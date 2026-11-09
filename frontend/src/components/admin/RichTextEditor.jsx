import { useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import client from "../../api/client";

/** Word-processor style editor for blog posts (TipTap). Produces HTML; the
 * server sanitises it on save (app/services/blog_service.py), so only
 * formatting survives. Photos upload to Cloudinary through the existing
 * /admin/upload-image endpoint and are inserted at the cursor. */

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const imageUrl = (publicId) => `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,w_1400/${publicId}`;

function Tool({ label, active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the text selection
      onClick={onClick}
      className={`h-10 min-w-[2.5rem] px-2.5 rounded-lg text-[15px] font-semibold transition-colors disabled:opacity-30 ${
        active ? "bg-ink text-white" : "text-ink hover:bg-blue-50"
      }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span aria-hidden="true" className="w-px h-6 bg-mist mx-1" />;

export default function RichTextEditor({ value, onChange, placeholder = "Start writing…" }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Image.configure({ HTMLAttributes: { loading: "lazy" } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    onUpdate: ({ editor: ed }) => onChange(ed.isEmpty ? "" : ed.getHTML()),
    editorProps: {
      attributes: {
        class: "blog-prose min-h-[22rem] px-5 py-4 focus:outline-none",
        "aria-label": "Post body",
      },
    },
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
            h2: ed.isActive("heading", { level: 2 }),
            h3: ed.isActive("heading", { level: 3 }),
            bold: ed.isActive("bold"),
            italic: ed.isActive("italic"),
            underline: ed.isActive("underline"),
            bullet: ed.isActive("bulletList"),
            ordered: ed.isActive("orderedList"),
            quote: ed.isActive("blockquote"),
            link: ed.isActive("link"),
            canUndo: ed.can().undo(),
            canRedo: ed.can().redo(),
          }
        : {},
  });

  if (!editor) return null;
  const chain = () => editor.chain().focus();

  const setLink = () => {
    const prev = editor.getAttributes("link").href || "";
    const url = window.prompt("Link to (a full address, e.g. https://dermarra.com/shop):", prev);
    if (url === null) return;
    if (!url.trim()) chain().extendMarkRange("link").unsetLink().run();
    else chain().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const uploadImage = async (file) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      form.append("folder", "derma-skincare/blog");
      const { data } = await client.post("/admin/upload-image", form, { headers: { "Content-Type": "multipart/form-data" } });
      const alt = window.prompt("Describe the photo for people who can't see it (alt text):", "") || "";
      chain().setImage({ src: imageUrl(data.public_id), alt }).run();
    } catch (err) {
      setError(err.response?.data?.error || "Upload failed -- please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="rounded-lg border border-ink/20 bg-white focus-within:border-blue focus-within:ring-2 focus-within:ring-blue/30">
      <div role="toolbar" aria-label="Formatting" className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-mist bg-white rounded-t-lg">
        <Tool label="Heading" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>H2</Tool>
        <Tool label="Subheading" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>H3</Tool>
        <Sep />
        <Tool label="Bold" active={state.bold} onClick={() => chain().toggleBold().run()}>
          <span className="font-bold">B</span>
        </Tool>
        <Tool label="Italic" active={state.italic} onClick={() => chain().toggleItalic().run()}>
          <span className="italic font-serif">I</span>
        </Tool>
        <Tool label="Underline" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
          <span className="underline">U</span>
        </Tool>
        <Sep />
        <Tool label="Bulleted list" active={state.bullet} onClick={() => chain().toggleBulletList().run()}>• List</Tool>
        <Tool label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}>1. List</Tool>
        <Tool label="Quote" active={state.quote} onClick={() => chain().toggleBlockquote().run()}>“ ”</Tool>
        <Sep />
        <Tool label="Link" active={state.link} onClick={setLink}>Link</Tool>
        <Tool label="Insert photo" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "Uploading…" : "Photo"}
        </Tool>
        <Sep />
        <Tool label="Undo" disabled={!state.canUndo} onClick={() => chain().undo().run()}>↶</Tool>
        <Tool label="Redo" disabled={!state.canRedo} onClick={() => chain().redo().run()}>↷</Tool>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => uploadImage(e.target.files[0])} />
      </div>
      <EditorContent editor={editor} />
      {error && <p className="px-5 pb-3 text-sm text-orange-700">{error}</p>}
    </div>
  );
}
