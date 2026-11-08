# Swipe back

Drag from the left edge of a navigation stack to go back. The top page tracks the finger; the page underneath follows at a fraction of the speed (parallax) with a dim that clears as it's revealed.

```ts
const EDGE = 24; // px from the left edge where the swipe can start
const LOCK = 10;
const PARALLAX = width * 0.3;
const NAV = springFromResponse(0.35, 1); // no bounce for navigation

const x = useMotionValue(0); // how far the top page has slid: 0 showing, width gone
const underX = useTransform(x, [0, width], [reduceMotion ? 0 : -PARALLAX, 0]);
const dim = useTransform(x, [0, width], [0.06, 0]);
```

## The gesture

The whole page is full of tappable rows, so this can't capture on pointer down.

1. **Pointer down:** start only within `EDGE` of the left edge (or anywhere if a page is mid-slide). Record the start, phase `"pending"`. Don't capture.
2. **Pointer move while pending:** wait for `LOCK` px. If it's moving right and more horizontal than vertical, capture the pointer and switch to `"dragging"`. Otherwise drop the gesture so the page scrolls and taps work.
3. **Dragging:** `x = max(0, origin + dx − lockOffset)`. It hard-stops at 0 because the page is pinned to the screen's left edge: the one deliberate exception to rubber banding directions with no action.
4. **Release:** go back if `x + project(velocity) > width / 2`, otherwise stay. Both spring with the release velocity.

```ts
const settle = (velocity: number) => {
  const landing = x.get() + project(velocity);
  if (landing > width / 2) goBack(velocity);
  else stayHere(velocity);
};
```

- **Catching mid-slide:** if `x > 0` on pointer down, `x.stop()`, take it from where it is and start dragging straight away.
- **A cancel or lost capture is the system taking the touch,** not a flick: settle with velocity `0`.
- **Reset the whole gesture state on end,** phase too, so nothing leaks into the next drag.
- **Recover from a stale gesture:** if a new pointer arrives while the old one is recorded but no longer captured, the old touch ended without telling you. Reset and accept the new one, or every drag from then on gets refused.

## Changing pages without a flash

Pop the page in the spring's `onComplete`, then reset `x` to 0 in a `useLayoutEffect` keyed on the stack length. That runs after React swaps the pages but before paint, so the outgoing page never flashes back for a frame. A push sets `x` to `width` in the same effect and springs it to 0.

Ignore taps on rows while a page is moving (read `x.isAnimating() || x.get() !== 0`, not a flag), or they stack pages mid-slide.

## Gotchas

- The rows under the finger may hold the pointer first, and their `lostpointercapture` bubbles up to the container when you take capture. Only treat it as the end of the drag when `e.target === e.currentTarget`.
- `setPointerCapture` throws if the pointer is already gone. Wrap it in `try`; on failure, reset and settle.
- Never pop the root page.

Under reduced motion, keep the swipe as it is (it follows the finger), drop the parallax, and make tapped navigation (push and the back button) fade instead of slide.
