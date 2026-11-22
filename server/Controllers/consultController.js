import { query } from "../db.js";
import { httpError } from "../middleware/errors.js";
import { isoDateTime } from "../services/dates.js";
import { loadProfile, publicUser, loadUser } from "../services/account.js";

export async function listDietitians(req, res) {
  const rows = await query(
    "SELECT id, full_name, language FROM users WHERE role = 'dietitian' ORDER BY full_name"
  );
  res.json({ dietitians: rows });
}

export async function requestConsult(req, res) {
  const result = await query(
    "INSERT INTO consultations (user_id, dietitian_id, note, status) VALUES (?, ?, ?, 'requested')",
    [req.user.id, req.body.dietitian_id || null, req.body.note || null]
  );
  res.status(201).json({ id: result.insertId, status: "requested" });
}

export async function updateConsent(req, res) {
  const dietitian = await query("SELECT id FROM users WHERE id = ? AND role = 'dietitian'", [
    req.body.dietitian_id,
  ]);
  if (!dietitian[0]) throw httpError(404, "NOT_FOUND", "Dietitian not found.");
  if (req.body.grant) {
    await query(
      `UPDATE consent_records SET revoked_at = ? WHERE user_id = ? AND dietitian_id = ? AND revoked_at IS NULL`,
      [isoDateTime(), req.user.id, req.body.dietitian_id]
    );
    const days = req.body.days || 30;
    const expires = isoDateTime(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
    const scope = (req.body.scope || ["profile", "logs"]).filter((item) => ["profile", "logs"].includes(item));
    await query(
      "INSERT INTO consent_records (user_id, dietitian_id, scope, granted_at, expires_at) VALUES (?, ?, ?, ?, ?)",
      [req.user.id, req.body.dietitian_id, JSON.stringify(scope.length ? scope : ["profile", "logs"]), isoDateTime(), expires]
    );
    res.json({ granted: true });
    return;
  }
  await query(
    "UPDATE consent_records SET revoked_at = ? WHERE user_id = ? AND dietitian_id = ? AND revoked_at IS NULL",
    [isoDateTime(), req.user.id, req.body.dietitian_id]
  );
  res.json({ granted: false });
}

export async function myRequests(req, res) {
  const rows = await query(
    `SELECT c.id, c.dietitian_id, c.status, c.note, c.created_at, u.full_name AS dietitian_name, u.language AS dietitian_language
     FROM consultations c LEFT JOIN users u ON u.id = c.dietitian_id
     WHERE c.user_id = ? ORDER BY c.id DESC`,
    [req.user.id]
  );
  const consents = await query(
    `SELECT dietitian_id, scope, granted_at, expires_at
     FROM consent_records
     WHERE user_id = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`,
    [req.user.id]
  );
  res.json({ requests: rows, consents });
}

export async function dietitianRequests(req, res) {
  const rows = await query(
    `SELECT c.id, c.user_id, c.status, c.note, c.created_at, u.full_name, u.age, u.category,
            EXISTS(
              SELECT 1 FROM consent_records k
              WHERE k.user_id = c.user_id AND k.dietitian_id = ? AND k.revoked_at IS NULL
                AND (k.expires_at IS NULL OR k.expires_at > NOW())
            ) AS consent
     FROM consultations c JOIN users u ON u.id = c.user_id
     WHERE c.dietitian_id = ? OR c.dietitian_id IS NULL
     ORDER BY c.id DESC`,
    [req.user.id, req.user.id]
  );
  res.json({
    requests: rows.map((row) => ({ ...row, consent: Boolean(row.consent) })),
    prototype: true,
  });
}

export async function updateRequest(req, res) {
  const rows = await query("SELECT * FROM consultations WHERE id = ?", [req.params.id]);
  if (!rows[0]) throw httpError(404, "NOT_FOUND", "Request not found.");
  await query("UPDATE consultations SET status = ?, dietitian_id = ?, note = COALESCE(?, note) WHERE id = ?", [
    req.body.status,
    req.user.id,
    req.body.note || null,
    req.params.id,
  ]);
  res.json({ id: Number(req.params.id), status: req.body.status });
}

export async function readSharedUser(req, res) {
  const consent = await query(
    `SELECT id, scope FROM consent_records
     WHERE user_id = ? AND dietitian_id = ? AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
    [req.params.id, req.user.id]
  );
  if (!consent[0]) {
    throw httpError(403, "FORBIDDEN", "This person has not shared their record with you.");
  }
  const user = await loadUser(req.params.id);
  if (!user) throw httpError(404, "NOT_FOUND", "User not found.");
  const profile = await loadProfile(user.id);
  const logs = await query(
    `SELECT f.name_en, l.portions, l.logged_at FROM food_logs l
     JOIN foods f ON f.id = l.food_id WHERE l.user_id = ? ORDER BY l.logged_at DESC LIMIT 10`,
    [user.id]
  );
  res.json({
    user: publicUser(user),
    profile,
    recent_logs: logs,
  });
}
