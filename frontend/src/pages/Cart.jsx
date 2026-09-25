import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { cloudinaryUrl } from "../api/client";
import { MinusIcon, PlusIcon, TrashIcon, BagIcon } from "../components/Icons.jsx";
import { cartItemUnitPriceCents, cartItemUndiscountedCents, cartSubtotalCents, cartDiscountCents } from "../lib/cartTotals.js";

export default function Cart() {
  const { user } = useAuth();
  const { cart, updateItem, removeItem, applyCoupon, removeCoupon } = useCart();
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);

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

  const subtotal = cartSubtotalCents(cart.items);
  const discount = cartDiscountCents(cart, subtotal);
  const total = subtotal - discount;

  const handleApplyCoupon = async (event) => {
    event.preventDefault();
    setCouponError(null);
    setCouponLoading(true);
    try {
      await applyCoupon(couponCode);
      setCouponCode("");
    } catch (err) {
      setCouponError(err.response?.data?.error || "We couldn't apply that code.");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = async () => {
    setCouponError(null);
    setCouponLoading(true);
    try {
      await removeCoupon();
    } catch (err) {
      setCouponError(err.response?.data?.error || "We couldn't remove that code.");
    } finally {
      setCouponLoading(false);
    }
  };

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
            const name = item.product
              ? `${item.product.name}${item.variant ? ` — ${item.variant.label}` : ""}`
              : `${item.routine.name} (Full Routine)`;
            const priceCents = cartItemUnitPriceCents(item);
            const undiscountedPriceCents = cartItemUndiscountedCents(item);

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

      <div className="mt-6 border-t border-mist pt-4">
        <div className="flex gap-2">
          <form onSubmit={handleApplyCoupon} className="flex flex-1 gap-2">
            <input
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
              placeholder="Coupon code"
              aria-label="Coupon code"
              className="min-w-0 flex-1 border border-mist rounded-sm px-3 py-2 text-sm bg-bone text-ink uppercase focus:border-amber"
              disabled={couponLoading || Boolean(cart.coupon)}
            />
            <button
              type="submit"
              disabled={couponLoading || !couponCode.trim() || Boolean(cart.coupon)}
              className="px-3 py-2 rounded-sm border border-ink text-sm font-semibold text-ink disabled:opacity-40"
            >
              Apply
            </button>
          </form>
          {cart.coupon && (
            <button onClick={handleRemoveCoupon} disabled={couponLoading} className="text-sm text-clay underline disabled:opacity-40">
              Remove
            </button>
          )}
        </div>
        {couponError && <p className="text-sm text-clay mt-2">{couponError}</p>}
        {cart.coupon && <p className="text-sm text-sage-dark mt-2">{cart.coupon.code} applied</p>}
        <div className="mt-4 flex flex-col gap-1 text-sm text-ink/70">
          <div className="flex justify-between"><span>Subtotal</span><span>KES {(subtotal / 100).toFixed(0)}</span></div>
          {discount > 0 && <div className="flex justify-between text-sage-dark"><span>Discount</span><span>- KES {(discount / 100).toFixed(0)}</span></div>}
        </div>
        <div className="mt-3 flex items-center justify-between">
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
    </div>
  );
}
