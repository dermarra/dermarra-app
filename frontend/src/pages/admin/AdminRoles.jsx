import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import client from "../../api/client";
import Field from "../../components/admin/Field.jsx";
import { containerReveal } from "../../components/Reveal.jsx";
import {
  Button,
  EditorDrawer,
  EmptyState,
  ErrorText,
  FormSection,
  ListRow,
  LoadingState,
  PageHeader,
  StatusBadge,
  Thumb,
  Toggle,
  inputClass,
} from "../../components/admin/Kit.jsx";

const emptyForm = { name: "", description: "", permissions: [] };

/** Roles & access: editable bundles of admin permissions. The super-admin
 * role always has everything and is locked. Who has which role is set on
 * the Users page. */
export default function AdminRoles() {
  const [roles, setRoles] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editingId, setEditingId] = useState(null); // null | "new" | roleId
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [rowError, setRowError] = useState({});

  const load = () => {
    setLoading(true);
    Promise.all([client.get("/admin/roles"), client.get("/admin/permissions")])
      .then(([r, p]) => {
        setRoles(r.data);
        setCatalogue(p.data);
      })
      .catch((err) => setLoadError(err.response?.data?.error || "Couldn't load roles."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const groups = catalogue.reduce((acc, p) => {
    (acc[p.group] ||= []).push(p);
    return acc;
  }, {});

  const openCreate = () => {
    setForm(emptyForm);
    setError(null);
    setEditingId("new");
  };
  const openEdit = (role) => {
    setForm({ name: role.name, description: role.description || "", permissions: role.permissions });
    setError(null);
    setEditingId(role.id);
  };
  const toggle = (key, on) =>
    setForm((f) => ({ ...f, permissions: on ? [...new Set([...f.permissions, key])] : f.permissions.filter((k) => k !== key) }));

  const save = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (editingId === "new") await client.post("/admin/roles", form);
      else await client.patch(`/admin/roles/${editingId}`, form);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't save this role.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (role) => {
    if (!window.confirm(`Delete the ${role.name} role?`)) return;
    try {
      await client.delete(`/admin/roles/${role.id}`);
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
    } catch (err) {
      setRowError((s) => ({ ...s, [role.id]: err.response?.data?.error || "Couldn't delete this role." }));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      <PageHeader
        title="Roles & access"
        description="What each kind of admin can see and do. Choose who has which role on the Users page."
        actions={
          <Button variant="primary" size="lg" onClick={openCreate}>
            + Add role
          </Button>
        }
      />

      <EditorDrawer
        open={!!editingId}
        wide
        title={editingId === "new" ? "New role" : `Edit ${form.name || "role"}`}
        description="Changes apply straight away to everyone with this role."
        onClose={() => setEditingId(null)}
        onSubmit={save}
        saving={saving}
        error={error}
        submitLabel={editingId === "new" ? "Add role" : "Save changes"}
      >
        <FormSection title="About">
          <Field label="Name" help="e.g. Packers or Weekend support.">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Packers" className={inputClass} />
          </Field>
          <Field label="Description (optional)" help="One line on who this role is for.">
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Packs and sends orders on weekends"
              className={inputClass}
            />
          </Field>
        </FormSection>
        {Object.entries(groups).map(([group, perms]) => (
          <FormSection key={group} title={group}>
            {perms.map((p) => (
              <Toggle
                key={p.key}
                checked={form.permissions.includes(p.key)}
                onChange={(on) => toggle(p.key, on)}
                label={p.label}
                help={p.help}
              />
            ))}
          </FormSection>
        ))}
      </EditorDrawer>

      <ErrorText>{loadError}</ErrorText>
      {loading ? (
        <LoadingState>Loading roles…</LoadingState>
      ) : roles.length === 0 ? (
        <EmptyState>No roles yet.</EmptyState>
      ) : (
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-3">
          {roles.map((role, index) => (
            <ListRow
              key={role.id}
              thumb={<Thumb name={role.name} index={index} />}
              title={role.name}
              subtitle={role.description}
              note={rowError[role.id]}
              stats={[
                { label: "People", value: role.member_count ?? 0 },
                { label: "Permissions", value: role.is_super ? "All" : `${role.permissions.length} of ${catalogue.length || "…"}` },
              ]}
              badge={role.is_super ? <StatusBadge tone="admin">Locked</StatusBadge> : <StatusBadge tone="info">Editable</StatusBadge>}
              actions={
                role.is_super ? (
                  <span className="max-w-[12rem] text-sm leading-snug text-ink/70">Always has every permission.</span>
                ) : (
                  <>
                    <Button onClick={() => openEdit(role)}>Edit</Button>
                    <Button variant="danger" onClick={() => remove(role)} disabled={(role.member_count ?? 0) > 0} title={role.member_count ? "Move its people to another role first" : undefined}>
                      Delete
                    </Button>
                  </>
                )
              }
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
