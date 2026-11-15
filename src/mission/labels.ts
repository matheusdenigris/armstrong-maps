/**
 * Where the label of each mark on the map goes, so that no label covers another label or
 * another mark.
 *
 * A label sits to the right of its mark by habit. Marks that are close (the base, the astronaut
 * who has just left it, the first waypoint) would stack their labels on each other, so each
 * label in turn takes the first free spot around its mark: right, left, below, above, then
 * further out below. Labels are placed in the order given, so the first ones keep their spot and
 * the later ones move: put the marks that stay still first.
 */
import type { Pixel } from './camera';

export type LabelRequest = {
  id: string;
  /** The mark the label belongs to, on screen. */
  at: Pixel;
  /** The size of the label as drawn. */
  width: number;
  height: number;
};

export type LabelSide = 'right' | 'left' | 'below' | 'above';

export type LabelPlace = {
  side: LabelSide;
  /** Top left corner of the label, on screen. */
  left: number;
  top: number;
};

type Box = { left: number; top: number; right: number; bottom: number };

/** The diameter of a mark, and the room between it and its label. */
export const MARK_SIZE = 14;
export const LABEL_GAP = 8;
/** Room kept between two labels. */
const CLEARANCE = 3;
/** How many rows further down a label may go before it is put there anyway. */
const ROWS_DOWN = 8;

const overlaps = (a: Box, b: Box) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const grow = (box: Box, by: number): Box => ({
  left: box.left - by,
  top: box.top - by,
  right: box.right + by,
  bottom: box.bottom + by,
});

const markBox = (at: Pixel): Box => ({
  left: at.x - MARK_SIZE / 2,
  top: at.y - MARK_SIZE / 2,
  right: at.x + MARK_SIZE / 2,
  bottom: at.y + MARK_SIZE / 2,
});

/** The spots a label may take around its mark, the preferred one first. */
function candidates({ at, width, height }: LabelRequest): LabelPlace[] {
  const reach = MARK_SIZE / 2 + LABEL_GAP;
  const middle = at.y - height / 2;
  const centred = at.x - width / 2;
  const spots: LabelPlace[] = [
    { side: 'right', left: at.x + reach, top: middle },
    { side: 'left', left: at.x - reach - width, top: middle },
    { side: 'below', left: centred, top: at.y + reach },
    { side: 'above', left: centred, top: at.y - reach - height },
  ];
  // Then down the right side and down the middle, a row at a time.
  for (let row = 1; row <= ROWS_DOWN; row += 1) {
    const drop = row * (height + CLEARANCE);
    spots.push({ side: 'right', left: at.x + reach, top: middle + drop });
    spots.push({ side: 'below', left: centred, top: at.y + reach + drop });
  }
  return spots;
}

/**
 * A place for every label, by id. A label never covers a label placed before it, nor the mark
 * of another label. When every spot is taken, which needs more than a dozen marks on one point,
 * the last one tried is used.
 */
export function placeLabels(requests: readonly LabelRequest[]): Map<string, LabelPlace> {
  const places = new Map<string, LabelPlace>();
  const taken: Box[] = [];
  for (const request of requests) {
    const marks = requests
      .filter((other) => other.id !== request.id)
      .map((other) => markBox(other.at));
    const spots = candidates(request);
    const boxOf = (spot: LabelPlace): Box => ({
      left: spot.left,
      top: spot.top,
      right: spot.left + request.width,
      bottom: spot.top + request.height,
    });
    const free = spots.find((spot) => {
      const box = grow(boxOf(spot), CLEARANCE);
      return !taken.some((other) => overlaps(box, other)) && !marks.some((mark) => overlaps(box, mark));
    });
    const chosen = free ?? spots[spots.length - 1];
    places.set(request.id, chosen);
    taken.push(boxOf(chosen));
  }
  return places;
}
