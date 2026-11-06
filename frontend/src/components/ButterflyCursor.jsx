import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/** A butterfly that trails the pointer -- a native port of the owner-supplied
 * Framer component "ButterflyCursor" (framer.com/m/ButterflyCursor-ILlCpO.js,
 * by Shouvik Biswas). Rebuilt rather than embedded: Framer modules need
 * Framer's runtime.
 *
 * Same behaviour as the original: spring-follows the pointer, turns to face
 * its direction of travel (drifts back upright when still), wings flap in 3D,
 * and a click briefly makes them flap wider and faster. The native cursor
 * stays visible (the original's default), so nothing about pointing changes.
 *
 * Only mounts on a real mouse/trackpad (`pointer: fine`) and never under
 * prefers-reduced-motion -- on touch there's no pointer to follow. Purely
 * decorative: pointer-events none, aria-hidden. */

const WING_RIGHT =
  "M0.221799 0.392428C2.006 -1.40921 12 3.24805 12 9.14307C12 12.4736 10.7625 16 7.41203 16C3.91959 16 5.56313 10.7104 6.17939 9.79611C2.68705 10.2533 -0.942285 1.56789 0.221799 0.392428Z";
const WING_LEFT =
  "M11.7782 0.392428C9.994 -1.40921 0 3.24805 0 9.14307C0 12.4736 1.23752 16 4.58797 16C8.08041 16 6.43687 10.7104 5.82061 9.79611C9.31295 10.2533 12.9423 1.56789 11.7782 0.392428Z";

function useEnabled() {
  const query = "(pointer: fine) and (prefers-reduced-motion: no-preference)";
  const [enabled, setEnabled] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.(query).matches
  );
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return undefined;
    const update = () => setEnabled(mql.matches);
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return enabled;
}

// Contrast-aware colour: the wings take `color` unless what's under the
// pointer is too close to it (blue on a blue tile, or on orange/lime/gold,
// which are all similarly bright), then switch to `altColor`. Reads the first
// opaque background colour up the tree from the element under the pointer.
const parseRgb = (css) => {
  const m = css && css.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = "1"] = m[1].split(/[\s,/]+/).filter(Boolean);
  return parseFloat(a) < 0.5 ? null : [r, g, b].map(Number);
};
const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = ([r, g, b]) => {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
function backgroundAt(x, y) {
  let el = document.elementFromPoint(x, y);
  while (el && el !== document.documentElement) {
    const rgb = parseRgb(getComputedStyle(el).backgroundColor);
    if (rgb) return rgb;
    el = el.parentElement;
  }
  return parseRgb(getComputedStyle(document.body).backgroundColor) || [255, 255, 255];
}

function Butterfly({ color, altColor, size, smoothing }) {
  const width = 12 * size;
  const height = 16 * size;
  const mouseX = useMotionValue(window.innerWidth / 2);
  const mouseY = useMotionValue(window.innerHeight / 2);
  const opacity = useMotionValue(0);
  const x = useSpring(mouseX, { stiffness: 500, damping: 50 });
  const y = useSpring(mouseY, { stiffness: 500, damping: 50 });
  const smoothOpacity = useSpring(opacity, { stiffness: 400, damping: 30 });
  const rotate = useMotionValue(0);
  const hasMoved = useRef(false);
  const [boost, setBoost] = useState(false);
  const [flapKey, setFlapKey] = useState(0);
  const [fill, setFill] = useState(color);

  // Re-check the colour underneath once per frame at most, on move and scroll.
  useEffect(() => {
    const base = hexRgb(color);
    let frame = 0;
    const check = () => {
      frame = 0;
      setFill(contrast(base, backgroundAt(mouseX.get(), mouseY.get())) < 2 ? altColor : color);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    window.addEventListener("pointermove", schedule, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    return () => {
      window.removeEventListener("pointermove", schedule);
      window.removeEventListener("scroll", schedule, { capture: true });
      cancelAnimationFrame(frame);
    };
  }, [color, altColor, mouseX, mouseY]);

  useEffect(() => {
    let timeout = null;
    const onMove = (e) => {
      if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      if (!hasMoved.current) {
        x.jump(e.clientX);
        y.jump(e.clientY);
        hasMoved.current = true;
      }
      opacity.set(1);
    };
    const onLeave = () => {
      hasMoved.current = false;
      opacity.set(0);
    };
    const onDown = () => {
      setBoost(true);
      setFlapKey((k) => k + 1);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setBoost(false);
        setFlapKey((k) => k + 1);
      }, 200);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      clearTimeout(timeout);
    };
  }, [mouseX, mouseY, opacity, x, y]);

  // Face the direction of travel; ease back upright when still.
  useEffect(() => {
    let frame;
    const tick = () => {
      const vx = x.getVelocity();
      const vy = y.getVelocity();
      const moving = Math.hypot(vx, vy) > 15;
      const target = moving ? (Math.atan2(vy, vx) * 180) / Math.PI + 90 : 0;
      const current = rotate.get();
      let delta = target - (current % 360);
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      rotate.set(current + delta * (moving ? 0.08 : 0.015));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [x, y, rotate]);

  const baseAmplitude = 40 * (1 - smoothing * 0.4);
  const baseDuration = 0.4 + smoothing ** 2 * 1.8;
  const amplitude = boost ? baseAmplitude * 1.8 : baseAmplitude;
  const duration = boost ? baseDuration * 0.5 : baseDuration;
  const flap = (sign) => ({
    animate: { rotateY: [0, sign * amplitude, 0, sign * amplitude, 0] },
    transition: { repeat: Infinity, duration, ease: "easeInOut" },
  });

  return (
    <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-[9999]" style={{ perspective: 5000 }}>
      <motion.div
        style={{
          position: "absolute",
          left: x,
          top: y,
          x: "-50%",
          y: "-50%",
          width: width * 2,
          height,
          rotate,
          opacity: smoothOpacity,
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-full -translate-y-1/2" style={{ width, height }}>
          <motion.svg
            key={`r-${flapKey}`}
            viewBox="0 0 12 16"
            className="w-full h-full"
            style={{ transformOrigin: "right center" }}
            {...flap(1)}
          >
            <path d={WING_RIGHT} fill={fill} style={{ transition: "fill 0.2s" }} />
          </motion.svg>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-y-1/2" style={{ width, height }}>
          <motion.svg
            key={`l-${flapKey}`}
            viewBox="0 0 12 16"
            className="w-full h-full"
            style={{ transformOrigin: "left center" }}
            {...flap(-1)}
          >
            <path d={WING_LEFT} fill={fill} style={{ transition: "fill 0.2s" }} />
          </motion.svg>
        </div>
      </motion.div>
    </div>
  );
}

export default function ButterflyCursor({ color = "#1D9CD7", altColor = "#231F20", size = 2, smoothing = 0.6 }) {
  const enabled = useEnabled();
  return enabled ? <Butterfly color={color} altColor={altColor} size={size} smoothing={smoothing} /> : null;
}
