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

## What works today

- **Globe** (web): Mars textured with the Viking colour mosaic, turned by drag, pinch or wheel,
  with the five landing sites and the outline of their high-resolution coverage. Choosing a site
  flies there and opens its map.
- **Surface map**: the Viking, CTX and HiRISE mosaics of each site, dragged and pinched, with a
  scale bar measured on Mars and coordinates in 0 to 360 E.
- **Layers**: colour relief (MOLA and HRSC), daytime and nighttime infrared (THEMIS), thermal
  inertia, dust cover and glass and clay (TES), each with a switch and an opacity.
- **Walk planning**: tap to add waypoints; the app draws the route and the walk-back limit and
  gives distance, time outside, life support used, radiation dose and a go, caution or no-go
  verdict with its reasons. The plan is saved on the device.
- **Live data**: the real traverse and latest position of Curiosity at Gale and of Perseverance
  at Jezero, and the latest sol of weather from Curiosity's REMS station, each with its source.
  A feed that does not answer is shown as a gap.
- **The walk, from two seats**: the ship console starts a simulated walk, and an astronaut
  follows the route on the map. The astronaut's visor opens in another tab and puts you inside a
  real 360-degree photograph taken by the rover at that site: drag with the mouse or a finger to
  look all the way round. Over it, the display of the visor shows the heading, the bearing and
  distance of the next waypoint, life support, dose, and a round map turned so that ahead is up.
  As the astronaut moves, the visor switches to the photograph taken nearest to them. Pause the
  walk in one tab and the other stops. The **Sound** button plays real wind recorded on Mars by
  the microphone of Perseverance.

To see both seats: open a site, tap the map to add waypoints, press **Start the walk**, then
**Open the astronaut visor**.

Not built yet: the globe inside the Android and iOS apps (they open on the list of sites), and
the link between two different devices (the two tabs have to be in the same browser). The rest of the plan is in the
[issues](../../issues) and [milestones](../../milestones); see [docs/roadmap.md](docs/roadmap.md).
What is measured and what is assumed is in [docs/assumptions.md](docs/assumptions.md).

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
| Globe | three.js on WebGL |
| State | Zustand, saved with AsyncStorage |
| Targets | Android and iOS (EAS Build), web (static export on Vercel) |
| Language | TypeScript, strict |
| Quality | Vitest, ESLint, `tsc`, an English-only gate, GitHub Actions |

## Data

Every number in the app comes from a published source or carries a "simulated" or "assumption"
label.

| Kind | Source | In the app |
|---|---|---|
| Map tiles | [Mars Trek](https://trek.nasa.gov/mars/) (NASA/JPL): Viking MDIM 2.1, MRO CTX and HiRISE, MGS MOLA, Mars Express HRSC, Mars Odyssey THEMIS, MGS TES | Yes |
| Radiation | MSL RAD, Hassler et al. 2014 (a published average, not a live reading) | Yes |
| Weather | Curiosity REMS, an outreach feed of the Centro de Astrobiologia (CSIC-INTA). Measured at Gale only | Yes |
| Rover traverses | Curiosity and Perseverance waypoints (mars.nasa.gov) | Yes |
| Sound | [Wind recorded by the SuperCam microphone of Perseverance](https://science.nasa.gov/resource/perseverance-rovers-supercam-records-wind-on-mars/), Jezero, sol 4 (22 February 2021). NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero | Yes |
| Visor photographs | Seven 360-degree panoramas from the NASA Image and Video Library: Curiosity (PIA16101, PIA20840, PIA22545, PIA26019), Perseverance (PIA24264, PIA26369) and Spirit (PIA16440). Listed in `src/data/panoramas.ts` | Yes |

The walk is simulated: the astronaut's position follows the plan at an assumed speed. Walking
speed, life-support duration and the walk-back limit are assumptions of this project, not NASA
rules. The photographs in the visor are real, and each was taken from one fixed spot: there is no
video of anyone walking on Mars, so the view does not move forward between two photographs. The
stars behind the globe and the light on it are decoration.

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
