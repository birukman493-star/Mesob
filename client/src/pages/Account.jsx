import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";

export default function Account() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const [weight, setWeight] = useState("");
  const [saved, setSaved] = useState("");
  async function submit(event) {
    event.preventDefault();
    await api.post("/weight", { weight_kg: Number(weight) });
    setSaved("Weight saved.");
  }
  return (
    <section>
      <h1 className="h2">Profile</h1>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <Link className="btn btn-outline-success" to="/reports">Reports</Link>
        <Link className="btn btn-outline-success" to="/consult">Consult</Link>
        <Link className="btn btn-outline-success" to="/pricing">Pricing</Link>
      </div>
      <article className="panel p-3" style={{ maxWidth: 560 }}>
        <p><strong>{me?.user?.full_name}</strong></p>
        <p>Age {me?.user?.age} · {me?.user?.category} · {me?.user?.language}</p>
        <p>Subscription: {me?.user?.subscription_status}. Trial days left: {me?.trial_days_left}.</p>
        <p className="fine">Allergies: {(me?.profile?.allergies || []).join(", ") || "none"}. Fasting: {me?.profile?.orthodox_fasting ? "yes" : "no"}. Ramadan: {me?.profile?.ramadan_mode ? "yes" : "no"}.</p>
        <button className="btn btn-outline-danger" onClick={() => { logout(); navigate("/"); }}>Log out</button>
      </article>
      <form className="panel p-3 mt-3" style={{ maxWidth: 420 }} onSubmit={submit}>
        <label className="form-label" htmlFor="kg">Log weight (kg)</label>
        <input id="kg" className="form-control" required type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        <button className="btn btn-primary mt-2">Save weight</button>
        {saved && <p role="status">{saved}</p>}
      </form>
    </section>
  );
}
