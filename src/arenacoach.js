// Arena coach: plain-language explanations for every move, right or wrong.
// Pure module (no React). Height convention is the course's: empty = 0, a leaf = 1.
import { pathTo } from "./arenasim.js";

const hgt = (t, id) => (id ? 1 + Math.max(hgt(t, t.nodes[id].left), hgt(t, t.nodes[id].right)) : 0);
const node = (t, v) => t.nodes["v" + v];
const cmp = (v, p) => (v < p ? "smaller" : "bigger");
const dir = (v, p) => (v < p ? "left" : "right");
const other = (d) => (d === "left" ? "right" : "left");

// Plain BST insert with NO balancing: the tree the moment the node hooks on, before bal() runs.
export function plainInsert(tree, v) {
  const nodes = {}; for (const id in tree.nodes) nodes[id] = { ...tree.nodes[id] };
  const t = { nodes, root: tree.root };
  const nid = "v" + v; t.nodes[nid] = { id: nid, val: v, left: null, right: null };
  if (!t.root) { t.root = nid; return t; }
  let cur = t.root;
  for (;;) { const n = t.nodes[cur]; const s = dir(v, n.val); if (!n[s]) { n[s] = nid; break; } cur = n[s]; }
  return t;
}

// Walk back UP from v's parent to the root, reporting each node's two heights.
// Stops at the first node that is off by 2 (that's the one that rotates).
export function balanceWalk(tree, v) {
  const path = pathTo(tree, v).slice().reverse();     // parent first, root last
  const out = [];
  for (const a of path) {
    const n = node(tree, a); const hl = hgt(tree, n.left), hr = hgt(tree, n.right); const diff = hl - hr;
    const entry = { val: a, hl, hr, diff, broken: Math.abs(diff) > 1 };
    if (entry.broken) {
      const heavyId = diff > 0 ? n.left : n.right; const c = tree.nodes[heavyId];
      const childLean = hgt(tree, c.left) - hgt(tree, c.right);
      entry.heavy = c.val; entry.lean = diff > 0 ? "left" : "right";
      entry.kink = (diff > 0 && childLean < 0) || (diff < 0 && childLean > 0);
      entry.childLean = childLean > 0 ? "left" : childLean < 0 ? "right" : "even";
    }
    out.push(entry); if (entry.broken) break;
  }
  return out;
}

function walkWords(tree, v) {
  const path = pathTo(tree, v);
  const lines = path.map((p) => `At ${p}: ${v} is ${cmp(v, p)} than ${p}, so go ${dir(v, p)}.`);
  lines.push(path.length ? `There's nothing ${dir(v, path[path.length - 1])} of ${path[path.length - 1]}. Stop. That empty spot is where ${v} lives.` : `The tree was empty, so ${v} is the root.`);
  return lines;
}

// Why the chosen empty slot was wrong for value v. slotId = "<parent>-<side>".
export function explainWrongSlot(tree, v, slotId) {
  const [pStr, side] = slotId.split("-"); const P = Number(pStr);
  const toP = pathTo(tree, P);                          // ancestors of P
  for (const m of toP) {
    const dv = dir(v, m), dp = dir(P, m);
    if (dv !== dp) return [`You picked the spot under ${P}. To get there, ${v} would have to pass through ${m} on the ${dp} side. But at ${m}, ${v} is ${cmp(v, m)} than ${m}, so it turns ${dv} \u2014 away from ${P}.`, `Once you turn away from a node you never come back to it. So ${v} can never reach ${P}.`];
  }
  const correctSide = dir(v, P);
  if (side !== correctSide) return [`You got all the way to ${P} \u2014 that part was right. But at ${P}, ${v} is ${cmp(v, P)} than ${P}, so it goes ${correctSide}, not ${side}.`];
  const child = node(tree, P)[side];
  if (child) return [`You got to ${P} and turned the right way. But that spot isn't empty \u2014 ${tree.nodes[child].val} is already there. ${v} has to keep walking, through ${tree.nodes[child].val}, until it finds a spot with nobody in it.`];
  return [];
}

function rotationWords(e) {
  const heavySide = e.lean;
  const base = `${e.val} leans ${heavySide}: its ${heavySide} side is ${Math.max(e.hl, e.hr)} tall and its ${other(heavySide)} side is ${Math.min(e.hl, e.hr)}. That's 2 apart \u2014 too much.`;
  if (e.kink) return [base, `Now look at its heavy child, ${e.heavy}. ${e.heavy} leans ${e.childLean} \u2014 the opposite way. That's a kink. A single rotation can't straighten a kink, so first rotate ${e.heavy} ${other(e.childLean)} to make the line straight, then rotate ${e.val} ${other(heavySide)}. Two moves.`];
  return [base, `Its heavy child ${e.heavy} leans ${e.childLean === "even" ? "the same way (or is even)" : "the same way"}, so this is a straight line. One rotation of ${e.val} to the ${other(heavySide)}: ${e.heavy} comes up, ${e.val} goes down. Done.`];
}

// ---------- the coach ----------
// Returns { title, paras } for the current state of a round.
export function coach({ puzzle, phase, picked, pick2, answered }) {
  const k = puzzle.kind;
  // --- Class exercise ---
  if (k === "class") {
    const before = puzzle.before, v = puzzle.value;
    if (puzzle.op === "insert") {
      if (phase === "land") {
        const r = before.root ? before.nodes[before.root].val : null;
        return { title: `How to find where ${v} goes`, paras: [
          `Start at the very top, at ${r}. Ask one question: is ${v} smaller or bigger than ${r}? Smaller means go left. Bigger means go right.`,
          `Keep asking that exact question at every node you land on. The moment there's no node in the direction you need, stop. That empty spot is where ${v} lives.`,
          `You never skip a node and you never turn back. One question per node, straight down.` ] };
      }
      const pre = plainInsert(before, v);
      const rep = balanceWalk(pre, v);
      if (phase === "rotate") {
        const landOk = picked === puzzle.landing || puzzle.landing === null;
        const paras = [];
        if (puzzle.landing !== null) paras.push(landOk ? `You walked it exactly right: ${walkWords(before, v).join(" ")}` : `${explainWrongSlot(before, v, picked).join(" ")} Here's the real walk: ${walkWords(before, v).join(" ")}`);
        else paras.push(`The tree was empty, so ${v} simply becomes the root. Nothing to walk.`);
        paras.push(`Now the balance check. Walk back UP from ${v}, one node at a time, all the way to the top. At each node, count how tall its left side is and how tall its right side is (a single node counts as 1, nothing counts as 0).`);
        paras.push(`If a node's two sides differ by 2, that node has to rotate. Check from the bottom up \u2014 the first one you find off by 2 is the one. If nobody is off by 2, click No rotation.`);
        return { title: "Step 2: is anyone off by 2?", paras };
      }
      // done
      const paras = rep.map((e) => `${e.val}: left ${e.hl}, right ${e.hr} \u2192 ${Math.abs(e.diff) > 1 ? "off by 2. This is the one." : Math.abs(e.diff) === 1 ? "off by 1, fine." : "even, fine."}`);
      const broken = rep.find((e) => e.broken);
      const rotOk = pick2 === (puzzle.rotAt === null ? "none" : puzzle.rotAt);
      let verdict;
      if (rotOk) verdict = broken ? `You found it: ${broken.val} was the one off by 2.` : `Right \u2014 nobody was off by 2, so the tree just writes down its new heights.`;
      else if (pick2 === "none") verdict = `It looked calm, but ${broken.val} was hiding it: left ${broken.hl}, right ${broken.hr}. Two apart means it must rotate.`;
      else {
        const e = rep.find((x) => x.val === pick2);
        if (e) verdict = `You picked ${pick2}, but ${pick2}'s sides are ${e.hl} and ${e.hr} \u2014 only ${Math.abs(e.diff)} apart. That's allowed.${broken ? ` The node that was actually off by 2 is ${broken.val}, ${rep.indexOf(e) < rep.indexOf(broken) ? "higher up" : "lower down"} the path.` : " Nobody was off by 2 this time."}`;
        else verdict = `${pick2} isn't on the path back up from ${v}. Only the nodes you walked through just gained height, so only they can go out of balance.${broken ? ` The one off by 2 was ${broken.val}.` : ""}`;
      }
      return { title: rotOk ? "Balance check: right" : "Balance check: here's what happened", paras: [verdict, "Walking up: " + paras.join(" "), ...(broken ? rotationWords(broken) : [])] };
    }
    // class remove (slides' rule: largest in the left branch)
    const x = puzzle.value;
    if (!puzzle.twoChildren) {
      const n = node(before, x); const kid = n && (n.left || n.right) ? before.nodes[n.left || n.right].val : null;
      const how = kid === null ? `${x} is a leaf \u2014 no children \u2014 so you just unhook it. Its parent's pointer becomes empty.` : `${x} has exactly one child, ${kid}. You cut ${x} out and its parent points straight to ${kid} instead. Nothing else moves.`;
      if (phase === "land") return { title: `Removing ${x}`, paras: [`First find ${x}: start at the top and walk the comparisons, smaller left, bigger right, until you're standing on it.`, how, `Click ${x} to take it out. Then we'll check the balance.`] };
      if (phase === "rotate") return { title: `Removing ${x}`, paras: [picked === x ? `${x} is out.` : `You clicked ${picked}, but the node to remove was ${x} \u2014 it's out now.`, how, `Removing shortens that side of the tree. Walk back up from where ${x} was and check each node's two heights. If one is off by 2, it rotates. Otherwise, No rotation.`] };
      const rotOk = pick2 === (puzzle.rotAt === null ? "none" : puzzle.rotAt);
      return { title: rotOk ? "Removal: right" : "Removal: here's what happened", paras: [how, puzzle.rotAt === null ? "Nobody went out of balance, so no rotation." : `Taking ${x} out left ${puzzle.rotAt} with one side 2 taller than the other, so ${puzzle.rotAt} rotated.${pick2 === "none" ? " Removals unbalance things quietly \u2014 always walk up and count." : ""}`] };
    }
    if (phase === "land") return { title: `Who takes ${x}'s seat?`, paras: [
      `${x} has two children, so you can't just cut it out \u2014 one child would be left dangling.`,
      `The slides' rule: replace ${x} with the LARGEST key in its LEFT branch. To find it: from ${x}, step left once, then keep stepping right until you can't. The node you stop on is the answer.`,
      `(Your professor's code does the mirror image \u2014 smallest in the right branch. Both are legal. Here, play the slides' rule.)` ] };
    const L = node(before, x).left; let w = before.nodes[L].val; const walk = [w]; let cur = before.nodes[L]; while (cur.right) { cur = before.nodes[cur.right]; walk.push(cur.val); }
    const seatOk = picked === puzzle.seat;
    const seatPara = seatOk ? `Right. From ${x}, left once to ${walk[0]}${walk.length > 1 ? `, then right: ${walk.slice(1).join(" \u2192 ")}` : ", and it has no right child"}. ${puzzle.seat} is the largest thing smaller than ${x}, so it can sit in ${x}'s seat without breaking the order.`
      : `You picked ${picked}. From ${x} the walk is: left once to ${walk[0]}${walk.length > 1 ? `, then right until you can't: ${walk.slice(1).join(" \u2192 ")}` : ", which has no right child"}. So the seat goes to ${puzzle.seat}, the largest key on ${x}'s left side.`;
    if (phase === "rotate") return { title: "Step 2: did the removal unbalance anything?", paras: [seatPara, `Removing shortens one side. Walk back up from where the seat-taker used to be and check each node's two heights. Off by 2? That node rotates. Otherwise, No rotation.`] };
    const after = puzzle.after; const rotOk = pick2 === (puzzle.rotAt === null ? "none" : puzzle.rotAt);
    return { title: rotOk ? "Removal: right" : "Removal: here's what happened", paras: [seatPara, puzzle.rotAt === null ? (rotOk ? "And nobody went out of balance \u2014 no rotation." : `Nobody went out of balance after that, so no rotation was needed.`) : (rotOk ? `And you spotted it: ${puzzle.rotAt} ended up 2 taller on one side, so it rotated.` : `After the seat swap, ${puzzle.rotAt} was left with one side 2 taller than the other, so it rotated. ${pick2 === "none" ? "Easy to miss \u2014 removals unbalance things quietly." : ""}`)] };
  }
  // --- random modes ---
  if (k === "insert") {
    const v = puzzle.value, t = puzzle.tree;
    if (!answered) return { title: `How to find where ${v} goes`, paras: [`Start at the top, ${t.nodes[t.root].val}. Smaller means left, bigger means right. Ask that at every node until there's no node in the direction you need \u2014 that empty spot is the answer.`] };
    const ok = picked === puzzle.answer;
    return { title: ok ? "Right \u2014 here's why" : "Not there \u2014 here's why", paras: ok ? [walkWords(t, v).join(" ")] : [...explainWrongSlot(t, v, picked), "The real walk: " + walkWords(t, v).join(" ")] };
  }
  if (k === "seat") {
    const x = puzzle.value, t = puzzle.tree;
    if (!answered) return { title: `Who takes ${x}'s seat?`, paras: [`${x} has two children, so it can't just be cut out. The replacement is the smallest key on ${x}'s RIGHT side: from ${x}, step right once, then keep stepping left until you can't.`, `Why that one? It's the next key up from ${x}, so it fits ${x}'s seat without breaking the left-smaller / right-bigger order.`] };
    const R = node(t, x).right; const walk = [t.nodes[R].val]; let cur = t.nodes[R]; while (cur.left) { cur = t.nodes[cur.left]; walk.push(cur.val); }
    const ok = picked === puzzle.answer;
    return { title: ok ? "Right \u2014 here's why" : "Not that one \u2014 here's why", paras: [`${ok ? "" : `You picked ${picked}. `}From ${x}: right once to ${walk[0]}${walk.length > 1 ? `, then left: ${walk.slice(1).join(" \u2192 ")}` : ", which has nothing to its left"}. ${puzzle.answer} is the smallest thing bigger than ${x}, so it takes the seat.`, `Then the old ${puzzle.answer} gets removed from below \u2014 easy, because a smallest key never has a left child.`] };
  }
  if (k === "extreme") {
    const wantMin = /SMALLEST/.test(puzzle.prompt); const t = puzzle.tree; const side = wantMin ? "left" : "right";
    if (!answered) return { title: wantMin ? "Finding the smallest" : "Finding the largest", paras: [`${wantMin ? "Smaller" : "Bigger"} keys always live to the ${side}. So start at the top and keep going ${side} until there's no ${side} child. Don't look at the numbers \u2014 just follow the ${side} pointers.`] };
    let cur = t.nodes[t.root]; const walk = [cur.val]; while (cur[side]) { cur = t.nodes[cur[side]]; walk.push(cur.val); }
    const ok = picked === puzzle.answer;
    return { title: ok ? "Right \u2014 here's why" : "Not that one \u2014 here's why", paras: [`${ok ? "" : `You picked ${picked}. `}Follow the ${side} pointers from the top: ${walk.join(" \u2192 ")}. ${puzzle.answer} has no ${side} child, so it's the ${wantMin ? "smallest" : "largest"}.`, `That's ${wantMin ? "findMin" : "findMax"}: \`while (p->${side}) p = p->${side};\``] };
  }
  return { title: "", paras: [] };
}

// Plain remove with NO balancing (seat rule: predecessor when usePred, else successor): the tree the moment
// the seat is swapped and the dead node is unhooked, before bal() runs.
export function plainRemove(tree, k, usePred) {
  const nodes = {}; for (const id in tree.nodes) nodes[id] = { ...tree.nodes[id] };
  const t = { nodes, root: tree.root };
  const go = (id, key) => {
    if (!id) return null;
    const n = t.nodes[id];
    if (key < n.val) { n.left = go(n.left, key); return id; }
    if (key > n.val) { n.right = go(n.right, key); return id; }
    if (n.left && n.right) {
      let c = usePred ? n.left : n.right; while (usePred ? t.nodes[c].right : t.nodes[c].left) c = usePred ? t.nodes[c].right : t.nodes[c].left;
      const rep = t.nodes[c].val;
      if (usePred) n.left = go(n.left, rep); else n.right = go(n.right, rep);
      const nid = "v" + rep; delete t.nodes[id]; t.nodes[nid] = { ...n, id: nid, val: rep }; return nid;
    }
    const child = n.left || n.right; delete t.nodes[id]; return child;
  };
  t.root = go(t.root, k);
  return t;
}
