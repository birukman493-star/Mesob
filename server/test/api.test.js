import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../index.js";
import { closeDb } from "../db.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

let base;
let server;
const stamp = Date.now();
const name = `Sara Bekele ${stamp}`;

async function api(path, { method = "GET", token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${base}${path}`, { method, headers, body: payload });
  const type = response.headers.get("content-type") || "";
  const data = type.includes("application/pdf") ? Buffer.from(await response.arrayBuffer()) : await response.json();
  return { status: response.status, data };
}

test.before(async () => {
  const app = await createApp();
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeDb();
});

test("demo journey, access control, and pdf", async () => {
  const created = await api("/auth/register", {
    method: "POST",
    body: { full_name: name, age: 30, pin: "1234", language: "en" },
  });
  assert.equal(created.status, 201);
  assert.ok(created.data.token);

  const wrong = await api("/auth/login", {
    method: "POST",
    body: { full_name: name, age: 30, pin: "9999" },
  });
  assert.equal(wrong.status, 401);

  const duplicate = await api("/auth/register", {
    method: "POST",
    body: { full_name: name, age: 30, pin: "1234", language: "en" },
  });
  assert.equal(duplicate.status, 409);

  const auth = await api("/auth/login", {
    method: "POST",
    body: { full_name: name, age: 30, pin: "1234" },
  });
  const token = auth.data.token;
  assert.equal(auth.status, 200);

  const blocked = await api("/admin/foods", { token });
  assert.equal(blocked.status, 403);

  await api("/me/category", {
    method: "PUT",
    token,
    body: { category: "patient", support_mode: "ai" },
  });
  const profile = await api("/me/profile", {
    method: "PUT",
    token,
    body: {
      sex: "male",
      height_cm: 175,
      weight_kg: 85,
      activity: "moderate",
      conditions: ["diabetes"],
      allergies: [],
      budget_per_day: 400,
      region: "Addis Ababa",
      orthodox_fasting: false,
      ramadan_mode: false,
    },
  });
  assert.equal(profile.status, 200);
  assert.ok(Math.abs(profile.data.targets.bmr - 1798.75) < 0.01);

  const plan = await api("/plans/generate", { method: "POST", token, body: { mode: "standard", seed: 1 } });
  assert.equal(plan.status, 201);
  assert.ok(plan.data.days[0].meals.some((meal) => meal.meal_type === "lunch"));
  for (const day of plan.data.days) {
    for (const meal of day.meals) {
      assert.ok(meal.items.every((item) => item.glycemic_level !== "high"));
    }
  }

  const form = new FormData();
  form.append("image", new Blob([PNG], { type: "image/png" }), "injera.png");
  const scan = await api("/scan", { method: "POST", token, form });
  assert.equal(scan.status, 200);
  assert.equal(scan.data.low_confidence, false);
  assert.equal(scan.data.guesses[0].name, "Injera");

  const injera = await api("/foods?q=injera", { token });
  const foodId = injera.data.foods[0].id;
  const carbs = injera.data.foods[0].carbs_g;
  const logged = await api("/logs", {
    method: "POST",
    token,
    body: { food_id: foodId, portions: 1, source: "scan" },
  });
  assert.equal(logged.status, 201);
  assert.equal(logged.data.totals.carbs_g, carbs);

  const chat = await api("/chat", {
    method: "POST",
    token,
    body: { message: "Can I eat injera if I have diabetes?", lang: "en" },
  });
  assert.equal(chat.status, 200);
  assert.match(chat.data.reply, /dietitian/i);
  assert.match(chat.data.reply, new RegExp(String(carbs)));

  const recipes = await api("/recipes/suggest", {
    method: "POST",
    token,
    body: { ingredients: ["lentils", "onion"], budget: 80, meal_type: "lunch" },
  });
  assert.equal(recipes.status, 200);
  assert.ok(recipes.data.dishes.length >= 1);
  assert.ok(recipes.data.dishes[0].have.length >= 1);

  const pdf = await api("/reports/health-summary.pdf?period=week&sections=patient,targets", { token });
  assert.equal(pdf.status, 200);
  const pdfText = [...pdf.data.toString("latin1").matchAll(/<([0-9A-Fa-f]+)>/g)]
    .map((match) => Buffer.from(match[1], "hex").toString("latin1"))
    .join("");
  assert.match(pdfText, /not a medical record/);
  assert.match(pdfText, /Patient/);
  assert.doesNotMatch(pdfText, /Weight trend/);

  const dietLogin = await api("/auth/login", {
    method: "POST",
    body: { full_name: "Hana Bekele", age: 34, pin: "1357" },
  });
  assert.equal(dietLogin.status, 200);
  const hidden = await api(`/dietitian/users/${auth.data.user.id}`, { token: dietLogin.data.token });
  assert.equal(hidden.status, 403);
});
