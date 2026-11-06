import { useEffect, useState } from "react";
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
      <BagIcon className="w-6 h-6 lg:w-7 lg:h-7" />
      <AnimatePresence>
        {itemCount > 0 && (
          <motion.span
            key={itemCount}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="absolute -top-2 -right-2.5 min-w-[20px] h-5 px-1 rounded-full bg-orange text-ink text-xs font-semibold flex items-center justify-center"
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

  // When a full-bleed hero (HeroCarousel, #site-hero) is on the page, the
  // bar floats transparently over it with the white logo, then turns solid
  // white once the hero has scrolled out from under it.
  const [hasHero, setHasHero] = useState(false);
  const [overHero, setOverHero] = useState(false);
  useEffect(() => {
    const update = () => {
      const hero = document.getElementById("site-hero");
      setHasHero(Boolean(hero));
      setOverHero(Boolean(hero) && hero.getBoundingClientRect().bottom > 96);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("hero:change", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("hero:change", update);
    };
  }, [location.pathname]);

  const linkTone = overHero ? "text-white hover:text-blue" : "text-ink hover:text-blue-700";

  return (
    <header
      className={`${hasHero ? "fixed inset-x-0" : "sticky"} top-0 z-30 border-b transition-colors duration-300 ${
        overHero ? "bg-transparent border-transparent" : "bg-white border-mist shadow-sm"
      }`}
    >
      <BrandStripe className="h-1.5" />
      {/* Three zones, like The Ordinary: logo left, primary links centred
          with generous gaps, account/cart right. Regular-weight links --
          large but light, not bold. */}
      <div
        className={`mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 grid grid-cols-[auto_1fr_auto] items-center gap-6 lg:gap-10 transition-[height] duration-300 ${
          overHero ? "h-24 sm:h-32" : "h-20 sm:h-24"
        }`}
      >
        <Link to="/" aria-label="Dermarra Skincare home" className="shrink-0">
          <Logo
            variant={overHero ? "light" : "dark"}
            className={`transition-[height] duration-300 ${overHero ? "h-11 sm:h-14 lg:h-16" : "h-9 sm:h-11 lg:h-12"}`}
          />
        </Link>

        <nav aria-label="Main" className="hidden md:flex items-center justify-center gap-8 lg:gap-12 xl:gap-14 text-lg font-medium">
          <Link to="/shop" className={`${linkTone} transition-colors`}>Shop</Link>
          <Link to="/quiz" className={`${linkTone} transition-colors`}>Find your routine</Link>
          <Link to="/blog" className={`${linkTone} transition-colors`}>Blog</Link>
          {user?.is_admin && (
            <Link to="/admin/dashboard" className={`${linkTone} transition-colors`}>Admin</Link>
          )}
        </nav>

        <div className="flex items-center justify-end gap-5 lg:gap-7 text-lg font-medium">
          <CartLink className={`${overHero ? "text-white" : "text-ink"} transition-colors`} />
          {user ? (
            <>
              <Link
                to="/account"
                aria-label="My account"
                title={user.full_name}
                className={`hidden md:inline-flex items-center gap-2 ${linkTone} transition-colors`}
              >
                <UserIcon className="w-6 h-6" />
                <span className="hidden xl:inline">{user.full_name.split(" ")[0]}</span>
              </Link>
              <button
                onClick={signOut}
                className={`hidden md:inline ${overHero ? "text-white/85 hover:text-white" : "text-ink/70 hover:text-ink"} transition-colors`}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              state={returnTo ? { from: returnTo } : undefined}
              className={`hidden md:inline-flex px-6 py-2.5 rounded-full border-2 transition-colors ${
                overHero
                  ? "border-white text-white hover:bg-white hover:text-ink"
                  : "border-ink text-ink hover:bg-ink hover:text-white"
              }`}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
