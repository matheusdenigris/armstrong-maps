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
