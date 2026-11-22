import { useEffect, useState } from "react";
import api from "../api/client";

const blank = { year: 2026, starts_on: "2026-02-18", ends_on: "2026-03-19", suhoor_time: "05:00", iftar_time: "18:30", region: "Addis Ababa" };

export default function RamadanAdmin() {
  const [periods, setPeriods] = useState([]);
  const [message, setMessage] = useState("");
  useEffect(() => { api.get("/admin/ramadan").then((res) => setPeriods(res.data.periods)); }, []);
  function update(index, key, value) {
    setPeriods((current) => current.map((row, i) => i === index ? { ...row, [key]: value } : row));
  }
  async function save(event) {
    event.preventDefault();
    const { data } = await api.put("/admin/ramadan", { periods });
    setPeriods(data.periods);
    setMessage("Ramadan times saved. These are admin entries, not a prayer-time service.");
  }
  return (
    <form onSubmit={save}>
      <h1>Ramadan periods</h1>
      {periods.map((period, index) => (
        <div className="row g-2 mb-2" key={index}>
          {["year", "starts_on", "ends_on", "suhoor_time", "iftar_time", "region"].map((key) => (
            <div className="col-md-2" key={key}>
              <label className="form-label">{key}</label>
              <input className="form-control" value={period[key] || ""} onChange={(e) => update(index, key, e.target.value)} />
            </div>
          ))}
        </div>
      ))}
      <button type="button" className="btn btn-outline-success me-2" onClick={() => setPeriods([...periods, blank])}>Add period</button>
      <button className="btn btn-primary">Save</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
