import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import client from "../../api/client";
import { itemReveal } from "../Reveal.jsx";

/** Dashboard: shopper visits (today / week / month / year / all time, active
 * now, last 30 days) and the team's presence. Both refresh every minute.
 * Visits are anonymous -- see backend app/services/analytics_service.py. */

const PERIODS = [
  ["today", "Today"],
  ["week", "This week"],
  ["month", "This month"],
  ["year", "This year"],
  ["all", "All time"],
];
const n = (v) => Number(v || 0).toLocaleString("en-KE");

function useEveryMinute(load) {
  useEffect(() => {
    load();
    const id = setInterval(() => document.visibilityState === "visible" && load(), 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function LiveDot({ on }) {
  return (
    <span className="relative inline-flex w-2.5 h-2.5 shrink-0" aria-hidden="true">
      {on && <span className="absolute inset-0 rounded-full bg-lime animate-ping opacity-75" />}
      <span className={`relative w-2.5 h-2.5 rounded-full ${on ? "bg-lime-600" : "bg-ink/25"}`} />
    </span>
  );
}

function VisitsTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg bg-ink text-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold">{new Date(`${d.date}T00:00:00`).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })}</p>
      <p>
        {n(d.visits)} visits · {n(d.visitors)} visitors
      </p>
    </div>
  );
}

export function VisitorsCard({ className = "" }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEveryMinute(() =>
    client
      .get("/admin/analytics/visits", { params: { days: 30 } })
      .then(({ data: d }) => {
        setData(d);
        setError(null);
      })
      .catch(() => setError("Couldn't load visits."))
  );

  return (
    <motion.section variants={itemReveal} className={`bg-white border border-mist rounded-lg shadow-sm p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-xl font-bold text-ink">Shop visits</h3>
          <p className="text-sm text-ink/70 mt-0.5">Anonymous visits to the shop (not the admin), Kenyan time.</p>
        </div>
        <p className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-lime-100 text-lime-900 text-sm font-semibold" aria-live="polite">
          <LiveDot on={!!data?.active_now} />
          {data ? `${n(data.active_now)} shopping now` : "…"}
        </p>
      </div>

      {error && <p className="text-orange-700">{error}</p>}

      <dl className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {PERIODS.map(([key, label]) => {
          const p = data?.periods?.[key];
          return (
            <div key={key} className={`rounded-lg p-4 ${key === "today" ? "bg-blue text-ink" : "bg-bone-light"}`}>
              <dt className={`text-xs font-semibold uppercase tracking-[0.08em] ${key === "today" ? "text-ink" : "text-ink/70"}`}>{label}</dt>
              <dd className="mt-1 text-3xl font-bold tabular-nums">{p ? n(p.visits) : "…"}</dd>
              <dd className={`text-sm leading-snug ${key === "today" ? "text-ink" : "text-ink/70"}`}>
                {p ? (
                  <>
                    <span className="block whitespace-nowrap">{n(p.visitors)} visitors</span>
                    <span className="block whitespace-nowrap">{n(p.pageviews)} pages</span>
                  </>
                ) : (
                  " "
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="mt-6 h-56">
        {data && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="25%">
              <CartesianGrid vertical={false} stroke="#ECECEB" />
              <XAxis
                dataKey="date"
                tickFormatter={(iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                tick={{ fontSize: 13, fill: "#4A4547" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis allowDecimals={false} width={36} tick={{ fontSize: 13, fill: "#4A4547" }} tickLine={false} axisLine={false} />
              <Tooltip content={<VisitsTooltip />} cursor={{ fill: "rgba(29,156,215,0.08)" }} />
              <Bar dataKey="visits" fill="#1D9CD7" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-2 text-sm text-ink/70">Visits per day, last 30 days. A visit ends after 30 minutes without activity.</p>

      {data && (data.top_sources.length > 0 || Object.keys(data.devices).length > 0) && (
        <div className="mt-5 pt-5 border-t border-mist grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/70">Where visitors came from (this month)</p>
            <ul className="mt-2 flex flex-col gap-1">
              {data.top_sources.length ? (
                data.top_sources.map((s) => (
                  <li key={s.host} className="flex justify-between gap-3">
                    <span className="truncate">{s.host.replace(/^www\./, "")}</span>
                    <span className="font-semibold tabular-nums">{n(s.visits)}</span>
                  </li>
                ))
              ) : (
                <li className="text-ink/70">Mostly direct visits so far.</li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/70">Devices (this month)</p>
            <ul className="mt-2 flex flex-col gap-1">
              {Object.entries(data.devices).map(([device, count]) => (
                <li key={device} className="flex justify-between gap-3">
                  <span className="capitalize">{device}</span>
                  <span className="font-semibold tabular-nums">{n(count)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </motion.section>
  );
}

const ago = (iso) => {
  if (!iso) return "Not seen yet";
  const t = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  const mins = Math.round((Date.now() - t.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return t.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
};

export function TeamCard({ className = "" }) {
  const [team, setTeam] = useState(null);
  useEveryMinute(() =>
    client
      .get("/admin/presence")
      .then(({ data }) => setTeam(data))
      .catch(() => setTeam([]))
  );
  const activeCount = team?.filter((t) => t.active_now).length || 0;

  return (
    <motion.section variants={itemReveal} className={`bg-white border border-mist rounded-lg shadow-sm p-5 ${className}`}>
      <h3 className="text-xl font-bold text-ink">Team</h3>
      <p className="text-sm text-ink/70 mt-0.5">{team ? `${activeCount} active now` : "Loading…"}</p>
      <ul className="mt-4 flex flex-col divide-y divide-mist">
        {(team || []).map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-3">
            <span className="w-9 h-9 shrink-0 rounded-full bg-lime-100 text-lime-900 font-bold flex items-center justify-center">
              {(t.full_name || "?").trim().charAt(0).toUpperCase()}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold truncate">{t.full_name}</span>
              <span className="block text-sm text-ink/70 truncate">{t.role}</span>
            </span>
            <span className="flex items-center gap-2 text-sm whitespace-nowrap">
              <LiveDot on={t.active_now} />
              <span className={t.active_now ? "font-semibold text-lime-900" : "text-ink/70"}>{t.active_now ? "Active now" : ago(t.last_seen_at)}</span>
            </span>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
