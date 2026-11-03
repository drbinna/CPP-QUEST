// Pure BST simulation + layout for the chapter 7 visualizer.
// No React in here, so node can unit-test every function directly.

// Build a BST from values in insertion order. Node ids are stable
// ("n" + insertion index) so the UI can key elements across rerenders.
export function buildTree(values) {
  const nodes = {};
  let root = null;
  values.forEach((v, i) => {
    const id = "n" + i;
    nodes[id] = { id, val: v, left: null, right: null };
    if (root === null) { root = id; return; }
    let cur = root;
    for (;;) {
      const side = v < nodes[cur].val ? "left" : "right";
      if (nodes[cur][side] === null) { nodes[cur][side] = id; break; }
      cur = nodes[cur][side];
    }
  });
  return { nodes, root };
}

// In-order x position, depth-based y position. Never overlaps.
export function layout(tree, width = 640, rowH = 62, top = 36) {
  const pos = {};
  if (!tree.root) return pos;
  const count = Object.keys(tree.nodes).length;
  const gap = width / (count + 1);
  let i = 0;
  const walk = (id, depth) => {
    if (!id) return;
    const n = tree.nodes[id];
    walk(n.left, depth + 1);
    i++;
    pos[id] = { x: gap * i, y: top + depth * rowH };
    walk(n.right, depth + 1);
  };
  walk(tree.root, 0);
  return pos;
}

// Comparison path of inserting v into the tree built from `values`.
export function insertPath(values, v) {
  const t = buildTree(values);
  const steps = [];
  if (!t.root) return [{ type: "place", at: null, side: null }];
  let cur = t.root;
  for (;;) {
    const side = v < t.nodes[cur].val ? "left" : "right";
    steps.push({ type: "compare", id: cur, side, nodeVal: t.nodes[cur].val });
    if (t.nodes[cur][side] === null) {
      steps.push({ type: "place", at: cur, side });
      return steps;
    }
    cur = t.nodes[cur][side];
  }
}

// Full insert script for a value sequence. Each step remembers how many
// values are fully placed before it (`placed`) and the value in flight.
export function genInsertSteps(values) {
  const steps = [];
  values.forEach((v, i) => {
    for (const s of insertPath(values.slice(0, i), v))
      steps.push({ ...s, placed: i, moving: v });
  });
  return steps;
}

// In-order traversal: a walk step on entering each node, an emit step
// when the node's value is printed. Emits come out in sorted order.
export function genInorderSteps(values) {
  const t = buildTree(values);
  const steps = [];
  let n = 0;
  const walk = (id) => {
    if (!id) return;
    steps.push({ type: "walk", id, val: t.nodes[id].val });
    walk(t.nodes[id].left);
    n++;
    steps.push({ type: "emit", id, n, val: t.nodes[id].val });
    walk(t.nodes[id].right);
  };
  walk(t.root);
  return steps;
}

// Leftmost walk: keep going left until there is no left.
export function genFindMinSteps(values) {
  const t = buildTree(values);
  const steps = [];
  let cur = t.root;
  while (cur) {
    if (t.nodes[cur].left) {
      steps.push({ type: "walk", id: cur, val: t.nodes[cur].val });
      cur = t.nodes[cur].left;
    } else {
      steps.push({ type: "found", id: cur, val: t.nodes[cur].val });
      break;
    }
  }
  return steps;
}

// Scene for insert mode at a given cursor: which nodes exist, and where
// the moving token is. cursor >= steps.length means everything is placed.
export function deriveInsert(values, steps, cursor) {
  let placedCount = values.length;
  let token = null;
  if (cursor < steps.length) {
    const s = steps[cursor];
    placedCount = s.placed;
    token = s.type === "compare"
      ? { val: s.moving, id: s.id, side: s.side, phase: "compare" }
      : { val: s.moving, id: s.at, side: s.side, phase: "place" };
  }
  return { tree: buildTree(values.slice(0, placedCount)), token };
}
