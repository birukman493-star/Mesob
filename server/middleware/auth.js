import jwt from "jsonwebtoken";
import { query } from "../db.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Login required." } });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const rows = await query(
      "SELECT id, role, full_name, age, language, category, support_mode, subscription_status FROM users WHERE id = ?",
      [payload.sub]
    );
    if (!rows[0]) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Account not found." } });
    }
    req.user = rows[0];
    return next();
  } catch {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or expired token." } });
  }
}
