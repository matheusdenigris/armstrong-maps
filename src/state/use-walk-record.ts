import { useMemo } from 'react';

import { SURFACE_RADIATION } from '@/data/radiation';
import type { Site } from '@/data/sites';
import type { LatLon } from '@/mission/geo';
import { elevationAt, lineOfSight, type SightLine } from '@/mission/line-of-sight';
import type { ShipMessage } from '@/mission/messages';
import { walkLog, type LogEntry } from '@/mission/walk-log';

import type { Feed } from './use-feed';
import type { TerrainLayer } from './use-terrain';

/** What the ship knows about the line of sight: the line itself, or why there is none to give. */
export type Sight =
  | { status: 'ready'; line: SightLine; cellM: number }
  /** The elevation model has not arrived yet. */
  | { status: 'loading' }
  /** The model did not answer, or has no height at one of the two ends. */
  | { status: 'unknown' };

/** The log on screen is worked out again every this many seconds of walk time. */
const LOG_EVERY_S = 5;

/** The line from the base to a place, over the sharpest grid that has a height at both ends. */
function sightTo(
  grids: readonly TerrainLayer[],
  base: LatLon,
  place: LatLon,
): { line: SightLine; cellM: number } | null {
  for (const grid of grids) {
    if (elevationAt(grid.heights, base) === null || elevationAt(grid.heights, place) === null) {
      continue;
    }
    const line = lineOfSight(grid.heights, base, place);
    if (line) return { line, cellM: grid.slopes.cellM };
  }
  return null;
}

type WalkRecordInput = {
  site: Site;
  route: readonly LatLon[];
  /** A walk is in progress. */
  walking: boolean;
  /** Walk time so far, in hours, and where the astronaut is. */
  elapsedHours: number;
  position: LatLon | null;
  messages: readonly ShipMessage[];
  terrain: { near: Feed<TerrainLayer>; around: Feed<TerrainLayer> };
};

/**
 * What the ship keeps about a walk in progress: whether it sees the astronaut over the ground,
 * and the log so far. Both come from the plan and the elevation model, so they are worked out
 * here instead of being written down as the walk goes.
 */
export function useWalkRecord({
  site,
  route,
  walking,
  elapsedHours,
  position,
  messages,
  terrain,
}: WalkRecordInput) {
  const { near, around } = terrain;
  // The grid near the base first: it is the sharper one.
  const grids = useMemo(
    () => [near, around].flatMap((feed) => (feed.status === 'ready' ? [feed.data] : [])),
    [near, around],
  );
  const waiting = near.status === 'loading' || around.status === 'loading';

  const found = walking && position ? sightTo(grids, site.landing, position) : null;
  const sight: Sight = found
    ? { status: 'ready', ...found }
    : walking && waiting && grids.length === 0
      ? { status: 'loading' }
      : { status: 'unknown' };

  const options = useMemo(
    () => ({
      doseRateMsvPerDay: SURFACE_RADIATION.msvPerDay,
      messages,
      linkDownAt:
        grids.length > 0
          ? (place: LatLon) => {
              const to = sightTo(grids, site.landing, place);
              return to ? !to.line.clear : null;
            }
          : undefined,
    }),
    [grids, messages, site],
  );

  // Looking at the whole walk again on every draw would be wasteful: a few times a second is
  // more than a log needs.
  const tick = walking ? Math.floor((elapsedHours * 3600) / LOG_EVERY_S) : -1;
  const entries = useMemo<LogEntry[]>(
    () => (tick < 0 ? [] : walkLog(site.landing, route, (tick * LOG_EVERY_S) / 3600, options)),
    [tick, site, route, options],
  );

  /** The log as it stands at this very moment, for when the walk ends. */
  const closing = (endedEarly: boolean) =>
    walkLog(site.landing, route, elapsedHours, { ...options, endedEarly });

  return { sight, entries, closing };
}
