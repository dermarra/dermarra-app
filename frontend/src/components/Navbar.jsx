import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { BagIcon, UserIcon } from "./Icons.jsx";

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
            className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-amber text-bone-light text-[10px] font-semibold flex items-center justify-center"
          >
            {itemCount}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-bone-light/95 backdrop-blur border-b border-mist">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link to="/" className="font-display text-lg tracking-tight text-ink">
          Dermarra<span className="text-amber">+</span>
        </Link>

        <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-ink/80">
          <Link to="/shop" className="hover:text-ink transition-colors">Shop</Link>
          <Link to="/quiz" className="hover:text-ink transition-colors">Find your routine</Link>
          <CartLink className="hover:text-ink transition-colors" />
          {user ? (
            <>
              {user.is_admin && (
                <Link to="/admin/orders" className="hover:text-ink transition-colors">Admin</Link>
              )}
              <Link to="/account" className="flex items-center gap-1.5 hover:text-ink transition-colors">
                <UserIcon className="w-4 h-4" />
                {user.full_name}
              </Link>
              <button onClick={logout} className="hover:text-ink transition-colors">Sign out</button>
            </>
          ) : (
            <Link to="/login" className="hover:text-ink transition-colors">Sign in</Link>
          )}
        </nav>

        <CartLink className="sm:hidden text-ink" />
      </div>
    </header>
  );
}
