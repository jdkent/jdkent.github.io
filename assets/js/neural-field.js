// The insular cortex from cortex.js, drawn behind the page. The cells'
// morphologies are painted once, faintly, like a Golgi stain, and activity
// is drawn only within the neurites, never as glows around them: a press
// injects current into the cells under it, and a cell's potential building
// toward threshold tints it faintly. When a cell fires, a pulse spreads out
// from its body through the dendritic tree, fading with distance (as a
// back-propagating action potential does), and each spike runs along its
// axon as a soft-edged pulse to the dendrite it reaches. The model runs in
// slow motion so the spread can be watched.
//
// Presses in quick succession raise arousal, which raises the release
// probability at every synapse and widens the area a press drives, so rapid
// pressing carries activity further (not faster: conduction sets the speed).
// Now and then a cell somewhere on screen is driven by itself.

import { createCortex, V_REST, AXON_SPEED } from "./cortex.js";

const LEVELS = 48;

const TIME_SCALE = 5 / 3; // model ms per real second
const RELEASE = { rest: 0.5, aroused: 0.8 };
// Arousal outlasts the slow-motion spread, so quick presses still carry it
// far: 24 s real is 40 ms of model time.
const AROUSAL_TAU = 24;    // s for arousal to decay by 1/e
const AROUSAL_AREA = 3;    // full arousal drives this much more area
// A press: current into the cells under it, in µA/cm² for model ms.
const PRESS = { amplitude: 14, ms: 6 };
// A pulse's shape along a neurite, in px: a soft leading edge and a longer
// fading tail. Dendritic pulses travel at the conduction speed and weaken
// over DENDRITE_REACH px of tree. Pulses in transit are dimmer and thinner
// than a firing cell's body, so the cells carry the picture.
const AXON_PULSE = { lead: 6, tail: 36, peak: 0.35, width: 0.9 };
const DENDRITE_PULSE = { lead: 10, tail: 70, peak: 0.5, width: 1.2 };
const DENDRITE_REACH = 260;
const WAVES_KEPT = 2;      // pulses drawn per tree; older ones are mostly faded tails
// Lit neurites are drawn in pieces this long (px), meeting end to end with
// square ends so no two overlap, which would show as beads along them.
const STRIDE = 3;
// Potentials within BUILDUP_FROM mV of rest are not drawn; above that the
// tint grows to BUILDUP_GLOW at BUILDUP_SPAN mV more. The tint follows a
// rising potential at once but fades over BUILDUP_FADE (real seconds), so a
// cell dims gradually after firing rather than going dark as it repolarizes.
const BUILDUP_FROM = 1.5, BUILDUP_SPAN = 12, BUILDUP_GLOW = 0.35, BUILDUP_FADE = 1.5;
// Spontaneous firing: a random cell on screen, at random intervals, four
// times as strong as a press.
const SPONTANEOUS_MEAN = 20; // s between firings, on average
const SPONTANEOUS_MIN = 5;   // s, at least
const SPONTANEOUS_STRENGTH = 4;
const MAX_PULSES = 1500;   // axon pulses drawn at once
const FAINTEST = 0.02;     // brightness below which a stretch is not drawn
// Low-power mode: when frames keep arriving slower than SLOW_FRAME (as on
// software rendering), draw activity at half resolution, with fewer and
// coarser axon pulses and only the brighter part of each pulse.
const SLOW_FRAME = 0.034;  // s, slower than ~30 fps
const SLOW_STREAK = 20;    // net slow frames before switching
const LOW_POWER = { scale: 0.5, maxPulses: 300, stride: 12, faintest: 0.15 };

// Brightness at `x` px behind a pulse's front (negative: ahead of it).
const pulse = (x, { lead, tail }) => (x < 0 ? Math.exp(-((x / lead) ** 2)) : Math.exp(-x / tail));

function quadPoint(s, t) {
  const u = 1 - t;
  return [u * u * s.ax + 2 * u * t * s.cx + t * t * s.bx, u * u * s.ay + 2 * u * t * s.cy + t * t * s.by];
}

function sample(stops, t) {
  for (let i = 1; i < stops.length; i++) {
    const [t1, ...c1] = stops[i];
    if (t <= t1) {
      const [t0, ...c0] = stops[i - 1];
      const f = (t - t0) / (t1 - t0);
      return c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
    }
  }
  return stops[stops.length - 1].slice(1);
}

// The colormap is five evenly spaced stops, --cmap-0 to --cmap-4, set per
// theme in base.css so the canvas and the colorbar share one definition.
function readColormap() {
  const css = getComputedStyle(document.documentElement);
  return [0, 1, 2, 3, 4].map((i) => {
    const hex = css.getPropertyValue(`--cmap-${i}`).trim().replace("#", "");
    return [i / 4, ...[0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16))];
  });
}

function traceSoma(ctx, c) {
  if (c.soma === "triangle") {
    ctx.moveTo(c.x, c.y - c.sh * 0.55);
    ctx.lineTo(c.x - c.sw / 2, c.y + c.sh * 0.45);
    ctx.lineTo(c.x + c.sw / 2, c.y + c.sh * 0.45);
    ctx.closePath();
  } else {
    ctx.moveTo(c.x + c.sw / 2, c.y);
    ctx.ellipse(c.x, c.y, c.sw / 2, c.sh / 2, 0, 0, Math.PI * 2);
  }
}

// Distance along the tree from the soma to each segment's two ends, and
// exp(d / tail) there. Behind a pulse's front f the pulse is
// exp(-(f - d) / tail) = exp(-f / tail) * exp(d / tail), so with the second
// factor stored per end, a tree is lit with one exponential per pulse, not
// one per piece. Segments continue from the end of an earlier one, or start
// at the soma.
function treeDistances(c) {
  const g = c.segs, ends = new Map(), n = (g.length / 5) * 2;
  const dist = new Float64Array(n), grow = new Float64Array(n);
  let reach = 0;
  for (let i = 0, j = 0; i < g.length; i += 5, j += 2) {
    const from = ends.get(`${g[i]},${g[i + 1]}`) ?? Math.hypot(g[i] - c.x, g[i + 1] - c.y);
    const to = from + Math.hypot(g[i + 2] - g[i], g[i + 3] - g[i + 1]);
    ends.set(`${g[i + 2]},${g[i + 3]}`, to);
    dist[j] = from; dist[j + 1] = to;
    grow[j] = Math.exp(from / DENDRITE_PULSE.tail); grow[j + 1] = Math.exp(to / DENDRITE_PULSE.tail);
    reach = Math.max(reach, to);
  }
  c.dist = dist;
  c.grow = grow;
  c.reach = reach;
}

export function createNeuralField(canvas, { reducedMotion = false, onSlow = () => {} } = {}) {
  // The resting cortex is painted once onto `canvas`. Activity is redrawn
  // every frame onto a second canvas stacked above it at CSS-pixel
  // resolution: soft gradients gain nothing from device pixels, and a full
  // device-pixel redraw per frame is what made rapid clicking stall.
  const live = canvas.cloneNode();
  canvas.after(live);
  const rest = canvas.getContext("2d");
  const ctx = live.getContext("2d");
  let width = 0, height = 0, dpr = 1;
  let cortex = null;
  let palette = [], dark = false;
  let arousal = 0, arousalAt = 0;
  let frame = 0, lastTick = 0;
  let scale = 1, maxPulses = MAX_PULSES, stride = STRIDE, faintest = FAINTEST, slow = 0;
  // Axon spikes being drawn: kept past their arrival until the pulse's tail
  // has drained into the dendrite it reached.
  let pulses = [];

  const now = () => performance.now() / 1000;
  const level = (e) => Math.min(LEVELS - 1, Math.max(0, Math.round(e * (LEVELS - 1))));
  // 0 when calm, approaching 1 as presses come faster.
  const arousalLevel = (t) => 1 - Math.exp(-Math.max(0, arousal * Math.exp(-(t - arousalAt) / AROUSAL_TAU) - 1) / 1.8);

  function build() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    live.width = Math.round(width * scale);
    live.height = Math.round(height * scale);
    cortex = createCortex(width, height);
    pulses = [];
    for (const c of cortex.cells) {
      c.waves = [];   // model times of recent spikes, whose pulses are still in the tree
      c.shade = 0;    // the build-up tint as drawn
      c.body = new Path2D();
      traceSoma(c.body, c);
      // The whole tree as one path, for drawing it evenly tinted: segments
      // that continue one another join into one line, with no ends to overlap.
      c.tree = new Path2D();
      const g = c.segs;
      for (let i = 0; i < g.length; i += 5) {
        if (i === 0 || g[i] !== g[i - 3] || g[i + 1] !== g[i - 2]) c.tree.moveTo(g[i], g[i + 1]);
        c.tree.lineTo(g[i + 2], g[i + 3]);
      }
      treeDistances(c);
    }
    paintRest();
    draw();
  }

  function paintRest() {
    const css = getComputedStyle(document.documentElement);
    const r = rest;
    r.setTransform(dpr, 0, 0, dpr, 0, 0);
    r.clearRect(0, 0, width, height);
    r.strokeStyle = css.getPropertyValue("--net-axon").trim();
    r.lineCap = "butt";
    // Dendrites, batched by width.
    const byWidth = new Map();
    for (const c of cortex.cells) {
      for (let i = 0; i < c.segs.length; i += 5) {
        const w = Math.round(c.segs[i + 4] * 4) / 4;
        if (!byWidth.has(w)) byWidth.set(w, []);
        byWidth.get(w).push(c.segs, i);
      }
    }
    for (const [w, list] of byWidth) {
      r.lineWidth = w;
      r.beginPath();
      for (let k = 0; k < list.length; k += 2) {
        const s = list[k], i = list[k + 1];
        r.moveTo(s[i], s[i + 1]);
        r.lineTo(s[i + 2], s[i + 3]);
      }
      r.stroke();
    }
    r.fillStyle = css.getPropertyValue("--net-soma").trim();
    r.beginPath();
    for (const c of cortex.cells) traceSoma(r, c);
    r.fill();
  }

  // The colormap sampled at each brightness level.
  function paintPalette() {
    const stops = readColormap();
    palette = Array.from({ length: LEVELS }, (_, i) => sample(stops, i / (LEVELS - 1)).join(","));
  }

  const onSpike = (c, sent) => {
    c.waves.push(cortex.time);
    if (c.waves.length > WAVES_KEPT) c.waves.shift();
    pulses.push(...sent);
  };
  // How far along its axon (px) a spike's pulse has run; past the end once arrived.
  const headOf = (e) => ((cortex.time - e.from) / cortex.synapses[e.syn].travel) * cortex.synapses[e.syn].len;
  // Each pulse's head, worked out once a frame.
  const placePulses = () => { for (const e of pulses) e.head = headOf(e); };

  // The tint of a cell's potential building toward threshold, now.
  const tint = (c) => BUILDUP_GLOW * Math.min(1, Math.max(0, c.v - V_REST - BUILDUP_FROM) / BUILDUP_SPAN);

  function step(dt) {
    cortex.step(dt * TIME_SCALE, RELEASE.rest + (RELEASE.aroused - RELEASE.rest) * arousalLevel(now()), onSpike);
    placePulses();
    pulses = pulses.filter((e) => e.head - AXON_PULSE.tail * 6 < cortex.synapses[e.syn].len);
    let active = cortex.inFlight.length > 0 || pulses.length > 0;
    const fade = Math.exp(-dt / BUILDUP_FADE);
    for (const c of cortex.cells) {
      c.shade = Math.max(tint(c), c.shade * fade);
      // A pulse is done once its tail has passed the tips of the tree.
      while (c.waves.length && AXON_SPEED * (cortex.time - c.waves[0]) > c.reach + DENDRITE_PULSE.tail * 4) c.waves.shift();
      if (c.waves.length || c.shade > 0.01 || cortex.time < c.extUntil) active = true;
    }
    return active;
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, live.width, live.height);
    if (!cortex) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // Light adds on black and deepens like ink on white.
    ctx.globalCompositeOperation = dark ? "lighter" : "multiply";
    ctx.lineCap = "butt";

    const visible = AXON_PULSE.tail * Math.log(AXON_PULSE.peak / faintest) + stride;

    // Lit pieces of neurite go into one path per brightness level, axons and
    // dendrites apart since they are drawn at different widths.
    const axons = new Array(LEVELS).fill(null), dendrites = new Array(LEVELS).fill(null);
    const bodies = new Array(LEVELS).fill(null);
    const piece = (paths, x0, y0, x1, y1, b) => {
      if (b < faintest) return;
      const l = level(Math.min(1, b));
      const p = paths[l] || (paths[l] = new Path2D());
      p.moveTo(x0, y0);
      p.lineTo(x1, y1);
    };

    // Axon pulses, in short pieces whose brightness follows the pulse.
    for (let k = 0; k < pulses.length && k < maxPulses; k++) {
      const e = pulses[k], s = cortex.synapses[e.syn];
      const head = e.head ?? headOf(e);
      // The pulse's pieces lie on a grid starting AXON_PULSE.tail * 6 behind
      // its head (or at the axon's start); those further back than `visible`
      // are fainter than `faintest`, so skip whole pieces up to there.
      const origin = Math.max(0, head - AXON_PULSE.tail * 6);
      const from = origin + stride * Math.max(0, Math.floor((head - visible - origin) / stride));
      const to = Math.min(s.len, head + AXON_PULSE.lead * 2);
      if (from >= to) continue;
      let [px, py] = quadPoint(s, from / s.len);
      for (let a = from; a < to;) {
        const b = Math.min(to, a + stride);
        const [qx, qy] = quadPoint(s, b / s.len);
        piece(axons, px, py, qx, qy, AXON_PULSE.peak * pulse(head - (a + b) / 2, AXON_PULSE));
        px = qx; py = qy; a = b;
      }
    }

    // Cells: the build-up tint, and the pulses spreading through their
    // trees. A tree with no pulse in it is tinted evenly, in one piece; in a
    // tree with a pulse, each lit segment is cut into pieces so its
    // brightness changes smoothly from end to end.
    for (const c of cortex.cells) {
      const base = c.shade;
      if (!c.waves.length) {
        if (base < faintest) continue;
        const l = level(base);
        (dendrites[l] || (dendrites[l] = new Path2D())).addPath(c.tree);
        (bodies[l] || (bodies[l] = new Path2D())).addPath(c.body);
        continue;
      }
      // Per pulse: its front, its strength there, and the strength times
      // exp(-front / tail), which the stored exp(d / tail) turns into the
      // brightness behind the front.
      const nf = c.waves.length, front = [], amp = [], behind = [];
      for (const t of c.waves) {
        const f = AXON_SPEED * (cortex.time - t), a = Math.exp(-f / DENDRITE_REACH);
        front.push(f); amp.push(a); behind.push(a * Math.exp(-f / DENDRITE_PULSE.tail));
      }
      // The pulses' sum at distance d, with g = exp(d / tail) when known, and
      // the dendrite's brightness there.
      const sum = (d, g = Math.exp(d / DENDRITE_PULSE.tail)) => {
        let b = 0;
        for (let w = 0; w < nf; w++) {
          const ahead = (d - front[w]) / DENDRITE_PULSE.lead;
          // The leading edge is under 1e-6 past 3.7 widths: far below a brightness step.
          if (ahead <= 0) b += behind[w] * g;
          else if (ahead < 3.7) b += amp[w] * Math.exp(-ahead * ahead);
        }
        return b;
      };
      const wave = (d, g) => base + DENDRITE_PULSE.peak * sum(d, g);
      const g = c.segs, dist = c.dist, grow = c.grow;
      for (let i = 0, j = 0; i < g.length; i += 5, j += 2) {
        const d0 = dist[j], d1 = dist[j + 1];
        const b0 = wave(d0, grow[j]), b1 = wave(d1, grow[j + 1]), bm = wave((d0 + d1) / 2, Math.sqrt(grow[j] * grow[j + 1]));
        if (Math.max(b0, b1, bm) < faintest) continue;
        const n = Math.max(1, Math.ceil((d1 - d0) / stride));
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 1) / n;
          piece(dendrites,
            g[i] + (g[i + 2] - g[i]) * t0, g[i + 1] + (g[i + 3] - g[i + 1]) * t0,
            g[i] + (g[i + 2] - g[i]) * t1, g[i + 1] + (g[i + 3] - g[i + 1]) * t1,
            wave(d0 + (d1 - d0) * (t0 + t1) / 2));
        }
      }
      const b = base + sum(0, 1);
      if (b >= faintest) {
        const l = level(Math.min(1, b));
        (bodies[l] || (bodies[l] = new Path2D())).addPath(c.body);
      }
    }

    for (let l = 0; l < LEVELS; l++) {
      const color = `rgba(${palette[l]},${Math.min(1, (l / (LEVELS - 1)) * 1.3)})`;
      if (axons[l]) { ctx.strokeStyle = color; ctx.lineWidth = AXON_PULSE.width; ctx.stroke(axons[l]); }
      if (dendrites[l]) { ctx.strokeStyle = color; ctx.lineWidth = DENDRITE_PULSE.width; ctx.stroke(dendrites[l]); }
      if (bodies[l]) { ctx.fillStyle = color; ctx.fill(bodies[l]); }
    }
  }

  function lowerPower() {
    ({ scale, maxPulses, stride, faintest } = LOW_POWER);
    live.width = Math.round(width * scale);
    live.height = Math.round(height * scale);
    onSlow();
  }

  function tick() {
    const t = now();
    const elapsed = t - lastTick;
    const dt = Math.min(0.05, elapsed);
    lastTick = t;
    if (scale === 1) {
      slow = Math.max(0, slow + (elapsed > SLOW_FRAME ? 1 : -1));
      if (slow >= SLOW_STREAK) lowerPower();
    }
    const active = step(dt);
    draw();
    frame = active ? requestAnimationFrame(tick) : 0;
  }

  function start() {
    if (frame) return;
    lastTick = now();
    frame = requestAnimationFrame(tick);
  }

  // Drive the cells near (x, y), in viewport pixels. With `arouse`, the
  // press also counts toward the press rate that sets arousal; `strength`
  // scales the area driven.
  function stimulate(x, y, { arouse = true, strength = 1 } = {}) {
    if (reducedMotion || !cortex) return;
    const t = now();
    if (arouse) {
      arousal = arousal * Math.exp(-(t - arousalAt) / AROUSAL_TAU) + 1;
      arousalAt = t;
    }
    cortex.inject(x, y, { ...PRESS, area: strength * (1 + AROUSAL_AREA * arousalLevel(t)) });
    start();
  }

  // A cell somewhere on screen is driven by itself. Skipped while the tab is hidden.
  function fireSpontaneously() {
    const wait = SPONTANEOUS_MIN - Math.log(1 - Math.random()) * (SPONTANEOUS_MEAN - SPONTANEOUS_MIN);
    setTimeout(() => {
      const onScreen = cortex ? cortex.cells.filter((c) => c.x > 0 && c.y > 0 && c.x < width && c.y < height) : [];
      if (!document.hidden && onScreen.length) {
        const c = onScreen[Math.floor(Math.random() * onScreen.length)];
        stimulate(c.x, c.y, { arouse: false, strength: SPONTANEOUS_STRENGTH });
      }
      fireSpontaneously();
    }, wait * 1000);
  }
  if (!reducedMotion) fireSpontaneously();

  function setTheme(isDark) {
    dark = isDark;
    paintPalette();
    if (cortex) { paintRest(); draw(); }
  }

  return { build, stimulate, setTheme };
}
