# cppquest

Learn C++ by doing: bite-sized lessons with a real compiler, XP, streaks, badges, and the Tree Arena games. Live at https://cppquest.vercel.app.

## Stack

- React 18 + Vite, Tailwind via CDN (see `index.html`)
- Supabase (project `mfgbbcvgqsmbcsvzeixq`)
  - `curriculum` table: one row (`id = 1`) holding `chapters` and `lessons` as JSON
  - `explainers` table: `lesson_id` → `blocks` (the long-form reading for each lesson)
  - `scores` table: the leaderboard
  - Edge functions: `compile` (runs the student's code against the lesson tests), `hint`, `chat` (AI tutor)
- Progress is stored in the browser under `localStorage["cppquest:progress:v2"]`

## Run locally

```sh
npm install
npm run dev
```

## Content

`data/curriculum.json` and `data/explainers.json` are snapshots of the Supabase tables. The app reads the tables at load time, so to change lessons update the tables; keep the snapshots in sync so content is versioned here too.

## Layout

```
src/App.jsx          lessons, editor, map, topic picker, leaderboard, tutor
src/lessons.js       badges, XP/level curve, streak helpers
src/arena*.jsx       Tree Arena menu and games (BST, AVL, heap, sorting, BFS, DFS, topo sort)
src/*sim.js          simulators the arena games run on
src/livetree.jsx     animated tree built from a lesson run
```
