import { query } from "../db.js";
import { mapFood, publicFood } from "./foods.js";
import { scaleFood, sumNutrients } from "./nutrients.js";
import { loadRules } from "./rules.js";
import { isoDate } from "./dates.js";
import { fastingNotice } from "./ramadan.js";

export async function buildChatContext(user, profile, targets, message) {
  const rules = loadRules();
  const today = isoDate();
  const logs = await query(
    `SELECT f.*, l.portions FROM food_logs l JOIN foods f ON f.id = l.food_id
     WHERE l.user_id = ? AND l.logged_at >= ? AND l.logged_at <= ?`,
    [user.id, `${today} 00:00:00`, `${today} 23:59:59`]
  );
  const eaten = sumNutrients(logs.map((row) => scaleFood(mapFood(row), Number(row.portions))));
  const remaining = {
    kcal: Math.round((targets.kcal - eaten.kcal) * 10) / 10,
    protein_g: Math.round((targets.protein_g - eaten.protein_g) * 10) / 10,
    carbs_g: Math.round((targets.carbs_g - eaten.carbs_g) * 10) / 10,
    fat_g: Math.round((targets.fat_g - eaten.fat_g) * 10) / 10,
  };

  const words = String(message || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3);
  const all = (await query("SELECT * FROM foods ORDER BY name_en")).map(mapFood);
  const mentioned = all.filter((food) =>
    words.some((word) => food.name_en.toLowerCase().includes(word))
  );
  const planFoods = (
    await query(
      `SELECT f.* FROM meal_plan_items i
       JOIN meal_plans p ON p.id = i.plan_id
       JOIN foods f ON f.id = i.food_id
       WHERE p.user_id = ?
       ORDER BY p.id DESC, i.id
       LIMIT 8`,
      [user.id]
    )
  ).map(mapFood);
  const merged = [];
  for (const food of [...mentioned, ...planFoods, ...all.slice(0, 4)]) {
    if (!merged.some((item) => item.id === food.id)) merged.push(publicFood(food));
    if (merged.length >= 6) break;
  }

  const rawAge = Number(user?.age || profile?.age || 30);
  const safeAge = Number.isFinite(rawAge) && rawAge > 0 ? rawAge : 30;
  const ageMonths = user?.category === "children"
    ? Number(profile?.child_data?.child_age_months ?? (safeAge * 12))
    : safeAge * 12;
  const audiences = [...new Set([user.category || "all", "all", ...(profile.conditions || [])].map((item) => String(item)))];
  const guides = await query(
    `SELECT title, body, source FROM guideline_documents
     WHERE audience IN (${audiences.map(() => "?").join(",")})
       AND (min_age_months IS NULL OR min_age_months <= ?)
       AND (max_age_months IS NULL OR max_age_months >= ?)
     LIMIT 6`,
    [...audiences, ageMonths, ageMonths]
  );

  const periods = await query(
    "SELECT year, starts_on, ends_on, suhoor_time, iftar_time, region FROM ramadan_periods ORDER BY year DESC LIMIT 1"
  );
  const ramadan = periods[0]
    ? {
        ...periods[0],
        starts_on: String(periods[0].starts_on).slice(0, 10),
        ends_on: String(periods[0].ends_on).slice(0, 10),
        suhoor_time: String(periods[0].suhoor_time).slice(0, 5),
        iftar_time: String(periods[0].iftar_time).slice(0, 5),
      }
    : null;

  return {
    category: user.category,
    conditions: profile.conditions || [],
    age: user.age,
    pregnancy: user.category === "pregnancy",
    trimester: profile.trimester,
    allergies: profile.allergies || [],
    orthodox_fasting: profile.orthodox_fasting,
    budget_per_day: profile.budget_per_day,
    targets: {
      kcal: targets.kcal,
      protein_g: targets.protein_g,
      carbs_g: targets.carbs_g,
      fat_g: targets.fat_g,
      sodium_mg: targets.sodium_mg,
      fiber_g: targets.fiber_g,
    },
    remaining,
    foods: merged,
    guidelines: guides.map((doc) => ({
      title: doc.title,
      excerpt: String(doc.body).slice(0, 280),
      source: doc.source,
    })),
    ramadan,
    reminder: fastingNotice(profile, rules, profile.ramadan_mode ? "ramadan" : "standard"),
    notice: rules.doctor_notice,
  };
}
