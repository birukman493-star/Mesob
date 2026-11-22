export function slotsFor(mode) {
  if (mode === "ramadan") return ["suhoor", "iftar", "snack"];
  return ["breakfast", "lunch", "snack", "dinner"];
}

export function isMainMeal(mode, mealType) {
  if (mode === "ramadan") return mealType === "suhoor" || mealType === "iftar";
  return mealType === "breakfast" || mealType === "lunch" || mealType === "dinner";
}

export function fastingNotice(profile, rules, mode) {
  if (mode !== "ramadan" && !profile.ramadan_mode) return null;
  const conditions = profile.conditions || [];
  const sensitive =
    profile.category === "pregnancy" ||
    profile.category === "children" ||
    profile.category === "patient" ||
    conditions.length > 0;
  const fluid = "Drink fluids between iftar and suhoor.";
  return sensitive ? `${fluid} ${rules.fasting_doctor_notice}` : fluid;
}
