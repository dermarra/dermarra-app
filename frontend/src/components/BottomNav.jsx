import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../context/CartContext";

const items = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/shop", label: "Shop", icon: "shop" },
  { to: "/quiz", label: "Quiz", icon: "quiz" },
  { to: "/cart", label: "Cart", icon: "cart" },
  { to: "/account", label: "Account", icon: "account" },
];

const icons = {
  home: (
    <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  ),
  shop: (
    <path d="M4 8h16l-1.2 11.2A2 2 0 0 1 17 21H7a2 2 0 0 1-2-1.8L4 8Zm3 0a3 3 0 0 1 6 0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  ),
  quiz: <path d="M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.7v.5M12 17h.01M4 4h16v16H4V4Z" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  cart: (
    <path d="M3 4h2l2.6 12.4A2 2 0 0 0 9.5 18H18a2 2 0 0 0 2-1.6L21 8H6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  ),
  account: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
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
                `relative flex flex-col items-center gap-1 py-2 text-[11px] font-medium ${
                  isActive ? "text-amber" : "text-ink/60"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <motion.svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    className="w-5 h-5"
                    animate={{ scale: isActive ? 1.1 : 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  >
                    {icons[icon]}
                  </motion.svg>
                  {label}
                  {isActive && (
                    <motion.span
                      layoutId="bottomNavActive"
                      className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-amber"
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
                          className="absolute top-0 right-1/2 translate-x-3 -translate-y-1 bg-amber text-bone-light text-[9px] rounded-full w-4 h-4 flex items-center justify-center"
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
