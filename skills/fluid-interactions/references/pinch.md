# Pinch to zoom

An image or canvas you pinch to zoom and drag to pan. Whatever you pinched stays under your fingers the whole time, past the limits it resists, and on release it springs back around your fingers.

Use [code/use-pinch.ts](../code/use-pinch.ts). It tracks every finger on the element and reports their midpoint and how far apart they've moved since the last baseline. One finger is a pan, two or more a pinch, and it tells a double tap from both.

## One rule does the whole gesture

When the fingers go down, remember which point on the image is under their midpoint (the anchor) and the scale at that moment. On every move, set the new scale, then move the image so the anchor is back under the midpoint:

```ts
// The point on the image, in unscaled px, that's under p right now
const imagePointAt = (p: Point) => {
  const s = bandScale(raw.current.scale);
  return { x: (p.x - raw.current.x) / s, y: (p.y - raw.current.y) / s };
};

// Zoom to rawScale and move the image so imagePoint lands under p
const placeImage = (rawScale: number, imagePoint: Point, p: Point) => {
  const s = bandScale(rawScale);
  raw.current = {
    scale: rawScale,
    x: p.x - imagePoint.x * s,
    y: p.y - imagePoint.y * s,
  };
  render();
};

const pinch = usePinch({
  onBaseline: (mid) => {
    gesture.current = { scale0: raw.current.scale, anchor: imagePointAt(mid) };
  },
  // Fingers twice as far apart = twice the scale
  onMove: (mid, ratio) => {
    const { scale0, anchor } = gesture.current;
    placeImage(scale0 * ratio, anchor, mid);
  },
});
```

That one call is both the zoom around the fingers and the pan as they move together. Don't zoom around the image's centre and pan separately: the thing you pinched slides away from your fingers.

Scale the image from its top-left corner (`originX: 0, originY: 0`), so `x` and `y` are simply where that corner sits and the maths above stays this short. Move it with `x`, `y` and `scale` only.

## Re-measure whenever a finger is added or lifted

`onBaseline` fires on every change in the set of fingers, not only the first. A second finger landing, or one lifting mid-pinch, starts a new baseline from the current midpoint and spread, so nothing jumps. Lifting one finger of a pinch carries on as a pan.

## Keep the raw value, rubber band on the way out

Keep what the fingers ask for (`raw`) separate from what's on screen. Gestures write to `raw`, and one `render()` rubber bands it:

```ts
const render = () => {
  const s = bandScale(raw.current.scale);
  const b = boundsFor(s);
  scale.set(s);
  x.set(applyRubberBand(raw.current.x, b.minX, b.maxX, width));
  y.set(applyRubberBand(raw.current.y, b.minY, b.maxY, height));
};
```

Rubber band the scale as a **ratio**, so pinching past the maximum resists the same as squeezing below the minimum:

```ts
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SCALE_BAND = 0.5; // never overshoots by more than 50%

// Pass rubberBandInverse to undo it
const bandScale = (s: number, band = rubberBand) => {
  if (s > MAX_SCALE) return MAX_SCALE * (1 + band(s / MAX_SCALE - 1, SCALE_BAND));
  if (s < MIN_SCALE) return MIN_SCALE / (1 + band(MIN_SCALE / s - 1, SCALE_BAND));
  return s;
};
```

The pan's bounds depend on the scale. Zoomed in, any offset that keeps the stage covered. Below 1× (while rubber banding), centred:

```ts
const boundsFor = (s: number) => {
  const slackX = width - width * s;
  const slackY = height - height * s;
  return {
    minX: Math.min(slackX, slackX / 2),
    maxX: Math.max(0, slackX / 2),
    minY: Math.min(slackY, slackY / 2),
    maxY: Math.max(0, slackY / 2),
  };
};
```

## Catch it mid-spring

On the first finger down, stop every spring and turn what's on screen back into raw values with `unapplyRubberBand` and the inverse scale band. Otherwise the rubber band is applied twice and the image jumps toward the fingers.

```ts
const catchImage = () => {
  scale.stop();
  x.stop();
  y.stop();
  const s = scale.get();
  const b = boundsFor(s);
  raw.current = {
    scale: bandScale(s, rubberBandInverse),
    x: unapplyRubberBand(x.get(), b.minX, b.maxX, width),
    y: unapplyRubberBand(y.get(), b.minY, b.maxY, height),
  };
};
```

## Let go: settle around the fingers

Spring to the nearest allowed scale while keeping the point under the fingers still, then fit the pan inside the new bounds:

```ts
const zoomTo = (target: number, focal: Point, velocity: Point, transition: Spring) => {
  const s = scale.get();
  const b = boundsFor(target);
  const tx = focal.x - ((focal.x - x.get()) / s) * target;
  const ty = focal.y - ((focal.y - y.get()) / s) * target;
  animate(scale, target, spring(transition));
  animate(x, clamp(tx + project(velocity.x), b.minX, b.maxX), { ...spring(transition), velocity: velocity.x });
  animate(y, clamp(ty + project(velocity.y), b.minY, b.maxY), { ...spring(transition), velocity: velocity.y });
};
```

Only a pan inside the edges carries momentum. If the scale is springing back, or the image is already past an edge, pass zero velocity on that axis: it's on its way back, and the fingers' drift would fling it further out.

## Double tap

Zoomed in: back to fit. At fit: zoom into the tapped point (about 2.5×), using `zoomTo` with no velocity and a no-bounce spring. A double tap uses up both taps, so a third tap doesn't count as another.

## Trackpads and mice

A trackpad pinch arrives as `wheel` events with `ctrlKey` set (so does ctrl + scroll on a mouse), and a two-finger drag as a plain `wheel`. React's `onWheel` is passive, so add a native listener with `{ passive: false }` to call `preventDefault`.

- Zoom with `raw.scale * Math.exp(-deltaY * 0.01)` around the cursor, through the same `placeImage`.
- While at fit and not pinching, let plain wheel events scroll the page. Only take them over once zoomed in.
- Wheel events never say the fingers lifted, so settle once they stop arriving (about 120ms). The cost: holding still mid-pinch past a limit for that long counts as letting go.
- Ignore wheel events while fingers are down on a touch screen.

## Reduced motion

The pinch itself is the user's own motion, so it's unchanged. Only the springs lose their overshoot (`spring()` from `use-motion-preference.ts`).

## Checklist

- [ ] Pinch on a detail: it stays exactly under your fingers as you zoom.
- [ ] Pinch past the maximum or below 1×: it resists, and on release springs back around your fingers, not the centre.
- [ ] Pan past an edge while zoomed: it resists and springs back.
- [ ] Lift one finger mid-pinch, then put it back: no jump either time.
- [ ] Grab it while it's springing back: it stops exactly where it is.
- [ ] Double tap to zoom in on a point, again to zoom out.
- [ ] At fit, scrolling the page over the image still scrolls the page.
