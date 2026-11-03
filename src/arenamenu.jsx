// Left-hand mode menu for the Tree Arena, built on the shared sidebar component.
import { Sidebar, SidebarHeader, SidebarNav, SidebarSection, SidebarItem, SidebarFooter, SidebarToggle, useSidebar } from "./components/ui/sidebar.jsx";

const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

const Svg = ({ children }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const I = {
  mix: <Svg><path d="M4 7h3l10 10h3M4 17h3l3-3M14 10l3-3h3M18 5l2 2-2 2M18 15l2 2-2 2" /></Svg>,
  land: <Svg><circle cx="12" cy="5" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" strokeDasharray="2 2" /><path d="M11 7l-4 9M13 7l4 9" /></Svg>,
  seat: <Svg><circle cx="12" cy="6" r="2.5" /><path d="M7 20v-3a5 5 0 0 1 10 0v3M4 20h16" /></Svg>,
  floor: <Svg><path d="M12 4v11M8 11l4 4 4-4M5 20h14" /></Svg>,
  avl: <Svg><path d="M12 4v16M5 20h14M6 8l-3 6h6zM18 8l-3 6h6zM6 8h12" /></Svg>,
  slides: <Svg><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M12 16v4M8 20h8" /></Svg>,
  quiz: <Svg><path d="M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.6V14M12 18h.01" /><circle cx="12" cy="12" r="9" /></Svg>,
  up: <Svg><path d="M12 20V5M6 11l6-6 6 6" /></Svg>,
  down: <Svg><path d="M12 4v15M6 13l6 6 6-6" /></Svg>,
  notes: <Svg><path d="M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h3" /></Svg>,
  build: <Svg><path d="M12 3l9 16H3z" /><path d="M8 13h8" /></Svg>,
  book: <Svg><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21h15" /></Svg>,
  drain: <Svg><path d="M5 5h14l-5 7v6l-4 2v-8z" /></Svg>,
  wall: <Svg><path d="M4 18h3M9 18V9M14 18v-6M19 18V6M11.5 4v16" /></Svg>,
  pivot: <Svg><path d="M5 18V12M10 18V8M15 18v-4M20 18V10M10 5l0 0M8 3l2 2 2-2" /></Svg>,
  bars: <Svg><path d="M5 18v-4M10 18v-7M15 18V8M20 18V5" /></Svg>,
  shuffle: <Svg><path d="M5 18v-8M10 18v-3M15 18V6M20 18v-6" /></Svg>,
  merge: <Svg><path d="M5 4v5a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V4M12 12v8M9 17l3 3 3-3" /></Svg>,
  target: <Svg><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3" /></Svg>,
  split: <Svg><path d="M12 3v5M12 8l-6 5M12 8l6 5M6 13v3M18 13v3M4 20h4M16 20h4" /></Svg>,
  graph: <Svg><circle cx="5" cy="6" r="2.2" /><circle cx="19" cy="6" r="2.2" /><circle cx="5" cy="18" r="2.2" /><circle cx="19" cy="18" r="2.2" /><path d="M7.2 6h9.6M5 8.2v7.6M19 8.2v7.6M7.2 18h9.6M6.6 7.6l10.8 8.8" /></Svg>,
  queue: <Svg><rect x="3" y="9" width="5" height="6" rx="1" /><rect x="9.5" y="9" width="5" height="6" rx="1" /><rect x="16" y="9" width="5" height="6" rx="1" strokeDasharray="2 2" /><path d="M3 5h15M15 2.5L18 5l-3 2.5" /></Svg>,
  levels: <Svg><circle cx="12" cy="4.5" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="12" r="2" /><path d="M10.6 6l-3.4 4.4M13.4 6l3.4 4.4M3 19h18M3 15.5h18" /></Svg>,
  ruler: <Svg><circle cx="5" cy="12" r="2.2" /><circle cx="19" cy="12" r="2.2" /><path d="M7.2 12h9.6M10 10v4M14 10v4" /></Svg>,
  dive: <Svg><circle cx="6" cy="4.5" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="14" cy="19.5" r="2" /><circle cx="18" cy="12" r="2" strokeDasharray="2 2" /><path d="M7 6.3l2 3.9M11 13.8l2 3.9M8 4.5h8l1.4 5.6" /></Svg>,
  stack: <Svg><rect x="5" y="4" width="14" height="4" rx="1" /><rect x="5" y="10" width="14" height="4" rx="1" /><rect x="5" y="16" width="14" height="4" rx="1" fill="currentColor" fillOpacity=".25" /></Svg>,
  tree: <Svg><circle cx="12" cy="4.5" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="12" r="2" /><circle cx="4" cy="19.5" r="2" /><path d="M10.6 6l-3.4 4.4M13.4 6l3.4 4.4M5.4 13.8l-.8 3.8" /></Svg>,
  ready: <Svg><circle cx="5" cy="12" r="2.2" /><circle cx="19" cy="6" r="2.2" /><circle cx="19" cy="18" r="2.2" /><path d="M7.2 11l9-4M7.2 13l9 4M14 5.5l2.2 1.5-1.2 2.3M14 18.5l2.2-1.5-1.2-2.3" /></Svg>,
  chain: <Svg><rect x="2.5" y="9" width="5" height="6" rx="1.2" /><rect x="9.5" y="9" width="5" height="6" rx="1.2" /><rect x="16.5" y="9" width="5" height="6" rx="1.2" /><path d="M7.5 12h2M14.5 12h2" /></Svg>,
  check: <Svg><path d="M4 7h10M4 12h7M4 17h5M14 15l3 3 5-6" /></Svg>,
  dice: <Svg><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 9h.01M15 15h.01M15 9h.01M9 15h.01" /></Svg>,
};

// Which icon goes with which mode key; unknown keys fall back by family.
const ICONS = {
  mix: I.mix, insert: I.land, seat: I.seat, extreme: I.floor,
  class: I.avl, deck: I.slides, practA: I.quiz, practB: I.quiz,
  "heap-rand-insert": I.up, "heap-rand-extract": I.down,
  "heap-notes": I.notes, "heap-build": I.build, "heap-clrs": I.book, "heap-drain": I.drain,
  "sort-trace": I.wall, "sort-pivot": I.pivot, "sort-full": I.bars, "sort-full-rand": I.shuffle,
  "merge-step": I.merge, "merge-land": I.target, "merge-full": I.split, "merge-full-rand": I.dice,
  "bfs-step": I.queue, "bfs-order": I.levels, "bfs-dist": I.ruler, "bfs-step-rand": I.graph,
  "dfs-step": I.dive, "dfs-order": I.tree, "dfs-grey": I.stack, "dfs-step-rand": I.graph,
  "topo-step": I.ready, "topo-build": I.chain, "topo-valid": I.check, "topo-step-rand": I.graph,
};

function Brand() {
  const { collapsed } = useSidebar();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, fontFamily: MONO }}>
      <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden="true">{"🎮"}</span>
      {!collapsed && <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>Arena modes</span>}
    </div>
  );
}

function Best({ best }) {
  const { collapsed } = useSidebar();
  return collapsed
    ? <span title={`Your best: ${best}`} style={{ fontFamily: MONO, fontSize: 11, color: "#F2B84B", fontWeight: 700 }}>{best}</span>
    : <span style={{ fontFamily: MONO, fontSize: 12, color: "#9AA3B5" }}>Your best: <b style={{ color: "#F2B84B" }}>{best}</b></span>;
}

/**
 * groups: [{ label, modes: [[key, label], ...] }]
 * active: the mode currently being played (or null on the menu screen)
 */
export default function ArenaMenu({ groups, active, onPick, best = 0 }) {
  const narrow = typeof window !== "undefined" && window.innerWidth < 900;
  return (
    <Sidebar variant="collapsible" defaultCollapsed={narrow} width={250} aria-label="Arena modes">
      <SidebarHeader>
        <Brand />
        <SidebarToggle style={{ marginLeft: "auto" }} />
      </SidebarHeader>
      <SidebarNav>
        {groups.map((g) => (
          <SidebarSection key={g.label} label={g.label}>
            {g.modes.map(([k, label]) => (
              <SidebarItem key={k} icon={ICONS[k] || (k.startsWith("heap") ? I.build : I.land)} active={active === k} onClick={() => onPick(k)}>
                {label}
              </SidebarItem>
            ))}
          </SidebarSection>
        ))}
      </SidebarNav>
      <SidebarFooter>
        <Best best={best} />
      </SidebarFooter>
    </Sidebar>
  );
}
