import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import client from "../../api/client";
import NameSlugFields from "../../components/NameSlugFields.jsx";
import Field from "../../components/admin/Field.jsx";
import { finalizeSlug } from "../../lib/slug.js";
import ImageUploadField from "../../components/ImageUploadField.jsx";
import { containerReveal } from "../../components/Reveal.jsx";
import {
  Button,
  EditorDrawer,
  EmptyState,
  FilterTabs,
  ListRow,
  LoadingState,
  PageHeader,
  SearchBox,
  StatusBadge,
  Thumb,
  Toolbar,
  inputClass,
  matches,
} from "../../components/admin/Kit.jsx";

const emptyForm = { name: "", slug: "", description: "", cloudinary_public_id: null };

export default function AdminIngredients() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null); // null | "new" | ingredientId
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [rowState, setRowState] = useState({});
  const [query, setQuery] = useState("");
  const [photoFilter, setPhotoFilter] = useState("");

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

  const withPhoto = ingredients.filter((i) => i.cloudinary_public_id).length;
  const shown = ingredients.filter(
    (i) =>
      (photoFilter === "" || (photoFilter === "with" ? i.cloudinary_public_id : !i.cloudinary_public_id)) &&
      matches(query, i.name, i.slug, i.description)
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      <PageHeader
        title="Ingredients"
        description="Active ingredients shoppers can browse by. Each one gets its own page and a homepage card."
        actions={
          <Button variant="primary" size="lg" onClick={openCreate}>
            + Add ingredient
          </Button>
        }
      >
        <Toolbar>
          <FilterTabs
            value={photoFilter}
            onChange={setPhotoFilter}
            options={[
              { value: "", label: "All", count: ingredients.length },
              { value: "with", label: "With photo", count: withPhoto },
              { value: "without", label: "No photo", count: ingredients.length - withPhoto, countTone: "warn" },
            ]}
          />
          <SearchBox value={query} onChange={setQuery} placeholder="Search ingredients" />
        </Toolbar>
      </PageHeader>

      <EditorDrawer
        open={!!editingId}
        title={editingId === "new" ? "New ingredient" : "Edit ingredient"}
        description="Shown on the homepage “Shop by ingredient” cards and the ingredient’s own page."
        onClose={() => setEditingId(null)}
        onSubmit={handleSubmit}
        saving={submitting}
        error={error}
        submitLabel={editingId === "new" ? "Add ingredient" : "Save changes"}
      >
        <NameSlugFields
          form={form}
          setForm={setForm}
          urlPrefix="/shop/ingredient/"
          namePlaceholder="e.g. Niacinamide"
          nameHelp="Its common name. Strengths (e.g. 10%) go on the product instead."
        />
        <Field label="Description" help="One or two sentences on what it does for skin.">
          <textarea
            placeholder="e.g. A gentle brightener that fades dark spots and evens skin tone."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={`${inputClass} min-h-[6rem]`}
            rows={3}
          />
        </Field>
        <Field label="Cover photo" help="Square. Used on the homepage card and as the page banner.">
          <ImageUploadField
            value={form.cloudinary_public_id}
            onChange={(publicId) => setForm({ ...form, cloudinary_public_id: publicId })}
            folder="derma-skincare/ingredients"
            aspect={1}
            removable
            hint="Square photo, at least 800 × 800px"
          />
        </Field>
      </EditorDrawer>

      {loading ? (
        <LoadingState>Loading ingredients…</LoadingState>
      ) : shown.length === 0 ? (
        <EmptyState>{ingredients.length ? "No ingredients match." : "No ingredients yet. Add the first one."}</EmptyState>
      ) : (
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-3">
          {shown.map((ingredient, index) => {
            const state = rowState[ingredient.id];
            return (
              <ListRow
                key={ingredient.id}
                thumb={<Thumb imageId={ingredient.cloudinary_public_id} name={ingredient.name} index={index} />}
                title={ingredient.name}
                subtitle={ingredient.description || `/shop/ingredient/${ingredient.slug}`}
                note={state && state !== "deleting" ? state : null}
                badge={!ingredient.cloudinary_public_id && <StatusBadge tone="warn">No photo</StatusBadge>}
                actions={
                  <>
                    <Button onClick={() => openEdit(ingredient)}>Edit</Button>
                    <Button variant="danger" onClick={() => handleDelete(ingredient.id)} disabled={state === "deleting"}>
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
