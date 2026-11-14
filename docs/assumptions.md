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
| Return leg | A straight line from the last waypoint to the base | Simplification |
| Terrain | Flat: slopes and obstacles do not slow the walk | Simplification |

## The verdict

`evaluateWalk` returns go, caution or no-go with the reasons:

| Reason | Verdict |
|---|---|
| The walk takes longer than the life support lasts | No-go |
| The walk uses part of the reserve | Caution |
| A waypoint is beyond the walk-back limit | No-go |
| A waypoint is past the warning threshold of the walk-back limit | Caution |
| NASA DONKI's WSA-Enlil model forecasts a CME hitting Mars inside the window above, not rated minor or glancing | Caution |

Most forecast arrivals at Mars are rated minor or a glancing blow (all ten in the 30 days to 2026-11-14). Counting them would have kept walks on caution 61% of the time, so they are shown in the Site tab but do not change the verdict.

Daylight and weather do not change the verdict yet. The dose stays the published average; a CME
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
| Weather | The latest sol the feed has, read live | Curiosity REMS, outreach feed of the Centro de Astrobiologia (CSIC-INTA) |
| CME arrivals at Mars | A model forecast, read live: the last 30 days of runs | NASA DONKI, WSA-Enlil simulations (CCMC, Goddard) |
| Solar particle events | Seen near the Earth, read live: the last 30 days | NASA DONKI, SEP |
| Rover pictures | The newest raw frames, read live | NASA/JPL-Caltech raw-image feed on mars.nasa.gov |
| Archive pictures | Read live | NASA Image and Video Library |

The weather is measured at Gale crater only. At the other sites the app shows it as a reference
and says how far the station is. The feed can be weeks behind the current date, so the app shows
the sol and the Earth date of the reading.

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
- The change of scene is a short cut: the view strides forward into a gust of dust, which clears
  on the next photograph. The dust and the stride are drawn.
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
- The light on the globe travels with the camera; it is not the real position of the Sun.
