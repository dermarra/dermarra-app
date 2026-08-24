import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import client, { cloudinaryUrl } from "../../api/client";
import ImageUploadField from "../../components/ImageUploadField.jsx";
import { containerReveal, itemReveal } from "../../components/Reveal.jsx";

const emptyForm = { name: "", slug: "", description: "", cloudinary_public_id: null };

export default function AdminConcerns() {
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null); // null | "new" | concernId
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [rowState, setRowState] = useState({});

  const load = () => {
    setLoading(true);
    client
      .get("/admin/concerns")
      .then(({ data }) => setConcerns(data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setForm(emptyForm);
    setError(null);
    setEditingId("new");
  };

  const openEdit = (concern) => {
    setForm({
      name: concern.name,
      slug: concern.slug,
      description: concern.description || "",
      cloudinary_public_id: concern.cloudinary_public_id,
    });
    setError(null);
    setEditingId(concern.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        description: form.description,
        cloudinary_public_id: form.cloudinary_public_id,
      };
      if (editingId === "new") {
        await client.post("/admin/concerns", payload);
      } else {
        await client.patch(`/admin/concerns/${editingId}`, payload);
      }
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (concernId) => {
    setRowState((s) => ({ ...s, [concernId]: "deleting" }));
    try {
      await client.delete(`/admin/concerns/${concernId}`);
      setConcerns((prev) => prev.filter((c) => c.id !== concernId));
    } catch (err) {
      setRowState((s) => ({
        ...s,
        [concernId]: err.response?.data?.error || "Couldn't delete this concern.",
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
        <h2 className="font-display text-xl text-ink">Concerns</h2>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={openCreate}
          className="px-4 py-2 rounded-sm bg-amber text-bone-light font-semibold text-sm"
        >
          + Add concern
        </motion.button>
      </div>

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
              {editingId === "new" ? "New concern" : "Edit concern"}
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
            </div>

            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="border border-mist rounded-sm px-3 py-2 text-sm"
              rows={2}
            />

            <div>
              <p className="text-xs font-semibold text-ink/70 mb-2">Cover photo</p>
              <ImageUploadField
                value={form.cloudinary_public_id}
                onChange={(publicId) => setForm({ ...form, cloudinary_public_id: publicId })}
                folder="derma-skincare/concerns"
                aspect={1}
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
        <p className="text-ink/60 text-sm">Loading concerns…</p>
      ) : concerns.length === 0 ? (
        <p className="text-ink/60 text-sm">No concerns yet.</p>
      ) : (
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-2">
          {concerns.map((concern) => {
            const state = rowState[concern.id];
            const imageUrl = cloudinaryUrl(concern.cloudinary_public_id, { width: 80 });
            return (
              <motion.div
                key={concern.id}
                variants={itemReveal}
                className="flex items-center justify-between border border-mist rounded-sm px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-sm bg-mist overflow-hidden shrink-0">
                    {imageUrl && <img src={imageUrl} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">{concern.name}</p>
                    <p className="text-xs text-ink/60">{concern.slug}</p>
                    {state && state !== "deleting" && (
                      <p className="text-xs text-clay mt-1">{state}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(concern)}
                    className="px-3 py-1.5 rounded-sm border border-mist text-ink/70 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(concern.id)}
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
