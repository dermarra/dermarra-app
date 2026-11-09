import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import AuthPromoPanel from "../components/AuthPromoPanel.jsx";
import { MailIcon, LockIcon, UserIcon, PhoneIcon, EyeIcon, EyeOffIcon } from "../components/Icons.jsx";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Return the shopper to where they were (e.g. the product they tried to
  // add) instead of always dumping them on /account.
  const from = location.state?.from;
  const returnTo =
    from && !["/login", "/signup", "/forgot-password", "/reset-password"].includes(from) ? from : "/account";
  const prefillEmail = useLocation().state?.email || "";
  const [form, setForm] = useState({ fullName: "", email: prefillEmail, password: "", phone: "", newsletter: false });
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
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-mist/20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-3xl bg-bone-light border border-mist rounded-lg shadow-xl overflow-hidden grid lg:grid-cols-2"
      >
        <div className="hidden lg:block">
          <AuthPromoPanel />
        </div>

        <div className="p-8 sm:p-12 flex flex-col justify-center">
          <p className="text-sm font-semibold tracking-[0.18em] text-lime-800 uppercase mb-2">
            Join Dermarra
          </p>
          <h1 className="font-display font-semibold text-3xl sm:text-4xl text-ink mb-8">Create your account</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <label className="relative block">
              <input
                type="text"
                required
                placeholder="Full name"
                value={form.fullName}
                onChange={handleChange("fullName")}
                className="peer field pl-10"
              />
              <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 peer-focus:text-orange-700" />
            </label>

            <label className="relative block">
              <input
                type="email"
                required
                placeholder="Email"
                value={form.email}
                onChange={handleChange("email")}
                className="peer field pl-10"
              />
              <MailIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 peer-focus:text-orange-700" />
            </label>

            <label className="relative block">
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={form.phone}
                onChange={handleChange("phone")}
                className="peer field pl-10"
              />
              <PhoneIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 peer-focus:text-orange-700" />
            </label>

            <label className="relative block">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                placeholder="Password (min. 8 characters)"
                value={form.password}
                onChange={handleChange("password")}
                className="peer field pl-10 pr-10"
              />
              <LockIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 peer-focus:text-orange-700" />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink transition-colors"
              >
                {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </label>

            <label className="flex items-start gap-3 text-ink/80 cursor-pointer">
              <input
                type="checkbox"
                checked={form.newsletter}
                onChange={(e) => setForm({ ...form, newsletter: e.target.checked })}
                className="mt-1 w-5 h-5 accent-orange shrink-0"
              />
              <span>Send me skincare tips and new-routine news by email. Unsubscribe any time.</span>
            </label>

            {error && <p className="text-sm text-orange-700">{error}</p>}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting}
              className="btn btn-primary w-full"
            >
              {submitting ? "Creating account…" : "Create account"}
            </motion.button>
          </form>

          <p className="text-sm text-ink/60 mt-6">
            Already have an account?{" "}
            <Link to="/login" state={location.state} className="text-orange-700 font-medium hover:text-orange-700">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
