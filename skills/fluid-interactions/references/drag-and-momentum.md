# Drag and momentum

## Velocity

The browser gives positions, not speed. `VelocityTracker` keeps the last 100ms of pointer positions and measures across them. Only recent movement counts: a slow drag that ends in a flick should report the flick.

`useDrag` does this for you and passes the release velocity (px/s) to `onEnd`.

## Following the finger

Store where the element was when the drag started, then add the pointer's offset. Never accumulate per-event deltas into state.

```ts
onStart: () => {
  x.stop();
  origin.current = x.get();
},
onMove: (delta) => x.set(origin.current + delta.x),
```

Give the dragged element `touch-action: none` and `user-select: none`. Without `touch-action`, a slow drag on a phone scrolls the page, and a fast one flicks it away.

## Rubber band

Past an edge, the element keeps moving but less and less, approaching a limit it never reaches:

```
offset = (1 − 1 / (c · x / d + 1)) · d
```

- `x`: how far past the edge the finger has pulled.
- `d`: the limit, usually the container's size on that axis.
- `c`: how stiff it feels; `0.55` matches iOS.

At small pulls it moves about `c` px per finger px; at large pulls it barely moves.

```ts
x.set(applyRubberBand(origin.current + delta.x, min, max, containerWidth));
```

On release, spring back to the edge with the release velocity, **but only on an axis that's actually past its edge**. Released inside its bounds, a freely placed element stays exactly where it was dropped:

```ts
onEnd: (velocity) => {
  const targetX = clamp(x.get(), min, max);
  // Already inside: leave it. Springing to where it already is would carry
  // the release speed past that point and wobble back, a bounce from nowhere.
  if (targetX !== x.get()) animate(x, targetX, { ...SETTLE, velocity: velocity.x });
},
```

Use a spring with no bounce (damping ratio `1`) for the trip back from past an edge: the rubber band has already shown where the edge is, and overshooting it would show a gap ([springs](springs.md#how-much-bounce)).

This is only for things that can rest anywhere. Something with targets (corners, detents, pages) always springs to the chosen target, as described under projection.

To grab something mid-bounce and continue the stretch without a jump, convert the current offset back into a pull with `rubberBandInverse(offset, d)`.

For something with no free range (it should always return to 0), use `stretch(delta, d)`.

## Directions with no action

Most gestures do something in one direction only: a card dismisses downward, a page goes back to the right, a sheet opens upward. The other directions should still respond, under a rubber band, and spring back on release.

This is for something the user is holding that moves freely under the finger: a card being dismissed, a draggable box, a sheet. Once it's in the user's hand, every direction responds, and the ones that do nothing resist.

- **Not frozen.** Locking the other axis to 0 makes the element feel stuck to a rail, as if the finger slipped off it.
- **Not free.** Moving 1:1 suggests that direction does something too, and then nothing happens on release.
- **Resisting** says "this moves, but not that way", and it costs one line.

```ts
onMove: (delta) => {
  const y = origin.current.y + delta.y;
  // Sideways does nothing: it resists either way
  x.set(stretch(origin.current.x + delta.x, containerWidth));
  // Down dismisses: free. Up does nothing: it resists
  y.set(y > 0 ? y : -rubberBand(-y, containerHeight));
},
onEnd: (velocity) => {
  // The no-action axis always goes home, carrying its speed
  animate(x, 0, { ...SPRING, velocity: velocity.x });
  // …decide the action axis from y + project(velocity.y)
},
```

`origin` holds the finger offset, not the on-screen value. If you grab it again mid-spring, convert the current offset back first, or the stretch is applied twice and it jumps:

```ts
onStart: () => {
  x.stop();
  const shown = x.get();
  origin.current.x = Math.sign(shown) * rubberBandInverse(Math.abs(shown), containerWidth);
},
```

The same rule shows up elsewhere: an open swipe-action row rubber bands at 0 instead of revealing the other side ([direction lock](direction-lock.md)), a sheet rubber bands above its top detent ([sheets](sheets.md)), and a pull-to-refresh list rubber bands at the bottom.

**Not when the other axis belongs to something else.** A horizontal carousel on a scrolling page doesn't rubber band its items vertically. Vertical belongs to the page. Hand it off with a [direction lock](direction-lock.md) instead:

- After 10px, mostly sideways: the carousel captures the pointer and moves; vertical movement is ignored from then on.
- Mostly vertical: the carousel lets go and the browser scrolls the page (`touch-action: pan-y` on the carousel, and no pointer capture before the lock).

Rubber banding vertically there would grab the carousel every time someone tried to scroll past it. A carousel still rubber bands at its own ends, past the first and last item; that's the ordinary edge rubber band, not this rule.

The same goes for swipe-action rows in a list: vertical belongs to the list.

**The exception is something pinned to an edge.** A page being swiped back is attached to the left edge of the screen, so it hard-stops at 0. There's nothing behind it to the left, and showing a gap would look broken.

## Projection: where a flick would land

When you release something, decide where it ends up from where it was going, not where it was:

```
projection = (v / 1000) · rate / (1 − rate)
```

- `v`: release velocity in px/s.
- `rate`: fraction of speed kept each millisecond. `0.998` coasts like a normal scroll view; `0.99` stops sooner.

This is the total distance a decelerating scroll would travel. Add it to the current position and snap to the nearest target from there:

```ts
onEnd: (velocity) => {
  const landing = x.get() + project(velocity.x);
  animate(x, nearest(landing, targets), { ...SNAP, velocity: velocity.x });
};
```

In 2D, project both axes and use `nearestPoint`:

```ts
const landing = { x: x.get() + project(v.x), y: y.get() + project(v.y) };
const target = nearestPoint(landing, corners);
```

Without projection, a quick flick from near one target snaps back to it, which feels like the interface is ignoring you. With projection, a short, fast flick goes to the next target.

Scale the velocity down (`project(v.y * 0.75)`) when targets are close together and flicks overshoot too easily.

## Coasting (a custom scroller)

For free scrolling, let it decelerate instead of snapping. The position at time `t` (ms) after release:

```
position(t) = p0 + v0 · (rate^t − 1) / (1000 · ln(rate))
velocity(t) = v0 · rate^t
```

Run it on `requestAnimationFrame` and stop when the speed drops below about 10px/s. If it hits an edge mid-flight, clamp to the edge and hand the remaining velocity to a spring, so it bounces:

```ts
const coast = (v0: number, rate: number) => {
  const p0 = x.get();
  const t0 = performance.now();
  const lnRate = Math.log(rate);

  const tick = () => {
    const t = performance.now() - t0;
    const decay = Math.pow(rate, t);
    const position = p0 + (v0 * (decay - 1)) / (1000 * lnRate);
    const velocity = v0 * decay;

    if (position > max || position < min) {
      const edge = clamp(position, min, max);
      x.set(edge);
      animate(x, edge, { ...BOUNCE, velocity });
      return;
    }

    x.set(position);
    if (Math.abs(velocity) > 10) frame.current = requestAnimationFrame(tick);
  };

  frame.current = requestAnimationFrame(tick);
};
```

Cancel the frame on pointer down (and on unmount) along with `x.stop()`.

If the release is already past an edge, skip coasting and spring straight back.

## Paging

Project with the fast rate, round to the nearest page, clamp:

```ts
const step = pageWidth + gap;
const landing = x.get() + project(velocity.x, DECELERATION.fast);
const target = clamp(Math.round(landing / step) * step, min, max);
animate(x, target, { ...PAGE, velocity: velocity.x });
```

## Normal, fast, or paging

Pick by what the content is and what the user is trying to do:

| Use              | When                                                                       | Examples                                                                               |
| ---------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Normal (`0.998`) | Long content people browse, where flinging far is useful                   | Feeds, long lists, maps, a free-scrolling row of many small items                      |
| Fast (`0.99`)    | Short content, or picking something precisely, where it shouldn't fly past | A short row of chips, value pickers, a scroller only slightly wider than its container |
| Paging           | Equal units that each fill the view, viewed one at a time                  | Photo viewers, onboarding, full-width cards, app-store-style carousels                 |

- **Items smaller than the view don't page.** If each item is clearly smaller than the view and there are many, scroll normally, or snap to the nearest item from a normal-rate projection.
- **Snap targets project at the normal rate.** Sheets and corners use `0.998`. If targets are close and flicks overshoot, scale the velocity down (`project(v * 0.75)`) rather than switching to fast.
- **Paging projects at the fast rate** so a flick moves one page, not several. A very hard flick can still skip a page; clamp to one page either side if it must never skip.
- **When unsure, use normal.** It matches the platform's own scrolling.

## Interruptible by default

Every drag starts with `stop()` and reading the current value. Never refuse a grab because something is animating; a refused grab is the clearest sign an interface isn't native.
