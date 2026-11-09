import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInView, useReducedMotion } from "framer-motion";
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
 * Shown as a carousel: 4 cards per view from `xl`, 3 from `lg`, 2 from
 * `sm`, one-and-a-peek on phones. Round prev/next buttons sit on the left
 * and right edges, centred on the cards, move one card and wrap round at
 * the ends; when there's more than fits, it also slides one card every
 * 4.5s (paused on hover/focus/off-screen/reduced motion). Hidden when
 * everything fits. Swipe / trackpad scroll still work.
 *
 * tiles: [{ key, to, title, category, description, imageId, tags[], detail,
 *           cta, accent }]; heading: the section's title + intro, shown left
 * of the arrows. `variant`: "full" (default), "compact" (photo + one button
 * named after the tile -- concern cards) or "step" (compact design + step
 * heading, a step line from tile.step {index,total}, description and a
 * "View all" button -- step cards). */
export const BRAND_ACCENTS = ["#BBD531", "#F16722", "#1D9CD7", "#CD902D"]; // lime, orange, blue, gold

function CtaBar({ children }) {
  return (
    <span className="st-cta relative isolate flex items-center justify-between gap-3 min-h-[52px] px-4 py-3 overflow-hidden rounded-lg bg-bone-light text-ink text-[15px] font-semibold before:absolute before:inset-0 before:-z-10 before:bg-[var(--st-accent)] before:origin-left before:scale-x-0 before:transition-transform before:duration-[350ms] before:ease-[cubic-bezier(.2,.75,.25,1)]">
      {children}
      <ChevronRightIcon className="st-arrow w-4 h-4 shrink-0 transition-transform duration-[350ms] ease-[cubic-bezier(.2,.75,.25,1)]" />
    </span>
  );
}

function Tile({ tile, index, variant }) {
  const compact = variant === "compact";
  const number = String(index + 1).padStart(2, "0");
  const imageUrl = cloudinaryUrl(tile.imageId, { width: 640 });
  const titleId = `tile-title-${tile.key}`;
  return (
    <Link
      to={tile.to}
      aria-labelledby={titleId}
      style={{ "--st-accent": tile.accent || BRAND_ACCENTS[index % BRAND_ACCENTS.length] }}
      className="st-card group relative flex flex-col h-full min-w-0 bg-white text-ink border border-mist rounded-lg isolate transition-[transform,box-shadow] duration-[350ms] ease-[cubic-bezier(.2,.75,.25,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue"
    >
      <div className="relative h-56 shrink-0 overflow-hidden rounded-t-lg bg-[var(--st-accent)]">
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
        <span className="absolute top-3 left-3 inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-lg bg-white text-ink text-xs font-semibold tabular-nums">
          {number}
        </span>
      </div>

      {compact ? (
        // Compact (owner, 2026-11-10, concern cards): just the photo and one
        // button named after the tile -- no category, text or tags.
        <div className="p-4">
          <CtaBar>
            <span id={titleId} className="min-w-0">{tile.title}</span>
          </CtaBar>
        </div>
      ) : variant === "step" ? (
        // Step cards (owner, 2026-11-10): the concern-card design plus the
        // step heading, a 4-segment step line (this card's steps in its
        // brand colour, the rest ink) and the description.
        <div className="flex flex-1 flex-col min-w-0 p-6">
          <h3 id={titleId} className="text-2xl font-semibold tracking-tight leading-tight">
            {tile.title}
          </h3>
          {tile.step && (
            <span className="mt-3 flex gap-1.5" role="img" aria-label={`Step ${tile.step.index} of ${tile.step.total}`}>
              {Array.from({ length: tile.step.total }, (_, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className="h-[3px] w-6 rounded-full"
                  style={{ backgroundColor: i < tile.step.index ? "var(--st-accent)" : "#231F20" }}
                />
              ))}
            </span>
          )}
          <p className="mt-4 text-ink/75 leading-relaxed line-clamp-3 min-h-[4.875em]" title={tile.description || undefined}>
            {tile.description}
          </p>
          <div className="mt-auto pt-6">
            <CtaBar>
              <span className="min-w-0">{tile.cta || "View all"}</span>
            </CtaBar>
          </div>
        </div>
      ) : (
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
                className="inline-flex items-center max-w-full px-2.5 py-1 rounded-lg bg-bone-light text-ink/75 text-xs font-medium"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-6 min-w-0">
          {tile.detail && <p className="mb-2.5 text-ink/70">{tile.detail}</p>}
          <span className="st-cta relative isolate flex items-center justify-between gap-3 min-h-[3rem] px-4 py-3 overflow-hidden rounded-lg bg-bone-light text-ink text-base font-semibold before:absolute before:inset-0 before:-z-10 before:bg-[var(--st-accent)] before:origin-left before:scale-x-0 before:transition-transform before:duration-[350ms] before:ease-[cubic-bezier(.2,.75,.25,1)]">
            <span className="min-w-0">{tile.cta}</span>
            <ChevronRightIcon className="st-arrow w-4 h-4 shrink-0 transition-transform duration-[350ms] ease-[cubic-bezier(.2,.75,.25,1)]" />
          </span>
        </div>
      </div>
      )}
    </Link>
  );
}

function ArrowButton({ dir, onClick, label, className = "" }) {
  const Icon = dir === "prev" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white border border-ink text-ink shadow-md flex items-center justify-center transition-colors hover:bg-ink hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

const AUTO_STEP_MS = 4500;

export default function ServiceTiles({ tiles, heading, label = "cards", variant = "full" }) {
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const [scrollable, setScrollable] = useState(false);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0); // bumps on manual moves, restarting the auto timer
  const inView = useInView(rootRef, { margin: "0px 0px -15% 0px" });
  const reduced = useReducedMotion();

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (el) setScrollable(el.scrollWidth > el.clientWidth + 2);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, tiles.length]);

  // Move by one card; past either end it wraps round, so the arrows never
  // dead-end and the auto-slide can keep going.
  const step = useCallback(
    (dir) => {
      const el = trackRef.current;
      if (!el) return;
      const card = el.firstElementChild;
      const by = card ? card.getBoundingClientRect().width + 16 : el.clientWidth;
      const max = el.scrollWidth - el.clientWidth;
      const behavior = reduced ? "auto" : "smooth";
      if (dir > 0 && el.scrollLeft >= max - 2) el.scrollTo({ left: 0, behavior });
      else if (dir < 0 && el.scrollLeft <= 2) el.scrollTo({ left: max, behavior });
      else el.scrollBy({ left: dir * by, behavior });
    },
    [reduced]
  );
  const manual = (dir) => {
    step(dir);
    setTick((t) => t + 1);
  };

  // Slides in moments (owner, 2026-11-10): one card every few seconds, then
  // a pause -- so shoppers see there's more. Stops while hovered/focused,
  // off screen, or under prefers-reduced-motion.
  useEffect(() => {
    if (!scrollable || paused || !inView || reduced) return undefined;
    const id = setInterval(() => step(1), AUTO_STEP_MS);
    return () => clearInterval(id);
  }, [scrollable, paused, inView, reduced, step, tick]);

  return (
    <div ref={rootRef}>
      <div className="mb-8 min-w-0">{heading}</div>
      <div
        className="relative"
        onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
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
              <Tile tile={tile} index={index} variant={variant} />
            </div>
          ))}
        </div>
        {scrollable && (
          <>
            <ArrowButton dir="prev" onClick={() => manual(-1)} label={`Previous ${label}`} className="left-0 -translate-x-1/3 sm:-translate-x-1/2" />
            <ArrowButton dir="next" onClick={() => manual(1)} label={`Next ${label}`} className="right-0 translate-x-1/3 sm:translate-x-1/2" />
          </>
        )}
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
