// Breadth-first search simulator for the Arena. BFS(G, s) is traced one
// dequeue at a time so the game can ask "who gets enqueued?" and replay the
// queue, the distances and the parent pointers.
//
// A graph is { names, adj, pos, directed, rule }:
//   names[i]  label drawn in the circle
//   adj[i]    neighbors of vertex i, IN THE ORDER BFS CHECKS THEM
//   pos[i]    { x, y } on a 520 x 270 board

export const BOARD_W = 520, BOARD_H = 270;

// vertex states, the textbook's three colors:
//   "new"    white  not discovered yet
//   "queued" gray   discovered, waiting in the queue (or being processed)
//   "done"   black  dequeued and every neighbor checked
export function bfsTrace(g, s) {
  const n = g.names.length;
  const dist = new Array(n).fill(-1), parent = new Array(n).fill(-1), state = new Array(n).fill("new");
  const queue = [s];
  dist[s] = 0; state[s] = "queued";
  const snap = () => ({ dist: [...dist], parent: [...parent], state: [...state], queue: [...queue] });
  const start = snap();
  const steps = [], order = [];
  while (queue.length) {
    const before = snap();
    const u = queue.shift();
    order.push(u);
    const popped = snap();
    const checks = [];
    for (const v of g.adj[u]) {
      const fresh = state[v] === "new";
      if (fresh) { state[v] = "queued"; dist[v] = dist[u] + 1; parent[v] = u; queue.push(v); }
      checks.push({ v, fresh, after: snap() });
    }
    state[u] = "done";
    steps.push({ u, before, popped, checks, found: checks.filter((c) => c.fresh).map((c) => c.v), after: snap() });
  }
  return { g, s, start, steps, order, dist, parent, end: snap() };
}

// The shortest path s -> t that BFS found, as a list of vertices (empty if unreachable).
export function pathTo(tr, t) {
  if (tr.dist[t] < 0) return [];
  const p = [];
  for (let v = t; v !== -1; v = tr.parent[v]) p.unshift(v);
  return p;
}

export const edgeList = (g) => {
  const seen = new Set(), out = [];
  g.adj.forEach((ns, u) => ns.forEach((v) => {
    const k = g.directed ? `${u}>${v}` : `${Math.min(u, v)}-${Math.max(u, v)}`;
    if (!seen.has(k)) { seen.add(k); out.push([u, v]); }
  }));
  return out;
};

// ---------- fixed graphs ----------
const byName = (names, lists) => names.map((nm) => (lists[nm] || []).map((x) => names.indexOf(x)));

// The textbook's BFS example (CLRS, "Breadth-first search" figure): eight
// vertices in two rows, source s. The adjacency order below reproduces the
// figure's queue: s | w r | r t x | t x v | x v u | v u y | u y | y.
export function textbookGraph() {
  const names = ["r", "s", "t", "u", "v", "w", "x", "y"];
  const adj = byName(names, {
    r: ["s", "v"], s: ["w", "r"], t: ["w", "x", "u"], u: ["t", "x", "y"],
    v: ["r"], w: ["s", "t", "x"], x: ["w", "t", "u", "y"], y: ["x", "u"],
  });
  const xs = [80, 200, 320, 440];
  const pos = names.map((_, i) => ({ x: xs[i % 4], y: i < 4 ? 80 : 195 }));
  return { names, adj, pos, directed: false, rule: "the adjacency lists shown (textbook order)", source: 1 };
}

// A binary tree: BFS from the root is level-order traversal.
export function treeGraph() {
  const names = ["15", "10", "24", "7", "13", "20", "30", "25", "36"];
  const adj = byName(names, { 15: ["10", "24"], 10: ["7", "13"], 24: ["20", "30"], 30: ["25", "36"] });
  const pos = [{ x: 245, y: 40 }, { x: 125, y: 105 }, { x: 355, y: 105 }, { x: 65, y: 170 }, { x: 185, y: 170 }, { x: 295, y: 170 }, { x: 415, y: 170 }, { x: 365, y: 235 }, { x: 460, y: 235 }];
  return { names, adj, pos, directed: true, tree: true, rule: "left child, then right child", source: 0 };
}

// A small graph with a cycle and two routes to the far side.
export function sixGraph() {
  const names = ["A", "B", "C", "D", "E", "F"];
  const adj = byName(names, { A: ["B", "D"], B: ["A", "C", "E"], C: ["B", "F"], D: ["A", "E"], E: ["B", "D", "F"], F: ["C", "E"] });
  const xs = [110, 260, 410];
  const pos = names.map((_, i) => ({ x: xs[i % 3], y: i < 3 ? 80 : 195 }));
  return { names, adj, pos, directed: false, rule: "alphabetical order", source: 0 };
}

// ---------- random graphs ----------
// Vertices sit on a 4 x 2 grid and edges only join grid neighbors (one
// diagonal per cell), so the drawing never has crossing edges.
export function randomGraph(rnd, { n = 8, cutOff = false } = {}) {
  const cols = 4;
  const cells = [0, 1, 2, 3, 4, 5, 6, 7];
  if (n < 8) cells.splice(4 + Math.floor(rnd() * 4), 8 - n);          // drop bottom-row cells
  const names = cells.map((_, i) => String.fromCharCode(65 + i));
  const at = (cell) => cells.indexOf(cell);
  const cand = [];
  for (let c = 0; c < 8; c++) {
    const col = c % cols, row = Math.floor(c / cols);
    if (col < cols - 1) cand.push([c, c + 1]);
    if (row === 0) cand.push([c, c + cols]);
    if (row === 0 && col < cols - 1) cand.push(rnd() < 0.5 ? [c, c + cols + 1] : [c + 1, c + cols]);
  }
  const all = cand.map(([p, q]) => [at(p), at(q)]).filter(([p, q]) => p >= 0 && q >= 0);
  const N = names.length;
  const lonely = cutOff ? 1 + Math.floor(rnd() * (N - 1)) : -1;         // one vertex with no edges at all
  const usable = all.filter(([p, q]) => p !== lonely && q !== lonely);
  const picked = usable.filter(() => rnd() < 0.5);
  // join the pieces until everything except the lonely vertex is connected
  const comp = () => {
    const id = names.map((_, i) => i);
    const find = (x) => (id[x] === x ? x : (id[x] = find(id[x])));
    picked.forEach(([p, q]) => { id[find(p)] = find(q); });
    return find;
  };
  const rest = usable.filter((e) => !picked.includes(e));
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  for (const e of rest) { const f = comp(); if (f(e[0]) !== f(e[1])) picked.push(e); }
  const adj = names.map(() => []);
  picked.forEach(([p, q]) => { adj[p].push(q); adj[q].push(p); });
  adj.forEach((l) => l.sort((x, y) => x - y));
  const xs = [80, 200, 320, 440];
  const pos = cells.map((c) => ({ x: xs[c % cols] + Math.round((rnd() - 0.5) * 30), y: (c < cols ? 80 : 195) + Math.round((rnd() - 0.5) * 30) }));
  const pool = names.map((_, i) => i).filter((i) => i !== lonely);
  return { names, adj, pos, directed: false, rule: "alphabetical order", source: pool[Math.floor(rnd() * pool.length)], lonely };
}

export const BFS_ROUNDS_DIST = 8;

// Rounds for each mode.
//  bfs-step / bfs-step-rand: one round per dequeue of a single BFS run
//  bfs-order:                one round per graph, click the visit order
//  bfs-dist:                 one round per graph, name d[target]
export function bfsRounds(mode, rnd) {
  if (mode === "bfs-step" || mode === "bfs-step-rand") {
    const g = mode === "bfs-step" ? textbookGraph() : randomGraph(rnd, { n: 8 });
    const tr = bfsTrace(g, g.source);
    return tr.steps.map((st, k) => ({ kind: "step", tr, g, k, st }));
  }
  if (mode === "bfs-order") {
    return [treeGraph(), sixGraph(), randomGraph(rnd, { n: 7 })].map((g) => ({ kind: "order", g, tr: bfsTrace(g, g.source) }));
  }
  return Array.from({ length: BFS_ROUNDS_DIST }, (_, i) => {
    const cutOff = i === 3 || i === 6;                                   // two rounds teach "unreachable"
    for (let tries = 0; ; tries++) {
      const g = randomGraph(rnd, { n: 7 + Math.floor(rnd() * 2), cutOff });
      const tr = bfsTrace(g, g.source);
      const far = Math.max(...tr.dist);
      if (far > 5 && tries < 40) continue;
      let target;
      if (cutOff) target = g.lonely;
      else {
        const pool = g.names.map((_, v) => v).filter((v) => tr.dist[v] >= 2);
        if (!pool.length && tries < 40) continue;
        const src = pool.length ? pool : g.names.map((_, v) => v).filter((v) => v !== g.source);
        target = src[Math.floor(rnd() * src.length)];
      }
      return { kind: "dist", g, tr, target, answer: tr.dist[target] };
    }
  });
}
