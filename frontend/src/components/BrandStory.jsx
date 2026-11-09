import { motion, useReducedMotion } from "framer-motion";
import { itemReveal } from "./Reveal.jsx";

/** "The Dermarra story" -- the meaning of the name and the mark, from the
 * owner's brand notes (2026-11-09).
 *
 * Two drawings:
 * - ConstructionStrip: the owner's "Letter D transformation to a butterfly"
 *   artwork -- one D, the D mirrored, four Ds, the butterfly they make --
 *   redrawn as thin ink lines on white (the original sat on a dark panel),
 *   ending in the filled butterfly in the logo's colours.
 * - TiltingMark: the logo icon shown upright as a butterfly, which turns 45
 *   degrees into the "+" of medicine and healing when it scrolls into view
 *   (and back and forth on hover). The official icon file *is* the "+"
 *   position, so the butterfly is that file rotated -45deg. */

const LINE = { fill: "none", stroke: "#231F20", strokeOpacity: 0.55, strokeWidth: 0.9, strokeMiterlimit: 10 };

// Final butterfly (upright). Colours follow the logo once it is turned
// upright: top-left lime, bottom-left orange, bottom-right blue,
// top-right gold, body and head ink.
const FILLED = [
  ["#BBD531", "m550.36,47.44c-6.56-6.43-10.64-15.39-10.64-25.3v-4.43h4.43c9.91,0,18.89,4.07,25.31,10.63-2.68,3.950-4.74,8.35-6.03,13.08-4.72,1.28-9.12,3.34-13.07,6.02Z"],
  ["#231F20", "m580.85,28.34c-2.23,2.27-4.15,4.85-5.7,7.65-1.55-2.81-3.48-5.38-5.71-7.65,1.67-2.46,3.58-4.75,5.71-6.82,2.12,2.07,4.03,4.36,5.7,6.82Z"],
  ["#F16722", "m569.44,77.94c-4.79-7.07-7.59-15.61-7.59-24.8,0-.62,0-1.24.04-1.86-13,5.24-22.17,17.98-22.17,32.86v4.44h4.43c9.92,0,18.87-4.07,25.29-10.64Z"],
  ["#1D9CD7", "m580.86,77.94c4.79-7.07,7.59-15.61,7.59-24.8,0-.62,0-1.24-.04-1.86,13,5.24,22.17,17.98,22.17,32.86v4.44h-4.43c-9.92,0-18.87-4.07-25.29-10.64Z"],
  ["#231F20", "m570.72,53.15c0,6.23,1.61,12.08,4.43,17.17,2.82-5.09,4.43-10.94,4.43-17.17h0c0-6.23-1.61-12.07-4.43-17.16-2.82,5.08-4.430,10.93-4.43,17.16h0Z"],
  ["#CD902D", "m606.15,17.71c-9.91,0-18.87,4.08-25.3,10.64h0c2.68,3.95,4.74,8.35,6.02,13.07,4.72,1.29,9.140,3.34,13.09,6.02,6.56-6.43,10.62-15.39,10.62-25.3v-4.43h-4.43Z"],
];

const OUTLINES = [
  // 1. The letter D (inner and outer)
  "m17.72,17.72h4.43c19.56,0,35.43,15.88,35.43,35.43h0c0,19.56-15.88,35.43-35.43,35.43h-4.43V17.72h0Z",
  "m8.86,8.86h13.3c24.45,0,44.29,19.85,44.29,44.29h0c0,24.45-19.85,44.29-44.29,44.29h-13.3V8.86h0Z",
  // 2. D and its mirror, meeting in the middle
  "m102.64,17.72h70.87v70.87h-70.87z",
  "m93.78,8.86h88.58v88.58h-88.58z",
  "m102.64,17.72h4.43c19.56,0,35.43,15.88,35.43,35.43h0c0,19.56-15.88,35.43-35.43,35.43h-4.43V17.72h0Z",
  "m169.07,17.72h4.43v70.87h-4.43c-19.56,0-35.43-15.88-35.43-35.43h0c0-19.56,15.88-35.43,35.43-35.43Z",
  "m93.78,8.86h13.3c24.45,0,44.29,19.85,44.29,44.29h0c0,24.45-19.85,44.29-44.29,44.29h-13.3V8.86h0Z",
  "m169.06,8.86h13.3v88.58h-13.3c-24.45,0-44.29-19.85-44.29-44.29h0c0-24.45,19.85-44.29,44.29-44.29Z",
  // 3. Four Ds, one from each side
  "m218.55,17.72h70.87v70.87h-70.87z",
  "m209.69,8.86h88.58v88.58h-88.58z",
  "m218.55,17.72h4.43c19.56,0,35.43,15.88,35.43,35.43h0c0,19.56-15.88,35.43-35.43,35.43h-4.43V17.72h0Z",
  "m284.98,17.72h4.43v70.87h-4.43c-19.56,0-35.43-15.88-35.43-35.43h0c0-19.56,15.88-35.43,35.43-35.43Z",
  "m209.69,8.86h13.3c24.45,0,44.29,19.85,44.29,44.29h0c0,24.45-19.85,44.29-44.29,44.29h-13.3V8.86h0Z",
  "m284.98,8.86h13.3v88.58h-13.3c-24.45,0-44.29-19.85-44.29-44.29h0c0-24.45,19.85-44.29,44.29-44.29Z",
  // 4. The butterfly they leave behind, inside the same square
  "m345.11,47.44c-6.56-6.43-10.64-15.39-10.64-25.3v-4.43s4.43,0,4.43,0c9.91,0,18.89,4.07,25.31,10.63-2.68,3.95-4.74,8.35-6.03,13.08-4.72,1.28-9.12,3.34-13.07,6.02Z",
  "m375.61,28.34c-2.23,2.27-4.15,4.85-5.7,7.65-1.55-2.81-3.48-5.38-5.71-7.65,1.67-2.46,3.58-4.75,5.71-6.82,2.12,2.07,4.03,4.36,5.7,6.82Z",
  "m364.19,77.94c-4.79-7.07-7.59-15.61-7.59-24.8,0-.62.01-1.24.04-1.86-13,5.24-22.17,17.98-22.17,32.86v4.44s4.43,0,4.43,0c9.92,0,18.87-4.07,25.29-10.64Z",
  "m375.61,77.94c4.79-7.07,7.59-15.61,7.59-24.8,0-.62,0-1.24-.04-1.86,13,5.24,22.17,17.98,22.17,32.86v4.44s-4.43,0-4.43,0c-9.92,0-18.87-4.07-25.29-10.64Z",
  "m365.47,53.15c0,6.23,1.61,12.08,4.43,17.17,2.82-5.09,4.43-10.94,4.43-17.170h0c0-6.23-1.61-12.07-4.43-17.16-2.82,5.08-4.43,10.93-4.43,17.16h0Z",
  "m400.9,17.72c-9.91,0-18.87,4.08-25.3,10.64h0c2.68,3.95,4.74,8.35,6.02,13.07,4.72,1.29,9.14,3.34,13.09,6.02,6.56-6.43,10.62-15.39,10.62-25.3v-4.43s-4.43,0-4.43,0Z",
  "m325.61,8.86h88.58v88.58h-88.58z",
  // 5. The butterfly on its own
  "m452.16,47.44c-6.56-6.43-10.64-15.39-10.64-25.3v-4.43h4.43c9.91,0,18.89,4.07,25.31,10.63-2.68,3.95-4.74,8.35-6.03,13.08-4.72,1.28-9.12,3.34-13.07,6.02Z",
  "m482.66,28.34c-2.23,2.27-4.15,4.85-5.7,7.65-1.55-2.81-3.48-5.38-5.71-7.65,1.67-2.46,3.58-4.75,5.71-6.82,2.12,2.07,4.03,4.36,5.7,6.82Z",
  "m471.24,77.94c-4.79-7.07-7.59-15.61-7.59-24.8,0-.62,0-1.24.04-1.86-13,5.24-22.17,17.98-22.17,32.86v4.44h4.43c9.92,0,18.87-4.07,25.29-10.64Z",
  "m482.66,77.94c4.79-7.07,7.59-15.61,7.59-24.8,0-.62,0-1.24-.04-1.86,13,5.24,22.17,17.98,22.17,32.86v4.44h-4.43c-9.92,0-18.87-4.07-25.29-10.64Z",
  "m472.52,53.15c0,6.23,1.61,12.08,4.43,17.17,2.82-5.09,4.43-10.94,4.43-17.17h0c0-6.23-1.61-12.07-4.43-17.16-2.82,5.08-4.43,10.93-4.43,17.16h0Z",
  "m507.96,17.71c-9.91,0-18.87,4.08-25.3,10.64h0c2.68,3.95,4.74,8.35,6.02,13.07,4.72,1.29,9.14,3.34,13.09,6.02,6.56-6.43,10.62-15.39,10.62-25.3v-4.43h-4.43Z",
];

const CIRCLES = [
  [129.2, 53.15], [138.07, 44.28], [146.93, 53.15], [138.07, 62.01], [138.07, 53.15],
  [245.12, 53.15], [253.98, 44.28], [262.85, 53.15], [253.98, 62.01], [253.98, 53.15],
];

const CAPTIONS = ["D", "Mirrored", "Four Ds", "The butterfly", "Set free", "In colour"];

function ConstructionStrip() {
  const reduce = useReducedMotion();
  return (
    <figure>
      <svg viewBox="0 0 619.44 106.3" className="w-full h-auto" role="img" aria-labelledby="d-story-title">
        <title id="d-story-title">One letter D, mirrored, then four Ds joined at the centre, forming the Dermarra butterfly</title>
        {/* The two D-rotations in step 3 use the original artwork's transforms. */}
        <g {...LINE}>
          {OUTLINES.map((d) => (
            <path key={d.slice(0, 18)} d={d} />
          ))}
          <path d="m234.05,33.22h4.43c19.56,0,35.43,15.88,35.43,35.43h0c0,19.56-15.88,35.43-35.43,35.43h-4.43V33.22h0Z" transform="translate(185.33 322.63) rotate(-90)" />
          <path d="m269.48,2.22h4.43v70.87h-4.43c-19.56,0-35.43-15.88-35.43-35.43h0c0-19.56,15.88-35.43,35.43-35.43Z" transform="translate(216.33 291.63) rotate(-90)" />
          <path d="m225.19,24.35h13.3c24.45,0,44.29,19.85,44.29,44.29h0c0,24.45-19.85,44.29-44.29,44.29h-13.3V24.35h0Z" transform="translate(185.34 322.63) rotate(-90)" />
          <path d="m269.48-6.64h13.3v88.58h-13.3c-24.45,0-44.29-19.85-44.29-44.29h0c0-24.45,19.85-44.29,44.29-44.29Z" transform="translate(216.33 291.63) rotate(-90)" />
          {CIRCLES.map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4.43" />
          ))}
        </g>
        <motion.g
          initial={reduce ? false : { opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
          style={{ transformOrigin: "575px 53px" }}
        >
          {FILLED.map(([fill, d]) => (
            <path key={d.slice(0, 18)} d={d} fill={fill} />
          ))}
        </motion.g>
      </svg>
      <figcaption className="mt-3 hidden sm:grid grid-cols-6 text-center text-xs font-semibold uppercase tracking-[0.12em] text-ink/70">
        {CAPTIONS.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </figcaption>
    </figure>
  );
}

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
      <motion.div variants={itemReveal} className="mt-14 sm:mt-16">
        <ConstructionStrip />
      </motion.div>
    </>
  );
}
