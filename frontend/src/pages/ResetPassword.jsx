import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import client from "../api/client";
import AuthPromoPanel from "../components/AuthPromoPanel.jsx";
import { LockIcon, EyeIcon, EyeOffIcon } from "../components/Icons.jsx";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await client.post("/auth/reset-password", { token, new_password: password });
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
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

      <div className="relative flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative z-10 w-full max-w-sm bg-bone-light border border-mist rounded-sm p-8 sm:p-10"
        >
          <p className="font-mono text-xs tracking-widest text-sage-dark uppercase mb-2">
            Reset password
          </p>
          <h1 className="font-display text-2xl sm:text-3xl text-ink mb-8">Choose a new password</h1>

          {!token ? (
            <p className="text-sm text-clay">
              This reset link is missing its token -- request a new one from the{" "}
              <Link to="/forgot-password" className="text-amber font-medium hover:text-amber-dark">
                forgot password
              </Link>{" "}
              page.
            </p>
          ) : done ? (
            <p className="text-sm text-sage-dark">Password updated -- redirecting you to sign in…</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <label className="relative block">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  placeholder="New password (min. 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

              <label className="relative block">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="peer w-full border border-mist rounded-sm pl-10 pr-4 py-3 text-sm bg-bone text-ink placeholder:text-ink/40 focus:border-amber transition-colors"
                />
                <LockIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 peer-focus:text-amber" />
              </label>

              {error && <p className="text-sm text-clay">{error}</p>}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={submitting}
                className="py-3 rounded-sm bg-amber text-bone-light font-semibold text-sm disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Reset password"}
              </motion.button>
            </form>
          )}

          <p className="text-sm text-ink/60 mt-6">
            <Link to="/login" className="text-amber font-medium hover:text-amber-dark">
              ← Back to sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
