import { Link } from "react-router-dom";
import { InstagramIcon, FacebookIcon, TiktokIcon } from "./Icons.jsx";
import NewsletterForm from "./NewsletterForm.jsx";

const QUICK_LINKS = [
  { to: "/shop", label: "Shop all products" },
  { to: "/quiz", label: "Find your routine" },
  { to: "/blog", label: "Blog" },
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
  return (
    // Light footer (owner, 2026-11-09: no dark backgrounds on the shop).
    // The brand shield (public/brand/shield.svg) with the line beside it.
    <footer className="mt-16 bg-white text-ink border-t border-mist">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] gap-10">
        <div>
          <Link to="/" aria-label="Dermarra Skincare home" className="flex items-center gap-5 max-w-sm">
            <img src="/brand/shield.svg" alt="" className="w-16 sm:w-20 h-auto shrink-0 select-none" draggable="false" />
            <span className="text-base leading-snug text-ink/80">
              Skin health, engineered as a system — cleanse, treat, repair, protect.
            </span>
          </Link>
          {SOCIAL_LINKS.length > 0 && <div className="flex gap-3 mt-6">
            {SOCIAL_LINKS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="w-10 h-10 rounded-full border border-ink/20 flex items-center justify-center text-ink hover:bg-blue hover:border-blue transition-colors"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>}
        </div>

        <div>
          <p className="text-xs font-semibold tracking-widest text-lime-800 uppercase mb-3">Quick links</p>
          <ul className="flex flex-col gap-2">
            {QUICK_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-sm text-ink/80 hover:text-blue-700 transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-widest text-gold-700 uppercase mb-3">Company</p>
          <ul className="flex flex-col gap-2">
            <li><Link to="/terms" className="text-sm text-ink/80 hover:text-blue-700 transition-colors">Terms &amp; conditions</Link></li>
            <li><Link to="/privacy" className="text-sm text-ink/80 hover:text-blue-700 transition-colors">Privacy policy</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-widest text-blue-700 uppercase mb-3">Get in touch</p>
          <p className="text-sm text-ink/80 mb-3">Skincare tips and new-routine drops, occasionally.</p>
          <NewsletterForm variant="light" source="footer" stacked />
        </div>
      </div>

      <div className="border-t border-mist">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-ink/70">
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
