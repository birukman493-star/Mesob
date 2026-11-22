import { query } from "../db.js";

export async function checkout(req, res) {
  const reference = `MOCK-${Date.now()}`;
  await query("UPDATE users SET subscription_status = 'active' WHERE id = ?", [req.user.id]);
  res.json({
    status: "mock_success",
    provider: "chapa",
    plan: req.body.plan,
    reference,
    message: "Prototype only. No payment was taken.",
  });
}
