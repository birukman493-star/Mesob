import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";
import { useI18n } from "../context/I18nContext.jsx";

const items = [
  ["patient", "Patients", "Diabetes, blood pressure and more", "bi-heart-pulse"],
  ["pregnancy", "Pregnancy", "Trimester-aware nutrition", "bi-person-heart"],
  ["weight_loss", "Weight loss", "Safe, steady deficit", "bi-graph-down-arrow"],
  ["weight_gain", "Weight gain", "Healthy surplus", "bi-graph-up-arrow"],
  ["gym", "Gym & fitness", "High-protein plans", "bi-lightning"],
  ["children", "Children", "Age-band guidance", "bi-backpack"],
];

export default function Category() {
  const { t } = useI18n();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState("patient");
  const [support, setSupport] = useState("ai");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.put("/me/category", { category, support_mode: support });
      await refresh();
      navigate("/profile");
    } catch (err) {
      setError(err.userMessage);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="screen">
      <div className="tibeb" aria-hidden="true" />
      <main className="screen-body">
        <div className="d-flex justify-content-between align-items-center">
          <Link to="/" className="btn btn-ghost" aria-label="Back"><i className="bi bi-arrow-left" /></Link>
          <span className="fine">Step 1 of 2</span>
        </div>
        <h1 className="h2 mt-3">{t("category.title")}</h1>
        <p className="fine">Choose the category that fits you best. You can change it later.</p>
        <form onSubmit={submit}>
          <div className="row g-2">
            {items.map(([id, title, copy, icon]) => (
              <div className="col-md-4" key={id}>
                <label className={`cat-card d-block ${category === id ? "selected" : ""}`}>
                  <input className="visually-hidden" type="radio" name="category" checked={category === id} onChange={() => setCategory(id)} />
                  <span className="cat-ico"><i className={`bi ${icon}`} /></span>
                  <strong className="d-block mt-2">{t(`category.${id}`) || title}</strong>
                  <span className="fine">{copy}</span>
                </label>
              </div>
            ))}
          </div>
          <fieldset className="mt-3">
            <legend className="h6">{t("category.support")}</legend>
            {[["ai", "AI assistant"], ["consultancy", "Dietitian"], ["both", "Both"]].map(([id, label]) => (
              <label key={id} className="me-3"><input type="radio" className="form-check-input me-1" name="support" checked={support === id} onChange={() => setSupport(id)} />{label}</label>
            ))}
          </fieldset>
          {error && <p className="text-danger" role="alert">{error}</p>}
          <button className="btn btn-primary w-100 mt-3" disabled={busy}>{t("category.continue")}</button>
        </form>
      </main>
      <div className="tibeb" aria-hidden="true" />
    </div>
  );
}
