import { useRef } from "react";

// Shared C++ syntax highlighting for code-lab editors and answer blocks.
// Same base palette as the lesson editor in App.jsx, plus function and operator colors.
export const HL = {
  comment: "#7FB56F", string: "#E0A96D", pre: "#6FB3F2", num: "#D9B871",
  kw: "#6FB3F2", type: "#6FB3F2", std: "#5FD3BC", brace: "#E8C66B",
  fn: "#EB9CD4", op: "#B89CF2",
};

const KW = new Set("auto break case catch class const constexpr continue default delete do else enum false for if namespace new nullptr private public return sizeof static static_cast struct switch template this throw true try typedef using while".split(" "));
const TYPES = new Set("void int bool char double float long short signed unsigned size_t".split(" "));
const STD = new Set("std cout cin endl vector string".split(" "));

const TOKEN_RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|(#[^\n]*)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|(&&|\|\||[=!<>]=|<<|>>|\+\+|--|->|[-+*/%=<>!&|^~?:])|([{}()[\]])/g;

export function CppTokens({ code }) {
  const out = [];
  let last = 0, m, k = 0;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const t = m[0];
    let style;
    if (m[1]) style = { color: HL.comment, fontStyle: "italic" };
    else if (m[2]) style = { color: HL.string };
    else if (m[3]) style = { color: HL.pre };
    else if (m[4]) style = { color: HL.num };
    else if (m[5]) {
      if (KW.has(t)) style = { color: HL.kw };
      else if (TYPES.has(t)) style = { color: HL.type };
      else if (STD.has(t)) style = { color: HL.std };
      else if (/^\s*\(/.test(code.slice(m.index + t.length))) style = { color: HL.fn };
    }
    else if (m[6]) style = { color: HL.op };
    else style = { color: HL.brace };
    out.push(style ? <span key={k++} style={style}>{t}</span> : t);
    last = m.index + t.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

// Read-only highlighted block.
export function CppCode({ code, style }) {
  return <pre style={{ whiteSpace: "pre", overflowX: "auto", margin: 0, ...style }}><CppTokens code={code} /></pre>;
}

// Editable highlighted textarea: transparent text on top, colored <pre> underneath.
// `textStyle` must hold the font/size/line-height/padding shared by both layers.
export function CppEditor({ value, onChange, rows, textStyle, background, caretColor = "#F2B84B", borderRadius }) {
  const layer = { margin: 0, border: "none", whiteSpace: "pre", tabSize: 4, boxSizing: "border-box", ...textStyle };
  const hl = useRef(null);
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0, background, borderRadius }}>
      <pre ref={hl} aria-hidden="true"
        style={{ ...layer, position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <CppTokens code={value + "\n"} />
      </pre>
      <textarea value={value} onChange={onChange} rows={rows} spellCheck={false} wrap="off"
        onScroll={(e) => { if (hl.current) { hl.current.scrollTop = e.target.scrollTop; hl.current.scrollLeft = e.target.scrollLeft; } }}
        style={{ ...layer, position: "relative", display: "block", width: "100%", background: "transparent", color: "transparent", caretColor, resize: "vertical", outline: "none", overflow: "auto" }} />
    </div>
  );
}
