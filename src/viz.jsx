import { useState, useEffect, useMemo } from "react";
import { buildTree, layout, genInsertSteps, genInorderSteps, genFindMinSteps, deriveInsert } from "./bstsim.js";

const V = { ink: "#141924", line: "#3A4358", panel: "#242B3A", panel2: "#2C3446", text: "#E8E6DF", muted: "#9AA3B5", gold: "#F2B84B", teal: "#5FD3BC", coral: "#E86F6F", blue: "#4C9EE8" };
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const DEMO = [50, 30, 70, 20, 40, 60, 80];
const MODES = [["insert", "Insert"], ["inorder", "In-order"], ["findmin", "Find min"]];

function statusFor(mode, steps, cur, values) {
  if (steps.length === 0) return "Empty tree. Type a number below and insert it.";
  if (cur >= steps.length) {
    if (mode === "insert") return `All ${values.length} values placed. Press play to replay, or insert your own number.`;
    if (mode === "inorder") return "Done. Left, node, right visited the values in sorted order.";
    return "Done. The minimum is wherever going left stops.";
  }
  const s = steps[cur];
  if (s.type === "compare") return s.side === "left" ? `${s.moving} < ${s.nodeVal}? yes → go left` : `${s.moving} < ${s.nodeVal}? no → go right`;
  if (s.type === "place") return s.at === null ? `t == nullptr → ${s.moving} becomes the root` : `t == nullptr → new node ${s.moving} hooks onto the tree`;
  if (s.type === "walk") return mode === "findmin" ? `${s.val} has a left child → keep going left` : `Visit ${s.val}: finish the whole left subtree first`;
  if (s.type === "emit") return `Left side of ${s.val} is done → print ${s.val}`;
  if (s.type === "found") return `${s.val} has no left child → minimum found`;
  return "";
}

export default function BSTViz({ mode: initialMode = "insert" }) {
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState(initialMode);
  const [values, setValues] = useState(DEMO);
  const [cursor, setCursor] = useState(Number.MAX_SAFE_INTEGER);
  const [playing, setPlaying] = useState(false);
  const [draft, setDraft] = useState("");

  const steps = useMemo(() => (
    mode === "insert" ? genInsertSteps(values)
      : mode === "inorder" ? genInorderSteps(values)
      : genFindMinSteps(values)
  ), [mode, values]);

  const cur = Math.min(cursor, steps.length);

  useEffect(() => { setPlaying(false); setCursor(mode === "insert" ? Number.MAX_SAFE_INTEGER : 0); }, [mode]);
  useEffect(() => {
    if (!playing) return;
    if (cur >= steps.length) { setPlaying(false); return; }
    const t = setTimeout(() => setCursor(cur + 1), 700);
    return () => clearTimeout(t);
  }, [playing, cur, steps.length]);

  // ----- derive the scene -----
  let tree, token = null, activeId = null, foundId = null;
  const emitted = [], trail = [];
  if (mode === "insert") {
    const d = deriveInsert(values, steps, cur);
    tree = d.tree; token = d.token;
  } else {
    tree = buildTree(values);
    const upto = Math.min(cur, steps.length - 1);
    for (let i = 0; i <= upto; i++) {
      const s = steps[i];
      if (s.type === "emit") emitted.push(s);
      if (s.type === "walk") trail.push(s.id);
      if (s.type === "found") foundId = s.id;
    }
    if (cur < steps.length) activeId = steps[cur].id;
  }

  const pos = layout(tree);
  const ids = Object.keys(tree.nodes);
  let maxY = 98;
  for (const id of ids) if (pos[id].y > maxY) maxY = pos[id].y;
  const H = maxY + 46;

  let tok = null;
  if (token) {
    if (token.id === null) tok = { x: 320, y: 34 };
    else if (token.phase === "compare") tok = { x: pos[token.id].x, y: pos[token.id].y - 36 };
    else tok = { x: pos[token.id].x + (token.side === "left" ? -34 : 34), y: pos[token.id].y + 46 };
  }
  const emitOrder = {};
  emitted.forEach((e) => { emitOrder[e.id] = e.n; });
  const trailSet = new Set(trail);

  const play = () => { if (cur >= steps.length) setCursor(0); setPlaying(true); };
  const shuffle = () => {
    const pool = new Set();
    while (pool.size < 7) pool.add(1 + Math.floor(Math.random() * 99));
    setValues([...pool]); setPlaying(false);
    setCursor(mode === "insert" ? Number.MAX_SAFE_INTEGER : 0);
  };
  const addValue = () => {
    const v = parseInt(draft, 10);
    if (isNaN(v) || v < 0 || v > 999 || values.length >= 12) return;
    const startAt = genInsertSteps(values).length;
    setValues((vs) => [...vs, v]);
    setDraft("");
    setCursor(startAt);
    setPlaying(true);
  };

  const mbtn = (on) => ({ fontFamily: MONO, fontSize: 11.5, padding: "4px 10px", borderRadius: 6, cursor: "pointer", background: on ? V.gold : "transparent", color: on ? V.ink : V.muted, border: `1px solid ${on ? V.gold : V.line}`, fontWeight: on ? 700 : 400 });
  const cbtn = (extra = {}) => ({ fontFamily: MONO, fontSize: 12.5, padding: "5px 12px", borderRadius: 6, cursor: "pointer", background: V.panel2, color: V.text, border: `1px solid ${V.line}`, ...extra });

  return (
    <div style={{ border: `1px solid ${V.line}`, borderRadius: 12, background: V.panel, overflow: "hidden" }} className="mb-5">
      <style>{`@keyframes cq-vfade { from { opacity: 0 } to { opacity: 1 } }
        .cq-vnode { animation: cq-vfade .35s ease-out }
        @media (prefers-reduced-motion: reduce) { .cq-vnode { animation: none } .cq-vtoken { transition: none !important } }`}</style>

      <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap" style={{ borderBottom: open ? `1px solid ${V.line}` : "none" }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14 }}>{"🌳 Visualizer"}</span>
        {open && MODES.map(([k, label]) => (
          <button key={k} className="cq-btn" onClick={() => setMode(k)} style={mbtn(mode === k)}>{label}</button>
        ))}
        <div className="flex-1" />
        <button className="cq-btn" onClick={() => setOpen(!open)} style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted, background: "none", border: "none", cursor: "pointer" }}>{open ? "hide" : "show"}</button>
      </div>

      {open && (
        <div>
          <svg viewBox={`0 0 640 ${H}`} style={{ width: "100%", display: "block", background: V.ink }} role="img" aria-label="Binary search tree animation">
            {ids.map((id) => {
              const nd = tree.nodes[id];
              return ["left", "right"].map((side) => {
                const c = nd[side];
                if (!c) return null;
                const hot = token && token.phase === "compare" && token.id === id && token.side === side;
                return <line key={id + side} x1={pos[id].x} y1={pos[id].y} x2={pos[c].x} y2={pos[c].y}
                  stroke={hot ? V.gold : V.line} strokeWidth={hot ? 3 : 2} />;
              });
            })}
            {token && token.id !== null && token.phase === "place" && (
              <line x1={pos[token.id].x} y1={pos[token.id].y} x2={tok.x} y2={tok.y}
                stroke={V.gold} strokeWidth={2} strokeDasharray="4 4" />
            )}
            {ids.map((id) => {
              const nd = tree.nodes[id];
              const isEmit = emitOrder[id] !== undefined;
              const isFound = foundId === id;
              const isActive = activeId === id || (token && token.phase === "compare" && token.id === id);
              const fill = isFound ? V.gold : isEmit ? V.teal : V.panel2;
              const stroke = isActive ? V.gold : isFound ? V.gold : isEmit ? V.teal : trailSet.has(id) ? "#7d879c" : V.line;
              return (
                <g key={id} className="cq-vnode">
                  <circle cx={pos[id].x} cy={pos[id].y} r={17} fill={fill} stroke={stroke} strokeWidth={isActive ? 3 : 2} />
                  <text x={pos[id].x} y={pos[id].y + 4.5} textAnchor="middle" fontFamily={MONO} fontSize="13" fontWeight="700"
                    fill={isEmit || isFound ? V.ink : V.text}>{nd.val}</text>
                  {isEmit && (
                    <g>
                      <circle cx={pos[id].x + 14} cy={pos[id].y - 14} r={8} fill={V.ink} stroke={V.teal} strokeWidth={1.5} />
                      <text x={pos[id].x + 14} y={pos[id].y - 10.5} textAnchor="middle" fontFamily={MONO} fontSize="9" fill={V.teal}>{emitOrder[id]}</text>
                    </g>
                  )}
                </g>
              );
            })}
            {tok && (
              <g className="cq-vtoken" style={{ transform: `translate(${tok.x}px, ${tok.y}px)`, transition: "transform .5s ease" }}>
                <circle r={15} fill={V.gold} stroke={V.ink} strokeWidth={2} />
                <text y={4.5} textAnchor="middle" fontFamily={MONO} fontSize="12" fontWeight="700" fill={V.ink}>{token.val}</text>
              </g>
            )}
          </svg>

          <div className="px-4 py-2" style={{ fontFamily: MONO, fontSize: 12.5, color: V.gold, borderTop: `1px solid ${V.line}`, minHeight: 34 }}>
            {statusFor(mode, steps, cur, values)}
          </div>
          {mode === "inorder" && (
            <div className="px-4 pb-1" style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted }}>
              Output: <span style={{ color: V.teal }}>{emitted.map((e) => e.val).join(" ") || "—"}</span>
            </div>
          )}

          <div className="flex items-center gap-2 px-4 py-3 flex-wrap" style={{ borderTop: `1px solid ${V.line}` }}>
            <button className="cq-btn" onClick={() => { setPlaying(false); setCursor(0); }} style={cbtn()} aria-label="Restart">{"⏮"}</button>
            <button className="cq-btn" onClick={() => { setPlaying(false); setCursor(Math.max(0, cur - 1)); }} style={cbtn()} aria-label="Step back">{"◀"}</button>
            {playing
              ? <button className="cq-btn" onClick={() => setPlaying(false)} style={cbtn({ background: V.gold, color: V.ink, fontWeight: 700 })} aria-label="Pause">{"❚❚"}</button>
              : <button className="cq-btn" onClick={play} style={cbtn({ background: V.gold, color: V.ink, fontWeight: 700 })} aria-label="Play">{"▶"}</button>}
            <button className="cq-btn" onClick={() => { setPlaying(false); setCursor(Math.min(steps.length, cur + 1)); }} style={cbtn()} aria-label="Step forward">{"▶▏"}</button>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted }}>step {cur}/{steps.length}</span>
            <div className="flex-1" />
            <button className="cq-btn" onClick={shuffle} style={cbtn({ color: V.muted })}>{"🔀 new tree"}</button>
            {mode === "insert" && (
              <span className="flex items-center gap-2">
                <input value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                  onKeyDown={(e) => { if (e.key === "Enter") addValue(); }}
                  placeholder="0-999" aria-label="Value to insert"
                  style={{ fontFamily: MONO, fontSize: 12.5, width: 64, background: V.ink, color: V.text, border: `1px solid ${V.line}`, borderRadius: 6, padding: "5px 8px" }} />
                <button className="cq-btn" onClick={addValue} disabled={values.length >= 12}
                  style={cbtn({ background: V.teal, color: V.ink, fontWeight: 700, opacity: values.length >= 12 ? 0.5 : 1 })}>+ insert</button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
