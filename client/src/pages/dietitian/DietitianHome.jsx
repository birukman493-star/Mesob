import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext.jsx";

export default function DietitianHome() {
  const { logout } = useAuth();
  const [requests, setRequests] = useState([]);
  const [record, setRecord] = useState(null);
  const [error, setError] = useState("");
  function load() {
    api.get("/dietitian/requests").then((res) => setRequests(res.data.requests)).catch((err) => setError(err.userMessage));
  }
  useEffect(load, []);
  async function accept(id) {
    await api.put(`/dietitian/requests/${id}`, { status: "accepted" });
    load();
  }
  async function open(userId) {
    setError("");
    try {
      const { data } = await api.get(`/dietitian/users/${userId}`);
      setRecord(data);
    } catch (err) {
      setRecord(null);
      setError(err.userMessage);
    }
  }
  return (
    <main className="section">
      <div className="d-flex justify-content-between">
        <h1>Dietitian desk</h1>
        <button className="btn btn-outline-secondary" onClick={logout}>Log out</button>
      </div>
      <p className="sample-note">Prototype screen. You can open a record only when that person has an active consent.</p>
      {error && <p role="alert" className="text-danger">{error}</p>}
      {requests.length === 0 && <p>No consultation requests yet.</p>}
      <ul className="list-unstyled">
        {requests.map((item) => (
          <li key={item.id} className="panel p-3 mb-2 d-flex flex-wrap justify-content-between gap-2">
            <span>{item.full_name}, age {item.age} · {item.category} · {item.status} · consent {item.consent ? "yes" : "no"}</span>
            <span>
              <button className="btn btn-sm btn-outline-success me-2" onClick={() => accept(item.id)}>Accept</button>
              <button className="btn btn-sm btn-primary" onClick={() => open(item.user_id)}>Open record</button>
            </span>
          </li>
        ))}
      </ul>
      {record && (
        <article className="panel p-3">
          <h2 className="h5">{record.user.full_name}</h2>
          <p>Conditions: {(record.profile?.conditions || []).join(", ") || "none"}</p>
          <p>Allergies: {(record.profile?.allergies || []).join(", ") || "none"}</p>
          <ul>{record.recent_logs.map((log, index) => <li key={index}>{log.name_en} · {log.portions}</li>)}</ul>
        </article>
      )}
    </main>
  );
}
