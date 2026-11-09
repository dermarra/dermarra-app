import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import client from "../../api/client";
import Field from "../../components/admin/Field.jsx";
import ImageUploadField from "../../components/ImageUploadField.jsx";
import { containerReveal } from "../../components/Reveal.jsx";
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
} from "../../components/admin/Kit.jsx";

const emptyForm = {
  eyebrow: "",
  title: "",
  subtitle: "",
  cloudinary_public_id: null,
  cta_label: "",
  cta_link: "",
  position: 0,
  is_active: true,
};

export default function AdminHeroSlides() {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null); // null | "new" | slideId
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [rowState, setRowState] = useState({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = () => {
    setLoading(true);
    client
      .get("/admin/hero-slides")
      .then(({ data }) => setSlides(data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setForm({ ...emptyForm, position: slides.length });
    setError(null);
    setEditingId("new");
  };

  const openEdit = (slide) => {
    setForm({
      eyebrow: slide.eyebrow || "",
      title: slide.title,
      subtitle: slide.subtitle || "",
      cloudinary_public_id: slide.cloudinary_public_id,
      cta_label: slide.cta_label || "",
      cta_link: slide.cta_link || "",
      position: slide.position,
      is_active: slide.is_active,
    });
    setError(null);
    setEditingId(slide.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = { ...form, position: Number(form.position) };
      if (editingId === "new") {
        await client.post("/admin/hero-slides", payload);
      } else {
        await client.patch(`/admin/hero-slides/${editingId}`, payload);
      }
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (slideId) => {
    if (!window.confirm("Delete this hero slide and its image? This can't be undone.")) return;
    setRowState((s) => ({ ...s, [slideId]: "deleting" }));
    try {
      await client.delete(`/admin/hero-slides/${slideId}`);
      setSlides((prev) => prev.filter((s) => s.id !== slideId));
    } catch (err) {
      setRowState((s) => ({
        ...s,
        [slideId]: err.response?.data?.error || "Couldn't delete this slide.",
      }));
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const activeCount = slides.filter((s) => s.is_active).length;
  const shown = slides.filter(
    (s) =>
      (statusFilter === "" || (statusFilter === "active" ? s.is_active : !s.is_active)) &&
      matches(query, s.title, s.eyebrow, s.subtitle)
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      <PageHeader
        title="Hero slides"
        description="The full-screen homepage banner (also the sign-in page panel). Active slides rotate in position order; with none, the homepage shows its default hero."
        actions={
          <Button variant="primary" size="lg" onClick={openCreate}>
            + Add slide
          </Button>
        }
      >
        <Toolbar>
          <FilterTabs
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "", label: "All", count: slides.length },
              { value: "active", label: "Active", count: activeCount },
              { value: "hidden", label: "Hidden", count: slides.length - activeCount },
            ]}
          />
          <SearchBox value={query} onChange={setQuery} placeholder="Search slides" />
        </Toolbar>
      </PageHeader>

      <EditorDrawer
        open={!!editingId}
        title={editingId === "new" ? "New slide" : "Edit slide"}
        description="Big, short and bold reads best: the photo sits behind the text, darkened."
        onClose={() => setEditingId(null)}
        onSubmit={handleSubmit}
        saving={submitting}
        error={error}
        submitLabel={editingId === "new" ? "Add slide" : "Save changes"}
      >
        <FormSection title="Text">
          <Field label="Title" help="The big headline, about 3-7 words.">
            <input required placeholder="e.g. Exfoliation is now simpler" value={form.title} onChange={set("title")} className={inputClass} />
          </Field>
          <Field label="Eyebrow (optional)" help="Small text above the title.">
            <input placeholder="e.g. New arrival" value={form.eyebrow} onChange={set("eyebrow")} className={inputClass} />
          </Field>
          <Field label="Subtitle (optional)" help="One supporting sentence under the title.">
            <textarea
              placeholder="e.g. Slough away dead skin cells for smoother, brighter skin."
              value={form.subtitle}
              onChange={set("subtitle")}
              className={`${inputClass} min-h-[5rem]`}
              rows={2}
            />
          </Field>
        </FormSection>

        <FormSection title="Button (optional)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Button text" help="Shows only when the link is set too.">
              <input placeholder="e.g. Shop now" value={form.cta_label} onChange={set("cta_label")} className={inputClass} />
            </Field>
            <Field label="Links to" help="A page on this site, e.g. /quiz or /shop/concern/signs-of-ageing.">
              <input placeholder="/shop/anti-ageing-serum" value={form.cta_link} onChange={set("cta_link")} className={inputClass} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Display">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
            <Field label="Position" help="0 shows first, then 1, 2…">
              <input type="number" min="0" step="1" value={form.position} onChange={set("position")} className={inputClass} />
            </Field>
            <div className="sm:pt-8">
              <Toggle
                checked={form.is_active}
                onChange={(v) => setForm({ ...form, is_active: v })}
                label="Show on the homepage"
                help="Turn off to hide it without deleting."
              />
            </div>
          </div>
        </FormSection>

        <Field label="Background photo" help="Wide landscape, at least 1600px across.">
          <ImageUploadField
            value={form.cloudinary_public_id}
            onChange={(publicId) => setForm({ ...form, cloudinary_public_id: publicId })}
            folder="derma-skincare/hero-slides"
            hint="Landscape photo, at least 1600px wide"
          />
        </Field>
      </EditorDrawer>

      {loading ? (
        <LoadingState>Loading slides…</LoadingState>
      ) : shown.length === 0 ? (
        <EmptyState>{slides.length ? "No slides match." : "No slides yet. The homepage hero shows only the headline until you add one."}</EmptyState>
      ) : (
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-3">
          {shown.map((slide, index) => {
            const state = rowState[slide.id];
            return (
              <ListRow
                key={slide.id}
                thumb={<Thumb imageId={slide.cloudinary_public_id} name={slide.title} index={index} wide />}
                title={slide.title}
                subtitle={slide.subtitle || slide.eyebrow}
                note={state && state !== "deleting" ? state : null}
                stats={[
                  { label: "Position", value: slide.position },
                  { label: "Button", value: slide.cta_label && slide.cta_link ? slide.cta_label : "None" },
                ]}
                badge={<StatusBadge tone={slide.is_active ? "info" : "neutral"}>{slide.is_active ? "Active" : "Hidden"}</StatusBadge>}
                actions={
                  <>
                    <Button onClick={() => openEdit(slide)}>Edit</Button>
                    <Button variant="danger" onClick={() => handleDelete(slide.id)} disabled={state === "deleting"}>
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
