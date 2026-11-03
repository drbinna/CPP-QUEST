import { useState, useEffect, useMemo } from "react";
import { rng, pointsFor, xpFor } from "./arenasim.js";
import { mergeRounds } from "./mergesim.js";
import { run as runCpp } from "./cppmini.js";
import { CppEditor, CppCode } from "./cpphl.jsx";

const V = { ink: "#141924", line: "#3A4358", panel: "#242B3A", panel2: "#2C3446", text: "#E8E6DF", muted: "#9AA3B5", gold: "#F2B84B", teal: "#5FD3BC", coral: "#E86F6F", blue: "#4C9EE8" };
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const btn = (extra = {}) => ({ fontFamily: MONO, fontSize: 12.5, padding: "6px 14px", borderRadius: 6, cursor: "pointer", background: V.panel2, color: V.text, border: `1px solid ${V.line}`, ...extra });
const SLOT = 58, BOX = 50, GUT = 58;           // GUT: room on the left for the row labels
const TOP_Y = 30, TEMP_Y = 30 + BOX + 50;

export const MERGE_MODES = [
  ["merge-step", "Merge sort: merge step by step"],
  ["merge-land", "Merge sort: where does it land?"],
  ["merge-full", "Merge sort: full run (class array)"],
  ["merge-full-rand", "Merge sort: full run (random)"],
];

// The board state before step s of a merge (s = steps.length means every value is in temp).
function frameAt(r, s) {
  const st = r.steps[s];
  return { arr: r.start, placed: r.steps.slice(0, s).map((x) => x.id), i: st ? st.i : r.mid + 1, j: st ? st.j : r.hi + 1, k: r.lo + s, cmp: st && st.cmp };
}
const copiedFrame = (r) => ({ arr: r.final, placed: [], i: null, j: null, k: null, copied: true });

// ---------- the board: a[] on top, temp[] underneath ----------
function Board({ r, frame, targetId, pickable, onPick, marks = {} }) {
  const n = frame.arr.length;
  const W = GUT + n * SLOT;
  const { lo, mid, hi } = r;
  const inRange = (k) => k >= lo && k <= hi;
  const pos = {}; frame.arr.forEach((c, k) => { pos[c.id] = k; });
  const tempSlot = {}; frame.placed.forEach((id, t) => { tempSlot[id] = lo + t; });
  const merging = !frame.copied;
  return (
    <div style={{ overflowX: "auto", padding: "6px 0 4px" }}>
      <div style={{ position: "relative", width: W, height: TEMP_Y + BOX + 30, margin: "0 auto" }}>
        <div style={{ position: "absolute", left: 0, top: TOP_Y + BOX / 2 - 8, fontFamily: MONO, fontSize: 12, color: V.muted }}>a[]</div>
        <div style={{ position: "absolute", left: 0, top: TEMP_Y + BOX / 2 - 8, fontFamily: MONO, fontSize: 12, color: merging ? V.muted : "#56607a" }}>temp[]</div>
        {/* half tints + index labels on the top row */}
        {frame.arr.map((_, k) => (
          <div key={"s" + k} style={{ position: "absolute", left: GUT + k * SLOT, top: TOP_Y - 6, width: SLOT, height: BOX + 12, borderRadius: 6,
            background: merging && inRange(k) ? (k <= mid ? "rgba(95,211,188,.13)" : "rgba(76,158,232,.14)") : "transparent" }}>
            <div style={{ position: "absolute", top: BOX + 13, width: "100%", textAlign: "center", fontFamily: MONO, fontSize: 11, color: inRange(k) ? V.muted : "#56607a" }}>{k}</div>
          </div>
        ))}
        {/* empty temp slots for this call's range */}
        {frame.arr.map((_, k) => inRange(k) && (
          <div key={"t" + k} style={{ position: "absolute", left: GUT + k * SLOT + (SLOT - BOX) / 2, top: TEMP_Y, width: BOX, height: BOX, borderRadius: 8,
            border: `1.5px dashed ${merging && frame.k === k ? V.gold : "#465069"}`, opacity: merging ? 1 : 0.35 }} />
        ))}
        {/* the split between the two halves */}
        {merging && (
          <div style={{ position: "absolute", left: GUT + (mid + 1) * SLOT - 1, top: TOP_Y - 10, width: 2, height: BOX + 20, background: V.gold, borderRadius: 1, opacity: 0.8 }}>
            <div style={{ position: "absolute", top: -15, left: -11, fontFamily: MONO, fontSize: 10.5, color: V.gold }}>mid</div>
          </div>
        )}
        {/* fingers */}
        {merging && frame.i != null && frame.i <= mid && (
          <div className="cq-ms-move" style={{ position: "absolute", left: GUT + frame.i * SLOT, top: 2, width: SLOT, textAlign: "center", fontFamily: MONO, fontSize: 12, fontWeight: 700, color: V.teal }}>i {"▼"}</div>
        )}
        {merging && frame.j != null && frame.j <= hi && (
          <div className="cq-ms-move" style={{ position: "absolute", left: GUT + frame.j * SLOT, top: 2, width: SLOT, textAlign: "center", fontFamily: MONO, fontSize: 12, fontWeight: 700, color: V.blue }}>j {"▼"}</div>
        )}
        {merging && frame.k != null && frame.k <= hi && (
          <div className="cq-ms-move" style={{ position: "absolute", left: GUT + frame.k * SLOT, top: TEMP_Y + BOX + 4, width: SLOT, textAlign: "center", fontFamily: MONO, fontSize: 12, fontWeight: 700, color: V.gold }}>{"▲"} k</div>
        )}
        {/* the values */}
        {frame.arr.map((c) => {
          const k = pos[c.id];
          const inTemp = c.id in tempSlot;
          const slot = inTemp ? tempSlot[c.id] : k;
          const y = inTemp ? TEMP_Y : TOP_Y;
          const live = inRange(k);
          const comparing = merging && frame.cmp && !inTemp && (k === frame.i || k === frame.j);
          const isTarget = c.id === targetId;
          const mark = !inTemp ? marks[k] : null;
          const border = mark === "right" ? V.teal : mark === "wrong" ? V.coral : isTarget ? V.gold : comparing ? (k <= mid ? V.teal : V.blue) : V.line;
          const clickable = pickable && live && !inTemp;
          return (
            <button key={c.id} type="button" className="cq-ms-move cq-btn" disabled={!clickable}
              onClick={() => clickable && onPick(k)}
              aria-label={`${inTemp ? "temp" : "a"} index ${slot}, value ${c.v}${isTarget ? ", the value to place" : ""}`}
              style={{ position: "absolute", left: GUT + slot * SLOT + (SLOT - BOX) / 2, top: y, width: BOX, height: BOX, borderRadius: 8,
                border: `2px ${clickable ? "dashed" : "solid"} ${border}`,
                background: isTarget ? "rgba(242,184,75,.16)" : inTemp ? "rgba(242,184,75,.08)" : comparing ? V.panel2 : V.ink,
                color: live ? V.text : "#5f6880", opacity: live ? 1 : 0.45, fontFamily: MONO, fontSize: 17, fontWeight: 700,
                cursor: clickable ? "pointer" : "default", padding: 0 }}>
              {c.v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Plain two-row view used while the player's own code is replaying.
function LabBoard({ f }) {
  const row = (label, vals, hlArr) => (
    <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
      <span style={{ width: 52, fontFamily: MONO, fontSize: 12, color: V.muted }}>{label}</span>
      {vals.map((v, k) => {
        const hl = f.hl && f.hl.arr === hlArr && f.hl.i === k;
        return <div key={k} style={{ width: 40, height: 40, borderRadius: 7, display: "grid", placeItems: "center", fontFamily: MONO, fontSize: 15, fontWeight: 700,
          border: `2px ${v == null ? "dashed" : "solid"} ${hl ? V.gold : v == null ? "#465069" : V.line}`, background: hl ? "rgba(242,184,75,.18)" : V.ink, color: V.text }}>{v ?? ""}</div>;
      })}
    </div>
  );
  return (
    <div style={{ overflowX: "auto", padding: "14px 0 6px" }}>
      {row("a[]", f.a, "a")}
      {row("temp[]", f.temp, "temp")}
    </div>
  );
}

// ---------- code lab ----------
const MERGE_ANSWER = `void merge(int lo, int mid, int hi) {
  int i = lo;
  int j = mid + 1;
  int k = lo;
  while (i <= mid && j <= hi) {
    if (a[i] <= a[j]) {
      temp[k] = a[i];
      i++;
    } else {
      temp[k] = a[j];
      j++;
    }
    k++;
  }
  while (i <= mid) { temp[k] = a[i]; i++; k++; }
  while (j <= hi)  { temp[k] = a[j]; j++; k++; }
  for (int x = lo; x <= hi; x++) {
    a[x] = temp[x];
  }
}`;
const LABS = {
  merge: {
    label: "merge()",
    starter: `// a[lo..mid] and a[mid+1..hi] are each sorted already.
// Merge them so a[lo..hi] is sorted.
// Available: a[], and temp[], a scratch array the same size as a[].
void merge(int lo, int mid, int hi) {
  int i = lo;        // finger in the left half
  int j = mid + 1;   // finger in the right half
  int k = lo;        // next free slot in temp

  while (i <= mid && j <= hi) {
    // TODO: copy the smaller of a[i] and a[j] into temp[k]
    //       (ties go left), then move that finger and k forward
  }

  // TODO: one half ran out. Copy whatever is left in the other.

  // TODO: copy temp[lo..hi] back into a[lo..hi]
}`,
    hint: "if (a[i] <= a[j]) { temp[k] = a[i]; i++; } else { temp[k] = a[j]; j++; } k++;  then two leftover loops, then a[x] = temp[x] for x = lo..hi",
    answer: MERGE_ANSWER,
  },
  mergeSort: {
    label: "mergeSort()",
    starter: `// Sort a[lo..hi]. merge() is already written below.
void mergeSort(int lo, int hi) {
  // TODO: stop when the range has fewer than two elements
  // TODO: find mid, sort the left half, sort the right half, merge them
}

${MERGE_ANSWER}`,
    hint: "if (lo < hi) { int mid = (lo + hi) / 2; mergeSort(lo, mid); mergeSort(mid + 1, hi); merge(lo, mid, hi); }",
    answer: `void mergeSort(int lo, int hi) {
  if (lo < hi) {
    int mid = (lo + hi) / 2;
    mergeSort(lo, mid);
    mergeSort(mid + 1, hi);
    merge(lo, mid, hi);
  }
}`,
  },
};

function CodeLab({ r, onFrames, activeLine }) {
  const [which, setWhich] = useState("merge");
  const ex = LABS[which];
  const [codes, setCodes] = useState({ merge: LABS.merge.starter, mergeSort: LABS.mergeSort.starter });
  const code = codes[which];
  const setCode = (v) => setCodes((c) => ({ ...c, [which]: v }));
  const [status, setStatus] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  useEffect(() => { setStatus(null); onFrames(null); }, [r, which]);

  const execute = () => {
    const vals = r.start.map((c) => c.v);
    const n = vals.length;
    const args = which === "merge" ? [r.lo, r.mid, r.hi] : [0, n - 1];
    let res;
    try { res = runCpp(code, { a: [...vals], count: n, temp: new Array(n).fill(0), trackWrites: true, maxSteps: 8000, what: "the array", call: { name: which, args } }); }
    catch (e) { setStatus({ line: e && e.line, msg: e && e.msg ? e.msg : String(e) }); onFrames(null); return; }
    // Replay every write the player's code made to a[] or temp[].
    let a = [...vals], temp = new Array(n).fill(null);
    const frames = [{ a, temp, line: 0 }];
    let writes = 0;
    for (const t of res.trace) {
      const nt = t.note;
      if (!nt) continue;
      if (nt.kind === "swap") { a = [...a]; [a[nt.i], a[nt.j]] = [a[nt.j], a[nt.i]]; frames.push({ a, temp, line: t.line, hl: { arr: "a", i: nt.j } }); }
      if (nt.kind === "set") {
        writes++;
        if (nt.arr === "a") { a = [...a]; a[nt.i] = nt.v; } else { temp = [...temp]; if (nt.i < temp.length) temp[nt.i] = nt.v; }
        frames.push({ a, temp, line: t.line, hl: { arr: nt.arr === "a" ? "a" : "temp", i: nt.i } });
      }
    }
    if (!res.ok) { setStatus({ line: res.error.line, msg: res.error.msg }); onFrames(frames, which); return; }
    const want = (which === "merge" ? r.final.map((c) => c.v) : [...vals].sort((x, y) => x - y)).join(", ");
    const got = res.arr.join(", ");
    const pass = want === got;
    setStatus({ pass, msg: pass
      ? `Your code produced [${got}]. That matches, with ${writes} write${writes === 1 ? "" : "s"} to a[] and temp[].`
      : `Your code produced [${got}] but it should be [${want}].${which === "merge" && got === vals.join(", ") ? " Nothing changed in a[]: did you copy temp back?" : ""}` });
    onFrames(frames, which);
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
        {which === "merge" ? `Runs merge(${r.lo}, ${r.mid}, ${r.hi}) on this round's array.` : `Runs mergeSort(0, ${r.start.length - 1}) on this round's whole array.`}
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
function coachFor(r, phase, s, full) {
  const range = `a[${r.lo}..${r.mid}] and a[${r.mid + 1}..${r.hi}]`;
  if (phase === "step") {
    const st = r.steps[s];
    return { title: `temp[${st.k}]: ${st.left} or ${st.right}?`, paras: [
      full ? `The recursive calls have already sorted ${range}. This merge combines them.` : `The two halves, ${range}, are each sorted already.`,
      `Finger i points at the smallest value left in the left half (${st.left}); j points at the smallest left in the right half (${st.right}). Whichever is smaller goes into temp[k], and only that finger moves.`,
      "Ties go left (a[i] <= a[j]). That keeps merge sort stable: equal values keep their original order."] };
  }
  if (phase === "land") {
    const t = r.target;
    const fromLeft = t.from <= r.mid;
    return { title: `Where does ${t.v} land?`, paras: [
      `This merge combines ${range}. The value ${t.v} starts at index ${t.from}, in the ${fromLeft ? "left" : "right"} half.`,
      `After the merge, ${t.v} sits just after every value in the range that's smaller than it. Count those and add ${r.lo}.`,
      fromLeft ? "Equal values from the right half go after it (ties go left)." : "Equal values from the left half go before it (ties go left).",
      "Click the index in a[] where it ends up."] };
  }
  const left = r.mid - r.lo + 1, right = r.hi - r.mid;
  return { title: "The merge", paras: [
    `${r.comparisons} comparison${r.comparisons === 1 ? "" : "s"} merged ${left} + ${right} values. When one half ran out, the rest of the other half was copied straight over with no comparisons, then temp[${r.lo}..${r.hi}] was copied back into a[].`,
    full ? `Merge sort always sorts the left half completely before touching the right half, then merges. Watch the call path above: this was ${r.path[r.path.length - 1] || "the top call"}.`
         : "A merge of n values takes at most n − 1 comparisons, so it's O(n).",
    "There are about log₂ n levels of splitting and each level merges n values in total: O(n log n) in every case, plus O(n) extra space for temp."] };
}

// ---------- the game ----------
export default function MergeArena({ mode, best = 0, onFinish, onExit, renderChat }) {
  const rounds = useMemo(() => mergeRounds(mode, rng(Date.now() % 1e9)), [mode]);
  const full = mode === "merge-full" || mode === "merge-full-rand";
  const [round, setRound] = useState(0);
  const r = rounds[round];
  const [phase, setPhase] = useState(r.stepwise ? "step" : "land");
  const [s, setS] = useState(0);                   // current comparison step
  const [log, setLog] = useState([]);              // player's answers: { ok }
  const [pick, setPick] = useState(null);
  const [play, setPlay] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [labFrames, setLabFrames] = useState(null);
  const [labSpeed, setLabSpeed] = useState(400);
  const [labIdx, setLabIdx] = useState(0);

  // Playback after the last answer: the rest of the merge, then the copy back.
  const frames = useMemo(() => {
    const from = r.stepwise ? r.comparisons : 0;
    const out = [];
    for (let k = from; k <= r.steps.length; k++) out.push(frameAt(r, k));
    out.push(copiedFrame(r));
    return out;
  }, [r]);

  useEffect(() => {
    if (phase !== "done" || play >= frames.length - 1) return;
    const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setPlay((p) => p + 1), reduce ? 350 : 750);
    return () => clearTimeout(t);
  }, [phase, play, frames]);
  useEffect(() => {
    if (!labFrames || labIdx >= labFrames.length - 1) return;
    const t = setTimeout(() => setLabIdx((i) => i + 1), labSpeed);
    return () => clearTimeout(t);
  }, [labFrames, labIdx, labSpeed]);

  const award = (ok) => { if (ok) { const n = streak + 1; setStreak(n); setBestStreak((b) => Math.max(b, n)); setScore((sc) => sc + pointsFor(n)); } else setStreak(0); };
  const answerStep = (saysLeft) => {
    const st = r.steps[s]; const ok = saysLeft === st.takeLeft;
    award(ok);
    const nl = [...log, { ok }];
    setLog(nl);
    if (s + 1 < r.comparisons) setS(s + 1);
    else { if (nl.every((x) => x.ok)) setCorrect((c) => c + 1); setPlay(0); setPhase("done"); }
  };
  const chooseLanding = (idx) => {
    setPick(idx); const ok = idx === r.target.to; award(ok);
    if (ok) setCorrect((c) => c + 1);
    setPlay(0); setPhase("done");
  };
  const next = () => {
    if (round + 1 >= rounds.length) { setFinished(true); onFinish && onFinish({ score, correct, bestStreak, xp: xpFor(correct) }); return; }
    const nr = rounds[round + 1];
    setRound(round + 1); setPhase(nr.stepwise ? "step" : "land"); setS(0); setLog([]); setPick(null); setPlay(0); setLabFrames(null);
  };

  const labFrame = labFrames && labFrames.length ? labFrames[Math.min(labIdx, labFrames.length - 1)] : null;
  let frame;
  if (phase === "step") frame = frameAt(r, s);
  else if (phase === "land") frame = frameAt(r, 0);
  else frame = frames[Math.min(play, frames.length - 1)];
  const targetId = r.target ? r.target.id : null;
  const marks = phase === "done" && pick !== null && frame.copied ? { [pick]: pick === r.target.to ? "right" : "wrong", [r.target.to]: "right" } : {};
  const c = coachFor(r, phase, s, full);
  const modeLabel = MERGE_MODES.find((m) => m[0] === mode)?.[1] || mode;
  const lastLog = log.length ? log[log.length - 1] : null;
  const shownSteps = phase === "step" ? s : phase === "done" ? Math.min(r.steps.length, (r.stepwise ? r.comparisons : 0) + play) : 0;
  const tempSoFar = (upto) => r.steps.slice(0, upto).map((x) => x.val);

  if (finished) return (
    <div style={{ border: `1px solid ${V.line}`, borderRadius: 12, background: V.panel, padding: 18, fontFamily: MONO }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: V.gold }}>Merge sort round over: {score} points</div>
      <div style={{ fontSize: 13, color: V.text, marginTop: 6 }}>{correct}/{rounds.length} merges fully right, best streak {bestStreak}, +{xpFor(correct)} xp{score > best ? ", new best" : ""}</div>
      {full && <div style={{ fontSize: 13, color: V.teal, marginTop: 6 }}>Sorted: [{rounds[rounds.length - 1].final.map((x) => x.v).join(", ")}] in {rounds.reduce((t, x) => t + x.comparisons, 0)} comparisons</div>}
      <div className="flex gap-2 mt-4"><button className="cq-btn" onClick={onExit} style={btn({ background: V.gold, color: V.ink, fontWeight: 700 })}>Back to modes</button></div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <style>{`.cq-ms-move { transition: left .5s cubic-bezier(.2,.8,.2,1), top .5s cubic-bezier(.2,.8,.2,1) } @media (prefers-reduced-motion: reduce) { .cq-ms-move { transition: none } } @media (max-width: 1023px) { .cq-col { flex: none !important } }`}</style>
      <div className="cq-col" style={{ border: `1px solid ${V.gold}`, borderRadius: 12, background: V.panel, overflow: "hidden", flex: labOpen ? "1.6 1 0" : "3 1 0", minWidth: 0, width: "100%" }}>
        <div className="flex items-center gap-4 px-4 py-2.5 flex-wrap" style={{ borderBottom: `1px solid ${V.line}`, fontFamily: MONO, fontSize: 12.5 }}>
          <span style={{ color: V.muted }}>merge {round + 1}/{rounds.length}</span>
          <span style={{ color: V.gold, fontWeight: 700 }}>{score} pts</span>
          <span title="streak">{"🔥"} {streak}{streak >= 3 ? " (×3)" : streak === 2 ? " (×2)" : ""}</span>
          <div className="flex-1" />
          <span style={{ color: V.muted }}>{modeLabel}</span>
          <button className="cq-btn" onClick={() => { setLabOpen(!labOpen); setLabFrames(null); }} style={btn({ padding: "3px 10px", fontSize: 11.5, background: labOpen ? V.teal : V.panel2, color: labOpen ? V.ink : V.text })}>{"⌨"} code</button>
          <button className="cq-btn" onClick={onExit} style={btn({ padding: "3px 10px", fontSize: 11.5 })}>quit</button>
        </div>

        <div className="px-4 py-3" style={{ fontFamily: MONO, fontSize: 14, color: V.text, borderBottom: `1px solid ${V.line}` }}>
          {full && r.path.length > 0 && (
            <div style={{ fontSize: 11.5, color: V.muted, marginBottom: 4 }}>{r.path.join(" → ")}</div>
          )}
          merge(a, {r.lo}, {r.mid}, {r.hi}){" "}
          <span style={{ color: V.teal }}>[{r.start.slice(r.lo, r.mid + 1).map((x) => x.v).join(", ")}]</span>
          <span style={{ color: V.muted }}> + </span>
          <span style={{ color: V.blue }}>[{r.start.slice(r.mid + 1, r.hi + 1).map((x) => x.v).join(", ")}]</span>
          {labFrame && <span style={{ color: V.teal }}>{" "}playing your code</span>}
        </div>

        <div className="px-4">
          {labFrame ? <LabBoard f={labFrame} /> : (
            <Board r={r} frame={frame} targetId={phase === "land" || (phase === "done" && r.target) ? targetId : null}
              pickable={phase === "land"} onPick={chooseLanding} marks={marks} />
          )}
          {!labFrame && (
            <div className="flex items-center gap-4 flex-wrap pb-3" style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted }}>
              <span><span style={{ color: "rgba(95,211,188,.7)" }}>{"■"}</span> left half (i)</span>
              <span><span style={{ color: "rgba(76,158,232,.7)" }}>{"■"}</span> right half (j)</span>
              <span><span style={{ color: V.gold }}>{"□"}</span> next temp slot (k)</span>
              {r.target && <span><span style={{ color: V.gold }}>{"■"}</span> value to place</span>}
            </div>
          )}
        </div>

        <div className="px-4 py-3" style={{ borderTop: `1px solid ${V.line}`, minHeight: 64 }}>
          {labFrame ? (
            <span style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted }}>{labFrame.hl ? `your code wrote ${labFrame.hl.arr}[${labFrame.hl.i}]` : "your code's starting array"}</span>
          ) : phase === "step" ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontFamily: MONO, fontSize: 13, color: V.text }}>a[{r.steps[s].i}] = {r.steps[s].left} vs a[{r.steps[s].j}] = {r.steps[s].right} → temp[{r.steps[s].k}]:</span>
              <button className="cq-btn" onClick={() => answerStep(true)} style={btn({ border: `1px solid ${V.teal}`, color: V.teal })}>Take left ({r.steps[s].left})</button>
              <button className="cq-btn" onClick={() => answerStep(false)} style={btn({ border: `1px solid ${V.blue}`, color: V.blue })}>Take right ({r.steps[s].right})</button>
              {lastLog && (
                <span style={{ fontFamily: MONO, fontSize: 12, color: lastLog.ok ? V.teal : V.coral }}>
                  {lastLog.ok ? `✓ step ${s} right` : `✗ step ${s}: ${r.steps[s - 1].val} should have gone in (${r.steps[s - 1].takeLeft ? "left" : "right"})`}
                </span>
              )}
            </div>
          ) : phase === "land" ? (
            <span style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted }}>Click the index in a[] where {r.target.v} ends up after this merge (dashed boxes are in range).</span>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              {r.target ? (
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: pick === r.target.to ? V.teal : V.coral }}>
                  {pick === r.target.to ? `✓ right! ${r.target.v} lands at index ${r.target.to}` : `✗ ${r.target.v} lands at index ${r.target.to}, not ${pick}`}
                </span>
              ) : (
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: log.every((x) => x.ok) ? V.teal : V.coral }}>
                  {log.every((x) => x.ok) ? `✓ all ${r.comparisons} comparison${r.comparisons === 1 ? "" : "s"} right` : `${log.filter((x) => x.ok).length}/${r.comparisons} comparisons right`}
                  <span style={{ color: V.muted, fontWeight: 400 }}>{play < frames.length - 1 ? (frame.placed.length < r.steps.length ? "  copying the leftovers…" : "  copying temp back into a[]…") : ""}</span>
                </span>
              )}
              <div className="flex-1" />
              <button className="cq-btn" onClick={next} disabled={play < frames.length - 1} style={btn({ background: play < frames.length - 1 ? V.panel2 : V.gold, color: play < frames.length - 1 ? V.muted : V.ink, fontWeight: 700 })}>
                {round + 1 >= rounds.length ? "Finish" : "Next merge"} {"▶"}
              </button>
            </div>
          )}
        </div>

        {/* trace table */}
        {shownSteps > 0 && !labFrame && (
          <div className="px-4 pb-4" style={{ overflowX: "auto" }}>
            <table style={{ fontFamily: MONO, fontSize: 12, color: V.text, borderCollapse: "collapse", width: "100%" }}>
              <thead><tr style={{ color: V.muted, textAlign: "left" }}>{["k", "a[i]", "a[j]", "took", `temp[${r.lo}..k]`].map((h) => <th key={h} style={{ padding: "4px 8px", borderBottom: `1px solid ${V.line}`, fontWeight: 500 }}>{h}</th>)}</tr></thead>
              <tbody>
                {r.steps.slice(0, shownSteps).map((st, n) => (
                  <tr key={n}>
                    <td style={{ padding: "4px 8px" }}>{st.k}</td>
                    <td style={{ padding: "4px 8px", color: st.i <= r.mid ? V.teal : V.muted }}>{st.i <= r.mid ? r.start[st.i].v : "—"}</td>
                    <td style={{ padding: "4px 8px", color: st.j <= r.hi ? V.blue : V.muted }}>{st.j <= r.hi ? r.start[st.j].v : "—"}</td>
                    <td style={{ padding: "4px 8px" }}>{st.cmp ? `${st.val} (${st.takeLeft ? "left" : "right"})` : `${st.val} (leftover)`}</td>
                    <td style={{ padding: "4px 8px", color: V.muted }}>[{tempSoFar(n + 1).join(", ")}]</td>
                  </tr>
                ))}
                {phase === "done" && play >= frames.length - 1 && (
                  <tr><td colSpan={4} style={{ padding: "4px 8px", color: V.gold }}>copy temp[{r.lo}..{r.hi}] back into a[]</td><td style={{ padding: "4px 8px", color: V.gold }}>[{r.final.map((x) => x.v).join(", ")}]</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {labOpen && (
        <div className="cq-col" style={{ flex: "1.45 1 0", minWidth: 0, width: "100%" }}>
          <div style={{ border: `1px solid ${V.teal}`, borderRadius: 12, background: V.panel, overflow: "hidden" }}>
            <CodeLab r={r} onFrames={(f, which) => { setLabFrames(f); setLabIdx(0); setLabSpeed(which === "mergeSort" ? 220 : 400); }}
              activeLine={labFrame && labIdx < labFrames.length - 1 ? labFrame.line : null} />
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
              if (a[i] &lt;= a[j]) temp[k++] = a[i++]; else temp[k++] = a[j++];
            </div>
          </div>
        </div>
        {renderChat && renderChat(() => ({
          title: `Arena — merge sort${labOpen ? " (code lab)" : ""}`,
          challenge: `This is the Arena merge sort game, not a coding exercise. merge(a, lo, mid, hi) combines the sorted halves a[lo..mid] and a[mid+1..hi]: fingers i = lo, j = mid+1, k = lo; while both halves have values, copy the smaller into temp[k] (ties go left, a[i] <= a[j], which makes it stable) and advance that finger and k; copy any leftovers; then copy temp[lo..hi] back into a. mergeSort(lo, hi) returns if lo >= hi, else mid = (lo+hi)/2, mergeSort(lo, mid), mergeSort(mid+1, hi), merge(lo, mid, hi). The player ${r.target ? "predicts where one value lands after the merge" : "picks left or right at every comparison"}.`,
          code: `// Call: merge(a, ${r.lo}, ${r.mid}, ${r.hi})${r.path.length ? `  via ${r.path.join(" -> ")}` : ""}\n// Array before: [${r.start.map((x) => x.v).join(", ")}]\n// Array after:  [${r.final.map((x) => x.v).join(", ")}]\n// Order into temp: ${r.steps.map((x) => `${x.val}${x.cmp ? (x.takeLeft ? "(L)" : "(R)") : "(leftover)"}`).join(", ")}${r.target ? `\n// Question: where does ${r.target.v} (index ${r.target.from}) land? Answer: index ${r.target.to}` : ""}`,
          summary: `Phase: ${phase}. ${r.target ? `Player's pick: ${pick ?? "none yet"} (correct: ${r.target.to}).` : `Answers so far: ${log.map((x, n) => `step ${n + 1} ${x.ok ? "right" : "wrong"}`).join(", ") || "none"}.`}`,
        }))}
      </div>
    </div>
  );
}
