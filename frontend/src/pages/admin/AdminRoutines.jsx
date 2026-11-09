import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import client from "../../api/client";
import NameSlugFields from "../../components/NameSlugFields.jsx";
import Field from "../../components/admin/Field.jsx";
import { finalizeSlug } from "../../lib/slug.js";
import ImageUploadField from "../../components/ImageUploadField.jsx";
import { containerReveal } from "../../components/Reveal.jsx";
import { ChevronLeftIcon, ChevronRightIcon } from "../../components/Icons.jsx";
import {
  Button,
  EditorDrawer,
  EmptyState,
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
  selectClass,
} from "../../components/admin/Kit.jsx";

const kes = (cents) => `KES ${Math.round(cents / 100).toLocaleString("en-KE")}`;

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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const priceOf = Object.fromEntries(products.flatMap((p) => (p.variants || []).map((v) => [v.id, v.price_cents])));
  const stepsRoutine = routines.find((r) => r.id === stepsRoutineId);
  const stepsTotal = steps.reduce((sum, st) => sum + (priceOf[st.variant_id] || 0), 0);
  const stepsDiscount = stepsRoutine?.bundle_discount_percent || 0;
  const routinePrice = (r) => {
    const total = r.steps.reduce((sum, st) => sum + (st.variant?.price_cents || 0), 0);
    return Math.round((total * (100 - (r.bundle_discount_percent || 0))) / 100 / 100) * 100;
  };
  const activeCount = routines.filter((r) => r.is_active).length;
  const shown = routines.filter(
    (r) =>
      (statusFilter === "" || (statusFilter === "active" ? r.is_active : !r.is_active)) &&
      matches(query, r.name, r.tagline, r.primary_concern?.name)
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      <PageHeader
        title="Routines"
        description="Bundles of products used in order. The quiz recommends one by concern and skin type."
        actions={
          <Button variant="primary" size="lg" onClick={openCreate}>
            + Add routine
          </Button>
        }
      >
        <Toolbar>
          <FilterTabs
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "", label: "All", count: routines.length },
              { value: "active", label: "Active", count: activeCount },
              { value: "hidden", label: "Hidden", count: routines.length - activeCount },
            ]}
          />
          <SearchBox value={query} onChange={setQuery} placeholder="Search routines" />
        </Toolbar>
      </PageHeader>

      {/* ---------- Routine details ---------- */}
      <EditorDrawer
        open={!!editingId}
        title={editingId === "new" ? "New routine" : "Edit routine"}
        description="Add the products afterwards with “Steps”."
        onClose={() => setEditingId(null)}
        onSubmit={handleSubmit}
        saving={submitting}
        error={error}
        submitLabel={editingId === "new" ? "Add routine" : "Save changes"}
      >
        <FormSection title="Basics">
          <NameSlugFields
            form={form}
            setForm={setForm}
            namePlaceholder="e.g. Brightening Routine"
            nameHelp="Shown on the quiz result and concern pages."
          />
          <Field label="Tagline" help="One short line under the name.">
            <input placeholder="e.g. Fade dark spots in 4 weeks" value={form.tagline} onChange={set("tagline")} className={inputClass} />
          </Field>
          <Field label="Description" help="A few sentences on what it does and who it's for.">
            <textarea
              placeholder="e.g. A four-step system that targets dark spots while protecting your barrier…"
              value={form.description}
              onChange={set("description")}
              className={`${inputClass} min-h-[6rem]`}
              rows={3}
            />
          </Field>
        </FormSection>

        <FormSection title="Who it's for">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Main concern" help="The quiz recommends it for this concern. None = never recommended.">
              <select value={form.primary_concern_id} onChange={set("primary_concern_id")} className={selectClass}>
                <option value="">None</option>
                {concerns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Skin type" help="“Any” suits everyone.">
              <select value={form.skin_type} onChange={set("skin_type")} className={selectClass}>
                <option value="">Any skin type</option>
                {SKIN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </FormSection>

        <FormSection title="Price and visibility">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
            <Field label="Bundle saving (%)" help="Taken off the steps' total, e.g. 10 = 10% off.">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="e.g. 10"
                value={form.bundle_discount_percent}
                onChange={set("bundle_discount_percent")}
                className={inputClass}
              />
            </Field>
            <div className="sm:pt-8">
              <Toggle
                checked={form.is_active}
                onChange={(v) => setForm({ ...form, is_active: v })}
                label="Show in the shop"
                help="Also needs at least one step."
              />
            </div>
          </div>
        </FormSection>

        <Field label="Cover photo" help="Square. You'll crop it after choosing.">
          <ImageUploadField
            value={form.cloudinary_public_id}
            onChange={(publicId) => setForm({ ...form, cloudinary_public_id: publicId })}
            folder="derma-skincare/routines"
            aspect={1}
            removable
            hint="Square photo, at least 800 × 800px"
          />
        </Field>
      </EditorDrawer>

      {/* ---------- Steps ---------- */}
      <EditorDrawer
        open={!!stepsRoutineId}
        title={stepsRoutine ? `Steps: ${stepsRoutine.name}` : "Steps"}
        description="The products in the order they're applied. Each step is one exact size."
        onClose={() => setStepsRoutineId(null)}
        onSubmit={(e) => {
          e.preventDefault();
          if (steps.length) saveSteps();
        }}
        saving={stepsSubmitting}
        error={stepsError}
        submitLabel="Save steps"
        wide
      >
        {steps.length === 0 && <EmptyState>No steps yet -- add the first product.</EmptyState>}
        <ol className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <li key={index} className="flex flex-wrap items-center gap-3 p-4 bg-bone-light border border-mist rounded-lg">
              <span className="w-9 h-9 shrink-0 rounded-full bg-ink text-white text-sm font-bold flex items-center justify-center">{index + 1}</span>
              <label className="flex-[1_1_260px] min-w-0">
                <span className="sr-only">Step {index + 1} product and size</span>
                <select value={step.variant_id} onChange={(e) => updateStep(index, "variant_id", e.target.value)} className={selectClass}>
                  {variantOptions
                    .filter((v) => v.onSale || v.id === step.variant_id)
                    .map((v) => (
                      <option key={v.id} value={v.id} disabled={!v.onSale}>
                        {v.label}
                      </option>
                    ))}
                </select>
              </label>
              <div role="group" aria-label={`Step ${index + 1}: when it's used`} className="flex p-1 bg-white border border-mist rounded-lg">
                {[
                  ["am", "AM"],
                  ["pm", "PM"],
                  ["both", "Both"],
                ].map(([value, text]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateStep(index, "time_of_day", value)}
                    aria-pressed={step.time_of_day === value}
                    className={`h-9 px-3.5 rounded-lg text-[15px] font-semibold ${step.time_of_day === value ? "bg-ink text-white" : "text-ink hover:bg-blue-50"}`}
                  >
                    {text}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <Button onClick={() => moveStep(index, -1)} disabled={index === 0} aria-label={`Move step ${index + 1} up`} className="!px-3">
                  <ChevronLeftIcon className="w-3.5 h-3.5 rotate-90" />
                </Button>
                <Button onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1} aria-label={`Move step ${index + 1} down`} className="!px-3">
                  <ChevronRightIcon className="w-3.5 h-3.5 rotate-90" />
                </Button>
                <Button variant="danger" onClick={() => removeStep(index)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button variant="secondary" onClick={addStep} disabled={sellableOptions.length === 0}>
            + Add step
          </Button>
          {steps.length > 0 && (
            <p className="text-ink/70">
              Routine price:{" "}
              <span className="font-semibold text-ink">{kes(Math.round((stepsTotal * (100 - stepsDiscount)) / 100 / 100) * 100)}</span>
              {stepsDiscount > 0 && ` (${kes(stepsTotal)} less ${stepsDiscount}%)`}
            </p>
          )}
        </div>
      </EditorDrawer>

      {loading ? (
        <LoadingState>Loading routines…</LoadingState>
      ) : shown.length === 0 ? (
        <EmptyState>{routines.length ? "No routines match." : "No routines yet -- add the first one."}</EmptyState>
      ) : (
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-3">
          {shown.map((routine, index) => {
            const state = rowState[routine.id];
            const noSteps = routine.steps.length === 0;
            return (
              <ListRow
                key={routine.id}
                thumb={<Thumb imageId={routine.cloudinary_public_id} name={routine.name} index={index} />}
                title={routine.name}
                subtitle={routine.tagline || routine.primary_concern?.name}
                note={state && state !== "deleting" ? state : null}
                stats={[
                  { label: "Steps", value: routine.steps.length, tone: noSteps ? "warn" : undefined },
                  { label: "Saving", value: `${routine.bundle_discount_percent || 0}%` },
                  { label: "Price", value: noSteps ? "—" : kes(routinePrice(routine)) },
                  { label: "Skin type", value: routine.skin_type ? routine.skin_type[0].toUpperCase() + routine.skin_type.slice(1) : "Any" },
                ]}
                badge={
                  noSteps ? (
                    <StatusBadge tone="warn">No steps</StatusBadge>
                  ) : (
                    <StatusBadge tone={routine.is_active ? "info" : "neutral"}>{routine.is_active ? "Active" : "Hidden"}</StatusBadge>
                  )
                }
                actions={
                  <>
                    <Button variant="secondary" onClick={() => openSteps(routine)}>
                      Steps
                    </Button>
                    <Button onClick={() => openEdit(routine)}>Edit</Button>
                    <Button variant="danger" onClick={() => handleDelete(routine.id)} disabled={state === "deleting"}>
                      {state === "deleting" ? "Deleting…" : "Delete"}
                    </Button>
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
