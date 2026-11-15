# Space Apps project page

The text of the project page, in English, the language of the submission. It follows the fields
of the 2026 form. Updated on 2026-11-15 against `main`.

Rules: claim only what is on `main`; what is simulated or assumed is called that; no NASA images
or logo on the project page.

---

## Project name

Armstrong Maps

## Team

Make It Mars: Matheus De Nigris, Miguel Amaral, Larissa Albuquerque.

## High-level project summary

Armstrong Maps is a layered map of Mars for planning and following a walk on the surface, made for
a phone. Before anyone steps outside, a crew needs one map that answers three questions: where are
we going, is it safe today, and can we get back. The crew picks a landing site on a 3D globe,
stacks real NASA layers, plans the stops of a walk and gets a go, caution or no-go verdict with
its reasons. The astronaut then follows the same plan through a helmet visor over real NASA
photographs. Every number shown has a source; everything simulated is labelled as simulated.

## Link to project demo

https://youtu.be/xQKNnt-h_sA (30 seconds, public)

## Link to final project

https://www.armstrongmaps.us. Source code: https://github.com/matheusdenigris/armstrong-maps

## Detailed project description

**What it does**

- **Globe.** A 3D Mars textured with the Viking colour mosaic, lit by the real Sun, with its
  relief and five landing sites (Gale, Jezero, Meridiani, Gusev, Elysium). Picking one flies down
  to its map.
- **Surface map.** NASA Mars Trek mosaics down to 25 cm per pixel (HiRISE), with layers to switch
  and fade: colour relief (MOLA and HRSC), day and night infrared (THEMIS), thermal inertia, dust
  cover, glass and clay (TES). A scale bar measured on Mars, and the real traverses and latest
  positions of Curiosity and Perseverance.
- **A walk planned stop by stop.** Tap waypoints, drag them, give each stop a time and a task.
  Science targets come from NASA: at Gale, five places where Curiosity did science, placed where
  the rover was on that sol; at Jezero, the published sample sites, depot and helicopter
  airfields.
- **Safety verdict.** Go, caution or no-go, with the reasons, from distance, time outside, life
  support, the walk-back limit, daylight, the radiation dose, space weather, steep ground and
  loose sand. Each factor shows its source; a source that does not answer is shown as a gap,
  never as a pass.
- **Hazardous ground.** Slopes computed from NASA elevation models (1 m HiRISE where it exists,
  200 m MOLA and HRSC around it) and mapped dune fields. Where a route crosses steep ground, the
  app searches the elevation model for a way round. The route has an elevation profile with its
  climb, and any point pressed shows its height and slope.
- **Daylight and the Mars clock.** The Sun over each site from NASA/JPL Horizons, and local solar
  time with the Mars24 algorithm of NASA GISS. A walk in the dark is a no-go, and the app offers to
  simulate it from the next morning.
- **Space weather.** NASA DONKI forecasts of coronal mass ejections reaching Mars and recent solar
  particle events; a CME around the walk adds a caution.
- **Weather and wind.** Curiosity REMS over recent sols, the last readings of Perseverance MEDA at
  Jezero (dated), and InSight wind with a wind rose.
- **The walk from two seats.** The ship console starts a simulated walk. The astronaut's helmet
  visor opens in first person over a real NASA 360-degree photograph of the site, with life
  support left, the time to turn back, the next waypoint and its bearing, the task at the stop,
  the dose, the weather and a round map turned so that ahead is up. It warns near a limit, with a
  sound, and says when to turn back. At Jezero, near a stop where Perseverance looked all the way
  round, the visor shows the view from that very stop, lined up with the compass.
- **Ship link and walk log.** The base sees whether it still has line of sight to the astronaut
  over the elevation model, sends messages the visor shows until they are acknowledged, and keeps
  a log of the walk that exports as text. The Sound button plays real wind recorded on Mars by
  Perseverance.
- **Shared plans.** A plan can be shared as a link that opens on another device.
- **In-app docs** (`/docs`): every NASA source, the address it calls, and what is measured,
  forecast, assumed or simulated.

**How it is built**

React Native with Expo and Expo Router, TypeScript (strict), three.js for the globe and Zustand
for the state. The web version is a static export on Vercel; the same code targets Android and
iOS. Mars Trek tiles are equirectangular, not Web Mercator, so the app computes the tiles and the
projection itself. Every distance uses the radius of Mars (3,389.5 km) in tested code, never an
Earth formula. Vitest, ESLint, type checks and an English-only gate run in GitHub Actions.

**Why it matters**

On Mars a walk is limited by the suit and the way back, not by the terrain alone. Putting the data
and the limits in one view lets the crew see the risk before stepping outside, and lets the
astronaut keep the plan in sight while walking. Next: run it on real phones, link two devices
directly, and add sites as NASA publishes complete data for them.

**Limits we are open about**

- The astronaut's position and the walk clock are simulated.
- The suit limits (2.5 km/h, 8 h of life support with a 20 percent reserve, a 5 km walk-back
  limit, task times and suggested tasks) are assumptions of this project, not NASA rules.
- Radiation is the average surface dose published from Curiosity's RAD (Hassler et al. 2014), not
  a live reading. Weather is measured at the rover sites only, and dust has no published feed.
- The visor photographs are real, but outside the stop views at Jezero their framing does not
  follow the walker's exact position or heading.
- Walking speed does not depend on the ground, and the way back is a straight line.
- Not done yet: the globe inside the native phone apps (they open on the list of sites), and a
  test on a physical phone.

## NASA data

- NASA/JPL Mars Trek (WMTS): Viking MDIM 2.1, MRO CTX and HiRISE, MGS MOLA, Mars Odyssey THEMIS,
  MGS TES, HiRISE elevation models, the InSight landing-site mosaic.
- Curiosity and Perseverance traverses and positions (NASA Science, mars.nasa.gov, the Curiosity
  Rover Location Map); Mars 2020 sample sites, the Three Forks depot (PDS) and Ingenuity's
  airfields.
- NASA DONKI (CCMC, Goddard) through api.nasa.gov: WSA-Enlil CME arrivals at Mars, SEP events.
- NASA/JPL Horizons: the Sun over each site. NASA GISS Mars24 algorithm: local solar time.
- InSight TWINS wind through api.nasa.gov; Perseverance MEDA readings.
- MSL RAD surface dose (Hassler et al. 2014, Science 343).
- NASA Image and Video Library: eleven 360-degree panoramas for the visor (Curiosity PIA16101,
  PIA20840, PIA22545, PIA26554, PIA26019; Perseverance PIA24264, PIA26474, PIA26369, PIA26644;
  Spirit PIA16440; Opportunity PIA11754) and archive pictures of each site.
- Raw-image feeds of Curiosity and Perseverance, including the navigation camera frames, camera
  models and rover orientation used for the stop views at Jezero.
- The Perseverance SuperCam recording of wind, Jezero, sol 4
  (NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero).

## Space agency partners and other data

- ESA, with DLR and FU Berlin: Mars Express HRSC topography, blended with MOLA in the elevation
  layer and the slope.
- Spain: the REMS weather station on Curiosity is from the Centro de Astrobiologia (CSIC-INTA);
  its public feed gives the weather.
- USGS: the Mars Global Digital Dune Database (Hayward et al. 2007), served through Mars Trek.

## References

The full list with licences is in [docs/credits.md](../credits.md).

- Mars Trek: https://trek.nasa.gov/mars/
- Curiosity Rover Location Map (NASA Science): https://mars.nasa.gov/msl/mission/where-is-the-rover/
- DONKI: https://ccmc.gsfc.nasa.gov/tools/DONKI/ and https://api.nasa.gov
- JPL Horizons: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- NASA GISS Mars24 algorithm: https://www.giss.nasa.gov/tools/mars24/help/algorithm.html
- NASA Image and Video Library: https://images.nasa.gov
- Perseverance SuperCam wind recording:
  https://science.nasa.gov/resource/perseverance-rovers-supercam-records-wind-on-mars/
- Hassler, D. M. et al. (2014). Mars' surface radiation environment measured with the Mars
  Science Laboratory's Curiosity rover. Science 343.
- Hayward, R. K. et al. (2007). Mars Global Digital Dune Database. USGS Open-File Report
  2007-1158.
- Archinal, B. A. et al. (2018). Report of the IAU Working Group on Cartographic Coordinates and
  Rotational Elements: 2015. Celestial Mechanics and Dynamical Astronomy 130.
- Software: React Native, Expo, Expo Router, three.js, Zustand, TypeScript, Vitest, Vercel.
- Demo video: footage and audio from NASA mission videos and broadcasts (Mars 2020 launch and
  landing, InSight, Perseverance microphones); narration voice and background music generated
  with ElevenLabs.

## Use of artificial intelligence

Yes. The idea and the product decisions are the team's. We used Claude (Anthropic) through Claude
Code as a coding assistant under our direction: it wrote much of the code, tests and documentation
and helped find and test the NASA data sources; commits written with it carry a Co-Authored-By
line. Inside the app, no image, map, sound or scientific data is AI-generated: all of it comes from
NASA and its partners and is credited in the app. In the demo video, the narration voice and the
background music are AI-generated (ElevenLabs), and two short shots (an astronaut walking on Mars
and the final shot) were generated with ElevenLabs from real NASA photographs; both shots carry a
visible on-screen note that they were generated with AI.
