import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cloudinaryUrl } from "../api/client";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons.jsx";

const AUTO_ADVANCE_MS = 6000;

/** Admin-managed homepage hero carousel. Split layout, no dark scrim
 * (owner, 2026-11-09: no dark backgrounds on the storefront): the slide's
 * text sits on a solid brand-blue panel in ink, the photo beside it (above
 * it on phones). The section is data-nav="blue", so the navbar turns the
 * same blue while it is under it. Renders nothing without slides -- Home.jsx
 * falls back to a static hero. */
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
    <section
      data-nav="blue"
      className="relative grid lg:grid-cols-2 bg-blue text-ink lg:h-[calc(100svh-5rem)] lg:min-h-[560px] overflow-hidden"
    >
      <div className="relative order-1 lg:order-2 aspect-[4/3] lg:aspect-auto lg:h-full bg-blue-100 overflow-hidden">
        <AnimatePresence mode="wait">
          {imageUrl && (
            <motion.img
              key={slide.id}
              src={imageUrl}
              alt={slide.title}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
        </AnimatePresence>
      </div>

      <div className="relative order-2 lg:order-1 flex flex-col justify-center px-5 sm:px-8 lg:px-12 xl:pl-[max(3rem,calc((100vw-1440px)/2+3rem))] py-12 sm:py-16 lg:py-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="max-w-xl"
          >
            {slide.eyebrow && (
              <p className="text-sm sm:text-base font-semibold tracking-[0.18em] uppercase mb-4">{slide.eyebrow}</p>
            )}
            <h1 className="font-display font-semibold text-4xl sm:text-5xl lg:text-6xl leading-[1.05]">{slide.title}</h1>
            {slide.subtitle && <p className="mt-5 text-lg sm:text-xl font-medium">{slide.subtitle}</p>}
            {slide.cta_label && slide.cta_link && (
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-block mt-8">
                <Link
                  to={slide.cta_link}
                  className="block px-8 py-4 rounded-full bg-orange text-ink text-base sm:text-lg font-semibold hover:bg-orange-400 transition-colors"
                >
                  {slide.cta_label}
                </Link>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {slides.length > 1 && (
          <div className="mt-10 flex items-center gap-4">
            <button
              onClick={() => goTo(index - 1)}
              aria-label="Previous slide"
              className="w-11 h-11 rounded-full border border-ink flex items-center justify-center hover:bg-ink hover:text-white transition-colors"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => goTo(index + 1)}
              aria-label="Next slide"
              className="w-11 h-11 rounded-full border border-ink flex items-center justify-center hover:bg-ink hover:text-white transition-colors"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
            <div className="flex gap-2 ml-2">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === index ? "true" : undefined}
                  className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-ink" : "w-1.5 bg-ink/35"}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
