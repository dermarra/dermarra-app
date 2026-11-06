import { useState } from "react";
import client from "../api/client";

/** Newsletter sign-up (Brevo list via POST /api/newsletter/subscribe).
 * variant "dark": the footer (on ink). variant "light": the end-of-post box. */
export default function NewsletterForm({ variant = "dark", source }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState(null);
  const dark = variant === "dark";

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setStatus("sending");
    try {
      await client.post("/newsletter/subscribe", { email, source });
      setStatus("sent");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setError(err.response?.data?.error || "Couldn't sign you up -- please try again.");
    }
  };

  if (status === "sent") {
    return (
      <p role="status" className={`font-semibold ${dark ? "text-lime" : "text-lime-900"}`}>
        You&apos;re on the list -- look out for our next email.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={dark ? "flex flex-col gap-2" : "flex flex-col sm:flex-row gap-3"}>
      <label className="flex-1">
        <span className="sr-only">Email address</span>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`w-full rounded-lg px-4 py-3 text-base bg-white text-ink placeholder:text-ink/60 ${dark ? "" : "border border-ink/20 focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/30"}`}
        />
      </label>
      <button
        type="submit"
        disabled={status === "sending"}
        className="px-6 py-3 rounded-lg bg-orange text-ink font-semibold text-[15px] hover:bg-orange-400 disabled:opacity-50 transition-colors"
      >
        {status === "sending" ? "Signing up…" : "Subscribe"}
      </button>
      {error && <p className={`text-sm ${dark ? "text-orange-300" : "text-orange-700"} sm:basis-full`}>{error}</p>}
    </form>
  );
}
