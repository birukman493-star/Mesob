import { useEffect, useState } from "react";
import api from "../api/client";
import PageState from "../components/PageState.jsx";
import MealCard from "../components/MealCard.jsx";
import WeeklyAnalysisModal from "../components/WeeklyAnalysisModal.jsx";
import { useI18n } from "../context/I18nContext.jsx";

export default function MealPlan() {
  const { t } = useI18n();
  const [plan, setPlan] = useState(null);
  const [day, setDay] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [analysis, setAnalysis] = useState(null);

  function load() {
    setLoading(true);
    api.get("/plans/current").then((res) => { setPlan(res.data); setError(""); })
      .catch((err) => setError(err.userMessage)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function generate(mode) {
    setBusy(true);
    setNote("");
    try {
      const { data } = await api.post("/plans/generate", { mode, seed: 1 });
      setPlan(data);
    } catch (err) {
      setError(err.userMessage);
    } finally {
      setBusy(false);
    }
  }
  async function replaceMeal(meal) {
    setBusy(true);
    try {
      const { data } = await api.put(`/plans/items/${meal.items[0].id}`);
      setPlan(data);
    } catch (err) {
      setNote(err.userMessage);
    } finally {
      setBusy(false);
    }
  }
  async function logMeal(meal) {
    setBusy(true);
    try {
      for (const item of meal.items) {
        await api.post("/logs", { food_id: item.food_id, portions: item.portions, source: "plan" });
      }
      setNote("Meal added to today's log.");
    } catch (err) {
      setNote(err.userMessage);
    } finally {
      setBusy(false);
    }
  }
  async function openAnalysis() {
    const { data } = await api.post("/plans/analysis");
    setAnalysis(data);
  }
  const selected = plan?.days?.[day];
  return (
    <PageState loading={loading} error={error} onRetry={load}>
      <p className="fine mb-0">This week</p>
      <h1 className="h2">Meal plan</h1>
      <p className="sample-note">{t("common.sample")}</p>
      <div className="d-flex flex-wrap gap-2 my-3">
        <button className="btn btn-primary" disabled={busy} onClick={() => generate("standard")}>Standard</button>
        <button className="btn btn-outline-success" disabled={busy} onClick={() => generate("ramadan")}>Ramadan</button>
        {plan?.plan && <button className="btn btn-outline-dark" onClick={openAnalysis}>Weekly analysis</button>}
      </div>
      {plan?.reminder && <p className="panel p-3">{plan.reminder}</p>}
      {note && <p role="status">{note}</p>}
      {!plan?.plan && <p>{t("common.empty")} Generate a week to see plates.</p>}
      {plan?.plan && (
        <>
          <div className="d-flex gap-2 flex-wrap mb-3" role="tablist">
            {plan.days.map((item) => (
              <button key={item.day_index} className={`day-chip ${day === item.day_index ? "active" : ""}`} onClick={() => setDay(item.day_index)}>{item.label.slice(0, 3)}</button>
            ))}
          </div>
          <div className="row g-3">
            {selected.meals.map((meal) => (
              <div className="col-md-6" key={meal.meal_type}>
                <MealCard meal={meal} busy={busy} onReplace={() => replaceMeal(meal)} onLog={() => logMeal(meal)} />
              </div>
            ))}
          </div>
          <p className="fine mt-3">Day total {selected.totals.kcal} kcal · target {plan.daily_targets.kcal} kcal · cost {selected.totals.cost || "—"} birr</p>
        </>
      )}
      {analysis && <WeeklyAnalysisModal data={analysis} onClose={() => setAnalysis(null)} />}
    </PageState>
  );
}
