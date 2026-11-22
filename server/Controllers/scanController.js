import { query } from "../db.js";
import { mapFood } from "../services/foods.js";
import { isImageBuffer, mockGuesses } from "../services/scan.js";
import { httpError } from "../middleware/errors.js";

async function fromModel(file, foods) {
  const form = new FormData();
  form.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname || "upload.jpg");
  const response = await fetch(`${process.env.AI_SERVICE_URL}/recognize`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const guesses = (data.guesses || [])
    .map((guess) => {
      const food = foods.find((item) => item.name_en.toLowerCase() === String(guess.label || "").toLowerCase());
      if (!food) return null;
      return {
        food_id: food.id,
        name: food.name_en,
        confidence: Math.round(Number(guess.confidence) * 100) / 100,
      };
    })
    .filter(Boolean)
    .slice(0, 3);
  if (!guesses.length) return null;
  return { guesses, low_confidence: guesses[0].confidence < 0.6, mode: "model" };
}

export async function scanFood(req, res) {
  if (!req.file) throw httpError(400, "BAD_FILE", "Choose a JPEG or PNG image.");
  if (!["image/jpeg", "image/png"].includes(req.file.mimetype) || !isImageBuffer(req.file.buffer)) {
    throw httpError(400, "BAD_FILE", "Only JPEG and PNG images are accepted.");
  }
  const foods = (await query("SELECT * FROM foods ORDER BY id")).map(mapFood);
  let result = null;
  if (process.env.VISION_MODE === "model") {
    try {
      result = await fromModel(req.file, foods);
    } catch {
      result = null;
    }
  }
  if (!result) result = mockGuesses(foods, req.file.originalname);
  req.file.buffer = null;
  res.json(result);
}
