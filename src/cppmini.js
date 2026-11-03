// A very small C++ interpreter: just enough of the language to write heap
// functions (loops, ifs, index math, swap, recursion) and watch them run.
// It is deliberately not a real compiler; it exists so the Arena can show
// the tree moving one statement at a time.

// --- tokenizer ----------------------------------------------------------
const PUNCT = ["<<", ">>", "==", "!=", "<=", ">=", "&&", "||", "++", "--", "+=", "-=", "::",
  "{", "}", "(", ")", "[", "]", ";", ",", ":", "=", "<", ">", "+", "-", "*", "/", "%", "!", "&", "."];

export function tokenize(src) {
  const t = []; let i = 0, line = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line++; i++; } i += 2; continue; }
    if (/[0-9]/.test(c)) { let s = i; while (i < src.length && /[0-9]/.test(src[i])) i++; t.push({ k: "num", v: +src.slice(s, i), line }); continue; }
    if (/[A-Za-z_]/.test(c)) { let s = i; while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i++; t.push({ k: "id", v: src.slice(s, i), line }); continue; }
    const p = PUNCT.find((q) => src.startsWith(q, i));
    if (!p) throw { line, msg: `I don't understand the character "${c}"` };
    i += p.length; t.push({ k: "op", v: p, line });
  }
  t.push({ k: "eof", v: "", line });
  return t;
}

// --- parser -------------------------------------------------------------
const TYPES = new Set(["int", "bool", "void", "auto", "unsigned", "size_t", "long"]);

export function parse(src) {
  const ts = tokenize(src); let p = 0;
  const peek = (o = 0) => ts[p + o];
  const at = (v) => peek().v === v;
  const eat = (v) => { if (!at(v)) throw { line: peek().line, msg: `expected "${v}" but found "${peek().v || "end of file"}"` }; return ts[p++]; };
  const tryEat = (v) => (at(v) ? (p++, true) : false);

  function primary() {
    const tk = peek();
    if (tk.k === "num") { p++; return { t: "num", v: tk.v, line: tk.line }; }
    if (tk.k === "id") {
      p++;
      let name = tk.v;
      while (at("::")) { p++; name = ts[p++].v; }          // std::swap -> swap
      if (at("(")) {
        p++; const args = [];
        if (!at(")")) do { args.push(expr()); } while (tryEat(","));
        eat(")");
        return { t: "call", name, args, line: tk.line };
      }
      let node = { t: "var", name, line: tk.line };
      while (at("[")) { p++; const idx = expr(); eat("]"); node = { t: "index", arr: node, idx, line: tk.line }; }
      while (at(".")) {                                     // q.push(x), q.front(), adj[u].size()
        p++; const m = ts[p++]; eat("(");
        const margs = [];
        if (!at(")")) do { margs.push(expr()); } while (tryEat(","));
        eat(")");
        node = { t: "method", obj: node, name: m.v, args: margs, line: m.line };
      }
      if (at("++") || at("--")) { const op = ts[p++].v[0]; return { t: "post", target: node, value: { t: "bin", op, l: node, r: { t: "num", v: 1 }, line: tk.line }, line: tk.line }; }
      return node;
    }
    if (tryEat("(")) { const e = expr(); eat(")"); return e; }
    if (at("++") || at("--")) {                             // prefix: --indegree[w] changes it, then gives the new value
      const op = ts[p++].v[0]; const target = primary();
      if (target.t !== "var" && target.t !== "index") throw { line: tk.line, msg: `"${op}${op}" needs a variable or an array slot after it` };
      return { t: "assign", target, value: { t: "bin", op, l: target, r: { t: "num", v: 1 }, line: tk.line }, line: tk.line };
    }
    if (at("!") || at("-")) { const op = ts[p++].v; return { t: "unary", op, e: primary(), line: tk.line }; }
    throw { line: tk.line, msg: `unexpected "${tk.v || "end of file"}"` };
  }
  const LEVELS = [["||"], ["&&"], ["==", "!="], ["<", ">", "<=", ">="], ["+", "-"], ["*", "/", "%"]];
  function binary(lv) {
    if (lv >= LEVELS.length) return primary();
    let left = binary(lv + 1);
    while (peek().k === "op" && LEVELS[lv].includes(peek().v)) {
      const op = ts[p++].v; const right = binary(lv + 1);
      left = { t: "bin", op, l: left, r: right, line: left.line };
    }
    return left;
  }
  function expr() {
    const left = binary(0);
    if (at("=") ) { p++; const right = expr(); return { t: "assign", target: left, value: right, line: left.line }; }
    if (at("+=") || at("-=")) { const op = ts[p++].v[0]; const right = expr(); return { t: "assign", target: left, value: { t: "bin", op, l: left, r: right, line: left.line }, line: left.line }; }
    return left;
  }

  function block() { eat("{"); const body = []; while (!at("}")) body.push(statement()); eat("}"); return { t: "block", body }; }

  function statement() {
    const tk = peek();
    if (at("{")) return block();
    if (at("if")) {
      p++; eat("("); const cond = expr(); eat(")");
      const then = statement();
      let other = null; if (at("else")) { p++; other = statement(); }
      return { t: "if", cond, then, other, line: tk.line };
    }
    if (at("while")) { p++; eat("("); const cond = expr(); eat(")"); return { t: "while", cond, body: statement(), line: tk.line }; }
    if (at("for")) {
      p++; eat("(");
      {                                                   // for (int v : adj[u])
        let o = 0;
        if (peek(o).v === "const") o++;
        if (peek(o).k === "id" && TYPES.has(peek(o).v)) o++;
        if (peek(o).v === "&") o++;
        if (o > 0 && peek(o).k === "id" && peek(o + 1).v === ":") {
          const name = peek(o).v; p += o + 2;
          const list = expr(); eat(")");
          return { t: "foreach", name, list, body: statement(), line: tk.line };
        }
      }
      const init = at(";") ? null : statement();          // statement() eats the ;
      if (!init) eat(";");
      const cond = at(";") ? { t: "num", v: 1 } : expr(); eat(";");
      const post = at(")") ? null : expr(); eat(")");
      return { t: "for", init, cond, post, body: statement(), line: tk.line };
    }
    if (at("return")) { p++; const v = at(";") ? null : expr(); eat(";"); return { t: "return", v, line: tk.line }; }
    if (at("break")) { p++; eat(";"); return { t: "break", line: tk.line }; }
    if (at("continue")) { p++; eat(";"); return { t: "continue", line: tk.line }; }
    // queue<int> q;   (std::queue<int> q; works too)
    {
      const o = tk.v === "std" && peek(1).v === "::" ? 2 : 0;
      if (peek(o).k === "id" && peek(o).v === "queue" && peek(o + 1).v === "<") {
        p += o + 2;
        while (!at(">") && peek().k !== "eof") p++;
        eat(">");
        const name = ts[p++].v; eat(";");
        return { t: "decl", name, queue: true, size: null, init: null, line: tk.line };
      }
    }
    // declaration: type name [= expr] ;   (also "int a[]" style is rejected politely)
    if (tk.k === "id" && TYPES.has(tk.v) && peek(1).k === "id") {
      p++; const name = ts[p++].v;
      let size = null; if (tryEat("[")) { size = expr(); eat("]"); }
      let init = null; if (tryEat("=")) init = expr();
      eat(";");
      return { t: "decl", name, size, init, line: tk.line };
    }
    const e = expr(); eat(";"); return { t: "expr", e, line: tk.line };
  }

  // top level: function definitions and loose statements
  const funcs = {}; const main = [];
  while (peek().k !== "eof") {
    const tk = peek();
    if (tk.k === "id" && TYPES.has(tk.v) && peek(1).k === "id" && peek(2).v === "(") {
      p++; const name = ts[p++].v; eat("(");
      const params = [];
      if (!at(")")) do { if (peek().k === "id" && TYPES.has(peek().v)) p++; while (at("&") || at("*")) p++; params.push(ts[p++].v); if (at("[")) { p++; eat("]"); } } while (tryEat(","));
      eat(")");
      funcs[name] = { name, params, body: block(), line: tk.line };
    } else main.push(statement());
  }
  return { funcs, main };
}

// --- interpreter --------------------------------------------------------
// host: { a, count, onStep(line, scope), maxSteps }
export function run(src, host) {
  const { funcs, main } = parse(src);
  const a = host.a;
  const W = host.what || "the heap";
  let count = host.count;
  const trace = [];
  let steps = 0, depth = 0;
  const BREAK = {}, CONT = {};

  const record = (line, note) => {
    steps++;
    if (steps > (host.maxSteps || 4000)) throw { line, msg: "this ran for too long \u2014 is the loop missing a way to stop?" };
    trace.push({ line, arr: [...a].slice(0, count), count, note: note || null });
  };

  const globals = { count, n: count, heapSize: count, heap_size: count, size: count };
  if (host.temp) globals.temp = host.temp;
  if (host.globals) Object.assign(globals, host.globals);   // extra named arrays (adj, dist, visited, ...)
  const arrName = (node) => (node.t === "var" ? (["a", "A", "arr"].includes(node.name) ? "a" : node.name) : "?");
  const limit = (arr) => (arr === a ? count : arr.length);
  const builtin = {
    leftChild: (i) => 2 * i + 1, rightChild: (i) => 2 * i + 2, parent: (i) => Math.floor((i - 1) / 2),
    left: (i) => 2 * i + 1, right: (i) => 2 * i + 2, LEFT: (i) => 2 * i + 1, RIGHT: (i) => 2 * i + 2, PARENT: (i) => Math.floor((i - 1) / 2),
  };

  function lookupScope(scopes, name) { for (let k = scopes.length - 1; k >= 0; k--) if (name in scopes[k]) return scopes[k]; return null; }

  function evalNode(node, scopes) {
    switch (node.t) {
      case "num": return node.v;
      case "var": {
        if (node.name === "true") return 1;
        if (node.name === "false") return 0;
        if (node.name === "a" || node.name === "A" || node.name === "arr") return a;
        const s = lookupScope(scopes, node.name);
        if (s) return s[node.name];
        if (node.name in globals) return globals[node.name];
        throw { line: node.line, msg: `"${node.name}" hasn't been declared yet` };
      }
      case "index": {
        const arr = evalNode(node.arr, scopes); const i = evalNode(node.idx, scopes);
        if (!Array.isArray(arr)) throw { line: node.line, msg: "only the array can be indexed" };
        if (arr !== a && (i < 0 || i >= arr.length)) throw { line: node.line, msg: `index ${i} is outside ${arrName(node.arr)} (it has ${arr.length} slots)` };
        if (i < 0 || i >= count) throw { line: node.line, msg: `index ${i} is outside ${W} (count is ${count}) \u2014 check the bounds test before this comparison` };
        return arr[i];
      }
      case "unary": { const v = evalNode(node.e, scopes); return node.op === "!" ? (v ? 0 : 1) : -v; }
      case "bin": {
        if (node.op === "&&") return evalNode(node.l, scopes) ? (evalNode(node.r, scopes) ? 1 : 0) : 0;   // short-circuits, like C++
        if (node.op === "||") return evalNode(node.l, scopes) ? 1 : (evalNode(node.r, scopes) ? 1 : 0);
        const x = evalNode(node.l, scopes), y = evalNode(node.r, scopes);
        switch (node.op) {
          case "+": return x + y; case "-": return x - y; case "*": return x * y;
          case "/": return Math.trunc(x / y); case "%": return x % y;
          case "<": return x < y ? 1 : 0; case ">": return x > y ? 1 : 0;
          case "<=": return x <= y ? 1 : 0; case ">=": return x >= y ? 1 : 0;
          case "==": return x === y ? 1 : 0; case "!=": return x !== y ? 1 : 0;
        }
        throw { line: node.line, msg: `unknown operator ${node.op}` };
      }
      case "assign": {
        const v = evalNode(node.value, scopes);
        if (node.target.t === "index") {
          const arr = evalNode(node.target.arr, scopes);
          if (!Array.isArray(arr)) throw { line: node.line, msg: "only an array can be indexed" };
          const i = evalNode(node.target.idx, scopes);
          if (i < 0 || i >= limit(arr)) throw { line: node.line, msg: arr === a ? `index ${i} is outside ${W} (count is ${count})` : `index ${i} is outside ${arrName(node.target.arr)} (it has ${arr.length} slots)` };
          arr[i] = v;
          if (host.trackWrites) record(node.line, { kind: "set", arr: arrName(node.target.arr), i, v });
        } else if (node.target.t === "var") {
          const s = lookupScope(scopes, node.target.name);
          if (s) s[node.target.name] = v;
          else if (node.target.name in globals) globals[node.target.name] = v;
          else throw { line: node.line, msg: `"${node.target.name}" hasn't been declared yet` };
        } else throw { line: node.line, msg: "that isn't something you can assign to" };
        return v;
      }
      case "post": { const old = evalNode(node.target, scopes); evalNode({ t: "assign", target: node.target, value: node.value, line: node.line }, scopes); return old; }
      case "method": {
        const obj = evalNode(node.obj, scopes);
        const args = node.args.map((x) => evalNode(x, scopes));
        if (obj && obj.__queue) {
          const q = obj.items;
          switch (node.name) {
            case "push": case "emplace": q.push(args[0]); record(node.line, { kind: "qpush", v: args[0] }); return 0;
            case "pop": if (!q.length) throw { line: node.line, msg: "pop() on an empty queue — check !q.empty() first" };
              { const v = q.shift(); record(node.line, { kind: "qpop", v }); return 0; }
            case "front": if (!q.length) throw { line: node.line, msg: "front() on an empty queue — check !q.empty() first" }; return q[0];
            case "back": if (!q.length) throw { line: node.line, msg: "back() on an empty queue" }; return q[q.length - 1];
            case "empty": return q.length ? 0 : 1;
            case "size": return q.length;
          }
          throw { line: node.line, msg: `a queue has push, pop, front, empty and size — not "${node.name}"` };
        }
        if (Array.isArray(obj)) {
          if (node.name === "size") return obj === a ? count : obj.length;
          if (node.name === "empty") return (obj === a ? count : obj.length) ? 0 : 1;
          throw { line: node.line, msg: `I only know .size() on an array, not "${node.name}"` };
        }
        throw { line: node.line, msg: `"${node.name}" needs a queue or an array in front of the dot` };
      }
      case "call": {
        if (node.name === "swap") {
          if (node.args.length !== 2) throw { line: node.line, msg: "swap takes two things" };
          const [x, y] = node.args;
          if (x.t !== "index" || y.t !== "index") throw { line: node.line, msg: "swap two array slots, like swap(a[i], a[big])" };
          const i = evalNode(x.idx, scopes), j = evalNode(y.idx, scopes);
          if (i < 0 || i >= count || j < 0 || j >= count) throw { line: node.line, msg: `swap index outside ${W} (count is ${count})` };
          const t = a[i]; a[i] = a[j]; a[j] = t;
          record(node.line, { kind: "swap", i, j });
          return 0;
        }
        if (funcs[node.name]) {
          const f = funcs[node.name];
          const args = node.args.map((x) => evalNode(x, scopes));
          if (depth >= (host.maxDepth || 40)) throw { line: node.line, msg: "too many nested calls \u2014 is the recursion missing a stopping point?" };
          const frame = {};
          f.params.forEach((pn, k) => { frame[pn] = args[k]; });
          // A called function sees the globals and its own parameters, not the caller's locals.
          depth++;
          try { exec(f.body, [scopes[0], frame]); } catch (e) { if (e && e.__ret) return e.value; throw e; } finally { depth--; }
          return 0;
        }
        if (builtin[node.name]) return builtin[node.name](...node.args.map((x) => evalNode(x, scopes)));
        throw { line: node.line, msg: `there's no function called "${node.name}"` };
      }
    }
    throw { line: node.line, msg: "I can't evaluate that" };
  }

  function exec(node, scopes) {
    switch (node.t) {
      case "block": { const inner = [...scopes, {}]; for (const s of node.body) exec(s, inner); return; }
      case "decl": {
        record(node.line);
        if (node.queue) { scopes[scopes.length - 1][node.name] = { __queue: true, items: [] }; return; }
        if (node.size) {
          const n = evalNode(node.size, scopes);
          if (!(n > 0 && n <= 1000)) throw { line: node.line, msg: `an array needs a size between 1 and 1000 (got ${n})` };
          scopes[scopes.length - 1][node.name] = new Array(n).fill(0); return;
        }
        scopes[scopes.length - 1][node.name] = node.init ? evalNode(node.init, scopes) : 0; return;
      }
      case "expr": { record(node.line); evalNode(node.e, scopes); return; }
      case "if": { record(node.line); if (evalNode(node.cond, scopes)) exec(node.then, scopes); else if (node.other) exec(node.other, scopes); return; }
      case "while": { while (true) { record(node.line); if (!evalNode(node.cond, scopes)) return; try { exec(node.body, scopes); } catch (e) { if (e === BREAK) return; if (e !== CONT) throw e; } } }
      case "for": {
        const inner = [...scopes, {}];
        if (node.init) exec(node.init, inner);
        while (true) { record(node.line); if (!evalNode(node.cond, inner)) return;
          try { exec(node.body, inner); } catch (e) { if (e === BREAK) return; if (e !== CONT) throw e; }
          if (node.post) evalNode(node.post, inner); }
      }
      case "foreach": {
        const list = evalNode(node.list, scopes);
        if (!Array.isArray(list)) throw { line: node.line, msg: "a range-for needs an array after the colon, like adj[u]" };
        for (const item of [...list]) {
          record(node.line);
          try { exec(node.body, [...scopes, { [node.name]: item }]); } catch (e) { if (e === BREAK) return; if (e !== CONT) throw e; }
        }
        return;
      }
      case "return": { record(node.line); throw { __ret: true, value: node.v ? evalNode(node.v, scopes) : 0 }; }
      case "break": throw BREAK;
      case "continue": throw CONT;
    }
    throw { line: node.line, msg: "I can't run that statement" };
  }

  record(0);   // starting snapshot
  try {
    if (host.call) {
      const f = funcs[host.call.name];
      if (!f) throw { line: 1, msg: `I couldn't find a function called "${host.call.name}" \u2014 check the name and the spelling` };
      const frame = {}; f.params.forEach((pn, k) => { frame[pn] = host.call.args[k]; });
      try { exec(f.body, [globals, frame]); } catch (e) { if (!(e && e.__ret)) throw e; }
    }
    for (const s of main) exec(s, [globals, {}]);
  } catch (e) {
    if (e && e.__ret) return { trace, arr: a.slice(0, count), ok: true };
    return { trace, arr: a.slice(0, count), ok: false, error: e && e.msg ? e : { line: 0, msg: String(e && e.message ? e.message : e) } };
  }
  return { trace, arr: a.slice(0, count), ok: true };
}

export const funcNames = (src) => { try { return Object.keys(parse(src).funcs); } catch { return []; } };
