/**
 * The mission state: what the crew has planned. It is saved on the device, so closing the app
 * or reloading the page keeps the plan.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  pauseClock,
  resumeClock,
  startClock,
  withRate,
  elapsedSeconds,
  type WalkClock,
} from '@/mission/clock';
import type { LatLon } from '@/mission/geo';
import { returnPlan, walkHoursPlayed } from '@/mission/progress';
import { MAX_STOP_MINUTES, type WalkStop } from '@/mission/walk';

type MissionState = {
  /** The waypoints of the planned walk at each site, in walking order. */
  routes: Record<string, WalkStop[]>;
  addWaypoint: (siteId: string, point: WalkStop) => void;
  removeLastWaypoint: (siteId: string) => void;
  /** Takes one waypoint out of the route, wherever it is in it. */
  removeWaypoint: (siteId: string, index: number) => void;
  /** Puts a waypoint somewhere else. A place with a published name is no longer that place. */
  moveWaypoint: (siteId: string, index: number, point: LatLon) => void;
  /** Changes the work at a stop: how long it takes and what it is. */
  updateWaypoint: (siteId: string, index: number, change: StopChange) => void;
  /** Replaces the whole route: a plan opened from a link, or a way round steep ground. */
  setRoute: (siteId: string, stops: readonly WalkStop[]) => void;
  clearRoute: (siteId: string) => void;
  /**
   * The sites whose walk in progress has been turned for the base. The rest of the plan was
   * replaced by the way back, and the console and the visor say so.
   */
  returning: Record<string, true>;
  /** Replaces the rest of the walk in progress with the shortest way back from where it is. */
  returnToBase: (siteId: string, base: LatLon) => void;
  /** Opacity (0..1) of each overlay layer that is on, by layer id. A layer that is off is absent. */
  overlays: Record<string, number>;
  toggleOverlay: (layerId: string) => void;
  setOverlayOpacity: (layerId: string, opacity: number) => void;
  /**
   * The sets of mission points that are switched off, by set id. A set is on unless it is listed,
   * so the published places are on the map from the first visit.
   */
  hiddenPoints: Record<string, true>;
  togglePoints: (setId: string) => void;
  /**
   * The clock of the walk in progress at each site. The ship console is the only screen that
   * changes it; the visor reads it. A site without a walk has no entry.
   */
  clocks: Record<string, WalkClock>;
  startWalk: (siteId: string) => void;
  pauseWalk: (siteId: string) => void;
  resumeWalk: (siteId: string) => void;
  setWalkRate: (siteId: string, rate: number) => void;
  endWalk: (siteId: string) => void;
};

/** What can be changed about the work at a stop. An empty task takes the task away. */
export type StopChange = { minutes?: number; task?: string };

/** A step of the buttons that lengthen and shorten a stop, in minutes. */
export const STOP_STEP_MINUTES = 5;

/** An overlay comes on see-through enough to keep the ground visible under it. */
export const DEFAULT_OVERLAY_OPACITY = 0.5;

/** More waypoints than this is a mistake, not a plan. */
export const MAX_WAYPOINTS = 24;

const NO_WAYPOINTS: readonly WalkStop[] = [];
/** The longest task a stop keeps, in characters. */
const LONGEST_TASK = 200;

/** A record without one of its keys; the same record when it does not have the key. */
function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record;
  const { [key]: _gone, ...others } = record;
  return others;
}

export const useMission = create<MissionState>()(
  persist(
    (set) => ({
      routes: {},
      addWaypoint: (siteId, point) =>
        set((state) => {
          const route = state.routes[siteId] ?? [];
          // The route is locked while somebody is walking it.
          if (state.clocks[siteId] || route.length >= MAX_WAYPOINTS) return state;
          return { routes: { ...state.routes, [siteId]: [...route, point] } };
        }),
      removeLastWaypoint: (siteId) =>
        set((state) =>
          state.clocks[siteId]
            ? state
            : { routes: { ...state.routes, [siteId]: (state.routes[siteId] ?? []).slice(0, -1) } },
        ),
      removeWaypoint: (siteId, index) =>
        set((state) => {
          const route = state.routes[siteId] ?? [];
          if (state.clocks[siteId] || index < 0 || index >= route.length) return state;
          return {
            routes: { ...state.routes, [siteId]: route.filter((_, at) => at !== index) },
          };
        }),
      moveWaypoint: (siteId, index, point) =>
        set((state) => {
          const route = state.routes[siteId] ?? [];
          const stop = route[index];
          if (state.clocks[siteId] || !stop) return state;
          // The time and the task go with the stop. The name and the source belonged to the place
          // it was on, so they stay behind.
          const moved: WalkStop = { lat: point.lat, lon: point.lon };
          if (stop.minutes !== undefined) moved.minutes = stop.minutes;
          if (stop.task !== undefined) moved.task = stop.task;
          return {
            routes: {
              ...state.routes,
              [siteId]: route.map((entry, at) => (at === index ? moved : entry)),
            },
          };
        }),
      updateWaypoint: (siteId, index, change) =>
        set((state) => {
          const route = state.routes[siteId] ?? [];
          const stop = route[index];
          if (state.clocks[siteId] || !stop) return state;
          const next: WalkStop = { ...stop };
          if (change.minutes !== undefined && Number.isFinite(change.minutes)) {
            next.minutes = Math.min(MAX_STOP_MINUTES, Math.max(0, Math.round(change.minutes)));
          }
          if (change.task !== undefined) {
            const task = change.task.slice(0, LONGEST_TASK);
            if (task.trim() === '') delete next.task;
            else next.task = task;
          }
          return {
            routes: {
              ...state.routes,
              [siteId]: route.map((entry, at) => (at === index ? next : entry)),
            },
          };
        }),
      setRoute: (siteId, stops) =>
        set((state) =>
          state.clocks[siteId]
            ? state
            : { routes: { ...state.routes, [siteId]: stops.slice(0, MAX_WAYPOINTS) } },
        ),
      clearRoute: (siteId) =>
        set((state) =>
          state.clocks[siteId] ? state : { routes: { ...state.routes, [siteId]: [] } },
        ),
      returning: {},
      returnToBase: (siteId, base) =>
        set((state) => {
          const clock = state.clocks[siteId];
          const route = state.routes[siteId] ?? [];
          if (!clock || route.length === 0 || state.returning[siteId]) return state;
          const hours = walkHoursPlayed(base, route, elapsedSeconds(clock, Date.now()) / 3600);
          return {
            routes: { ...state.routes, [siteId]: returnPlan(base, route, hours) },
            returning: { ...state.returning, [siteId]: true },
          };
        }),
      clocks: {},
      startWalk: (siteId) =>
        set((state) =>
          (state.routes[siteId] ?? []).length === 0
            ? state
            : {
                clocks: { ...state.clocks, [siteId]: startClock(Date.now()) },
                returning: without(state.returning, siteId),
              },
        ),
      pauseWalk: (siteId) =>
        set((state) => {
          const clock = state.clocks[siteId];
          return clock
            ? { clocks: { ...state.clocks, [siteId]: pauseClock(clock, Date.now()) } }
            : state;
        }),
      resumeWalk: (siteId) =>
        set((state) => {
          const clock = state.clocks[siteId];
          return clock
            ? { clocks: { ...state.clocks, [siteId]: resumeClock(clock, Date.now()) } }
            : state;
        }),
      setWalkRate: (siteId, rate) =>
        set((state) => {
          const clock = state.clocks[siteId];
          return clock
            ? { clocks: { ...state.clocks, [siteId]: withRate(clock, rate, Date.now()) } }
            : state;
        }),
      endWalk: (siteId) =>
        set((state) => {
          const { [siteId]: _ended, ...others } = state.clocks;
          return { clocks: others, returning: without(state.returning, siteId) };
        }),
      overlays: {},
      toggleOverlay: (layerId) =>
        set((state) => {
          const { [layerId]: current, ...others } = state.overlays;
          return {
            overlays:
              current === undefined ? { ...others, [layerId]: DEFAULT_OVERLAY_OPACITY } : others,
          };
        }),
      setOverlayOpacity: (layerId, opacity) =>
        set((state) => ({
          overlays: { ...state.overlays, [layerId]: Math.min(1, Math.max(0, opacity)) },
        })),
      hiddenPoints: {},
      togglePoints: (setId) =>
        set((state) => {
          const { [setId]: hidden, ...others } = state.hiddenPoints;
          return { hiddenPoints: hidden ? others : { ...others, [setId]: true } };
        }),
    }),
    {
      name: 'armstrong-maps.mission', // MISSION_STORAGE_KEY
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        routes: state.routes,
        overlays: state.overlays,
        hiddenPoints: state.hiddenPoints,
        clocks: state.clocks,
        returning: state.returning,
      }),
      // The saved plan is read after the first render, in the root layout, so the page that was
      // rendered ahead of time and the first render in the browser are the same.
      skipHydration: true,
    },
  ),
);

/** The name the state is saved under. Other tabs watch this key to follow the ship. */
export const MISSION_STORAGE_KEY = 'armstrong-maps.mission';
/**
 * Where a visor that has just finished loading says so, for the console in the other tab that is
 * waiting to start the walk. The value is the site and the moment, so that it changes every time.
 */
export const VISOR_READY_KEY = 'armstrong-maps.visor-ready';

/** The waypoints of one site. The empty list is always the same object, so nothing re-renders. */
export function useRoute(siteId: string): readonly WalkStop[] {
  return useMission((state) => state.routes[siteId] ?? NO_WAYPOINTS);
}
