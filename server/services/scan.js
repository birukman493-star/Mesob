export function hashName(value) {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) hash = (Math.imul(hash, 31) + text.charCodeAt(i)) >>> 0;
  return hash;
}

export function isImageBuffer(buffer) {
  if (!buffer || buffer.length < 4) return false;
  const png = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  return png || jpeg;
}

export function mockGuesses(foods, filename) {
  const name = String(filename || "").toLowerCase();
  const hash = hashName(name);
  const uncertain = name.includes("unknown") || name.includes("low");
  const mentioned = foods.find((food) => {
    const token = food.name_en.toLowerCase().split(" ")[0];
    return token.length > 3 && name.includes(token);
  });
  let ordered;
  if (mentioned) {
    ordered = [mentioned, ...foods.filter((food) => food.id !== mentioned.id)];
  } else {
    const start = foods.length ? hash % foods.length : 0;
    ordered = foods.slice(start).concat(foods.slice(0, start));
  }
  const base = uncertain ? 0.55 : mentioned ? 0.86 : Math.min(0.95, 0.5 + (hash % 46) / 100);
  const guesses = ordered.slice(0, 3).map((food, index) => ({
    food_id: food.id,
    name: food.name_en,
    confidence: Math.round(Math.min(0.95, Math.max(0.5, base - index * 0.15)) * 100) / 100,
  }));
  return {
    guesses,
    low_confidence: !guesses.length || guesses[0].confidence < 0.6,
    mode: "mock",
  };
}
