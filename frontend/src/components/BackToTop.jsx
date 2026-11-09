import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronUpIcon } from "./Icons.jsx";

/** "Back to top" (owner, 2026-11-10): a round button, bottom-right, that
 * appears once the shopper is a screen down the page and scrolls back up.
 * Storefront only (mounted beside ButterflyCursor in App.jsx). On phones it
 * sits above the bottom nav -- and above the product page's sticky
 * add-to-cart bar on /shop/:slug. */
export default function BackToTop() {
  const reduced = useReducedMotion();
  const { pathname } = useLocation();
  const [show, setShow] = useState(false);
  const productPage = /^\/shop\/[^/]+$/.test(pathname);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setShow(window.scrollY > window.innerHeight * 0.9);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          aria-label="Back to top"
          title="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })}
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.9 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          className={`fixed right-4 sm:right-6 z-30 w-12 h-12 rounded-full bg-white border border-ink text-ink shadow-md flex items-center justify-center transition-colors hover:bg-ink hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue sm:bottom-6 ${
            productPage
              ? "bottom-[calc(10.5rem+env(safe-area-inset-bottom))]"
              : "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
          }`}
        >
          <ChevronUpIcon className="w-4 h-4" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
