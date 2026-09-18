import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
import { containerReveal, itemReveal } from "../../components/Reveal.jsx";
import { getCroppedBlob } from "../../lib/imageCrop.js";

// The sortable image gallery below (SortableImageTile) deliberately stays
// plain, non-motion elements -- @dnd-kit drives its position via an inline
// style.transform during drag, and Framer Motion's own transform-based
// animations on the same node would fight that mid-drag.

const STEP_TYPES = ["cleanser", "serum", "barrier_cream", "spf"];

const STOCK_FILTERS = [
  { value: "", label: "All stock" },
  { value: "in_stock", label: "In stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

const emptyForm = {
  name: "",
  slug: "",
  step_type: STEP_TYPES[0],
  short_description: "",
  key_actives: "",
  is_active: true,
  skin_concern_ids: [],
  ingredient_ids: [],
  images: [],
};

function StockBadge({ product }) {
  const cls = product.in_stock ? "text-sage-dark border-sage/30" : "text-clay border-clay/30";
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>
      {product.in_stock ? "In stock" : "Out of stock"}
    </span>
  );
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
    setSaving(true);
    setError(null);
    try {
      const { data } = await client.patch(`/admin/products/${productId}/variants/${variant.id}`, {
        label: form.label,
        sku: form.sku,
        price_cents: Math.round(Number(form.price_kes) * 100),
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
    <div className="flex flex-col gap-1 border border-mist rounded-sm p-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          placeholder="Size/label, e.g. 30ml"
          className="border border-mist rounded-sm px-2 py-1 text-sm w-32"
        />
        <input
          value={form.sku}
          onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
          placeholder="SKU"
          className="border border-mist rounded-sm px-2 py-1 text-sm w-36"
        />
        <input
          type="number"
          min="0"
          value={form.price_kes}
          onChange={(e) => setForm((f) => ({ ...f, price_kes: e.target.value }))}
          placeholder="Price (KES)"
          className="border border-mist rounded-sm px-2 py-1 text-sm w-28"
        />
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
          Active
        </label>
        <Link
          to={`/admin/inventory/${variant.id}`}
          className="text-xs text-ink/60 underline decoration-dotted"
        >
          Manage stock →
        </Link>
        <div className="flex-1" />
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="px-3 py-1 rounded-sm bg-amber text-bone-light text-xs font-semibold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={saving}
          className="px-3 py-1 rounded-sm border border-mist text-clay text-xs disabled:opacity-50"
        >
          Delete
        </button>
      </div>
      {error && <p className="text-xs text-clay">{error}</p>}
    </div>
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
      className={`relative border rounded-sm overflow-hidden ${
        image.is_primary ? "border-amber" : "border-mist"
      } ${isDragging ? "opacity-50 z-10" : ""}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
        <img src={url} alt="" className="w-full h-24 object-cover" />
      </div>
      {image.is_primary && (
        <span className="absolute top-1 left-1 text-[10px] font-semibold bg-amber text-bone-light px-1.5 py-0.5 rounded-sm">
          Primary
        </span>
      )}
      <div className="flex">
        {!image.is_primary && (
          <button
            type="button"
            onClick={() => onSetPrimary(image.id)}
            disabled={busy}
            className="flex-1 text-[10px] py-1 border-t border-mist text-ink/70 disabled:opacity-50"
          >
            Set primary
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(image.id)}
          disabled={busy}
          className="flex-1 text-[10px] py-1 border-t border-mist text-clay disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function AdminProducts() {
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
    reloadProducts().finally(() => setLoading(false));
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
    e.preventDefault();
    setAddingVariant(true);
    setNewVariantError(null);
    try {
      const { data } = await client.post(`/admin/products/${editingId}/variants`, {
        label: newVariantForm.label,
        sku: newVariantForm.sku,
        price_cents: Math.round(Number(newVariantForm.price_kes) * 100),
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
        slug: form.slug,
        step_type: form.step_type,
        short_description: form.short_description,
        key_actives: form.key_actives,
        is_active: form.is_active,
        skin_concern_ids: form.skin_concern_ids,
        ingredient_ids: form.ingredient_ids,
      };
      if (editingId === "new") {
        await client.post("/admin/products", payload);
      } else {
        await client.patch(`/admin/products/${editingId}`, payload);
      }
      setEditingId(null);
      reloadProducts();
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (productId) => {
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

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortIndicator = (key) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-ink">Products</h2>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={openCreate}
          className="px-4 py-2 rounded-sm bg-amber text-bone-light font-semibold text-sm"
        >
          + Add product
        </motion.button>
      </div>

      <AnimatePresence>
      {editingId && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 border border-mist rounded-sm p-4 mb-6 bg-bone-light overflow-hidden"
        >
          <h3 className="font-semibold text-sm">
            {editingId === "new" ? "New product" : "Edit product"}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              required
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border border-mist rounded-sm px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="border border-mist rounded-sm px-3 py-2 text-sm"
            />
            <select
              value={form.step_type}
              onChange={(e) => setForm({ ...form, step_type: e.target.value })}
              className="border border-mist rounded-sm px-3 py-2 text-sm"
            >
              {STEP_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              placeholder="Key actives (e.g. 10% Ascorbic Acid)"
              value={form.key_actives}
              onChange={(e) => setForm({ ...form, key_actives: e.target.value })}
              className="border border-mist rounded-sm px-3 py-2 text-sm"
            />
          </div>

          <textarea
            placeholder="Short description"
            value={form.short_description}
            onChange={(e) => setForm({ ...form, short_description: e.target.value })}
            className="border border-mist rounded-sm px-3 py-2 text-sm"
            rows={2}
          />

          <div>
            <p className="text-xs font-semibold text-ink/70 mb-2">Skin concerns</p>
            <div className="flex flex-wrap gap-2">
              {concerns.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => toggleConcern(c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs border ${
                    form.skin_concern_ids.includes(c.id)
                      ? "bg-ink text-bone-light border-ink"
                      : "border-mist text-ink/70"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-ink/70 mb-2">Ingredients</p>
            <div className="flex flex-wrap gap-2">
              {ingredients.map((i) => (
                <button
                  type="button"
                  key={i.id}
                  onClick={() => toggleIngredient(i.id)}
                  className={`px-3 py-1.5 rounded-full text-xs border ${
                    form.ingredient_ids.includes(i.id)
                      ? "bg-ink text-bone-light border-ink"
                      : "border-mist text-ink/70"
                  }`}
                >
                  {i.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-ink/70 mb-2">
              Sizes &amp; prices (each is a separately stocked, separately priced variant)
            </p>
            {editingId === "new" ? (
              <p className="text-xs text-ink/60">Save the product first, then add sizes.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {(currentProduct()?.variants || []).map((v) => (
                  <VariantRow
                    key={v.id}
                    productId={editingId}
                    variant={v}
                    onSaved={handleVariantSaved}
                    onDeleted={handleVariantDeleted}
                  />
                ))}
                <form onSubmit={handleAddVariant} className="flex flex-wrap items-center gap-2">
                  <input
                    required
                    value={newVariantForm.label}
                    onChange={(e) => setNewVariantForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="Size/label, e.g. 30ml"
                    className="border border-mist rounded-sm px-2 py-1 text-sm w-32"
                  />
                  <input
                    required
                    value={newVariantForm.sku}
                    onChange={(e) => setNewVariantForm((f) => ({ ...f, sku: e.target.value }))}
                    placeholder="SKU"
                    className="border border-mist rounded-sm px-2 py-1 text-sm w-36"
                  />
                  <input
                    required
                    type="number"
                    min="0"
                    value={newVariantForm.price_kes}
                    onChange={(e) => setNewVariantForm((f) => ({ ...f, price_kes: e.target.value }))}
                    placeholder="Price (KES)"
                    className="border border-mist rounded-sm px-2 py-1 text-sm w-28"
                  />
                  <button
                    type="submit"
                    disabled={addingVariant}
                    className="px-3 py-1.5 rounded-sm border border-mist text-ink/70 text-xs disabled:opacity-50"
                  >
                    {addingVariant ? "Adding…" : "+ Add size"}
                  </button>
                </form>
                {newVariantError && <p className="text-xs text-clay">{newVariantError}</p>}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-ink/70 mb-2">Images</p>
            {editingId === "new" ? (
              <p className="text-xs text-ink/60">Save the product first, then add images.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {form.images.length > 0 && (
                  <DndContext
                    sensors={dndSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleGalleryDragEnd}
                  >
                    <SortableContext items={form.images.map((i) => i.id)} strategy={rectSortingStrategy}>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {form.images.map((image) => (
                          <SortableImageTile
                            key={image.id}
                            image={image}
                            onSetPrimary={handleSetPrimary}
                            onDelete={handleDeleteImage}
                            busy={imageBusy}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}

                {cropFile ? (
                  <div className="border border-mist rounded-sm p-3">
                    <div className="relative w-full h-56 bg-ink/5">
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
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.1}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full mt-2"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={confirmCrop}
                        disabled={imageBusy}
                        className="px-3 py-1.5 rounded-sm bg-amber text-bone-light text-xs font-semibold disabled:opacity-50"
                      >
                        {imageBusy ? "Uploading…" : "Confirm crop & upload"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelCrop}
                        className="px-3 py-1.5 rounded-sm border border-mist text-ink/70 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSelectFile}
                    className="text-xs text-ink/70"
                  />
                )}
                {imageError && <p className="text-xs text-clay">{imageError}</p>}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Active (visible in shop)
          </label>

          {error && <p className="text-sm text-clay">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-sm bg-amber text-bone-light font-semibold text-sm disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="px-4 py-2 rounded-sm border border-mist text-ink/70 text-sm"
            >
              Cancel
            </button>
          </div>
        </motion.form>
      )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="border border-mist rounded-sm px-3 py-2 text-sm sm:w-64"
        />
        <div className="flex gap-2 overflow-x-auto">
          {[{ value: "", label: "All types" }, ...STEP_TYPES.map((t) => ({ value: t, label: t }))].map(
            (f) => (
              <button
                key={f.value}
                onClick={() => setStepTypeFilter(f.value)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs border ${
                  stepTypeFilter === f.value ? "bg-ink text-bone-light border-ink" : "border-mist text-ink/70"
                }`}
              >
                {f.label}
              </button>
            )
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {STOCK_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStockFilter(f.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs border ${
                stockFilter === f.value ? "bg-ink text-bone-light border-ink" : "border-mist text-ink/70"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2 border border-mist rounded-sm bg-bone-light">
          <span className="text-xs text-ink/70">{selectedIds.size} selected</span>
          <button
            onClick={() => bulkSetActive(true)}
            disabled={bulkBusy}
            className="px-3 py-1.5 rounded-sm border border-mist text-ink/70 text-xs disabled:opacity-50"
          >
            Activate
          </button>
          <button
            onClick={() => bulkSetActive(false)}
            disabled={bulkBusy}
            className="px-3 py-1.5 rounded-sm border border-mist text-ink/70 text-xs disabled:opacity-50"
          >
            Deactivate
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-ink/60 text-sm">Loading products…</p>
      ) : visibleProducts.length === 0 ? (
        <p className="text-ink/60 text-sm">No products match this filter.</p>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-mist text-left text-xs text-ink/60 uppercase tracking-wide">
                <th className="py-2 pr-2 w-8"></th>
                <th className="py-2 pr-2 w-14"></th>
                <th className="py-2 pr-2 cursor-pointer select-none" onClick={() => toggleSort("name")}>
                  Name{sortIndicator("name")}
                </th>
                <th className="py-2 pr-2 cursor-pointer select-none" onClick={() => toggleSort("price")}>
                  Price{sortIndicator("price")}
                </th>
                <th className="py-2 pr-2 cursor-pointer select-none" onClick={() => toggleSort("stock")}>
                  Stock{sortIndicator("stock")}
                </th>
                <th className="py-2 pr-2 cursor-pointer select-none" onClick={() => toggleSort("status")}>
                  Status{sortIndicator("status")}
                </th>
                <th className="py-2 pr-2"></th>
              </tr>
            </thead>
            <motion.tbody key={`${sortKey}-${sortDir}`} initial="hidden" animate="show" variants={containerReveal}>
              {visibleProducts.map((product) => {
                const state = rowState[product.id];
                const thumbUrl = cloudinaryUrl(product.cloudinary_public_id, { width: 80 });
                return (
                  <motion.tr key={product.id} variants={itemReveal} className="border-b border-mist align-top">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleSelected(product.id)}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <div className="w-10 h-10 rounded-sm bg-mist overflow-hidden">
                        {thumbUrl && <img src={thumbUrl} alt="" className="w-full h-full object-cover" />}
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <p className="font-semibold text-ink">{product.name}</p>
                      <p className="text-xs text-ink/60">{product.step_type}</p>
                      {state && state !== "saving" && state !== "deleting" && (
                        <p className="text-xs text-clay mt-1">{state}</p>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      {product.price_from_cents == null ? (
                        <span className="text-ink/40">No sizes yet</span>
                      ) : (
                        <>
                          {product.variants?.length > 1 ? "From " : ""}
                          KES {(product.price_from_cents / 100).toFixed(0)}
                        </>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <button
                        onClick={() => openEdit(product)}
                        className="text-ink hover:text-amber underline decoration-dotted"
                      >
                        {(product.variants || []).reduce((sum, v) => sum + (v.on_hand || 0), 0)}
                      </button>
                      <div><StockBadge product={product} /></div>
                    </td>
                    <td className="py-2 pr-2 text-xs text-ink/60">
                      {product.is_active ? "Active" : "Inactive"}
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(product)}
                          className="px-3 py-1.5 rounded-sm border border-mist text-ink/70 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          disabled={state === "deleting"}
                          className="px-3 py-1.5 rounded-sm border border-mist text-clay text-xs disabled:opacity-50"
                        >
                          {state === "deleting" ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </motion.tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
