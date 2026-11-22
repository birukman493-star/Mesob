import PDFDocument from "pdfkit";

function heading(doc, text) {
  doc.moveDown(0.6);
  doc.fontSize(13).fillColor("#132A13").text(text);
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor("#1c2416");
}

export function buildHealthPdf({ user, profile, targets, intake, weights, notes, sections, period }) {
  const chosen = new Set(sections?.length ? sections : ["patient", "targets", "intake", "weight", "concerns", "notes"]);
  const doc = new PDFDocument({ margin: 48, compress: false, size: "A4" });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.fontSize(18).fillColor("#132A13").text("Mesob — AI Ethiopian Nutrition");
  doc.fontSize(10).fillColor("#31572C").text(`Health summary (${period})  ·  ${new Date().toISOString().slice(0, 10)}`);

  if (chosen.has("patient")) {
    heading(doc, "Patient");
    const conditions = (profile?.conditions || []).join(", ") || "none recorded";
    const allergies = (profile?.allergies || []).join(", ") || "none recorded";
    doc.text(`Name: ${user.full_name}`);
    doc.text(`Age: ${user.age}`);
    doc.text(`Category: ${user.category || "not set"}`);
    doc.text(`Conditions: ${conditions}`);
    doc.text(
      `Pregnancy: ${user.category === "pregnancy" ? `yes, trimester ${profile?.trimester || "not set"}` : "no"}`
    );
    doc.text(`Allergies: ${allergies}`);
  }

  if (chosen.has("targets") && targets) {
    heading(doc, "Targets");
    doc.text(
      `Calories ${targets.kcal} kcal · Protein ${targets.protein_g} g · Carbohydrate ${targets.carbs_g} g · Fat ${targets.fat_g} g`
    );
    doc.text(`Sodium cap ${targets.sodium_mg} mg · Fiber ${targets.fiber_g} g · Water ${targets.water_ml} ml`);
    doc.text("Targets are calculated by the nutrition engine from the saved profile and rules.json.");
  }

  if (chosen.has("intake") && intake) {
    heading(doc, "Weekly intake");
    doc.text("Averages include days with no logged food as zero. Intake-based estimate, not a diagnosis.");
    for (const row of intake.rows || []) {
      doc.text(`${row.label}: average ${row.average} ${row.unit} / target ${row.target} ${row.unit}`);
    }
  }

  if (chosen.has("weight")) {
    heading(doc, "Weight trend");
    if (!weights?.length) doc.text("No weight entries in this period.");
    else weights.forEach((row) => doc.text(`${row.logged_at}: ${row.weight_kg} kg`));
  }

  if (chosen.has("concerns")) {
    heading(doc, "Intake concerns");
    const lines = intake?.statements || [];
    if (!lines.length) doc.text("No nutrient was under 70% of the daily target on the logged days.");
    else lines.forEach((line) => doc.text(line));
    doc.text("Intake-based estimate, not a diagnosis.");
  }

  if (chosen.has("notes")) {
    heading(doc, "Notes");
    doc.text(notes || "No dietitian or assistant note was attached.");
  }

  doc.moveDown(1.2);
  doc.fontSize(9).fillColor("#31572C").text("Generated from self-reported app data; not a medical record.");
  doc.end();
  return done;
}
