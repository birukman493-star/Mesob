import { query } from "../db.js";
import { requireComplete } from "../services/account.js";
import { mapFood } from "../services/foods.js";
import { addCost, scaleFood, sumNutrients } from "../services/nutrients.js";
import { buildPlan, chooseMeal } from "../services/planner.js";
import { analyzeWeek } from "../services/analysis.js";
import { addDays, dayNames, weekStart } from "../services/dates.js";
import { isInjera } from "../services/safety.js";
import { fastingNotice } from "../services/ramadan.js";
import { httpError } from "../middleware/errors.js";

async function foods() {
  return (await query("SELECT * FROM foods ORDER BY id")).map(mapFood);
}

function presentItem(row) {
  const food = mapFood(row);
  const portions = Number(row.portions);
  return {
    id: row.item_id,
    food_id: food.id,
    portions,
    name_en: food.name_en,
    name_am: food.name_am,
    name_om: food.name_om,
    portion_unit: food.portion_unit,
    portion_grams: food.portion_grams,
    glycemic_level: food.glycemic_level,
    allergens: food.allergens,
    is_fasting_ok: food.is_fasting_ok,
    recipe: food.recipe,
    impact_en: food.impact_en,
    source: food.source,
    ingredients: food.ingredients,
    nutrients: scaleFood(food, portions),
    cost: addCost(food, portions),
  };
}

async function readPlan(userId) {
  const plans = await query(
    "SELECT * FROM meal_plans WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    [userId]
  );
  if (!plans[0]) return { plan: null, days: [], daily_targets: null, reminder: null };
  const { profile, targets, rules } = await requireComplete(userId);
  const rows = await query(
    `SELECT i.id AS item_id, i.day_index, i.meal_type, i.portions, f.*
     FROM meal_plan_items i JOIN foods f ON f.id = i.food_id
     WHERE i.plan_id = ? ORDER BY i.day_index, i.id`,
    [plans[0].id]
  );
  const order = plans[0].mode === "ramadan"
    ? ["suhoor", "iftar", "snack"]
    : ["breakfast", "lunch", "snack", "dinner"];
  const start = String(plans[0].week_start).slice(0, 10);
  const days = [];
  for (let day = 0; day < 7; day += 1) {
    const dayRows = rows.filter((row) => Number(row.day_index) === day);
    const meals = order
      .filter((mealType) => dayRows.some((row) => row.meal_type === mealType))
      .map((mealType) => {
        const items = dayRows.filter((row) => row.meal_type === mealType).map(presentItem);
        return {
          meal_type: mealType,
          items,
          nutrients: sumNutrients(items.map((item) => item.nutrients)),
          cost: Math.round(items.reduce((sum, item) => sum + item.cost, 0) * 100) / 100,
        };
      });
    days.push({
      day_index: day,
      label: dayNames()[day],
      date: addDays(start, day),
      meals,
      totals: { ...sumNutrients(meals.map((meal) => meal.nutrients)) },
    });
  }
  return {
    plan: { id: plans[0].id, week_start: start, mode: plans[0].mode },
    days,
    daily_targets: targets,
    reminder: fastingNotice(profile, rules, plans[0].mode),
  };
}

export async function generatePlan(req, res) {
  const { profile, targets, rules } = await requireComplete(req.user.id);
  const mode = req.body.mode || (profile.ramadan_mode ? "ramadan" : "standard");
  const menu = await foods();
  const built = buildPlan({
    targets,
    profile,
    rules,
    foods: menu,
    mode,
    seed: req.body.seed || 1,
  });
  await query("DELETE FROM meal_plans WHERE user_id = ?", [req.user.id]);
  const start = weekStart();
  const inserted = await query(
    "INSERT INTO meal_plans (user_id, week_start, mode) VALUES (?, ?, ?)",
    [req.user.id, start, mode]
  );
  for (const day of built.days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        await query(
          "INSERT INTO meal_plan_items (plan_id, day_index, meal_type, food_id, portions) VALUES (?, ?, ?, ?, ?)",
          [inserted.insertId, day.day_index, meal.meal_type, item.food.id, item.portions]
        );
      }
    }
  }
  res.status(201).json(await readPlan(req.user.id));
}

export async function currentPlan(req, res) {
  const data = await readPlan(req.user.id);
  res.json({
    plan: data.plan,
    days: data.days,
    daily_targets: data.daily_targets,
    reminder: data.reminder,
  });
}

export async function replaceItem(req, res) {
  const { profile, targets, rules } = await requireComplete(req.user.id);
  const rows = await query(
    `SELECT i.*, p.mode, p.id AS plan_id FROM meal_plan_items i
     JOIN meal_plans p ON p.id = i.plan_id
     WHERE i.id = ? AND p.user_id = ?`,
    [req.params.id, req.user.id]
  );
  if (!rows[0]) throw httpError(404, "NOT_FOUND", "Meal item not found.");
  const current = rows[0];
  const slot = await query(
    `SELECT i.*, f.name_en, f.cost_birr FROM meal_plan_items i
     JOIN foods f ON f.id = i.food_id
     WHERE i.plan_id = ? AND i.day_index = ? AND i.meal_type = ?`,
    [current.plan_id, current.day_index, current.meal_type]
  );
  const dayItems = await query(
    `SELECT i.portions, f.cost_birr, f.name_en, i.meal_type FROM meal_plan_items i
     JOIN foods f ON f.id = i.food_id
     WHERE i.plan_id = ? AND i.day_index = ?`,
    [current.plan_id, current.day_index]
  );
  const spentElsewhere = dayItems
    .filter((item) => item.meal_type !== current.meal_type)
    .reduce((sum, item) => sum + Number(item.cost_birr) * Number(item.portions), 0);
  const budgetLeft = profile.budget_per_day == null
    ? null
    : Number(profile.budget_per_day) - spentElsewhere;
  const splits = rules.meal_splits[current.mode] || rules.meal_splits.standard;
  const split = splits[current.meal_type] ?? 0.25;
  const menu = await foods();
  const chosen = chooseMeal({
    foods: menu,
    profile,
    rules,
    targets,
    budgetLeft,
    mode: current.mode,
    avoidIds: slot.map((item) => item.food_id).filter((id) => {
      const food = menu.find((item) => item.id === id);
      return food && !isInjera(food);
    }),
    rng: () => ((Date.now() % 1000) / 1000),
    slot: {
      meal_type: current.meal_type,
      kcal: targets.kcal * split,
      protein_g: targets.protein_g * split,
      carbs_g: targets.carbs_g * split,
      fat_g: targets.fat_g * split,
    },
  });
  if (!chosen) throw httpError(409, "NO_SWAP", "No other dish fits this meal's rules.");
  await query(
    "DELETE FROM meal_plan_items WHERE plan_id = ? AND day_index = ? AND meal_type = ?",
    [current.plan_id, current.day_index, current.meal_type]
  );
  for (const item of chosen.items) {
    await query(
      "INSERT INTO meal_plan_items (plan_id, day_index, meal_type, food_id, portions) VALUES (?, ?, ?, ?, ?)",
      [current.plan_id, current.day_index, current.meal_type, item.food.id, item.portions]
    );
  }
  res.json(await readPlan(req.user.id));
}

export async function analyze(req, res) {
  const data = await readPlan(req.user.id);
  if (!data.plan) throw httpError(400, "NO_PLAN", "Generate a meal plan first.");
  const { profile } = await requireComplete(req.user.id);
  const rows = data.days.flatMap((day) => day.meals.map((meal) => meal.nutrients));
  res.json({
    nutrients: analyzeWeek(rows, data.daily_targets, profile),
    note: "Compared with daily targets × 7. Intake-based estimate, not a diagnosis.",
  });
}
