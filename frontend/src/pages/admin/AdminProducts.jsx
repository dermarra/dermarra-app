import { useEffect, useState } from "react";
import client from "../../api/client";
import ImageUploadField from "../../components/ImageUploadField.jsx";

const STEP_TYPES = ["cleanser", "serum", "barrier_cream", "spf", "hair"];

const emptyForm = {
  name: "",
  slug: "",
  step_type: STEP_TYPES[0],
  short_description: "",
  key_actives: "",
  price_kes: "",
  stock_quantity: 0,
  cloudinary_public_id: null,
  is_active: true,
  skin_concern_ids: [],
};

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null); // null = closed, "new" = create form
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [rowState, setRowState] = useState({}); // productId -> "deleting" | error message

  const load = () => {
    setLoading(true);
    Promise.all([client.get("/admin/products"), client.get("/admin/concerns")])
      .then(([productsRes, concernsRes]) => {
        setProducts(productsRes.data);
        setConcerns(concernsRes.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

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
      cloudinary_public_id: product.cloudinary_public_id,
      is_active: product.is_active,
      skin_concern_ids: product.skin_concerns?.map((c) => c.id) || [],
    });
    setError(null);
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
        cloudinary_public_id: form.cloudinary_public_id,
        is_active: form.is_active,
        skin_concern_ids: form.skin_concern_ids,
      };
      if (editingId === "new") {
        await client.post("/admin/products", payload);
      } else {
        await client.patch(`/admin/products/${editingId}`, payload);
      }
      setEditingId(null);
      load();
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
            <p className="text-xs font-semibold text-ink/70 mb-2">Image</p>
            <ImageUploadField
              value={form.cloudinary_public_id}
              onChange={(publicId) => setForm({ ...form, cloudinary_public_id: publicId })}
              folder="derma-skincare/products"
            />
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

      {loading ? (
        <p className="text-ink/60 text-sm">Loading products…</p>
      ) : products.length === 0 ? (
        <p className="text-ink/60 text-sm">No products yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {products.map((product) => {
            const state = rowState[product.id];
            return (
              <div
                key={product.id}
                className="flex items-center justify-between border border-mist rounded-sm px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{product.name}</p>
                  <p className="text-xs text-ink/60">
                    {product.step_type} · KES {(product.price_cents / 100).toFixed(0)} ·
                    stock {product.stock_quantity} · {product.is_active ? "active" : "inactive"}
                  </p>
                  {state && state !== "deleting" && (
                    <p className="text-xs text-clay mt-1">{state}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
