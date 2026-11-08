# Pointer events

Most "it freezes on mobile" and "it gets stuck" bugs are a gesture that never received its end, or the browser taking the touch.

## Use pointer events, not mouse and touch

One code path for mouse, touch and pen. Track the `pointerId` that started the gesture and ignore every other pointer.

## touch-action

Without it, the browser treats a touch drag as a scroll: a slow drag scrolls the page, a fast one flings it, and you get `pointercancel` partway through.

- `touch-action: none` on anything you drag freely.
- `touch-action: pan-y` when the browser should keep vertical scrolling and you handle horizontal (and `pan-x` for the reverse).
- It isn't inherited by nested scroll containers. Set it on each scroller.
- Add `user-select: none`, or dragging past the edge selects nearby text.

## Ending a gesture

End on all three, through one function that checks the pointer id:

- `pointerup`: a normal release.
- `pointercancel`: the browser or OS took the touch (a scroll started, a system gesture, an incoming call).
- `lostpointercapture`: capture went away without a pointerup (app switch, context menu, element removed).

Only `pointerup` is a real release. For cancel and lost capture, settle with velocity 0 rather than projecting the speed.

Reset all gesture state on end, every field, so nothing leaks into the next one.

## Pointer capture

Capture keeps `pointermove` coming even when the finger leaves the element.

- **Capture on pointer down** for elements that are only ever dragged.
- **Capture after the direction lock** for anything that also has taps or native scroll inside it (rows, links). Capturing early steals their clicks and blocks the browser's scroll.
- `setPointerCapture` throws if the pointer is already gone. Wrap it in `try`, and drop the gesture if it fails.
- **Children's `lostpointercapture` bubbles.** When a child (a row) held the pointer and you take it, the child's event bubbles to your handler. Only treat it as yours if `e.target === e.currentTarget`.

## Defensive defaults

- Left button only: `if (e.button !== 0 || e.ctrlKey) return`. A right or ctrl-click opens the context menu, which swallows the pointerup.
- Ignore a second finger while one is dragging.
- **Recover from a stale gesture.** If a new pointer comes down while an old one is still recorded but not captured, the old one ended without an event (its target re-rendered away, or the system took it). Reset and accept the new one. Otherwise every later drag is refused and the UI looks frozen.
- `e.stopPropagation()` on pointer down in buttons that sit inside a draggable, so their click still fires.
- Cancel `requestAnimationFrame` loops and stop animations on unmount.

## State

Pointer handlers run many times a second. Keep gesture state in refs and positions in motion values (or write to the DOM directly). Setting React state per `pointermove` re-renders the tree on every event and drops frames, especially on phones.
