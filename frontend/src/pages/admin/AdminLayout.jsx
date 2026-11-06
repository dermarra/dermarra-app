import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import Logo from "../../components/Logo.jsx";
import BrandStripe from "../../components/BrandStripe.jsx";
import {
  BoxIcon,
  DropletIcon,
  GridIcon,
  ImageIcon,
  LayersIcon,
  LogOutIcon,
  MenuIcon,
  ReceiptIcon,
  StepsIcon,
  StoreIcon,
  TagIcon,
  TargetIcon,
  UsersIcon,
  XIcon,
} from "../../components/Icons.jsx";

// Grouped like the reference dashboards: day-to-day work first.
const NAV = [
  { title: "Overview", items: [{ to: "dashboard", label: "Dashboard", Icon: GridIcon }] },
  {
    title: "Sales",
    items: [
      { to: "orders", label: "Orders", Icon: ReceiptIcon },
      { to: "coupons", label: "Coupons", Icon: TagIcon },
    ],
  },
  {
    title: "Catalogue",
    items: [
      { to: "products", label: "Products", Icon: BoxIcon },
      { to: "inventory", label: "Inventory", Icon: LayersIcon },
      { to: "routines", label: "Routines", Icon: StepsIcon },
    ],
  },
  {
    title: "Storefront",
    items: [
      { to: "hero-slides", label: "Hero slides", Icon: ImageIcon },
      { to: "concerns", label: "Concerns", Icon: TargetIcon },
      { to: "ingredients", label: "Ingredients", Icon: DropletIcon },
      { to: "step-groups", label: "Shop by Step", Icon: StepsIcon },
    ],
  },
  { title: "People", items: [{ to: "users", label: "Users", Icon: UsersIcon }] },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items);

/** Brand-black sidebar: white logo, white text, active item = solid brand
 * blue with brand-black text (white on blue is only 3.1:1). */
function SidebarContent({ onNavigate, onSignOut, user }) {
  return (
    <div className="flex flex-col h-full bg-ink text-white">
      <BrandStripe className="h-1.5" />
      <div className="px-5 py-5">
        <Link to="/admin/dashboard" onClick={onNavigate} aria-label="Admin dashboard">
          <Logo variant="light" className="h-6" />
        </Link>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-blue">Admin</p>
      </div>

      <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((group) => (
          <div key={group.title} className="mb-4">
            <p className="px-3 mb-1 text-[11px] font-bold uppercase tracking-widest text-white/50">{group.title}</p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map(({ to, label, Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                        isActive ? "bg-blue text-ink" : "text-white/80 hover:bg-white/10 hover:text-white"
                      }`
                    }
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3 flex flex-col gap-0.5">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
        >
          <StoreIcon className="w-[18px] h-[18px]" /> View store
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white text-left"
        >
          <LogOutIcon className="w-[18px] h-[18px]" /> Sign out
        </button>
        {user && (
          <div className="flex items-center gap-3 px-3 pt-3">
            <span className="w-8 h-8 rounded-full bg-lime text-ink text-sm font-bold flex items-center justify-center shrink-0">
              {(user.full_name || user.email || "?").trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold truncate">{user.full_name}</span>
              <span className="block text-xs text-white/60 truncate">{user.email}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const signOut = () => {
    logout();
    navigate("/", { replace: true });
  };

  const section = location.pathname.split("/")[2] || "dashboard";
  const current = ALL_ITEMS.find((i) => i.to === section);
  const title = current?.label || "Admin";

  return (
    <div className="min-h-screen bg-blue-50 lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-60 z-30">
        <SidebarContent user={user} onSignOut={signOut} />
      </aside>

      {/* Mobile drawer */}
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
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw]"
            >
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="absolute top-4 right-3 z-10 w-9 h-9 rounded-md text-white hover:bg-white/10 flex items-center justify-center"
              >
                <XIcon className="w-5 h-5" />
              </button>
              <SidebarContent user={user} onSignOut={signOut} onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white border-b border-mist">
        <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="lg:hidden w-10 h-10 -ml-1 rounded-md flex items-center justify-center text-ink hover:bg-blue-50"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
            <Logo iconOnly className="h-7 lg:hidden" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-700">Admin</p>
              <h1 className="text-lg font-bold text-ink leading-tight truncate">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="hidden sm:inline-flex items-center gap-2 rounded-full border border-mist px-4 py-2 text-sm font-semibold text-ink hover:border-blue hover:text-blue-700"
            >
              <StoreIcon className="w-4 h-4" /> View store
            </Link>
            {user && (
              <span
                title={user.email}
                className="w-9 h-9 rounded-full bg-lime text-ink text-sm font-bold flex items-center justify-center"
              >
                {(user.full_name || user.email || "?").trim().charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-6 lg:px-8 py-6 w-full">
        <Outlet />
      </div>
    </div>
  );
}
