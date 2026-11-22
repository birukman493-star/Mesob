import { GoogleGenAI } from "@google/genai";

const NAMES = { en: "English", am: "Amharic", om: "Afaan Oromo" };

export function speakGemini({ text, language = "am" }) {
  const spoken = String(text || "").trim().slice(0, 1500);
  if (!spoken) return Promise.reject(Object.assign(new Error("Nothing to speak."), { code: "EMPTY" }));
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_ENABLED !== "true") {
    return Promise.reject(Object.assign(new Error("Gemini is not configured."), { code: "GEMINI_NOT_CONFIGURED" }));
  }
  const languageName = NAMES[language] || "Amharic";
  return new Promise((resolve, reject) => {
    const chunks = [];
    let transcript = "";
    let session = null;
    let sent = false;
    let settled = false;
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { apiVersion: "v1beta" },
    });
    const timer = setTimeout(() => finish(Object.assign(new Error("Gemini voice timed out."), { code: "TIMEOUT" })), 25000);

    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { session?.close(); } catch { /* The voice session already ended. */ }
      if (error && !chunks.length) {
        reject(error);
        return;
      }
      resolve({
        audio_base64: Buffer.concat(chunks).toString("base64"),
        sample_rate: 24000,
        transcript,
      });
    }

    function speakNow() {
      if (!session || sent || settled) return;
      sent = true;
      session.sendClientContent({
        turns: [{ role: "user", parts: [{ text: `Read this aloud exactly in ${languageName}:\n${spoken}` }] }],
        turnComplete: true,
      });
    }

    ai.live.connect({
      model: process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live",
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { languageCode: language },
        outputAudioTranscription: {},
        systemInstruction: `You speak only ${languageName}. Read the user's text aloud exactly. Do not translate it and do not add words.`,
      },
      callbacks: {
        onopen: () => {},
        onmessage: (message) => {
          if (message.setupComplete) speakNow();
          if (message.data) chunks.push(Buffer.from(message.data, "base64"));
          const heard = message.serverContent?.outputTranscription?.text;
          if (heard) transcript += heard;
          if (message.serverContent?.turnComplete && chunks.length) finish();
        },
        onerror: (event) => finish(Object.assign(new Error("Gemini voice failed."), { code: "GEMINI_VOICE", cause: event?.error || event })),
        onclose: () => finish(chunks.length ? null : Object.assign(new Error("Gemini voice closed."), { code: "GEMINI_VOICE" })),
      },
    }).then((value) => {
      session = value;
      speakNow();
    }).catch((error) => finish(error));
  });
}
