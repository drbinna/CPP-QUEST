// Depth-first search simulator for the Arena. DFS(G, s) is traced event by
// event (discover, check an edge, finish) so the game can replay the
// recursion: the call stack, the three colors and the parent pointers.
//
// Graphs use the same shape as bfssim.js: { names, adj, pos, directed, rule }.
// adj[u] lists u's neighbors IN THE ORDER DFS CHECKS THEM.

import { textbookGraph, treeGraph, sixGraph, randomGraph } from "./bfssim.js";

export { BOARD_W, BOARD_H, edgeList } from "./bfssim.js";

// vertex states, the three colors from class:
//   "white"  not visited yet
//   "grey"   visited, still exploring its neighbors (it's on the call stack)
//   "black"  finished: every neighbor checked, its dfs() call has returned
export function dfsTrace(g, s) {
  const n = g.names.length;
  const state = new Array(n).fill("white"), parent = new Array(n).fill(-1);
  const disc = new Array(n).fill(-1), fin = new Array(n).fill(-1);
  const stack = [];
  let time = 0;
  const snap = () => ({ state: [...state], parent: [...parent], stack: [...stack], disc: [...disc], fin: [...fin] });
  const start = snap();
  const events = [], order = [], finishOrder = [];
  const visit = (u) => {
    state[u] = "grey"; disc[u] = ++time; stack.push(u); order.push(u);
    events.push({ type: "discover", v: u, from: parent[u], after: snap() });
    for (const v of g.adj[u]) {
      const fresh = state[v] === "white";
      events.push({ type: "check", u, v, fresh, after: snap() });
      if (fresh) { parent[v] = u; visit(v); }
    }
    state[u] = "black"; fin[u] = ++time; stack.pop(); finishOrder.push(u);
    events.push({ type: "finish", v: u, after: snap() });
  };
  visit(s);
  return { g, s, start, events, order, finishOrder, parent, disc, fin, end: snap() };
}

// Index (into tr.events) of the event that discovers order[k].
export const discoverAt = (tr, k) => tr.events.findIndex((e) => e.type === "discover" && e.v === tr.order[k]);

// A graph with a fork near the source, so DFS has to dive and come back.
function forkGraph() {
  const names = ["A", "B", "C", "D", "E", "F", "G"];
  const byName = (lists) => names.map((nm) => (lists[nm] || []).map((x) => names.indexOf(x)));
  const adj = byName({ A: ["B", "E"], B: ["A", "C", "D"], C: ["B"], D: ["B", "F"], E: ["A", "F", "G"], F: ["D", "E"], G: ["E"] });
  const pos = [{ x: 70, y: 135 }, { x: 190, y: 70 }, { x: 310, y: 30 }, { x: 330, y: 125 }, { x: 190, y: 205 }, { x: 440, y: 160 }, { x: 330, y: 240 }];
  return { names, adj, pos, directed: false, rule: "alphabetical order", source: 0 };
}

export const DFS_ROUNDS_GREY = 6;

// Rounds for each mode.
//  dfs-step / dfs-step-rand: one round per discovery of a single DFS run
//  dfs-order:                one round per graph, click the discovery order
//  dfs-grey:                 one round per graph, pause on a discovery and
//                            click every vertex that is grey (on the stack)
export function dfsRounds(mode, rnd) {
  if (mode === "dfs-step" || mode === "dfs-step-rand") {
    const g = mode === "dfs-step" ? textbookGraph() : randomGraph(rnd, { n: 8 });
    const tr = dfsTrace(g, g.source);
    return tr.order.slice(1).map((v, i) => {
      const k = i + 1, from = discoverAt(tr, k - 1), to = discoverAt(tr, k);
      return { kind: "step", g, tr, k, answer: v, before: tr.events[from].after, at: tr.order[k - 1], events: tr.events.slice(from + 1, to + 1) };
    });
  }
  if (mode === "dfs-order") {
    return [treeGraph(), forkGraph(), sixGraph(), randomGraph(rnd, { n: 7 })].map((g) => ({ kind: "order", g, tr: dfsTrace(g, g.source) }));
  }
  return Array.from({ length: DFS_ROUNDS_GREY }, (_, i) => {
    for (let tries = 0; ; tries++) {
      const g = i === 0 ? forkGraph() : randomGraph(rnd, { n: 7 + Math.floor(rnd() * 2) });
      const tr = dfsTrace(g, g.source);
      // pause on a discovery where the stack is deep and DFS has already backtracked at least once
      const cands = tr.events.map((e, idx) => ({ e, idx })).filter(({ e, idx }) => e.type === "discover" && e.after.stack.length >= 3
        && tr.events.slice(0, idx).some((x) => x.type === "finish"));
      const pool = cands.length ? cands : tr.events.map((e, idx) => ({ e, idx })).filter(({ e }) => e.type === "discover" && e.after.stack.length >= 3);
      if (!pool.length && tries < 40) continue;
      const pick = pool.length ? pool[Math.floor(rnd() * pool.length)] : { e: tr.events[0], idx: 0 };
      return { kind: "grey", g, tr, t: pick.e.v, idx: pick.idx, at: pick.e.after, answer: pick.e.after.stack };
    }
  });
}
