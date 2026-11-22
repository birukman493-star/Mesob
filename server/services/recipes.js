import { foodBlocked } from "./safety.js";
import { round1 } from "./nutrients.js";

export function suggestRecipes({ foods, ingredients = [], budget = null, mealType = null, profile, rules, targets }) {
  const owned = ingredients.map((item) => String(item).toLowerCase().trim()).filter(Boolean);
  const rows = [];
  for (const food of foods) {
    if (foodBlocked(food, profile, rules)) continue;
    if (mealType && !(food.meal_types || []).includes(mealType)) continue;
    const parts = (food.ingredients || []).map((item) => String(item));
    const have = [];
    const missing = [];
    for (const part of parts) {
      const low = part.toLowerCase();
      const found = owned.some((item) => low.includes(item) || item.includes(low));
      if (found) have.push(part);
      else missing.push(part);
    }
    const missingCost = parts.length
      ? round1(Number(food.cost_birr) * (missing.length / parts.length))
      : round1(food.cost_birr);
    if (budget != null && budget !== "" && missingCost > Number(budget)) continue;
    const substitutions = missing
      .map((item) => {
        const hit = Object.entries(rules.substitutions || {}).find(([key]) =>
          item.toLowerCase().includes(key)
        );
        return hit ? { ingredient: item, instead: hit[1] } : null;
      })
      .filter(Boolean);
    const slotKcal = targets?.kcal ? targets.kcal * 0.3 : Number(food.kcal);
    rows.push({
      food_id: food.id,
      name_en: food.name_en,
      name_am: food.name_am,
      name_om: food.name_om,
      meal_types: food.meal_types,
      have,
      missing,
      missing_cost: missingCost,
      cost_birr: round1(food.cost_birr),
      kcal: round1(food.kcal),
      protein_g: round1(food.protein_g),
      carbs_g: round1(food.carbs_g),
      fat_g: round1(food.fat_g),
      substitutions,
      fit: Math.abs(Number(food.kcal) - slotKcal),
      source: food.source,
    });
  }
  const matched = owned.length ? rows.filter((row) => row.have.length > 0) : rows;
  const pool = matched.length ? matched : rows;
  pool.sort((a, b) => a.missing_cost - b.missing_cost || a.fit - b.fit);
  return pool.slice(0, 8);
}
