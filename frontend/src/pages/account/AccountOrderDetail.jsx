import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import client, { cloudinaryUrl } from "../../api/client";

export default function AccountOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    client
      .get(`/orders/${orderId}`)
      .then(({ data }) => setOrder(data))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return <p className="text-sm text-ink/60">Loading order…</p>;
  if (!order) return <p className="text-sm text-ink/60">Order not found.</p>;

  const proofUrl = cloudinaryUrl(order.delivery_proof_public_id, { width: 300 });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col gap-4"
    >
      <button onClick={() => navigate("/account/orders")} className="text-xs text-ink/60 self-start">
        ← Back to orders
      </button>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-ink">Order #{order.id.slice(0, 8)}</h2>
        <span className="text-xs font-mono uppercase border border-mist rounded-full px-3 py-1 text-ink/70">
          {order.status.replace("_", " ")}
        </span>
      </div>

      <section className="border border-mist rounded-sm bg-bone-light p-4">
        <h3 className="text-sm font-semibold text-ink mb-3">Items</h3>
        <div className="flex flex-col gap-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-ink">
                {item.name} × {item.quantity}
                {item.routine_id && (
                  <span className="ml-2 text-[10px] font-mono uppercase text-sage-dark align-middle">
                    Routine
                  </span>
                )}
              </span>
              <span className="text-ink/80">
                {order.currency} {(item.line_total_cents / 100).toFixed(0)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm font-semibold text-ink mt-3 pt-3 border-t border-mist">
          <span>Total</span>
          <span>
            {order.currency} {(order.total_cents / 100).toFixed(0)}
          </span>
        </div>
      </section>

      <section className="border border-mist rounded-sm bg-bone-light p-4">
        <h3 className="text-sm font-semibold text-ink mb-3">Shipping</h3>
        <p className="text-sm text-ink/80">{order.shipping.name}</p>
        <p className="text-sm text-ink/80">{order.shipping.address_line1}</p>
        {order.shipping.address_line2 && (
          <p className="text-sm text-ink/80">{order.shipping.address_line2}</p>
        )}
        <p className="text-sm text-ink/80">
          {order.shipping.city}, {order.shipping.country}
        </p>
        <p className="text-sm text-ink/80">{order.shipping.phone}</p>
        {order.tracking_number && (
          <p className="text-sm text-ink/80 mt-2">
            Tracking number: <span className="font-mono">{order.tracking_number}</span>
          </p>
        )}
      </section>

      <section className="border border-mist rounded-sm bg-bone-light p-4">
        <h3 className="text-sm font-semibold text-ink mb-3">Payment</h3>
        <p className="text-sm text-ink/80">Method: {order.payment_method || "—"}</p>
        <p className="text-sm text-ink/80">Receipt: {order.mpesa_receipt_number || "—"}</p>
        <p className="text-sm text-ink/80">
          Paid at: {order.paid_at ? new Date(order.paid_at).toLocaleString() : "—"}
        </p>
      </section>

      {proofUrl && (
        <section className="border border-mist rounded-sm bg-bone-light p-4">
          <h3 className="text-sm font-semibold text-ink mb-3">Proof of delivery</h3>
          <img
            src={proofUrl}
            alt="Proof of delivery"
            className="w-40 h-40 object-cover rounded-sm border border-mist"
          />
        </section>
      )}
    </motion.div>
  );
}
