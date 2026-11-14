/**
 * The mission state: what the crew has planned. It is saved on the device, so closing the app
 * or reloading the page keeps the plan.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
          if (route.length >= MAX_WAYPOINTS) return state;
          return { routes: { ...state.routes, [siteId]: [...route, point] } };
        }),
      removeLastWaypoint: (siteId) =>
        set((state) => ({
          routes: { ...state.routes, [siteId]: (state.routes[siteId] ?? []).slice(0, -1) },
        })),
      clearRoute: (siteId) =>
        set((state) => ({ routes: { ...state.routes, [siteId]: [] } })),
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
          overlays: { ...state.overlays, [layerId]: Math.min(1, Math.max(0.05, opacity)) },
        })),
    }),
    {
      name: 'armstrong-maps.mission',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ routes: state.routes, overlays: state.overlays }),
      // The saved plan is read after the first render, in the root layout, so the page that was
      // rendered ahead of time and the first render in the browser are the same.
      skipHydration: true,
    },
  ),
);

/** The waypoints of one site. The empty list is always the same object, so nothing re-renders. */
export function useRoute(siteId: string): readonly LatLon[] {
  return useMission((state) => state.routes[siteId] ?? NO_WAYPOINTS);
}
