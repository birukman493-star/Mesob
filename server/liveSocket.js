import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
import { GoogleGenAI } from "@google/genai";
import { query } from "./db.js";
import { requireComplete } from "./services/account.js";
import { buildChatContext } from "./services/chatContext.js";
import { SYSTEM_PROMPT } from "./services/aiClient.js";
import { hasabTranslate } from "./services/hasab.js";

const LIVE_MODEL = () => process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live";

function liveClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { apiVersion: "v1beta" },
  });
}

function safeError(error) {
  return String(error?.message || "Gemini Live could not start.")
    .replace(/key=[^&\s]+/gi, "key=redacted")
    .slice(0, 240);
}

function send(socket, payload) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(payload));
}

async function userFromToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const rows = await query(
    "SELECT id, role, full_name, age, language, category, support_mode, subscription_status FROM users WHERE id = ?",
    [payload.sub]
  );
  return rows[0] || null;
}

function instructionFor(context, lang) {
  const languagePrompt =
    lang === "am"
      ? "You MUST speak and respond ONLY in Amharic (አማርኛ). Pronounce all words, Ethiopian foods, and numbers naturally in Amharic. Never speak English."
      : lang === "om"
      ? "You MUST speak and respond ONLY in Afaan Oromo (Oromiffa). Pronounce all words, Ethiopian foods, and numbers naturally in Afaan Oromo. Never speak English or Amharic."
      : "You MUST speak and respond in clear, natural English.";

  return `${SYSTEM_PROMPT}

CRITICAL SPOKEN LANGUAGE REQUIREMENT:
${languagePrompt}
Keep each spoken reply concise, natural, and friendly (1 to 3 sentences suitable for continuous spoken conversation).
Use ONLY verified nutrition numbers and foods from the context below. Do not invent nutrition facts or portions.
If the user interrupts or asks a follow-up, respond directly to their new query.

Verified context JSON:
${JSON.stringify(context)}`;
}

export function attachLiveSocket(server) {
  const sockets = new WebSocketServer({ server, path: "/api/live" });
  sockets.on("connection", (socket, request) => {
    const url = new URL(request.url || "/api/live", "http://localhost");
    const token = url.searchParams.get("token") || "";
    const lang = ["en", "am", "om"].includes(url.searchParams.get("lang")) ? url.searchParams.get("lang") : "en";
    let session = null;
    let ready = false;
    let closed = false;
    let loggedMic = false;
    let loggedForward = false;
    let loggedModel = false;
    let loggedClient = false;
    const waiting = [];
    let userText = "";
    let modelText = "";

    function stop(message) {
      if (closed) return;
      closed = true;
      if (message) send(socket, { type: "error", message });
      try { session?.close(); } catch { /* The live socket may already be closed. */ }
      if (socket.readyState === socket.OPEN) socket.close();
    }

    function forward(base64) {
      if (!base64 || closed) return;
      if (!ready || !session) {
        waiting.push(base64);
        if (waiting.length > 120) waiting.shift();
        return;
      }
      session.sendRealtimeInput({
        audio: { data: base64, mimeType: "audio/pcm;rate=16000" },
      });
      if (!loggedForward) {
        loggedForward = true;
        console.log("[3] Audio forwarded to Gemini");
      }
    }

    async function saveTurn() {
      const spokenUser = userText.trim();
      const spokenModel = modelText.trim();
      userText = "";
      modelText = "";
      if (!socket.userId) return;
      if (spokenUser) {
        send(socket, { type: "transcript", role: "user", text: spokenUser, final: true });
        await query("INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'user', ?)", [socket.userId, spokenUser]).catch(() => {});
      }
      if (spokenModel) {
        send(socket, { type: "transcript", role: "assistant", text: spokenModel, final: true });
        await query("INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'assistant', ?)", [socket.userId, spokenModel]).catch(() => {});
        translateAside(spokenModel);
      }
    }

    function translateAside(text) {
      const english = /\b(the|and|you|for|with|can|eat|breakfast)\b/i.test(text);
      if (lang === "en" || !english || (lang === "am" && /[\u1200-\u137F]/.test(text))) return;
      hasabTranslate({ text, source: "en", target: lang })
        .then((translated) => {
          if (!closed && translated && translated !== text) {
            send(socket, { type: "translation", role: "assistant", text: translated });
          }
        })
        .catch((error) => {
          if (socket.hasabNoted || closed) return;
          socket.hasabNoted = true;
          console.log("[HASAB]", error.code || "failed");
          send(socket, {
            type: "hasab",
            ok: false,
            message: "Hasab translation is unavailable. Gemini voice continues.",
          });
        });
    }

    (async () => {
      try {
        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_ENABLED !== "true") {
          stop("Gemini Live is not configured.");
          return;
        }
        const user = await userFromToken(token);
        if (!user) {
          stop("Login required.");
          return;
        }
        const { profile, targets } = await requireComplete(user.id);
        socket.userId = user.id;
        const context = await buildChatContext(user, profile, targets, "");
        const ai = liveClient();
        session = await ai.live.connect({
          model: LIVE_MODEL(),
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: lang === "am" || lang === "om" ? "Aoede" : "Puck",
                },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: instructionFor(context, lang),
          },
          callbacks: {
            onopen: () => {},
            onmessage: (message) => {
              if (closed) return;
              if (message.setupComplete) {
                ready = true;
                console.log("[1] Gemini Live connection established");
                send(socket, { type: "ready", model: LIVE_MODEL() });
                for (const chunk of waiting.splice(0)) forward(chunk);
              }
              const content = message.serverContent;
              if (content?.interrupted) {
                send(socket, { type: "interrupted" });
              }
              if (content?.inputTranscription?.text) {
                userText += content.inputTranscription.text;
                send(socket, { type: "transcript", role: "user", text: userText, final: false });
              }
              if (content?.outputTranscription?.text) {
                modelText += content.outputTranscription.text;
                send(socket, { type: "transcript", role: "assistant", text: modelText, final: false });
              }
              // Handle audio delivered directly or inside modelTurn parts
              if (message.data) {
                if (!loggedModel) {
                  loggedModel = true;
                  console.log("[4] Gemini audio response received");
                }
                send(socket, { type: "audio", data: message.data });
                if (!loggedClient) {
                  loggedClient = true;
                  console.log("[5] Audio forwarded to frontend");
                }
              }
              const parts = content?.modelTurn?.parts || [];
              for (const part of parts) {
                if (part.inlineData?.data) {
                  if (!loggedModel) {
                    loggedModel = true;
                    console.log("[4] Gemini audio response received (parts)");
                  }
                  send(socket, { type: "audio", data: part.inlineData.data });
                  if (!loggedClient) {
                    loggedClient = true;
                    console.log("[5] Audio forwarded to frontend");
                  }
                }
                if (part.text && !content?.outputTranscription?.text) {
                  modelText += part.text;
                  send(socket, { type: "transcript", role: "assistant", text: modelText, final: false });
                }
              }
              if (content?.turnComplete) saveTurn().catch(() => {});
            },
            onerror: (event) => {
              if (closed) return;
              console.log("[LIVE] error", safeError(event?.error || event));
              stop("The live voice connection failed.");
            },
            onclose: (event) => {
              const reason = String(event?.reason || "").trim();
              console.log("[LIVE] closed", event?.code || "", reason.slice(0, 180));
              if (!closed) stop(reason || "The live voice connection closed.");
            },
          },
        });
        if (closed) {
          try { session.close(); } catch { /* The visitor already left. */ }
        }
      } catch (error) {
        console.log("[LIVE] setup failed", safeError(error));
        const expired = error?.name === "JsonWebTokenError" || error?.name === "TokenExpiredError";
        stop(error?.code === "PROFILE"
          ? "Complete your profile before using live voice."
          : expired || !token
            ? "Login required."
            : "Gemini Live could not start.");
      }
    })();

    socket.on("message", (data, isBinary) => {
      if (closed) return;
      if (isBinary) {
        if (!loggedMic) {
          loggedMic = true;
          console.log("[2] Microphone audio received");
        }
        forward(Buffer.from(data).toString("base64"));
        return;
      }
      let message;
      try { message = JSON.parse(data.toString()); } catch { return; }
      if (message.type === "audio" && message.data) {
        if (!loggedMic) {
          loggedMic = true;
          console.log("[2] Microphone audio received");
        }
        forward(message.data);
      }
      if (message.type === "stop") stop();
    });

    socket.on("close", () => stop());
    socket.on("error", () => stop());
  });
}
