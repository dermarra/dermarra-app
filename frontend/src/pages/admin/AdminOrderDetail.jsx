import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import client, { cloudinaryUrl } from "../../api/client";
import ImageUploadField from "../../components/ImageUploadField.jsx";
import OrderTotals from "../../components/OrderTotals.jsx";
import Field from "../../components/admin/Field.jsx";
import { BackLink, Button, EmptyState, LoadingState, PageHeader, Panel, StatusBadge, inputClass } from "../../components/admin/Kit.jsx";
import { ORDER_STATUS } from "../../lib/orderStatus.js";
import { can } from "../../lib/permissions.js";
import { useAuth } from "../../context/AuthContext";
import { CheckIcon } from "../../components/Icons.jsx";

const NEXT_STEP = { paid: "processing", processing: "shipped", shipped: "delivered" };
const CANCELLABLE = new Set(["paid", "processing", "shipped"]);

export default function AdminOrderDetail() {
  const { user } = useAuth();
  const { orderId } = useParams();

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
      .catch(() => setOrder(null))
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
    if (!window.confirm(
      "Cancel this paid order? Stock is returned to inventory, but the M-Pesa refund must be done manually."
    )) return;
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

  if (loading) return <LoadingState>Loading order…</LoadingState>;
  if (!order) return <EmptyState>Order not found.</EmptyState>;

  const nextStatus = NEXT_STEP[order.status];
  const proofUrl = cloudinaryUrl(order.delivery_proof_public_id, { width: 300 });

  const mayFulfil = can(user, "orders.fulfil");
  const mayCancel = can(user, "orders.cancel");
  const status = ORDER_STATUS[order.status] || { label: order.status, tone: "neutral" };
  const PIPELINE = ["paid", "processing", "shipped", "delivered"];
  const stage = PIPELINE.indexOf(order.status);
  const placed = new Date(order.created_at).toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const money = (cents) => `${order.currency} ${Math.round(cents / 100).toLocaleString("en-KE")}`;
  const NEXT_LABEL = { processing: "Mark as processing", shipped: "Mark as shipped", delivered: "Mark as delivered" };
  const row = (label, value) => (
    <div className="flex justify-between gap-4 py-2.5 border-t border-mist first:border-t-0">
      <dt className="text-ink/70">{label}</dt>
      <dd className="text-right font-medium [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="flex flex-col gap-6">
      <div>
        <BackLink to="/admin/orders">Back to orders</BackLink>
        <PageHeader
          title={`Order #${order.id.slice(0, 8)}`}
          description={
            <span className="flex flex-wrap items-center gap-3">
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              <span>
                {order.user_email} · placed {placed}
              </span>
            </span>
          }
          actions={
            <>
              {mayFulfil && (
                <Button size="lg" onClick={sendInvoice} disabled={sendingInvoice}>
                  {sendingInvoice ? "Sending…" : invoiceSent ? <>Invoice sent <CheckIcon className="w-4 h-4" /></> : "Email invoice"}
                </Button>
              )}
              {mayCancel && CANCELLABLE.has(order.status) && (
                <Button variant="danger" size="lg" onClick={cancelOrder} disabled={busy}>
                  Cancel order
                </Button>
              )}
            </>
          }
        />
      </div>

      {order.stock_allocated === false && (
        <p className="px-5 py-4 rounded-lg bg-orange-50 border border-orange-200 text-orange-800">
          Paid, but no stock was deducted: the payment confirmed after its items sold out. Check you can fulfil it (or cancel and refund) before
          shipping.
        </p>
      )}
      {error && <p className="px-5 py-4 rounded-lg bg-orange-50 border border-orange-200 text-orange-800">{error}</p>}

      {stage >= 0 && (
        <Panel title={nextStatus ? "Next step" : "Delivered"} description={nextStatus ? undefined : "This order is complete."}>
          <ol className="grid grid-cols-4 gap-2 mb-6" aria-label="Order progress">
            {PIPELINE.map((st, i) => (
              <li key={st} className="flex flex-col gap-2">
                <span className={`h-2 rounded-full ${i <= stage ? "bg-blue" : "bg-mist"}`} />
                <span className={`text-xs font-semibold uppercase tracking-[0.08em] ${i <= stage ? "text-ink" : "text-ink/70"}`}>
                  {ORDER_STATUS[st].label}
                </span>
              </li>
            ))}
          </ol>
          {nextStatus && !mayFulfil && <p className="text-ink/70">Your role can see this order but not move it along.</p>}
          {nextStatus && mayFulfil && (
            <div className="flex flex-col gap-5 max-w-xl">
              {nextStatus === "shipped" && (
                <Field label="Tracking number (optional)" help="The courier's waybill code. It goes in the “your order has shipped” email.">
                  <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="e.g. G4S-123456" className={inputClass} />
                </Field>
              )}
              {nextStatus === "delivered" && (
                <Field label="Proof of delivery" help="A photo of the parcel at the door or in the customer's hands. Required.">
                  <ImageUploadField value={proofPublicId} onChange={setProofPublicId} folder="derma-skincare/delivery-proofs" removable hint="Any photo, straight from your phone" />
                </Field>
              )}
              <Button
                variant="primary"
                size="lg"
                className="self-start"
                onClick={() => advance(nextStatus)}
                disabled={busy || (nextStatus === "delivered" && !proofPublicId)}
              >
                {busy ? "Saving…" : NEXT_LABEL[nextStatus]}
              </Button>
            </div>
          )}
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
        <Panel title="Items">
          <ul className="flex flex-col">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-3 border-t border-mist first:border-t-0">
                <span>
                  <span className="font-medium">{item.name}</span> <span className="text-ink/70">× {item.quantity}</span>
                </span>
                <span className="font-semibold tabular-nums whitespace-nowrap">{money(item.line_total_cents)}</span>
              </li>
            ))}
          </ul>
          <OrderTotals order={order} />
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="Delivery">
            <address className="not-italic leading-relaxed">
              <span className="font-semibold">{order.shipping.name}</span>
              <br />
              {order.shipping.address_line1}
              {order.shipping.address_line2 && (
                <>
                  <br />
                  {order.shipping.address_line2}
                </>
              )}
              <br />
              {order.shipping.city}, {order.shipping.country}
              <br />
              {order.shipping.phone}
            </address>
            {order.tracking_number && <p className="mt-3 text-ink/70">Tracking: <span className="font-semibold text-ink">{order.tracking_number}</span></p>}
            {proofUrl && <img src={proofUrl} alt="Proof of delivery" className="mt-4 w-40 h-40 object-cover rounded-lg border border-mist" />}
          </Panel>

          <Panel title="Payment" actions={order.status === "payment_pending" && (mayFulfil || mayCancel) && (
            <Button onClick={refreshPaymentStatus} disabled={busy}>
              {busy ? "Checking…" : "Check with M-Pesa"}
            </Button>
          )}>
            <dl>
              {row("Method", order.payment_method === "mpesa" ? "M-Pesa" : order.payment_method || "None")}
              {row("Receipt", order.mpesa_receipt_number || "None yet")}
              {row("Paid", order.paid_at ? new Date(order.paid_at).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Not yet")}
            </dl>
            {order.status === "payment_failed" && order.payment_failure_reason && (
              <p className="mt-3 text-orange-700">Last attempt: {order.payment_failure_reason}</p>
            )}
          </Panel>
        </div>
      </div>
    </motion.div>
  );
}
