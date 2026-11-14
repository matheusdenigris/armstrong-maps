<p align="center">
  <img src="assets/brand/symbol.svg" width="96" alt="Armstrong Maps">
</p>

# Armstrong Maps

A layered map of Mars for planning and following walks on the surface, in your pocket.

Built for the **Interplanetary Survival Guide: Martian Map** challenge of the
[NASA Space Apps Challenge](https://www.spaceappschallenge.org/) 2026. The name honours Neil
Armstrong.

**Live:** https://www.armstrongmaps.us

## The idea

A crew on Mars needs one map that answers three questions before anyone steps outside: where are
we going, is it safe today, and can we get back. Armstrong Maps puts NASA's orbital and rover data
in layers on a phone and turns a tapped route into a go, caution or no-go verdict.

The app has three views:

- **Globe.** Mars from orbit, with the regions where high-resolution mosaics exist. Pick a landing
  site and descend to it.
- **Ship console.** The crew chooses layers (optical, topographic, thermal, spectral), draws the
  walk and follows astronauts, base and rover.
- **Astronaut visor.** First person: heading, next waypoint, life support and radiation, with the
  map oriented to where you are facing.

This is a hackathon build in progress. What works today is tracked in the
[issues](../../issues) and [milestones](../../milestones); see [docs/roadmap.md](docs/roadmap.md).

## Run it

```bash
npm install
npm start          # Expo dev server: press a for Android, w for web
npm run web        # web only
npm test           # unit tests of the mission code
npm run check      # English-only gate, typecheck, lint and tests
npm run build:web  # static web export to dist/
```

To run on a phone, install Expo Go and scan the QR code that `npm start` prints.

## Stack

| Part | Choice |
|---|---|
| App | React Native 0.88 with Expo SDK 58 and Expo Router |
| Targets | Android and iOS (EAS Build), web (static export on Vercel) |
| Language | TypeScript, strict |
| Quality | Vitest, ESLint, `tsc`, an English-only gate, GitHub Actions |

## Data

Every number in the app comes from a published source or carries a "simulated" or "assumption"
label.

| Kind | Source |
|---|---|
| Map tiles | [Mars Trek](https://trek.nasa.gov/mars/) (NASA/JPL): Viking MDIM 2.1, MRO CTX and HiRISE, MGS MOLA, Mars Express HRSC, Mars Odyssey THEMIS, MGS TES |
| Weather | Curiosity REMS |
| Radiation | MSL RAD, Hassler et al. 2014 (a published value) |
| Rover traverses | Curiosity and Perseverance waypoints (mars.nasa.gov) |

The astronauts' position and the walk clock are simulated. Walking speed, life-support duration
and the turn-back limit are assumptions of this project, not NASA rules.

## English only

The whole repository is in English: interface, code, docs, issues and commit messages. CI fails
when it finds anything else (`scripts/check-english.mjs`).

## Use of AI

This project is developed with the help of Claude (Anthropic) working as a coding agent under the
team's direction. Commits written with it carry a `Co-Authored-By` trailer. No AI-generated image,
audio or dataset is presented as NASA data.

## Notes

Armstrong Maps is a hackathon project with no official link to NASA. It does not use the NASA
logotype or insignia. Code is under the [MIT License](LICENSE); the data belongs to its sources.
