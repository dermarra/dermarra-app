import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../context/CartContext";
import { BagIcon, HomeIcon, QuizIcon, ShopIcon, UserIcon } from "./Icons.jsx";

const items = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/shop", label: "Shop", icon: "shop" },
  { to: "/quiz", label: "Quiz", icon: "quiz" },
  { to: "/cart", label: "Cart", icon: "cart" },
  { to: "/account", label: "Account", icon: "account" },
];

// Simple Line Icons (see Icons.jsx).
const icons = {
  home: HomeIcon,
  shop: ShopIcon,
  quiz: QuizIcon,
  cart: BagIcon,
  account: UserIcon,
};

export default function BottomNav() {
  const { itemCount } = useCart();

  return (
    <nav
      className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-bone-light border-t border-mist"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex justify-between px-2">
        {items.map(({ to, label, icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 py-2 text-[16px] leading-tight font-semibold ${
                  isActive ? "text-orange-700" : "text-ink/60"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <motion.span
                    className="inline-flex"
                    animate={{ scale: isActive ? 1.1 : 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  >
                    {(() => {
                      const NavIcon = icons[icon];
                      return <NavIcon className="w-5 h-5" />;
                    })()}
                  </motion.span>
                  {label}
                  {isActive && (
                    <motion.span
                      layoutId="bottomNavActive"
                      className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-orange"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  {to === "/cart" && (
                    <AnimatePresence>
                      {itemCount > 0 && (
                        <motion.span
                          key={itemCount}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 15 }}
                          className="absolute top-0 right-1/2 translate-x-3 -translate-y-1 bg-orange text-ink text-sm rounded-full w-4 h-4 flex items-center justify-center"
                        >
                          {itemCount}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
