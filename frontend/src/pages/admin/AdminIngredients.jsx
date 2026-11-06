import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import client, { cloudinaryUrl } from "../../api/client";
import NameSlugFields from "../../components/NameSlugFields.jsx";
import Field from "../../components/admin/Field.jsx";
import { finalizeSlug } from "../../lib/slug.js";
import ImageUploadField from "../../components/ImageUploadField.jsx";
import { containerReveal, itemReveal } from "../../components/Reveal.jsx";

const emptyForm = { name: "", slug: "", description: "", cloudinary_public_id: null };

export default function AdminIngredients() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null); // null | "new" | ingredientId
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [rowState, setRowState] = useState({});

  const load = () => {
    setLoading(true);
    client
      .get("/admin/ingredients")
      .then(({ data }) => setIngredients(data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setForm(emptyForm);
    setError(null);
    setEditingId("new");
  };

  const openEdit = (ingredient) => {
    setForm({
      name: ingredient.name,
      slug: ingredient.slug,
      description: ingredient.description || "",
      cloudinary_public_id: ingredient.cloudinary_public_id,
    });
    setError(null);
    setEditingId(ingredient.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (editingId === "new") {
        await client.post("/admin/ingredients", { ...form, slug: finalizeSlug(form.slug) });
      } else {
        await client.patch(`/admin/ingredients/${editingId}`, { ...form, slug: finalizeSlug(form.slug) });
      }
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (ingredientId) => {
    if (!window.confirm("Delete this ingredient? It will be removed from every product tagged with it.")) return;
    setRowState((s) => ({ ...s, [ingredientId]: "deleting" }));
    try {
      await client.delete(`/admin/ingredients/${ingredientId}`);
      setIngredients((prev) => prev.filter((i) => i.id !== ingredientId));
    } catch (err) {
      setRowState((s) => ({
        ...s,
        [ingredientId]: err.response?.data?.error || "Couldn't delete this ingredient.",
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
        <h2 className="font-display text-xl text-ink">Ingredients</h2>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={openCreate}
          className="px-4 py-2 rounded-sm bg-brand-700 text-bone-light font-semibold text-sm"
        >
          + Add ingredient
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
              {editingId === "new" ? "New ingredient" : "Edit ingredient"}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NameSlugFields
                form={form}
                setForm={setForm}
                urlPrefix="/shop/ingredient/"
                namePlaceholder="e.g. Niacinamide"
                nameHelp="The ingredient's common name, e.g. Niacinamide or Tranexamic Acid -- no strengths here (those go in a product's Key actives)."
              />
            </div>

            <Field
              label="Description"
              help="One or two sentences on what this ingredient does for skin, e.g. 'Fades dark spots and evens tone.' Shown on its Shop by Ingredient page."
            >
              <textarea
                placeholder="e.g. A gentle brightener that fades dark spots and evens skin tone."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink"
                rows={2}
              />
            </Field>

            <div>
              <p className="text-xs font-semibold text-ink/80">Cover photo</p>
              <p className="text-[11px] text-ink/55 mb-2">
                Square image used on the homepage &quot;Shop by ingredient&quot; section and this ingredient&apos;s page banner.
              </p>
              <ImageUploadField
                value={form.cloudinary_public_id}
                onChange={(publicId) => setForm({ ...form, cloudinary_public_id: publicId })}
                folder="derma-skincare/ingredients"
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
                className="px-4 py-2 rounded-sm bg-brand-700 text-bone-light font-semibold text-sm disabled:opacity-50"
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
        <p className="text-ink/60 text-sm">Loading ingredients…</p>
      ) : ingredients.length === 0 ? (
        <p className="text-ink/60 text-sm">No ingredients yet.</p>
      ) : (
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-2">
          {ingredients.map((ingredient) => {
            const state = rowState[ingredient.id];
            const imageUrl = cloudinaryUrl(ingredient.cloudinary_public_id, { width: 80 });
            return (
              <motion.div
                key={ingredient.id}
                variants={itemReveal}
                className="flex items-center justify-between border border-mist rounded-sm px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-sm bg-mist overflow-hidden shrink-0">
                    {imageUrl && <img src={imageUrl} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">{ingredient.name}</p>
                    <p className="text-xs text-ink/60">{ingredient.slug}</p>
                    {state && state !== "deleting" && (
                      <p className="text-xs text-clay mt-1">{state}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(ingredient)}
                    className="px-3 py-1.5 rounded-sm border border-mist text-ink/70 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(ingredient.id)}
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
