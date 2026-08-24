import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import client from "../api/client";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { UserIcon, MapPinIcon, PhoneIcon, CheckIcon } from "../components/Icons.jsx";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90000;

const emptyShipping = {
  name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  country: "Kenya",
  postal_code: "",
  phone: "",
};

const inputClass =
  "peer w-full border border-mist rounded-sm pl-10 pr-4 py-3 text-sm bg-bone text-ink placeholder:text-ink/40 focus:border-amber transition-colors";
const iconClass = "w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 peer-focus:text-amber";
const plainInputClass =
  "border border-mist rounded-sm px-4 py-3 text-sm bg-bone text-ink placeholder:text-ink/40 focus:border-amber transition-colors";

export default function Checkout() {
  const { cart, refreshCart } = useCart();
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const hasSavedAddress = Boolean(user?.default_shipping?.address_line1);
  const [shipping, setShipping] = useState(() => {
    if (!hasSavedAddress) return emptyShipping;
    // user.default_shipping always has all 7 keys (null when unset) --
    // strip nulls so they don't clobber emptyShipping's defaults.
    const nonNull = Object.fromEntries(
      Object.entries(user.default_shipping).filter(([, v]) => v != null)
    );
    return { ...emptyShipping, ...nonNull };
  });
  const [saveAddress, setSaveAddress] = useState(!hasSavedAddress);
  const [step, setStep] = useState("form");
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);
  const pollTimer = useRef(null);
  const pollDeadline = useRef(null);

  useEffect(() => () => clearInterval(pollTimer.current), []);

  const handleChange = (field) => (e) => setShipping({ ...shipping, [field]: e.target.value });

  const total = cart.items.reduce((sum, item) => {
    const unit = item.product
      ? item.product.price_cents
      : (item.routine.steps.reduce((s, step) => s + step.product.price_cents, 0) *
          (100 - (item.routine.bundle_discount_percent || 0))) /
        100;
    return sum + unit * item.quantity;
  }, 0);

  const startPolling = (orderId) => {
    pollDeadline.current = Date.now() + POLL_TIMEOUT_MS;
    pollTimer.current = setInterval(async () => {
      if (Date.now() > pollDeadline.current) {
        clearInterval(pollTimer.current);
        setError("We didn't hear back in time. Check your phone -- if you already paid, your order will update shortly.");
        return;
      }
      const { data } = await client.get(`/payments/mpesa/status/${orderId}`);
      if (data.status === "paid") {
        clearInterval(pollTimer.current);
        setStep("paid");
        refreshCart();
      } else if (data.status === "payment_failed") {
        clearInterval(pollTimer.current);
        setStep("failed");
      }
    }, POLL_INTERVAL_MS);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setStep("creating_order");
    try {
      const { data: createdOrder } = await client.post("/orders/checkout", { shipping });
      setOrder(createdOrder);
      refreshCart(); // Clear the cart after creating the order

      if (saveAddress) {
        client
          .patch("/auth/me", {
            default_shipping_name: shipping.name,
            default_shipping_address_line1: shipping.address_line1,
            default_shipping_address_line2: shipping.address_line2,
            default_shipping_city: shipping.city,
            default_shipping_country: shipping.country,
            default_shipping_postal_code: shipping.postal_code,
            default_shipping_phone: shipping.phone,
          })
          .then(({ data }) => updateUser(data))
          .catch(() => {}); // Non-critical -- don't block checkout on this
      }

      const { data } = await client.post("/payments/mpesa/stk-push", {
        order_id: createdOrder.id,
        phone: shipping.phone,
      });
      setOrder(data.order);
      setStep("awaiting_pin");
      startPolling(createdOrder.id);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
      setStep("form");
    }
  };

  if (cart.items.length === 0 && step === "form") {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-ink/70">Your cart is empty.</p>
      </div>
    );
  }

  if (step === "paid") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mx-auto max-w-lg px-4 py-10 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
          className="w-14 h-14 rounded-full bg-sage flex items-center justify-center mx-auto mb-4"
        >
          <CheckIcon className="w-7 h-7 text-bone-light" />
        </motion.div>
        <h1 className="font-display text-2xl text-ink mb-2">Payment received</h1>
        <p className="text-ink/70">
          M-Pesa receipt: <span className="font-mono">{order?.mpesa_receipt_number}</span>
        </p>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/account")}
          className="mt-6 px-6 py-3 rounded-sm bg-amber text-bone-light font-semibold"
        >
          View order
        </motion.button>
      </motion.div>
    );
  }

  if (step === "awaiting_pin") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mx-auto max-w-lg px-4 py-10 text-center"
      >
        <h1 className="font-display text-2xl text-ink mb-2">Check your phone</h1>
        <p className="text-ink/70">
          We sent an M-Pesa prompt to <span className="font-mono">{shipping.phone}</span>. Enter your
          PIN to complete the payment of <span className="font-semibold">KES {(total / 100).toFixed(0)}</span>.
        </p>
        <div className="mt-6 flex justify-center">
          <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin" />
        </div>
        {error && <p className="text-sm text-clay mt-4">{error}</p>}
      </motion.div>
    );
  }

  if (step === "failed") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mx-auto max-w-lg px-4 py-10 text-center"
      >
        <h1 className="font-display text-2xl text-ink mb-2">Payment didn&apos;t go through</h1>
        <p className="text-ink/70">The M-Pesa transaction was cancelled or failed.</p>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setStep("form")}
          className="mt-6 px-6 py-3 rounded-sm bg-amber text-bone-light font-semibold"
        >
          Try again
        </motion.button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mx-auto max-w-lg px-4 py-6 pb-32 sm:pb-6"
    >
      <p className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-2">
        Almost there
      </p>
      <h1 className="font-display text-2xl sm:text-3xl text-ink mb-4">Checkout</h1>

      <div className="rounded-sm border border-mist bg-bone-light p-4 mb-6 flex justify-between text-sm">
        <span className="text-ink/70">Total ({cart.items.length} item{cart.items.length !== 1 ? "s" : ""})</span>
        <span className="font-semibold text-ink">KES {(total / 100).toFixed(0)}</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="relative block">
          <input required placeholder="Full name" value={shipping.name} onChange={handleChange("name")} className={inputClass} />
          <UserIcon className={iconClass} />
        </label>
        <label className="relative block">
          <input required placeholder="Address" value={shipping.address_line1} onChange={handleChange("address_line1")} className={inputClass} />
          <MapPinIcon className={iconClass} />
        </label>
        <label className="relative block">
          <input placeholder="Apartment, suite, etc. (optional)" value={shipping.address_line2} onChange={handleChange("address_line2")} className={inputClass} />
          <MapPinIcon className={iconClass} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <input required placeholder="City" value={shipping.city} onChange={handleChange("city")} className={plainInputClass} />
          <input required placeholder="Postal code" value={shipping.postal_code} onChange={handleChange("postal_code")} className={plainInputClass} />
        </div>
        <input required placeholder="Country" value={shipping.country} onChange={handleChange("country")} className={plainInputClass} />
        <label className="relative block">
          <input
            required
            type="tel"
            placeholder="M-Pesa phone number, e.g. 0712345678"
            value={shipping.phone}
            onChange={handleChange("phone")}
            className={inputClass}
          />
          <PhoneIcon className={iconClass} />
        </label>

        {user && (
          <label className="flex items-center gap-2 text-sm text-ink/70">
            <input
              type="checkbox"
              checked={saveAddress}
              onChange={(e) => setSaveAddress(e.target.checked)}
            />
            Save this address to my account
          </label>
        )}

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-sm text-clay"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={step === "creating_order"}
          className="mt-2 py-3 rounded-sm bg-amber text-bone-light font-semibold disabled:opacity-50"
        >
          {step === "creating_order" ? "Preparing order…" : `Pay with M-Pesa · KES ${(total / 100).toFixed(0)}`}
        </motion.button>
      </form>
    </motion.div>
  );
}
