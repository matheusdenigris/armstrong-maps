import { describe, expect, it } from 'vitest';

import { LABEL_GAP, MARK_SIZE, placeLabels, type LabelRequest } from './labels';

const label = (id: string, x: number, y: number, width = 120, height = 24): LabelRequest => ({
  id,
  at: { x, y },
  width,
  height,
});

const boxes = (requests: LabelRequest[]) => {
  const places = placeLabels(requests);
  return requests.map((request) => {
    const place = places.get(request.id)!;
    return {
      id: request.id,
      left: place.left,
      top: place.top,
      right: place.left + request.width,
      bottom: place.top + request.height,
    };
  });
};

const overlap = (
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const noneOverlap = (requests: LabelRequest[]) => {
  const drawn = boxes(requests);
  for (let i = 0; i < drawn.length; i += 1) {
    for (let j = i + 1; j < drawn.length; j += 1) {
      if (overlap(drawn[i], drawn[j])) return false;
    }
  }
  return true;
};

describe('placeLabels', () => {
  it('puts a label on its own to the right of its mark, level with it', () => {
    const place = placeLabels([label('base', 200, 300)]).get('base')!;

    expect(place.side).toBe('right');
    expect(place.left).toBe(200 + MARK_SIZE / 2 + LABEL_GAP);
    expect(place.top).toBe(300 - 12);
  });

  it('leaves labels that are far apart where they are', () => {
    const places = placeLabels([label('base', 100, 100), label('rover', 600, 500)]);

    expect(places.get('base')!.side).toBe('right');
    expect(places.get('rover')!.side).toBe('right');
  });

  it('moves the second of two labels on the same point, and keeps the first', () => {
    const requests = [label('base', 300, 300, 160), label('astronaut', 300, 300, 110)];
    const places = placeLabels(requests);

    expect(places.get('base')!.side).toBe('right');
    expect(places.get('astronaut')!.side).not.toBe('right');
    expect(noneOverlap(requests)).toBe(true);
  });

  it('keeps every label apart at the start of a walk, when four marks are close', () => {
    const requests = [
      label('base', 300, 300, 160),
      label('waypoint-1', 318, 292, 30),
      label('waypoint-2', 330, 310, 30),
      label('astronaut', 302, 301, 110),
    ];

    expect(noneOverlap(requests)).toBe(true);
  });

  it('does not lay a label over the mark of another', () => {
    // The second mark sits where the label of the first would go.
    const requests = [label('base', 300, 300, 160), label('waypoint-1', 360, 300, 30)];
    const [base] = boxes(requests);
    const mark = { left: 353, top: 293, right: 367, bottom: 307 };

    expect(overlap(base, mark)).toBe(false);
  });

  it('still finds a place for a dozen labels on one point', () => {
    const requests = Array.from({ length: 12 }, (_, index) => label(`m${index}`, 400, 200, 90));

    expect(placeLabels(requests).size).toBe(12);
    expect(noneOverlap(requests)).toBe(true);
  });
});
