import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import client from "../api/client";
import AuthPromoPanel from "../components/AuthPromoPanel.jsx";
import { ArrowLeftIcon, MailIcon } from "../components/Icons.jsx";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(null); // success message once sent
  const [noAccount, setNoAccount] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setNoAccount(false);
    setSubmitting(true);
    try {
      const { data } = await client.post("/auth/forgot-password", { email });
      setSent(data.message || "We've sent you a password reset link.");
    } catch (err) {
      if (err.response?.data?.code === "no_account") setNoAccount(true);
      else setError(err.response?.data?.error || "Something went wrong.");
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
            Reset password
          </p>
          <h1 className="font-display font-semibold text-3xl sm:text-4xl text-ink mb-3">Forgot your password?</h1>
          <p className="text-sm text-ink/60 mb-8">
            Enter your account email and we&apos;ll send you a link to reset it.
          </p>

          {sent ? (
            <p className="text-sm text-lime-800">{sent}</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <label className="relative block">
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="peer field pl-10"
                />
                <MailIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 peer-focus:text-orange-700" />
              </label>

              {error && <p className="text-sm text-orange-700">{error}</p>}
              {noAccount && (
                <p className="text-sm text-orange-700">
                  There&apos;s no account with that email.{" "}
                  <Link to="/signup" state={{ email }} className="text-orange-700 font-medium underline">
                    Create an account
                  </Link>
                </p>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={submitting}
                className="btn btn-primary w-full"
              >
                {submitting ? "Sending…" : "Send reset link"}
              </motion.button>
            </form>
          )}

          <p className="text-sm text-ink/60 mt-6">
            <Link to="/login" className="inline-flex items-center gap-2 text-orange-700 font-medium hover:text-orange-700">
              <ArrowLeftIcon className="w-3.5 h-3.5" /> Back to sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
