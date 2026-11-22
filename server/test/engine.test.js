import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadRules } from "../services/rules.js";
import { computeTargets } from "../services/targets.js";
import { buildPlan } from "../services/planner.js";
import { parseCsv, rowToFood } from "../seed/csv.js";
import { fallbackReply } from "../services/chatFallback.js";
import { mockGuesses } from "../services/scan.js";
import { suggestRecipes } from "../services/recipes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rules = loadRules();
const foods = parseCsv(fs.readFileSync(path.join(__dirname, "..", "seed", "foods.csv"), "utf8")).map((row, index) =>
  rowToFood(row, index + 1)
);

const adult = {
  age: 30,
  sex: "male",
  kg: 85,
  cm: 175,
  activity: "moderate",
};

test("weight-loss target matches the Mifflin-St Jeor example", () => {
  const result = computeTargets({ ...adult, category: "weight_loss", rules });
  assert.equal(result.bmr, 1798.75);
  assert.ok(Math.abs(result.tdee - 2788) < 1, `tdee ${result.tdee}`);
  assert.ok(Math.abs(result.kcal - 2370) < 1, `kcal ${result.kcal}`);
});

test("pregnancy is never a calorie deficit and blocks raw meat", () => {
  const targets = computeTargets({
    age: 28,
    sex: "female",
    kg: 65,
    cm: 160,
    activity: "light",
    category: "pregnancy",
    trimester: 2,
    rules,
  });
  assert.ok(targets.kcal >= targets.tdee);
  const plan = buildPlan({
    targets,
    profile: {
      category: "pregnancy",
      sex: "female",
      conditions: [],
      allergies: [],
      orthodox_fasting: false,
      budget_per_day: 500,
      trimester: 2,
    },
    rules,
    foods,
    mode: "standard",
    seed: 3,
  });
  const names = plan.days.flatMap((day) => day.meals.flatMap((meal) => meal.items.map((item) => item.food.name_en.toLowerCase())));
  assert.ok(names.length > 0);
  assert.ok(names.every((name) => !/kitfo|gored|kurt/.test(name)));
});

test("children and teens never receive a weight-loss deficit", () => {
  const child = computeTargets({
    age: 35,
    category: "children",
    childAgeMonths: 96,
    rules,
  });
  assert.equal(child.method, "child_age_band");
  assert.equal(child.kcal, 1400);
  assert.equal(child.weight_loss_blocked, true);

  const teen = computeTargets({
    age: 16,
    sex: "male",
    kg: 60,
    cm: 170,
    activity: "moderate",
    category: "weight_loss",
    rules,
  });
  assert.equal(teen.method, "no_deficit_teen");
  assert.ok(Math.abs(teen.kcal - Math.round(teen.tdee)) <= 1);
});

test("diabetes plan avoids high-glycemic foods and spreads carbohydrate", () => {
  const targets = computeTargets({ ...adult, category: "patient", conditions: ["diabetes"], rules });
  const plan = buildPlan({
    targets,
    profile: {
      category: "patient",
      conditions: ["diabetes"],
      allergies: [],
      orthodox_fasting: false,
      budget_per_day: 500,
      sex: "male",
    },
    rules,
    foods,
    mode: "standard",
    seed: 1,
  });
  for (const day of plan.days) {
    const items = day.meals.flatMap((meal) => meal.items);
    assert.ok(items.every((item) => item.food.glycemic_level !== "high"));
    assert.ok(items.every((item) => !/honey|sugar|sweet/i.test(`${item.food.name_en} ${(item.food.ingredients || []).join(" ")}`)));
    for (const mealType of ["breakfast", "lunch", "dinner"]) {
      const meal = day.meals.find((item) => item.meal_type === mealType);
      assert.ok(meal, `missing ${mealType}`);
      const ratio = meal.nutrients.carbs_g / targets.carbs_g;
      assert.ok(ratio >= 0.25 && ratio <= 0.35, `${mealType} carb ratio ${ratio}`);
    }
  }
});

test("plans respect allergens, fasting, and budget", () => {
  const targets = computeTargets({ ...adult, category: "patient", rules });
  const allergic = buildPlan({
    targets,
    profile: { category: "patient", conditions: [], allergies: ["peanut"], orthodox_fasting: false, budget_per_day: null },
    rules,
    foods,
    seed: 2,
  });
  const fasting = buildPlan({
    targets,
    profile: { category: "patient", conditions: [], allergies: [], orthodox_fasting: true, budget_per_day: null },
    rules,
    foods,
    seed: 2,
  });
  const budgeted = buildPlan({
    targets,
    profile: { category: "patient", conditions: [], allergies: [], orthodox_fasting: false, budget_per_day: 180 },
    rules,
    foods,
    seed: 4,
  });
  for (const day of allergic.days) {
    for (const meal of day.meals) {
      assert.ok(meal.items.every((item) => !(item.food.allergens || []).map((a) => a.toLowerCase()).includes("peanut")));
    }
  }
  for (const day of fasting.days) {
    for (const meal of day.meals) assert.ok(meal.items.every((item) => item.food.is_fasting_ok));
  }
  for (const day of budgeted.days) assert.ok(day.totals.cost <= 180.05, `cost ${day.totals.cost}`);
});

test("ramadan mode uses suhoor, iftar, and an evening snack", () => {
  const targets = computeTargets({ ...adult, category: "patient", rules });
  const plan = buildPlan({
    targets,
    profile: { category: "patient", conditions: [], allergies: [], orthodox_fasting: false, ramadan_mode: true, budget_per_day: 500 },
    rules,
    foods,
    mode: "ramadan",
    seed: 5,
  });
  assert.match(plan.reminder, /iftar/i);
  for (const day of plan.days) {
    assert.deepEqual(day.meals.map((meal) => meal.meal_type), ["suhoor", "iftar", "snack"]);
  }
});

test("ingredient search returns have, missing, and cost", () => {
  const targets = computeTargets({ ...adult, category: "patient", rules });
  const dishes = suggestRecipes({
    foods,
    ingredients: ["lentils"],
    budget: 100,
    mealType: "lunch",
    profile: { category: "patient", conditions: [], allergies: [], orthodox_fasting: false },
    rules,
    targets,
  });
  assert.ok(dishes.length >= 1);
  assert.ok(dishes[0].have.length >= 1);
  assert.ok(Array.isArray(dishes[0].missing));
  assert.equal(typeof dishes[0].missing_cost, "number");
  assert.ok(dishes.every((dish) => dish.missing_cost <= 100));
});

test("rules fallback quotes database numbers and the dietitian notice", () => {
  const injera = foods.find((food) => food.name_en === "Injera");
  const reply = fallbackReply(
    "Can I eat injera if I have diabetes?",
    {
      category: "patient",
      conditions: ["diabetes"],
      foods: [injera],
      targets: { carbs_g: 348.5, kcal: 2788, protein_g: 100, fat_g: 70, sodium_mg: 2300 },
      remaining: { carbs_g: 200, kcal: 1500, protein_g: 40, fat_g: 30 },
      notice: rules.doctor_notice,
    },
    "en"
  );
  assert.match(reply, new RegExp(String(injera.carbs_g)));
  assert.match(reply, new RegExp(String(injera.kcal)));
  assert.match(reply, /dietitian/i);
});

test("mock scan recognizes an injera filename and flags an uncertain one", () => {
  const known = mockGuesses(foods, "injera.png");
  assert.equal(known.guesses[0].name, "Injera");
  assert.equal(known.low_confidence, false);
  const unknown = mockGuesses(foods, "unknown-photo.png");
  assert.equal(unknown.low_confidence, true);
  assert.equal(unknown.guesses.length, 3);
});
