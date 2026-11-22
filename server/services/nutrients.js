export const NUTRIENT_KEYS = [
  "kcal",
  "protein_g",
  "carbs_g",
  "fat_g",
  "fiber_g",
  "sodium_mg",
  "iron_mg",
  "calcium_mg",
  "vit_a_ug",
  "folate_ug",
];

export function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function scaleFood(food, portions) {
  const out = {};
  for (const key of NUTRIENT_KEYS) {
    out[key] = round1(Number(food[key] || 0) * portions);
  }
  return out;
}

export function sumNutrients(list) {
  const out = {};
  for (const key of NUTRIENT_KEYS) out[key] = 0;
  for (const item of list) {
    for (const key of NUTRIENT_KEYS) out[key] += Number(item?.[key] || 0);
  }
  for (const key of NUTRIENT_KEYS) out[key] = round1(out[key]);
  return out;
}

export function addCost(food, portions) {
  return round2(Number(food.cost_birr || 0) * portions);
}
