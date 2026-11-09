import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import client, { cloudinaryUrl } from "../api/client";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { BRAND_ACCENTS } from "../components/ServiceTiles.jsx";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MenuIcon,
  XIcon,
} from "../components/Icons.jsx";

/** Routine builder, modelled on The Ordinary's regimen builder:
 *  - one question per screen, split in two by a hairline: the question
 *    (counter "01 / 03", large heading, helper, "Why we ask") on the left,
 *    the answers on the right, both vertically centred;
 *  - a full-width progress line over a footer of text-link Back / Next;
 *  - skin type as outlined pills, top-3 concerns as photo tiles with a check
 *    overlay, then ranking the chosen concerns (drag, or the arrow buttons);
 *  - a results page: greeting, the ranked concerns, then the routine grouped
 *    by step (Prep / Treat / Seal / Protect) with an AM / PM toggle.
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
const RANK_LABELS = ["Primary concern", "Secondary concern", "Tertiary concern"];

const WHY = {
  skin: {
    title: "Why we ask about your skin type",
    body: [
      "Skin type changes which textures suit you: a rich barrier cream that comforts dry skin can feel heavy on oily skin, and a light gel that suits oily skin can leave dry skin tight.",
      "If you're not sure, think about how your skin feels a few hours after washing it -- or choose “Not sure” and we'll match on your concerns alone.",
    ],
  },
  concerns: {
    title: "Why we ask about your concerns",
    body: [
      "Every Dermarra routine is built around a main concern, so the actives in each step work towards the same result instead of competing.",
      "Choose up to three. On the next screen you'll put them in order -- the one you rank first is the one your routine is built around.",
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
      <span className="block mt-2 text-base leading-snug text-ink [overflow-wrap:anywhere]">{concern.name.trim()}</span>
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
            <span key={d} className={`w-2.5 h-2.5 rounded-full border border-ink ${d < number ? "bg-ink" : ""}`} />
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
              <Link to={`/shop/${step.product.slug}`} className="group block">
                <span className="relative block aspect-square bg-bone-light overflow-hidden">
                  {img && (
                    <img
                      src={img}
                      alt={step.product.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <span className="absolute top-3 left-3 px-2.5 py-1 bg-white text-ink text-xs font-semibold uppercase tracking-wide">
                    {step.time_of_day === "both" ? "AM + PM" : step.time_of_day.toUpperCase()}
                  </span>
                </span>
                {step.product.key_actives && (
                  <span className="block mt-4 font-mono text-xs uppercase tracking-wide text-lime-800">
                    {step.product.key_actives}
                  </span>
                )}
                <span className="block mt-1 text-xl font-medium leading-snug group-hover:underline underline-offset-4">
                  {step.product.name}
                </span>
                <span className="mt-3 pt-3 border-t border-mist flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{kes(step.variant.price_cents)}</span>
                  <span className="text-ink/70">{step.variant.label}</span>
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
      setAddError(err.response?.data?.error || "Couldn't add this to your cart -- please try again.");
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
        <div className="aspect-[3/2] bg-blue overflow-hidden">
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
              className={`inline-flex items-center gap-2 px-7 py-4 text-sm font-semibold transition-colors ${
                added ? "bg-lime text-ink" : "bg-orange text-ink hover:bg-orange-400"
              }`}
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
              className="inline-flex px-7 py-4 bg-orange text-ink text-sm font-semibold hover:bg-orange-400 transition-colors"
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
            className={`w-28 py-3 border text-sm font-semibold transition-colors ${
              time === value ? "bg-ink border-ink text-white" : "bg-white border-ink text-ink hover:bg-bone-light"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sections.length ? (
        sections.map((s, i) => <StepSection key={s.group.key} group={s.group} number={i + 1} steps={s.steps} />)
      ) : (
        <p className="py-14 border-t border-mist text-ink/70">
          No {time.toUpperCase()} steps in this routine -- switch to {time === "am" ? "PM" : "AM"}.
        </p>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------- page

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

  useEffect(() => {
    window.scrollTo({ top: 0 });
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
            : "We don't have a routine for these concerns yet -- new routines are on the way.",
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
  const QUESTION = {
    skin: { title: "How would you describe your skin type?", helper: "Select the answer that fits you best." },
    concerns: { title: "Identify your top 3 skin concerns.", helper: "Select up to three." },
    rank: { title: "Rank your concerns from highest to lowest priority.", helper: null },
    result: { title: "We don't have a routine for that yet.", helper: result?.error },
  }[stepKey];
  const total = steps.length;
  const progress = isNoMatch ? 100 : ((position + (answered ? 1 : 0)) / total) * 100;
  const nextLabel = matching
    ? "Finding your routine…"
    : stepKey === "rank" || (stepKey === "concerns" && picked.length <= 1)
    ? "See my routine"
    : "Next";

  return (
    <div className="flex flex-col min-h-[calc(100svh-5rem)] sm:min-h-[calc(100svh-6rem)] bg-white">
      <div className="flex-1 grid lg:grid-cols-2">
        {/* Question */}
        <section className="relative flex flex-col px-5 sm:px-10 lg:px-20 pt-8 pb-10 lg:py-12 lg:border-r border-mist">
          {!isNoMatch && (
            <p className="text-sm tabular-nums">
              {String(position + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </p>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={stepKey}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex-1 flex flex-col justify-center pt-8 lg:pt-0"
            >
              <h1 className="text-4xl sm:text-5xl leading-[1.1] max-w-xl">{QUESTION.title}</h1>
              {QUESTION.helper && <p className="mt-4 text-ink/70 max-w-md">{QUESTION.helper}</p>}
              {isNoMatch ? (
                <button
                  type="button"
                  onClick={retake}
                  className="mt-10 self-start font-medium underline underline-offset-[6px] decoration-1"
                >
                  Start again
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setWhyOpen(true)}
                  className="mt-10 self-start font-medium underline underline-offset-[6px] decoration-1 hover:decoration-2"
                >
                  Why we ask
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </section>

        {/* Answers */}
        <section className="flex items-center px-5 sm:px-10 lg:px-20 pb-12 lg:py-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={stepKey}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-full"
            >
              {stepKey === "skin" && (
                <div role="group" aria-label="Skin type" className="flex flex-wrap gap-3">
                  {SKIN_TYPES.map((t) => (
                    <Pill key={t.label} selected={skinType === t.value} onClick={() => setSkinType(t.value)}>
                      {t.label}
                    </Pill>
                  ))}
                </div>
              )}

              {stepKey === "concerns" &&
                (concerns === null ? (
                  <p className="text-ink/70">Loading concerns…</p>
                ) : concerns.length === 0 ? (
                  <p className="text-ink/70">Concerns couldn&apos;t be loaded. Refresh the page to try again.</p>
                ) : (
                  <>
                    <div
                      role="group"
                      aria-label="Skin concerns"
                      className="grid gap-x-4 gap-y-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,120px),1fr))] max-w-3xl"
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
                      {limitHit
                        ? "You can choose up to 3 -- remove one to pick another."
                        : `${picked.length} of ${MAX_CONCERNS} selected`}
                    </p>
                  </>
                ))}

              {stepKey === "rank" && <RankList ranked={ranked} setRanked={setRanked} concernIndex={concernIndex} />}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>

      {/* Progress line + Back / Next. Sits above the mobile bottom nav. */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-0 z-20 bg-white">
        <div
          className="h-[3px] bg-mist"
          role="progressbar"
          aria-label="Routine builder progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <motion.div
            className="h-full bg-blue"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />
        </div>
        <div className="flex items-center justify-between gap-4 px-5 sm:px-8 h-20">
          <button
            type="button"
            onClick={back}
            className={`inline-flex items-center gap-3 text-lg ${position <= 0 && !isNoMatch ? "invisible" : ""}`}
          >
            <span aria-hidden="true">&larr;</span> Back
          </button>
          {!isNoMatch && (
            <button
              type="button"
              onClick={next}
              disabled={!answered || matching}
              className="inline-flex items-center gap-3 text-lg disabled:text-ink/35"
            >
              {nextLabel} {!matching && <span aria-hidden="true">&rarr;</span>}
            </button>
          )}
        </div>
      </div>

      <WhyDrawer open={whyOpen} onClose={closeWhy} why={WHY[stepKey]} />
    </div>
  );
}
