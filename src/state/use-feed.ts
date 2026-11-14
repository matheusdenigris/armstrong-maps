import { useEffect, useState } from 'react';

/**
 * A live source that may be slow, or may not answer. The interface shows each state as it is:
 * a gap is shown as a gap, never filled with a made-up value.
 */
export type Feed<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'failed' };

const IDLE = { status: 'idle' } as const;
const LOADING = { status: 'loading' } as const;
const FAILED = { status: 'failed' } as const;

/** One request per address for the life of the page, shared by every screen that asks. */
const requests = new Map<string, Promise<unknown>>();

function request(url: string): Promise<unknown> {
  let pending = requests.get(url);
  if (!pending) {
    pending = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`The feed answered ${response.status}`);
      return response.json();
    });
    // A failure is not remembered, so the next screen that asks tries again.
    pending.catch(() => requests.delete(url));
    requests.set(url, pending);
  }
  return pending;
}

/**
 * Fetches a JSON feed and parses it. Pass null as the address to wait (for a panel that is
 * closed, say). `parse` must be the same function on every render.
 */
export function useFeed<T>(url: string | null, parse: (raw: unknown) => T): Feed<T> {
  const [result, setResult] = useState<{ url: string; feed: Feed<T> } | null>(null);

  useEffect(() => {
    if (!url) return;
    let current = true;
    request(url).then(
      (raw) => {
        if (current) setResult({ url, feed: { status: 'ready', data: parse(raw) } });
      },
      () => {
        if (current) setResult({ url, feed: FAILED });
      },
    );
    return () => {
      current = false;
    };
  }, [url, parse]);

  if (!url) return IDLE;
  return result?.url === url ? result.feed : LOADING;
}
