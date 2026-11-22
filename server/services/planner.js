import { addCost, sumNutrients } from "./nutrients.js";
import { fastingNotice, isMainMeal, slotsFor } from "./ramadan.js";
import { containsInjera, foodBlocked, isInjera } from "./safety.js";
import { scaleFood } from "./nutrients.js";

function rngFrom(seed) {
  let x = Number(seed) >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

function injeraCap(food, profile, rules) {
  const diabetes = (profile.conditions || []).map((c) => String(c).toLowerCase()).includes("diabetes");
  if (diabetes && isInjera(food)) return Number(rules.diabetes.injera_max_portions);
  return 2;
}

export function chooseMeal({
  foods,
  profile,
  rules,
  slot,
  targets,
  budgetLeft,
  avoidIds = [],
  mode,
  rng,
}) {
  const diabetes = (profile.conditions || []).map((c) => String(c).toLowerCase()).includes("diabetes");
  const applyBand = diabetes && mode === "standard" && isMainMeal(mode, slot.meal_type) && targets.carbs_g > 0;
  const injera = foods.find((food) => isInjera(food) && !foodBlocked(food, profile, rules));
  const ordered = [...foods].sort((a, b) => a.id - b.id);
  const avoid = new Set(avoidIds);

  const attempt = (respectAvoid, respectBand) => {
    let best = null;
    for (const base of ordered) {
      if (foodBlocked(base, profile, rules)) continue;
      if (!(base.meal_types || []).includes(slot.meal_type)) continue;
      if (respectAvoid && avoid.has(base.id) && !isInjera(base)) continue;
      const steps = rules.portion_steps || [0.5, 1, 1.5, 2];
      const cap = injeraCap(base, profile, rules);
      for (const portions of steps) {
        if (portions > cap + 0.001) continue;
        const addonChoices = [0];
        if (injera && !containsInjera(base) && !isInjera(base) && (injera.meal_types || []).includes(slot.meal_type)) {
          addonChoices.push(0.5, 1);
        }
        for (const extra of addonChoices) {
          if (injera && extra > injeraCap(injera, profile, rules) + 0.001) continue;
          const parts = [{ food: base, portions }];
          if (extra > 0) parts.push({ food: injera, portions: extra });
          const nutrients = sumNutrients(parts.map((part) => scaleFood(part.food, part.portions)));
          const cost = parts.reduce((sum, part) => sum + addCost(part.food, part.portions), 0);
          if (budgetLeft != null && cost - budgetLeft > 0.05) continue;
          if (respectBand && applyBand) {
            const ratio = nutrients.carbs_g / targets.carbs_g;
            if (ratio < rules.diabetes.main_meal_carb_min_ratio - 0.005) continue;
            if (ratio > rules.diabetes.main_meal_carb_max_ratio + 0.005) continue;
          }
          let score = Math.abs(nutrients.kcal - slot.kcal);
          score += Math.abs(nutrients.protein_g - slot.protein_g) * 2;
          score += Math.abs(nutrients.carbs_g - slot.carbs_g);
          const hypertension = (profile.conditions || [])
            .map((c) => String(c).toLowerCase())
            .includes("hypertension");
          if (hypertension && nutrients.sodium_mg > rules.hypertension_food_sodium_flag_mg) score += 35;
          if (profile.region && base.region && base.region !== "all" && base.region === profile.region) {
            score -= 4;
          }
          score += (rng ? rng() : 0) * 5;
          if (!best || score < best.score) {
            best = {
              score,
              cost: Math.round(cost * 100) / 100,
              nutrients,
              items: parts.map((part) => ({
                food: part.food,
                portions: part.portions,
                nutrients: scaleFood(part.food, part.portions),
                cost: addCost(part.food, part.portions),
              })),
            };
          }
        }
      }
    }
    return best;
  };

  return (
    attempt(true, true) ||
    attempt(false, true) ||
    attempt(true, false) ||
    attempt(false, false)
  );
}

export function buildPlan({ targets, profile, rules, foods, mode = "standard", seed = 1 }) {
  const rng = rngFrom(seed);
  const slots = slotsFor(mode);
  const splits = (rules.meal_splits && rules.meal_splits[mode]) || rules.meal_splits.standard;
  const days = [];
  const previous = {};

  for (let day = 0; day < 7; day += 1) {
    let budgetLeft =
      profile.budget_per_day == null || profile.budget_per_day === ""
        ? null
        : Number(profile.budget_per_day);
    const meals = [];
    for (const mealType of slots) {
      const split = splits[mealType] ?? 0.25;
      const slot = {
        meal_type: mealType,
        kcal: targets.kcal * split,
        protein_g: targets.protein_g * split,
        carbs_g: targets.carbs_g * split,
        fat_g: targets.fat_g * split,
      };
      const chosen = chooseMeal({
        foods,
        profile,
        rules,
        slot,
        targets,
        budgetLeft,
        avoidIds: previous[mealType] || [],
        mode,
        rng,
      });
      if (!chosen) continue;
      if (budgetLeft != null) budgetLeft = Math.round((budgetLeft - chosen.cost) * 100) / 100;
      previous[mealType] = chosen.items.map((item) => item.food.id).filter((id) => {
        const food = chosen.items.find((item) => item.food.id === id);
        return food && !isInjera(food.food);
      });
      meals.push({
        day_index: day,
        meal_type: mealType,
        items: chosen.items,
        nutrients: chosen.nutrients,
        cost: chosen.cost,
      });
    }
    const totals = sumNutrients(meals.map((meal) => meal.nutrients));
    totals.cost = Math.round(meals.reduce((sum, meal) => sum + meal.cost, 0) * 100) / 100;
    days.push({ day_index: day, meals, totals });
  }

  return {
    mode,
    days,
    targets,
    reminder: fastingNotice(profile, rules, mode),
  };
}
