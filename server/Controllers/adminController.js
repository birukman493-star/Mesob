import { query } from "../db.js";
import { mapFood } from "../services/foods.js";
import { loadRules, saveRules } from "../services/rules.js";
import { httpError } from "../middleware/errors.js";

function foodParams(body) {
  return [
    body.name_en,
    body.name_am || null,
    body.name_om || null,
    body.meal_types.join(","),
    body.is_fasting_ok ? 1 : 0,
    body.region || "all",
    body.cost_birr,
    body.portion_unit,
    body.portion_grams,
    body.kcal,
    body.protein_g,
    body.carbs_g,
    body.fat_g,
    body.fiber_g,
    body.sodium_mg,
    body.iron_mg,
    body.calcium_mg,
    body.vit_a_ug,
    body.folate_ug,
    body.glycemic_level || null,
    JSON.stringify(body.allergens || []),
    JSON.stringify(body.ingredients || []),
    body.recipe || null,
    body.impact_en || null,
    body.source,
  ];
}

export async function listFoods(req, res) {
  const rows = await query("SELECT * FROM foods ORDER BY name_en");
  res.json({ foods: rows.map(mapFood) });
}

export async function createFood(req, res) {
  const result = await query(
    `INSERT INTO foods
      (name_en, name_am, name_om, meal_types, is_fasting_ok, region, cost_birr, portion_unit, portion_grams,
       kcal, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, iron_mg, calcium_mg, vit_a_ug, folate_ug,
       glycemic_level, allergens, ingredients, recipe, impact_en, source)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    foodParams(req.body)
  );
  const rows = await query("SELECT * FROM foods WHERE id = ?", [result.insertId]);
  res.status(201).json({ food: mapFood(rows[0]) });
}

export async function updateFood(req, res) {
  const existing = await query("SELECT id FROM foods WHERE id = ?", [req.params.id]);
  if (!existing[0]) throw httpError(404, "NOT_FOUND", "Food not found.");
  await query(
    `UPDATE foods SET name_en=?, name_am=?, name_om=?, meal_types=?, is_fasting_ok=?, region=?, cost_birr=?,
      portion_unit=?, portion_grams=?, kcal=?, protein_g=?, carbs_g=?, fat_g=?, fiber_g=?, sodium_mg=?,
      iron_mg=?, calcium_mg=?, vit_a_ug=?, folate_ug=?, glycemic_level=?, allergens=?, ingredients=?,
      recipe=?, impact_en=?, source=? WHERE id=?`,
    [...foodParams(req.body), req.params.id]
  );
  const rows = await query("SELECT * FROM foods WHERE id = ?", [req.params.id]);
  res.json({ food: mapFood(rows[0]) });
}

export async function deleteFood(req, res) {
  try {
    const result = await query("DELETE FROM foods WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) throw httpError(404, "NOT_FOUND", "Food not found.");
    res.json({ deleted: true });
  } catch (error) {
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      throw httpError(409, "IN_USE", "This food is used in a meal plan or food log.");
    }
    throw error;
  }
}

export function getRules(req, res) {
  res.json({ rules: loadRules() });
}

export function putRules(req, res) {
  saveRules(req.body);
  res.json({ rules: loadRules() });
}

export async function getRamadan(req, res) {
  const rows = await query("SELECT * FROM ramadan_periods ORDER BY year DESC");
  res.json({
    periods: rows.map((row) => ({
      ...row,
      starts_on: String(row.starts_on).slice(0, 10),
      ends_on: String(row.ends_on).slice(0, 10),
      suhoor_time: String(row.suhoor_time).slice(0, 5),
      iftar_time: String(row.iftar_time).slice(0, 5),
    })),
  });
}

export async function putRamadan(req, res) {
  await query("DELETE FROM ramadan_periods");
  for (const period of req.body.periods) {
    const suhoor = period.suhoor_time.length === 5 ? `${period.suhoor_time}:00` : period.suhoor_time;
    const iftar = period.iftar_time.length === 5 ? `${period.iftar_time}:00` : period.iftar_time;
    await query(
      `INSERT INTO ramadan_periods (year, starts_on, ends_on, suhoor_time, iftar_time, region)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [period.year, period.starts_on, period.ends_on, suhoor, iftar, period.region || null]
    );
  }
  return getRamadan(req, res);
}

export async function listUsers(req, res) {
  const rows = await query(
    `SELECT id, full_name, age, role, language, category, subscription_status, trial_start, created_at
     FROM users ORDER BY id DESC LIMIT 100`
  );
  res.json({ users: rows });
}

export async function updateUserSubscription(req, res) {
  const rows = await query("SELECT id FROM users WHERE id = ?", [req.params.id]);
  if (!rows[0]) throw httpError(404, "NOT_FOUND", "User not found.");
  await query("UPDATE users SET subscription_status = ? WHERE id = ?", [
    req.body.subscription_status,
    req.params.id,
  ]);
  res.json({ id: Number(req.params.id), subscription_status: req.body.subscription_status });
}
