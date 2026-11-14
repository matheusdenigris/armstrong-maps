import AsyncStorage from '@react-native-async-storage/async-storage';
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
 * Keeps a parsed answer on the device, for a feed with a tight rate limit. One entry per `key`,
 * so old answers do not pile up: an entry for another address is ignored and replaced.
 */
export type FeedCache = {
  /** A short name for the feed, unique in the app. */
  key: string;
  /** How long an answer is used without asking again. */
  freshForHours: number;
};

type Saved<T> = { url: string; savedAt: number; data: T };

const storageKey = (cache: FeedCache) => `feed-cache:${cache.key}`;

/** The saved answer for this address, fresh or not; null when there is none or storage fails. */
async function readSaved<T>(cache: FeedCache, url: string): Promise<Saved<T> | null> {
  try {
    const text = await AsyncStorage.getItem(storageKey(cache));
    const saved = text ? (JSON.parse(text) as Saved<T>) : null;
    return saved?.url === url && typeof saved.savedAt === 'number' ? saved : null;
  } catch {
    return null;
  }
}

function save<T>(cache: FeedCache, url: string, data: T) {
  const saved: Saved<T> = { url, savedAt: Date.now(), data };
  AsyncStorage.setItem(storageKey(cache), JSON.stringify(saved)).catch(() => {});
}

/**
 * Fetches a JSON feed and parses it. Pass null as the address to wait (for a panel that is
 * closed, say). `parse` must be the same function on every render.
 *
 * With `cache`, a fresh answer saved on the device is used without asking, and when the feed
 * does not answer, the last answer for the same address is used instead of a gap. Only addresses
 * that pin their own time span (such as a date range) should be cached this way, so an old
 * answer is never shown as a newer one.
 */
export function useFeed<T>(
  url: string | null,
  parse: (raw: unknown) => T,
  cache?: FeedCache,
): Feed<T> {
  const [result, setResult] = useState<{ url: string; feed: Feed<T> } | null>(null);
  const cacheKey = cache?.key;
  const freshForHours = cache?.freshForHours;

  useEffect(() => {
    if (!url) return;
    let current = true;
    const settle = (feed: Feed<T>) => {
      if (current) setResult({ url, feed });
    };
    const options = cacheKey && freshForHours ? { key: cacheKey, freshForHours } : null;

    void (async () => {
      const saved = options ? await readSaved<T>(options, url) : null;
      if (options && saved && Date.now() - saved.savedAt < options.freshForHours * 3_600_000) {
        settle({ status: 'ready', data: saved.data });
        return;
      }
      try {
        const data = parse(await request(url));
        if (options) save(options, url, data);
        settle({ status: 'ready', data });
      } catch {
        settle(saved ? { status: 'ready', data: saved.data } : FAILED);
      }
    })();

    return () => {
      current = false;
    };
  }, [url, parse, cacheKey, freshForHours]);

  if (!url) return IDLE;
  return result?.url === url ? result.feed : LOADING;
}
