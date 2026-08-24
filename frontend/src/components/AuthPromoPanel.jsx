import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import client, { cloudinaryUrl } from "../api/client";

const AUTO_ADVANCE_MS = 5000;
const MAX_SLIDES = 4;

/** The left-hand marketing panel on Login/Signup -- reuses the same
 * admin-managed hero slides shown on the homepage carousel (see
 * HeroCarousel.jsx / AdminHeroSlides.jsx) rather than a separate content
 * model, so admins manage one carousel, not two. Falls back to a plain
 * branded panel if no slides exist yet. */
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

  if (slides.length === 0) {
    return (
      <div className="relative h-full min-h-[280px] bg-ink flex items-center justify-center overflow-hidden">
        <motion.div
          aria-hidden="true"
          className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-amber/20 blur-2xl"
          animate={{ y: [0, 18, 0], x: [0, 12, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative z-10 text-center px-8">
          <p className="font-display text-2xl text-bone-light">
            Derma<span className="text-amber">.</span>
          </p>
          <p className="text-bone-light/70 text-sm mt-2 max-w-xs mx-auto">
            Skin health, engineered as a system -- cleanse, treat, repair, protect.
          </p>
        </div>
      </div>
    );
  }

  const slide = slides[index];
  const imageUrl = cloudinaryUrl(slide.cloudinary_public_id, { width: 1000 });

  return (
    <div className="relative h-full min-h-[280px] overflow-hidden bg-ink">
      <AnimatePresence mode="wait">
        {imageUrl && (
          <motion.img
            key={slide.id}
            src={imageUrl}
            alt={slide.title}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 0.55, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/30 to-transparent" />

      <div className="relative z-10 h-full flex flex-col justify-end p-8 sm:p-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {slide.eyebrow && (
              <p className="font-mono text-xs tracking-widest text-amber uppercase mb-2">{slide.eyebrow}</p>
            )}
            <h2 className="font-display text-2xl sm:text-3xl leading-tight text-bone-light max-w-xs">
              {slide.title}
            </h2>
            {slide.subtitle && (
              <p className="mt-2 text-sm text-bone-light/80 max-w-xs">{slide.subtitle}</p>
            )}
            {slide.cta_label && slide.cta_link && (
              <Link
                to={slide.cta_link}
                className="inline-block mt-4 text-sm font-semibold text-bone-light underline decoration-amber underline-offset-4 hover:text-amber transition-colors"
              >
                {slide.cta_label} →
              </Link>
            )}
          </motion.div>
        </AnimatePresence>

        {slides.length > 1 && (
          <div className="flex gap-2 mt-6">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-amber" : "w-1.5 bg-bone-light/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
