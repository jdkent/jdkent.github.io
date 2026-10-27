// A lazy-susan menu: panels stand around a turntable seen slightly from
// above, and the turntable spins to bring one panel to the front. Geometry
// follows the standard CSS ring: panel i sits at rotateY(i * step)
// translateZ(r), with r = (width / 2) / tan(pi / n), and the ring itself
// rotates. Drags spin it with momentum and snap to the nearest panel.

const TILT = -9;          // deg the turntable leans toward the viewer
const GAP = 18;           // px between neighbouring panels on the ring
const SETTLE = 0.11;      // s time constant for easing to the target angle
const DRAG_START = 6;     // px of horizontal travel before a press becomes a drag
const FLING = 0.2;        // s of release velocity carried into the snap
const MAX_SPEED = 900;    // deg/s cap on a fling
const SAMPLE_WINDOW = 100; // ms of recent movement used to measure release velocity

const mod = (a, n) => ((a % n) + n) % n;
const wrap180 = (deg) => mod(deg + 180, 360) - 180;

export function createLazySusan(scene, ring, panels, { onFront, reducedMotion = false }) {
  const n = panels.length;
  const step = 360 / n;
  let radius = 0, angle = 0, target = 0, front = 0;
  let frame = 0, last = 0, drag = null, suppressClick = false;

  function layout() {
    radius = Math.round((ring.offsetWidth / 2 + GAP) / Math.tan(Math.PI / n));
    // The scene sizes itself to the ring, since the tilt lowers the front panel.
    scene.style.setProperty("--radius", `${radius}px`);
    panels.forEach((el, i) => {
      el.style.transform = `rotateY(${i * step}deg) translateZ(${radius}px)`;
    });
    render();
  }

  function render() {
    ring.style.transform = `translateZ(${-radius}px) rotateX(${TILT}deg) rotateY(${angle}deg)`;
    panels.forEach((el, i) => {
      // 1 at the front of the turntable, 0 at the back.
      const depth = (Math.cos((wrap180(i * step + angle) * Math.PI) / 180) + 1) / 2;
      el.style.setProperty("--depth", depth.toFixed(3));
      // Panels turned away from the viewer are reached by turning, not clicking,
      // so they must not catch clicks meant for the panels in front of them.
      el.style.pointerEvents = depth < 0.5 ? "none" : "";
    });
    const f = mod(Math.round(-angle / step), n);
    if (f !== front) {
      front = f;
      onFront(f);
    }
  }

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!drag) {
      angle += (target - angle) * (1 - Math.exp(-dt / SETTLE));
      if (Math.abs(target - angle) < 0.05) angle = target;
    }
    render();
    frame = drag || angle !== target ? requestAnimationFrame(tick) : 0;
  }

  function animate() {
    if (reducedMotion && !drag) {
      angle = target;
      render();
      return;
    }
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }

  // Bring panel i to the front by the shortest way round.
  function goTo(i, { instant = false } = {}) {
    target += wrap180(-i * step - target);
    if (instant) {
      angle = target;
      render();
    } else {
      animate();
    }
  }

  // Turn by whole panels; positive brings the panel on the right to the front.
  function spin(by) {
    target = Math.round(target / step) * step - by * step;
    animate();
  }

  scene.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, from: angle, moved: false, samples: [[e.timeStamp, angle]] };
  });

  scene.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(e.clientY - drag.y) > Math.abs(dx) + 4) { drag = null; return; }
      if (Math.abs(dx) < DRAG_START) return;
      drag.moved = true;
      scene.setPointerCapture(e.pointerId);
      scene.classList.add("is-dragging");
    }
    // Move the front panel's surface with the pointer: arc length to degrees.
    angle = target = drag.from + (dx * 180) / (Math.PI * radius);
    drag.samples.push([e.timeStamp, angle]);
    while (drag.samples.length > 2 && e.timeStamp - drag.samples[0][0] > SAMPLE_WINDOW) drag.samples.shift();
    animate();
  });

  // A cancelled gesture snaps to the nearest panel without a fling.
  function release(e) {
    if (!drag) return;
    if (drag.moved) {
      const [[t0, a0]] = drag.samples;
      const [t1, a1] = drag.samples[drag.samples.length - 1];
      const fresh = e.type === "pointerup" && t1 > t0 && e.timeStamp - t1 < SAMPLE_WINDOW;
      const velocity = fresh ? Math.max(-MAX_SPEED, Math.min(MAX_SPEED, ((a1 - a0) / (t1 - t0)) * 1000)) : 0;
      target = Math.round((angle + velocity * FLING) / step) * step;
      scene.classList.remove("is-dragging");
      // The click that ends a drag is not a selection.
      suppressClick = true;
      setTimeout(() => (suppressClick = false));
    }
    drag = null;
    animate();
  }
  // Panels hold links; a native link drag would cancel the pointer stream.
  scene.addEventListener("dragstart", (e) => e.preventDefault());
  scene.addEventListener("pointerup", release);
  scene.addEventListener("pointercancel", release);
  scene.addEventListener("click", (e) => {
    if (!suppressClick) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  layout();
  // `front` is the panel at the front now; `target`, the one the ring is turning to.
  return { layout, goTo, spin, get front() { return front; }, get target() { return mod(Math.round(-target / step), n); } };
}
