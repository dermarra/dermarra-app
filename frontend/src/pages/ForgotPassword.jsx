import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import client from "../api/client";
import AuthPromoPanel from "../components/AuthPromoPanel.jsx";
import { MailIcon } from "../components/Icons.jsx";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await client.post("/auth/forgot-password", { email });
      setSent(true);
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
          <h1 className="font-display text-2xl sm:text-3xl text-ink mb-3">Forgot your password?</h1>
          <p className="text-sm text-ink/60 mb-8">
            Enter your account email and we'll send you a link to reset it.
          </p>

          {sent ? (
            <p className="text-sm text-sage-dark">
              If an account exists for that email, we've sent a password reset link -- it expires
              in 30 minutes.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <label className="relative block">
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="peer w-full border border-mist rounded-sm pl-10 pr-4 py-3 text-sm bg-bone text-ink placeholder:text-ink/40 focus:border-amber transition-colors"
                />
                <MailIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 peer-focus:text-amber" />
              </label>

              {error && <p className="text-sm text-clay">{error}</p>}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={submitting}
                className="py-3 rounded-sm bg-amber text-bone-light font-semibold text-sm disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Send reset link"}
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
