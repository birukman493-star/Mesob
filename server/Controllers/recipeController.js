import { query } from "../db.js";
import { requireComplete } from "../services/account.js";
import { mapFood } from "../services/foods.js";
import { suggestRecipes } from "../services/recipes.js";

export async function suggest(req, res) {
  const { profile, targets, rules } = await requireComplete(req.user.id);
  const foods = (await query("SELECT * FROM foods")).map(mapFood);
  const dishes = suggestRecipes({
    foods,
    ingredients: req.body.ingredients || [],
    budget: req.body.budget ?? profile.budget_per_day,
    mealType: req.body.meal_type || null,
    profile,
    rules,
    targets,
  });
  res.json({ dishes });
}
