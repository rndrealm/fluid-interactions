# Other libraries: GSAP and plain JS

**Prefer motion.** This file is the fallback for when motion isn't an option: the user wants to keep a single existing library, or motion can't be added. If neither applies, suggest motion first (see "Use motion" in `SKILL.md`).

The examples in this skill use React and motion/react, but only a few pieces depend on motion. Everything else carries over unchanged: the maths in `physics.ts` (`VelocityTracker`, `rubberBand`, `project`, `nearest`), the pointer handling, and every rule.

The piece that matters most is a **spring that starts from the finger's speed**. GSAP tweens are duration plus easing, and `elastic` only looks like a spring: neither takes a starting velocity. Use [code/spring.ts](../code/spring.ts) instead. It has the same model and gives the same numbers as `springFromResponse` with motion, and works with GSAP, plain JS or any framework.

## Mapping

| motion/react                                                   | GSAP                                                                          | Plain JS                                         |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| `useMotionValue(0)`                                            | A plain number you own, written with `gsap.quickSetter(el, "x", "px")`        | A plain number, written to `el.style.transform`  |
| `useTransform(x, …)`                                           | Compute derived values in the same function that writes `x`                   | Same                                             |
| `animate(x, to, { ...spring, velocity })`                      | `springTo({ from, to, velocity, response, dampingRatio, onUpdate: setX })`    | Same                                             |
| `x.stop()` then `x.get()`                                      | `const { value } = anim.stop()`                                               | Same                                             |
| `animate(opacity, 1, FADE)`                                    | `gsap.to(el, { opacity: 1, duration: 0.2, ease: "power1.out" })`              | A CSS transition or `el.animate()`               |
| `useDrag` (pointer events + `VelocityTracker`)                 | The same pointer handling, without React (below)                              | Same                                             |
| `useReducedMotion()`                                           | `gsap.matchMedia()` with `"(prefers-reduced-motion: reduce)"`                 | `matchMedia("(prefers-reduced-motion: reduce)")` |
| `noBounce(spring)`                                             | `dampingRatio: reduce ? Math.max(ratio, 1) : ratio`                           | Same                                             |
| `layoutId` (shared layout)                                     | The `Flip` plugin, or the single-progress approach in [morphing](morphing.md) | The single-progress approach                     |
| The coasting loop in [drag and momentum](drag-and-momentum.md) | The same loop, or `InertiaPlugin` for simple flings (see below)               | The same loop                                    |

`springFromResponse(response, dampingRatio)` and `springTo({ response, dampingRatio })` take the same two numbers, so the values in [springs](springs.md) apply as they are.

## A full example: flick to the nearest corner

The same gesture as the "basic shape" in `SKILL.md`, with GSAP and no React:

```ts
import gsap from "gsap";
import {
  VelocityTracker,
  applyRubberBand,
  project,
  nearestPoint,
} from "./physics";
import { springTo, type SpringAnimation } from "./spring";

const SNAP = { response: 0.45, dampingRatio: 0.8 };

const setX = gsap.quickSetter(box, "x", "px");
const setY = gsap.quickSetter(box, "y", "px");
const position = { x: 16, y: 16 };
const render = () => {
  setX(position.x);
  setY(position.y);
};

let reduce = false;
gsap
  .matchMedia()
  .add({ reduce: "(prefers-reduced-motion: reduce)" }, (context) => {
    reduce = Boolean(context.conditions?.reduce);
  });
const ratio = (r: number) => (reduce ? Math.max(r, 1) : r);

const tracker = new VelocityTracker();
let pointerId: number | null = null;
let start = { x: 0, y: 0 };
let origin = { x: 0, y: 0 };
let springs: SpringAnimation[] = [];

box.style.touchAction = "none";

box.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || pointerId !== null) return;
  pointerId = e.pointerId;
  box.setPointerCapture(e.pointerId);
  // Catch it mid-flight: stop exactly where it is
  springs.forEach((s) => s.stop());
  springs = [];
  origin = { ...position };
  start = { x: e.clientX, y: e.clientY };
  tracker.reset();
  tracker.add(e.clientX, e.clientY);
});

box.addEventListener("pointermove", (e) => {
  if (e.pointerId !== pointerId) return;
  tracker.add(e.clientX, e.clientY);
  position.x = applyRubberBand(
    origin.x + e.clientX - start.x,
    0,
    maxX,
    stageWidth,
  );
  position.y = applyRubberBand(
    origin.y + e.clientY - start.y,
    0,
    maxY,
    stageHeight,
  );
  render();
});

const end = (e: PointerEvent) => {
  if (e.pointerId !== pointerId) return;
  pointerId = null;
  // Only a real release carries speed
  const v = e.type === "pointerup" ? tracker.get() : { x: 0, y: 0 };
  const landing = {
    x: position.x + project(v.x),
    y: position.y + project(v.y),
  };
  const target = nearestPoint(landing, corners());

  springs = (["x", "y"] as const).map((axis) =>
    springTo({
      from: position[axis],
      to: target[axis],
      velocity: v[axis],
      response: SNAP.response,
      dampingRatio: ratio(SNAP.dampingRatio),
      onUpdate: (value) => {
        position[axis] = value;
        render();
      },
    }),
  );
};

box.addEventListener("pointerup", end);
box.addEventListener("pointercancel", end);
box.addEventListener("lostpointercapture", end);
```

Every pattern in the other references translates the same way: own the numbers, write them with `quickSetter` (or straight to the style), and end every gesture with `springTo` from the release velocity.

## GSAP's own drag and momentum tools

GSAP ships `Draggable` and `InertiaPlugin`. They're fine for simple cases, but they don't match this skill's behaviour exactly, so know the trade-off:

- **`Draggable` moves the element itself.** Its `edgeResistance` is a simple resistance, not the rubber band curve here, and you don't control when it captures the pointer, so direction lock with native scroll and taps inside is harder. For anything in the [direction lock](direction-lock.md) or [swipe back](swipe-back.md) references, use your own pointer handlers as above.
- **`InertiaPlugin` coasts with its own deceleration** and doesn't spring off an edge with the remaining speed. For a quick fling it's fine (`gsap.to(el, { inertia: { x: { velocity: v.x, min, max } } })`), and its `end` option takes a function, so `end: (natural) => nearest(natural, targets)` snaps to a target. For a scroller that should feel like the platform's (normal, fast, paging, bouncing at the edges), use the coasting loop and `springTo`.

If a project already uses `Draggable`, keep it for pointer handling, kill any running springs in `onPress`, and hand the release to `springTo` in `onRelease` with the velocity from `InertiaPlugin.getVelocity(el, "x")` (requires `InertiaPlugin.track(el, "x")`) or from your own `VelocityTracker`.

## Other frameworks

Vue, Svelte, Solid and plain DOM all work the same way as the GSAP example: keep positions in plain variables (not reactive state), write transforms directly, and use `springTo`. Reactive state on every pointer move re-renders on every event in any framework.
