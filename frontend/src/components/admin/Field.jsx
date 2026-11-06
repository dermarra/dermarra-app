/** A labelled admin form field with a short, always-visible hint about what
 * to enter. Hints are shown as text rather than hover tooltips so they also
 * work on phones/tablets. Wrap a single input/select/textarea:
 *
 *   <Field label="SKU" help="Unique stock code, e.g. AAS-30ML.">
 *     <input ... />
 *   </Field>
 */
export default function Field({ label, help, children, className = "" }) {
  // Same label/hint style everywhere (see Kit.jsx): label ink semibold, hint
  // ink/70 (5.9:1) -- the old ink/55 hint was ~3.5:1, below the 4.5 minimum.
  return (
    <label className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {help && <span className="text-sm leading-snug text-ink/70 font-normal">{help}</span>}
    </label>
  );
}

/** Section heading + one-line explanation for a group of fields. */
export function FieldGroup({ title, help, children }) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {help && <p className="text-sm leading-snug text-ink/70">{help}</p>}
      </div>
      {children}
    </div>
  );
}
