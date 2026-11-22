import { useEffect, useState } from "react";
import api from "../api/client";

export default function FoodPopup({ foodId, portions, onPortions, onClose, onConfirm }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api.get(`/foods/${foodId}/popup`, { params: { portions } })
      .then((response) => active && setData(response.data))
      .catch((err) => active && setError(err.userMessage));
    return () => { active = false; };
  }, [foodId, portions]);
  return (
    <dialog className="mesob-dialog" open aria-modal="true" aria-labelledby="food-title">
      <div className="dialog-body">
        <div className="d-flex justify-content-between">
          <h2 id="food-title" className="h4">{data?.food?.name_en || "Food"}</h2>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose} aria-label="Close">Close</button>
        </div>
        <label className="form-label mt-2">Portion</label>
        <div className="btn-group" role="group" aria-label="Portion size">
          {[["S", 0.5], ["M", 1], ["L", 1.5]].map(([label, value]) => (
            <button key={label} className={`btn ${portions === value ? "btn-primary" : "btn-outline-success"}`} onClick={() => onPortions(value)}>{label}</button>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
        {data && (
          <>
            <p className="mt-3 mb-1">{data.nutrients.kcal} kcal · {data.nutrients.protein_g} g protein · {data.nutrients.carbs_g} g carbohydrate · {data.nutrients.fat_g} g fat</p>
            <p className="fine">Sodium {data.nutrients.sodium_mg} mg · Iron {data.nutrients.iron_mg} mg · Fiber {data.nutrients.fiber_g} g</p>
            <p>{data.impact}</p>
            <p>{data.suitability}</p>
            <p className="fine">Source: {data.source}</p>
            <button className="btn btn-primary" onClick={() => onConfirm(data)}>Add to food log</button>
          </>
        )}
      </div>
    </dialog>
  );
}
