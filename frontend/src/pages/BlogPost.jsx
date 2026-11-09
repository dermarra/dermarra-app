import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import client, { cloudinaryUrl } from "../api/client";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import NewsletterForm from "../components/NewsletterForm.jsx";
import PostCard, { postDate } from "../components/blog/PostCard.jsx";

function setMeta(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content || "");
}

/** /blog/:slug -- one article. body_html is sanitised server-side
 * (app/services/blog_service.py) before it's stored. */
export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setPost(null);
    setMissing(false);
    window.scrollTo({ top: 0 });
    client
      .get(`/blog/posts/${slug}`)
      .then(({ data }) => {
        setPost(data);
        document.title = `${data.title} · Dermarra Blog`;
        setMeta("description", data.seo_description || data.excerpt || "");
      })
      .catch(() => setMissing(true));
  }, [slug]);

  if (missing) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h1 className="text-4xl">Post not found</h1>
        <p className="mt-3 text-ink/70">It may have moved, or isn&apos;t published yet.</p>
        <Link to="/blog" className="inline-block mt-6 px-6 py-3 rounded-lg bg-orange text-ink font-semibold">
          Back to the Blog
        </Link>
      </div>
    );
  }
  if (!post) return <p className="mx-auto max-w-[760px] px-5 py-16 text-ink/70">Loading…</p>;

  const cover = cloudinaryUrl(post.cover_public_id, { width: 1800 });

  return (
    <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="pt-10 sm:pt-14 pb-16">
      <header className="mx-auto max-w-[760px] px-5">
        <Breadcrumbs
          items={[
            { label: "Blog", to: "/blog" },
            ...(post.category ? [{ label: post.category.name, to: `/blog?category=${post.category.slug}` }] : []),
            { label: post.title },
          ]}
        />
        {post.category && <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">{post.category.name}</p>}
        <h1 className="mt-3 text-4xl sm:text-5xl leading-[1.08]">{post.title}</h1>
        {post.excerpt && <p className="mt-5 text-xl text-ink/75 leading-relaxed">{post.excerpt}</p>}
        <p className="mt-5 text-ink/70">
          {postDate(post.published_at)} · {post.reading_minutes} min read
        </p>
      </header>

      {cover && (
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8 mt-10">
          <img src={cover} alt="" className="w-full aspect-[16/9] object-cover rounded-lg" />
        </div>
      )}

      {/* eslint-disable-next-line react/no-danger -- sanitised on the server */}
      <div className="blog-prose mx-auto max-w-[760px] px-5 mt-10" dangerouslySetInnerHTML={{ __html: post.body_html }} />

      <aside className="mx-auto max-w-[760px] px-5 mt-14">
        <div className="p-8 rounded-lg bg-blue-50">
          <h2 className="text-3xl leading-tight">Skincare tips in your inbox</h2>
          <p className="mt-2 text-ink/75">New articles and routine drops, now and then. Unsubscribe any time.</p>
          <div className="mt-5">
            <NewsletterForm variant="light" source="blog-post" />
          </div>
        </div>
      </aside>

      {post.related?.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12 mt-20">
          <h2 className="text-4xl">More from the Blog</h2>
          <div className="mt-8 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {post.related.map((p, i) => (
              <PostCard key={p.id} post={p} index={i} />
            ))}
          </div>
        </section>
      )}
    </motion.article>
  );
}
