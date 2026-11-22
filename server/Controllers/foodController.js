import { query } from "../db.js";
import { mapFood, publicFood } from "../services/foods.js";
import { scaleFood } from "../services/nutrients.js";
import { loadProfile, loadUser } from "../services/account.js";
import { suitabilityNote } from "../services/safety.js";
import { loadRules } from "../services/rules.js";
import { httpError } from "../middleware/errors.js";

export async function searchFoods(req, res) {
  const q = String(req.query.q || "").trim();
  const rows = q
    ? await query(
        `SELECT * FROM foods
         WHERE name_en LIKE ? OR name_am LIKE ? OR name_om LIKE ?
         ORDER BY name_en LIMIT 30`,
        [`%${q}%`, `%${q}%`, `%${q}%`]
      )
    : await query("SELECT * FROM foods ORDER BY name_en LIMIT 20");
  res.json({ foods: rows.map((row) => publicFood(mapFood(row))) });
}

export async function foodPopup(req, res) {
  const rows = await query("SELECT * FROM foods WHERE id = ?", [req.params.id]);
  if (!rows[0]) throw httpError(404, "NOT_FOUND", "Food not found.");
  const food = mapFood(rows[0]);
  const portions = Math.min(10, Math.max(0.25, Number(req.query.portions || 1)));
  const user = await loadUser(req.user.id);
  const profile = (await loadProfile(req.user.id)) || { conditions: [], allergies: [], category: user.category };
  profile.category = user.category;
  res.json({
    food: { ...publicFood(food), recipe: food.recipe, impact_en: food.impact_en, ingredients: food.ingredients },
    portions,
    nutrients: scaleFood(food, portions),
    impact: food.impact_en,
    suitability: suitabilityNote(food, portions, profile, loadRules()),
    source: food.source,
  });
}
