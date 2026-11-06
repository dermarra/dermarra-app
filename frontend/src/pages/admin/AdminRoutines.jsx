import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import client from "../../api/client";
import NameSlugFields from "../../components/NameSlugFields.jsx";
import Field from "../../components/admin/Field.jsx";
import { finalizeSlug } from "../../lib/slug.js";
import ImageUploadField from "../../components/ImageUploadField.jsx";
import { containerReveal, itemReveal } from "../../components/Reveal.jsx";

const TIME_OF_DAY = ["both", "am", "pm"];
const SKIN_TYPES = ["oily", "dry", "combination", "normal", "sensitive"];

const emptyForm = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  primary_concern_id: "",
  skin_type: "",
  bundle_discount_percent: 0,
  cloudinary_public_id: null,
  is_active: true,
};

export default function AdminRoutines() {
  const [routines, setRoutines] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null); // null | "new" | routineId
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [stepsRoutineId, setStepsRoutineId] = useState(null);
  const [steps, setSteps] = useState([]);
  const [stepsSubmitting, setStepsSubmitting] = useState(false);
  const [stepsError, setStepsError] = useState(null);

  const [rowState, setRowState] = useState({});

  const load = () => {
    setLoading(true);
    Promise.all([
      client.get("/admin/routines"),
      client.get("/admin/concerns"),
      client.get("/admin/products"),
    ])
      .then(([routinesRes, concernsRes, productsRes]) => {
        setRoutines(routinesRes.data);
        setConcerns(concernsRes.data);
        setProducts(productsRes.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setForm(emptyForm);
    setError(null);
    setEditingId("new");
  };

  const openEdit = (routine) => {
    setForm({
      name: routine.name,
      slug: routine.slug,
      tagline: routine.tagline || "",
      description: routine.description || "",
      primary_concern_id: routine.primary_concern?.id || "",
      skin_type: routine.skin_type || "",
      bundle_discount_percent: routine.bundle_discount_percent || 0,
      cloudinary_public_id: routine.cloudinary_public_id,
      is_active: routine.is_active,
    });
    setError(null);
    setEditingId(routine.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        slug: finalizeSlug(form.slug),
        tagline: form.tagline,
        description: form.description,
        primary_concern_id: form.primary_concern_id || null,
        skin_type: form.skin_type || null,
        bundle_discount_percent: Number(form.bundle_discount_percent),
        cloudinary_public_id: form.cloudinary_public_id,
        is_active: form.is_active,
      };
      if (editingId === "new") {
        await client.post("/admin/routines", payload);
      } else {
        await client.patch(`/admin/routines/${editingId}`, payload);
      }
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (routineId) => {
    if (!window.confirm("Delete this routine? This can't be undone -- deactivate it instead to just hide it.")) return;
    setRowState((s) => ({ ...s, [routineId]: "deleting" }));
    try {
      await client.delete(`/admin/routines/${routineId}`);
      setRoutines((prev) => prev.filter((r) => r.id !== routineId));
    } catch (err) {
      setRowState((s) => ({
        ...s,
        [routineId]: err.response?.data?.error || "Couldn't delete this routine.",
      }));
    }
  };

  // Flattened "Product — Size" options for the step picker -- a routine
  // step pins to a specific sellable variant, not just the product family,
  // so the bundle's price is deterministic (see backend RoutineStep model).
  // Inactive sizes/products are kept in the list only so a step already
  // pinned to one still displays -- flagged and disabled so they can't be
  // newly picked (the backend also rejects them on save).
  const variantOptions = products.flatMap((p) =>
    (p.variants || []).map((v) => {
      const onSale = p.is_active && v.is_active;
      return { id: v.id, label: `${p.name} — ${v.label}${onSale ? "" : " (inactive)"}`, onSale };
    })
  );
  const sellableOptions = variantOptions.filter((v) => v.onSale);

  const openSteps = (routine) => {
    setStepsError(null);
    setStepsRoutineId(routine.id);
    setSteps(
      routine.steps.map((s) => ({
        variant_id: s.variant.id,
        time_of_day: s.time_of_day,
      }))
    );
  };

  const addStep = () => {
    if (sellableOptions.length === 0) return;
    setSteps((s) => [...s, { variant_id: sellableOptions[0].id, time_of_day: "both" }]);
  };

  const removeStep = (index) => {
    setSteps((s) => s.filter((_, i) => i !== index));
  };

  const moveStep = (index, direction) => {
    setSteps((s) => {
      const next = [...s];
      const target = index + direction;
      if (target < 0 || target >= next.length) return next;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updateStep = (index, field, value) => {
    setSteps((s) => s.map((step, i) => (i === index ? { ...step, [field]: value } : step)));
  };

  const saveSteps = async () => {
    setStepsError(null);
    setStepsSubmitting(true);
    try {
      const payload = {
        steps: steps.map((s, i) => ({
          variant_id: s.variant_id,
          order_index: i + 1,
          time_of_day: s.time_of_day,
        })),
      };
      await client.put(`/admin/routines/${stepsRoutineId}/steps`, payload);
      setStepsRoutineId(null);
      load();
    } catch (err) {
      setStepsError(err.response?.data?.error || "Couldn't save steps.");
    } finally {
      setStepsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-3xl text-ink">Routines</h2>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={openCreate}
          className="px-4 py-2 rounded-sm bg-blue text-ink font-semibold text-sm"
        >
          + Add routine
        </motion.button>
      </div>

      {editingId && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 border border-mist rounded-sm p-4 mb-6 bg-bone-light"
        >
          <h3 className="font-semibold text-xl">
            {editingId === "new" ? "New routine" : "Edit routine"}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NameSlugFields
              form={form}
              setForm={setForm}
              urlPrefix="routine id: "
              namePlaceholder="e.g. Brightening Routine"
              nameHelp="The bundle's name, e.g. Brightening Routine. Shown on the quiz result and concern pages."
            />
            <Field label="Tagline" help="One short line under the name, e.g. 'Fade dark spots in 4 weeks.'">
              <input
                placeholder="e.g. Fade dark spots in 4 weeks"
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
              />
            </Field>
            <Field
              label="Primary concern"
              help="The skin concern this routine treats. The quiz recommends it to customers who pick this concern."
            >
              <select
                value={form.primary_concern_id}
                onChange={(e) => setForm({ ...form, primary_concern_id: e.target.value })}
                className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
              >
                <option value="">No primary concern (never recommended by the quiz)</option>
                {concerns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Skin type"
              help="Pick one if this routine is made for a specific skin type; the quiz prefers an exact match. 'Any' suits everyone."
            >
              <select
                value={form.skin_type}
                onChange={(e) => setForm({ ...form, skin_type: e.target.value })}
                className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
              >
                <option value="">Any skin type</option>
                {SKIN_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Bundle discount (%)"
              help="Whole number 0-100. Taken off the total of the step prices when bought as a full routine, e.g. 10 = 10% off."
            >
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="e.g. 10"
                value={form.bundle_discount_percent}
                onChange={(e) => setForm({ ...form, bundle_discount_percent: e.target.value })}
                className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
              />
            </Field>
          </div>

          <Field label="Description" help="A few sentences on what the routine does and who it's for.">
            <textarea
              placeholder="e.g. A four-step system that targets dark spots while protecting your barrier…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
              rows={2}
            />
          </Field>

          <div>
            <p className="text-sm font-semibold text-ink/80">Image</p>
            <p className="text-sm text-ink/55 mb-2">A square cover photo for the routine (you&apos;ll be asked to crop).</p>
            <ImageUploadField
              value={form.cloudinary_public_id}
              onChange={(publicId) => setForm({ ...form, cloudinary_public_id: publicId })}
              folder="derma-skincare/routines"
              aspect={1}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span>
              Active (visible in shop)
              <span className="block text-sm text-ink/55">
                Inactive routines are hidden and never recommended by the quiz. A routine also needs at least one
                step (set with &quot;Steps&quot;) before customers can see it.
              </span>
            </span>
          </label>

          {error && <p className="text-sm text-orange-700">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-sm bg-blue text-ink font-semibold text-sm disabled:opacity-50"
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
        </form>
      )}

      {stepsRoutineId && (
        <div className="flex flex-col gap-3 border border-mist rounded-sm p-4 mb-6 bg-bone-light">
          <h3 className="font-semibold text-xl">Steps</h3>
          <p className="text-sm text-ink/55 -mt-2">
            List the products in the order they&apos;re applied (use ↑ ↓ to reorder). Each step is one specific
            size -- the routine&apos;s price is the sum of these sizes&apos; prices minus the bundle discount. &quot;AM&quot;,
            &quot;PM&quot; or &quot;both&quot; is when the step is used. Only sizes currently on sale can be picked.
          </p>

          {steps.length === 0 && <p className="text-sm text-ink/60">No steps yet -- add the first product below.</p>}

          {steps.map((step, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="font-mono text-sm text-ink/60 w-5">{index + 1}</span>
              <select
                value={step.variant_id}
                onChange={(e) => updateStep(index, "variant_id", e.target.value)}
                aria-label={`Step ${index + 1} product and size`}
                title="The exact product size used for this step"
                className="border border-mist rounded-sm px-3 py-2 text-sm flex-1 min-w-0"
              >
                {variantOptions
                  .filter((v) => v.onSale || v.id === step.variant_id)
                  .map((v) => (
                    <option key={v.id} value={v.id} disabled={!v.onSale}>{v.label}</option>
                  ))}
              </select>
              <select
                value={step.time_of_day}
                onChange={(e) => updateStep(index, "time_of_day", e.target.value)}
                aria-label={`Step ${index + 1} time of day`}
                title="When this step is used: morning (am), evening (pm) or both"
                className="border border-mist rounded-sm px-3 py-2 text-sm"
              >
                {TIME_OF_DAY.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => moveStep(index, -1)}
                disabled={index === 0}
                className="px-2 py-1.5 rounded-sm border border-mist text-xs disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveStep(index, 1)}
                disabled={index === steps.length - 1}
                className="px-2 py-1.5 rounded-sm border border-mist text-xs disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeStep(index)}
                className="px-2 py-1.5 rounded-sm border border-mist text-orange-700 text-xs"
              >
                Remove
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addStep}
            className="self-start px-3 py-1.5 rounded-sm border border-mist text-ink/70 text-xs"
          >
            + Add step
          </button>

          {stepsError && <p className="text-sm text-orange-700">{stepsError}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveSteps}
              disabled={stepsSubmitting || steps.length === 0}
              className="px-4 py-2 rounded-sm bg-blue text-ink font-semibold text-sm disabled:opacity-50"
            >
              {stepsSubmitting ? "Saving…" : "Save steps"}
            </button>
            <button
              type="button"
              onClick={() => setStepsRoutineId(null)}
              className="px-4 py-2 rounded-sm border border-mist text-ink/70 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-ink/60 text-sm">Loading routines…</p>
      ) : routines.length === 0 ? (
        <p className="text-ink/60 text-sm">No routines yet.</p>
      ) : (
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-2">
          {routines.map((routine) => {
            const state = rowState[routine.id];
            return (
              <motion.div
                key={routine.id}
                variants={itemReveal}
                className="flex items-center justify-between border border-mist rounded-sm px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{routine.name}</p>
                  <p className="text-sm text-ink/60">
                    {routine.steps.length} steps · {routine.bundle_discount_percent}% off ·{" "}
                    {routine.is_active ? "active" : "inactive"}
                    {routine.skin_type && ` · ${routine.skin_type} skin`}
                  </p>
                  {state && state !== "deleting" && (
                    <p className="text-sm text-orange-700 mt-1">{state}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openSteps(routine)}
                    className="px-3 py-1.5 rounded-sm border border-mist text-ink/70 text-xs"
                  >
                    Steps
                  </button>
                  <button
                    onClick={() => openEdit(routine)}
                    className="px-3 py-1.5 rounded-sm border border-mist text-ink/70 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(routine.id)}
                    disabled={state === "deleting"}
                    className="px-3 py-1.5 rounded-sm border border-mist text-orange-700 text-xs disabled:opacity-50"
                  >
                    {state === "deleting" ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
