// Slugs become page URLs (/shop/<slug>, /shop/concern/<slug>...), and the
// backend only accepts lowercase words joined by hyphens.

/** Full conversion, e.g. "Anti Ageing Serum!" -> "anti-ageing-serum". */
export function slugify(value) {
  return finalizeSlug(slugifyWhileTyping(value));
}

/** Same, but keeps a trailing hyphen so typing "anti-" isn't fought. */
export function slugifyWhileTyping(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "");
}

/** Trims leftover edge hyphens before saving. */
export function finalizeSlug(value) {
  return String(value || "").replace(/^-+|-+$/g, "");
}
