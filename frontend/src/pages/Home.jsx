import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import client, { cloudinaryUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import HeroCarousel from "../components/HeroCarousel.jsx";
import Reveal, { containerReveal, itemReveal } from "../components/Reveal.jsx";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/Icons.jsx";

// Fallback copy for a step group whose admin-editable `description` hasn't
// been filled in yet -- keyed by Product.step_type so it lines up
// regardless of what the StepGroup's own label/key is.
const STEP_COPY = {
  cleanser: "Strip nothing but the day. A pH-correct cleanse that keeps the barrier intact.",
  serum: "Actives dosed at the concentration that actually changes skin, in the right order.",
  barrier_cream: "Rebuild the lipid barrier the actives just worked through.",
  spf: "Broad-spectrum SPF, every morning — the step that makes the other three worth it.",
};

const PRINCIPLES = [
  {
    label: "Barrier-first",
    copy: "Every product is designed to protect, restore, and strengthen your skin barrier first — long-term skin health over short-term cosmetic gains.",
  },
  {
    label: "System-based skincare",
    copy: "Instead of standalone products, we build coordinated systems where each step has a defined role, working together to maximize results and minimize irritation.",
  },
  {
    label: "Clinical precision",
    copy: "Every formula is built on scientifically proven actives at optimal concentrations — no unnecessary complexity, no unproven trends.",
  },
];

function ConcernSlider({ concerns }) {
  const scrollRef = useRef(null);
  const scrollBy = (dir) => scrollRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {concerns.map((concern) => {
          const imageUrl = cloudinaryUrl(concern.cloudinary_public_id, { width: 300 });
          return (
            <Link
              key={concern.id}
              to={`/shop/concern/${concern.slug}`}
              className="group shrink-0 snap-start w-40 sm:w-48"
            >
              <div className="aspect-square rounded-sm bg-mist overflow-hidden">
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={concern.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
              </div>
              <p className="mt-2 text-sm font-semibold text-ink flex items-center gap-1">
                {concern.name}
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </p>
            </Link>
          );
        })}
      </div>

      {concerns.length > 4 && (
        <>
          <button
            onClick={() => scrollBy(-1)}
            aria-label="Scroll concerns left"
            className="hidden sm:flex absolute -left-4 top-[35%] -translate-y-1/2 w-9 h-9 rounded-full bg-bone-light border border-mist items-center justify-center text-ink/70 hover:text-ink shadow-sm"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => scrollBy(1)}
            aria-label="Scroll concerns right"
            className="hidden sm:flex absolute -right-4 top-[35%] -translate-y-1/2 w-9 h-9 rounded-full bg-bone-light border border-mist items-center justify-center text-ink/70 hover:text-ink shadow-sm"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [heroSlides, setHeroSlides] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [stepGroups, setStepGroups] = useState([]);

  useEffect(() => {
    client.get("/hero-slides").then(({ data }) => setHeroSlides(data));
    client.get("/products/concerns").then(({ data }) => setConcerns(data));
    client.get("/products/ingredients").then(({ data }) => setIngredients(data.slice(0, 6)));
    client.get("/products/step-groups").then(({ data }) => setStepGroups(data));
  }, []);

  return (
    <div className="overflow-x-hidden">
      {/* ---------- Hero ---------- */}
      {heroSlides.length > 0 ? (
        <HeroCarousel slides={heroSlides} />
      ) : (
        <section className="relative px-4 pt-10 pb-16 sm:pt-16 sm:pb-24 mx-auto max-w-6xl overflow-hidden">
          <motion.div
            aria-hidden="true"
            className="absolute -top-10 -right-16 w-64 h-64 rounded-full bg-amber/10 blur-2xl"
            animate={{ y: [0, 18, 0], x: [0, -10, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden="true"
            className="absolute top-24 right-1/3 w-40 h-40 rounded-full bg-sky/10 blur-2xl"
            animate={{ y: [0, -14, 0], x: [0, 12, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden="true"
            className="absolute -bottom-8 left-1/4 w-48 h-48 rounded-full bg-sage/10 blur-2xl"
            animate={{ y: [0, 16, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          />

          <motion.div initial="hidden" animate="show" variants={containerReveal} className="relative">
            <motion.p
              variants={itemReveal}
              className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-3"
            >
              Barrier-first · Clinically precise
            </motion.p>
            <motion.h1
              variants={itemReveal}
              className="font-display text-3xl sm:text-5xl leading-tight text-ink max-w-2xl"
            >
              Skin health, engineered as a system — not a shelf of standalone products.
            </motion.h1>
            <motion.p variants={itemReveal} className="mt-4 text-ink/70 max-w-xl">
              Cleanse, treat, repair, protect. Every Dermarra routine is built around your skin
              concern, in the right order, at the right concentration.
            </motion.p>
            <motion.div variants={itemReveal} className="mt-6 flex gap-3">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/quiz"
                  className="block px-5 py-3 rounded-sm bg-amber text-bone-light text-sm font-semibold hover:bg-amber-dark transition-colors"
                >
                  Find your routine
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/shop"
                  className="block px-5 py-3 rounded-sm border border-mist text-sm font-semibold text-ink hover:bg-mist/40 transition-colors"
                >
                  Shop all products
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        </section>
      )}

      {/* ---------- The Dermarra story ---------- */}
      <Reveal as={motion.section} className="px-4 py-16 sm:py-20 mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <motion.p variants={itemReveal} className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-2">
            Why Dermarra
          </motion.p>
          <motion.h2 variants={itemReveal} className="font-display text-2xl sm:text-3xl text-ink mb-4">
            Skincare engineered around your skin&apos;s biology, not market trends.
          </motion.h2>
          <motion.p variants={itemReveal} className="text-ink/70 leading-relaxed">
            We design science-led, result-oriented skin solutions built on a simple idea: skin
            needs a coordinated system, not a shelf of standalone products. Every Dermarra
            routine is engineered around cleansing, treatment, barrier repair and protection —
            in the right order, at the right concentration — for real, measurable outcomes
            instead of short-term appearance fixes.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-10">
          {PRINCIPLES.map((p, index) => (
            <motion.div key={p.label} variants={itemReveal} className="border-t border-mist pt-4">
              <span className="font-mono text-xs text-ink/40">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="font-display text-lg text-ink mt-2 mb-2">{p.label}</h3>
              <p className="text-sm text-ink/70 leading-relaxed">{p.copy}</p>
            </motion.div>
          ))}
        </div>
      </Reveal>

      {/* ---------- Shop by concern ---------- */}
      {concerns.length > 0 && (
        <Reveal as={motion.section} className="px-4 py-16 mx-auto max-w-6xl">
          <motion.h2 variants={itemReveal} className="font-display text-2xl sm:text-3xl text-ink mb-2 max-w-xl">
            Shop by concern.
          </motion.h2>
          <motion.p variants={itemReveal} className="text-ink/70 mb-8 max-w-xl">
            Tell us what you&apos;re seeing, get a routine and products built to remedy it.
          </motion.p>
          <ConcernSlider concerns={concerns} />
        </Reveal>
      )}

      {/* ---------- Shop by step ---------- */}
      {stepGroups.length > 0 && (
        <Reveal as={motion.section} className="px-4 py-16 mx-auto max-w-6xl">
          <motion.h2 variants={itemReveal} className="font-display text-2xl sm:text-3xl text-ink mb-2 max-w-xl">
            Shop by step.
          </motion.h2>
          <motion.p variants={itemReveal} className="text-ink/70 mb-8 max-w-xl">
            Only need one thing? Our 4-step system -- cleanse, treat, repair, protect -- works
            just as well one product at a time.
          </motion.p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stepGroups.map((group) => {
              const imageUrl = cloudinaryUrl(group.cloudinary_public_id, { width: 400 });
              return (
                <motion.div key={group.id} variants={itemReveal} whileHover={{ y: -3 }}>
                  <div className="aspect-square rounded-sm bg-mist overflow-hidden mb-3">
                    {imageUrl && (
                      <img src={imageUrl} alt={group.label} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <h3 className="font-display text-lg text-ink">{group.label}</h3>
                  <p className="text-sm text-ink/70 mt-1 leading-relaxed">
                    {group.description || STEP_COPY[group.step_type]}
                  </p>
                  <Link
                    to={`/shop/step/${group.key}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-amber hover:text-amber-dark mt-2"
                  >
                    View all <span>→</span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </Reveal>
      )}

      {/* ---------- Shop by ingredient ---------- */}
      {ingredients.length > 0 && (
        <Reveal as={motion.section} className="px-4 py-16 mx-auto max-w-6xl">
          <motion.h2 variants={itemReveal} className="font-display text-2xl sm:text-3xl text-ink mb-2 max-w-xl">
            Shop by active ingredient.
          </motion.h2>
          <motion.p variants={itemReveal} className="text-ink/70 mb-8 max-w-xl">
            Look for products by what&apos;s actually doing the work.
          </motion.p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {ingredients.map((ingredient) => {
              const imageUrl = cloudinaryUrl(ingredient.cloudinary_public_id, { width: 300 });
              return (
                <motion.div key={ingredient.id} variants={itemReveal}>
                  <Link to={`/shop/ingredient/${ingredient.slug}`} className="group block">
                    <div className="aspect-square rounded-sm bg-mist overflow-hidden">
                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt={ingredient.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      )}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-ink flex items-center gap-1">
                      {ingredient.name}
                      <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </p>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </Reveal>
      )}

      {/* ---------- Become a member ---------- */}
      {!user && (
        <Reveal as={motion.section} className="px-4 py-16 mx-auto max-w-4xl text-center">
          <motion.p variants={itemReveal} className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-3">
            Join the family
          </motion.p>
          <motion.h2 variants={itemReveal} className="font-display text-2xl sm:text-3xl text-ink">
            Your skin&apos;s story is just getting started. Let&apos;s write it together.
          </motion.h2>
          <motion.p variants={itemReveal} className="text-ink/70 mt-3 max-w-md mx-auto">
            Create your Dermarra account to save your quiz results, build a wishlist, track
            orders, and pick up your routine right where you left off.
          </motion.p>
          <motion.div
            variants={itemReveal}
            className="mt-6 inline-block"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Link
              to="/signup"
              className="inline-block px-6 py-3 rounded-sm bg-amber text-bone-light text-sm font-semibold hover:bg-amber-dark transition-colors"
            >
              Join Dermarra
            </Link>
          </motion.div>
        </Reveal>
      )}

      {/* ---------- Closing CTA ---------- */}
      <Reveal
        as={motion.section}
        className="px-4 py-16 sm:py-20 mx-auto max-w-6xl"
      >
        <motion.div
          variants={itemReveal}
          className="relative overflow-hidden rounded-sm bg-ink px-6 py-12 sm:py-16 text-center"
        >
          <motion.div
            aria-hidden="true"
            className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-amber/20 blur-2xl"
            animate={{ y: [0, 14, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden="true"
            className="absolute -bottom-16 -right-8 w-56 h-56 rounded-full bg-sky/20 blur-2xl"
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          />
          <h2 className="relative font-display text-2xl sm:text-3xl text-bone-light max-w-xl mx-auto">
            Not sure where to start? Answer three questions.
          </h2>
          <motion.div
            className="relative mt-6 inline-block"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Link
              to="/quiz"
              className="inline-block px-6 py-3 rounded-sm bg-amber text-bone-light text-sm font-semibold hover:bg-amber-dark transition-colors"
            >
              Find your routine
            </Link>
          </motion.div>
        </motion.div>
      </Reveal>
    </div>
  );
}
