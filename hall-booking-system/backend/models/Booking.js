import pool from "../config/database.js";

export async function createBooking({
  userId,
  guest_name,
  guest_email,
  guest_phone,
  hallId,
  event_name,
  start_datetime,
  end_datetime,
  guests_count,
  special_requirements,
  status = "pending",
}) {
  const q = `
    INSERT INTO bookings (
      user_id,
      guest_name,
      guest_email,
      guest_phone,
      hall_id,
      event_name,
      start_datetime,
      end_datetime,
      guests_count,
      special_requirements,
      status
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *;
  `;

  const { rows } = await pool.query(q, [
    userId ?? null,
    guest_name,
    guest_email,
    guest_phone,
    hallId,
    event_name,
    start_datetime,
    end_datetime,
    guests_count,
    special_requirements,
    status,
  ]);

  return rows[0];
}

export async function findBookingById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM bookings WHERE id=$1 LIMIT 1;`,
    [id]
  );
  return rows[0] || null;
}

export async function listBookings({
  status,
  q,
  limit = 50,
  offset = 0,
  isAdmin = false,
  userId,
} = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (!isAdmin) {
    conditions.push(`user_id = $${idx++}`);
    params.push(userId);
  }

  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }

  if (q) {
    conditions.push(
      `(event_name ILIKE $${idx++} OR guest_name ILIKE $${idx++})`
    );
    params.push(`%${q}%`, `%${q}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT b.*, h.name AS hall_name, u.full_name AS user_name
    FROM bookings b
    JOIN halls h ON h.id = b.hall_id
    LEFT JOIN users u ON u.id = b.user_id
    ${where}
    ORDER BY b.created_at DESC
    LIMIT $${idx++} OFFSET $${idx++};
  `;

  params.push(limit, offset);

  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function listBookingsForAdmin({
  q,
  status,
  limit = 50,
  offset = 0,
} = {}) {
  return listBookings({ q, status, limit, offset, isAdmin: true });
}

export async function approveBooking(id) {
  const { rows } = await pool.query(
    `UPDATE bookings SET status='approved', approved_at=NOW() WHERE id=$1 RETURNING *;`,
    [id]
  );
  return rows[0] || null;
}

export async function rejectBooking(id) {
  const { rows } = await pool.query(
    `UPDATE bookings SET status='rejected', rejected_at=NOW() WHERE id=$1 RETURNING *;`,
    [id]
  );
  return rows[0] || null;
}

export async function cancelBooking(id) {
  const { rows } = await pool.query(
    `UPDATE bookings SET status='cancelled', cancelled_at=NOW() WHERE id=$1 AND status IN ('pending','approved') RETURNING *;`,
    [id]
  );
  return rows[0] || null;
}

export async function getBookingCounts() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status='pending')::int as pending,
      COUNT(*) FILTER (WHERE status='approved')::int as approved,
      COUNT(*) FILTER (WHERE status='rejected')::int as rejected,
      COUNT(*) FILTER (WHERE status='cancelled')::int as cancelled
    FROM bookings;
  `);
  return rows[0] || { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
}

export async function findConflictingBookings({
  hallId,
  startDatetime,
  endDatetime,
}) {
  // Conflict rule: overlapping intervals
  // existing.start < new.end AND existing.end > new.start
  const { rows } = await pool.query(
    `SELECT * FROM bookings
     WHERE hall_id=$1
       AND status IN ('pending','approved')
       AND start_datetime < $3
       AND end_datetime > $2
     ORDER BY start_datetime ASC;`,
    [hallId, startDatetime, endDatetime]
  );
  return rows;
}

export async function getAvailableSlots({ hallId, dateStr }) {
  // Simple day-level availability: returns if any booking exists for day.
  // Full slot logic is handled by conflict check on submit.
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int as count
     FROM bookings
     WHERE hall_id=$1
       AND status IN ('pending','approved')
       AND start_datetime::date <= $2::date
       AND end_datetime::date >= $2::date;`,
    [hallId, dateStr]
  );
  return (rows[0]?.count ?? 0) === 0;
}

export async function getBookedDatesForHall({ hallId }) {
  const { rows } = await pool.query(
    `SELECT DISTINCT start_datetime::date as date
     FROM bookings
     WHERE hall_id=$1 AND status IN ('pending','approved')
     ORDER BY date ASC;`,
    [hallId]
  );
  return rows.map((r) => r.date.toISOString().slice(0, 10));
}
