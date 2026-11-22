import { useEffect, useState } from "react";
import api from "../api/client";

export default function RulesAdmin() {
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { api.get("/admin/rules").then((res) => setText(JSON.stringify(res.data.rules, null, 2))); }, []);
  async function save(event) {
    event.preventDefault();
    try {
      await api.put("/admin/rules", JSON.parse(text));
      setMessage("Rules saved.");
    } catch (err) {
      setMessage(err.userMessage || "The JSON could not be saved.");
    }
  }
  return (
    <form onSubmit={save}>
      <h1>Nutrition rules</h1>
      <p className="fine">These values drive targets, diabetes limits, pregnancy additions, and child age bands. Child band numbers are still TODO_VERIFY.</p>
      <textarea className="form-control" rows={22} value={text} onChange={(e) => setText(e.target.value)} aria-label="Rules JSON" />
      <button className="btn btn-primary mt-3">Save rules</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
