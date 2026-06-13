import pool from "../config/database.js";
import {
  listPublicHalls,
  findHallBySlug,
  findHallById,
  updateHallById,
  createHall,
  deleteHallById,
  getHallUtilizationStats,
} from "../models/Hall.js";
import {
  findConflictingBookings,
  getBookedDatesForHall,
} from "../models/Booking.js";

export async function getHalls(req, res) {
  const halls = await listPublicHalls();
  return res.json({ halls });
}

export async function getHall(req, res) {
  const { slug } = req.params;
  const hall = await findHallBySlug(slug);
  if (!hall) return res.status(404).json({ message: "Hall not found" });
  return res.json({ hall });
}

export async function checkAvailability(req, res) {
  const { hallId, startDatetime, endDatetime } = req.body || {};
  if (!hallId || !startDatetime || !endDatetime) {
    return res
      .status(400)
      .json({ message: "hallId, startDatetime, endDatetime required" });
  }

  const conflicts = await findConflictingBookings({
    hallId,
    startDatetime,
    endDatetime,
  });
  return res.json({ available: conflicts.length === 0, conflicts });
}

export async function getBookedDates(req, res) {
  const { hallId } = req.params;
  const dates = await getBookedDatesForHall({ hallId });
  return res.json({ bookedDates: dates });
}

export async function adminListHalls(req, res) {
  const { limit = 50, offset = 0 } = req.query || {};
  const { rows } = await pool.query(
    `SELECT * FROM halls ORDER BY created_at DESC LIMIT $1 OFFSET $2;`,
    [Number(limit), Number(offset)]
  );
  return res.json({ halls: rows });
}

export async function adminCreateHall(req, res) {
  const {
    name,
    slug,
    capacity,
    price_per_hour,
    description,
    features,
    image_urls,
  } = req.body || {};
  if (!name || !slug)
    return res.status(400).json({ message: "name and slug required" });

  const hall = await createHall({
    name,
    slug,
    capacity,
    price_per_hour,
    description: description || "",
    features: features || [],
    image_urls: image_urls || [],
  });

  return res.status(201).json({ hall });
}

export async function adminUpdateHall(req, res) {
  const { hallId } = req.params;
  const patch = req.body || {};
  const hall = await updateHallById(hallId, patch);
  if (!hall) return res.status(404).json({ message: "Hall not found" });
  return res.json({ hall });
}

export async function adminDeleteHall(req, res) {
  const { hallId } = req.params;
  const id = await deleteHallById(hallId);
  if (!id) return res.status(404).json({ message: "Hall not found" });
  return res.json({ deletedId: id });
}

export async function adminUtilization(req, res) {
  const { hallId } = req.params;
  const stats = await getHallUtilizationStats({ hallId });
  return res.json({ stats });
}
