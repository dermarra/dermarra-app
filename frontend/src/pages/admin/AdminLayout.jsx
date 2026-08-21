import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "dashboard", label: "Dashboard" },
  { to: "orders", label: "Orders" },
  { to: "products", label: "Products" },
  { to: "routines", label: "Routines" },
  { to: "users", label: "Users" },
];

export default function AdminLayout() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-display text-2xl mb-4">Admin</h1>

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
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
