import { useRef, useState } from "react";

const LANG = { en: "en-US", am: "am-ET", om: "om-ET" };

export const NO_VOICE_NOTE = "Voice output is not available for this language on this device. You can still read the text response.";

let generation = 0;
let heldUtterance = null;
let unlockUtterance = null;
let pollTimer = null;
let tabWatch = false;

function recognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function engine() {
  return typeof window !== "undefined" ? window.speechSynthesis : null;
}

function clearPoll() {
  clearInterval(pollTimer);
  pollTimer = null;
}

function watchTab() {
  if (tabWatch || typeof document === "undefined") return;
  tabWatch = true;
  document.addEventListener("visibilitychange", () => {
    const synth = engine();
    if (!synth || document.visibilityState !== "visible" || !synth.paused) return;
    try { synth.resume(); } catch { /* The browser may already have ended playback. */ }
  });
}

function voiceCode(voice) {
  return String(voice?.lang || "").toLowerCase().replaceAll("_", "-");
}

export function pickVoice(lang) {
  const voices = engine()?.getVoices() || [];
  const matches = voices.filter((voice) => {
    const code = voiceCode(voice);
    if (lang === "en") return code === "en" || code.startsWith("en-");
    if (lang === "am") return code === "am" || code.startsWith("am-");
    if (lang === "om") return code === "om" || code.startsWith("om-");
    return false;
  });
  if (lang === "en") {
    return matches.find((voice) => voiceCode(voice).startsWith("en-us")) || matches[0] || null;
  }
  return matches[0] || null;
}

function waitForVoices() {
  const synth = engine();
  if (!synth) return Promise.resolve([]);
  const ready = synth.getVoices();
  if (ready.length) return Promise.resolve(ready);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      const list = synth.getVoices();
      if (!list.length) return;
      settled = true;
      synth.removeEventListener("voiceschanged", finish);
      resolve(list);
    };
    synth.addEventListener("voiceschanged", finish);
    const previous = synth.onvoiceschanged;
    synth.onvoiceschanged = (event) => {
      if (typeof previous === "function") previous(event);
      finish();
    };
    window.setTimeout(() => {
      if (settled) return;
      settled = true;
      synth.removeEventListener("voiceschanged", finish);
      resolve(synth.getVoices());
    }, 1000);
  });
}

export function primeSpeech() {
  const synth = engine();
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return;
  watchTab();
  try { synth.getVoices(); } catch { /* Voices load through voiceschanged. */ }
  try { synth.resume(); } catch { /* Resume is a no-op until speech has started. */ }
  if (synth.speaking || synth.pending) return;
  try {
    const unlock = new SpeechSynthesisUtterance("\u200b");
    unlock.volume = 0;
    unlock.rate = 2;
    unlockUtterance = unlock;
    synth.speak(unlock);
  } catch { /* The answer is spoken when the text arrives. */ }
}

export function recognitionAvailable() {
  return Boolean(recognitionCtor());
}

export function speakBrowser(text, lang = "en") {
  const spoken = String(text || "").replace(/\s+/g, " ").trim();
  if (!spoken) return Promise.resolve({ ok: false, reason: "empty" });
  const synth = engine();
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
    return Promise.resolve({ ok: false, reason: "unsupported" });
  }
  const token = ++generation;
  clearPoll();
  watchTab();
  try { synth.cancel(); } catch { /* Nothing was speaking. */ }
  return new Promise((resolve) => {
    let settled = false;
    let armed = false;
    let sawSpeech = false;
    let quiet = 0;
    let lastKeep = Date.now();
    let attemptId = 0;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearPoll();
      if (token === generation) heldUtterance = null;
      resolve(result);
    };
    pollTimer = window.setInterval(() => {
      if (settled) return;
      if (token !== generation) {
        finish({ ok: false, reason: "stopped" });
        return;
      }
      if (!armed) return;
      const talking = synth.speaking || synth.pending;
      if (talking) {
        sawSpeech = true;
        quiet = 0;
        if (document.visibilityState === "visible" && synth.speaking && Date.now() - lastKeep > 10000) {
          lastKeep = Date.now();
          try {
            synth.pause();
            synth.resume();
          } catch { /* Keep the current utterance playing. */ }
        }
        return;
      }
      if (!sawSpeech) return;
      quiet += 1;
      if (quiet >= 2) finish({ ok: true, reason: "end" });
    }, 400);

    const launch = (attempt) => {
      if (settled || token !== generation) return;
      const voice = pickVoice(lang);
      if (!voice) {
        finish({ ok: false, reason: "no-voice" });
        return;
      }
      const mine = ++attemptId;
      const utterance = new SpeechSynthesisUtterance(spoken);
      utterance.voice = voice;
      utterance.lang = voice.lang || LANG[lang] || "en-US";
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      heldUtterance = utterance;
      utterance.onstart = () => {
        if (mine === attemptId) sawSpeech = true;
      };
      utterance.onend = () => {
        if (mine === attemptId) finish({ ok: true, reason: "end" });
      };
      utterance.onerror = (event) => {
        if (mine !== attemptId) return;
        const code = event?.error || "error";
        if (code === "interrupted" || code === "canceled" || code === "cancelled") {
          if (token !== generation) finish({ ok: false, reason: "stopped" });
          return;
        }
        finish({ ok: false, reason: code });
      };
      window.setTimeout(() => {
        if (settled || token !== generation || mine !== attemptId) return;
        try {
          synth.resume();
          armed = true;
          synth.speak(utterance);
        } catch {
          finish({ ok: false, reason: "error" });
          return;
        }
        window.setTimeout(() => {
          if (settled || token !== generation || mine !== attemptId) return;
          if (sawSpeech || synth.speaking || synth.pending) return;
          if (attempt === 0) {
            try { synth.cancel(); } catch { /* Retry can start clean. */ }
            window.setTimeout(() => launch(1), 120);
            return;
          }
          finish({ ok: false, reason: "blocked" });
        }, 900);
      }, 80);
    };

    waitForVoices().then(() => {
      if (token !== generation) {
        finish({ ok: false, reason: "stopped" });
        return;
      }
      launch(0);
    });
  });
}

export function stopBrowserSpeech() {
  generation += 1;
  clearPoll();
  heldUtterance = null;
  try { engine()?.cancel(); } catch { /* Already silent. */ }
}

export function useVoiceCapture(lang = "en") {
  const recorder = useRef(null);
  const recognition = useRef(null);
  const streamRef = useRef(null);
  const timer = useRef(null);
  const onDone = useRef(() => {});
  const onPartial = useRef(() => {});
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function clearTimer() {
    clearInterval(timer.current);
    timer.current = null;
  }

  function finish(text, code = "") {
    clearTimer();
    recognition.current = null;
    setRecording(false);
    setPaused(false);
    onDone.current(text || "", code);
  }

  function startRecognition() {
    const Ctor = recognitionCtor();
    const heard = new Ctor();
    heard.lang = LANG[lang] || "en-US";
    heard.interimResults = true;
    heard.continuous = false;
    heard.onresult = (event) => {
      let spoken = "";
      let final = false;
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        spoken += event.results[index][0].transcript;
        if (event.results[index].isFinal) final = true;
      }
      onPartial.current(spoken.trim());
      if (final) finish(spoken.trim());
    };
    heard.onerror = (event) => {
      const code = event.error || "failed";
      if (code === "aborted") return;
      setError(code);
      if (code === "language-not-supported" || code === "service-not-allowed") {
        heard.onend = null;
        recognition.current = null;
        finish("", code);
        return;
      }
      finish("", code);
    };
    recognition.current = heard;
    heard.start();
    setRecording(true);
    setSeconds(0);
    clearTimer();
    timer.current = setInterval(() => setSeconds((value) => value + 1), 1000);
    console.info("[VOICE] Recognition started", heard.lang);
  }

  async function start(onText, partial) {
    setError("");
    onDone.current = onText || (() => {});
    onPartial.current = partial || (() => {});
    if (recognitionCtor()) {
      try {
        startRecognition();
        return "ok";
      } catch {
        setError("unsupported");
      }
    }
    setError("unsupported");
    return "unsupported";
  }

  function stop() {
    recognition.current?.stop();
    recognition.current = null;
    const media = recorder.current;
    if (media && media.state !== "inactive") media.stop();
  }

  function cancel() {
    if (recognition.current) {
      recognition.current.onresult = null;
      recognition.current.onerror = null;
      recognition.current.abort();
      recognition.current = null;
    }
    const media = recorder.current;
    if (media) media.onstop = () => stopTracks();
    if (media && media.state !== "inactive") media.stop();
    else stopTracks();
    clearTimer();
    setRecording(false);
    setPaused(false);
  }

  function togglePause() {
    const media = recorder.current;
    if (!media) return;
    if (media.state === "recording" && typeof media.pause === "function") {
      media.pause();
      setPaused(true);
      clearTimer();
    } else if (media.state === "paused" && typeof media.resume === "function") {
      media.resume();
      setPaused(false);
      timer.current = setInterval(() => setSeconds((value) => value + 1), 1000);
    }
  }

  return { recording, paused, busy: false, seconds, error, start, stop, cancel, togglePause, clearError: () => setError("") };
}

export default function VoiceButton({ lang = "en", onText, onNote }) {
  const voice = useVoiceCapture(lang);

  async function begin() {
    const result = await voice.start((spoken) => {
      if (spoken) {
        onText(spoken);
        onNote("Speech recognized. You can edit it before sending.");
      } else {
        onNote("No speech was recognized. Type instead.");
      }
    });
    if (result === "unsupported") onNote("This browser cannot record audio. Type your question instead.");
    if (result === "denied") onNote("Microphone permission was denied. Type your question instead.");
  }

  if (voice.recording) {
    return (
      <button type="button" className="btn btn-danger" onClick={voice.stop}>
        <span className="rec-dot" aria-hidden="true" /> Stop
      </button>
    );
  }
  return (
    <button type="button" className="btn btn-outline-success" onClick={begin} disabled={voice.busy}>
      {voice.busy ? "Transcribing…" : "Microphone"}
    </button>
  );
}
