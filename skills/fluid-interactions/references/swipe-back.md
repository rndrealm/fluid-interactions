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

- **Catching mid-slide:** if `x > 0` and the press lands **on the moving page** (`fromEdge >= x`), `x.stop()`, take it from where it is and start dragging straight away. A press to the left of the moving page's edge is on the page underneath: leave it alone, so its rows can be tapped.
- **A cancel or lost capture is the system taking the touch,** not a flick: settle with velocity `0`.
- **Reset the whole gesture state on end,** phase too, so nothing leaks into the next drag.
- **Recover from a stale gesture:** if a new pointer arrives while the old one is recorded but no longer captured, the old touch ended without telling you. Reset and accept the new one, or every drag from then on gets refused.

## Changing pages without a flash

Pop the page in the spring's `onComplete`, then reset `x` to 0 in a `useLayoutEffect` keyed on the stack. That runs after React swaps the pages but before paint, so the outgoing page never flashes back for a frame. A push sets `x` to `width` in the same effect and springs it to 0.

## Taps while a page is going back

The page underneath is fully revealed well before the back spring finishes (about 0.3s against 0.54s for a 0.35s no-bounce spring). If taps on it wait for `onComplete`, every quick tap after going back is silently dropped. Don't wait:

```ts
const goingBack = useRef(false); // set in goBack, cleared on pop, stay, or grab

const goBack = (velocity: number) => {
  goingBack.current = true;
  animate(x, width, { ...NAV, velocity, onComplete: pop });
};

const pop = () => {
  if (!goingBack.current) return; // a late onComplete after the user took over
  goingBack.current = false;
  setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
};

// Rows on the page underneath
const openFromUnder = (to: string) => {
  if (!goingBack.current) return;
  goingBack.current = false;
  x.stop();
  setStack((s) => [...s.slice(0, -1), to]); // drop the outgoing page, push the new one, in one update
};
```

The layout effect then has to treat "same length, different array" as a push too, so the new page slides in from the right:

```ts
const pushed =
  stack.length > prev.length ||
  (stack.length === prev.length && stack !== prev);
```

Taps on the **moving** page itself (during a push, or while it slides away) are still ignored, or they'd stack pages mid-slide.

## Gotchas

- The rows under the finger may hold the pointer first, and their `lostpointercapture` bubbles up to the container when you take capture. Only treat it as the end of the drag when `e.target === e.currentTarget`.
- `setPointerCapture` throws if the pointer is already gone. Wrap it in `try`; on failure, reset and settle.
- Never pop the root page.

Under reduced motion, keep the swipe as it is (it follows the finger), drop the parallax, and make tapped navigation (push and the back button) fade instead of slide.
