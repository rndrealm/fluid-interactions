# Sheets

A bottom sheet with detents (for example closed, half, full). The sheet's `y` is the distance from the top of the screen to its top edge.

```ts
const FULL = screenHeight * 0.1;
const HALF = screenHeight * 0.4;
const CLOSED = screenHeight - peekHeight; // handle + search field + margin
const DETENTS = [FULL, HALF, CLOSED];

const drag = useDrag({
  onStart: () => {
    y.stop();
    origin.current = y.get();
  },
  onMove: (delta) => {
    y.set(
      applyRubberBand(origin.current + delta.y, FULL, CLOSED, screenHeight),
    );
  },
  onEnd: (velocity) => {
    const landing = y.get() + project(velocity.y * 0.75);
    const target = nearest(landing, DETENTS);
    setDetent(target); // state only on release
    animate(y, target, { ...spring(SHEET), velocity: velocity.y });
  },
});
```

- **Project before snapping,** so a quick flick from closed can skip half and land on full. The `0.75` damps the projection because detents are close together.
- **Rubber band past both ends.** Pulling above full or below closed resists instead of hard-stopping. Make the sheet taller than the screen so the rubber band never shows its bottom edge.
- **State only on release or button press.** The current detent is state (it changes what renders); the sheet's position is a motion value.
- **Buttons that change detent** use the same spring without a velocity.

## The background

Derive it from `y` with transforms, so it tracks the drag for free:

```ts
const dim = useTransform(y, [FULL, HALF], [0.06, 0]);
const backgroundScale = useTransform(
  y,
  [FULL, HALF],
  [reduceMotion ? 1 : 0.92, 1],
);
```

Under reduced motion keep the dim but drop the scale; see [reduced motion](reduced-motion.md).

At the top detent, make the dimmed background tappable: a tap there drops the sheet to the middle detent, not all the way closed. The user wants the background back, not to lose their place in the sheet. Below the top detent, leave the background alone (`pointer-events: none` on the dim) so the map or page underneath still works.

## Content that scrolls

- **Drag from the handle.** Give the handle a full-width hit area with generous padding (the bar itself is only about 5px tall).
- **Only let the list scroll at full.** At lower detents use `overflow: hidden`, otherwise a drag inside the list is ambiguous between scrolling and moving the sheet.
- **Give the list a fixed height** (the visible height at full, minus the handle and header) and `overscroll-behavior: contain`, so reaching the end doesn't scroll the page.
- **Safari leaves a flex column's bottom padding out of its scroll height.** Add a spacer element at the end of the list instead of `padding-bottom`.
