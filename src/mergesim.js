// Merge sort simulator for the Arena. merge(lo, mid, hi) is traced one
// comparison at a time so the game can ask "which finger goes next?" and
// replay the values dropping into temp[] and copying back.

import { tag, randomArray } from "./sortsim.js";

// merge(a, lo, mid, hi), the version from class:
//   i = lo, j = mid+1, k = lo
//   while i <= mid && j <= hi: take the smaller (ties go LEFT, so it's stable)
//   copy whatever is left, then copy temp[lo..hi] back into a[lo..hi]
export function mergeTrace(cells, lo, mid, hi) {
  const a = cells.map((c) => ({ ...c }));
  let i = lo, j = mid + 1;
  const out = [];            // cells in the order they land in temp
  const steps = [];
  while (i <= mid && j <= hi) {
    const takeLeft = a[i].v <= a[j].v;
    steps.push({ i, j, k: lo + out.length, cmp: true, takeLeft, left: a[i].v, right: a[j].v, id: takeLeft ? a[i].id : a[j].id, val: takeLeft ? a[i].v : a[j].v });
    out.push(takeLeft ? a[i++] : a[j++]);
  }
  while (i <= mid) { steps.push({ i, j, k: lo + out.length, cmp: false, takeLeft: true, id: a[i].id, val: a[i].v }); out.push(a[i++]); }
  while (j <= hi) { steps.push({ i, j, k: lo + out.length, cmp: false, takeLeft: false, id: a[j].id, val: a[j].v }); out.push(a[j++]); }
  const final = a.map((c) => ({ ...c }));
  out.forEach((c, t) => { final[lo + t] = { ...c }; });
  return { lo, mid, hi, start: cells.map((c) => ({ ...c })), steps, out, final, comparisons: steps.filter((s) => s.cmp).length };
}

// Every merge a full top-down merge sort makes, in the order it makes them.
export function mergeSortCalls(vals) {
  let cells = tag(vals);
  const calls = [];
  const go = (lo, hi, depth, path) => {
    if (lo >= hi) return;
    const mid = Math.floor((lo + hi) / 2);
    go(lo, mid, depth + 1, [...path, `mergeSort(${lo}, ${mid})`]);
    go(mid + 1, hi, depth + 1, [...path, `mergeSort(${mid + 1}, ${hi})`]);
    const tr = mergeTrace(cells, lo, mid, hi);
    calls.push({ ...tr, depth, path });
    cells = tr.final;
  };
  go(0, vals.length - 1, 0, [`mergeSort(0, ${vals.length - 1})`]);
  return { calls, sorted: cells.map((c) => c.v) };
}

// An array whose two halves are each already sorted: exactly what merge() receives.
export function halvesArray(rnd, nL, nR) {
  const v = randomArray(rnd, nL + nR);
  return [...v.slice(0, nL).sort((x, y) => x - y), ...v.slice(nL).sort((x, y) => x - y)];
}

export const MERGE_STEP_ARRAYS = [[2, 5, 8, 1, 3, 9], [1, 4, 6, 7, 2, 3, 5, 8], [3, 3, 7, 9, 1, 3, 4, 10]];
export const MERGE_FULL_ARRAY = [5, 2, 8, 1, 9, 3, 7, 4];

const whole = (v) => { const mid = Math.floor((v.length - 1) / 2); return mergeTrace(tag(v), 0, mid, v.length - 1); };

// Rounds for each mode. A round is one merge(lo, mid, hi) call.
//  stepwise: the player answers every comparison
//  target:   the player clicks where one highlighted value lands
export function mergeRounds(mode, rnd) {
  if (mode === "merge-step") return MERGE_STEP_ARRAYS.map((v) => ({ ...whole(v), stepwise: true, path: [] }));
  if (mode === "merge-full") return mergeSortCalls(MERGE_FULL_ARRAY).calls.map((c) => ({ ...c, stepwise: true }));
  if (mode === "merge-full-rand") return mergeSortCalls(randomArray(rnd, 8)).calls.map((c) => ({ ...c, stepwise: true }));
  // merge-land: random halves, pick one value and ask where it lands
  return Array.from({ length: 8 }, (_, n) => {
    const nL = 3 + Math.floor(rnd() * 2), nR = 3 + Math.floor(rnd() * 2);
    const v = halvesArray(rnd, nL, nR);
    const tr = mergeTrace(tag(v), 0, nL - 1, v.length - 1);
    // skip the first slot of each half: it's the easy case
    const pool = tr.start.map((c, k) => k).filter((k) => k !== tr.lo && k !== tr.mid + 1);
    const at = n % 3 === 0 ? tr.mid : pool[Math.floor(rnd() * pool.length)];   // every third: the left half's biggest value
    const id = tr.start[at].id;
    return { ...tr, path: [], target: { id, v: tr.start[at].v, from: at, to: tr.final.findIndex((c) => c.id === id) } };
  });
}
