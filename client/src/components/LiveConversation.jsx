import { useEffect, useRef, useState } from "react";
import { downsampleTo16k, pcm16ToFloat, createPlayback } from "../utils/audio.js";

export { downsampleTo16k, pcm16ToFloat, createPlayback };

export default function LiveConversation({ lang = "en", audioContext, stream, onClose, onTranscript }) {
  const [status, setStatus] = useState("Connecting to Gemini Live…");
  const [lines, setLines] = useState([]);
  const [error, setError] = useState("");
  const saved = useRef(new Set());

  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    const token = localStorage.getItem("mesob_token");
    if (!token) {
      setError("Login required.");
      setStatus("Live voice needs a signed-in account.");
      return undefined;
    }
    if (!audioContext || !stream) {
      setError("The microphone could not start. Type your question instead.");
      setStatus("Microphone unavailable.");
      return undefined;
    }
    let stopped = false;
    let socket;
    let processor;
    let micSource;
    let loggedPlayback = false;
    let acceptAudio = false;
    const playback = createPlayback(audioContext);
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";

    function connect(attempt) {
      socket = new WebSocket(`${protocol}//${window.location.host}/api/live?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(lang)}`);
      socket.binaryType = "arraybuffer";
      socket.onmessage = async (event) => {
        if (stopped) return;
        const message = JSON.parse(event.data);
        if (message.type === "ready") {
          acceptAudio = true;
          setError("");
          setStatus("Listening… speak naturally. You can interrupt Mesob.");
        }
        if (message.type === "transcript") remember(message.role, message.text, message.final);
        if (message.type === "translation") remember("hasab", message.text, true);
        if (message.type === "hasab" && message.ok === false) remember("hasab", message.message, true);
        if (message.type === "interrupted") {
          playback.flush();
          setStatus("Listening…");
        }
        if (message.type === "audio" && message.data) {
          if (audioContext.state === "suspended") await audioContext.resume();
          const played = playback.push(message.data);
          if (played) {
            setStatus("Mesob is speaking… talk to interrupt.");
            if (!loggedPlayback) {
              loggedPlayback = true;
              console.info("[6] Frontend audio playback started");
            }
          }
        }
        if (message.type === "error") {
          setError(message.message || "Live voice failed.");
          setStatus("Live voice stopped.");
        }
      };
      socket.onerror = () => {};
      socket.onclose = () => {
        acceptAudio = false;
        if (stopped) return;
        if (attempt < 1) {
          window.setTimeout(() => {
            if (!stopped) connect(attempt + 1);
          }, 500);
          return;
        }
        setError("The live voice connection failed.");
        setStatus("Live voice stopped.");
      };
    }

    const startTimer = window.setTimeout(() => {
      if (!stopped) connect(0);
    }, 50);

    function remember(role, text, final) {
      const content = String(text || "").trim();
      if (!content) return;
      setLines((current) => {
        const next = current.filter((line) => line.final || line.role !== role);
        const last = next[next.length - 1];
        if (!final && last?.role === role && !last.final) next.pop();
        next.push({ role, text: content, final });
        return next.slice(-8);
      });
      if (final && role !== "hasab" && !saved.current.has(`${role}:${content}`)) {
        saved.current.add(`${role}:${content}`);
        onTranscriptRef.current?.(role, content);
      }
    }

    (async () => {
      try {
        if (audioContext.state === "suspended") await audioContext.resume();
        if (stopped) return;
        micSource = audioContext.createMediaStreamSource(stream);
        processor = audioContext.createScriptProcessor(4096, 1, 1);
        const mute = audioContext.createGain();
        mute.gain.value = 0;
        processor.onaudioprocess = (event) => {
          if (stopped || !acceptAudio || !socket || socket.readyState !== WebSocket.OPEN) return;
          const input = event.inputBuffer.getChannelData(0);
          let energy = 0;
          for (let index = 0; index < input.length; index += 8) energy += input[index] * input[index];
          const level = Math.sqrt(energy / Math.ceil(input.length / 8));
          if (level > 0.08 && playback.playing()) {
            playback.flush();
            setStatus("Listening…");
          }
          const pcm = downsampleTo16k(input, audioContext.sampleRate);
          if (!pcm.length) return;
          const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
          socket.send(bytes);
        };
        micSource.connect(processor);
        processor.connect(mute);
        mute.connect(audioContext.destination);
      } catch {
        setError("The microphone could not start. Type your question instead.");
        setStatus("Microphone unavailable.");
      }
    })();

    return () => {
      stopped = true;
      window.clearTimeout(startTimer);
      playback.flush();
      processor?.disconnect();
      micSource?.disconnect();
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "stop" }));
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) socket.close();
    };
  }, [lang, audioContext, stream]);

  return (
    <div className="listen-screen">
      <header>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close live voice"><i className="bi bi-x-lg" /></button>
        <span className="lang-pill"><i className="bi bi-broadcast text-danger" /> Gemini Live · {lang === "am" ? "አማርኛ" : lang === "om" ? "Afaan Oromoo" : "English"}</span>
        <span />
      </header>
      <div className="listen-body">
        <h2>{status}</h2>
        <p>Mesob hears you through the microphone and answers with Gemini audio. Text chat stays available when you close this.</p>
        <div className="live-log" aria-live="polite">
          {lines.map((line) => (
            <p key={`${line.role}-${line.text.slice(0, 24)}-${line.final}`} className={line.role}>
              <strong>{line.role === "user" ? "You" : line.role === "hasab" ? "Hasab" : "Mesob"}</strong> {line.text}
            </p>
          ))}
        </div>
        {error && <p className="text-danger" role="alert">{error}</p>}
      </div>
      <div className="listen-actions">
        <button type="button" className="stop" onClick={onClose}><i className="bi bi-stop-fill" />Stop</button>
      </div>
    </div>
  );
}
