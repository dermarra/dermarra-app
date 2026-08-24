import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import client, { cloudinaryUrl } from "../api/client";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import RoutineStepRail from "../components/RoutineStepRail.jsx";
import { containerReveal, itemReveal } from "../components/Reveal.jsx";
import { CheckIcon } from "../components/Icons.jsx";

const SKIN_TYPES = [
  { value: "oily", label: "Oily" },
  { value: "dry", label: "Dry" },
  { value: "combination", label: "Combination" },
  { value: "normal", label: "Normal" },
  { value: "sensitive", label: "Sensitive" },
];

function ProgressLabel({ step }) {
  if (step !== "concern" && step !== "skin_type") return null;
  return (
    <p className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-2">
      {step === "concern" ? "Step 1 of 2" : "Step 2 of 2"}
    </p>
  );
}

export default function RoutineQuiz() {
  const [step, setStep] = useState("concern"); // concern | skin_type | result
  const [concerns, setConcerns] = useState([]);
  const [concern, setConcern] = useState(null);
  const [routine, setRoutine] = useState(null);
  const [error, setError] = useState(null);
  const [matching, setMatching] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState(null);
  const { addItem } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    client.get("/products/concerns").then(({ data }) => setConcerns(data));
  }, []);

  const chooseConcern = (selectedConcern) => {
    setConcern(selectedConcern);
    setStep("skin_type");
  };

  const chooseSkinType = async (skinType) => {
    setError(null);
    setRoutine(null);
    setAdded(false);
    setMatching(true);
    try {
      const { data } = await client.post("/routines/quiz", {
        concern_slug: concern.slug,
        skin_type: skinType || undefined,
      });
      setRoutine(data);
    } catch (err) {
      setError(err.response?.data?.error || "No routine found yet for this concern.");
    } finally {
      setMatching(false);
      setStep("result");
    }
  };

  const startOver = () => {
    setStep("concern");
    setConcern(null);
    setRoutine(null);
    setError(null);
  };

  const handleAdd = async () => {
    setAddError(null);
    try {
      await addItem({ routineId: routine.id });
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      setAddError(err.response?.data?.error || "Couldn't add this to your cart -- please try again.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <ProgressLabel step={step} />
        {step === "concern" && (
          <>
            <h1 className="font-display text-2xl sm:text-3xl text-ink">
              What are you noticing on your skin?
            </h1>
            <p className="text-ink/60 text-sm mt-1">Pick whichever sounds closest.</p>
          </>
        )}
        {step === "skin_type" && (
          <>
            <h1 className="font-display text-2xl sm:text-3xl text-ink">
              What&apos;s your skin type?
            </h1>
            <p className="text-ink/60 text-sm mt-1">
              This helps us match a routine that&apos;s actually right for you.
            </p>
          </>
        )}
      </motion.div>

      <AnimatePresence mode="wait">
        {step === "concern" && (
          <motion.div key="concern" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              initial="hidden"
              animate="show"
              variants={containerReveal}
              className="flex gap-3 overflow-x-auto snap-x snap-mandatory py-6 -mx-4 px-4 sm:mx-0 sm:px-0"
            >
              {concerns.map((c) => (
                <motion.button
                  key={c.id}
                  variants={itemReveal}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => chooseConcern(c)}
                  className={`shrink-0 snap-start w-40 sm:w-48 rounded-sm border p-4 text-left transition-colors ${
                    concern?.id === c.id ? "border-amber bg-amber-light/20" : "border-mist bg-bone-light"
                  }`}
                >
                  {c.description ? (
                    <>
                      <span className="font-semibold text-sm text-ink leading-snug">{c.description}</span>
                      <p className="text-[11px] font-mono uppercase tracking-wide text-sage-dark mt-2">
                        {c.name}
                      </p>
                    </>
                  ) : (
                    <span className="font-semibold text-sm text-ink">{c.name}</span>
                  )}
                </motion.button>
              ))}
            </motion.div>
          </motion.div>
        )}

        {step === "skin_type" && (
          <motion.div key="skin_type" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button
              onClick={() => setStep("concern")}
              className="text-xs text-ink/60 hover:text-ink my-4"
            >
              ← Back
            </button>
            <motion.div
              initial="hidden"
              animate="show"
              variants={containerReveal}
              className="grid grid-cols-2 sm:grid-cols-3 gap-3"
            >
              {SKIN_TYPES.map((t) => (
                <motion.button
                  key={t.value}
                  variants={itemReveal}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={matching}
                  onClick={() => chooseSkinType(t.value)}
                  className="rounded-sm border border-mist bg-bone-light p-4 text-sm font-semibold text-ink hover:border-amber transition-colors disabled:opacity-50"
                >
                  {t.label}
                </motion.button>
              ))}
              <motion.button
                variants={itemReveal}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                disabled={matching}
                onClick={() => chooseSkinType(null)}
                className="rounded-sm border border-mist bg-bone-light p-4 text-sm font-semibold text-ink/60 hover:border-amber transition-colors disabled:opacity-50"
              >
                Not sure
              </motion.button>
            </motion.div>

            {matching && (
              <div className="flex items-center gap-3 mt-6">
                <div className="w-5 h-5 border-2 border-amber border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-ink/60">Finding your routine…</p>
              </div>
            )}
          </motion.div>
        )}

        {step === "result" && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mt-4 pt-6"
          >
            {error && (
              <div>
                <p className="text-sm text-clay">{error}</p>
                <button
                  onClick={startOver}
                  className="mt-4 px-5 py-2.5 rounded-sm border border-mist text-ink/70 text-sm font-semibold"
                >
                  Start over
                </button>
              </div>
            )}

            {routine && (
              <>
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-sm bg-mist overflow-hidden shrink-0">
                    {cloudinaryUrl(routine.cloudinary_public_id, { width: 200 }) && (
                      <img
                        src={cloudinaryUrl(routine.cloudinary_public_id, { width: 200 })}
                        alt={routine.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <h2 className="font-display text-xl text-ink">{routine.name}</h2>
                    {routine.tagline && <p className="text-ink/60 text-sm mt-1">{routine.tagline}</p>}
                  </div>
                </div>

                <div className="mt-4">
                  <RoutineStepRail steps={routine.steps} />
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-6">
                  {user ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleAdd}
                      className={`px-6 py-3 rounded-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                        added ? "bg-sage text-bone-light" : "bg-amber text-bone-light hover:bg-amber-dark"
                      }`}
                    >
                      {added ? (
                        <>
                          <CheckIcon className="w-4 h-4" /> Added to cart
                        </>
                      ) : (
                        <>
                          Add full routine to cart
                          {routine.bundle_discount_percent > 0 && ` · Save ${routine.bundle_discount_percent}%`}
                        </>
                      )}
                    </motion.button>
                  ) : (
                    <Link
                      to="/login"
                      className="px-6 py-3 rounded-sm bg-amber text-bone-light font-semibold hover:bg-amber-dark transition-colors"
                    >
                      Sign in to add this routine to your cart
                    </Link>
                  )}
                  <button onClick={startOver} className="text-xs text-ink/60 hover:text-ink">
                    Start over
                  </button>
                </div>
                {addError && <p className="text-sm text-clay mt-3">{addError}</p>}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
