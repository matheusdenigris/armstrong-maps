import type { Metadata } from 'expo-server';

/** The address the site is served from; share previews need absolute URLs. */
export const SITE_URL = 'https://www.armstrongmaps.us';

export const TAGLINE = 'A layered map of Mars for planning and following walks on the surface.';

/** The 1200 x 630 picture in `public/` that a link preview shows. */
const PREVIEW_IMAGE = {
  url: `${SITE_URL}/social-preview.png`,
  width: 1200,
  height: 630,
  alt: 'Armstrong Maps: a layered map of Mars',
};

/**
 * The tags of one page that a link preview reads: title, description and the social cards.
 * The web export writes them into that page's static HTML (a route's `generateMetadata`), so
 * they are there before any script runs. `path` is the page's own address, such as `/site/gale`.
 */
export function pageMetadata(title: string, description: string, path: string): Metadata {
  const url = `${SITE_URL}${path === '/' ? '' : path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      siteName: 'Armstrong Maps',
      locale: 'en_US',
      title,
      description,
      url,
      images: [PREVIEW_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: PREVIEW_IMAGE.url, alt: PREVIEW_IMAGE.alt }],
    },
  };
}
