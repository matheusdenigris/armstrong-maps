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
import {
  withAcknowledged,
  withMessage,
  withShown,
  type ShipMessage,
} from '@/mission/messages';
import type { LogEntry } from '@/mission/walk-log';

/** Whether the base and the crew member can reach each other, as the ship works it out. */
export type LinkState = 'clear' | 'blocked';

/** The record of the last walk at a site, kept after it ends so it can be read and exported. */
export type SavedLog = {
  /** When the walk started and ended, on the wall clock, in milliseconds since the epoch. */
  startedMs: number | null;
  endedMs: number;
  /** How many waypoints the route had. */
  stops: number;
  entries: LogEntry[];
};

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
  /**
   * Ends the walk. The ship passes the log of the walk as it stands, which is kept as the
   * record of the last walk at the site.
   */
  endWalk: (siteId: string, entries?: LogEntry[], stops?: number) => void;
  /** When the walk in progress at each site started, on the wall clock. */
  started: Record<string, number>;
  /**
   * The messages of the walk in progress at each site. The ship sends them; the visor marks
   * them shown and acknowledged, which is the one thing it writes.
   */
  messages: Record<string, readonly ShipMessage[]>;
  sendMessage: (siteId: string, text: string, atHours: number) => void;
  showMessages: (siteId: string, atHours: number) => void;
  acknowledgeMessage: (siteId: string, id: string, atHours: number) => void;
  /**
   * The radio link at each site, as the ship console works it out from the terrain. A site
   * where it cannot be told has no entry.
   */
  links: Record<string, LinkState>;
  setLink: (siteId: string, link: LinkState | null) => void;
  /** The record of the last walk that ended at each site. */
  logs: Record<string, SavedLog>;
};

/** An overlay comes on see-through enough to keep the ground visible under it. */
export const DEFAULT_OVERLAY_OPACITY = 0.5;

/** More waypoints than this is a mistake, not a plan. */
export const MAX_WAYPOINTS = 24;

const NO_WAYPOINTS: readonly LatLon[] = [];
const NO_MESSAGES: readonly ShipMessage[] = [];

/** A record without one of its keys. */
function without<Value>(record: Record<string, Value>, key: string): Record<string, Value> {
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
      clearRoute: (siteId) =>
        set((state) =>
          state.clocks[siteId] ? state : { routes: { ...state.routes, [siteId]: [] } },
        ),
      clocks: {},
      startWalk: (siteId) =>
        set((state) =>
          (state.routes[siteId] ?? []).length === 0
            ? state
            : {
                clocks: { ...state.clocks, [siteId]: startClock(Date.now()) },
                started: { ...state.started, [siteId]: Date.now() },
                // A new walk starts with nothing said and nothing known about the link.
                messages: without(state.messages, siteId),
                links: without(state.links, siteId),
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
      endWalk: (siteId, entries, stops) =>
        set((state) => {
          if (!state.clocks[siteId]) return state;
          return {
            clocks: without(state.clocks, siteId),
            started: without(state.started, siteId),
            links: without(state.links, siteId),
            logs: entries
              ? {
                  ...state.logs,
                  [siteId]: {
                    startedMs: state.started[siteId] ?? null,
                    endedMs: Date.now(),
                    stops: stops ?? (state.routes[siteId] ?? []).length,
                    entries,
                  },
                }
              : state.logs,
          };
        }),
      started: {},
      messages: {},
      sendMessage: (siteId, text, atHours) =>
        set((state) => {
          // Only a walk in progress has anyone to talk to.
          if (!state.clocks[siteId]) return state;
          const list = state.messages[siteId] ?? NO_MESSAGES;
          const id = `${Date.now().toString(36)}-${list.length}`;
          const next = withMessage(list, id, text, atHours);
          return next === list ? state : { messages: { ...state.messages, [siteId]: next } };
        }),
      showMessages: (siteId, atHours) =>
        set((state) => {
          const list = state.messages[siteId] ?? NO_MESSAGES;
          const next = withShown(list, atHours);
          return next === list ? state : { messages: { ...state.messages, [siteId]: next } };
        }),
      acknowledgeMessage: (siteId, id, atHours) =>
        set((state) => {
          const list = state.messages[siteId] ?? NO_MESSAGES;
          const next = withAcknowledged(list, id, atHours);
          return next === list ? state : { messages: { ...state.messages, [siteId]: next } };
        }),
      links: {},
      setLink: (siteId, link) =>
        set((state) => {
          if ((state.links[siteId] ?? null) === link) return state;
          return {
            links: link ? { ...state.links, [siteId]: link } : without(state.links, siteId),
          };
        }),
      logs: {},
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
        started: state.started,
        messages: state.messages,
        links: state.links,
        logs: state.logs,
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

/** The messages of the walk at one site. The empty list is always the same object. */
export function useMessages(siteId: string): readonly ShipMessage[] {
  return useMission((state) => state.messages[siteId] ?? NO_MESSAGES);
}

/** The waypoints of one site. The empty list is always the same object, so nothing re-renders. */
export function useRoute(siteId: string): readonly LatLon[] {
  return useMission((state) => state.routes[siteId] ?? NO_WAYPOINTS);
}
