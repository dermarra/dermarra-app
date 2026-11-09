import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import client from "../../api/client";
import Field from "../../components/admin/Field.jsx";
import { containerReveal } from "../../components/Reveal.jsx";
import {
  Button,
  EditorDrawer,
  EmptyState,
  ErrorText,
  FilterTabs,
  FormSection,
  ListRow,
  LoadingState,
  PageHeader,
  SearchBox,
  StatusBadge,
  Thumb,
  Toggle,
  Toolbar,
  inputClass,
  matches,
} from "../../components/admin/Kit.jsx";

const emptyForm = {
  code: "",
  discount_type: "percent",
  value: "", // percent (1-100) or whole KES, converted to cents on save
  max_uses: "",
  first_order_only: false,
  expires_on: "",
  is_active: true,
};

function describe(coupon) {
  const amount =
    coupon.discount_type === "percent"
      ? `${coupon.discount_value}% off`
      : `KES ${(coupon.discount_value / 100).toFixed(0)} off`;
  return coupon.first_order_only ? `${amount} · first order only` : amount;
}

/** Coupons were API-only before (curl) -- this is their admin UI. "Delete"
 * on the backend is a soft deactivate (orders keep referencing the row). */
export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editingId, setEditingId] = useState(null); // null | "new" | couponId
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = () => {
    setLoading(true);
    client
      .get("/admin/coupons")
      .then(({ data }) => setCoupons(data))
      .catch(() => setLoadError("Couldn't load coupons."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setForm(emptyForm);
    setError(null);
    setEditingId("new");
  };

  const openEdit = (coupon) => {
    setForm({
      code: coupon.code,
      discount_type: coupon.discount_type,
      value:
        coupon.discount_type === "percent" ? String(coupon.discount_value) : String(coupon.discount_value / 100),
      max_uses: coupon.max_uses == null ? "" : String(coupon.max_uses),
      first_order_only: coupon.first_order_only,
      expires_on: coupon.expires_at ? coupon.expires_at.slice(0, 10) : "",
      is_active: coupon.is_active,
    });
    setError(null);
    setEditingId(coupon.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const value = Number(form.value);
    if (!Number.isInteger(value) || value < 1 || (form.discount_type === "percent" && value > 100)) {
      setError(
        form.discount_type === "percent"
          ? "Percent discount must be a whole number from 1 to 100."
          : "Fixed discount must be a whole number of shillings (at least KES 1)."
      );
      return;
    }
    const maxUses = form.max_uses.trim() === "" ? null : Number(form.max_uses);
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
      setError("Max uses must be a whole number of at least 1, or blank for unlimited.");
      return;
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value: form.discount_type === "percent" ? value : value * 100,
      max_uses: maxUses,
      first_order_only: form.first_order_only,
      // end of the chosen day, so "expires 30 Nov" still works on 30 Nov
      expires_at: form.expires_on ? `${form.expires_on}T23:59:59` : null,
      is_active: form.is_active,
    };

    setSubmitting(true);
    try {
      if (editingId === "new") await client.post("/admin/coupons", payload);
      else await client.patch(`/admin/coupons/${editingId}`, payload);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't save this coupon.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (coupon) => {
    if (coupon.is_active && !window.confirm(`Switch off ${coupon.code}? Customers won't be able to use it.`)) return;
    try {
      const { data } = await client.patch(`/admin/coupons/${coupon.id}`, { is_active: !coupon.is_active });
      setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? data : c)));
    } catch (err) {
      setLoadError(err.response?.data?.error || "Couldn't update this coupon.");
    }
  };

  const now = new Date();
  const statusOf = (c) =>
    !c.is_active ? "off" : c.expires_at && new Date(c.expires_at) < now ? "expired" : c.max_uses != null && c.used_count >= c.max_uses ? "used_up" : "live";
  const STATUS = {
    live: { label: "Active", tone: "info" },
    off: { label: "Switched off", tone: "neutral" },
    expired: { label: "Expired", tone: "neutral" },
    used_up: { label: "Used up", tone: "warn" },
  };
  const liveCount = coupons.filter((c) => statusOf(c) === "live").length;
  const shown = coupons.filter(
    (c) => (statusFilter === "" || (statusFilter === "live" ? statusOf(c) === "live" : statusOf(c) !== "live")) && matches(query, c.code)
  );
  const isPercent = form.discount_type === "percent";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      <PageHeader
        title="Coupons"
        description="Codes customers type at checkout. The newest active first-order code is what the homepage “Become a member” section advertises."
        actions={
          <Button variant="primary" size="lg" onClick={openCreate}>
            + Add coupon
          </Button>
        }
      >
        <Toolbar>
          <FilterTabs
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "", label: "All", count: coupons.length },
              { value: "live", label: "Active", count: liveCount },
              { value: "inactive", label: "Not active", count: coupons.length - liveCount },
            ]}
          />
          <SearchBox value={query} onChange={setQuery} placeholder="Search codes" />
        </Toolbar>
      </PageHeader>

      <EditorDrawer
        open={!!editingId}
        title={editingId === "new" ? "New coupon" : `Edit ${form.code || "coupon"}`}
        description="Taken off the cart subtotal at checkout, never more than the cart total."
        onClose={() => setEditingId(null)}
        onSubmit={handleSubmit}
        saving={submitting}
        error={error}
        submitLabel={editingId === "new" ? "Add coupon" : "Save changes"}
      >
        <Field label="Code" help="What customers type. Letters and numbers, saved in capitals.">
          <input
            required
            placeholder="e.g. WELCOME10"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, "") })}
            className={`${inputClass} uppercase tracking-[0.08em] font-semibold placeholder:normal-case placeholder:tracking-normal placeholder:font-normal`}
          />
        </Field>

        <FormSection title="Discount">
          <div className="flex flex-wrap items-end gap-4">
            <div role="group" aria-label="Discount type" className="flex p-1 bg-white border border-mist rounded-lg">
              {[
                ["percent", "% off"],
                ["fixed_cents", "KES off"],
              ].map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, discount_type: value })}
                  aria-pressed={form.discount_type === value}
                  className={`h-10 px-4 rounded-lg text-[15px] font-semibold ${form.discount_type === value ? "bg-ink text-white" : "text-ink hover:bg-blue-50"}`}
                >
                  {text}
                </button>
              ))}
            </div>
            <label className="flex-1 min-w-[10rem]">
              <span className="sr-only">Discount amount</span>
              <span className="flex items-center rounded-lg border border-ink/20 bg-white focus-within:border-blue focus-within:ring-2 focus-within:ring-blue/30">
                {!isPercent && <span className="pl-4 text-ink/70">KES</span>}
                <input
                  required
                  type="number"
                  min="1"
                  max={isPercent ? 100 : undefined}
                  step="1"
                  placeholder={isPercent ? "10" : "500"}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="flex-1 min-w-0 bg-transparent px-4 py-2.5 text-base text-ink outline-none"
                />
                {isPercent && <span className="pr-4 text-ink/70">%</span>}
              </span>
            </label>
          </div>
          <p className="-mt-2 text-sm text-ink/70">
            {isPercent ? "A whole number from 1 to 100, e.g. 10 = 10% off." : "Whole shillings, e.g. 500 = KES 500 off."}
          </p>
        </FormSection>

        <FormSection title="Limits">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Max uses" help="Across all customers. Blank = unlimited.">
              <input type="number" min="1" step="1" placeholder="Unlimited" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Expires on" help="Works until the end of that day. Blank = never.">
              <input type="date" value={form.expires_on} onChange={(e) => setForm({ ...form, expires_on: e.target.value })} className={inputClass} />
            </Field>
          </div>
          <Toggle
            checked={form.first_order_only}
            onChange={(v) => setForm({ ...form, first_order_only: v })}
            label="First order only"
            help="Only for customers who've never completed a paid order."
          />
          <Toggle
            checked={form.is_active}
            onChange={(v) => setForm({ ...form, is_active: v })}
            label="Active"
            help="Switch off without losing its usage history."
          />
        </FormSection>
      </EditorDrawer>

      <ErrorText>{loadError}</ErrorText>
      {loading ? (
        <LoadingState>Loading coupons…</LoadingState>
      ) : shown.length === 0 ? (
        <EmptyState>{coupons.length ? "No coupons match." : "No coupons yet. Add the first one."}</EmptyState>
      ) : (
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-3">
          {shown.map((coupon, index) => {
            const status = STATUS[statusOf(coupon)];
            return (
              <ListRow
                key={coupon.id}
                thumb={<Thumb name={coupon.code} index={index} />}
                title={<span className="tracking-[0.06em]">{coupon.code}</span>}
                subtitle={describe(coupon)}
                stats={[
                  { label: "Used", value: `${coupon.used_count}${coupon.max_uses != null ? ` / ${coupon.max_uses}` : ""}` },
                  {
                    label: "Expires",
                    value: coupon.expires_at
                      ? new Date(coupon.expires_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
                      : "Never",
                  },
                ]}
                badge={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
                actions={
                  <>
                    <Button onClick={() => openEdit(coupon)}>Edit</Button>
                    {coupon.is_active ? (
                      <Button variant="danger" onClick={() => toggleActive(coupon)}>
                        Switch off
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={() => toggleActive(coupon)}>
                        Switch on
                      </Button>
                    )}
                  </>
                }
              />
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
