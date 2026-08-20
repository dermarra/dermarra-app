import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useCart } from "../context/CartContext";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90000;

export default function Checkout() {
  const { cart, refreshCart } = useCart();
  const navigate = useNavigate();

  const [shipping, setShipping] = useState({
    name: "",
    address_line1: "",
    address_line2: "",
    city: "",
    country: "Kenya",
    postal_code: "",
    phone: "",
  });
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
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <h1 className="font-display text-2xl mb-2">Payment received</h1>
        <p className="text-ink/70">
          M-Pesa receipt: <span className="font-mono">{order?.mpesa_receipt_number}</span>
        </p>
        <button
          onClick={() => navigate("/account")}
          className="mt-6 px-6 py-3 rounded-sm bg-amber text-bone-light font-semibold"
        >
          View order
        </button>
      </div>
    );
  }

  if (step === "awaiting_pin") {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <h1 className="font-display text-2xl mb-2">Check your phone</h1>
        <p className="text-ink/70">
          We sent an M-Pesa prompt to <span className="font-mono">{shipping.phone}</span>. Enter your
          PIN to complete the payment of <span className="font-semibold">KES {(total / 100).toFixed(0)}</span>.
        </p>
        <div className="mt-6 flex justify-center">
          <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin" />
        </div>
        {error && <p className="text-sm text-clay mt-4">{error}</p>}
      </div>
    );
  }

  if (step === "failed") {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <h1 className="font-display text-2xl mb-2">Payment didn&apos;t go through</h1>
        <p className="text-ink/70">The M-Pesa transaction was cancelled or failed.</p>
        <button
          onClick={() => setStep("form")}
          className="mt-6 px-6 py-3 rounded-sm bg-amber text-bone-light font-semibold"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-32 sm:pb-6">
      <h1 className="font-display text-2xl mb-4">Checkout</h1>

      <div className="rounded-sm border border-mist bg-bone-light p-4 mb-6 flex justify-between text-sm">
        <span className="text-ink/70">Total ({cart.items.length} item{cart.items.length !== 1 ? "s" : ""})</span>
        <span className="font-semibold">KES {(total / 100).toFixed(0)}</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input required placeholder="Full name" value={shipping.name} onChange={handleChange("name")} className="border border-mist rounded-sm px-4 py-3 text-sm" />
        <input required placeholder="Address" value={shipping.address_line1} onChange={handleChange("address_line1")} className="border border-mist rounded-sm px-4 py-3 text-sm" />
        <input placeholder="Apartment, suite, etc. (optional)" value={shipping.address_line2} onChange={handleChange("address_line2")} className="border border-mist rounded-sm px-4 py-3 text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <input required placeholder="City" value={shipping.city} onChange={handleChange("city")} className="border border-mist rounded-sm px-4 py-3 text-sm" />
          <input required placeholder="Postal code" value={shipping.postal_code} onChange={handleChange("postal_code")} className="border border-mist rounded-sm px-4 py-3 text-sm" />
        </div>
        <input required placeholder="Country" value={shipping.country} onChange={handleChange("country")} className="border border-mist rounded-sm px-4 py-3 text-sm" />
        <input
          required
          type="tel"
          placeholder="M-Pesa phone number, e.g. 0712345678"
          value={shipping.phone}
          onChange={handleChange("phone")}
          className="border border-mist rounded-sm px-4 py-3 text-sm"
        />

        {error && <p className="text-sm text-clay">{error}</p>}

        <button
          type="submit"
          disabled={step === "creating_order"}
          className="mt-2 py-3 rounded-sm bg-amber text-bone-light font-semibold disabled:opacity-50"
        >
          {step === "creating_order" ? "Preparing order…" : `Pay with M-Pesa · KES ${(total / 100).toFixed(0)}`}
        </button>
      </form>
    </div>
  );
}
