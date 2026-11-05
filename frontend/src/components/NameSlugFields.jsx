import { slugify, slugifyWhileTyping } from "../lib/slug.js";

/** Labelled Name + URL slug inputs shared by the admin catalog forms. The
 * slug follows the name automatically until the admin edits it by hand,
 * is kept URL-safe as they type, and shows the page address it produces --
 * placeholder-only inputs let descriptive text ("wrinkles, ageing") end up
 * in the slug and break the product/concern URL. */
export default function NameSlugFields({ form, setForm, urlPrefix, namePlaceholder = "Name" }) {
  const slugFollowsName = !form.slug || form.slug === slugify(form.name);

  const onNameChange = (e) => {
    const name = e.target.value;
    setForm({ ...form, name, slug: slugFollowsName ? slugify(name) : form.slug });
  };

  const labelClass = "flex flex-col gap-1 text-xs font-semibold text-ink/70";
  const inputClass = "border border-mist rounded-sm px-3 py-2 text-sm font-normal text-ink";

  return (
    <>
      <label className={labelClass}>
        Name
        <input required placeholder={namePlaceholder} value={form.name} onChange={onNameChange} className={inputClass} />
      </label>
      <label className={labelClass}>
        URL slug
        <input
          required
          placeholder="e.g. anti-ageing-serum"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: slugifyWhileTyping(e.target.value) })}
          className={`${inputClass} font-mono`}
        />
        <span className="font-normal text-ink/50 truncate">
          Page address: {urlPrefix}
          {form.slug || "…"}
        </span>
      </label>
    </>
  );
}
