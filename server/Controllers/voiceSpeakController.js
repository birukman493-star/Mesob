import { httpError } from "../middleware/errors.js";
import { speakGemini } from "../services/geminiSpeak.js";

export async function speakReply(req, res) {
  const language = req.body.language || req.body.lang || "am";
  if (!["en", "am", "om"].includes(language)) {
    throw httpError(400, "VALIDATION", "Choose English, Amharic, or Afaan Oromo.");
  }
  const text = String(req.body.text || "").trim();
  if (!text) throw httpError(400, "VALIDATION", "Nothing to speak.");
  try {
    const audio = await speakGemini({ text, language });
    if (!audio.audio_base64) throw httpError(502, "NO_AUDIO", "Gemini did not return speech.");
    res.json({ success: true, language, sample_rate: audio.sample_rate, audio_base64: audio.audio_base64 });
  } catch (error) {
    if (error.status) throw error;
    throw httpError(502, error.code || "GEMINI_VOICE", "The answer could not be spoken. You can still read the text.");
  }
}
