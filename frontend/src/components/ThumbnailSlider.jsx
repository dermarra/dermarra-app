import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, animate, useMotionValue, useReducedMotion } from "framer-motion";
import { cloudinaryUrl } from "../api/client";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons.jsx";

/** Product image gallery -- a native port of the owner-supplied Framer
 * component "ThumbnailSlider" (framer.com/m/ThumbnailSlider-kWGpU2.js).
 * Rebuilt rather than embedded: Framer modules need Framer's runtime (and the
 * original bundles the Swiper library; framer-motion is already on the page).
 *
 * Same behaviour as the original: a swipeable main slide synced with a
 * thumbnail tray (the active thumb gets a border and scrolls into view),
 * round prev/next arrows that grow and change colour on hover, a "1 / 5"
 * counter, and arrow-key navigation. Laid out like The Ordinary's product
 * page: thumbnails in a column on the left from `lg`, in a row underneath
 * on smaller screens.
 *
 * images: [cloudinary public id]; alt: text for the main image. */

const SPRING = { type: "spring", stiffness: 320, damping: 36 };

function Arrow({ dir, onClick, disabled }) {
  const Icon = dir === "prev" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous image" : "Next image"}
      className={`absolute top-1/2 -translate-y-1/2 ${
        dir === "prev" ? "left-3" : "right-3"
      } z-10 w-11 h-11 rounded-full bg-ink/70 text-white flex items-center justify-center transition-[background-color,color,transform,opacity] duration-200 hover:bg-blue hover:text-ink hover:scale-110 disabled:opacity-0 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

export default function ThumbnailSlider({ images, alt = "" }) {
  const count = images.length;
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const viewportRef = useRef(null);
  const trayRef = useRef(null);
  const x = useMotionValue(0);
  const reduceMotion = useReducedMotion();

  // Reset when a different product's images arrive.
  const key = images.join("|");
  useEffect(() => {
    setIndex(0);
    x.set(0);
  }, [key, x]);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Slide the track to the active image (also re-snaps after a resize).
  useEffect(() => {
    if (!width) return undefined;
    const controls = animate(x, -index * width, reduceMotion ? { duration: 0 } : SPRING);
    return () => controls.stop();
  }, [index, width, x, reduceMotion]);

  // Keep the active thumbnail visible inside the tray without scrolling the page.
  useEffect(() => {
    const tray = trayRef.current;
    const thumb = tray?.children[index];
    if (!tray || !thumb) return;
    const vertical = tray.scrollHeight > tray.clientHeight + 1;
    if (vertical) {
      const top = thumb.offsetTop - tray.offsetTop;
      if (top < tray.scrollTop) tray.scrollTop = top;
      else if (top + thumb.offsetHeight > tray.scrollTop + tray.clientHeight)
        tray.scrollTop = top + thumb.offsetHeight - tray.clientHeight;
    } else {
      const left = thumb.offsetLeft - tray.offsetLeft;
      if (left < tray.scrollLeft) tray.scrollLeft = left;
      else if (left + thumb.offsetWidth > tray.scrollLeft + tray.clientWidth)
        tray.scrollLeft = left + thumb.offsetWidth - tray.clientWidth;
    }
  }, [index]);

  const goTo = useCallback((i) => setIndex(Math.max(0, Math.min(count - 1, i))), [count]);

  const onDragEnd = (_, info) => {
    const swipe = info.offset.x + info.velocity.x * 0.2;
    if (swipe < -width / 5) goTo(index + 1);
    else if (swipe > width / 5) goTo(index - 1);
    else animate(x, -index * width, SPRING); // not far enough: settle back
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      goTo(index - 1);
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      goTo(index + 1);
    }
  };

  if (!count) return <div className="aspect-square bg-bone-light" />;

  return (
    <div className="flex flex-col-reverse lg:flex-row gap-3 lg:gap-4 min-w-0">
      {count > 1 && (
        <ul
          ref={trayRef}
          aria-label="Product images"
          className="flex lg:flex-col gap-2.5 overflow-auto lg:w-24 shrink-0 lg:max-h-[calc(5*6rem+4*0.625rem)] [scrollbar-width:none]"
        >
          {images.map((id, i) => (
            <li key={id} className="shrink-0">
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show image ${i + 1} of ${count}`}
                aria-current={i === index ? "true" : undefined}
                className={`block w-20 h-20 lg:w-24 lg:h-24 bg-bone-light overflow-hidden border-b-[3px] transition-[opacity,border-color] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${
                  i === index ? "border-ink opacity-100" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <img src={cloudinaryUrl(id, { width: 200 })} alt="" loading="lazy" className="w-full h-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        className="relative flex-1 min-w-0 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue"
        tabIndex={count > 1 ? 0 : undefined}
        onKeyDown={count > 1 ? onKeyDown : undefined}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${alt} images`}
      >
        <div ref={viewportRef} className="aspect-square overflow-hidden bg-bone-light">
          <motion.div
            className="flex h-full"
            style={{ x, touchAction: "pan-y" }}
            drag={count > 1 ? "x" : false}
            dragConstraints={{ left: -(count - 1) * width, right: 0 }}
            dragElastic={0.15}
            dragMomentum={false}
            onDragEnd={onDragEnd}
          >
            {images.map((id, i) => (
              <div
                key={id}
                className="relative w-full h-full shrink-0"
                aria-hidden={i !== index}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`}
              >
                <img
                  src={cloudinaryUrl(id, { width: 1000 })}
                  alt={i === 0 ? alt : `${alt}, image ${i + 1}`}
                  loading={i === 0 ? "eager" : "lazy"}
                  draggable="false"
                  className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                />
              </div>
            ))}
          </motion.div>
        </div>

        {count > 1 && (
          <>
            <Arrow dir="prev" onClick={() => goTo(index - 1)} disabled={index === 0} />
            <Arrow dir="next" onClick={() => goTo(index + 1)} disabled={index === count - 1} />
            <span
              className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-white text-ink text-xs font-semibold tabular-nums"
              aria-live="polite"
            >
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
