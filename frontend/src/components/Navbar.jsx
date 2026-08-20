import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();

  return (
    <header className="sticky top-0 z-30 bg-bone-light/95 backdrop-blur border-b border-mist">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link to="/" className="font-display text-lg tracking-tight text-ink">
          Derma<span className="text-amber">.</span>
        </Link>

        <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-ink/80">
          <Link to="/shop" className="hover:text-ink">Shop</Link>
          <Link to="/quiz" className="hover:text-ink">Find your routine</Link>
          <Link to="/cart" className="hover:text-ink">Cart ({itemCount})</Link>
          {user ? (
            <>
              {user.is_admin && (
                <Link to="/admin/orders" className="hover:text-ink">Admin</Link>
              )}
              <Link to="/account" className="hover:text-ink">{user.full_name}</Link>
              <button onClick={logout} className="hover:text-ink">Sign out</button>
            </>
          ) : (
            <Link to="/login" className="hover:text-ink">Sign in</Link>
          )}
        </nav>

        <Link to="/cart" className="sm:hidden text-sm font-mono">
          Cart ({itemCount})
        </Link>
      </div>
    </header>
  );
}
