# Gesture modes

One gesture can do several things. What it does depends on how it moves, not only which way: where it started, how far and how fast it went, whether it paused, and what a second dimension is doing. Swiping up on a phone's home bar can go home, open the app switcher or stay in the app. Dragging a video scrubber away from the bar makes it scrub more slowly.

## Three kinds

| Decided         | By                                                   | Example                                                                                                                                                     |
| --------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| At the start    | Where it began, or which axis wins after 10px        | Swipe back only starts near the left edge ([swipe back](swipe-back.md)). A row swipe versus a list scroll ([direction lock](direction-lock.md)).            |
| During the drag | A second dimension changes how the first one behaves | Fine scrubbing: the further the finger is from the bar, the slower it scrubs ([scrubbing](scrubbing.md)). Swipe-action buttons stretching past their width. |
| On release      | Speed, distance and pauses                           | Home bar: home, switcher, next or previous app, or stay (below). A flick on a sheet skipping a detent ([sheets](sheets.md)).                                |

## Rules

1. **The plain version always works.** Swiping up goes home; dragging scrubs. The other modes are a reward for people who find them, never a requirement.
2. **Show the mode before release.** Preview what will happen: the neighbouring cards appear when a pause would open the switcher, the scrubber shows the current rate. If people can't tell what will happen, the gesture feels random.
3. **Changing mode never jumps.** Work in deltas, not absolute positions. The scrubber adds movement at the new rate instead of moving the playhead to the finger; a threshold eases toward its new value instead of switching instantly.
4. **Keep the meanings related.** Every outcome of swiping up is about leaving the app; fine scrubbing is still scrubbing. Don't put unrelated actions on one gesture.
5. **Check the strongest signal first:** the axis, then the decisive ones (a fast flick, a long distance), then the subtle one (a pause).
6. **Don't add a destructive mode on your own.** A long swipe on a row can stretch the action buttons without triggering anything. Only make it run an action (delete on a full swipe, say) when that's asked for, and then show it clearly before release.

## Worked example: a home bar

One drag that can end in several places: swipe up fast to go home, swipe up and pause to open the app switcher, swipe sideways to switch apps, or let go early to stay.

## Decide from velocity and position

Write the decision as one pure function you can call at any time:

```ts
const decide = (
  delta: Point,
  velocity: Point,
  pauseThreshold: number,
): Outcome => {
  // Mostly sideways: switch apps
  if (Math.abs(velocity.x) > 2 * Math.abs(velocity.y) && Math.abs(delta.x) > 40)
    return delta.x < 0 ? "next" : "prev"; // or "app" if there's nothing there

  const up = -delta.y;
  // A fast flick up, or most of the way up: home
  if (-velocity.y > 210 || up > height * 0.6) return "home";
  // Slowed down in the middle zone: switcher
  if (
    up > 50 &&
    up < height * 0.6 &&
    Math.hypot(velocity.x, velocity.y) < pauseThreshold
  )
    return "switcher";

  return "app";
};
```

Order matters: check the sideways case first, then the decisive ones (flick, distance), then the subtle one (pause).

## Run it every frame, not every pointer event

A finger held still sends no pointer events, so "the user paused" can't be detected in `pointermove`. Run a `requestAnimationFrame` loop while the finger is down: read the tracker's velocity, call `decide`, and update the preview (show the neighbouring cards when the outcome would be the switcher).

`requestAnimationFrame`'s timestamp is on the same clock as `performance.now()`, which `VelocityTracker` uses.

## A pause threshold that adapts

A fixed "slow enough" speed is either too eager or too hard to hit. Let it climb while the finger hovers in the switcher zone and decay when it leaves:

```ts
const target = inSwitcherZone(up) ? 134 : 51; // px/s
const ease = 1 - Math.pow(1 - 0.2, (now - lastTick) / (1000 / 60));
pauseThreshold += (target - pauseThreshold) * ease;
```

Scale the easing by frame time, so 120Hz screens don't climb twice as fast.

## Settling

Each outcome is a set of springs from the current position with the release velocity:

- **app:** x, y → 0, scale → 1.
- **switcher:** x, y → 0, scale → 0.6, neighbours and backdrop fade in.
- **home:** fly to the app's icon. Read the icon's rect once at release (not per frame), then spring x, y and scale to it and fade out near the end.
- **prev or next:** move the neighbour into the front slot by shifting x by one card width, then settle like "app".

Shrink the card's corner radius with its scale so it lands close to the icon's.

## Keep it cheap

- Every card moves with `x`, `y`, `scale` and `opacity`. Neighbours are `useTransform`s of the front card's position.
- All per-frame state (the tracker, the last delta, the threshold, the frame id) lives in refs. React state changes only on release.
- Cancel the frame loop on release and on unmount.

Under reduced motion, opening from and returning to an icon becomes a fade in place, and springs lose their bounce. The card still follows the finger.
