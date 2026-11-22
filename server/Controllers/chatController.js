import { query } from "../db.js";
import { requireComplete } from "../services/account.js";
import { buildChatContext } from "../services/chatContext.js";
import { answerQuestion } from "../services/aiClient.js";
import { geminiConfigured } from "../services/geminiService.js";
import { mapFood } from "../services/foods.js";
import { scaleFood } from "../services/nutrients.js";
import { isoDateTime } from "../services/dates.js";

async function saveMessage(userId, role, content) {
  await query("INSERT INTO chat_messages (user_id, role, content) VALUES (?, ?, ?)", [userId, role, content]);
}

export async function chat(req, res) {
  const { user, profile, targets } = await requireComplete(req.user.id);
  const lang = req.body.language || req.body.lang || user.language || "en";
  const message = req.body.message.trim();
  console.log("[CHAT] Message received");
  console.log("[CHAT] Language selected", lang);
  console.log("[CHAT] Request validated");
  const context = await buildChatContext(user, profile, targets, message);
  let logged = null;
  const ate = message.match(/\bi ate\s+([a-z][a-z\s]{1,40})/i);
  let result;
  if (ate) {
    const term = ate[1].trim();
    const rows = await query(
      "SELECT * FROM foods WHERE name_en LIKE ? ORDER BY CHAR_LENGTH(name_en) LIMIT 1",
      [`%${term}%`]
    );
    if (rows[0]) {
      const food = mapFood(rows[0]);
      await query(
        "INSERT INTO food_logs (user_id, food_id, portions, logged_at, source) VALUES (?, ?, 1, ?, 'voice')",
        [user.id, food.id, isoDateTime()]
      );
      const nutrients = scaleFood(food, 1);
      logged = { food_id: food.id, name_en: food.name_en, portions: 1, nutrients };
      const reply =
        `Logged 1 ${food.portion_unit} of ${food.name_en}: ${nutrients.kcal} kcal, ${nutrients.protein_g} g protein, ${nutrients.carbs_g} g carbohydrate, and ${nutrients.fat_g} g fat. ` +
        `${context.notice && (profile.conditions?.length || ["patient", "pregnancy", "children"].includes(user.category)) ? context.notice : ""}`;
      result = { reply: reply.trim(), source: "rules", provider: "rules", providers_tried: ["rules"], fallback: true };
    }
  }
  if (!result) {
    const prior = await query(
      "SELECT role, content FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 8",
      [user.id]
    );
    result = await answerQuestion({
      mode: process.env.AI_MODE || "rules",
      context,
      message,
      lang,
      history: prior.reverse(),
    });
  }
  console.log("[CHAT] Reply ready", result.provider, result.fallback ? "fallback" : "generated");
  await saveMessage(user.id, "user", message);
  await saveMessage(user.id, "assistant", result.reply);
  res.json({
    success: true,
    reply: result.reply,
    language: lang,
    source: result.source,
    provider: result.provider || result.source,
    fallback: Boolean(result.fallback),
    model: result.model || null,
    warning: result.warning || null,
    providers_tried: result.providers_tried || [],
    gemini_configured: geminiConfigured(),
    logged,
    numbers: {
      remaining: context.remaining,
      targets: context.targets,
      cited: (context.foods || []).slice(0, 4).map((food) => ({
        name: food.name_en,
        kcal: food.kcal,
        protein_g: food.protein_g,
        carbs_g: food.carbs_g,
        fat_g: food.fat_g,
        portion_unit: food.portion_unit,
      })),
    },
  });
}

export async function clearHistory(req, res) {
  await query("DELETE FROM chat_messages WHERE user_id = ?", [req.user.id]);
  res.json({ success: true });
}

export async function history(req, res) {
  const rows = await query(
    "SELECT id, role, content, created_at FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 40",
    [req.user.id]
  );
  res.json({ messages: rows.reverse() });
}
