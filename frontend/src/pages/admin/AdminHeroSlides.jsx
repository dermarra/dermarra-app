import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import client, { cloudinaryUrl } from "../../api/client";
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-ink">Hero slides</h2>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={openCreate}
          className="px-4 py-2 rounded-sm bg-amber text-bone-light font-semibold text-sm"
        >
          + Add slide
        </motion.button>
      </div>
      <p className="text-xs text-ink/60 mb-4">
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
            <h3 className="font-semibold text-sm text-ink">
              {editingId === "new" ? "New slide" : "Edit slide"}
            </h3>

            <input
              placeholder="Eyebrow (e.g. New arrival)"
              value={form.eyebrow}
              onChange={(e) => setForm({ ...form, eyebrow: e.target.value })}
              className="border border-mist rounded-sm px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="border border-mist rounded-sm px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Subtitle"
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              className="border border-mist rounded-sm px-3 py-2 text-sm"
              rows={2}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                placeholder="CTA label (e.g. Shop now)"
                value={form.cta_label}
                onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
                className="border border-mist rounded-sm px-3 py-2 text-sm"
              />
              <input
                placeholder="CTA link (e.g. /shop/product-slug)"
                value={form.cta_link}
                onChange={(e) => setForm({ ...form, cta_link: e.target.value })}
                className="border border-mist rounded-sm px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <label className="flex flex-col gap-1 text-xs text-ink/60">
                Position (lower shows first)
                <input
                  type="number"
                  min="0"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  className="border border-mist rounded-sm px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-ink mt-4">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Active
              </label>
            </div>

            <div>
              <p className="text-xs font-semibold text-ink/70 mb-2">Background image</p>
              <ImageUploadField
                value={form.cloudinary_public_id}
                onChange={(publicId) => setForm({ ...form, cloudinary_public_id: publicId })}
                folder="derma-skincare/hero-slides"
              />
            </div>

            {error && <p className="text-sm text-clay">{error}</p>}

            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-sm bg-amber text-bone-light font-semibold text-sm disabled:opacity-50"
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
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-2">
          {slides.map((slide) => {
            const state = rowState[slide.id];
            const imageUrl = cloudinaryUrl(slide.cloudinary_public_id, { width: 80 });
            return (
              <motion.div
                key={slide.id}
                variants={itemReveal}
                className="flex items-center justify-between border border-mist rounded-sm px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-14 h-10 rounded-sm bg-mist overflow-hidden shrink-0">
                    {imageUrl && <img src={imageUrl} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {slide.title}
                      {!slide.is_active && (
                        <span className="ml-2 text-[10px] uppercase text-ink/40 border border-mist rounded-full px-2 py-0.5">
                          Inactive
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-ink/60">Position {slide.position}</p>
                    {state && state !== "deleting" && (
                      <p className="text-xs text-clay mt-1">{state}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(slide)}
                    className="px-3 py-1.5 rounded-sm border border-mist text-ink/70 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(slide.id)}
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
