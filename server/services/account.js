import { query } from "../db.js";
import { parseJson } from "./foods.js";
import { loadRules } from "./rules.js";
import { computeTargets } from "./targets.js";

export function normalizeName(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isProfileComplete(user, profile) {
  if (!user?.category || !profile) return false;
  if (user.category === "children") {
    return Number(profile.child_data?.child_age_months) >= 0 && profile.child_data?.child_age_months != null;
  }
  const age = profile.age || user.age;
  if (!profile.sex || !profile.height_cm || !profile.weight_kg || !Number(age)) return false;
  if (user.category === "pregnancy" && !profile.trimester) return false;
  return true;
}

export function trialInfo(trialStart, status) {
  const start = new Date(trialStart);
  const now = new Date();
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsed = Math.max(0, Math.floor((nowUtc - startUtc) / 86400000));
  const total = Number(process.env.TRIAL_DAYS || 15);
  const left = Math.max(0, total - elapsed);
  return {
    trial_days_left: left,
    trial_day: elapsed + 1,
    trial_reminder: status === "trial" && elapsed >= 10 && left > 0,
  };
}

export async function loadUser(id) {
  const rows = await query("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0] || null;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    full_name: user.full_name,
    // age moved to profile – not exposed here
    email: user.email,
    phone: user.phone,
    role: user.role,
    language: user.language,
    category: user.category,
    support_mode: user.support_mode,
    subscription_status: user.subscription_status,
    trial_start: user.trial_start instanceof Date
      ? user.trial_start.toISOString().slice(0, 10)
      : String(user.trial_start).slice(0, 10),
  };
}

export async function loadProfile(userId) {
  const rows = await query("SELECT * FROM profiles WHERE user_id = ?", [userId]);
  const row = rows[0];
  if (!row) return null;
  return {
    age: row.age != null ? Number(row.age) : null,
    sex: row.sex,
    height_cm: row.height_cm != null ? Number(row.height_cm) : null,
    weight_kg: row.weight_kg != null ? Number(row.weight_kg) : null,
    goal_weight_kg: row.goal_weight_kg != null ? Number(row.goal_weight_kg) : null,
    activity: row.activity,
    conditions: parseJson(row.conditions, []),
    trimester: row.trimester == null ? null : Number(row.trimester),
    allergies: parseJson(row.allergies, []),
    budget_per_day: row.budget_per_day != null ? Number(row.budget_per_day) : null,
    region: row.region,
    orthodox_fasting: Boolean(row.orthodox_fasting),
    ramadan_mode: Boolean(row.ramadan_mode),
    child_data: parseJson(row.child_data, null),
  };
}

export function targetsFor(user, profile) {
  const rules = loadRules();
  const effectiveAge = profile?.age || user?.age;
  return computeTargets({
    age: Number(effectiveAge),
    sex: profile?.sex || "male",
    kg: profile?.weight_kg,
    cm: profile?.height_cm,
    activity: profile?.activity || "light",
    category: user.category,
    trimester: profile?.trimester,
    conditions: profile?.conditions || [],
    childAgeMonths: profile?.child_data?.child_age_months ?? null,
    rules,
  });
}

export async function requireComplete(userId) {
  const user = await loadUser(userId);
  const profile = await loadProfile(userId);
  if (!isProfileComplete(user, profile)) {
    const error = new Error("Complete your profile before using this feature.");
    error.status = 400;
    error.code = "PROFILE";
    throw error;
  }
  const targets = targetsFor(user, profile);
  return { user, profile: { ...profile, category: user.category }, targets, rules: loadRules() };
}
