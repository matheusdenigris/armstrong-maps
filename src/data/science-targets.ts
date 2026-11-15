/**
 * Science targets: places inside a site where a mission did science, which a walk can be planned
 * through.
 *
 * At Jezero they are the places NASA publishes with coordinates (`mission-points.ts`): where
 * Perseverance took each sample, the Three Forks depot and the helicopter's airfields.
 *
 * At Gale NASA publishes no such list, so each target here is a named place of the Curiosity
 * mission with the sol the rover worked there, from a NASA page that says so. Its position is not
 * typed in: it is where NASA's location feed puts the rover on that sol (`positionOnSol`).
 *
 * What was done at a place is published. What the crew could do there (the "suggested task") is
 * a suggestion of this project, and the interface labels it so.
 */
import type { WalkStop } from '@/mission/walk';

import type { MissionPoint, PointSet, PointSetId } from './mission-points';
import { positionOnSol, type RoverTrack } from './rover';

export type ScienceTarget = {
  id: string;
  name: string;
  /** A sol on which Curiosity stood at the place. */
  sol: number;
  /** What the rover did there, as NASA tells it. */
  what: string;
  /** The NASA page that says so. */
  source: string;
  reference: string;
  /** What the crew could do there. A suggestion of this project. */
  task: string;
};

const SAMPLING_SITES = {
  source: "NASA/JPL-Caltech, Curiosity's First 16 Rock or Soil Sampling Sites on Mars (PIA20845)",
  reference:
    'https://www.jpl.nasa.gov/images/pia20845-curiositys-first-16-rock-or-soil-sampling-sites-on-mars/',
};
const JOURNEY_POSTER = {
  source: 'NASA, Curiosity poster of the journey to Mount Sharp',
  reference: 'https://mars.nasa.gov/files/mep/CuriosityPoster-small.pdf',
};

/** Checked on 2026-11-15 against the pages named in each entry. */
export const GALE_TARGETS: readonly ScienceTarget[] = [
  {
    id: 'rocknest',
    name: 'Rocknest',
    sol: 60,
    what: 'Curiosity scooped soil here: the first of its sampling sites.',
    ...SAMPLING_SITES,
    task: 'Photograph the scoop marks and sample the soil beside them.',
  },
  {
    id: 'john-klein',
    name: 'Yellowknife Bay · John Klein',
    sol: 182,
    what: 'Curiosity drilled its first rock sample here on sol 182 (8 February 2013).',
    ...SAMPLING_SITES,
    task: 'Photograph the drill hole and the rock around it.',
  },
  {
    id: 'darwin',
    name: 'Darwin',
    sol: 392,
    what: 'A waypoint on the way to Mount Sharp where Curiosity stopped to study the rocks, reached on sol 392.',
    ...JOURNEY_POSTER,
    task: 'Photograph the outcrop and collect a rock from it.',
  },
  {
    id: 'cooperstown',
    name: 'Cooperstown',
    sol: 440,
    what: 'A waypoint on the way to Mount Sharp, reached on sol 440.',
    ...JOURNEY_POSTER,
    task: 'Photograph the outcrop and collect a rock from it.',
  },
  {
    id: 'kimberley',
    name: 'The Kimberley · Windjana',
    sol: 621,
    what: 'Curiosity drilled the sandstone target Windjana here on sol 621 (5 May 2014).',
    source: "NASA, Sample-Collection Drill Hole on Martian Sandstone Target 'Windjana'",
    reference:
      'https://www.nasa.gov/image-article/sample-collection-drill-hole-martian-sandstone-target-windjana/',
    task: 'Photograph the drill hole and the sandstone layers around it.',
  },
];

/**
 * The Gale targets as marks for the map, each where the location feed puts the rover on its sol.
 * A target the feed has no position for is left off the map.
 */
export function galeTargetPoints(track: RoverTrack): MissionPoint[] {
  return GALE_TARGETS.flatMap((target) => {
    const point = positionOnSol(track, target.sol);
    if (!point) return [];
    return [
      {
        id: `target-${target.id}`,
        set: 'targets' as const,
        point,
        name: target.name,
        lines: [target.what, `Where the rover stood on sol ${target.sol}`],
        source: target.source,
        task: target.task,
      },
    ];
  });
}

/** What the crew could do at a place of each set, when the place has no task of its own. */
const SET_TASKS: Readonly<Record<PointSetId, string>> = {
  targets: 'Photograph the place and collect a rock from it.',
  samples: 'Photograph the outcrop Perseverance sampled and collect a rock from beside the hole.',
  depot: 'Inspect the sample tube on the ground and photograph it.',
  flights: 'Photograph the ground where the helicopter landed.',
};

/** The task this project suggests at a published place. */
export function suggestedTask(point: MissionPoint): string {
  return point.task ?? SET_TASKS[point.set];
}

/**
 * A published place as a stop of the walk: it keeps its name, takes the suggested task and says
 * where it comes from.
 */
export function stopAt(point: MissionPoint, set: PointSet): WalkStop {
  return {
    lat: point.point.lat,
    lon: point.point.lon,
    name: point.name,
    task: suggestedTask(point),
    source: point.source ?? set.source,
  };
}
