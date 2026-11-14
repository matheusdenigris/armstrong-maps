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
  type WalkClock,
} from '@/mission/clock';
import type { LatLon } from '@/mission/geo';

type MissionState = {
  /** The waypoints of the planned walk at each site, in walking order. */
  routes: Record<string, LatLon[]>;
  addWaypoint: (siteId: string, point: LatLon) => void;
  removeLastWaypoint: (siteId: string) => void;
  clearRoute: (siteId: string) => void;
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

/** An overlay comes on see-through enough to keep the ground visible under it. */
export const DEFAULT_OVERLAY_OPACITY = 0.5;

/** More waypoints than this is a mistake, not a plan. */
export const MAX_WAYPOINTS = 24;

const NO_WAYPOINTS: readonly LatLon[] = [];

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
      clearRoute: (siteId) =>
        set((state) =>
          state.clocks[siteId] ? state : { routes: { ...state.routes, [siteId]: [] } },
        ),
      clocks: {},
      startWalk: (siteId) =>
        set((state) =>
          (state.routes[siteId] ?? []).length === 0
            ? state
            : { clocks: { ...state.clocks, [siteId]: startClock(Date.now()) } },
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
          return { clocks: others };
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
export function useRoute(siteId: string): readonly LatLon[] {
  return useMission((state) => state.routes[siteId] ?? NO_WAYPOINTS);
}
