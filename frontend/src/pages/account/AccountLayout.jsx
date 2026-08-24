import { NavLink, Outlet, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";

const TABS = [
  { to: "profile", label: "Profile" },
  { to: "routines", label: "Routines" },
  { to: "wishlist", label: "Wishlist" },
  { to: "orders", label: "Orders" },
];

export default function AccountLayout() {
  const { user, loading } = useAuth();

  if (loading) return <p className="p-4 text-sm text-ink/60">Loading…</p>;

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-ink/70">Sign in to view your account.</p>
        <Link
          to="/login"
          className="inline-block mt-4 px-5 py-3 rounded-sm bg-amber text-bone-light font-semibold"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative overflow-hidden rounded-sm border border-mist bg-bone-light p-6 mb-6"
      >
        <motion.div
          aria-hidden="true"
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber/10 blur-2xl"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <p className="relative font-mono text-xs tracking-widest text-sage-dark uppercase mb-2">
          My account
        </p>
        <h1 className="relative font-display text-2xl text-ink">{user.full_name}</h1>
        <p className="relative text-sm text-ink/60 mt-1">{user.email}</p>
      </motion.div>

      <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 mb-2">
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
      </div>

      <Outlet />
    </div>
  );
}
