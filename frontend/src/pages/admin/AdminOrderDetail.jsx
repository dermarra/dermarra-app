import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import client, { cloudinaryUrl } from "../../api/client";
import ImageUploadField from "../../components/ImageUploadField.jsx";

const NEXT_STEP = { paid: "processing", processing: "shipped", shipped: "delivered" };
const CANCELLABLE = new Set(["paid", "processing", "shipped"]);

export default function AdminOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [proofPublicId, setProofPublicId] = useState(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);

  const load = () => {
    setLoading(true);
    client
      .get(`/admin/orders/${orderId}`)
      .then(({ data }) => setOrder(data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [orderId]);

  const refreshPaymentStatus = async () => {
    setError(null);
    setBusy(true);
    try {
      const { data } = await client.post(`/admin/orders/${orderId}/refresh-payment-status`);
      setOrder(data);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't check payment status.");
    } finally {
      setBusy(false);
    }
  };

  const advance = async (nextStatus) => {
    setError(null);
    setBusy(true);
    try {
      const body = { status: nextStatus };
      if (nextStatus === "delivered") body.delivery_proof_public_id = proofPublicId;
      if (trackingNumber.trim()) body.tracking_number = trackingNumber.trim();
      const { data } = await client.post(`/admin/orders/${orderId}/advance`, body);
      setOrder(data);
      setProofPublicId(null);
      setTrackingNumber("");
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't advance this order.");
    } finally {
      setBusy(false);
    }
  };

  const sendInvoice = async () => {
    setError(null);
    setInvoiceSent(false);
    setSendingInvoice(true);
    try {
      await client.post(`/admin/orders/${orderId}/send-invoice`);
      setInvoiceSent(true);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't send the invoice.");
    } finally {
      setSendingInvoice(false);
    }
  };

  const cancelOrder = async () => {
    setError(null);
    setBusy(true);
    try {
      const { data } = await client.post(`/admin/orders/${orderId}/cancel`);
      setOrder(data);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't cancel this order.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-ink/60 text-sm">Loading order…</p>;
  if (!order) return <p className="text-ink/60 text-sm">Order not found.</p>;

  const nextStatus = NEXT_STEP[order.status];
  const proofUrl = cloudinaryUrl(order.delivery_proof_public_id, { width: 300 });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col gap-6 max-w-2xl"
    >
      <button onClick={() => navigate("/admin/orders")} className="text-xs text-ink/60 self-start">
        ← Back to orders
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-ink">Order {order.id.slice(0, 8)}</h2>
          <p className="text-xs text-ink/60">{order.user_email}</p>
        </div>
        <span className="text-xs font-mono uppercase border border-mist rounded-full px-3 py-1">
          {order.status}
        </span>
      </div>

      <section className="border border-mist rounded-sm p-4">
        <h3 className="text-sm font-semibold mb-3">Items</h3>
        <div className="flex flex-col gap-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.name} × {item.quantity}</span>
              <span>{order.currency} {(item.line_total_cents / 100).toFixed(0)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm font-semibold mt-3 pt-3 border-t border-mist">
          <span>Total</span>
          <span>{order.currency} {(order.total_cents / 100).toFixed(0)}</span>
        </div>
      </section>

      <section className="border border-mist rounded-sm p-4">
        <h3 className="text-sm font-semibold mb-3">Shipping</h3>
        <p className="text-sm text-ink/80">{order.shipping.name}</p>
        <p className="text-sm text-ink/80">{order.shipping.address_line1}</p>
        {order.shipping.address_line2 && <p className="text-sm text-ink/80">{order.shipping.address_line2}</p>}
        <p className="text-sm text-ink/80">{order.shipping.city}, {order.shipping.country}</p>
        <p className="text-sm text-ink/80">{order.shipping.phone}</p>
        {order.tracking_number && (
          <p className="text-sm text-ink/80 mt-2">
            Tracking number: <span className="font-mono">{order.tracking_number}</span>
          </p>
        )}
      </section>

      <section className="border border-mist rounded-sm p-4">
        <h3 className="text-sm font-semibold mb-3">Payment</h3>
        <p className="text-sm text-ink/80">Method: {order.payment_method || "—"}</p>
        <p className="text-sm text-ink/80">Receipt: {order.mpesa_receipt_number || "—"}</p>
        <p className="text-sm text-ink/80">Paid at: {order.paid_at ? new Date(order.paid_at).toLocaleString() : "—"}</p>

        {order.status === "payment_pending" && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={refreshPaymentStatus}
            disabled={busy}
            className="mt-3 px-4 py-2 rounded-sm border border-mist text-ink/70 text-sm disabled:opacity-50"
          >
            {busy ? "Checking…" : "Check live payment status"}
          </motion.button>
        )}

        <div className="mt-3 flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={sendInvoice}
            disabled={sendingInvoice}
            className="px-4 py-2 rounded-sm border border-mist text-ink/70 text-sm disabled:opacity-50"
          >
            {sendingInvoice ? "Sending…" : "Email invoice to customer"}
          </motion.button>
          {invoiceSent && <span className="text-xs text-sage-dark">Invoice sent.</span>}
        </div>
      </section>

      {proofUrl && (
        <section className="border border-mist rounded-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Proof of delivery</h3>
          <img src={proofUrl} alt="Proof of delivery" className="w-40 h-40 object-cover rounded-sm border border-mist" />
        </section>
      )}

      {error && <p className="text-sm text-clay">{error}</p>}

      {nextStatus && (
        <section className="border border-mist rounded-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Advance to {nextStatus}</h3>
          {nextStatus === "delivered" && (
            <div className="mb-3">
              <p className="text-xs text-ink/60 mb-2">A proof-of-delivery photo is required.</p>
              <ImageUploadField
                value={proofPublicId}
                onChange={setProofPublicId}
                folder="derma-skincare/delivery-proofs"
              />
            </div>
          )}
          {nextStatus === "shipped" && (
            <div className="mb-3">
              <p className="text-xs text-ink/60 mb-2">Tracking number (optional)</p>
              <input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. G4S-123456"
                className="border border-mist rounded-sm px-3 py-2 text-sm w-full sm:w-64"
              />
            </div>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => advance(nextStatus)}
            disabled={busy || (nextStatus === "delivered" && !proofPublicId)}
            className="px-4 py-2 rounded-sm bg-amber text-bone-light font-semibold text-sm disabled:opacity-50"
          >
            {busy ? "Saving…" : `Mark as ${nextStatus}`}
          </motion.button>
        </section>
      )}

      {CANCELLABLE.has(order.status) && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={cancelOrder}
          disabled={busy}
          className="self-start px-4 py-2 rounded-sm border border-mist text-clay text-sm disabled:opacity-50"
        >
          Cancel order
        </motion.button>
      )}
    </motion.div>
  );
}
