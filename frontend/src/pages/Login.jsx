import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import AuthPromoPanel from "../components/AuthPromoPanel.jsx";
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon } from "../components/Icons.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(form);
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
          className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-amber/10 blur-2xl"
          animate={{ y: [0, 16, 0], x: [0, 10, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute -bottom-16 -right-10 w-56 h-56 rounded-full bg-sky/10 blur-2xl"
          animate={{ y: [0, -14, 0] }}
          transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative z-10 w-full max-w-sm bg-bone-light border border-mist rounded-sm p-8 sm:p-10"
        >
        <p className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-2">
          Welcome back
        </p>
        <h1 className="font-display text-2xl sm:text-3xl text-ink mb-8">Sign in</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="relative block">
            <input
              type="email"
              required
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="peer w-full border border-mist rounded-sm pl-10 pr-4 py-3 text-sm bg-bone text-ink placeholder:text-ink/40 focus:border-amber transition-colors"
            />
            <MailIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 peer-focus:text-amber" />
          </label>

          <label className="relative block">
            <input
              type={showPassword ? "text" : "password"}
              required
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
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

          <Link to="/forgot-password" className="text-xs text-ink/60 hover:text-ink -mt-2 self-end">
            Forgot password?
          </Link>

          {error && <p className="text-sm text-clay">{error}</p>}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={submitting}
            className="py-3 rounded-sm bg-amber text-bone-light font-semibold text-sm disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </motion.button>
        </form>

          <p className="text-sm text-ink/60 mt-6">
            No account?{" "}
            <Link to="/signup" className="text-amber font-medium hover:text-amber-dark">
              Sign up
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
