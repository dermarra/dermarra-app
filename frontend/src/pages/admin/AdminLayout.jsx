import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import client from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import Logo from "../../components/Logo.jsx";
import { can, PAGE_PERMS } from "../../lib/permissions.js";
import {
  BookIcon,
  BoxIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CompassIcon,
  DirectionsIcon,
  DropletIcon,
  GridIcon,
  ImageIcon,
  LayersIcon,
  LockIcon,
  LogOutIcon,
  MenuIcon,
  ReceiptIcon,
  SearchIcon,
  StepsIcon,
  StoreIcon,
  TagIcon,
  TargetIcon,
  UsersIcon,
  XIcon,
} from "../../components/Icons.jsx";

/** Admin navigation, modelled on the owner's reference sidebar: logo, a
 * search box that filters the menu, section headings, icon rows with live
 * count badges, a group that opens and closes (chevron), the active page in
 * brand blue with an accent bar on the left edge, and a footer. Collapsed,
 * it becomes an icon strip with dividers between sections and a white name
 * tooltip on hover/focus. Brand: ink background; section headings wear their
 * brand colour (5.2-9.8:1 on ink); links white (16:1); active blue (5.3:1);
 * badges orange with ink text (white on orange fails contrast). */
const NAV = [
  { key: "overview", title: "Overview", color: "text-white/70", items: [{ to: "dashboard", label: "Dashboard", Icon: GridIcon }] },
  {
    key: "sales",
    title: "Sales",
    color: "text-orange",
    items: [
      { to: "orders", label: "Orders", Icon: ReceiptIcon, badge: "orders" },
      { to: "coupons", label: "Coupons", Icon: TagIcon },
    ],
  },
  {
    key: "catalogue",
    title: "Catalogue",
    color: "text-lime",
    items: [
      { to: "products", label: "Products", Icon: BoxIcon },
      { to: "inventory", label: "Inventory", Icon: LayersIcon, badge: "stock" },
      { to: "routines", label: "Routines", Icon: StepsIcon },
    ],
  },
  {
    key: "storefront",
    title: "Storefront",
    color: "text-blue",
    items: [
      { to: "hero-slides", label: "Hero slides", Icon: ImageIcon },
      { to: "blog", label: "Blog", Icon: BookIcon },
      {
        key: "browse",
        label: "Browse by",
        Icon: CompassIcon,
        children: [
          { to: "concerns", label: "Concerns", Icon: TargetIcon },
          { to: "ingredients", label: "Ingredients", Icon: DropletIcon },
          { to: "step-groups", label: "Shop by Step", Icon: DirectionsIcon },
        ],
      },
    ],
  },
  {
    key: "people",
    title: "People",
    color: "text-gold",
    items: [
      { to: "users", label: "Users", Icon: UsersIcon },
      { to: "roles", label: "Roles & access", Icon: LockIcon },
      { to: "activity", label: "Activity", Icon: ClockIcon },
    ],
  },
];

const leavesOf = (items) => items.flatMap((i) => (i.children ? i.children : [i]));
const ALL_ITEMS = NAV.flatMap((s) => leavesOf(s.items));

const COLLAPSE_KEY = "dermarra.admin.sidebarCollapsed";
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};

const initial = (user) => (user.full_name || user.email || "?").trim().charAt(0).toUpperCase();

function Badge({ count, small = false }) {
  if (!count) return null;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-orange text-ink font-bold tabular-nums leading-none ${
        small ? "absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 text-[0.75rem]" : "ml-auto min-w-[1.75rem] h-6 px-2 text-xs"
      }`}
      aria-label={`${count} need attention`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Only the pages this admin's role opens (sections with none are dropped). */
const navFor = (user) =>
  NAV.map((s) => ({
    ...s,
    items: s.items
      .map((i) => (i.children ? { ...i, children: i.children.filter((c) => can(user, ...(PAGE_PERMS[c.to] || []))) } : i))
      .filter((i) => (i.children ? i.children.length : can(user, ...(PAGE_PERMS[i.to] || [])))),
  })).filter((s) => s.items.length);

function AdminSidebar({ collapsed, counts, user, onSignOut, onNavigate, onExpand, inDrawer = false, focusSignal = 0 }) {
  const NAV = useMemo(() => navFor(user), [user]);
  const location = useLocation();
  const navigate = useNavigate();
  const section = location.pathname.split("/")[2] || "dashboard";
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const [tip, setTip] = useState(null); // { label, top } -- collapsed tooltips
  const searchRef = useRef(null);

  // A group holding the current page is always open.
  const activeGroup = NAV.flatMap((s) => s.items).find((i) => i.children?.some((c) => c.to === section))?.key;
  const isOpen = (key) => key === activeGroup || openGroups.has(key) || !!query;
  const toggleGroup = (key) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  useEffect(() => {
    if (focusSignal && !collapsed) searchRef.current?.focus();
  }, [focusSignal, collapsed]);

  const q = query.trim().toLowerCase();
  const sections = useMemo(() => {
    if (!q) return NAV;
    return NAV.map((s) => ({
      ...s,
      items: s.items
        .map((i) =>
          i.children
            ? { ...i, children: i.children.filter((c) => c.label.toLowerCase().includes(q) || i.label.toLowerCase().includes(q)) }
            : i
        )
        .filter((i) => (i.children ? i.children.length : i.label.toLowerCase().includes(q) || s.title.toLowerCase().includes(q))),
    })).filter((s) => s.items.length);
  }, [q, NAV]);
  const firstMatch = sections.flatMap((s) => leavesOf(s.items))[0];

  const go = () => {
    setQuery("");
    onNavigate?.();
  };

  const showTip = (label) => (e) => {
    if (!collapsed) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2 });
  };
  const hideTip = () => setTip(null);
  const tipProps = (label) => ({ onMouseEnter: showTip(label), onMouseLeave: hideTip, onFocus: showTip(label), onBlur: hideTip });

  const rowBase = "relative flex items-center gap-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue";
  const leafClass = (isActive) =>
    `${rowBase} h-11 px-6 text-base ${isActive ? "text-blue font-semibold" : "text-white font-medium hover:bg-white/5"}`;
  const accent = <span aria-hidden="true" className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-blue" />;

  // ---------------------------------------------------------------- collapsed
  if (collapsed) {
    return (
      <div className="flex flex-col h-full w-20 bg-ink text-white">
        <Link to="/admin/dashboard" aria-label="Admin dashboard" className="flex justify-center pt-6 pb-5">
          <Logo variant="light" iconOnly className="h-9" />
        </Link>
        <div className="flex justify-center pb-3">
          <button
            type="button"
            onClick={() => onExpand?.(true)}
            aria-label="Search the menu"
            {...tipProps("Search  /")}
            className="w-12 h-12 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue"
          >
            <SearchIcon className="w-5 h-5" />
          </button>
        </div>
        <nav aria-label="Admin pages" onScroll={hideTip} className="flex-1 overflow-y-auto overflow-x-hidden pb-4">
          {NAV.map((s, si) => (
            <div key={s.key}>
              {si > 0 && <div aria-hidden="true" className="mx-5 my-3 border-t border-white/10" />}
              <p className="sr-only">{s.title}</p>
              <ul className="flex flex-col items-center gap-1">
                {leavesOf(s.items).map((item) => (
                  <li key={item.to} className="relative w-full flex justify-center">
                    <NavLink
                      to={item.to}
                      onClick={hideTip}
                      {...tipProps(item.label + (item.badge && counts[item.badge] ? ` · ${counts[item.badge]}` : ""))}
                      className={({ isActive }) =>
                        `relative w-12 h-12 rounded-lg flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue ${
                          isActive ? "bg-white/10 text-blue" : "text-white/80 hover:text-white hover:bg-white/10"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.Icon className="w-5 h-5" />
                          <span className="sr-only">{item.label}</span>
                          {item.badge && <Badge count={counts[item.badge]} small />}
                          {isActive && <span aria-hidden="true" className="absolute -left-4 top-2 bottom-2 w-1 rounded-r bg-blue" />}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="flex flex-col items-center gap-3 py-4 border-t border-white/10">
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            {...tipProps("Sign out")}
            className="w-12 h-12 rounded-lg text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center"
          >
            <LogOutIcon className="w-5 h-5" />
          </button>
          {user && (
            <span
              tabIndex={0}
              {...tipProps(user.full_name || user.email)}
              className="w-10 h-10 rounded-full bg-lime text-ink font-bold flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue"
            >
              {initial(user)}
            </span>
          )}
        </div>
        {tip && (
          <div
            aria-hidden="true"
            style={{ top: tip.top }}
            className="fixed z-50 left-[5.75rem] -translate-y-1/2 px-3 py-2 rounded-lg bg-white text-ink text-sm font-semibold shadow-lg ring-1 ring-mist whitespace-nowrap pointer-events-none"
          >
            {tip.label}
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------- expanded
  return (
    <div className="flex flex-col h-full w-72 bg-ink text-white">
      <div className="px-6 pt-7 pb-5">
        <Link to="/admin/dashboard" onClick={go} aria-label="Admin dashboard" className="inline-block">
          <Logo variant="light" className="h-9" />
        </Link>
      </div>

      <div className="px-4 pb-2">
        <label className="relative block">
          <span className="sr-only">Search the menu</span>
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && firstMatch) {
                e.preventDefault();
                navigate(`/admin/${firstMatch.to}`);
                go();
              } else if (e.key === "Escape") {
                setQuery("");
                e.currentTarget.blur();
              }
            }}
            placeholder="Search pages…"
            className="w-full h-12 rounded-lg bg-white/10 pl-11 pr-11 text-base text-white placeholder:text-white/60 outline-none focus:bg-white/15 focus:ring-2 focus:ring-blue"
          />
          {!query && (
            <kbd aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-white/10 text-xs font-semibold text-white/70">
              /
            </kbd>
          )}
        </label>
      </div>

      <nav aria-label="Admin pages" className="flex-1 overflow-y-auto pb-4">
        {sections.length === 0 && <p className="px-6 pt-5 text-white/70">No page called “{query}”.</p>}
        {sections.map((s, si) => (
          <div key={s.key} className={si > 0 ? "mt-3 mx-0 pt-3 border-t border-white/10" : "pt-3"}>
            <p className={`px-6 pt-2 pb-2 text-xs font-bold uppercase tracking-[0.14em] ${s.color}`}>{s.title}</p>
            <ul>
              {s.items.map((item) =>
                item.children ? (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.key)}
                      aria-expanded={isOpen(item.key)}
                      className={`${rowBase} w-full h-11 px-6 text-base text-left ${
                        item.key === activeGroup ? "text-white font-semibold" : "text-white font-medium hover:bg-white/5"
                      }`}
                    >
                      <item.Icon className="w-5 h-5 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      <ChevronRightIcon className={`w-3.5 h-3.5 transition-transform ${isOpen(item.key) ? "rotate-90" : ""}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen(item.key) && (
                        <motion.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          {item.children.map((child) => (
                            <li key={child.to}>
                              <NavLink to={child.to} onClick={go} className={({ isActive }) => `${leafClass(isActive)} !pl-14 !h-10`}>
                                {({ isActive }) => (
                                  <>
                                    {isActive && accent}
                                    {child.label}
                                  </>
                                )}
                              </NavLink>
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </li>
                ) : (
                  <li key={item.to}>
                    <NavLink to={item.to} onClick={go} className={({ isActive }) => leafClass(isActive)}>
                      {({ isActive }) => (
                        <>
                          {isActive && accent}
                          <item.Icon className="w-5 h-5 shrink-0" />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && <Badge count={counts[item.badge]} />}
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              )}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-4 pt-3 pb-5 border-t border-white/10 flex flex-col gap-1">
        {inDrawer && (
          <Link to="/" onClick={go} className={`${rowBase} h-11 px-2 rounded-lg text-base font-medium text-white hover:bg-white/5`}>
            <StoreIcon className="w-5 h-5" /> View store
          </Link>
        )}
        <button type="button" onClick={onSignOut} className={`${rowBase} h-11 px-2 rounded-lg text-base font-medium text-white hover:bg-white/5 text-left`}>
          <LogOutIcon className="w-5 h-5" /> Sign out
        </button>
        {user && (
          <div className="flex items-center gap-3 px-2 pt-3">
            <span className="w-10 h-10 rounded-full bg-lime text-ink font-bold flex items-center justify-center shrink-0">{initial(user)}</span>
            <span className="min-w-0">
              <span className="block text-base font-semibold truncate">{user.full_name}</span>
              <span className="block text-sm text-white/70 truncate">{user.admin_role?.name || user.email}</span>
            </span>
          </div>
        )}
        <p className="px-2 pt-4 text-xs text-white/70">© {new Date().getFullYear()} Dermarra Skincare</p>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [counts, setCounts] = useState({});
  const [focusSignal, setFocusSignal] = useState(0);

  const setCollapsedSaved = (value) => {
    setCollapsed(value);
    try {
      localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
    } catch {
      // private mode etc. -- the toggle still works for this visit
    }
  };
  const expandAndSearch = () => {
    setCollapsedSaved(false);
    setFocusSignal((n) => n + 1);
  };

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  // Live badge counts (orders waiting, sizes low or out), refreshed each minute.
  const canSeeCounts = can(user, "dashboard.view");
  useEffect(() => {
    if (!canSeeCounts) return undefined;
    let alive = true;
    const load = () =>
      client
        .get("/admin/dashboard", { params: { range: "today" } })
        .then(({ data }) => {
          if (!alive) return;
          const t = data.todo || {};
          setCounts({
            orders: (t.to_process || 0) + (t.to_ship || 0),
            stock: (t.low_stock_sizes || 0) + (t.out_of_stock_sizes || 0),
          });
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [canSeeCounts]);

  // "/" jumps to the menu search (unless typing somewhere already).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      e.preventDefault();
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setCollapsed(false);
        try {
          localStorage.setItem(COLLAPSE_KEY, "0");
        } catch {
          // ignore
        }
      } else {
        setDrawerOpen(true);
      }
      setFocusSignal((n) => n + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const signOut = () => {
    logout();
    navigate("/", { replace: true });
  };

  const section = location.pathname.split("/")[2] || "dashboard";
  const current = ALL_ITEMS.find((i) => i.to === section);
  const title = current?.label || "Admin";
  const today = new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className={`min-h-screen bg-blue-50 transition-[padding] duration-200 ${collapsed ? "lg:pl-20" : "lg:pl-72"}`}>
      {/* Desktop sidebar */}
      <aside className={`hidden lg:block fixed inset-y-0 left-0 z-30 transition-[width] duration-200 ${collapsed ? "w-20" : "w-72"}`}>
        <AdminSidebar
          collapsed={collapsed}
          counts={counts}
          user={user}
          onSignOut={signOut}
          onExpand={expandAndSearch}
          focusSignal={focusSignal}
        />
      </aside>

      {/* Phones/tablets: the expanded sidebar in a drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40 bg-ink/50"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.22 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 max-w-[88vw]"
            >
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="absolute top-6 right-3 z-10 w-10 h-10 rounded-lg text-white hover:bg-white/10 flex items-center justify-center"
              >
                <XIcon className="w-5 h-5" />
              </button>
              <AdminSidebar
                collapsed={false}
                counts={counts}
                user={user}
                onSignOut={signOut}
                onNavigate={() => setDrawerOpen(false)}
                inDrawer
                focusSignal={focusSignal}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white border-b border-mist">
        <div className="h-20 lg:h-[100px] px-5 sm:px-8 lg:px-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="lg:hidden w-10 h-10 -ml-1 rounded-lg flex items-center justify-center text-ink hover:bg-blue-50"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setCollapsedSaved(!collapsed)}
              aria-label={collapsed ? "Expand menu" : "Collapse menu to icons"}
              aria-expanded={!collapsed}
              title={collapsed ? "Expand menu" : "Collapse menu"}
              className="hidden lg:flex w-10 h-10 -ml-2 rounded-lg items-center justify-center text-ink hover:bg-blue-50"
            >
              {collapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
            </button>
            <Logo iconOnly className="h-7 lg:hidden" />
            {/* The page itself shows its heading (with its actions), so the
                bar doesn't repeat it -- just today's date. */}
            <p className="hidden sm:block text-base text-ink/70 truncate">{today}</p>
            <h1 className="sr-only">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-2 h-11 rounded-lg border border-lime px-4 text-[15px] font-semibold text-ink hover:bg-lime"
            >
              <StoreIcon className="w-4 h-4" /> View store
            </Link>
            {user && (
              <span title={user.email} className="w-10 h-10 rounded-full bg-lime text-ink text-sm font-bold flex items-center justify-center">
                {initial(user)}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="px-5 sm:px-8 lg:px-12 py-8 lg:py-12 w-full">
        <Outlet />
      </div>
    </div>
  );
}
