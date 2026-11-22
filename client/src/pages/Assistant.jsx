import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client";
import LiveConversation, { createPlayback } from "../components/LiveConversation.jsx";
import VoiceButton, { primeSpeech, speakBrowser, stopBrowserSpeech, useVoiceCapture } from "../components/VoiceButton.jsx";
import { useI18n } from "../context/I18nContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const NOTICES = [
  "This is general information, not a diagnosis. Please consult a doctor or dietitian before changing your diet.",
  "If you have a medical condition, are pregnant, or this plan is for a child, ask a doctor before fasting.",
  "ይህ ምርመራ አይደለም። እባክዎ ሐኪም ወይም የአመጋገብ ባለሙያ ያማክሩ።",
  "Kun qorannoo miti. Maaloo doktora yookiin ogeessa nyaataa mariifadhaa.",
];

const PROMPTS = [
  { icon: "bi-circle", tone: "lime", text: "Can I eat injera if I have diabetes?", tags: ["you", "diabetes"] },
  { icon: "bi-egg-fried", tone: "sage", text: "What is a good dinner within my remaining calories?", tags: ["you", "plan"] },
  { icon: "bi-leaf", tone: "mint", text: "What are good fasting foods for Wednesday?", tags: ["you", "fasting"] },
  { icon: "bi-wallet2", tone: "blue", text: "What is a healthy lunch within my daily budget?", tags: ["you", "budget"] },
  { icon: "bi-activity", tone: "sage", text: "Which Ethiopian foods are lower in carbohydrate?", tags: ["diabetes"] },
  { icon: "bi-pie-chart", tone: "sage", text: "How should I split carbohydrates across meals?", tags: ["diabetes", "plan"] },
  { icon: "bi-cup-hot", tone: "mint", text: "Is shiro or misir wat listed with more protein?", tags: ["fasting", "you"] },
  { icon: "bi-basket", tone: "blue", text: "What can I cook with lentils?", tags: ["budget"] },
];

const LANGS = [
  { id: "en", title: "English", detail: "Text and voice" },
  { id: "am", title: "አማርኛ", detail: "Amharic · text and voice" },
  { id: "om", title: "Afaan Oromoo", detail: "Oromiffa · text and voice" },
];

function todayKey() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function clock(value) {
  const date = value ? new Date(String(value).replace(" ", "T")) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayBucket(value) {
  if (!value) return "Today";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "Today";
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const then = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((start - then) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return "Earlier";
}

function formatSeconds(total) {
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function splitNotice(content) {
  let body = content || "";
  const notes = [];
  for (const notice of NOTICES) {
    if (body.includes(notice)) {
      notes.push(notice);
      body = body.replace(notice, "").trim();
    }
  }
  return { body, notes };
}

function pairs(messages) {
  const items = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role !== "user") continue;
    const next = messages[index + 1];
    const answer = next?.role === "assistant" ? next : null;
    items.push({ question: message, answer, at: message.created_at });
    if (answer) index += 1;
  }
  return items;
}

function conditionChip(profile) {
  const list = profile?.conditions || [];
  const first = list.find(Boolean);
  if (!first) return "";
  return String(first).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function Assistant() {
  const { lang, setLang } = useI18n();
  const { me, refresh } = useAuth();
  const [params] = useSearchParams();
  const voice = useVoiceCapture(lang);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState(params.get("q") || "");
  const [draft, setDraft] = useState("");
  const [screen, setScreen] = useState("home");
  const [sheet, setSheet] = useState("");
  const [pendingLang, setPendingLang] = useState(lang);
  const [filter, setFilter] = useState("you");
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState("");
  const [retryText, setRetryText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [voiceOn, setVoiceOn] = useState(() => {
    try { return localStorage.getItem("mesob_voice_muted") !== "1"; }
    catch { return true; }
  });
  const [speaking, setSpeaking] = useState(false);
  const [speakingKey, setSpeakingKey] = useState("");
  const [kcalLeft, setKcalLeft] = useState(null);
  const [dietitian, setDietitian] = useState(null);
  const [ingredients, setIngredients] = useState("");
  const [budget, setBudget] = useState(me?.profile?.budget_per_day || 80);
  const [mealType, setMealType] = useState("lunch");
  const [dishes, setDishes] = useState([]);
  const inputRef = useRef(null);
  const asked = useRef(false);
  const logRef = useRef(null);
  const speakGen = useRef(0);
  const liveMedia = useRef(null);
  const replyAudio = useRef(null);

  const nameParts = (me?.user?.full_name || "").split(" ").filter(Boolean);
  const firstName = (nameParts[0]?.toLowerCase() === "selam" && nameParts[1]) ? nameParts[1] : (nameParts[0] || "there");
  const profile = me?.profile;
  const condition = conditionChip(profile);
  const fastingLabel = profile?.ramadan_mode ? "Ramadan" : profile?.orthodox_fasting ? "Fasting Wed & Fri" : "";
  const history = useMemo(() => pairs(messages), [messages]);
  const last = history[history.length - 1];

  useEffect(() => {
    api.get("/chat").then((res) => setMessages(res.data.messages || [])).catch(() => { });
    api.get("/logs", { params: { date: todayKey() } })
      .then((res) => {
        const goal = Number(res.data.targets?.kcal);
        const eaten = Number(res.data.totals?.kcal || 0);
        if (Number.isFinite(goal)) setKcalLeft(Math.max(0, Math.round(goal - eaten)));
      })
      .catch(() => { });
    api.get("/consult/dietitians").then((res) => setDietitian(res.data.dietitians?.[0] || null)).catch(() => { });
  }, []);

  useEffect(() => {
    if (!busy) return undefined;
    setStep(0);
    const timer = setInterval(() => setStep((value) => Math.min(value + 1, 2)), 700);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, screen]);

  useEffect(() => () => {
    voice.cancel();
    stopBrowserSpeech();
  }, []);

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return undefined;
    const mark = () => synth.getVoices();
    synth.addEventListener("voiceschanged", mark);
    primeSpeech();
    mark();
    return () => synth.removeEventListener("voiceschanged", mark);
  }, []);

  useEffect(() => {
    const starter = params.get("q");
    if (starter && !asked.current) {
      asked.current = true;
      ask(starter);
    }
  }, [params]);

  function stopAudio() {
    speakGen.current += 1;
    stopBrowserSpeech();
    replyAudio.current?.stop?.();
    replyAudio.current?.context?.close().catch(() => { });
    replyAudio.current = null;
    setSpeaking(false);
    setSpeakingKey("");
  }

  function prepareReplyAudio() {
    const context = new AudioContext();
    context.resume().catch(() => { });
    replyAudio.current = { context, stop: () => { } };
    return context;
  }

  async function playGeminiVoice(reply) {
    try {
      const context = replyAudio.current?.context?.state === "closed" || !replyAudio.current?.context
        ? prepareReplyAudio()
        : replyAudio.current.context;
      if (context.state === "suspended") await context.resume();
      const { data } = await api.post("/voice/speak", { text: reply, language: lang });
      const playback = createPlayback(context);
      replyAudio.current = { context, stop: () => playback.flush() };
      if (!playback.push(data.audio_base64)) return { ok: false, reason: "blocked" };
      const seconds = Math.min(60, (atob(data.audio_base64).length / 2 / 24000) + 0.4);
      await new Promise((resolve) => {
        const timer = window.setTimeout(resolve, seconds * 1000);
        const previous = replyAudio.current?.stop;
        replyAudio.current.stop = () => {
          window.clearTimeout(timer);
          playback.flush();
          previous?.();
          resolve();
        };
      });
      return { ok: true, reason: "end" };
    } catch (err) {
      return { ok: false, reason: err.response?.data?.error?.code || "unavailable" };
    }
  }

  function toggleVoice() {
    const next = !voiceOn;
    try { localStorage.setItem("mesob_voice_muted", next ? "0" : "1"); } catch { /* This visit still keeps the choice. */ }
    if (!next) stopAudio();
    setVoiceOn(next);
  }

  async function playReply(reply, key, isManual = false) {
    const spoken = String(reply || "").trim();
    if (!spoken) return { ok: false, reason: "empty" };
    const gen = ++speakGen.current;
    primeSpeech();
    setSpeaking(true);
    setSpeakingKey(key);
    const geminiVoice = lang === "am" || lang === "om";
    let result;
    try {
      if (geminiVoice) {
        result = await playGeminiVoice(spoken);
        if (!result.ok) {
          const browserRes = await speakBrowser(spoken, lang);
          if (browserRes.ok) result = browserRes;
        }
      } else {
        result = await speakBrowser(spoken, lang);
        if (!result.ok && (result.reason === "no-voice" || result.reason === "unsupported")) {
          const spokenByGemini = await playGeminiVoice(spoken);
          if (spokenByGemini.ok) result = spokenByGemini;
        }
      }
    } catch {
      result = { ok: false, reason: "blocked" };
    }
    if (gen !== speakGen.current) return result;
    setSpeaking(false);
    if (!result.ok && result.reason !== "stopped") {
      const voiceNote =
        lang === "om"
          ? "Sagaleen deebii kana dubbisuu hin dandeenye. Barreeffama isaa dubbisuu dandeessu."
          : lang === "am"
            ? "መልሱን በድምፅ ማሰማት አልተቻለም። ጽሑፉን ማንበብ ይችላሉ።"
            : "The answer could not be spoken. You can still read the text response.";
      setNote(voiceNote);
    }
    return result;
  }

  function speakMessage(message, index, replay) {
    const key = message.localId || `i-${index}`;
    if (!replay && speaking && speakingKey === key) return;
    if (lang === "am" || lang === "om") prepareReplyAudio();
    else primeSpeech();
    playReply(message.content, key, true);
  }

  useEffect(() => {
    if (screen === "live") return undefined;
    const media = liveMedia.current;
    if (!media) return undefined;
    liveMedia.current = null;
    media.stream.getTracks().forEach((track) => track.stop());
    media.context.close().catch(() => { });
    return undefined;
  }, [screen]);

  async function openLive() {
    stopAudio();
    try {
      const context = new AudioContext();
      await context.resume();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      liveMedia.current = { context, stream };
      setScreen("live");
    } catch {
      setNote("Microphone permission was denied. Type your question instead.");
    }
  }

  async function ask(message) {
    const content = (message ?? text).trim();
    if (!content || busy) return;
    stopAudio();
    if (voiceOn) {
      primeSpeech();
      if (lang === "am" || lang === "om") prepareReplyAudio();
    }
    setScreen("chat");
    setSheet("");
    setMenu(false);
    setBusy(true);
    setError("");
    setNote("Generating response...");
    setRetryText(content);
    setMessages((current) => {
      const last = current[current.length - 1];
      if (last?.role === "user" && last.content === content) return current;
      return [...current, { role: "user", content, created_at: new Date().toISOString() }];
    });
    try {
      const { data } = await api.post("/chat", { message: content, language: lang });
      const reply = String(data.reply || "").trim();
      const localId = `a-${Date.now()}`;
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.reply || "",
          created_at: new Date().toISOString(),
          cited: data.numbers?.cited || [],
          warning: data.warning,
          localId,
        },
      ]);
      if (!reply) {
        setNote(lang === "om" ? "Gargaaraan deebii duwwaa kenne." : lang === "am" ? "ረዳቱ ምንም መልስ አልሰጠም።" : "The assistant returned an empty answer.");

        setNote("");
      }
      setText("");
      setRetryText(data.fallback ? content : "");
      if (reply && voiceOn) await playReply(reply, localId);
    } catch (err) {
      setError(err.userMessage || "The assistant could not answer. Try again.");
      setNote("AI service temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function clearChat() {
    stopAudio();
    await api.delete("/chat").catch(() => { });
    setMessages([]);
    setScreen("home");
    setMenu(false);
  }

  async function applyLanguage() {
    stopAudio();
    setLang(pendingLang);
    if (me?.user) {
      await api.put("/me/language", { language: pendingLang }).catch(() => { });
      refresh().catch(() => { });
    }
    setSheet("");
  }

  async function beginVoice(nextLang = lang) {
    setSheet("");
    setNote("Listening...");
    const result = await voice.start((spoken, code) => {
      setText(spoken || "");
      setScreen(messages.length ? "chat" : "home");
      if (code === "not-allowed" || code === "denied") {
        setSheet("mic");
        setNote("Microphone permission denied.");
      } else if (code === "language-not-supported") {
        setNote("This browser cannot recognize the selected language. Type your question.");
      } else if (!spoken) {
        setNote("No speech was recognized. Type your question.");
      } else {
        setNote("Speech recognized. Edit it, then press Send.");
      }
    }, (partial) => partial && setText(partial));
    if (result === "ok") setScreen("listen");
    if (result === "denied") {
      setSheet("mic");
      setNote("Microphone permission denied.");
    }
    if (result === "unsupported") {
      setScreen(messages.length ? "chat" : "home");
      setNote("This browser cannot record audio. Type your question.");
    }
  }

  async function suggest(event) {
    event.preventDefault();
    const { data } = await api.post("/recipes/suggest", {
      ingredients: ingredients.split(",").map((item) => item.trim()).filter(Boolean),
      budget: Number(budget),
      meal_type: mealType,
    });
    setDishes(data.dishes || []);
  }

  const rememberLive = useCallback((role, text) => {
    setMessages((current) => [
      ...current,
      {
        role: role === "assistant" ? "assistant" : "user",
        content: text,
        created_at: new Date().toISOString(),
        localId: `live-${Date.now()}-${role}`,
      },
    ]);
  }, []);

  const visiblePrompts = PROMPTS.filter((item) => {
    const matchesFilter = filter === "you" || item.tags.includes(filter);
    const matchesQuery = item.text.toLowerCase().includes(query.trim().toLowerCase());
    return matchesFilter && matchesQuery;
  });
  const homePrompts = PROMPTS.filter((item) => item.tags.includes("you")).slice(0, 4);
  const followUps = PROMPTS.filter((item) => item.text !== last?.question?.content).slice(0, 3);

  return (
    <section className="assistant-page">
      {screen === "listen" && (
        <Listening
          lang={lang}
          seconds={voice.seconds}
          paused={voice.paused}
          onClose={() => { voice.cancel(); setScreen(messages.length ? "chat" : "home"); }}
          onType={() => { voice.cancel(); setScreen(messages.length ? "chat" : "home"); inputRef.current?.focus(); }}
          onStop={voice.stop}
          onPause={voice.togglePause}
          onLanguage={() => { setPendingLang(lang); setSheet("language"); }}
        />
      )}

      {screen === "review" && (
        <Review
          lang={lang}
          draft={draft}
          busy={voice.busy}
          onChange={setDraft}
          onCancel={() => { setDraft(""); setScreen(messages.length ? "chat" : "home"); }}
          onSend={() => ask(draft)}
          onRedo={() => beginVoice(lang)}
        />
      )}

      {screen === "history" && (
        <History
          items={history}
          onBack={() => setScreen(messages.length ? "chat" : "home")}
          onNew={clearChat}
          onOpen={() => setScreen("chat")}
        />
      )}

      {screen === "live" && (
        <LiveConversation
          lang={lang}
          audioContext={liveMedia.current?.context}
          stream={liveMedia.current?.stream}
          onClose={() => { stopAudio(); setScreen(messages.length ? "chat" : "home"); }}
          onTranscript={rememberLive}
        />
      )}

      {screen !== "listen" && screen !== "review" && screen !== "history" && screen !== "live" && (
        <>
          <header className="assistant-top">
            {screen === "chat" ? (
              <button type="button" className="icon-btn" onClick={() => setScreen("home")} aria-label="Back to assistant home">
                <i className="bi bi-arrow-left" />
              </button>
            ) : (
              <div>
                <h1>AI Assistant</h1>
                <p>Rule-based + AI · cites Mesob data</p>
              </div>
            )}
            {screen === "chat" && (
              <div className="assistant-title">
                <img src="/mesob-logo.png" alt="" />
                <div>
                  <strong>Mesob Assistant</strong>
                  <span>{busy ? "Thinking…" : speaking ? "Speaking…" : "Online"}</span>
                </div>
              </div>
            )}
            <div className="assistant-top-actions">
              <button
                type="button"
                className="icon-btn"
                aria-pressed={voiceOn}
                aria-label={voiceOn ? "Mute spoken answers" : "Unmute spoken answers"}
                onClick={toggleVoice}
              >
                <i className={`bi ${voiceOn ? "bi-volume-up" : "bi-volume-mute"}`} />
              </button>
              <button type="button" className="lang-pill" onClick={openLive}>
                <i className="bi bi-broadcast" /> Live
              </button>
              <button type="button" className="lang-pill" onClick={() => { setPendingLang(lang); setSheet("language"); }}>
                <i className="bi bi-translate" /> {lang === "am" ? "አማ" : lang.toUpperCase()}
              </button>
              {screen === "home" && (
                <button type="button" className="icon-btn" onClick={() => setScreen("history")} aria-label="Chat history">
                  <i className="bi bi-clock" />
                </button>
              )}
              {screen === "chat" && (
                <button type="button" className="icon-btn" onClick={() => setMenu((open) => !open)} aria-label="More">
                  <i className="bi bi-three-dots" />
                </button>
              )}
            </div>
            {menu && (
              <div className="assistant-menu">
                <button type="button" onClick={clearChat}>Clear conversation</button>
              </div>
            )}
          </header>

          {screen === "home" && (
            <div className="assistant-home">
              <div className="assistant-mark" aria-hidden="true"><img src="/mesob-logo.png" alt="" /></div>
              <h2>Selam, {firstName}</h2>
              <p>Ask me about Ethiopian foods, your meal plan or your health goals.</p>
              <div className="assistant-chips">
                {condition && <span className="chip sage"><i className="bi bi-heart-pulse" /> {condition}</span>}
                {kcalLeft != null && <span className="chip lilac"><i className="bi bi-lightning-charge" /> {kcalLeft} kcal left</span>}
                {fastingLabel && <span className="chip sand"><i className="bi bi-moon" /> {fastingLabel}</span>}
              </div>
              <div className="assistant-section-head">
                <h3>Try asking</h3>
                <button type="button" onClick={() => setSheet("questions")}>More</button>
              </div>
              <div className="suggest-grid">
                {homePrompts.map((item) => (
                  <button key={item.text} type="button" className="suggest-card" onClick={() => ask(item.text)}>
                    <i className={`bi ${item.icon} tone-${item.tone}`} />
                    {item.text}
                  </button>
                ))}
              </div>
              {last && (
                <button type="button" className="continue-card" onClick={() => setScreen("chat")}>
                  <i className="bi bi-chat-left-text" />
                  <span>
                    <strong>Continue: {last.question.content}</strong>
                    <small>{dayBucket(last.at)} · {messages.length} messages</small>
                  </span>
                  <i className="bi bi-chevron-right" />
                </button>
              )}
              <p className="assistant-disclaimer"><i className="bi bi-shield" /> General guidance, not a diagnosis · always check with your doctor</p>
            </div>
          )}

          {screen === "chat" && (
            <div className="assistant-thread" ref={logRef}>
              {messages.length > 0 && <p className="day-pill">Today · {clock(messages[0].created_at)}</p>}
              {messages.map((message, index) => (
                <Message
                  key={message.localId || `${message.role}-${index}`}
                  message={message}
                  speaking={speaking && speakingKey === (message.localId || `i-${index}`)}
                  onPlay={() => speakMessage(message, index, false)}
                  onReplay={() => speakMessage(message, index, true)}
                  onStop={stopAudio}
                  dietitian={dietitian}
                  condition={condition}
                />
              ))}
              {busy && <Thinking step={step} />}
              {!busy && followUps.length > 0 && messages.some((item) => item.role === "assistant") && (
                <div className="follow-row">
                  {followUps.map((item) => (
                    <button key={item.text} type="button" onClick={() => ask(item.text)}>{item.text}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {lang !== "en" && <p className="voice-beta"><i className="bi bi-mic" /> {lang === "am" ? "አማርኛ" : "Afaan Oromoo"} · text and Live voice</p>}
          {note && <p className="assistant-note" role="status">{note} {!busy && retryText && <button type="button" className="btn btn-sm btn-ghost" onClick={() => ask(retryText)}>Retry</button>}</p>}
          {error && <p className="text-danger" role="alert">{error} <button type="button" className="btn btn-sm btn-ghost" onClick={() => ask(retryText)}>Retry</button></p>}

          <form className="composer" onSubmit={(event) => { event.preventDefault(); ask(text); }}>
            <button type="button" className="icon-btn" onClick={() => setSheet("ingredients")} aria-label="Ingredients and budget">
              <i className="bi bi-plus-lg" />
            </button>
            <input
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={busy ? "Mesob is answering…" : "Ask about food or health..."}
              disabled={busy}
              aria-label="Message"
            />
            {text.trim() ? (
              <button type="submit" className="send-btn" disabled={busy} aria-label="Send"><i className="bi bi-arrow-up" /></button>
            ) : (
              <button type="button" className="send-btn" onClick={() => beginVoice(lang)} disabled={busy || voice.busy} aria-label="Microphone">
                <i className="bi bi-mic" />
              </button>
            )}
          </form>
        </>
      )}

      {sheet === "questions" && (
        <Sheet title="Suggested questions" onClose={() => setSheet("")}>
          <label className="search-line">
            <i className="bi bi-search" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search questions" />
          </label>
          <div className="filter-row">
            {[
              ["you", "For you"],
              ["diabetes", "Diabetes"],
              ["fasting", "Fasting"],
              ["plan", "Meal plan"],
              ["budget", "Budget"],
            ].map(([id, label]) => (
              <button key={id} type="button" className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
          <p className="group-label">Based on your profile {condition && <span>{condition}</span>}</p>
          <div className="question-list">
            {visiblePrompts.map((item) => (
              <button key={item.text} type="button" onClick={() => ask(item.text)}>
                <i className={`bi ${item.icon} tone-${item.tone}`} />
                <span>{item.text}</span>
                <i className="bi bi-arrow-up-right" />
              </button>
            ))}
            {visiblePrompts.length === 0 && <p className="fine">No questions match that search.</p>}
          </div>
        </Sheet>
      )}

      {sheet === "language" && (
        <Sheet title="Assistant language" subtitle="Answers and voice input will use this language." onClose={() => setSheet("")}>
          <div className="lang-list">
            {LANGS.map((item) => (
              <button key={item.id} type="button" className={pendingLang === item.id ? "on" : ""} onClick={() => setPendingLang(item.id)}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </span>
                <em><i className="bi bi-volume-up" /> Text and voice</em>
                <i className={pendingLang === item.id ? "bi bi-record-circle" : "bi bi-circle"} />
              </button>
            ))}
          </div>
          <p className="info-box"><i className="bi bi-info-circle" /> English, Amharic, and Afaan Oromoo (Oromiffa) are available for typed answers and Live voice.</p>
          <button type="button" className="btn btn-primary w-100" onClick={applyLanguage}>Apply</button>
        </Sheet>
      )}

      {sheet === "voice-fallback" && (
        <div className="assistant-sheet" role="dialog" aria-label="Voice unavailable">
          <button type="button" className="sheet-close" onClick={() => setSheet("")} aria-label="Close"><i className="bi bi-x-lg" /></button>
          <article className="fallback-card">
            <i className="bi bi-mic-mute" />
            <div>
              <strong>Live voice uses the language you selected</strong>
              <p>English, Amharic, and Afaan Oromoo (Oromiffa) can be spoken with Live. Typed answers stay in that same language.</p>
            </div>
            <div className="fallback-actions">
              <button type="button" className="on" onClick={() => { setSheet(""); inputRef.current?.focus(); }}><i className="bi bi-keyboard" /> Typing</button>
              <button type="button" onClick={() => { setSheet(""); openLive(); }}><i className="bi bi-mic" /> Use Live voice</button>
            </div>
          </article>
        </div>
      )}

      {sheet === "mic" && (
        <div className="assistant-modal-back" role="dialog" aria-labelledby="mic-title">
          <article className="assistant-modal">
            <div className="deny-mark"><i className="bi bi-mic-mute" /></div>
            <h2 id="mic-title">Microphone access denied</h2>
            <p>To ask by voice, allow Mesob AI to use the microphone. You can still type any question.</p>
            <ol>
              <li>Click the lock icon in the address bar</li>
              <li>Microphone → Allow, then try the mic again</li>
            </ol>
            <button type="button" className="btn btn-primary w-100" onClick={() => { setSheet(""); inputRef.current?.focus(); }}>
              <i className="bi bi-keyboard" /> Type instead
            </button>
          </article>
        </div>
      )}

      {sheet === "ingredients" && (
        <Sheet title="Ingredients and budget" subtitle="Suggestions use foods already in the Mesob database." onClose={() => setSheet("")}>
          <form onSubmit={suggest}>
            <label className="form-label" htmlFor="ings">Ingredients you have</label>
            <input id="ings" className="form-control" value={ingredients} onChange={(event) => setIngredients(event.target.value)} placeholder="lentils, onion" />
            <VoiceButton lang={lang} onText={(spoken) => spoken && setIngredients(spoken)} onNote={setNote} />
            <div className="row g-2 mt-2">
              <div className="col-6">
                <label className="form-label" htmlFor="birr">Budget (birr)</label>
                <input id="birr" className="form-control" type="number" value={budget} onChange={(event) => setBudget(event.target.value)} />
              </div>
              <div className="col-6">
                <label className="form-label" htmlFor="slot">Meal</label>
                <select id="slot" className="form-select" value={mealType} onChange={(event) => setMealType(event.target.value)}>
                  {["breakfast", "lunch", "snack", "dinner", "suhoor", "iftar"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
            </div>
            <button className="btn btn-primary mt-3">Suggest dishes</button>
          </form>
          <div className="question-list mt-3">
            {dishes.map((dish) => (
              <article key={dish.food_id} className="dish-row">
                <strong>{dish.name_en}</strong>
                <p>{dish.kcal} kcal · {dish.cost_birr} birr · missing {dish.missing_cost} birr</p>
                <p className="fine">Have: {dish.have.join(", ") || "—"}. Missing: {dish.missing.join(", ") || "—"}.</p>
              </article>
            ))}
          </div>
        </Sheet>
      )}
    </section>
  );
}

function Message({ message, speaking, onPlay, onReplay, onStop, dietitian, condition }) {
  if (message.role === "user") {
    return (
      <div className="bubble user">
        <p>{message.content}</p>
        <time>{clock(message.created_at)}</time>
      </div>
    );
  }
  const { body, notes } = splitNotice(message.content);
  const cited = (message.cited || []).filter((food) => body.toLowerCase().includes(String(food.name).toLowerCase()));
  const food = cited[0];
  const fastingNotice = "If you have a medical condition, are pregnant, or this plan is for a child, ask a doctor before fasting.";
  const fasting = notes.includes(fastingNotice) || /\bfasting\b/i.test(body);
  const doctorNotes = notes.filter((notice) => notice !== fastingNotice);
  return (
    <article className="assistant-answer">
      <img src="/mesob-logo.png" alt="" />
      <div>
        <div className="bubble assistant">
          {fasting && (
            <div className="safety-card">
              <strong><i className="bi bi-shield-exclamation" /> Health safety notice</strong>
              <p>{condition ? `${fastingNotice} This profile includes ${condition.toLowerCase()}.` : fastingNotice}</p>
            </div>
          )}
          <p>{body}</p>
          {food && (
            <>
              <p className="portion-line">1 {food.portion_unit} · {food.name}</p>
              <div className="nutri-row">
                <div><strong>{food.kcal}</strong><span>kcal</span></div>
                <div><strong>{food.carbs_g} g</strong><span>carbs</span></div>
                <div><strong>{food.protein_g} g</strong><span>protein</span></div>
              </div>
            </>
          )}
          {cited.length > 1 && (
            <ul className="cited-list">
              {cited.slice(1, 4).map((item) => (
                <li key={item.name}><span>{item.name}<small>1 {item.portion_unit}</small></span><span>{item.kcal} kcal<small>{item.carbs_g} g carbs</small></span></li>
              ))}
            </ul>
          )}
          <span className="source-pill"><i className="bi bi-journal-check" /> Based on Mesob food database</span>
          {doctorNotes.map((notice) => (
            <p key={notice} className="doctor-note"><i className="bi bi-heart-pulse" /> {notice}</p>
          ))}
          {dietitian && fasting && (
            <Link className="dietitian-row" to="/consult">
              <i className="bi bi-person-circle" />
              <span><strong>{dietitian.full_name}</strong><small>Dietitian · replies when they accept</small></span>
              <em>Ask</em>
            </Link>
          )}
        </div>
        <div className="answer-tools">
          <button type="button" className="icon-only" onClick={() => navigator.clipboard?.writeText(message.content)} aria-label="Copy"><i className="bi bi-copy" /></button>
          {speaking ? (
            <button type="button" onClick={onStop} aria-label="Stop speaking"><i className="bi bi-stop-fill" /> Stop</button>
          ) : (
            <button type="button" onClick={onPlay} aria-label="Play answer"><i className="bi bi-volume-up" /> Play</button>
          )}
          <button type="button" onClick={onReplay} aria-label="Replay answer"><i className="bi bi-arrow-clockwise" /> Replay</button>
          {speaking && <span className="speaking-pill" role="status"><i /> Speaking</span>}
          <time>{clock(message.created_at)}</time>
        </div>
      </div>
    </article>
  );
}

function Thinking({ step }) {
  const lines = ["Understood your question", "Checking the Mesob food database", "Applying your profile rules…"];
  return (
    <article className="assistant-answer">
      <img src="/mesob-logo.png" alt="" />
      <div className="bubble assistant thinking">
        <span className="dots" aria-hidden="true"><i /><i /><i /></span>
        {lines.map((line, index) => (
          <p key={line} className={index <= step ? "done" : ""}>
            <i className={`bi ${index < step ? "bi-check-circle-fill" : index === step ? "bi-arrow-repeat" : "bi-circle"}`} /> {line}
          </p>
        ))}
      </div>
    </article>
  );
}

function Listening({ lang, seconds, paused, onClose, onType, onStop, onPause, onLanguage }) {
  const label = lang === "am" ? "አማርኛ" : lang === "om" ? "Afaan Oromoo" : "English (US)";
  return (
    <div className="listen-screen">
      <header>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><i className="bi bi-x-lg" /></button>
        <button type="button" className="lang-pill" onClick={onLanguage}><i className="bi bi-translate" /> {label} <em>Voice</em></button>
        <span />
      </header>
      <div className="listen-body">
        <h2>{paused ? "Paused" : "Listening…"}</h2>
        <p>Ask your question out loud. I’ll answer using the Mesob food database.</p>
        <div className="listen-orb" aria-hidden="true"><i className="bi bi-mic" /></div>
        <div className="wave" aria-hidden="true">{Array.from({ length: 28 }, (_, index) => <span key={index} style={{ animationDelay: `${index * 0.05}s` }} />)}</div>
        <time>{formatSeconds(seconds)}</time>
      </div>
      <p className="try-line"><i className="bi bi-lightbulb" /> Try: “Can I eat injera if I have diabetes?”</p>
      <div className="listen-actions">
        <button type="button" onClick={onType}><i className="bi bi-keyboard" />Type</button>
        <button type="button" className="stop" onClick={onStop}><i className="bi bi-stop-fill" />Stop</button>
        <button type="button" onClick={onPause}><i className={`bi ${paused ? "bi-play" : "bi-pause"}`} />{paused ? "Resume" : "Pause"}</button>
      </div>
    </div>
  );
}

function Review({ lang, draft, busy, onChange, onCancel, onSend, onRedo }) {
  const label = lang === "am" ? "አማርኛ" : lang === "om" ? "Afaan Oromoo" : "English (US)";
  return (
    <div className="listen-screen review">
      <header>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="Close"><i className="bi bi-x-lg" /></button>
        <span className="lang-pill"><i className="bi bi-translate" /> {label} <em>Voice</em></span>
        <span />
      </header>
      <p className="recognizing"><i /> {busy ? "Transcribing speech" : "Recognized speech"} · {label}</p>
      <textarea value={draft} onChange={(event) => onChange(event.target.value)} aria-label="Recognized text" placeholder="Tap to type what you said" />
      <p className="edit-hint"><i className="bi bi-pencil" /> Tap words to edit</p>
      <div className="lookup-box">
        <span>I’ll look up</span>
        <div>
          <em><i className="bi bi-circle" /> Your foods</em>
          <em><i className="bi bi-heart-pulse" /> Your profile rules</em>
          <em><i className="bi bi-person" /> Your targets</em>
        </div>
      </div>
      <div className="listen-actions">
        <button type="button" onClick={onCancel}><i className="bi bi-x-lg" />Cancel</button>
        <button type="button" className="send" onClick={onSend} disabled={busy || !draft.trim()}><i className="bi bi-arrow-up" />Send</button>
        <button type="button" onClick={onRedo}><i className="bi bi-arrow-clockwise" />Redo</button>
      </div>
    </div>
  );
}

function History({ items, onBack, onNew, onOpen }) {
  const groups = ["Today", "Yesterday", "Earlier"].map((label) => ({
    label,
    items: items.filter((item) => dayBucket(item.at) === label).reverse(),
  })).filter((group) => group.items.length);
  return (
    <div className="history-screen">
      <header className="assistant-top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back"><i className="bi bi-arrow-left" /></button>
        <h1>Chat history</h1>
        <span />
      </header>
      <button type="button" className="new-chat" onClick={onNew}><i className="bi bi-plus-square" /> New chat</button>
      {groups.length === 0 && <p className="fine">Nothing here yet. Ask a question to start a chat.</p>}
      {groups.map((group) => (
        <section key={group.label}>
          <p className="group-label">{group.label}</p>
          {group.items.map((item) => (
            <button type="button" key={`${item.question.content}-${item.at}`} className="history-row" onClick={onOpen}>
              <i className="bi bi-chat-left-text" />
              <span>
                <strong>{item.question.content}</strong>
                <small>{item.answer ? splitNotice(item.answer.content).body : "Waiting for an answer"}</small>
              </span>
              <time>{clock(item.at)}</time>
            </button>
          ))}
        </section>
      ))}
      <p className="assistant-disclaimer"><i className="bi bi-lock" /> Chats are private to your account</p>
    </div>
  );
}

function Sheet({ title, subtitle, onClose, children }) {
  return (
    <div className="assistant-sheet" role="dialog" aria-label={title}>
      <button type="button" className="sheet-close" onClick={onClose} aria-label="Close"><i className="bi bi-x-lg" /></button>
      <h2>{title}</h2>
      {subtitle && <p className="fine">{subtitle}</p>}
      {children}
    </div>
  );
}
