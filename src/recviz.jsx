import { useState, useEffect, useMemo } from "react";
import { genSumSteps, genClimbSteps, genDiveSteps, deriveScene, tri } from "./recsim.js";

const V = { ink: "#141924", line: "#3A4358", panel: "#242B3A", panel2: "#2C3446", text: "#E8E6DF", muted: "#9AA3B5", gold: "#F2B84B", teal: "#5FD3BC", coral: "#E86F6F" };
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const MODES = [["sumto", "sumTo"], ["climb", "climb"], ["dive", "dive"]];
const FN = { sumto: "sumTo", climb: "climb", dive: "dive" };

function frameText(mode, f, N) {
  const fn = FN[mode];
  if (f.status === "resolved") {
    if (mode === "sumto") return f.n === 0 ? "sumTo(0) = 0   (base case answered instantly)" : `sumTo(${f.n}) = ${f.n} + ${tri(f.n - 1)} = ${tri(f.n)}`;
    if (f.n === 0) return `${fn}(0) did nothing (base case)`;
    return mode === "climb" ? `${fn}(${f.n}) resumed and printed ${f.n}` : `${fn}(${f.n}) finished`;
  }
  if (f.status === "waiting") {
    if (mode === "sumto") return `sumTo(${f.n}) = ${f.n} + sumTo(${f.n - 1})   \u2026waiting for that answer`;
    return `${fn}(${f.n}) paused at ${fn}(${f.n - 1})${mode === "climb" ? ", its print must wait" : ""}`;
  }
  // active
  if (f.n === 0) return mode === "sumto" ? "sumTo(0) \u2192 base case! answers 0 with no helper" : `${fn}(0) \u2192 base case! does nothing and returns`;
  return `${fn}(${f.n})`;
}

function narration(mode, steps, cur, N) {
  const fn = FN[mode];
  if (cur >= steps.length) {
    if (mode === "sumto") return `Done: sumTo(${N}) = ${tri(N)}. Every call did one add and trusted the rest.`;
    if (mode === "climb") return "Done. The prints ran while the calls unwound, deepest first: ascending order.";
    return "Done. Printing before the call runs on the way down: descending order.";
  }
  const s = steps[cur];
  if (s.type === "call") {
    if (s.n === 0) return `${fn}(0) hits the base case \u2192 answers without asking anyone.`;
    if (mode === "dive") return `${fn}(${s.n}) prints ${s.n} first, then delegates to ${fn}(${s.n - 1}).`;
    return `${fn}(${s.n}) can't finish alone \u2192 pauses and asks ${fn}(${s.n - 1}).`;
  }
  if (mode === "sumto") return s.n === 0 ? "The 0 rolls back up to the caller\u2026" : `sumTo(${s.n}) resumes: ${s.n} + ${tri(s.n - 1)} = ${tri(s.n)}, handed up.`;
  if (mode === "climb") return s.n === 0 ? "climb(0) returns. Now everyone un-pauses in reverse\u2026" : `climb(${s.n}) resumes \u2192 NOW its print runs: ${s.n}`;
  return `${fn}(${s.n}) returns. Its print already happened on the way down.`;
}

export default function RecViz({ mode: initialMode = "sumto" }) {
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState(initialMode);
  const [N, setN] = useState(4);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  const steps = useMemo(() => (
    mode === "sumto" ? genSumSteps(N) : mode === "climb" ? genClimbSteps(N) : genDiveSteps(N)
  ), [mode, N]);
  const cur = Math.min(cursor, steps.length);

  useEffect(() => { setPlaying(false); setCursor(0); }, [mode, N]);
  useEffect(() => {
    if (!playing) return;
    if (cur >= steps.length) { setPlaying(false); return; }
    const t = setTimeout(() => setCursor(cur + 1), 850);
    return () => clearTimeout(t);
  }, [playing, cur, steps.length]);

  const { frames, output } = deriveScene(steps, cur);
  const play = () => { if (cur >= steps.length) setCursor(0); setPlaying(true); };

  const mbtn = (on) => ({ fontFamily: MONO, fontSize: 11.5, padding: "4px 10px", borderRadius: 6, cursor: "pointer", background: on ? V.gold : "transparent", color: on ? V.ink : V.muted, border: `1px solid ${on ? V.gold : V.line}`, fontWeight: on ? 700 : 400 });
  const cbtn = (extra = {}) => ({ fontFamily: MONO, fontSize: 12.5, padding: "5px 12px", borderRadius: 6, cursor: "pointer", background: V.panel2, color: V.text, border: `1px solid ${V.line}`, ...extra });

  return (
    <div style={{ border: `1px solid ${V.line}`, borderRadius: 12, background: V.panel, overflow: "hidden" }} className="mb-5">
      <style>{`@keyframes cq-rfade { from { opacity: 0; transform: translateX(-6px) } to { opacity: 1; transform: none } }
        .cq-rframe { animation: cq-rfade .3s ease-out }
        @media (prefers-reduced-motion: reduce) { .cq-rframe { animation: none } }`}</style>

      <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap" style={{ borderBottom: open ? `1px solid ${V.line}` : "none" }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14 }}>{"\ud83e\ude9c Call stack"}</span>
        {open && MODES.map(([k, label]) => (
          <button key={k} className="cq-btn" onClick={() => setMode(k)} style={mbtn(mode === k)}>{label}</button>
        ))}
        <div className="flex-1" />
        <button className="cq-btn" onClick={() => setOpen(!open)} style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted, background: "none", border: "none", cursor: "pointer" }}>{open ? "hide" : "show"}</button>
      </div>

      {open && (
        <div>
          <div style={{ background: V.ink, padding: "14px 16px", minHeight: 120 }}>
            {frames.length === 0 && <div style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted }}>Press play to watch {FN[mode]}({N}) run.</div>}
            {frames.map((f) => {
              const depth = N - f.n;
              const color = f.status === "resolved" ? V.teal : f.status === "active" ? V.gold : V.muted;
              const border = f.status === "active" ? V.gold : f.status === "resolved" ? V.teal : V.line;
              return (
                <div key={f.n} className="cq-rframe" style={{ marginLeft: Math.min(depth * 22, 176), marginBottom: 5, border: `1px solid ${border}`, borderLeft: `3px solid ${border}`, borderRadius: 6, background: f.status === "active" ? V.panel2 : "transparent", padding: "5px 10px", fontFamily: MONO, fontSize: 12.5, color, maxWidth: 460 }}>
                  {frameText(mode, f, N)}
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2" style={{ fontFamily: MONO, fontSize: 12.5, color: V.gold, borderTop: `1px solid ${V.line}`, minHeight: 34 }}>
            {narration(mode, steps, cur, N)}
          </div>
          {mode !== "sumto" && (
            <div className="px-4 pb-1" style={{ fontFamily: MONO, fontSize: 12.5, color: V.muted }}>
              Output: <span style={{ color: V.teal }}>{output.join(" ") || "\u2014"}</span>
            </div>
          )}

          <div className="flex items-center gap-2 px-4 py-3 flex-wrap" style={{ borderTop: `1px solid ${V.line}` }}>
            <button className="cq-btn" onClick={() => { setPlaying(false); setCursor(0); }} style={cbtn()} aria-label="Restart">{"\u23ee"}</button>
            <button className="cq-btn" onClick={() => { setPlaying(false); setCursor(Math.max(0, cur - 1)); }} style={cbtn()} aria-label="Step back">{"\u25c0"}</button>
            {playing
              ? <button className="cq-btn" onClick={() => setPlaying(false)} style={cbtn({ background: V.gold, color: V.ink, fontWeight: 700 })} aria-label="Pause">{"\u275a\u275a"}</button>
              : <button className="cq-btn" onClick={play} style={cbtn({ background: V.gold, color: V.ink, fontWeight: 700 })} aria-label="Play">{"\u25b6"}</button>}
            <button className="cq-btn" onClick={() => { setPlaying(false); setCursor(Math.min(steps.length, cur + 1)); }} style={cbtn()} aria-label="Step forward">{"\u25b6\u258f"}</button>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted }}>step {cur}/{steps.length}</span>
            <div className="flex-1" />
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: V.muted }}>n =</span>
            {[2, 3, 4, 5, 6].map((k) => (
              <button key={k} className="cq-btn" onClick={() => setN(k)} style={mbtn(N === k)}>{k}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
