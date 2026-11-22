export function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function mapFood(row) {
  if (!row) return null;
  const meals = Array.isArray(row.meal_types)
    ? row.meal_types
    : String(row.meal_types || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  return {
    id: row.id,
    name_en: row.name_en,
    name_am: row.name_am,
    name_om: row.name_om,
    meal_types: meals,
    is_fasting_ok: Boolean(Number(row.is_fasting_ok)),
    region: row.region,
    cost_birr: Number(row.cost_birr),
    portion_unit: row.portion_unit,
    portion_grams: Number(row.portion_grams),
    kcal: Number(row.kcal),
    protein_g: Number(row.protein_g),
    carbs_g: Number(row.carbs_g),
    fat_g: Number(row.fat_g),
    fiber_g: Number(row.fiber_g),
    sodium_mg: Number(row.sodium_mg),
    iron_mg: Number(row.iron_mg),
    calcium_mg: Number(row.calcium_mg),
    vit_a_ug: Number(row.vit_a_ug),
    folate_ug: Number(row.folate_ug),
    glycemic_level: row.glycemic_level,
    allergens: parseJson(row.allergens, []),
    ingredients: parseJson(row.ingredients, []),
    recipe: row.recipe,
    impact_en: row.impact_en,
    source: row.source,
  };
}

export function publicFood(food) {
  if (!food) return null;
  const {
    id, name_en, name_am, name_om, meal_types, portion_unit, portion_grams,
    kcal, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, iron_mg, calcium_mg,
    vit_a_ug, folate_ug, glycemic_level, allergens, cost_birr, is_fasting_ok, source,
  } = food;
  return {
    id, name_en, name_am, name_om, meal_types, portion_unit, portion_grams,
    kcal, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, iron_mg, calcium_mg,
    vit_a_ug, folate_ug, glycemic_level, allergens, cost_birr, is_fasting_ok, source,
  };
}
