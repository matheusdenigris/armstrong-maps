# Assumptions and sources

The app mixes measured data with values the team chose. This page says which is which. The same
labels appear in the interface.

## Walk assumptions

These are choices of this project, picked to be plausible for a suited walk. **They are not NASA
requirements.** They live in `WALK_ASSUMPTIONS` in `src/mission/walk.ts`; change them there and
every number follows.

| Value | In the app | Kind |
|---|---|---|
| Walking speed in a suit over rough ground | 2.5 km/h | Assumption |
| Time working at each waypoint | 20 min | Assumption |
| Life support of the suit | 8 h | Assumption |
| Share of life support that must be left on return | 20% | Assumption |
| Walk-back limit: the farthest a waypoint may be from the base | 5 km | Assumption |
| Warning threshold near the walk-back limit | 80% of it | Assumption |
| A CME counts against a walk from this long before its forecast arrival at Mars | 72 h | Assumption |
| ... and until this long after it | 24 h | Assumption |
| Ground too steep for a caution | 15° or more under the route | Assumption |
| Ground too steep to walk | 25° or more under the route | Assumption |
| The Sun is low: shadows hide holes and rocks | Below 10° above the horizon | Assumption |
| "Next morning" starts the walk when the Sun is | 15° up, on its way up | Assumption |
| Return leg | A straight line from the last waypoint to the base | Simplification |
| Terrain | Slopes do not slow the walk; they only change the verdict | Simplification |

## The verdict

`evaluateWalk` returns go, caution or no-go with the reasons:

| Reason | Verdict |
|---|---|
| The walk takes longer than the life support lasts | No-go |
| The walk uses part of the reserve | Caution |
| A waypoint is beyond the walk-back limit | No-go |
| A waypoint is past the warning threshold of the walk-back limit | Caution |
| NASA DONKI's WSA-Enlil model forecasts a CME hitting Mars inside the window above, not rated minor or glancing | Caution |
| The route, out and back, crosses ground of 25° or more | No-go |
| The route, out and back, crosses ground of 15° or more | Caution |
| The route enters a mapped dune field (loose sand) | Caution |
| The Sun is below the horizon at the planned start | No-go |
| The walk would still be out after sunset | No-go |
| The Sun gets lower than 10° during the walk | Caution |

Most forecast arrivals at Mars are rated minor or a glancing blow (all ten in the 30 days to 2026-11-14). Counting them would have kept walks on caution 61% of the time, so they are shown in the Site tab but do not change the verdict.

## Hazardous ground

The slope comes from elevation models served by NASA/JPL Mars Trek, read in two areas around each
base:

| Site | Near the base (about 12 km across) | Around it (about 120 km across) |
|---|---|---|
| Gale | HiRISE model, 1 m, read as about 60 m cells | MOLA and HRSC blend, 200 m |
| Gusev | HiRISE model of the Columbia Hills, 1 m, clipped to its coverage | MOLA and HRSC blend, 200 m |
| Elysium | InSight mosaic (HiRISE, CTX, HRSC), about 20 m | MOLA and HRSC blend, 200 m |
| Jezero, Meridiani | MOLA and HRSC blend, 200 m | MOLA and HRSC blend, 200 m |

The same services give the height of one point, which is what the pin button of the map reads: the
sharp model where it covers the point, the 200 m blend everywhere else, so every site has a height
to show. The vertical reference of each model was not checked: a height is shown as the model
gives it, and it is compared only with the height of the base in the same model. The thermal and
spectral layers have no such service; they are pictures, and the app says no value can be read.

The app computes the slope of each cell from its neighbours, with the radius of Mars. A model gives
the mean slope over a cell, so a ledge or a boulder smaller than a cell does not show: real ground
can be steeper than the shading. Jezero's sharper models (CTX at 20 m, HiRISE at 1 m) are listed in
the Mars Trek catalogue, but no image service serves their heights and the subset service failed
for them on 2026-11-14, so Jezero uses the 200 m blend.

Dune fields come from the Mars Global Digital Dune Database (Hayward et al. 2007, USGS), served by
Mars Trek. It maps fields between 65° S and 65° N from orbit; small patches of sand are not in it.

## Wind

- **Measured:** NASA serves wind measurements from one lander only, InSight at Elysium Planitia,
  through api.nasa.gov. The feed keeps the last seven sols it sent, in October 2020. Elsewhere the
  app shows it as a reference with the distance to InSight.
- **Not available:** Curiosity's wind sensor was damaged at landing (the REMS feed reports no
  wind), and the public MEDA feed of Perseverance carries temperature and pressure only, up to
  April 2024 (the Site tab of Jezero shows them, dated).
- **Written in the dunes:** the slip faces of a dune field face downwind; the dune database gives
  their direction, which the map draws as arrows. It is the prevailing wind of the last time the
  dunes changed much, not today's.
- **Why wind does not enter the verdict:** the air of Mars is about 75 times thinner than the
  Earth's (NASA fact sheets: about 0.016 against 1.217 kg/m³), so the strongest gust InSight
  measured in the feed pushes like a light breeze on Earth. The dust it lifts is the risk, and
  no opacity feed is published (see "Not available yet").

## The Mars clock and daylight

The app computes time on Mars itself, with the algorithm NASA GISS publishes for its Mars24
sunclock (Allison and McEwen 2000): the Mars Sol Date, local mean and true solar time, the season
(Ls), and where the Sun stands in the sky of each site. `src/mission/mars-time.ts` is tested
against the two worked examples of the Mars24 algorithm page (2000-01-06 and the landing of
Spirit); every value matches to a few ten-thousandths of a degree.

The Sun itself comes from NASA/JPL Horizons, the ephemeris service of JPL: the app asks for the
Sun's elevation seen from the landing point every 10 minutes over three days, and reads sunrise,
sunset and the daylight of a walk from that table. Horizons sends no CORS header, so the web app
asks through `api/horizons.js`, a Vercel function on the same host that only builds that one
query; the phone apps ask directly. When Horizons does not answer, the Mars24 algorithm takes
over and the screen says so. The two agree within about a minute (tested on 2026-11-14 at Gale).

A walk is timed from its planned start (now, or the next morning) for as long as it lasts. Walk
durations are Earth hours; a sol is 24 h 40 min. Latitudes are used as the app stores them
(planetocentric); Mars24 uses planetographic ones, under half a degree apart at the landing sites,
which moves sunrise and sunset by under a minute.

## The globe

| What | In the app | Kind |
|---|---|---|
| Day and night | The lit side is where it is day on Mars at this moment. The point with the Sun overhead comes from the Mars24 algorithm of NASA GISS (`src/mission/mars-time.ts`), worked out again every minute | Computed from a published algorithm |
| Relief | MOLA and HRSC blended elevation model (Fergason et al. 2018), resampled by the Mars Trek image service to 512 by 256 heights and kept as `public/globe/relief.bin` by `scripts/build-globe-relief.mjs` | Measured, coarse: about 42 km a cell at the equator |
| How tall the relief is drawn | 6 times taller than it is (`RELIEF_EXAGGERATION` in `src/mission/relief.ts`). At true scale Olympus Mons is 0.6% of the radius of Mars, a pixel or two | Assumption |
| Regional mosaics | The area of each regional image mosaic in the Mars Trek catalogue (CTX, HiRISE, HRSC) is written to `src/data/coverage.ts` by `scripts/build-coverage.mjs`. The globe does not mark them: outlines and soft patches were both tried and taken off as visual noise | Read from the catalogue; not shown |

The line under the globe names each of these. The relief is named only once the heights have
arrived; if they do not, the globe is a smooth sphere.

The cost of the relief on a phone was weighed before it went in: one file of 256 KB, a sphere of
about 33,000 points moved once when the file arrives, and one small texture for the shading.
Nothing is computed per frame. It was looked at in a desktop browser at phone width; it has not
been timed on a physical phone.

## Not available yet

- **Dust opacity (#42):** NASA serves no public feed of atmospheric opacity for any site. The
  REMS feed has a word for the sky, and it is not a measurement of dust: counted over the whole
  feed on 2026-11-14, it said "Sunny" on 4,742 of 4,745 sols, the 81 sols of the global dust
  storm of 2018 (10 June to 31 August) included. The Site tab shows it as "Sky, as the feed words
  it". With no measurement, the app shows nothing about dust and **dust does not enter the
  verdict**: a card built on the season alone was tried and taken out, because a season is not a
  reading. Other places opacity exists,
  none of them a feed: the calibrated REMS and MEDA files in the PDS, and the weekly Mars weather
  reports of MSSS from the MARCI camera, which are written text.
- **Weather at Jezero (#41):** the public MEDA feed of Perseverance held seven sols on 2026-11-14,
  1127 to 1133 (April 2024), three of them without a temperature, and had not moved since. The
  Site tab of Jezero shows its last sol with a reading as a dated measurement at Jezero (air
  temperature, pressure, sunrise and sunset), marked as not the weather of today, above the Gale
  reference. The feed has no ground temperature, ultraviolet, wind or sky. The calibrated MEDA
  data is in the PDS as instrument files: an archive to process, not a feed.

Weather does not change the verdict yet. The dose stays the published average; a CME
only adds a caution, because DONKI forecasts its arrival, not the dose it brings. When DONKI does
not answer, the verdict leaves space weather out and the Site tab says so.

## Alerts during the walk

While the walk runs, `walkSafety` in `src/mission/safety.ts` works out the time to spare: the
life support left, minus the reserve, minus the time to walk straight back to the base from where
the astronaut is. The helmet display raises:

| Alert | When | Level |
|---|---|---|
| Life support exhausted | Nothing is left | Warning |
| Turn back now | The time to spare is zero or less | Warning |
| Beyond the walk-back limit | The astronaut is farther from the base than the limit | Warning |
| Turn back within a given time | Less than 30 minutes to spare | Caution |
| Into the reserve | Life support is below the reserve | Caution |
| Near the walk-back limit | Past 80% of the limit | Caution |

The way back is a straight line at the assumed walking speed, like the return leg of the plan.

## Measured data

| What | Value | Source |
|---|---|---|
| Radius of Mars | 3389.5 km (mean) | IAU |
| Radiation on the surface | 0.64 ± 0.12 mSv per Earth day, dose equivalent from galactic cosmic rays | MSL RAD: Hassler et al., *Science* 343, 1244797 (2014) |
| Map imagery and its coverage | See `src/data/layers.ts` and `src/data/sites.ts` | NASA/JPL Mars Trek, each product's `WMTSCapabilities.xml` |
| Rover traverse and latest position | Read live | Waypoints published by NASA/JPL on mars.nasa.gov |
| Sample sites at Jezero | Read live | The sample file of the NASA location map on mars.nasa.gov |
| Ingenuity flights at Jezero | Read live | The helicopter file of the NASA location map on mars.nasa.gov |
| Sample depot at Three Forks | Ten rows, copied on 2026-11-14 | NASA Planetary Data System, Mars 2020 sample depot bundle, DOI 10.17189/wmc5-cw60 |
| Weather | The latest sol the feed has, read live | Curiosity REMS, outreach feed of the Centro de Astrobiologia (CSIC-INTA) |
| CME arrivals at Mars | A model forecast, read live: the last 30 days of runs | NASA DONKI, WSA-Enlil simulations (CCMC, Goddard) |
| Solar particle events | Seen near the Earth, read live: the last 30 days | NASA DONKI, SEP |
| Rover pictures | The newest raw frames, read live | NASA/JPL-Caltech raw-image feed on mars.nasa.gov |
| Archive pictures | Read live | NASA Image and Video Library |
| Slope near and around the base | Read live, computed in the app | Elevation models on NASA/JPL Mars Trek (HiRISE, MOLA, HRSC) |
| Dune fields and their slip faces | Read live | Mars Global Digital Dune Database, Hayward et al. 2007 (USGS) |
| Wind speed and direction | The last seven sols in the feed (October 2020) | InSight TWINS, NASA/JPL and Cornell |

The weather is measured at Gale crater only. At the other sites the app shows it as a reference
and says how far the station is. The feed can be weeks behind the current date, so the app shows
the sol and the Earth date of the reading.

The mission points on the Jezero map (`src/data/mission-points.ts`) are there only because a NASA
file gives their latitude and longitude; nothing is placed by eye. What a position is the position
of differs by set, and the app says which:

- A sample site is where the sample was taken. One record of the NASA file (Lefroy Bay) repeats
  the position of the sample before it, while its own easting and northing are about 370 m away.
  The app uses the position printed in the Sample Dossier of the Planetary Data System for that
  one, says so on its card, and goes back to the file as soon as the file stops repeating.
- A depot mark is where the rover stood when it dropped the tube, which is what the data bundle
  states. The tube lies a few metres from it.
- A flight mark is where the helicopter landed after that flight. The record numbered 0 is left
  out: it has no distance and no time in the air.

Gale has no such marks. NASA publishes no list of the drill holes of Curiosity with coordinates;
the tables that exist give the position of the rover, so a mark made from them would be derived,
not published. The other sites have no surface data of this kind at all.

The radiation figure is a published average over about 300 sols at Gale crater, not a live
reading: RAD has no public feed. The app uses it at every site, and a solar particle event would
raise it for hours or days.

## Sound

The visor can play wind recorded on Mars: the SuperCam microphone of Perseverance, at Jezero
crater, on sol 4 (22 February 2021). The file in `public/audio` is the MP3 that NASA publishes,
unchanged. The app plays it on a loop and six times louder than published, through a limiter so
the gusts do not distort: the recording is faint, as wind is in air a hundredth as dense as
Earth's. It was recorded at Jezero; at the other sites the visor plays the same recording and
says it was not recorded there.

Source: [Perseverance Rover's SuperCam Records Wind on Mars](https://science.nasa.gov/resource/perseverance-rovers-supercam-records-wind-on-mars/),
NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero.

## Simulated

- The walk: the astronaut's position, heading, time outside, life support and dose all follow the
  plan at the assumed speed. Nobody is walking it. The console can play it faster than real time.
- The work at a waypoint is played 15 times faster than the walking, so that a 20-minute stop
  takes eight seconds on screen at the default speed. The plan, the mission clock, life support
  and the dose still count the whole stop.
- The base stands on the landing point of the mission at each site.

## Illustrative

- The photographs in the visor are real 360-degree mosaics (see the table below), each taken
  from one fixed spot. Nobody has walked on Mars, so there is no film of a walk. To give the sense
  of ground being covered, the visor goes through the photographs of the site in order, from the
  one taken nearest to the landing point outwards, and changes scene every 120 m walked (more when
  the walk is played fast, so that a scene stays at least eight seconds). The photographs are real
  and from that site, but they were not taken on the planned route: the Sources panel says how far
  from the simulated position each one was taken.
- Within a scene the view moves slowly into the photograph as the astronaut covers the stretch,
  until what is ahead is about one and a half times larger. It gives the walk depth, but it is a
  move into a still picture: nothing in the photograph shifts against anything else, as it would
  if the ground were really being covered.
- The change of scene is a short cut: a gust of dust rises over the view and clears on the next
  photograph. The dust is drawn.
- The picture does not rise and fall with the steps: at the speeds a walk is played, that reads
  as shaking and is uncomfortable to watch. When the device asks for reduced motion the view
  does not move into the photograph either, and the change of scene is a plain fade through the
  dust.
- Only one photograph has a caption that says where north is (PIA20840). The others are not lined
  up with the compass: turning turns the view by the right amount, but what is ahead in the
  picture is not what is ahead on the ground. The visor says which case it is.
- Three things were set by eye for each photograph: the row of the horizon, the band that is free
  of the black gaps at the top and bottom of the mosaic, and the colour that continues the sky
  above that band. Black areas inside the band are where the camera took no frame.
- Where the mosaic has no frame for a patch of sky inside that band (PIA20840 has one beside its
  first butte), the visor draws the sky there, in the colours the photograph has on either side.
  The ground is never filled in: a gap in it stays black.
- Gale has five photographs, Jezero four and Gusev one, so a walk at Gusev stays in the same
  scene. Meridiani and Elysium borrow the ones from Gale, and the visor says so.

| Photograph | Where and when | Source |
|---|---|---|
| Curiosity Mastcam, the landing site with Mount Sharp | Gale, Bradbury Landing, August 2012 | [PIA16101](https://images.nasa.gov/details/PIA16101), NASA/JPL-Caltech/MSSS |
| Curiosity Mastcam amid the Murray Buttes | Gale, sol 1451 (2016) | [PIA20840](https://images.nasa.gov/details/PIA20840), NASA/JPL-Caltech/MSSS |
| Curiosity Mastcam on Vera Rubin Ridge | Gale, sol 2137 (2018) | [PIA22545](https://images.nasa.gov/details/PIA22545), NASA/JPL-Caltech/MSSS |
| Curiosity Mastcam below Gediz Vallis Ridge | Gale, sol 3928 (2023) | [PIA26019](https://images.nasa.gov/details/PIA26019), NASA/JPL-Caltech/MSSS |
| Perseverance Mastcam-Z, first 360-degree panorama | Jezero, landing site, sol 3 (2021) | [PIA24264](https://images.nasa.gov/details/PIA24264), NASA/JPL-Caltech/MSSS/ASU |
| Perseverance Mastcam-Z at Bright Angel | Jezero, sol 1178 (2024) | [PIA26369](https://images.nasa.gov/details/PIA26369), NASA/JPL-Caltech/ASU/MSSS |
| Perseverance Mastcam-Z at Rio Chiquito | Jezero, sol 1337 (2024) | [PIA26474](https://images.nasa.gov/details/PIA26474), NASA/JPL-Caltech/ASU/MSSS |
| Perseverance Mastcam-Z at Falbreen | Jezero, sol 1516 (2025) | [PIA26644](https://images.nasa.gov/details/PIA26644), NASA/JPL-Caltech/ASU/MSSS |
| Curiosity Mastcam at the Ubajara sampling site | Gale, sol 3815 (2023) | [PIA26554](https://images.nasa.gov/details/PIA26554), NASA/JPL-Caltech/MSSS |
| Spirit Pancam, the McMurdo panorama | Gusev, Low Ridge, 2006 | [PIA16440](https://images.nasa.gov/details/PIA16440), NASA/JPL-Caltech/Cornell |

The place of each Gale and Jezero photograph is the rover's published position on the sol it was
taken.

## Decoration

- The stars behind the globe are not a star catalogue.
- The night side of the globe is lit faintly so the ground and the sites can be read; a real night
  on Mars is dark.
- The glow round the planet is a hint of its thin atmosphere, not a measurement.
