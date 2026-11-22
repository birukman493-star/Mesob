import { useEffect, useState } from "react";
import api from "../api/client";
import PageState from "../components/PageState.jsx";

const empty = {
  name_en: "", name_am: "", name_om: "", meal_types: ["lunch"], is_fasting_ok: true, region: "all",
  cost_birr: 20, portion_unit: "bowl", portion_grams: 200, kcal: 200, protein_g: 8, carbs_g: 30, fat_g: 6,
  fiber_g: 4, sodium_mg: 200, iron_mg: 2, calcium_mg: 40, vit_a_ug: 0, folate_ug: 20,
  glycemic_level: "low", allergens: [], ingredients: [], recipe: "", impact_en: "Sample description.",
  source: "TODO_VERIFY sample — replace with Ethiopian Food Composition Table",
};

export default function FoodsAdmin() {
  const [foods, setFoods] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([api.get("/admin/foods"), api.get("/admin/users")])
      .then(([foodRes, userRes]) => { setFoods(foodRes.data.foods); setUsers(userRes.data.users); })
      .catch((err) => setError(err.userMessage))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function payload() {
    return {
      ...form,
      meal_types: Array.isArray(form.meal_types) ? form.meal_types : String(form.meal_types).split(",").map((item) => item.trim()),
      allergens: Array.isArray(form.allergens) ? form.allergens : String(form.allergens || "").split(",").map((item) => item.trim()).filter(Boolean),
      ingredients: Array.isArray(form.ingredients) ? form.ingredients : String(form.ingredients || "").split("|").map((item) => item.trim()).filter(Boolean),
      is_fasting_ok: Boolean(form.is_fasting_ok),
      glycemic_level: form.glycemic_level || null,
    };
  }
  async function save(event) {
    event.preventDefault();
    const body = payload();
    if (editing) await api.put(`/admin/foods/${editing}`, body);
    else await api.post("/admin/foods", body);
    setForm(empty);
    setEditing(null);
    load();
  }
  async function remove(id) {
    try { await api.delete(`/admin/foods/${id}`); load(); }
    catch (err) { setError(err.userMessage); }
  }
  async function setStatus(id, subscription_status) {
    await api.put(`/admin/users/${id}`, { subscription_status });
    load();
  }
  return (
    <PageState loading={loading} error={error} onRetry={load}>
      <h1>Foods</h1>
      <p className="fine">Rows whose source starts with TODO_VERIFY are refreshed from foods.csv when the server starts. Change the source if you want an edit to stay.</p>
      <form className="panel p-3 mb-3" onSubmit={save}>
        <div className="row g-2">
          <div className="col-md-4"><label className="form-label">English name</label><input className="form-control" required value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
          <div className="col-md-2"><label className="form-label">kcal</label><input className="form-control" type="number" value={form.kcal} onChange={(e) => setForm({ ...form, kcal: Number(e.target.value) })} /></div>
          <div className="col-md-2"><label className="form-label">Protein</label><input className="form-control" type="number" value={form.protein_g} onChange={(e) => setForm({ ...form, protein_g: Number(e.target.value) })} /></div>
          <div className="col-md-2"><label className="form-label">Carbs</label><input className="form-control" type="number" value={form.carbs_g} onChange={(e) => setForm({ ...form, carbs_g: Number(e.target.value) })} /></div>
          <div className="col-md-2"><label className="form-label">Fat</label><input className="form-control" type="number" value={form.fat_g} onChange={(e) => setForm({ ...form, fat_g: Number(e.target.value) })} /></div>
          <div className="col-md-4"><label className="form-label">Meal types</label><input className="form-control" value={Array.isArray(form.meal_types) ? form.meal_types.join(",") : form.meal_types} onChange={(e) => setForm({ ...form, meal_types: e.target.value })} /></div>
          <div className="col-md-2"><label className="form-label">Glycemic</label>
            <select className="form-select" value={form.glycemic_level || ""} onChange={(e) => setForm({ ...form, glycemic_level: e.target.value })}>
              <option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
            </select></div>
          <div className="col-md-6"><label className="form-label">Source</label><input className="form-control" required value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
        </div>
        <button className="btn btn-primary mt-3">{editing ? "Update food" : "Add food"}</button>
      </form>
      <div className="table-responsive">
        <table className="table">
          <thead><tr><th>Name</th><th>kcal</th><th>Carbs</th><th>Source</th><th></th></tr></thead>
          <tbody>
            {foods.map((food) => (
              <tr key={food.id}>
                <td>{food.name_en}</td><td>{food.kcal}</td><td>{food.carbs_g}</td><td>{food.source}</td>
                <td>
                  <button className="btn btn-sm btn-outline-success me-2" onClick={() => { setEditing(food.id); setForm(food); }}>Edit</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => remove(food.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="h4 mt-4">Users and subscription</h2>
      <ul className="list-unstyled">
        {users.map((user) => (
          <li key={user.id} className="d-flex flex-wrap gap-2 align-items-center border-bottom py-2">
            <span>{user.full_name} · {user.role} · {user.category || "no category"}</span>
            <select className="form-select" style={{ maxWidth: 160 }} value={user.subscription_status} onChange={(e) => setStatus(user.id, e.target.value)}>
              <option value="trial">trial</option><option value="active">active</option><option value="free">free</option>
            </select>
          </li>
        ))}
      </ul>
    </PageState>
  );
}
