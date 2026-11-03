import { useState, useEffect, useMemo } from "react";
import { rng, pointsFor, xpFor } from "./arenasim.js";
import { dfsRounds, edgeList, BOARD_W, BOARD_H } from "./dfssim.js";
import { run as runCpp } from "./cppmini.js";
import { CppEditor, CppCode } from "./cpphl.jsx";

const V = { ink: "#141924", line: "#3A4358", panel: "#242B3A", panel2: "#2C3446", text: "#E8E6DF", muted: "#9AA3B5", gold: "#F2B84B", teal: "#5FD3BC", coral: "#E86F6F", blue: "#4C9EE8", grey: "#C3C9D6" };
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const btn = (extra = {}) => ({ fontFamily: MONO, fontSize: 12.5, padding: "6px 14px", borderRadius: 6, cursor: "pointer", background: V.panel2, color: V.text, border: `1px solid ${V.line}`, ...extra });
const R = 21;

export const DFS_MODES = [
  ["dfs-step", "DFS: where does it go next? (textbook graph)"],
  ["dfs-order", "DFS: visit order"],
  ["dfs-grey", "DFS: which vertices are grey?"],
  ["dfs-step-rand", "DFS: full run (random graph)"],
];

const ekey = (u, v) => `${Math.min(u, v)}-${Math.max(u, v)}`;
const names = (g, vs) => vs.map((v) => g.names[v]).join(", ");
const FILL = { white: V.ink, grey: "#4A5163", black: "#1F4C47" };
const STROKE = { white: V.muted, grey: V.grey, black: V.teal };

// ---------- the board: the graph, its adjacency lists, and the call stack ----------
// view: { state[], stack[], cur, checking, parent[], showTree, showStack, showTimes, disc[], fin[],
//         hideColors, badges{}, marks{}, picks(Set), target }
function Board({ g, view, pickable, onPick, showIndex }) {
  const edges = useMemo(() => edgeList(g), [g]);
  const treeEdge = (u, v) => view.showTree && view.parent && (view.parent[v] === u || view.parent[u] === v);
  const st = (v) => (view.hideColors ? "white" : view.state[v]);
  return (
    <div className="flex flex-wrap gap-3 items-start" style={{ padding: "10px 0 6px" }}>
      <div style={{ flex: "1 1 300px", minWidth: 0, overflowX: "auto", borderRadius: 8 }}>
        <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} style={{ width: "100%", minWidth: 400, display: "block", background: V.ink, borderRadius: 8 }} role="img" aria-label="Graph for depth-first search">
          {edges.map(([u, v]) => {
            const checking = view.cur != null && view.checking != null && ekey(u, v) === ekey(view.cur, view.checking);
            const tree = treeEdge(u, v);
            return <line key={u + ":" + v} x1={g.pos[u].x} y1={g.pos[u].y} x2={g.pos[v].x} y2={g.pos[v].y}
              stroke={checking ? V.gold : tree ? V.teal : V.line} strokeWidth={checking ? 4 : tree ? 3 : 2} strokeLinecap="round" />;
          })}
          {g.names.map((nm, v) => {
            const isCur = view.cur === v, isChk = view.checking === v, isTarget = view.target === v;
            const picked = view.picks && view.picks.has(v);
            const mark = view.marks ? view.marks[v] : null;
            const stroke = mark === "right" ? V.teal : mark === "wrong" ? V.coral : mark === "missed" ? V.gold : isCur || isTarget || picked ? V.gold : isChk ? V.text : STROKE[st(v)];
            const can = pickable && pickable(v);
            const badge = view.badges ? view.badges[v] : null;
            const times = view.showTimes && view.disc && view.disc[v] > 0 ? `${view.disc[v]}/${view.fin && view.fin[v] > 0 ? view.fin[v] : "–"}` : null;
            return (
              <g key={v} className={can ? "cq-btn cq-dfs-v" : "cq-dfs-v"} onClick={() => can && onPick(v)} role={can ? "button" : undefined} tabIndex={can ? 0 : undefined}
                onKeyDown={(e) => { if (can && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onPick(v); } }}
                aria-label={`vertex ${nm}${view.hideColors ? "" : `, ${st(v)}`}${isCur ? ", current call" : ""}${picked ? ", selected" : ""}${isTarget ? ", just discovered" : ""}`} style={{ cursor: can ? "pointer" : "default" }}>
                <circle cx={g.pos[v].x} cy={g.pos[v].y} r={R} fill={picked || isTarget ? "#4A3F2A" : FILL[st(v)]} stroke={stroke}
                  strokeWidth={isCur || picked || mark || isTarget ? 3.5 : 2} strokeDasharray={can && !picked ? "5 4" : undefined} />
                <text x={g.pos[v].x} y={g.pos[v].y + 5.5} textAnchor="middle" fontFamily={MONO} fontSize={nm.length > 1 ? 14 : 17} fontWeight="700" fill={V.text}>{nm}</text>
                {times && (
                  <g><rect x={g.pos[v].x + R - 1} y={g.pos[v].y - R - 7} width={times.length * 7.5 + 10} height="17" rx="5" fill={V.ink} stroke={V.line} strokeWidth="1" />
                    <text x={g.pos[v].x + R + 4 + times.length * 3.75} y={g.pos[v].y - R + 6} textAnchor="middle" fontFamily={MONO} fontSize="12" fontWeight="700" fill={V.gold}>{times}</text></g>
                )}
                {showIndex && <text x={g.pos[v].x} y={g.pos[v].y + R + 14} textAnchor="middle" fontFamily={MONO} fontSize="11" fill={V.muted}>[{v}]</text>}
                {badge != null && (
                  <g><circle cx={g.pos[v].x - R + 2} cy={g.pos[v].y - R + 2} r="10" fill={V.gold} />
                    <text x={g.pos[v].x - R + 2} y={g.pos[v].y - R + 6} textAnchor="middle" fontFamily={MONO} fontSize="11.5" fontWeight="700" fill={V.ink}>{badge}</text></g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ flex: "0 1 168px", minWidth: 150, fontFamily: MONO, fontSize: 12.5 }}>
        <div style={{ color: V.muted, fontSize: 11.5, marginBottom: 4 }}>{g.tree ? "children" : "adjacency lists"}</div>
        {g.names.map((nm, u) => (g.tree && !g.adj[u].length ? null : (
          <div key={u} style={{ padding: "2px 6px", borderRadius: 5, background: view.cur === u ? "rgba(242,184,75,.14)" : "transparent", color: view.cur === u ? V.text : V.muted, whiteSpace: "nowrap" }}>
            <b style={{ color: view.cur === u ? V.gold : V.text }}>{nm}</b>{showIndex ? <span style={{ color: "#6b7590" }}>[{u}]</span> : null}:{" "}
            {g.adj[u].length ? g.adj[u].map((v, i) => (
              <span key={v} style={{ color: view.cur === u && view.checking === v ? V.gold : undefined, fontWeight: view.cur === u && view.checking === v ? 700 : 400 }}>{i ? ", " : ""}{g.names[v]}</span>
            )) : <span style={{ color: "#6b7590" }}>(none)</span>}
          </div>
        )))}
      </div>
      {view.showStack && (
        <div className="flex items-center gap-2 flex-wrap" style={{ flex: "1 1 100%", fontFamily: MONO, fontSize: 12.5, color: V.muted, minHeight: 44 }}>
          <span style={{ width: 76 }}>call stack</span>
          <span style={{ fontSize: 11, color: V.grey }}>bottom {"▸"}</span>
          {view.stack.length ? view.stack.map((v, i) => {
            const top = i === view.stack.length - 1;
            return (
              <div key={v + ":" + i} style={{ height: 38, padding: "0 8px", borderRadius: 7, display: "grid", placeItems: "center", fontSize: 13.5, fontWeight: 700,
                border: `2px solid ${top ? V.gold : V.grey}`, background: "#4A5163", color: V.text }}>dfs({g.names[v]})</div>
            );
          }) : <span style={{ color: "#6b7590" }}>(empty: every call has returned)</span>}
          {view.stack.length ? <span style={{ fontSize: 11, color: V.gold }}>{"◂"} top (running now)</span> : null}
        </div>
      )}
    </div>
  );
}

// ---------- code lab ----------
const DFS_ANSWER = `void dfs(int v) {
  color[v] = GREY;          // v is visited

  for (int w : adj[v]) {
    if (color[w] == WHITE) {
      parent[w] = v;
      dfs(w);
    }
  }

  color[v] = BLACK;         // every neighbor explored
}`;
const DFS_STARTER = `// The graph has n vertices, numbered 0..n-1 (the small [k] labels).
// adj[u] is the list of u's neighbors.
// Already set up for you, all of size n:
//   color[]   starts WHITE for every vertex
//   parent[]  starts -1
// WHITE, GREY and BLACK are defined for you.
void dfs(int v) {
  color[v] = GREY;          // v is visited

  // TODO: look at every neighbor w of v.
  //       If w is still WHITE: set parent[w] = v,
  //       then call dfs(w).

  color[v] = BLACK;         // every neighbor explored
}`;
const DFS_HINT = "for (int w : adj[v]) { if (color[w] == WHITE) { parent[w] = v; dfs(w); } }";

function CodeLab({ r, onFrames, activeLine }) {
  const [code, setCode] = useState(DFS_STARTER);
  const [status, setStatus] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const g = r.g, tr = r.tr, n = g.names.length;
  useEffect(() => { setStatus(null); onFrames(null); }, [tr]);

  const execute = () => {
    const globals = { adj: g.adj.map((l) => [...l]), color: new Array(n).fill(0), parent: new Array(n).fill(-1), WHITE: 0, GREY: 1, BLACK: 2, GRAY: 1 };
    let res;
    try { res = runCpp(code, { a: new Array(n).fill(0), count: n, globals, trackWrites: true, maxSteps: 8000, maxDepth: 40, what: "the vertices", call: { name: "dfs", args: [tr.s] } }); }
    catch (e) { setStatus({ line: e && e.line, msg: e && e.msg ? e.msg : String(e) }); onFrames(null); return; }
    // Replay what the player's code did to the colors and the call stack.
    let state = new Array(n).fill("white"), stack = [], parent = new Array(n).fill(-1);
    const frames = [{ state, stack, parent, cur: null, line: 0, say: "your code's starting graph: every vertex is white" }];
    const greys = [], blacks = [];
    const inRange = (v) => Number.isInteger(v) && v >= 0 && v < n;
    for (const t of res.trace) {
      const nt = t.note;
      if (!nt || nt.kind !== "set" || !inRange(nt.i)) continue;
      if (nt.arr === "color" && nt.v === 1) {
        greys.push(nt.i); state = [...state]; state[nt.i] = "grey"; stack = [...stack, nt.i];
        frames.push({ state, stack, parent, cur: nt.i, line: t.line, say: `color[${nt.i}] = GREY  // ${g.names[nt.i]} is visited, dfs(${g.names[nt.i]}) is running` });
      } else if (nt.arr === "color" && nt.v === 2) {
        blacks.push(nt.i); state = [...state]; state[nt.i] = "black"; stack = stack.filter((x) => x !== nt.i);
        frames.push({ state, stack, parent, cur: stack.length ? stack[stack.length - 1] : null, line: t.line, say: `color[${nt.i}] = BLACK  // ${g.names[nt.i]} is finished, dfs(${g.names[nt.i]}) returns` });
      } else if (nt.arr === "parent") {
        parent = [...parent]; parent[nt.i] = nt.v;
        frames.push({ state, stack, parent, cur: stack.length ? stack[stack.length - 1] : null, line: t.line, say: `parent[${nt.i}] = ${nt.v}  // ${g.names[nt.i]} was reached from ${inRange(nt.v) ? g.names[nt.v] : "?"}` });
      }
    }
    if (!res.ok) {
      const deep = /nested calls/.test(res.error.msg);
      const twice = greys.find((v, i) => greys.indexOf(v) !== i);
      setStatus({ line: res.error.line, msg: res.error.msg + (deep ? (twice !== undefined ? ` dfs(${g.names[twice]}) got called again after ${g.names[twice]} was already visited: only recurse on WHITE neighbors.` : " Only call dfs(w) when w is still WHITE.") : "") });
      onFrames(frames.slice(0, 60)); return;
    }
    const orderOk = greys.join(",") === tr.order.join(",");
    const finOk = blacks.join(",") === tr.finishOrder.join(",");
    const parentOk = globals.parent.join(",") === tr.parent.join(",");
    const twice = greys.find((v, i) => greys.indexOf(v) !== i);
    const pass = orderOk && finOk && parentOk && twice === undefined;
    setStatus({ pass, msg: pass
      ? `Your DFS visited ${names(g, greys)} and finished ${names(g, blacks)}. That matches.`
      : !greys.length ? "No vertex was ever colored GREY. Does dfs() set color[v] = GREY?"
      : greys.length === 1 && tr.order.length > 1 ? `Only ${g.names[greys[0]]} was visited. Nothing calls dfs() on its neighbors yet.`
      : twice !== undefined ? `${g.names[twice]} was colored GREY more than once. Check color[w] == WHITE before calling dfs(w).`
      : !orderOk ? `Visit order was ${names(g, greys)} but it should be ${names(g, tr.order)}.`
      : !finOk ? `Visit order is right, but vertices finished (turned BLACK) in the order ${names(g, blacks)} instead of ${names(g, tr.finishOrder)}. A vertex turns BLACK only after its loop is done.`
      : `Visit order is right, but parent came out as [${globals.parent.join(", ")}] and should be [${tr.parent.join(", ")}].` });
    onFrames(frames);
  };

  const lines = code.split("\n");
  return (
    <div>
      <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap" style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted, borderBottom: `1px solid ${V.line}` }}>
        <span style={{ color: V.teal, fontWeight: 700, marginRight: 4 }}>{"⌨"} Code lab</span>
        <span style={{ color: V.text }}>dfs()</span>
        <div className="flex-1" />
        <button className="cq-btn" onClick={execute} style={btn({ background: V.teal, color: V.ink, fontWeight: 700 })}>Run {"▶"}</button>
        <button className="cq-btn" onClick={() => { setCode(DFS_STARTER); setStatus(null); onFrames(null); }} style={btn()}>Reset</button>
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
        Runs dfs({tr.s}) on this round's graph: vertex {tr.s} is {g.names[tr.s]}.
      </div>
      {status && (
        <div className="px-4 pb-3" style={{ fontFamily: MONO, fontSize: 12.5, color: status.pass ? V.teal : V.coral }}>
          {status.line && !status.pass ? `line ${status.line}: ` : ""}{status.msg}
        </div>
      )}
      {showAnswer && (
        <div className="px-4 pb-3">
          <div style={{ fontFamily: MONO, fontSize: 12, color: V.muted, marginBottom: 4 }}>Hint: {DFS_HINT}</div>
          <CppCode code={DFS_ANSWER} style={{ background: V.ink, color: V.text, padding: 10, borderRadius: 6, fontFamily: MONO, fontSize: 12 }} />
        </div>
      )}
    </div>
  );
}

// ---------- coach text ----------
function coachFor(r, phase) {
  const g = r.g, tr = r.tr, src = g.names[tr.s];
  if (r.kind === "step") {
    const at = g.names[r.at], nx = g.names[r.answer], from = g.names[tr.parent[r.answer]];
    const backed = r.events.filter((e) => e.type === "finish").map((e) => e.v);
    if (phase === "pick") return { title: `dfs(${at}) just started. Where does DFS go next?`, paras: [
      `${at} just turned grey. DFS now walks ${at}'s adjacency list (${names(g, g.adj[r.at]) || "empty"}) from left to right and dives into the FIRST white neighbor it finds, right away, before looking at the rest.`,
      "Grey vertices are visited but still exploring (they're on the call stack). Teal ones are finished. Both get skipped.",
      `If ${at} has no white neighbors, dfs(${at}) finishes and returns to the call below it on the stack, which carries on through its own list. Click the next vertex to turn grey.`] };
    return { title: `Next: ${nx}, reached from ${from}`, paras: [
      backed.length ? `DFS had to back up first: ${names(g, backed)} ran out of white neighbors and finished, so control returned down the stack to dfs(${from}), which found ${nx}.`
        : `${nx} was the first white vertex in ${from}'s list, so DFS called dfs(${nx}) immediately and set parent[${nx}] = ${from}.`,
      "That's the 'depth-first' part: go as deep as possible along one path, and only back up when you hit a dead end.",
      "The call stack is exactly the set of grey vertices, from the source at the bottom to the current vertex on top."] };
  }
  if (r.kind === "order") {
    if (phase === "order") return { title: `Visit order from ${src}`, paras: [
      g.tree ? "On a tree, DFS from the root is a preorder traversal: visit a node, then its whole left subtree, then its whole right subtree." : `DFS visits ${src} first, then dives into ${src}'s first neighbor, then that vertex's first unvisited neighbor, and so on until it's stuck.`,
      `When it's stuck it backs up to the most recent vertex that still has a white neighbor. Neighbors are checked in ${g.rule}.`,
      "Click the vertices in the order they turn grey (the order dfs() is called on them)."] };
    return { title: "The order", paras: [
      `${names(g, tr.order)}. Each label is d/f: the time a vertex turned grey (discovered) and the time it turned black (finished). A vertex finishes only after everything it discovered has finished.`,
      "The teal edges are the DFS tree: each vertex joined to the vertex whose dfs() call discovered it.",
      `Compare with BFS, which would have visited all of ${src}'s neighbors before going any deeper. DFS uses a stack (here, the recursion) where BFS uses a queue.`] };
  }
  const t = g.names[r.t];
  if (phase === "grey") return { title: `dfs(${t}) was just called. Which vertices are grey?`, paras: [
    `DFS started at ${src} and has just discovered ${t}. The colors are hidden: work it out from the adjacency lists.`,
    "A vertex is grey from the moment it's visited until its dfs() call returns. So the grey vertices are exactly the calls still on the stack: the chain from the source down to the current vertex.",
    "Vertices DFS already backed out of are black, not grey. Click every grey vertex besides " + t + " (it's grey already), then confirm."] };
  return { title: `Grey: ${names(g, r.answer)}`, paras: [
    `The call stack when ${t} was discovered: ${r.answer.map((v) => `dfs(${g.names[v]})`).join(" → ")}. Each one is waiting for the call above it to return.`,
    `Following parent pointers back from ${t} gives the same chain in reverse. That's why the grey vertices always form a single path in the DFS tree.`,
    "If DFS ever sees an edge to a grey vertex in a directed graph, that's a cycle. This is how DFS detects cycles and why topological sort uses finish times."] };
}

// ---------- the game ----------
export default function DfsArena({ mode, best = 0, onFinish, onExit, renderChat }) {
  const rounds = useMemo(() => dfsRounds(mode, rng(Date.now() % 1e9)), [mode]);
  const [round, setRound] = useState(0);
  const r = rounds[round];
  const g = r.g, tr = r.tr;
  const first = (x) => (x.kind === "step" ? "pick" : x.kind);
  const [phase, setPhase] = useState(first(r));
  const [picked, setPicked] = useState(null);                 // step mode: the vertex clicked
  const [picks, setPicks] = useState(() => new Set());        // grey mode: vertices selected
  const [clicks, setClicks] = useState([]);                   // order mode: { v, ok, tried }
  const [roundOk, setRoundOk] = useState(null);
  const [play, setPlay] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [labFrames, setLabFrames] = useState(null);
  const [labIdx, setLabIdx] = useState(0);

  const top = (s) => (s.length ? s[s.length - 1] : null);
  // Playback once the round is answered.
  const frames = useMemo(() => {
    const fromEvent = (e) => ({ ...e.after, cur: e.type === "check" ? e.u : top(e.after.stack), checking: e.type === "check" ? e.v : null, ev: e });
    if (r.kind === "step") return r.events.map(fromEvent);
    if (r.kind === "grey") return [{ ...tr.start, cur: null, checking: null }, ...tr.events.slice(0, r.idx + 1).filter((e) => e.type !== "check").map(fromEvent)];
    return [{ ...tr.end, cur: null, checking: null }];
  }, [r]);

  useEffect(() => {
    if (phase !== "done" || play >= frames.length - 1) return;
    const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setPlay((p) => p + 1), reduce ? 350 : r.kind === "grey" ? 550 : 850);
    return () => clearTimeout(t);
  }, [phase, play, frames]);
  useEffect(() => {
    if (!labFrames || labIdx >= labFrames.length - 1) return;
    const t = setTimeout(() => setLabIdx((i) => i + 1), 420);
    return () => clearTimeout(t);
  }, [labFrames, labIdx]);

  const award = (ok) => { if (ok) { const n = streak + 1; setStreak(n); setBestStreak((b) => Math.max(b, n)); setScore((sc) => sc + pointsFor(n)); } else setStreak(0); };
  const finishRound = (ok) => { setRoundOk(ok); if (ok) setCorrect((c) => c + 1); setPlay(0); setPhase("done"); };

  const pickNext = (v) => { setPicked(v); const ok = v === r.answer; award(ok); finishRound(ok); };
  const togglePick = (v) => setPicks((s) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; });
  const confirmGrey = () => {
    const want = r.answer.filter((v) => v !== r.t);
    const ok = picks.size === want.length && want.every((v) => picks.has(v));
    award(ok); finishRound(ok);
  };
  const clickOrder = (v) => {
    const want = tr.order[clicks.length + 1];
    const ok = v === want;
    award(ok);
    const nc = [...clicks, { v: want, ok, tried: v }];
    setClicks(nc);
    if (nc.length + 1 >= tr.order.length) finishRound(nc.every((c) => c.ok));
  };
  const next = () => {
    if (round + 1 >= rounds.length) { setFinished(true); onFinish && onFinish({ score, correct, bestStreak, xp: xpFor(correct) }); return; }
    const nr = rounds[round + 1];
    setRound(round + 1); setPhase(first(nr)); setPicked(null); setPicks(new Set()); setClicks([]); setRoundOk(null); setPlay(0); setLabFrames(null);
  };

  // ----- what the board shows right now -----
  const labFrame = labFrames && labFrames.length ? labFrames[Math.min(labIdx, labFrames.length - 1)] : null;
  const playing = phase === "done" && play < frames.length - 1;
  const fr = frames[Math.min(play, frames.length - 1)];
  let view, pickable = null, onPick = null;
  if (labFrame) view = { ...labFrame, showStack: true, showTree: true };
  else if (r.kind === "step") {
    if (phase === "pick") { view = { ...r.before, cur: r.at, showStack: true }; pickable = (v) => r.before.state[v] === "white"; onPick = pickNext; }
    else {
      const marks = {};
      if (!playing) { marks[r.answer] = picked === r.answer ? "right" : "missed"; if (picked !== r.answer && picked != null) marks[picked] = "wrong"; }
      view = { ...fr, showStack: true, showTree: true, marks };
    }
  } else if (r.kind === "order") {
    const state = g.names.map(() => "white"); const badges = {}; const marks = {};
    state[tr.s] = "grey"; badges[tr.s] = 1;
    clicks.forEach((c, i) => { state[c.v] = "grey"; badges[c.v] = i + 2; if (!c.ok) marks[c.v] = "missed"; });
    const last = clicks[clicks.length - 1];
    if (phase === "order" && last && !last.ok) marks[last.tried] = "wrong";
    if (phase === "done") view = { ...tr.end, badges, marks, showTree: true, showTimes: true, showStack: false };
    else { view = { state, stack: [], badges, marks, showStack: false }; pickable = (v) => state[v] === "white"; onPick = clickOrder; }
  } else {
    if (phase === "grey") { view = { ...r.at, stack: [], hideColors: true, target: r.t, picks, showStack: false }; pickable = (v) => v !== r.t; onPick = togglePick; }
    else {
      const marks = {};
      if (!playing) { r.answer.forEach((v) => { if (v !== r.t) marks[v] = picks.has(v) ? "right" : "missed"; }); picks.forEach((v) => { if (!r.answer.includes(v)) marks[v] = "wrong"; }); }
      view = { ...fr, target: playing ? null : r.t, showStack: true, showTree: !playing, marks };
    }
  }

  const c = coachFor(r, phase);
  const modeLabel = DFS_MODES.find((m) => m[0] === mode)?.[1] || mode;
  const unit = r.kind === "step" ? "step" : "graph";
  const shownSteps = r.kind === "step" ? r.k - 1 + (phase === "done" && !playing ? 1 : 0) : 0;
  const lastClick = clicks[clicks.length - 1];
  const sayEvent = (e) => !e ? "" : e.type === "check" ? `  checking ${g.names[e.v]} from ${g.names[e.u]}: ${e.fresh ? "white, call dfs(" + g.names[e.v] + ")" : `already ${e.after.state[e.v]}, skip`}`
    : e.type === "finish" ? `  ${g.names[e.v]} has no white neighbors left: it turns black and returns`
    : `  dfs(${g.names[e.v]}): ${g.names[e.v]} turns grey`;

  if (finished) return (
    <div style={{ border: `1px solid ${V.line}`, borderRadius: 12, background: V.panel, padding: 18, fontFamily: MONO }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: V.gold }}>DFS round over: {score} points</div>
      <div style={{ fontSize: 13, color: V.text, marginTop: 6 }}>{correct}/{rounds.length} {unit}s fully right, best streak {bestStreak}, +{xpFor(correct)} xp{score > best ? ", new best" : ""}</div>
      {r.kind === "step" && <div style={{ fontSize: 13, color: V.teal, marginTop: 6 }}>Visit order: {names(g, tr.order)} · finish order: {names(g, tr.finishOrder)}</div>}
      <div className="flex gap-2 mt-4"><button className="cq-btn" onClick={onExit} style={btn({ background: V.gold, color: V.ink, fontWeight: 700 })}>Back to modes</button></div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <style>{`.cq-dfs-v:focus:not(:focus-visible) { outline: none } @media (max-width: 1023px) { .cq-col { flex: none !important } }`}</style>
      <div className="cq-col" style={{ border: `1px solid ${V.gold}`, borderRadius: 12, background: V.panel, overflow: "hidden", flex: labOpen ? "1.6 1 0" : "3 1 0", minWidth: 0, width: "100%" }}>
        <div className="flex items-center gap-4 px-4 py-2.5 flex-wrap" style={{ borderBottom: `1px solid ${V.line}`, fontFamily: MONO, fontSize: 12.5 }}>
          <span style={{ color: V.muted }}>{unit} {round + 1}/{rounds.length}</span>
          <span style={{ color: V.gold, fontWeight: 700 }}>{score} pts</span>
          <span title="streak">{"🔥"} {streak}{streak >= 3 ? " (×3)" : streak === 2 ? " (×2)" : ""}</span>
          <div className="flex-1" />
          <span style={{ color: V.muted }}>{modeLabel}</span>
          <button className="cq-btn" onClick={() => { setLabOpen(!labOpen); setLabFrames(null); }} style={btn({ padding: "3px 10px", fontSize: 11.5, background: labOpen ? V.teal : V.panel2, color: labOpen ? V.ink : V.text })}>{"⌨"} code</button>
          <button className="cq-btn" onClick={onExit} style={btn({ padding: "3px 10px", fontSize: 11.5 })}>quit</button>
        </div>

        <div className="px-4 py-3" style={{ fontFamily: MONO, fontSize: 14, color: V.text, borderBottom: `1px solid ${V.line}` }}>
          <div style={{ fontSize: 11.5, color: V.muted, marginBottom: 4 }}>neighbors are checked in {g.rule}</div>
          DFS(G, {g.names[tr.s]})
          {r.kind === "step" && <span style={{ color: V.muted }}> · just called dfs(<span style={{ color: V.gold }}>{g.names[r.at]}</span>)</span>}
          {r.kind === "grey" && <span style={{ color: V.muted }}> · just called dfs(<span style={{ color: V.gold }}>{g.names[r.t]}</span>)</span>}
          {labFrame && <span style={{ color: V.teal }}>{" "}playing your code</span>}
        </div>

        <div className="px-4">
          <Board g={g} view={view} pickable={labFrame ? null : pickable} onPick={onPick} showIndex={labOpen} />
          <div className="flex items-center gap-4 flex-wrap pb-3" style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted }}>
            {view.hideColors ? <span>colors hidden: you decide which are grey</span> : <>
              <span><span style={{ color: V.muted }}>{"○"}</span> white: not visited</span>
              <span><span style={{ color: V.grey }}>{"●"}</span> grey: visited, still exploring</span>
              <span><span style={{ color: V.teal }}>{"●"}</span> black: finished</span>
            </>}
            {(r.kind === "step" || labFrame) && <span><span style={{ color: V.gold }}>{"○"}</span> current call</span>}
          </div>
        </div>

        <div className="px-4 py-3" style={{ borderTop: `1px solid ${V.line}`, minHeight: 64 }}>
          {labFrame ? (
            <span style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted }}>{labFrame.say}</span>
          ) : phase === "pick" ? (
            <span style={{ fontFamily: MONO, fontSize: 13, color: V.text }}>Click the next vertex DFS visits (the next one to turn grey).</span>
          ) : phase === "order" ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontFamily: MONO, fontSize: 13, color: V.text }}>Click vertex #{clicks.length + 2} in DFS order.</span>
              {lastClick && (
                <span style={{ fontFamily: MONO, fontSize: 12, color: lastClick.ok ? V.teal : V.coral }}>
                  {lastClick.ok ? `✓ #${clicks.length + 1} is ${g.names[lastClick.v]}` : `✗ #${clicks.length + 1} was ${g.names[lastClick.v]}, not ${g.names[lastClick.tried]}`}
                </span>
              )}
            </div>
          ) : phase === "grey" ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontFamily: MONO, fontSize: 13, color: V.text }}>Grey besides {g.names[r.t]}:</span>
              <span style={{ fontFamily: MONO, fontSize: 13, color: V.gold }}>{picks.size ? names(g, [...picks].sort((x, y) => x - y)) : "(none selected)"}</span>
              <div className="flex-1" />
              <button className="cq-btn" onClick={confirmGrey} style={btn({ background: V.gold, color: V.ink, fontWeight: 700 })}>{picks.size ? "These are grey" : "Only " + g.names[r.t]} {"▶"}</button>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: roundOk ? V.teal : V.coral }}>
                {r.kind === "step" ? (roundOk ? `✓ right! DFS goes to ${g.names[r.answer]}` : `✗ DFS goes to ${g.names[r.answer]}, not ${g.names[picked]}`)
                  : r.kind === "order" ? (roundOk ? `✓ all ${tr.order.length - 1} right: ${names(g, tr.order)}` : `${clicks.filter((x) => x.ok).length}/${clicks.length} right. Order: ${names(g, tr.order)}`)
                  : (roundOk ? `✓ right! grey: ${names(g, r.answer)}` : `✗ grey: ${names(g, r.answer)}`)}
                <span style={{ color: V.muted, fontWeight: 400 }}>{playing ? (r.kind === "grey" ? "  replaying DFS…" : sayEvent(fr.ev)) : ""}</span>
              </span>
              <div className="flex-1" />
              <button className="cq-btn" onClick={next} disabled={playing} style={btn({ background: playing ? V.panel2 : V.gold, color: playing ? V.muted : V.ink, fontWeight: 700 })}>
                {round + 1 >= rounds.length ? "Finish" : r.kind === "step" ? "Next step" : "Next graph"} {"▶"}
              </button>
            </div>
          )}
        </div>

        {/* trace table */}
        {shownSteps > 0 && !labFrame && (
          <div className="px-4 pb-4" style={{ overflowX: "auto" }}>
            <table style={{ fontFamily: MONO, fontSize: 12, color: V.text, borderCollapse: "collapse", width: "100%" }}>
              <thead><tr style={{ color: V.muted, textAlign: "left" }}>{["#", "visited", "from", "backed out of first", "call stack after"].map((h) => <th key={h} style={{ padding: "4px 8px", borderBottom: `1px solid ${V.line}`, fontWeight: 500 }}>{h}</th>)}</tr></thead>
              <tbody>
                {rounds.slice(0, shownSteps).map((x, n) => {
                  const fin = x.events.filter((e) => e.type === "finish").map((e) => e.v);
                  return (
                    <tr key={n}>
                      <td style={{ padding: "4px 8px", color: V.muted }}>{n + 2}</td>
                      <td style={{ padding: "4px 8px", color: V.gold }}>{g.names[x.answer]}</td>
                      <td style={{ padding: "4px 8px" }}>{g.names[tr.parent[x.answer]]}</td>
                      <td style={{ padding: "4px 8px", color: V.teal }}>{names(g, fin) || "—"}</td>
                      <td style={{ padding: "4px 8px", color: V.grey }}>{names(g, x.events[x.events.length - 1].after.stack)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {labOpen && (
        <div className="cq-col" style={{ flex: "1.45 1 0", minWidth: 0, width: "100%" }}>
          <div style={{ border: `1px solid ${V.teal}`, borderRadius: 12, background: V.panel, overflow: "hidden" }}>
            <CodeLab r={r} onFrames={(f) => { setLabFrames(f); setLabIdx(0); }}
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
              dfs(v): color[v] = GREY; for (w : adj[v]) if (color[w] == WHITE) dfs(w); color[v] = BLACK;
            </div>
          </div>
        </div>
        {renderChat && renderChat(() => ({
          title: `Arena — depth-first search${labOpen ? " (code lab)" : ""}`,
          challenge: `This is the Arena DFS game, not a coding exercise. dfs(v): color v GREY (visited), then for each neighbor w of v in adjacency-list order, if w is still WHITE set parent[w] = v and call dfs(w) immediately; when the loop ends, color v BLACK (finished). Grey vertices are exactly the calls on the recursion stack; DFS backs up only when the current vertex has no white neighbors. Running time O(V + E). On a tree, DFS from the root is a preorder traversal. The player ${r.kind === "step" ? "clicks the next vertex DFS visits" : r.kind === "order" ? "clicks the vertices in the order DFS visits them" : "clicks every vertex that is grey at the moment a given vertex is discovered"}.`,
          code: `// Source: ${g.names[tr.s]}. Neighbors checked in ${g.rule}.\n// Adjacency lists:\n${g.names.map((nm, u) => `//   ${nm}: ${names(g, g.adj[u]) || "(none)"}`).join("\n")}\n// DFS visit order: ${names(g, tr.order)}\n// Finish order: ${names(g, tr.finishOrder)}${r.kind === "step" ? `\n// This round: dfs(${g.names[r.at]}) just started with stack [${names(g, r.before.stack)}]; next visited: ${g.names[r.answer]}` : r.kind === "grey" ? `\n// Question: which vertices are grey when ${g.names[r.t]} is discovered? Answer: ${names(g, r.answer)}` : ""}`,
          summary: `Phase: ${phase}. ${r.kind === "step" ? `Player picked: ${picked == null ? "nothing yet" : g.names[picked]}${phase === "done" ? (roundOk ? " (right)" : " (wrong)") : ""}.` : r.kind === "order" ? `Clicks so far: ${clicks.map((x, n) => `#${n + 2} ${x.ok ? "right" : `wrong (picked ${g.names[x.tried]}, was ${g.names[x.v]})`}`).join(", ") || "none"}.` : `Player selected: ${names(g, [...picks]) || "nothing"}${phase === "done" ? (roundOk ? " (right)" : " (wrong)") : " (not confirmed yet)"}.`}`,
        }))}
      </div>
    </div>
  );
}
