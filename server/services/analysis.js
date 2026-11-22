import { NUTRIENT_KEYS, round1, sumNutrients } from "./nutrients.js";

const LABELS = {
  kcal: ["Calories", "kcal"],
  protein_g: ["Protein", "g"],
  carbs_g: ["Carbohydrates", "g"],
  fat_g: ["Fat", "g"],
  fiber_g: ["Fiber", "g"],
  sodium_mg: ["Sodium", "mg"],
  iron_mg: ["Iron", "mg"],
  calcium_mg: ["Calcium", "mg"],
  vit_a_ug: ["Vitamin A", "µg"],
  folate_ug: ["Folate", "µg"],
};

export function priorityKeys(profile) {
  const keys = new Set(["kcal", "protein_g"]);
  const conditions = (profile.conditions || []).map((item) => String(item).toLowerCase());
  if (conditions.includes("diabetes")) {
    keys.add("carbs_g");
    keys.add("fiber_g");
  }
  if (conditions.includes("hypertension")) keys.add("sodium_mg");
  if (profile.category === "pregnancy") {
    keys.add("iron_mg");
    keys.add("folate_ug");
    keys.add("calcium_mg");
    keys.add("protein_g");
  }
  return keys;
}

export function analyzeWeek(nutrientRows, dailyTargets, profile) {
  const totals = sumNutrients(nutrientRows);
  const priority = priorityKeys(profile);
  return NUTRIENT_KEYS.map((key) => {
    const value = totals[key] || 0;
    const target = round1(Number(dailyTargets[key] || 0) * 7);
    const ratio = target > 0 ? value / target : 0;
    let status = "ok";
    if (target > 0 && ratio < 0.85) status = "low";
    else if (target > 0 && ratio > 1.15) status = "high";
    const [label, unit] = LABELS[key];
    return { key, label, unit, value, target, status, priority: priority.has(key) };
  });
}

export function intakeStatements(dayRows, dailyTargets) {
  const statements = [];
  for (const key of ["kcal", "protein_g", "carbs_g", "fat_g", "fiber_g", "iron_mg", "calcium_mg", "folate_ug"]) {
    const target = Number(dailyTargets[key] || 0);
    if (!target) continue;
    let lowDays = 0;
    for (const day of dayRows) {
      if (Number(day[key] || 0) < target * 0.7) lowDays += 1;
    }
    if (lowDays > 0) {
      statements.push(`${LABELS[key][0]} low on ${lowDays} of ${dayRows.length} days`);
    }
  }
  return statements;
}
