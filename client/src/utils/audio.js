export function downsampleTo16k(samples, inputRate) {
  if (!samples?.length) return new Int16Array();
  if (inputRate === 16000) return floatTo16(samples);
  const length = Math.floor((samples.length * 16000) / inputRate);
  const out = new Int16Array(length);
  for (let index = 0; index < length; index += 1) {
    const source = (index * inputRate) / 16000;
    const left = Math.floor(source);
    const right = Math.min(left + 1, samples.length - 1);
    const mix = source - left;
    const value = samples[left] * (1 - mix) + samples[right] * mix;
    out[index] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }
  return out;
}

export function floatTo16(samples) {
  const out = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index]));
    out[index] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }
  return out;
}

export function pcm16ToFloat(base64) {
  let binary;
  if (typeof atob === "function") {
    binary = atob(base64);
  } else {
    binary = Buffer.from(base64, "base64").toString("binary");
  }
  const length = binary.length - (binary.length % 2);
  const floats = new Float32Array(length / 2);
  for (let index = 0; index < floats.length; index += 1) {
    const low = binary.charCodeAt(index * 2);
    const high = binary.charCodeAt(index * 2 + 1);
    let value = low | (high << 8);
    if (value & 0x8000) value -= 0x10000;
    floats[index] = value / 32768;
  }
  return floats;
}

export function createPlayback(context) {
  const sources = new Set();
  let nextTime = 0;
  let started = false;
  return {
    started: () => started,
    push(base64) {
      const floats = pcm16ToFloat(base64);
      if (!floats.length || context.state !== "running") return false;
      const buffer = context.createBuffer(1, floats.length, 24000);
      buffer.copyToChannel(floats, 0);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      const when = Math.max(context.currentTime + 0.02, nextTime);
      source.start(when);
      nextTime = when + buffer.duration;
      sources.add(source);
      source.onended = () => sources.delete(source);
      started = true;
      return true;
    },
    playing() {
      return sources.size > 0;
    },
    flush() {
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          /* This chunk already finished. */
        }
      }
      sources.clear();
      nextTime = 0;
    },
  };
}
