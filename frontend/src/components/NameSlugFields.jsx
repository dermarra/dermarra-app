import { useState } from "react";
import { slugify, slugifyWhileTyping } from "../lib/slug.js";
import Field from "./admin/Field.jsx";
import { inputClass } from "./admin/Kit.jsx";

/** Name + its page address, shared by the admin catalog forms. The address
 * (slug) follows the name automatically and is shown as a plain line --
 * "Page address: dermarra.com/shop/ingredient/niacinamide · Edit" -- rather
 * than a second code-style box, since admins almost never need to change it.
 * "Edit" opens the input for the rare manual fix; it stays URL-safe as they
 * type. No `urlPrefix` (e.g. routines, which have no page) shows it as a
 * "Reference" instead. Slugs must match ^[a-z0-9]+(-[a-z0-9]+)*$ (see CLAUDE.md). */
export default function NameSlugFields({ form, setForm, urlPrefix, namePlaceholder = "Name", nameHelp }) {
  const slugFollowsName = !form.slug || form.slug === slugify(form.name);
  const [editingSlug, setEditingSlug] = useState(false);

  const onNameChange = (e) => {
    const name = e.target.value;
    setForm({ ...form, name, slug: slugFollowsName ? slugify(name) : form.slug });
  };

  return (
    <div className="flex flex-col gap-2">
      <Field label="Name" help={nameHelp}>
        <input required placeholder={namePlaceholder} value={form.name} onChange={onNameChange} className={inputClass} />
      </Field>
      {editingSlug ? (
        <Field label={urlPrefix ? "Page address" : "Reference"} help="Lowercase words joined by hyphens, e.g. vitamin-c-serum.">
          <div className="flex items-center rounded-lg border border-ink/20 bg-white focus-within:border-blue focus-within:ring-2 focus-within:ring-blue/30">
            {urlPrefix && <span className="pl-4 text-ink/70 whitespace-nowrap">{urlPrefix}</span>}
            <input
              required
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: slugifyWhileTyping(e.target.value) })}
              className={`flex-1 min-w-0 bg-transparent py-2.5 pr-4 ${urlPrefix ? "" : "pl-4"} text-base text-ink outline-none`}
            />
          </div>
        </Field>
      ) : (
        <p className="text-sm text-ink/70 [overflow-wrap:anywhere]">
          {urlPrefix ? "Page address: " : "Reference: "}
          <span className="text-ink">
            {urlPrefix ? `dermarra.com${urlPrefix}` : ""}
            {form.slug || "…"}
          </span>
          {" · "}
          <button type="button" onClick={() => setEditingSlug(true)} className="font-semibold text-blue-700 underline underline-offset-2">
            Edit
          </button>
        </p>
      )}
    </div>
  );
}
