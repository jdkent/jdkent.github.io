// A patch of agranular insular cortex, seen as a slice: the top of the
// screen is the pial surface, and the layers run I, II/III, V, VI below it
// (the anterior insula has no layer IV). Each neuron has a drawn morphology
// for its type: pyramidal cells, von Economo neurons and fork cells (both
// found in layer V of the anterior insula), and basket and bipolar
// interneurons. Neurons follow the Hodgkin-Huxley equations; a spike travels
// down the axon with a conduction delay and releases transmitter onto the
// target's dendrite with some probability, which arousal raises.
// Units: mV, ms, mS/cm², µA/cm², µF/cm²; lengths in CSS pixels.

const DT = 0.025;                 // ms, integration step
export const V_REST = -65;

// Hodgkin & Huxley (1952), with the resting potential at -65 mV.
const C_M = 1, G_NA = 120, G_K = 36, G_L = 0.3;
const E_NA = 50, E_K = -77, E_L = -54.387;
// Synapses, as conductances that jump on release and decay exponentially:
// excitation has a fast AMPA-like part and a slow NMDA-like part (without
// the magnesium block), so inputs spread out in time still add up and a
// cell's potential builds toward threshold; inhibition is GABA-A-like.
const E_EXC = 0, E_INH = -80, TAU_AMPA = 2, TAU_NMDA = 50, TAU_INH = 6;
const SPIKE_V = -20;              // upward crossing counts as a spike
export const AXON_SPEED = 10;     // px per ms of conduction
const SYN_DELAY = 0.5;            // ms from arrival to release
// Short-term depression (Tsodyks & Markram): each spike uses a fraction U of
// the presynaptic resource, which recovers with TAU_REC.
const U = 0.5, TAU_REC = 60;
// Peak conductance per release by connection (pre, post), the NMDA share of
// excitation, and how many cells each type's axon reaches. Tuned so a
// pyramidal cell needs two coincident inputs to fire (or more spread out in
// time, summed by the slow NMDA current), and a click's
// activity, at the resting release probability, dies out within a few
// hundred pixels; see neural-field.js for release and arousal.
export const PARAMS = {
  w: { EE: 0.045, EI: 0.05, IE: 0.06, II: 0.03 },
  nmda: 0.25,
  fanout: { E: 16, I: 8, ven: 12 },
};

// Layer boundaries as fractions of the screen height, and the cell types
// each layer holds, with their shares.
const LAYERS = [
  { name: "I", bottom: 0.07, keep: 0.3, mix: [["bipolar", 0.5], ["basket", 0.5]] },
  { name: "II/III", bottom: 0.42, keep: 1, mix: [["pyramidal", 0.72], ["basket", 0.16], ["bipolar", 0.12]], size: 0.75 },
  { name: "V", bottom: 0.74, keep: 1, mix: [["pyramidal", 0.6], ["ven", 0.12], ["fork", 0.08], ["basket", 0.13], ["bipolar", 0.07]], size: 1.15 },
  { name: "VI", bottom: Infinity, keep: 1, mix: [["pyramidal", 0.7], ["basket", 0.15], ["bipolar", 0.15]], size: 0.8 },
];
const INHIBITORY = new Set(["basket", "bipolar"]);

// Gating rates (per ms) at membrane potential v.
function rates(v) {
  const lin = (x, k) => (Math.abs(x) < 1e-6 ? k : x / (1 - Math.exp(-x / k)));
  return {
    am: 0.1 * lin(v + 40, 10), bm: 4 * Math.exp(-(v + 65) / 18),
    ah: 0.07 * Math.exp(-(v + 65) / 20), bh: 1 / (1 + Math.exp(-(v + 35) / 10)),
    an: 0.01 * lin(v + 55, 10), bn: 0.125 * Math.exp(-(v + 65) / 80),
  };
}

// Each gate relaxes to x_inf with time constant tau; tabulated over V so a
// step is a lookup (Rush-Larsen: exact for the gates at fixed V).
const LUT_MIN = -100, LUT_STEP = 0.05, LUT_N = 3201;
const LUT = new Float64Array(LUT_N * 6);
for (let i = 0; i < LUT_N; i++) {
  const r = rates(LUT_MIN + i * LUT_STEP);
  const gate = (a, b, k) => { LUT[i * 6 + k] = a / (a + b); LUT[i * 6 + k + 1] = Math.exp(-DT * (a + b)); };
  gate(r.am, r.bm, 0); gate(r.ah, r.bh, 2); gate(r.an, r.bn, 4);
}
const lutIndex = (v) => Math.max(0, Math.min(LUT_N - 1, Math.round((v - LUT_MIN) / LUT_STEP)));

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Morphology. A dendrite grows from (x, y) along `angle` (radians; -π/2 is
// up, toward the pia) in short wavering segments, and may fork at its end.
// Segments are stored flat as x0, y0, x1, y1, width; tips become contacts,
// where incoming axons synapse.
function grow(cell, rand, x, y, angle, length, width, depth, { wiggle = 0.25, fork = 0.6, spread = 0.5, shrink = 0.7 } = {}) {
  const steps = Math.max(2, Math.round(length / 7));
  const l = length / steps;
  let a = angle;
  for (let i = 0; i < steps; i++) {
    a += (rand() - 0.5) * wiggle;
    const nx = x + Math.cos(a) * l, ny = y + Math.sin(a) * l;
    cell.segs.push(x, y, nx, ny, Math.max(0.35, width * (1 - (0.45 * i) / steps)));
    x = nx; y = ny;
  }
  cell.contacts.push(x, y);
  if (depth > 0 && rand() < fork) {
    const opts = { wiggle, fork, spread, shrink };
    for (const side of [-1, 1]) {
      grow(cell, rand, x, y, a + side * spread * (0.5 + rand() * 0.6), length * shrink, width * 0.65, depth - 1, opts);
    }
  }
}

const UP = -Math.PI / 2, DOWN = Math.PI / 2;

// Each builder sets the soma's shape and the axon hillock (hx, hy), where
// outgoing axons start, and grows the dendrites. `u` scales with the grid.
const MORPHOLOGY = {
  // Triangular soma; an apical dendrite rising to a tuft, with oblique
  // branches; a skirt of basal dendrites. Layer II/III cells and the thick-
  // tufted half of layer V reach layer I; the slender-tufted rest of layer V
  // stops in layer II/III, and layer VI cells in layer V.
  pyramidal(cell, rand, u, size, height) {
    const h = 7 * u * size, w = 5.5 * u * size;
    Object.assign(cell, { soma: "triangle", sw: w, sh: h, hx: cell.x, hy: cell.y + h * 0.45 });
    const top = cell.y - h * 0.55;
    const reach = cell.layer === "VI" ? 0.12 + rand() * 0.16 : cell.layer === "V" && rand() < 0.5 ? 0.18 + rand() * 0.14 : Infinity;
    const tuftAt = Math.max((6 + rand() * 10) * u, top - reach * height);
    const span = Math.max(12 * u, top - tuftAt);
    const steps = Math.max(3, Math.round(span / (9 * u)));
    let x = cell.x, y = top;
    for (let i = 0; i < steps; i++) {
      const nx = x + (rand() - 0.5) * 1.6 * u, ny = y - span / steps;
      cell.segs.push(x, y, nx, ny, 1.5 * size * (1 - (0.55 * i) / steps));
      cell.contacts.push(nx, ny);
      if (i > 0 && i < steps - 1 && rand() < 0.28) {
        const side = rand() < 0.5 ? -1 : 1;
        grow(cell, rand, nx, ny, UP + side * (0.9 + rand() * 0.4), (9 + rand() * 9) * u * size, 0.7, 1, { fork: 0.4 });
      }
      x = nx; y = ny;
    }
    for (let k = 0, n = 3 + Math.floor(rand() * 2); k < n; k++) {
      grow(cell, rand, x, y, UP + (k / (n - 1) - 0.5) * 1.6 + (rand() - 0.5) * 0.3, (8 + rand() * 8) * u, 0.6, 1, { fork: 0.5 });
    }
    for (let k = 0, n = 4 + Math.floor(rand() * 3); k < n; k++) {
      const a = 0.15 + (k / (n - 1)) * (Math.PI - 0.3) + (rand() - 0.5) * 0.3;
      grow(cell, rand, cell.x + Math.cos(a) * w * 0.4, cell.y + h * 0.3, a, (10 + rand() * 10) * u * size, 1.1, 2, { fork: 0.6, spread: 0.45 });
    }
  },
  // Von Economo neuron: a large spindle soma with one thick dendrite up and
  // one down, and little branching.
  ven(cell, rand, u) {
    const h = 15 * u, w = 4.2 * u;
    Object.assign(cell, { soma: "spindle", sw: w, sh: h, hx: cell.x, hy: cell.y + h * 0.5 });
    grow(cell, rand, cell.x, cell.y - h * 0.5, UP, (34 + rand() * 20) * u, 2, 1, { wiggle: 0.08, fork: 0.35, spread: 0.3, shrink: 0.4 });
    grow(cell, rand, cell.x, cell.y + h * 0.5, DOWN, (26 + rand() * 16) * u, 1.8, 0, { wiggle: 0.08 });
  },
  // Fork cell: an apical dendrite that splits in two just above the soma.
  fork(cell, rand, u) {
    const h = 8 * u, w = 5 * u;
    Object.assign(cell, { soma: "spindle", sw: w, sh: h, hx: cell.x, hy: cell.y + h * 0.5 });
    const y = cell.y - h * 0.5, x = cell.x;
    const yf = y - 6 * u;
    cell.segs.push(x, y, x, yf, 1.7);
    for (const side of [-1, 1]) {
      grow(cell, rand, x, yf, UP + side * (0.32 + rand() * 0.15), (26 + rand() * 16) * u, 1.3, 1, { wiggle: 0.12, fork: 0.3, spread: 0.3 });
    }
    grow(cell, rand, x, cell.y + h * 0.5, DOWN, (16 + rand() * 10) * u, 1.3, 1, { fork: 0.3 });
  },
  // Basket cell: round soma, short dendrites radiating every way.
  basket(cell, rand, u) {
    const r = 3.2 * u;
    Object.assign(cell, { soma: "round", sw: r * 2, sh: r * 2, hx: cell.x, hy: cell.y });
    const n = 5 + Math.floor(rand() * 3), turn = rand() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      grow(cell, rand, cell.x, cell.y, turn + (k / n) * Math.PI * 2 + (rand() - 0.5) * 0.4, (8 + rand() * 7) * u, 0.9, 1, { fork: 0.5, spread: 0.6 });
    }
  },
  // Bipolar (double-bouquet-like) interneuron: a slim soma with one
  // dendrite up and one down, each ending in a small tuft.
  bipolar(cell, rand, u) {
    const h = 6.5 * u, w = 3.4 * u;
    Object.assign(cell, { soma: "spindle", sw: w, sh: h, hx: cell.x, hy: cell.y });
    grow(cell, rand, cell.x, cell.y - h * 0.5, UP, (14 + rand() * 9) * u, 0.9, 1, { wiggle: 0.15, fork: 0.7, spread: 0.4, shrink: 0.5 });
    grow(cell, rand, cell.x, cell.y + h * 0.5, DOWN, (14 + rand() * 9) * u, 0.9, 1, { wiggle: 0.15, fork: 0.7, spread: 0.4, shrink: 0.5 });
  },
};

function pick(mix, r) {
  for (const [type, share] of mix) { if (r < share) return type; r -= share; }
  return mix[mix.length - 1][0];
}

// Builds the cells and their wiring over a width x height screen, with one
// ring of cells just outside it so activity can leave through the edges.
export function createCortex(width, height, { seed = 7, params = PARAMS } = {}) {
  const rand = mulberry32(seed);
  const spacing = Math.min(96, Math.max(56, Math.sqrt((width * height) / 170)));
  const u = spacing / 80;
  const cols = Math.ceil(width / spacing) + 2, rows = Math.ceil(height / spacing) + 2;
  const cells = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = (i - 0.5) * spacing + (rand() - 0.5) * spacing * 0.8;
      const y = (j - 0.5) * spacing + (rand() - 0.5) * spacing * 0.8;
      const depth = y / height;
      const layer = LAYERS.find((l) => depth < l.bottom);
      const keep = rand(), r = rand();
      if (keep > layer.keep) continue;
      const type = pick(layer.mix, r);
      const cell = {
        id: cells.length, x, y, type, layer: layer.name, inhibitory: INHIBITORY.has(type),
        segs: [], contacts: [], out: [],
        v: V_REST, m: 0, h: 0, n: 0, gE: 0, gN: 0, gI: 0, iExt: 0, extUntil: 0, resource: 1, above: false,
      };
      const k = lutIndex(V_REST);
      cell.m = LUT[k * 6]; cell.h = LUT[k * 6 + 2]; cell.n = LUT[k * 6 + 4];
      MORPHOLOGY[type](cell, rand, u, layer.size ?? 1, height);
      cell.segs = Float32Array.from(cell.segs);
      cell.contacts = Float32Array.from(cell.contacts);
      cells.push(cell);
    }
  }

  // Wiring: each cell's axon reaches cells near it, more often the nearer;
  // von Economo neurons project further. A synapse lands on the target's
  // dendritic contact nearest the presynaptic cell, and the axon's path
  // there (a gentle curve from the hillock) sets the conduction delay.
  const synapses = [];
  for (const pre of cells) {
    const reach = pre.type === "ven" ? 3 : pre.inhibitory ? 1.1 : 1.6;
    const count = pre.type === "ven" ? params.fanout.ven : pre.inhibitory ? params.fanout.I : params.fanout.E;
    const lambda = reach * spacing;
    const candidates = [];
    for (const post of cells) {
      if (post === pre) continue;
      const d = Math.hypot(post.x - pre.x, post.y - pre.y);
      if (d < lambda * 2.2) candidates.push([post, Math.exp(-((d / lambda) ** 2)) * rand()]);
    }
    candidates.sort((a, b) => b[1] - a[1]);
    for (const [post] of candidates.slice(0, count)) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < post.contacts.length; c += 2) {
        const d = Math.hypot(post.contacts[c] - pre.hx, post.contacts[c + 1] - pre.hy);
        if (d < bestD) { bestD = d; best = c; }
      }
      const bx = post.contacts[best], by = post.contacts[best + 1];
      const ax = pre.hx, ay = pre.hy;
      const chord = Math.max(1, Math.hypot(bx - ax, by - ay));
      const bend = (rand() - 0.5) * 0.5 * chord;
      const cx = (ax + bx) / 2 - ((by - ay) / chord) * bend, cy = (ay + by) / 2 + ((bx - ax) / chord) * bend;
      let len = 0, px = ax, py = ay;
      for (let s = 1; s <= 8; s++) {
        const t = s / 8, v = 1 - t;
        const qx = v * v * ax + 2 * v * t * cx + t * t * bx, qy = v * v * ay + 2 * v * t * cy + t * t * by;
        len += Math.hypot(qx - px, qy - py); px = qx; py = qy;
      }
      const kind = (pre.inhibitory ? "I" : "E") + (post.inhibitory ? "I" : "E");
      pre.out.push(synapses.length);
      synapses.push({ pre: pre.id, post: post.id, inhibitory: pre.inhibitory, w: params.w[kind], travel: len / AXON_SPEED, len, ax, ay, cx, cy, bx, by });
    }
  }

  // Spikes in flight, as a min-heap on arrival time.
  const heap = [];
  const push = (e) => {
    heap.push(e);
    for (let i = heap.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (heap[p].at <= heap[i].at) break;
      [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l].at < heap[m].at) m = l;
        if (r < heap.length && heap[r].at < heap[m].at) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };

  let time = 0;
  const decE = Math.exp(-DT / TAU_AMPA), decN = Math.exp(-DT / TAU_NMDA), decI = Math.exp(-DT / TAU_INH), recover = DT / TAU_REC;

  // Advances the model by `ms`, releasing each arriving spike with
  // probability `release`. Calls onSpike(cell, sent) for each spike, with
  // the axon spikes it sent ({ syn, from, at }), now in flight.
  function step(ms, release, onSpike) {
    const end = time + ms;
    while (time < end) {
      time += DT;
      while (heap.length && heap[0].at <= time) {
        const e = pop();
        const syn = synapses[e.syn];
        if (rand() < release) {
          const post = cells[syn.post];
          const g = syn.w * e.strength;
          if (syn.inhibitory) post.gI += g;
          else { post.gE += g; post.gN += g * params.nmda; }
        }
      }
      for (const c of cells) {
        const v = c.v;
        const iExt = time < c.extUntil ? c.iExt : 0;
        const ionic = G_NA * c.m * c.m * c.m * c.h * (v - E_NA) + G_K * c.n * c.n * c.n * c.n * (v - E_K) + G_L * (v - E_L);
        const syn = (c.gE + c.gN) * (v - E_EXC) + c.gI * (v - E_INH);
        c.v = v + (DT * (iExt - ionic - syn)) / C_M;
        const k = lutIndex(c.v) * 6;
        c.m = LUT[k] + (c.m - LUT[k]) * LUT[k + 1];
        c.h = LUT[k + 2] + (c.h - LUT[k + 2]) * LUT[k + 3];
        c.n = LUT[k + 4] + (c.n - LUT[k + 4]) * LUT[k + 5];
        c.gE *= decE; c.gN *= decN; c.gI *= decI;
        c.resource += (1 - c.resource) * recover;
        if (!c.above && c.v > SPIKE_V) {
          c.above = true;
          const used = U * c.resource;
          c.resource -= used;
          const sent = c.out.map((s) => ({ syn: s, from: time, at: time + synapses[s].travel + SYN_DELAY, strength: used / U }));
          sent.forEach(push);
          onSpike(c, sent);
        } else if (c.above && c.v < -40) c.above = false;
      }
    }
  }

  // Current into the cells near (x, y) for `ms` of model time, falling off
  // with distance; `area` scales the region it reaches (in units of about a
  // cell's share of the sheet), so a stimulus twice as strong recruits
  // twice the cells.
  function inject(x, y, { amplitude, ms, area = 1 }) {
    const radius = spacing * 0.9 * Math.sqrt(area);
    for (const c of cells) {
      const d = Math.hypot(c.x - x, c.y - y);
      const a = amplitude * Math.exp(-((d / radius) ** 2));
      if (a < amplitude * 0.15) continue;
      c.iExt = time < c.extUntil ? Math.max(c.iExt, a) : a;
      c.extUntil = Math.max(c.extUntil, time + ms);
    }
  }

  // True once nothing is in flight and every cell is within half a millivolt
  // of rest with no synaptic current worth drawing.
  function quiet() {
    if (heap.length) return false;
    for (const c of cells) {
      if (time < c.extUntil || Math.abs(c.v - V_REST) > 0.5 || c.gE + c.gN > 2e-3 || c.gI > 2e-3) return false;
    }
    return true;
  }

  return { cells, synapses, inFlight: heap, spacing, step, inject, quiet, get time() { return time; } };
}
