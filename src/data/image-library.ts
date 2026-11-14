/**
 * The NASA Image and Video Library (images.nasa.gov), searched through images-api.nasa.gov. No key
 * is needed. It gives archive pictures of every site, including the ones whose rover or lander has
 * gone quiet and has no live feed.
 */

export const IMAGE_LIBRARY_API = 'https://images-api.nasa.gov';

export function imageSearchUrl(query: string): string {
  return `${IMAGE_LIBRARY_API}/search?q=${encodeURIComponent(query)}&media_type=image`;
}

export type LibraryImage = {
  nasaId: string;
  title: string;
  /** YYYY-MM-DD. */
  dateCreated: string;
  /** The NASA centre that published it, for instance "JPL". */
  centre: string | null;
  /** The preview the search returns, a few hundred pixels wide. */
  thumbnail: string;
  /** The image's page on images.nasa.gov, with its full description and credit. */
  page: string;
};

type Entry = Record<string, unknown>;
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/** The first `limit` images of a search, in the order the library ranks them. */
export function parseImageSearch(raw: unknown, limit = 6): LibraryImage[] {
  const items = (raw as { collection?: { items?: unknown } } | null)?.collection?.items;
  if (!Array.isArray(items)) return [];
  const found: LibraryImage[] = [];
  for (const item of items as Entry[]) {
    const data = (Array.isArray(item?.data) ? item.data[0] : null) as Entry | null;
    const preview = (Array.isArray(item?.links) ? item.links[0] : null) as Entry | null;
    const nasaId = text(data?.nasa_id);
    const thumbnail = text(preview?.href);
    if (!nasaId || !thumbnail || data?.media_type !== 'image') continue;
    found.push({
      nasaId,
      title: text(data?.title) ?? nasaId,
      dateCreated: (text(data?.date_created) ?? '').slice(0, 10),
      centre: text(data?.center),
      thumbnail: thumbnail.replace(/^http:\/\//, 'https://').replace(/ /g, '%20'),
      page: `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}`,
    });
    if (found.length === limit) break;
  }
  return found;
}
