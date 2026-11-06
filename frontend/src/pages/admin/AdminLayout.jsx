import { NavLink, Outlet } from "react-router-dom";
import { motion } from "framer-motion";

// Day-to-day work first, storefront content next, people last.
const TABS = [
  { to: "dashboard", label: "Dashboard" },
  { to: "orders", label: "Orders" },
  { to: "products", label: "Products" },
  { to: "inventory", label: "Inventory" },
  { to: "routines", label: "Routines" },
  { to: "coupons", label: "Coupons" },
  { to: "hero-slides", label: "Hero slides" },
  { to: "concerns", label: "Concerns" },
  { to: "ingredients", label: "Ingredients" },
  { to: "step-groups", label: "Shop by Step" },
  { to: "users", label: "Users" },
];

export default function AdminLayout() {
  return (
    // Admin area gets its own brand-blue identity (the logo colour),
    // distinct from the storefront's amber CTA colour.
    <div className="min-h-[calc(100vh-4rem)] bg-brand-50/40">
      <div className="border-b border-brand-100 bg-gradient-to-r from-brand-900 via-brand-800 to-brand-700">
        <div className="mx-auto max-w-6xl px-4 pt-6 pb-0">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex items-end justify-between gap-4 mb-4"
          >
            <div>
              <p className="font-mono text-[11px] tracking-widest uppercase text-brand-100">Dermarra+ · Admin</p>
              <h1 className="font-display text-2xl sm:text-3xl text-white">Store management</h1>
            </div>
          </motion.div>

          <nav
            aria-label="Admin sections"
            className="flex gap-1 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]"
          >
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `shrink-0 px-4 py-2.5 rounded-t-md text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-white text-brand-800 shadow-sm"
                      : "text-brand-50 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <motion.span whileTap={{ scale: 0.94 }} className="inline-block">
                  {tab.label}
                </motion.span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </div>
    </div>
  );
}
