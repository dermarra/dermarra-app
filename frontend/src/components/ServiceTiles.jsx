import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cloudinaryUrl } from "../api/client";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons.jsx";

/** Card grid used for every "Shop by …" section on the landing page
 * (concern, step, ingredient) -- a native port of the owner-supplied Framer
 * component "Component_01" (ServiceTiles). Rebuilt rather than embedded:
 * Framer modules need Framer's runtime and would load third-party code at
 * runtime.
 *
 * Same behaviour as the original: auto-fit grid (cards >= 260px, wrap on
 * their own), numbered image header, accent dot + category, title,
 * description, tag chips, a detail line, and a CTA bar whose accent fill
 * sweeps in left-to-right while the arrow tilts -35deg; the whole card lifts
 * 5px with a soft shadow and the image zooms 1.06x. Same "active" state on
 * keyboard focus; all motion off under prefers-reduced-motion (see the
 * .service-tiles rules in index.css).
 *
 * Brand mapping: accents are brand colours (text on them is ink, 5.2:1+);
 * fonts and sizes follow the site's type rules.
 *
 * Shown as a static carousel (no autoplay): 4 cards per view from `xl`,
 * 3 from `lg`, 2 from `sm`, one-and-a-peek on phones; round prev/next
 * buttons beside the section heading scroll one view at a time and disable at
 * either end (hidden when everything fits). Swipe / trackpad scroll still work.
 *
 * tiles: [{ key, to, title, category, description, imageId, tags[], detail,
 *           cta, accent }]; heading: the section's title + intro, shown left
 * of the arrows. */
export const BRAND_ACCENTS = ["#BBD531", "#F16722", "#1D9CD7", "#CD902D"]; // lime, orange, blue, gold

function Tile({ tile, index }) {
  const number = String(index + 1).padStart(2, "0");
  const imageUrl = cloudinaryUrl(tile.imageId, { width: 640 });
  const titleId = `tile-title-${tile.key}`;
  return (
    <Link
      to={tile.to}
      aria-labelledby={titleId}
      style={{ "--st-accent": tile.accent || BRAND_ACCENTS[index % BRAND_ACCENTS.length] }}
      className="st-card group relative flex flex-col h-full min-w-0 bg-white text-ink border border-mist rounded-2xl isolate transition-[transform,box-shadow] duration-[350ms] ease-[cubic-bezier(.2,.75,.25,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue"
    >
      <div className="relative h-56 shrink-0 overflow-hidden rounded-t-2xl bg-[var(--st-accent)]">
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            draggable="false"
            className="st-image absolute inset-0 w-full h-full object-cover transition-transform duration-[560ms] ease-[cubic-bezier(.2,.75,.25,1)]"
          />
        )}
        <span className="absolute top-3 left-3 inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-md bg-white text-ink text-xs font-semibold tabular-nums">
          {number}
        </span>
      </div>

      <div className="flex flex-1 flex-col min-w-0 p-6">
        {tile.category && (
          <p className="flex items-center gap-2 mb-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink/70">
            <span
              aria-hidden="true"
              className="w-2.5 h-2.5 shrink-0 rounded-full bg-[var(--st-accent)] shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)]"
            />
            {tile.category}
          </p>
        )}
        <h3 id={titleId} lang="en" className="text-2xl font-semibold tracking-tight leading-tight min-h-[2.5em] line-clamp-2 hyphens-auto [overflow-wrap:break-word]">
          {tile.title}
        </h3>
        {/* Always 4 lines tall (clamped) so titles, tags and buttons line up across a row. */}
        <p className="mt-2.5 text-ink/75 leading-relaxed line-clamp-4 min-h-[6.5em]" title={tile.description || undefined}>
          {tile.description}
        </p>

        {tile.tags?.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 mt-5" aria-label="Products">
            {tile.tags.map((tag) => (
              <li
                key={tag}
                className="inline-flex items-center max-w-full px-2.5 py-1 rounded-md bg-bone-light text-ink/75 text-xs font-medium"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-6 min-w-0">
          {tile.detail && <p className="mb-2.5 text-ink/70">{tile.detail}</p>}
          <span className="st-cta relative isolate flex items-center justify-between gap-3 min-h-[3rem] px-4 py-3 overflow-hidden rounded-xl bg-bone-light text-ink text-base font-semibold before:absolute before:inset-0 before:-z-10 before:bg-[var(--st-accent)] before:origin-left before:scale-x-0 before:transition-transform before:duration-[350ms] before:ease-[cubic-bezier(.2,.75,.25,1)]">
            <span className="min-w-0">{tile.cta}</span>
            <ChevronRightIcon className="st-arrow w-4 h-4 shrink-0 transition-transform duration-[350ms] ease-[cubic-bezier(.2,.75,.25,1)]" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function ArrowButton({ dir, disabled, onClick, label }) {
  const Icon = dir === "prev" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-12 h-12 rounded-full border border-ink text-ink flex items-center justify-center transition-colors hover:bg-ink hover:text-white disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

export default function ServiceTiles({ tiles, heading, label = "cards" }) {
  const trackRef = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure, tiles.length]);

  const page = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  };

  const scrollable = !(edges.start && edges.end);

  return (
    <div>
      <div className="flex items-end justify-between gap-6 mb-8">
        <div className="min-w-0">{heading}</div>
        {scrollable && (
          <div className="flex gap-3 shrink-0">
            <ArrowButton dir="prev" disabled={edges.start} onClick={() => page(-1)} label={`Previous ${label}`} />
            <ArrowButton dir="next" disabled={edges.end} onClick={() => page(1)} label={`Next ${label}`} />
          </div>
        )}
      </div>
      <div
        ref={trackRef}
        role="list"
        // Vertical padding leaves room for the hover lift + shadow, which an
        // overflow container would otherwise clip.
        className="service-tiles flex gap-4 overflow-x-auto snap-x snap-mandatory py-3 -my-3 px-1 -mx-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tiles.map((tile, index) => (
          <div
            key={tile.key}
            role="listitem"
            className="shrink-0 snap-start w-[85%] sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-3rem)/4)]"
          >
            <Tile tile={tile} index={index} />
          </div>
        ))}
      </div>
    </div>
  );
}

const kes = (cents) => `KES ${Math.round(cents / 100).toLocaleString("en-KE")}`;

/** "3 products · from KES 1,800" for whichever products match a tile. */
export function productSummary(matching) {
  if (!matching.length) return { tags: [], detail: "New products coming soon" };
  const from = matching.reduce(
    (min, p) => (p.price_from_cents != null && (min == null || p.price_from_cents < min) ? p.price_from_cents : min),
    null
  );
  return {
    tags: matching.slice(0, 3).map((p) => p.name),
    detail: `${matching.length} product${matching.length === 1 ? "" : "s"}${from != null ? ` · from ${kes(from)}` : ""}`,
  };
}
