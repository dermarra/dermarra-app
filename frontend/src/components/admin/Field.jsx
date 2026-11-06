/** A labelled admin form field with a short, always-visible hint about what
 * to enter. Hints are shown as text rather than hover tooltips so they also
 * work on phones/tablets. Wrap a single input/select/textarea:
 *
 *   <Field label="SKU" help="Unique stock code, e.g. AAS-30ML.">
 *     <input ... />
 *   </Field>
 */
export default function Field({ label, help, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1 min-w-0 ${className}`}>
      <span className="text-sm font-semibold text-ink/80">{label}</span>
      {children}
      {help && <span className="text-sm leading-snug text-ink/55 font-normal">{help}</span>}
    </label>
  );
}

/** Section heading + one-line explanation for a group of fields. */
export function FieldGroup({ title, help, children }) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-semibold text-ink/80">{title}</p>
        {help && <p className="text-sm leading-snug text-ink/55">{help}</p>}
      </div>
      {children}
    </div>
  );
}
