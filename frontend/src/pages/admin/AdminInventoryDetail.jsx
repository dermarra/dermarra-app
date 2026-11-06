import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import client from "../../api/client";
import Field from "../../components/admin/Field.jsx";
import {
  BackLink,
  Button,
  EditorDrawer,
  EmptyState,
  ErrorText,
  LoadingState,
  PageHeader,
  Panel,
  Stat,
  StatusBadge,
  inputClass,
  selectClass,
  tableClass,
} from "../../components/admin/Kit.jsx";

const STATUS = {
  in_stock: { label: "In stock", tone: "good" },
  low_stock: { label: "Low stock", tone: "warn" },
  out_of_stock: { label: "Out of stock", tone: "bad" },
};
const BATCH_STATUS = {
  active: { label: "Active", tone: "good" },
  depleted: { label: "Used up", tone: "neutral" },
  expired: { label: "Expired", tone: "warn" },
  recalled: { label: "Recalled", tone: "warn" },
};
const TX_LABELS = {
  PRODUCTION_RECEIPT: "Production run",
  SALE: "Sale",
  RETURN: "Return",
  DAMAGE: "Damage",
  EXPIRY: "Expiry write-off",
  LOSS: "Loss",
  SAMPLE: "Sample",
  PROMOTION: "Promotion",
  INTERNAL_USE: "Internal use",
  ADJUSTMENT: "Correction",
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

  if (loading) return <LoadingState />;
  if (error) return <ErrorText>{error}</ErrorText>;
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

  const status = STATUS[variant.stock_status] || STATUS.out_of_stock;
  const canAdjust = batches.some((b) => b.status === "active" || b.status === "depleted");
  const setR = (key) => (e) => setReceiveForm({ ...receiveForm, [key]: e.target.value });
  const setA = (key) => (e) => setAdjustForm({ ...adjustForm, [key]: e.target.value });
  const closeAdjust = () => {
    setAdjustOpen(false);
    setReviewing(false);
  };
  const fmt = (n) => Number(n).toLocaleString("en-KE");

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="flex flex-col gap-6">
      <div>
        <BackLink to="/admin/inventory">Back to inventory</BackLink>
        <PageHeader
          title={`${variant.product_name} — ${variant.label}`}
          description="Log each production run as a batch. Stock always sells from the batch that expires first."
          actions={
            <>
              <Button variant="secondary" size="lg" onClick={() => setAdjustOpen(true)} disabled={!canAdjust}>
                Adjust stock
              </Button>
              <Button variant="primary" size="lg" onClick={() => setReceiveOpen(true)}>
                + Log production run
              </Button>
            </>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-6 px-6 py-5 bg-white border border-mist rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 flex-1 min-w-0">
          <Stat label="On hand" value={fmt(variant.on_hand)} />
          <Stat label="Reserved" value={fmt(variant.reserved)} />
          <Stat label="Available" value={fmt(variant.available)} tone={variant.stock_status !== "in_stock" ? "warn" : undefined} />
          <Stat label="Reorder at" value={fmt(variant.reorder_level)} />
        </div>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>

      <Panel title="Batches" description="One per production run, oldest expiry sold first.">
        {batches.length === 0 ? (
          <EmptyState>No batches yet -- log the first production run.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Remaining</th>
                  <th>Unit cost</th>
                  <th>Expires</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="font-semibold">{b.batch_number}</td>
                    <td className="tabular-nums">
                      {fmt(b.quantity_remaining)} <span className="text-ink/70">of {fmt(b.quantity_produced)}</span>
                    </td>
                    <td className="tabular-nums">{formatKES(b.unit_cost_cents)}</td>
                    <td>{b.expiry_date || "Doesn't expire"}</td>
                    <td>
                      <StatusBadge tone={BATCH_STATUS[b.status]?.tone}>{BATCH_STATUS[b.status]?.label || b.status}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Stock history" description="Every movement, permanently logged.">
        {transactions.length === 0 ? (
          <EmptyState>No stock movements yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>What</th>
                  <th>Units</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap">
                      {new Date(t.created_at).toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td>{TX_LABELS[t.type] || t.type}</td>
                    <td className={`font-semibold tabular-nums ${t.quantity < 0 ? "text-orange-700" : "text-lime-800"}`}>
                      {t.quantity > 0 ? `+${fmt(t.quantity)}` : fmt(t.quantity)}
                    </td>
                    <td className="text-ink/80">{t.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ---------- Log a production run ---------- */}
      <EditorDrawer
        open={receiveOpen}
        title="Log a production run"
        description={`Adds a new batch of ${variant.product_name} (${variant.label}) to stock on hand.`}
        onClose={() => setReceiveOpen(false)}
        onSubmit={submitReceive}
        saving={receiveBusy}
        error={receiveError}
        submitLabel="Add to stock"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Batch number" help="The lot code on the packaging. Unique for this size.">
            <input required placeholder="e.g. AAS-2611-01" value={receiveForm.batch_number} onChange={setR("batch_number")} className={`${inputClass} uppercase`} />
          </Field>
          <Field label="Units made" help="Sellable units of this size.">
            <input required type="number" min="1" step="1" placeholder="e.g. 50" value={receiveForm.quantity_produced} onChange={setR("quantity_produced")} className={inputClass} />
          </Field>
          <Field label="Expiry date" help="Leave blank only if it doesn't expire.">
            <input type="date" value={receiveForm.expiry_date} onChange={setR("expiry_date")} className={inputClass} />
          </Field>
          <Field label="Made on" help="Leave blank for today.">
            <input type="date" value={receiveForm.produced_at} onChange={setR("produced_at")} className={inputClass} />
          </Field>
          <Field label="Cost per unit (optional)" help="Internal only, never shown to customers.">
            <span className="flex items-center rounded-lg border border-ink/20 bg-white focus-within:border-blue focus-within:ring-2 focus-within:ring-blue/30">
              <span className="pl-4 text-ink/70">KES</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="850"
                value={receiveForm.unit_cost_kes}
                onChange={setR("unit_cost_kes")}
                className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-base text-ink outline-none"
              />
            </span>
          </Field>
        </div>
        <Field label="Notes (optional)" help="e.g. formula version or who made it.">
          <textarea placeholder="e.g. Formula v2, made by Jane" value={receiveForm.notes} onChange={setR("notes")} className={`${inputClass} min-h-[5rem]`} rows={2} />
        </Field>
      </EditorDrawer>

      {/* ---------- Adjust stock (review, then confirm) ---------- */}
      <EditorDrawer
        open={adjustOpen}
        title={reviewing ? "Check this adjustment" : "Adjust stock"}
        description={
          reviewing
            ? "It's permanent and logged with its reason. Go back to change anything."
            : "For stock that leaves (or turns up) outside normal sales: damage, expiry, samples, or a stocktake correction."
        }
        onClose={closeAdjust}
        onSubmit={(e) => {
          e.preventDefault();
          if (reviewing) confirmAdjust();
          else if (adjustForm.batch_id && adjustForm.quantity && adjustForm.reason) setReviewing(true);
        }}
        saving={adjustBusy}
        error={adjustError}
        submitLabel={reviewing ? "Confirm and apply" : "Review adjustment"}
      >
        {reviewing ? (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 bg-orange-50 border border-orange-200 rounded-lg">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/70">What happened</dt>
                <dd className="mt-1 text-lg font-semibold">{ADJUSTMENT_TYPES.find((t) => t.value === adjustForm.type)?.label}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/70">Units</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{adjustForm.quantity}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/70">Batch</dt>
                <dd className="mt-1 text-lg font-semibold">{selectedBatch?.batch_number}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/70">Reason</dt>
                <dd className="mt-1">{adjustForm.reason}</dd>
              </div>
            </dl>
            <Button onClick={() => setReviewing(false)} className="self-start">
              ← Back to edit
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Batch" help="Check the batch number on the packaging.">
                <select value={adjustForm.batch_id} onChange={setA("batch_id")} className={selectClass} required>
                  <option value="">Choose a batch…</option>
                  {activeBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_number} ({b.quantity_remaining} left)
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="What happened" help="“Other correction” is for stocktake differences.">
                <select value={adjustForm.type} onChange={setA("type")} className={selectClass}>
                  {ADJUSTMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              label="Units"
              help={
                adjustForm.type === "ADJUSTMENT"
                  ? "Negative removes (e.g. -3), positive adds units found in a count (e.g. 5)."
                  : "How many to remove. Units held for unpaid orders can't be removed."
              }
            >
              <input required type="number" step="1" placeholder={adjustForm.type === "ADJUSTMENT" ? "-3 or 5" : "2"} value={adjustForm.quantity} onChange={setA("quantity")} className={inputClass} />
            </Field>
            <Field label="Reason" help="So the history makes sense later.">
              <textarea required placeholder="e.g. 2 bottles cracked in transit" value={adjustForm.reason} onChange={setA("reason")} className={`${inputClass} min-h-[5rem]`} rows={2} />
            </Field>
          </>
        )}
      </EditorDrawer>
    </motion.div>
  );
}
