import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import client, { cloudinaryUrl } from "../api/client";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import ProductCard from "../components/ProductCard.jsx";
import RoutineStepRail from "../components/RoutineStepRail.jsx";
import HeroCarousel from "../components/HeroCarousel.jsx";
import Reveal, { containerReveal, itemReveal } from "../components/Reveal.jsx";

const SYSTEM_STEPS = [
  {
    label: "Cleanse",
    copy: "Strip nothing but the day. A pH-correct cleanse that keeps the barrier intact.",
    accent: "bg-ink",
  },
  {
    label: "Treat",
    copy: "Actives dosed at the concentration that actually changes skin, in the right order.",
    accent: "bg-amber",
  },
  {
    label: "Repair",
    copy: "Rebuild the lipid barrier the actives just worked through.",
    accent: "bg-sage",
  },
  {
    label: "Protect",
    copy: "Broad-spectrum SPF, every morning — the step that makes the other three worth it.",
    accent: "bg-sky",
  },
];

export default function Home() {
  const { addItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [heroSlides, setHeroSlides] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [stepGroups, setStepGroups] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [products, setProducts] = useState([]);
  const [addedRoutineId, setAddedRoutineId] = useState(null);

  useEffect(() => {
    client.get("/hero-slides").then(({ data }) => setHeroSlides(data));
    client.get("/products/concerns").then(({ data }) => setConcerns(data));
    client.get("/products/ingredients").then(({ data }) => setIngredients(data.slice(0, 6)));
    client.get("/products/step-groups").then(({ data }) => setStepGroups(data));
    client.get("/routines").then(({ data }) => setRoutines(data.slice(0, 3)));
    client.get("/products").then(({ data }) => setProducts(data.slice(0, 8)));
  }, []);

  const addRoutineToCart = async (routineId) => {
    if (!user) {
      navigate("/login");
      return;
    }
    try {
      await addItem({ routineId });
      setAddedRoutineId(routineId);
      setTimeout(() => setAddedRoutineId(null), 1800);
    } catch {
      // swallowed -- this is a lightweight landing-page shortcut; the
      // full quiz/product-detail flows show a real error message.
    }
  };

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
              Cleanse, treat, repair, protect. Every Derma routine is built around your skin
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

      {/* ---------- How it works ---------- */}
      <Reveal as={motion.section} className="px-4 py-16 mx-auto max-w-6xl">
        <motion.p
          variants={itemReveal}
          className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-2"
        >
          The system
        </motion.p>
        <motion.h2 variants={itemReveal} className="font-display text-2xl sm:text-3xl text-ink mb-8 max-w-xl">
          Four steps, in order, every time.
        </motion.h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {SYSTEM_STEPS.map((step, index) => (
            <motion.div
              key={step.label}
              variants={itemReveal}
              whileHover={{ y: -4 }}
              className="rounded-sm border border-mist bg-bone-light p-4 flex flex-col gap-3"
            >
              <span className={`w-8 h-8 rounded-full ${step.accent} text-bone-light text-xs font-mono flex items-center justify-center`}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="font-semibold text-ink text-sm">{step.label}</h3>
              <p className="text-xs text-ink/70 leading-relaxed">{step.copy}</p>
            </motion.div>
          ))}
        </div>
      </Reveal>

      {/* ---------- Shop by concern ---------- */}
      {concerns.length > 0 && (
        <Reveal as={motion.section} className="px-4 py-16 mx-auto max-w-6xl">
          <motion.h2 variants={itemReveal} className="font-display text-2xl sm:text-3xl text-ink mb-8 max-w-xl">
            Common concerns.
          </motion.h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {concerns.map((concern) => {
              const imageUrl = cloudinaryUrl(concern.cloudinary_public_id, { width: 300 });
              return (
                <motion.div key={concern.id} variants={itemReveal}>
                  <Link to={`/shop/concern/${concern.slug}`} className="group block">
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
                </motion.div>
              );
            })}
          </div>
        </Reveal>
      )}

      {/* ---------- Shop by step ---------- */}
      {stepGroups.length > 0 && (
        <Reveal as={motion.section} className="px-4 py-16 mx-auto max-w-6xl">
          <motion.h2 variants={itemReveal} className="font-display text-2xl sm:text-3xl text-ink mb-2 max-w-xl">
            Shop by step.
          </motion.h2>
          <motion.p variants={itemReveal} className="text-ink/70 mb-8 max-w-xl">
            Our 4-step system is designed to build a complete routine. Explore each step
            to see what it does and which products belong there.
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
                  {group.description && (
                    <p className="text-sm text-ink/70 mt-1 leading-relaxed">{group.description}</p>
                  )}
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
            Look for products by what's actually doing the work.
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

      {/* ---------- Featured routines ---------- */}
      {routines.length > 0 && (
        <Reveal as={motion.section} className="px-4 py-16 mx-auto max-w-6xl">
          <motion.h2 variants={itemReveal} className="font-display text-2xl sm:text-3xl text-ink mb-8 max-w-xl">
            Built for a specific concern.
          </motion.h2>
          <div className="flex flex-col gap-6">
            {routines.map((routine) => {
              const routineImageUrl = cloudinaryUrl(routine.cloudinary_public_id, { width: 160 });
              return (
              <motion.div
                key={routine.id}
                variants={itemReveal}
                whileHover={{ y: -3 }}
                className="rounded-sm border border-mist bg-bone-light p-5 transition-shadow hover:shadow-lg hover:shadow-ink/5"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-sm bg-mist overflow-hidden shrink-0">
                      {routineImageUrl && (
                        <img src={routineImageUrl} alt={routine.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-display text-lg text-ink">{routine.name}</h3>
                      {routine.tagline && (
                        <p className="text-sm text-ink/70 mt-1">{routine.tagline}</p>
                      )}
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => addRoutineToCart(routine.id)}
                    className="shrink-0 px-4 py-2 rounded-sm bg-amber text-bone-light text-xs font-semibold hover:bg-amber-dark transition-colors whitespace-nowrap"
                  >
                    {addedRoutineId === routine.id
                      ? "Added to cart"
                      : user
                      ? `Add to cart${routine.bundle_discount_percent > 0 ? ` · Save ${routine.bundle_discount_percent}%` : ""}`
                      : "Sign in to add"}
                  </motion.button>
                </div>
                <RoutineStepRail steps={routine.steps} />
              </motion.div>
              );
            })}
          </div>
        </Reveal>
      )}

      {/* ---------- Featured products ---------- */}
      {products.length > 0 && (
        <Reveal as={motion.section} className="px-4 py-16 mx-auto max-w-6xl">
          <motion.h2 variants={itemReveal} className="font-display text-2xl sm:text-3xl text-ink mb-8 max-w-xl">
            The products behind the system.
          </motion.h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {products.map((product) => (
              <motion.div key={product.id} variants={itemReveal}>
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        </Reveal>
      )}

      {/* ---------- Become a member ---------- */}
      {/* NOTE: this is the marketing section only -- an actual signup
          discount isn't wired up yet (see CLAUDE.md/session notes: needs
          a decision between a hardcoded new-account discount vs. a real
          Coupon model before checkout can apply one). */}
      {!user && (
        <Reveal as={motion.section} className="px-4 py-16 mx-auto max-w-4xl text-center">
          <motion.p variants={itemReveal} className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-3">
            Become a member
          </motion.p>
          <motion.h2 variants={itemReveal} className="font-display text-2xl sm:text-3xl text-ink">
            Create an account and save on your first routine.
          </motion.h2>
          <motion.p variants={itemReveal} className="text-ink/70 mt-3 max-w-md mx-auto">
            Track orders, save your quiz results, build a wishlist, and reorder in one click.
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
              Sign up
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
