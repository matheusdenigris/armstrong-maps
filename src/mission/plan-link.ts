/**
 * A walk plan as a piece of text short enough for a link, and back. The link carries the plan
 * itself, so opening it on another device draws the same route: nothing is kept on a server.
 *
 * The text is "1" (the version of this format) and then one part a stop, joined by "~". A part
 * is the latitude, the longitude, the minutes of work, the name, the task and the source, joined
 * by "_"; what a stop does not have is left empty, and empty parts at the end are dropped.
 * Positions keep six decimals, about six centimetres on Mars. Names, tasks and sources are
 * written the way a web address writes text.
 */
import type { WalkStop } from './walk';
import { MAX_STOP_MINUTES } from './walk';

const VERSION = '1';
/** More stops than this is not a plan the app would have made. */
const MOST_STOPS = 24;
/** The longest a name, a task or a source may be once read from a link. */
const LONGEST_TEXT = 200;

const sixDecimals = (value: number) => String(Math.round(value * 1e6) / 1e6);
// A web address already uses "~" and "_" as plain characters, so they are written out.
const write = (text: string | undefined) =>
  text ? encodeURIComponent(text).replace(/~/g, '%7E').replace(/_/g, '%5F') : '';

/** The plan as text for a link. An empty plan is an empty text. */
export function encodePlan(stops: readonly WalkStop[]): string {
  if (stops.length === 0) return '';
  const parts = stops.map((stop) => {
    const fields = [
      sixDecimals(stop.lat),
      sixDecimals(stop.lon),
      typeof stop.minutes === 'number' ? String(Math.round(stop.minutes * 10) / 10) : '',
      write(stop.name),
      write(stop.task),
      write(stop.source),
    ];
    while (fields.length > 2 && fields[fields.length - 1] === '') fields.pop();
    return fields.join('_');
  });
  return [VERSION, ...parts].join('~');
}

function read(text: string | undefined): string | undefined {
  if (!text) return undefined;
  try {
    const plain = decodeURIComponent(text).trim().slice(0, LONGEST_TEXT);
    return plain === '' ? undefined : plain;
  } catch {
    // Not text a web address could have carried: the stop goes without it.
    return undefined;
  }
}

/**
 * Reads a plan from the text of a link. Null when the text is not a plan this version wrote: a
 * link that was cut short or edited by hand must not put a wrong route on the map.
 */
export function decodePlan(text: string | null | undefined): WalkStop[] | null {
  if (typeof text !== 'string' || text === '') return null;
  const [version, ...parts] = text.split('~');
  if (version !== VERSION || parts.length === 0 || parts.length > MOST_STOPS) return null;
  const stops: WalkStop[] = [];
  for (const part of parts) {
    const [latText, lonText, minutesText, name, task, source] = part.split('_');
    if (!latText || !lonText) return null;
    const lat = Number(latText);
    const lon = Number(lonText);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    const stop: WalkStop = { lat, lon };
    if (minutesText) {
      const minutes = Number(minutesText);
      if (!Number.isFinite(minutes) || minutes < 0 || minutes > MAX_STOP_MINUTES) return null;
      stop.minutes = minutes;
    }
    const readName = read(name);
    const readTask = read(task);
    const readSource = read(source);
    if (readName) stop.name = readName;
    if (readTask) stop.task = readTask;
    if (readSource) stop.source = readSource;
    stops.push(stop);
  }
  return stops;
}

/** True when two plans are the same route with the same work: what a shared link must reproduce. */
export function samePlan(one: readonly WalkStop[], other: readonly WalkStop[]): boolean {
  return encodePlan(one) === encodePlan(other);
}
