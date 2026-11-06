import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import client from "../../api/client";
import Field from "../../components/admin/Field.jsx";
import ImageUploadField from "../../components/ImageUploadField.jsx";
import { containerReveal } from "../../components/Reveal.jsx";
import { Button, EditorDrawer, ListRow, LoadingState, PageHeader, Thumb, inputClass } from "../../components/admin/Kit.jsx";

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

  const STEP_TYPE_NAMES = { cleanser: "Cleansers", serum: "Serums", barrier_cream: "Barrier creams", spf: "SPF" };
  const editing = groups.find((g) => g.id === editingId);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      <PageHeader
        title="Shop by Step"
        description="The four fixed steps on the homepage. You can rename them and change their wording and photo; they can't be added or removed."
      />

      <EditorDrawer
        open={!!editingId}
        title={editing ? `Edit ${editing.label}` : "Edit step"}
        description={editing ? `Shows ${STEP_TYPE_NAMES[editing.step_type] || editing.step_type} on the homepage and its shop page.` : undefined}
        onClose={() => setEditingId(null)}
        onSubmit={handleSubmit}
        saving={submitting}
        error={error}
        submitLabel="Save changes"
      >
        <Field label="Name" help="e.g. Step 01: Prep">
          <input required placeholder="e.g. Step 02: Treat" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Description" help="One line on what this step does. Leave blank for the default wording.">
          <textarea
            placeholder="e.g. Actives dosed at the concentration that actually changes skin."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={`${inputClass} min-h-[5rem]`}
            rows={2}
          />
        </Field>
        <Field label="Photo" help="Square. Used on the homepage card and the page banner.">
          <ImageUploadField
            value={form.cloudinary_public_id}
            onChange={(publicId) => setForm({ ...form, cloudinary_public_id: publicId })}
            folder="derma-skincare/step-groups"
            aspect={1}
            removable
            hint="Square photo, at least 800 × 800px"
          />
        </Field>
      </EditorDrawer>

      {loading ? (
        <LoadingState />
      ) : (
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-3">
          {groups.map((group, index) => (
            <ListRow
              key={group.id}
              thumb={<Thumb imageId={group.cloudinary_public_id} name={group.label} index={index} />}
              title={group.label}
              subtitle={group.description || "Using the default wording."}
              stats={[{ label: "Shows", value: STEP_TYPE_NAMES[group.step_type] || group.step_type }]}
              actions={<Button onClick={() => openEdit(group)}>Edit</Button>}
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
