# AGENTS.md

Guide for coding agents (and people) working in this repository.

## What this is

Armstrong Maps is a layered map of Mars for planning and following walks on the surface, named
after Neil Armstrong. It is an entry for the *Interplanetary Survival Guide: Martian Map* challenge
of the NASA Space Apps Challenge 2026.

It is a mobile app first: React Native through Expo, shipped to Android and iOS, with the same
code exported to the web at https://www.armstrongmaps.us. Design for a phone held upright, then
widen.

The roadmap is the GitHub issues, grouped in milestones. See [docs/roadmap.md](docs/roadmap.md).

## Commands

```bash
npm install
npm start              # Expo dev server (press a for Android, w for web)
npm run web            # web only
npm test               # unit tests of the mission code (vitest)
npm run check          # English-only gate, typecheck, lint and tests: run before calling a task done
npm run build:web      # static web export to dist/
```

## English only

Everything here is written in English: interface text, code, comments, docs, file names, issues
and commit messages. Portuguese is not allowed anywhere. `npm run check:english` enforces it for
files, CI enforces it for commit messages and pull request titles too, and a failing gate blocks
the merge. A real exception (a proper noun) goes in `scripts/english-allowlist.txt`.

## Domain rules

- **Mars is not Earth.** Every distance comes from `src/mission/geo.ts` (radius 3389.5 km). Map
  libraries assume Earth; never take a distance from one.
- **Mission code is pure TypeScript** in `src/mission`, with no React and no device APIs, and it
  is tested. It returns numbers and reason codes; the interface turns them into text.
- **Map tiles are equirectangular**, not Web Mercator. Level L has 2^(L+1) columns and 2^L rows.
- **Longitudes** are stored as -180..180 and shown as 0..360 E (`src/mission/format.ts`).
- **The map is equirectangular too.** `src/mission/camera.ts` does the projection; the gestures are
  in `src/components/map-controller.ts`. Tiles are laid out for a settled view and follow a
  gesture with one transform, so do not position tiles from the per-frame view.
- **A new map layer** is checked against the product's `WMTSCapabilities.xml` on trek.nasa.gov
  (id, image format, deepest level) before it is added to `src/data`. A 404 outside a layer's
  coverage is normal.

## Honest data

The app mixes real data with simulation, and the interface must always say which is which.

- Real: map tiles, rover traverses, weather and radiation measurements, each with its source.
- Simulated: the astronauts' position and the walk clock.
- Project assumptions (walking speed, life-support duration, turn-back limit) are labelled as
  assumptions; they are not NASA rules.

Never invent data. If a source does not exist or does not answer, show the gap. Every number on
screen needs a source or a "simulated" or "assumption" label.

## Interface

- Visual language: mission control. Tokens live in `src/constants/theme.ts`. Dark only.
- Styling is `StyleSheet` with the tokens; no hard-coded colours in screens.
- The logo is `src/components/logo.tsx`; masters are in `assets/brand`. The app icons under
  `assets/images` are rendered from the same drawing: change them together.
- Do not reproduce the NASA logotype or insignia. The project has no official link to NASA.
- Respect reduced-motion settings and keep touch targets at 44 pt or more.
- Check every screen change at phone width (375 pt) and at desktop width on the web export. The
  web version is what is shown first, so mouse, wheel and keyboard must work as well as touch.
- Routes live in `src/app`: `/` is the globe and the list of sites, `/site/<id>` is the ship
  console of one, and `/visor/<id>` is the astronaut's visor. A dynamic route exports
  `generateStaticParams` so the web export has a page for each address.
- **The ship owns the walk.** Only the console starts, pauses or ends it; the visor reads the
  state. The clock (`src/mission/clock.ts`) stores an anchor instead of ticking, so every tab
  works out the same time. Tabs follow each other through the saved state and the browser's
  `storage` event (`src/app/_layout.tsx`).
- **The visor shows real photographs, not a drawn scene.** A 3D terrain with a painted sky was
  tried and rejected as game-like: do not bring it back. `src/components/panorama-view.web.tsx`
  wraps a real 360-degree mosaic round the astronaut with plain strips, because the NASA image
  library does not let its files be used as WebGL textures. Each picture in
  `src/data/panoramas.ts` has a `band` that keeps the black gaps of the mosaic out of view. The
  visor has to say where the photograph was taken and whether it is lined up with the compass.
- Do not add `src/app/+html.tsx` without checking the export: a custom shell dropped the style
  sheet and the script tags from every page. Set titles with `Head` from `expo-router/head`.
- **Pages are rendered ahead of time, without a window.** `useWindowDimensions` is 0 there, and a
  style computed from it stays in the HTML after the app starts. Gate anything that depends on the
  window on `useHydrated` (see `src/app/index.tsx`): layout by width, sizes by height.
- An `Svg` that covers its parent needs `width` and `height` as numbers; a fill style is not enough
  on the web.
- The globe is web only for now (`mars-globe.web.tsx`); `mars-globe.tsx` is what the phone apps
  get. Screens check `GLOBE_AVAILABLE` before giving it room.
- The mission state is `src/state/mission.ts`. It is read from the device after the first render.
- Static files for the web go in `public/` and are served from the root: the recording of wind in
  `public/audio` is NASA's file, unchanged. Do not edit or re-encode it without saying so in
  `docs/assumptions.md`. Sound starts only from a press, never on its own.

## Workflow

- Small commits with a descriptive message, in English.
- Every change that reaches `main` updates its issue in the same step: `Closes #N` in the commit
  when it is done, or a comment saying what landed and what is left. Work without an issue gets
  one. Say what was not verified.
- Owner and priority are labels: `owner: matheus|miguel|larissa|claude`, `priority`.
- Never commit `.env*`, `node_modules`, `dist` or the generated `android/` and `ios/` folders.
- **`main` is the live site.** Every push deploys to https://www.armstrongmaps.us. Before pushing a
  change to a screen or to the web shell, run `npm run build:web` and open the export in a browser;
  tests and lint do not see a page that fails to start.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
