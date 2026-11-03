// Tree Arena: prediction puzzles judged without compiling anything.
// Pure module (no React) so node can test it. Trees use the same
// {nodes keyed "v"+val, root} shape as livetree/bstsim.

export function rng(seed) {                 // tiny seeded PRNG (mulberry32)
  let a = seed >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function buildValTree(values) {
  const nodes = {}; let root = null;
  for (const v of values) {
    const id = "v" + v;
    if (nodes[id]) continue;
    nodes[id] = { id, val: v, left: null, right: null };
    if (!root) { root = id; continue; }
    let cur = root;
    for (;;) { const side = v < nodes[cur].val ? "left" : "right"; if (!nodes[cur][side]) { nodes[cur][side] = id; break; } cur = nodes[cur][side]; }
  }
  return { nodes, root };
}

export function pathTo(tree, v) {
  const path = []; let id = tree.root;
  while (id) { const n = tree.nodes[id]; if (n.val === v) break; path.push(n.val); id = v < n.val ? n.left : n.right; }
  return path;
}

export function emptySlots(tree) {          // every missing child: { id, parent, side }
  const out = [];
  for (const id of Object.keys(tree.nodes)) for (const side of ["left", "right"]) if (!tree.nodes[id][side]) out.push({ id: `${tree.nodes[id].val}-${side}`, parent: tree.nodes[id].val, side });
  return out;
}

function distinct(r, n, max = 99) { const s = new Set(); while (s.size < n) s.add(1 + Math.floor(r() * max)); return [...s]; }

// "Land the node": where does v hook on?
export function genInsertPuzzle(r) {
  const n = 4 + Math.floor(r() * 5);
  const vals = distinct(r, n + 1);
  const v = vals.pop();
  const tree = buildValTree(vals);
  const path = pathTo(tree, v);
  const last = path[path.length - 1];
  const answer = `${last}-${v < last ? "left" : "right"}`;
  const lines = path.map((p) => `${v} vs ${p}: ${v < p ? "smaller \u2192 left" : "bigger \u2192 right"}`);
  lines.push(`no child there \u2192 ${v} hooks on under ${last}`);
  return { kind: "insert", tree, value: v, answer, slots: emptySlots(tree), lines, prompt: `Insert ${v} \u2014 click the spot where it lands` };
}

function minOf(tree, id) { while (tree.nodes[id].left) id = tree.nodes[id].left; return tree.nodes[id].val; }

// "Who takes the seat": removing a two-children node, click its successor.
export function genSeatPuzzle(r) {
  for (let tries = 0; tries < 50; tries++) {
    const tree = buildValTree(distinct(r, 6 + Math.floor(r() * 4)));
    const twos = Object.keys(tree.nodes).filter((id) => tree.nodes[id].left && tree.nodes[id].right);
    if (!twos.length) continue;
    const id = twos[Math.floor(r() * twos.length)];
    const x = tree.nodes[id].val;
    const answer = minOf(tree, tree.nodes[id].right);
    const walk = []; let c = tree.nodes[id].right; while (c) { walk.push(tree.nodes[c].val); c = tree.nodes[c].left; }
    return { kind: "seat", tree, value: x, answer, lines: [`${x} has two children, so it can't be bypassed.`, `Its replacement is the smallest key in its RIGHT subtree: step right to ${walk[0]}, then left until you can't: ${walk.join(" \u2192 ")}.`, `${answer} takes the seat; the old ${answer} is then removed from below (easy case: a min has no left child).`], prompt: `Remove ${x} (two children) \u2014 click the node that takes its seat` };
  }
  return genInsertPuzzle(r);
}

// "Find the floor": click the min (leftmost) or max (rightmost).
export function genExtremePuzzle(r) {
  const tree = buildValTree(distinct(r, 5 + Math.floor(r() * 5)));
  const wantMin = r() < 0.5;
  let id = tree.root; const walk = [];
  while (id) { walk.push(tree.nodes[id].val); id = wantMin ? tree.nodes[id].left : tree.nodes[id].right; }
  const answer = walk[walk.length - 1];
  return { kind: "extreme", tree, value: null, answer, lines: [`${wantMin ? "Smaller" : "Bigger"} keys always live ${wantMin ? "left" : "right"}, so keep going ${wantMin ? "left" : "right"} until there's no child: ${walk.join(" \u2192 ")}.`, `That's ${wantMin ? "findMin" : "findMax"}: \`while (p->${wantMin ? "left" : "right"}) p = p->${wantMin ? "left" : "right"};\``], prompt: `Click the ${wantMin ? "SMALLEST" : "LARGEST"} key in this tree` };
}

export const MODES = { insert: genInsertPuzzle, seat: genSeatPuzzle, extreme: genExtremePuzzle };
export function genPuzzle(mode, r) {
  if (mode === "mix") { const ks = ["insert", "seat", "extreme"]; return MODES[ks[Math.floor(r() * ks.length)]](r); }
  return (MODES[mode] || genInsertPuzzle)(r);
}

export const ROUNDS = 10;
export const pointsFor = (streak) => 10 * Math.min(3, Math.max(1, streak));   // streak multiplier, capped x3
export const xpFor = (correct) => correct * 3;

// ---------- Class exercise: scripted AVL with rotation bookkeeping ----------
// Trees stay in the {nodes keyed "v"+val, root} shape; heights are computed on the fly.

function hgt(t, id) { if (!id) return 0; const n = t.nodes[id]; return 1 + Math.max(hgt(t, n.left), hgt(t, n.right)); }
function clone(t) { const nodes = {}; for (const id in t.nodes) nodes[id] = { ...t.nodes[id] }; return { nodes, root: t.root }; }
function rotR(t, id) { const n = t.nodes[id], c = t.nodes[n.left]; n.left = c.right; c.right = id; return c.id; }
function rotL(t, id) { const n = t.nodes[id], c = t.nodes[n.right]; n.right = c.left; c.left = id; return c.id; }

// balance node `id`; returns { id: new subtree root, rot: null | {at, kind} }
function balance(t, id) {
  const n = t.nodes[id]; const hl = hgt(t, n.left), hr = hgt(t, n.right);
  if (hl - hr > 1) {
    const L = t.nodes[n.left]; let kind = "right rotation";
    if (hgt(t, L.left) < hgt(t, L.right)) { n.left = rotL(t, n.left); kind = "left-right rotation"; }
    return { id: rotR(t, id), rot: { at: n.val, kind } };
  }
  if (hr - hl > 1) {
    const R = t.nodes[n.right]; let kind = "left rotation";
    if (hgt(t, R.right) < hgt(t, R.left)) { n.right = rotR(t, n.right); kind = "right-left rotation"; }
    return { id: rotL(t, id), rot: { at: n.val, kind } };
  }
  return { id, rot: null };
}

export function avlInsert(tree, v) {
  const t = clone(tree); let rot = null;
  const go = (id) => {
    if (!id) { const nid = "v" + v; t.nodes[nid] = { id: nid, val: v, left: null, right: null }; return nid; }
    const n = t.nodes[id];
    if (v < n.val) n.left = go(n.left); else if (v > n.val) n.right = go(n.right);
    const b = balance(t, id); if (b.rot && !rot) rot = b.rot; return b.id;
  };
  t.root = go(t.root);
  return { tree: t, rot };
}

export function avlRemove(tree, k, usePred) {
  const t = clone(tree); let rot = null, seat = null;
  const minOf = (id) => { while (t.nodes[id].left) id = t.nodes[id].left; return t.nodes[id].val; };
  const maxOf = (id) => { while (t.nodes[id].right) id = t.nodes[id].right; return t.nodes[id].val; };
  const go = (id, key) => {
    if (!id) return null;
    const n = t.nodes[id];
    if (key < n.val) n.left = go(n.left, key);
    else if (key > n.val) n.right = go(n.right, key);
    else if (n.left && n.right) {
      const rep = usePred ? maxOf(n.left) : minOf(n.right); seat = rep;
      if (usePred) n.left = go(n.left, rep); else n.right = go(n.right, rep);
      // re-key the node in place: keep its id stable by swapping ids
      const nid = "v" + rep; delete t.nodes[id]; t.nodes[nid] = { ...n, id: nid, val: rep };
      const b = balance(t, nid); if (b.rot && !rot) rot = b.rot; return b.id;
    } else { const child = n.left || n.right; delete t.nodes[id]; return child; }
    const b = balance(t, id); if (b.rot && !rot) rot = b.rot; return b.id;
  };
  t.root = go(t.root, k);
  return { tree: t, rot, seat };
}

export const SCRIPTS = {
  class:  { label: "Class exercise (AVL)", ops: [["i",15],["i",20],["i",24],["i",10],["i",13],["i",7],["i",30],["i",36],["i",25],["r",24],["r",20]] },
  deck:   { label: "Slides: worked example", ops: [["i",14],["i",17],["i",11],["i",7],["i",53],["i",4],["i",13],["i",12],["i",8],["r",53],["r",11],["r",8]] },
  practA: { label: "Quiz drill A", ops: [["i",50],["i",30],["i",70],["i",20],["i",40],["i",10],["i",35]] },
  practB: { label: "Quiz drill B", ops: [["i",10],["i",20],["i",30],["i",25],["i",28],["i",27],["i",5],["r",20],["r",28]] },
};
export const CLASS_EXERCISE = { inserts: SCRIPTS.class.ops.filter((o) => o[0] === "i").map((o) => o[1]), removes: SCRIPTS.class.ops.filter((o) => o[0] === "r").map((o) => o[1]), usePred: true };

export function classRounds() { return scriptRounds(SCRIPTS.class.ops); }

export function scriptRounds(ops) {
  const rounds = []; let tree = { nodes: {}, root: null };
  for (const [op, v] of ops) {
    if (op === "r") {
    const k = v; const before = tree; const { tree: after, rot, seat } = avlRemove(tree, k, true);
    const lines = [`${k} has two children. The slides' rule: replace it with the LARGEST key in its LEFT branch \u2192 ${seat}.`,
      rot ? `Walking back up, ${rot.at} is off by 2 \u2192 ${rot.kind} at ${rot.at}.` : "Walking back up, every node is within 1 \u2192 no rotation.",
      "(Your professor's code uses the smallest in the RIGHT branch instead \u2014 also legal, different tree.)"];
    const n = before.nodes["v" + k]; const two = !!(n && n.left && n.right);
    if (!two) { lines[0] = n && (n.left || n.right) ? `${k} has one child, so its parent just points past it.` : `${k} is a leaf, so it's simply unhooked.`; lines.splice(2, 1); }
    rounds.push({ kind: "class", op: "remove", value: k, before, after, seat: two ? seat : null, twoChildren: two, rotAt: rot ? rot.at : null, prompt: two ? `Remove ${k} (slides' rule: largest in its left branch)` : `Remove ${k}`, lines });
    tree = after; continue;
    }
    const before = tree; const { tree: after, rot } = avlInsert(tree, v);
    const path = pathTo(before, v); const last = path[path.length - 1];
    const landing = before.root ? `${last}-${v < last ? "left" : "right"}` : null;
    const lines = path.map((p) => `${v} vs ${p}: ${v < p ? "smaller \u2192 left" : "bigger \u2192 right"}`);
    if (!before.root) lines.push(`${v} is the first node: it becomes the root.`); else lines.push(`no child there \u2192 ${v} hooks on under ${last}`);
    lines.push(rot ? `Walking back up, ${rot.at} is off by 2 \u2192 ${rot.kind} at ${rot.at}.` : "Walking back up, every node is within 1 \u2192 no rotation.");
    rounds.push({ kind: "class", op: "insert", value: v, before, after, slots: emptySlots(before), landing, rotAt: rot ? rot.at : null, prompt: `Insert ${v}` , lines });
    tree = after;
  }
  return rounds;
}
