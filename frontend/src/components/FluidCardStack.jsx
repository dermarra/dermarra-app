import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronRightIcon } from "./Icons.jsx";

/** A horizontal accordion of cards -- a native port of the owner-supplied
 * Framer component "Fluid Card Stack" (framer.com/m/Fluid-Card-Stack-qBHE.js).
 * Rebuilt rather than embedded: Framer modules need Framer's runtime.
 *
 * Same behaviour as the original: cards sit side by side in a 440px row,
 * 8px apart; the open card springs out to fill the row (spring stiffness 300,
 * damping 40) while the others narrow to 15% strips; the open card's icon
 * grows and its description and button fade in. Hovering a card opens it;
 * so do keyboard focus and tap. Below `lg` (the original's Tablet/Phone
 * variants) the cards stack vertically, all open.
 *
 * Brand mapping: solid brand fills with ink text (5.2:1+), no gradients.
 *
 * cards: [{ key, title, description, icon: Component, fill, to, cta }] */

const SPRING = { type: "spring", stiffness: 300, damping: 40, mass: 1 };

function useWide() {
  const query = "(min-width: 1024px)";
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setWide(mql.matches);
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return wide;
}

function CardBody({ card, index, open, animated }) {
  const Icon = card.icon;
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <motion.span
          className="inline-flex items-center justify-center rounded-full bg-ink text-white shrink-0 origin-top-left"
          initial={false}
          animate={{ width: open ? 88 : 48, height: open ? 88 : 48 }}
          transition={animated ? SPRING : { duration: 0 }}
        >
          {Icon && <Icon className={open ? "w-9 h-9" : "w-5 h-5"} />}
        </motion.span>
        <span className="text-xs font-semibold tabular-nums tracking-[0.14em]">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <div className="mt-auto pt-8">
        <h3
          className={
            open
              ? "text-3xl lg:text-4xl leading-tight [overflow-wrap:anywhere]"
              : // A closed strip is ~120px wide: run the title up the strip.
                "text-2xl leading-tight max-h-[16rem] [writing-mode:vertical-rl] rotate-180"
          }
        >
          {card.title}
        </h3>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              // Fixed width while the card grows, so text doesn't reflow
              // mid-spring (the original pins its copy at 500px).
              className="lg:w-[30rem] max-w-full"
              initial={animated ? { opacity: 0, y: 12 } : false}
              animate={{ opacity: 1, y: 0, transition: { delay: animated ? 0.15 : 0, duration: 0.3 } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            >
              <p className="mt-4 text-ink/85 leading-relaxed">{card.description}</p>
              {card.to && (
                <Link
                  to={card.to}
                  className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-ink text-white text-sm font-semibold hover:bg-ink-soft transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {card.cta}
                  <ChevronRightIcon className="w-3.5 h-3.5" />
                </Link>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export default function FluidCardStack({ cards }) {
  const wide = useWide();
  const reduceMotion = useReducedMotion();
  const [openIndex, setOpenIndex] = useState(0);

  if (!wide) {
    return (
      <div className="flex flex-col gap-2">
        {cards.map((card, index) => (
          <article key={card.key} className={`flex flex-col min-h-[18rem] rounded-2xl p-6 sm:p-8 text-ink ${card.fill}`}>
            <CardBody card={card} index={index} open animated={false} />
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 h-[440px]">
      {cards.map((card, index) => {
        const open = index === openIndex;
        return (
          <motion.article
            key={card.key}
            onMouseEnter={() => setOpenIndex(index)}
            onFocus={() => setOpenIndex(index)}
            // Every card has a 15% basis; the open one takes all the slack.
            style={{ flexBasis: "15%", flexShrink: 0 }}
            initial={false}
            animate={{ flexGrow: open ? 1 : 0 }}
            transition={reduceMotion ? { duration: 0 } : SPRING}
            className={`relative min-w-0 overflow-hidden rounded-2xl text-ink ${card.fill}`}
          >
            <div className="absolute inset-0 flex flex-col p-8">
              <CardBody card={card} index={index} open={open} animated={!reduceMotion} />
            </div>
            {!open && (
              // Whole closed strip is the control (tap / click / keyboard).
              <button
                type="button"
                onClick={() => setOpenIndex(index)}
                aria-expanded="false"
                aria-label={`Show: ${card.title}`}
                className="absolute inset-0 w-full h-full focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ink rounded-2xl"
              />
            )}
          </motion.article>
        );
      })}
    </div>
  );
}
