# Reduced motion

People turn on reduced motion because large or unexpected movement makes them feel unwell. It doesn't mean "no animation".

## The rule

**Never change what the finger drives.** Dragging, scrubbing and swiping are the user's own motion; they must still follow the finger exactly.

**Soften what moves by itself:**

1. **Springs settle without overshooting.** Raise damping to critical, `2√(k·m)`. The response and the velocity handoff stay the same; only the bounce goes.
2. **Big automatic movements become short fades in place:** things that fly across the screen, grow out of a thumbnail, or slide in from the side. Use about 200ms ease-out.
3. **Drop decorative motion:** parallax, background scaling.

## Code

```ts
const { reduceMotion, spring } = useMotionPreference();

animate(x, target, { ...spring(SNAP), velocity }); // bounce removed when reduced
```

For a big movement, branch:

```ts
if (reduceMotion) {
  card.set(finalPosition);
  opacity.set(0);
  animate(opacity, 1, FADE);
  return;
}
animate(card, finalPosition, SPRING);
```

For a fade out, reset the state in `onComplete` and check the user didn't reverse it mid-fade.

## Motion's own animations

Wrap the app in `<MotionConfig reducedMotion="user">`. That covers `layout`, `layoutId` and transform animations set through props. It does **not** cover `animate()` calls, which you handle yourself as above.

## Per pattern

| Pattern                               | Reduced                                                     |
| ------------------------------------- | ----------------------------------------------------------- |
| Drag, flick, snap                     | Springs without bounce                                      |
| Sheet                                 | Keep the dim, drop the background scale                     |
| Morph into a detail view              | Fade in at full size; fade out from where the drag left it  |
| Swipe back                            | Swipe unchanged; no parallax; push and the back button fade |
| Opening from and returning to an icon | Fade in place                                               |
| Scrubber, swipe actions               | Springs without bounce                                      |
