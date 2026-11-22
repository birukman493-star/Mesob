import { httpError } from "../middleware/errors.js";
import { lockKey, assertNotLocked, recordFailure, failures } from "../middleware/lock.js";
import { query } from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Registration – identifier is email, phone, or full name, PIN is 4‑6 digits.
export async function register(req, res) {
  const { full_name: fullName, age, identifier, email, phone, pin, language } = req.body;
  const rawIdentifier = identifier || email || phone || fullName;
  if (!rawIdentifier) throw httpError(400, "INVALID", "Identifier (email, phone, or name) is required");
  const isEmail = rawIdentifier.includes("@");
  const isPhone = !isEmail && /^\+?[0-9\s-]{7,20}$/.test(rawIdentifier);
  const normIdentifier = isEmail ? rawIdentifier.trim().toLowerCase() : rawIdentifier.trim();

  if (!/^[0-9]{4,6}$/.test(pin)) throw httpError(400, "INVALID", "PIN must be 4 to 6 digits");

  const nameNorm = fullName?.trim().replace(/\s+/g, " ").toLowerCase() || normIdentifier.toLowerCase();
  const numAge = age ? Number(age) : null;

  // Ensure identifier / account uniqueness
  const existing = await query(
    "SELECT id FROM users WHERE (identifier IS NOT NULL AND identifier = ?) OR (email IS NOT NULL AND email = ?) OR (name_norm = ? AND (? IS NULL OR age = ?))",
    [normIdentifier, normIdentifier, nameNorm, numAge, numAge]
  );
  if (existing.length) throw httpError(409, "DUPLICATE", "An account with this identifier already exists.");

  const pinHash = await bcrypt.hash(pin, 10);
  const result = await query(
    `INSERT INTO users (full_name, name_norm, age, identifier, email, phone, pin_hash, language, trial_start)` +
    ` VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
    [
      (fullName || normIdentifier).trim().replace(/\s+/g, " "),
      nameNorm,
      numAge,
      normIdentifier,
      isEmail ? normIdentifier : null,
      isPhone ? normIdentifier : null,
      pinHash,
      language || "en",
    ]
  );
  const token = jwt.sign({ sub: result.insertId, role: "user" }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.status(201).json({
    token,
    user: { id: result.insertId, full_name: (fullName || normIdentifier).trim(), age: numAge, identifier: normIdentifier, role: "user", language: language || "en", category: null },
  });
}

/**
 * Login – identifier (email|phone|name) + PIN.
 */
export async function login(req, res) {
  const { identifier, email, phone, full_name: fullName, age, pin } = req.body;
  const rawIdentifier = identifier || email || phone || fullName;
  if (!rawIdentifier) throw httpError(400, "INVALID", "Identifier is required");
  const isEmail = rawIdentifier.includes("@");
  const normIdentifier = isEmail ? rawIdentifier.trim().toLowerCase() : rawIdentifier.trim();
  const nameNorm = rawIdentifier.trim().replace(/\s+/g, " ").toLowerCase();
  const key = lockKey(req, normIdentifier);
  assertNotLocked(key);

  let rows = await query(
    "SELECT * FROM users WHERE identifier = ? OR email = ? OR phone = ? OR name_norm = ?",
    [normIdentifier, normIdentifier, normIdentifier, nameNorm]
  );
  if (!rows.length && age) {
    rows = await query("SELECT * FROM users WHERE name_norm = ? AND age = ?", [nameNorm, Number(age)]);
  }
  let match = null;
  for (const row of rows) {
    if (await bcrypt.compare(pin, row.pin_hash)) {
      match = row;
      break;
    }
  }
  if (!match) {
    recordFailure(key);
    throw httpError(401, "UNAUTHORIZED", "Invalid credentials.");
  }
  failures.delete(key);
  const token = jwt.sign({ sub: match.id, role: match.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({
    token,
    user: {
      id: match.id,
      full_name: match.full_name,
      age: match.age,
      identifier: match.identifier || match.email || match.phone || match.full_name,
      role: match.role,
      language: match.language,
      category: match.category,
      support_mode: match.support_mode,
      subscription_status: match.subscription_status,
    },
  });
}
