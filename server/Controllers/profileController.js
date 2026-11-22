import { query } from "../db.js";
import {
  isProfileComplete,
  loadProfile,
  loadUser,
  publicUser,
  targetsFor,
  trialInfo,
} from "../services/account.js";
import { httpError } from "../middleware/errors.js";

async function payload(userId) {
  const user = await loadUser(userId);
  const profile = await loadProfile(userId);
  const complete = isProfileComplete(user, profile);
  return {
    user: publicUser(user),
    profile,
    profile_complete: complete,
    ...trialInfo(user.trial_start, user.subscription_status),
    targets: complete ? targetsFor(user, profile) : null,
  };
}

export async function me(req, res) {
  res.json(await payload(req.user.id));
}

export async function updateCategory(req, res) {
  await query("UPDATE users SET category = ?, support_mode = ? WHERE id = ?", [
    req.body.category,
    req.body.support_mode,
    req.user.id,
  ]);
  res.json(await payload(req.user.id));
}

export async function updateLanguage(req, res) {
  await query("UPDATE users SET language = ? WHERE id = ?", [req.body.language, req.user.id]);
  res.json(await payload(req.user.id));
}

export async function updateProfile(req, res) {
  const user = await loadUser(req.user.id);
  const body = req.body;
  if (user.category === "pregnancy" && !body.trimester) {
    throw httpError(400, "VALIDATION", "Choose a trimester for a pregnancy profile.");
  }
  if (user.category === "children" && body.child_data?.child_age_months == null) {
    throw httpError(400, "VALIDATION", "Enter the child's age in months.");
  }
  const age = body.age || user.age;
  if (user.category !== "children" && (!body.sex || !body.height_cm || !body.weight_kg || !age)) {
    throw httpError(400, "VALIDATION", "Age, sex, height, and weight are required.");
  }
  if (body.age) {
    await query("UPDATE users SET age = ? WHERE id = ?", [body.age, req.user.id]);
  }
  const values = [
    body.sex || null,
    body.height_cm || null,
    body.weight_kg || null,
    body.goal_weight_kg || null,
    body.activity || "light",
    JSON.stringify(body.conditions || []),
    body.trimester || null,
    JSON.stringify(body.allergies || []),
    body.budget_per_day ?? null,
    body.region || null,
    body.orthodox_fasting ? 1 : 0,
    body.ramadan_mode ? 1 : 0,
    body.child_data ? JSON.stringify(body.child_data) : null,
    body.age || user.age || null,
    req.user.id,
  ];
  const existing = await query("SELECT user_id FROM profiles WHERE user_id = ?", [req.user.id]);
  if (!existing.length) {
    await query(
      `INSERT INTO profiles
        (sex, height_cm, weight_kg, goal_weight_kg, activity, conditions, trimester, allergies,
         budget_per_day, region, orthodox_fasting, ramadan_mode, child_data, age, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values
    );
  } else {
    await query(
      `UPDATE profiles SET sex=?, height_cm=?, weight_kg=?, goal_weight_kg=?, activity=?, conditions=?,
        trimester=?, allergies=?, budget_per_day=?, region=?, orthodox_fasting=?, ramadan_mode=?, child_data=?, age=?
       WHERE user_id=?`,
      values
    );
  }
  res.json(await payload(req.user.id));
}

export async function getTargets(req, res) {
  const data = await payload(req.user.id);
  if (!data.profile_complete) {
    throw httpError(400, "PROFILE", "Complete your profile before calculating targets.");
  }
  res.json({
    daily: data.targets,
    weekly: {
      kcal: data.targets.weekly_kcal,
      protein_g: Math.round(data.targets.protein_g * 7 * 10) / 10,
      carbs_g: Math.round(data.targets.carbs_g * 7 * 10) / 10,
      fat_g: Math.round(data.targets.fat_g * 7 * 10) / 10,
    },
  });
}
