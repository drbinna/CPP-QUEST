// Topological sort simulator for the Arena, following the class slides (Weiss):
// compute every indegree, put the indegree-0 vertices in a queue, then
// repeatedly take a vertex off the front, give it the next topological
// number, and "remove" its outgoing edges by decrementing each target's
// indegree. A target whose indegree hits 0 joins the back of the queue.
//
// A graph is { names, adj, pos, rule } with DIRECTED edges u -> adj[u][k].

export { BOARD_W, BOARD_H } from "./bfssim.js";

export const indegrees = (g) => { const d = g.names.map(() => 0); g.adj.forEach((l) => l.forEach((w) => d[w]++)); return d; };
export const edges = (g) => g.adj.flatMap((l, u) => l.map((w) => [u, w]));

export function topoTrace(g) {
  const n = g.names.length;
  const indeg = indegrees(g), start = [...indeg];
  const removed = new Array(n).fill(false), topNum = new Array(n).fill(-1);
  const queue = [];
  for (let v = 0; v < n; v++) if (indeg[v] === 0) queue.push(v);
  const snap = () => ({ indeg: [...indeg], queue: [...queue], removed: [...removed], topNum: [...topNum] });
  const first = snap();
  const steps = [], order = [];
  while (queue.length) {
    const before = snap();
    const v = queue.shift();
    topNum[v] = order.length; order.push(v); removed[v] = true;
    const popped = snap();
    const checks = [];
    for (const w of g.adj[v]) {
      indeg[w]--;
      const zero = indeg[w] === 0;
      if (zero) queue.push(w);
      checks.push({ w, zero, after: snap() });
    }
    steps.push({ v, before, popped, checks, found: checks.filter((c) => c.zero).map((c) => c.w), after: snap() });
  }
  return { g, startIndeg: start, first, steps, order, topNum, cycle: order.length < n, end: snap() };
}

// Is `ord` a topological order of g? Returns null if yes, else the first edge [u, w] it breaks.
export function brokenEdge(g, ord) {
  const at = new Array(g.names.length).fill(-1);
  ord.forEach((v, i) => { at[v] = i; });
  for (const [u, w] of edges(g)) if (at[u] > at[w]) return [u, w];
  return null;
}

// Vertices that must come before v (direct predecessors).
export const preds = (g, v) => g.names.map((_, u) => u).filter((u) => g.adj[u].includes(v));

// Does g have a cycle? (Kahn's algorithm can't number every vertex.)
export const hasCycle = (g) => topoTrace(g).cycle;

// ---------- fixed graph ----------
// The example on the class slides (Weiss, Figure 9.4). Vertex k is stored at index k - 1.
// The queue algorithm gives 1, 2, 5, 4, 3, 7, 6.
export function slideGraph() {
  const names = ["1", "2", "3", "4", "5", "6", "7"];
  const E = { 1: [2, 3, 4], 2: [4, 5], 3: [6], 4: [3, 6, 7], 5: [4, 7], 6: [], 7: [6] };
  const adj = names.map((nm) => E[nm].map((k) => k - 1));
  const pos = [{ x: 175, y: 45 }, { x: 330, y: 45 }, { x: 60, y: 135 }, { x: 252, y: 135 }, { x: 460, y: 135 }, { x: 175, y: 228 }, { x: 330, y: 228 }];
  return { names, adj, pos, rule: "numeric order", slide: true };
}

// ---------- random DAGs ----------
// Vertices sit in columns (layers) left to right; every edge points from a
// lower layer to a higher one, so the graph is acyclic by construction.
// Names are shuffled so alphabetical order gives nothing away.
export function randomDag(rnd, { n = 7 } = {}) {
  const layers = n >= 8 ? [2, 2, 2, 2] : rnd() < 0.5 ? [2, 2, 2, 1] : [1, 2, 2, 2];
  while (layers.reduce((a, b) => a + b, 0) < n) layers[layers.indexOf(Math.min(...layers))]++;
  const layerOf = [];
  layers.forEach((c, L) => { for (let i = 0; i < c; i++) layerOf.push(L); });
  const N = layerOf.length;
  const letters = Array.from({ length: N }, (_, i) => String.fromCharCode(65 + i));
  for (let i = letters.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [letters[i], letters[j]] = [letters[j], letters[i]]; }
  // store vertices in alphabetical order so adjacency lists read naturally
  const ids = letters.map((_, i) => i).sort((a, b) => (letters[a] < letters[b] ? -1 : 1));
  const idx = new Array(N); ids.forEach((orig, k) => { idx[orig] = k; });
  const names = ids.map((o) => letters[o]);
  const adjSet = names.map(() => new Set());
  const byLayer = layers.map((_, L) => layerOf.map((l, i) => (l === L ? i : -1)).filter((i) => i >= 0));
  // every vertex after the first layer gets at least one incoming edge from the layer before
  for (let L = 1; L < layers.length; L++) for (const v of byLayer[L]) {
    const from = byLayer[L - 1][Math.floor(rnd() * byLayer[L - 1].length)];
    adjSet[idx[from]].add(idx[v]);
  }
  // a few extra edges, including some that skip a layer
  for (let u = 0; u < N; u++) for (let v = 0; v < N; v++) {
    const gap = layerOf[v] - layerOf[u];
    if ((gap === 1 && rnd() < 0.3) || (gap === 2 && rnd() < 0.12)) adjSet[idx[u]].add(idx[v]);
  }
  // no vertex left out: anything without an outgoing edge (outside the last layer) gets one
  for (let L = 0; L < layers.length - 1; L++) for (const u of byLayer[L]) {
    if (!adjSet[idx[u]].size) adjSet[idx[u]].add(idx[byLayer[L + 1][Math.floor(rnd() * byLayer[L + 1].length)]]);
  }
  const adj = adjSet.map((s) => [...s].sort((a, b) => a - b));
  const xs = [60, 190, 330, 460];
  const pos = new Array(N);
  byLayer.forEach((vs, L) => {
    const order = rnd() < 0.5 ? vs : [...vs].reverse();
    order.forEach((v, k) => {
      const ys = order.length === 1 ? [135] : order.length === 2 ? [70, 200] : [40, 135, 230];
      pos[idx[v]] = { x: xs[L] + Math.round((rnd() - 0.5) * 24), y: ys[k] + Math.round((rnd() - 0.5) * 20) };
    });
  });
  return { names, adj, pos, rule: "alphabetical order" };
}

// Add one edge that points backwards, so the graph has a cycle.
// Only an edge u -> w where w can already reach u closes a cycle.
function withCycle(rnd, g) {
  const n = g.names.length;
  const reach = g.names.map((_, s) => {                       // reach[s][t]: path s -> t of 2+ edges?
    const seen = new Array(n).fill(false), stack = [...g.adj[s]];
    while (stack.length) { const x = stack.pop(); for (const y of g.adj[x]) if (!seen[y]) { seen[y] = true; stack.push(y); } }
    return seen;
  });
  const cands = [];
  for (let w = 0; w < n; w++) for (let u = 0; u < n; u++)
    if (u !== w && reach[w][u] && !g.adj[w].includes(u) && !g.adj[u].includes(w)) cands.push([u, w]);
  if (!cands.length) return { ...g, cyclic: false };
  const [u, w] = cands[Math.floor(rnd() * cands.length)];
  const adj = g.adj.map((l) => [...l]); adj[u] = [...adj[u], w].sort((a, b) => a - b);
  return { ...g, adj, cyclic: true };
}

// Any topological order, choosing randomly among the ready vertices.
function randomOrder(rnd, g) {
  const indeg = indegrees(g), out = [];
  let ready = g.names.map((_, v) => v).filter((v) => indeg[v] === 0);
  while (ready.length) {
    const v = ready.splice(Math.floor(rnd() * ready.length), 1)[0];
    out.push(v);
    for (const w of g.adj[v]) if (--indeg[w] === 0) ready.push(w);
  }
  return out;
}

export const TOPO_ROUNDS_VALID = 7;

// Rounds for each mode.
//  topo-step / topo-step-rand: one round per dequeue of a single run
//  topo-build:                 one round per graph, click ANY valid order
//  topo-valid:                 one round per graph, judge a proposed order
export function topoRounds(mode, rnd) {
  if (mode === "topo-step" || mode === "topo-step-rand") {
    const g = mode === "topo-step" ? slideGraph() : randomDag(rnd, { n: 7 + Math.floor(rnd() * 2) });
    const tr = topoTrace(g);
    return tr.steps.map((st, k) => ({ kind: "step", g, tr, k, st }));
  }
  if (mode === "topo-build") {
    return [slideGraph(), randomDag(rnd, { n: 7 }), randomDag(rnd, { n: 8 })].map((g) => ({ kind: "build", g, tr: topoTrace(g) }));
  }
  // topo-valid: a mix of valid orders, orders that break one edge, and graphs with a cycle
  const plan = ["valid", "broken", "valid", "cycle", "broken", "valid", "cycle"];
  return plan.slice(0, TOPO_ROUNDS_VALID).map((kind, i) => {
    let g = i === 0 ? slideGraph() : randomDag(rnd, { n: 7 + Math.floor(rnd() * 2) });
    let ord;
    if (i === 0) ord = topoTrace(g).order;                       // the slide's answer: valid
    else if (kind === "cycle") { ord = randomOrder(rnd, g); g = withCycle(rnd, g); }   // an order that was fine until one edge was added
    else ord = randomOrder(rnd, g);
    if (kind === "broken") {
      // swap two vertices joined by an edge, so exactly that requirement is violated
      const es = edges(g).filter(([u, w]) => Math.abs(ord.indexOf(u) - ord.indexOf(w)) <= 3);
      const [u, w] = es[Math.floor(rnd() * es.length)];
      const a = ord.indexOf(u), b = ord.indexOf(w);
      ord = [...ord]; [ord[a], ord[b]] = [ord[b], ord[a]];
    }
    const broken = brokenEdge(g, ord);
    const answer = hasCycle(g) ? "cycle" : broken ? "invalid" : "valid";
    return { kind: "valid", g, tr: topoTrace(g), ord, broken, answer };
  });
}
