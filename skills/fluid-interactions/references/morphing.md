# Morphing

A thumbnail grows into a full view, and you drag it back down to put it away. It has to read as one object the whole way.

## One progress value

Drive the whole morph from a single `progress` (0 = on the thumbnail, 1 = full view), with a separate drag offset on top. Measure the thumbnail and container once when opening, then interpolate:

```ts
const progress = useMotionValue(0);
const dragX = useMotionValue(0);
const dragY = useMotionValue(0);

const left = useTransform([progress, itemX], ([p, t]) => t * (1 - p));
const width = useTransform(
  [progress, itemW, containerW],
  ([p, t, s]) => t + (s - t) * p,
);
// …top and height the same way
```

Because it's one value, opening, closing and dragging all compose, and the open can be interrupted by the close at any point.

Using `layoutId` (shared layout animation) also works for simpler morphs. If the element is positioned with transforms, put the transform on a wrapper and the `layoutId` on a child: motion ignores an element's own transform when measuring, but applies its ancestors'.

## Keep something constant

Pick one thing that stays the same through the morph (a cover image, an icon, a glyph) and render it identically in the thumbnail and the open view, just bigger. That's what makes the eye read it as one object.

Hold back everything else:

```ts
const bodyOpacity = useTransform(progress, [0.6, 1], [0, 1]); // text only once it's big enough to read
const labelOpacity = useTransform(progress, [0, 0.4], [1, 0]); // the tile's own labels leave early
```

Never show text squeezed into something the size of a thumbnail.

## Drag down to dismiss

```ts
onMove: (delta) => {
  const y = origin.y + delta.y;
  dragX.set(stretch(origin.x + delta.x, containerWidth)); // sideways does nothing: it resists
  dragY.set(y > 0 ? y : -rubberBand(-y, containerHeight)); // down is free, up resists
},
onEnd: (velocity) => {
  const landing = dragY.get() + project(velocity.y);
  if (landing > containerHeight * 0.25) close(velocity);
  else open(velocity);
},
```

- Only down does anything, so up and sideways rubber band (see [directions with no action](drag-and-momentum.md#directions-with-no-action)).
- Shrink the card as it's dragged (`scale` from 1 to 0.5 over 60% of the height) and fade the dim behind it.
- `close` springs `progress` to 0 and the drag offsets to 0 with the release velocity, so it flies back into the tile at the flick's speed.
- In `close`'s `onComplete`, check it wasn't reopened mid-flight before unmounting.
- Treat a release under about 6px of movement as a tap.
