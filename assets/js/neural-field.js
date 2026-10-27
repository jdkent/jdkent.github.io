// A network of neurons drawn behind the page. Each stimulus fires the nearest
// neurons; spikes travel outward along axons and fire the neurons they reach.
// Stimuli that arrive in quick succession raise arousal, which lets each hop
// keep more of its energy, so rapid clicking carries waves off the page edges.
// Neurons also fire on their own now and then.

const LEVELS = 24;

const CUTOFF = 0.05;       // energy below which a spike is not propagated
const AROUSAL_TAU = 1.6;   // s for arousal to decay by 1/e
// Glow swells in over NODE_RISE and fades over the decays, so firing blooms
// rather than flashes.
const NODE_RISE = 0.25;    // s glow time constants
const NODE_DECAY = 1.0;
const EDGE_DECAY = 1.6;
const CLICK_ENERGY = 0.55;  // an isolated click's stimulus
// Spontaneous firing: a random neuron on screen, at random intervals, four
// times as strong as a click, so it blooms out across much of the screen.
const SPONTANEOUS_MEAN = 20; // s between firings, on average
const SPONTANEOUS_MIN = 5;   // s, at least
const SPONTANEOUS_ENERGY = 4 * CLICK_ENERGY;
const MAX_SPIKES = 1500;
// Low-power mode: when frames keep arriving slower than SLOW_FRAME (as on
// software rendering), draw activity at half resolution with fewer spikes.
const SLOW_FRAME = 0.034;  // s, slower than ~30 fps
const SLOW_STREAK = 20;    // net slow frames before switching
const LOW_POWER = { scale: 0.5, maxSpikes: 600 };

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
// theme in home.css so the canvas and the colorbar share one definition.
function readColormap() {
  const css = getComputedStyle(document.documentElement);
  return [0, 1, 2, 3, 4].map((i) => {
    const hex = css.getPropertyValue(`--cmap-${i}`).trim().replace("#", "");
    return [i / 4, ...[0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16))];
  });
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quadPoint(a, e, b, t) {
  const u = 1 - t;
  return [u * u * a.x + 2 * u * t * e.cx + t * t * b.x, u * u * a.y + 2 * u * t * e.cy + t * t * b.y];
}

export function createNeuralField(canvas, { reducedMotion = false, onSlow = () => {} } = {}) {
  // The resting network is painted once onto `canvas`. Activity is redrawn
  // every frame onto a second canvas stacked above it at CSS-pixel
  // resolution: soft glows gain nothing from device pixels, and a full
  // device-pixel redraw per frame is what made rapid clicking stall.
  const live = canvas.cloneNode();
  canvas.after(live);
  const rest = canvas.getContext("2d");
  const ctx = live.getContext("2d");
  let width = 0, height = 0, dpr = 1, spacing = 0;
  let nodes = [], edges = [], spikes = [];
  let palette = [], sprites = [], dark = false;
  let arousal = 0, arousalAt = 0;
  let frame = 0, lastTick = 0;
  let scale = 1, maxSpikes = MAX_SPIKES, slow = 0;

  const now = () => performance.now() / 1000;
  const level = (e) => Math.min(LEVELS - 1, Math.max(0, Math.round(e * (LEVELS - 1))));

  // Jittered grid with one ring of neurons just outside the viewport, so
  // waves visibly leave through the edges instead of stopping short of them.
  function build() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    live.width = Math.round(width * scale);
    live.height = Math.round(height * scale);
    spacing = Math.min(96, Math.max(56, Math.sqrt((width * height) / 170)));

    const rand = mulberry32(7);
    const cols = Math.ceil(width / spacing) + 2;
    const rows = Math.ceil(height / spacing) + 2;
    nodes = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        nodes.push({
          id: nodes.length,
          x: (i - 0.5) * spacing + (rand() - 0.5) * spacing * 0.85,
          y: (j - 0.5) * spacing + (rand() - 0.5) * spacing * 0.85,
          r: 1 + rand() * 1.4,
          heat: 0,
          charge: 0,
          edges: [],
        });
      }
    }

    edges = [];
    const seen = new Set();
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = nodes[j * cols + i];
        const near = [];
        for (let dj = -2; dj <= 2; dj++) {
          for (let di = -2; di <= 2; di++) {
            const ii = i + di, jj = j + dj;
            if ((di || dj) && ii >= 0 && jj >= 0 && ii < cols && jj < rows) {
              const b = nodes[jj * cols + ii];
              near.push([Math.hypot(b.x - a.x, b.y - a.y), b]);
            }
          }
        }
        near.sort((p, q) => p[0] - q[0]);
        const degree = 2 + (rand() < 0.5) + (rand() < 0.2);
        for (const [len, b] of near.slice(0, degree)) {
          const key = Math.min(a.id, b.id) * nodes.length + Math.max(a.id, b.id);
          if (len > spacing * 2.2 || seen.has(key)) continue;
          seen.add(key);
          const bend = (rand() - 0.5) * 0.35 * len;
          const e = {
            a: a.id, b: b.id, len, heat: 0,
            cx: (a.x + b.x) / 2 - ((b.y - a.y) / len) * bend,
            cy: (a.y + b.y) / 2 + ((b.x - a.x) / len) * bend,
          };
          a.edges.push(edges.length);
          b.edges.push(edges.length);
          edges.push(e);
        }
      }
    }
    spikes = [];
    paintRest();
    draw();
  }

  function paintRest() {
    const css = getComputedStyle(document.documentElement);
    const r = rest;
    r.setTransform(dpr, 0, 0, dpr, 0, 0);
    r.clearRect(0, 0, width, height);
    r.strokeStyle = css.getPropertyValue("--net-axon").trim();
    r.lineWidth = 1;
    r.beginPath();
    for (const e of edges) {
      const a = nodes[e.a], b = nodes[e.b];
      r.moveTo(a.x, a.y);
      r.quadraticCurveTo(e.cx, e.cy, b.x, b.y);
    }
    r.stroke();
    r.fillStyle = css.getPropertyValue("--net-soma").trim();
    for (const n of nodes) {
      r.beginPath();
      r.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      r.fill();
    }
  }

  // Pre-rendered radial glows, one per colormap level; far cheaper than shadowBlur.
  function paintSprites() {
    const stops = readColormap();
    palette = [];
    sprites = [];
    for (let i = 0; i < LEVELS; i++) {
      const [r, g, b] = sample(stops, i / (LEVELS - 1));
      palette.push(`${r},${g},${b}`);
      const s = document.createElement("canvas");
      s.width = s.height = 64;
      const c = s.getContext("2d");
      const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
      grad.addColorStop(0.25, `rgba(${r},${g},${b},0.45)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = grad;
      c.fillRect(0, 0, 64, 64);
      sprites.push(s);
    }
  }

  // Each wave fires a neuron at most once, but separate waves pass through
  // each other, and their heat adds up, so rapid clicks run hotter.
  function fire(node, energy, wave) {
    if (wave.fired.has(node.id)) return;
    wave.fired.add(node.id);
    node.charge += energy;
    const next = energy * wave.gain;
    if (next < CUTOFF) return;
    // Only propagate away from the stimulus, so the wave expands instead of echoing.
    const d0 = Math.hypot(node.x - wave.x, node.y - wave.y) - spacing * 0.1;
    for (const ei of node.edges) {
      if (spikes.length >= maxSpikes) return;
      const e = edges[ei];
      const to = e.a === node.id ? e.b : e.a;
      const o = nodes[to];
      if (Math.hypot(o.x - wave.x, o.y - wave.y) <= d0) continue;
      spikes.push({ edge: ei, from: node.id, to, t: 0, energy: next, wave });
    }
  }

  function step(dt) {
    const current = spikes;
    const count = current.length;
    const alive = [];
    for (let i = 0; i < count; i++) {
      const s = current[i];
      const e = edges[s.edge];
      s.t += (s.wave.speed * dt) / e.len;
      e.heat = Math.max(e.heat, Math.min(1, s.energy) * Math.min(1, s.t * 1.5));
      if (s.t >= 1) fire(nodes[s.to], s.energy, s.wave);
      else alive.push(s);
    }
    // fire() appends newly spawned spikes past `count`; they start moving next frame.
    spikes = alive.concat(current.slice(count));
    const kn = Math.exp(-dt / NODE_DECAY), ke = Math.exp(-dt / EDGE_DECAY);
    const rise = 1 - Math.exp(-dt / NODE_RISE);
    let active = spikes.length > 0;
    for (const n of nodes) {
      const take = n.charge * rise;
      n.charge -= take;
      n.heat = Math.min(1, n.heat * kn + take);
      if (n.heat > 0.01 || n.charge > 0.01) active = true;
    }
    for (const e of edges) { e.heat *= ke; if (e.heat > 0.01) active = true; }
    return active;
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, live.width, live.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // Glows add light on black and deepen like ink on white.
    ctx.globalCompositeOperation = dark ? "lighter" : "multiply";
    ctx.lineCap = "round";

    for (const e of edges) {
      if (e.heat < 0.015) continue;
      const a = nodes[e.a], b = nodes[e.b];
      ctx.strokeStyle = `rgba(${palette[level(e.heat)]},${Math.min(1, e.heat * 1.6)})`;
      ctx.lineWidth = 1 + 2.2 * e.heat;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(e.cx, e.cy, b.x, b.y);
      ctx.stroke();
    }
    for (const s of spikes) {
      const e = edges[s.edge];
      const [x, y] = quadPoint(nodes[s.from], e, nodes[s.to], s.t);
      // Energy above 1 (a spontaneous firing's first hops) carries further, not brighter.
      const e1 = Math.min(1, s.energy);
      const size = 10 + 18 * e1;
      ctx.globalAlpha = Math.min(1, 0.4 + e1);
      ctx.drawImage(sprites[level(e1)], x - size / 2, y - size / 2, size, size);
    }
    for (const n of nodes) {
      if (n.heat < 0.015) continue;
      const size = 10 + 40 * n.heat;
      ctx.globalAlpha = Math.min(1, n.heat * 1.5);
      ctx.drawImage(sprites[level(n.heat)], n.x - size / 2, n.y - size / 2, size, size);
    }
  }

  function lowerPower() {
    scale = LOW_POWER.scale;
    maxSpikes = LOW_POWER.maxSpikes;
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

  // Fire the neurons nearest (x, y), in viewport pixels. With `arouse`, the
  // stimulus also counts toward the click rate that sets how far waves travel;
  // `energy` overrides the stimulus's own strength.
  function stimulate(x, y, { arouse = true, energy: given } = {}) {
    if (reducedMotion || !nodes.length) return;
    const t = now();
    let drive = arousal * Math.exp(-(t - arousalAt) / AROUSAL_TAU);
    if (arouse) { drive += 1; arousal = drive; arousalAt = t; }
    // 0 for an isolated click, approaching 1 as clicks come faster.
    const a = 1 - Math.exp(-Math.max(0, drive - 1) / 1.8);
    const wave = { x, y, gain: 0.64 + 0.33 * a, speed: 75 + 125 * a, fired: new Set() };
    const energy = given ?? (arouse ? CLICK_ENERGY + 0.45 * a : 0.4);
    const nearest = nodes
      .map((n) => [Math.hypot(n.x - x, n.y - y), n])
      .sort((p, q) => p[0] - q[0])
      .slice(0, 3);
    nearest.forEach(([, n], k) => fire(n, energy * (1 - k * 0.1), wave));
    start();
  }

  // A neuron somewhere on screen fires by itself. Skipped while the tab is hidden.
  function fireSpontaneously() {
    const wait = SPONTANEOUS_MIN - Math.log(1 - Math.random()) * (SPONTANEOUS_MEAN - SPONTANEOUS_MIN);
    setTimeout(() => {
      const onScreen = nodes.filter((n) => n.x > 0 && n.y > 0 && n.x < width && n.y < height);
      if (!document.hidden && onScreen.length) {
        const n = onScreen[Math.floor(Math.random() * onScreen.length)];
        stimulate(n.x, n.y, { arouse: false, energy: SPONTANEOUS_ENERGY });
      }
      fireSpontaneously();
    }, wait * 1000);
  }
  if (!reducedMotion) fireSpontaneously();

  function setTheme(isDark) {
    dark = isDark;
    paintSprites();
    if (nodes.length) { paintRest(); draw(); }
  }

  return { build, stimulate, setTheme };
}
