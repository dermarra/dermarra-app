import { motion, useReducedMotion } from "framer-motion";
import { itemReveal } from "./Reveal.jsx";

/** "The Dermarra story" -- the meaning of the name and the mark, from the
 * owner's brand notes (2026-11-09). Beside the text, TiltingMark: the logo
 * icon shown upright as a butterfly, which turns 45 degrees into the "+" of
 * medicine and healing when it scrolls into view (and back on hover). The
 * official icon file *is* the "+" position, so the butterfly is that file
 * rotated -45deg. (The D-construction drawing was removed at the owner's
 * request, 2026-11-09.) */

function TiltingMark() {
  const reduce = useReducedMotion();
  return (
    <figure className="flex flex-col items-center">
      <motion.img
        src="/brand/icon-dark.svg"
        alt="The Dermarra butterfly turning 45 degrees into a plus sign"
        draggable="false"
        className="w-48 sm:w-60 h-auto select-none"
        initial={reduce ? false : { rotate: -45 }}
        whileInView={{ rotate: 0 }}
        whileHover={reduce ? undefined : { rotate: -45 }}
        viewport={{ once: false, amount: 0.8 }}
        transition={{ type: "spring", stiffness: 60, damping: 12, delay: 0.2 }}
      />
      <figcaption className="mt-6 text-center text-ink/70 max-w-xs">
        Tilted 45°, the butterfly takes flight — and becomes the <strong className="text-ink">+</strong> of healing.
      </figcaption>
    </figure>
  );
}

export default function BrandStory() {
  return (
    <>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-20 items-center">
        <div className="max-w-2xl">
          <motion.p variants={itemReveal} className="text-sm font-semibold tracking-[0.18em] text-orange-700 uppercase mb-3">
            Our story
          </motion.p>
          <motion.h2 variants={itemReveal} className="font-display font-semibold text-3xl sm:text-4xl text-ink mb-5">
            From the dermis, a transformation.
          </motion.h2>
          <motion.div variants={itemReveal} className="flex flex-col gap-4 text-ink/80 leading-relaxed">
            <p>
              Dermarra takes its name from the <strong className="text-ink">dermis</strong> — the living layer of your
              skin. Our mark is built from the first letter of that name: four uppercase{" "}
              <strong className="text-ink">D</strong>s, joined at the centre, form a butterfly.
            </p>
            <p>
              The butterfly stands for our multi-step system — <strong className="text-ink">cleanse, treat, repair and protect</strong>{" "}
              — a transformation that happens in stages, the way a butterfly forms.
            </p>
            <p>
              Tilt the butterfly 45° in any direction and it comes alive, seemingly in motion — and forms the{" "}
              <strong className="text-ink">+</strong> of medicine and healing. A story of transformation, and of the
              intentional, clinical precision that goes into every Dermarra product.
            </p>
          </motion.div>
        </div>
        <motion.div variants={itemReveal}>
          <TiltingMark />
        </motion.div>
      </div>
    </>
  );
}
