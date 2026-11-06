import { useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { InstagramIcon, FacebookIcon, TiktokIcon } from "./Icons.jsx";
import Logo from "./Logo.jsx";
import BrandStripe from "./BrandStripe.jsx";

const QUICK_LINKS = [
  { to: "/shop", label: "Shop all products" },
  { to: "/quiz", label: "Find your routine" },
  { to: "/shop/step/prep", label: "Shop by step" },
  { to: "/account", label: "My account" },
];

// Real profile URLs come from the build env (VITE_INSTAGRAM_URL etc. --
// set them on Netlify). Unset ones are hidden, rather than linking to the
// generic instagram.com/facebook.com/tiktok.com homepages as before.
const SOCIAL_LINKS = [
  { href: import.meta.env.VITE_INSTAGRAM_URL, label: "Instagram", Icon: InstagramIcon },
  { href: import.meta.env.VITE_FACEBOOK_URL, label: "Facebook", Icon: FacebookIcon },
  { href: import.meta.env.VITE_TIKTOK_URL, label: "TikTok", Icon: TiktokIcon },
].filter((link) => link.href);

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
    <footer className="mt-16 bg-ink text-white">
      <BrandStripe className="h-2" />
      <div className="mx-auto max-w-6xl px-4 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <Link to="/" aria-label="Dermarra Skincare home" className="inline-block">
            <Logo variant="light" className="h-7" />
          </Link>
          <p className="text-sm text-white/75 mt-4 max-w-xs">
            Skin health, engineered as a system -- cleanse, treat, repair, protect.
          </p>
          {SOCIAL_LINKS.length > 0 && <div className="flex gap-3 mt-4">
            {SOCIAL_LINKS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-blue hover:text-ink transition-colors"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>}
        </div>

        <div>
          <p className="text-xs font-bold tracking-widest text-lime uppercase mb-3">Quick links</p>
          <ul className="flex flex-col gap-2">
            {QUICK_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-sm text-white/80 hover:text-white transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-bold tracking-widest text-gold uppercase mb-3">Company</p>
          <ul className="flex flex-col gap-2">
            <li><Link to="/terms" className="text-sm text-white/80 hover:text-white transition-colors">Terms &amp; conditions</Link></li>
            <li><Link to="/privacy" className="text-sm text-white/80 hover:text-white transition-colors">Privacy policy</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-bold tracking-widest text-blue uppercase mb-3">Get in touch</p>
          <p className="text-sm text-white/80 mb-3">Skincare tips and new-routine drops, occasionally.</p>
          <form onSubmit={handleSubscribe} className="flex flex-col gap-2">
            <input
              type="email"
              required
              aria-label="Email address"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md px-3 py-2.5 text-sm bg-white text-ink placeholder:text-ink/50"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="px-4 py-2.5 rounded-md bg-orange text-ink font-bold text-sm hover:bg-orange-400 disabled:opacity-50 transition-colors"
            >
              {status === "sending" ? "Signing up…" : status === "sent" ? "Subscribed ✓" : "Subscribe"}
            </button>
            {error && <p className="text-xs text-orange-300">{error}</p>}
          </form>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/70">
          <p>© {new Date().getFullYear()} Dermarra Skincare. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
