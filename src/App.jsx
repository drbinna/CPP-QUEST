import { useState, useEffect, useRef, useCallback } from "react";

// ---------- Palette & type ----------
const C = {
  bg: "#1C2230", panel: "#242B3A", panel2: "#2C3446", line: "#3A4358",
  text: "#E8E6DF", muted: "#9AA3B5", gold: "#F2B84B", teal: "#5FD3BC",
  coral: "#E86F6F", ink: "#141924", blue: "#4C9EE8",
};
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// cppquest backend (Supabase: edge function for compiling, REST for the leaderboard)
const SUPABASE_URL = "https://mfgbbcvgqsmbcsvzeixq.supabase.co";
const COMPILE_API = "https://mfgbbcvgqsmbcsvzeixq.supabase.co/functions/v1/compile";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mZ2JiY3ZncXNtYmNzdnplaXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyODMyNzUsImV4cCI6MjEwMzg1OTI3NX0.6vtYOqQfe2I6c49QOeNcp4ALDUp5ZtYVcVkXJ1hirIM";

import { BADGES, todayKey, streakOf, levelOf, norm, difficultyOf } from "./lessons.js";
import BSTViz from "./viz.jsx";
import RecViz from "./recviz.jsx";
import LiveTree, { TreeLab } from "./livetree.jsx";
import Arena from "./arena.jsx";
import Workbench from "./workbench.jsx";
import { parseSnapshots } from "./livetree.js";

const cleanErr = (s) => String(s || "").split("\n").filter((l) => !l.trim().startsWith("@@T")).join("\n").trim();

const EMPTY = { xp: 0, done: [], days: [], attempts: {}, firstTry: 0, code: {}, name: "", hintsUsed: {}, missions: [] };

async function storeGet(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function storeSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}
const sbHeaders = { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };

// ---------- Inline markdown-ish renderer ----------
function Rich({ text, size = 14, tight = false }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <p style={{ fontFamily: SANS, color: C.text, lineHeight: 1.65, fontSize: size }} className={tight ? "mb-0" : "mb-3"}>
      {parts.map((p, i) => {
        if (p.startsWith("`")) return <code key={i} style={{ fontFamily: MONO, background: C.ink, color: C.teal, padding: "1px 6px", borderRadius: 4, fontSize: size - 1 }}>{p.slice(1, -1)}</code>;
        if (p.startsWith("**")) return <strong key={i} style={{ color: C.gold }}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
        return p;
      })}
    </p>
  );
}

// ---------- C++ syntax highlighting (tiny tokenizer, no deps) ----------
const HL = { comment: "#7FB56F", string: "#E0A96D", pre: "#6FB3F2", num: "#D9B871", kw: "#6FB3F2", std: "#5FD3BC", brace: "#E8C66B" };
const TOKEN_RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"?)|('(?:[^'\\\n]|\\.)*'?)|(#[^\n]*)|(\b\d+(?:\.\d+)?\b)|(\b(?:auto|bool|break|case|catch|char|class|const|constexpr|continue|default|delete|do|double|else|enum|false|float|for|if|int|long|namespace|new|nullptr|private|public|return|short|signed|sizeof|static|static_cast|struct|switch|template|this|throw|true|try|typedef|unsigned|using|void|while)\b)|(\b(?:std|cout|cin|endl|boolalpha|fixed|setprecision)\b)|([{}()[\]])/g;

function Tokens({ code }) {
  const out = [];
  let last = 0, m, k = 0;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const color = m[1] ? HL.comment : m[2] || m[3] ? HL.string : m[4] ? HL.pre : m[5] ? HL.num : m[6] ? HL.kw : m[7] ? HL.std : HL.brace;
    out.push(<span key={k++} style={{ color }}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

function CodeBlock({ code }) {
  return (
    <pre style={{ fontFamily: MONO, fontSize: 13, lineHeight: 1.55, background: C.ink, color: C.text, padding: "12px 14px", borderRadius: 8, border: `1px solid ${C.line}`, overflowX: "auto", whiteSpace: "pre" }} className="mb-4"><Tokens code={code} /></pre>
  );
}

// AI chat message renderer: prose paragraphs + fenced code blocks
function AiText({ text }) {
  const parts = text.split(/```[a-zA-Z+]*\n?([\s\S]*?)```/g);
  return parts.map((p, i) =>
    i % 2 === 1
      ? <CodeBlock key={i} code={p.replace(/\n+$/, "")} />
      : (p.trim() ? p.trim().split(/\n{2,}/).map((para, j) => <Rich key={`${i}-${j}`} text={para} size={13.5} />) : null));
}

// ---------- Main ----------
export default function CppQuest() {
  const [state, setState] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState("l1");
  const [code, setCode] = useState("");
  const [running, setRunning] = useState(false);
  const [arena, setArena] = useState(false);
  const [bench, setBench] = useState(false);
  const [result, setResult] = useState(null);
  const [openHints, setOpenHints] = useState({});
  const [aiHint, setAiHint] = useState({ loading: false, text: "", error: "" });
  const [burst, setBurst] = useState(null);
  const [tab, setTab] = useState("tests");
  const [board, setBoard] = useState([]);
  const [nameDraft, setNameDraft] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [explainers, setExplainers] = useState({});
  const [chatOpen, setChatOpen] = useState(false);
  const [chats, setChats] = useState({});
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const gutterRef = useRef(null);
  const hlRef = useRef(null);
  const chatEndRef = useRef(null);

  const [curriculum, setCurriculum] = useState(null);
  const [loadErr, setLoadErr] = useState(false);
  const CHAPTERS = curriculum ? curriculum.chapters : [];
  const LESSONS = curriculum ? curriculum.lessons : [];

  const lesson = LESSONS.find((l) => l.id === current);
  const lvl = levelOf(state.xp);
  const streak = streakOf(state.days);
  const doneToday = state.days.includes(todayKey());
  const unlocked = (id) => {
    const i = LESSONS.findIndex((l) => l.id === id);
    if (i === 0) return true;
    if (LESSONS[i].chapter !== LESSONS[i - 1].chapter) return true; // every topic starts open
    return state.done.includes(LESSONS[i - 1].id);
  };

  useEffect(() => {
    (async () => {
      const saved = await storeGet("cppquest:progress:v2");
      if (saved) { setState({ ...EMPTY, ...saved }); setNameDraft(saved.name || ""); }
      setLoaded(true);
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/curriculum?id=eq.1&select=chapters,lessons`, { headers: sbHeaders });
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0] && Array.isArray(rows[0].lessons) && rows[0].lessons.length) setCurriculum(rows[0]);
        else setLoadErr(true);
      } catch { setLoadErr(true); }
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/explainers?select=lesson_id,blocks`, { headers: sbHeaders });
        const rows = await res.json();
        if (Array.isArray(rows)) setExplainers(Object.fromEntries(rows.map((r) => [r.lesson_id, r.blocks])));
      } catch { /* fall back to terse notes */ }
    })();
  }, []);
  useEffect(() => { if (loaded) storeSet("cppquest:progress:v2", state); }, [state, loaded]);

  useEffect(() => {
    if (!lesson) return;
    setCode(state.code[current] || lesson.starter);
    setResult(null); setOpenHints({}); setTab("tests"); setAiHint({ loading: false, text: "", error: "" }); setChatInput("");
  }, [current, curriculum]); // eslint-disable-line

  const loadBoard = useCallback(async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/scores?select=name,xp,level,done&order=xp.desc&limit=10`, { headers: sbHeaders });
      const rows = await res.json();
      setBoard(Array.isArray(rows) ? rows : []);
    } catch { setBoard([]); }
  }, []);
  useEffect(() => { if (tab === "board") loadBoard(); }, [tab, loadBoard]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ block: "end" }); }, [chats, chatSending, chatOpen]);

  const publishScore = async (s) => {
    const clean = (s.name || "").trim().slice(0, 16);
    if (!clean) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/scores`, {
        method: "POST",
        headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify([{ name: clean, xp: s.xp, level: levelOf(s.xp).level, done: s.done.length, updated_at: new Date().toISOString() }]),
      });
    } catch { /* leaderboard is best-effort */ }
  };

  // One-shot compile+run for the Workbench shell: returns {compileErr|netErr|stdout,stderr,exit}
  const compileOnce = async (code, input = "") => {
    try {
      const res = await fetch(COMPILE_API, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY }, body: JSON.stringify({ code, tests: [{ input, expected: "" }] }) });
      const data = await res.json();
      if (data.error) return { netErr: data.error };
      if (data.compile_error) return { compileErr: data.compile_error };
      const o = data.outcomes?.[0] || {};
      return { stdout: o.got || "", stderr: cleanErr(o.stderr || ""), exit: o.exit_code || 0 };
    } catch (err) { return { netErr: String(err) }; }
  };

  const runSummary = () => {
    if (result?.compileErr) return "Compile error: " + result.compileErr.slice(0, 600);
    if (result?.outcomes) {
      const fails = result.outcomes.filter((o) => !o.pass);
      return fails.length === 0 ? "All tests passing."
        : fails.slice(0, 2).map((o) => `For input ${JSON.stringify(o.input)} expected ${JSON.stringify(norm(o.expected))} but got ${JSON.stringify(norm(o.got))}${o.exit_code && o.exit_code !== 0 ? ` (exit code ${o.exit_code})` : ""}`).join("; ");
    }
    return "";
  };

  async function getAiHint() {
    if (aiHint.loading) return;
    setAiHint((h) => ({ ...h, loading: true, error: "" }));
    const summary = runSummary();
    try {
      let data = null;
      for (let attempt = 0; attempt < 2 && !(data && (data.hint || data.error === "not_configured")); attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1200));
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/hint`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
            body: JSON.stringify({
              title: lesson.title,
              challenge: lesson.challenge,
              tests: lesson.tests,
              code,
              result_summary: summary,
            }),
          });
          data = await res.json();
        } catch { data = null; }
      }
      if (!data) throw new Error("unreachable");
      if (data.hint) setAiHint({ loading: false, text: data.hint, error: "" });
      else if (data.error === "not_configured") setAiHint({ loading: false, text: "", error: "AI hints aren't set up yet — ask the site owner to add an API key." });
      else setAiHint({ loading: false, text: "", error: data.error || "Something went wrong. Try again." });
    } catch {
      setAiHint({ loading: false, text: "", error: "Couldn't reach the hint service. Check your connection." });
    }
  }

  async function sendChat(text) {
    const t = (text || "").trim();
    if (!t || chatSending) return;
    const history = [...(chats[current] || []), { role: "user", content: t.slice(0, 2000) }];
    setChats((c) => ({ ...c, [current]: history }));
    setChatInput("");
    setChatSending(true);
    try {
      let data = null;
      for (let attempt = 0; attempt < 2 && !(data && (data.reply || data.error === "not_configured")); attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1200));
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
            body: JSON.stringify({ title: lesson.title, challenge: lesson.challenge, tests: lesson.tests, code: fullCode, result_summary: runSummary(), messages: history.slice(-12) }),
          });
          data = await res.json();
        } catch { data = null; }
      }
      if (!data) throw new Error("unreachable");
      const reply = data.reply || (data.error === "not_configured" ? "AI chat isn't set up yet — ask the site owner to add an API key." : "Hmm, I hit a snag. Try sending that again.");
      setChats((c) => ({ ...c, [current]: [...(c[current] || []), { role: "assistant", content: reply }] }));
    } catch {
      setChats((c) => ({ ...c, [current]: [...(c[current] || []), { role: "assistant", content: "I couldn't reach the tutor service — check your connection and try again." }] }));
    }
    setChatSending(false);
  }

  const onKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.target, s = el.selectionStart, t = el.selectionEnd;
      const next = code.slice(0, s) + "    " + code.slice(t);
      setCode(next);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 4; });
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run();
  };

  // Some lessons keep scaffolding (headers, class declaration, driver) out of the editor.
  // It is wrapped around the student's code at compile time, and error lines are mapped back.
  const preludeLines = lesson?.prelude ? lesson.prelude.split("\n").length : 0;
  const fullCode = (lesson?.prelude ? lesson.prelude + "\n" : "") + code + (lesson?.postlude ? "\n" + lesson.postlude : "");
  const remapErr = (txt) => {
    if (!preludeLines) return txt;
    const n = code.split("\n").length;
    return String(txt).replace(/^([^\s:]+):(\d+):/gm, (m, f, l) => {
      const k = +l - preludeLines;
      if (k < 1) return `(hidden scaffolding, line ${l}):`;
      if (k > n) return `(driver, line ${k - n}):`;
      return `${f}:${k}:`;
    });
  };

  async function run() {
    if (running) return;
    setRunning(true); setResult(null); setTab("tests");
    const attempts = (state.attempts[lesson.id] || 0) + 1;
    setState((s) => ({ ...s, attempts: { ...s.attempts, [lesson.id]: attempts }, code: { ...s.code, [lesson.id]: code } }));

    let outcomes = [], compileErr = null, netErr = null;
    try {
      const res = await fetch(COMPILE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
        body: JSON.stringify({ code: fullCode, tests: lesson.tests.map((t) => ({ input: t.input, expected: t.expected })) }),
      });
      const data = await res.json();
      if (data.error) netErr = data.error;
      else if (data.compile_error) compileErr = remapErr(data.compile_error);
      else outcomes = (data.outcomes || []).map((o) => ({ ...o, pass: norm(o.got) === norm(o.expected) }));
    } catch (err) { netErr = String(err); }
    setRunning(false);

    if (netErr) { setResult({ netErr }); return; }
    if (compileErr) { setResult({ compileErr }); return; }
    const passed = outcomes.every((o) => o.pass);
    const snaps = parseSnapshots(outcomes[0]?.stderr || "");
    setResult({ outcomes, passed, snaps });

    if (passed && !state.done.includes(lesson.id)) {
      const before = lvl.level;
      const next = {
        ...state,
        xp: state.xp + lesson.xp,
        done: [...state.done, lesson.id],
        days: state.days.includes(todayKey()) ? state.days : [...state.days, todayKey()],
        firstTry: state.firstTry + (attempts === 1 ? 1 : 0),
        attempts: { ...state.attempts, [lesson.id]: attempts },
        code: { ...state.code, [lesson.id]: code },
      };
      const newBadges = BADGES.filter((b) => !b.check(state, LESSONS) && b.check(next, LESSONS)).map((b) => b.name);
      setState(next);
      publishScore(next);
      setBurst({ xp: lesson.xp, levelUp: levelOf(next.xp).level > before, badges: newBadges });
      setTimeout(() => setBurst(null), 3200);
    }
  }

  const earned = BADGES.filter((b) => b.check(state, LESSONS));
  const idx = LESSONS.findIndex((l) => l.id === current);
  const nextLesson = LESSONS[idx + 1];
  const lineCount = code.split("\n").length;
  const diff = lesson ? difficultyOf(lesson) : "";

  const btn = (extra = {}) => ({ fontFamily: MONO, fontSize: 13, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, color: C.muted, cursor: "pointer", ...extra });

  if (!lesson) {
    return (
      <div style={{ background: C.bg, color: C.muted, fontFamily: MONO, fontSize: 14, height: "100vh" }} className="flex items-center justify-center">
        {loadErr ? "Couldn't load the lessons. Check your connection and refresh." : "Loading lessons…"}
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: SANS, height: "100vh" }} className="flex flex-col">
      <style>{`
        @keyframes cq-rise { 0%{opacity:0; transform:translateY(12px) scale(.9)} 15%{opacity:1; transform:translateY(0) scale(1)} 80%{opacity:1} 100%{opacity:0; transform:translateY(-20px)} }
        @keyframes cq-spin { to { transform: rotate(360deg) } }
        .cq-burst { animation: cq-rise 3.2s ease-out forwards }
        @media (prefers-reduced-motion: reduce) { .cq-burst { animation: none } }
        .cq-editor:focus { outline: none }
        .cq-node:focus-visible, .cq-btn:focus-visible { outline: 2px solid ${C.gold}; outline-offset: 2px }
        .cq-editor::selection { background: ${C.line} }
      `}</style>

      {/* Top bar */}
      <header style={{ borderBottom: `1px solid ${C.line}`, background: C.panel, flexShrink: 0 }} className="flex items-center gap-4 px-4 py-2.5 flex-wrap">
        <button className="cq-btn" onClick={() => setMapOpen(true)} style={btn({ padding: "6px 12px" })} aria-label="Open lesson map">☰</button>
        <button className="cq-btn" onClick={() => setTopicsOpen(true)} style={btn({ padding: "6px 12px", color: C.gold, border: `1px solid ${C.gold}` })} aria-label="Choose a topic">📚 Topics</button>
        <button className="cq-btn" onClick={() => { setArena(false); setBench(!bench); }} style={btn({ padding: "6px 12px", color: bench ? C.ink : C.text, background: bench ? C.text : undefined, border: `1px solid ${C.text}` })} aria-label="Workbench: the four-window build loop" title="Dr. Wheat's four windows: header, implementation, driver + Makefile, shell">🖥 Workbench</button>
        <button className="cq-btn" onClick={() => { setBench(false); setArena(!arena); }} style={btn({ padding: "6px 12px", color: arena ? C.ink : C.teal, background: arena ? C.teal : undefined, border: `1px solid ${C.teal}` })} aria-label="Tree Arena game">🎮 Arena</button>
        <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, letterSpacing: -0.5 }}>
          cpp<span style={{ color: C.gold }}>quest</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 13, color: C.muted }} className="hidden sm:block">{lesson.title}</div>
        <div className="flex items-center gap-3 flex-1 justify-end" style={{ fontFamily: MONO, fontSize: 13 }}>
          <span title={`Level ${lvl.level} — ${lvl.into}/${lvl.need} xp`} style={{ color: C.gold }}>Lv {lvl.level}</span>
          <div style={{ background: C.ink, height: 8, borderRadius: 4, width: 110, overflow: "hidden" }} aria-label="XP progress">
            <div style={{ width: `${(lvl.into / lvl.need) * 100}%`, height: "100%", background: C.gold, transition: "width .6s ease" }} />
          </div>
          <span title="Current streak">🔥 {streak}</span>
          <span style={{ color: doneToday ? C.teal : C.muted }} title="Daily goal: one lesson">{doneToday ? "✓" : "○"} today</span>
        </div>
      </header>

      {arena && (
        <Arena best={state.arenaBest || 0} onClose={() => setArena(false)}
          ask={async (messages, ctx) => {
            let data = null;
            for (let attempt = 0; attempt < 2 && !(data && (data.reply || data.error === "not_configured")); attempt++) {
              if (attempt > 0) await new Promise((r) => setTimeout(r, 1200));
              try {
                const res = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
                  body: JSON.stringify({ title: ctx.title, challenge: ctx.challenge, tests: [], code: ctx.code, result_summary: ctx.summary, messages: messages.slice(-12) }),
                });
                data = await res.json();
              } catch { data = null; }
            }
            if (!data) throw new Error("unreachable");
            if (data.reply) return data.reply;
            if (data.error === "not_configured") return "The tutor isn't configured on this deployment yet.";
            throw new Error(data.error || "no reply");
          }}
          onFinish={({ score, correct, xp }) => {
            setState((s) => ({ ...s, xp: s.xp + xp, arenaBest: Math.max(s.arenaBest || 0, score) }));
            if (xp > 0) setBurst({ xp, levelUp: false, badges: [] });
          }} />
      )}
      {bench && (
        <Workbench compile={compileOnce} onClose={() => setBench(false)} tourDone={!!state.benchTour}
          onFinish={({ xp }) => { setState((s) => ({ ...s, xp: s.xp + xp, benchTour: true })); setBurst({ xp, levelUp: false, badges: [] }); }} />
      )}
      <div className="flex flex-1 flex-col lg:flex-row" style={{ minHeight: 0, display: arena || bench ? "none" : undefined }}>
        {/* LEFT: lesson content, challenge, hints */}
        <div className="overflow-y-auto p-6 w-full" style={{ maxWidth: "44rem", flexShrink: 0, borderRight: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: MONO, fontSize: 12, color: C.muted }} className="mb-1">Lesson {idx + 1} of {LESSONS.length}</div>
          <h1 style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }} className="mb-4">{lesson.title}</h1>

          {result?.snaps?.length > 0 && <LiveTree snapshots={result.snaps} />}
          {lesson.starter?.includes("void snapshot(") && (
            <TreeLab key={lesson.id} lessonId={lesson.id} chapter={lesson.chapter} doneMissions={state.missions || []}
              run={async (input) => {
                const res = await fetch(COMPILE_API, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY }, body: JSON.stringify({ code, tests: [{ input, expected: "" }] }) });
                const data = await res.json();
                if (data.error) return { error: data.error };
                if (data.compile_error) return { error: data.compile_error.split("\n")[0] };
                const o = data.outcomes?.[0];
                return { snaps: parseSnapshots(o?.stderr || ""), stdout: o?.got || "" };
              }}
              onMission={(ids, ms) => {
                const gained = ms.reduce((a, m) => a + m.xp, 0);
                setState((s) => ({ ...s, xp: s.xp + gained, missions: [...(s.missions || []), ...ids] }));
                setBurst({ xp: gained, levelUp: false, badges: [] });
              }} />
          )}
          {(lesson.id === "l28" || lesson.id === "l29") ? <RecViz key={lesson.id} mode={lesson.id === "l28" ? "sumto" : "climb"} />
            : (lesson.chapter === "c7" || lesson.chapter === "c8") && <BSTViz key={lesson.id} mode={{ l32: "inorder", l33: "findmin", l34: "inorder", l37: "inorder" }[lesson.id] || "insert"} />}

          {(explainers[lesson.id] || []).map((b, i) =>
            b.t === "code" ? <CodeBlock key={i} code={b.x} />
            : b.t === "ul" ? (
              <ul key={i} className="mb-3 pl-6" style={{ listStyleType: "disc", color: "#E8E6DF" }}>
                {b.items.map((it, j) => <li key={j} className="mb-1"><Rich text={it} tight /></li>)}
              </ul>
            )
            : <Rich key={i} text={b.x} />)}
          {!explainers[lesson.id] && lesson.concept.map((t, i) => <Rich key={i} text={t} />)}
          {!explainers[lesson.id] && lesson.example && <CodeBlock code={lesson.example} />}

          {/* Challenge */}
          <div style={{ borderTop: `1px solid ${C.line}` }} className="pt-5 mt-5">
            <div className="flex items-center gap-3 mb-3">
              <span style={{ fontFamily: MONO, fontSize: 19, fontWeight: 700 }}>💡 Challenge</span>
              <span style={{ fontFamily: MONO, fontSize: 12, background: lesson.boss ? C.coral : C.blue, color: C.ink, padding: "3px 12px", borderRadius: 999, fontWeight: 700 }}>{diff}</span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: C.gold }}>+{lesson.xp} xp</span>
            </div>
            <Rich text={lesson.challenge} />
            {lesson.tests[0].input && (
              <div style={{ fontFamily: MONO, fontSize: 12.5, color: C.muted }} className="mb-2">
                Example: input <code style={{ color: C.text }}>{JSON.stringify(lesson.tests[0].input)}</code> → output <code style={{ color: C.teal }}>{JSON.stringify(lesson.tests[0].expected)}</code>
              </div>
            )}
          </div>

          {/* Hints */}
          <div style={{ borderTop: `1px solid ${C.line}` }} className="pt-5 mt-5">
            <div style={{ fontFamily: MONO, fontSize: 19, fontWeight: 700 }} className="mb-3">🛟 Hints</div>
            {/* AI hint */}
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: C.panel }} className="mb-3 p-4">
              {aiHint.text && (
                <div className="mb-3">
                  {aiHint.text.split(/\n{2,}/).map((para, i) => <Rich key={i} text={para} size={13.5} />)}
                </div>
              )}
              {aiHint.error && <div style={{ fontFamily: MONO, fontSize: 12.5, color: C.coral }} className="mb-3">{aiHint.error}</div>}
              <div className="flex items-center gap-3">
                <button className="cq-btn" onClick={getAiHint} disabled={aiHint.loading}
                  style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, background: aiHint.loading ? C.line : C.panel2, color: C.teal, border: `1px solid ${C.teal}`, padding: "8px 16px", borderRadius: 8, cursor: aiHint.loading ? "wait" : "pointer" }}>
                  {aiHint.loading ? "Thinking…" : aiHint.text ? "\u21bb Another hint" : "\u2728 Get AI hint"}
                </button>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.muted }}>Reads your current code · nudges, never spoils</span>
              </div>
            </div>

            {lesson.hints.map((h, i) => {
              const open = !!openHints[i];
              const available = i === 0 || openHints[i - 1];
              return (
                <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 10, opacity: available ? 1 : 0.5 }} className="mb-2">
                  <button className="cq-btn w-full text-left flex items-center justify-between px-4 py-3" disabled={!available}
                    onClick={() => setOpenHints((o) => ({ ...o, [i]: !o[i] }))}
                    style={{ fontFamily: MONO, fontSize: 14, color: C.text, cursor: available ? "pointer" : "not-allowed" }}>
                    <span>Hint {i + 1} <span style={{ color: C.muted, fontSize: 12 }}>{open ? "· revealed" : available ? "" : "· reveal previous hint first"}</span></span>
                    <span style={{ color: C.muted, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>›</span>
                  </button>
                  {open && <div className="px-4 pb-3"><Rich text={h} size={13.5} /></div>}
                </div>
              );
            })}
          </div>

          {/* Badges */}
          <div style={{ borderTop: `1px solid ${C.line}` }} className="pt-5 mt-5 pb-8">
            <div style={{ fontFamily: MONO, fontSize: 13, color: C.muted }} className="mb-2">Badges {earned.length}/{BADGES.length}</div>
            <div className="flex flex-wrap gap-2">
              {BADGES.map((b) => {
                const has = earned.includes(b);
                return <span key={b.id} title={b.how} style={{ fontFamily: MONO, fontSize: 11, padding: "3px 8px", borderRadius: 999, border: `1px solid ${has ? C.gold : C.line}`, color: has ? C.gold : C.muted, opacity: has ? 1 : 0.6 }}>{b.name}</span>;
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: editor + test cases */}
        <div className="flex-1 flex flex-col" style={{ minWidth: 0, minHeight: 0, overflowY: "auto" }}>
          {/* Editor */}
          <div className="flex flex-col" style={{ flexShrink: 0 }}>
            <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: `1px solid ${C.line}` }}>
              <span style={{ fontFamily: MONO, fontSize: 12, background: C.panel2, border: `1px solid ${C.line}`, padding: "3px 10px", borderRadius: 6 }}>C++</span>
              <button className="cq-btn" onClick={() => setCode(lesson.starter)} style={btn({ padding: "4px 10px", fontSize: 12 })} title="Reset to starter code">↺ Reset</button>
            </div>
            <div className="flex" style={{ height: Math.max(220, Math.round(lineCount * 20.925) + 34), background: C.ink }}>
              <div ref={gutterRef} aria-hidden="true" style={{ fontFamily: MONO, fontSize: 13.5, lineHeight: 1.55, color: C.muted, padding: "16px 0", width: 48, textAlign: "right", overflow: "hidden", userSelect: "none", flexShrink: 0 }}>
                {Array.from({ length: lineCount }, (_, i) => <div key={i} style={{ paddingRight: 14 }}>{i + 1}</div>)}
              </div>
              <div className="flex-1" style={{ position: "relative", minWidth: 0 }}>
                <pre ref={hlRef} aria-hidden="true"
                  style={{ position: "absolute", inset: 0, margin: 0, fontFamily: MONO, fontSize: 13.5, lineHeight: 1.55, color: C.text, padding: "16px 16px 16px 0", tabSize: 4, whiteSpace: "pre", overflow: "hidden", pointerEvents: "none" }}>
                  <Tokens code={code + "\n"} />
                </pre>
                <textarea value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={onKeyDown}
                  onScroll={(e) => { const t = e.target; if (gutterRef.current) gutterRef.current.scrollTop = t.scrollTop; if (hlRef.current) { hlRef.current.scrollTop = t.scrollTop; hlRef.current.scrollLeft = t.scrollLeft; } }}
                  spellCheck={false} wrap="off" aria-label="Code editor"
                  className="cq-editor resize-none"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", fontFamily: MONO, fontSize: 13.5, lineHeight: 1.55, background: "transparent", color: "transparent", caretColor: C.gold, border: "none", padding: "16px 16px 16px 0", tabSize: 4, whiteSpace: "pre", overflowX: "auto" }} />
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted }} className="hidden sm:block">Ctrl+Enter to run · Tab indents</span>
              <div className="flex-1" />
              {result?.passed && nextLesson && unlocked(nextLesson.id) && (
                <button className="cq-btn" onClick={() => setCurrent(nextLesson.id)} style={btn({ color: C.teal, border: `1px solid ${C.teal}` })}>Next: {nextLesson.title} →</button>
              )}
              {result?.passed && !nextLesson && <span style={{ fontFamily: MONO, color: C.teal, fontSize: 13 }}>You cleared the map.</span>}
              <button className="cq-btn" onClick={() => setChatOpen(true)} style={btn({ color: C.gold, border: `1px solid ${C.gold}` })}>🤖 Ask AI</button>
              <button className="cq-btn" onClick={run} disabled={running}
                style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14, background: running ? C.line : C.blue, color: "#fff", padding: "9px 26px", borderRadius: 8, border: "none", cursor: running ? "wait" : "pointer" }}>
                {running ? "Running…" : "▶ Run"}
              </button>
            </div>
          </div>

          {/* Test cases / leaderboard */}
          <div className="flex flex-col" style={{ flexShrink: 0, minHeight: 180, borderTop: `1px solid ${C.line}`, background: C.panel, minWidth: 0 }}>
            <div className="flex" style={{ borderBottom: `1px solid ${C.line}` }}>
              {[["tests", result?.passed ? "TEST CASES ✓" : "TEST CASES"], ["board", "LEADERBOARD"]].map(([k, label]) => (
                <button key={k} className="cq-btn px-5 py-2.5" onClick={() => setTab(k)}
                  style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 0.5, color: tab === k ? (k === "tests" && result?.passed ? C.teal : C.text) : C.muted, borderBottom: `2px solid ${tab === k ? C.gold : "transparent"}` }}>{label}</button>
              ))}
            </div>

            {tab === "tests" && (
              <div className="p-4 overflow-y-auto overflow-x-hidden flex-1" style={{ fontFamily: MONO, fontSize: 12.5, overflowWrap: "break-word" }}>
                {running && <div style={{ color: C.muted }} className="flex items-center gap-2"><span style={{ display: "inline-block", width: 12, height: 12, border: `2px solid ${C.line}`, borderTopColor: C.gold, borderRadius: 6, animation: "cq-spin .8s linear infinite" }} />Compiling and running…</div>}
                {result?.netErr && (
                  <div style={{ color: C.coral }}>
                    <div className="mb-2">Couldn't reach the compiler service.</div>
                    <div style={{ color: C.muted }}>Check your connection and try again.</div>
                    <div style={{ color: C.muted, marginTop: 8, fontSize: 11 }}>{result.netErr}</div>
                  </div>
                )}
                {result?.compileErr && (
                  <div>
                    <div style={{ color: C.coral, fontWeight: 700 }} className="mb-2">Compile error</div>
                    <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word", maxWidth: "100%", color: C.text, background: C.ink, padding: 10, borderRadius: 6, fontSize: 11.5 }}>{result.compileErr}</pre>
                  </div>
                )}
                {!running && !result?.compileErr && !result?.netErr && (
                  <div>
                    {result?.outcomes && (
                      <div style={{ color: result.passed ? C.teal : C.coral, fontWeight: 700 }} className="mb-3">
                        {result.outcomes.filter((o) => o.pass).length}/{result.outcomes.length} tests passed{result.passed ? ` — +${lesson.xp} xp` : ""}
                      </div>
                    )}
                    {lesson.tests.map((t, i) => {
                      const o = result?.outcomes?.[i];
                      return (
                        <div key={i} className="mb-3 rounded" style={{ border: `1px solid ${o ? (o.pass ? C.teal : C.coral) : C.line}`, overflow: "hidden" }}>
                          <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: C.panel2, fontSize: 12 }}>
                            <span style={{ color: o ? (o.pass ? C.teal : C.coral) : C.muted }}>{o ? (o.pass ? "✓" : "✗") : "•"} Test {i + 1}</span>
                            {t.input && <span style={{ color: C.muted, overflowWrap: "anywhere" }}>input: {JSON.stringify(t.input)}</span>}
                          </div>
                          <div className="flex flex-col sm:flex-row">
                            <div className="flex-1 px-3 py-2" style={{ minWidth: 0 }}>
                              <div style={{ color: C.muted, fontSize: 11 }} className="mb-1">Output</div>
                              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: o ? C.text : C.muted, fontSize: 12 }}>{o ? (norm(o.got) || "(no output)") : "—"}</pre>
                              {o && !o.pass && cleanErr(o.stderr) && <div style={{ color: C.coral, marginTop: 4, overflowWrap: "anywhere", fontSize: 11 }}>{cleanErr(o.stderr).slice(0, 200)}</div>}
                            </div>
                            <div className="flex-1 px-3 py-2" style={{ minWidth: 0, borderLeft: `1px solid ${C.line}` }}>
                              <div style={{ color: C.muted, fontSize: 11 }} className="mb-1">Expected Output</div>
                              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: C.text, fontSize: 12 }}>{t.expected}</pre>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {result && !result.passed && <div style={{ color: C.muted }}>Attempt {state.attempts[lesson.id] || 1}. Stuck? Open a hint on the left.</div>}
                    {!result && <div style={{ color: C.muted }}>Press Run to check your code against {lesson.tests.length} test{lesson.tests.length > 1 ? "s" : ""}.</div>}
                  </div>
                )}
              </div>
            )}

            {tab === "board" && (
              <div className="p-4 overflow-y-auto flex-1" style={{ fontFamily: MONO, fontSize: 12.5 }}>
                <div style={{ color: C.muted }} className="mb-2">Pick a display name to appear on the shared board. Your name and score are visible to everyone using this app.</div>
                <div className="flex gap-2 mb-4">
                  <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value.slice(0, 16))} placeholder="display name" aria-label="Display name"
                    style={{ fontFamily: MONO, background: C.ink, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 10px", flex: 1, minWidth: 0 }} />
                  <button className="cq-btn" onClick={async () => { const s = { ...state, name: nameDraft.trim() }; setState(s); await publishScore(s); loadBoard(); }}
                    style={{ background: C.gold, color: C.ink, fontWeight: 700, padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer" }}>Save</button>
                </div>
                {board.length === 0 && <div style={{ color: C.muted }}>No scores yet. Pass a lesson to post yours.</div>}
                {board.map((r, i) => (
                  <div key={r.name} className="flex items-center gap-3 py-2" style={{ borderBottom: `1px solid ${C.line}`, color: r.name === state.name ? C.gold : C.text }}>
                    <span style={{ color: C.muted, width: 20 }}>{i + 1}</span>
                    <span className="flex-1 truncate">{r.name}</span>
                    <span style={{ color: C.muted }}>Lv {r.level}</span>
                    <span>{r.xp} xp</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Topic picker */}
      {topicsOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-label="Choose a topic">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.6)" }} onClick={() => setTopicsOpen(false)} />
          <div className="relative overflow-y-auto p-6 w-full" style={{ maxWidth: 620, maxHeight: "85vh", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14 }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 19 }}>Pick a topic</span>
              <button className="cq-btn" onClick={() => setTopicsOpen(false)} style={btn({ padding: "4px 10px" })} aria-label="Close topic picker">✕</button>
            </div>
            <div style={{ fontFamily: SANS, fontSize: 13, color: C.muted }} className="mb-4">Jump straight to whatever your class is on. Every topic starts unlocked.</div>
            {CHAPTERS.map((ch, ci) => {
              const ls = LESSONS.filter((l) => l.chapter === ch.id);
              const doneCount = ls.filter((l) => state.done.includes(l.id)).length;
              const target = ls.find((l) => !state.done.includes(l.id)) || ls[0];
              const label = doneCount === ls.length ? "Replay" : doneCount > 0 ? "Continue" : "Start";
              return (
                <button key={ch.id} className="cq-btn w-full text-left mb-3 p-4 rounded-xl"
                  onClick={() => { setCurrent(target.id); setTopicsOpen(false); }}
                  style={{ background: C.panel2, border: `1px solid ${doneCount === ls.length ? C.teal : C.line}`, borderRadius: 12, cursor: "pointer", display: "block", width: "100%" }}>
                  <div className="flex items-center gap-3 mb-1">
                    <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>Topic {ci + 1}</span>
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15, color: C.text }} className="flex-1">{ch.title}</span>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: doneCount === ls.length ? C.teal : C.gold }}>{label} →</span>
                  </div>
                  <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.muted }} className="mb-2">{ch.blurb}</div>
                  <div className="flex items-center gap-3">
                    <div style={{ background: C.ink, height: 6, borderRadius: 3, flex: 1, overflow: "hidden" }}>
                      <div style={{ width: `${(doneCount / ls.length) * 100}%`, height: "100%", background: doneCount === ls.length ? C.teal : C.gold }} />
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{doneCount}/{ls.length}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lesson map drawer */}
      {mapOpen && (
        <div className="fixed inset-0 z-40" role="dialog" aria-label="Lesson map">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.5)" }} onClick={() => setMapOpen(false)} />
          <div className="absolute inset-y-0 left-0 overflow-y-auto p-4" style={{ width: 300, background: C.panel, borderRight: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between mb-4">
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 16 }}>Lessons</span>
              <button className="cq-btn" onClick={() => setMapOpen(false)} style={btn({ padding: "4px 10px" })} aria-label="Close lesson map">✕</button>
            </div>
            {CHAPTERS.map((ch, ci) => {
              const ls = LESSONS.filter((l) => l.chapter === ch.id);
              return (
                <div key={ch.id} className="mb-5">
                  <div style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}>Chapter {ci + 1}</div>
                  <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15 }} className="mb-1">{ch.title}</div>
                  <div style={{ fontSize: 12, color: C.muted }} className="mb-3">{ch.blurb}</div>
                  <div>
                    {ls.map((l, li) => {
                      const done = state.done.includes(l.id), open = unlocked(l.id), active = l.id === current;
                      const seg = (hidden) => (
                        <span style={{ width: 2, flex: 1, minHeight: 6, background: C.line, visibility: hidden ? "hidden" : "visible" }} />
                      );
                      return (
                        <button key={l.id} disabled={!open} onClick={() => { setCurrent(l.id); setMapOpen(false); }}
                          className="cq-node w-full text-left flex items-stretch gap-3 rounded"
                          style={{ cursor: open ? "pointer" : "not-allowed", background: active ? C.panel2 : "transparent", paddingRight: 8, border: "none" }}>
                          <span className="flex flex-col items-center" style={{ width: 16, flexShrink: 0 }}>
                            {seg(li === 0)}
                            <span aria-hidden="true" style={{
                              width: 16, height: 16, borderRadius: l.boss ? 3 : 8, flexShrink: 0, margin: "4px 0",
                              background: done ? C.teal : active ? C.gold : "transparent",
                              border: `2px solid ${done ? C.teal : active ? C.gold : C.line}`,
                              transform: l.boss ? "rotate(45deg)" : "none",
                            }} />
                            {seg(li === ls.length - 1)}
                          </span>
                          <span className="flex items-center gap-3 flex-1 py-2" style={{ minWidth: 0 }}>
                            <span style={{ fontFamily: MONO, fontSize: 13, flex: 1, color: open ? C.text : C.muted }}>{l.title}</span>
                            <span style={{ fontFamily: MONO, fontSize: 11, color: done ? C.teal : C.muted, opacity: open ? 1 : 0.7 }}>{done ? "✓" : `+${l.xp}`}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ask AI drawer */}
      {chatOpen && (
        <div className="fixed inset-0 z-40" role="dialog" aria-label="Ask AI tutor">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.5)" }} onClick={() => setChatOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex flex-col" style={{ width: "min(430px, 100vw)", background: C.panel, borderLeft: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div className="flex-1">
                <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15 }}>Quest Tutor</div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>Sees this lesson and your code · nudges, never spoils</div>
              </div>
              <button className="cq-btn" onClick={() => setChatOpen(false)} style={btn({ padding: "4px 10px" })} aria-label="Close chat">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {(chats[current] || []).length === 0 && (
                <div>
                  <div style={{ fontFamily: SANS, fontSize: 14, color: C.muted }} className="mb-3">Ask me anything about this lesson — or try one of these:</div>
                  {["Explain this challenge in simpler words", "What does \\n actually do?", "Why is my code not passing?"].map((q) => (
                    <button key={q} className="cq-btn block w-full text-left mb-2" onClick={() => sendChat(q)}
                      style={{ fontFamily: SANS, fontSize: 13, color: C.text, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", width: "100%" }}>{q}</button>
                  ))}
                </div>
              )}
              {(chats[current] || []).map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end mb-3">
                    <div style={{ fontFamily: SANS, fontSize: 13.5, background: C.gold, color: C.ink, borderRadius: 12, padding: "8px 12px", maxWidth: "85%", whiteSpace: "pre-wrap" }}>{m.content}</div>
                  </div>
                ) : (
                  <div key={i} className="mb-3" style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 12px 2px", maxWidth: "95%" }}>
                    <AiText text={m.content} />
                  </div>
                ))}
              {chatSending && <div style={{ fontFamily: MONO, fontSize: 12.5, color: C.muted }} className="mb-3">Quest Tutor is thinking…</div>}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2 p-3" style={{ borderTop: `1px solid ${C.line}`, flexShrink: 0 }}>
              <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} rows={2} placeholder="Ask about this lesson…" aria-label="Message the AI tutor"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(chatInput); } }}
                style={{ fontFamily: SANS, fontSize: 13.5, flex: 1, minWidth: 0, background: C.ink, color: C.text, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 10px", resize: "none" }} />
              <button className="cq-btn" onClick={() => sendChat(chatInput)} disabled={chatSending || !chatInput.trim()}
                style={{ fontFamily: MONO, fontWeight: 700, background: chatSending ? C.line : C.gold, color: C.ink, border: "none", borderRadius: 10, padding: "8px 16px", cursor: chatSending ? "wait" : "pointer", alignSelf: "flex-end" }}>Send</button>
            </div>
          </div>
        </div>
      )}

      {/* XP burst */}
      {burst && (
        <div className="cq-burst" role="status" style={{ position: "fixed", left: "50%", top: "18%", transform: "translateX(-50%)", background: C.panel2, border: `1px solid ${C.gold}`, borderRadius: 12, padding: "14px 22px", textAlign: "center", boxShadow: "0 12px 40px rgba(0,0,0,.4)", zIndex: 50 }}>
          <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, color: C.gold }}>+{burst.xp} xp</div>
          {burst.levelUp && <div style={{ fontFamily: MONO, color: C.teal }}>Level up → {lvl.level + 1}</div>}
          {burst.badges.map((b) => <div key={b} style={{ fontFamily: MONO, fontSize: 13, color: C.text }}>Badge earned: {b}</div>)}
        </div>
      )}
    </div>
  );
}
