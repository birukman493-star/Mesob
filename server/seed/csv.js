export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;
  const src = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const char = src[i];
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQuotes = false;
      } else cur += char;
    } else if (char === '"') inQuotes = true;
    else if (char === ",") {
      row.push(cur);
      cur = "";
    } else if (char === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (char !== "\r") cur += char;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((line) => line.some((cell) => String(cell).trim() !== ""));
  return body.map((cells) =>
    Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""]))
  );
}

export function rowToFood(row, id) {
  const split = (value) =>
    String(value || "")
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
  return {
    id,
    name_en: row.name_en,
    name_am: row.name_am,
    name_om: row.name_om,
    meal_types: String(row.meal_types || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    is_fasting_ok: row.is_fasting_ok === "1" || row.is_fasting_ok === "true",
    region: row.region,
    cost_birr: Number(row.cost_birr),
    portion_unit: row.portion_unit,
    portion_grams: Number(row.portion_grams),
    kcal: Number(row.kcal),
    protein_g: Number(row.protein_g),
    carbs_g: Number(row.carbs_g),
    fat_g: Number(row.fat_g),
    fiber_g: Number(row.fiber_g),
    sodium_mg: Number(row.sodium_mg),
    iron_mg: Number(row.iron_mg),
    calcium_mg: Number(row.calcium_mg),
    vit_a_ug: Number(row.vit_a_ug),
    folate_ug: Number(row.folate_ug),
    glycemic_level: row.glycemic_level || null,
    allergens: split(row.allergens),
    ingredients: split(row.ingredients),
    recipe: row.recipe,
    impact_en: row.impact_en,
    source: row.source,
  };
}
