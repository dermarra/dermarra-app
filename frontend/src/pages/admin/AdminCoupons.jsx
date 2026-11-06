import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import client from "../../api/client";
import Field from "../../components/admin/Field.jsx";
import { containerReveal, itemReveal } from "../../components/Reveal.jsx";

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
    if (coupon.is_active && !window.confirm(`Deactivate ${coupon.code}? Customers won't be able to use it.`)) return;
    try {
      const { data } = await client.patch(`/admin/coupons/${coupon.id}`, { is_active: !coupon.is_active });
      setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? data : c)));
    } catch (err) {
      setLoadError(err.response?.data?.error || "Couldn't update this coupon.");
    }
  };

  const inputClass = "border border-mist rounded-sm px-3 py-2 text-sm";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-ink">Coupons</h2>
          <p className="text-xs text-ink/60 mt-1">
            The newest active first-order coupon is what the homepage &quot;Become a member&quot; section advertises.
          </p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 rounded-sm bg-blue text-ink text-sm font-semibold">
          New coupon
        </button>
      </div>

      <AnimatePresence>
        {editingId && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="border border-mist rounded-sm p-4 flex flex-col gap-3 overflow-hidden"
          >
            <h3 className="text-sm font-semibold">{editingId === "new" ? "New coupon" : "Edit coupon"}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Code" help="What customers type at checkout. Letters and numbers, saved in capitals, e.g. WELCOME10.">
                <input
                  required
                  placeholder="e.g. WELCOME10"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, "") })}
                  className={`${inputClass} uppercase font-mono font-normal`}
                />
              </Field>
              <Field
                label="Discount"
                help={
                  form.discount_type === "percent"
                    ? "Percent off the cart subtotal, 1-100 (e.g. 10 = 10% off)."
                    : "Fixed shillings off the cart subtotal (e.g. 500 = KES 500 off). Never more than the cart total."
                }
              >
                <div className="flex gap-2">
                  <select
                    value={form.discount_type}
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                    aria-label="Discount type"
                    className={`${inputClass} font-normal`}
                  >
                    <option value="percent">% off</option>
                    <option value="fixed_cents">KES off</option>
                  </select>
                  <input
                    required
                    type="number"
                    min="1"
                    max={form.discount_type === "percent" ? 100 : undefined}
                    step="1"
                    placeholder={form.discount_type === "percent" ? "e.g. 10" : "e.g. 500"}
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    aria-label="Discount amount"
                    className={`${inputClass} flex-1 min-w-0 font-normal`}
                  />
                </div>
              </Field>
              <Field label="Max uses" help="Total times the code can be used across all customers. Leave blank for unlimited.">
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Unlimited"
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                  className={`${inputClass} font-normal`}
                />
              </Field>
              <Field label="Expires on" help="Optional. Last day the code works (valid until the end of that day). Blank = never expires.">
                <input
                  type="date"
                  value={form.expires_on}
                  onChange={(e) => setForm({ ...form, expires_on: e.target.value })}
                  className={`${inputClass} font-normal`}
                />
              </Field>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.first_order_only}
                onChange={(e) => setForm({ ...form, first_order_only: e.target.checked })}
              />
              <span>
                First order only
                <span className="block text-[11px] text-ink/55">
                  Only customers who have never completed a paid order can use it. The newest active first-order code
                  is advertised in the homepage &quot;Become a member&quot; section.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <span>
                Active
                <span className="block text-[11px] text-ink/55">Untick to switch the code off without losing its usage history.</span>
              </span>
            </label>
            {error && <p className="text-sm text-orange-700">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-sm bg-blue text-ink text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="px-4 py-2 rounded-sm border border-mist text-ink/70 text-sm"
              >
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {loadError && <p className="text-sm text-orange-700">{loadError}</p>}
      {loading ? (
        <p className="text-sm text-ink/60">Loading coupons…</p>
      ) : coupons.length === 0 ? (
        <p className="text-sm text-ink/60">No coupons yet.</p>
      ) : (
        <motion.ul initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-2">
          {coupons.map((coupon) => (
            <motion.li
              key={coupon.id}
              variants={itemReveal}
              className={`border border-mist rounded-sm p-3 flex flex-wrap items-center justify-between gap-3 ${
                coupon.is_active ? "" : "opacity-60"
              }`}
            >
              <div>
                <p className="font-mono text-sm font-semibold text-ink">{coupon.code}</p>
                <p className="text-xs text-ink/60">
                  {describe(coupon)} · used {coupon.used_count}
                  {coupon.max_uses != null ? ` / ${coupon.max_uses}` : ""}
                  {coupon.expires_at ? ` · expires ${new Date(coupon.expires_at).toLocaleDateString()}` : ""}
                  {coupon.is_active ? "" : " · inactive"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(coupon)}
                  className="px-3 py-1.5 rounded-sm border border-mist text-ink/70 text-xs"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(coupon)}
                  className="px-3 py-1.5 rounded-sm border border-mist text-xs text-ink/70"
                >
                  {coupon.is_active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}
