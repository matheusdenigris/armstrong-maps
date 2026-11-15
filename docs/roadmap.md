# Roadmap

The GitHub issues are the source of truth. This page explains how they are grouped and in what
order the work goes.

## Milestones

| # | Milestone | What it delivers |
|---|---|---|
| 1 | Foundation | The Expo app, CI, the English-only gate, the web deploy and the Android build |
| 2 | Mars globe | The entry screen: a 3D globe with coverage areas and landing sites |
| 3 | Surface map and layers | A touch map of each site with NASA layers and the rover traverse |
| 4 | Safety and environment | Weather, radiation, daylight and the go, caution or no-go verdict |
| 5 | Walk planning | Tap a route, get distance, time, life support and dose |
| 6 | Astronaut visor | The first-person view with compass, minimap and vitals |
| 7 | Ship and astronaut link | What the ship changes shows up in the visor |
| 8 | Mobile release | Icons, offline use, device testing and the Play Store build |
| 9 | Hackathon submission | What Space Apps asks for: project page, demo, credits |

## Where it stands

On 2026-11-15, at the close of the hackathon weekend. The live site is https://www.armstrongmaps.us
and the demo video is https://youtu.be/xQKNnt-h_sA.

| # | Milestone | State | Closed / open issues |
|---|---|---|---|
| 1 | Foundation | Done | 17 / 0 |
| 2 | Mars globe | Done on the web: lit by the real Sun, with relief and the landing sites | 11 / 0 |
| 3 | Surface map and layers | Done: Viking, CTX, HiRISE and the InSight mosaic, six overlay layers with colour keys, the height and slope of any point | 19 / 0 |
| 4 | Safety and environment | Done for what has a source: life support, walk-back limit, daylight, radiation, space weather, steep ground and dune fields. Dust has no published feed and is left out | 16 / 0 |
| 5 | Walk planning | Done: stops with a time and a task, science targets at Gale and Jezero, an elevation profile, a way round steep ground and a plan shared as a link | 19 / 0 |
| 6 | Astronaut visor | Done: the helmet display over real photographs, alerts with sound, the view from the stops of Perseverance at Jezero. Limits of that view are in #148 | 21 / 1 |
| 7 | Ship and astronaut link | Done: line of sight over the elevation model, messages from the ship, the walk log | 8 / 0 |
| 8 | Mobile release | Not started: no build on a phone yet, nothing tried on a real device | 0 / 8 |
| 9 | Hackathon submission | Demo video published; this page, the credits and the AI statement written. The project page and the team section wait for the submission | 2 / 11 |

What is left against the challenge statement is tracked in #127: walking speed that depends on
the ground (#140), a way back that avoids steep ground (#141), science targets at the other
three sites (#142), a mineral layer (#143) and an objective for the walk (#144).

## Order

1. Foundation first: nothing ships without the build and the gates.
2. The surface map and the walk verdict are the core of the challenge, so milestones 3, 4 and 5
   come before the globe is polished.
3. The visor reads the same mission state as the console, so it follows walk planning.
4. Mobile release and the submission run alongside from the first working screen.

## Labels

| Label | Meaning |
|---|---|
| `priority` | Needed for the hackathon submission |
| `owner: matheus`, `owner: miguel`, `owner: larissa`, `owner: claude` | Who is on it |
| `feature`, `data`, `safety`, `ux`, `infra`, `docs`, `idea` | Kind of work |

```bash
gh issue list --label priority
gh issue list --label "owner: claude"
```

Do not pick up someone else's issue without a comment on it first.
