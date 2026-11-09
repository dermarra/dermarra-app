import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { BagIcon, UserIcon } from "./Icons.jsx";
import Logo from "./Logo.jsx";

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

const TONES = { blue: "bg-blue", orange: "bg-orange", lime: "bg-lime", gold: "bg-gold" };

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

  // Landing-page sections carry data-nav="blue|orange|lime|gold"; the bar
  // takes the colour of whichever section is passing beneath it (white
  // everywhere else). Text on all four is ink (5.2-9.8:1, see CLAUDE.md).
  const [tone, setTone] = useState(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const bar = document.getElementById("site-navbar");
      const edge = bar ? bar.getBoundingClientRect().bottom : 80;
      let next = null;
      for (const el of document.querySelectorAll("[data-nav]")) {
        const r = el.getBoundingClientRect();
        if (r.top <= edge && r.bottom > edge) {
          next = el.dataset.nav;
          break;
        }
      }
      setTone(next);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    // Sections render after their data loads, so re-check as the page grows.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [location.pathname]);

  const coloured = Boolean(TONES[tone]);
  const linkTone = "text-ink hover:text-ink/70";

  return (
    <header
      id="site-navbar"
      className={`sticky top-0 z-30 border-b transition-colors duration-500 ${
        coloured ? `${TONES[tone]} border-transparent` : "bg-white border-mist"
      }`}
    >
      {/* Three zones, like The Ordinary: logo left, primary links centred
          with generous gaps, account/cart right. Regular-weight links --
          large but light, not bold. */}
      <div className="mx-auto w-full max-w-[1440px] h-16 sm:h-20 px-5 sm:px-8 lg:px-12 grid grid-cols-[auto_1fr_auto] items-center gap-6 lg:gap-10">
        <Link to="/" aria-label="Dermarra Skincare home" className="shrink-0">
          {/* 80px wide (owner, 2026-11-09). On a brand colour the multicolour
              icon would lose one petal, so it goes one-colour ink there. */}
          <Logo className={`w-20 h-auto transition-[filter] duration-500 ${coloured ? "brightness-0" : ""}`} />
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
          <CartLink className="text-ink" />
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
                className={`hidden md:inline ${coloured ? "text-ink" : "text-ink/70"} hover:text-ink transition-colors`}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              state={returnTo ? { from: returnTo } : undefined}
              className="btn btn-secondary btn-sm hidden md:inline-flex"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
