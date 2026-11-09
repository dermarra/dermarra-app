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

export default function AdminConcerns() {
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null); // null | "new" | concernId
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [rowState, setRowState] = useState({});
  const [query, setQuery] = useState("");
  const [photoFilter, setPhotoFilter] = useState("");

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
        slug: finalizeSlug(form.slug),
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
    if (!window.confirm("Delete this concern? It will be removed from every product tagged with it.")) return;
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

  const withPhoto = concerns.filter((c) => c.cloudinary_public_id).length;
  const shown = concerns.filter(
    (c) =>
      (photoFilter === "" || (photoFilter === "with" ? c.cloudinary_public_id : !c.cloudinary_public_id)) &&
      matches(query, c.name, c.slug, c.description)
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      <PageHeader
        title="Concerns"
        description="Skin concerns shoppers browse by and answer in the routine quiz. Each gets a page and a homepage card."
        actions={
          <Button variant="primary" size="lg" onClick={openCreate}>
            + Add concern
          </Button>
        }
      >
        <Toolbar>
          <FilterTabs
            value={photoFilter}
            onChange={setPhotoFilter}
            options={[
              { value: "", label: "All", count: concerns.length },
              { value: "with", label: "With photo", count: withPhoto },
              { value: "without", label: "No photo", count: concerns.length - withPhoto, countTone: "warn" },
            ]}
          />
          <SearchBox value={query} onChange={setQuery} placeholder="Search concerns" />
        </Toolbar>
      </PageHeader>

      <EditorDrawer
        open={!!editingId}
        title={editingId === "new" ? "New concern" : "Edit concern"}
        description="Shown on the homepage “Shop by concern” cards, its own page and the routine quiz."
        onClose={() => setEditingId(null)}
        onSubmit={handleSubmit}
        saving={submitting}
        error={error}
        submitLabel={editingId === "new" ? "Add concern" : "Save changes"}
      >
        <NameSlugFields
          form={form}
          setForm={setForm}
          urlPrefix="/shop/concern/"
          namePlaceholder="e.g. Hyperpigmentation"
          nameHelp="Short name, used as the page heading."
        />
        <Field label="Quiz wording" help="How a customer would describe it. The quiz shows this on the answer tile.">
          <textarea
            placeholder="e.g. Dark spots or patches that won't fade"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={`${inputClass} min-h-[6rem]`}
            rows={3}
          />
        </Field>
        <Field label="Cover photo" help="Square. Used on the homepage card, the quiz tile and the page banner.">
          <ImageUploadField
            value={form.cloudinary_public_id}
            onChange={(publicId) => setForm({ ...form, cloudinary_public_id: publicId })}
            folder="derma-skincare/concerns"
            aspect={1}
            removable
            hint="Square photo, at least 800 × 800px"
          />
        </Field>
      </EditorDrawer>

      {loading ? (
        <LoadingState>Loading concerns…</LoadingState>
      ) : shown.length === 0 ? (
        <EmptyState>{concerns.length ? "No concerns match." : "No concerns yet. Add the first one."}</EmptyState>
      ) : (
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-3">
          {shown.map((concern, index) => {
            const state = rowState[concern.id];
            return (
              <ListRow
                key={concern.id}
                thumb={<Thumb imageId={concern.cloudinary_public_id} name={concern.name} index={index} />}
                title={concern.name}
                subtitle={concern.description || `/shop/concern/${concern.slug}`}
                note={state && state !== "deleting" ? state : null}
                badge={!concern.cloudinary_public_id && <StatusBadge tone="warn">No photo</StatusBadge>}
                actions={
                  <>
                    <Button onClick={() => openEdit(concern)}>Edit</Button>
                    <Button variant="danger" onClick={() => handleDelete(concern.id)} disabled={state === "deleting"}>
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
