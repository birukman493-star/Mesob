const CODES = { en: "eng", am: "amh", om: "orm" };

export function hasabConfigured() {
  return Boolean(process.env.HASAB_API_KEY);
}

export function hasabCapabilities() {
  return {
    configured: hasabConfigured(),
    provider: "Hasab AI",
    endpoint: "https://api.hasab.ai/api/v1/translate",
    supported_languages: ["eng", "amh", "orm", "tir"],
    streaming_audio: false, // Hasab AI provides REST translation/transcription; does not support real-time audio WebSocket
    side_translation: true, // Asynchronous translation of turn transcripts
  };
}

export async function hasabTranslate({ text, source = "en", target = "am" }) {
  const spoken = String(text || "").trim();
  if (!spoken) {
    const error = new Error("Nothing to translate.");
    error.code = "HASAB_EMPTY";
    throw error;
  }
  if (!hasabConfigured()) {
    const error = new Error("Hasab AI is not configured.");
    error.code = "HASAB_NOT_CONFIGURED";
    throw error;
  }
  const targetCode = CODES[target] || (target === "om" ? "orm" : target === "am" ? "amh" : "eng");
  const sourceCode = CODES[source] || (source === "om" ? "orm" : source === "am" ? "amh" : "eng");

  async function attempt(tCode) {
    const body = new FormData();
    body.set("text", spoken);
    body.set("source_language", sourceCode);
    body.set("target_language", tCode);
    const response = await fetch("https://api.hasab.ai/api/v1/translate", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.HASAB_API_KEY}` },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const error = new Error(`Hasab translation failed with status ${response.status}`);
      error.code = response.status === 401 || response.status === 403 ? "HASAB_AUTH" : "HASAB_UNAVAILABLE";
      error.status = response.status;
      throw error;
    }
    const payload = await response.json().catch(() => null);
    const translated = payload?.data?.translation?.translated_text;
    if (!translated) {
      const error = new Error("Hasab returned no translation.");
      error.code = "HASAB_EMPTY";
      throw error;
    }
    return String(translated).trim();
  }

  try {
    return await attempt(targetCode);
  } catch (err) {
    if (target === "om" && targetCode === "orm") {
      try {
        return await attempt("oro");
      } catch {
        throw err;
      }
    }
    throw err;
  }
}
