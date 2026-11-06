import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import client from "../../api/client";
import NameSlugFields from "../../components/NameSlugFields.jsx";
import ImageUploadField from "../../components/ImageUploadField.jsx";
import RichTextEditor from "../../components/admin/RichTextEditor.jsx";
import Field from "../../components/admin/Field.jsx";
import { containerReveal } from "../../components/Reveal.jsx";
import { finalizeSlug, slugify } from "../../lib/slug.js";
import {
  Button,
  EditorDrawer,
  EmptyState,
  ErrorText,
  FilterTabs,
  FormSection,
  ListRow,
  LoadingState,
  PageHeader,
  SearchBox,
  StatusBadge,
  Thumb,
  Toolbar,
  inputClass,
  matches,
  selectClass,
} from "../../components/admin/Kit.jsx";

const STATE = {
  published: { label: "Published", tone: "good" },
  scheduled: { label: "Scheduled", tone: "info" },
  draft: { label: "Draft", tone: "neutral" },
};
const emptyForm = { name: "", slug: "", category_id: "", excerpt: "", cover_public_id: null, body_html: "", seo_description: "", mode: "draft", when: "" };
const fmt = (iso) => (iso ? new Date(iso).toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
// <input type="datetime-local"> wants "YYYY-MM-DDTHH:MM" in local time.
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
// The server stores UTC; posts' published_at come back without an offset.
const asUtc = (iso) => (iso && !/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? `${iso}Z` : iso);

export default function AdminBlog() {
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null); // null | "new" | id
  const [editingPost, setEditingPost] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [catError, setCatError] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([client.get("/admin/blog/posts"), client.get("/admin/blog/categories")])
      .then(([p, c]) => {
        setPosts(p.data);
        setCategories(c.data);
      })
      .catch((err) => setLoadError(err.response?.data?.error || "Couldn't load the blog."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingPost(null);
    setError(null);
    setEditingId("new");
  };
  const openEdit = async (post) => {
    setError(null);
    try {
      const { data } = await client.get(`/admin/blog/posts/${post.id}`);
      setEditingPost(data);
      setForm({
        name: data.title,
        slug: data.slug,
        category_id: data.category?.id || "",
        excerpt: data.excerpt || "",
        cover_public_id: data.cover_public_id,
        body_html: data.body_html || "",
        seo_description: data.seo_description || "",
        mode: data.state === "scheduled" ? "schedule" : data.state === "published" ? "now" : "draft",
        when: data.state === "scheduled" ? toLocalInput(asUtc(data.published_at)) : "",
      });
      setEditingId(data.id);
    } catch (err) {
      setLoadError(err.response?.data?.error || "Couldn't open that post.");
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.mode === "schedule" && (!form.when || new Date(form.when) <= new Date())) {
      setError("Pick a date and time in the future to schedule it.");
      return;
    }
    const payload = {
      title: form.name,
      slug: finalizeSlug(form.slug),
      category_id: form.category_id || null,
      excerpt: form.excerpt,
      cover_public_id: form.cover_public_id,
      body_html: form.body_html,
      seo_description: form.seo_description,
      status: form.mode === "draft" ? "draft" : "published",
    };
    if (form.mode === "schedule") payload.published_at = new Date(form.when).toISOString();
    // "Publish now": keep an already-live post's original date; otherwise now.
    if (form.mode === "now") payload.published_at = editingPost?.state === "published" ? asUtc(editingPost.published_at) : null;
    setSaving(true);
    try {
      if (editingId === "new") await client.post("/admin/blog/posts", payload);
      else await client.patch(`/admin/blog/posts/${editingId}`, payload);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't save this post.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (post) => {
    if (!window.confirm(`Delete “${post.title}”? This can't be undone.`)) return;
    try {
      await client.delete(`/admin/blog/posts/${post.id}`);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (err) {
      setLoadError(err.response?.data?.error || "Couldn't delete that post.");
    }
  };

  // ---- categories (saved as you go) ----
  const addCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    setCatError(null);
    try {
      const { data } = await client.post("/admin/blog/categories", { name, slug: slugify(name), position: categories.length });
      setCategories((prev) => [...prev, data]);
      setNewCat("");
    } catch (err) {
      setCatError(err.response?.data?.error || "Couldn't add that category.");
    }
  };
  const renameCategory = async (cat, name) => {
    if (!name.trim() || name.trim() === cat.name) return;
    setCatError(null);
    try {
      const { data } = await client.patch(`/admin/blog/categories/${cat.id}`, { name: name.trim() });
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? { ...c, ...data } : c)));
    } catch (err) {
      setCatError(err.response?.data?.error || "Couldn't rename that category.");
    }
  };
  const deleteCategory = async (cat) => {
    if (!window.confirm(`Delete the ${cat.name} category?`)) return;
    setCatError(null);
    try {
      await client.delete(`/admin/blog/categories/${cat.id}`);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    } catch (err) {
      setCatError(err.response?.data?.error || "Couldn't delete that category.");
    }
  };

  const count = (st) => posts.filter((p) => p.state === st).length;
  const shown = posts.filter((p) => (!filter || p.state === filter) && matches(query, p.title, p.excerpt, p.category?.name));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      <PageHeader
        title="Blog"
        description="Skincare articles on the shop's Blog. Save drafts, publish straight away, or schedule a post for later."
        actions={
          <>
            <Button size="lg" onClick={() => setCatsOpen(true)}>
              Categories
            </Button>
            <Button variant="primary" size="lg" onClick={openCreate}>
              + New post
            </Button>
          </>
        }
      >
        <Toolbar>
          <FilterTabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: "", label: "All", count: posts.length },
              { value: "published", label: "Published", count: count("published") },
              { value: "scheduled", label: "Scheduled", count: count("scheduled") },
              { value: "draft", label: "Drafts", count: count("draft") },
            ]}
          />
          <SearchBox value={query} onChange={setQuery} placeholder="Search posts" />
        </Toolbar>
      </PageHeader>

      {/* ---------- Post editor ---------- */}
      <EditorDrawer
        open={!!editingId}
        wide
        title={editingId === "new" ? "New post" : "Edit post"}
        description="Write it like you'd explain it to a friend: short paragraphs, a heading every few."
        onClose={() => setEditingId(null)}
        onSubmit={save}
        saving={saving}
        error={error}
        submitLabel={form.mode === "draft" ? "Save draft" : form.mode === "schedule" ? "Schedule post" : editingPost?.state === "published" ? "Update post" : "Publish now"}
      >
        <FormSection title="Basics">
          <NameSlugFields form={form} setForm={setForm} urlPrefix="/blog/" nameLabel="Title" namePlaceholder="e.g. How to layer vitamin C and SPF" nameHelp="The post's headline." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Category" help="Helps readers filter the Blog.">
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className={selectClass}>
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Summary" help="One or two sentences for the Blog page and link previews.">
              <textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} maxLength={400} className={`${inputClass} min-h-[3.25rem]`} />
            </Field>
          </div>
          <Field label="Cover photo" help="Wide (16:9). Shown at the top of the post and on the Blog page.">
            <ImageUploadField
              value={form.cover_public_id}
              onChange={(id) => setForm({ ...form, cover_public_id: id })}
              folder="derma-skincare/blog"
              aspect={16 / 9}
              removable
              hint="Landscape photo, at least 1600px wide"
            />
          </Field>
        </FormSection>

        <FormSection title="Post">
          <RichTextEditor key={editingId || "new"} value={form.body_html} onChange={(html) => setForm((f) => ({ ...f, body_html: html }))} />
        </FormSection>

        <FormSection title="Publishing">
          <div role="radiogroup" aria-label="When to publish" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              ["draft", "Draft", "Only admins can see it."],
              ["now", editingPost?.state === "published" ? "Published" : "Publish now", "Live on the Blog straight away."],
              ["schedule", "Schedule", "Goes live on a date you pick."],
            ].map(([mode, label, help]) => (
              <label
                key={mode}
                className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                  form.mode === mode ? "border-blue bg-blue-50" : "border-mist bg-white hover:border-ink/30"
                }`}
              >
                <input type="radio" name="mode" checked={form.mode === mode} onChange={() => setForm({ ...form, mode })} className="mt-1 w-5 h-5 accent-blue shrink-0" />
                <span>
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-sm text-ink/70">{help}</span>
                </span>
              </label>
            ))}
          </div>
          {form.mode === "schedule" && (
            <Field label="Goes live at" help="Your local time.">
              <input type="datetime-local" value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} className={`${inputClass} sm:max-w-xs`} />
            </Field>
          )}
          <Field label="Search description (optional)" help="What Google shows under the title. Leave blank to use the summary.">
            <textarea value={form.seo_description} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} rows={2} maxLength={300} className={`${inputClass} min-h-[3.25rem]`} />
          </Field>
        </FormSection>
      </EditorDrawer>

      {/* ---------- Categories ---------- */}
      <EditorDrawer
        open={catsOpen}
        title="Blog categories"
        description="Readers filter the Blog by these. Changes save as you go."
        onClose={() => setCatsOpen(false)}
        onSubmit={(e) => {
          e.preventDefault();
          if (newCat.trim()) addCategory();
          else setCatsOpen(false);
        }}
        submitLabel="Done"
        error={catError}
      >
        <ul className="flex flex-col gap-3">
          {categories.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 p-4 bg-bone-light border border-mist rounded-lg">
              <label className="flex-1 min-w-[12rem]">
                <span className="sr-only">Category name</span>
                <input defaultValue={c.name} onBlur={(e) => renameCategory(c, e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())} className={inputClass} />
              </label>
              <span className="text-sm text-ink/70 whitespace-nowrap">{c.post_count || 0} posts</span>
              <Button variant="danger" onClick={() => deleteCategory(c)} disabled={(c.post_count || 0) > 0} title={c.post_count ? "Move its posts first" : undefined}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="New category" className="flex-1 min-w-[12rem]">
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCategory();
                }
              }}
              placeholder="e.g. Skin science"
              className={inputClass}
            />
          </Field>
          <Button variant="secondary" onClick={addCategory}>
            + Add
          </Button>
        </div>
      </EditorDrawer>

      <ErrorText>{loadError}</ErrorText>
      {loading ? (
        <LoadingState>Loading posts…</LoadingState>
      ) : shown.length === 0 ? (
        <EmptyState>{posts.length ? "No posts match." : "No posts yet -- write the first one."}</EmptyState>
      ) : (
        <motion.div initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-3">
          {shown.map((post, index) => {
            const st = STATE[post.state] || STATE.draft;
            return (
              <ListRow
                key={post.id}
                thumb={<Thumb imageId={post.cover_public_id} name={post.title} index={index} wide />}
                title={post.title}
                subtitle={post.excerpt || `/blog/${post.slug}`}
                stats={[
                  { label: "Category", value: post.category?.name || "None" },
                  { label: post.state === "draft" ? "Last edited" : post.state === "scheduled" ? "Goes live" : "Published", value: fmt(asUtc(post.state === "draft" ? post.updated_at : post.published_at)) },
                  { label: "Read", value: `${post.reading_minutes} min` },
                ]}
                badge={<StatusBadge tone={st.tone}>{st.label}</StatusBadge>}
                actions={
                  <>
                    {post.state === "published" && (
                      <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center h-10 px-4 rounded-lg border border-ink/20 bg-white text-[15px] font-semibold hover:border-ink">
                        View
                      </a>
                    )}
                    <Button onClick={() => openEdit(post)}>Edit</Button>
                    <Button variant="danger" onClick={() => remove(post)}>
                      Delete
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
