import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { homeFor, useAuth } from "../context/AuthContext.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import LanguageSelect from "../components/LanguageSelect.jsx";
import PinBoxes from "../components/PinBoxes.jsx";
import AuthFrame from "../components/AuthFrame.jsx";

export default function Register() {
  const { register } = useAuth();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", pin: "", confirm: "", email: "", agree: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function set(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event) {
    event.preventDefault();
    if (form.pin !== form.confirm) {
      setError("The two PINs do not match.");
      return;
    }
    if (!form.agree) {
      setError("Please agree before creating an account.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await register({
        full_name: form.full_name,
        email: form.email || undefined,
        pin: form.pin,
        language: lang,
      });
      setLang(lang);
      navigate(homeFor(data));
    } catch (err) {
      setError(err.userMessage);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <Link to="/" className="btn btn-ghost" aria-label="Back"><i className="bi bi-arrow-left" /></Link>
        <LanguageSelect />
      </div>
      <p className="auth-kicker dark">Create account</p>
      <h1 className="auth-title">{t("auth.registerTitle")}</h1>
      <p className="fine mb-4">Your name and a PIN are enough. Age is part of your health profile later.</p>
      <form onSubmit={submit} className="auth-form">
        <label className="form-label" htmlFor="name">{t("auth.name")}</label>
        <input id="name" className="form-control" required autoComplete="name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
        <label className="form-label mt-3" htmlFor="email">{t("auth.email")}</label>
        <input id="email" className="form-control" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        <div className="mt-3">
          <PinBoxes id="pin" label="Create a 4–6 digit PIN" value={form.pin} onChange={(pin) => set("pin", pin)} hint="You will log in with your name and this PIN." />
        </div>
        <div className="mt-3">
          <PinBoxes id="confirm" label="Confirm PIN" value={form.confirm} onChange={(confirm) => set("confirm", confirm)} />
        </div>
        <label className="d-flex gap-2 align-items-start mt-4">
          <input type="checkbox" className="form-check-input mt-1" checked={form.agree} onChange={(e) => set("agree", e.target.checked)} />
          <span>I agree that Mesob AI gives guidance, not a medical diagnosis.</span>
        </label>
        {error && <p className="text-danger mt-3" role="alert">{error}</p>}
        <button className="btn btn-primary w-100 mt-4" disabled={busy}>{t("auth.create")}</button>
      </form>
      <p className="text-center mt-4 mb-0">{t("auth.have")} <Link to="/login">{t("nav.login")}</Link></p>
    </AuthFrame>
  );
}
