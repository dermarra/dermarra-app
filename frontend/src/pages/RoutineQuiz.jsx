import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, Reorder, useReducedMotion } from "framer-motion";
import client, { cloudinaryUrl } from "../api/client";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { BRAND_ACCENTS } from "../components/ServiceTiles.jsx";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MenuIcon,
  XIcon,
} from "../components/Icons.jsx";

/** Routine builder (/quiz). The questions run as an "Accordion in Motion"
 * (see QuestionAccordion below; owner, 2026-11-10): numbered questions on
 * the left -- skin type, top-3 concerns, then ranking them when more than
 * one is picked -- each moved on with a Next button; the answers panel on
 * the right follows the open question (pills, photo tiles, the drag/arrow
 * ranking list). Then a results page: greeting, the ranked concerns, and
 * the routine grouped by step (Prep / Treat / Seal / Protect) with an
 * AM / PM toggle.
 *
 * Only asks what the matcher uses: POST /routines/quiz takes one concern and
 * an optional skin type. The concern ranked first is sent; if no routine
 * exists for it yet, the next-ranked concern is tried. */

const SKIN_TYPES = [
  { value: "normal", label: "Balanced" },
  { value: "dry", label: "Dry" },
  { value: "oily", label: "Oily" },
  { value: "combination", label: "Combination" },
  { value: "sensitive", label: "Sensitive" },
  { value: null, label: "Not sure" },
];

const MAX_CONCERNS = 3;
// Same step line as the homepage step cards: this step's brand colour for
// the steps so far, ink for the rest (lime, orange, blue, gold).
const STEP_LINE = ["#BBD531", "#F16722", "#1D9CD7", "#CD902D"];
const RANK_LABELS = ["Primary concern", "Secondary concern", "Tertiary concern"];

const WHY = {
  skin: {
    title: "Why we ask about your skin type",
    body: [
      "Skin type changes which textures suit you: a rich barrier cream that comforts dry skin can feel heavy on oily skin, and a light gel that suits oily skin can leave dry skin tight.",
      "If you're not sure, think about how your skin feels a few hours after washing it, or choose “Not sure” and we'll match on your concerns alone.",
    ],
  },
  concerns: {
    title: "Why we ask about your concerns",
    body: [
      "Every Dermarra routine is built around a main concern, so the actives in each step work towards the same result instead of competing.",
      "Choose up to three. On the next screen you'll put them in order. The one you rank first is the one your routine is built around.",
    ],
  },
  rank: {
    title: "Why we ask you to rank them",
    body: [
      "Your routine is built around your highest-priority concern. If we don't have a routine for it yet, we'll build around the next one on your list.",
    ],
  },
};

const kes = (cents) => `KES ${Math.round(cents / 100).toLocaleString("en-KE")}`;

// ---------------------------------------------------------------- drawer

function WhyDrawer({ open, onClose, why }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && why && (
        <div className="fixed inset-0 z-50">
          <motion.button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            onClick={onClose}
            className="absolute inset-0 bg-ink/50 cursor-default"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="why-title"
            className="absolute inset-y-0 right-0 w-full max-w-md bg-white text-ink shadow-xl flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: [0.2, 0.75, 0.25, 1] }}
          >
            <div className="flex items-center justify-between px-6 sm:px-10 h-20 border-b border-mist">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/70">Why we ask</p>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-11 h-11 -mr-2 inline-flex items-center justify-center rounded-full hover:bg-bone-light"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 sm:px-10 py-10 overflow-y-auto">
              <h2 id="why-title" className="text-3xl leading-tight">
                {why.title}
              </h2>
              {why.body.map((p) => (
                <p key={p} className="mt-5 text-ink/80 leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------- answers

function Pill({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`chip h-[52px] px-6 gap-2.5 text-lg font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${
        selected ? "bg-ink border-ink text-white font-medium" : "bg-white border-ink text-ink hover:bg-bone-light"
      }`}
    >
      {children}
      {selected && <CheckIcon className="w-3.5 h-3.5" />}
    </button>
  );
}

function ConcernThumb({ concern, index, className = "" }) {
  const img = cloudinaryUrl(concern.cloudinary_public_id, { width: 320 });
  return (
    <span
      className={`block overflow-hidden ${className}`}
      style={{ backgroundColor: BRAND_ACCENTS[index % BRAND_ACCENTS.length] }}
    >
      {img && <img src={img} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
    </span>
  );
}

function ConcernTile({ concern, index, selected, disabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      aria-disabled={disabled}
      className={`group text-center min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue ${
        disabled ? "cursor-not-allowed" : ""
      }`}
    >
      <span className="relative block aspect-square">
        <ConcernThumb
          concern={concern}
          index={index}
          className={`absolute inset-0 transition-opacity ${selected ? "opacity-45" : disabled ? "opacity-70" : "group-hover:opacity-85"}`}
        />
        {selected && (
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute inset-0 m-auto w-9 h-9 rounded-full bg-ink text-white flex items-center justify-center"
            aria-hidden="true"
          >
            <CheckIcon className="w-4 h-4" />
          </motion.span>
        )}
      </span>
      <span lang="en" className="block mt-2 text-base leading-snug text-ink [overflow-wrap:break-word]">{concern.name.trim()}</span>
    </button>
  );
}

function RankList({ ranked, setRanked, concernIndex }) {
  const move = (from, to) => {
    if (to < 0 || to >= ranked.length) return;
    const next = [...ranked];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setRanked(next);
  };
  return (
    <div className="w-full max-w-xl">
      <p className="text-ink/70 mb-5">Drag your concerns into order, highest priority at the top.</p>
      <Reorder.Group axis="y" values={ranked} onReorder={setRanked} className="flex flex-col gap-3">
        {ranked.map((c, i) => (
          <Reorder.Item
            key={c.id}
            value={c}
            className="flex items-center gap-4 bg-white border border-mist rounded-lg overflow-hidden cursor-grab active:cursor-grabbing select-none"
            whileDrag={{ scale: 1.02, boxShadow: "0 12px 28px rgba(35,31,32,.14)" }}
          >
            <ConcernThumb concern={c} index={concernIndex(c)} className="relative w-24 h-24 shrink-0" />
            <span className="flex-1 min-w-0 text-xl leading-snug [overflow-wrap:anywhere]">
              <span className="tabular-nums">{i + 1}.</span> {c.name.trim()}
            </span>
            <span className="flex items-center gap-1 pr-3">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                aria-label={`Move ${c.name.trim()} up`}
                className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-bone-light disabled:opacity-25"
              >
                <ChevronLeftIcon className="w-4 h-4 rotate-90" />
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === ranked.length - 1}
                aria-label={`Move ${c.name.trim()} down`}
                className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-bone-light disabled:opacity-25"
              >
                <ChevronRightIcon className="w-4 h-4 rotate-90" />
              </button>
              <MenuIcon className="w-5 h-5 ml-1 text-ink/60" />
            </span>
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  );
}

// ---------------------------------------------------------------- results

function StepSection({ group, number, steps }) {
  return (
    <section className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-8 py-14 border-t border-mist">
      <div>
        <p className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3].map((d) => (
            <span key={d} className="h-[3px] w-6 rounded-full" style={{ backgroundColor: d < number ? STEP_LINE[(number - 1) % STEP_LINE.length] : "#231F20" }} />
          ))}
        </p>
        <h3 className="mt-4 text-3xl">
          Step {number}: {group.name}
        </h3>
        {group.description && <p className="mt-3 text-ink/75 leading-relaxed">{group.description}</p>}
      </div>
      <ul className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr))]">
        {steps.map((step) => {
          const img = cloudinaryUrl(step.product.cloudinary_public_id, { width: 480 });
          return (
            <li key={step.id}>
              <Link
                to={`/shop/${step.product.slug}`}
                className="group flex flex-col h-full rounded-lg border border-mist bg-bone-light overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
              >
                <span className="relative block aspect-square bg-mist overflow-hidden">
                  {img && (
                    <img
                      src={img}
                      alt={step.product.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-white text-ink text-xs font-semibold uppercase tracking-wide">
                    {step.time_of_day === "both" ? "AM + PM" : step.time_of_day.toUpperCase()}
                  </span>
                </span>
                <span className="flex flex-1 flex-col p-4">
                <span className="block font-mono text-xs uppercase tracking-wide text-lime-800 leading-5 h-5 truncate">
                  {step.product.key_actives}
                </span>
                <span className="block mt-1 text-xl font-semibold leading-snug min-h-[2.75em] line-clamp-2 group-hover:underline underline-offset-4">
                  {step.product.name}
                </span>
                <span className="mt-auto pt-3 border-t border-mist flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{kes(step.variant.price_cents)}</span>
                  <span className="text-ink/70">{step.variant.label}</span>
                </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Results({ routine, ranked, matchedIndex, stepGroups, user, onRetake }) {
  const { addItem } = useCart();
  const [time, setTime] = useState("am");
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState(null);
  const firstName = user?.full_name?.trim().split(/\s+/)[0];
  const img = cloudinaryUrl(routine.cloudinary_public_id, { width: 960 });
  const today = new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });

  const sections = useMemo(() => {
    const visible = (routine.steps || [])
      .filter((s) => s.time_of_day === "both" || s.time_of_day === time)
      .sort((a, b) => a.order_index - b.order_index);
    const groups = [...stepGroups].sort((a, b) => a.position - b.position);
    const out = groups
      .map((g) => ({
        group: { key: g.key, name: g.label.replace(/^Step\s*\d+\s*:\s*/i, ""), description: g.description },
        steps: visible.filter((s) => s.product.step_type === g.step_type),
      }))
      .filter((s) => s.steps.length);
    const known = new Set(groups.map((g) => g.step_type));
    const other = visible.filter((s) => !known.has(s.product.step_type));
    if (other.length) out.push({ group: { key: "other", name: "Extras" }, steps: other });
    return out;
  }, [routine.steps, stepGroups, time]);

  const handleAdd = async () => {
    setAddError(null);
    try {
      await addItem({ routineId: routine.id });
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } catch (err) {
      setAddError(err.response?.data?.error || "Couldn't add this to your cart. Please try again.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-12 pt-12 sm:pt-16 pb-16"
    >
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center pb-14">
        <div>
          <p className="font-medium">{today}</p>
          <h1 className="mt-4 text-4xl sm:text-5xl leading-[1.08]">
            {firstName ? `Hi ${firstName}, here's` : "Here's"} your routine.
          </h1>
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-5">
            {ranked.map((c, i) => (
              <div key={c.id}>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/70">{RANK_LABELS[i]}</dt>
                <dd className="mt-1 text-lg">{c.name.trim()}</dd>
              </div>
            ))}
          </dl>
          {matchedIndex > 0 && (
            <p className="mt-6 text-ink/75 max-w-md">
              We don&apos;t have a routine for {ranked[0].name.trim()} yet, so this one is built around your{" "}
              {RANK_LABELS[matchedIndex].toLowerCase()}, {ranked[matchedIndex].name.trim()}.
            </p>
          )}
          <button
            type="button"
            onClick={onRetake}
            className="mt-8 inline-flex items-center gap-2 font-medium underline underline-offset-4 decoration-ink/40 hover:decoration-ink"
          >
            Retake the routine builder <ChevronRightIcon className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="aspect-[3/2] rounded-lg bg-blue overflow-hidden">
          {img && <img src={img} alt={routine.name} className="w-full h-full object-cover" />}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 pt-14 pb-10 border-t border-mist">
        <div className="max-w-xl">
          <h2 className="text-4xl">{routine.name}</h2>
          {(routine.tagline || routine.description) && (
            <p className="mt-3 text-ink/75 leading-relaxed">{routine.tagline || routine.description}</p>
          )}
          <p className="mt-3 text-sm text-ink/70">Apply from thinnest to thickest: step by step, in the order below.</p>
        </div>
        <div className="shrink-0">
          {user ? (
            <button
              type="button"
              onClick={handleAdd}
              className={`btn ${added ? "bg-lime text-ink" : "btn-primary"}`}
            >
              {added ? <CheckIcon className="w-4 h-4" /> : null}
              {added
                ? "Added to cart"
                : `Add routine to cart${routine.bundle_discount_percent > 0 ? ` · Save ${routine.bundle_discount_percent}%` : ""}`}
            </button>
          ) : (
            <Link
              to="/login"
              state={{ from: "/quiz" }}
              className="btn btn-primary"
            >
              Sign in to add this routine to your cart
            </Link>
          )}
          {addError && <p className="text-orange-700 mt-3 max-w-xs">{addError}</p>}
        </div>
      </div>

      <div role="group" aria-label="Time of day" className="flex gap-3 pb-4">
        {[
          ["am", "AM"],
          ["pm", "PM"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTime(value)}
            aria-pressed={time === value}
            className={`chip w-28 ${time === value ? "chip-on" : "chip-off"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {sections.length ? (
        sections.map((s, i) => <StepSection key={s.group.key} group={s.group} number={i + 1} steps={s.steps} />)
      ) : (
        <p className="py-14 border-t border-mist text-ink/70">
          No {time.toUpperCase()} steps in this routine. Switch to {time === "am" ? "PM" : "AM"}.
        </p>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------- page

// ---------------------------------------------------------------- accordion

/** The questions as an "Accordion in Motion" -- a native port of the
 * owner-supplied Framer component (framer.com/m/Accordion-in-Motion-1FSSD6.js,
 * "Follow Morph Accordion"). Left: numbered questions; the open one shows
 * its helper, "Why we ask" and the Next button (no autoplay -- the customer
 * moves on with Next). Right: the answers panel, which follows the open
 * question down the page and morphs (scale + corner radius) as it changes.
 * Below lg the answers sit inside the open question instead.
 * Earlier questions can be reopened from their header; later ones only
 * through Next, so the answers stay consistent. */
const ACC_SPRING = { type: "spring", duration: 0.7, bounce: 0.12 };
const ITEM_GAP = 8;

function useIsDesktop() {
  const query = "(min-width: 1024px)";
  const [desktop, setDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setDesktop(mql.matches);
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return desktop;
}

function QuestionAccordion({ questions, openKey, onOpen, canOpen, answers, answered, matching, nextLabel, onNext, onWhy }) {
  const desktop = useIsDesktop();
  const reduced = useReducedMotion();
  const transition = reduced ? { duration: 0 } : ACC_SPRING;
  const openIndex = Math.max(0, questions.findIndex((q) => q.key === openKey));
  const headerRefs = useRef([]);
  const contentRefs = useRef([]);
  const panelRefs = useRef([]);
  const buttonRefs = useRef([]);
  const [m, setM] = useState({ headers: [], contents: [], panels: [] });

  const measure = useCallback(() => {
    const next = {
      headers: questions.map((_, i) => headerRefs.current[i]?.offsetHeight || 0),
      contents: questions.map((_, i) => contentRefs.current[i]?.offsetHeight || 0),
      panels: questions.map((_, i) => panelRefs.current[i]?.offsetHeight || 0),
    };
    setM((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [questions]);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    [...headerRefs.current, ...contentRefs.current, ...panelRefs.current].forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [measure, desktop, questions.length]);

  // Where the answers panel sits: level with the open question, but never
  // running past the bottom of the list.
  let top = 0;
  for (let j = 0; j < openIndex; j += 1) top += (m.headers[j] || 0) + ITEM_GAP;
  let listH = 0;
  for (let j = 0; j < questions.length; j += 1) listH += (m.headers[j] || 0) + (j > 0 ? ITEM_GAP : 0);
  listH += m.contents[openIndex] || 0;
  const panelH = m.panels[openIndex] || 0;
  const shift = Math.max(0, Math.min(top, Math.max(0, listH - panelH)));

  const onKeyDown = (e, i) => {
    const n = { ArrowDown: Math.min(questions.length - 1, i + 1), ArrowUp: Math.max(0, i - 1), Home: 0, End: questions.length - 1 }[e.key];
    if (n === undefined) return;
    e.preventDefault();
    buttonRefs.current[n]?.focus();
  };

  return (
    <div className="flex gap-10 xl:gap-16 items-start">
      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: ITEM_GAP }}>
        {questions.map((q, i) => {
          const isOpen = i === openIndex;
          const reachable = isOpen || canOpen(i);
          const hId = `rq-h-${q.key}`;
          const pId = `rq-p-${q.key}`;
          return (
            <motion.div
              key={q.key}
              initial={false}
              animate={{ backgroundColor: isOpen ? "#F5F4F1" : "rgba(245,244,241,0)" }}
              transition={{ duration: reduced ? 0 : 0.3 }}
              className="relative rounded-lg overflow-hidden"
            >
              <h2 ref={(el) => (headerRefs.current[i] = el)} className="m-0">
                <button
                  ref={(el) => (buttonRefs.current[i] = el)}
                  id={hId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={pId}
                  aria-disabled={!reachable || undefined}
                  onClick={() => reachable && !isOpen && onOpen(q.key)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className={`w-full min-h-[76px] flex items-center gap-5 px-5 sm:px-7 py-4 text-left rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue ${
                    reachable ? "cursor-pointer" : "cursor-default"
                  } ${!isOpen && reachable ? "hover:bg-ink/[0.04]" : ""}`}
                >
                  <motion.span
                    aria-hidden="true"
                    initial={false}
                    animate={{ backgroundColor: isOpen ? "#231F20" : "rgba(35,31,32,0.07)", color: isOpen ? "#FFFFFF" : "#231F20" }}
                    transition={{ duration: reduced ? 0 : 0.3 }}
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold tabular-nums"
                  >
                    {q.summary && !isOpen ? <CheckIcon className="w-3.5 h-3.5" /> : String(i + 1).padStart(2, "0")}
                  </motion.span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-xl sm:text-2xl font-semibold leading-snug ${reachable ? "text-ink" : "text-ink/70"}`}>{q.title}</span>
                    {q.summary && !isOpen && <span className="block mt-1 text-ink/70 truncate">{q.summary}</span>}
                  </span>
                  <motion.span
                    aria-hidden="true"
                    initial={false}
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={transition}
                    className="shrink-0 text-ink"
                  >
                    <ChevronDownIcon className="w-4 h-4" />
                  </motion.span>
                </button>
              </h2>
              <motion.div
                id={pId}
                role="region"
                aria-labelledby={hId}
                aria-hidden={!isOpen}
                initial={false}
                animate={{ height: isOpen ? "auto" : 0 }}
                transition={transition}
                className="overflow-hidden"
              >
                <div ref={(el) => (contentRefs.current[i] = el)} className="px-5 sm:px-7 pb-6 sm:pl-[86px] flex flex-col gap-5">
                  {q.helper && <p className="text-ink/70 max-w-xl">{q.helper}</p>}
                  {!desktop && isOpen && <div className="rounded-lg bg-white p-4 sm:p-5">{answers(q.key)}</div>}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <button
                      type="button"
                      onClick={onNext}
                      disabled={!isOpen || !answered || matching}
                      tabIndex={isOpen ? 0 : -1}
                      className="btn btn-primary"
                    >
                      {nextLabel} {!matching && <ArrowRightIcon className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={onWhy}
                      tabIndex={isOpen ? 0 : -1}
                      className="font-medium underline underline-offset-[6px] decoration-1 hover:decoration-2"
                    >
                      Why we ask
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      {desktop && (
        <div className="relative w-[48%] shrink-0 self-stretch" aria-live="polite" style={{ minHeight: Math.max(listH, panelH) }}>
          <motion.div className="absolute inset-x-0 top-0" initial={false} animate={{ y: shift }} transition={transition}>
            {questions.map((q, i) => {
              const active = i === openIndex;
              return (
                <motion.div
                  key={q.key}
                  ref={(el) => (panelRefs.current[i] = el)}
                  aria-hidden={!active}
                  initial={false}
                  animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.86, borderRadius: active ? 8 : 200 }}
                  transition={transition}
                  className={`${active ? "relative z-[2]" : "absolute inset-x-0 top-0 z-[1] pointer-events-none"} overflow-hidden bg-bone-light p-6 xl:p-8`}
                  {...(active ? {} : { inert: "" })}
                >
                  {answers(q.key)}
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default function RoutineQuiz() {
  const { user } = useAuth();
  const [concerns, setConcerns] = useState(null);
  const [stepGroups, setStepGroups] = useState([]);
  const [stepKey, setStepKey] = useState("skin"); // skin | concerns | rank | result
  const [skinType, setSkinType] = useState(undefined); // undefined = unanswered, null = not sure
  const [picked, setPicked] = useState([]); // concern ids, in pick order
  const [ranked, setRanked] = useState([]); // concern objects, priority order
  const [limitHit, setLimitHit] = useState(false);
  const [matching, setMatching] = useState(false);
  const [result, setResult] = useState(null); // { routine, matchedIndex } | { error }
  const [whyOpen, setWhyOpen] = useState(false);
  const closeWhy = useCallback(() => setWhyOpen(false), []);

  useEffect(() => {
    client
      .get("/products/concerns")
      .then(({ data }) => setConcerns(data))
      .catch(() => setConcerns([]));
    client
      .get("/products/step-groups")
      .then(({ data }) => setStepGroups(data))
      .catch(() => setStepGroups([]));
  }, []);

  // Only the results page starts at the top; the questions stay in place.
  useEffect(() => {
    if (stepKey === "result") window.scrollTo({ top: 0 });
  }, [stepKey]);

  const concernIndex = (c) => concerns?.findIndex((x) => x.id === c.id) ?? 0;
  const steps = picked.length > 1 ? ["skin", "concerns", "rank"] : ["skin", "concerns"];
  const position = steps.indexOf(stepKey);
  const answered =
    stepKey === "skin" ? skinType !== undefined : stepKey === "concerns" ? picked.length > 0 : ranked.length > 0;

  const togglePick = (id) => {
    setLimitHit(false);
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= MAX_CONCERNS) {
        setLimitHit(true);
        return cur;
      }
      return [...cur, id];
    });
  };

  const findRoutine = async (order) => {
    setMatching(true);
    let found = null;
    let lastError = null;
    for (let i = 0; i < order.length && !found; i += 1) {
      try {
        const { data } = await client.post("/routines/quiz", {
          concern_slug: order[i].slug,
          skin_type: skinType || undefined,
        });
        found = { routine: data, matchedIndex: i };
      } catch (err) {
        lastError = err.response?.data?.error;
        if (err.response?.status !== 404) break;
      }
    }
    setResult(
      found || {
        error:
          lastError && !/no routine/i.test(lastError)
            ? lastError
            : "We don't have a routine for these concerns yet. New routines are on the way.",
      }
    );
    setMatching(false);
    setStepKey("result");
  };

  const next = () => {
    if (!answered || matching) return;
    if (stepKey === "skin") setStepKey("concerns");
    else if (stepKey === "concerns") {
      // Keep any ranking already made; new picks go to the bottom.
      const chosen = picked.map((id) => concerns.find((c) => c.id === id));
      const kept = ranked.filter((c) => picked.includes(c.id));
      const order = [...kept, ...chosen.filter((c) => !kept.some((k) => k.id === c.id))];
      setRanked(order);
      if (order.length > 1) setStepKey("rank");
      else findRoutine(order);
    } else findRoutine(ranked);
  };
  const back = () => {
    if (stepKey === "result") setStepKey(steps[steps.length - 1]);
    else if (position > 0) setStepKey(steps[position - 1]);
  };
  const retake = () => {
    setSkinType(undefined);
    setPicked([]);
    setRanked([]);
    setResult(null);
    setStepKey("skin");
  };

  if (stepKey === "result" && result?.routine) {
    return (
      <Results
        routine={result.routine}
        ranked={ranked}
        matchedIndex={result.matchedIndex}
        stepGroups={stepGroups}
        user={user}
        onRetake={retake}
      />
    );
  }

  const isNoMatch = stepKey === "result";
  const skinLabel = SKIN_TYPES.find((t) => t.value === skinType)?.label;
  const pickedNames = picked.map((id) => concerns?.find((c) => c.id === id)?.name).filter(Boolean);
  const questions = [
    {
      key: "skin",
      title: "How would you describe your skin type?",
      helper: "Select the answer that fits you best.",
      summary: skinType === undefined ? null : skinLabel,
    },
    {
      key: "concerns",
      title: "What are your top skin concerns?",
      helper: "Choose up to three.",
      summary: pickedNames.length ? pickedNames.join(", ") : null,
    },
    ...(picked.length > 1
      ? [
          {
            key: "rank",
            title: "Which matters most to you?",
            helper: "Drag them into order, or use the arrows. Your routine is built around the first one.",
            summary: null,
          },
        ]
      : []),
  ];
  const nextLabel = matching
    ? "Finding your routine…"
    : stepKey === "rank" || (stepKey === "concerns" && picked.length <= 1)
    ? "See my routine"
    : "Next";

  const answers = (key) => {
    if (key === "skin") {
      return (
        <div role="group" aria-label="Skin type" className="flex flex-wrap gap-3">
          {SKIN_TYPES.map((t) => (
            <Pill key={t.label} selected={skinType === t.value} onClick={() => setSkinType(t.value)}>
              {t.label}
            </Pill>
          ))}
        </div>
      );
    }
    if (key === "concerns") {
      if (concerns === null) return <p className="text-ink/70">Loading concerns…</p>;
      if (concerns.length === 0) return <p className="text-ink/70">Concerns couldn&apos;t be loaded. Refresh the page to try again.</p>;
      return (
        <>
          <div
            role="group"
            aria-label="Skin concerns"
            className="grid gap-x-4 gap-y-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,120px),1fr))]"
          >
            {concerns.map((c, i) => (
              <ConcernTile
                key={c.id}
                concern={c}
                index={i}
                selected={picked.includes(c.id)}
                disabled={!picked.includes(c.id) && picked.length >= MAX_CONCERNS}
                onToggle={() => togglePick(c.id)}
              />
            ))}
          </div>
          <p className={`mt-6 text-sm ${limitHit ? "text-orange-700" : "text-ink/70"}`} aria-live="polite">
            {limitHit ? "You can choose up to 3. Remove one to pick another." : `${picked.length} of ${MAX_CONCERNS} selected`}
          </p>
        </>
      );
    }
    return <RankList ranked={ranked} setRanked={setRanked} concernIndex={concernIndex} />;
  };

  return (
    <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 pt-10 sm:pt-14 pb-20">
      <header className="mb-8 sm:mb-12 max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.18em] text-lime-800 uppercase mb-3">Routine builder</p>
        <h1 className="font-display font-semibold text-4xl sm:text-5xl leading-[1.05] text-ink">Build your routine.</h1>
        <p className="mt-4 text-ink/70 max-w-xl">A few questions about your skin, then the routine that fits it.</p>
      </header>

      {isNoMatch ? (
        <div className="rounded-lg bg-bone-light p-8 sm:p-10 max-w-2xl">
          <h2 className="text-3xl font-semibold text-ink">We don&apos;t have a routine for that yet.</h2>
          {result?.error && <p className="mt-3 text-ink/70">{result.error}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={back} className="btn btn-secondary">
              <ArrowLeftIcon className="w-4 h-4" /> Change my answers
            </button>
            <button type="button" onClick={retake} className="btn btn-primary">
              Start again
            </button>
          </div>
        </div>
      ) : (
        <QuestionAccordion
          questions={questions}
          openKey={stepKey}
          onOpen={(key) => setStepKey(key)}
          canOpen={(i) => i < position}
          answers={answers}
          answered={answered}
          matching={matching}
          nextLabel={nextLabel}
          onNext={next}
          onWhy={() => setWhyOpen(true)}
        />
      )}

      <WhyDrawer open={whyOpen} onClose={closeWhy} why={WHY[stepKey]} />
    </div>
  );
}
