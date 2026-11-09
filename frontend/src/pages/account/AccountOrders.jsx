import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import client from "../../api/client";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90000;

export default function AccountOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  // orderId -> "sending" | "awaiting_pin" | error message
  const [paymentState, setPaymentState] = useState({});
  // orderId -> "cancelling" | error message
  const [cancelState, setCancelState] = useState({});
  const pollTimers = useRef({});

  useEffect(() => {
    client
      .get("/orders")
      .then(({ data }) => setOrders(data))
      .finally(() => setLoading(false));
  }, []);

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

      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "payment_pending" } : o)));
      pollStatus(order);
    } catch (err) {
      setPaymentState((s) => ({
        ...s,
        [order.id]: err.response?.data?.error || "Payment did not go through.",
      }));
    }
  };

  // Polls the status endpoint, which also asks Daraja directly -- so an
  // in-flight payment resolves even if Safaricom's callback never arrives.
  const pollStatus = (order) => {
    clearInterval(pollTimers.current[order.id]);
    setPaymentState((s) => ({ ...s, [order.id]: "awaiting_pin" }));
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    pollTimers.current[order.id] = setInterval(async () => {
      if (Date.now() > deadline) {
        clearInterval(pollTimers.current[order.id]);
        setPaymentState((s) => ({
          ...s,
          [order.id]: "Still waiting on M-Pesa. Check again in a minute.",
        }));
        return;
      }
      let data;
      try {
        ({ data } = await client.get(`/payments/mpesa/status/${order.id}`));
      } catch {
        return;
      }
      if (data.status !== "payment_pending") {
        stopPolling(order.id);
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id
              ? { ...o, status: data.status, payment_failure_reason: data.result_description }
              : o
          )
        );
        if (data.status === "payment_failed" && data.result_description) {
          setPaymentState((s) => ({ ...s, [order.id]: data.result_description }));
        }
      }
    }, POLL_INTERVAL_MS);
  };

  const cancelOrder = async (order) => {
    setCancelState((s) => ({ ...s, [order.id]: "cancelling" }));
    try {
      const { data } = await client.post(`/orders/${order.id}/cancel`);
      stopPolling(order.id);
      setCancelState((s) => {
        const next = { ...s };
        delete next[order.id];
        return next;
      });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? data : o)));
    } catch (err) {
      const message = err.response?.data?.error || "Couldn't cancel this order.";
      setCancelState((s) => ({ ...s, [order.id]: message }));
      if (err.response?.data?.order) {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? err.response.data.order : o))
        );
      }
    }
  };

  if (loading) return <p className="text-sm text-ink/60">Loading your orders…</p>;

  if (orders.length === 0) {
    return (
      <div className="border border-mist rounded-lg bg-bone-light p-6 text-center">
        <p className="text-sm text-ink/60">No orders yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => {
        const state = paymentState[order.id];
        const cancelling = cancelState[order.id];
        const inFlight = order.status === "payment_pending";
        const canRetry = ["pending", "payment_failed", "payment_pending"].includes(order.status);
        const canCancel = canRetry;

        return (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="border border-mist rounded-lg bg-bone-light p-4"
          >
            <Link to={`/account/orders/${order.id}`} className="flex justify-between items-start">
              <div>
                <p className="text-sm font-semibold text-ink font-mono">
                  #{order.id.slice(0, 8)}
                </p>
                <p className="text-sm text-ink/60 capitalize mt-0.5">
                  {order.status.replace("_", " ")} ·{" "}
                  {new Date(order.created_at).toLocaleDateString()}
                </p>
                {order.status === "payment_failed" && order.payment_failure_reason && (
                  <p className="text-sm text-orange-700 mt-0.5">{order.payment_failure_reason}</p>
                )}
              </div>
              <span className="text-sm font-semibold text-ink">
                KES {(order.total_cents / 100).toFixed(0)}
              </span>
            </Link>

            {canRetry && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {state === "sending" && (
                  <p className="text-sm text-ink/60">Sending M-Pesa prompt…</p>
                )}
                {state === "awaiting_pin" && (
                  <p className="text-sm text-lime-800">
                    Check your phone ({order.shipping.phone}) and enter your PIN…
                  </p>
                )}
                {state && state !== "sending" && state !== "awaiting_pin" && (
                  <p className="text-sm text-orange-700">
                    {state}{" "}
                    <button onClick={() => (inFlight ? pollStatus(order) : payNow(order))} className="underline">
                      {inFlight ? "Check again" : "Try again"}
                    </button>
                  </p>
                )}
                {!state && (
                  <button
                    onClick={() => (inFlight ? pollStatus(order) : payNow(order))}
                    className="btn btn-primary btn-sm"
                  >
                    {inFlight ? "Check payment status" : "Pay with M-Pesa"}
                  </button>
                )}

                {canCancel && state !== "sending" && state !== "awaiting_pin" && (
                  <button
                    onClick={() => cancelOrder(order)}
                    disabled={cancelling === "cancelling"}
                    className="btn btn-secondary btn-sm"
                  >
                    {cancelling === "cancelling" ? "Cancelling…" : "Cancel order"}
                  </button>
                )}
              </div>
            )}

            {cancelling && cancelling !== "cancelling" && (
              <p className="text-sm text-orange-700 mt-1">{cancelling}</p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
