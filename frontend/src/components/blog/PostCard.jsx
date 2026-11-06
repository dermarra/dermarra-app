import { Link } from "react-router-dom";
import { cloudinaryUrl } from "../../api/client";
import { BRAND_ACCENTS } from "../ServiceTiles.jsx";

export const postDate = (iso) =>
  iso ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : "";

/** Blog card: 16:9 cover (or a brand-colour panel), category, title,
 * summary, date + reading time. `featured` = the big two-column version. */
export default function PostCard({ post, index = 0, featured = false }) {
  const img = cloudinaryUrl(post.cover_public_id, { width: featured ? 1400 : 800 });
  const meta = `${postDate(post.published_at)} · ${post.reading_minutes} min read`;
  return (
    <Link
      to={`/blog/${post.slug}`}
      className={`group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue rounded-lg ${
        featured ? "lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12 lg:items-center" : ""
      }`}
    >
      <span className="block aspect-[16/9] overflow-hidden rounded-lg" style={{ backgroundColor: BRAND_ACCENTS[index % BRAND_ACCENTS.length] }}>
        {img && <img src={img} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />}
      </span>
      <span className={`block ${featured ? "mt-6 lg:mt-0" : "mt-5"}`}>
        {post.category && <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">{post.category.name}</span>}
        <span className={`block mt-2 font-semibold leading-tight text-ink group-hover:underline underline-offset-4 decoration-2 ${featured ? "text-4xl lg:text-5xl" : "text-2xl"}`}>
          {post.title}
        </span>
        {post.excerpt && <span className={`block mt-3 text-ink/75 ${featured ? "text-lg" : "line-clamp-3"}`}>{post.excerpt}</span>}
        <span className="block mt-3 text-sm text-ink/70">{meta}</span>
      </span>
    </Link>
  );
}
