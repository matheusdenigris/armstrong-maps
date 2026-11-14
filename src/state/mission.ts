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
};

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
    }),
    {
      name: 'armstrong-maps.mission',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ routes: state.routes }),
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
