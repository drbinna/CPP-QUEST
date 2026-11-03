import { useState, useEffect, useMemo, useRef } from "react";
import { parentOf, scriptRounds, randomRounds, HEAP_SCRIPTS } from "./heapsim.js";
import { rng, pointsFor, xpFor } from "./arenasim.js";
import { run as runCpp } from "./cppmini.js";
import { CppEditor, CppCode } from "./cpphl.jsx";

// Same look as the AVL class-exercise mode: paper page, light-blue boxes, red marks.
const V = { ink: "#141924", line: "#3A4358", panel: "#242B3A", panel2: "#2C3446", text: "#E8E6DF", muted: "#9AA3B5", gold: "#F2B84B", teal: "#5FD3BC", coral: "#E86F6F" };
const PAPER = { bg: "#fbf9f3", node: "#cfe3ea", border: "#2b2b2b", text: "#111", line: "#2b2b2b", slot: "#8a8a8a", ok: "#2e7d32", okFill: "#d7f0d9", newFill: "#fff1a8", red: "#e53935", partner: "#bfe8dc", gone: "#e9e2e2" };
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const SERIF = 'Georgia, "Times New Roman", serif';
const W = 640, ROW = 64, TOP = 34;
const btn = (extra = {}) => ({ fontFamily: MONO, fontSize: 12.5, padding: "6px 14px", borderRadius: 6, cursor: "pointer", background: V.panel2, color: V.text, border: `1px solid ${V.line}`, ...extra });

// Position of array index i in a complete tree: level by level, left to right.
function at(i) {
  const L = Math.floor(Math.log2(i + 1)); const k = i - (2 ** L - 1);
  return { x: ((k + 0.5) * W) / 2 ** L, y: TOP + L * ROW };
}

export const HEAP_MODES = [
  ["heap-rand-insert", "Heap: random inserts"],
  ["heap-rand-extract", "Heap: random extract-max"],
  ...Object.entries(HEAP_SCRIPTS).map(([k, s]) => ["heap-" + k, "Heap: " + s.label]),
];

const RANDOM = { "heap-rand-insert": { kind: "min", mix: "insert" }, "heap-rand-extract": { kind: "max", mix: "extract" } };

// Index formulas, phrased for whichever base the player's class uses.
const formulas = (base) => base === 1
  ? { left: "2i", right: "2i + 1", parent: "i / 2 (rounded down)" }
  : { left: "2i + 1", right: "2i + 2", parent: "(i - 1) / 2" };
const parentExpr = (i, base) => (base === 1 ? `${i + base}/2` : `(${i + base}-1)/2`);

// One step of the walk, in words. Steps are index-base agnostic until here.
function stepText(s, r, base) {
  const cmp = r.kind === "min" ? "<" : ">";
  const anti = r.kind === "min" ? ">=" : "<=";
  const at1 = (k) => k + base;
  if (s.act === "place") return `${s.moved} goes in the next open spot: index ${at1(s.i)}, the count before inserting.`;
  if (s.act === "fill") return `Take ${s.removed} out of the root. The last node, ${s.moved}, fills the hole and the count drops by one.`;
  if (r.op === "insert") {
    const p = parentOf(s.i);
    return `i=${at1(s.i)}: parent is ${parentExpr(s.i, base)} = ${at1(p)}, holding ${s.parentVal}. ${s.moved} ${s.act === "swap" ? cmp : anti} ${s.parentVal}, so ${s.act === "swap" ? "swap" : "stop"}.`;
  }
  if (!s.kids.length) return `i=${at1(s.i)}: no children left, so ${s.moved} is a leaf. Done.`;
  const kids = s.kids.map((k) => `${k.v} at ${at1(k.k)}`).join(" and ");
  if (s.act === "stop") return `i=${at1(s.i)}: children are ${kids}. ${s.moved} beats both, so it stays. Done.`;
  const winner = s.kids.find((k) => k.k === s.other);
  return `i=${at1(s.i)}: children are ${kids}. ${winner.v} is the ${r.kind === "min" ? "smallest" : "largest"} of the three, so swap with index ${at1(s.other)}.`;
}

function coachFor(r, phase, base) {
  const n = r.before.length; const f = formulas(base);
  const most = r.kind === "min" ? "smallest" : "largest";
  if (phase === "land") return { title: "Step 1: where does it go?", paras: [
    "A heap is a complete tree, so there's one legal spot: the next open one, filling the bottom level left to right.",
    `In the array that spot is index = count, one past the last filled slot. Children live at ${f.left} and ${f.right}.`] };
  if (phase === "bubble") return { title: "Step 2: where does it stop?", paras: [
    `${r.value} is at the bottom now, which may break the rule that every parent is ${r.kind === "min" ? "\u2264" : "\u2265"} its children.`,
    `Compare it with its parent at ${f.parent}. If it wins, swap and repeat from there. Stop when the parent wins, or at the root.`,
    `Click where ${r.value} ends up, or "Stays put" if it won't move.`] };
  if (phase === "fill") return { title: "Step 1: who fills the root?", paras: [
    `${r.value} leaves the root, and the hole has to be filled without punching a gap in the tree.`,
    "Only one node can leave its place and keep the shape complete: the very last one in the array.",
    "Click the node that moves up into the root."] };
  if (phase === "sink") return { title: "Step 2: how far does it sink?", paras: [
    `${r.mover} is at the root but it's probably too ${r.kind === "min" ? "big" : "small"} to stay there.`,
    `Compare it with both children (${f.left} and ${f.right}) and swap with the ${most} of the three. Repeat until it beats both, or it runs out of children.`,
    `Click where ${r.mover} ends up.`] };
  return { title: "The walk", paras: [
    r.op === "insert"
      ? `${r.value} landed at index ${r.landing + base} and bubbled up to index ${r.finalIndex + base}.`
      : `${r.value} came off the root, ${r.mover} took its place and sank to index ${r.finalIndex + base}.`,
    r.op === "insert"
      ? "The loop: compare with the parent, swap if it wins, move up, stop when it loses."
      : "The loop: find the " + most + " of the parent and its two children, swap if a child wins, move down, stop when the parent wins.",
    "Either way it walks one path between a leaf and the root, so it's O(log n)."] };
}


// --- code lab -----------------------------------------------------------
// Write the function yourself and watch your own loop move the nodes.
const EXERCISES = {
  sink: {
    label: "sink / maxHeapify (bubble down)",
    fn: "sink",
    call: (r) => [0],
    starter: `// Sink a[i] down until the heap rule holds again.
// Available: a[], count, swap(a[x], a[y]).
void sink(int i) {
  int big = i;
  int l = 2 * i + 1;
  int r = 2 * i + 2;

  // TODO: if the left child exists and beats a[big], set big = l

  // TODO: same for the right child

  if (big != i) {
    swap(a[i], a[big]);
    sink(big);
  }
}`,
    hint: (kind) => `Bounds first, then compare: if (l < count && a[l] ${kind === "min" ? "<" : ">"} a[big]) big = l;`,
    answer: (kind) => `void sink(int i) {
  int big = i;
  int l = 2 * i + 1;
  int r = 2 * i + 2;
  if (l < count && a[l] ${kind === "min" ? "<" : ">"} a[big]) big = l;
  if (r < count && a[r] ${kind === "min" ? "<" : ">"} a[big]) big = r;
  if (big != i) {
    swap(a[i], a[big]);
    sink(big);
  }
}`,
  },
  bubbleUp: {
    label: "bubbleUp (after an insert)",
    fn: "bubbleUp",
    call: (r) => [r.landing],
    starter: `// Bubble a[i] up while it beats its parent.
// Available: a[], count, swap(a[x], a[y]).
void bubbleUp(int i) {

  // TODO: while i > 0 and a[i] beats its parent at (i-1)/2,
  //       swap them and move i up to the parent

}`,
    hint: (kind) => `while (i > 0 && a[i] ${kind === "min" ? "<" : ">"} a[(i-1)/2]) { ... }`,
    answer: (kind) => `void bubbleUp(int i) {
  while (i > 0 && a[i] ${kind === "min" ? "<" : ">"} a[(i-1)/2]) {
    swap(a[i], a[(i-1)/2]);
    i = (i-1)/2;
  }
}`,
  },
};

function CodeLab({ r, base, onFrames, onDone, activeLine }) {
  const ex = EXERCISES[r.op === "insert" ? "bubbleUp" : "sink"];
  const [code, setCode] = useState(ex.starter);
  const [status, setStatus] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  useEffect(() => { setCode(ex.starter); setStatus(null); setShowAnswer(false); onFrames(null); }, [r]);

  const execute = (animate) => {
    const startArr = [...r.steps[0].arr];
    let res;
    try {
      res = runCpp(code, { a: startArr, count: startArr.length, call: { name: ex.fn, args: ex.call(r) } });
    } catch (e) {
      setStatus({ bad: true, line: e && e.line, msg: e && e.msg ? e.msg : String(e) }); onFrames(null); return;
    }
    if (!res.ok) { setStatus({ bad: true, line: res.error.line, msg: res.error.msg }); onFrames(res.trace, animate); return; }
    const want = r.arr.join(",");
    const got = res.arr.join(",");
    const pass = want === got;
    setStatus({ bad: !pass, pass, msg: pass
      ? `Your code produced [${got}] \u2014 that matches. ${res.trace.filter((t) => t.note).length} swap(s).`
      : `Your code produced [${got}] but the heap should end up [${want}].` });
    onFrames(res.trace, animate);
    if (pass) onDone && onDone();
  };

  const lines = code.split("\n");
  return (
    <div>
      <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap" style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted, borderBottom: `1px solid ${V.line}` }}>
        <span style={{ color: V.teal, fontWeight: 700 }}>{"\u2328"} Code lab</span>
        <span>{ex.label}</span>
        <div className="flex-1" />
        <button className="cq-btn" onClick={() => execute(true)} style={btn({ background: V.teal, color: V.ink, fontWeight: 700 })}>Run {"\u25b6"}</button>
        <button className="cq-btn" onClick={() => { setCode(ex.starter); setStatus(null); onFrames(null); }} style={btn()}>Reset</button>
        <button className="cq-btn" onClick={() => setShowAnswer(!showAnswer)} style={btn()}>{showAnswer ? "hide" : "stuck?"}</button>
      </div>
      <div className="px-4 pb-2 pt-3" style={{ display: "flex", gap: 0, fontFamily: MONO, fontSize: 12.5 }}>
        <div style={{ background: V.ink, color: "#5a6376", padding: "8px 6px", textAlign: "right", borderRadius: "6px 0 0 6px", userSelect: "none", lineHeight: "1.5" }}>
          {lines.map((_, i) => <div key={i} style={{ color: status && status.line === i + 1 ? V.coral : activeLine === i + 1 ? V.gold : undefined, fontWeight: activeLine === i + 1 ? 700 : 400 }}>{activeLine === i + 1 ? "\u25b8" : ""}{i + 1}</div>)}
        </div>
        <CppEditor value={code} onChange={(e) => setCode(e.target.value)} rows={Math.max(lines.length + 1, 14)}
          background={V.ink} borderRadius="0 6px 6px 0" caretColor={V.gold}
          textStyle={{ color: V.text, padding: "8px 10px", fontFamily: MONO, fontSize: 12.5, lineHeight: "1.5" }} />
      </div>
      {status && (
        <div className="px-4 pb-3" style={{ fontFamily: MONO, fontSize: 12.5, color: status.pass ? V.teal : V.coral }}>
          {status.line ? `line ${status.line}: ` : ""}{status.msg}
        </div>
      )}
      {showAnswer && (
        <div className="px-4 pb-3">
          <div style={{ fontFamily: MONO, fontSize: 12, color: V.muted, marginBottom: 4 }}>Hint: {ex.hint(r.kind)}</div>
          <CppCode code={ex.answer(r.kind)} style={{ background: V.ink, color: V.text, padding: 10, borderRadius: 6, fontFamily: MONO, fontSize: 12 }} />
        </div>
      )}
    </div>
  );
}

export default function HeapArena({ mode, best = 0, onFinish, onExit, renderChat }) {
  const rand = useRef(rng(Date.now() % 1e9));
  const rounds = useMemo(() => {
    const cfg = RANDOM[mode];
    return cfg ? randomRounds(rand.current, 6, cfg.kind, cfg.mix) : scriptRounds(mode.replace(/^heap-/, ""));
  }, [mode]);
  const [round, setRound] = useState(0);
  const r = rounds[round];
  const [phase, setPhase] = useState(r.op === "insert" ? "land" : "fill");
  const [pick1, setPick1] = useState(null);
  const [pick2, setPick2] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [step, setStep] = useState(0);
  const [base, setBase] = useState(r.kind === "max" ? 1 : 0);   // textbook heaps are 1-indexed
  const [labOpen, setLabOpen] = useState(false);
  const [labTrace, setLabTrace] = useState(null);   // frames from the player's own code
  const [labIdx, setLabIdx] = useState(0);
  const [finished, setFinished] = useState(false);

  const answer1 = r.op === "insert" ? r.landing : r.moverIndex;
  const answer2 = r.finalIndex;

  // After both picks, play the swaps one at a time.
  useEffect(() => {
    if (phase !== "done" || step >= r.steps.length - 1) return;
    const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setStep((s) => s + 1), reduce ? 400 : 950);
    return () => clearTimeout(t);
  }, [phase, step, r]);

  useEffect(() => {
    if (!labTrace || labIdx >= labTrace.length - 1) return;
    const t = setTimeout(() => setLabIdx((i) => i + 1), 130);
    return () => clearTimeout(t);
  }, [labTrace, labIdx]);
  const takeFrames = (frames) => { setLabTrace(frames); setLabIdx(0); };

  const award = (ok) => { if (ok) { const s = streak + 1; setStreak(s); setBestStreak((b) => Math.max(b, s)); setScore((sc) => sc + pointsFor(s)); } else setStreak(0); };
  const choose1 = (idx) => { setPick1(idx); award(idx === answer1); setPhase(r.op === "insert" ? "bubble" : "sink"); };
  const choose2 = (idx) => { setPick2(idx); const ok = idx === answer2; award(ok); if (ok && pick1 === answer1) setCorrect((c) => c + 1); setStep(0); setPhase("done"); };
  const next = () => {
    if (round + 1 >= rounds.length) { setFinished(true); onFinish && onFinish({ score, correct, bestStreak, xp: xpFor(correct) }); return; }
    const nr = rounds[round + 1];
    setRound(round + 1); setPhase(nr.op === "insert" ? "land" : "fill"); setPick1(null); setPick2(null); setStep(0);
  };

  // What the board shows in each phase
  const labFrame = labTrace && labTrace.length ? labTrace[Math.min(labIdx, labTrace.length - 1)] : null;
  const first = !labFrame && (phase === "land" || phase === "fill");
  const arr = labFrame ? labFrame.arr : first ? r.before : phase === "done" ? r.steps[step].arr : r.steps[0].arr;
  const cur = labFrame && labFrame.note ? { i: labFrame.note.i, other: labFrame.note.j } : phase === "done" ? r.steps[step] : null;
  const live = !!(labFrame ? labFrame.note : phase === "done" && step < r.steps.length - 1);
  const maxIdx = Math.max(...(phase === "land" ? r.slots : [arr.length - 1]));
  const H = TOP + (Math.floor(Math.log2(maxIdx + 1)) + 1) * ROW;
  const f = formulas(base);

  // Which nodes can be clicked, and the ancestor/descendant hint boxes
  const hint = new Set();
  if (phase === "bubble") { let i = r.landing; while (i > 0) { i = parentOf(i); hint.add(i); } }
  const clickable = (i) => (phase === "fill" ? true : phase === "sink" ? true : false);
  let c = coachFor(r, phase, base);
  if (labOpen) {
    const cmp = r.kind === "min" ? "<" : ">";
    c = r.op === "insert"
      ? { title: "Write bubbleUp yourself", paras: [
          `The value sits at index ${r.landing + base} and has to climb while it beats its parent.`,
          `Three moving parts: the test (i > 0 && a[i] ${cmp} a[(i-1)/2]), the swap, and moving i up to the parent so the next pass compares the right pair.`,
          "Run it and the nodes above move on your code's swaps. If the array doesn't match the reference, the message says what you produced."] }
      : { title: "Write sink yourself", paras: [
          "Find the " + (r.kind === "min" ? "smallest" : "largest") + " of three: the parent and its two children. Only swap if a child wins.",
          `Each child needs two tests joined by &&: does it exist (l < count), and does it beat the current best (a[l] ${cmp} a[big])? The bounds test must come first, or you'll read past the end — the lab will tell you if you do.`,
          "After the swap, keep going from the spot the value moved to. That's what sink(big) does."] };
  }
  const bothRight = pick1 === answer1 && pick2 === answer2;

  if (finished) return (
    <div style={{ border: `1px solid ${V.line}`, borderRadius: 12, background: V.panel, padding: 18, fontFamily: MONO }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: V.gold }}>Heap round over: {score} points</div>
      <div style={{ fontSize: 13, color: V.text, marginTop: 6 }}>{correct}/{rounds.length} fully right, best streak {bestStreak}, +{xpFor(correct)} xp{score > best ? ", new best" : ""}</div>
      <div className="flex gap-2 mt-4"><button className="cq-btn" onClick={onExit} style={btn({ background: V.gold, color: V.ink, fontWeight: 700 })}>Back to modes</button></div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <style>{`.cq-hp-node { transition: transform .7s cubic-bezier(.2,.8,.2,1) } @media (prefers-reduced-motion: reduce) { .cq-hp-node { transition: none } } @media (max-width: 1023px) { .cq-col { flex: none !important } }`}</style>
      <div className="cq-col" style={{ border: `1px solid ${V.gold}`, borderRadius: 12, background: V.panel, overflow: "hidden", flex: labOpen ? "1.75 1 0" : "3 1 0", minWidth: 0, width: "100%" }}>
        <div className="flex items-center gap-4 px-4 py-2.5 flex-wrap" style={{ borderBottom: `1px solid ${V.line}`, fontFamily: MONO, fontSize: 12.5 }}>
          <span style={{ color: V.muted }}>move {round + 1}/{rounds.length}</span>
          <span style={{ color: V.gold, fontWeight: 700 }}>{score} pts</span>
          <span title="streak">{"\ud83d\udd25"} {streak}{streak >= 3 ? " (\u00d73)" : streak === 2 ? " (\u00d72)" : ""}</span>
          <div className="flex-1" />
          <label style={{ color: V.muted, cursor: "pointer" }}><input type="checkbox" checked={base === 1} onChange={(e) => setBase(e.target.checked ? 1 : 0)} style={{ marginRight: 5 }} />root at index 1</label>
          <button className="cq-btn" onClick={() => { setLabOpen(!labOpen); setLabTrace(null); }} style={btn({ padding: "3px 10px", fontSize: 11.5, background: labOpen ? V.teal : V.panel2, color: labOpen ? V.ink : V.text })}>{"\u2328"} code lab</button>
          <button className="cq-btn" onClick={onExit} style={btn({ padding: "3px 10px", fontSize: 11.5 })}>quit</button>
        </div>
        <div style={{ background: PAPER.bg, color: PAPER.text, fontFamily: SERIF, padding: "12px 18px", borderBottom: `1px solid ${V.line}`, fontSize: 15 }}>
          <b>{r.kind === "min" ? "Min" : "Max"} heap:</b>{" "}
          {rounds.map((x, k) => <span key={k} style={{ fontWeight: k === round ? 700 : 400, color: k > round ? "#888" : PAPER.text, background: k === round ? PAPER.newFill : "transparent", textDecoration: k === round ? "underline" : "none", padding: k === round ? "0 3px" : 0 }}>{x.op === "insert" ? "insert " + x.value : "extract-" + (x.kind === "min" ? "min" : "max")}{k < rounds.length - 1 ? ", " : ""}</span>)}
        </div>
        <div className="px-4 py-3" style={{ fontFamily: MONO, fontSize: 14, color: V.text, borderBottom: `1px solid ${V.line}` }}>
          {r.op === "insert" ? `Insert ${r.value}` : `Extract-${r.kind === "min" ? "min" : "max"}: ${r.value} comes off the root`}
          {phase === "land" ? " \u2014 step 1: click where it lands" : phase === "bubble" ? " \u2014 step 2: click where it stops bubbling up" : phase === "fill" ? " \u2014 step 1: click the node that moves up to fill the root" : phase === "sink" ? ` \u2014 step 2: click where ${r.mover} stops sinking` : ""}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", display: "block", background: PAPER.bg, maxHeight: labOpen ? 340 : undefined }} role="img" aria-label="Heap as a tree">
          {arr.map((_, i) => i > 0 && <line key={"e" + i} x1={at(parentOf(i)).x} y1={at(parentOf(i)).y} x2={at(i).x} y2={at(i).y} stroke={PAPER.line} strokeWidth="1.5" />)}
          {phase === "land" && r.slots.map((s) => { const p = at(s), q = at(parentOf(s)); return (
            <g key={"s" + s} className="cq-btn" onClick={() => choose1(s)} style={{ cursor: "pointer" }} role="button" aria-label={`empty spot at index ${s + base}`}>
              {s > 0 && <line x1={q.x} y1={q.y} x2={p.x} y2={p.y} stroke={PAPER.slot} strokeWidth="1.5" strokeDasharray="4 4" />}
              <rect x={p.x - 17} y={p.y - 13} width="34" height="26" fill={PAPER.bg} stroke={PAPER.slot} strokeWidth="1.5" strokeDasharray="4 3" />
              <text x={p.x} y={p.y} dy="4" textAnchor="middle" fontFamily={SERIF} fontSize="12" fill={PAPER.slot}>?</text>
            </g>); })}
          {phase !== "land" && pick2 !== null && pick2 !== answer2 && <ellipse cx={at(pick2).x} cy={at(pick2).y} rx="32" ry="23" fill="none" stroke={PAPER.slot} strokeWidth="1.5" strokeDasharray="5 4" />}
          {arr.map((v, i) => {
            const p = at(i);
            const leaving = r.op === "extract" && first && i === 0;                 // root on its way out
            const isMover = !first && v === (r.op === "insert" ? r.value : r.mover);
            const isI = live && cur.i === i;
            const isPartner = live && cur.other === i;
            const stopHere = phase === "done" && step === r.steps.length - 1 && i === answer2;
            const can = (phase === "fill" || phase === "sink");
            return (
              <g key={"n" + v} className="cq-hp-node" onClick={() => can && (phase === "fill" ? choose1(i) : choose2(i))} style={{ transform: `translate(${p.x}px, ${p.y}px)`, cursor: can ? "pointer" : "default" }} role={can ? "button" : undefined} aria-label={`${v} at index ${i + base}`}>
                {hint.has(i) && <rect x="-25" y="-18" width="50" height="36" fill="none" stroke={PAPER.slot} strokeWidth="1" strokeDasharray="3 3" />}
                {stopHere && <ellipse rx="32" ry="23" fill="none" stroke={bothRight ? PAPER.ok : PAPER.red} strokeWidth="2" />}
                {leaving && <ellipse rx="32" ry="23" fill="none" stroke={PAPER.red} strokeWidth="2" />}
                <rect x="-21" y="-14" width="42" height="28" fill={leaving ? PAPER.gone : isMover ? PAPER.newFill : isPartner ? PAPER.partner : PAPER.node} stroke={isMover || isI || leaving ? PAPER.red : PAPER.border} strokeWidth={isMover || leaving ? 2 : 1} />
                <text textAnchor="middle" dy="5" fill={PAPER.text} fontFamily={SERIF} fontSize={v >= 1000 ? 13 : 15} textDecoration={leaving ? "line-through" : "none"}>{v}</text>
                <text y="25" textAnchor="middle" fontFamily={SERIF} fontSize="9.5" fill="#777">[{i + base}]</text>
              </g>);
          })}
        </svg>

        {/* The same heap as the array it really is */}
        <div className="px-4 py-3" style={{ background: PAPER.bg, borderTop: "1px solid #ddd", overflowX: "auto" }}>
          <div style={{ fontFamily: SERIF, fontSize: 12, color: "#555", marginBottom: 6 }}>
            The same heap stored as an array (no pointers) &nbsp;&nbsp; count = {arr.length}
            {live && cur.other !== null ? ` \u2014 comparing [${cur.i + base}] with [${cur.other + base}]` : ""}
          </div>
          <div className="flex" style={{ gap: 3 }}>
            {arr.map((v, i) => {
              const hot = (!first && v === (r.op === "insert" ? r.value : r.mover)) || (live && cur.i === i);
              const warm = live && cur.other === i;
              return (
                <div key={i} style={{ textAlign: "center", flex: "0 0 auto" }}>
                  <div style={{ minWidth: 38, padding: "4px", fontFamily: SERIF, fontSize: 14, color: PAPER.text, background: hot ? PAPER.newFill : warm ? PAPER.partner : PAPER.node, border: `${hot ? 2 : 1}px solid ${hot ? PAPER.red : PAPER.border}`, transition: "background .3s" }}>{v}</div>
                  <div style={{ fontFamily: SERIF, fontSize: 10, color: "#777", marginTop: 2 }}>{i + base}</div>
                </div>);
            })}
            {r.op === "extract" && !first && (
              <div style={{ textAlign: "center", flex: "0 0 auto", marginLeft: 8 }}>
                <div style={{ minWidth: 38, padding: "4px", fontFamily: SERIF, fontSize: 14, color: "#999", background: PAPER.gone, border: "1px dashed #bbb" }}>{r.before[r.before.length - 1]}</div>
                <div style={{ fontFamily: SERIF, fontSize: 10, color: "#999", marginTop: 2 }}>out</div>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3" style={{ borderTop: `1px solid ${V.line}`, minHeight: 70 }}>
          {phase === "bubble" && (
            <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 8 }}>
              <span style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted }}>Dashed boxes are {r.value}'s ancestors. Click where it stops, or:</span>
              <button className="cq-btn" onClick={() => choose2(r.landing)} style={btn()}>Stays put</button>
            </div>
          )}
          {phase === "sink" && (
            <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 8 }}>
              <span style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted }}>Click the box {r.mover} sinks to, or:</span>
              <button className="cq-btn" onClick={() => choose2(0)} style={btn()}>Stays at the root</button>
            </div>
          )}
          {phase === "done" ? (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: bothRight ? V.teal : V.coral }}>{bothRight ? `\u2713 right! +${pointsFor(streak)}` : "\u2717 not quite \u2014 watch it play out:"}</div>
              {r.steps.slice(0, step + 1).map((s, i) => <div key={i} style={{ fontSize: 12.5, color: V.text, marginTop: 3, fontFamily: MONO }}>{stepText(s, r, base)}</div>)}
            </div>
          ) : first && <div style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted }}>{r.op === "insert" ? "Dashed boxes are empty spots. Only one keeps the tree complete." : "The tree has to stay complete, so only one node can leave its spot."}</div>}
        </div>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: `1px solid ${V.line}` }}>
          <button className="cq-btn" onClick={next} disabled={phase !== "done"} style={btn({ background: phase === "done" ? V.gold : V.panel2, color: phase === "done" ? V.ink : V.muted, fontWeight: 700 })}>{round + 1 >= rounds.length ? "Finish" : "Next \u25b6"}</button>
          {phase === "done" && r.steps.length > 1 && <button className="cq-btn" onClick={() => setStep(0)} style={btn()}>{"\u21ba"} Replay</button>}
        </div>
      </div>

      {labOpen && (
        <div className="cq-col" style={{ flex: "1.45 1 0", minWidth: 0, width: "100%" }}>
          <div style={{ border: `1px solid ${V.teal}`, borderRadius: 12, background: V.panel, overflow: "hidden" }}>
            <CodeLab r={r} base={base} onFrames={takeFrames} onDone={() => {}} activeLine={labFrame && labIdx < labTrace.length - 1 ? labFrame.line : null} />
          </div>
        </div>
      )}

      <div className="cq-col" style={{ flex: labOpen ? "1 1 0" : "2 1 0", minWidth: 0, width: "100%" }}>
        <div style={{ border: `1px solid ${V.teal}`, borderRadius: 12, background: V.panel }}>
          <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${V.line}`, fontFamily: MONO, fontSize: 13, fontWeight: 700, color: V.teal }}>{"\ud83e\udde0 Coach"}</div>
          <div className="px-4 py-3">
            <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: V.gold, marginBottom: 6 }}>{c.title}</div>
            {c.paras.map((p, i) => <p key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: V.text, marginBottom: 8 }}>{p}</p>)}
            <div style={{ fontFamily: MONO, fontSize: 12, color: V.muted, borderTop: `1px solid ${V.line}`, paddingTop: 8 }}>
              left = {f.left}{"\u2003"}right = {f.right}{"\u2003"}parent = {f.parent}
            </div>
          </div>
        </div>
        {renderChat && renderChat(() => ({
          title: `Tree Arena \u2014 heap ${r.op}${labOpen ? " (code lab)" : ""}`,
          challenge: `This is the Tree Arena heap game (${r.kind} heap ${r.op === "insert" ? "insert / bubble up" : "extract / bubble down"} practice), not a coding exercise. The player has indices labelled from ${base}. Children of i are ${f.left} and ${f.right}; parent is ${f.parent}. Current move: ${r.op === "insert" ? "insert " + r.value : "extract the root, " + r.value}. Phase: ${phase}.`,
          code: `// Heap before this move: [${r.before.join(", ")}]\n// After the ${r.op === "insert" ? "value is placed at the end" : "last node fills the root and the count drops"}: [${r.steps[0].arr.join(", ")}]${phase === "done" ? `\n// Final: [${r.arr.join(", ")}]` : ""}`,
          summary: `Player's picks: ${pick1 !== null ? "step 1 = index " + (pick1 + base) : "none yet"}${pick2 !== null ? ", step 2 = index " + (pick2 + base) : ""}. Correct: step 1 = ${answer1 + base}, step 2 = ${answer2 + base}. Walk: ${r.steps.map((s) => stepText(s, r, base)).join(" ")}`,
        }))}
      </div>
    </div>
  );
}
