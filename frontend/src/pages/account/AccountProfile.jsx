import { useState } from "react";
import { motion } from "framer-motion";
import client from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  UserIcon,
  PhoneIcon,
  MapPinIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
} from "../../components/Icons.jsx";

const inputClass =
  "peer w-full border border-mist rounded-sm pl-10 pr-4 py-2.5 text-sm bg-bone text-ink placeholder:text-ink/40 focus:border-amber transition-colors";
const iconClass = "w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 peer-focus:text-amber";

function Card({ eyebrow, title, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="border border-mist rounded-sm bg-bone-light p-5"
    >
      <p className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-1">{eyebrow}</p>
      <h2 className="font-display text-lg text-ink mb-4">{title}</h2>
      {children}
    </motion.section>
  );
}

function SaveButton({ submitting, children = "Save" }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      type="submit"
      disabled={submitting}
      className="px-5 py-2.5 rounded-sm bg-amber text-bone-light font-semibold text-sm disabled:opacity-50"
    >
      {submitting ? "Saving…" : children}
    </motion.button>
  );
}

function ProfileSection() {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: user.full_name, phone: user.phone || "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const openEdit = () => {
    setForm({ fullName: user.full_name, phone: user.phone || "" });
    setError(null);
    setEditing(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await client.patch("/auth/me", {
        full_name: form.fullName,
        phone: form.phone,
      });
      updateUser(data);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't save your profile.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!editing) {
    return (
      <Card eyebrow="Account" title="Profile">
        <p className="text-sm text-ink">{user.full_name}</p>
        <p className="text-sm text-ink/60 mt-1">{user.email}</p>
        <p className="text-sm text-ink/60">{user.phone || "No phone number on file"}</p>
        <button
          onClick={openEdit}
          className="mt-4 px-4 py-2 rounded-sm border border-mist text-ink/70 text-xs font-semibold"
        >
          Edit profile
        </button>
      </Card>
    );
  }

  return (
    <Card eyebrow="Account" title="Edit profile">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="relative block">
          <input
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder="Full name"
            className={inputClass}
          />
          <UserIcon className={iconClass} />
        </label>
        <label className="relative block">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Phone"
            className={inputClass}
          />
          <PhoneIcon className={iconClass} />
        </label>
        {error && <p className="text-sm text-clay">{error}</p>}
        <div className="flex gap-2">
          <SaveButton submitting={submitting} />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-4 py-2.5 rounded-sm border border-mist text-ink/70 text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}

function PasswordSection() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (form.newPassword !== form.confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await client.post("/auth/change-password", {
        current_password: form.currentPassword,
        new_password: form.newPassword,
      });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't change your password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card eyebrow="Security" title="Change password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {[
          { key: "currentPassword", placeholder: "Current password" },
          { key: "newPassword", placeholder: "New password (min. 8 characters)" },
          { key: "confirmPassword", placeholder: "Confirm new password" },
        ].map(({ key, placeholder }) => (
          <label className="relative block" key={key}>
            <input
              type={showPasswords ? "text" : "password"}
              required
              minLength={key === "currentPassword" ? undefined : 8}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              placeholder={placeholder}
              className={`${inputClass} pr-10`}
            />
            <LockIcon className={iconClass} />
          </label>
        ))}
        <button
          type="button"
          onClick={() => setShowPasswords((s) => !s)}
          className="self-start -mt-2 flex items-center gap-1.5 text-xs text-ink/60 hover:text-ink"
        >
          {showPasswords ? <EyeOffIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
          {showPasswords ? "Hide passwords" : "Show passwords"}
        </button>

        {error && <p className="text-sm text-clay">{error}</p>}
        {success && <p className="text-sm text-sage-dark">Password updated.</p>}
        <SaveButton submitting={submitting}>Change password</SaveButton>
      </form>
    </Card>
  );
}

const emptyAddress = {
  name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  country: "Kenya",
  postal_code: "",
  phone: "",
};

// user.default_shipping always has all 7 keys (null when unset) -- strip
// the nulls before merging so emptyAddress's defaults ("" / "Kenya") don't
// get clobbered by a null value on a controlled input.
function withSavedAddress(savedAddress) {
  const nonNull = Object.fromEntries(
    Object.entries(savedAddress || {}).filter(([, v]) => v != null)
  );
  return { ...emptyAddress, ...nonNull };
}

function AddressSection() {
  const { user, updateUser } = useAuth();
  const hasAddress = Boolean(user.default_shipping?.address_line1);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => withSavedAddress(user.default_shipping));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const openEdit = () => {
    setForm(withSavedAddress(user.default_shipping));
    setError(null);
    setEditing(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await client.patch("/auth/me", {
        default_shipping_name: form.name,
        default_shipping_address_line1: form.address_line1,
        default_shipping_address_line2: form.address_line2,
        default_shipping_city: form.city,
        default_shipping_country: form.country,
        default_shipping_postal_code: form.postal_code,
        default_shipping_phone: form.phone,
      });
      updateUser(data);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't save this address.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!editing) {
    return (
      <Card eyebrow="Checkout" title="Default shipping address">
        {hasAddress ? (
          <div className="text-sm text-ink/80 leading-relaxed">
            <p>{user.default_shipping.name}</p>
            <p>{user.default_shipping.address_line1}</p>
            {user.default_shipping.address_line2 && <p>{user.default_shipping.address_line2}</p>}
            <p>
              {user.default_shipping.city}, {user.default_shipping.country}{" "}
              {user.default_shipping.postal_code}
            </p>
            <p>{user.default_shipping.phone}</p>
          </div>
        ) : (
          <p className="text-sm text-ink/60">
            No saved address yet — add one to speed up checkout next time.
          </p>
        )}
        <button
          onClick={openEdit}
          className="mt-4 px-4 py-2 rounded-sm border border-mist text-ink/70 text-xs font-semibold"
        >
          {hasAddress ? "Edit address" : "Add address"}
        </button>
      </Card>
    );
  }

  return (
    <Card eyebrow="Checkout" title="Default shipping address">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="relative block">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Full name"
            className={inputClass}
          />
          <UserIcon className={iconClass} />
        </label>
        <label className="relative block">
          <input
            required
            value={form.address_line1}
            onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
            placeholder="Address"
            className={inputClass}
          />
          <MapPinIcon className={iconClass} />
        </label>
        <label className="relative block">
          <input
            value={form.address_line2}
            onChange={(e) => setForm({ ...form, address_line2: e.target.value })}
            placeholder="Apartment, suite, etc. (optional)"
            className={inputClass}
          />
          <MapPinIcon className={iconClass} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <input
            required
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="City"
            className="border border-mist rounded-sm px-4 py-2.5 text-sm focus:border-amber transition-colors"
          />
          <input
            required
            value={form.postal_code}
            onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
            placeholder="Postal code"
            className="border border-mist rounded-sm px-4 py-2.5 text-sm focus:border-amber transition-colors"
          />
        </div>
        <input
          required
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
          placeholder="Country"
          className="border border-mist rounded-sm px-4 py-2.5 text-sm focus:border-amber transition-colors"
        />
        <label className="relative block">
          <input
            required
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Phone"
            className={inputClass}
          />
          <PhoneIcon className={iconClass} />
        </label>

        {error && <p className="text-sm text-clay">{error}</p>}
        <div className="flex gap-2">
          <SaveButton submitting={submitting} />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-4 py-2.5 rounded-sm border border-mist text-ink/70 text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}

export default function AccountProfile() {
  return (
    <div className="flex flex-col gap-4">
      <ProfileSection />
      <AddressSection />
      <PasswordSection />
    </div>
  );
}
