# Direction lock

Fingers never move in a straight line. Without a lock, scrolling a list drifts sideways and swiping a row nudges the list.

## The lock

Wait until the pointer has moved about 10px, then decide which axis wins. Measure from the lock point afterwards, so nothing jumps by the 10px it took to decide.

```ts
const LOCK_THRESHOLD = 10;
const LOCK_RATIO = 2;

onMove: (delta) => {
  if (axis.current === null) {
    if (Math.hypot(delta.x, delta.y) < LOCK_THRESHOLD) return;
    const ax = Math.abs(delta.x);
    const ay = Math.abs(delta.y);
    axis.current = ax > ay * LOCK_RATIO ? "x" : ay > ax * LOCK_RATIO ? "y" : "free";
    lockAt.current = delta;
  }

  const dx = delta.x - lockAt.current.x;
  const dy = delta.y - lockAt.current.y;
  x.set(axis.current === "y" ? 0 : dx);
  y.set(axis.current === "x" ? 0 : dy);
},
onEnd: (velocity) => {
  // A locked-out axis gets no velocity
  animate(x, 0, { ...SETTLE, velocity: axis.current === "y" ? 0 : velocity.x });
  animate(y, 0, { ...SETTLE, velocity: axis.current === "x" ? 0 : velocity.y });
},
```

- **Strict ratio (2×) with a "free" outcome:** for something that can move both ways (a box, a map). A clearly diagonal drag stays free.
- **Simple comparison (`|dx| > |dy|`):** when there are exactly two outcomes, such as a row swipe versus a list scroll. Every drag has to go somewhere.

## Swipe actions inside a scrolling list

Each row decides its own axis. Horizontal swipes the row; vertical hands the drag to the list.

```ts
// In the row
onStart: (start) => {
  list.onStart?.(start);   // touching a row stops the list, like any scroll view
  x.stop();
  originX.current = x.get();
  axis.current = null;
},
onMove: (delta) => {
  // …lock as above, two outcomes…
  if (axis.current === "y") {
    list.onMove({ x: 0, y: delta.y - lockAt.current.y });
    return;
  }
  x.set(applyRubberBand(originX.current + delta.x - lockAt.current.x, -ACTIONS, ACTIONS, rowWidth));
},
onEnd: (velocity) => {
  // The list always gets onEnd, but only a vertical drag gives it speed
  list.onEnd?.(axis.current === "y" ? velocity : { x: 0, y: 0 });
  if (axis.current !== "x") return;
  const landing = x.get() + project(velocity.x);
  const target = landing > ACTIONS / 2 ? ACTIONS : landing < -ACTIONS / 2 ? -ACTIONS : 0;
  animate(x, target, { ...SWIPE, velocity: velocity.x });
},
```

Details that matter:

- **An open row can only close.** At grab time, read which side is open from where the row was last sent (a `restingAt` ref set in `onEnd`), not from `x`. A row finishing its close sits a fraction of a pixel off 0 for a while after it looks shut; reading `x` would count it as still open, and the other side couldn't be swiped. A hard swipe the other way on a genuinely open row rubber bands at 0 instead of revealing the other side. See [decide from the target](springs.md#decide-from-the-target-not-the-value).
- **Action buttons stretch with the rubber band.** Past the open width the row keeps rubber banding, and the buttons grow with it so they always exactly fill the gap. That stretch is the feedback for a long swipe. On its own it doesn't run an action; the row still settles open. Only make a full swipe trigger an action when that's asked for (see [gesture modes](gesture-modes.md)).
- **Do it with transforms, not width.** Draw each button much wider than it needs to be (wider than the rubber band can ever reach), mostly hidden under the row, and slide it out with `x`. With two buttons per side, each shows half the gap, button `n` sliding to `(n + 1) · size`, where `size` is half the row's offset. The button nearest the edge stacks on top so the other can tuck behind it. Keep the icon in a fixed square on the edge facing the row, so it doesn't stretch.

```tsx
// size: visible width of each button, 0 → 60 while opening, past 60 when stretched
const size = useTransform(x, (v) => Math.max(0, v / 2));

function ActionButton({ size, slot, side }) {
  const sign = side === "left" ? 1 : -1;
  const x = useTransform(size, (s) => sign * ((slot + 1) * s - BUTTON_WIDTH));
  return <motion.button style={{ x, width: BUTTON_WIDTH, zIndex: 2 - slot }} />;
}
```

- **Buttons inside a draggable** call `e.stopPropagation()` on pointer down, or the drag captures the pointer and the button never gets its click.

## Native scroll plus a custom horizontal gesture

When the vertical axis is the browser's own scrolling:

- Set `touch-action: pan-y` on the element, so the browser keeps vertical scrolling and leaves horizontal to you.
- Don't call `setPointerCapture` on pointer down. Capture only once the lock picks your axis; otherwise taps on rows inside break, and the browser can't take the vertical scroll.
- `touch-action` is not inherited by a nested scroll container. Set it on the scroller itself too.
- `setPointerCapture` throws if the pointer is already gone. Wrap it in `try` and abandon the gesture if it fails.

See [pointer events](pointer-events.md) for the events that end a gesture.

## Pull to refresh

A vertical list whose top edge rubber bands, with a loader drawn from the pull distance.

- Drive the loader from the list's position (`useMotionValueEvent(y, "change", …)`) and write to the DOM directly. Don't set state per frame.
- Nothing shows for the first few px, then the loader fills until the pull crosses the refresh threshold (around 56px).
- Fix the top edge for the whole drag at grab time. If it changed mid-drag (when loading starts), the rubber band would suddenly stop squashing and the list would jump.
- While loading, the list rests a little short of the threshold (like a content inset), so on release it visibly settles back up and the loader stays in view.
- When loading ends mid-drag, leave it; `onEnd` sends the list home. Otherwise spring back to 0.
- If you draw a progress ring, let it erase back to 0 as the list returns rather than vanishing.
