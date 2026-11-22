import { useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";

export default function Pricing() {
  const { me, refresh } = useAuth();
  const [message, setMessage] = useState("");
  async function pay(plan) {
    const { data } = await api.post("/subscription/checkout", { plan });
    setMessage(`${data.message} Reference ${data.reference}.`);
    await refresh();
  }
  return (
    <section>
      <h1>Subscription</h1>
      <p>New accounts receive a 15-day trial. A reminder appears on day 10. Payment is a Chapa prototype and does not charge a card.</p>
      <p className="panel p-3">Status: {me?.user?.subscription_status}. Trial days left: {me?.trial_days_left}.</p>
      <div className="row g-3">
        {[["monthly", "Monthly", "299 birr"], ["yearly", "Yearly", "2,499 birr"]].map(([id, title, price]) => (
          <div className="col-md-6" key={id}>
            <article className="panel p-3 h-100">
              <h2 className="h4">{title}</h2>
              <p>{price}</p>
              <button className="btn btn-primary" onClick={() => pay(id)}>Pay with Chapa</button>
            </article>
          </div>
        ))}
      </div>
      {message && <p role="status" className="mt-3">{message}</p>}
    </section>
  );
}
