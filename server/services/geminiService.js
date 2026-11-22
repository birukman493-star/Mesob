import { ApiError, GoogleGenAI } from "@google/genai";

let client;
let clientKey = "";

export function geminiConfigured() {
  return process.env.GEMINI_ENABLED === "true" && Boolean(process.env.GEMINI_API_KEY);
}

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error("GEMINI_API_KEY is not set.");
    error.code = "GEMINI_NOT_CONFIGURED";
    throw error;
  }
  if (!client || clientKey !== process.env.GEMINI_API_KEY) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    clientKey = process.env.GEMINI_API_KEY;
  }
  return client;
}

export function describeGeminiError(error) {
  if (error?.code === "GEMINI_NOT_CONFIGURED") return "GEMINI_NOT_CONFIGURED";
  if (error?.name === "AbortError" || error?.code === "ENOTFOUND" || error?.code === "ECONNRESET" || error?.cause?.code === "ENOTFOUND") {
    return "GEMINI_NETWORK";
  }
  const status = error instanceof ApiError ? error.status : Number(error?.status);
  if (status === 400) return "GEMINI_BAD_REQUEST";
  if (status === 401 || status === 403) return "GEMINI_AUTH";
  if (status === 404) return "GEMINI_MODEL";
  if (status === 429) return "GEMINI_QUOTA";
  if (status === 503) return "GEMINI_BUSY";
  return "GEMINI_UNAVAILABLE";
}

function contentsFrom(history, message) {
  const contents = [];
  for (const item of history || []) {
    const text = String(item?.content || "").trim();
    if (!text) continue;
    const role = item.role === "assistant" ? "model" : "user";
    const previous = contents[contents.length - 1];
    if (previous?.role === role) previous.parts[0].text += `\n${text}`;
    else contents.push({ role, parts: [{ text }] });
  }
  while (contents.length && contents[0].role !== "user") contents.shift();
  const latest = String(message || "").trim();
  const previous = contents[contents.length - 1];
  if (previous?.role === "user") previous.parts[0].text += `\n${latest}`;
  else contents.push({ role: "user", parts: [{ text: latest }] });
  return contents;
}

function replacementModel(error, current) {
  if (error?.status !== 404) return "";
  const names = [...String(error?.message || "").matchAll(/models\/([a-z0-9.\-]+)/gi)].map((match) => match[1]);
  return names.find((name) => name !== current) || "";
}

const MODEL_FALLBACKS = ["gemini-3.5-flash-lite"];

async function generate(ai, model, contents, system) {
  return ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: system,
      temperature: 0.4,
      maxOutputTokens: 700,
      abortSignal: AbortSignal.timeout(20000),
    },
  });
}

export async function geminiChat({ language, system, history, message }) {
  if (process.env.GEMINI_ENABLED !== "true") {
    const error = new Error("Gemini is disabled.");
    error.code = "GEMINI_NOT_CONFIGURED";
    throw error;
  }
  const ai = getClient();
  const requested = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const languageName = language === "am" ? "Amharic" : language === "om" ? "Afaan Oromo" : "English";
  const instruction = `${system}\nAnswer only in ${languageName}. Do not translate the user's question into another language before answering.`;
  const contents = contentsFrom(history, message);
  const queue = [requested, ...MODEL_FALLBACKS];
  const tried = new Set();
  const retried = new Set();
  let lastError = null;
  while (queue.length) {
    const model = queue.shift();
    if (!model || tried.has(model)) continue;
    tried.add(model);
    try {
      const response = await generate(ai, model, contents, instruction);
      const text = String(response.text || "").trim();
      if (text) return { text, model };
      lastError = new Error("Gemini returned an empty answer");
      lastError.code = "GEMINI_EMPTY";
    } catch (error) {
      lastError = error;
      if ((error?.status === 503 || error?.status === 429) && !retried.has(model)) {
        retried.add(model);
        tried.delete(model);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        queue.unshift(model);
        continue;
      }
      const next = replacementModel(error, model);
      if (next) queue.unshift(next);
      if (error?.status === 429) break;
    }
  }
  try {
    throw lastError;
  } catch (error) {
    const wrapped = new Error("Gemini request failed");
    wrapped.code = describeGeminiError(error);
    throw wrapped;
  }
}
