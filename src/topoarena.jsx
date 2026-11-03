import { useState, useEffect, useMemo } from "react";
import { rng, pointsFor, xpFor } from "./arenasim.js";
import { topoRounds, edges as edgesOf, preds, BOARD_W, BOARD_H } from "./toposim.js";
import { run as runCpp } from "./cppmini.js";
import { CppEditor, CppCode } from "./cpphl.jsx";

const V = { ink: "#141924", line: "#3A4358", panel: "#242B3A", panel2: "#2C3446", text: "#E8E6DF", muted: "#9AA3B5", gold: "#F2B84B", teal: "#5FD3BC", coral: "#E86F6F", blue: "#4C9EE8" };
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const btn = (extra = {}) => ({ fontFamily: MONO, fontSize: 12.5, padding: "6px 14px", borderRadius: 6, cursor: "pointer", background: V.panel2, color: V.text, border: `1px solid ${V.line}`, ...extra });
const R = 21;

export const TOPO_MODES = [
  ["topo-step", "Topological sort: who's ready next? (slide example)"],
  ["topo-build", "Topological sort: build an order"],
  ["topo-valid", "Topological sort: valid or not?"],
  ["topo-step-rand", "Topological sort: full run (random graph)"],
];

const names = (g, vs) => vs.map((v) => g.names[v]).join(", ");
const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

// How far to bow the edge u -> w sideways so it doesn't run through another vertex (0 = straight).
function bendFor(g, u, w) {
  const a = g.pos[u], b = g.pos[w];
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
  let side = 0;
  g.pos.forEach((p, k) => {
    if (k === u || k === w || side) return;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2;
    if (t <= 0.08 || t >= 0.92) return;
    const cx = a.x + t * dx, cy = a.y + t * dy;
    if (Math.hypot(p.x - cx, p.y - cy) < R + 10) {
      const cross = dx * (p.y - a.y) - dy * (p.x - a.x);         // which side the blocker is on
      side = cross > 0 ? -1 : 1;
    }
  });
  return side * 42;
}

// One directed edge, drawn between the circles with an arrowhead at w.
function Arrow({ g, u, w, color, width, dash, opacity = 1 }) {
  const a = g.pos[u], b = g.pos[w];
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
  const bend = bendFor(g, u, w);
  // control point: the midpoint pushed sideways (equal to the midpoint when straight)
  const qx = (a.x + b.x) / 2 - (dy / L) * bend, qy = (a.y + b.y) / 2 + (dx / L) * bend;
  const dir = (fx, fy, tx, ty) => { const l = Math.hypot(tx - fx, ty - fy) || 1; return [(tx - fx) / l, (ty - fy) / l]; };
  const [sx, sy] = dir(a.x, a.y, qx, qy), [ex, ey] = dir(qx, qy, b.x, b.y);
  const x1 = a.x + sx * R, y1 = a.y + sy * R, x2 = b.x - ex * (R + 2), y2 = b.y - ey * (R + 2);
  const h = 9 + width, s = 4.5 + width / 2;
  const bx = x2 - ex * h, by = y2 - ey * h;
  return (
    <g opacity={opacity}>
      {bend ? <path d={`M${x1},${y1} Q${qx},${qy} ${bx},${by}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={dash} />
        : <line x1={x1} y1={y1} x2={bx} y2={by} stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={dash} />}
      <polygon points={`${x2},${y2} ${bx - ey * s},${by + ex * s} ${bx + ey * s},${by - ex * s}`} fill={color} />
    </g>
  );
}

// ---------- the board: the DAG, its adjacency lists, the queue and the output ----------
// view: { indeg[], removed[], queue[], topNum[], cur, checking, showIndeg, showQueue, showOrder,
//         order[], badges{}, marks{}, picks(Set), hot (edge [u,w]), hotColor }
function Board({ g, view, pickable, onPick, showIndex }) {
  const es = useMemo(() => edgesOf(g), [g]);
  const inQ = (v) => view.queue && view.queue.includes(v);
  const fill = (v) => (view.removed && view.removed[v] ? "#1F4C47" : inQ(v) ? "#233F63" : V.ink);
  return (
    <div className="flex flex-wrap gap-3 items-start" style={{ padding: "10px 0 6px" }}>
      <div style={{ flex: "1 1 300px", minWidth: 0, overflowX: "auto", borderRadius: 8 }}>
        <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} style={{ width: "100%", minWidth: 400, display: "block", background: V.ink, borderRadius: 8 }} role="img" aria-label="Directed graph for topological sort">
          {es.map(([u, w]) => {
            const gone = view.removed && view.removed[u] && !(view.cur === u);
            const checking = view.cur === u && view.checking === w;
            const fromCur = view.cur === u && view.checking == null;
            const hot = same(view.hot, [u, w]);
            const color = hot ? (view.hotColor || V.coral) : checking ? V.gold : fromCur ? "#C9A55A" : gone ? V.line : "#7C869C";
            return <Arrow key={u + ">" + w} g={g} u={u} w={w} color={color} width={hot || checking ? 3.5 : 2} dash={gone && !checking ? "4 5" : undefined} opacity={gone && !checking && !hot ? 0.55 : 1} />;
          })}
          {g.names.map((nm, v) => {
            const isCur = view.cur === v, isChk = view.checking === v;
            const picked = view.picks && view.picks.has(v);
            const mark = view.marks ? view.marks[v] : null;
            const stroke = mark === "right" ? V.teal : mark === "wrong" ? V.coral : mark === "missed" ? V.gold : isCur || picked ? V.gold : isChk ? V.text : view.removed && view.removed[v] ? V.teal : inQ(v) ? V.blue : V.muted;
            const can = pickable && pickable(v);
            const badge = view.badges ? view.badges[v] : view.topNum && view.topNum[v] >= 0 ? view.topNum[v] + 1 : null;
            const showIn = view.showIndeg && view.indeg && !(view.removed && view.removed[v]);
            return (
              <g key={v} className={can ? "cq-btn cq-topo-v" : "cq-topo-v"} onClick={() => can && onPick(v)} role={can ? "button" : undefined} tabIndex={can ? 0 : undefined}
                onKeyDown={(e) => { if (can && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onPick(v); } }}
                aria-label={`vertex ${nm}${showIn ? `, indegree ${view.indeg[v]}` : ""}${isCur ? ", just dequeued" : ""}${picked ? ", selected" : ""}`} style={{ cursor: can ? "pointer" : "default" }}>
                <circle cx={g.pos[v].x} cy={g.pos[v].y} r={R} fill={picked ? "#4A3F2A" : fill(v)} stroke={stroke}
                  strokeWidth={isCur || picked || mark ? 3.5 : 2} strokeDasharray={can && !picked ? "5 4" : undefined} />
                <text x={g.pos[v].x} y={g.pos[v].y + 5.5} textAnchor="middle" fontFamily={MONO} fontSize="17" fontWeight="700" fill={V.text}>{nm}</text>
                {showIn && (
                  <g><rect x={g.pos[v].x + R - 3} y={g.pos[v].y - R - 7} width="40" height="17" rx="5" fill={V.ink} stroke={isChk ? V.gold : V.line} strokeWidth="1" />
                    <text x={g.pos[v].x + R + 17} y={g.pos[v].y - R + 6} textAnchor="middle" fontFamily={MONO} fontSize="12" fontWeight="700" fill={view.indeg[v] === 0 ? V.teal : V.gold}>in={view.indeg[v]}</text></g>
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
        <div style={{ color: V.muted, fontSize: 11.5, marginBottom: 4 }}>edges out of each vertex</div>
        {g.names.map((nm, u) => (
          <div key={u} style={{ padding: "2px 6px", borderRadius: 5, background: view.cur === u ? "rgba(242,184,75,.14)" : "transparent", color: view.cur === u ? V.text : V.muted, whiteSpace: "nowrap" }}>
            <b style={{ color: view.cur === u ? V.gold : V.text }}>{nm}</b>{showIndex ? <span style={{ color: "#6b7590" }}>[{u}]</span> : null}{" → "}
            {g.adj[u].length ? g.adj[u].map((w, i) => (
              <span key={w} style={{ color: (view.cur === u && view.checking === w) || same(view.hot, [u, w]) ? (same(view.hot, [u, w]) ? view.hotColor || V.coral : V.gold) : undefined, fontWeight: view.cur === u && view.checking === w ? 700 : 400 }}>{i ? ", " : ""}{g.names[w]}</span>
            )) : <span style={{ color: "#6b7590" }}>(none)</span>}
          </div>
        ))}
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
        </div>
      )}
      {view.showOrder && (
        <div className="flex items-center gap-2 flex-wrap" style={{ flex: "1 1 100%", fontFamily: MONO, fontSize: 12.5, color: V.muted, minHeight: 40 }}>
          <span style={{ width: 52 }}>{view.orderLabel || "order"}</span>
          {view.order.length ? view.order.map((v, i) => (
            <div key={v + ":" + i} style={{ height: 34, padding: "0 8px", borderRadius: 7, display: "flex", alignItems: "center", gap: 5, fontSize: 14, fontWeight: 700,
              border: `2px solid ${view.orderMarks && view.orderMarks[i] ? V.coral : V.teal}`, background: "#1F4C47", color: V.text }}>
              <span style={{ fontSize: 10.5, color: V.gold }}>{i + 1}</span>{g.names[v]}
            </div>
          )) : <span style={{ color: "#6b7590" }}>(nothing yet)</span>}
        </div>
      )}
    </div>
  );
}

// ---------- code lab ----------
const TOPO_ANSWER = `void topsort() {
  queue<int> q;
  int counter = 0;

  for (int v = 0; v < n; v++)
    if (indegree[v] == 0)
      q.push(v);

  while (!q.empty()) {
    int v = q.front();
    q.pop();
    topNum[v] = counter;
    counter++;

    for (int w : adj[v])
      if (--indegree[w] == 0)
        q.push(w);
  }
  // if counter < n here, the graph has a cycle
}`;
const TOPO_STARTER = `// The graph has n vertices, numbered 0..n-1 (the small [k] labels).
// adj[v] lists the vertices that v points to (edges v -> w).
// Already set up for you, all of size n:
//   indegree[]  how many edges point INTO each vertex
//   topNum[]    starts -1; set topNum[v] to v's place in the order
void topsort() {
  queue<int> q;
  int counter = 0;

  for (int v = 0; v < n; v++)
    if (indegree[v] == 0)
      q.push(v);

  while (!q.empty()) {
    int v = q.front();
    q.pop();
    topNum[v] = counter;
    counter++;

    // TODO: "remove" v's outgoing edges. For every w in adj[v],
    //       lower indegree[w] by one; if it reaches 0, push w.
  }
}`;
const TOPO_HINT = "for (int w : adj[v]) { indegree[w]--; if (indegree[w] == 0) q.push(w); }";

function CodeLab({ r, onFrames, activeLine }) {
  const [code, setCode] = useState(TOPO_STARTER);
  const [status, setStatus] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const g = r.g, tr = r.tr, n = g.names.length;
  useEffect(() => { setStatus(null); onFrames(null); }, [tr]);

  const execute = () => {
    const globals = { adj: g.adj.map((l) => [...l]), indegree: [...tr.startIndeg], topNum: new Array(n).fill(-1) };
    let res;
    try { res = runCpp(code, { a: new Array(n).fill(0), count: n, globals, trackWrites: true, maxSteps: 8000, what: "the vertices", call: { name: "topsort", args: [] } }); }
    catch (e) { setStatus({ line: e && e.line, msg: e && e.msg ? e.msg : String(e) }); onFrames(null); return; }
    // Replay what the player's code did to the queue, the indegrees and the numbering.
    let indeg = [...tr.startIndeg], queue = [], removed = new Array(n).fill(false), topNum = new Array(n).fill(-1), cur = null;
    const frames = [{ indeg, queue, removed, topNum, cur, line: 0, say: "your code's starting graph, with every indegree counted" }];
    const pops = [], pushes = [];
    const inRange = (v) => Number.isInteger(v) && v >= 0 && v < n;
    for (const t of res.trace) {
      const nt = t.note;
      if (!nt) continue;
      if (nt.kind === "qpush" && inRange(nt.v)) {
        pushes.push(nt.v); queue = [...queue, nt.v];
        frames.push({ indeg, queue, removed, topNum, cur, line: t.line, say: `q.push(${nt.v})  // ${g.names[nt.v]} is ready: nothing left points into it` });
      } else if (nt.kind === "qpop" && inRange(nt.v)) {
        pops.push(nt.v); queue = queue.slice(1); removed = [...removed]; removed[nt.v] = true; cur = nt.v;
        frames.push({ indeg, queue, removed, topNum, cur, line: t.line, say: `q.pop()  // ${g.names[nt.v]} comes off the front` });
      } else if (nt.kind === "set" && nt.arr === "indegree" && inRange(nt.i)) {
        indeg = [...indeg]; indeg[nt.i] = nt.v;
        frames.push({ indeg, queue, removed, topNum, cur, checking: nt.i, line: t.line, say: `indegree[${nt.i}] = ${nt.v}  // edge into ${g.names[nt.i]} removed` });
      } else if (nt.kind === "set" && nt.arr === "topNum" && inRange(nt.i)) {
        topNum = [...topNum]; topNum[nt.i] = nt.v;
        frames.push({ indeg, queue, removed, topNum, cur, line: t.line, say: `topNum[${nt.i}] = ${nt.v}  // ${g.names[nt.i]} is number ${nt.v + 1} in the order` });
      }
    }
    if (cur != null) frames.push({ indeg, queue, removed, topNum, cur: null, line: 0, say: "queue is empty: done" });
    const twice = pushes.find((v, i) => pushes.indexOf(v) !== i);
    if (!res.ok) {
      const loop = /too long/.test(res.error.msg) && twice !== undefined;
      setStatus({ line: res.error.line, msg: res.error.msg + (loop ? ` Vertex ${twice} (${g.names[twice]}) keeps getting pushed: push w only when its indegree reaches exactly 0.` : "") });
      onFrames(frames.slice(0, 60)); return;
    }
    const want = tr.topNum.join(", "), got = globals.topNum.join(", ");
    const orderOk = pops.join(",") === tr.order.join(",");
    const pass = want === got && orderOk && twice === undefined;
    const roots = g.names.map((_, v) => v).filter((v) => tr.startIndeg[v] === 0);
    setStatus({ pass, msg: pass
      ? `Your sort numbered the vertices ${names(g, pops)}${tr.cycle ? `, then got stuck: ${n - pops.length} vertices are on a cycle and never reach indegree 0` : ""}. That matches.`
      : !pushes.length ? "Nothing was pushed, so the loop never ran. Push every vertex whose indegree starts at 0."
      : twice !== undefined ? `Vertex ${twice} (${g.names[twice]}) was pushed more than once. Push w only at the moment its indegree becomes 0.`
      : pops.length <= roots.length && tr.order.length > roots.length ? `Only ${names(g, pops)} came out. Nothing new joins the queue yet: lower indegree[w] for each w in adj[v] and push w when it hits 0.`
      : !orderOk ? `Order came out ${names(g, pops)} but the queue version gives ${names(g, tr.order)}.`
      : `topNum came out [${got}] but should be [${want}].` });
    onFrames(frames);
  };

  const lines = code.split("\n");
  return (
    <div>
      <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap" style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted, borderBottom: `1px solid ${V.line}` }}>
        <span style={{ color: V.teal, fontWeight: 700, marginRight: 4 }}>{"⌨"} Code lab</span>
        <span style={{ color: V.text }}>topsort()</span>
        <div className="flex-1" />
        <button className="cq-btn" onClick={execute} style={btn({ background: V.teal, color: V.ink, fontWeight: 700 })}>Run {"▶"}</button>
        <button className="cq-btn" onClick={() => { setCode(TOPO_STARTER); setStatus(null); onFrames(null); }} style={btn()}>Reset</button>
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
        Runs topsort() on this round's graph. Starting indegrees: [{tr.startIndeg.join(", ")}].
      </div>
      {status && (
        <div className="px-4 pb-3" style={{ fontFamily: MONO, fontSize: 12.5, color: status.pass ? V.teal : V.coral }}>
          {status.line && !status.pass ? `line ${status.line}: ` : ""}{status.msg}
        </div>
      )}
      {showAnswer && (
        <div className="px-4 pb-3">
          <div style={{ fontFamily: MONO, fontSize: 12, color: V.muted, marginBottom: 4 }}>Hint: {TOPO_HINT}</div>
          <CppCode code={TOPO_ANSWER} style={{ background: V.ink, color: V.text, padding: 10, borderRadius: 6, fontFamily: MONO, fontSize: 12 }} />
        </div>
      )}
    </div>
  );
}

// ---------- coach text ----------
function coachFor(r, phase, ctx) {
  const g = r.g, tr = r.tr;
  if (r.kind === "step") {
    const st = r.st, v = g.names[st.v];
    if (phase === "pick") return { title: `${v} was dequeued. Who becomes ready?`, paras: [
      r.k === 0 ? `Before the loop started, every vertex with indegree 0 went into the queue (${names(g, tr.first.queue)}). Those are the ones nothing has to come before.` : `${v} reached the front of the queue, so it gets topological number ${r.k + 1}.`,
      `Now ${v} is "removed" from the graph along with its outgoing edges (${g.adj[st.v].length ? g.adj[st.v].map((w) => `${v}→${g.names[w]}`).join(", ") : "it has none"}). Each target loses one from its indegree.`,
      "A vertex joins the queue the moment its indegree reaches 0. Click every vertex that becomes ready now, then confirm. If none do, confirm with nothing selected."] };
    return { title: st.found.length ? `Ready: ${names(g, st.found)}` : "Nobody new", paras: [
      st.checks.length ? `Indegrees after removing ${v}: ${st.checks.map((c) => `${g.names[c.w]} → ${c.after.indeg[c.w]}`).join(", ")}. ${st.found.length ? `${names(g, st.found)} hit 0 and joined the back of the queue.` : "None of them hit 0: each still has another edge coming in from a vertex that isn't done yet."}`
        : `${v} has no outgoing edges, so no indegree changes.`,
      "A vertex with indegree 0 has every prerequisite already in the order, so it's safe to place next.",
      "Each vertex is enqueued once and each edge is looked at once: O(V + E) total."] };
  }
  if (r.kind === "build") {
    if (phase === "build") return { title: "Build any valid order", paras: [
      "An edge u → v means u has to come before v (like a prerequisite course). Click the vertices one at a time to build an order that never breaks an edge.",
      "At every point, you can place any vertex whose incoming edges all come from vertices you've already placed. When several are ready, any of them is fine.",
      `The order isn't unique: the slides say any legal ordering will do. ${ctx && ctx.wrong ? "A coral edge shows what's blocking a vertex you tried too early." : ""}`] };
    return { title: "Your order works", paras: [
      `You placed ${names(g, ctx.order)}. Every edge points forward in that list.`,
      `The queue algorithm from the slides would give ${names(g, tr.order)}${ctx.order.join() === tr.order.join() ? ", the same one." : ". Different, but just as valid."}`,
      "If a graph has a cycle there's no valid order at all: every vertex on the cycle would have to come before itself."] };
  }
  if (phase === "valid") return { title: "Is this a topological order?", paras: [
    "The numbered list is a proposed order. It's valid only if every edge u → v points forward: u appears earlier than v.",
    "Check edges one at a time against the list. One backwards edge is enough to make it invalid.",
    "Look for a cycle too. If the graph has one, no order can satisfy it, no matter how you arrange the vertices."] };
  const [u, w] = r.broken || [];
  return { title: r.answer === "valid" ? "Valid" : r.answer === "cycle" ? "The graph has a cycle" : "Invalid", paras: [
    r.answer === "valid" ? `Every edge points forward in ${names(g, r.ord)}. ${r.ord.join() === tr.order.join() ? "This is exactly what the queue algorithm produces." : `The queue algorithm would give ${names(g, tr.order)}, which is also valid: orderings aren't unique.`}`
      : r.answer === "cycle" ? `The edge ${g.names[u]} → ${g.names[w]} (in coral) closes a cycle: there's already a path from ${g.names[w]} to ${g.names[u]}. So ${g.names[u]} must come before ${g.names[w]} and after it at the same time. No order works.`
      : `The edge ${g.names[u]} → ${g.names[w]} (in coral) needs ${g.names[u]} first, but the list puts ${g.names[w]} at #${r.ord.indexOf(w) + 1} and ${g.names[u]} at #${r.ord.indexOf(u) + 1}.`,
    r.answer === "cycle" ? `The queue algorithm notices this on its own: it numbers only ${tr.order.length} of ${g.names.length} vertices before the queue empties, because the vertices on the cycle never reach indegree 0.` : "To check an order fast, give each vertex its position, then make one pass over the edges.",
    "Topological sort only works on a directed acyclic graph (a DAG)."] };
}

// ---------- the game ----------
export default function TopoArena({ mode, best = 0, onFinish, onExit, renderChat }) {
  const rounds = useMemo(() => topoRounds(mode, rng(Date.now() % 1e9)), [mode]);
  const [round, setRound] = useState(0);
  const r = rounds[round];
  const g = r.g, tr = r.tr;
  const first = (x) => (x.kind === "step" ? "pick" : x.kind);
  const [phase, setPhase] = useState(first(r));
  const [picks, setPicks] = useState(() => new Set());        // step mode: vertices selected
  const [placed, setPlaced] = useState([]);                   // build mode: the player's order so far
  const [miss, setMiss] = useState(null);                     // build mode: { v, edge } of the last too-early click
  const [wrongs, setWrongs] = useState(0);
  const [answer, setAnswer] = useState(null);                 // valid mode
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

  const frames = useMemo(() => {
    if (r.kind === "step") {
      const st = r.st;
      return [...st.checks.map((c) => ({ ...c.after, cur: st.v, checking: c.w, zero: c.zero })), { ...st.after, cur: null, checking: null }];
    }
    return [{ ...tr.end }];
  }, [r]);

  useEffect(() => {
    if (phase !== "done" || play >= frames.length - 1) return;
    const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setPlay((p) => p + 1), reduce ? 350 : 850);
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
  const place = (v) => {
    const blocking = preds(g, v).filter((u) => !placed.includes(u));
    if (blocking.length) { award(false); setWrongs((x) => x + 1); setMiss({ v, edge: [blocking[0], v] }); return; }
    award(true); setMiss(null);
    const np = [...placed, v]; setPlaced(np);
    if (np.length === g.names.length) finishRound(wrongs === 0);
  };
  const judge = (a) => { setAnswer(a); const ok = a === r.answer; award(ok); finishRound(ok); };
  const next = () => {
    if (round + 1 >= rounds.length) { setFinished(true); onFinish && onFinish({ score, correct, bestStreak, xp: xpFor(correct) }); return; }
    const nr = rounds[round + 1];
    setRound(round + 1); setPhase(first(nr)); setPicks(new Set()); setPlaced([]); setMiss(null); setWrongs(0); setAnswer(null); setRoundOk(null); setPlay(0); setLabFrames(null);
  };

  // ----- what the board shows right now -----
  const labFrame = labFrames && labFrames.length ? labFrames[Math.min(labIdx, labFrames.length - 1)] : null;
  const playing = phase === "done" && play < frames.length - 1;
  const fr = frames[Math.min(play, frames.length - 1)];
  const orderOf = (topNum) => g.names.map((_, v) => v).filter((v) => topNum[v] >= 0).sort((a, b) => topNum[a] - topNum[b]);
  let view, pickable = null, onPick = null;
  if (labFrame) view = { ...labFrame, showIndeg: true, showQueue: true, showOrder: true, order: orderOf(labFrame.topNum) };
  else if (r.kind === "step") {
    if (phase === "pick") {
      view = { ...r.st.popped, cur: r.st.v, showIndeg: true, showQueue: true, showOrder: true, order: orderOf(r.st.popped.topNum), picks };
      pickable = (v) => !r.st.popped.removed[v] && !r.st.popped.queue.includes(v); onPick = togglePick;
    } else {
      const marks = {};
      if (!playing) { r.st.found.forEach((v) => { marks[v] = picks.has(v) ? "right" : "missed"; }); picks.forEach((v) => { if (!r.st.found.includes(v)) marks[v] = "wrong"; }); }
      view = { ...fr, showIndeg: true, showQueue: true, showOrder: true, order: orderOf(fr.topNum), marks };
    }
  } else if (r.kind === "build") {
    const removed = g.names.map((_, v) => placed.includes(v)); const badges = {}; placed.forEach((v, i) => { badges[v] = i + 1; });
    const marks = {}; if (miss && phase === "build") marks[miss.v] = "wrong";
    view = { removed, badges, marks, queue: [], showOrder: true, order: placed, orderLabel: "yours", hot: phase === "build" && miss ? miss.edge : null };
    if (phase === "build") { pickable = (v) => !placed.includes(v); onPick = place; }
  } else {
    const badges = {}; r.ord.forEach((v, i) => { badges[v] = i + 1; });
    const orderMarks = {}; if (phase === "done" && r.broken) { orderMarks[r.ord.indexOf(r.broken[0])] = true; orderMarks[r.ord.indexOf(r.broken[1])] = true; }
    view = { removed: g.names.map(() => false), badges, queue: [], showOrder: true, order: r.ord, orderLabel: "order", orderMarks, hot: phase === "done" ? r.broken : null };
  }

  const c = coachFor(r, phase, { order: placed, wrong: !!miss });
  const modeLabel = TOPO_MODES.find((m) => m[0] === mode)?.[1] || mode;
  const unit = r.kind === "step" ? "dequeue" : "graph";
  const shownSteps = r.kind === "step" ? r.k + (phase === "done" && !playing ? 1 : 0) : 0;
  const answerText = { valid: "valid", invalid: "breaks an edge", cycle: "has a cycle: no order exists" };

  if (finished) return (
    <div style={{ border: `1px solid ${V.line}`, borderRadius: 12, background: V.panel, padding: 18, fontFamily: MONO }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: V.gold }}>Topological sort round over: {score} points</div>
      <div style={{ fontSize: 13, color: V.text, marginTop: 6 }}>{correct}/{rounds.length} {unit}s fully right, best streak {bestStreak}, +{xpFor(correct)} xp{score > best ? ", new best" : ""}</div>
      {r.kind === "step" && <div style={{ fontSize: 13, color: V.teal, marginTop: 6 }}>Topological order: {names(g, tr.order)}</div>}
      <div className="flex gap-2 mt-4"><button className="cq-btn" onClick={onExit} style={btn({ background: V.gold, color: V.ink, fontWeight: 700 })}>Back to modes</button></div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <style>{`.cq-topo-v:focus:not(:focus-visible) { outline: none } @media (max-width: 1023px) { .cq-col { flex: none !important } }`}</style>
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
          <div style={{ fontSize: 11.5, color: V.muted, marginBottom: 4 }}>{g.slide ? "the example from the class slides · " : ""}an edge u → v means u comes before v</div>
          Topological sort
          {r.kind === "step" && <span style={{ color: V.muted }}> · dequeued <span style={{ color: V.gold }}>{g.names[r.st.v]}</span>, it gets number {r.k + 1}</span>}
          {labFrame && <span style={{ color: V.teal }}>{" "}playing your code</span>}
        </div>

        <div className="px-4">
          <Board g={g} view={view} pickable={labFrame ? null : pickable} onPick={onPick} showIndex={labOpen} />
          <div className="flex items-center gap-4 flex-wrap pb-3" style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted }}>
            {(r.kind === "step" || labFrame) ? <>
              <span><span style={{ color: V.gold }}>in=k</span> edges still coming in</span>
              <span><span style={{ color: V.blue }}>{"●"}</span> in the queue (in=0)</span>
              <span><span style={{ color: V.teal }}>{"●"}</span> numbered and removed</span>
              <span><span style={{ color: V.gold }}>{"○"}</span> just dequeued</span>
            </> : r.kind === "build" ? <>
              <span><span style={{ color: V.teal }}>{"●"}</span> placed</span>
              <span><span style={{ color: V.coral }}>{"→"}</span> blocking edge</span>
            </> : <span><span style={{ color: V.gold }}>{"●"}</span> position in the proposed order</span>}
          </div>
        </div>

        <div className="px-4 py-3" style={{ borderTop: `1px solid ${V.line}`, minHeight: 64 }}>
          {labFrame ? (
            <span style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted }}>{labFrame.say}</span>
          ) : phase === "pick" ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontFamily: MONO, fontSize: 13, color: V.text }}>Click every vertex that hits in=0:</span>
              <span style={{ fontFamily: MONO, fontSize: 13, color: V.gold }}>{picks.size ? names(g, [...picks].sort((x, y) => x - y)) : "(none selected)"}</span>
              <div className="flex-1" />
              <button className="cq-btn" onClick={confirmPicks} style={btn({ background: V.gold, color: V.ink, fontWeight: 700 })}>{picks.size ? `Enqueue ${picks.size === 1 ? "it" : "these"}` : "Enqueue nothing"} {"▶"}</button>
            </div>
          ) : phase === "build" ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontFamily: MONO, fontSize: 13, color: V.text }}>Click vertex #{placed.length + 1} of your order.</span>
              {miss && <span style={{ fontFamily: MONO, fontSize: 12, color: V.coral }}>{`✗ not yet: ${g.names[miss.edge[0]]} → ${g.names[miss.v]} means ${g.names[miss.edge[0]]} has to come first`}</span>}
              {!miss && placed.length > 0 && <span style={{ fontFamily: MONO, fontSize: 12, color: V.teal }}>{`✓ ${g.names[placed[placed.length - 1]]} is safe`}</span>}
            </div>
          ) : phase === "valid" ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontFamily: MONO, fontSize: 13, color: V.text, marginRight: 4 }}>This order is…</span>
              <button className="cq-btn" onClick={() => judge("valid")} style={btn({ border: `1px solid ${V.teal}`, color: V.teal })}>{"✓"} valid</button>
              <button className="cq-btn" onClick={() => judge("invalid")} style={btn({ border: `1px solid ${V.coral}`, color: V.coral })}>{"✗"} breaks an edge</button>
              <button className="cq-btn" onClick={() => judge("cycle")} style={btn({ border: `1px solid ${V.gold}`, color: V.gold })}>{"⟳"} graph has a cycle</button>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: roundOk ? V.teal : V.coral }}>
                {r.kind === "step" ? (roundOk ? `✓ right! ${r.st.found.length ? `${names(g, r.st.found)} joined the queue` : "nobody new is ready"}` : `✗ removing ${g.names[r.st.v]} frees ${r.st.found.length ? names(g, r.st.found) : "nobody"}, not ${picks.size ? names(g, [...picks].sort((x, y) => x - y)) : "nobody"}`)
                  : r.kind === "build" ? (roundOk ? `✓ clean run: ${names(g, placed)}` : `Done: ${names(g, placed)} (${wrongs} too-early ${wrongs === 1 ? "click" : "clicks"})`)
                  : (roundOk ? `✓ right! It ${r.answer === "valid" ? "is valid" : r.answer === "cycle" ? "has a cycle" : "breaks an edge"}` : `✗ it ${answerText[r.answer]}, not "${answerText[answer]}"`)}
                <span style={{ color: V.muted, fontWeight: 400 }}>{playing && r.kind === "step" ? `  ${g.names[fr.cur]} → ${g.names[fr.checking]}: in=${fr.indeg[fr.checking]}${fr.zero ? ", ready!" : ""}` : ""}</span>
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
              <thead><tr style={{ color: V.muted, textAlign: "left" }}>{["#", "dequeued", "indegrees lowered", "enqueued", "queue after"].map((h) => <th key={h} style={{ padding: "4px 8px", borderBottom: `1px solid ${V.line}`, fontWeight: 500 }}>{h}</th>)}</tr></thead>
              <tbody>
                {tr.steps.slice(0, shownSteps).map((st, n) => (
                  <tr key={n}>
                    <td style={{ padding: "4px 8px", color: V.muted }}>{n + 1}</td>
                    <td style={{ padding: "4px 8px", color: V.gold }}>{g.names[st.v]}</td>
                    <td style={{ padding: "4px 8px", color: V.muted }}>{st.checks.map((c) => `${g.names[c.w]}=${c.after.indeg[c.w]}`).join(", ") || "—"}</td>
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
              push every in=0 vertex; while queue: v = pop; topNum[v] = counter++; for (w : adj[v]) if (--indegree[w] == 0) push(w);
            </div>
          </div>
        </div>
        {renderChat && renderChat(() => ({
          title: `Arena — topological sort${labOpen ? " (code lab)" : ""}`,
          challenge: `This is the Arena topological sort game, not a coding exercise. It follows the class slides (Weiss): a topological sort orders the vertices of a directed acyclic graph so every edge u → v has u before v. Algorithm: compute indegrees, push every indegree-0 vertex onto a queue; while the queue isn't empty, pop v, give it the next number, and for each edge v → w decrement indegree[w], pushing w when it reaches 0. If fewer than n vertices get numbered, the graph has a cycle. Orderings are not unique; O(V + E). The player ${r.kind === "step" ? "clicks the vertices whose indegree reaches 0 after each dequeue" : r.kind === "build" ? "builds any valid order by clicking vertices" : "judges whether a proposed order is valid, breaks an edge, or the graph has a cycle"}.`,
          code: `// Edges (u -> list):\n${g.names.map((nm, u) => `//   ${nm} -> ${names(g, g.adj[u]) || "(none)"}`).join("\n")}\n// Starting indegrees: ${g.names.map((nm, v) => `${nm}=${tr.startIndeg[v]}`).join(", ")}\n// Queue algorithm order: ${names(g, tr.order)}${tr.cycle ? " (stops early: cycle)" : ""}${r.kind === "step" ? `\n// This round: ${g.names[r.st.v]} dequeued; newly ready: ${names(g, r.st.found) || "none"}` : r.kind === "valid" ? `\n// Proposed order: ${names(g, r.ord)}; correct verdict: ${answerText[r.answer]}${r.broken ? `; offending edge ${g.names[r.broken[0]]} -> ${g.names[r.broken[1]]}` : ""}` : ""}`,
          summary: `Phase: ${phase}. ${r.kind === "step" ? `Player selected: ${names(g, [...picks]) || "nothing"}${phase === "done" ? (roundOk ? " (right)" : " (wrong)") : " (not confirmed yet)"}.` : r.kind === "build" ? `Player's order so far: ${names(g, placed) || "nothing"}; too-early clicks: ${wrongs}${miss ? `; last blocked by ${g.names[miss.edge[0]]} -> ${g.names[miss.v]}` : ""}.` : `Player's verdict: ${answer ? answerText[answer] : "none yet"}.`}`,
        }))}
      </div>
    </div>
  );
}
