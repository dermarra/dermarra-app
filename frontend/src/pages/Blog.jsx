import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import client from "../api/client";
import PostCard from "../components/blog/PostCard.jsx";
import NewsletterForm from "../components/NewsletterForm.jsx";

/** /blog: category pills, the newest post as a feature, then a card grid. */
export default function Blog() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") || "";
  const [categories, setCategories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Blog · Dermarra Skincare";
    client.get("/blog/categories").then(({ data }) => setCategories(data.filter((c) => c.post_count > 0))).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    client
      .get("/blog/posts", { params: { category: category || undefined, limit: 13 } })
      .then(({ data }) => {
        setPosts(data.items);
        setPages(data.pages);
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [category]);

  const more = () =>
    client.get("/blog/posts", { params: { category: category || undefined, limit: 13, page: page + 1 } }).then(({ data }) => {
      setPosts((prev) => [...prev, ...data.items]);
      setPage(page + 1);
      setPages(data.pages);
    });

  const [first, ...rest] = posts;
  const pill = (active) =>
    `h-11 px-5 rounded-full border text-[15px] font-semibold transition-colors ${active ? "bg-ink border-ink text-white" : "bg-white border-ink/20 text-ink hover:border-ink"}`;

  return (
    <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 pt-12 sm:pt-16 pb-16">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">The Dermarra Blog</p>
        <h1 className="mt-3 text-5xl sm:text-6xl leading-[1.05]">Blog</h1>
        <p className="mt-4 text-lg text-ink/75">Skin science, ingredients and routines, explained plainly.</p>
      </header>

      {categories.length > 0 && (
        <div role="group" aria-label="Category" className="mt-8 flex flex-wrap gap-2">
          <button type="button" onClick={() => setParams({})} aria-pressed={!category} className={pill(!category)}>
            All
          </button>
          {categories.map((c) => (
            <button key={c.id} type="button" onClick={() => setParams({ category: c.slug })} aria-pressed={category === c.slug} className={pill(category === c.slug)}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="mt-12 text-ink/70">Loading posts…</p>
      ) : !first ? (
        <div className="mt-12 max-w-2xl p-8 rounded-lg bg-blue-50">
          <h2 className="text-3xl">First articles coming soon</h2>
          <p className="mt-2 text-ink/75">Get them in your inbox the day they go live.</p>
          <div className="mt-5">
            <NewsletterForm variant="light" source="blog-empty" />
          </div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}>
          <div className="mt-12">
            <PostCard post={first} featured />
          </div>
          {rest.length > 0 && (
            <div className="mt-16 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p, i) => (
                <PostCard key={p.id} post={p} index={i + 1} />
              ))}
            </div>
          )}
          {page < pages && (
            <div className="mt-14 flex justify-center">
              <button type="button" onClick={more} className="h-12 px-6 rounded-lg border border-ink text-ink text-[15px] font-semibold hover:bg-ink hover:text-white transition-colors">
                Show more posts
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
