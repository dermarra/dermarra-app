import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { cloudinaryUrl } from "../api/client";

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
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-ink/70">Your cart is empty.</p>
        <Link to="/shop" className="inline-block mt-4 px-5 py-3 rounded-sm bg-amber text-bone-light font-semibold">
          Shop products
        </Link>
      </div>
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
      <h1 className="font-display text-2xl mb-4">Your cart</h1>

      <ul className="divide-y divide-mist">
        {cart.items.map((item) => {
          const image = item.product?.cloudinary_public_id || item.routine?.cloudinary_public_id;
          const imageUrl = cloudinaryUrl(image, { width: 160 });
          const name = item.product ? item.product.name : `${item.routine.name} (Full Routine)`;
          const priceCents = item.product
            ? item.product.price_cents
            : Math.round(
              (item.routine.steps.reduce((s, step) => s + step.product.price_cents, 0) *
            (100 - (item.routine.bundle_discount_percent || 0))) /100
            );
          const undiscountedPriceCents = item.routine
          ? item.routine.steps.reduce((s, step) => s + step.product.price_cents, 0)
          : null;

          return (
            <li key={item.id} className="flex gap-3 py-4">
              <div className="w-16 h-16 rounded-sm bg-mist overflow-hidden shrink-0">
                {imageUrl && <img src={imageUrl} alt={name} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{name}</p>
                <p className="text-sm text-ink/60">
                {undiscountedPriceCents != null && undiscountedPriceCents !== priceCents && (
                  <span className="line-through mr-2 text-ink/40">
                    KES {(undiscountedPriceCents / 100).toFixed(0)}
                  </span>
                )}
                KES {(priceCents / 100).toFixed(0)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => updateItem(item.id, Math.max(1, item.quantity - 1))}
                    className="w-7 h-7 rounded-full border border-mist text-sm"
                  >
                    −
                  </button>
                  <span className="text-sm w-5 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateItem(item.id, item.quantity + 1)}
                    className="w-7 h-7 rounded-full border border-mist text-sm"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="ml-3 text-xs text-clay underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="fixed sm:static bottom-16 inset-x-0 bg-bone-light border-t border-mist sm:border-0 p-4 sm:p-0 sm:mt-6 flex items-center justify-between">
        <span className="font-semibold">Total: KES {(total / 100).toFixed(0)}</span>
        <Link
          to="/checkout"
          className="px-5 py-3 rounded-sm bg-amber text-bone-light font-semibold hover:bg-amber-dark transition-colors"
        >
          Checkout
        </Link>
      </div>
    </div>
  );
}
