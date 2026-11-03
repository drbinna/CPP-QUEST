import { useState, useMemo, useRef } from "react";
import { layout } from "./bstsim.js";
import { rng, genPuzzle, pointsFor, xpFor, ROUNDS, classRounds, scriptRounds, SCRIPTS } from "./arenasim.js";
import { coach, plainInsert, plainRemove } from "./arenacoach.js";
import { useRef as useRef2, useEffect } from "react";
import HeapArena, { HEAP_MODES } from "./heaparena.jsx";
import ArenaMenu from "./arenamenu.jsx";
import SortArena, { SORT_MODES } from "./sortarena.jsx";
import MergeArena, { MERGE_MODES } from "./mergearena.jsx";
import BfsArena, { BFS_MODES } from "./bfsarena.jsx";
import DfsArena, { DFS_MODES } from "./dfsarena.jsx";
import TopoArena, { TOPO_MODES } from "./topoarena.jsx";

// Plain-text picture of a tree for the tutor: one line per node, plus the sorted order.
function describeTree(t) {
  if (!t || !t.root) return "(empty tree)";
  const lines = []; const walk = (id, depth) => { if (!id) return; const n = t.nodes[id]; const L = n.left ? t.nodes[n.left].val : "-", R = n.right ? t.nodes[n.right].val : "-"; lines.push(`${"  ".repeat(depth)}${n.val}  (left: ${L}, right: ${R})`); walk(n.left, depth + 1); walk(n.right, depth + 1); };
  walk(t.root, 0);
  const inorder = []; const io = (id) => { if (!id) return; io(t.nodes[id].left); inorder.push(t.nodes[id].val); io(t.nodes[id].right); }; io(t.root);
  return `root = ${t.nodes[t.root].val}\n${lines.join("\n")}\nin-order: ${inorder.join(" ")}`;
}

function ArenaChat({ ask, context }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef2(null);
  useEffect(() => { const el = endRef.current; if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" }); }, [msgs, busy]);
  const send = async () => {
    const q = text.trim(); if (!q || busy || !ask) return;
    const history = [...msgs, { role: "user", content: q }];
    setMsgs(history); setText(""); setBusy(true);
    try { const reply = await ask(history, context()); setMsgs([...history, { role: "assistant", content: reply }]); }
    catch { setMsgs([...history, { role: "assistant", content: "Hmm, I hit a snag. Try sending that again." }]); }
    setBusy(false);
  };
  return (
    <div style={{ border: `1px solid ${V.line}`, borderRadius: 12, background: V.panel, marginTop: 12 }}>
      <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${V.line}`, fontFamily: MONO, fontSize: 13, fontWeight: 700 }}>{"\ud83d\udcac Ask about this step"}<span style={{ fontWeight: 400, color: V.muted, marginLeft: 8, fontSize: 11.5 }}>the tutor can see the tree, your picks, and the coach's note</span></div>
      <div className="px-4 py-3" style={{ maxHeight: 320, overflowY: "auto" }}>
        {msgs.length === 0 && <div style={{ fontSize: 12.5, color: V.muted, fontFamily: MONO }}>e.g. "why is it 15 and not 20?", "what does 'leans right' mean?", "what would happen if I inserted 16 next?"</div>}
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <div style={{ maxWidth: "92%", padding: "8px 11px", borderRadius: 10, fontSize: 13.5, lineHeight: 1.55, background: m.role === "user" ? V.gold : V.panel2, color: m.role === "user" ? V.ink : V.text, whiteSpace: "pre-wrap" }}>
              {m.role === "user" ? m.content : m.content.split("\n").map((ln, j) => <div key={j}><Tie text={ln.replace(/\*\*/g, "")} /></div>)}
            </div>
          </div>
        ))}
        {busy && <div style={{ fontFamily: MONO, fontSize: 12, color: V.muted }}>thinking…</div>}
        <div ref={endRef} />
      </div>
      <div className="flex items-end gap-2 px-4 pb-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={2} placeholder={"Ask anything about this tree or this move\u2026"}
          style={{ flex: 1, fontFamily: "inherit", fontSize: 13.5, background: V.ink, color: V.text, border: `1px solid ${V.line}`, borderRadius: 8, padding: "8px 10px", resize: "vertical" }} />
        <button className="cq-btn" onClick={send} disabled={busy || !text.trim()} style={btn({ background: busy || !text.trim() ? V.panel2 : V.gold, color: busy || !text.trim() ? V.muted : V.ink, fontWeight: 700 })}>Send</button>
      </div>
    </div>
  );
}

const V = { ink: "#141924", line: "#3A4358", panel: "#242B3A", panel2: "#2C3446", text: "#E8E6DF", muted: "#9AA3B5", gold: "#F2B84B", teal: "#5FD3BC", coral: "#E86F6F", blue: "#4C9EE8" };
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const ROW = 62, TOP = 36, W = 640, R = 18;
const MODES = [["mix", "Mix"], ["insert", "Land the node"], ["seat", "Who takes the seat"], ["extreme", "Find the floor"], ...Object.entries(SCRIPTS).map(([k, s]) => [k, s.label]), ...HEAP_MODES, ...SORT_MODES, ...MERGE_MODES, ...BFS_MODES, ...DFS_MODES, ...TOPO_MODES];
const isSortMode = (m) => SORT_MODES.some(([k]) => k === m);
const isMergeMode = (m) => MERGE_MODES.some(([k]) => k === m);
const isBfsMode = (m) => BFS_MODES.some(([k]) => k === m);
const isDfsMode = (m) => DFS_MODES.some(([k]) => k === m);
const isTopoMode = (m) => TOPO_MODES.some(([k]) => k === m);
// Heap and sort modes each run in their own component, outside the tree game loop.
const isHeapMode = (m) => HEAP_MODES.some(([k]) => k === m) || isSortMode(m) || isMergeMode(m) || isBfsMode(m) || isDfsMode(m) || isTopoMode(m);
// Sidebar sections: same modes as MODES, grouped by topic.
const MENU = [
  { label: "Quick play", modes: [["mix", "Mix"]] },
  { label: "Binary search trees", modes: MODES.filter(([k]) => ["insert", "seat", "extreme"].includes(k)) },
  { label: "AVL trees", modes: Object.entries(SCRIPTS).map(([k, s]) => [k, s.label]) },
  { label: "Heaps", modes: HEAP_MODES.map(([k, l]) => [k, l.replace(/^Heap: /, "")]) },
  { label: "Quicksort", modes: SORT_MODES.map(([k, l]) => [k, l.replace(/^Quicksort: /, "")]) },
  { label: "Merge sort", modes: MERGE_MODES.map(([k, l]) => [k, l.replace(/^Merge sort: /, "")]) },
  { label: "Breadth-first search", modes: BFS_MODES.map(([k, l]) => [k, l.replace(/^BFS: /, "")]) },
  { label: "Depth-first search", modes: DFS_MODES.map(([k, l]) => [k, l.replace(/^DFS: /, "")]) },
  { label: "Topological sort", modes: TOPO_MODES.map(([k, l]) => [k, l.replace(/^Topological sort: /, "")]) },
];

function Tie({ text }) {
  return String(text).split("`").map((p, i) => i % 2 ? <code key={i} style={{ color: V.teal, background: V.ink, padding: "0 4px", borderRadius: 4 }}>{p}</code> : <span key={i}>{p}</span>);
}
const btn = (extra = {}) => ({ fontFamily: MONO, fontSize: 12.5, padding: "6px 14px", borderRadius: 6, cursor: "pointer", background: V.panel2, color: V.text, border: `1px solid ${V.line}`, ...extra });

function Coach({ puzzle, phase, picked, pick2, answered }) {
  let c;
  try { c = coach({ puzzle, phase, picked, pick2, answered }); } catch (e) { c = { title: "", paras: [] }; }
  if (!c.title) return null;
  return (
    <div style={{ border: `1px solid ${V.teal}`, borderRadius: 12, background: V.panel, width: "100%" }}>
      <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${V.line}`, fontFamily: MONO, fontSize: 13, fontWeight: 700, color: V.teal }}>{"\ud83e\udde0 Coach"}</div>
      <div className="px-4 py-3" key={c.title + (answered ? "a" : "b") + (phase || "")} style={{ animation: "cq-ar-fade .3s ease-out" }}>
        <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: V.gold, marginBottom: 6 }}>{c.title}</div>
        {c.paras.map((p, i) => <p key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: V.text, marginBottom: 8 }}><Tie text={p} /></p>)}
      </div>
    </div>
  );
}

// "paper" look for the scripted quiz modes: white page, light-blue boxes, black lines, red circle on the broken node (like the slides)
const PAPER = { bg: "#fbf9f3", node: "#cfe3ea", border: "#2b2b2b", text: "#111", line: "#2b2b2b", slot: "#8a8a8a", ok: "#2e7d32", okFill: "#d7f0d9", bad: "#c62828", newFill: "#fff1a8", red: "#e53935" };
const SERIF = 'Georgia, "Times New Roman", serif';

// Quiz-style statement for a scripted mode: full sequence with done / current / upcoming values marked.
function QuestionBanner({ ops, index }) {
  const inserts = ops.map((o, i) => ({ i, op: o[0], v: o[1] })).filter((o) => o.op === "i");
  const cur = ops[index];
  const firstRemoveIdx = ops.findIndex((o) => o[0] === "r");
  const insertPhaseDone = index >= inserts.length;
  return (
    <div style={{ background: PAPER.bg, color: PAPER.text, fontFamily: SERIF, padding: "14px 18px", borderBottom: `1px solid ${V.line}` }}>
      <div style={{ fontWeight: 700, fontSize: 15 }}>AVL Tree Example:</div>
      <div style={{ fontSize: 15, marginTop: 4 }}>
        {"\u2022 Insert "}
        {inserts.map((o, k) => {
          const state = o.i < index ? "done" : o.i === index ? "now" : "later";
          return <span key={o.i} style={{ fontWeight: state === "now" ? 700 : 400, textDecoration: state === "now" ? "underline" : "none", color: state === "later" ? "#888" : PAPER.text, background: state === "now" ? PAPER.newFill : "transparent", padding: state === "now" ? "0 3px" : 0 }}>{o.v}{k < inserts.length - 1 ? ", " : ""}</span>;
        })}
        {" into an empty AVL tree"}
      </div>
      {insertPhaseDone && cur && cur[0] === "r" && (
        <div style={{ fontSize: 15, marginTop: 4 }}>{"\u2022 Now remove "}<span style={{ fontWeight: 700, textDecoration: "underline", background: PAPER.newFill, padding: "0 3px" }}>{cur[1]}</span>
          {ops.slice(firstRemoveIdx, index).filter((o) => o[0] === "r").length > 0 && <span style={{ color: "#888" }}>{"  (already removed: " + ops.slice(firstRemoveIdx, index).filter((o) => o[0] === "r").map((o) => o[1]).join(", ") + ")"}</span>}
        </div>
      )}
    </div>
  );
}

const hgt = (t, id) => (id ? 1 + Math.max(hgt(t, t.nodes[id].left), hgt(t, t.nodes[id].right)) : 0);
const ancestorsOf = (t, v) => { const out = []; let id = t.root; while (id) { const n = t.nodes[id]; if (n.val === v) break; out.push(id); id = v < n.val ? n.left : n.right; } return out; };

// tiny paper-style tree for the "so far" strip (like the slide's sequence of trees)
function MiniTree({ tree, label, highlight }) {
  const MW = 150, MR = 24, MT = 16;
  const depth = (() => { let d = 0; const w = (id, k) => { if (!id) return; d = Math.max(d, k); w(tree.nodes[id].left, k + 1); w(tree.nodes[id].right, k + 1); }; w(tree.root, 0); return d; })();
  const MH = MT + (depth + 1) * MR + 8;
  const pos = layout(tree, MW, MR, MT);
  return (
    <div style={{ flex: "0 0 auto", textAlign: "center" }}>
      <svg viewBox={`0 0 ${MW} ${MH}`} width={MW} height={MH} style={{ display: "block", background: PAPER.bg, border: `1px solid ${highlight ? PAPER.red : "#ddd"}`, borderRadius: 4 }}>
        {!tree.root && <text x={MW / 2} y={MH / 2 + 4} textAnchor="middle" fontFamily={SERIF} fontSize="10" fill="#888">empty</text>}
        {Object.keys(tree.nodes).map((id) => { const nd = tree.nodes[id]; return ["left", "right"].map((s) => nd[s] && <line key={id + s} x1={pos[id].x} y1={pos[id].y} x2={pos[nd[s]].x} y2={pos[nd[s]].y} stroke={PAPER.line} strokeWidth="0.8" />); })}
        {Object.keys(tree.nodes).map((id) => { const p = pos[id]; return (
          <g key={id}><rect x={p.x - 9} y={p.y - 6} width="18" height="12" fill={PAPER.node} stroke={PAPER.border} strokeWidth="0.6" /><text x={p.x} y={p.y + 3} textAnchor="middle" fontFamily={SERIF} fontSize="8" fill={PAPER.text}>{tree.nodes[id].val}</text></g>); })}
      </svg>
      <div style={{ fontFamily: SERIF, fontSize: 11, color: highlight ? PAPER.red : "#555", marginTop: 2 }}>{label}</div>
    </div>
  );
}

const firstPhase = (p) => (p.op === "insert" && !p.before.root) ? "rotate" : "land";

export default function Arena({ best = 0, onFinish, onClose, ask }) {
  const seed = useRef(Date.now() % 1e9);
  const rand = useRef(rng(seed.current));
  const [mode, setMode] = useState("mix");
  const [round, setRound] = useState(0);              // 0..ROUNDS; ROUNDS = finished
  const [puzzle, setPuzzle] = useState(() => genPuzzle("mix", rand.current));
  const [picked, setPicked] = useState(null);          // slot id or value the player chose
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [started, setStarted] = useState(false);
  const [script, setScript] = useState(null);        // class mode: the 11 scripted rounds
  const [phase, setPhase] = useState("land");        // class mode: "land" | "rotate" | "done"
  const [pick2, setPick2] = useState(null);          // class mode: rotation pick (value or "none")
  const [runId, setRunId] = useState(0);               // bumps on every start so picking the same heap mode restarts it
  const isClass = mode in SCRIPTS;
  const [showH, setShowH] = useState(true);
  const total = isClass ? (script ? script.length : ROUNDS) : ROUNDS;

  // class mode: step 1 shows the tree before the move; step 2 shows the node already hooked on (or the seat swapped), BEFORE balancing; result shows after
  const shown = useMemo(() => {
    if (!isClass) return puzzle.tree;
    if (phase === "done") return puzzle.after;
    if (phase === "rotate") return puzzle.op === "insert" ? plainInsert(puzzle.before, puzzle.value) : plainRemove(puzzle.before, puzzle.value, true);
    return puzzle.before;
  }, [isClass, phase, puzzle]);
  const pos = useMemo(() => layout(shown, W, ROW, TOP), [shown]);
  const depth = useMemo(() => { let d = 0; const walk = (id, k) => { if (!id) return; d = Math.max(d, k); walk(shown.nodes[id].left, k + 1); walk(shown.nodes[id].right, k + 1); }; walk(shown.root, 0); return d; }, [shown]);
  const H = TOP + (depth + 2) * ROW;
  const walkPath = useMemo(() => (isClass && phase === "rotate" && puzzle.op === "insert") ? new Set(ancestorsOf(shown, puzzle.value)) : new Set(), [isClass, phase, puzzle, shown]);
  const answered = isClass ? phase === "done" : picked !== null;
  const step1Ok = puzzle.op === "insert" ? (picked === puzzle.landing || puzzle.landing === null) : (puzzle.twoChildren ? picked === puzzle.seat : picked === puzzle.value);
  const isRight = isClass ? (pick2 !== null && step1Ok && pick2 === (puzzle.rotAt === null ? "none" : puzzle.rotAt)) : (answered && picked === puzzle.answer);

  const start = (m) => {
    setRunId((n) => n + 1);
    // Heap modes run inside HeapArena, but clear any AVL script so the tree view never reads a stale class puzzle.
    if (isHeapMode(m)) { setMode(m); setStarted(true); setRound(1); setScript(null); setPhase("land"); setPicked(null); setPick2(null); setPuzzle(genPuzzle("mix", rand.current)); return; }
    setMode(m); setRound(1); setScore(0); setStreak(0); setBestStreak(0); setCorrect(0); setPicked(null); setPick2(null); setStarted(true);
    if (m in SCRIPTS) { const s = scriptRounds(SCRIPTS[m].ops); setScript(s); setPuzzle(s[0]); setPhase(firstPhase(s[0])); }
    else { setScript(null); setPuzzle(genPuzzle(m, rand.current)); }
  };
  const award = (ok) => { if (ok) { const s = streak + 1; setStreak(s); setBestStreak(Math.max(bestStreak, s)); setScore((sc) => sc + pointsFor(s)); } else setStreak(0); };
  // class mode, step 1: landing spot (insert) or seat (remove)
  const chooseClass1 = (id) => {
    if (!isClass || phase !== "land") return;
    setPicked(id); award(puzzle.op === "insert" ? id === puzzle.landing : (puzzle.twoChildren ? id === puzzle.seat : id === puzzle.value)); setPhase("rotate");
  };
  // class mode, step 2: rotation at which node, or none
  const chooseClass2 = (val) => {
    if (!isClass || phase !== "rotate") return;
    setPick2(val); const ok = val === (puzzle.rotAt === null ? "none" : puzzle.rotAt); award(ok);
    if (ok && step1Ok) setCorrect((c) => c + 1);
    setPhase("done");
  };
  const choose = (id) => {
    if (answered || !started) return;
    setPicked(id);
    if (id === puzzle.answer) {
      const s = streak + 1; setStreak(s); setBestStreak(Math.max(bestStreak, s)); setScore(score + pointsFor(s)); setCorrect(correct + 1);
    } else setStreak(0);
  };
  const next = () => {
    if (round >= total) { setRound(total + 1); onFinish && onFinish({ score, correct, bestStreak, xp: xpFor(correct) }); return; }
    setRound(round + 1); setPicked(null); setPick2(null);
    if (isClass) { const p = script[round]; setPuzzle(p); setPhase(firstPhase(p)); }
    else setPuzzle(genPuzzle(mode, rand.current));
  };
  const slotPos = (s) => { const p = pos["v" + s.parent]; return { x: p.x + (s.side === "left" ? -30 : 30), y: p.y + ROW * 0.85 }; };
  const finished = round > total;

  return (
    <div className="flex w-full" style={{ flex: 1, minHeight: 0 }}>
    <ArenaMenu groups={MENU} active={started && !finished ? mode : null} onPick={start} best={best} />
    <div className="w-full overflow-y-auto" style={{ flex: 1, minWidth: 0 }}>
    <div className="p-6 w-full" style={{ maxWidth: started && isHeapMode(mode) ? "108rem" : started && !finished ? "80rem" : "52rem", margin: "0 auto" }}>
      <style>{`.cq-ar-node { transition: transform .6s cubic-bezier(.2,.8,.2,1) } @keyframes cq-ar-fade { from { opacity: 0; transform: translateY(3px) } to { opacity: 1; transform: none } } @media (prefers-reduced-motion: reduce) { .cq-ar-node { transition: none } }`}</style>
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <h1 style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>{"\ud83c\udfae Tree Arena"}</h1>
        <span style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted }}>predict the tree before it moves</span>
        <div className="flex-1" />
        <button className="cq-btn" onClick={onClose} style={btn()}>{"\u2190 back to lessons"}</button>
      </div>

      {(!started || finished) && (
        <div style={{ border: `1px solid ${V.line}`, borderRadius: 12, background: V.panel, padding: 18 }} className="mb-4">
          {finished ? (
            <div style={{ fontFamily: MONO }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: V.gold }}>Game over: {score} points</div>
              <div style={{ fontSize: 13, color: V.text, marginTop: 6 }}>{correct}/{total} correct · best streak {bestStreak} · +{xpFor(correct)} xp{score > best ? " · NEW BEST" : best ? ` · best ${best}` : ""}</div>
            </div>
          ) : (
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              <div style={{ fontFamily: MONO, fontWeight: 700, marginBottom: 6 }}>How to play</div>
              You're shown a tree and a move. <b>Click where it lands before it happens.</b> Right answers build a streak (points ×1, ×2, ×3); a wrong answer shows you the walk and resets the streak. Ten rounds a game, XP for every correct pick. <b>Class exercise</b> plays the AVL sequence from the slides (15, 20, 24, 10, 13, 7, 30, 36, 25, then remove 24 and 20): for each step you predict where it lands <i>and</i> whether the tree rotates. <b>Heap</b> modes cover inserts (bubble up) and extract-min/max (bubble down): predict each step, then watch the swaps play out in the tree and the array. Textbook modes label the root as index 1. <b>Sorting</b> modes run the class's left-wall quicksort partition: call each comparison, then click where the pivot lands. <b>Breadth-first search</b> modes run BFS on a graph: after each dequeue, click the vertices that join the queue, call the visit order, or name a vertex's distance from the source. <b>Depth-first search</b> modes run the recursive white/grey/black DFS: predict where it dives next, call the visit order, or spot which vertices are still grey on the call stack. <b>Topological sort</b> modes use the indegree-and-queue method from the slides: say which vertices become ready after each removal, build your own valid order, or judge whether an order works.{best ? <span style={{ color: V.muted }}> Your best: {best}.</span> : null}
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap mt-4">
            {finished
              ? <button className="cq-btn" onClick={() => start(mode)} style={btn({ background: V.gold, color: V.ink, fontWeight: 700 })}>Play again: {MODES.find((m) => m[0] === mode)?.[1] || mode}</button>
              : <button className="cq-btn" onClick={() => start("mix")} style={btn({ background: V.gold, color: V.ink, fontWeight: 700 })}>Play Mix</button>}
            <span style={{ fontFamily: MONO, fontSize: 12, color: V.muted }}>or pick any mode from the menu on the left</span>
          </div>
        </div>
      )}

      {started && isSortMode(mode) && (
        <SortArena key={mode + ":" + runId} mode={mode} best={best}
          onFinish={(res) => onFinish && onFinish(res)}
          onExit={() => { setStarted(false); setMode("mix"); setRound(0); }}
          renderChat={ask ? (ctx) => <ArenaChat ask={ask} context={ctx} /> : null} />
      )}

      {started && isMergeMode(mode) && (
        <MergeArena key={mode + ":" + runId} mode={mode} best={best}
          onFinish={(res) => onFinish && onFinish(res)}
          onExit={() => { setStarted(false); setMode("mix"); setRound(0); }}
          renderChat={ask ? (ctx) => <ArenaChat ask={ask} context={ctx} /> : null} />
      )}

      {started && isBfsMode(mode) && (
        <BfsArena key={mode + ":" + runId} mode={mode} best={best}
          onFinish={(res) => onFinish && onFinish(res)}
          onExit={() => { setStarted(false); setMode("mix"); setRound(0); }}
          renderChat={ask ? (ctx) => <ArenaChat ask={ask} context={ctx} /> : null} />
      )}

      {started && isDfsMode(mode) && (
        <DfsArena key={mode + ":" + runId} mode={mode} best={best}
          onFinish={(res) => onFinish && onFinish(res)}
          onExit={() => { setStarted(false); setMode("mix"); setRound(0); }}
          renderChat={ask ? (ctx) => <ArenaChat ask={ask} context={ctx} /> : null} />
      )}

      {started && isTopoMode(mode) && (
        <TopoArena key={mode + ":" + runId} mode={mode} best={best}
          onFinish={(res) => onFinish && onFinish(res)}
          onExit={() => { setStarted(false); setMode("mix"); setRound(0); }}
          renderChat={ask ? (ctx) => <ArenaChat ask={ask} context={ctx} /> : null} />
      )}

      {started && isHeapMode(mode) && !isSortMode(mode) && !isMergeMode(mode) && !isBfsMode(mode) && !isDfsMode(mode) && !isTopoMode(mode) && (
        <HeapArena key={mode + round + ":" + runId} mode={mode} best={best}
          onFinish={(res) => onFinish && onFinish(res)}
          onExit={() => { setStarted(false); setMode("mix"); setRound(0); }}
          renderChat={ask ? (ctx) => <ArenaChat ask={ask} context={ctx} /> : null} />
      )}

      {started && !finished && !isHeapMode(mode) && (
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div style={{ border: `1px solid ${V.gold}`, borderRadius: 12, background: V.panel, overflow: "hidden", flex: "3 1 0", minWidth: 0, width: "100%" }}>
          <div className="flex items-center gap-4 px-4 py-2.5 flex-wrap" style={{ borderBottom: `1px solid ${V.line}`, fontFamily: MONO, fontSize: 12.5 }}>
            <span style={{ color: V.muted }}>round {round}/{total}</span>
            <span style={{ color: V.gold, fontWeight: 700 }}>{score} pts</span>
            <span title="streak">{"\ud83d\udd25"} {streak}{streak >= 3 ? " (\u00d73)" : streak === 2 ? " (\u00d72)" : ""}</span>
            <div className="flex-1" />
            <span style={{ color: V.muted }}>{MODES.find((m) => m[0] === mode)?.[1]}</span>
          </div>
          {isClass && <QuestionBanner ops={SCRIPTS[mode].ops} index={round - 1} />}
          <div className="px-4 py-3" style={{ fontFamily: MONO, fontSize: 14, color: V.text, borderBottom: `1px solid ${V.line}` }}>
            {puzzle.prompt}{isClass && phase === "land" ? (puzzle.op === "insert" ? " \u2014 step 1: click where it lands" : (puzzle.twoChildren ? " \u2014 step 1: click the node that takes its seat" : ` \u2014 step 1: find ${puzzle.value} and click it to unhook it`)) : ""}{isClass && phase === "rotate" ? (puzzle.op === "remove" && !puzzle.twoChildren ? ` \u2014 ${puzzle.value} is unhooked. Does the tree rotate? click the node, or No rotation` : " \u2014 step 2: does the tree rotate? click the node that rotates, or No rotation") : ""}{isClass && phase === "done" ? " \u2014 result" : ""}
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block", background: isClass ? PAPER.bg : V.ink }} role="img" aria-label="Arena tree">
            {Object.keys(shown.nodes).map((id) => { const nd = shown.nodes[id]; return ["left", "right"].map((s) => nd[s] && <line key={id + s} x1={pos[id].x} y1={pos[id].y} x2={pos[nd[s]].x} y2={pos[nd[s]].y} stroke={isClass ? PAPER.line : V.line} strokeWidth={isClass ? 1.5 : 2} />); })}
            {(puzzle.kind === "insert" || (isClass && puzzle.op === "insert" && phase === "land")) && (puzzle.slots || []).map((s) => {
              const p = slotPos(s); const ans = isClass ? puzzle.landing : puzzle.answer; const isAns = s.id === ans; const isPick = s.id === picked;
              const revealed = isClass ? phase !== "land" : answered;
              const stroke = isClass ? (revealed ? (isAns ? PAPER.ok : isPick ? PAPER.bad : PAPER.slot) : PAPER.slot) : (revealed ? (isAns ? V.teal : isPick ? V.coral : V.line) : V.muted);
              return (
                <g key={s.id} className="cq-btn" onClick={() => (isClass ? chooseClass1(s.id) : choose(s.id))} style={{ cursor: revealed ? "default" : "pointer" }} role="button" aria-label={`slot under ${s.parent} ${s.side}`}>
                  <line x1={pos["v" + s.parent].x} y1={pos["v" + s.parent].y} x2={p.x} y2={p.y} stroke={stroke} strokeWidth="1.5" strokeDasharray="4 4" />
                  {isClass
                    ? <rect x={p.x - 20} y={p.y - 14} width="40" height="28" fill={revealed && isAns ? PAPER.okFill : PAPER.bg} stroke={stroke} strokeWidth="1.5" strokeDasharray={revealed && isAns ? "0" : "4 3"} />
                    : <circle cx={p.x} cy={p.y} r={R - 3} fill={revealed && isAns ? V.teal : V.ink} stroke={stroke} strokeWidth="2" strokeDasharray={revealed && isAns ? "0" : "4 3"} />}
                  {revealed && isAns && <text x={p.x} y={p.y} textAnchor="middle" dy="4.5" fill={isClass ? PAPER.text : V.ink} fontFamily={isClass ? SERIF : MONO} fontSize={isClass ? "15" : "12"} fontWeight="700">{puzzle.value}</text>}
                  {!revealed && <text x={p.x} y={p.y} textAnchor="middle" dy="4" fill={isClass ? PAPER.slot : V.muted} fontFamily={isClass ? SERIF : MONO} fontSize="12">?</text>}
                </g>
              );
            })}
            {Object.keys(shown.nodes).map((id) => {
              const nd = shown.nodes[id]; const p = pos[id];
              const clickable = isClass ? (phase === "rotate" || (phase === "land" && puzzle.op === "remove")) : (puzzle.kind !== "insert" && !answered);
              const rotAns = isClass && phase === "done" && nd.val === puzzle.rotAt;
              const seatAns = isClass && puzzle.op === "remove" && phase !== "land" && (puzzle.twoChildren ? nd.val === puzzle.seat : false);
              const isAns = isClass ? (rotAns || seatAns) : (puzzle.kind !== "insert" && nd.val === puzzle.answer);
              const isPick = isClass ? (nd.val === pick2 || nd.val === picked) : nd.val === picked;
              const isNew = isClass && puzzle.op === "insert" && phase === "rotate" && nd.val === puzzle.value;
              const isX = isClass ? ((puzzle.op === "remove" && nd.val === puzzle.value && phase !== "done") || isNew) : (puzzle.kind === "seat" && nd.val === puzzle.value);
              const stroke = answered ? (isAns ? V.teal : (isPick && !isAns) ? V.coral : isX ? V.gold : V.line) : isX ? V.gold : V.teal;
              if (isClass) {
                const wrongPick = answered && isPick && !isAns;
                return (
                  <g key={id} className="cq-ar-node" onClick={() => clickable && (phase === "rotate" ? chooseClass2(nd.val) : chooseClass1(nd.val))} style={{ cursor: clickable ? "pointer" : "default", transform: `translate(${p.x}px, ${p.y}px)` }} role={clickable ? "button" : undefined} aria-label={`node ${nd.val}`}>
                    {rotAns && <ellipse rx="34" ry="24" fill="none" stroke={PAPER.red} strokeWidth="2" />}
                    {wrongPick && <ellipse rx="34" ry="24" fill="none" stroke={PAPER.slot} strokeWidth="1.5" strokeDasharray="5 4" />}
                    {walkPath.has(id) && <rect x="-26" y="-19" width="52" height="38" fill="none" stroke={PAPER.slot} strokeWidth="1" strokeDasharray="3 3" />}
                    <rect x="-22" y="-15" width="44" height="30" fill={seatAns && answered ? PAPER.okFill : isNew ? PAPER.newFill : PAPER.node} stroke={isX && !isNew ? PAPER.red : PAPER.border} strokeWidth={isX ? 2 : 1} />
                    <text textAnchor="middle" dy="5.5" fill={PAPER.text} fontFamily={SERIF} fontSize="16">{nd.val}</text>
                    {showH && (() => { const hl = hgt(shown, nd.left), hr = hgt(shown, nd.right); const h = 1 + Math.max(hl, hr); const b = hl - hr; const reveal = phase === "done" || (phase === "land"); const bad = Math.abs(b) > 1;
                      return (<text x="27" y="-6" fontFamily={SERIF} fontSize="10.5" fill="#444"><tspan x="27" dy="0">h={h}</tspan>{reveal && <tspan x="27" dy="12" fill={bad ? PAPER.red : "#444"} fontWeight={bad ? 700 : 400}>b={b > 0 ? "+" + b : b}</tspan>}</text>); })()}
                  </g>
                );
              }
              return (
                <g key={id} className="cq-ar-node" onClick={() => clickable && choose(nd.val)} style={{ cursor: clickable ? "pointer" : "default", transform: `translate(${p.x}px, ${p.y}px)` }} role={clickable ? "button" : undefined} aria-label={`node ${nd.val}`}>
                  <circle r={R} fill={answered && isAns ? V.teal : isNew ? V.gold : V.panel2} stroke={stroke} strokeWidth={isX || (answered && isAns) ? 3 : 2.5} />
                  <text textAnchor="middle" dy="4.5" fill={(answered && isAns) || isNew ? V.ink : V.text} fontFamily={MONO} fontSize="13" fontWeight="700">{nd.val}</text>
                </g>
              );
            })}
          </svg>

          <div className="px-4 py-3" style={{ borderTop: `1px solid ${V.line}`, minHeight: 70 }}>
            {isClass && phase === "rotate" && (
              <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted }}>Click the node that becomes 2-off and rotates, or:</span>
                <button className="cq-btn" onClick={() => chooseClass2("none")} style={btn()}>No rotation</button>
              </div>
            )}
            {answered ? (
              <div>
                <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: isRight ? V.teal : V.coral }}>{isRight ? `\u2713 right! +${pointsFor(streak)}` : (isClass ? "\u2717 not quite \u2014 here's the walk:" : "\u2717 not there \u2014 here's the walk:")}</div>
                {puzzle.lines.map((l, i) => <div key={i} style={{ fontSize: 12.5, color: V.text, marginTop: 3, fontFamily: MONO }}><Tie text={l} /></div>)}
              </div>
            ) : (
              <div style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted }}>{isClass ? (phase === "land" ? (puzzle.op === "insert" ? "Dashed circles are the empty spots. Walk the comparisons, then click." : "Two children: which node takes its seat under the slides' rule?") : "Walk back up from the new node: is anyone off by 2?") : (puzzle.kind === "insert" ? "Dashed circles are the empty spots. Walk the comparisons in your head, then click." : "Click a node.")}</div>
            )}
          </div>
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: `1px solid ${V.line}` }}>
            <button className="cq-btn" onClick={next} disabled={!answered} style={btn({ background: answered ? V.gold : V.panel2, color: answered ? V.ink : V.muted, fontWeight: 700 })}>{round >= total ? "Finish" : "Next \u25b6"}</button>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted }}>{best ? `best ${best}` : ""}</span>
            {isClass && <><div className="flex-1" /><label style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted, cursor: "pointer" }}><input type="checkbox" checked={showH} onChange={(e) => setShowH(e.target.checked)} style={{ marginRight: 6 }} />show h / balance</label></>}
          </div>
          {isClass && script && (
            <div className="px-4 py-3" style={{ borderTop: `1px solid ${V.line}`, background: PAPER.bg }}>
              <div style={{ fontFamily: SERIF, fontSize: 12, color: "#555", marginBottom: 6 }}>So far (each step's result, like the slides):</div>
              <div className="flex items-start gap-3" style={{ overflowX: "auto", paddingBottom: 4 }}>
                <MiniTree tree={{ nodes: {}, root: null }} label="start" />
                {script.slice(0, round - 1).map((p, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div style={{ fontFamily: SERIF, fontSize: 18, color: "#888", paddingTop: 18 }}>{"\u2192"}</div>
                    <MiniTree tree={p.after} label={`${p.op} ${p.value}${p.rotAt !== null ? " \u21bb" : ""}`} highlight={p.rotAt !== null} />
                  </div>
                ))}
                {phase === "done" && <div className="flex items-start gap-3"><div style={{ fontFamily: SERIF, fontSize: 18, color: "#888", paddingTop: 18 }}>{"\u2192"}</div><MiniTree tree={puzzle.after} label={`${puzzle.op} ${puzzle.value}${puzzle.rotAt !== null ? " \u21bb" : ""} (now)`} highlight={puzzle.rotAt !== null} /></div>}
              </div>
            </div>
          )}
        </div>
        <div style={{ flex: "2 1 0", minWidth: 0, width: "100%" }}>
          <Coach puzzle={puzzle} phase={isClass ? phase : undefined} picked={picked} pick2={pick2} answered={answered} />
          {ask && <ArenaChat ask={ask} context={() => {
            let c = { title: "", paras: [] }; try { c = coach({ puzzle, phase: isClass ? phase : undefined, picked, pick2, answered }); } catch {}
            const modeLabel = MODES.find((m) => m[0] === mode)?.[1] || mode;
            const seq = isClass ? SCRIPTS[mode].ops.map((o) => (o[0] === "i" ? "insert " : "remove ") + o[1]).join(", ") : "";
            return {
              title: `Tree Arena \u2014 ${modeLabel}`,
              challenge: `This is the Tree Arena game (AVL / BST practice), not a coding exercise. ${seq ? "Full question: " + seq + ". " : ""}Current round: ${puzzle.prompt}.${isClass ? ` Phase: ${phase}.` : ""} Heights count a single node as 1 and an empty spot as 0. Balance = height(left) - height(right); off by 2 means rotate at the LOWEST such node. Removals in the scripted modes use the slides' rule (largest key in the left branch takes the seat).`,
              code: isClass
                ? `// Before the move:\n${describeTree(puzzle.before)}\n// Right after the key is hooked on / the seat is swapped, BEFORE any rotation:\n${describeTree(puzzle.op === "insert" ? plainInsert(puzzle.before, puzzle.value) : plainRemove(puzzle.before, puzzle.value, true))}${phase === "done" ? "\n// After the move (result, rotated if needed):\n" + describeTree(puzzle.after) : ""}`
                : `// Tree on screen:\n${describeTree(puzzle.tree)}`,
              summary: `Player's picks: ${picked !== null ? "step 1 = " + picked : "none yet"}${pick2 !== null ? ", step 2 = " + pick2 : ""}. Correct: ${isClass ? `landing/seat = ${puzzle.landing ?? puzzle.seat ?? "n/a"}, rotation at = ${puzzle.rotAt ?? "none"}` : `answer = ${puzzle.answer}`}. Coach said: ${c.title}. ${c.paras.join(" ")}`,
            };
          }} />}
        </div>
      </div>
      )}
    </div>
    </div>
    </div>
  );
}
