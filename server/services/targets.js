import { activityFactor, bmr } from "./bmr.js";
import { round1, round2 } from "./nutrients.js";

function bandFor(months, rules) {
  const bands = rules.child_age_bands || [];
  return (
    bands.find((b) => months >= b.min_months && months <= b.max_months) ||
    bands[bands.length - 1]
  );
}

function micros(rules, extra = {}) {
  const base = rules.micronutrient_defaults;
  return {
    fiber_g: rules.fiber_target_g,
    iron_mg: round1(base.iron_mg + (extra.iron_mg || 0)),
    calcium_mg: round1(base.calcium_mg + (extra.calcium_mg || 0)),
    vit_a_ug: round1(base.vit_a_ug),
    folate_ug: round1(base.folate_ug + (extra.folate_ug || 0)),
  };
}

function macrosFromKcal(kcal, rules, { gymProteinG = null } = {}) {
  if (gymProteinG != null) {
    const protein_g = round1(gymProteinG);
    const carbs_g = round1((kcal * rules.macro_split.carbs) / 4);
    const fat_g = round1(Math.max(kcal - protein_g * 4 - carbs_g * 4, 0) / 9);
    return { protein_g, carbs_g, fat_g };
  }
  return {
    protein_g: round1((kcal * rules.macro_split.protein) / 4),
    carbs_g: round1((kcal * rules.macro_split.carbs) / 4),
    fat_g: round1((kcal * rules.macro_split.fat) / 9),
  };
}

export function computeTargets({
  age,
  sex = "male",
  kg,
  cm,
  activity = "light",
  category,
  trimester = null,
  conditions = [],
  childAgeMonths = null,
  rules,
}) {
  const noticeNeeded = ["patient", "pregnancy", "children"].includes(category) || conditions.length > 0;
  const sodium = conditions.map((c) => String(c).toLowerCase()).includes("hypertension")
    ? rules.sodium_limit_mg
    : rules.sodium_limit_mg_default;

  const useChildBand =
    category === "children" ||
    (Number(age) <= Number(rules.child_max_age) && category !== "pregnancy");

  if (useChildBand) {
    const months = childAgeMonths != null ? Number(childAgeMonths) : Number(age) * 12;
    const band = bandFor(months, rules);
    const kcal = band.kcal;
    return {
      method: "child_age_band",
      source: band.source || "TODO_VERIFY",
      weight_loss_blocked: true,
      bmr: null,
      tdee: null,
      kcal,
      protein_g: band.protein_g,
      carbs_g: band.carbs_g,
      fat_g: band.fat_g,
      sodium_mg: sodium,
      water_ml: rules.water_target_ml,
      ...micros(rules),
      weekly_kcal: round1(kcal * 7),
      notice: noticeNeeded || Number(age) < 18 ? rules.doctor_notice : null,
    };
  }

  const bmrVal = bmr({ sex, kg: Number(kg), cm: Number(cm), age: Number(age) });
  const tdee = bmrVal * activityFactor(activity, rules);
  const pregnant = category === "pregnancy";
  const teen = Number(age) <= Number(rules.teen_max_age);
  let raw = tdee;
  let method = "maintain";

  if (pregnant) {
    const add = Number(rules.pregnancy_kcal_add[String(trimester || 1)] || 0);
    raw = tdee + add;
    method = "pregnancy";
  } else if (category === "weight_loss") {
    if (teen) {
      raw = tdee;
      method = "no_deficit_teen";
    } else {
      raw = tdee * rules.goal_factors.weight_loss;
      method = "weight_loss";
    }
  } else if (category === "weight_gain") {
    raw = tdee * rules.goal_factors.weight_gain;
    method = "weight_gain";
  } else if (category === "gym") {
    raw = tdee * rules.goal_factors.gym;
    method = "gym";
  }

  const floor = sex === "female" ? rules.floors.female : rules.floors.male;
  raw = Math.max(raw, floor);
  const kcal = Math.round(raw);
  const gymProtein = method === "gym" ? rules.gym_protein_g_per_kg * Number(kg) : null;
  const macro = macrosFromKcal(kcal, rules, { gymProteinG: gymProtein });
  if (pregnant) macro.protein_g = round1(macro.protein_g + rules.pregnancy_boosts.protein_g);

  return {
    method,
    source: "rules.json",
    weight_loss_blocked: method === "no_deficit_teen" || pregnant,
    bmr: round2(bmrVal),
    tdee: round2(tdee),
    kcal,
    protein_g: macro.protein_g,
    carbs_g: macro.carbs_g,
    fat_g: macro.fat_g,
    sodium_mg: sodium,
    water_ml: rules.water_target_ml,
    ...micros(rules, pregnant ? rules.pregnancy_boosts : {}),
    weekly_kcal: kcal * 7,
    notice: noticeNeeded ? rules.doctor_notice : null,
  };
}
