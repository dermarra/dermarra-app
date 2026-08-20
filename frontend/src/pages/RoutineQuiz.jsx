import { useEffect, useState } from "react";
import client from "../api/client";
import { useCart } from "../context/CartContext";
import RoutineStepRail from "../components/RoutineStepRail.jsx";

export default function RoutineQuiz() {
  const [concerns, setConcerns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [routine, setRoutine] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    client.get("/products/concerns").then(({ data }) => setConcerns(data));
  }, []);

  const handleSelect = async (concern) => {
    setSelected(concern);
    setRoutine(null);
    setError(null);
    setLoading(true);
    try {
      const { data } = await client.post("/routines/quiz", { concern_slug: concern.slug });
      setRoutine(data);
    } catch (err) {
      setError(err.response?.data?.error || "No routine found yet for this concern.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-2xl">What's your main skin concern today?</h1>
      <p className="text-ink/60 text-sm mt-1">Pick one to get a matched routine.</p>

      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory py-6 -mx-4 px-4 sm:mx-0 sm:px-0">
        {concerns.map((concern) => (
          <button
            key={concern.id}
            onClick={() => handleSelect(concern)}
            className={`shrink-0 snap-start w-40 sm:w-48 rounded-sm border p-4 text-left transition-colors ${
              selected?.id === concern.id
                ? "border-amber bg-amber-light/20"
                : "border-mist bg-bone-light"
            }`}
          >
            <span className="font-semibold text-sm">{concern.name}</span>
            {concern.description && (
              <p className="text-xs text-ink/60 mt-1 leading-snug">{concern.description}</p>
            )}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-ink/60">Finding your routine…</p>}
      {error && <p className="text-sm text-clay">{error}</p>}

      {routine && (
        <div className="mt-4 border-t border-mist pt-6">
          <h2 className="font-display text-xl">{routine.name}</h2>
          {routine.tagline && <p className="text-ink/60 text-sm mt-1">{routine.tagline}</p>}

          <div className="mt-4">
            <RoutineStepRail steps={routine.steps} />
          </div>

          <button
            onClick={() => addItem({ routineId: routine.id })}
            className="mt-6 w-full sm:w-auto px-6 py-3 rounded-sm bg-amber text-bone-light font-semibold hover:bg-amber-dark transition-colors"
          >
            Add full routine to cart
            {routine.bundle_discount_percent > 0 && ` · Save ${routine.bundle_discount_percent}%`}
          </button>
        </div>
      )}
    </div>
  );
}
