// Parse tree snapshots emitted by the lesson's snapshot() helper (on stderr as
// "@@T <preorder tokens>" with "#" for null), build layout-compatible trees,
// and diff consecutive snapshots so the UI can animate real inserts/removes.
// Pure module: no React, node-testable.

// "@@T 8 3 # 6 # # 10 # #" -> tree in bstsim's {nodes, root} shape, ids = "v"+value.
export function parseSnapshot(line) {
  const toks = line.replace(/^@@T\s*/, "").trim().split(/\s+/).filter(Boolean);
  const nodes = {};
  let i = 0;
  const build = () => {
    if (i >= toks.length) return null;
    const t = toks[i++];
    if (t === "#") return null;
    const val = Number(t);
    if (!Number.isFinite(val)) return null;
    const id = "v" + val;
    nodes[id] = { id, val, left: null, right: null };
    nodes[id].left = build();
    nodes[id].right = build();
    return id;
  };
  const root = build();
  return { nodes, root };
}

// All "@@T" lines from a stderr blob, in order, consecutive duplicates dropped.
export function parseSnapshots(stderr) {
  const out = [];
  let prev = null;
  for (const raw of String(stderr || "").split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("@@T")) continue;
    const key = line.replace(/^@@T\s*/, "").trim();
    if (key === prev) continue;
    prev = key;
    out.push(parseSnapshot(line));
  }
  return out;
}

// value -> { parent: value|null, side: "left"|"right"|null, depth }
export function flatten(tree) {
  const m = {};
  const walk = (id, parent, side, depth) => {
    if (!id) return;
    const n = tree.nodes[id];
    m[n.val] = { parent, side, depth };
    walk(n.left, n.val, "left", depth + 1);
    walk(n.right, n.val, "right", depth + 1);
  };
  walk(tree.root, null, null, 0);
  return m;
}

// What changed between two snapshots.
export function diffSnapshots(prev, next) {
  const a = prev ? flatten(prev) : {};
  const b = flatten(next);
  const added = [], removed = [], moved = [];
  for (const v of Object.keys(b).map(Number)) {
    if (!(v in a)) added.push(v);
    else if (a[v].parent !== b[v].parent || a[v].side !== b[v].side) moved.push(v);
  }
  for (const v of Object.keys(a).map(Number)) if (!(v in b)) removed.push(v);
  return { added, removed, moved };
}

export function describe(diff, isFirst) {
  const parts = [];
  if (isFirst && diff.added.length === 0 && diff.removed.length === 0) return "empty tree";
  if (diff.added.length) parts.push(`inserted ${diff.added.join(", ")}`);
  if (diff.removed.length) parts.push(`removed ${diff.removed.join(", ")}`);
  if (diff.moved.length) parts.push(`${diff.moved.join(", ")} moved`);
  return parts.join(" \u00b7 ") || "no change";
}

export function depthOf(tree) {
  let d = 0;
  const walk = (id, k) => { if (!id) return; d = Math.max(d, k); walk(tree.nodes[id].left, k + 1); walk(tree.nodes[id].right, k + 1); };
  walk(tree.root, 0);
  return d;
}

export function isStick(tree) {
  // every node has at most one child and there are 4+ nodes: the classic bad insert
  const ids = Object.keys(tree.nodes);
  if (ids.length < 4) return false;
  return ids.every((id) => !(tree.nodes[id].left && tree.nodes[id].right));
}

// ---------- tiny explainers: reconstruct WHY a step happened ----------

function childrenOf(tree, val) {
  const n = tree.nodes["v" + val];
  if (!n) return [];
  return ["left", "right"].filter((s) => n[s]).map((s) => tree.nodes[n[s]].val);
}

// Comparison path from the root to `val` in `tree` (stops before val itself).
export function pathTo(tree, val) {
  const path = [];
  let id = tree.root;
  while (id) {
    const n = tree.nodes[id];
    if (n.val === val) break;
    path.push(n.val);
    id = val < n.val ? n.left : n.right;
  }
  return path;
}

// { kind, value, title, lines[], tie, path[] } describing prev -> next.
export function explainStep(prev, next, diff) {
  const d = diff || diffSnapshots(prev, next);
  if (!prev || (!prev.root && next.root && d.added.length === 1)) {
    const v = next.nodes[next.root].val;
    return { kind: "root", value: v, title: `${v} became the root`, path: [],
      lines: ["The tree was empty, so the very first call hit the base case."],
      tie: "Your `t == nullptr` branch ran on `root` itself. Because `t` is a `tnode *&`, setting `t = new tnode` set `root`." };
  }
  if (d.added.length === 1 && d.removed.length === 0) {
    const v = d.added[0];
    const path = pathTo(next, v);
    const lines = path.map((p) => `${v} vs ${p}: ${v < p ? "smaller \u2192 went left" : "bigger \u2192 went right"}`);
    lines.push(`empty spot \u2192 ${v} hooked on here`);
    if (d.moved.length) {
      const before = prev && prev.root ? prev.nodes[prev.root].val : null, after = next.nodes[next.root].val;
      return { kind: "rotate", value: v, title: `inserted ${v}, then the tree ROTATED`, path: [],
        lines: [`${v} went in and made a node 2 levels heavier on one side.`, `bal() rotated: ${d.moved.join(", ")} shifted to restore balance${before !== null && before !== after ? ` (the root changed from ${before} to ${after})` : ""}.`],
        tie: "On the way back up the recursion, `bal(t)` found `height(left) - height(right)` at 2 and called `rotateRight` / `rotateLeft` (after straightening a kink with the opposite rotation first)." };
    }
    return { kind: "insert", value: v, title: `inserted ${v}`, path, lines,
      tie: `${path.length} comparison${path.length === 1 ? "" : "s"} = ${path.length} recursive call${path.length === 1 ? "" : "s"} down; the hook-up is the \`t == nullptr\` branch, writing through the parent's pointer.` };
  }
  if (d.removed.length === 1) {
    const r = d.removed[0];
    const kids = childrenOf(prev, r);
    const path = pathTo(prev, r);
    const wasRoot = prev.nodes[prev.root].val === r;
    const walk = path.length ? `Walked ${path.join(" \u2192 ")} to find ${r}. ` : (wasRoot ? `${r} was the root. ` : "");
    if (kids.length === 0) {
      return { kind: "leaf", value: r, wasRoot, title: `removed ${r} (a leaf)`, path,
        lines: [walk + `${r} had no children, so its parent's pointer just became nullptr.`],
        tie: "Your bypass line ran with both children null: `t = (t->left) ? t->left : t->right` picked nullptr, then `delete`." };
    }
    if (kids.length === 1) {
      return { kind: "one", value: r, wasRoot, title: `removed ${r} (one child)`, path,
        lines: [walk + `${r} had one child, ${kids[0]}. The parent now points straight past ${r} to ${kids[0]}.`],
        tie: "The bypass: `tnode *dead = t; t = (t->left) ? t->left : t->right; delete dead;` \u2014 save, redirect, then delete." };
    }
    // two children: the successor now sits where r was
    const pos = flatten(prev)[r];
    let succ = null;
    if (pos.parent === null) succ = next.root ? next.nodes[next.root].val : null;
    else { const pn = next.nodes["v" + pos.parent]; const cid = pn && pn[pos.side]; succ = cid ? next.nodes[cid].val : null; }
    return { kind: "two", value: r, wasRoot, successor: succ, title: `removed ${r} (two children)`, path,
      lines: [walk + `${r} had two children, so it couldn't be bypassed.`,
        `Its cargo was replaced by ${succ} \u2014 the smallest key in its right subtree \u2014 then the old ${succ} was removed from below.`],
      tie: "`t->p = findMin(t->right); remove(t->p.key, t->right);` \u2014 copy the successor up, then evict it with your own remove (an easy case, since a min has no left child)." };
  }
  if (d.removed.length === 1 && d.moved.length > 2 && !next.root === false) {
    // handled above, but a rebalancing remove moves more than the successor; fallthrough is fine
  }
  if (!next.root && d.removed.length > 1) {
    return { kind: "clear", value: null, title: `cleared ${d.removed.length} nodes`, path: [],
      lines: ["Every node was freed, children before parents, and root ended as nullptr."],
      tie: "Post-order: `clear(t->left); clear(t->right); delete t; t = nullptr;` \u2014 the only order that never touches freed memory." };
  }
  return { kind: "other", value: null, title: describe(d), path: [], lines: [], tie: "" };
}

export function nodeCount(tree) { return Object.keys(tree.nodes).length; }
export function heightOf(tree) { return tree.root ? depthOf(tree) + 1 : 0; }

// ---------- missions: small goals judged from the snapshots ----------
const kindsOf = (snaps) => snaps.slice(1).map((s, i) => explainStep(snaps[i], s));
const last = (snaps) => snaps[snaps.length - 1];
const XP = 25;
const INSERT_MISSIONS = [
  { id: "m_balanced7", text: "Build a perfectly balanced tree: 7 nodes, height 3", xp: XP, check: (s) => nodeCount(last(s)) === 7 && heightOf(last(s)) === 3 },
  { id: "m_stick5", text: "Make a stick on purpose: 5+ nodes, every node has at most one child", xp: XP, check: (s) => isStick(last(s)) && nodeCount(last(s)) >= 5 },
  { id: "m_rightheavy", text: "Give the root an empty left side and at least 3 nodes on its right", xp: XP,
    check: (s) => { const t = last(s); if (!t.root) return false; const r = t.nodes[t.root]; return !r.left && !!r.right && nodeCount(t) >= 4; } },
];
export const MISSIONS = {
  l31: INSERT_MISSIONS, l32: INSERT_MISSIONS, l33: INSERT_MISSIONS, l36: INSERT_MISSIONS, l37: INSERT_MISSIONS,
  l38: [
    { id: "m_leaf", text: "Remove a leaf (a node with no children)", xp: XP, check: (s) => kindsOf(s).some((k) => k.kind === "leaf") },
    { id: "m_onechild", text: "Remove a node that has exactly one child", xp: XP, check: (s) => kindsOf(s).some((k) => k.kind === "one") },
    { id: "m_root", text: "Remove the root itself", xp: XP, check: (s) => kindsOf(s).some((k) => k.wasRoot) },
  ],
  l39: [
    { id: "m_two", text: "Remove a node with two children (watch the successor move up)", xp: XP, check: (s) => kindsOf(s).some((k) => k.kind === "two") },
    { id: "m_tworoot", text: "Remove the root while it has two children", xp: XP, check: (s) => kindsOf(s).some((k) => k.kind === "two" && k.wasRoot) },
    { id: "m_shrink", text: "Do 3+ removals and end with height 2 or less", xp: XP, check: (s) => kindsOf(s).filter((k) => ["leaf", "one", "two"].includes(k.kind)).length >= 3 && heightOf(last(s)) <= 2 },
  ],
  l43: [
    { id: "m_h4", text: "Build a tree whose root height is 4 or more (no balancing here, so a long chain works)", xp: XP, check: (s) => heightOf(last(s)) >= 4 },
    { id: "m_h3seven", text: "7 nodes with root height exactly 3: the shape balancing will produce automatically next lesson", xp: XP, check: (s) => nodeCount(last(s)) === 7 && heightOf(last(s)) === 3 },
  ],
  l44: [
    { id: "m_rotate", text: "Trigger a rotation: insert something that makes nodes move", xp: XP, check: (s) => kindsOf(s).some((k) => k.kind === "rotate") },
    { id: "m_sorted7", text: "Insert 1..7 in order and end with height 3 (a plain BST would be a stick of height 7)", xp: XP, check: (s) => nodeCount(last(s)) >= 7 && heightOf(last(s)) === 3 },
    { id: "m_rootchange", text: "Make the root change during an insert (a rotation at the very top)", xp: XP,
      check: (s) => s.slice(1).some((t, i) => s[i].root && t.root && s[i].nodes[s[i].root].val !== t.nodes[t.root].val && diffSnapshots(s[i], t).removed.length === 0) },
  ],
  l40: [
    { id: "m_clear5", text: "Build 5+ nodes, then clear the whole tree", xp: XP, check: (s) => s.some((t) => nodeCount(t) >= 5) && !last(s).root },
    { id: "m_clear4h", text: "Build a tree of height 4 or more, then clear it", xp: XP, check: (s) => s.some((t) => heightOf(t) >= 4) && !last(s).root },
  ],
};
export function checkMissions(lessonId, snaps) {
  const ms = MISSIONS[lessonId] || [];
  if (!snaps || snaps.length < 2) return [];
  return ms.filter((m) => { try { return m.check(snaps); } catch { return false; } }).map((m) => m.id);
}
