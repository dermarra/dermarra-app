import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Cropper from "react-easy-crop";
import client, { cloudinaryUrl } from "../../api/client";
import NameSlugFields from "../../components/NameSlugFields.jsx";
import Field from "../../components/admin/Field.jsx";
import { finalizeSlug } from "../../lib/slug.js";
import { containerReveal } from "../../components/Reveal.jsx";
import {
  Button,
  EditorDrawer,
  EmptyState,
  FilterTabs,
  FormSection,
  ListRow,
  LoadingState,
  PageHeader,
  SearchBox,
  StatusBadge,
  Thumb,
  Toggle,
  Toolbar,
  inputClass,
  selectClass,
} from "../../components/admin/Kit.jsx";
import { getCroppedBlob } from "../../lib/imageCrop.js";

// The sortable image gallery below (SortableImageTile) deliberately stays
// plain, non-motion elements -- @dnd-kit drives its position via an inline
// style.transform during drag, and Framer Motion's own transform-based
// animations on the same node would fight that mid-drag.

const STEP_TYPES = ["cleanser", "serum", "barrier_cream", "spf"];
const STEP_LABELS = {
  cleanser: "Cleanser (prep)",
  serum: "Serum (treat)",
  barrier_cream: "Barrier cream (seal)",
  spf: "SPF (protect)",
};

const STOCK_FILTERS = [
  { value: "", label: "Any stock" },
  { value: "in_stock", label: "In stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

const emptyForm = {
  name: "",
  slug: "",
  step_type: STEP_TYPES[0],
  short_description: "",
  description: "",
  key_actives: "",
  is_active: true,
  skin_concern_ids: [],
  ingredient_ids: [],
  images: [],
};

// M-Pesa only charges whole shillings, and a blank field must never save as
// KES 0 (Number("") === 0) -- returns cents, or null if invalid.
function parsePriceKes(value) {
  const kes = Number(value);
  if (String(value).trim() === "" || !Number.isInteger(kes) || kes < 1) return null;
  return kes * 100;
}

function VariantRow({ productId, variant, onSaved, onDeleted }) {
  const [form, setForm] = useState({
    label: variant.label,
    sku: variant.sku,
    price_kes: variant.price_cents / 100,
    is_active: variant.is_active,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const dirty =
    form.label !== variant.label ||
    form.sku !== variant.sku ||
    Number(form.price_kes) !== variant.price_cents / 100 ||
    form.is_active !== variant.is_active;

  const save = async () => {
    const priceCents = parsePriceKes(form.price_kes);
    if (priceCents === null) {
      setError("Enter a price of at least KES 1, in whole shillings.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data } = await client.patch(`/admin/products/${productId}/variants/${variant.id}`, {
        label: form.label,
        sku: form.sku,
        price_cents: priceCents,
        is_active: form.is_active,
      });
      onSaved(data);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't save this variant.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete the ${variant.label} size? This can't be undone.`)) return;
    setSaving(true);
    setError(null);
    try {
      await client.delete(`/admin/products/${productId}/variants/${variant.id}`);
      onDeleted(variant.id);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't delete this variant.");
      setSaving(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-4 p-5 bg-white border border-mist rounded-lg"
      onKeyDown={(e) => {
        // These inputs sit inside the product <form>: Enter would otherwise
        // submit the whole product (closing the editor, edit lost).
        if (e.key === "Enter" && e.target.tagName === "INPUT") {
          e.preventDefault();
          if (dirty && !saving) save();
        }
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Size">
          <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. 30ml" className={inputClass} />
        </Field>
        <Field label="SKU">
          <input
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))}
            placeholder="e.g. AAS-30ML"
            className={`${inputClass} uppercase`}
          />
        </Field>
        <Field label="Price">
          <KesInput value={form.price_kes} onChange={(v) => setForm((f) => ({ ...f, price_kes: v }))} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Toggle checked={form.is_active} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} label="On sale" />
          <Link to={`/admin/inventory/${variant.id}`} className="text-sm font-semibold text-blue-700 underline underline-offset-2">
            {variant.available ?? 0} available · Manage stock
          </Link>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : dirty ? "Save size" : "Saved"}
          </Button>
          <Button variant="danger" onClick={remove} disabled={saving}>
            Delete
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-orange-700">{error}</p>}
    </div>
  );
}

/** Whole-shilling price input with "KES" shown inside the box. */
function KesInput({ value, onChange, placeholder = "3200" }) {
  return (
    <span className="flex items-center rounded-lg border border-ink/20 bg-white focus-within:border-blue focus-within:ring-2 focus-within:ring-blue/30">
      <span className="pl-4 text-ink/70">KES</span>
      <input
        type="number"
        min="1"
        step="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-base text-ink outline-none"
      />
    </span>
  );
}

function SortableImageTile({ image, onSetPrimary, onDelete, busy }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const url = cloudinaryUrl(image.cloudinary_public_id, { width: 200 });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex flex-col bg-white border rounded-lg overflow-hidden ${
        image.is_primary ? "border-blue ring-2 ring-blue/30" : "border-mist"
      } ${isDragging ? "opacity-60 z-10 shadow-lg" : ""}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none" title="Drag to reorder">
        <img src={url} alt="" className="w-full aspect-square object-cover bg-mist" />
      </div>
      {image.is_primary && (
        <span className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-blue text-ink text-xs font-semibold leading-none">Main photo</span>
      )}
      <div className="flex border-t border-mist">
        {!image.is_primary && (
          <button
            type="button"
            onClick={() => onSetPrimary(image.id)}
            disabled={busy}
            className="flex-1 h-10 text-sm font-semibold text-ink hover:bg-blue-50 disabled:opacity-50"
          >
            Make main
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(image.id)}
          disabled={busy}
          className="flex-1 h-10 text-sm font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50 border-l border-mist first:border-l-0"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function AdminProducts() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null); // null = closed, "new" = create form
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [rowState, setRowState] = useState({}); // productId -> "deleting"|"saving" | error message

  const [search, setSearch] = useState("");
  const [stepTypeFilter, setStepTypeFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const [addingVariant, setAddingVariant] = useState(false);
  const [newVariantForm, setNewVariantForm] = useState({ label: "", sku: "", price_kes: "" });
  const [newVariantError, setNewVariantError] = useState(null);

  const [cropFile, setCropFile] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [savedNotice, setSavedNotice] = useState(null);
  const [imageError, setImageError] = useState(null);
  const fileInputRef = useRef(null);

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const reloadProducts = async () => {
    const [productsRes, concernsRes, ingredientsRes] = await Promise.all([
      client.get("/admin/products"),
      client.get("/admin/concerns"),
      client.get("/admin/ingredients"),
    ]);
    setProducts(productsRes.data);
    setConcerns(concernsRes.data);
    setIngredients(ingredientsRes.data);
    return productsRes.data;
  };

  useEffect(() => {
    setLoading(true);
    reloadProducts()
      .then((loaded) => {
        // /admin/products?edit=<id> (linked from Inventory's "No sizes"
        // rows) opens that product's editor straight away.
        const editId = searchParams.get("edit");
        const target = editId && loaded.find((p) => p.id === editId);
        if (target) openEdit(target);
      })
      .catch(() => setError("Couldn't load products."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setError(null);
    setEditingId("new");
  };

  const openEdit = (product) => {
    setForm({
      name: product.name,
      slug: product.slug,
      step_type: product.step_type,
      short_description: product.short_description || "",
      description: product.description || "",
      key_actives: product.key_actives || "",
      is_active: product.is_active,
      skin_concern_ids: product.skin_concerns?.map((c) => c.id) || [],
      ingredient_ids: product.ingredients?.map((i) => i.id) || [],
      images: product.images || [],
    });
    setError(null);
    setImageError(null);
    setAddingVariant(false);
    setNewVariantForm({ label: "", sku: "", price_kes: "" });
    setNewVariantError(null);
    setEditingId(product.id);
  };

  // Variants are managed immediately against the API (like the image
  // gallery below), not staged into `form` -- keep the `products` list in
  // sync directly so the table's price/stock columns don't go stale.
  const syncProductVariants = (variants) => {
    setProducts((prev) => prev.map((p) => (p.id === editingId ? { ...p, variants } : p)));
    // price_from_cents / in_stock are computed server-side from the
    // variants -- refetch so the table's price and stock columns don't go
    // stale (only patching `variants` locally left them out of date).
    reloadProducts().catch(() => {});
  };

  const currentProduct = () => products.find((p) => p.id === editingId);

  const handleVariantSaved = (variant) => {
    const next = (currentProduct()?.variants || []).map((v) => (v.id === variant.id ? variant : v));
    syncProductVariants(next);
  };

  const handleVariantDeleted = (variantId) => {
    const next = (currentProduct()?.variants || []).filter((v) => v.id !== variantId);
    syncProductVariants(next);
  };

  const handleAddVariant = async (e) => {
    e?.preventDefault?.();
    if (!newVariantForm.label.trim() || !newVariantForm.sku.trim()) {
      setNewVariantError("Enter a size label and a SKU.");
      return;
    }
    const priceCents = parsePriceKes(newVariantForm.price_kes);
    if (priceCents === null) {
      setNewVariantError("Enter a price of at least KES 1, in whole shillings.");
      return;
    }
    setAddingVariant(true);
    setNewVariantError(null);
    try {
      const { data } = await client.post(`/admin/products/${editingId}/variants`, {
        label: newVariantForm.label,
        sku: newVariantForm.sku,
        price_cents: priceCents,
      });
      syncProductVariants([...(currentProduct()?.variants || []), data]);
      setNewVariantForm({ label: "", sku: "", price_kes: "" });
    } catch (err) {
      setNewVariantError(err.response?.data?.error || "Couldn't add this variant.");
    } finally {
      setAddingVariant(false);
    }
  };

  const toggleConcern = (concernId) => {
    setForm((f) => ({
      ...f,
      skin_concern_ids: f.skin_concern_ids.includes(concernId)
        ? f.skin_concern_ids.filter((id) => id !== concernId)
        : [...f.skin_concern_ids, concernId],
    }));
  };

  const toggleIngredient = (ingredientId) => {
    setForm((f) => ({
      ...f,
      ingredient_ids: f.ingredient_ids.includes(ingredientId)
        ? f.ingredient_ids.filter((id) => id !== ingredientId)
        : [...f.ingredient_ids, ingredientId],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        slug: finalizeSlug(form.slug),
        step_type: form.step_type,
        short_description: form.short_description,
        description: form.description,
        key_actives: form.key_actives,
        is_active: form.is_active,
        skin_concern_ids: form.skin_concern_ids,
        ingredient_ids: form.ingredient_ids,
      };
      if (editingId === "new") {
        const { data } = await client.post("/admin/products", payload);
        await reloadProducts();
        // Keep the form open on the new product so sizes can be added next
        // (they can't be added until the product exists).
        openEdit(data);
        setSavedNotice(`Saved "${data.name}". Now add its sizes below.`);
      } else {
        await client.patch(`/admin/products/${editingId}`, payload);
        setEditingId(null);
        await reloadProducts();
        setSavedNotice(`Saved "${payload.name}".`);
      }
      setTimeout(() => setSavedNotice(null), 5000);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm("Delete this product and all its sizes and photos? This can't be undone -- deactivate it instead to just hide it.")) return;
    setRowState((s) => ({ ...s, [productId]: "deleting" }));
    try {
      await client.delete(`/admin/products/${productId}`);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (err) {
      setRowState((s) => ({
        ...s,
        [productId]: err.response?.data?.error || "Couldn't delete this product.",
      }));
    }
  };

  // ---------- Multi-select + bulk actions ----------
  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkSetActive = async (isActive) => {
    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    await Promise.all(
      ids.map(async (id) => {
        setRowState((s) => ({ ...s, [id]: "saving" }));
        try {
          const { data } = await client.patch(`/admin/products/${id}`, { is_active: isActive });
          setProducts((prev) => prev.map((p) => (p.id === id ? data : p)));
          setRowState((s) => {
            const next = { ...s };
            delete next[id];
            return next;
          });
        } catch (err) {
          setRowState((s) => ({
            ...s,
            [id]: err.response?.data?.error || "Couldn't update this product.",
          }));
        }
      })
    );
    setBulkBusy(false);
    setSelectedIds(new Set());
  };

  // ---------- Image gallery ----------
  // The gallery's edits (set-primary/delete/reorder/upload) all hit the API
  // immediately, independent of the outer form's Save button -- so the
  // `products` list (which drives the table thumbnail) needs to be kept in
  // sync directly, or it goes stale if the admin manages images then hits
  // Cancel instead of Save.
  const syncProductImages = (images) => {
    const primary = images.find((img) => img.is_primary);
    setProducts((prev) =>
      prev.map((p) =>
        p.id === editingId
          ? { ...p, images, cloudinary_public_id: primary ? primary.cloudinary_public_id : null }
          : p
      )
    );
  };

  const handleSetPrimary = async (imageId) => {
    setImageBusy(true);
    setImageError(null);
    try {
      await client.patch(`/admin/products/${editingId}/images/${imageId}`, { is_primary: true });
      const images = form.images.map((img) => ({ ...img, is_primary: img.id === imageId }));
      setForm((f) => ({ ...f, images }));
      syncProductImages(images);
    } catch (err) {
      setImageError(err.response?.data?.error || "Couldn't set primary image.");
    } finally {
      setImageBusy(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!window.confirm("Delete this photo?")) return;
    setImageBusy(true);
    setImageError(null);
    try {
      await client.delete(`/admin/products/${editingId}/images/${imageId}`);
      const remaining = form.images.filter((img) => img.id !== imageId);
      const removedWasPrimary = form.images.find((img) => img.id === imageId)?.is_primary;
      if (removedWasPrimary && remaining.length > 0 && !remaining.some((img) => img.is_primary)) {
        remaining[0] = { ...remaining[0], is_primary: true };
      }
      setForm((f) => ({ ...f, images: remaining }));
      syncProductImages(remaining);
    } catch (err) {
      setImageError(err.response?.data?.error || "Couldn't delete this image.");
    } finally {
      setImageBusy(false);
    }
  };

  const handleGalleryDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = form.images.findIndex((img) => img.id === active.id);
    const newIndex = form.images.findIndex((img) => img.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(form.images, oldIndex, newIndex).map((img, i) => ({
      ...img,
      position: i,
    }));
    setForm((f) => ({ ...f, images: reordered }));
    syncProductImages(reordered);
    setImageBusy(true);
    try {
      await Promise.all(
        reordered.map((img) =>
          client.patch(`/admin/products/${editingId}/images/${img.id}`, { position: img.position })
        )
      );
    } catch (err) {
      setImageError(err.response?.data?.error || "Couldn't save the new image order.");
    } finally {
      setImageBusy(false);
    }
  };

  const handleSelectFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCropFile(file);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const cropImageSrc = useMemo(() => (cropFile ? URL.createObjectURL(cropFile) : null), [cropFile]);

  const cancelCrop = () => {
    setCropFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const confirmCrop = async () => {
    if (!croppedAreaPixels || !cropImageSrc) return;
    setImageBusy(true);
    setImageError(null);
    try {
      const blob = await getCroppedBlob(cropImageSrc, croppedAreaPixels);
      const formData = new FormData();
      formData.append("file", blob, "product-image.jpg");
      const { data } = await client.post(`/admin/products/${editingId}/images`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const images = [...form.images, data];
      setForm((f) => ({ ...f, images }));
      syncProductImages(images);
      setCropFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setImageError(err.response?.data?.error || "Upload failed.");
    } finally {
      setImageBusy(false);
    }
  };

  // ---------- Filter + sort ----------
  const visibleProducts = useMemo(() => {
    let list = products;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (stepTypeFilter) list = list.filter((p) => p.step_type === stepTypeFilter);
    if (stockFilter) list = list.filter((p) => (stockFilter === "in_stock" ? p.in_stock : !p.in_stock));

    const sorted = [...list].sort((a, b) => {
      let av, bv;
      if (sortKey === "name") {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      } else if (sortKey === "price") {
        av = a.price_from_cents ?? 0;
        bv = b.price_from_cents ?? 0;
      } else if (sortKey === "stock") {
        av = (a.variants || []).reduce((sum, v) => sum + (v.on_hand || 0), 0);
        bv = (b.variants || []).reduce((sum, v) => sum + (v.on_hand || 0), 0);
      } else {
        av = a.is_active ? 1 : 0;
        bv = b.is_active ? 1 : 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [products, search, stepTypeFilter, stockFilter, sortKey, sortDir]);


  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const STEP_NAMES = { cleanser: "Cleansers", serum: "Serums", barrier_cream: "Barrier creams", spf: "SPF" };
  const onHand = (p) => (p.variants || []).reduce((sum, v) => sum + (v.on_hand || 0), 0);
  const productStatus = (p) =>
    !p.is_active
      ? { label: "Hidden", tone: "neutral" }
      : !(p.variants || []).length
      ? { label: "No sizes", tone: "warn" }
      : p.in_stock
      ? { label: "In stock", tone: "good" }
      : { label: "Out of stock", tone: "bad" };
  const chip = (selected) =>
    `h-10 px-4 rounded-lg border text-[15px] font-semibold transition-colors ${
      selected ? "bg-ink border-ink text-white" : "bg-white border-ink/20 text-ink hover:border-ink"
    }`;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
      <PageHeader
        title="Products"
        description="Everything in the shop. Each product has one or more sizes, each priced and stocked separately."
        actions={
          <Button variant="primary" size="lg" onClick={openCreate}>
            + Add product
          </Button>
        }
      >
        <Toolbar>
          <FilterTabs
            value={stepTypeFilter}
            onChange={setStepTypeFilter}
            label="Routine step"
            options={[
              { value: "", label: "All", count: products.length },
              ...STEP_TYPES.map((t) => ({ value: t, label: STEP_NAMES[t], count: products.filter((p) => p.step_type === t).length })),
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="w-44">
              <span className="sr-only">Stock</span>
              <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className={`${selectClass} h-12`}>
                {STOCK_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="w-48">
              <span className="sr-only">Sort by</span>
              <select
                value={`${sortKey}:${sortDir}`}
                onChange={(e) => {
                  const [k, d] = e.target.value.split(":");
                  setSortKey(k);
                  setSortDir(d);
                }}
                className={`${selectClass} h-12`}
              >
                <option value="name:asc">Name A–Z</option>
                <option value="name:desc">Name Z–A</option>
                <option value="price:asc">Price: low to high</option>
                <option value="price:desc">Price: high to low</option>
                <option value="stock:asc">Stock: lowest first</option>
                <option value="stock:desc">Stock: highest first</option>
                <option value="status:asc">Hidden first</option>
              </select>
            </label>
            <SearchBox value={search} onChange={setSearch} placeholder="Search products" />
          </div>
        </Toolbar>
      </PageHeader>

      {savedNotice && <p className="mb-5 px-4 py-3 rounded-lg bg-lime-100 text-lime-900 font-medium">{savedNotice}</p>}

      <EditorDrawer
        open={!!editingId}
        wide
        title={editingId === "new" ? "New product" : `Edit ${form.name || "product"}`}
        description={editingId === "new" ? "Save it first, then add its sizes and photos." : "Sizes and photos save as you change them; the rest saves with the button below."}
        onClose={() => setEditingId(null)}
        onSubmit={handleSubmit}
        saving={submitting}
        error={error}
        submitLabel={editingId === "new" ? "Save and add sizes" : "Save changes"}
      >
        <FormSection title="Basics">
          <NameSlugFields
            form={form}
            setForm={setForm}
            urlPrefix="/shop/"
            namePlaceholder="e.g. Anti Ageing Serum"
            nameHelp="Without the size -- sizes are added below."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Routine step" help="Decides where it shows under Shop by Step.">
              <select value={form.step_type} onChange={set("step_type")} className={selectClass}>
                {STEP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {STEP_LABELS[t] || t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Key actives" help="With strengths, shown on the product card.">
              <input placeholder="e.g. 0.1% Retinaldehyde, Copper Peptides" value={form.key_actives} onChange={set("key_actives")} className={inputClass} />
            </Field>
          </div>
          <Field label="Short description" help="One sentence under the name, under ~120 characters.">
            <textarea
              placeholder="e.g. Smooths fine lines and firms skin overnight."
              value={form.short_description}
              onChange={set("short_description")}
              className={`${inputClass} min-h-[5rem]`}
              rows={2}
            />
          </Field>
          <Field label="Full description" help="What it does, who it's for, how to use it. Line breaks are kept.">
            <textarea
              placeholder="What it does, who it's for, how and when to apply it…"
              value={form.description}
              onChange={set("description")}
              className={`${inputClass} min-h-[9rem]`}
              rows={6}
            />
          </Field>
        </FormSection>

        <FormSection title="Where it's listed">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-ink">Skin concerns it helps with</p>
            <div className="flex flex-wrap gap-2">
              {concerns.map((c) => (
                <button type="button" key={c.id} onClick={() => toggleConcern(c.id)} aria-pressed={form.skin_concern_ids.includes(c.id)} className={chip(form.skin_concern_ids.includes(c.id))}>
                  {c.name.trim()}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-ink">Key ingredients it contains</p>
            <div className="flex flex-wrap gap-2">
              {ingredients.map((i) => (
                <button type="button" key={i.id} onClick={() => toggleIngredient(i.id)} aria-pressed={form.ingredient_ids.includes(i.id)} className={chip(form.ingredient_ids.includes(i.id))}>
                  {i.name}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            checked={form.is_active}
            onChange={(v) => setForm({ ...form, is_active: v })}
            label="Show in the shop"
            help="Turn off to hide it; orders and stock records are kept."
          />
        </FormSection>

        <FormSection title="Sizes and prices">
          {editingId === "new" ? (
            <p className="text-ink/70">Save the product first, then add its sizes here.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {(currentProduct()?.variants || []).length === 0 && (
                <p className="px-4 py-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-800">
                  No sizes yet, so customers can&apos;t see or buy it. Add one below, then receive stock under Inventory.
                </p>
              )}
              {(currentProduct()?.variants || []).map((v) => (
                <VariantRow key={v.id} productId={editingId} variant={v} onSaved={handleVariantSaved} onDeleted={handleVariantDeleted} />
              ))}
              {/* Not a <form>: this sits inside the product <form>, and a nested
                  form is ignored by browsers -- "+ Add size" used to submit the
                  product form instead (saved + closed the editor, size lost). */}
              <div
                className="flex flex-col gap-4 p-5 border-2 border-dashed border-ink/20 rounded-lg"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.target.tagName === "INPUT") {
                    e.preventDefault();
                    handleAddVariant(e);
                  }
                }}
              >
                <p className="text-sm font-semibold text-ink">Add a size</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Size" help="e.g. 30ml or Travel size">
                    <input value={newVariantForm.label} onChange={(e) => setNewVariantForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. 30ml" className={inputClass} />
                  </Field>
                  <Field label="SKU" help="Unique stock code, never reused">
                    <input
                      value={newVariantForm.sku}
                      onChange={(e) => setNewVariantForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))}
                      placeholder="e.g. AAS-30ML"
                      className={`${inputClass} uppercase`}
                    />
                  </Field>
                  <Field label="Price" help="Whole shillings">
                    <KesInput value={newVariantForm.price_kes} onChange={(v) => setNewVariantForm((f) => ({ ...f, price_kes: v }))} />
                  </Field>
                </div>
                <div className="flex items-center gap-4">
                  <Button variant="secondary" onClick={handleAddVariant} disabled={addingVariant}>
                    {addingVariant ? "Adding…" : "+ Add size"}
                  </Button>
                  {newVariantError && <p className="text-sm text-orange-700">{newVariantError}</p>}
                </div>
              </div>
            </div>
          )}
        </FormSection>

        <FormSection title="Photos">
          {editingId === "new" ? (
            <p className="text-ink/70">Save the product first, then add photos here.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="-mt-2 text-sm text-ink/70">Square photos, shared by every size. The main photo is used on shop cards; drag to reorder.</p>
              {cropFile ? (
                <div className="flex flex-col gap-3 max-w-md">
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-ink/5">
                    <Cropper
                      image={cropImageSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                    />
                  </div>
                  <label className="flex items-center gap-3 text-sm text-ink/70">
                    Zoom
                    <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-blue" />
                  </label>
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={confirmCrop} disabled={imageBusy}>
                      {imageBusy ? "Uploading…" : "Use this crop"}
                    </Button>
                    <Button onClick={cancelCrop}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleGalleryDragEnd}>
                  <SortableContext items={form.images.map((i) => i.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {form.images.map((image) => (
                        <SortableImageTile key={image.id} image={image} onSetPrimary={handleSetPrimary} onDelete={handleDeleteImage} busy={imageBusy} />
                      ))}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={imageBusy}
                        className="flex flex-col items-center justify-center gap-2 aspect-square rounded-lg border-2 border-dashed border-ink/25 bg-bone-light text-center hover:border-blue hover:bg-blue-50 transition-colors"
                      >
                        <span className="text-3xl leading-none text-ink/70">+</span>
                        <span className="text-sm font-semibold">Add photo</span>
                      </button>
                    </div>
                  </SortableContext>
                </DndContext>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleSelectFile} className="sr-only" tabIndex={-1} />
              {imageError && <p className="text-sm text-orange-700">{imageError}</p>}
            </div>
          )}
        </FormSection>
      </EditorDrawer>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 px-5 py-3 bg-ink text-white rounded-lg">
          <span className="font-semibold">{selectedIds.size} selected</span>
          <span className="flex-1" />
          <Button variant="quiet" onClick={() => bulkSetActive(true)} disabled={bulkBusy}>
            Show in shop
          </Button>
          <Button variant="quiet" onClick={() => bulkSetActive(false)} disabled={bulkBusy}>
            Hide from shop
          </Button>
        </div>
      )}

      {loading ? (
        <LoadingState>Loading products…</LoadingState>
      ) : visibleProducts.length === 0 ? (
        <EmptyState>{products.length ? "No products match." : "No products yet -- add the first one."}</EmptyState>
      ) : (
        <motion.div key={`${sortKey}-${sortDir}`} initial="hidden" animate="show" variants={containerReveal} className="flex flex-col gap-3">
          {visibleProducts.map((product, index) => {
            const state = rowState[product.id];
            const status = productStatus(product);
            const sizes = (product.variants || []).length;
            return (
              <ListRow
                key={product.id}
                thumb={
                  <span className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(product.id)}
                      onChange={() => toggleSelected(product.id)}
                      aria-label={`Select ${product.name}`}
                      className="w-5 h-5 rounded accent-blue"
                    />
                    <Thumb imageId={product.cloudinary_public_id} name={product.name} index={index} />
                  </span>
                }
                title={product.name}
                subtitle={STEP_LABELS[product.step_type] || product.step_type}
                note={state && state !== "saving" && state !== "deleting" ? state : null}
                stats={[
                  {
                    label: sizes > 1 ? "Price from" : "Price",
                    value: product.price_from_cents == null ? "—" : `KES ${Math.round(product.price_from_cents / 100).toLocaleString("en-KE")}`,
                  },
                  { label: "Sizes", value: sizes, tone: sizes === 0 ? "warn" : undefined },
                  { label: "On hand", value: onHand(product).toLocaleString("en-KE") },
                ]}
                badge={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
                actions={
                  <>
                    <Button onClick={() => openEdit(product)}>Edit</Button>
                    <Button variant="danger" onClick={() => handleDelete(product.id)} disabled={state === "deleting"}>
                      {state === "deleting" ? "Deleting…" : "Delete"}
                    </Button>
                  </>
                }
              />
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
