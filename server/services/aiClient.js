import { fallbackReply } from "./chatFallback.js";
import { geminiChat, geminiConfigured } from "./geminiService.js";

export const SYSTEM_PROMPT = `You are Mesob, a nutrition assistant for Ethiopian meals.
Answer general nutrition questions in simple, natural language, including Ethiopian foods, protein, carbohydrates, fats, vitamins, minerals, diabetes-friendly eating, pregnancy, and children.
Answer the user's question in natural conversation. Use earlier messages only to understand follow-up questions.
Use ONLY numbers, foods, targets, and remaining amounts from the verified context. Never invent calories, protein, carbohydrate, fat, sodium, prices, or portion math.
If a number is not in the verified context, say it is not in the food database.
Do not diagnose, prescribe, or tell a pregnant user or a child to eat less than their saved target.
Never suggest a food that matches an allergy in the context.
Respect diabetes, hypertension, fasting, and age limits already reflected in the context.
For a health condition, pregnancy, or a child, end with the notice from the context.`;

function languageLine(lang) {
  if (lang === "am") return "Write the whole answer in Amharic (አማርኛ), including any safety notice. Do not answer in English.";
  if (lang === "om") return "Write the whole answer in Afaan Oromo (Oromiffa), including any safety notice. Do not answer in English.";
  return "Write the whole answer in English.";
}

function promptFor(context, lang) {
  return `${SYSTEM_PROMPT}\n${languageLine(lang)}\nVerified context JSON:\n${JSON.stringify(context)}`;
}

const NOTICES = {
  en: "This is general information, not a diagnosis. Please consult a doctor or dietitian before changing your diet.",
  am: "ይህ ምርመራ አይደለም። እባክዎ ሐኪም ወይም የአመጋገብ ባለሙያ ያማክሩ።",
  om: "Kun qorannoo miti. Maaloo doktora yookiin ogeessa nyaataa mariifadhaa.",
};

function withNotice(reply, context, lang = "en") {
  if (!reply) return reply;
  const sensitive =
    ["patient", "pregnancy", "children"].includes(context.category) ||
    (context.conditions || []).length > 0;
  const notice = NOTICES[lang] || NOTICES.en;
  if (sensitive && !reply.includes(notice)) return `${reply.trim()} ${notice}`;
  return reply.trim();
}

function done(reply, context, provider, warning, providersTried, lang) {
  const text = withNotice(reply, context, lang);
  return {
    reply: text,
    source: provider,
    provider,
    warning: warning || null,
    providers_tried: providersTried,
    fallback: provider === "rules",
    success: Boolean(text),
  };
}

export async function answerQuestion({ mode, context, message, lang, history = [] }) {
  const providersTried = [];
  let warning = null;

  if (geminiConfigured()) {
    providersTried.push("gemini");
    console.log("[AI] Trying Gemini", lang);
    try {
      const generated = await geminiChat({
        language: lang,
        system: promptFor(context, lang),
        history,
        message,
      });
      if (generated.text) {
        console.log("[AI] Gemini response received", generated.model);
        return { ...done(generated.text, context, "gemini", null, providersTried, lang), model: generated.model };
      }
      warning = warning || "GEMINI_EMPTY";
      console.log("[AI] Gemini returned empty text");
    } catch (error) {
      warning = error.code || "GEMINI_UNAVAILABLE";
      console.log("[AI] Gemini failed", warning);
    }
  } else if (process.env.GEMINI_ENABLED === "true") {
    warning = "GEMINI_NOT_CONFIGURED";
  }

  if (mode === "llm" && process.env.AI_SERVICE_URL) {
    providersTried.push("local");
    try {
      const response = await fetch(`${process.env.AI_SERVICE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context, lang, history }),
        signal: AbortSignal.timeout(12000),
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.reply) return done(data.reply, context, "local", warning, providersTried, lang);
      }
    } catch {
      warning = warning || "LOCAL_UNAVAILABLE";
    }
  }

  return done(fallbackReply(message, context, lang), context, "rules", warning, providersTried, lang);
}
