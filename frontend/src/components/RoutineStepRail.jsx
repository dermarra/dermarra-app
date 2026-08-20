import { cloudinaryUrl } from "../api/client";

const STEP_LABELS = {
  cleanser: "Cleanse",
  serum: "Treat",
  barrier_cream: "Repair",
  spf: "Protect",
  hair: "Hair",
};

/**
 * Signature UI element: a horizontal, connected rail of routine steps.
 * Reused on the quiz result, routine bundle pages, and product detail
 * pages -- reinforces the "system-based skincare" brand pillar everywhere.
 */
export default function RoutineStepRail({ steps, activeStepId = null, timeOfDay = "both" }) {
  const visibleSteps = steps.filter(
    (step) => timeOfDay === "both" || step.time_of_day === "both" || step.time_of_day === timeOfDay
  );

  return (
    <ol className="flex items-stretch gap-0 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0">
      {visibleSteps.map((step, index) => {
        const isActive = step.product.id === activeStepId;
        const imageUrl = cloudinaryUrl(step.product.cloudinary_public_id, { width: 160 });
        return (
          <li
            key={step.id}
            className="flex items-center shrink-0 snap-start"
            aria-current={isActive ? "step" : undefined}
          >
            <div
              className={`flex flex-col items-center gap-2 w-28 sm:w-32 rounded-sm border p-3 transition-colors ${
                isActive ? "border-amber bg-amber-light/20" : "border-mist bg-bone-light"
              }`}
            >
              <span className="font-mono text-[10px] tracking-widest text-sage-dark">
                STEP {String(step.order_index).padStart(2, "0")}
              </span>
              <div className="w-16 h-16 rounded-sm overflow-hidden bg-mist">
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={step.product.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-ink text-center">
                {STEP_LABELS[step.product.step_type] || step.product.step_type}
              </span>
              <span className="text-[11px] text-ink/70 text-center leading-snug">
                {step.product.name}
              </span>
            </div>
            {index < visibleSteps.length - 1 && (
              <div className="w-6 sm:w-8 h-px bg-mist shrink-0" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
