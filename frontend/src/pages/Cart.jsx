import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { cloudinaryUrl } from "../api/client";
import { MinusIcon, PlusIcon, TrashIcon, BagIcon } from "../components/Icons.jsx";

export default function Cart() {
  const { user } = useAuth();
  const { cart, updateItem, removeItem } = useCart();

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-ink/70">Sign in to view your cart.</p>
        <Link to="/login" className="inline-block mt-4 px-5 py-3 rounded-sm bg-amber text-bone-light font-semibold">
          Sign in
        </Link>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mx-auto max-w-2xl px-4 py-16 text-center"
      >
        <div className="w-14 h-14 rounded-full bg-mist/60 flex items-center justify-center mx-auto mb-4">
          <BagIcon className="w-6 h-6 text-ink/40" />
        </div>
        <p className="text-ink/70">Your cart is empty.</p>
        <Link to="/shop" className="inline-block mt-4 px-5 py-3 rounded-sm bg-amber text-bone-light font-semibold">
          Shop products
        </Link>
      </motion.div>
    );
  }

  const total = cart.items.reduce((sum, item) => {
    const unit = item.product
      ? item.product.price_cents
      : (item.routine.steps.reduce((s, step) => s + step.product.price_cents, 0) *
          (100 - (item.routine.bundle_discount_percent || 0))) /
        100;
    return sum + unit * item.quantity;
  }, 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-32 sm:pb-6">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="font-display text-2xl sm:text-3xl text-ink mb-4"
      >
        Your cart
      </motion.h1>

      <ul className="divide-y divide-mist">
        <AnimatePresence initial={false}>
          {cart.items.map((item) => {
            const image = item.product?.cloudinary_public_id || item.routine?.cloudinary_public_id;
            const imageUrl = cloudinaryUrl(image, { width: 160 });
            const name = item.product ? item.product.name : `${item.routine.name} (Full Routine)`;
            const priceCents = item.product
              ? item.product.price_cents
              : Math.round(
                  (item.routine.steps.reduce((s, step) => s + step.product.price_cents, 0) *
                    (100 - (item.routine.bundle_discount_percent || 0))) /
                    100
                );
            const undiscountedPriceCents = item.routine
              ? item.routine.steps.reduce((s, step) => s + step.product.price_cents, 0)
              : null;

            return (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex gap-3 py-4"
              >
                <div className="w-16 h-16 rounded-sm bg-mist overflow-hidden shrink-0">
                  {imageUrl && <img src={imageUrl} alt={name} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink">{name}</p>
                  <p className="text-sm text-ink/60">
                    {undiscountedPriceCents != null && undiscountedPriceCents !== priceCents && (
                      <span className="line-through mr-2 text-ink/40">
                        KES {(undiscountedPriceCents / 100).toFixed(0)}
                      </span>
                    )}
                    KES {(priceCents / 100).toFixed(0)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateItem(item.id, Math.max(1, item.quantity - 1))}
                      className="w-7 h-7 rounded-full border border-mist flex items-center justify-center text-ink/70 hover:border-amber hover:text-amber transition-colors"
                    >
                      <MinusIcon className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm w-5 text-center text-ink">{item.quantity}</span>
                    <button
                      onClick={() => updateItem(item.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-full border border-mist flex items-center justify-center text-ink/70 hover:border-amber hover:text-amber transition-colors"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      aria-label="Remove item"
                      className="ml-3 flex items-center gap-1 text-xs text-clay hover:text-amber-dark"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <div className="fixed sm:static bottom-16 inset-x-0 bg-bone-light border-t border-mist sm:border-0 p-4 sm:p-0 sm:mt-6 flex items-center justify-between">
        <span className="font-semibold text-ink">Total: KES {(total / 100).toFixed(0)}</span>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Link
            to="/checkout"
            className="block px-5 py-3 rounded-sm bg-amber text-bone-light font-semibold hover:bg-amber-dark transition-colors"
          >
            Checkout
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
