import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { BagIcon, UserIcon } from "./Icons.jsx";
import Logo from "./Logo.jsx";
import BrandStripe from "./BrandStripe.jsx";

function CartLink({ className }) {
  const { itemCount } = useCart();
  return (
    <Link to="/cart" className={`relative inline-flex items-center ${className}`}>
      <BagIcon className="w-5 h-5" />
      <AnimatePresence>
        {itemCount > 0 && (
          <motion.span
            key={itemCount}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-orange text-ink text-[10px] font-semibold flex items-center justify-center"
          >
            {itemCount}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

const AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Leave whatever signed-in page you were on (checkout, account, admin) --
  // it used to stay put showing that page's stale signed-in state.
  const signOut = () => {
    logout();
    navigate("/", { replace: true });
  };
  // Signing in from any page returns you to that page (it always went to
  // /account before). Auth pages themselves are never a return target.
  const returnTo = AUTH_PATHS.includes(location.pathname)
    ? location.state?.from
    : `${location.pathname}${location.search}`;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-mist">
      <BrandStripe className="h-1" />
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link to="/" aria-label="Dermarra Skincare home" className="shrink-0">
          <Logo className="h-6 sm:h-7" />
        </Link>

        <nav className="hidden sm:flex items-center gap-6 text-sm font-semibold text-ink">
          <Link to="/shop" className="hover:text-blue-700 transition-colors">Shop</Link>
          <Link to="/quiz" className="hover:text-blue-700 transition-colors">Find your routine</Link>
          <CartLink className="hover:text-blue-700 transition-colors" />
          {user ? (
            <>
              {user.is_admin && (
                <Link to="/admin/dashboard" className="hover:text-blue-700 transition-colors">Admin</Link>
              )}
              <Link to="/account" className="flex items-center gap-1.5 hover:text-blue-700 transition-colors">
                <UserIcon className="w-4 h-4" />
                {user.full_name}
              </Link>
              <button onClick={signOut} className="text-ink/70 hover:text-ink transition-colors">Sign out</button>
            </>
          ) : (
            <Link
              to="/login"
              state={returnTo ? { from: returnTo } : undefined}
              className="px-4 py-2 rounded-full bg-blue text-ink hover:bg-blue-400 transition-colors"
            >
              Sign in
            </Link>
          )}
        </nav>

        <CartLink className="sm:hidden text-ink" />
      </div>
    </header>
  );
}
