// Quicksort simulator for the Arena: the "left wall" partition from class
// (pivot = A[low]), traced one comparison at a time so the game can ask
// about each step and replay the swaps.

// Every cell carries a stable id so the board can animate boxes sliding
// between slots when they swap.
export const tag = (vals) => vals.map((v, i) => ({ id: "c" + i, v }));

// partition(A, low, high) exactly as written in the corrected slide:
//   pivot = A[low]; leftwall = low
//   for i = low+1 .. high: if A[i] < pivot { leftwall++; swap(A[i], A[leftwall]) }
//   swap(A[low], A[leftwall]); return leftwall
export function partitionTrace(cells, low, high) {
  const a = cells.map((c) => ({ ...c }));
  const pivot = a[low].v;
  let wall = low;
  const steps = [];
  for (let i = low + 1; i <= high; i++) {
    const less = a[i].v < pivot;
    const wallBefore = wall;
    let swap = null;
    if (less) {
      wall++;
      if (wall !== i) { const t = a[i]; a[i] = a[wall]; a[wall] = t; }
      swap = [i, wall];
    }
    steps.push({ i, val: less ? a[wall].v : a[i].v, less, wallBefore, wallAfter: wall, swap, arr: a.map((c) => ({ ...c })) });
  }
  const before = a.map((c) => ({ ...c }));
  const t = a[low]; a[low] = a[wall]; a[wall] = t;
  return { low, high, pivot, start: cells.map((c) => ({ ...c })), steps, beforeFinal: before, final: a, p: wall };
}

// Every partition call a full quicksort makes, in the order it makes them.
// Ranges with fewer than two elements return immediately and aren't rounds.
export function quicksortCalls(vals) {
  let cells = tag(vals);
  const calls = [];
  const locked = new Set();
  const go = (low, high) => {
    if (low > high) return;
    if (low === high) { locked.add(low); return; }
    const tr = partitionTrace(cells, low, high);
    calls.push({ ...tr, locked: new Set(locked), depth: 0 });
    cells = tr.final;
    locked.add(tr.p);
    go(low, tr.p - 1);
    go(tr.p + 1, high);
  };
  go(0, vals.length - 1);
  return { calls, sorted: cells.map((c) => c.v) };
}

const shuffle = (xs, rnd) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export function randomArray(rnd, n = 7) {
  const pool = Array.from({ length: 40 }, (_, i) => i + 2);
  return shuffle(pool, rnd).slice(0, n);
}

export const SORT_TRACE_ARRAYS = [[5, 3, 8, 1, 9, 2], [4, 7, 2, 6, 1, 5, 3], [6, 2, 9, 1, 8, 3, 7]];
export const SORT_FULL_ARRAY = [5, 3, 8, 1, 9, 2, 7];

// Rounds for each mode. A round is one partition call on [low..high].
export function sortRounds(mode, rnd) {
  if (mode === "sort-trace") return SORT_TRACE_ARRAYS.map((v) => ({ ...partitionTrace(tag(v), 0, v.length - 1), locked: new Set(), stepwise: true }));
  if (mode === "sort-full") return quicksortCalls(SORT_FULL_ARRAY).calls;
  if (mode === "sort-full-rand") return quicksortCalls(randomArray(rnd, 8)).calls;
  // sort-pivot: fresh random arrays, one question each
  return Array.from({ length: 8 }, () => { const v = randomArray(rnd, 7); return { ...partitionTrace(tag(v), 0, v.length - 1), locked: new Set() }; });
}
