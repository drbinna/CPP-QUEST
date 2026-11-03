import { useState, useEffect, useMemo } from "react";
import { rng, pointsFor, xpFor } from "./arenasim.js";
import { sortRounds } from "./sortsim.js";
import { run as runCpp } from "./cppmini.js";
import { CppEditor, CppCode } from "./cpphl.jsx";

const V = { ink: "#141924", line: "#3A4358", panel: "#242B3A", panel2: "#2C3446", text: "#E8E6DF", muted: "#9AA3B5", gold: "#F2B84B", teal: "#5FD3BC", coral: "#E86F6F", blue: "#4C9EE8" };
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const btn = (extra = {}) => ({ fontFamily: MONO, fontSize: 12.5, padding: "6px 14px", borderRadius: 6, cursor: "pointer", background: V.panel2, color: V.text, border: `1px solid ${V.line}`, ...extra });
const SLOT = 58, BOX = 50;

export const SORT_MODES = [
  ["sort-trace", "Quicksort: partition step by step"],
  ["sort-pivot", "Quicksort: where does the pivot land?"],
  ["sort-full", "Quicksort: full run (class array)"],
  ["sort-full-rand", "Quicksort: full run (random)"],
];

// ---------- the board: one row of boxes with the wall and i markers ----------
function Board({ frame, low, high, locked, pivotId, onPick, pickable, marks = {} }) {
  const n = frame.arr.length;
  const W = n * SLOT;
  const pos = {}; frame.arr.forEach((c, k) => { pos[c.id] = k; });
  const wall = frame.wall;
  const tint = (k) => {
    if (wall == null || k < low || k > high) return null;
    if (k > low && k <= wall) return "rgba(95,211,188,.16)";                  // smaller than the pivot
    if (frame.i != null && k > wall && k < frame.i) return "rgba(232,111,111,.14)"; // bigger or equal
    return null;
  };
  return (
    <div style={{ overflowX: "auto", padding: "8px 0 4px" }}>
      <div style={{ position: "relative", width: W, height: 118, margin: "0 auto" }}>
        {/* region tints and index labels, one per slot */}
        {frame.arr.map((_, k) => (
          <div key={"s" + k} style={{ position: "absolute", left: k * SLOT, top: 22, width: SLOT, height: BOX + 12, background: tint(k) || "transparent", borderRadius: 6 }}>
            <div style={{ position: "absolute", bottom: -24, width: "100%", textAlign: "center", fontFamily: MONO, fontSize: 11, color: k >= low && k <= high ? V.muted : "#56607a" }}>{k}</div>
          </div>
        ))}
        {/* i marker */}
        {frame.i != null && frame.i <= high && (
          <div className="cq-qs-move" style={{ position: "absolute", left: frame.i * SLOT, top: 0, width: SLOT, textAlign: "center", fontFamily: MONO, fontSize: 12, fontWeight: 700, color: V.blue }}>i {"▼"}</div>
        )}
        {/* the boxes */}
        {frame.arr.map((c) => {
          const k = pos[c.id];
          const inRange = k >= low && k <= high;
          const isLocked = locked.has(k) && !(inRange && c.id === pivotId);
          const isPivot = c.id === pivotId && !frame.pivotPlaced;
          const placed = c.id === pivotId && frame.pivotPlaced;
          const mark = marks[k];
          const border = mark === "right" ? V.teal : mark === "wrong" ? V.coral : isPivot || placed ? V.gold : isLocked ? V.teal : frame.i === k ? V.blue : V.line;
          const clickable = pickable && inRange;
          return (
            <button key={c.id} type="button" className="cq-qs-move cq-btn" disabled={!clickable}
              onClick={() => clickable && onPick(k)}
              aria-label={`index ${k}, value ${c.v}${isPivot ? ", pivot" : ""}`}
              style={{ position: "absolute", left: k * SLOT + (SLOT - BOX) / 2, top: 28, width: BOX, height: BOX, borderRadius: 8,
                border: `2px ${clickable ? "dashed" : "solid"} ${border}`, background: placed ? "rgba(242,184,75,.22)" : isPivot ? "rgba(242,184,75,.12)" : isLocked ? "rgba(95,211,188,.10)" : V.ink,
                color: inRange || isLocked ? V.text : "#5f6880", fontFamily: MONO, fontSize: 17, fontWeight: 700, cursor: clickable ? "pointer" : "default",
                opacity: inRange || isLocked ? 1 : 0.45, padding: 0 }}>
              {c.v}
            </button>
          );
        })}
        {/* the wall: a bar just right of index `wall` */}
        {wall != null && (
          <div className="cq-qs-move" style={{ position: "absolute", left: (wall + 1) * SLOT - 2, top: 20, width: 3, height: BOX + 16, background: V.gold, borderRadius: 2 }}>
            <div style={{ position: "absolute", top: -17, left: -14, fontFamily: MONO, fontSize: 10.5, color: V.gold, whiteSpace: "nowrap" }}>wall</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- code lab ----------
const LABS = {
  partition: {
    label: "partition()",
    starter: `// Partition a[low..high] around the pivot a[low].
// Return the index where the pivot ends up.
// Available: a[], swap(a[x], a[y]).
int partition(int low, int high) {
  int pivot = a[low];
  int leftwall = low;

  for (int i = low + 1; i <= high; i++) {
    // TODO: if a[i] is smaller than the pivot,
    //       move the wall right, then swap a[i] into the wall's spot
  }

  // TODO: swap the pivot (a[low]) into its final spot

  return leftwall;
}`,
    hint: "Wall first, then swap: leftwall++; swap(a[i], a[leftwall]);  and at the end swap(a[low], a[leftwall]);",
    answer: `int partition(int low, int high) {
  int pivot = a[low];
  int leftwall = low;
  for (int i = low + 1; i <= high; i++) {
    if (a[i] < pivot) {
      leftwall++;
      swap(a[i], a[leftwall]);
    }
  }
  swap(a[low], a[leftwall]);
  return leftwall;
}`,
  },
  quicksort: {
    label: "quicksort()",
    starter: `// Sort a[low..high]. partition() is already written below.
void quicksort(int low, int high) {
  // TODO: stop when the range has fewer than two elements
  // TODO: partition, then sort the left side and the right side
}

int partition(int low, int high) {
  int pivot = a[low];
  int leftwall = low;
  for (int i = low + 1; i <= high; i++) {
    if (a[i] < pivot) {
      leftwall++;
      swap(a[i], a[leftwall]);
    }
  }
  swap(a[low], a[leftwall]);
  return leftwall;
}`,
    hint: "if (low < high) { int p = partition(low, high); quicksort(low, p - 1); quicksort(p + 1, high); }",
    answer: `void quicksort(int low, int high) {
  if (low < high) {
    int p = partition(low, high);
    quicksort(low, p - 1);
    quicksort(p + 1, high);
  }
}`,
  },
};

function CodeLab({ r, onFrames, activeLine }) {
  const [which, setWhich] = useState("partition");
  const ex = LABS[which];
  const [codes, setCodes] = useState({ partition: LABS.partition.starter, quicksort: LABS.quicksort.starter });
  const code = codes[which];
  const setCode = (v) => setCodes((c) => ({ ...c, [which]: v }));
  const [status, setStatus] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  useEffect(() => { setStatus(null); onFrames(null); }, [r, which]);

  const execute = () => {
    // partition runs on this round's range; quicksort sorts the round's whole array
    const startCells = r.start;
    const vals = startCells.map((c) => c.v);
    const args = which === "partition" ? [r.low, r.high] : [0, vals.length - 1];
    let res;
    try { res = runCpp(code, { a: [...vals], count: vals.length, what: "the array", call: { name: which, args } }); }
    catch (e) { setStatus({ line: e && e.line, msg: e && e.msg ? e.msg : String(e) }); onFrames(null); return; }
    // Replay the player's swaps on the board: rebuild tagged frames by following each swap.
    let cells = startCells.map((c) => ({ ...c }));
    const frames = [{ arr: cells, line: 0 }];
    for (const t of res.trace) {
      if (t.note && t.note.kind === "swap") { cells = [...cells]; const { i, j } = t.note; [cells[i], cells[j]] = [cells[j], cells[i]]; frames.push({ arr: cells, line: t.line, swap: [i, j] }); }
    }
    if (!res.ok) { setStatus({ line: res.error.line, msg: res.error.msg }); onFrames(frames); return; }
    const want = (which === "partition" ? r.final.map((c) => c.v) : [...vals].sort((x, y) => x - y)).join(", ");
    const got = res.arr.join(", ");
    const pass = want === got;
    const swaps = frames.length - 1;
    setStatus({ pass, msg: pass
      ? `Your code produced [${got}] — that matches, with ${swaps} swap${swaps === 1 ? "" : "s"}.`
      : `Your code produced [${got}] but it should be [${want}].` });
    onFrames(frames);
  };

  const lines = code.split("\n");
  return (
    <div>
      <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap" style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted, borderBottom: `1px solid ${V.line}` }}>
        <span style={{ color: V.teal, fontWeight: 700, marginRight: 4 }}>{"⌨"} Code lab</span>
        {Object.entries(LABS).map(([k, l]) => (
          <button key={k} className="cq-btn" onClick={() => { setWhich(k); setShowAnswer(false); }} aria-pressed={which === k}
            style={btn({ padding: "3px 10px", fontSize: 12, background: which === k ? V.panel2 : "transparent", color: which === k ? V.text : V.muted, border: `1px solid ${which === k ? V.teal : V.line}` })}>{l.label}</button>
        ))}
        <div className="flex-1" />
        <button className="cq-btn" onClick={execute} style={btn({ background: V.teal, color: V.ink, fontWeight: 700 })}>Run {"▶"}</button>
        <button className="cq-btn" onClick={() => { setCode(ex.starter); setStatus(null); onFrames(null); }} style={btn()}>Reset</button>
        <button className="cq-btn" onClick={() => setShowAnswer(!showAnswer)} style={btn()}>{showAnswer ? "hide" : "stuck?"}</button>
      </div>
      <div className="px-4 pb-2 pt-3" style={{ display: "flex", fontFamily: MONO, fontSize: 12.5 }}>
        <div style={{ background: V.ink, color: "#5a6376", padding: "8px 6px", textAlign: "right", borderRadius: "6px 0 0 6px", userSelect: "none", lineHeight: "1.5" }}>
          {lines.map((_, i) => <div key={i} style={{ color: status && status.line === i + 1 && !status.pass ? V.coral : activeLine === i + 1 ? V.gold : undefined, fontWeight: activeLine === i + 1 ? 700 : 400 }}>{activeLine === i + 1 ? "▸" : ""}{i + 1}</div>)}
        </div>
        <CppEditor value={code} onChange={(e) => setCode(e.target.value)} rows={Math.max(lines.length + 1, 14)}
          background={V.ink} borderRadius="0 6px 6px 0" caretColor={V.gold}
          textStyle={{ color: V.text, padding: "8px 10px", fontFamily: MONO, fontSize: 12.5, lineHeight: "1.5" }} />
      </div>
      <div className="px-4 pb-3" style={{ fontFamily: MONO, fontSize: 12, color: V.muted }}>
        {which === "partition" ? `Runs partition(${r.low}, ${r.high}) on this round's array.` : `Runs quicksort(0, ${r.start.length - 1}) on this round's whole array.`}
      </div>
      {status && (
        <div className="px-4 pb-3" style={{ fontFamily: MONO, fontSize: 12.5, color: status.pass ? V.teal : V.coral }}>
          {status.line && !status.pass ? `line ${status.line}: ` : ""}{status.msg}
        </div>
      )}
      {showAnswer && (
        <div className="px-4 pb-3">
          <div style={{ fontFamily: MONO, fontSize: 12, color: V.muted, marginBottom: 4 }}>Hint: {ex.hint}</div>
          <CppCode code={ex.answer} style={{ background: V.ink, color: V.text, padding: 10, borderRadius: 6, fontFamily: MONO, fontSize: 12 }} />
        </div>
      )}
    </div>
  );
}

// ---------- coach text ----------
function coachFor(r, phase, k) {
  const pv = r.pivot;
  if (phase === "scan") {
    const s = r.steps[k];
    const cur = k === 0 ? r.start : r.steps[k - 1].arr;
    return { title: `Step ${k + 1}: is ${cur[s.i].v} smaller than ${pv}?`, paras: [
      `The pivot is ${pv} (the first element). The wall sits at index ${s.wallBefore}: everything from index ${r.low + 1} up to the wall is already known to be smaller than ${pv}.`,
      `i is at index ${s.i}. If A[i] < ${pv}, the wall moves right one step first, then A[i] swaps into the wall's new spot. Otherwise nothing moves and i just keeps going.`,
      "Equal values stay on the right: the test is strictly less than."] };
  }
  if (phase === "land") {
    return r.stepwise
      ? { title: "Last step: where does the pivot go?", paras: [
          `The scan is done. Everything smaller than ${pv} sits between index ${r.low + 1} and the wall.`,
          `The pivot swaps with A[leftwall], so it lands exactly at the wall. Click that box.`] }
      : { title: `Where does ${pv} land?`, paras: [
          `This call partitions indices ${r.low} to ${r.high}, with the pivot ${pv} at index ${r.low}.`,
          `The pivot ends up just after every value in the range that's smaller than it. Count how many values in the range are below ${pv} and add that to ${r.low}.`,
          "Click the index where the pivot will end up."] };
  }
  const smaller = r.p - r.low;
  return { title: "The walk", paras: [
    `${smaller} value${smaller === 1 ? " was" : "s were"} smaller than ${pv}, so the wall stopped at index ${r.p} and the pivot swapped into it.`,
    `Now ${pv} is locked in its sorted spot. Quicksort next sorts indices ${r.low}..${r.p - 1} and ${r.p + 1}..${r.high} separately${r.p - 1 <= r.low && r.p + 1 >= r.high ? " (both sides are already done here)" : ""}.`,
    "Each level of recursion scans its range once, so a good split gives O(n log n); a pivot that's always the smallest or largest gives O(n²)."] };
}

// ---------- the game ----------
export default function SortArena({ mode, best = 0, onFinish, onExit, renderChat }) {
  const rounds = useMemo(() => sortRounds(mode, rng(Date.now() % 1e9)), [mode]);
  const [round, setRound] = useState(0);
  const r = rounds[round];
  const [phase, setPhase] = useState(r.stepwise ? "scan" : "land");
  const [k, setK] = useState(0);                 // scan step
  const [scanLog, setScanLog] = useState([]);    // player's scan answers: { ok }
  const [pick, setPick] = useState(null);
  const [play, setPlay] = useState(0);           // playback frame in "done"
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [labFrames, setLabFrames] = useState(null);
  const [labIdx, setLabIdx] = useState(0);

  // Playback frames after the pivot pick
  const frames = useMemo(() => {
    const out = [];
    if (r.stepwise) out.push({ arr: r.beforeFinal, wall: r.p, i: null });
    else {
      out.push({ arr: r.start, wall: r.low, i: r.low + 1 <= r.high ? r.low + 1 : null });
      r.steps.forEach((s, j) => out.push({ arr: s.arr, wall: s.wallAfter, i: j + 1 < r.steps.length ? r.steps[j + 1].i : null, swap: s.swap }));
    }
    out.push({ arr: r.final, wall: r.p, i: null, pivotPlaced: true });
    return out;
  }, [r]);

  useEffect(() => {
    if (phase !== "done" || play >= frames.length - 1) return;
    const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setPlay((p) => p + 1), reduce ? 350 : 850);
    return () => clearTimeout(t);
  }, [phase, play, frames]);
  useEffect(() => {
    if (!labFrames || labIdx >= labFrames.length - 1) return;
    const t = setTimeout(() => setLabIdx((i) => i + 1), 450);
    return () => clearTimeout(t);
  }, [labFrames, labIdx]);

  const award = (ok) => { if (ok) { const s = streak + 1; setStreak(s); setBestStreak((b) => Math.max(b, s)); setScore((sc) => sc + pointsFor(s)); } else setStreak(0); };
  const answerScan = (saysSwap) => {
    const s = r.steps[k]; const ok = saysSwap === s.less;
    award(ok); setScanLog((l) => [...l, { ok, said: saysSwap }]);
    if (k + 1 < r.steps.length) setK(k + 1); else setPhase("land");
  };
  const choosePivot = (idx) => {
    setPick(idx); const ok = idx === r.p; award(ok);
    if (ok && scanLog.every((x) => x.ok)) setCorrect((c) => c + 1);
    setPlay(0); setPhase("done");
  };
  const next = () => {
    if (round + 1 >= rounds.length) { setFinished(true); onFinish && onFinish({ score, correct, bestStreak, xp: xpFor(correct) }); return; }
    const nr = rounds[round + 1];
    setRound(round + 1); setPhase(nr.stepwise ? "scan" : "land"); setK(0); setScanLog([]); setPick(null); setPlay(0); setLabFrames(null);
  };

  const labFrame = labFrames && labFrames.length ? labFrames[Math.min(labIdx, labFrames.length - 1)] : null;
  let frame;
  if (labFrame) frame = { arr: labFrame.arr, wall: null, i: null };
  else if (phase === "scan") frame = { arr: k === 0 ? r.start : r.steps[k - 1].arr, wall: k === 0 ? r.low : r.steps[k - 1].wallAfter, i: r.steps[k].i };
  else if (phase === "land") frame = r.stepwise ? { arr: r.beforeFinal, wall: r.p, i: null } : { arr: r.start, wall: null, i: null };
  else frame = frames[Math.min(play, frames.length - 1)];
  const pivotId = r.start[r.low].id;
  const marks = phase === "done" && pick !== null ? { [pick]: pick === r.p ? "right" : "wrong", [r.p]: "right" } : {};
  const c = coachFor(r, phase, k);
  const modeLabel = SORT_MODES.find((m) => m[0] === mode)?.[1] || mode;
  const pickRight = pick === r.p;

  if (finished) return (
    <div style={{ border: `1px solid ${V.line}`, borderRadius: 12, background: V.panel, padding: 18, fontFamily: MONO }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: V.gold }}>Quicksort round over: {score} points</div>
      <div style={{ fontSize: 13, color: V.text, marginTop: 6 }}>{correct}/{rounds.length} partitions fully right, best streak {bestStreak}, +{xpFor(correct)} xp{score > best ? ", new best" : ""}</div>
      {(mode === "sort-full" || mode === "sort-full-rand") && <div style={{ fontSize: 13, color: V.teal, marginTop: 6 }}>Sorted: [{rounds[rounds.length - 1].final.map((x) => x.v).join(", ")}]</div>}
      <div className="flex gap-2 mt-4"><button className="cq-btn" onClick={onExit} style={btn({ background: V.gold, color: V.ink, fontWeight: 700 })}>Back to modes</button></div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <style>{`.cq-qs-move { transition: left .55s cubic-bezier(.2,.8,.2,1) } @media (prefers-reduced-motion: reduce) { .cq-qs-move { transition: none } } @media (max-width: 1023px) { .cq-col { flex: none !important } }`}</style>
      <div className="cq-col" style={{ border: `1px solid ${V.gold}`, borderRadius: 12, background: V.panel, overflow: "hidden", flex: labOpen ? "1.6 1 0" : "3 1 0", minWidth: 0, width: "100%" }}>
        <div className="flex items-center gap-4 px-4 py-2.5 flex-wrap" style={{ borderBottom: `1px solid ${V.line}`, fontFamily: MONO, fontSize: 12.5 }}>
          <span style={{ color: V.muted }}>call {round + 1}/{rounds.length}</span>
          <span style={{ color: V.gold, fontWeight: 700 }}>{score} pts</span>
          <span title="streak">{"🔥"} {streak}{streak >= 3 ? " (×3)" : streak === 2 ? " (×2)" : ""}</span>
          <div className="flex-1" />
          <span style={{ color: V.muted }}>{modeLabel}</span>
          <button className="cq-btn" onClick={() => { setLabOpen(!labOpen); setLabFrames(null); }} style={btn({ padding: "3px 10px", fontSize: 11.5, background: labOpen ? V.teal : V.panel2, color: labOpen ? V.ink : V.text })}>{"⌨"} code</button>
          <button className="cq-btn" onClick={onExit} style={btn({ padding: "3px 10px", fontSize: 11.5 })}>quit</button>
        </div>

        <div className="px-4 py-3" style={{ fontFamily: MONO, fontSize: 14, color: V.text, borderBottom: `1px solid ${V.line}` }}>
          partition(A, {r.low}, {r.high}){" "}<span style={{ color: V.gold }}>pivot = A[{r.low}] = {r.pivot}</span>
          {labFrame && <span style={{ color: V.teal }}>{" "}playing your code</span>}
        </div>

        <div className="px-4">
          <Board frame={frame} low={r.low} high={r.high} locked={r.locked} pivotId={pivotId}
            pickable={!labFrame && phase === "land"} onPick={choosePivot} marks={marks} />
          <div className="flex items-center gap-4 flex-wrap pb-3" style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted }}>
            <span><span style={{ color: V.gold }}>{"■"}</span> pivot</span>
            {frame.wall != null && <span><span style={{ color: "rgba(95,211,188,.6)" }}>{"■"}</span> smaller than pivot</span>}
            {frame.wall != null && frame.i != null && <span><span style={{ color: "rgba(232,111,111,.6)" }}>{"■"}</span> bigger or equal</span>}
            {r.locked.size > 0 && <span><span style={{ color: V.teal }}>{"□"}</span> already sorted</span>}
          </div>
        </div>

        <div className="px-4 py-3" style={{ borderTop: `1px solid ${V.line}`, minHeight: 64 }}>
          {labFrame ? (
            <span style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted }}>{labFrame.swap ? `your code swapped index ${labFrame.swap[0]} and ${labFrame.swap[1]}` : "your code's starting array"}</span>
          ) : phase === "scan" ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontFamily: MONO, fontSize: 13, color: V.text }}>A[{r.steps[k].i}] = {frame.arr[r.steps[k].i].v} vs pivot {r.pivot}:</span>
              <button className="cq-btn" onClick={() => answerScan(true)} style={btn({ border: `1px solid ${V.teal}`, color: V.teal })}>Move wall + swap</button>
              <button className="cq-btn" onClick={() => answerScan(false)} style={btn()}>Leave it</button>
              {scanLog.length > 0 && (
                <span style={{ fontFamily: MONO, fontSize: 12, color: scanLog[scanLog.length - 1].ok ? V.teal : V.coral }}>
                  {scanLog[scanLog.length - 1].ok ? `✓ step ${k} right` : `✗ step ${k}: it should have been "${r.steps[k - 1].less ? "move wall + swap" : "leave it"}"`}
                </span>
              )}
            </div>
          ) : phase === "land" ? (
            <span style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted }}>Click the box where {r.pivot} ends up (dashed boxes are in this call's range).</span>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: pickRight ? V.teal : V.coral }}>
                {pickRight ? `✓ right! ${r.pivot} lands at index ${r.p}` : `✗ ${r.pivot} lands at index ${r.p}, not ${pick}`}
              </span>
              <div className="flex-1" />
              <button className="cq-btn" onClick={next} disabled={play < frames.length - 1} style={btn({ background: play < frames.length - 1 ? V.panel2 : V.gold, color: play < frames.length - 1 ? V.muted : V.ink, fontWeight: 700 })}>
                {round + 1 >= rounds.length ? "Finish" : "Next call"} {"▶"}
              </button>
            </div>
          )}
        </div>

        {/* trace table, like the one from class */}
        {(phase === "done" || (phase === "scan" && k > 0) || (phase === "land" && r.stepwise)) && !labFrame && (
          <div className="px-4 pb-4" style={{ overflowX: "auto" }}>
            <table style={{ fontFamily: MONO, fontSize: 12, color: V.text, borderCollapse: "collapse", width: "100%" }}>
              <thead><tr style={{ color: V.muted, textAlign: "left" }}>{["i", "A[i]", `< ${r.pivot}?`, "action", "array after"].map((h) => <th key={h} style={{ padding: "4px 8px", borderBottom: `1px solid ${V.line}`, fontWeight: 500 }}>{h}</th>)}</tr></thead>
              <tbody>
                {r.steps.slice(0, phase === "scan" ? k : phase === "done" && !r.stepwise ? Math.min(play, r.steps.length) : r.steps.length).map((s, j) => (
                  <tr key={j}>
                    <td style={{ padding: "4px 8px" }}>{s.i}</td>
                    <td style={{ padding: "4px 8px" }}>{s.val}</td>
                    <td style={{ padding: "4px 8px", color: s.less ? V.teal : V.muted }}>{s.less ? "yes" : "no"}</td>
                    <td style={{ padding: "4px 8px" }}>{s.less ? `wall→${s.wallAfter}${s.swap[0] !== s.swap[1] ? `, swap A[${s.swap[0]}], A[${s.swap[1]}]` : `, swap A[${s.i}] with itself`}` : "—"}</td>
                    <td style={{ padding: "4px 8px", color: V.muted }}>[{s.arr.map((x) => x.v).join(", ")}]</td>
                  </tr>
                ))}
                {phase === "done" && play >= frames.length - 1 && (
                  <tr><td colSpan={4} style={{ padding: "4px 8px", color: V.gold }}>final: swap A[{r.low}], A[{r.p}], return {r.p}</td><td style={{ padding: "4px 8px", color: V.gold }}>[{r.final.map((x) => x.v).join(", ")}]</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {labOpen && (
        <div className="cq-col" style={{ flex: "1.45 1 0", minWidth: 0, width: "100%" }}>
          <div style={{ border: `1px solid ${V.teal}`, borderRadius: 12, background: V.panel, overflow: "hidden" }}>
            <CodeLab r={r} onFrames={(f) => { setLabFrames(f); setLabIdx(0); }} activeLine={labFrame && labIdx < labFrames.length - 1 ? labFrame.line : null} />
          </div>
        </div>
      )}

      <div className="cq-col" style={{ flex: labOpen ? "1 1 0" : "2 1 0", minWidth: 0, width: "100%" }}>
        <div style={{ border: `1px solid ${V.teal}`, borderRadius: 12, background: V.panel }}>
          <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${V.line}`, fontFamily: MONO, fontSize: 13, fontWeight: 700, color: V.teal }}>{"🧠 Coach"}</div>
          <div className="px-4 py-3">
            <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: V.gold, marginBottom: 6 }}>{c.title}</div>
            {c.paras.map((p, i) => <p key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: V.text, marginBottom: 8 }}>{p}</p>)}
            <div style={{ fontFamily: MONO, fontSize: 12, color: V.muted, borderTop: `1px solid ${V.line}`, paddingTop: 8 }}>
              if (A[i] &lt; pivot) {"{"} leftwall++; swap(A[i], A[leftwall]); {"}"}
            </div>
          </div>
        </div>
        {renderChat && renderChat(() => ({
          title: `Arena — quicksort partition${labOpen ? " (code lab)" : ""}`,
          challenge: `This is the Arena quicksort game, not a coding exercise. It uses the class's "left wall" partition: pivot = A[low], leftwall = low; for i = low+1..high, if A[i] < pivot then leftwall++ and swap(A[i], A[leftwall]); finally swap(A[low], A[leftwall]) and return leftwall. Quicksort then recurses on low..p-1 and p+1..high. The player predicts each comparison (step-by-step mode) and where the pivot lands.`,
          code: `// Call: partition(A, ${r.low}, ${r.high}), pivot ${r.pivot}\n// Array before: [${r.start.map((x) => x.v).join(", ")}]\n// Array after:  [${r.final.map((x) => x.v).join(", ")}], pivot lands at ${r.p}\n// Steps: ${r.steps.map((s) => `i=${s.i} ${s.less ? "swap" : "skip"}`).join("; ")}`,
          summary: `Phase: ${phase}. Player's pivot pick: ${pick ?? "none yet"} (correct: ${r.p}). Scan answers so far: ${scanLog.map((x, j) => `step ${j + 1} ${x.ok ? "right" : "wrong"}`).join(", ") || "none"}.`,
        }))}
      </div>
    </div>
  );
}
