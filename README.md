<p align="center">
  <img src="assets/brand/symbol.svg" width="96" alt="Armstrong Maps">
</p>

# Armstrong Maps

A layered map of Mars for planning and following walks on the surface, in your pocket.

Built for the **Interplanetary Survival Guide: Martian Map** challenge of the
[NASA Space Apps Challenge](https://www.spaceappschallenge.org/) 2026. The name honours Neil
Armstrong.

**Live:** https://www.armstrongmaps.us · **Demo video (30 s):** https://youtu.be/xQKNnt-h_sA

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

- **Globe** (web): Mars textured with the Viking colour mosaic, lit where it is day on Mars now,
  with its relief from MOLA and HRSC drawn six times taller, turned by drag, pinch or wheel, and
  the five landing sites. Choosing a site flies there and opens its map.
- **Surface map**: the Viking, CTX and HiRISE mosaics of each site (and the InSight mosaic at
  Elysium), dragged and pinched, with a scale bar measured on Mars and coordinates in 0 to 360 E.
  A tile that fails is asked for again, and the map says when the service itself is down.
- **Layers**: colour relief (MOLA and HRSC), daytime and nighttime infrared (THEMIS), thermal
  inertia, dust cover and glass and clay (TES), each with a switch and an opacity.
- **Walk planning**: tap to add waypoints; the app draws the route and the walk-back limit and
  gives distance, time outside, life support used, radiation dose and a go, caution or no-go
  verdict with its reasons. The plan is a list of stops: drag a waypoint to move it, and give
  each stop a time and a task. Science targets come from NASA (five places where Curiosity did
  science at Gale; the sample sites, depot and helicopter airfields at Jezero), each with its
  source. The route has an elevation profile with its climb, "Avoid steep ground" adds points
  round a steep stretch, and "Share the plan" copies a link that opens the same plan on another
  device. The plan is saved on the device, so a reload keeps it; opening a site from the home page
  starts it from nothing.
- **Live data**: the real traverse and latest position of Curiosity at Gale and of Perseverance
  at Jezero, and the latest sol of weather from Curiosity's REMS station, each with its source.
  A feed that does not answer is shown as a gap.
- **The walk, from two seats**: the ship console starts a simulated walk, and an astronaut
  follows the route on the map. The astronaut's visor opens in another tab: first person, through
  the glass of the helmet, over a real 360-degree photograph of the site that you turn with the
  mouse or a finger. The display of the helmet carries what keeps the astronaut alive and the
  mission on course: life support left, the time the way back takes and the time to spare before
  turning back, the next waypoint with its bearing and arrival time, waypoints done, the mission
  clock, the radiation dose, the weather where there is a station, and a round map turned so that
  ahead is up. It raises an alert when the walk nears a limit, and says to turn back when the way
  home would eat the reserve, with a tone and a vibration. Pause the walk in one tab and the other
  holds. At Jezero, near a stop where Perseverance looked all the way round, the visor shows the
  view from that very stop, rebuilt from the rover's navigation camera frames and lined up with
  the compass. On a phone, **Phone look** turns the view as the phone turns. The **Sound** button
  plays real wind recorded on Mars by the microphone of Perseverance.
- **Space weather**: NASA DONKI's WSA-Enlil forecast of coronal mass ejections reaching Mars, and
  the solar particle events of the last 30 days. A CME forecast to hit Mars squarely around the walk adds a caution to
  the verdict.
- **Photos**: the newest raw frames from Curiosity and Perseverance, and archive pictures of every
  site from the NASA Image and Video Library, each linked to its NASA page.
- **Hazardous ground**: slopes too steep to walk, computed from NASA elevation models (1 m HiRISE
  at Gale and Gusev) near the base and from the 200 m MOLA and HRSC blend around it, and mapped
  dune fields of loose sand. Both are shaded on the map and enter the verdict.
- **Read the ground**: the pin button on the map reads any point pressed: its height from the
  sharpest NASA elevation model there, how far up or down it is from the base, and the slope of
  the ground. Thermal and spectral layers are served as pictures, so the app says no value can be
  read for them.
- **Ship link, messages and walk log**: during a walk the console shows whether the base sees the
  astronaut, from the line of sight over the NASA elevation model, and sends short messages that
  the visor shows until they are acknowledged. The log of the walk (waypoints, alerts, link,
  messages) stays after it ends and exports as a text file.
- **Wind**: the last sols measured by InSight, with a wind rose and how hard the gusts push compared
  with the Earth, and the prevailing wind written in the slip faces of the region's dunes.
- **Mars clock and daylight**: the Sun over each site from NASA/JPL Horizons, and local solar time
  with the Mars24 algorithm of NASA GISS, which also takes over when Horizons does not answer. A walk that starts in the dark or runs into the night is a
  no-go, and the panel offers to simulate it in daylight, from the next morning.
- **Safety check**: every factor of the verdict on one card (life support, walk-back limit,
  daylight, radiation, space weather, steep ground, loose sand), each with its status and source.
  A factor whose source has not answered says so instead of passing.
- **Weather chart**: air temperature and pressure over the last sols Curiosity's REMS reported.
  Jezero shows the last readings of Perseverance's MEDA (April 2024), dated as such.
- **Docs** (`/docs`): every NASA API and source the app reads, the address it calls, where it
  shows up, and what is measured, forecast, assumed or simulated. NASA sources come first.

To see both seats: open a site, tap the map to add waypoints and press **Start the walk**. The
astronaut visor opens in a new tab.

Not built yet: the globe inside the Android and iOS apps (they open on the list of sites), and
the link between two different devices (the two tabs have to be in the same browser). The rest of the plan is in the
[issues](../../issues) and [milestones](../../milestones); see [docs/roadmap.md](docs/roadmap.md).
What is measured and what is assumed is in [docs/assumptions.md](docs/assumptions.md).

## Documentation

| Page | What is in it |
|---|---|
| In the app, [`/docs`](https://www.armstrongmaps.us/docs) | A guide to each view, the verdict, every NASA source with the address it calls, and what is measured, forecast, assumed or simulated |
| [docs/assumptions.md](docs/assumptions.md) | Every assumption of the project, the rules of the verdict, and the limits of each data source |
| [docs/credits.md](docs/credits.md) | Every dataset, photograph, sound, typeface and library, with its credit and licence |
| [docs/roadmap.md](docs/roadmap.md) | The milestones and where each one stands |
| [docs/device-testing.md](docs/device-testing.md) | The checklist for testing on real phones |
| [docs/pitch/project-page.md](docs/pitch/project-page.md) | The text of the Space Apps project page |
| [docs/pitch/demo-video-script.md](docs/pitch/demo-video-script.md) | The demo video: its talk, its scenes and its credits |
| [AGENTS.md](AGENTS.md) | The rules of the code, for people and coding agents |

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

DONKI, on api.nasa.gov, is the only source that takes a key. Without one the app uses the shared
`DEMO_KEY`, which allows only a few calls an hour per address. Set your own key (free at
https://api.nasa.gov) in `EXPO_PUBLIC_NASA_API_KEY`, in `.env.local` or in the Vercel project.
The web app is a static export, so the key is visible in the page: use one made for this app only.

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
| Weather | Curiosity REMS, an outreach feed of the Centro de Astrobiologia (CSIC-INTA), measured at Gale; Perseverance MEDA at Jezero, last readings April 2024 | Yes |
| Rover traverses | Curiosity and Perseverance waypoints (mars.nasa.gov) | Yes |
| Science targets | Jezero: Perseverance sample sites and Ingenuity flights (mars.nasa.gov), the Three Forks depot (NASA PDS). Gale: places of the Curiosity mission, each from a NASA page | Yes |
| Space weather | [DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) (NASA CCMC, Goddard) through api.nasa.gov: WSA-Enlil CME arrivals at Mars (a model forecast) and SEP events (seen near the Earth) | Yes |
| Rover pictures | Raw-image feed of Curiosity and Perseverance (NASA/JPL-Caltech, mars.nasa.gov) | Yes |
| Archive pictures | [NASA Image and Video Library](https://images.nasa.gov) (images-api.nasa.gov) | Yes |
| Slope | Elevation models served by NASA/JPL Mars Trek: HiRISE (1 m), the InSight mosaic, and the MOLA and HRSC blend (200 m) | Yes |
| Dune fields | [Mars Global Digital Dune Database](https://pubs.usgs.gov/of/2007/1158/) (Hayward et al. 2007, USGS), via Mars Trek | Yes |
| Sun over each site | [NASA/JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html) (through `api/horizons.js` on the web) | Yes |
| Wind | InSight TWINS through [api.nasa.gov](https://api.nasa.gov) (October 2020, Elysium Planitia) | Yes |
| Sound | [Wind recorded by the SuperCam microphone of Perseverance](https://science.nasa.gov/resource/perseverance-rovers-supercam-records-wind-on-mars/), Jezero, sol 4 (22 February 2021). NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero | Yes |
| Visor photographs | Eleven 360-degree panoramas from the NASA Image and Video Library: Curiosity (PIA16101, PIA20840, PIA22545, PIA26554, PIA26019), Perseverance (PIA24264, PIA26474, PIA26369, PIA26644), Spirit (PIA16440) and Opportunity (PIA11754). Listed in `src/data/panoramas.ts` | Yes |
| Views from the rover's stops | Navigation camera frames of Perseverance, with the camera model and the rover's orientation published with each frame (NASA/JPL-Caltech, Mars 2020 raw images) | Yes |

The full list, with each endpoint, is in the app at `/docs` and in `src/data/sources.ts`. Credits
and licences are in [docs/credits.md](docs/credits.md).

The walk is simulated: the astronaut's position follows the plan at an assumed speed. Walking
speed, life-support duration and the walk-back limit are assumptions of this project, not NASA
rules. The photographs in the visor are real, and each was taken from one fixed spot: there is no
video of anyone walking on Mars. To give the sense of a walk, the view moves slowly into the
photograph as the astronaut covers ground, and every 120 m it changes to another real photograph
of the same site, through a short cut with drawn dust; those photographs were not taken on the
planned route. The stars behind the globe and the faint light on its night side are
decoration.

## Team

**Make It Mars**

- **Matheus De Nigris**: product, the walk and the visor, deployment, the demo video.
- **Miguel Amaral**: the Mars clock and daylight, the Sun from Horizons, hazardous ground, walk
  planning stop by stop.
- **Larissa Albuquerque**: the interface: the console panels, their motion, the map controls and
  the design of the docs.

## Use of AI

This project is developed with the help of Claude (Anthropic) working as a coding agent under the
team's direction. Commits written with it carry a `Co-Authored-By` trailer. Inside the app, no
image, map, sound or scientific data is AI-generated: all of it comes from NASA and its partners, except for the app logo (Armstrong Agent), that was AI-generated.
In the demo video, the narration voice and the music are generated with ElevenLabs, and two short
shots (an astronaut walking on Mars and the final shot) were generated from real NASA photographs;
both carry an on-screen note that they were generated with AI.

## In memory of Sir Patrick Stewart

<p align="center"><em>1940 – 2026</em></p>

Sir Patrick Stewart died on 28 October 2026, a little over two weeks before this hackathon. For
seven seasons of *Star Trek: The Next Generation*, four films and three seasons of *Picard*, his
Captain Jean-Luc Picard showed a generation what a commander in space could be: curious before
afraid, calm when the readings turn bad, and answerable above all for bringing the crew home.

That last duty is the question this app is built around: before anyone steps outside, will they
come back? The talk of our demo video was written in his register, and it ends on the line
*"This is our way to pursue the next frontier."* That line is for him.

Thank you, Captain. Engage.

## Notes

Armstrong Maps is a hackathon project with no official link to NASA. It does not use the NASA
logotype or insignia. Code is under the [MIT License](LICENSE); the data belongs to its sources.
