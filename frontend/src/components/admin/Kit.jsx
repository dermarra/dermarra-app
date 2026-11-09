import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cloudinaryUrl } from "../../api/client";
import { itemReveal } from "../Reveal.jsx";
import { ArrowLeftIcon, SearchIcon, XIcon } from "../Icons.jsx";

/** The admin panel kit -- every admin page builds its header, toolbar, rows,
 * badges and buttons from these, so the panels stay identical (agreed design:
 * the "Dermarra Admin Panel System" canvas, 2026-11-06).
 *
 * Rules baked in here, not repeated per page:
 *  - one corner radius: 8px (`rounded-lg`) on rows, thumbs, buttons, badges,
 *    inputs, filter tabs;
 *  - buttons: one type style (15px semibold), two heights -- `lg` 48px in a
 *    page header, `md` 40px in a row;
 *  - badges: one size (14px semibold, 12px top/bottom, min width so a column
 *    of them lines up), tinted fill + dark text of the same colour (6.4-14:1);
 *  - stat labels: 14px semibold caps, never wrapping; values 20px, same font
 *    as everything else (no monospace);
 *  - grey text is ink/70 (5.9:1 on white), never fainter. */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg text-[15px] leading-none font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue";
const BUTTON_SIZE = { lg: "h-[52px] px-6", md: "h-10 px-4" }; // = storefront .btn / .btn-sm
const BUTTON_VARIANT = {
  primary: "bg-blue text-ink hover:bg-blue-400",
  secondary: "bg-white text-ink border border-ink hover:bg-ink hover:text-white",
  quiet: "bg-white text-ink border border-ink/20 hover:border-ink",
  danger: "bg-white text-orange-700 border border-orange-700 hover:bg-orange-700 hover:text-white",
};

export const buttonClass = ({ variant = "quiet", size = "md", className = "" } = {}) =>
  `${BUTTON_BASE} ${BUTTON_SIZE[size]} ${BUTTON_VARIANT[variant]} ${className}`;

/** <Button variant="primary|secondary|quiet|danger" size="lg|md">. Pass `to`
 * to render a router Link styled as the same button. */
export function Button({ variant = "quiet", size = "md", to, className = "", type = "button", children, ...rest }) {
  const cls = buttonClass({ variant, size, className });
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}

/** Text inputs / selects / textareas in admin forms share this look. */
export const inputClass =
  "w-full min-w-0 rounded-lg border border-ink/20 bg-white px-4 py-[11px] min-h-[52px] text-base font-normal text-ink placeholder:text-ink/60 focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/30";

export const selectClass = `${inputClass} admin-select`; // arrow: .admin-select in index.css

/** On/off switch with a label and one-line hint -- replaces bare checkboxes
 * ("Active", "Featured"). Still a real checkbox underneath (keyboard + screen
 * readers), styled as a track + knob in brand blue. */
export function Toggle({ checked, onChange, label, help, disabled = false }) {
  return (
    <label className={`flex items-start gap-4 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={!!checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="block w-12 h-7 rounded-full bg-ink/25 transition-colors peer-checked:bg-blue peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue" />
        <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {help && <span className="block text-sm leading-snug text-ink/70">{help}</span>}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------- header

/** Title + one-line purpose on the left, actions on the right; `children`
 * (usually a <Toolbar>) sits underneath. Every admin page starts with this. */
export function PageHeader({ title, description, actions, children }) {
  return (
    <div className="flex flex-col gap-7 mb-7">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight text-ink">{title}</h2>
          {description && <p className="mt-2.5 text-ink/70 max-w-3xl">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** Filter tabs (with counts) on the left, search on the right. */
export function Toolbar({ children }) {
  return <div className="flex flex-wrap items-center justify-between gap-4">{children}</div>;
}

export function FilterTabs({ options, value, onChange, label = "Filter" }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1 p-1 bg-white border border-mist rounded-lg">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`h-10 px-4 rounded-lg text-[15px] font-semibold whitespace-nowrap transition-colors ${
              active ? "bg-ink text-white" : "text-ink hover:bg-blue-50"
            }`}
          >
            {o.label}
            {o.count != null && (
              <span className={`ml-1.5 tabular-nums ${active ? "text-white/80" : o.countTone === "warn" && o.count > 0 ? "text-orange-700" : "text-ink/70"}`}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search", label = "Search" }) {
  return (
    <label className="flex items-center gap-2.5 h-[52px] w-full sm:w-[340px] px-4 bg-white border border-ink/20 rounded-lg focus-within:border-blue focus-within:ring-2 focus-within:ring-blue/30">
      <SearchIcon className="w-4 h-4 text-ink/70 shrink-0" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent text-base text-ink placeholder:text-ink/60 outline-none"
      />
    </label>
  );
}

/** Case-insensitive "does any of these fields contain the query". */
export const matches = (query, ...fields) => {
  const q = query.trim().toLowerCase();
  return !q || fields.some((f) => (f || "").toString().toLowerCase().includes(q));
};

// ---------------------------------------------------------------- rows

const TINTS = [
  "bg-lime-100 text-lime-900",
  "bg-orange-100 text-orange-800",
  "bg-blue-100 text-blue-800",
  "bg-gold-100 text-gold-900",
];

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

/** 56px picture: the photo, or initials on a brand tint -- never an empty box. */
export function Thumb({ imageId, name, index = 0, round = false, wide = false }) {
  const url = cloudinaryUrl(imageId, { width: 160 });
  const shape = `${wide ? "w-20" : "w-14"} h-14 shrink-0 overflow-hidden ${round ? "rounded-full" : "rounded-lg"}`;
  if (url) return <img src={url} alt="" className={`${shape} object-cover bg-mist`} loading="lazy" />;
  return (
    <span aria-hidden="true" className={`${shape} flex items-center justify-center font-bold ${round ? "text-xl" : "text-base"} ${TINTS[index % TINTS.length]}`}>
      {round ? initials(name).slice(0, 1) : initials(name)}
    </span>
  );
}

export function Stat({ label, value, tone }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/70 whitespace-nowrap">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tabular-nums whitespace-nowrap ${tone === "warn" ? "text-orange-700" : "text-ink"}`}>{value}</p>
    </div>
  );
}

const BADGE_TONE = {
  good: "bg-lime-100 text-lime-900",
  warn: "bg-orange-100 text-orange-800",
  bad: "bg-mist text-ink",
  info: "bg-blue-100 text-blue-800",
  neutral: "bg-mist text-ink",
  admin: "bg-gold-100 text-gold-900",
};

export function StatusBadge({ tone = "neutral", children }) {
  return (
    <span className={`inline-flex items-center justify-center min-w-[7rem] px-3 py-3 rounded-lg text-xs font-semibold leading-none whitespace-nowrap ${BADGE_TONE[tone]}`}>
      {children}
    </span>
  );
}

/** One row: thumb | title + sub-line | stats | badge | actions. `below`
 * renders full-width under the row (inline editors, expanded details). */
export function ListRow({ thumb, title, subtitle, note, stats, badge, actions, below, statCols }) {
  const cols = statCols || stats?.length || 0;
  return (
    <motion.div variants={itemReveal} className="bg-white border border-mist rounded-lg">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-6 py-5">
        {thumb}
        <div className="flex-[1_1_220px] min-w-0">
          <div className="text-lg font-semibold text-ink leading-snug [overflow-wrap:anywhere]">{title}</div>
          {subtitle && <div className="mt-1 text-ink/70 leading-snug line-clamp-2 [overflow-wrap:anywhere]">{subtitle}</div>}
          {note && <div className="mt-1.5 text-sm text-orange-700">{note}</div>}
        </div>
        {stats?.length > 0 && (
          <div
            className="grid gap-x-8 gap-y-3 flex-[2_1_360px] grid-cols-2 md:[grid-template-columns:repeat(var(--cols),minmax(max-content,1fr))]"
            style={{ "--cols": cols }}
          >
            {stats.map((s) => (
              <Stat key={s.label} {...s} />
            ))}
          </div>
        )}
        {badge}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {below}
    </motion.div>
  );
}

// ---------------------------------------------------------------- editor

/** Create/edit forms open in this side panel instead of inline in the list:
 * title + close at the top, fields scroll in the middle, Cancel / Save fixed
 * at the bottom. Esc or a click outside closes it. Renders a real <form>, so
 * Enter in a text field submits (callers keep their own guards). */
export function EditorDrawer({ open, title, description, onClose, onSubmit, saving, submitLabel = "Save", error, wide = false, children }) {
  const firstFieldRef = useRef(null);
  // Callers pass a fresh onClose on every render (inline arrow), so keep the
  // latest in a ref: the effect below must run only when the drawer opens.
  // It used to depend on onClose, so every keystroke re-ran it and its
  // "focus the first field" timer yanked the cursor back to the Name box.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => firstFieldRef.current?.querySelector("input, textarea, select")?.focus(), 250);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-ink/50"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.form
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-title"
            onSubmit={onSubmit}
            className={`absolute inset-y-0 right-0 w-full ${wide ? "max-w-4xl" : "max-w-2xl"} bg-white text-ink shadow-xl flex flex-col`}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.28, ease: [0.2, 0.75, 0.25, 1] }}
          >
            <div className="flex items-start justify-between gap-4 px-6 sm:px-8 py-6 border-b border-mist">
              <div className="min-w-0">
                <h3 id="editor-title" className="text-3xl font-semibold leading-tight">{title}</h3>
                {description && <p className="mt-1.5 text-ink/70">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-11 h-11 -mr-2 shrink-0 rounded-lg flex items-center justify-center hover:bg-blue-50"
              >
                <XIcon className="w-[18px] h-[18px]" />
              </button>
            </div>
            <div ref={firstFieldRef} className="flex-1 overflow-y-auto px-6 sm:px-8 py-7 flex flex-col gap-6">
              {children}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 px-6 sm:px-8 py-5 border-t border-mist bg-white">
              {error && <p className="mr-auto text-orange-700">{error}</p>}
              <Button variant="quiet" size="lg" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" size="lg" type="submit" disabled={saving}>
                {saving ? "Saving…" : submitLabel}
              </Button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Groups related fields inside an editor with a small heading. */
export function FormSection({ title, children }) {
  return (
    <fieldset className="flex flex-col gap-5 min-w-0">
      {title && <legend className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink/70">{title}</legend>}
      {children}
    </fieldset>
  );
}

/** A titled white section on detail pages (batches, history, order items). */
export function Panel({ title, description, actions, children, className = "" }) {
  return (
    <section className={`bg-white border border-mist rounded-lg p-6 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            {title && <h3 className="text-2xl font-semibold leading-tight">{title}</h3>}
            {description && <p className="mt-1 text-ink/70">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Tables inside panels: 14px caps headers, roomy rows, hairline dividers. */
export const tableClass =
  "w-full text-left [&_th]:pb-3 [&_th]:pr-4 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-ink/70 [&_th]:whitespace-nowrap [&_td]:py-3 [&_td]:pr-4 [&_td]:border-t [&_td]:border-mist [&_td]:align-top";

/** A "Back to …" link (Simple Line arrow) above a detail page's header. */
export function BackLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 mb-5 text-[15px] font-semibold text-ink/70 hover:text-ink">
      <ArrowLeftIcon className="w-3.5 h-3.5" /> {children}
    </Link>
  );
}

export function EmptyState({ children }) {
  return <p className="py-10 text-center text-ink/70 bg-white border border-dashed border-ink/20 rounded-lg">{children}</p>;
}

export function LoadingState({ children = "Loading…" }) {
  return <p className="text-ink/70">{children}</p>;
}

export function ErrorText({ children }) {
  return children ? <p className="text-orange-700">{children}</p> : null;
}
