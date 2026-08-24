import { motion } from "framer-motion";

export const containerReveal = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

export const itemReveal = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

/** Scroll-triggered reveal wrapper, shared across landing/shop/quiz/cart pages. */
export default function Reveal({ children, className = "", as: Component = motion.div, ...props }) {
  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={containerReveal}
      {...props}
    >
      {children}
    </Component>
  );
}
