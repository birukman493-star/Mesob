import { query } from "../db.js";
import { requireComplete } from "../services/account.js";
import { mapFood } from "../services/foods.js";
import { scaleFood, sumNutrients } from "../services/nutrients.js";
import { addDays, isoDate, isoDateTime } from "../services/dates.js";
import { httpError } from "../middleware/errors.js";

async function dayPayload(userId, date) {
  const { targets } = await requireComplete(userId);
  const rows = await query(
    `SELECT l.id, l.portions, l.logged_at, l.source, f.*
     FROM food_logs l JOIN foods f ON f.id = l.food_id
     WHERE l.user_id = ? AND l.logged_at >= ? AND l.logged_at <= ?
     ORDER BY l.logged_at`,
    [userId, `${date} 00:00:00`, `${date} 23:59:59`]
  );
  const entries = rows.map((row) => {
    const food = mapFood(row);
    const portions = Number(row.portions);
    return {
      id: row.id,
      food_id: food.id,
      name_en: food.name_en,
      name_am: food.name_am,
      portions,
      source: row.source,
      logged_at: row.logged_at,
      nutrients: scaleFood(food, portions),
      source_label: food.source,
    };
  });
  const water = await query(
    "SELECT COALESCE(SUM(ml), 0) AS ml FROM water_entries WHERE user_id = ? AND logged_at >= ? AND logged_at <= ?",
    [userId, `${date} 00:00:00`, `${date} 23:59:59`]
  );
  const plans = await query(
    "SELECT id, week_start, mode FROM meal_plans WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    [userId]
  );
  let mealsPlanned = 0;
  let mealsCompleted = 0;
  if (plans[0]) {
    const start = String(plans[0].week_start).slice(0, 10);
    const end = addDays(start, 6);
    if (date >= start && date <= end) {
      const dayIndex = Math.round((new Date(`${date}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86400000);
      const items = await query(
        "SELECT food_id, meal_type FROM meal_plan_items WHERE plan_id = ? AND day_index = ?",
        [plans[0].id, dayIndex]
      );
      const mealTypes = [...new Set(items.map((item) => item.meal_type))];
      mealsPlanned = mealTypes.length;
      const loggedIds = new Set(entries.map((entry) => entry.food_id));
      mealsCompleted = mealTypes.filter((mealType) =>
        items.some((item) => item.meal_type === mealType && loggedIds.has(item.food_id))
      ).length;
    }
  }
  return {
    date,
    entries,
    totals: sumNutrients(entries.map((entry) => entry.nutrients)),
    targets,
    water_ml: Number(water[0].ml),
    water_target_ml: targets.water_ml,
    meals_completed: mealsCompleted,
    meals_planned: mealsPlanned,
  };
}

export async function addLog(req, res) {
  await requireComplete(req.user.id);
  const foods = await query("SELECT id FROM foods WHERE id = ?", [req.body.food_id]);
  if (!foods[0]) throw httpError(404, "NOT_FOUND", "Food not found.");
  await query(
    "INSERT INTO food_logs (user_id, food_id, portions, logged_at, source) VALUES (?, ?, ?, ?, ?)",
    [req.user.id, req.body.food_id, req.body.portions, isoDateTime(), req.body.source || "manual"]
  );
  res.status(201).json(await dayPayload(req.user.id, isoDate()));
}

export async function getLogs(req, res) {
  const date = String(req.query.date || isoDate());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw httpError(400, "VALIDATION", "Use a YYYY-MM-DD date.");
  }
  res.json(await dayPayload(req.user.id, date));
}

export async function addWater(req, res) {
  await query("INSERT INTO water_entries (user_id, ml, logged_at) VALUES (?, ?, ?)", [
    req.user.id,
    req.body.ml,
    isoDateTime(),
  ]);
  res.status(201).json(await dayPayload(req.user.id, isoDate()));
}

export async function addWeight(req, res) {
  await query("INSERT INTO weight_entries (user_id, weight_kg, logged_at) VALUES (?, ?, ?)", [
    req.user.id,
    req.body.weight_kg,
    isoDate(),
  ]);
  const rows = await query(
    "SELECT weight_kg, logged_at FROM weight_entries WHERE user_id = ? ORDER BY logged_at DESC LIMIT 12",
    [req.user.id]
  );
  res.status(201).json({
    weights: rows.map((row) => ({
      weight_kg: Number(row.weight_kg),
      logged_at: String(row.logged_at).slice(0, 10),
    })),
  });
}

export async function addGrowth(req, res) {
  await query(
    "INSERT INTO growth_records (user_id, age_months, weight_kg, height_cm, logged_at) VALUES (?, ?, ?, ?, ?)",
    [req.user.id, req.body.age_months, req.body.weight_kg, req.body.height_cm, isoDate()]
  );
  const rows = await query(
    "SELECT age_months, weight_kg, height_cm, logged_at FROM growth_records WHERE user_id = ? ORDER BY logged_at DESC",
    [req.user.id]
  );
  res.status(201).json({
    records: rows.map((row) => ({
      age_months: row.age_months,
      weight_kg: Number(row.weight_kg),
      height_cm: Number(row.height_cm),
      logged_at: String(row.logged_at).slice(0, 10),
    })),
  });
}
