import { Link } from "react-router-dom";

export default function MealCard({ meal, onReplace, onLog, busy }) {
  const names = meal.items.map((item) => `${item.portions} ${item.portion_unit} ${item.name_en}`).join(" + ");
  return (
    <article className="meal-card p-3 h-100">
      <div className="d-flex gap-3">
        <div className="food-placeholder" aria-hidden="true">{meal.meal_type.slice(0, 1).toUpperCase()}</div>
        <div>
          <p className="kicker mb-1">{meal.meal_type}</p>
          <h3 className="h5 mb-1">{names}</h3>
          <p className="fine mb-0">
            {meal.nutrients.kcal} kcal · {meal.nutrients.protein_g} g protein · {meal.nutrients.carbs_g} g carbs · {meal.cost} birr
          </p>
        </div>
      </div>
      <details className="mt-2">
        <summary>View recipe</summary>
        {meal.items.map((item) => (
          <p key={item.id} className="mb-1"><strong>{item.name_en}.</strong> {item.recipe}</p>
        ))}
      </details>
      <div className="d-flex flex-wrap gap-2 mt-3">
        <button className="btn btn-outline-success btn-sm" disabled={busy} onClick={onReplace}>Replace meal</button>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={onLog}>Log meal</button>
        <Link className="btn btn-outline-dark btn-sm" to={`/assistant?q=${encodeURIComponent(`Tell me about ${meal.items[0].name_en}`)}`}>Ask AI</Link>
      </div>
    </article>
  );
}
