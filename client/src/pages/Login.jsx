import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { homeFor, useAuth } from "../context/AuthContext.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import PinBoxes from "../components/PinBoxes.jsx";
import AuthFrame from "../components/AuthFrame.jsx";

export default function Login() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  // identifier can be email or phone; keep a generic field name
  const [form, setForm] = useState({ email: "", pin: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await login({ email: form.email, pin: form.pin });
      navigate(homeFor(data));
    } catch (err) {
      setError(err.userMessage || err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame>
      <Link to="/" className="btn btn-ghost mb-4" aria-label="Back"><i className="bi bi-arrow-left" /></Link>
      <p className="auth-kicker dark">Sign in</p>
      <h1 className="auth-title">{t("auth.loginTitle")}</h1>
      <p className="fine mb-4">Use your email or phone and PIN to login. No age needed.</p>
      <form onSubmit={submit} className="auth-form">
        <label className="form-label" htmlFor="email">{t("auth.email")}</label>
        <input id="email" className="form-control" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <div className="mt-3">
          <PinBoxes id="pin" label="PIN" value={form.pin} onChange={(pin) => setForm({ ...form, pin })} />
        </div>
        {error && <p className="text-danger mt-3" role="alert">{error}</p>}
        <button className="btn btn-primary w-100 mt-4" disabled={busy || form.pin.length < 4}>{t("auth.enter")}</button>
      </form>
      <p className="text-center mt-4 mb-0">{t("auth.new")} <Link to="/register">Create an account</Link></p>
    </AuthFrame>
  );
}
