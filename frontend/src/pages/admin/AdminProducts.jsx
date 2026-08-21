import { useEffect, useMemo, useRef, useState } from "react";
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

const STEP_TYPES = ["cleanser", "serum", "barrier_cream", "spf", "hair"];
const LOW_STOCK_THRESHOLD = 10;

const STOCK_FILTERS = [
  { value: "", label: "All stock" },
  { value: "in", label: "In stock" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
];

const emptyForm = {
  name: "",
  slug: "",
  step_type: STEP_TYPES[0],
  short_description: "",
  key_actives: "",
  price_kes: "",
  stock_quantity: 0,
  is_active: true,
  skin_concern_ids: [],
  images: [],
};

function stockStatus(product) {
  if (product.stock_quantity === 0) return "out";
  if (product.stock_quantity <= LOW_STOCK_THRESHOLD) return "low";
  return "in";
}

function StockBadge({ product }) {
  const status = stockStatus(product);
  const label = status === "out" ? "Out of stock" : status === "low" ? "Low stock" : "In stock";
  const cls =
    status === "out"
      ? "text-clay border-clay/30"
      : status === "low"
      ? "text-amber-dark border-amber/30"
      : "text-sage-dark border-sage/30";
  return <span className={`text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

async function getCroppedBlob(imageSrc, cropPixels) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  canvas.width = cropPixels.width;
  canvas.height = cropPixels.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    cropPixels.width,
    cropPixels.height
  );
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
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

  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceValue, setEditingPriceValue] = useState("");

  const [cropFile, setCropFile] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState(null);
  const fileInputRef = useRef(null);

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const reloadProducts = async () => {
    const [productsRes, concernsRes] = await Promise.all([
      client.get("/admin/products"),
      client.get("/admin/concerns"),
    ]);
    setProducts(productsRes.data);
    setConcerns(concernsRes.data);
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
      price_kes: product.price_cents / 100,
      stock_quantity: product.stock_quantity ?? 0,
      is_active: product.is_active,
      skin_concern_ids: product.skin_concerns?.map((c) => c.id) || [],
      images: product.images || [],
    });
    setError(null);
    setImageError(null);
    setEditingId(product.id);
  };

  const toggleConcern = (concernId) => {
    setForm((f) => ({
      ...f,
      skin_concern_ids: f.skin_concern_ids.includes(concernId)
        ? f.skin_concern_ids.filter((id) => id !== concernId)
        : [...f.skin_concern_ids, concernId],
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
        price_cents: Math.round(Number(form.price_kes) * 100),
        stock_quantity: Number(form.stock_quantity),
        is_active: form.is_active,
        skin_concern_ids: form.skin_concern_ids,
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

  // ---------- Inline price edit ----------
  const startPriceEdit = (product) => {
    setEditingPriceId(product.id);
    setEditingPriceValue(String(product.price_cents / 100));
  };

  const commitPriceEdit = async (product) => {
    const priceCents = Math.round(Number(editingPriceValue) * 100);
    setEditingPriceId(null);
    if (!Number.isFinite(priceCents) || priceCents < 0 || priceCents === product.price_cents) return;
    setRowState((s) => ({ ...s, [product.id]: "saving" }));
    try {
      const { data } = await client.patch(`/admin/products/${product.id}`, { price_cents: priceCents });
      setProducts((prev) => prev.map((p) => (p.id === product.id ? data : p)));
      setRowState((s) => {
        const next = { ...s };
        delete next[product.id];
        return next;
      });
    } catch (err) {
      setRowState((s) => ({
        ...s,
        [product.id]: err.response?.data?.error || "Couldn't update the price.",
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
    if (stockFilter) list = list.filter((p) => stockStatus(p) === stockFilter);

    const sorted = [...list].sort((a, b) => {
      let av, bv;
      if (sortKey === "name") {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      } else if (sortKey === "price") {
        av = a.price_cents;
        bv = b.price_cents;
      } else if (sortKey === "stock") {
        av = a.stock_quantity;
        bv = b.stock_quantity;
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
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl">Products</h2>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-sm bg-amber text-bone-light font-semibold text-sm"
        >
          + Add product
        </button>
      </div>

      {editingId && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 border border-mist rounded-sm p-4 mb-6 bg-bone-light"
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
            <input
              required
              type="number"
              min="0"
              step="1"
              placeholder="Price (KES)"
              value={form.price_kes}
              onChange={(e) => setForm({ ...form, price_kes: e.target.value })}
              className="border border-mist rounded-sm px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              min="0"
              step="1"
              placeholder="Stock quantity"
              value={form.stock_quantity}
              onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
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
        </form>
      )}

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
            <tbody>
              {visibleProducts.map((product) => {
                const state = rowState[product.id];
                const thumbUrl = cloudinaryUrl(product.cloudinary_public_id, { width: 80 });
                return (
                  <tr key={product.id} className="border-b border-mist align-top">
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
                      {editingPriceId === product.id ? (
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          value={editingPriceValue}
                          onChange={(e) => setEditingPriceValue(e.target.value)}
                          onBlur={() => commitPriceEdit(product)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitPriceEdit(product);
                            if (e.key === "Escape") setEditingPriceId(null);
                          }}
                          className="border border-mist rounded-sm px-2 py-1 text-sm w-24"
                        />
                      ) : (
                        <button
                          onClick={() => startPriceEdit(product)}
                          className="text-ink hover:text-amber underline decoration-dotted"
                        >
                          KES {(product.price_cents / 100).toFixed(0)}
                        </button>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <p className="text-ink">{product.stock_quantity}</p>
                      <StockBadge product={product} />
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
