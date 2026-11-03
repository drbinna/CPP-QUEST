// Pure call-stack simulation for the recursion visualizer (l28/l29).
// No React here so node can unit-test it directly.

export const tri = (n) => (n * (n + 1)) / 2;

// sumTo(n): calls push frames n..0, returns resolve 0..n with values.
export function genSumSteps(n) {
  const steps = [];
  for (let i = n; i >= 0; i--) steps.push({ type: "call", n: i });
  for (let i = 0; i <= n; i++) steps.push({ type: "ret", n: i, value: tri(i) });
  return steps;
}

// climb(n): print AFTER the recursive call, so prints happen on returns, ascending.
export function genClimbSteps(n) {
  const steps = [];
  for (let i = n; i >= 0; i--) steps.push({ type: "call", n: i });
  for (let i = 0; i <= n; i++) {
    const s = { type: "ret", n: i };
    if (i > 0) s.print = i;
    steps.push(s);
  }
  return steps;
}

// dive(n): print BEFORE the recursive call, so prints happen on calls, descending.
export function genDiveSteps(n) {
  const steps = [];
  for (let i = n; i >= 0; i--) {
    const s = { type: "call", n: i };
    if (i > 0) s.print = i;
    steps.push(s);
  }
  for (let i = 0; i <= n; i++) steps.push({ type: "ret", n: i });
  return steps;
}

// Scene after steps[0..cursor-1] applied, with steps[cursor] as the live step.
// frames: outermost call first, each { n, status } where status is
// "waiting" (paused at its recursive call), "active" (the live step's frame),
// or "resolved" (finished, its value known). output: prints so far, in order.
export function deriveScene(steps, cursor) {
  const status = {};
  const output = [];
  const upto = Math.min(cursor, steps.length);
  for (let i = 0; i < upto; i++) {
    const s = steps[i];
    status[s.n] = s.type === "call" ? "waiting" : "resolved";
    if (s.print !== undefined) output.push(s.print);
  }
  let live = null;
  if (cursor < steps.length) {
    live = steps[cursor];
    status[live.n] = "active";
  }
  const ns = Object.keys(status).map(Number).sort((a, b) => b - a);
  const frames = ns.map((n) => ({ n, status: status[n] }));
  return { frames, output, live };
}
