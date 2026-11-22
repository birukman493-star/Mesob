import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import { parseCsv, rowToFood } from "./csv.js";
import { loadGuidelineFile } from "../services/rules.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function upsertFood(pool, food) {
  const [existing] = await pool.query("SELECT id, source FROM foods WHERE name_en = ?", [food.name_en]);
  const params = [
    food.name_am,
    food.name_om,
    food.meal_types.join(","),
    food.is_fasting_ok ? 1 : 0,
    food.region,
    food.cost_birr,
    food.portion_unit,
    food.portion_grams,
    food.kcal,
    food.protein_g,
    food.carbs_g,
    food.fat_g,
    food.fiber_g,
    food.sodium_mg,
    food.iron_mg,
    food.calcium_mg,
    food.vit_a_ug,
    food.folate_ug,
    food.glycemic_level,
    JSON.stringify(food.allergens),
    JSON.stringify(food.ingredients),
    food.recipe,
    food.impact_en,
    food.source,
  ];
  if (!existing.length) {
    await pool.query(
      `INSERT INTO foods
        (name_en, name_am, name_om, meal_types, is_fasting_ok, region, cost_birr, portion_unit, portion_grams,
         kcal, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, iron_mg, calcium_mg, vit_a_ug, folate_ug,
         glycemic_level, allergens, ingredients, recipe, impact_en, source)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [food.name_en, ...params]
    );
    return;
  }
  if (String(existing[0].source || "").startsWith("TODO_VERIFY")) {
    await pool.query(
      `UPDATE foods SET name_am=?, name_om=?, meal_types=?, is_fasting_ok=?, region=?, cost_birr=?, portion_unit=?,
        portion_grams=?, kcal=?, protein_g=?, carbs_g=?, fat_g=?, fiber_g=?, sodium_mg=?, iron_mg=?, calcium_mg=?,
        vit_a_ug=?, folate_ug=?, glycemic_level=?, allergens=?, ingredients=?, recipe=?, impact_en=?, source=?
       WHERE id=?`,
      [...params, existing[0].id]
    );
  }
}

async function ensureAccount(pool, account) {
  const nameNorm = account.full_name.trim().toLowerCase().replace(/\s+/g, " ");
  const [rows] = await pool.query(
    "SELECT id, pin_hash FROM users WHERE name_norm = ? AND age = ? AND role = ?",
    [nameNorm, account.age, account.role]
  );
  if (rows.length) return rows[0].id;
  const pinHash = await bcrypt.hash(account.pin, 10);
  const [result] = await pool.query(
    `INSERT INTO users (full_name, name_norm, age, pin_hash, role, language, trial_start, subscription_status)
     VALUES (?, ?, ?, ?, ?, 'en', CURDATE(), ?)`,
    [account.full_name, nameNorm, account.age, pinHash, account.role, account.role === "user" ? "trial" : "active"]
  );
  return result.insertId;
}

export async function seedDatabase(pool) {
  const csvPath = path.join(__dirname, "foods.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error("server/seed/foods.csv is missing. Create the sample file before starting the API.");
  }
  const foods = parseCsv(fs.readFileSync(csvPath, "utf8")).map((row, index) => rowToFood(row, index + 1));
  for (const food of foods) await upsertFood(pool, food);

  await ensureAccount(pool, { full_name: "Mesob Admin", age: 40, pin: "2468", role: "admin" });
  await ensureAccount(pool, { full_name: "Hana Bekele", age: 34, pin: "1357", role: "dietitian" });

  const [guides] = await pool.query("SELECT COUNT(*) AS n FROM guideline_documents");
  if (!guides[0].n) {
    const docs = loadGuidelineFile().documents || [];
    for (const doc of docs) {
      await pool.query(
        `INSERT INTO guideline_documents (title, audience, min_age_months, max_age_months, body, source, reviewed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [doc.title, doc.audience, doc.min_age_months, doc.max_age_months, doc.body, doc.source, doc.reviewed_by]
      );
    }
  }

  const [ramadan] = await pool.query("SELECT COUNT(*) AS n FROM ramadan_periods");
  if (!ramadan[0].n) {
    await pool.query(
      `INSERT INTO ramadan_periods (year, starts_on, ends_on, suhoor_time, iftar_time, region)
       VALUES (2026, '2026-02-18', '2026-03-19', '05:00:00', '18:30:00', 'Addis Ababa')`
    );
  }
  await ensureConditionGuidance(pool);
}

function section(label, items) {
  if (!items?.length) return "";
  return `${label}\n${items.map((item) => `- ${item}`).join("\n")}`;
}

function guidanceBody(item) {
  const plate = item.meal_pattern_example;
  return [
    item.goal,
    section("Prefer", item.prefer),
    section("Limit or use caution", item.limit_or_caution),
    section("Food-safety avoidances", item.avoid_food_safety),
    section("Not recommended", item.avoid_or_not_recommended),
    section("Nutrient focus", item.nutrient_focus),
    plate
      ? `Meal pattern: ${plate.pattern}. ${plate.components.join("; ")}. ${plate.note}`
      : "",
    section("App rules", item.app_rules),
    "Educational guidance only. Not a clinical diet prescription. A licensed dietitian must review it before clinical use.",
    section("Sources", item.sources),
  ].filter(Boolean).join("\n\n");
}

export async function ensureConditionGuidance(pool) {
  const file = path.join(__dirname, "condition_guidance.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const docs = [
    {
      title: data.metadata.title,
      audience: "all",
      body: [
        data.metadata.purpose,
        data.metadata.review_status,
        data.metadata.language_note,
        section("Safety rules", data.safety_rules),
      ].join("\n\n"),
      source: "condition_guidance.json 1.0",
    },
    ...Object.entries(data.conditions).map(([audience, item]) => ({
      title: `${item.display_name} nutrition guidance`,
      audience,
      body: guidanceBody(item),
      source: (item.sources?.[0] || "condition_guidance.json").slice(0, 200),
    })),
  ];
  for (const doc of docs) {
    const [existing] = await pool.query("SELECT id FROM guideline_documents WHERE title = ?", [doc.title]);
    const reviewed = "Draft — not clinician-approved";
    if (existing[0]) {
      await pool.query(
        `UPDATE guideline_documents
         SET audience = ?, body = ?, source = ?, reviewed_by = ?
         WHERE id = ?`,
        [doc.audience, doc.body, doc.source, reviewed, existing[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO guideline_documents (title, audience, min_age_months, max_age_months, body, source, reviewed_by)
         VALUES (?, ?, NULL, NULL, ?, ?, ?)`,
        [doc.title, doc.audience, doc.body, doc.source, reviewed]
      );
    }
  }
}
