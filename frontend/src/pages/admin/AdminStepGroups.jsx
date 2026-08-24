import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import client, { cloudinaryUrl } from "../../api/client";
import ImageUploadField from "../../components/ImageUploadField.jsx";
import { containerReveal, itemReveal } from "../../components/Reveal.jsx";

export default function AdminStepGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ label: "", description: "", cloudinary_public_id: null });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    client
      .get("/admin/step-groups")
      .then(({ data }) => setGroups(data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openEdit = (group) => {
    setForm({
      label: group.label,
      description: group.description || "",
      cloudinary_public_id: group.cloudinary_public_id,
    });
    setError(null);
    setEditingId(group.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await client.patch(`/admin/step-groups/${editingId}`, form);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <h2 className="font-display text-xl text-ink mb-1">Shop by Step</h2>
      <p className="text-sm text-ink/60 mb-4">
        The 4 fixed steps shown on the homepage. Each maps to a real product step type
        (Prep → Cleanser, Treat → Serum, Seal → Barrier cream, Protect → SPF) — only the
        label, description, and photo are editable here.
      </p>

      {loading ? (
        <p className="text-ink/60 text-sm">Loading…</p>
      ) : (
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-3">
          {groups.map((group) => {
            const imageUrl = cloudinaryUrl(group.cloudinary_public_id, { width: 120 });
            const isEditing = editingId === group.id;
            return (
              <motion.div
                key={group.id}
                variants={itemReveal}
                className="border border-mist rounded-sm bg-bone-light p-4"
              >
                {isEditing ? (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <p className="text-xs font-mono uppercase tracking-widest text-sage-dark">
                      {group.key} · maps to step_type &ldquo;{group.step_type}&rdquo;
                    </p>
                    <input
                      required
                      placeholder="Label"
                      value={form.label}
                      onChange={(e) => setForm({ ...form, label: e.target.value })}
                      className="border border-mist rounded-sm px-3 py-2 text-sm"
                    />
                    <textarea
                      placeholder="Description"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="border border-mist rounded-sm px-3 py-2 text-sm"
                      rows={2}
                    />
                    <div>
                      <p className="text-xs font-semibold text-ink/70 mb-2">Photo</p>
                      <ImageUploadField
                        value={form.cloudinary_public_id}
                        onChange={(publicId) => setForm({ ...form, cloudinary_public_id: publicId })}
                        folder="derma-skincare/step-groups"
                        aspect={1}
                      />
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-sm text-clay"
                        >
                          {error}
                        </motion.p>
                      )}
                    </AnimatePresence>

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
                  </form>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-sm bg-mist overflow-hidden shrink-0">
                      {imageUrl && <img src={imageUrl} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-ink">{group.label}</p>
                      <p className="text-xs text-ink/60">
                        {group.description || "No description yet."}
                      </p>
                    </div>
                    <button
                      onClick={() => openEdit(group)}
                      className="px-3 py-1.5 rounded-sm border border-mist text-ink/70 text-xs shrink-0"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
