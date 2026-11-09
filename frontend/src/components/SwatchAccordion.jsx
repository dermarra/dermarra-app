import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInView, useReducedMotion } from "framer-motion";
import { ArrowRightIcon, PlusIcon } from "./Icons.jsx";

/** Homepage hero: the admin's banners (Hero slides) as colour strips that
 * open into image panels
 * -- a native port of the owner-supplied Framer component "Swatch Accordion"
 * (framer.com/m/SwatchAccordion-NZuH6I.js, by Matthias Ölschlegel). Rebuilt
 * rather than embedded: Framer modules need Framer's runtime.
 *
 * Same behaviour as the original:
 * - A row of strips; each closed strip shows its slice of the product photo
 *   under the product's colour, with number, vertical name and a "+". The
 *   open strip grows (0.75s, soft spring-like ease) and the photo is laid
 *   out at its final width, so nothing re-wraps while it moves; content pins
 *   to the edge that stays still.
 * - Opens on hover (110ms intent), click or keyboard (arrows / Home / End
 *   move focus, Enter opens). Hovering a closed strip widens it 14px and
 *   fills the "+" from below.
 * - On open: number and tags rise in, the title's words rise while its
 *   letters sharpen one after another, then the text and the button.
 * - Autoplay: a 2px progress line at the bottom of the open strip; when it
 *   fills, the next product opens. Pauses on hover, keyboard focus, or when
 *   the hero is off screen.
 * - Narrow containers (< 640px): stacked bars that open downwards.
 * - prefers-reduced-motion: no autoplay, instant transitions.
 *
 * Brand mapping (owner's rules): no gradients or glass -- the colour wash
 * on closed strips is a solid brand-colour layer, and the open text sits on
 * a solid brand-colour card (ink text, 5.2:1+); 8px radius; Simple Line
 * icons; the button is the site's standard 52px button.
 *
 * items: [{ key, title, description, tags[], image, focus (0-100),
 *           to (path or URL; optional), button, color }] */

const INTERVAL_S = 6;

// Banner links are free text in the admin: internal paths use the router,
// full URLs open as ordinary links, no link means no button.
function BannerLink({ to, className, children, ...rest }) {
  if (!to) return null;
  return /^https?:\/\//i.test(to) ? (
    <a href={to} className={className} {...rest}>
      {children}
    </a>
  ) : (
    <Link to={to} className={className} {...rest}>
      {children}
    </Link>
  );
}

function SplitTitle({ text }) {
  let c = 0;
  const words = String(text || "").split(/\s+/).filter(Boolean);
  return (
    <span aria-hidden="true">
      {words.map((word, wi) => (
        <span key={wi}>
          <span className="swa-w" style={{ "--wi": wi }}>
            {Array.from(word).map((ch, k) => (
              <span key={k} className="swa-c" style={{ "--c": c++ }}>
                {ch}
              </span>
            ))}
          </span>
          {wi < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}

export default function SwatchAccordion({ items, height = 600, autoplay = true }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduced = useReducedMotion();
  const rootRef = useRef(null);
  const inView = useInView(rootRef, { margin: "0px 0px -10% 0px" });
  const triggers = useRef([]);
  const hoverTimer = useRef(null);
  const count = items.length;
  const [state, setState] = useState({ active: 0, prev: 0 });
  const [cycle, setCycle] = useState(0);
  const [hoverPause, setHoverPause] = useState(false);
  const [focusPause, setFocusPause] = useState(false);
  const active = Math.min(state.active, Math.max(0, count - 1));
  const autoplayOn = autoplay && !reduced && count > 1;

  const open = useCallback(
    (index) => {
      setCycle((c) => c + 1);
      setState((s) => (s.active === index ? s : { active: index, prev: s.active }));
    },
    []
  );
  const advance = () => open((active + 1) % count);

  const onStripEnter = (e, index) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => open(index), 110);
  };
  const onStripLeave = () => clearTimeout(hoverTimer.current);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  const onKeyDown = (e, index) => {
    const next = { ArrowRight: (index + 1) % count, ArrowDown: (index + 1) % count, ArrowLeft: (index - 1 + count) % count, ArrowUp: (index - 1 + count) % count, Home: 0, End: count - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    triggers.current[next]?.focus();
  };

  if (!count) return null;

  return (
    <div
      ref={rootRef}
      className="swa"
      data-instant={reduced ? "" : undefined}
      style={{ "--swa-n": count, "--swa-h": `${height}px` }}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHoverPause(true)}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setHoverPause(false);
        onStripLeave();
      }}
      onFocus={(e) => {
        let keyboard = true;
        try {
          keyboard = e.target.matches(":focus-visible");
        } catch {
          /* older browsers */
        }
        setFocusPause(keyboard);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocusPause(false);
      }}
    >
      <div className="swa-track">
        {items.map((item, index) => {
          const isOpen = index === active;
          const pinEnd = (isOpen && index > state.prev) || (index === state.prev && !isOpen && index > active);
          const triggerId = `swa-${uid}-t${index}`;
          const panelId = `swa-${uid}-p${index}`;
          const headingId = `swa-${uid}-h${index}`;
          const focus = Math.min(100, Math.max(0, item.focus ?? 50)) / 100;
          const num = String(index + 1).padStart(2, "0");
          return (
            <div
              key={item.key}
              className="swa-strip"
              data-open={isOpen ? "" : undefined}
              data-pin={pinEnd ? "end" : undefined}
              data-noimg={item.image ? undefined : ""}
              style={{ "--swa-color": item.color, "--swa-focus": focus }}
              onPointerEnter={(e) => onStripEnter(e, index)}
              onPointerLeave={onStripLeave}
            >
              <div className="swa-media" aria-hidden="true">
                {item.image ? (
                  <img className="swa-img" src={item.image} alt="" draggable="false" loading="eager" decoding="async" />
                ) : (
                  <span className="swa-img swa-placeholder">
                    <img src="/brand/icon-dark.svg" alt="" draggable="false" />
                  </span>
                )}
                <div className="swa-wash" />
              </div>

              <button
                ref={(el) => (triggers.current[index] = el)}
                id={triggerId}
                type="button"
                className="swa-trigger"
                aria-label={item.title}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => open(index)}
                onKeyDown={(e) => onKeyDown(e, index)}
              />
              {isOpen && <BannerLink to={item.to} className="swa-strip-link" tabIndex={-1} aria-hidden="true" />}

              <div className="swa-closed" aria-hidden="true">
                <span className="swa-num">{num}</span>
                <span className="swa-vt">
                  <span className="swa-vtitle">{item.title}</span>
                </span>
                <span className="swa-plw">
                  <span className="swa-plus">
                    <PlusIcon className="swa-pi w-3.5 h-3.5" />
                    <span className="swa-pf">
                      <PlusIcon className="swa-pi w-3.5 h-3.5" />
                    </span>
                  </span>
                </span>
              </div>

              <div
                id={panelId}
                role="region"
                aria-labelledby={headingId}
                className="swa-open"
                style={{ "--cn": Math.max(1, String(item.title).replace(/\s+/g, "").length) }}
                {...(isOpen ? {} : { inert: "", "aria-hidden": true })}
              >
                <div className="swa-top">
                  <span className="swa-rv swa-rv-num" aria-hidden="true">
                    <span className="swa-num">{num}</span>
                  </span>
                  {item.tags?.length > 0 && (
                    <ul className="swa-tags" aria-label="Details">
                      {item.tags.map((tag, i) => (
                        <li key={tag} className="swa-tag" style={{ "--i": i }}>
                          {tag}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="swa-content">
                  <h2 id={headingId} className="swa-title" aria-label={item.title}>
                    <SplitTitle text={item.title} />
                  </h2>
                  {item.description && (
                    <div className="swa-rv swa-rv-desc">
                      <p className="swa-desc">{item.description}</p>
                    </div>
                  )}
                  {item.to && (
                    <div className="swa-rc">
                      <BannerLink to={item.to} className="btn btn-dark swa-cta" tabIndex={isOpen ? 0 : -1}>
                        <span>{item.button || "Shop now"}</span>
                        <ArrowRightIcon className="w-4 h-4" />
                      </BannerLink>
                    </div>
                  )}
                </div>
                {autoplayOn && isOpen && (
                  <div className="swa-progress" aria-hidden="true">
                    <i
                      key={`${index}-${cycle}`}
                      style={{
                        animationDuration: `${INTERVAL_S}s`,
                        animationPlayState: hoverPause || focusPause || !inView ? "paused" : "running",
                      }}
                      onAnimationEnd={advance}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
