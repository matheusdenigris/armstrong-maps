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
| NASA DONKI's WSA-Enlil model forecasts a CME at Mars inside the window above | Caution |

Daylight and weather do not change the verdict yet. The dose stays the published average; a CME
only adds a caution, because DONKI forecasts its arrival, not the dose it brings. When DONKI does
not answer, the verdict leaves space weather out and the Site tab says so.

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

## Simulated

- The walk: the astronaut's position, heading, time outside, life support and dose all follow the
  plan at the assumed speed. Nobody is walking it. The console can play it faster than real time.
- The base stands on the landing point of the mission at each site.

## Illustrative

- The photograph in the visor is real (see the sources below), but it was taken from one fixed
  spot. It slides sideways as the astronaut turns; it does not show what is really in that
  direction. Only its clean part is shown: the mosaics have black gaps and the rover's deck.
- Gale and Jezero have their own photograph. At the other sites the visor borrows the one from
  Gale and says so.

| Photograph | Source |
|---|---|
| Curiosity Mastcam 360-degree panorama on Greenheugh, sol 3423 (2022) | [PIA25176](https://images.nasa.gov/details/PIA25176), NASA/JPL-Caltech/MSSS |
| Perseverance Mastcam-Z first 360-degree panorama, sol 3 (2021) | [PIA24264](https://images.nasa.gov/details/PIA24264), NASA/JPL-Caltech/MSSS/ASU |

## Decoration

- The stars behind the globe are not a star catalogue.
- The light on the globe travels with the camera; it is not the real position of the Sun.
