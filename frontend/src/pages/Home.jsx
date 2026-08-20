import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div>
      <section className="px-4 pt-10 pb-8 sm:pt-16 sm:pb-12 mx-auto max-w-6xl">
        <p className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-3">
          Barrier-first · Clinically precise
        </p>
        <h1 className="font-display text-3xl sm:text-5xl leading-tight text-ink max-w-2xl">
          Skin health, engineered as a system — not a shelf of standalone products.
        </h1>
        <p className="mt-4 text-ink/70 max-w-xl">
          Cleanse, treat, repair, protect. Every Derma routine is built around your skin
          concern, in the right order, at the right concentration.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            to="/quiz"
            className="px-5 py-3 rounded-sm bg-amber text-bone-light text-sm font-semibold hover:bg-amber-dark transition-colors"
          >
            Find your routine
          </Link>
          <Link
            to="/shop"
            className="px-5 py-3 rounded-sm border border-mist text-sm font-semibold text-ink hover:bg-mist/40 transition-colors"
          >
            Shop all products
          </Link>
        </div>
      </section>
    </div>
  );
}
