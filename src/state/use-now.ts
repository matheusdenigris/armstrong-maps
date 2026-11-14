import { useEffect, useState } from 'react';

/**
 * The time on the wall clock, refreshed while `ticking` is true. Screens that follow a walk in
 * progress use it to redraw; when nothing is moving they do not tick at all.
 */
export function useNow(ticking: boolean, everyMs = 250): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [ticking, everyMs]);

  return now;
}
