import { useRef } from "react";
import { Point, VelocityTracker } from "./physics";

// A tap: one finger that barely moved and lifted quickly
const TAP_SLOP = 8;
const TAP_TIME = 250;
// A double tap: a second tap soon after the first, and near it
const DOUBLE_TAP_TIME = 300;
const DOUBLE_TAP_SLOP = 30;

interface IProps {
  // First finger down
  onStart?: () => void;
  // A finger was added or lifted. Measure from here: ratio in onMove is
  // relative to this moment, so the change never makes anything jump
  onBaseline: (midpoint: Point) => void;
  // ratio = how far apart the fingers are now / at the last baseline (1 with
  // one finger). Points are relative to the element.
  onMove: (midpoint: Point, ratio: number) => void;
  // Last finger lifted. velocity is the midpoint's speed in px/s
  onEnd?: (midpoint: Point, velocity: Point) => void;
  onDoubleTap?: (point: Point) => void;
}

// Pointer position relative to an element's top-left corner
export const localPoint = (
  el: Element,
  e: { clientX: number; clientY: number },
) => {
  const rect = el.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
};

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const midpointOf = (points: Point[]) => ({
  x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
  y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
});

// How far apart the first two fingers are
const spreadOf = (points: Point[]) =>
  points.length >= 2 ? distance(points[0], points[1]) : 0;

// Tracks every finger on an element and reports their midpoint and how far
// apart they've moved. One finger is a pan, two or more a pinch.
export const usePinch = (props: IProps) => {
  const { onStart, onBaseline, onMove, onEnd, onDoubleTap } = props;

  const pointers = useRef(new Map<number, Point>());
  const spread0 = useRef(0);
  const midpoint = useRef<Point>({ x: 0, y: 0 });
  const tracker = useRef(new VelocityTracker());
  // The press so far, to tell a tap from a pan or pinch
  const press = useRef({
    time: 0,
    origin: { x: 0, y: 0 },
    moved: 0,
    multi: false,
  });
  const lastTap = useRef({ time: 0, point: { x: 0, y: 0 } });

  const baseline = () => {
    const points = [...pointers.current.values()];
    midpoint.current = midpointOf(points);
    spread0.current = spreadOf(points);
    tracker.current.reset();
    tracker.current.add(midpoint.current.x, midpoint.current.y);
    onBaseline(midpoint.current);
  };

  // Call when the last finger lifts. A tap soon after another, near it, is a
  // double tap; it uses up both, so a third tap doesn't make another.
  const isDoubleTap = () => {
    const { time, origin, moved, multi } = press.current;
    const now = performance.now();
    if (multi || moved > TAP_SLOP || now - time > TAP_TIME) return false;

    const last = lastTap.current;
    const double =
      now - last.time < DOUBLE_TAP_TIME &&
      distance(origin, last.point) < DOUBLE_TAP_SLOP;
    lastTap.current = { time: double ? 0 : now, point: origin };
    return double;
  };

  const end = (e: React.PointerEvent<Element>) => {
    if (!pointers.current.delete(e.pointerId)) return;

    // One finger lifted mid-pinch: carry on with the rest
    if (pointers.current.size > 0) return baseline();

    if (isDoubleTap()) onDoubleTap?.(press.current.origin);
    else onEnd?.(midpoint.current, tracker.current.get());
  };

  return {
    onPointerDown: (e: React.PointerEvent<Element>) => {
      // Left button only: right-click opens the context menu, which swallows pointerup
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const p = localPoint(e.currentTarget, e);

      if (pointers.current.size === 0) {
        press.current = {
          time: performance.now(),
          origin: p,
          moved: 0,
          multi: false,
        };
        onStart?.();
      }
      pointers.current.set(e.pointerId, p);
      if (pointers.current.size > 1) press.current.multi = true;
      baseline();
    },
    onPointerMove: (e: React.PointerEvent<Element>) => {
      if (!pointers.current.has(e.pointerId)) return;
      const p = localPoint(e.currentTarget, e);
      pointers.current.set(e.pointerId, p);
      press.current.moved = Math.max(
        press.current.moved,
        distance(p, press.current.origin),
      );

      const points = [...pointers.current.values()];
      midpoint.current = midpointOf(points);
      tracker.current.add(midpoint.current.x, midpoint.current.y);
      const ratio =
        spread0.current > 0 ? spreadOf(points) / spread0.current : 1;
      onMove(midpoint.current, ratio);
    },
    onPointerUp: end,
    onPointerCancel: end,
    // Capture can be lost without a pointerup (app switch, context menu): always settle
    onLostPointerCapture: end,
  };
};
