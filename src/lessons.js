// Curriculum (chapters + lessons) lives in the Supabase `curriculum` table
// and is fetched at load. This module keeps the pure helpers and badges.

export const BADGES = [
  { id: "first", name: "First light", how: "Pass your first lesson", check: (s) => s.done.length >= 1 },
  { id: "c2c", name: "Stream master", how: "Finish chapter 2", check: (s, L) => L.filter((l) => l.chapter === "c2").every((l) => s.done.includes(l.id)) },
  { id: "boss", name: "Structured", how: "Beat the exam-results boss", check: (s) => s.done.includes("l13") },
  { id: "tree", name: "Tree hugger", how: "Beat the grove boss", check: (s) => s.done.includes("l34") },
  { id: "harness", name: "Harness master", how: "Survive the full test protocol", check: (s) => s.done.includes("l41") },
  { id: "clean", name: "Clean compile", how: "Pass a lesson on the first try", check: (s) => s.firstTry >= 1 },
  { id: "streak3", name: "Three-day streak", how: "Practice three days in a row", check: (s) => streakOf(s.days) >= 3 },
  { id: "lvl5", name: "Level 5", how: "Reach level 5", check: (s) => levelOf(s.xp).level >= 5 },
];

// ---------- Helpers ----------
export const todayKey = () => new Date().toISOString().slice(0, 10);
export function streakOf(days) {
  if (!days.length) return 0;
  const set = new Set(days);
  let d = new Date();
  if (!set.has(todayKey())) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function levelOf(xp) {
  let level = 1, need = 150, floor = 0;
  while (xp >= floor + need) { floor += need; level++; need = Math.round(need * 1.35); }
  return { level, into: xp - floor, need };
}
export const norm = (s) => (s || "").replace(/\r/g, "").split("\n").map((l) => l.trimEnd()).join("\n").trim();
export const difficultyOf = (l) => (l.boss ? "Boss" : l.xp <= 75 ? "Beginner" : l.xp <= 125 ? "Intermediate" : "Advanced");
