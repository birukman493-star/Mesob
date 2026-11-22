import { scaleFood } from "./nutrients.js";

export function normList(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => String(item).toLowerCase().trim()).filter(Boolean);
}

export function foodText(food) {
  const ingredients = Array.isArray(food.ingredients) ? food.ingredients.join(" ") : "";
  return `${food.name_en || ""} ${ingredients}`.toLowerCase();
}

export function isInjera(food) {
  return /injera/i.test(food.name_en || "");
}

export function containsInjera(food) {
  if (isInjera(food)) return true;
  return (food.ingredients || []).some((item) => /injera/i.test(item));
}

export function foodBlocked(food, profile, rules) {
  const allergies = normList(profile.allergies);
  const allergens = normList(food.allergens);
  if (allergens.some((item) => allergies.includes(item))) return "allergen";
  if (profile.orthodox_fasting && !food.is_fasting_ok) return "fasting";
  const text = foodText(food);
  const conditions = normList(profile.conditions);
  if (conditions.includes("diabetes")) {
    if (food.glycemic_level === "high") return "glycemic";
    if ((rules.high_sugar_keywords || []).some((word) => text.includes(word))) return "sugar";
  }
  if (profile.category === "pregnancy") {
    if ((rules.raw_meat_keywords || []).some((word) => text.includes(word))) return "raw";
  }
  return null;
}

export function suitabilityNote(food, portions, profile, rules) {
  const notes = [];
  const nutrients = scaleFood(food, portions);
  const conditions = normList(profile.conditions);
  if (conditions.includes("diabetes")) {
    if (isInjera(food)) {
      notes.push(
        `Diabetes plans cap injera at ${rules.diabetes.injera_max_portions} portion per meal.`
      );
    }
    if (food.glycemic_level === "high") {
      notes.push("This dish is marked high glycemic and is left out of diabetes meal plans.");
    } else {
      notes.push(`Glycemic level in the database: ${food.glycemic_level || "not set"}.`);
    }
  }
  if (
    conditions.includes("hypertension") &&
    nutrients.sodium_mg > rules.hypertension_food_sodium_flag_mg
  ) {
    notes.push(
      `This portion has ${nutrients.sodium_mg} mg sodium, above the ${rules.hypertension_food_sodium_flag_mg} mg flag. The daily sodium cap is ${rules.sodium_limit_mg} mg.`
    );
  }
  if (profile.category === "pregnancy" && foodBlocked(food, profile, rules) === "raw") {
    notes.push("Raw-meat dishes are blocked for pregnancy profiles.");
  }
  const sensitive =
    ["patient", "pregnancy", "children"].includes(profile.category) || conditions.length > 0;
  if (sensitive) notes.push(rules.doctor_notice);
  if (!notes.length) notes.push("Fits the filters saved on this profile.");
  return notes.join(" ");
}
