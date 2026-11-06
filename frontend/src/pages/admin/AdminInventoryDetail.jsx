import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import client from "../../api/client";
import Field from "../../components/admin/Field.jsx";

const STATUS_LABELS = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
};

const ADJUSTMENT_TYPES = [
  { value: "DAMAGE", label: "Damage" },
  { value: "EXPIRY", label: "Expiry write-off" },
  { value: "LOSS", label: "Loss / shrinkage" },
  { value: "SAMPLE", label: "Given as a sample" },
  { value: "PROMOTION", label: "Given away (promotion)" },
  { value: "INTERNAL_USE", label: "Internal use" },
  { value: "ADJUSTMENT", label: "Other correction (e.g. stocktake)" },
];

const emptyReceiveForm = {
  batch_number: "",
  quantity_produced: "",
  unit_cost_kes: "",
  expiry_date: "",
  produced_at: "",
  notes: "",
};

const emptyAdjustForm = { batch_id: "", type: "DAMAGE", quantity: "", reason: "" };

function formatKES(cents) {
  if (cents == null) return "—";
  return `KES ${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function AdminInventoryDetail() {
  const { variantId } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [receiveForm, setReceiveForm] = useState(emptyReceiveForm);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveBusy, setReceiveBusy] = useState(false);
  const [receiveError, setReceiveError] = useState(null);

  const [adjustForm, setAdjustForm] = useState(emptyAdjustForm);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [adjustError, setAdjustError] = useState(null);

  const load = () => {
    setLoading(true);
    client
      .get(`/admin/inventory/${variantId}`)
      .then(({ data }) => setDetail(data))
      .catch((err) => setError(err.response?.data?.error || "Couldn't load this variant's inventory."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [variantId]);

  const submitReceive = async (e) => {
    e.preventDefault();
    setReceiveError(null);
    setReceiveBusy(true);
    try {
      await client.post(`/admin/inventory/${variantId}/receive`, {
        batch_number: receiveForm.batch_number,
        quantity_produced: Number(receiveForm.quantity_produced),
        unit_cost_cents: receiveForm.unit_cost_kes ? Math.round(Number(receiveForm.unit_cost_kes) * 100) : null,
        expiry_date: receiveForm.expiry_date || null,
        produced_at: receiveForm.produced_at ? new Date(receiveForm.produced_at).toISOString() : null,
        notes: receiveForm.notes || null,
      });
      setReceiveForm(emptyReceiveForm);
      setReceiveOpen(false);
      load();
    } catch (err) {
      setReceiveError(err.response?.data?.error || "Couldn't log this production run.");
    } finally {
      setReceiveBusy(false);
    }
  };

  const confirmAdjust = async () => {
    setAdjustError(null);
    setAdjustBusy(true);
    try {
      await client.post(`/admin/inventory/${variantId}/adjust`, {
        batch_id: adjustForm.batch_id,
        type: adjustForm.type,
        quantity: Number(adjustForm.quantity),
        reason: adjustForm.reason,
      });
      setAdjustForm(emptyAdjustForm);
      setAdjustOpen(false);
      setReviewing(false);
      load();
    } catch (err) {
      setAdjustError(err.response?.data?.error || "Couldn't apply this adjustment.");
    } finally {
      setAdjustBusy(false);
    }
  };

  if (loading) return <p className="text-ink/60 text-sm">Loading…</p>;
  if (error) return <p className="text-sm text-clay">{error}</p>;
  if (!detail) return null;

  const { variant, batches, transactions } = detail;
  // A stocktake correction ("ADJUSTMENT") can add units back to a batch
  // that's already depleted, so those are offered too; write-off types
  // only make sense against a batch that still has stock.
  const activeBatches = batches.filter((b) =>
    adjustForm.type === "ADJUSTMENT"
      ? b.status === "active" || b.status === "depleted"
      : b.status === "active" && b.quantity_remaining > 0
  );
  const selectedBatch = batches.find((b) => b.id === adjustForm.batch_id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col gap-6 max-w-3xl"
    >
      <button onClick={() => navigate("/admin/inventory")} className="text-xs text-ink/60 self-start">
        ← Back to inventory
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-ink">
            {variant.product_name} — {variant.label}
          </h2>
          <p className="text-xs text-ink/60 font-mono">
            on hand {variant.on_hand} · reserved {variant.reserved} · available {variant.available} · reorder at{" "}
            {variant.reorder_level}
          </p>
        </div>
        <span className="text-xs font-mono uppercase border border-mist rounded-full px-3 py-1">
          {STATUS_LABELS[variant.stock_status]}
        </span>
      </div>

      <section className="border border-mist rounded-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Batches</h3>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setReceiveOpen((v) => !v)}
            className="px-3 py-1.5 rounded-sm bg-brand-700 text-bone-light font-semibold text-xs"
          >
            {receiveOpen ? "Cancel" : "+ Log production run"}
          </motion.button>
        </div>

        <AnimatePresence>
          {receiveOpen && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onSubmit={submitReceive}
              className="flex flex-col gap-3 border border-mist rounded-sm p-4 mb-4 overflow-hidden"
            >
              <p className="text-[11px] text-ink/55">
                Log each finished production run as its own batch. Stock is sold oldest-expiry first, so expiry dates
                matter.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Batch number" help="Your lot/batch code printed on the packaging, e.g. AAS-2611-01. Must be unique for this size.">
                  <input
                    required
                    placeholder="e.g. AAS-2611-01"
                    value={receiveForm.batch_number}
                    onChange={(e) => setReceiveForm({ ...receiveForm, batch_number: e.target.value })}
                    className="border border-mist rounded-sm px-3 py-2 text-sm font-mono font-normal text-ink"
                  />
                </Field>
                <Field label="Quantity produced" help="How many sellable units of this size the run made (whole number). Added to stock on hand.">
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 50"
                    value={receiveForm.quantity_produced}
                    onChange={(e) => setReceiveForm({ ...receiveForm, quantity_produced: e.target.value })}
                    className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
                  />
                </Field>
                <Field label="Unit production cost (KES)" help="Optional. Your internal cost per unit (ingredients + packaging + labour). Never shown to customers.">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 850"
                    value={receiveForm.unit_cost_kes}
                    onChange={(e) => setReceiveForm({ ...receiveForm, unit_cost_kes: e.target.value })}
                    className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
                  />
                </Field>
                <Field label="Expiry date" help="The best-before date on this batch. Leave blank only if the product doesn't expire.">
                  <input
                    type="date"
                    value={receiveForm.expiry_date}
                    onChange={(e) => setReceiveForm({ ...receiveForm, expiry_date: e.target.value })}
                    className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
                  />
                </Field>
                <Field label="Production date" help="When the run was made. Leave blank to use today.">
                  <input
                    type="date"
                    value={receiveForm.produced_at}
                    onChange={(e) => setReceiveForm({ ...receiveForm, produced_at: e.target.value })}
                    className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
                  />
                </Field>
              </div>
              <Field label="Notes" help="Optional, e.g. which formula version or who made it.">
                <textarea
                  placeholder="e.g. Formula v2, made by Jane"
                  value={receiveForm.notes}
                  onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                  className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
                  rows={2}
                />
              </Field>
              {receiveError && <p className="text-sm text-clay">{receiveError}</p>}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={receiveBusy}
                className="self-start px-4 py-2 rounded-sm bg-brand-700 text-bone-light font-semibold text-sm disabled:opacity-50"
              >
                {receiveBusy ? "Saving…" : "Log production run"}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>

        {batches.length === 0 ? (
          <p className="text-xs text-ink/60">No batches yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-ink/50 uppercase tracking-wide">
                  <th className="py-1.5 pr-3">Batch</th>
                  <th className="py-1.5 pr-3">Remaining / produced</th>
                  <th className="py-1.5 pr-3">Unit cost</th>
                  <th className="py-1.5 pr-3">Expiry</th>
                  <th className="py-1.5 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-t border-mist">
                    <td className="py-1.5 pr-3 font-mono">{b.batch_number}</td>
                    <td className="py-1.5 pr-3">{b.quantity_remaining} / {b.quantity_produced}</td>
                    <td className="py-1.5 pr-3">{formatKES(b.unit_cost_cents)}</td>
                    <td className="py-1.5 pr-3">{b.expiry_date || "Non-expiring"}</td>
                    <td className="py-1.5 pr-3 uppercase">{b.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border border-mist rounded-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Adjust stock</h3>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              setAdjustOpen((v) => !v);
              setReviewing(false);
            }}
            disabled={!batches.some((b) => b.status === "active" || b.status === "depleted")}
            className="px-3 py-1.5 rounded-sm border border-mist text-ink/70 text-xs disabled:opacity-50"
          >
            {adjustOpen ? "Cancel" : "+ Manual adjustment"}
          </motion.button>
        </div>

        <AnimatePresence>
          {adjustOpen && !reviewing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex flex-col gap-3 border border-mist rounded-sm p-4 overflow-hidden"
            >
              <p className="text-[11px] text-ink/55">
                For stock that leaves (or turns up) outside of normal sales -- damaged, expired, given away, or a count
                correction. Every adjustment is permanently logged with its reason.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Batch" help="The batch the units came from (check the batch number on the packaging).">
                  <select
                    value={adjustForm.batch_id}
                    onChange={(e) => setAdjustForm({ ...adjustForm, batch_id: e.target.value })}
                    className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
                  >
                    <option value="">Select a batch…</option>
                    {activeBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batch_number} ({b.quantity_remaining} remaining)
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="What happened" help="Pick the closest reason. 'Other correction' is for stocktake differences.">
                  <select
                    value={adjustForm.type}
                    onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
                    className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
                  >
                    {ADJUSTMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Quantity"
                  help={
                    adjustForm.type === "ADJUSTMENT"
                      ? "Signed whole number: negative removes units (e.g. -3), positive adds units found in a count (e.g. 5)."
                      : "How many units to remove (whole number, e.g. 2). Units reserved for unpaid orders can't be removed."
                  }
                >
                  <input
                    type="number"
                    step="1"
                    placeholder={adjustForm.type === "ADJUSTMENT" ? "e.g. -3 or 5" : "e.g. 2"}
                    value={adjustForm.quantity}
                    onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                    className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
                  />
                </Field>
              </div>
              <Field label="Reason (required)" help="Explain what happened so the stock history makes sense later, e.g. '2 bottles cracked in transit'.">
                <textarea
                  required
                  placeholder="e.g. 2 bottles cracked in transit"
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
                  rows={2}
                />
              </Field>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                disabled={!adjustForm.batch_id || !adjustForm.quantity || !adjustForm.reason}
                onClick={() => setReviewing(true)}
                className="self-start px-4 py-2 rounded-sm border border-ink/30 text-ink text-sm disabled:opacity-50"
              >
                Review adjustment
              </motion.button>
            </motion.div>
          )}

          {adjustOpen && reviewing && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-3 border border-amber/60 bg-amber-light/10 rounded-sm p-4"
            >
              <h4 className="text-sm font-semibold text-ink">Confirm this adjustment</h4>
              <p className="text-sm text-ink/80">
                {ADJUSTMENT_TYPES.find((t) => t.value === adjustForm.type)?.label} of{" "}
                <span className="font-mono">{adjustForm.quantity}</span> unit(s) on batch{" "}
                <span className="font-mono">{selectedBatch?.batch_number}</span>.
              </p>
              <p className="text-xs text-ink/60">Reason: {adjustForm.reason}</p>
              {adjustError && <p className="text-sm text-clay">{adjustError}</p>}
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={confirmAdjust}
                  disabled={adjustBusy}
                  className="px-4 py-2 rounded-sm bg-clay text-bone-light font-semibold text-sm disabled:opacity-50"
                >
                  {adjustBusy ? "Applying…" : "Confirm and apply"}
                </motion.button>
                <button
                  type="button"
                  onClick={() => setReviewing(false)}
                  className="px-4 py-2 rounded-sm border border-mist text-ink/70 text-sm"
                >
                  Back
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section className="border border-mist rounded-sm p-4">
        <h3 className="text-sm font-semibold mb-3">Transaction history</h3>
        {transactions.length === 0 ? (
          <p className="text-xs text-ink/60">No stock movements yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-ink/50 uppercase tracking-wide">
                  <th className="py-1.5 pr-3">When</th>
                  <th className="py-1.5 pr-3">Type</th>
                  <th className="py-1.5 pr-3">Qty</th>
                  <th className="py-1.5 pr-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-t border-mist">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                    <td className="py-1.5 pr-3 font-mono">{t.type}</td>
                    <td className={`py-1.5 pr-3 font-mono ${t.quantity < 0 ? "text-clay" : "text-sage-dark"}`}>
                      {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                    </td>
                    <td className="py-1.5 pr-3 text-ink/70">{t.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </motion.div>
  );
}
