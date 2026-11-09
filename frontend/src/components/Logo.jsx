/** The Dermarra wordmark + multicolour icon, from the official brand files
 * in /public/brand. Replaces the old "Dermarra+" text logo.
 *
 * variant="dark"  -> black wordmark, for light backgrounds (default)
 * variant="light" -> white wordmark, for brand-black backgrounds
 * iconOnly        -> just the icon (same light/dark rule)
 *
 * Height drives size; the wordmark's aspect ratio is ~5.2:1. */
export default function Logo({ variant = "dark", iconOnly = false, className = "h-7", title = "Dermarra Skincare" }) {
  const file = iconOnly ? `icon-${variant}.svg` : `logo-${variant}.svg`;
  return <img src={`/brand/${file}`} alt={title} className={`select-none ${/(^|\s)!?w-/.test(className) ? "" : "w-auto "}${className}`} draggable="false" />;
}
