# Scrubbing

A video or audio progress bar you drag, with fine scrubbing: the further your finger moves away from the bar, the slower it scrubs.

Fine scrubbing is one of the [gesture modes](gesture-modes.md): a second dimension (distance from the bar) changes how the first one (horizontal movement) behaves.

## Add movement, don't jump to the finger

The playhead adds the finger's horizontal movement, scaled by the current rate. It never jumps to the finger's position, so changing speed mid-scrub never skips.

```ts
const ZONES = [
  { from: 0, rate: 1 },
  { from: 50, rate: 0.5 },
  { from: 100, rate: 0.25 },
  { from: 150, rate: 0.125 },
];

onStart: (start) => {
  const rect = track.getBoundingClientRect();
  geometry.current = {
    trackY: rect.top + rect.height / 2,
    secondsPerPx: (video.duration || 0) / track.clientWidth, // NaN until metadata loads
  };
  lastDeltaX.current = 0;
},
onMove: (delta) => {
  const { trackY, secondsPerPx } = geometry.current;
  if (!secondsPerPx) return;

  // Distance from the bar itself, not from where the finger went down
  const fingerY = start.y + delta.y;
  const zone = zoneFor(Math.abs(fingerY - trackY));

  const dx = delta.x - lastDeltaX.current;
  lastDeltaX.current = delta.x;

  const time = clamp(current.get() + dx * secondsPerPx * ZONES[zone].rate, 0, video.duration);
  current.set(time);
  video.currentTime = time;
},
```

## Play state

- Pause while scrubbing, for precise control.
- Remember whether it was playing at the start. Resume on release only if it was.
- If the play/pause icon follows the video's `pause` event, ignore the pause caused by the scrub itself, or the icon flickers.

## Feedback while held

- Grow the bar on press with a small spring (`springFromResponse(0.3, 0.8)`), shrink on release.
- Show the elapsed time and duration while held. Show them in the spots the play and mute buttons normally occupy, cross-fading with them.
- Show the current rate (`0.25×`) only while scrubbing.
- Drive all of these from motion values (`useTransform` from the time and a 0→1 pressed value), not state.

## Optional: stretch past the ends

Pushing past either end can stretch the bar with the rubber band and spring it back on release. Track the overflow in finger px, show `rubberBand(overflow, limit)`, and use the movement back toward the bar to undo the overflow before scrubbing resumes. It's a nice touch, but not essential.
