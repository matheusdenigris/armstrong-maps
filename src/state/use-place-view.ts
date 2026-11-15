import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import {
  PLACE_FEEDS,
  PLACE_TRIES,
  clearAhead,
  placeFramesUrl,
  placeViewOf,
  stopsNear,
  type PlaceView,
} from '@/data/place-views';
import { ROVERS, parseRoverTrack, type RoverStop } from '@/data/rover';
import type { Rover, Site } from '@/data/sites';
import type { LatLon } from '@/mission/geo';

import { useFeed } from './use-feed';

/** One request for each sol, shared by the stops of that sol. */
const sols = new Map<string, Promise<unknown>>();
/** One answer for each stop, for the life of the page. */
const views = new Map<string, Promise<PlaceView | null>>();

function framesOfSol(url: string): Promise<unknown> {
  let pending = sols.get(url);
  if (!pending) {
    pending = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`The feed answered ${response.status}`);
      return response.json();
    });
    // A failure is not remembered, so the next walk past the stop asks again.
    pending.catch(() => sols.delete(url));
    sols.set(url, pending);
  }
  return pending;
}

/** Resolves once the browser can paint the picture; rejects when it cannot get it. */
function painted(url: string): Promise<void> {
  const picture = new Image();
  picture.src = url;
  return picture.decode();
}

/**
 * The view from a stop, with its frames already in the browser, or null when the stop has no
 * frames that go all the way round or one of them does not arrive.
 */
function viewOf(rover: Rover, stop: RoverStop): Promise<PlaceView | null> {
  const key = `${rover}-${stop.site}-${stop.drive}`;
  let pending = views.get(key);
  if (!pending) {
    const url = placeFramesUrl(rover, stop.sol);
    pending = !url
      ? Promise.resolve(null)
      : framesOfSol(url)
          .then(async (raw) => {
            const view = placeViewOf(rover, stop, raw);
            if (!view) return null;
            await Promise.all(view.frames.map((frame) => painted(frame.url)));
            return view;
          })
          .catch(() => {
            views.delete(key);
            return null;
          });
    views.set(key, pending);
  }
  return pending;
}

export type PlaceLookup = {
  /**
   * The view of the place, or null when no rover of this site publishes what it takes, when none
   * stopped near, or while the first answer is on its way.
   */
  view: PlaceView | null;
  /** The first answer is in, one way or the other: there is no view still on its way to wait for. */
  settled: boolean;
};

/**
 * The real view of the place the astronaut is at: the frames the rover took at the stop nearest
 * to `position`, when it stopped within reach and looked all the way round there. While a new
 * place loads, the last one stays.
 *
 * Of the stops within reach, the nearest whose view along `facing` is clear of the rover is
 * taken; when the rover is in the way at every one, the nearest.
 *
 * Only in the browser: the view that wraps the frames round the astronaut is drawn there.
 */
export function usePlaceView(
  site: Site,
  position: LatLon | null,
  facing: number,
): PlaceLookup {
  const rover = site.rover && PLACE_FEEDS[site.rover] && Platform.OS === 'web' ? site.rover : null;
  const track = useFeed(rover ? ROVERS[rover].feed : null, parseRoverTrack);
  const stops = track.status === 'ready' ? track.data.stops : null;
  const lat = position?.lat ?? null;
  const lon = position?.lon ?? null;

  const [found, setFound] = useState<{ site: string; view: PlaceView | null } | null>(null);

  useEffect(() => {
    if (!rover || !stops || lat === null || lon === null) return;
    let current = true;
    const near = stopsNear(
      stops.filter((stop) => stop.site !== null && stop.drive !== null),
      { lat, lon },
    ).slice(0, PLACE_TRIES);
    void (async () => {
      let nearest: PlaceView | null = null;
      for (const { stop } of near) {
        const view = await viewOf(rover, stop);
        if (!current) return;
        if (!view) continue;
        if (clearAhead(view, facing)) {
          setFound({ site: site.id, view });
          return;
        }
        nearest ??= view;
      }
      setFound({ site: site.id, view: nearest });
    })();
    return () => {
      current = false;
    };
  }, [rover, stops, lat, lon, facing, site.id]);

  const answered = found !== null && found.site === site.id;
  return {
    view: answered ? found.view : null,
    // With no rover to ask, or a traverse that did not come, there is nothing to wait for.
    settled: answered || !rover || track.status === 'failed',
  };
}
