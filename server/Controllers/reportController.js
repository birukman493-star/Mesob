import { query } from "../db.js";
import { requireComplete } from "../services/account.js";
import { mapFood } from "../services/foods.js";
import { scaleFood, sumNutrients } from "../services/nutrients.js";
import { addDays, isoDate } from "../services/dates.js";
import { intakeStatements } from "../services/analysis.js";
import { buildHealthPdf } from "../services/pdf.js";

function range(period) {
  const end = isoDate();
  const days = period === "month" ? 30 : 7;
  const startDate = new Date(`${end}T12:00:00`);
  startDate.setDate(startDate.getDate() - (days - 1));
  const start = isoDate(startDate);
  const dates = [];
  for (let i = 0; i < days; i += 1) dates.push(addDays(start, i));
  return { start, end, dates };
}

async function intake(userId, period, targets) {
  const { start, end, dates } = range(period);
  const rows = await query(
    `SELECT l.portions, DATE(l.logged_at) AS day, f.*
     FROM food_logs l JOIN foods f ON f.id = l.food_id
     WHERE l.user_id = ? AND l.logged_at >= ? AND l.logged_at <= ?`,
    [userId, `${start} 00:00:00`, `${end} 23:59:59`]
  );
  const byDay = Object.fromEntries(dates.map((date) => [date, []]));
  for (const row of rows) {
    const key = String(row.day).slice(0, 10);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(scaleFood(mapFood(row), Number(row.portions)));
  }
  const days = dates.map((date) => ({ date, ...sumNutrients(byDay[date] || []) }));
  const statements = intakeStatements(days, targets);
  const keys = ["kcal", "protein_g", "carbs_g", "fat_g", "fiber_g", "iron_mg", "calcium_mg", "folate_ug"];
  const labels = {
    kcal: ["Calories", "kcal"],
    protein_g: ["Protein", "g"],
    carbs_g: ["Carbohydrates", "g"],
    fat_g: ["Fat", "g"],
    fiber_g: ["Fiber", "g"],
    iron_mg: ["Iron", "mg"],
    calcium_mg: ["Calcium", "mg"],
    folate_ug: ["Folate", "µg"],
  };
  const rowsOut = keys.map((key) => {
    const average = Math.round((days.reduce((sum, day) => sum + Number(day[key] || 0), 0) / days.length) * 10) / 10;
    return { key, label: labels[key][0], unit: labels[key][1], average, target: targets[key] };
  });
  return { days, statements, rows: rowsOut, label: "Intake-based estimate, not a diagnosis." };
}

export async function weekly(req, res) {
  const { targets } = await requireComplete(req.user.id);
  res.json(await intake(req.user.id, "week", targets));
}

export async function healthPdf(req, res) {
  const { user, profile, targets } = await requireComplete(req.user.id);
  const period = req.query.period === "month" ? "month" : "week";
  const sections = String(req.query.sections || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const summary = await intake(user.id, period, targets);
  const { start } = range(period);
  const weights = await query(
    "SELECT weight_kg, logged_at FROM weight_entries WHERE user_id = ? AND logged_at >= ? ORDER BY logged_at",
    [user.id, start]
  );
  const notes = await query(
    "SELECT content FROM chat_messages WHERE user_id = ? AND role = 'assistant' ORDER BY id DESC LIMIT 1",
    [user.id]
  );
  const pdf = await buildHealthPdf({
    user,
    profile,
    targets,
    intake: summary,
    weights: weights.map((row) => ({
      weight_kg: Number(row.weight_kg),
      logged_at: String(row.logged_at).slice(0, 10),
    })),
    notes: notes[0]?.content || "",
    sections,
    period,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="mesob-health-summary.pdf"');
  res.send(pdf);
}

export async function guidelines(req, res) {
  const { user, profile } = await requireComplete(req.user.id);
  const months = user.category === "children"
    ? Number(profile.child_data?.child_age_months || 0)
    : Number(user.age) * 12;
  const audiences = [...new Set([user.category || "all", "all", ...(profile.conditions || [])].map((item) => String(item)))];
  const rows = await query(
    `SELECT id, title, audience, body, source, reviewed_by
     FROM guideline_documents
     WHERE audience IN (${audiences.map(() => "?").join(",")})
       AND (min_age_months IS NULL OR min_age_months <= ?)
       AND (max_age_months IS NULL OR max_age_months >= ?)`,
    [...audiences, months, months]
  );
  res.json({ documents: rows });
}
