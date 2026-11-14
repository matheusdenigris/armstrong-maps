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

Daylight, weather and radiation do not change the verdict yet.

## Measured data

| What | Value | Source |
|---|---|---|
| Radius of Mars | 3389.5 km (mean) | IAU |
| Radiation on the surface | 0.64 ± 0.12 mSv per Earth day, dose equivalent from galactic cosmic rays | MSL RAD: Hassler et al., *Science* 343, 1244797 (2014) |
| Map imagery and its coverage | See `src/data/layers.ts` and `src/data/sites.ts` | NASA/JPL Mars Trek, each product's `WMTSCapabilities.xml` |
| Rover traverse and latest position | Read live | Waypoints published by NASA/JPL on mars.nasa.gov |
| Weather | The latest sol the feed has, read live | Curiosity REMS, outreach feed of the Centro de Astrobiologia (CSIC-INTA) |

The weather is measured at Gale crater only. At the other sites the app shows it as a reference
and says how far the station is. The feed can be weeks behind the current date, so the app shows
the sol and the Earth date of the reading.

The radiation figure is a published average over about 300 sols at Gale crater, not a live
reading: RAD has no public feed. The app uses it at every site, and a solar particle event would
raise it for hours or days.

## Simulated

- The walk itself: the route is a plan drawn on the map, and nobody is walking it.
- The base stands on the landing point of the mission at each site.

## Decoration

- The stars behind the globe are not a star catalogue.
- The light on the globe travels with the camera; it is not the real position of the Sun.
