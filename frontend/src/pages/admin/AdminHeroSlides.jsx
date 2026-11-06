import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import client, { cloudinaryUrl } from "../../api/client";
import Field from "../../components/admin/Field.jsx";
import ImageUploadField from "../../components/ImageUploadField.jsx";
import { containerReveal, itemReveal } from "../../components/Reveal.jsx";

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h2 className="font-display text-3xl text-ink">Hero slides</h2>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={openCreate}
          className="px-5 py-3 rounded-md bg-blue text-ink font-semibold text-sm"
        >
          + Add slide
        </motion.button>
      </div>
      <p className="text-sm text-ink/60 mb-4">
        The homepage hero shows active slides in position order, auto-advancing every few seconds.
        With no active slides, the homepage falls back to its default static hero.
      </p>

      <AnimatePresence>
        {editingId && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 border border-mist rounded-sm p-4 mb-6 bg-bone-light overflow-hidden"
          >
            <h3 className="font-semibold text-xl text-ink">
              {editingId === "new" ? "New slide" : "Edit slide"}
            </h3>

            <p className="text-sm text-ink/55 -mt-2">
              Slides rotate in the full-screen homepage banner and the sign-in page panel.
            </p>
            <Field label="Eyebrow" help="Optional small text above the title, e.g. New arrival or Bestseller.">
              <input
                placeholder="e.g. New arrival"
                value={form.eyebrow}
                onChange={(e) => setForm({ ...form, eyebrow: e.target.value })}
                className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
              />
            </Field>
            <Field label="Title" help="The big headline -- keep it short (about 3-7 words).">
              <input
                required
                placeholder="e.g. Exfoliation is now simpler"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
              />
            </Field>
            <Field label="Subtitle" help="Optional supporting sentence under the title.">
              <textarea
                placeholder="e.g. Slough away dead skin cells for smoother, brighter skin."
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
                rows={2}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Button text" help="Optional. The button only shows if both button text and link are filled in.">
                <input
                  placeholder="e.g. Shop now"
                  value={form.cta_label}
                  onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
                  className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
                />
              </Field>
              <Field
                label="Button link"
                help="A page on this site, starting with / -- e.g. /shop/anti-ageing-serum, /shop/concern/signs-of-ageing or /quiz."
              >
                <input
                  placeholder="e.g. /shop/anti-ageing-serum"
                  value={form.cta_link}
                  onChange={(e) => setForm({ ...form, cta_link: e.target.value })}
                  className="border border-mist rounded-sm px-3 py-2 text-sm font-mono font-normal text-ink"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <Field label="Position" help="Order in the carousel: 0 shows first, then 1, 2…">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
                />
              </Field>
              <label className="flex items-start gap-2 text-sm text-ink sm:mt-6">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                <span>
                  Active
                  <span className="block text-sm text-ink/55">Untick to hide this slide without deleting it.</span>
                </span>
              </label>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink/80">Background image</p>
              <p className="text-sm text-ink/55 mb-2">
                A wide landscape photo (at least 1600px wide). It&apos;s darkened behind the text, so busy images are fine.
              </p>
              <ImageUploadField
                value={form.cloudinary_public_id}
                onChange={(publicId) => setForm({ ...form, cloudinary_public_id: publicId })}
                folder="derma-skincare/hero-slides"
              />
            </div>

            {error && <p className="text-sm text-orange-700">{error}</p>}

            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-sm bg-blue text-ink font-semibold text-sm disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save"}
              </motion.button>
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

      {loading ? (
        <p className="text-ink/60 text-sm">Loading slides…</p>
      ) : slides.length === 0 ? (
        <p className="text-ink/60 text-sm">No slides yet.</p>
      ) : (
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-3">
          {slides.map((slide) => {
            const state = rowState[slide.id];
            const imageUrl = cloudinaryUrl(slide.cloudinary_public_id, { width: 80 });
            return (
              <motion.div
                key={slide.id}
                variants={itemReveal}
                className="flex items-center justify-between gap-4 bg-white border border-mist rounded-xl px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-14 h-10 rounded-sm bg-mist overflow-hidden shrink-0">
                    {imageUrl && <img src={imageUrl} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {slide.title}
                      {!slide.is_active && (
                        <span className="ml-2 text-xs uppercase text-ink/40 border border-mist rounded-full px-2 py-0.5">
                          Inactive
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-ink/60">Position {slide.position}</p>
                    {state && state !== "deleting" && (
                      <p className="text-sm text-orange-700 mt-1">{state}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(slide)}
                    className="px-4 py-2 rounded-md border border-ink/20 bg-white text-ink text-xs font-semibold hover:border-ink"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(slide.id)}
                    disabled={state === "deleting"}
                    className="px-4 py-2 rounded-md border border-orange-700/30 bg-white text-orange-700 text-xs font-semibold hover:border-orange-700 disabled:opacity-50"
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
