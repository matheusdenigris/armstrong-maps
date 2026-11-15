# Testing on real phones

Owner: Miguel. A checklist for testing https://www.armstrongmaps.us on real devices, and the
Expo build on Android and iOS once there is one.

- **Layout on real phones:** Android and iPhone. Drag, pinch, tapping waypoints, the phone held
  sideways, the sheets and tabs.
- **Visor legibility:** contrast and text size over a bright sky photograph and on a small screen.

**Every problem becomes an issue with a screenshot:** New issue, then "Device test finding". The
form asks for the device, the screen, the steps, what was expected, what happened and the
screenshot. Label it `owner: larissa` for the interface or `owner: claude` for data or logic.

**How to tick:** copy the list of one device into a comment on the testing issue. In a comment the
boxes can be ticked.

Minimum devices: one Android phone with Chrome and one iPhone with Safari.

## Globe and site list (`/`)

- [ ] The globe shows up and turns without stuttering
- [ ] The relief and the lit side of Mars show, and the line under the globe names them
- [ ] Dragging with a finger turns the globe, and the page does not scroll
- [ ] Choosing a site flies to it and opens its map
- [ ] The title, the site cards and the hint fit the screen with no cut and no sideways scroll,
      upright and sideways
- [ ] The Docs card opens `/docs`

## Site map (`/site/gale`)

- [ ] The map tiles load (up to 15 s on Wi-Fi)
- [ ] Dragging with one finger moves the map without scrolling the page
- [ ] Pinching zooms in and out, slowly and fast
- [ ] Tapping the map adds a waypoint, and the route and the dashed return line follow
- [ ] The + and - buttons and the recentre button are easy to hit without touching a neighbour
      (44 pt targets)
- [ ] Nothing hides under the browser bar (iPhone: the address bar showing and hiding)
- [ ] The base, waypoint and rover labels can be read and do not overlap
- [ ] The pin button reads the height and the slope of a pressed point
- [ ] At Jezero, the sample sites, the depot and the flights open their card with a press

## Sheet and tabs

- [ ] "More" opens the sheet and "Less" closes it; the map stays visible
- [ ] The Walk, Link, Site and Photos tabs switch the panel
- [ ] The panel scrolls inside itself, and the map does not move with it
- [ ] Turning a layer on and off changes the map (one topographic and one thermal)
- [ ] The opacity steps are easy to tap
- [ ] A layer that is on shows its colour key: ramp, low and high, unit and source
- [ ] The Site tab shows the weather, the radiation average, the space weather card and the rover
- [ ] The Photos tab shows the rover's raw images and the NASA Image Library pictures; tapping one
      opens its NASA page

## The walk

- [ ] The verdict (go, caution, no-go) changes as the waypoints move away from the base
- [ ] Undo and Clear work
- [ ] A waypoint can be dragged with a finger, and the verdict follows
- [ ] The list of stops sets the time and the task of a stop, and removes one
- [ ] A science target added from its card brings its name, task and source (Gale, Jezero)
- [ ] "Avoid steep ground" adds points round a steep stretch
- [ ] "Share the plan" copies a link that opens the same plan on another phone
- [ ] At night, the panel offers to simulate the walk from the next morning
- [ ] Start, Pause and Resume work, and the astronaut moves along the route
- [ ] "End the walk" unlocks the route
- [ ] Return to base sends the astronaut straight back

## Ship link and walk log

- [ ] The Link tab says whether the base sees the astronaut, and it drops behind high ground
- [ ] A message sent from the console shows in the visor until it is acknowledged
- [ ] The walk log in the Link tab lists the waypoints, alerts, link and messages, and exports
      as a text file
- [ ] Every number carries a source or a "simulated" or "assumption" label

## The five sites

- [ ] Gale (`/site/gale`)
- [ ] Jezero (`/site/jezero`)
- [ ] Meridiani (`/site/meridiani`)
- [ ] Gusev (`/site/gusev`)
- [ ] Elysium (`/site/elysium`)

## Docs (`/docs`)

- [ ] The page scrolls, and long endpoints wrap without sideways scroll
- [ ] "Read more" opens the source in the browser

## General

- [ ] With the system font made larger (accessibility settings), text stays on screen
- [ ] On a weak 4G signal the app loads and shows what failed (note the time until the map shows)
- [ ] After 5 min of use the phone does not get too hot or freeze (the globe uses WebGL)

## Visor legibility (`/visor/gale`)

- [ ] "Open the astronaut visor" opens the visor in a new tab
- [ ] Starting the walk in the console moves the heading tape and the numbers in the visor (both
      tabs in the same browser)
- [ ] At high brightness, outdoors or near a window, numbers and labels stay readable (note the
      time and place)
- [ ] Small text (labels, footer, photo credit) is readable over the bright sky
- [ ] Nothing overlaps on a small screen: heading tape, readouts, round map and buttons
- [ ] With the phone sideways, the round map and the readouts stay readable
- [ ] The photograph carries its credit and says the framing is illustrative
- [ ] With the sound on, an alert and a message from the ship are heard, and the phone vibrates
      (note whether the silent switch mutes them)
- [ ] "Phone look" turns the view as the phone turns
- [ ] At Jezero, near a stop of Perseverance, the view of that stop shows and says how far it is

## Done when

- Layout: Android and iPhone tested, each problem in an issue with a screenshot.
- Visor: contrast and text size reviewed over a bright sky and on a small screen, with an issue
  for each fix.
