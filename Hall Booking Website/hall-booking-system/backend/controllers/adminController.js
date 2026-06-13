import { getBookingCounts } from "../models/Booking.js";
import { listUsers, getUserCount } from "../models/User.js";
import pool from "../config/database.js";

export async function dashboard(req, res) {
  const counts = await getBookingCounts();
  const usersCount = await getUserCount();

  // Hall utilization placeholder
  const { rows } = await pool.query(`
    SELECT COUNT(*)::int as total_halls FROM halls;
  `);

  return res.json({
    counts,
    usersCount,
    totalHalls: rows[0]?.total_halls ?? 0,
  });
}

export async function adminUsersList(req, res) {
  const { q, limit = 50, offset = 0 } = req.query || {};
  const users = await listUsers({
    q,
    limit: Number(limit),
    offset: Number(offset),
  });
  return res.json({ users });
}

export async function adminDeleteUser(req, res) {
  const { userId } = req.params;
  const { rows } = await pool.query(
    `DELETE FROM users WHERE id=$1 RETURNING id;`,
    [userId]
  );
  if (!rows[0]) return res.status(404).json({ message: "User not found" });
  return res.json({ deletedId: rows[0].id });
}

export async function adminUpdateUser(req, res) {
  const { userId } = req.params;
  const { fullName, phone } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE users SET full_name=COALESCE($2, full_name), phone=COALESCE($3, phone) WHERE id=$1 RETURNING id, full_name, email, phone;`,
    [userId, fullName ?? null, phone ?? null]
  );
  if (!rows[0]) return res.status(404).json({ message: "User not found" });
  return res.json({ user: rows[0] });
}
