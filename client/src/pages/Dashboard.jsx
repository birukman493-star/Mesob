import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import PageState from "../components/PageState.jsx";

function TodayCard({ totals = {}, targets = {} }) {
  const kcal = Number(totals.kcal || 0);
  const goal = Number(targets.kcal || 0);
  const ratio = goal ? Math.max(0, Math.min(kcal / goal, 1)) : 0;
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  const bars = [
    ["Protein", totals.protein_g, targets.protein_g, "#31572C"],
    ["Carbs", totals.carbs_g, targets.carbs_g, "#90A955"],
    ["Fat", totals.fat_g, targets.fat_g, "#1B3A4B"],
  ];
  return (
    <article className="today-card">
      <div className="d-flex justify-content-between align-items-start">
        <strong>Today</strong>
        <span className="badge text-bg-light">{ratio >= 0.85 && ratio <= 1.15 ? "On track" : "In progress"}</span>
      </div>
      <div className="d-flex gap-3 align-items-center mt-2">
        <svg className="calorie-ring" viewBox="0 0 120 120" role="img" aria-label={`${Math.round(kcal)} of ${Math.round(goal)} kilocalories`}>
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e7eedc" strokeWidth="12" />
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#31572C" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${circ * ratio} ${circ}`} transform="rotate(-90 60 60)" />
          <text x="60" y="56" textAnchor="middle" fontSize="22" fontWeight="700" fill="#172114">{Math.round(kcal).toLocaleString()}</text>
          <text x="60" y="74" textAnchor="middle" fontSize="11" fill="#5d6b57">of {Math.round(goal).toLocaleString()} kcal</text>
        </svg>
        <div className="flex-grow-1">
          {bars.map(([label, value, target, color]) => {
            const width = target ? Math.min(100, (Number(value || 0) / Number(target)) * 100) : 0;
            return (
              <div key={label} className="mb-2">
                <div className="d-flex justify-content-between fine"><span>{label}</span><span>{Math.round(value || 0)} / {Math.round(target || 0)} g</span></div>
                <div className="macro-line"><span style={{ width: `${width}%`, background: color }} /></div>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function today() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const { me, refresh } = useAuth();
  const { t } = useI18n();
  const [logs, setLogs] = useState(null);
  const [plan, setPlan] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const date = today();

  function load() {
    setLoading(true);
    Promise.all([api.get("/logs", { params: { date } }), api.get("/plans/current"), api.get("/reports/weekly")])
      .then(([logRes, planRes, weekRes]) => {
        setLogs(logRes.data);
        setPlan(planRes.data);
        setWeekly(weekRes.data);
        setError("");
      })
      .catch((err) => setError(err.userMessage))
      .finally(() => setLoading(false));
  }
  useEffect(load, [date]);

  async function addWater() {
    await api.post("/water", { ml: 250 });
    load();
  }

  const day = plan?.days?.find((item) => item.date === date);
  return (
    <PageState loading={loading} error={error} onRetry={load}>
      <p className="fine mb-0">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</p>
      <h1 className="h2">Good morning, {me?.user?.full_name?.split(" ")[0]}</h1>
      <p className="sample-note">{t("common.sample")}</p>
      <div className="trial-banner mt-3">
        <span>Free trial · {me?.trial_days_left ?? "—"} days left</span>
        <Link to="/pricing">Upgrade</Link>
      </div>
      {me?.trial_reminder && <p className="fine mt-2">Day {me.trial_day} of your trial.</p>}
      {me?.subscription_status === "trial" && me?.trial_days_left === 0 && <p className="panel p-3 mt-3">The trial has ended. <Link to="/pricing">View subscription options</Link></p>}
      <div className="mt-3"><TodayCard totals={logs?.totals} targets={logs?.targets} /></div>
      <p className="fine mt-2">Water {logs?.water_ml || 0} / {logs?.water_target_ml || 0} ml · planned meals checked off {logs?.meals_completed || 0} of {logs?.meals_planned || 0}.</p>
      <div className="quick-grid my-3">
        <Link to="/scan"><span className="quick-ico"><i className="bi bi-camera" /></span>Scan food</Link>
        <Link className="accent" to="/assistant"><span className="quick-ico"><i className="bi bi-chat-heart" /></span>Ask AI</Link>
        <Link to="/plan"><span className="quick-ico"><i className="bi bi-calendar3" /></span>Meal plan</Link>
        <button className="btn btn-link p-0 text-decoration-none text-reset" onClick={addWater}><span className="quick-ico"><i className="bi bi-cup-straw" /></span>Add water</button>
      </div>
      <div className="d-flex justify-content-between align-items-center">
        <h2 className="h4 mb-0">Today's meals</h2>
        <Link to="/plan">See plan</Link>
      </div>
      {!day && <p className="fine mt-2">No meal plan for today yet. Generate one from the plan page.</p>}
      <div className="meal-scroll mt-2">
        {(day?.meals || []).map((meal) => (
          <article className="meal-tile" key={meal.meal_type}>
            <div className="food-placeholder mb-2" aria-hidden="true">{meal.meal_type.slice(0, 1).toUpperCase()}</div>
            <p className="fine mb-1 text-capitalize">{meal.meal_type}</p>
            <strong>{meal.items.map((item) => item.name_en).join(" + ")}</strong>
            <p className="fine mb-0">{meal.nutrients.kcal} kcal</p>
          </article>
        ))}
      </div>
      <h2 className="h4 mt-4">This week</h2>
      <div className="panel p-2" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={(weekly?.days || []).map((row) => ({ ...row, label: row.date.slice(5) }))}>
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="kcal" fill="#4F772D" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <button className="btn btn-link px-0" onClick={() => refresh()}>Refresh account</button>
    </PageState>
  );
}
