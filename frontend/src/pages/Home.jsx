import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import client, { cloudinaryUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import SwatchAccordion from "../components/SwatchAccordion.jsx";
import BrandStory from "../components/BrandStory.jsx";
import ServiceTiles, { BRAND_ACCENTS, productSummary } from "../components/ServiceTiles.jsx";
import Reveal, { containerReveal, itemReveal } from "../components/Reveal.jsx";
import FluidCardStack from "../components/FluidCardStack.jsx";
import { BadgeIcon, ChemistryIcon, DropletIcon, LayersIcon } from "../components/Icons.jsx";

// Fallback copy for a step group whose admin-editable `description` hasn't
// been filled in yet -- keyed by Product.step_type so it lines up
// regardless of what the StepGroup's own label/key is.
const STEP_COPY = {
  cleanser: "Strip nothing but the day. A pH-correct cleanse that keeps the barrier intact.",
  serum: "Actives dosed at the concentration that actually changes skin, in the right order.",
  barrier_cream: "Rebuild the lipid barrier the actives just worked through.",
  spf: "Broad-spectrum SPF, every morning — the step that makes the other three worth it.",
};

const HERO_COLORS = ["#1D9CD7", "#F16722", "#BBD531", "#CD902D"]; // blue, orange, lime, gold

// "Why Dermarra" cards (FluidCardStack). Solid brand fills with brand-black
// text (5.2-9.8:1). No gradients.
const PRINCIPLES = [
  {
    key: "barrier",
    title: "Barrier-first",
    description:
      "Every product is designed to protect, restore, and strengthen your skin barrier first — long-term skin health over short-term cosmetic gains.",
    icon: DropletIcon,
    fill: "bg-lime",
    to: "/shop",
    cta: "Shop the range",
  },
  {
    key: "system",
    title: "System-based skincare",
    description:
      "Instead of standalone products, we build coordinated systems where each step has a defined role, working together to maximize results and minimize irritation.",
    icon: LayersIcon,
    fill: "bg-blue",
    to: "/quiz",
    cta: "Find your routine",
  },
  {
    key: "precision",
    title: "Clinical precision",
    description:
      "Every formula is built on scientifically proven actives at optimal concentrations — no unnecessary complexity, no unproven trends.",
    icon: ChemistryIcon,
    fill: "bg-orange",
    to: "/shop",
    cta: "See the formulas",
  },
  {
    key: "in-house",
    title: "Made in-house",
    description:
      "We formulate and make every product ourselves, in small batches. Every batch is tracked, with its expiry date, from production to your door.",
    icon: BadgeIcon,
    fill: "bg-gold",
    to: "/shop",
    cta: "Shop all products",
  },
];
// Shop-by-step accents follow the logo's petals: prep, treat, seal, protect.
const STEP_ACCENTS = { cleanser: "#BBD531", serum: "#F16722", barrier_cream: "#1D9CD7", spf: "#CD902D" };

export default function Home() {
  const { user } = useAuth();
  const [concerns, setConcerns] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [stepGroups, setStepGroups] = useState([]);
  const [heroSlides, setHeroSlides] = useState([]);
  const [products, setProducts] = useState([]);
  const [featuredCoupon, setFeaturedCoupon] = useState(null);

  useEffect(() => {
    // Each section just stays hidden/empty if its request fails -- the
    // .catch keeps that from surfacing as an unhandled rejection.
    const ignore = () => {};
    client.get("/products/concerns").then(({ data }) => setConcerns(data)).catch(ignore);
    client.get("/products/ingredients").then(({ data }) => setIngredients(data.slice(0, 6))).catch(ignore);
    client.get("/products/step-groups").then(({ data }) => setStepGroups(data)).catch(ignore);
    client.get("/hero-slides").then(({ data }) => setHeroSlides(data)).catch(ignore);
    client.get("/products").then(({ data }) => setProducts(data)).catch(ignore);
    client.get("/coupons/featured").then(({ data }) => setFeaturedCoupon(data)).catch(ignore);
  }, []);

  // Hero panels: the banners admins post under Admin -> Hero slides (not the
  // catalogue -- owner, 2026-11-10), in their admin order, cycling the four
  // brand colours.
  const heroItems = heroSlides.map((slide, i) => ({
    key: slide.id,
    title: slide.title?.trim(),
    description: slide.subtitle,
    tags: slide.eyebrow ? [slide.eyebrow] : [],
    image: cloudinaryUrl(slide.cloudinary_public_id, { width: 1600 }),
    to: slide.cta_link,
    button: slide.cta_label,
    color: HERO_COLORS[i % HERO_COLORS.length],
  }));
  const heroHeight = typeof window === "undefined" ? 560 : Math.max(480, Math.min(640, window.innerHeight - 360));

  return (
    <div className="overflow-x-hidden">
      {/* ---------- Hero: the admin's banners, as a swatch accordion ----------
          No data-nav here: the navbar stays white over the hero (owner,
          2026-11-09) and takes a brand colour from the next section on. */}
      <section className="px-5 sm:px-8 lg:px-12 pt-8 sm:pt-12 pb-12 sm:pb-16 mx-auto max-w-[1440px]">
        <motion.div
          initial="hidden"
          animate="show"
          variants={containerReveal}
          className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8 sm:mb-10"
        >
          <div className="max-w-3xl">
            <motion.p variants={itemReveal} className="text-sm font-semibold tracking-[0.18em] text-lime-800 uppercase mb-3">
              Barrier-first · Clinically precise
            </motion.p>
            <motion.h1 variants={itemReveal} className="font-display font-semibold text-4xl sm:text-5xl leading-[1.05] text-ink">
              Skin health, engineered as a system.
            </motion.h1>
          </div>
          <motion.div variants={itemReveal} className="flex flex-wrap gap-3 shrink-0">
            <Link to="/quiz" className="btn btn-primary">
              Find your routine
            </Link>
            <Link to="/shop" className="btn btn-secondary">
              Shop all products
            </Link>
          </motion.div>
        </motion.div>
        {heroItems.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
            <SwatchAccordion items={heroItems} height={heroHeight} />
          </motion.div>
        )}
      </section>

      {/* Each section's data-nav colour is what the navbar turns while it's
          under it (Navbar.jsx). Cycles blue, orange, lime, gold. */}

      {/* ---------- Why Dermarra ---------- */}
      <Reveal as={motion.section} data-nav="orange" className="px-5 sm:px-8 lg:px-12 py-16 sm:py-20 mx-auto max-w-[1440px]">
        <div className="max-w-2xl">
          <motion.p variants={itemReveal} className="text-sm font-semibold tracking-[0.18em] text-blue-700 uppercase mb-3">
            Why Dermarra
          </motion.p>
          <motion.h2 variants={itemReveal} className="font-display font-semibold text-3xl sm:text-4xl text-ink mb-4">
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

        <motion.div variants={itemReveal} className="mt-10">
          <FluidCardStack cards={PRINCIPLES} />
        </motion.div>
      </Reveal>

      {/* ---------- Our story: the name and the mark ---------- */}
      <Reveal as={motion.section} data-nav="lime" className="px-5 sm:px-8 lg:px-12 py-16 sm:py-20 mx-auto max-w-[1440px]">
        <BrandStory />
      </Reveal>

      {/* ---------- Shop by concern ---------- */}
      {concerns.length > 0 && (
        <Reveal as={motion.section} data-nav="gold" className="px-5 sm:px-8 lg:px-12 py-16 mx-auto max-w-[1440px]">
          <motion.div variants={itemReveal}>
            <ServiceTiles
              label="concerns"
              variant="compact"
              heading={
                <>
                  <h2 className="text-3xl sm:text-4xl text-ink mb-2 max-w-xl">Shop by concern.</h2>
                  <p className="text-lg text-ink/80 max-w-xl">
                    Tell us what you&apos;re seeing, get a routine and products built to remedy it.
                  </p>
                </>
              }
              tiles={concerns.map((concern, index) => ({
                key: `concern-${concern.id}`,
                to: `/shop/concern/${concern.slug}`,
                title: concern.name,
                category: `Concern ${String(index + 1).padStart(2, "0")}`,
                description: concern.description,
                imageId: concern.cloudinary_public_id,
                ...productSummary(products.filter((p) => p.skin_concerns?.some((c) => c.id === concern.id))),
                cta: `Shop for ${concern.name.toLowerCase()}`,
                accent: BRAND_ACCENTS[index % BRAND_ACCENTS.length],
              }))}
            />
          </motion.div>
        </Reveal>
      )}

      {/* ---------- Shop by step ---------- */}
      {stepGroups.length > 0 && (
        <Reveal as={motion.section} data-nav="blue" className="px-5 sm:px-8 lg:px-12 py-16 mx-auto max-w-[1440px]">
          <motion.div variants={itemReveal}>
            <ServiceTiles
              label="steps"
              variant="step"
              heading={
                <>
                  <h2 className="text-3xl sm:text-4xl text-ink mb-2 max-w-xl">Shop by step.</h2>
                  <p className="text-lg text-ink/80 max-w-xl">
                    Only need one thing? Our 4-step system -- cleanse, treat, repair, protect -- works
            just as well one product at a time.
                  </p>
                </>
              }
              tiles={stepGroups.map((group, index) => ({
                key: `step-${group.id}`,
                to: `/shop/step/${group.key}`,
                title: group.label,
                step: { index: index + 1, total: stepGroups.length },
                description: group.description || STEP_COPY[group.step_type],
                imageId: group.cloudinary_public_id,
                cta: "View all",
                accent: STEP_ACCENTS[group.step_type],
              }))}
            />
          </motion.div>
        </Reveal>
      )}

      {/* ---------- Shop by ingredient ---------- */}
      {ingredients.length > 0 && (
        <Reveal as={motion.section} data-nav="orange" className="px-5 sm:px-8 lg:px-12 py-16 mx-auto max-w-[1440px]">
          <motion.div variants={itemReveal}>
            <ServiceTiles
              label="ingredients"
              heading={
                <>
                  <h2 className="text-3xl sm:text-4xl text-ink mb-2 max-w-xl">Shop by active ingredient.</h2>
                  <p className="text-lg text-ink/80 max-w-xl">
                    Look for products by what&apos;s actually doing the work.
                  </p>
                </>
              }
              tiles={ingredients.map((ingredient, index) => ({
                key: `ingredient-${ingredient.id}`,
                to: `/shop/ingredient/${ingredient.slug}`,
                title: ingredient.name,
                category: "Active ingredient",
                description: ingredient.description,
                imageId: ingredient.cloudinary_public_id,
                ...productSummary(products.filter((p) => p.ingredients?.some((i) => i.id === ingredient.id))),
                cta: `Shop ${ingredient.name}`,
                accent: BRAND_ACCENTS[index % BRAND_ACCENTS.length],
              }))}
            />
          </motion.div>
        </Reveal>
      )}

      {/* ---------- Become a member ---------- */}
      {!user && (
        <Reveal as={motion.section} data-nav="lime" className="px-5 sm:px-8 lg:px-12 py-16 mx-auto max-w-[1440px]">
          <div className="rounded-lg bg-lime px-6 py-12 sm:py-14 text-center text-ink">
          <motion.p variants={itemReveal} className="text-sm font-semibold tracking-[0.18em] uppercase mb-3">
            Join the family
          </motion.p>
          <motion.h2 variants={itemReveal} className="font-display font-semibold text-3xl sm:text-4xl text-ink">
            Your skin&apos;s story is just getting started. Let&apos;s write it together.
          </motion.h2>
          <motion.p variants={itemReveal} className="mt-3 max-w-md mx-auto">
            Create your Dermarra account to save your quiz results, build a wishlist, track
            orders, and pick up your routine right where you left off.
          </motion.p>
          {featuredCoupon && (
            <motion.p variants={itemReveal} className="mt-4 mx-auto w-fit rounded-lg bg-white px-4 py-2 text-sm font-semibold">
              Join now and use {featuredCoupon.code} for {featuredCoupon.discount_type === "percent"
                ? `${featuredCoupon.discount_value}% off your first order.`
                : `KES ${(featuredCoupon.discount_value / 100).toFixed(0)} off your first order.`}
            </motion.p>
          )}
          <motion.div
            variants={itemReveal}
            className="mt-6 inline-block"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Link
              to="/signup"
              className="btn btn-dark"
            >
              Join Dermarra
            </Link>
          </motion.div>
          </div>
        </Reveal>
      )}

      {/* ---------- Closing CTA ---------- */}
      <Reveal as={motion.section} data-nav="blue" className="px-5 sm:px-8 lg:px-12 py-16 sm:py-20 mx-auto max-w-[1440px]">
        <motion.div
          variants={itemReveal}
          className="relative overflow-hidden rounded-lg bg-blue px-6 pt-14 pb-12 sm:pb-16 text-center"
        >
          <h2 className="relative text-3xl sm:text-4xl text-ink max-w-xl mx-auto">
            Not sure where to start? Answer three questions.
          </h2>
          <motion.div
            className="relative mt-6 inline-block"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Link
              to="/quiz"
              className="btn btn-primary"
            >
              Find your routine
            </Link>
          </motion.div>
        </motion.div>
      </Reveal>
    </div>
  );
}
