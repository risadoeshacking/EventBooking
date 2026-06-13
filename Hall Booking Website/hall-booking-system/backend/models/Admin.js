import pool from "../config/database.js";

export async function findAdminByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, email, password_hash, role FROM admins WHERE email = $1 LIMIT 1;`,
    [email]
  );
  return rows[0] || null;
}

export async function getAdminCount() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int as count FROM admins;`
  );
  return rows[0]?.count ?? 0;
}

export async function getRevenuePlaceholder() {
  // Placeholder for future revenue calculations (sum of approved bookings etc.)
  return { revenue: 0 };
}
