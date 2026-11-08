// A spring that doesn't depend on any animation library, for GSAP, plain JS or
// anything else. Same model and numbers as springFromResponse: response is
// roughly how long it takes to get there (seconds), dampingRatio is how much
// it bounces (1 = none). Solved exactly rather than stepped, so it behaves the
// same at 60Hz and 120Hz.

export interface SpringOptions {
  from: number;
  to: number;
  // Starting speed in units per second (px/s for positions), e.g. the release
  // velocity from VelocityTracker
  velocity?: number;
  response: number;
  dampingRatio: number;
  onUpdate: (value: number) => void;
  onComplete?: () => void;
  // Settles once it's this close and this slow
  restDelta?: number;
  restSpeed?: number;
}

export interface SpringAnimation {
  // Stops where it is and returns the value and speed at that moment, so the
  // next animation can carry on from them
  stop: () => { value: number; velocity: number };
}

// Value and velocity t seconds after release
export const springAt = (
  t: number,
  from: number,
  to: number,
  velocity: number,
  response: number,
  dampingRatio: number,
) => {
  const w = (2 * Math.PI) / response;
  const z = dampingRatio;
  const x0 = from - to;
  const v0 = velocity;

  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    const decay = Math.exp(-z * w * t);
    const b = (v0 + z * w * x0) / wd;
    const cos = Math.cos(wd * t);
    const sin = Math.sin(wd * t);
    return {
      value: to + decay * (x0 * cos + b * sin),
      velocity: decay * (v0 * cos - ((z * w * v0 + w * w * x0) / wd) * sin),
    };
  }

  if (z === 1) {
    const decay = Math.exp(-w * t);
    const b = v0 + w * x0;
    return {
      value: to + decay * (x0 + b * t),
      velocity: decay * (v0 - w * b * t),
    };
  }

  const root = w * Math.sqrt(z * z - 1);
  const r1 = -z * w + root;
  const r2 = -z * w - root;
  const c2 = (v0 - r1 * x0) / (r2 - r1);
  const c1 = x0 - c2;
  return {
    value: to + c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t),
    velocity: r1 * c1 * Math.exp(r1 * t) + r2 * c2 * Math.exp(r2 * t),
  };
};

export const springTo = (options: SpringOptions): SpringAnimation => {
  const {
    from,
    to,
    velocity = 0,
    response,
    dampingRatio,
    onUpdate,
    onComplete,
    restDelta = 0.5,
    restSpeed = 10,
  } = options;

  const start = performance.now();
  let current = { value: from, velocity };
  let frame = 0;

  const tick = (now: number) => {
    const t = Math.max(0, now - start) / 1000;
    current = springAt(t, from, to, velocity, response, dampingRatio);

    const settled =
      Math.abs(current.value - to) < restDelta &&
      Math.abs(current.velocity) < restSpeed;

    if (settled) {
      current = { value: to, velocity: 0 };
      onUpdate(to);
      onComplete?.();
      return;
    }

    onUpdate(current.value);
    frame = requestAnimationFrame(tick);
  };

  frame = requestAnimationFrame(tick);

  return {
    stop: () => {
      cancelAnimationFrame(frame);
      return current;
    },
  };
};
