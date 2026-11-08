# Springs

## Why springs

A duration-based animation (300ms, ease-out) always starts from rest. When the user lets go mid-drag, the element is already moving at the finger's speed, so a duration animation stops it dead for a frame and then sets off again. A spring has no fixed duration. It only needs where it is, where it's going and how fast it's already moving, so it carries the finger's speed straight through.

Use springs for anything the user can touch or that responds to a gesture. Plain fades (opacity only) can stay duration-based.

## Describe springs by response and damping ratio

Stiffness and damping are hard to reason about. Use two numbers instead:

- **response**: roughly how long it takes to get there, in seconds.
- **dampingRatio**: how much it bounces. `1` settles without overshooting; lower values bounce more.

```ts
const SPRING = springFromResponse(0.45, 0.88);
// → { type: "spring", stiffness: 195, damping: 24.6, mass: 1 }

animate(x, target, { ...SPRING, velocity: releaseVelocity });
```

The conversion:

```
stiffness = (2π / response)² · mass
damping   = 4π · dampingRatio · mass / response
```

Changing `response` changes the speed without changing the feel; changing `dampingRatio` changes the bounce without changing the speed. With raw stiffness and damping, changing one changes both.

## How much bounce

Bounce says "you threw this and it carried your speed". Use it where that's true and harmless.

| dampingRatio           | When                                                                             | Examples                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `1` (none)             | The system is putting something where it belongs, it's big, or it's full of text | Navigation push and pop, paging, scroll edges, rows closing, full-screen views, anything read while it settles |
| `0.85–0.9` (a little)  | Small or medium objects the user flings or snaps                                 | Picture-in-picture, sheets, cards snapping, toggles, selection pills, morphs into a detail view                |
| `0.7–0.8` (noticeable) | Small, playful, rare moments                                                     | A success tick, a like, a press-and-release on a small button                                                  |

- **Bigger means less bounce.** A full-screen view wobbling feels broken; a 60px object wobbling feels alive.
- **No bounce at a hard edge.** The rubber band already shows the edge; overshooting it would show a gap.
- **Velocity adds bounce by itself.** A flicked object overshoots more than a tapped one with the same spring. Don't lower the damping to get more drama on flicks.
- **Reduced motion means none.** `noBounce` raises any spring to critical damping.
- **When unsure, use `1`.** Missing bounce is rarely noticed; wrong bounce always is.

## How fast (response)

| response    | When                                                                       |
| ----------- | -------------------------------------------------------------------------- |
| `0.3–0.35`  | Small UI: toggles, pills, press states                                     |
| `0.35–0.45` | Most things: snapping, sheets, cards, navigation, morphs                   |
| `0.45–0.5`  | Large or far-travelling things: full-screen transitions, flying to an icon |
| `0.9`       | Slow on purpose, for example to show off interruption in a demo            |

The further something travels and the bigger it is, the longer the response. Velocity handoff already makes flicks feel fast, so don't shorten the response to compensate.

## Always pass the velocity

```ts
onEnd: (velocity) => {
  animate(x, target, { ...SPRING, velocity: velocity.x });
};
```

`velocity` is in px/s, the same unit `VelocityTracker` returns. Axes are animated separately, so each gets its own velocity. If an axis was locked out (see [direction lock](direction-lock.md)), pass `0` for it.

When a spring animates something other than the dragged value (a progress from 0 to 1, say), convert the velocity into that value's units first, or pass `0`.

## Interrupting

Springs pick up from the current value and velocity, so interrupting is just starting a new one. To grab something mid-flight:

```ts
onStart: () => {
  x.stop(); // freeze it exactly where it is on screen
  origin.current = x.get();
};
```

## Decide from the target, not the value

A spring looks finished long before it is. With no bounce, a 0.35s spring travelling 286px is 98% of the way there at about 0.3s, but motion only finishes it (and calls `onComplete`) at about 0.54s, once it's within 0.5px and nearly still. For that last quarter of a second the value is a fraction of a pixel off its target.

So never use the animated value, `isAnimating()` or `onComplete` to decide what state something is in or whether input is allowed:

- `x.get() !== 0` is true for a row that looks closed, so it still counts as open.
- `x.isAnimating()` is true for a page that looks gone, so taps on what's underneath get refused.
- Waiting for `onComplete` makes the interface feel like it ignores you right after every animation.

Instead, keep the **target** in a ref and set it whenever you start an animation. That's the state the interface is in, as far as the user is concerned:

```ts
const restingAt = useRef(0); // 0 closed, ±ACTIONS_WIDTH open

const settle = (target: number, velocity: number) => {
  restingAt.current = target; // decided now, not when the spring ends
  animate(x, target, { ...SWIPE, velocity });
};

onStart: () => {
  x.stop();
  origin.current = x.get(); // where it is, for following the finger
  const openSide = Math.sign(restingAt.current); // where it's going, for deciding
},
```

Use the value for positioning (where to continue the drag from), and the target for decisions (which side is open, which page is current, whether a tap should go through).

Because every new animation overwrites the target, this can't get stuck the way a flag cleared in `onComplete` can (motion skips `onComplete` when another animation replaces the current one). Clear or change the target when the user grabs the element mid-flight.

If you need `onComplete` for cleanup (popping a page, unmounting a card), guard it with the target, so a late `onComplete` from an animation the user already overrode does nothing. And when the user acts during the tail, do the cleanup right away instead of waiting for it; see [swipe back](swipe-back.md).
