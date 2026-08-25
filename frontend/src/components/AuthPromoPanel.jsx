import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import client, { cloudinaryUrl } from "../api/client";

const AUTO_ADVANCE_MS = 5000;
const MAX_SLIDES = 4;

/** The side panel on Login/Signup/ForgotPassword/ResetPassword -- reuses
 * the same admin-managed hero slides shown on the homepage carousel (see
 * HeroCarousel.jsx / AdminHeroSlides.jsx) rather than a separate content
 * model, so admins manage one carousel, not two. Styled as a contained
 * illustration + headline + dots (like a product feature panel), not a
 * full-bleed photo hero -- this sits inside a compact card, not the full
 * viewport. Falls back to a plain branded panel if no slides exist yet. */
export default function AuthPromoPanel() {
  const [slides, setSlides] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    client.get("/hero-slides").then(({ data }) => setSlides(data.slice(0, MAX_SLIDES)));
  }, []);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  const Dots = ({ count, active, onSelect }) =>
    count > 1 && (
      <div className="flex gap-1.5 mt-8">
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === active ? "w-6 bg-amber" : "w-1.5 bg-ink/15"
            }`}
          />
        ))}
      </div>
    );

  if (slides.length === 0) {
    return (
      <div className="h-full min-h-[320px] bg-mist/50 flex flex-col items-center justify-center text-center px-10 py-12">
        <p className="font-display text-2xl text-ink">
          Dermarra<span className="text-amber">+</span>
        </p>
        <p className="text-ink/60 text-sm mt-2 max-w-[220px]">
          Skin health, engineered as a system -- cleanse, treat, repair, protect.
        </p>
      </div>
    );
  }

  const slide = slides[index];
  const imageUrl = cloudinaryUrl(slide.cloudinary_public_id, { width: 500 });

  return (
    <div className="h-full min-h-[320px] bg-mist/50 flex flex-col items-center justify-center text-center px-10 py-12">
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-[260px] flex flex-col items-center"
        >
          {imageUrl && (
            <div className="w-full aspect-[4/3] rounded-sm overflow-hidden bg-bone-light mb-8 shadow-sm">
              <img src={imageUrl} alt={slide.title} className="w-full h-full object-cover" />
            </div>
          )}
          {slide.eyebrow && (
            <p className="font-mono text-[11px] tracking-widest text-sage-dark uppercase mb-2">
              {slide.eyebrow}
            </p>
          )}
          <h2 className="font-display text-xl leading-snug text-ink">{slide.title}</h2>
          {slide.subtitle && <p className="mt-2 text-sm text-ink/60">{slide.subtitle}</p>}
          {slide.cta_label && slide.cta_link && (
            <Link
              to={slide.cta_link}
              className="inline-block mt-5 px-5 py-2 rounded-full border border-mist text-sm font-semibold text-ink hover:bg-bone-light transition-colors"
            >
              {slide.cta_label}
            </Link>
          )}
        </motion.div>
      </AnimatePresence>

      <Dots count={slides.length} active={index} onSelect={setIndex} />
    </div>
  );
}
