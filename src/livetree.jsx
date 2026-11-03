import { useState, useEffect, useMemo } from "react";
import { layout } from "./bstsim.js";
import { diffSnapshots, describe, depthOf, isStick, explainStep, MISSIONS, checkMissions } from "./livetree.js";

const V = { ink: "#141924", line: "#3A4358", panel: "#242B3A", panel2: "#2C3446", text: "#E8E6DF", muted: "#9AA3B5", gold: "#F2B84B", teal: "#5FD3BC", coral: "#E86F6F", blue: "#4C9EE8" };
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const ROW = 62, TOP = 36, W = 640, R = 18;

// "text with `code` spans" -> React nodes
function Tie({ text }) {
  const parts = String(text).split("`");
  return parts.map((p, i) => i % 2 ? <code key={i} style={{ color: V.teal, background: V.ink, padding: "0 4px", borderRadius: 4 }}>{p}</code> : <span key={i}>{p}</span>);
}

const cbtn = (extra = {}) => ({ fontFamily: MONO, fontSize: 12.5, padding: "5px 12px", borderRadius: 6, cursor: "pointer", background: V.panel2, color: V.text, border: `1px solid ${V.line}`, ...extra });

export default function LiveTree({ snapshots = [], title = "Your tree", subtitle = "built by your code on the last run" }) {
  const [open, setOpen] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(true);
  const n = snapshots.length;
  const cur = Math.min(cursor, Math.max(0, n - 1));

  useEffect(() => { setCursor(0); setPlaying(n > 1); }, [snapshots]);
  useEffect(() => {
    if (!playing) return;
    if (cur >= n - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setCursor(cur + 1), 1100);
    return () => clearTimeout(t);
  }, [playing, cur, n]);

  const tree = snapshots[cur];
  const prev = cur > 0 ? snapshots[cur - 1] : null;
  const { pos, prevPos, diff, H, ex } = useMemo(() => {
    if (!tree) return { pos: {}, prevPos: {}, diff: { added: [], removed: [], moved: [] }, H: 160, ex: null };
    const d = diffSnapshots(prev, tree);
    const depth = Math.max(depthOf(tree), prev ? depthOf(prev) : 0);
    const ex = cur > 0 ? explainStep(prev, tree, d) : null;
    return { pos: layout(tree, W, ROW, TOP), prevPos: prev ? layout(prev, W, ROW, TOP) : {}, diff: d, H: TOP + (depth + 1) * ROW + 24, ex };
  }, [tree, prev, cur]);

  if (n === 0) return null;
  const addedSet = new Set(diff.added.map((v) => "v" + v));
  const pathSet = new Set((ex?.path || []).map((v) => "v" + v));
  const final = snapshots[n - 1];
  const stick = final && isStick(final);
  const play = () => { if (cur >= n - 1) setCursor(0); setPlaying(true); };

  return (
    <div style={{ border: `1px solid ${V.teal}`, borderRadius: 12, background: V.panel, overflow: "hidden" }} className="mb-5">
      <style>{`@keyframes cq-lt-in { from { opacity: 0; transform: scale(.5) } to { opacity: 1; transform: scale(1) } }
        @keyframes cq-lt-out { from { opacity: 1 } to { opacity: 0; transform: translateY(14px) } }
        @keyframes cq-lt-card { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
        .cq-lt-node { transition: transform .55s cubic-bezier(.2,.8,.2,1) }
        .cq-lt-new .cq-lt-inner { animation: cq-lt-in .4s ease-out; transform-box: fill-box; transform-origin: center }
        .cq-lt-ghost { animation: cq-lt-out .7s ease-in forwards; transform-box: fill-box; transform-origin: center }
        .cq-lt-explain { animation: cq-lt-card .3s ease-out }
        @media (prefers-reduced-motion: reduce) { .cq-lt-node { transition: none } .cq-lt-new .cq-lt-inner, .cq-lt-ghost, .cq-lt-explain { animation: none } }`}</style>

      <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap" style={{ borderBottom: open ? `1px solid ${V.line}` : "none" }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14, color: V.teal }}>{"\ud83c\udf33 " + title}</span>
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted }}>{subtitle}</span>
        <div className="flex-1" />
        <button className="cq-btn" onClick={() => setOpen(!open)} style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted, background: "none", border: "none", cursor: "pointer" }}>{open ? "hide" : "show"}</button>
      </div>

      {open && (
        <div>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block", background: V.ink }} role="img" aria-label="Your tree, animated from your run">
            {!tree.root && <text x={W / 2} y={H / 2} textAnchor="middle" fill={V.muted} fontFamily={MONO} fontSize="13">empty tree</text>}
            {Object.keys(tree.nodes).map((id) => {
              const nd = tree.nodes[id];
              return ["left", "right"].map((side) => nd[side] && (
                <line key={id + side} x1={pos[id].x} y1={pos[id].y} x2={pos[nd[side]].x} y2={pos[nd[side]].y} stroke={pathSet.has(id) && (pathSet.has(nd[side]) || addedSet.has(nd[side])) ? V.blue : V.line} strokeWidth={pathSet.has(id) ? 3 : 2} />
              ));
            })}
            {diff.removed.map((v) => {
              const id = "v" + v; const p = prevPos[id]; if (!p) return null;
              return (
                <g key={`ghost-${id}-${cur}`} className="cq-lt-ghost" style={{ transform: `translate(${p.x}px, ${p.y}px)` }}>
                  <circle r={R} fill={V.panel2} stroke={V.coral} strokeWidth="2.5" />
                  <text textAnchor="middle" dy="4.5" fill={V.coral} fontFamily={MONO} fontSize="13" fontWeight="700">{v}</text>
                </g>
              );
            })}
            {Object.keys(tree.nodes).map((id) => {
              const nd = tree.nodes[id]; const p = pos[id]; const isNew = addedSet.has(id); const onPath = pathSet.has(id);
              const isSucc = ex?.kind === "two" && nd.val === ex.successor;
              const stroke = isNew ? V.gold : isSucc ? V.gold : onPath ? V.blue : V.teal;
              return (
                <g key={id} className={"cq-lt-node" + (isNew ? " cq-lt-new" : "")} style={{ transform: `translate(${p.x}px, ${p.y}px)` }}>
                  <g className="cq-lt-inner">
                    <circle r={R} fill={isNew ? V.gold : V.panel2} stroke={stroke} strokeWidth={onPath || isSucc ? 3 : 2.5} />
                    <text textAnchor="middle" dy="4.5" fill={isNew ? V.ink : V.text} fontFamily={MONO} fontSize="13" fontWeight="700">{nd.val}</text>
                  </g>
                </g>
              );
            })}
          </svg>

          <div key={cur} className="cq-lt-explain px-4 py-3" style={{ borderTop: `1px solid ${V.line}`, minHeight: 64 }}>
            {ex ? (
              <div>
                <div style={{ fontFamily: MONO, fontSize: 13, color: V.gold, fontWeight: 700 }}>{ex.title}</div>
                {ex.lines.map((l, i) => <div key={i} style={{ fontFamily: MONO, fontSize: 12.5, color: V.text, marginTop: 3 }}>{l}</div>)}
                {ex.tie && <div style={{ fontSize: 12, color: V.muted, marginTop: 6, lineHeight: 1.5 }}><Tie text={ex.tie} /></div>}
              </div>
            ) : (
              <div style={{ fontFamily: MONO, fontSize: 12.5, color: V.gold }}>start: {describe(diff, true)} {n > 1 ? "\u2014 press \u25b6 to watch it build" : ""}</div>
            )}
            {stick && cur === n - 1 && (
              <div style={{ fontFamily: MONO, fontSize: 12, color: V.coral, marginTop: 6 }}>{"\u26a0 This tree is a straight line. Either the input was already sorted, or your insert always picks the same side \u2014 check the < comparison."}</div>
            )}
          </div>

          <div className="flex items-center gap-2 px-4 py-3 flex-wrap" style={{ borderTop: `1px solid ${V.line}` }}>
            <button className="cq-btn" onClick={() => { setPlaying(false); setCursor(0); }} style={cbtn()} aria-label="Restart">{"\u23ee"}</button>
            <button className="cq-btn" onClick={() => { setPlaying(false); setCursor(Math.max(0, cur - 1)); }} style={cbtn()} aria-label="Step back">{"\u25c0"}</button>
            {playing
              ? <button className="cq-btn" onClick={() => setPlaying(false)} style={cbtn({ background: V.gold, color: V.ink, fontWeight: 700 })} aria-label="Pause">{"\u275a\u275a"}</button>
              : <button className="cq-btn" onClick={play} style={cbtn({ background: V.gold, color: V.ink, fontWeight: 700 })} aria-label="Play">{"\u25b6"}</button>}
            <button className="cq-btn" onClick={() => { setPlaying(false); setCursor(Math.min(n - 1, cur + 1)); }} style={cbtn()} aria-label="Step forward">{"\u25b6\u258f"}</button>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted }}>step {cur}/{n - 1}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const DEFAULT_INPUT = { c7: "50 25 75 12 40 60 90 -1", c8: "50 900\n25 901\n75 902\n12 903\n40 904\n60 905\n90 906" };
const INPUT_HINT = { c7: "numbers separated by spaces, ending with -1", c8: "one pair per line: key then value" };

export function TreeLab({ lessonId, chapter, doneMissions = [], run, onMission }) {
  const [input, setInput] = useState(DEFAULT_INPUT[chapter] || DEFAULT_INPUT.c7);
  const [snaps, setSnaps] = useState([]);
  const [stdout, setStdout] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [justWon, setJustWon] = useState([]);
  const missions = MISSIONS[lessonId] || [];

  const go = async () => {
    setBusy(true); setError(""); setJustWon([]);
    try {
      const r = await run(input.endsWith("\n") ? input : input + "\n");
      if (r.error) { setError(r.error); setSnaps([]); }
      else {
        setSnaps(r.snaps); setStdout(r.stdout || "");
        const passed = checkMissions(lessonId, r.snaps).filter((id) => !doneMissions.includes(id));
        if (passed.length) { setJustWon(passed); onMission && onMission(passed, missions.filter((m) => passed.includes(m.id))); }
      }
    } catch (e) { setError(String(e)); }
    setBusy(false);
  };

  return (
    <div style={{ border: `1px solid ${V.line}`, borderRadius: 12, background: V.panel, overflow: "hidden" }} className="mb-5">
      <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap" style={{ borderBottom: `1px solid ${V.line}` }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14 }}>{"\ud83e\uddea Tree Lab"}</span>
        <span style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted }}>feed your own numbers to the code in your editor, then watch</span>
      </div>
      <div className="px-4 py-3">
        <div style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted, marginBottom: 6 }}>Input ({INPUT_HINT[chapter] || INPUT_HINT.c7})</div>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={chapter === "c8" ? 4 : 2} spellCheck={false}
          style={{ width: "100%", fontFamily: MONO, fontSize: 13, background: V.ink, color: V.text, border: `1px solid ${V.line}`, borderRadius: 8, padding: "8px 10px", resize: "vertical" }} />
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <button className="cq-btn" onClick={go} disabled={busy} style={cbtn({ background: busy ? V.panel2 : V.gold, color: busy ? V.muted : V.ink, fontWeight: 700 })}>{busy ? "running\u2026" : "\u25b6 Run in the lab"}</button>
          {error && <span style={{ fontFamily: MONO, fontSize: 12, color: V.coral }}>{error.slice(0, 160)}</span>}
        </div>
        {missions.length > 0 && (
          <div className="mt-3">
            <div style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted, marginBottom: 4 }}>Missions</div>
            {missions.map((m) => {
              const done = doneMissions.includes(m.id) || justWon.includes(m.id);
              return (
                <div key={m.id} style={{ fontFamily: MONO, fontSize: 12.5, color: done ? V.teal : V.text, marginTop: 3 }}>
                  {done ? "\u2713" : "\u25cb"} {m.text} <span style={{ color: justWon.includes(m.id) ? V.gold : V.muted }}>{justWon.includes(m.id) ? `+${m.xp} xp!` : done ? "done" : `+${m.xp} xp`}</span>
                </div>
              );
            })}
          </div>
        )}
        {stdout && snaps.length > 0 && <pre style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted, marginTop: 10, whiteSpace: "pre-wrap", maxHeight: 96, overflow: "auto" }}>{stdout}</pre>}
      </div>
      {snaps.length > 0 && <div className="px-4 pb-3"><LiveTree snapshots={snaps} title="Lab tree" subtitle="your code, your numbers" /></div>}
    </div>
  );
}
