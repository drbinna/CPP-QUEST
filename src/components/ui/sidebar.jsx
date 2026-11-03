/**
 * Sidebar — port of the Wensity/shadcn sidebar for cppquest.
 *
 * Same compound API as the original (Sidebar, SidebarHeader, SidebarNav,
 * SidebarSection, SidebarItem, SidebarNested, SidebarFooter, SidebarToggle,
 * useSidebar) and the same variants (default, collapsible, icon-rail,
 * floating, resizable), rebuilt without framer-motion, @base-ui/react,
 * @tabler/icons-react, clsx or tailwind-merge so it ships through the existing
 * Vite build with no new packages. Motion is plain CSS: 240ms width
 * transition, label fades, a chevron rotate and a height reveal for nested
 * groups, all switched off under prefers-reduced-motion.
 *
 * Colors come from CSS variables (--sb-*) set on the <nav>, defaulting to the
 * cppquest palette; override any of them through the `style` prop.
 */
import * as React from "react";

const cn = (...xs) => xs.flat(Infinity).filter(Boolean).join(" ");

const STYLE_ID = "cq-sidebar-styles";
const STYLES = `
.sb { --sb-bg:#242B3A; --sb-fg:#E8E6DF; --sb-muted:#9AA3B5; --sb-border:#3A4358;
  --sb-hover:rgba(232,230,223,.05); --sb-selected:rgba(242,184,75,.14); --sb-accent:#F2B84B; --sb-ring:#F2B84B;
  position:relative; isolation:isolate; display:flex; flex-direction:column; height:100%; overflow:hidden; flex-shrink:0;
  background:var(--sb-bg); color:var(--sb-fg); border-right:1px solid var(--sb-border);
  transition:width 240ms cubic-bezier(.23,1,.32,1); }
.sb[data-dragging="true"] { transition:none; user-select:none; }
.sb[data-variant="floating"] { margin:12px; height:calc(100% - 24px); border:1px solid var(--sb-border); border-radius:16px;
  box-shadow:0 1px 2px rgba(0,0,0,.3), 0 8px 24px -12px rgba(0,0,0,.5); }

.sb-header { display:flex; flex-shrink:0; align-items:center; height:52px; gap:10px; padding:0 14px 0 18px; }
.sb[data-collapsed="true"] .sb-header { flex-direction:column; justify-content:center; height:auto; gap:8px; padding:12px 0; }
.sb-header[role="button"] { cursor:pointer; border-radius:10px; margin:4px 6px; outline:none;
  transition:background-color 150ms cubic-bezier(.23,1,.32,1), transform 120ms cubic-bezier(.23,1,.32,1); }
.sb-header[role="button"]:hover { background:var(--sb-hover); }
.sb-header[role="button"]:active { transform:scale(.97); }

.sb-nav { min-height:0; flex:1; overflow-y:auto; overflow-x:hidden; overscroll-behavior-y:contain; padding:8px 0;
  scrollbar-width:thin; scrollbar-color:transparent transparent; }
.sb-nav:hover { scrollbar-color:rgba(255,255,255,.11) transparent; }
.sb-nav::-webkit-scrollbar { width:4px; }
.sb-nav::-webkit-scrollbar-thumb { background:transparent; border-radius:9999px; }
.sb-nav:hover::-webkit-scrollbar-thumb { background:rgba(255,255,255,.11); }

.sb-section { padding:4px 0; }
.sb-section-label { display:flex; align-items:flex-end; height:26px; padding:0 18px 6px; }
.sb-section-items { display:flex; flex-direction:column; gap:1px; padding:0 8px; }

.sb-fade { transition:opacity 120ms cubic-bezier(.23,1,.32,1); white-space:nowrap; }
.sb[data-collapsed="true"] .sb-fade { opacity:0; pointer-events:none; width:0; overflow:hidden; flex:0 0 0; }
.sb-label-text { font-size:10.5px; font-weight:500; text-transform:uppercase; letter-spacing:.08em; line-height:1; color:var(--sb-muted); }

.sb-item { position:relative; display:flex; width:100%; align-items:center; gap:10px; border:0; background:none; cursor:pointer;
  border-radius:10px; padding:7px 12px; font:inherit; font-size:13.5px; font-weight:500; line-height:1.15; text-align:left;
  color:var(--sb-muted); text-decoration:none; outline:none; user-select:none; white-space:nowrap;
  transition:color 150ms cubic-bezier(.23,1,.32,1), background-color 150ms cubic-bezier(.23,1,.32,1); }
.sb-item:hover { color:var(--sb-fg); background:var(--sb-hover); }
.sb-item[data-active="true"] { color:var(--sb-fg); }
.sb-item:focus-visible { box-shadow:0 0 0 2px var(--sb-bg), 0 0 0 4px var(--sb-ring); }
.sb-item:disabled { pointer-events:none; opacity:.4; }
.sb[data-collapsed="true"] .sb-item { justify-content:center; padding:7px 0; }
.sb-pill { pointer-events:none; position:absolute; inset:0; border-radius:10px; background:var(--sb-selected);
  box-shadow:inset 2px 0 0 var(--sb-accent); animation:sb-pill-in 180ms cubic-bezier(.23,1,.32,1); }
@keyframes sb-pill-in { from { opacity:0; transform:scale(.97) } to { opacity:1; transform:none } }
.sb-icon { position:relative; z-index:1; display:flex; width:20px; height:20px; flex-shrink:0; align-items:center; justify-content:center;
  color:var(--sb-muted); transition:color 150ms ease; }
.sb-item:hover .sb-icon, .sb-item[data-active="true"] .sb-icon { color:var(--sb-fg); }
.sb-item[data-active="true"] .sb-icon { color:var(--sb-accent); }
.sb-text { position:relative; z-index:1; min-width:0; flex:1; overflow:hidden; text-overflow:ellipsis; }
.sb-badge { position:relative; z-index:1; display:flex; flex-shrink:0; align-items:center; }

.sb-chevron { display:flex; color:var(--sb-muted); transition:transform 200ms cubic-bezier(.23,1,.32,1); }
.sb-chevron[data-open="true"] { transform:rotate(90deg); }
.sb-nested-body { display:grid; grid-template-rows:0fr; opacity:0; visibility:hidden;
  transition:grid-template-rows 240ms cubic-bezier(.23,1,.32,1), opacity 160ms cubic-bezier(.23,1,.32,1), visibility 0s 240ms; }
.sb-nested-body[data-open="true"] { grid-template-rows:1fr; opacity:1; visibility:visible; transition-delay:0s; }
.sb-nested-body > div { overflow:hidden; }
.sb-nested-list { position:relative; margin-left:21px; display:flex; flex-direction:column; gap:1px; padding:2px 0 2px 10px; }
.sb-nested-list::before { content:""; position:absolute; top:4px; bottom:4px; left:0; width:1px; background:rgba(232,230,223,.1); }

.sb-footer { display:flex; flex-shrink:0; align-items:center; gap:10px; padding:12px 18px; border-top:1px solid var(--sb-border); }
.sb[data-collapsed="true"] .sb-footer { justify-content:center; padding:12px 0; }

.sb-toggle { display:flex; width:28px; height:28px; flex-shrink:0; align-items:center; justify-content:center; border:0; border-radius:10px;
  background:none; color:var(--sb-muted); cursor:pointer; outline:none;
  transition:transform 120ms cubic-bezier(.23,1,.32,1), color 150ms ease, background-color 150ms ease; }
.sb-toggle:hover { background:rgba(232,230,223,.06); color:var(--sb-fg); }
.sb-toggle:active { transform:scale(.96); }
.sb-toggle:focus-visible, .sb-header[role="button"]:focus-visible { box-shadow:0 0 0 2px var(--sb-bg), 0 0 0 4px var(--sb-ring); }

.sb-resize { position:absolute; top:0; bottom:0; right:0; z-index:20; width:6px; cursor:col-resize; outline:none; }
.sb-resize::after { content:""; position:absolute; top:0; bottom:0; right:0; width:2px; background:transparent; transition:background-color 150ms; }
.sb-resize:hover::after, .sb-resize:focus-visible::after { background:rgba(232,230,223,.22); }
.sb[data-dragging="true"] .sb-resize::after { background:rgba(232,230,223,.3); }

@media (prefers-reduced-motion: reduce) {
  .sb, .sb-fade, .sb-item, .sb-chevron, .sb-nested-body, .sb-toggle, .sb-header[role="button"] { transition:none; }
  .sb-pill { animation:none; }
  .sb-toggle:active, .sb-header[role="button"]:active { transform:none; }
}
`;

function useSidebarStyles() {
  React.useInsertionEffect(() => {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = STYLES;
    document.head.appendChild(el);
  }, []);
}

/* ─── Icons (stroke icons drawn inline, Tabler-style) ───────── */

const Svg = ({ size = 17, children, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);
const IconChevronRight = (p) => <Svg size={14} strokeWidth={2} {...p}><path d="M9 6l6 6-6 6" /></Svg>;
const IconCollapse = (p) => <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 4v16M15 10l-2 2 2 2" /></Svg>;
const IconExpand = (p) => <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 4v16M14 10l2 2-2 2" /></Svg>;

/* ─── Context ───────────────────────────────────────────────── */

const SidebarContext = React.createContext(null);

function useSidebarContext() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("Sidebar compound components must be used within <Sidebar>");
  return ctx;
}

/** Current sidebar state, for custom header/footer content. */
export function useSidebar() {
  const { variant, collapsed, toggleCollapsed } = useSidebarContext();
  return { variant, collapsed, toggleCollapsed };
}

/* ─── Resizable width ───────────────────────────────────────── */

function useResizableWidth(initial, min, max) {
  const [width, setWidth] = React.useState(initial);
  const [isDragging, setIsDragging] = React.useState(false);
  const drag = React.useRef(null);
  const clamp = React.useCallback((v) => Math.min(max, Math.max(min, v)), [min, max]);

  const onPointerDown = React.useCallback((e) => {
    e.preventDefault();
    e.target.setPointerCapture?.(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: width };
    setIsDragging(true);
  }, [width]);

  React.useEffect(() => {
    if (!isDragging) return;
    const move = (e) => { if (drag.current) setWidth(clamp(drag.current.startWidth + e.clientX - drag.current.startX)); };
    const up = () => { drag.current = null; setIsDragging(false); };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    return () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); };
  }, [isDragging, clamp]);

  const onKeyDown = React.useCallback((e) => {
    const step = e.shiftKey ? 48 : 16;
    if (e.key === "ArrowLeft") { e.preventDefault(); setWidth((w) => clamp(w - step)); }
    else if (e.key === "ArrowRight") { e.preventDefault(); setWidth((w) => clamp(w + step)); }
    else if (e.key === "Home") { e.preventDefault(); setWidth(min); }
    else if (e.key === "End") { e.preventDefault(); setWidth(max); }
  }, [clamp, min, max]);

  return { width, isDragging, onPointerDown, onKeyDown, reset: () => setWidth(initial) };
}

/* ─── <Sidebar> ─────────────────────────────────────────────── */

export const Sidebar = React.forwardRef(function Sidebar(
  {
    variant = "default",
    collapsed: controlledCollapsed,
    defaultCollapsed = false,
    onCollapsedChange,
    width: widthProp = 260,
    collapsedWidth = 60,
    minWidth = 180,
    maxWidth = 400,
    className,
    children,
    "aria-label": ariaLabel = "Sidebar",
    style,
    ...props
  },
  ref,
) {
  useSidebarStyles();
  const reactId = React.useId();
  const isCollapsible = variant === "collapsible";
  const isIconRail = variant === "icon-rail";
  const isResizable = variant === "resizable";

  const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed);
  const isControlled = controlledCollapsed !== undefined;
  const collapsed = isIconRail ? true : isCollapsible ? (isControlled ? controlledCollapsed : internalCollapsed) : false;

  const toggleCollapsed = React.useCallback(() => {
    if (!isCollapsible) return;
    const next = !collapsed;
    if (!isControlled) setInternalCollapsed(next);
    onCollapsedChange?.(next);
  }, [isCollapsible, collapsed, isControlled, onCollapsedChange]);

  const resize = useResizableWidth(widthProp, minWidth, maxWidth);
  const effectiveWidth = collapsed ? collapsedWidth : isResizable ? resize.width : widthProp;

  const ctx = React.useMemo(
    () => ({ variant, collapsed, toggleCollapsed, navId: `sidebar-${reactId}` }),
    [variant, collapsed, toggleCollapsed, reactId],
  );

  return (
    <SidebarContext.Provider value={ctx}>
      <nav
        ref={ref}
        aria-label={ariaLabel}
        data-slot="sidebar"
        data-variant={variant}
        data-collapsed={collapsed ? "true" : "false"}
        data-dragging={resize.isDragging ? "true" : undefined}
        className={cn("sb", className)}
        style={{ ...style, width: effectiveWidth }}
        {...props}
      >
        {children}
        {isResizable && (
          <div
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            aria-valuemin={minWidth}
            aria-valuemax={maxWidth}
            aria-valuenow={Math.round(resize.width)}
            className="sb-resize"
            onPointerDown={resize.onPointerDown}
            onKeyDown={resize.onKeyDown}
            onDoubleClick={resize.reset}
          />
        )}
      </nav>
    </SidebarContext.Provider>
  );
});

/* ─── Fading label ──────────────────────────────────────────── */

function FadingLabel({ className, children }) {
  const { collapsed } = useSidebarContext();
  return <span className={cn("sb-fade", className)} aria-hidden={collapsed || undefined}>{children}</span>;
}

/* ─── <SidebarHeader> ───────────────────────────────────────── */

export const SidebarHeader = React.forwardRef(function SidebarHeader({ className, children, onClick, onKeyDown, ...props }, ref) {
  const { collapsed, variant, toggleCollapsed } = useSidebarContext();
  const expandable = collapsed && variant === "collapsible";
  // Collapsed: drop the toggle (no room at rail width) and let the header itself expand the sidebar.
  const visible = collapsed
    ? React.Children.toArray(children).filter((c) => !(React.isValidElement(c) && c.type === SidebarToggle))
    : children;
  return (
    <div
      ref={ref}
      data-slot="sidebar-header"
      role={expandable ? "button" : undefined}
      tabIndex={expandable ? 0 : undefined}
      aria-label={expandable ? "Expand sidebar" : undefined}
      onClick={(e) => { onClick?.(e); if (expandable) toggleCollapsed(); }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (expandable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggleCollapsed(); }
      }}
      className={cn("sb-header", className)}
      {...props}
    >
      {visible}
    </div>
  );
});

/* ─── <SidebarNav> ──────────────────────────────────────────── */

export const SidebarNav = React.forwardRef(function SidebarNav({ className, children, ...props }, ref) {
  const { navId } = useSidebarContext();
  return <div ref={ref} id={navId} data-slot="sidebar-nav" className={cn("sb-nav", className)} {...props}>{children}</div>;
});

/* ─── <SidebarSection> ──────────────────────────────────────── */

export const SidebarSection = React.forwardRef(function SidebarSection({ className, label, children, ...props }, ref) {
  return (
    <div ref={ref} data-slot="sidebar-section" role="group" aria-label={label} className={cn("sb-section", className)} {...props}>
      {label && <div className="sb-section-label"><FadingLabel className="sb-label-text">{label}</FadingLabel></div>}
      <div className="sb-section-items">{children}</div>
    </div>
  );
});

/* ─── <SidebarItem> ─────────────────────────────────────────── */

export const SidebarItem = React.forwardRef(function SidebarItem(
  { className, icon, active = false, href, external = false, badge, asChild = false, children, disabled, ...props },
  ref,
) {
  const { collapsed } = useSidebarContext();
  const cls = cn("sb-item", className);
  const title = collapsed && typeof children === "string" ? children : props.title;
  const shared = { "data-slot": "sidebar-item", "data-active": active ? "true" : undefined, "aria-current": active ? "page" : undefined, title };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, { ...shared, ...props, ref, className: cn(cls, children.props.className) });
  }

  const content = (
    <>
      {active && <span className="sb-pill" aria-hidden="true" />}
      {icon && <span className="sb-icon" data-slot="sidebar-item-icon">{icon}</span>}
      <FadingLabel className="sb-text">{children}</FadingLabel>
      {badge && <FadingLabel className="sb-badge">{badge}</FadingLabel>}
    </>
  );

  if (href) {
    return (
      <a ref={ref} href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}
        className={cls} {...shared} {...props}>{content}</a>
    );
  }
  return <button ref={ref} type="button" disabled={disabled} className={cls} {...shared} {...props}>{content}</button>;
});

/* ─── <SidebarNested> ───────────────────────────────────────── */

export const SidebarNested = React.forwardRef(function SidebarNested(
  { icon, label, open: controlledOpen, defaultOpen = false, onOpenChange, active = false, children },
  ref,
) {
  const { collapsed } = useSidebarContext();
  const id = React.useId();
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const toggle = () => { const next = !open; if (!isControlled) setInternalOpen(next); onOpenChange?.(next); };
  const shown = open && !collapsed;
  const contentId = `sidebar-nested-${id}`;

  return (
    <div ref={ref} data-slot="sidebar-nested" style={{ display: "flex", flexDirection: "column" }}>
      <button type="button" className="sb-item" data-open={open ? "true" : "false"}
        data-active={active && collapsed ? "true" : undefined}
        aria-expanded={open} aria-controls={contentId} onClick={toggle} title={collapsed ? label : undefined}>
        {active && collapsed && <span className="sb-pill" aria-hidden="true" />}
        {icon && <span className="sb-icon">{icon}</span>}
        <FadingLabel className="sb-text">{label}</FadingLabel>
        <FadingLabel className="sb-badge">
          <span className="sb-chevron" data-open={open ? "true" : "false"}><IconChevronRight /></span>
        </FadingLabel>
      </button>
      <div id={contentId} className="sb-nested-body" data-open={shown ? "true" : "false"} aria-hidden={shown ? undefined : true}>
        <div><div className="sb-nested-list">{children}</div></div>
      </div>
    </div>
  );
});

/* ─── <SidebarFooter> ───────────────────────────────────────── */

export const SidebarFooter = React.forwardRef(function SidebarFooter({ className, children, ...props }, ref) {
  return <div ref={ref} data-slot="sidebar-footer" className={cn("sb-footer", className)} {...props}>{children}</div>;
});

/* ─── <SidebarToggle> ───────────────────────────────────────── */

export const SidebarToggle = React.forwardRef(function SidebarToggle(
  { className, children, collapsed: collapsedProp, onToggle, ...props },
  ref,
) {
  const ctx = React.useContext(SidebarContext);
  const usesContext = ctx?.variant === "collapsible";
  const collapsed = usesContext ? ctx.collapsed : collapsedProp;
  const toggle = usesContext ? ctx.toggleCollapsed : onToggle;
  if (collapsed === undefined || !toggle) return null;

  return (
    <button ref={ref} type="button" data-slot="sidebar-toggle" onClick={toggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}
      className={cn("sb-toggle", className)} {...props}>
      {typeof children === "function" ? children({ collapsed }) : children ?? (collapsed ? <IconExpand /> : <IconCollapse />)}
    </button>
  );
});
