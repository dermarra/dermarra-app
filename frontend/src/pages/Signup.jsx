import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import AuthPromoPanel from "../components/AuthPromoPanel.jsx";
import { MailIcon, LockIcon, UserIcon, PhoneIcon, EyeIcon, EyeOffIcon } from "../components/Icons.jsx";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", phone: "" });
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="grid lg:grid-cols-2 min-h-[calc(100vh-4rem)]">
      <div className="hidden lg:block">
        <AuthPromoPanel />
      </div>

      <div className="relative flex items-center justify-center px-4 py-12 overflow-hidden">
        <motion.div
          aria-hidden="true"
          className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-sage/10 blur-2xl"
          animate={{ y: [0, 16, 0], x: [0, -10, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute -bottom-16 -left-10 w-56 h-56 rounded-full bg-amber/10 blur-2xl"
          animate={{ y: [0, -14, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative z-10 w-full max-w-sm bg-bone-light border border-mist rounded-sm p-8 sm:p-10"
        >
        <p className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-2">
          Join Derma
        </p>
        <h1 className="font-display text-2xl sm:text-3xl text-ink mb-8">Create your account</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="relative block">
            <input
              type="text"
              required
              placeholder="Full name"
              value={form.fullName}
              onChange={handleChange("fullName")}
              className="peer w-full border border-mist rounded-sm pl-10 pr-4 py-3 text-sm bg-bone text-ink placeholder:text-ink/40 focus:border-amber transition-colors"
            />
            <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 peer-focus:text-amber" />
          </label>

          <label className="relative block">
            <input
              type="email"
              required
              placeholder="Email"
              value={form.email}
              onChange={handleChange("email")}
              className="peer w-full border border-mist rounded-sm pl-10 pr-4 py-3 text-sm bg-bone text-ink placeholder:text-ink/40 focus:border-amber transition-colors"
            />
            <MailIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 peer-focus:text-amber" />
          </label>

          <label className="relative block">
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={form.phone}
              onChange={handleChange("phone")}
              className="peer w-full border border-mist rounded-sm pl-10 pr-4 py-3 text-sm bg-bone text-ink placeholder:text-ink/40 focus:border-amber transition-colors"
            />
            <PhoneIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 peer-focus:text-amber" />
          </label>

          <label className="relative block">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              placeholder="Password (min. 8 characters)"
              value={form.password}
              onChange={handleChange("password")}
              className="peer w-full border border-mist rounded-sm pl-10 pr-10 py-3 text-sm bg-bone text-ink placeholder:text-ink/40 focus:border-amber transition-colors"
            />
            <LockIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 peer-focus:text-amber" />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink transition-colors"
            >
              {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            </button>
          </label>

          {error && <p className="text-sm text-clay">{error}</p>}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={submitting}
            className="py-3 rounded-sm bg-amber text-bone-light font-semibold text-sm disabled:opacity-50"
          >
            {submitting ? "Creating account…" : "Create account"}
          </motion.button>
        </form>

          <p className="text-sm text-ink/60 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-amber font-medium hover:text-amber-dark">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
