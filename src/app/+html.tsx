import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * The HTML shell of every page of the web export. It only runs at build time, on the web.
 * The title and description here are the defaults; each screen sets its own with `Head`.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Armstrong Maps</title>
        <meta
          name="description"
          content="A layered map of Mars for planning and following walks on the surface."
        />
        <meta name="theme-color" content="#07090D" />
        <ScrollViewStyleReset />
        {/* Paint the page dark before the app loads, so there is no white flash. */}
        <style dangerouslySetInnerHTML={{ __html: 'html,body{background-color:#07090D}' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
