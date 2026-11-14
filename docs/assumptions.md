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

## Sound

The visor can play wind recorded on Mars: the SuperCam microphone of Perseverance, at Jezero
crater, on sol 4 (22 February 2021). The file in `public/audio` is the MP3 that NASA publishes,
unchanged, played on a loop at the volume it was published with. It was recorded at Jezero; at
the other sites the visor plays the same recording and says it was not recorded there.

Source: [Perseverance Rover's SuperCam Records Wind on Mars](https://science.nasa.gov/resource/perseverance-rovers-supercam-records-wind-on-mars/),
NASA/JPL-Caltech/LANL/CNES/CNRS/ISAE-Supaero.

## Simulated

- The walk: the astronaut's position, heading, time outside, life support and dose all follow the
  plan at the assumed speed. Nobody is walking it. The console can play it faster than real time.
- The base stands on the landing point of the mission at each site.

## Illustrative

- The photographs in the visor are real 360-degree mosaics (see the table below), each taken
  from one fixed spot. The visor shows the one taken nearest to the astronaut's simulated position
  and says how far away that was. Between two photographs nothing moves forward: there is no
  video of a walk on Mars, and the app does not fake one.
- Only one photograph has a caption that says where north is (PIA20840). The others are not lined
  up with the compass: turning turns the view by the right amount, but what is ahead in the
  picture is not what is ahead on the ground. The visor says which case it is.
- Three things were set by eye for each photograph: the row of the horizon, the band that is free
  of the black gaps at the top and bottom of the mosaic, and the colour that continues the sky
  above that band. Black areas inside the band are where the camera took no frame.
- Gale, Jezero and Gusev have their own photographs. Meridiani and Elysium borrow one from Gale,
  and the visor says so.

| Photograph | Where and when | Source |
|---|---|---|
| Curiosity Mastcam, the landing site with Mount Sharp | Gale, Bradbury Landing, August 2012 | [PIA16101](https://images.nasa.gov/details/PIA16101), NASA/JPL-Caltech/MSSS |
| Curiosity Mastcam amid the Murray Buttes | Gale, sol 1451 (2016) | [PIA20840](https://images.nasa.gov/details/PIA20840), NASA/JPL-Caltech/MSSS |
| Curiosity Mastcam on Vera Rubin Ridge | Gale, sol 2137 (2018) | [PIA22545](https://images.nasa.gov/details/PIA22545), NASA/JPL-Caltech/MSSS |
| Curiosity Mastcam below Gediz Vallis Ridge | Gale, sol 3928 (2023) | [PIA26019](https://images.nasa.gov/details/PIA26019), NASA/JPL-Caltech/MSSS |
| Perseverance Mastcam-Z, first 360-degree panorama | Jezero, landing site, sol 3 (2021) | [PIA24264](https://images.nasa.gov/details/PIA24264), NASA/JPL-Caltech/MSSS/ASU |
| Perseverance Mastcam-Z at Bright Angel | Jezero, sol 1178 (2024) | [PIA26369](https://images.nasa.gov/details/PIA26369), NASA/JPL-Caltech/ASU/MSSS |
| Spirit Pancam, the McMurdo panorama | Gusev, Low Ridge, 2006 | [PIA16440](https://images.nasa.gov/details/PIA16440), NASA/JPL-Caltech/Cornell |

The place of each Gale and Jezero photograph is the rover's published position on the sol it was
taken.

## Decoration

- The stars behind the globe are not a star catalogue.
- The light on the globe travels with the camera; it is not the real position of the Sun.
