// Heap Arena: insert (bubble up) and extract (bubble down), as prediction rounds.
// Pure module (no React) so node can test it. A heap is just an array: no
// pointers, children found by index math. Everything here is 0-indexed;
// the UI relabels for professors who start the root at 1.

export const parentOf = (i) => Math.floor((i - 1) / 2);
export const leftOf = (i) => 2 * i + 1;
export const rightOf = (i) => 2 * i + 2;

// beats(child, parent) is true when the child must move up: a min heap wants
// the smaller value on top, a max heap the larger.
const beats = (kind) => (a, b) => (kind === "min" ? a < b : a > b);

// --- insert -------------------------------------------------------------
// Put v in the next open spot, then bubble it up. Steps are structured so the
// UI can phrase them with either index base.
export function heapInsert(heap, v, kind = "min") {
  const win = beats(kind);
  const a = [...heap, v];
  let i = a.length - 1;
  const steps = [{ arr: [...a], i, other: null, act: "place", moved: v }];
  while (i > 0) {
    const p = parentOf(i);
    const swap = win(a[i], a[p]);
    steps.push({ arr: null, i, other: p, act: swap ? "swap" : "stop", moved: v, parentVal: a[p] });
    if (!swap) break;
    [a[i], a[p]] = [a[p], a[i]];
    i = p;
    steps[steps.length - 1].arr = [...a];
  }
  const last = steps[steps.length - 1];
  if (last.arr === null) last.arr = [...a];
  return { arr: a, finalIndex: i, steps };
}

export const buildHeap = (vals, kind = "min") => vals.reduce((h, v) => heapInsert(h, v, kind).arr, []);

// --- extract ------------------------------------------------------------
// Remove the root, move the last element up into it, shrink, then sink it.
export function heapExtract(heap, kind = "min") {
  const win = beats(kind);
  const removed = heap[0];
  const mover = heap[heap.length - 1];
  const a = heap.slice(0, -1);
  if (a.length) a[0] = mover;
  let i = 0;
  const steps = [{ arr: [...a], i: a.length ? 0 : null, other: null, act: "fill", moved: mover, removed }];
  while (a.length) {
    const l = leftOf(i), r = rightOf(i);
    let pick = i;
    if (l < a.length && win(a[l], a[pick])) pick = l;
    if (r < a.length && win(a[r], a[pick])) pick = r;
    const kids = [l, r].filter((k) => k < a.length).map((k) => ({ k, v: a[k] }));
    steps.push({ arr: null, i, other: pick === i ? null : pick, act: pick === i ? "stop" : "swap", moved: mover, kids });
    if (pick === i) break;
    [a[i], a[pick]] = [a[pick], a[i]];
    i = pick;
    steps[steps.length - 1].arr = [...a];
  }
  const last = steps[steps.length - 1];
  if (last.arr === null) last.arr = [...a];
  return { arr: a, finalIndex: a.length ? i : null, removed, mover, steps };
}

// --- rounds -------------------------------------------------------------
// Spots offered in step 1 of an insert: the right one (index n) plus a few
// believable wrong ones among the empty children of existing nodes.
export function candidateSlots(n) {
  if (n === 0) return [0];
  const set = new Set([n, n + 1, n + 2, 2 * n - 1, 2 * n].filter((k) => k >= n && k <= 2 * n));
  return [...set].sort((a, b) => a - b);
}

export function insertRound(heap, v, kind = "min") {
  const r = heapInsert(heap, v, kind);
  return { op: "insert", kind, before: heap, value: v, landing: heap.length, slots: candidateSlots(heap.length), ...r };
}

export function extractRound(heap, kind = "min") {
  const r = heapExtract(heap, kind);
  return { op: "extract", kind, before: heap, value: r.removed, moverIndex: heap.length - 1, ...r };
}

export const HEAP_SCRIPTS = {
  notes: { label: "your notes (insert)", kind: "min", start: [50, 100, 75, 200, 300, 90, 77, 1000, 201], ops: [["i", 60], ["i", 40], ["i", 80], ["i", 76], ["i", 500], ["i", 10]] },
  build: { label: "build from scratch", kind: "min", start: [30], ops: [["i", 20], ["i", 10], ["i", 40], ["i", 5], ["i", 25], ["i", 15], ["i", 8]] },
  clrs: { label: "textbook 6.5-1 (extract-max)", kind: "max", start: [15, 13, 9, 5, 12, 8, 7, 4, 0, 6, 2, 1], ops: [["x"], ["x"], ["i", 10], ["x"]] },
  drain: { label: "empty a max heap", kind: "max", start: [42, 30, 28, 19, 21, 14, 9, 7, 11], ops: [["x"], ["x"], ["x"], ["x"]] },
};

export function scriptRounds(key) {
  const s = HEAP_SCRIPTS[key]; const rounds = []; let h = [...s.start];
  for (const [op, v] of s.ops) {
    const r = op === "x" ? extractRound(h, s.kind) : insertRound(h, v, s.kind);
    rounds.push(r); h = r.arr;
  }
  return rounds;
}

export function randomRounds(rnd, count = 6, kind = "min", mix = "insert") {
  const used = new Set();
  const pick = () => { let v; do { v = 1 + Math.floor(rnd() * 99); } while (used.has(v)); used.add(v); return v; };
  let h = buildHeap(Array.from({ length: 6 + Math.floor(rnd() * 4) }, pick), kind);
  const rounds = [];
  for (let k = 0; k < count; k++) {
    const doExtract = mix === "extract" || (mix === "both" && rnd() < 0.5);
    const r = doExtract && h.length > 2 ? extractRound(h, kind) : insertRound(h, pick(), kind);
    rounds.push(r); h = r.arr;
  }
  return rounds;
}

export function isHeap(a, kind = "min") {
  const win = beats(kind);
  for (let i = 1; i < a.length; i++) if (win(a[i], a[parentOf(i)])) return false;
  return true;
}
