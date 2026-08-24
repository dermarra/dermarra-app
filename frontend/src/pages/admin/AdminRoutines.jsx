import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import client from "../../api/client";
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
        slug: form.slug,
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

  const openSteps = (routine) => {
    setStepsError(null);
    setStepsRoutineId(routine.id);
    setSteps(
      routine.steps.map((s) => ({
        product_id: s.product.id,
        time_of_day: s.time_of_day,
      }))
    );
  };

  const addStep = () => {
    if (products.length === 0) return;
    setSteps((s) => [...s, { product_id: products[0].id, time_of_day: "both" }]);
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
          product_id: s.product_id,
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
        <h2 className="font-display text-xl text-ink">Routines</h2>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={openCreate}
          className="px-4 py-2 rounded-sm bg-amber text-bone-light font-semibold text-sm"
        >
          + Add routine
        </motion.button>
      </div>

      {editingId && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 border border-mist rounded-sm p-4 mb-6 bg-bone-light"
        >
          <h3 className="font-semibold text-sm">
            {editingId === "new" ? "New routine" : "Edit routine"}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              required
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border border-mist rounded-sm px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="border border-mist rounded-sm px-3 py-2 text-sm"
            />
            <input
              placeholder="Tagline"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="border border-mist rounded-sm px-3 py-2 text-sm"
            />
            <select
              value={form.primary_concern_id}
              onChange={(e) => setForm({ ...form, primary_concern_id: e.target.value })}
              className="border border-mist rounded-sm px-3 py-2 text-sm"
            >
              <option value="">No primary concern</option>
              {concerns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={form.skin_type}
              onChange={(e) => setForm({ ...form, skin_type: e.target.value })}
              className="border border-mist rounded-sm px-3 py-2 text-sm"
            >
              <option value="">Any skin type</option>
              {SKIN_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="Bundle discount %"
              value={form.bundle_discount_percent}
              onChange={(e) => setForm({ ...form, bundle_discount_percent: e.target.value })}
              className="border border-mist rounded-sm px-3 py-2 text-sm"
            />
          </div>

          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="border border-mist rounded-sm px-3 py-2 text-sm"
            rows={2}
          />

          <div>
            <p className="text-xs font-semibold text-ink/70 mb-2">Image</p>
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
            Active (visible in shop)
          </label>

          {error && <p className="text-sm text-clay">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-sm bg-amber text-bone-light font-semibold text-sm disabled:opacity-50"
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
          <h3 className="font-semibold text-sm">Steps</h3>

          {steps.length === 0 && <p className="text-xs text-ink/60">No steps yet.</p>}

          {steps.map((step, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="font-mono text-xs text-ink/60 w-5">{index + 1}</span>
              <select
                value={step.product_id}
                onChange={(e) => updateStep(index, "product_id", e.target.value)}
                className="border border-mist rounded-sm px-3 py-2 text-sm flex-1"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={step.time_of_day}
                onChange={(e) => updateStep(index, "time_of_day", e.target.value)}
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
                className="px-2 py-1.5 rounded-sm border border-mist text-clay text-xs"
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

          {stepsError && <p className="text-sm text-clay">{stepsError}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveSteps}
              disabled={stepsSubmitting || steps.length === 0}
              className="px-4 py-2 rounded-sm bg-amber text-bone-light font-semibold text-sm disabled:opacity-50"
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
                  <p className="text-xs text-ink/60">
                    {routine.steps.length} steps · {routine.bundle_discount_percent}% off ·{" "}
                    {routine.is_active ? "active" : "inactive"}
                    {routine.skin_type && ` · ${routine.skin_type} skin`}
                  </p>
                  {state && state !== "deleting" && (
                    <p className="text-xs text-clay mt-1">{state}</p>
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
                    className="px-3 py-1.5 rounded-sm border border-mist text-clay text-xs disabled:opacity-50"
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
