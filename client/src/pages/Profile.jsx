import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";
import { useI18n } from "../context/I18nContext.jsx";

const regions = ["Addis Ababa", "Oromia", "Amhara", "Tigray", "Sidama", "Somali", "Afar", "Dire Dawa", "Harari", "Gambela", "Central Ethiopia", "South Ethiopia"];

export default function Profile() {
  const { me, refresh } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const category = me?.user?.category;
  const [form, setForm] = useState({
    age: me?.user?.age || me?.profile?.age || "", sex: "male", height_cm: "", weight_kg: "", goal_weight_kg: "", activity: "moderate",
    diabetes: category === "patient", hypertension: false, trimester: 2,
    allergies: [], budget_per_day: 200, region: "Addis Ababa",
    orthodox_fasting: false, ramadan_mode: false, child_age_months: 24, child_weight: "", child_height: "",
  });
  const [targets, setTargets] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me) return;
    const p = me.profile || {};
    const u = me.user || {};
    setForm((prev) => ({
      ...prev,
      age: p.age || u.age || prev.age,
      sex: p.sex || prev.sex,
      height_cm: p.height_cm ?? prev.height_cm,
      weight_kg: p.weight_kg ?? prev.weight_kg,
      goal_weight_kg: p.goal_weight_kg ?? prev.goal_weight_kg,
      activity: p.activity || prev.activity,
      diabetes: p.conditions ? p.conditions.includes("diabetes") : u.category === "patient",
      hypertension: p.conditions ? p.conditions.includes("hypertension") : prev.hypertension,
      trimester: p.trimester ?? prev.trimester,
      allergies: p.allergies || prev.allergies,
      budget_per_day: p.budget_per_day ?? prev.budget_per_day,
      region: p.region || prev.region,
      orthodox_fasting: p.orthodox_fasting ?? prev.orthodox_fasting,
      ramadan_mode: p.ramadan_mode ?? prev.ramadan_mode,
      child_age_months: p.child_data?.child_age_months ?? prev.child_age_months,
      child_weight: p.child_data?.weight_kg ?? prev.child_weight,
      child_height: p.child_data?.height_cm ?? prev.child_height,
    }));
    if (me.targets) {
      setTargets(me.targets);
    }
  }, [me]);

  function toggleAllergy(name) {
    setForm((current) => ({
      ...current,
      allergies: current.allergies.includes(name)
        ? current.allergies.filter((item) => item !== name)
        : [...current.allergies, name],
    }));
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    const conditions = [form.diabetes && "diabetes", form.hypertension && "hypertension"].filter(Boolean);
    const body = {
      ...(category !== "children" && form.age ? { age: Number(form.age) } : {}),
      sex: category === "children" ? null : form.sex,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      goal_weight_kg: form.goal_weight_kg ? Number(form.goal_weight_kg) : null,
      activity: form.activity,
      conditions,
      trimester: category === "pregnancy" ? Number(form.trimester) : null,
      allergies: form.allergies,
      budget_per_day: form.budget_per_day === "" ? null : Number(form.budget_per_day),
      region: form.region,
      orthodox_fasting: form.orthodox_fasting,
      ramadan_mode: form.ramadan_mode,
      child_data: category === "children" ? {
        child_age_months: Number(form.child_age_months),
        weight_kg: form.child_weight ? Number(form.child_weight) : undefined,
        height_cm: form.child_height ? Number(form.child_height) : undefined,
      } : null,
    };
    try {
      const { data } = await api.put("/me/profile", body);
      setTargets(data.targets);
      setSuccess("Profile saved successfully!");
      await refresh();
    } catch (err) {
      setError(err.userMessage || "Failed to save profile. Please check the fields.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="section">
      <h1>Complete your profile</h1>
      <p className="sample-note">{t("common.sample")}</p>
      <form className="panel p-3 mt-3" onSubmit={submit} style={{ maxWidth: 720 }}>
        {category !== "children" && (
          <div className="row g-3">
            <div className="col-md-3"><label className="form-label" htmlFor="age">Age</label>
              <input id="age" className="form-control" required type="number" min="1" max="120" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
            <div className="col-md-3"><label className="form-label" htmlFor="sex">Sex</label>
              <select id="sex" className="form-select" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}><option value="male">Male</option><option value="female">Female</option></select></div>
            <div className="col-md-3"><label className="form-label" htmlFor="height">Height (cm)</label>
              <input id="height" className="form-control" required type="number" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} /></div>
            <div className="col-md-3"><label className="form-label" htmlFor="weight">Weight (kg)</label>
              <input id="weight" className="form-control" required type="number" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} /></div>
          </div>
        )}
        {category === "children" && (
          <div className="row g-3">
            <div className="col-md-4"><label className="form-label" htmlFor="months">Child age (months)</label>
              <input id="months" className="form-control" required type="number" min="0" value={form.child_age_months} onChange={(e) => setForm({ ...form, child_age_months: e.target.value })} /></div>
            <div className="col-md-4"><label className="form-label" htmlFor="cw">Child weight (kg)</label>
              <input id="cw" className="form-control" type="number" value={form.child_weight} onChange={(e) => setForm({ ...form, child_weight: e.target.value })} /></div>
            <div className="col-md-4"><label className="form-label" htmlFor="ch">Child height (cm)</label>
              <input id="ch" className="form-control" type="number" value={form.child_height} onChange={(e) => setForm({ ...form, child_height: e.target.value })} /></div>
          </div>
        )}
        {category === "pregnancy" && (
          <div className="mt-3"><label className="form-label" htmlFor="tri">Trimester</label>
            <select id="tri" className="form-select" value={form.trimester} onChange={(e) => setForm({ ...form, trimester: e.target.value })}>
              <option value="1">First</option><option value="2">Second</option><option value="3">Third</option>
            </select></div>
        )}
        <div className="row g-3 mt-1">
          <div className="col-md-6"><label className="form-label" htmlFor="activity">Activity</label>
            <select id="activity" className="form-select" value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })}>
              <option value="sedentary">Desk work, little walking</option>
              <option value="light">Light walking most days</option>
              <option value="moderate">On your feet, or exercise 3–5 days</option>
              <option value="active">Hard training most days</option>
              <option value="very_active">Physical work plus training</option>
            </select></div>
          <div className="col-md-6"><label className="form-label" htmlFor="budget">Daily food budget (birr)</label>
            <input id="budget" className="form-control" type="number" value={form.budget_per_day} onChange={(e) => setForm({ ...form, budget_per_day: e.target.value })} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="region">Region</label>
            <select id="region" className="form-select" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>
              {regions.map((region) => <option key={region}>{region}</option>)}
            </select></div>
          <div className="col-md-6"><label className="form-label" htmlFor="goal">Goal weight (kg)</label>
            <input id="goal" className="form-control" type="number" value={form.goal_weight_kg} onChange={(e) => setForm({ ...form, goal_weight_kg: e.target.value })} /></div>
        </div>
        <fieldset className="mt-3"><legend className="h6">Health</legend>
          <label className="me-3"><input type="checkbox" className="form-check-input me-1" checked={form.diabetes} onChange={(e) => setForm({ ...form, diabetes: e.target.checked })} />Diabetes</label>
          <label><input type="checkbox" className="form-check-input me-1" checked={form.hypertension} onChange={(e) => setForm({ ...form, hypertension: e.target.checked })} />Hypertension</label>
        </fieldset>
        <fieldset className="mt-3"><legend className="h6">Allergies</legend>
          {["peanut", "egg", "dairy", "wheat"].map((item) => (
            <label key={item} className="me-3"><input type="checkbox" className="form-check-input me-1" checked={form.allergies.includes(item)} onChange={() => toggleAllergy(item)} />{item}</label>
          ))}
        </fieldset>
        <label className="d-block mt-3"><input type="checkbox" className="form-check-input me-2" checked={form.orthodox_fasting} onChange={(e) => setForm({ ...form, orthodox_fasting: e.target.checked })} />Orthodox fasting</label>
        <label className="d-block"><input type="checkbox" className="form-check-input me-2" checked={form.ramadan_mode} onChange={(e) => setForm({ ...form, ramadan_mode: e.target.checked })} />Ramadan mode</label>
        {["patient", "pregnancy", "children"].includes(category) && <p className="fine mt-3">{t("common.notice")}</p>}
        {error && <p className="text-danger mt-3" role="alert">{error}</p>}
        {success && <p className="alert alert-success mt-3" role="status">{success}</p>}
        <button className="btn btn-primary mt-3" disabled={busy}>{t("common.save")}</button>
      </form>
      {targets && (
        <section className="panel p-3 mt-3" style={{ maxWidth: 720 }}>
          <h2 className="h5">Daily targets</h2>
          <p>{targets.kcal} kcal · protein {targets.protein_g} g · carbohydrate {targets.carbs_g} g · fat {targets.fat_g} g</p>
          <p className="fine mb-2">Method: {targets.method}. {targets.notice}</p>
          <button className="btn btn-lime" onClick={() => navigate("/dashboard")}>Open dashboard</button>
        </section>
      )}
    </main>
  );
}
