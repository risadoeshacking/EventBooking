import pool from "../config/database.js";

export async function createHall({
  name,
  slug,
  capacity,
  price_per_hour,
  description,
  features,
  image_urls,
}) {
  const q = `
    INSERT INTO halls (name, slug, capacity, price_per_hour, description, features, image_urls)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *;
  `;
  const { rows } = await pool.query(q, [
    name,
    slug,
    capacity,
    price_per_hour,
    description,
    features,
    image_urls,
  ]);
  return rows[0];
}

export async function listHalls({ limit = 50, offset = 0 }) {
  const { rows } = await pool.query(
    `SELECT id, name, slug, capacity, price_per_hour, description, features, image_urls, created_at
     FROM halls ORDER BY created_at DESC
     LIMIT $1 OFFSET $2;`,
    [limit, offset]
  );
  return rows;
}

export async function listPublicHalls() {
  const { rows } = await pool.query(
    `SELECT id, name, slug, capacity, price_per_hour, description, features, image_urls
     FROM halls ORDER BY created_at DESC;`
  );
  return rows;
}

export async function findHallBySlug(slug) {
  const { rows } = await pool.query(
    `SELECT * FROM halls WHERE slug = $1 LIMIT 1;`,
    [slug]
  );
  return rows[0] || null;
}

export async function findHallById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM halls WHERE id = $1 LIMIT 1;`,
    [id]
  );
  return rows[0] || null;
}

export async function updateHallById(id, patch) {
  const existing = await findHallById(id);
  if (!existing) return null;

  const next = {
    name: patch.name ?? existing.name,
    slug: patch.slug ?? existing.slug,
    capacity: patch.capacity ?? existing.capacity,
    price_per_hour: patch.price_per_hour ?? existing.price_per_hour,
    description: patch.description ?? existing.description,
    features: patch.features ?? existing.features,
    image_urls: patch.image_urls ?? existing.image_urls,
    updated_at: new Date(),
  };

  const { rows } = await pool.query(
    `UPDATE halls
     SET name=$1, slug=$2, capacity=$3, price_per_hour=$4, description=$5, features=$6, image_urls=$7, updated_at=$8
     WHERE id=$9
     RETURNING *;`,
    [
      next.name,
      next.slug,
      next.capacity,
      next.price_per_hour,
      next.description,
      next.features,
      next.image_urls,
      next.updated_at,
      id,
    ]
  );
  return rows[0] || null;
}

export async function deleteHallById(id) {
  const { rows } = await pool.query(
    `DELETE FROM halls WHERE id=$1 RETURNING id;`,
    [id]
  );
  return rows[0]?.id ?? null;
}

export async function getHallUtilizationStats({ hallId } = {}) {
  const base = `
    SELECT h.id as hall_id,
           h.name as hall_name,
           COUNT(b.*)::int as total_bookings,
           COALESCE(SUM(b.total_amount),0)::numeric as total_amount
    FROM halls h
    LEFT JOIN bookings b ON b.hall_id = h.id AND b.status = 'approved'
    GROUP BY h.id
  `;

  if (hallId) {
    const { rows } = await pool.query(base + " HAVING h.id = $1;", [hallId]);
    return rows[0] || null;
  }

  const { rows } = await pool.query(base);
  return rows;
}
