import { useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { InstagramIcon, FacebookIcon, TiktokIcon } from "./Icons.jsx";

const QUICK_LINKS = [
  { to: "/shop", label: "Shop all products" },
  { to: "/quiz", label: "Find your routine" },
  { to: "/shop/step/prep", label: "Shop by step" },
  { to: "/account", label: "My account" },
];

const SOCIAL_LINKS = [
  { href: "https://instagram.com", label: "Instagram", Icon: InstagramIcon },
  { href: "https://facebook.com", label: "Facebook", Icon: FacebookIcon },
  { href: "https://tiktok.com", label: "TikTok", Icon: TiktokIcon },
];

export default function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState(null);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    setError(null);
    setStatus("sending");
    try {
      await client.post("/newsletter/subscribe", { email });
      setStatus("sent");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setError(err.response?.data?.error || "Couldn't sign you up -- please try again.");
    }
  };

  return (
    <footer className="border-t border-mist bg-bone-light mt-16">
      <div className="mx-auto max-w-6xl px-4 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <Link to="/" className="font-display text-lg tracking-tight text-ink">
            Dermarra<span className="text-amber">+</span>
          </Link>
          <p className="text-sm text-ink/60 mt-3 max-w-xs">
            Skin health, engineered as a system -- cleanse, treat, repair, protect.
          </p>
          <div className="flex gap-3 mt-4">
            {SOCIAL_LINKS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="w-8 h-8 rounded-full border border-mist flex items-center justify-center text-ink/60 hover:text-ink hover:border-ink/40 transition-colors"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-3">Quick links</p>
          <ul className="flex flex-col gap-2">
            {QUICK_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-sm text-ink/70 hover:text-ink transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-3">Company</p>
          <ul className="flex flex-col gap-2">
            <li><Link to="/terms" className="text-sm text-ink/70 hover:text-ink transition-colors">Terms &amp; conditions</Link></li>
            <li><Link to="/privacy" className="text-sm text-ink/70 hover:text-ink transition-colors">Privacy policy</Link></li>
          </ul>
        </div>

        <div>
          <p className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-3">Get in touch</p>
          <p className="text-sm text-ink/70 mb-3">Skincare tips and new-routine drops, occasionally.</p>
          <form onSubmit={handleSubscribe} className="flex flex-col gap-2">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-mist rounded-sm px-3 py-2 text-sm bg-bone"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="px-4 py-2 rounded-sm bg-amber text-bone-light font-semibold text-sm disabled:opacity-50"
            >
              {status === "sending" ? "Signing up…" : status === "sent" ? "Subscribed ✓" : "Subscribe"}
            </button>
            {error && <p className="text-xs text-clay">{error}</p>}
          </form>
        </div>
      </div>

      <div className="border-t border-mist">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ink/50">
          <p>© {new Date().getFullYear()} Dermarra Skincare. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-ink transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-ink transition-colors">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
