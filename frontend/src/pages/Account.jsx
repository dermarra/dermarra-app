import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90000;

export default function Account() {
  const { user, logout, loading } = useAuth();
  const [orders, setOrders] = useState([]);
  // orderId -> "sending" | "awaiting_pin" | "error"
  const [paymentState, setPaymentState] = useState({});
  // orderId -> "cancelling" | error message string
  const [cancelState, setCancelState] = useState({});
  const pollTimers = useRef({});

  useEffect(() => {
    if (user) client.get("/orders").then(({ data }) => setOrders(data));
  }, [user]);

  useEffect(() => {
    const timers = pollTimers.current;
    return () => Object.values(timers).forEach(clearInterval);
  }, []);

  const stopPolling = (orderId) => {
    clearInterval(pollTimers.current[orderId]);
    setPaymentState((s) => {
      const next = { ...s };
      delete next[orderId];
      return next;
    });
  };

  const payNow = async (order) => {
    setPaymentState((s) => ({ ...s, [order.id]: "sending" }));
    try {
      await client.post("/payments/mpesa/stk-push", {
        order_id: order.id,
        phone: order.shipping.phone,
      });
      setPaymentState((s) => ({ ...s, [order.id]: "awaiting_pin" }));

      const deadline = Date.now() + POLL_TIMEOUT_MS;
      pollTimers.current[order.id] = setInterval(async () => {
        if (Date.now() > deadline) {
          clearInterval(pollTimers.current[order.id]);
          setPaymentState((s) => ({ ...s, [order.id]: "error" }));
          return;
        }
        const { data } = await client.get(`/payments/mpesa/status/${order.id}`);
        if (data.status === "paid" || data.status === "payment_failed") {
          stopPolling(order.id);
          setOrders((prev) =>
            prev.map((o) => (o.id === order.id ? { ...o, status: data.status } : o))
          );
        }
      }, POLL_INTERVAL_MS);
    } catch {
      setPaymentState((s) => ({ ...s, [order.id]: "error" }));
    }
  };

  const cancelOrder = async (order) => {
    setCancelState((s) => ({ ...s, [order.id]: "cancelling" }));
    try {
      const { data } = await client.post(`/orders/${order.id}/cancel`);
      // Cancelled successfully -- stop any in-flight payment polling for it.
      stopPolling(order.id);
      setCancelState((s) => {
        const next = { ...s };
        delete next[order.id];
        return next;
      });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? data : o)));
    } catch (err) {
      // The backend may refuse this (e.g. "already paid", "still awaiting PIN")
      // -- show exactly why rather than a generic failure.
      const message = err.response?.data?.error || "Couldn't cancel this order.";
      setCancelState((s) => ({ ...s, [order.id]: message }));
      // If the backend flipped it to "paid" underneath us, reflect that.
      if (err.response?.data?.order) {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? err.response.data.order : o))
        );
      }
    }
  };

  if (loading) return <p className="p-4 text-sm text-ink/60">Loading…</p>;

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-ink/70">Sign in to view your account.</p>
        <Link to="/login" className="inline-block mt-4 px-5 py-3 rounded-sm bg-amber text-bone-light font-semibold">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-display text-2xl mb-1">{user.full_name}</h1>
      <p className="text-sm text-ink/60 mb-6">{user.email}</p>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/70 mb-3">
        Order history
      </h2>
      {orders.length === 0 ? (
        <p className="text-sm text-ink/60">No orders yet.</p>
      ) : (
        <ul className="divide-y divide-mist">
          {orders.map((order) => {
            const state = paymentState[order.id];
            const cancelling = cancelState[order.id];
            const canRetry = ["pending", "payment_failed", "payment_pending"].includes(order.status);
            const canCancel = ["pending", "payment_failed", "payment_pending"].includes(order.status);

            return (
              <li key={order.id} className="py-3 text-sm">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                    <p className="text-ink/60 capitalize">{order.status.replace("_", " ")}</p>
                  </div>
                  <span className="font-semibold">KES {(order.total_cents / 100).toFixed(0)}</span>
                </div>

                {canRetry && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {state === "sending" && (
                      <p className="text-xs text-ink/60">Sending M-Pesa prompt…</p>
                    )}
                    {state === "awaiting_pin" && (
                      <p className="text-xs text-sage-dark">
                        Check your phone ({order.shipping.phone}) and enter your PIN…
                      </p>
                    )}
                    {state === "error" && (
                      <p className="text-xs text-clay">
                        Payment didn&apos;t go through.{" "}
                        <button onClick={() => payNow(order)} className="underline">
                          Try again
                        </button>
                      </p>
                    )}
                    {!state && (
                      <button
                        onClick={() => payNow(order)}
                        className="text-xs px-3 py-1.5 rounded-full bg-amber text-bone-light font-semibold"
                      >
                        Pay with M-Pesa
                      </button>
                    )}

                    {canCancel && !state && (
                      <button
                        onClick={() => cancelOrder(order)}
                        disabled={cancelling === "cancelling"}
                        className="text-xs px-3 py-1.5 rounded-full border border-mist text-ink/70 disabled:opacity-50"
                      >
                        {cancelling === "cancelling" ? "Cancelling…" : "Cancel order"}
                      </button>
                    )}
                  </div>
                )}

                {cancelling && cancelling !== "cancelling" && (
                  <p className="text-xs text-clay mt-1">{cancelling}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <button onClick={logout} className="mt-8 text-sm text-clay underline">
        Sign out
      </button>
    </div>
  );
}