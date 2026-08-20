import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", phone: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(form);
      navigate("/account");
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <h1 className="font-display text-2xl mb-6">Create your account</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          required
          placeholder="Full name"
          value={form.fullName}
          onChange={handleChange("fullName")}
          className="border border-mist rounded-sm px-4 py-3 text-sm"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={form.email}
          onChange={handleChange("email")}
          className="border border-mist rounded-sm px-4 py-3 text-sm"
        />
        <input
          type="tel"
          placeholder="Phone (optional)"
          value={form.phone}
          onChange={handleChange("phone")}
          className="border border-mist rounded-sm px-4 py-3 text-sm"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (min. 8 characters)"
          value={form.password}
          onChange={handleChange("password")}
          className="border border-mist rounded-sm px-4 py-3 text-sm"
        />
        {error && <p className="text-sm text-clay">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="py-3 rounded-sm bg-amber text-bone-light font-semibold disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="text-sm text-ink/60 mt-4">
        Already have an account? <Link to="/login" className="text-amber font-medium">Sign in</Link>
      </p>
    </div>
  );
}
