import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cloudinaryUrl } from "../api/client";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons.jsx";

const AUTO_ADVANCE_MS = 6000;

/** Admin-managed homepage hero carousel -- fills the viewport below the
 * navbar (h-16 = 4rem, see Navbar.jsx) and animates each slide's text in
 * on change. Renders nothing if there are no active slides -- the caller
 * (Home.jsx) falls back to a static hero in that case. */
export default function HeroCarousel({ slides }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) return null;

  const slide = slides[index];
  const imageUrl = cloudinaryUrl(slide.cloudinary_public_id, { width: 1600 });
  const goTo = (i) => setIndex(((i % slides.length) + slides.length) % slides.length);

  return (
    <section className="relative h-[calc(100vh-4rem)] min-h-[420px] overflow-hidden bg-ink">
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
      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent" />

      <div className="relative z-10 h-full flex flex-col justify-end sm:justify-center mx-auto max-w-6xl px-4 pb-16 sm:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {slide.eyebrow && (
              <p className="font-mono text-xs tracking-widest text-amber uppercase mb-3">{slide.eyebrow}</p>
            )}
            <h1 className="font-display text-3xl sm:text-5xl leading-tight text-bone-light max-w-2xl">
              {slide.title}
            </h1>
            {slide.subtitle && (
              <p className="mt-4 text-bone-light/80 max-w-xl">{slide.subtitle}</p>
            )}
            {slide.cta_label && slide.cta_link && (
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-block mt-6"
              >
                <Link
                  to={slide.cta_link}
                  className="block px-5 py-3 rounded-sm bg-amber text-bone-light text-sm font-semibold hover:bg-amber-dark transition-colors"
                >
                  {slide.cta_label}
                </Link>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {slides.length > 1 && (
        <>
          <button
            onClick={() => goTo(index - 1)}
            aria-label="Previous slide"
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-bone-light/20 hover:bg-bone-light/30 items-center justify-center text-bone-light transition-colors"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => goTo(index + 1)}
            aria-label="Next slide"
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-bone-light/20 hover:bg-bone-light/30 items-center justify-center text-bone-light transition-colors"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-amber" : "w-1.5 bg-bone-light/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
