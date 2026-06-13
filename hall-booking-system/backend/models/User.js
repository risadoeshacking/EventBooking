import pool from "../config/database.js";

export async function createUser({ fullName, email, phone, passwordHash }) {
  const q = `
    INSERT INTO users (full_name, email, phone, password_hash)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const { rows } = await pool.query(q, [fullName, email, phone, passwordHash]);
  return rows[0];
}

export async function findUserByEmail(email) {
  const q = `SELECT * FROM users WHERE email = $1 LIMIT 1;`;
  const { rows } = await pool.query(q, [email]);
  return rows[0] || null;
}

export async function findUserById(id) {
  const q = `SELECT id, full_name, email, phone FROM users WHERE id = $1 LIMIT 1;`;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
}

export async function listUsers({ q, limit = 50, offset = 0 }) {
  const search = q ? `%${q}%` : null;
  if (search) {
    const sql = `
      SELECT id, full_name, email, phone, created_at
      FROM users
      WHERE full_name ILIKE $1 OR email ILIKE $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const { rows } = await pool.query(sql, [search, limit, offset]);
    return rows;
  }
  const sql = `
    SELECT id, full_name, email, phone, created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2;
  `;
  const { rows } = await pool.query(sql, [limit, offset]);
  return rows;
}

export async function getUserCount() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int as count FROM users;`
  );
  return rows[0]?.count ?? 0;
}

export async function deleteUserById(id) {
  const { rows } = await pool.query(
    `DELETE FROM users WHERE id = $1 RETURNING id;`,
    [id]
  );
  return rows[0] || null;
}

export async function updateUserById(id, { fullName, phone }) {
  const { rows } = await pool.query(
    `UPDATE users SET full_name = $1, phone = $2 WHERE id = $3 RETURNING id, full_name, email, phone;`,
    [fullName, phone, id]
  );
  return rows[0] || null;
}
