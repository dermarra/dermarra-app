import { slugify, slugifyWhileTyping } from "../lib/slug.js";
import Field from "./admin/Field.jsx";

/** Labelled Name + URL slug inputs shared by the admin catalog forms. The
 * slug follows the name automatically until the admin edits it by hand,
 * is kept URL-safe as they type, and shows the page address it produces --
 * placeholder-only inputs let descriptive text ("wrinkles, ageing") end up
 * in the slug and break the product/concern URL. */
export default function NameSlugFields({ form, setForm, urlPrefix, namePlaceholder = "Name", nameHelp }) {
  const slugFollowsName = !form.slug || form.slug === slugify(form.name);

  const onNameChange = (e) => {
    const name = e.target.value;
    setForm({ ...form, name, slug: slugFollowsName ? slugify(name) : form.slug });
  };

  const inputClass = "border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink";

  return (
    <>
      <Field label="Name" help={nameHelp || "Shown to customers exactly as typed."}>
        <input required placeholder={namePlaceholder} value={form.name} onChange={onNameChange} className={inputClass} />
      </Field>
      <Field
        label="URL slug"
        help={
          <>
            Filled in from the name automatically. Lowercase words joined by hyphens only -- not tags or
            descriptions. Page address: <span className="font-mono">{urlPrefix}{form.slug || "…"}</span>
          </>
        }
      >
        <input
          required
          placeholder="e.g. anti-ageing-serum"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: slugifyWhileTyping(e.target.value) })}
          className={`${inputClass} font-mono`}
        />
      </Field>
    </>
  );
}
