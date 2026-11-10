import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { CppTokens } from "./cpphl.jsx";
import { NOTES, FILE_INTRO, WALK_ORDER } from "./workbench_notes.js";

// ---------------------------------------------------------------------------
// Workbench: Dr. Wheat's four-window screen, recreated.
//   left   : bag.h in vim        middle : bag.cpp in vim
//   right  : bagMain.cpp / Makefile in vim, and a shell underneath
// The shell runs a real (small) `make`: it parses the Makefile, checks
// timestamps, and compiles through the cppquest compiler service.
// ---------------------------------------------------------------------------

const C = {
  bg: "#1C2230", panel: "#242B3A", panel2: "#2C3446", line: "#3A4358",
  text: "#E8E6DF", muted: "#9AA3B5", gold: "#F2B84B", teal: "#5FD3BC",
  coral: "#E86F6F", ink: "#141924", blue: "#4C9EE8", term: "#0C0C0C",
};
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const CWD = "~/csc255sp26/stage";
const USER = "you@cppquest";
const STORE = "cppquest:workbench:v1";

const RULE = "//" + "*".repeat(78);

// --- His files, as close to the screenshots as a working program allows ---
export const STARTER = {
  "bag.h": `#ifndef __BAG_H
#define __BAG_H

// CSC 255 Spring 2026 - Dr. Wheat
// Assignment: Intro to C++ and its objects
// Team 5: Sam Wright and Sara Smith

${RULE}

class bag {
    private:
        unsigned int bagCount;
        unsigned int bagCapacity;

        int *contents;

    public:
        bag(unsigned int bagCapacity = 100);
        ~bag();

        // to insert a value into the bag; if the value is inserted, it returns
        // true, otherwise it returns false.
        bool insert(int value);

        // to remove a value from the bag; if the value gets removed, it returns
        // true, otherwise it returns false.
        bool remove(int value);

        void clear(); // this empties the bag of all of its values

        // the constant functions
        bool isPresent(int value) const;
        unsigned int getBagCount() const;
        unsigned int getBagCapacity() const;
};

#endif
`,
  "bag.cpp": `#include <cstdio>
#include <iostream>

#include "bag.h"

using namespace std;

${RULE}

bag::bag(unsigned int bagCapacity) {
    bagCount = 0;   // the bag is empty, therefore the count is zero
    this->bagCapacity = bagCapacity; // memorize the capacity of the bag

    contents = new int[bagCapacity];
}

${RULE}

bag::~bag() {
    if (contents != NULL) {
        delete [] contents;
        contents = NULL;
    }
}

${RULE}

bool bag::insert(int value) {
    // if the bagCount and bagCapacity are the same value, then the bag is full
    bool rc = (bagCount < bagCapacity);

    if (rc) {
        // we have room to put the value in the bag
        contents[bagCount++] = value;
    }

    return rc;
}

${RULE}

bool bag::remove(int value) {
    bool rc = false;

    for (unsigned int i = 0; i < bagCount; i++) {
        if (contents[i] == value) {
            // we found the value; so, mark that we found it and remove it
            rc = true;

            // replace it with the last thing in the bag
            contents[i] = contents[--bagCount];

            break;
        }
    }

    return rc;
}

${RULE}

void bag::clear() {
    bagCount = 0;
}

${RULE}

bool bag::isPresent(int value) const {
    bool rc = false;

    for (unsigned int i = 0; i < bagCount; i++) {
        if (contents[i] == value) {
            // we found the value; time to quit the loop and return true
            rc = true;
            break;
        }
    }

    return rc;
}

${RULE}

unsigned int bag::getBagCount() const {
    return bagCount;
}

${RULE}

unsigned int bag::getBagCapacity() const {
    return bagCapacity;
}
`,
  "bagMain.cpp": `// CSC 255 Spring 2026 - Dr. Wheat
// Assignment: Intro to C++
// Team 5: Sam Wright and Sara Smith

#include <iostream>

#include "bag.h"

using namespace std;

${RULE}

int main() {
    bag myBag1;
    bag *myBag2 = new bag(1000);
    bag *myBag3 = new bag();

    myBag1.insert(15);
    myBag1.insert(7);
    myBag1.insert(23);
    myBag1.remove(7);

    cout << "myBag1 holds " << myBag1.getBagCount() << " of "
         << myBag1.getBagCapacity() << endl;
    cout << "is 7 present?  " << (myBag1.isPresent(7) ? "yes" : "no") << endl;
    cout << "is 23 present? " << (myBag1.isPresent(23) ? "yes" : "no") << endl;
    cout << "myBag2 capacity " << myBag2->getBagCapacity() << endl;

    delete myBag3;
    delete myBag2;

    return 0;
}
`,
  "Makefile": `#
# CSC 255 Spring 2026 - Dr. Wheat
# Assignment: Intro to C++
# Team 5: Sam Wright and Sara Smith

CWFLAGS=-Wall -Wextra -O2

all: bag

bag.o: bag.cpp bag.h
\tg++ $(CWFLAGS) -c bag.cpp

bagMain.o: bagMain.cpp bag.h
\tg++ $(CWFLAGS) -c bagMain.cpp

bag: bagMain.o bag.o
\tg++ $(CWFLAGS) bagMain.o bag.o -o bag

clean:
\trm -f *.o bag.exe bag
`,
};

export const BLANK = {
  "bag.h": `#ifndef __BAG_H
#define __BAG_H

// CSC 255 Spring 2026 - Dr. Wheat
// Assignment: Intro to C++ and its objects
// Team 1: Obi Amadi

${RULE}


#endif
`,
  "bag.cpp": `#include <iostream>

#include "bag.h"

using namespace std;

${RULE}

`,
  "bagMain.cpp": `// CSC 255 Spring 2026 - Dr. Wheat
// Assignment: Intro to C++
// Team 1: Obi Amadi

#include <iostream>

#include "bag.h"

using namespace std;

${RULE}

int main() {

    return 0;
}
`,
  "Makefile": `#
# CSC 255 Spring 2026 - Dr. Wheat
# Assignment: Intro to C++
# Team 1: Obi Amadi

`,
};

const SOURCE_FILES = ["bag.h", "bag.cpp", "bagMain.cpp", "Makefile"];

// What each window is for. Shown by the "?" on each title bar and by the tour.
const PANE_HELP = {
  "bag.h": {
    title: "Window 1 — the header, bag.h",
    body: [
      "The **blueprint**. It declares what a bag *is*: three private member variables and the public functions anyone may call. Not one line of implementation lives here.",
      "He keeps it open the whole time because every function he writes in bag.cpp has to agree with the declaration here: same return type, same parameters, same `const`. With the header in view he never has to remember what he declared; he looks.",
      "Two habits graded in every assignment: the include guard (`#ifndef __BAG_H` … `#endif`) so the header can be included twice without harm, and default parameter values (`= 100`) written here and **never** repeated in the .cpp.",
    ],
  },
  "bag.cpp": {
    title: "Window 2 — the implementation, bag.cpp",
    body: [
      "The **engine**. Every function the header promised gets its body here, with `bag::` in front of the name so the compiler knows which class it belongs to.",
      "`#include \"bag.h\"` at the top pastes the header's text in at compile time. That is how this file knows what `bagCount` and `contents` are.",
      "This file compiles once into `bag.o`. Any number of programs can link against that object file without ever seeing this source. That is the whole reason for the .h / .cpp split.",
    ],
  },
  "bagMain.cpp": {
    title: "Window 3 — the driver, bagMain.cpp",
    body: [
      "The **test**. `main()` lives here and nowhere else. It makes some bags, calls their functions, prints what it finds. On assignments he supplies this file; your job is to make the class it calls.",
      "He writes the class first and the driver second, but keeps the driver open so he can add a call for each function the moment he finishes it.",
      "The second tab is the **Makefile**: the recipe the shell follows when you type `make`. One rule per .o file, listing the .cpp *and the headers it includes*, so a header change recompiles everything that depends on it.",
    ],
  },
  shell: {
    title: "Window 4 — the shell",
    body: [
      "Where he **builds and runs**. Nothing is running yet; it waits for `make`, `./bag`, `ls -l`, `touch bag.h`.",
      "It's a separate window on purpose: compiler errors land here, where he can read them while fixing the code next door, instead of inside the editor.",
      "The loop he's teaching is edit → `make` → `./bag` → read → edit again, without ever closing or switching a window. The path in every title bar is the same directory, which is why `make` here finds the files the editors are saving.",
    ],
  },
};

// Guided tour. `wait` = the shell command that advances the step.
const TOUR = [
  { pane: null, text: "This is Dr. Wheat's screen: four windows, one job each. Walk through them with **Next**, or just start typing. Hover the **?** on any window to see what it does." },
  { pane: "bag.h", text: "**Window 1: the header.** Declares what a bag is and nothing more. He keeps it open so bag.cpp can be checked against it line by line. Notice the include guard and the `= 100` default, both here and only here." },
  { pane: "bag.cpp", text: "**Window 2: the implementation.** Every function the header promised, with `bag::` in front. Scroll it: 80 columns, four-space indents, a `//****` line between functions, comments that say why." },
  { pane: "bagMain.cpp", text: "**Window 3: the driver.** `main()` lives here. It makes three bags three different ways (one on the stack, two with `new`), calls insert and remove, prints what it finds. Click the **Makefile** tab to see the recipe `make` will follow." },
  { pane: "shell", text: "**Window 4: the shell.** Type `make` and press Enter. Watch it print one `g++` line per rule it runs.", wait: "make" },
  { pane: "shell", text: "Three commands ran: two compiles (`-c`, one per .cpp) and one link (`-o bag`). Now type `ls -l` to see what appeared.", wait: "ls" },
  { pane: "shell", text: "`bag.o`, `bagMain.o` and `bag` are new, and newer than the sources. Type `./bag` to run the program.", wait: "./bag" },
  { pane: "shell", text: "That output came from bagMain.cpp calling bag.cpp through bag.h. Now type `make` again, changing nothing.", wait: "make" },
  { pane: "shell", text: "Nothing to be done. `make` compared timestamps: every target is newer than its dependencies, so there is no work. Type `touch bag.h` (which only updates its timestamp), then `make`.", wait: "touch", then: "make" },
  { pane: "shell", text: "Both .o files recompiled, because both rules list bag.h as a dependency. That is the whole point of writing the dependencies out. Now edit bag.cpp (change the comment in `insert`, say) and `make` once more.", wait: "make", needsEdit: "bag.cpp" },
  { pane: "shell", text: "Only bag.o recompiled, then the link. That is the edit → make → run loop he does all lecture. **Tour done.** The real exercise: press **Blank files** and write the Bag from memory in his style, then make it build and run.", done: true },
];

// ---------------------------------------------------------------------------
// Tiny make + virtual filesystem
// ---------------------------------------------------------------------------
function parseMakefile(text) {
  const vars = {}, rules = {}, order = [];
  const lines = text.split("\n");
  let cur = null;
  lines.forEach((raw, i) => {
    const line = raw.replace(/\r$/, "");
    if (/^\s*#/.test(line) || !line.trim()) { if (!line.trim() && cur) cur = null; return; }
    if (line.startsWith("\t")) { if (cur) cur.cmds.push({ text: line.slice(1).trim(), line: i + 1 }); return; }
    const v = line.match(/^\s*([A-Za-z_][\w]*)\s*[:?]?=\s*(.*)$/);
    if (v) { vars[v[1]] = v[2].trim(); cur = null; return; }
    const r = line.match(/^([^:=\s][^:=]*):(.*)$/);
    if (r) {
      const targets = r[1].trim().split(/\s+/);
      const deps = r[2].trim() ? r[2].trim().split(/\s+/) : [];
      targets.forEach((t) => { rules[t] = { target: t, deps, cmds: [], line: i + 1 }; order.push(t); cur = rules[t]; });
      return;
    }
    if (/^ +\S/.test(line) && cur) throw new Error(`Makefile:${i + 1}: *** missing separator (did you mean TAB instead of spaces?).  Stop.`);
    throw new Error(`Makefile:${i + 1}: *** missing separator.  Stop.`);
  });
  const expand = (s) => s.replace(/\$\((\w+)\)|\$\{(\w+)\}/g, (_, a, b) => vars[a || b] ?? "");
  Object.values(rules).forEach((r) => { r.deps = r.deps.map(expand).join(" ").split(/\s+/).filter(Boolean); r.cmds = r.cmds.map((c) => ({ ...c, text: expand(c.text) })); });
  return { vars, rules, first: order[0] };
}

// Expand `#include "x.h"` recursively; returns { code, map } where map[i] = {file, line} for combined line i (0-based).
function expandUnit(fs, file, seen = new Set()) {
  const src = fs[file]?.content;
  if (src == null) return { error: `${file}: No such file or directory` };
  const out = [], map = [];
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*#\s*include\s+"([^"]+)"/);
    if (m) {
      const h = m[1];
      if (!fs[h]) return { error: `${file}:${i + 1}:10: fatal error: ${h}: No such file or directory\n ${lines[i].trim()}\n          ^~~~~~~\ncompilation terminated.` };
      if (seen.has(h)) { out.push(""); map.push({ file, line: i + 1 }); continue; }
      const sub = expandUnit(fs, h, new Set([...seen, file]));
      if (sub.error) return sub;
      out.push(...sub.code.split("\n")); map.push(...sub.map);
    } else { out.push(lines[i]); map.push({ file, line: i + 1 }); }
  }
  return { code: out.join("\n"), map };
}

// Rewrite "<anything>.cpp:LINE:COL:" from the compiler service into our file names.
function mapErrors(text, map, onlyFile) {
  const lines = String(text || "").split("\n");
  const kept = []; let keep = true, pending = null;
  for (const l of lines) {
    const m = l.match(/^([^\s:]+):(\d+):(\d+):(.*)$/);
    if (m) {
      const at = map[+m[2] - 1];
      if (at) {
        keep = !onlyFile || at.file === onlyFile || at.file.endsWith(".h");
        if (keep) {
          if (pending) { kept.push(pending.replace(/^[^\s:]+/, at.file)); pending = null; }
          kept.push(`${at.file}:${at.line}:${m[3]}:${m[4]}`);
        }
        continue;
      }
    }
    if (/^[^\s:]+: (In |At global scope)/.test(l)) { pending = l; keep = false; continue; }
    if (keep) kept.push(l);
  }
  return kept.join("\n").trim();
}

const fmtTime = (ms) => {
  const d = new Date(ms);
  const mon = d.toLocaleString("en-US", { month: "short" });
  const hh = String(d.getHours()).padStart(2, "0"), mm = String(d.getMinutes()).padStart(2, "0");
  return `${mon} ${String(d.getDate()).padStart(2, " ")} ${hh}:${mm}`;
};
const pad = (s, n) => String(s).padStart(n, " ");

// Resolve the notes against the files as they stand: each note's `m` is found in order
// within its file, so repeated lines map to the right place. Returns a flat walk list.
function resolveNotes(fs) {
  const last = {}, walk = [];
  for (const n of NOTES) {
    const src = fs[n.file]?.content; if (src == null) continue;
    const lines = src.split("\n"); const start = (last[n.file] ?? -1) + 1;
    let at = -1;
    for (let i = start; i < lines.length; i++) if (lines[i].includes(n.m)) { at = i; break; }
    if (at < 0) continue;
    last[n.file] = at;
    walk.push({ ...n, line: at + 1, code: lines[at] });
  }
  walk.sort((a, b) => WALK_ORDER.indexOf(a.file) - WALK_ORDER.indexOf(b.file) || a.line - b.line);
  const find = (file, m) => walk.find((w) => w.file === file && w.code.includes(m));
  walk.forEach((w) => { w.links = (w.link || []).map((l) => find(l.file, l.m)).filter(Boolean); });
  return walk;
}

// ---------------------------------------------------------------------------
// Rich text for callouts
// ---------------------------------------------------------------------------
function Rich({ text, size = 13.5, color = C.text }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <p style={{ fontFamily: SANS, color, lineHeight: 1.6, fontSize: size, margin: 0 }}>
      {parts.map((p, i) => {
        if (p.startsWith("`")) return <code key={i} style={{ fontFamily: MONO, background: C.ink, color: C.teal, padding: "1px 6px", borderRadius: 4, fontSize: size - 1 }}>{p.slice(1, -1)}</code>;
        if (p.startsWith("**")) return <strong key={i} style={{ color: C.gold }}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
        return p;
      })}
    </p>
  );
}

// ---------------------------------------------------------------------------
// A vim-looking editor pane
// ---------------------------------------------------------------------------
function VimPane({ name, value, onChange, highlight, onHelp, tabs, tab, onTab, dirty, explain, focusLine, linkLines, notedLines, onPickLine }) {
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const hl = useRef(null), gut = useRef(null), ta = useRef(null), focusRef = useRef(null), roRef = useRef(null);
  const lines = value.split("\n");
  useEffect(() => {
    const el = roRef.current, f = focusRef.current; if (!explain || !el || !f) return;
    el.scrollTop = Math.max(0, f.offsetTop - el.clientHeight / 2 + 9); // scroll only this pane, never the page
  }, [explain, focusLine, name]);
  const fill = Math.max(0, 40 - lines.length);
  const textStyle = { fontFamily: MONO, fontSize: 12.5, lineHeight: "18px", padding: "6px 10px 6px 0", tabSize: 4, whiteSpace: "pre", margin: 0, border: "none", boxSizing: "border-box" };
  const updCursor = () => {
    const el = ta.current; if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    const l = before.split("\n"); setCursor({ line: l.length, col: l[l.length - 1].length + 1 });
  };
  const onKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.target, s = el.selectionStart, t = el.selectionEnd;
      onChange(value.slice(0, s) + "    " + value.slice(t));
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 4; updCursor(); });
    }
  };
  const isMake = name === "Makefile";
  return (
    <div className="flex flex-col" style={{ flex: 1, minWidth: 0, minHeight: 0, border: `2px solid ${highlight ? C.gold : "#2a2a2a"}`, borderRadius: 6, overflow: "hidden", background: C.term, boxShadow: highlight ? `0 0 0 3px ${C.gold}33` : "none", transition: "border-color .2s" }}>
      <TitleBar path={CWD} onHelp={onHelp}>
        {tabs ? tabs.map((t) => (
          <button key={t} className="cq-btn" onClick={() => onTab(t)} style={{ fontFamily: MONO, fontSize: 11, padding: "1px 8px", borderRadius: 4, border: `1px solid ${t === tab ? C.gold : "#444"}`, color: t === tab ? C.gold : "#aaa", background: t === tab ? "#2a2410" : "transparent", cursor: "pointer" }}>{t}</button>
        )) : null}
      </TitleBar>
      {explain ? (
        <div ref={roRef} className="flex-1" style={{ minHeight: 0, overflow: "auto", position: "relative", fontFamily: MONO, fontSize: 12.5, lineHeight: "18px", padding: "6px 0" }}>
          {lines.map((l, i) => {
            const n = i + 1, isFocus = focusLine === n, isLink = linkLines?.has(n), has = notedLines?.has(n);
            return (
              <div key={i} ref={isFocus ? focusRef : null} onClick={() => has && onPickLine(name, n)} title={has ? "Explain this line" : undefined}
                style={{ display: "flex", whiteSpace: "pre", cursor: has ? "pointer" : "default", background: isFocus ? "#3a2f0e" : isLink ? "#0f2f2a" : "transparent", borderLeft: `3px solid ${isFocus ? C.gold : isLink ? C.teal : "transparent"}`, color: "#e6e6e6", opacity: has || !l.trim() ? 1 : 0.55 }}>
                <span style={{ width: 31, textAlign: "right", paddingRight: 8, color: isFocus ? C.gold : isLink ? C.teal : has ? "#8a8a8a" : "#4a4a4a", flexShrink: 0, userSelect: "none" }}>{n}</span>
                <span style={{ tabSize: 4 }}>{isMake ? <MakeTokens code={l} /> : <CppTokens code={l} />}{l === "" ? " " : ""}</span>
              </div>
            );
          })}
          {Array.from({ length: fill }, (_, i) => <div key={"f" + i} style={{ color: "#3b6ea8", paddingLeft: 6 }}>~</div>)}
        </div>
      ) : (
      <div className="flex-1 flex" style={{ minHeight: 0, position: "relative" }}>
        <div ref={gut} aria-hidden="true" style={{ ...textStyle, width: 34, color: "#5a5a5a", textAlign: "right", paddingRight: 8, paddingLeft: 0, overflow: "hidden", userSelect: "none", flexShrink: 0 }}>
          {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
          {Array.from({ length: fill }, (_, i) => <div key={"f" + i} style={{ color: "#3b6ea8", textAlign: "left", paddingLeft: 6 }}>~</div>)}
        </div>
        <div className="flex-1" style={{ position: "relative", minWidth: 0 }}>
          <pre ref={hl} aria-hidden="true" style={{ ...textStyle, position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", color: "#e6e6e6" }}>
            {isMake ? <MakeTokens code={value + "\n"} /> : <CppTokens code={value + "\n"} />}
          </pre>
          <textarea ref={ta} value={value} onChange={(e) => { onChange(e.target.value); updCursor(); }} onKeyDown={onKeyDown}
            onKeyUp={updCursor} onClick={updCursor} spellCheck={false} wrap="off" aria-label={`${name} editor`}
            onScroll={(e) => { const t = e.target; if (hl.current) { hl.current.scrollTop = t.scrollTop; hl.current.scrollLeft = t.scrollLeft; } if (gut.current) gut.current.scrollTop = t.scrollTop; }}
            className="cq-editor"
            style={{ ...textStyle, position: "absolute", inset: 0, width: "100%", height: "100%", background: "transparent", color: "transparent", caretColor: "#fff", resize: "none", outline: "none", overflow: "auto" }} />
        </div>
      </div>
      )}
      <div className="flex items-center" style={{ fontFamily: MONO, fontSize: 11.5, color: "#ddd", background: "#1a1a1a", padding: "2px 8px", borderTop: "1px solid #2a2a2a", gap: 12 }}>
        <span>"{name}"{dirty ? " [+]" : ""} {lines.length}L{explain ? " [RO]" : ""}</span>
        <span className="flex-1" />
        <span>{explain ? (focusLine || 1) + ",1" : `${cursor.line},${cursor.col}`}</span>
        <span style={{ width: 28, textAlign: "right" }}>{lines.length <= 40 ? "All" : cursor.line < 20 ? "Top" : "…"}</span>
      </div>
    </div>
  );
}

function MakeTokens({ code }) {
  const ls = code.split("\n"); const one = ls.length === 1;
  return ls.map((l, i) => {
    let el;
    if (/^\s*#/.test(l)) el = <span style={{ color: "#7FB56F", fontStyle: "italic" }}>{l}</span>;
    else if (/^[A-Za-z_]\w*\s*[:?]?=/.test(l)) { const [, k, rest] = l.match(/^([A-Za-z_]\w*)(.*)$/); el = <><span style={{ color: "#F2B84B" }}>{k}</span>{rest}</>; }
    else if (/^[^\t\s][^:]*:/.test(l)) { const [, t, rest] = l.match(/^([^:]*)(.*)$/); el = <><span style={{ color: "#6FB3F2", fontWeight: 700 }}>{t}</span><span style={{ color: "#B89CF2" }}>{rest}</span></>; }
    else if (l.startsWith("\t")) el = <span style={{ color: "#e6e6e6" }}>{l.replace(/\$\((\w+)\)/g, "$($1)")}</span>;
    else el = l;
    return <span key={i}>{el}{one ? "" : "\n"}</span>;
  });
}

function TitleBar({ path, onHelp, children }) {
  return (
    <div className="flex items-center gap-2 px-2" style={{ height: 24, background: "#e9e9e9", color: "#333", fontFamily: SANS, fontSize: 11, flexShrink: 0 }}>
      <span style={{ display: "inline-block", width: 13, height: 13, borderRadius: 3, background: "#2b8a3e", color: "#fff", fontSize: 9, lineHeight: "13px", textAlign: "center", fontWeight: 700 }}>C</span>
      <span style={{ color: "#555" }}>{path}</span>
      <span className="flex-1 flex items-center gap-1">{children}</span>
      <button className="cq-btn" onClick={onHelp} title="What is this window for?" aria-label="Explain this window"
        style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, width: 18, height: 18, borderRadius: 9, border: "1px solid #999", background: "#fff", color: "#333", cursor: "pointer", lineHeight: "16px", padding: 0 }}>?</button>
      <span style={{ color: "#777", letterSpacing: 3 }}>– ▢ ✕</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell pane
// ---------------------------------------------------------------------------
function ShellPane({ lines, onCommand, busy, highlight, onHelp, inputRef }) {
  const [cmd, setCmd] = useState("");
  const [hist, setHist] = useState([]);
  const [hi, setHi] = useState(-1);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [lines, busy]);
  const submit = () => {
    const c = cmd; setCmd(""); setHi(-1);
    if (c.trim()) setHist((h) => [...h, c]);
    onCommand(c);
  };
  const prompt = <><span style={{ color: "#7ddc7d" }}>{USER}</span> <span style={{ color: "#e3d26f" }}>{CWD}</span>{"\n"}<span style={{ color: "#7ddc7d" }}>$</span> </>;
  return (
    <div className="flex flex-col" style={{ flex: 1, minWidth: 0, minHeight: 0, border: `2px solid ${highlight ? C.gold : "#2a2a2a"}`, borderRadius: 6, overflow: "hidden", background: C.term, boxShadow: highlight ? `0 0 0 3px ${C.gold}33` : "none", transition: "border-color .2s" }}
      onClick={() => inputRef.current?.focus()}>
      <TitleBar path={CWD} onHelp={onHelp} />
      <div className="flex-1 overflow-y-auto" style={{ fontFamily: MONO, fontSize: 12.5, lineHeight: "18px", padding: "6px 10px", color: "#e6e6e6", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {lines.map((l, i) => <div key={i} style={{ color: l.color || "#e6e6e6" }}>{l.prompt ? <>{prompt}{l.text}</> : l.text}</div>)}
        {busy && <div style={{ color: "#9aa" }}>…</div>}
        {!busy && (
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            <span>{prompt}</span>
            <input ref={inputRef} value={cmd} onChange={(e) => setCmd(e.target.value)} aria-label="Shell command" autoCapitalize="off" autoCorrect="off" spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                else if (e.key === "ArrowUp") { e.preventDefault(); const n = hi < 0 ? hist.length - 1 : Math.max(0, hi - 1); if (hist[n] != null) { setHi(n); setCmd(hist[n]); } }
                else if (e.key === "ArrowDown") { e.preventDefault(); const n = hi + 1; if (n >= hist.length) { setHi(-1); setCmd(""); } else { setHi(n); setCmd(hist[n]); } }
                else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); onCommand("clear"); }
              }}
              style={{ fontFamily: MONO, fontSize: 12.5, flex: 1, minWidth: 120, background: "transparent", color: "#fff", border: "none", outline: "none", caretColor: "#fff", padding: 0 }} />
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The Workbench
// ---------------------------------------------------------------------------
export default function Workbench({ compile, onClose, onFinish, tourDone }) {
  const [fs, setFs] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(STORE) || "null"); if (s && s.fs) return s.fs; } catch { /* fresh */ }
    const t = Date.now() - 60000; return Object.fromEntries(SOURCE_FILES.map((f) => [f, { content: STARTER[f], mtime: t }]));
  });
  const [lines, setLines] = useState([{ text: `Welcome to the stage. Type help for the commands this shell knows.`, color: "#9aa" }]);
  const [busy, setBusy] = useState(false);
  const [rightTab, setRightTab] = useState("bagMain.cpp");
  const [help, setHelp] = useState(null);
  const [explain, setExplain] = useState(false);
  const [noteIdx, setNoteIdx] = useState(0);
  const walk = useMemo(() => resolveNotes(fs), [fs]);
  const note = explain ? walk[Math.min(noteIdx, walk.length - 1)] : null;
  const notedLines = useMemo(() => { const m = {}; walk.forEach((w) => { (m[w.file] ||= new Set()).add(w.line); }); return m; }, [walk]);
  const linkLines = useMemo(() => { const m = {}; (note?.links || []).forEach((l) => { (m[l.file] ||= new Set()).add(l.line); }); return m; }, [note]);
  const showNote = (i) => {
    const w = walk[i]; if (!w) return;
    setNoteIdx(i);
    if (w.file === "bagMain.cpp" || w.file === "Makefile") setRightTab(w.file);
    setMobilePane(w.file === "Makefile" ? "bagMain.cpp" : w.file);
  };
  const pickLine = (file, line) => { const i = walk.findIndex((w) => w.file === file && w.line === line); if (i >= 0) showNote(i); };
  const firstOfFile = (file) => walk.findIndex((w) => w.file === file);
  const [step, setStep] = useState(tourDone ? -1 : 0);
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 1100px)").matches);
  const [mobilePane, setMobilePane] = useState("bag.h");
  const inputRef = useRef(null);
  const editedRef = useRef(new Set());
  const touchedRef = useRef(false);
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => { const mq = window.matchMedia("(min-width: 1100px)"); const h = (e) => setWide(e.matches); mq.addEventListener("change", h); return () => mq.removeEventListener("change", h); }, []);
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify({ fs })); } catch { /* best effort */ } }, [fs]);

  const print = useCallback((text, color) => setLines((L) => [...L, ...String(text).split("\n").map((t) => ({ text: t, color }))]), []);

  const setFile = (name, content) => {
    editedRef.current.add(name);
    setFs((f) => ({ ...f, [name]: { content, mtime: Date.now() } }));
  };
  const reset = (which) => {
    const src = which === "blank" ? BLANK : STARTER;
    const t = Date.now();
    setFs(Object.fromEntries(SOURCE_FILES.map((f) => [f, { content: src[f], mtime: t }])));
    editedRef.current = new Set();
    print(`(${which === "blank" ? "blank" : "Dr. Wheat's"} files loaded; build products removed)`, "#9aa");
  };

  // ----- the shell -----
  async function runMake(args, fsNow) {
    const mk = fsNow["Makefile"];
    if (!mk) { print("make: *** No targets specified and no makefile found.  Stop.", C.coral); return fsNow; }
    let parsed;
    try { parsed = parseMakefile(mk.content); } catch (e) { print(e.message, C.coral); return fsNow; }
    const goal = args[0] || parsed.first;
    if (!goal) { print("make: *** No targets.  Stop.", C.coral); return fsNow; }
    let fs2 = { ...fsNow }, didWork = false, failed = false;
    const built = new Set();

    async function build(target, from) {
      if (failed) return false;
      const rule = parsed.rules[target];
      if (!rule) {
        if (fs2[target]) return false;
        print(`make: *** No rule to make target '${target}'${from ? `, needed by '${from}'` : ""}.  Stop.`, C.coral); failed = true; return false;
      }
      if (built.has(target)) return false;
      let depChanged = false;
      for (const d of rule.deps) { const r = await build(d, target); if (failed) return false; depChanged = depChanged || r; }
      const t = fs2[target];
      const stale = !t || depChanged || rule.deps.some((d) => fs2[d] && fs2[d].mtime > t.mtime);
      if (!stale && rule.cmds.length) return false;
      for (const c of rule.cmds) {
        print(c.text);
        didWork = true;
        const ok = await exec(c.text);
        if (!ok) { print(`make: *** [Makefile:${c.line}: ${target}] Error 1`, C.coral); failed = true; return false; }
      }
      built.add(target);
      return true;
    }

    async function exec(cmd) {
      const parts = cmd.split(/\s+/);
      if (parts[0] === "g++" || parts[0] === "gcc" || parts[0] === "clang++") {
        const srcs = parts.filter((p) => /\.(cpp|cc|cxx)$/.test(p));
        const objs = parts.filter((p) => /\.o$/.test(p));
        const oi = parts.indexOf("-o"); const out = oi > 0 ? parts[oi + 1] : null;
        if (parts.includes("-c")) {
          for (const s of srcs) {
            if (!fs2[s]) { print(`g++: error: ${s}: No such file or directory`, C.coral); return false; }
            const unit = expandUnit(fs2, s);
            if (unit.error) { print(unit.error, C.coral); return false; }
            // -c means compile only. Our service also links, so give it a main if the unit has none,
            // and the other units if it has one; then show only this file's diagnostics.
            let code = unit.code, map = unit.map;
            if (!/\bmain\s*\(/.test(code)) { code += "\nint main() { return 0; }\n"; }
            else for (const o of Object.keys(fs2).filter((f) => /\.cpp$/.test(f) && f !== s)) { const u = expandUnit(fs2, o); if (!u.error) { code += "\n" + u.code; map = [...map, ...u.map]; } }
            const r = await compile(code);
            if (r.netErr) { print(`g++: error: couldn't reach the compiler service (${r.netErr})`, C.coral); return false; }
            const diag = mapErrors(r.compileErr || "", map, s);
            if (r.compileErr && diag && /error/.test(diag)) { print(diag, C.coral); return false; }
            if (diag) print(diag, "#e3d26f"); // warnings only
            const oname = out || s.replace(/\.(cpp|cc|cxx)$/, ".o");
            fs2[oname] = { content: `(object code for ${s})`, mtime: Date.now(), obj: s, size: Math.round(unit.code.length * 1.7) };
          }
          return true;
        }
        // link
        const units = [];
        for (const o of objs) {
          if (!fs2[o]) { print(`g++: error: ${o}: No such file or directory`, C.coral); return false; }
          units.push(expandUnit(fs2, fs2[o].obj));
        }
        for (const s of srcs) { if (!fs2[s]) { print(`g++: error: ${s}: No such file or directory`, C.coral); return false; } units.push(expandUnit(fs2, s)); }
        if (!units.length) { print("g++: fatal error: no input files", C.coral); return false; }
        const bad = units.find((u) => u.error); if (bad) { print(bad.error, C.coral); return false; }
        const code = units.map((u) => u.code).join("\n"); const map = units.flatMap((u) => u.map);
        const r = await compile(code);
        if (r.netErr) { print(`g++: error: couldn't reach the compiler service (${r.netErr})`, C.coral); return false; }
        if (r.compileErr) { print(mapErrors(r.compileErr, map) || r.compileErr, C.coral); return false; }
        const exe = out || "a.out";
        fs2[exe] = { content: `(executable)`, mtime: Date.now(), exe: true, code, map, size: 70000 + Math.round(code.length * 8) };
        return true;
      }
      if (parts[0] === "rm") {
        const pats = parts.slice(1).filter((p) => !p.startsWith("-"));
        for (const p of pats) {
          const re = new RegExp("^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
          Object.keys(fs2).forEach((f) => { if (re.test(f) && !SOURCE_FILES.includes(f)) delete fs2[f]; });
        }
        return true;
      }
      if (parts[0] === "echo") { print(parts.slice(1).join(" ")); return true; }
      print(`make: ${parts[0]}: command not found`, C.coral); return false;
    }

    await build(goal);
    if (!failed && !didWork) print(parsed.rules[goal]?.cmds.length ? `make: '${goal}' is up to date.` : `make: Nothing to be done for '${goal}'.`);
    return fs2;
  }

  async function runProgram(name, fsNow) {
    const f = fsNow[name];
    if (!f) { print(`bash: ./${name}: No such file or directory`, C.coral); return; }
    if (!f.exe) { print(`bash: ./${name}: Permission denied`, C.coral); return; }
    const r = await compile(f.code, "");
    if (r.netErr) { print(`couldn't reach the compiler service (${r.netErr})`, C.coral); return; }
    if (r.compileErr) { print(mapErrors(r.compileErr, f.map), C.coral); return; }
    if (r.stdout) print(r.stdout.replace(/\n$/, ""));
    if (r.stderr) print(r.stderr.replace(/\n$/, ""), "#e3d26f");
    if (r.exit) print(`(exit code ${r.exit})`, "#9aa");
  }

  async function onCommand(raw) {
    const cmd = raw.trim();
    setLines((L) => [...L, { text: raw, prompt: true }]);
    if (!cmd) return;
    const [name, ...args] = cmd.split(/\s+/);
    setBusy(true);
    let fs2 = fs;
    try {
      switch (name) {
        case "help":
          print(["Commands this stage shell knows:", "  make [target]   follow the Makefile (make clean, make bag …)", "  ./bag           run the program you built", "  ls [-l|-lthr]   list files   ·   cat FILE   ·   touch FILE   ·   rm FILE", "  g++ …           same as a Makefile command line", "  clear · pwd · help", "The editors save as you type; make sees the saved files."].join("\n"), "#9aa"); break;
        case "clear": setLines([]); break;
        case "pwd": print("/home/you/csc255sp26/stage"); break;
        case "ls": {
          const long = args.some((a) => a.startsWith("-") && a.includes("l"));
          const byTime = args.some((a) => a.startsWith("-") && a.includes("t"));
          const rev = args.some((a) => a.startsWith("-") && a.includes("r"));
          let names = Object.keys(fs2).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
          if (byTime) names.sort((a, b) => fs2[b].mtime - fs2[a].mtime);
          if (rev) names.reverse();
          if (!long) print(names.join("  "));
          else {
            const size = (f) => fs2[f].size ?? fs2[f].content.length;
            print(`total ${Math.ceil(names.reduce((a, f) => a + size(f), 0) / 1024)}K`);
            names.forEach((f) => { const e = fs2[f]; const mode = e.exe ? "-rwx--x--x+" : e.obj ? "-rw-r--r--+" : "-rwx------+"; print(`${mode} 1 you None ${pad(size(f) >= 1024 ? (size(f) / 1024).toFixed(1) + "K" : size(f), 5)} ${fmtTime(e.mtime)} ${f}`, e.exe ? "#7ddc7d" : undefined); });
          }
          break;
        }
        case "cat": { for (const a of args) { if (fs2[a]) print(fs2[a].obj || fs2[a].exe ? `(binary file ${a})` : fs2[a].content.replace(/\n$/, "")); else print(`cat: ${a}: No such file or directory`, C.coral); } break; }
        case "touch": {
          if (!args.length) { print("touch: missing file operand", C.coral); break; }
          fs2 = { ...fs2 }; const t = Date.now();
          args.forEach((a) => { fs2[a] = fs2[a] ? { ...fs2[a], mtime: t } : { content: "", mtime: t }; });
          if (args.includes("bag.h")) touchedRef.current = true;
          break;
        }
        case "rm": {
          fs2 = { ...fs2 };
          args.filter((a) => !a.startsWith("-")).forEach((a) => { if (SOURCE_FILES.includes(a)) print(`rm: ${a} is open in an editor here; use the Reset menu instead`, C.coral); else if (fs2[a]) delete fs2[a]; else print(`rm: cannot remove '${a}': No such file or directory`, C.coral); });
          break;
        }
        case "make": fs2 = await runMake(args, fs2); break;
        case "g++": case "gcc": case "clang++": {
          // run a loose command line through the same machinery as a one-rule makefile
          const fake = { ...fs2, Makefile: { content: `x:\n\t${cmd}\n`, mtime: 0 } };
          const out = await runMake(["x"], fake); delete out.Makefile; fs2 = { ...out, Makefile: fs2.Makefile };
          break;
        }
        case "vim": case "vi": case "nano": case "code": print(`${name}: the editors are already open in the other windows`, "#9aa"); break;
        default:
          if (name.startsWith("./")) await runProgram(name.slice(2), fs2);
          else print(`bash: ${name}: command not found`, C.coral);
      }
    } catch (e) { print(`error: ${e.message}`, C.coral); }
    if (fs2 !== fs) setFs(fs2);
    setBusy(false);
    setTimeout(() => inputRef.current?.focus(), 0);

    // tour progress
    const st = stepRef.current;
    if (st >= 0 && st < TOUR.length) {
      const s = TOUR[st];
      const matches = (want) => want === "./bag" ? name.startsWith("./") : name === want;
      if (s.wait) {
        if (s.then) { if (matches(s.then) && touchedRef.current) advance(); }
        else if (s.needsEdit) { if (matches(s.wait) && editedRef.current.has(s.needsEdit)) advance(); }
        else if (matches(s.wait)) advance();
      }
    }
  }

  function advance() {
    const n = Math.min(TOUR.length - 1, stepRef.current + 1);
    if (TOUR[n].done && !tourDone) onFinish?.({ xp: 40 });
    stepRef.current = n;
    setStep(n);
  }

  const cur = step >= 0 ? TOUR[step] : null;
  const hiPane = cur?.pane;
  const ex = (file) => ({ explain, focusLine: note?.file === file ? note.line : null, linkLines: linkLines[file], notedLines: notedLines[file], onPickLine: pickLine });
  const panes = {
    "bag.h": <VimPane name="bag.h" value={fs["bag.h"]?.content ?? ""} onChange={(v) => setFile("bag.h", v)} highlight={hiPane === "bag.h" || (explain && note?.file === "bag.h")} onHelp={() => setHelp("bag.h")} {...ex("bag.h")} />,
    "bag.cpp": <VimPane name="bag.cpp" value={fs["bag.cpp"]?.content ?? ""} onChange={(v) => setFile("bag.cpp", v)} highlight={hiPane === "bag.cpp" || (explain && note?.file === "bag.cpp")} onHelp={() => setHelp("bag.cpp")} {...ex("bag.cpp")} />,
    "bagMain.cpp": <VimPane name={rightTab} value={fs[rightTab]?.content ?? ""} onChange={(v) => setFile(rightTab, v)} highlight={hiPane === "bagMain.cpp" || (explain && note?.file === rightTab)} onHelp={() => setHelp("bagMain.cpp")} tabs={["bagMain.cpp", "Makefile"]} tab={rightTab} onTab={setRightTab} {...ex(rightTab)} />,
    shell: <ShellPane lines={lines} onCommand={onCommand} busy={busy} highlight={hiPane === "shell"} onHelp={() => setHelp("shell")} inputRef={inputRef} />,
  };
  const btn = (extra = {}) => ({ fontFamily: MONO, fontSize: 12, padding: "5px 11px", borderRadius: 7, border: `1px solid ${C.line}`, color: C.muted, background: "transparent", cursor: "pointer", ...extra });

  return (
    <div className="flex flex-col" style={{ flex: 1, minHeight: 0, background: "#3b4b63", backgroundImage: "linear-gradient(135deg,#2b3a52 0%,#4a6a8a 60%,#8ab0c8 100%)" }}>
      {/* toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 flex-wrap" style={{ background: C.panel, borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15 }}>🖥 Workbench</span>
        <span style={{ fontFamily: SANS, fontSize: 12, color: C.muted }} className="hidden md:inline">Dr. Wheat's four windows: header, implementation, driver + Makefile, shell</span>
        <span className="flex-1" />
        <button className="cq-btn" onClick={() => { setExplain((e) => !e); if (!explain) { setStep(-1); setNoteIdx((i) => walk[i] ? i : 0); } }} style={btn({ color: explain ? C.ink : C.teal, background: explain ? C.teal : "transparent", border: `1px solid ${C.teal}`, fontWeight: 700 })} title="Line-by-line notes on every file">{explain ? "📖 Explaining" : "📖 Explain"}</button>
        <button className="cq-btn" onClick={() => { setExplain(false); setStep(0); }} style={btn({ color: C.gold, border: `1px solid ${C.gold}` })}>{step < 0 ? "▶ Start the tour" : "↺ Restart tour"}</button>
        <button className="cq-btn" onClick={() => reset("his")} style={btn()} title="Reload Dr. Wheat's Bag files">His files</button>
        <button className="cq-btn" onClick={() => reset("blank")} style={btn({ color: C.teal, border: `1px solid ${C.teal}` })} title="Empty files with just the header comments: write the Bag from memory">Blank files</button>
        <button className="cq-btn" onClick={onClose} style={btn()} aria-label="Close workbench">✕ Close</button>
      </div>

      {/* explain strip */}
      {explain && (
        <div className="px-4 py-2.5" style={{ background: C.panel2, borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
          {walk.length === 0 ? (
            <Rich text="These notes are written for Dr. Wheat's files, and the files here have changed too much to match. Press **His files** to restore them." />
          ) : (
            <div className="flex items-start gap-3" style={{ flexDirection: wide ? "row" : "column" }}>
              <div className="flex-1" style={{ minWidth: 0, width: wide ? undefined : "100%" }}>
                {noteIdx === firstOfFile(note.file) && <div className="mb-2"><Rich text={FILE_INTRO[note.file]} size={13} color={C.muted} /></div>}
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.gold }}>{note.file}:{note.line}</span>
                  <code style={{ fontFamily: MONO, fontSize: 12.5, background: C.ink, color: C.text, padding: "2px 8px", borderRadius: 4, whiteSpace: "pre", overflowX: "auto", maxWidth: "100%" }}>{note.code.trim()}</code>
                </div>
                <Rich text={note.text} />
                {note.links.length > 0 && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span style={{ fontFamily: MONO, fontSize: 11, color: C.teal }}>connects to</span>
                    {note.links.map((l, i) => (
                      <button key={i} className="cq-btn" onClick={() => showNote(walk.indexOf(l))} style={btn({ color: C.teal, border: `1px solid ${C.teal}44`, padding: "2px 8px", fontSize: 11.5 })}>{l.file}:{l.line} <span style={{ color: C.muted }}>{l.code.trim().slice(0, 34)}{l.code.trim().length > 34 ? "…" : ""}</span></button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2" style={{ flexShrink: 0, flexDirection: wide ? "column" : "row", alignItems: wide ? "flex-end" : "center", flexWrap: "wrap", width: wide ? undefined : "100%" }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{noteIdx + 1} / {walk.length}</span>
                <div className="flex gap-2">
                  <button className="cq-btn" onClick={() => showNote(noteIdx - 1)} disabled={noteIdx === 0} style={btn({ opacity: noteIdx === 0 ? 0.4 : 1 })}>‹ Prev</button>
                  <button className="cq-btn" onClick={() => showNote(noteIdx + 1)} disabled={noteIdx >= walk.length - 1} style={btn({ background: C.gold, color: C.ink, border: "none", fontWeight: 700, opacity: noteIdx >= walk.length - 1 ? 0.4 : 1 })}>Next ›</button>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  {WALK_ORDER.map((f) => <button key={f} className="cq-btn" onClick={() => showNote(firstOfFile(f))} style={btn({ padding: "1px 7px", fontSize: 10.5, color: note.file === f ? C.gold : C.muted, border: `1px solid ${note.file === f ? C.gold : C.line}` })}>{f}</button>)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* tour strip */}
      {cur && !explain && (
        <div className="flex items-start gap-3 px-4 py-2.5" style={{ background: C.panel2, borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.gold, paddingTop: 3, whiteSpace: "nowrap" }}>Step {step + 1}/{TOUR.length}</span>
          <div className="flex-1" style={{ minWidth: 0 }}><Rich text={cur.text} /></div>
          <div className="flex gap-2" style={{ flexShrink: 0 }}>
            <button className="cq-btn" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} style={btn({ opacity: step === 0 ? 0.4 : 1 })}>‹ Back</button>
            {cur.done ? <button className="cq-btn" onClick={() => setStep(-1)} style={btn({ background: C.gold, color: C.ink, border: "none", fontWeight: 700 })}>Done ✓</button>
              : <button className="cq-btn" onClick={advance} style={btn({ background: cur.wait ? "transparent" : C.gold, color: cur.wait ? C.muted : C.ink, border: cur.wait ? `1px solid ${C.line}` : "none", fontWeight: 700 })}>{cur.wait ? "Skip ›" : "Next ›"}</button>}
          </div>
        </div>
      )}

      {/* the four windows */}
      {wide ? (
        <div className="flex-1 p-3" style={{ minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.15fr) minmax(0,1fr)", gridTemplateRows: "1fr 1fr", gap: 10 }}>
          <div style={{ gridRow: "1 / 3", minHeight: 0, minWidth: 0, display: "flex" }}>{panes["bag.h"]}</div>
          <div style={{ gridRow: "1 / 3", minHeight: 0, minWidth: 0, display: "flex" }}>{panes["bag.cpp"]}</div>
          <div style={{ minHeight: 0, minWidth: 0, display: "flex" }}>{panes["bagMain.cpp"]}</div>
          <div style={{ minHeight: 0, minWidth: 0, display: "flex" }}>{panes.shell}</div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-2" style={{ minHeight: 0 }}>
          <div className="flex gap-1 mb-2 flex-wrap">
            {["bag.h", "bag.cpp", "bagMain.cpp", "shell"].map((p) => (
              <button key={p} className="cq-btn" onClick={() => setMobilePane(p)} style={btn({ color: mobilePane === p ? C.ink : C.text, background: mobilePane === p ? C.gold : C.panel, border: `1px solid ${hiPane === p ? C.gold : C.line}` })}>{p === "shell" ? "$ shell" : p}</button>
            ))}
          </div>
          <div className="flex-1" style={{ minHeight: 0, display: "flex" }}>{panes[mobilePane]}</div>
        </div>
      )}

      {/* window help */}
      {help && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-label={PANE_HELP[help].title}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.55)" }} onClick={() => setHelp(null)} />
          <div className="relative p-5" style={{ maxWidth: 560, width: "100%", background: C.panel, border: `1px solid ${C.gold}`, borderRadius: 14 }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 16, color: C.gold }}>{PANE_HELP[help].title}</span>
              <button className="cq-btn" onClick={() => setHelp(null)} style={btn({ padding: "3px 9px" })} aria-label="Close">✕</button>
            </div>
            {PANE_HELP[help].body.map((t, i) => <div key={i} className="mb-3"><Rich text={t} /></div>)}
          </div>
        </div>
      )}
    </div>
  );
}
