import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../../api/client";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "payment_pending", label: "Awaiting payment" },
  { value: "paid", label: "Paid" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "payment_failed", label: "Payment failed" },
];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    client
      .get("/admin/orders", { params: status ? { status } : {} })
      .then(({ data }) => setOrders(data))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div>
      <h2 className="font-display text-xl mb-4">Orders</h2>

      <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatus(filter.value)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${
              status === filter.value ? "bg-ink text-bone-light border-ink" : "border-mist text-ink/70"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-ink/60 text-sm">Loading orders…</p>
      ) : orders.length === 0 ? (
        <p className="text-ink/60 text-sm">No orders for this filter.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/admin/orders/${order.id}`}
              className="flex items-center justify-between border border-mist rounded-sm px-4 py-3 hover:border-ink/40"
            >
              <div>
                <p className="text-sm font-semibold text-ink font-mono">{order.id.slice(0, 8)}</p>
                <p className="text-xs text-ink/60">
                  {order.user_email} · {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm text-ink">
                  {order.currency} {(order.total_cents / 100).toFixed(0)}
                </p>
                <p className="text-xs font-mono uppercase text-ink/60">{order.status}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
