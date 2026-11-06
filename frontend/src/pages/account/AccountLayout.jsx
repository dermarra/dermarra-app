import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";

const TABS = [
  { to: "profile", label: "Profile" },
  { to: "routines", label: "Routines" },
  { to: "wishlist", label: "Wishlist" },
  { to: "orders", label: "Orders" },
];

export default function AccountLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) return <p className="p-4 text-sm text-ink/60">Loading…</p>;

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-14 sm:pt-20 pb-12 text-center">
        <p className="text-ink/70">Sign in to view your account.</p>
        <Link
          to="/login"
          className="inline-block mt-4 px-5 py-3 rounded-full bg-orange text-ink font-semibold"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 sm:pt-16 pb-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl bg-blue text-ink p-6 mb-6"
      >
        <p className="relative text-xs font-semibold tracking-widest uppercase mb-2">My account</p>
        <h1 className="relative text-3xl font-semibold">{user.full_name}</h1>
        <p className="relative text-sm mt-1">{user.email}</p>
        {/* The only sign-out on mobile -- BottomNav has no account menu. */}
        <button
          onClick={() => {
            logout();
            navigate("/", { replace: true });
          }}
          className="relative mt-4 px-4 py-2 rounded-full bg-ink text-white text-xs font-semibold hover:bg-ink-soft"
        >
          Sign out
        </button>
      </motion.div>

      <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 mb-2">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `shrink-0 px-5 py-2 rounded-full text-[16px] font-semibold border transition-colors ${
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
