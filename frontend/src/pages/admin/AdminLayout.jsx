import { NavLink, Outlet } from "react-router-dom";
import { motion } from "framer-motion";

const TABS = [
  { to: "dashboard", label: "Dashboard" },
  { to: "hero-slides", label: "Hero slides" },
  { to: "orders", label: "Orders" },
  { to: "products", label: "Products" },
  { to: "inventory", label: "Inventory" },
  { to: "routines", label: "Routines" },
  { to: "concerns", label: "Concerns" },
  { to: "ingredients", label: "Ingredients" },
  { to: "step-groups", label: "Shop by Step" },
  { to: "users", label: "Users" },
];

export default function AdminLayout() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="font-display text-2xl text-ink mb-4"
      >
        Admin
      </motion.h1>

      <nav className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-mist mb-6">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${
                isActive ? "bg-ink text-bone-light border-ink" : "border-mist text-ink/70"
              }`
            }
          >
            <motion.span whileTap={{ scale: 0.94 }} className="inline-block">
              {tab.label}
            </motion.span>
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
