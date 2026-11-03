import { useState, useEffect, useMemo } from "react";
import { rng, pointsFor, xpFor } from "./arenasim.js";
import { bfsRounds, edgeList, pathTo, BOARD_W, BOARD_H } from "./bfssim.js";
import { run as runCpp } from "./cppmini.js";
import { CppEditor, CppCode } from "./cpphl.jsx";

const V = { ink: "#141924", line: "#3A4358", panel: "#242B3A", panel2: "#2C3446", text: "#E8E6DF", muted: "#9AA3B5", gold: "#F2B84B", teal: "#5FD3BC", coral: "#E86F6F", blue: "#4C9EE8" };
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const btn = (extra = {}) => ({ fontFamily: MONO, fontSize: 12.5, padding: "6px 14px", borderRadius: 6, cursor: "pointer", background: V.panel2, color: V.text, border: `1px solid ${V.line}`, ...extra });
const R = 21;

export const BFS_MODES = [
  ["bfs-step", "BFS: who gets enqueued? (textbook graph)"],
  ["bfs-order", "BFS: visit order"],
  ["bfs-dist", "BFS: how far is it?"],
  ["bfs-step-rand", "BFS: full run (random graph)"],
];

const ekey = (u, v) => `${Math.min(u, v)}-${Math.max(u, v)}`;
const names = (g, vs) => vs.map((v) => g.names[v]).join(", ");

// ---------- the board: the graph, its adjacency lists, and the queue ----------
// view: { state[], dist[], queue[], cur, checking, showDist, showQueue, badges{}, marks{}, picks(Set), target, path[] }
function Board({ g, view, pickable, onPick, showIndex }) {
  const edges = useMemo(() => edgeList(g), [g]);
  const pathEdges = new Set();
  (view.path || []).forEach((v, i, p) => { if (i) pathEdges.add(ekey(p[i - 1], v)); });
  const treeEdge = (u, v) => view.showTree && view.parent && (view.parent[v] === u || view.parent[u] === v);
  const fill = (v) => (view.state[v] === "done" ? "#1F4C47" : view.state[v] === "queued" ? "#233F63" : V.ink);
  return (
    <div className="flex flex-wrap gap-3 items-start" style={{ padding: "10px 0 6px" }}>
      <div style={{ flex: "1 1 300px", minWidth: 0, overflowX: "auto", borderRadius: 8 }}>
        <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} style={{ width: "100%", minWidth: 400, display: "block", background: V.ink, borderRadius: 8 }} role="img" aria-label="Graph for breadth-first search">
          {edges.map(([u, v]) => {
            const checking = view.cur != null && view.checking != null && ekey(u, v) === ekey(view.cur, view.checking);
            const onPath = pathEdges.has(ekey(u, v));
            const tree = treeEdge(u, v);
            return <line key={u + ":" + v} x1={g.pos[u].x} y1={g.pos[u].y} x2={g.pos[v].x} y2={g.pos[v].y}
              stroke={checking || onPath ? V.gold : tree ? V.teal : V.line} strokeWidth={checking || onPath ? 4 : tree ? 3 : 2} strokeLinecap="round" />;
          })}
          {g.names.map((nm, v) => {
            const isCur = view.cur === v, isChk = view.checking === v, isTarget = view.target === v;
            const picked = view.picks && view.picks.has(v);
            const mark = view.marks ? view.marks[v] : null;
            const stroke = mark === "right" ? V.teal : mark === "wrong" ? V.coral : mark === "missed" ? V.gold : isCur || isTarget || picked ? V.gold : isChk ? V.text : view.state[v] === "queued" ? V.blue : view.state[v] === "done" ? V.teal : V.muted;
            const can = pickable && pickable(v);
            const d = view.dist ? view.dist[v] : -1;
            const badge = view.badges ? view.badges[v] : null;
            return (
              <g key={v} className={can ? "cq-btn cq-bfs-v" : "cq-bfs-v"} onClick={() => can && onPick(v)} role={can ? "button" : undefined} tabIndex={can ? 0 : undefined}
                onKeyDown={(e) => { if (can && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onPick(v); } }}
                aria-label={`vertex ${nm}${isCur ? ", just dequeued" : ""}${picked ? ", selected" : ""}${isTarget ? ", the target" : ""}`} style={{ cursor: can ? "pointer" : "default" }}>
                <circle cx={g.pos[v].x} cy={g.pos[v].y} r={R} fill={picked || isTarget ? "#4A3F2A" : fill(v)} stroke={stroke}
                  strokeWidth={isCur || picked || mark || isTarget ? 3.5 : 2} strokeDasharray={can && !picked ? "5 4" : undefined} />
                <text x={g.pos[v].x} y={g.pos[v].y + 5.5} textAnchor="middle" fontFamily={MONO} fontSize={nm.length > 1 ? 14 : 17} fontWeight="700" fill={V.text}>{nm}</text>
                {view.showDist && d >= 0 && (
                  <g><rect x={g.pos[v].x + R - 1} y={g.pos[v].y - R - 7} width="34" height="17" rx="5" fill={V.ink} stroke={V.line} strokeWidth="1" />
                    <text x={g.pos[v].x + R + 16} y={g.pos[v].y - R + 6} textAnchor="middle" fontFamily={MONO} fontSize="12" fontWeight="700" fill={V.gold}>d={d}</text></g>
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
      {view.showQueue && (
        <div className="flex items-center gap-2 flex-wrap" style={{ flex: "1 1 100%", fontFamily: MONO, fontSize: 12.5, color: V.muted, minHeight: 44 }}>
          <span style={{ width: 52 }}>queue</span>
          <span style={{ fontSize: 11, color: V.blue }}>front {"▸"}</span>
          {view.queue.length ? view.queue.map((v, i) => (
            <div key={v + ":" + i} style={{ minWidth: 38, height: 38, padding: "0 6px", borderRadius: 7, display: "grid", placeItems: "center", fontSize: 15, fontWeight: 700,
              border: `2px solid ${V.blue}`, background: "#233F63", color: V.text }}>{g.names[v]}</div>
          )) : <span style={{ color: "#6b7590" }}>(empty)</span>}
          <span style={{ fontSize: 11, color: V.blue }}>{"◂"} back</span>
          {view.cur != null && <span style={{ marginLeft: 8 }}>dequeued: <b style={{ color: V.gold }}>{g.names[view.cur]}</b></span>}
        </div>
      )}
    </div>
  );
}

// ---------- code lab ----------
const BFS_ANSWER = `void bfs(int s) {
  queue<int> q;
  visited[s] = true;
  dist[s] = 0;
  q.push(s);

  while (!q.empty()) {
    int u = q.front();
    q.pop();
    for (int v : adj[u]) {
      if (!visited[v]) {
        visited[v] = true;
        dist[v] = dist[u] + 1;
        parent[v] = u;
        q.push(v);
      }
    }
  }
}`;
const BFS_STARTER = `// The graph has n vertices, numbered 0..n-1 (the small [k] labels).
// adj[u] is the list of u's neighbors.
// Already set up for you, all of size n:
//   visited[]  starts false
//   dist[]     starts -1 (meaning "not reached")
//   parent[]   starts -1
void bfs(int s) {
  queue<int> q;
  visited[s] = true;
  dist[s] = 0;
  q.push(s);

  while (!q.empty()) {
    int u = q.front();
    q.pop();

    // TODO: look at every neighbor v of u.
    //       If v hasn't been visited: mark it visited,
    //       set dist[v] and parent[v], and push it.
  }
}`;
const BFS_HINT = "for (int v : adj[u]) { if (!visited[v]) { visited[v] = true; dist[v] = dist[u] + 1; parent[v] = u; q.push(v); } }";

function CodeLab({ r, onFrames, activeLine }) {
  const [code, setCode] = useState(BFS_STARTER);
  const [status, setStatus] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const g = r.g, tr = r.tr, n = g.names.length;
  useEffect(() => { setStatus(null); onFrames(null); }, [tr]);

  const execute = () => {
    const globals = { adj: g.adj.map((l) => [...l]), visited: new Array(n).fill(0), dist: new Array(n).fill(-1), parent: new Array(n).fill(-1) };
    let res;
    try { res = runCpp(code, { a: new Array(n).fill(0), count: n, globals, trackWrites: true, maxSteps: 8000, what: "the vertices", call: { name: "bfs", args: [tr.s] } }); }
    catch (e) { setStatus({ line: e && e.line, msg: e && e.msg ? e.msg : String(e) }); onFrames(null); return; }
    // Replay what the player's code did to the queue and the arrays.
    let state = new Array(n).fill("new"), dist = new Array(n).fill(-1), queue = [], cur = null;
    const frames = [{ state, dist, queue, cur, line: 0, say: "your code's starting graph" }];
    const pops = [], pushes = [];
    for (const t of res.trace) {
      const nt = t.note;
      if (!nt) continue;
      const inRange = (v) => Number.isInteger(v) && v >= 0 && v < n;
      if (nt.kind === "qpush" && inRange(nt.v)) {
        pushes.push(nt.v); queue = [...queue, nt.v]; state = [...state]; if (state[nt.v] === "new") state[nt.v] = "queued";
        frames.push({ state, dist, queue, cur, line: t.line, say: `q.push(${nt.v})  // ${g.names[nt.v]}` });
      } else if (nt.kind === "qpop" && inRange(nt.v)) {
        pops.push(nt.v); queue = queue.slice(1); state = [...state]; if (cur != null) state[cur] = "done"; cur = nt.v;
        frames.push({ state, dist, queue, cur, line: t.line, say: `q.pop()  // ${g.names[nt.v]} leaves the queue` });
      } else if (nt.kind === "set" && nt.arr === "dist") {
        dist = [...dist]; dist[nt.i] = nt.v;
        frames.push({ state, dist, queue, cur, line: t.line, say: `dist[${nt.i}] = ${nt.v}  // ${g.names[nt.i]}` });
      }
    }
    if (cur != null) { state = [...state]; state[cur] = "done"; frames.push({ state, dist, queue, cur: null, line: 0, say: "queue is empty: done" }); }
    const twice = pushes.find((v, i) => pushes.indexOf(v) !== i);
    if (!res.ok) {
      const loop = /too long/.test(res.error.msg) && twice !== undefined;
      setStatus({ line: res.error.line, msg: res.error.msg + (loop ? ` Vertex ${twice} (${g.names[twice]}) keeps getting pushed again: mark a vertex visited when you push it.` : "") });
      onFrames(loop ? frames.slice(0, 60) : frames); return;
    }
    const want = tr.dist.join(", "), got = globals.dist.join(", ");
    const orderOk = pops.join(",") === tr.order.join(",");
    const parentOk = globals.parent.join(",") === tr.parent.join(",");
    const pass = want === got && orderOk && parentOk && twice === undefined;
    setStatus({ pass, msg: pass
      ? `Your BFS visited ${names(g, pops)} and set dist = [${got}]. That matches.`
      : !pushes.length ? "Nothing was pushed, so the loop never ran. Does bfs() push s?"
      : twice !== undefined ? `Vertex ${twice} (${g.names[twice]}) was pushed more than once. Mark a vertex visited when you push it, not when you pop it.`
      : pops.length <= 1 && n > 1 && tr.order.length > 1 ? "Only the source left the queue. Nothing is being pushed inside the loop yet."
      : want !== got ? `dist came out as [${got}] but it should be [${want}].`
      : !orderOk ? `Visit order was ${names(g, pops)} but it should be ${names(g, tr.order)}.`
      : `dist is right, but parent came out as [${globals.parent.join(", ")}] and should be [${tr.parent.join(", ")}].` });
    onFrames(frames);
  };

  const lines = code.split("\n");
  return (
    <div>
      <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap" style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted, borderBottom: `1px solid ${V.line}` }}>
        <span style={{ color: V.teal, fontWeight: 700, marginRight: 4 }}>{"⌨"} Code lab</span>
        <span style={{ color: V.text }}>bfs()</span>
        <div className="flex-1" />
        <button className="cq-btn" onClick={execute} style={btn({ background: V.teal, color: V.ink, fontWeight: 700 })}>Run {"▶"}</button>
        <button className="cq-btn" onClick={() => { setCode(BFS_STARTER); setStatus(null); onFrames(null); }} style={btn()}>Reset</button>
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
        Runs bfs({tr.s}) on this round's graph: vertex {tr.s} is {g.names[tr.s]}.
      </div>
      {status && (
        <div className="px-4 pb-3" style={{ fontFamily: MONO, fontSize: 12.5, color: status.pass ? V.teal : V.coral }}>
          {status.line && !status.pass ? `line ${status.line}: ` : ""}{status.msg}
        </div>
      )}
      {showAnswer && (
        <div className="px-4 pb-3">
          <div style={{ fontFamily: MONO, fontSize: 12, color: V.muted, marginBottom: 4 }}>Hint: {BFS_HINT}</div>
          <CppCode code={BFS_ANSWER} style={{ background: V.ink, color: V.text, padding: 10, borderRadius: 6, fontFamily: MONO, fontSize: 12 }} />
        </div>
      )}
    </div>
  );
}

// ---------- coach text ----------
function coachFor(r, phase, ctx) {
  const g = r.g, tr = r.tr, src = g.names[tr.s];
  if (r.kind === "step") {
    const st = r.st, u = g.names[st.u];
    if (phase === "pick") return { title: `${u} was just dequeued. Who gets enqueued?`, paras: [
      `BFS took ${u} off the front of the queue. Now it walks ${u}'s adjacency list (${names(g, g.adj[st.u]) || "empty"}) from left to right.`,
      "A neighbor is enqueued only if it has never been discovered. Blue vertices are already waiting in the queue and green ones are finished, so both get skipped.",
      "Click every vertex that gets enqueued now, then confirm. If there are none, confirm with nothing selected."] };
    return { title: st.found.length ? `Enqueued: ${names(g, st.found)}` : "Nothing new", paras: [
      st.found.length ? `Each new vertex got d = d[${u}] + 1 = ${tr.dist[st.u] + 1} and its parent set to ${u}. They joined the BACK of the queue, in adjacency-list order.` : `Every neighbor of ${u} had already been discovered, so nothing was enqueued. That's normal near the end of a run.`,
      `${u} is finished: it never goes back in the queue. Each vertex is enqueued once and dequeued once.`,
      "The queue always holds vertices in non-decreasing distance, which is why the first time BFS reaches a vertex is along a shortest path."] };
  }
  if (r.kind === "order") {
    if (phase === "order") return { title: `Visit order from ${src}`, paras: [
      g.tree ? "On a tree, BFS from the root is level-order traversal: the whole of one level, left to right, before anything on the next level." : `BFS visits ${src} first, then everything 1 edge away, then everything 2 edges away, and so on.`,
      `Within a level the order comes from the queue. Run it in your head: dequeue the front vertex, then add its undiscovered neighbors to the back, checking them in ${g.rule}.`,
      "Click the vertices in the order they leave the queue."] };
    return { title: "The order", paras: [
      `${names(g, tr.order)}. The d labels show each vertex's level: BFS finished every vertex at distance k before starting distance k + 1.`,
      "The teal edges are the BFS tree: each vertex joined to the parent that discovered it.",
      "Swap the queue for a stack and you get depth-first search instead, which dives down one branch before backing up."] };
  }
  const t = g.names[r.target];
  if (phase === "dist") return { title: `How far is ${t} from ${src}?`, paras: [
    `d[${t}] is the fewest edges on any path from ${src} to ${t}. BFS computes it for every vertex in one pass.`,
    `Work outward in rings: ${src} is 0, its neighbors are 1, their undiscovered neighbors are 2. Stop when you label ${t}.`,
    `If no path reaches ${t} at all, BFS never discovers it and its distance stays ∞.`] };
  return { title: r.answer < 0 ? `${t} can't be reached` : `d[${t}] = ${r.answer}`, paras: [
    r.answer < 0 ? `${t} has no edge to anything, so the queue emptied without ever discovering it. Its distance stays ∞ (code usually stores -1 or INT_MAX).`
      : `The gold path ${names(g, pathTo(tr, r.target)).replace(/, /g, " → ")} is the one BFS found by following parent pointers back from ${t}. Other paths of the same length may exist, but none shorter.`,
    "BFS only gives shortest paths when every edge counts the same. With weighted edges you need Dijkstra's algorithm.",
    "Running time is O(V + E): each vertex is dequeued once and each adjacency list is scanned once."] };
}

// ---------- the game ----------
export default function BfsArena({ mode, best = 0, onFinish, onExit, renderChat }) {
  const rounds = useMemo(() => bfsRounds(mode, rng(Date.now() % 1e9)), [mode]);
  const [round, setRound] = useState(0);
  const r = rounds[round];
  const g = r.g, tr = r.tr;
  const first = (x) => (x.kind === "step" ? "pick" : x.kind);
  const [phase, setPhase] = useState(first(r));
  const [picks, setPicks] = useState(() => new Set());        // step mode: vertices selected to enqueue
  const [clicks, setClicks] = useState([]);                   // order mode: { v, ok } for positions 1..
  const [answer, setAnswer] = useState(null);                 // dist mode
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

  // Playback once the round is answered.
  const frames = useMemo(() => {
    if (r.kind === "step") {
      const st = r.st;
      return [...st.checks.map((c) => ({ ...c.after, cur: st.u, checking: c.v, fresh: c.fresh })), { ...st.after, cur: null, checking: null }];
    }
    if (r.kind === "dist") return [{ ...tr.start }, ...tr.steps.map((st) => ({ ...st.after }))];
    return [{ ...tr.end }];
  }, [r]);

  useEffect(() => {
    if (phase !== "done" || play >= frames.length - 1) return;
    const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setPlay((p) => p + 1), reduce ? 350 : r.kind === "dist" ? 600 : 800);
    return () => clearTimeout(t);
  }, [phase, play, frames]);
  useEffect(() => {
    if (!labFrames || labIdx >= labFrames.length - 1) return;
    const t = setTimeout(() => setLabIdx((i) => i + 1), 380);
    return () => clearTimeout(t);
  }, [labFrames, labIdx]);

  const award = (ok) => { if (ok) { const n = streak + 1; setStreak(n); setBestStreak((b) => Math.max(b, n)); setScore((sc) => sc + pointsFor(n)); } else setStreak(0); };
  const finishRound = (ok) => { setRoundOk(ok); if (ok) setCorrect((c) => c + 1); setPlay(0); setPhase("done"); };

  const togglePick = (v) => setPicks((s) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; });
  const confirmPicks = () => {
    const want = r.st.found;
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
  const answerDist = (d) => { setAnswer(d); const ok = d === r.answer; award(ok); finishRound(ok); };
  const next = () => {
    if (round + 1 >= rounds.length) { setFinished(true); onFinish && onFinish({ score, correct, bestStreak, xp: xpFor(correct) }); return; }
    const nr = rounds[round + 1];
    setRound(round + 1); setPhase(first(nr)); setPicks(new Set()); setClicks([]); setAnswer(null); setRoundOk(null); setPlay(0); setLabFrames(null);
  };

  // ----- what the board shows right now -----
  const labFrame = labFrames && labFrames.length ? labFrames[Math.min(labIdx, labFrames.length - 1)] : null;
  const playing = phase === "done" && play < frames.length - 1;
  const fr = frames[Math.min(play, frames.length - 1)];
  let view, pickable = null, onPick = null;
  if (labFrame) view = { ...labFrame, showDist: true, showQueue: true };
  else if (r.kind === "step") {
    if (phase === "pick") { view = { ...r.st.popped, cur: r.st.u, showDist: true, showQueue: true, picks }; pickable = (v) => v !== r.st.u; onPick = togglePick; }
    else {
      const marks = {};
      if (!playing) { r.st.found.forEach((v) => { marks[v] = picks.has(v) ? "right" : "missed"; }); picks.forEach((v) => { if (!r.st.found.includes(v)) marks[v] = "wrong"; }); }
      view = { ...fr, showDist: true, showQueue: true, marks };
    }
  } else if (r.kind === "order") {
    const state = g.names.map(() => "new"); const badges = {}; const marks = {};
    state[tr.s] = "done"; badges[tr.s] = 1;
    clicks.forEach((c, i) => { state[c.v] = "done"; badges[c.v] = i + 2; if (!c.ok) marks[c.v] = "missed"; });
    const last = clicks[clicks.length - 1];
    if (phase === "order" && last && !last.ok) marks[last.tried] = "wrong";
    view = { state, badges, marks, dist: tr.dist, parent: tr.parent, showDist: phase === "done", showTree: phase === "done", queue: [], showQueue: false };
    if (phase === "order") { pickable = (v) => state[v] === "new"; onPick = clickOrder; }
  } else {
    if (phase === "dist") view = { ...tr.start, target: r.target, showDist: true, showQueue: false };
    else view = { ...fr, target: r.target, showDist: true, showQueue: false, path: playing ? [] : pathTo(tr, r.target) };
  }

  const c = coachFor(r, phase);
  const modeLabel = BFS_MODES.find((m) => m[0] === mode)?.[1] || mode;
  const unit = r.kind === "step" ? "dequeue" : "graph";
  const shownSteps = r.kind === "step" ? r.k + (phase === "done" && !playing ? 1 : 0) : 0;
  const lastClick = clicks[clicks.length - 1];
  const distChoices = [1, 2, 3, 4, 5, -1];
  const dlabel = (d) => (d < 0 ? "∞" : String(d));

  if (finished) return (
    <div style={{ border: `1px solid ${V.line}`, borderRadius: 12, background: V.panel, padding: 18, fontFamily: MONO }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: V.gold }}>BFS round over: {score} points</div>
      <div style={{ fontSize: 13, color: V.text, marginTop: 6 }}>{correct}/{rounds.length} {unit}s fully right, best streak {bestStreak}, +{xpFor(correct)} xp{score > best ? ", new best" : ""}</div>
      {r.kind === "step" && <div style={{ fontSize: 13, color: V.teal, marginTop: 6 }}>Visit order: {names(g, tr.order)} · distances: {g.names.map((nm, v) => `${nm}=${dlabel(tr.dist[v])}`).join(", ")}</div>}
      <div className="flex gap-2 mt-4"><button className="cq-btn" onClick={onExit} style={btn({ background: V.gold, color: V.ink, fontWeight: 700 })}>Back to modes</button></div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <style>{`.cq-bfs-v:focus:not(:focus-visible) { outline: none } @media (max-width: 1023px) { .cq-col { flex: none !important } }`}</style>
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
          BFS(G, {g.names[tr.s]})
          {r.kind === "step" && <span style={{ color: V.muted }}> · u = <span style={{ color: V.gold }}>{g.names[r.st.u]}</span>, d[{g.names[r.st.u]}] = {tr.dist[r.st.u]}</span>}
          {r.kind === "dist" && <span style={{ color: V.muted }}> · find d[<span style={{ color: V.gold }}>{g.names[r.target]}</span>]</span>}
          {labFrame && <span style={{ color: V.teal }}>{" "}playing your code</span>}
        </div>

        <div className="px-4">
          <Board g={g} view={view} pickable={labFrame ? null : pickable} onPick={onPick} showIndex={labOpen} />
          <div className="flex items-center gap-4 flex-wrap pb-3" style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted }}>
            <span><span style={{ color: V.muted }}>{"○"}</span> not discovered</span>
            {r.kind !== "order" || labFrame ? <span><span style={{ color: V.blue }}>{"●"}</span> in the queue</span> : null}
            <span><span style={{ color: V.teal }}>{"●"}</span> finished</span>
            {(r.kind === "step" || labFrame) && <span><span style={{ color: V.gold }}>{"○"}</span> just dequeued (u)</span>}
            {r.kind === "dist" && !labFrame && <span><span style={{ color: V.gold }}>{"●"}</span> target</span>}
          </div>
        </div>

        <div className="px-4 py-3" style={{ borderTop: `1px solid ${V.line}`, minHeight: 64 }}>
          {labFrame ? (
            <span style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted }}>{labFrame.say}</span>
          ) : phase === "pick" ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontFamily: MONO, fontSize: 13, color: V.text }}>Click every vertex that {g.names[r.st.u]} enqueues:</span>
              <span style={{ fontFamily: MONO, fontSize: 13, color: V.gold }}>{picks.size ? names(g, [...picks].sort((x, y) => x - y)) : "(none selected)"}</span>
              <div className="flex-1" />
              <button className="cq-btn" onClick={confirmPicks} style={btn({ background: V.gold, color: V.ink, fontWeight: 700 })}>{picks.size ? `Enqueue ${picks.size === 1 ? "it" : "these"}` : "Enqueue nothing"} {"▶"}</button>
            </div>
          ) : phase === "order" ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontFamily: MONO, fontSize: 13, color: V.text }}>Click vertex #{clicks.length + 2} in BFS order.</span>
              {lastClick && (
                <span style={{ fontFamily: MONO, fontSize: 12, color: lastClick.ok ? V.teal : V.coral }}>
                  {lastClick.ok ? `✓ #${clicks.length + 1} is ${g.names[lastClick.v]}` : `✗ #${clicks.length + 1} was ${g.names[lastClick.v]}, not ${g.names[lastClick.tried]}`}
                </span>
              )}
            </div>
          ) : phase === "dist" ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontFamily: MONO, fontSize: 13, color: V.text, marginRight: 4 }}>d[{g.names[r.target]}] =</span>
              {distChoices.map((d) => (
                <button key={d} className="cq-btn" onClick={() => answerDist(d)} aria-label={d < 0 ? "infinity, cannot be reached" : `distance ${d}`}
                  style={btn({ minWidth: 44, border: `1px solid ${d < 0 ? V.coral : V.teal}`, color: d < 0 ? V.coral : V.teal })}>{d < 0 ? "∞ no path" : d}</button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: roundOk ? V.teal : V.coral }}>
                {r.kind === "step" ? (roundOk ? `✓ right! ${r.st.found.length ? `${names(g, r.st.found)} joined the queue` : "nothing new to enqueue"}` : `✗ ${g.names[r.st.u]} enqueues ${r.st.found.length ? names(g, r.st.found) : "nothing"}, not ${picks.size ? names(g, [...picks].sort((x, y) => x - y)) : "nothing"}`)
                  : r.kind === "order" ? (roundOk ? `✓ all ${tr.order.length - 1} right: ${names(g, tr.order)}` : `${clicks.filter((x) => x.ok).length}/${clicks.length} right. Order: ${names(g, tr.order)}`)
                  : (roundOk ? `✓ right! d[${g.names[r.target]}] = ${dlabel(r.answer)}` : `✗ d[${g.names[r.target]}] = ${dlabel(r.answer)}, not ${dlabel(answer)}`)}
                <span style={{ color: V.muted, fontWeight: 400 }}>{playing ? (r.kind === "step" ? `  checking ${g.names[fr.checking]}: ${fr.fresh ? "new, enqueue it" : "already discovered, skip"}` : "  running BFS…") : ""}</span>
              </span>
              <div className="flex-1" />
              <button className="cq-btn" onClick={next} disabled={playing} style={btn({ background: playing ? V.panel2 : V.gold, color: playing ? V.muted : V.ink, fontWeight: 700 })}>
                {round + 1 >= rounds.length ? "Finish" : r.kind === "step" ? "Next dequeue" : "Next graph"} {"▶"}
              </button>
            </div>
          )}
        </div>

        {/* trace table */}
        {shownSteps > 0 && !labFrame && (
          <div className="px-4 pb-4" style={{ overflowX: "auto" }}>
            <table style={{ fontFamily: MONO, fontSize: 12, color: V.text, borderCollapse: "collapse", width: "100%" }}>
              <thead><tr style={{ color: V.muted, textAlign: "left" }}>{["dequeued u", "d[u]", "checked", "enqueued", "queue after"].map((h) => <th key={h} style={{ padding: "4px 8px", borderBottom: `1px solid ${V.line}`, fontWeight: 500 }}>{h}</th>)}</tr></thead>
              <tbody>
                {tr.steps.slice(0, shownSteps).map((st, n) => (
                  <tr key={n}>
                    <td style={{ padding: "4px 8px", color: V.gold }}>{g.names[st.u]}</td>
                    <td style={{ padding: "4px 8px" }}>{tr.dist[st.u]}</td>
                    <td style={{ padding: "4px 8px", color: V.muted }}>{names(g, g.adj[st.u]) || "—"}</td>
                    <td style={{ padding: "4px 8px", color: V.teal }}>{names(g, st.found) || "—"}</td>
                    <td style={{ padding: "4px 8px", color: V.blue }}>{names(g, st.after.queue) || "(empty)"}</td>
                  </tr>
                ))}
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
              u = q.front(); q.pop(); for (v : adj[u]) if (!visited[v]) {"{"} visited[v] = true; dist[v] = dist[u] + 1; q.push(v); {"}"}
            </div>
          </div>
        </div>
        {renderChat && renderChat(() => ({
          title: `Arena — breadth-first search${labOpen ? " (code lab)" : ""}`,
          challenge: `This is the Arena BFS game, not a coding exercise. BFS(G, s): mark s visited, dist[s] = 0, push s on a FIFO queue; while the queue isn't empty, dequeue the front vertex u and, for each neighbor v of u in adjacency-list order, if v is undiscovered then mark it, set dist[v] = dist[u] + 1 and parent[v] = u, and push it on the back. Every vertex is enqueued at most once; dist is the fewest edges from s; unreachable vertices keep distance infinity; running time O(V + E). On a tree, BFS from the root is level-order traversal. The player ${r.kind === "step" ? "clicks the vertices that get enqueued after each dequeue" : r.kind === "order" ? "clicks the vertices in the order BFS dequeues them" : "names the BFS distance of one target vertex"}.`,
          code: `// Source: ${g.names[tr.s]}. Neighbors checked in ${g.rule}.\n// Adjacency lists:\n${g.names.map((nm, u) => `//   ${nm}: ${names(g, g.adj[u]) || "(none)"}`).join("\n")}\n// BFS visit order: ${names(g, tr.order)}\n// Distances: ${g.names.map((nm, v) => `${nm}=${dlabel(tr.dist[v])}`).join(", ")}${r.kind === "step" ? `\n// This round: ${g.names[r.st.u]} was dequeued with queue [${names(g, r.st.popped.queue)}] left; it enqueues: ${names(g, r.st.found) || "nothing"}` : r.kind === "dist" ? `\n// Question: d[${g.names[r.target]}]? Answer: ${dlabel(r.answer)}` : ""}`,
          summary: `Phase: ${phase}. ${r.kind === "step" ? `Player selected: ${names(g, [...picks]) || "nothing"}${phase === "done" ? (roundOk ? " (right)" : " (wrong)") : " (not confirmed yet)"}.` : r.kind === "order" ? `Clicks so far: ${clicks.map((x, n) => `#${n + 2} ${x.ok ? "right" : `wrong (picked ${g.names[x.tried]}, was ${g.names[x.v]})`}`).join(", ") || "none"}.` : `Player's answer: ${answer === null ? "none yet" : dlabel(answer)} (correct: ${dlabel(r.answer)}).`}`,
        }))}
      </div>
    </div>
  );
}
