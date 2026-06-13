import {
  createBooking,
  listBookingsForAdmin,
  listBookings,
  approveBooking,
  rejectBooking,
  cancelBooking,
  getBookingCounts,
  findConflictingBookings,
} from "../models/Booking.js";
import { findHallById } from "../models/Hall.js";

export async function create(req, res) {
  try {
    const {
      hallId,
      eventName,
      startDatetime,
      endDatetime,
      guestsCount,
      specialRequirements,
      bookingType,
      fullName,
      email,
      phone,
    } = req.body || {};

    if (!hallId || !eventName || !startDatetime || !endDatetime) {
      return res.status(400).json({ message: "Missing booking data" });
    }

    const start = new Date(startDatetime);
    const end = new Date(endDatetime);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return res.status(400).json({ message: "Invalid time range" });
    }

    // Conflict detection before create
    const conflicts = await findConflictingBookings({
      hallId,
      startDatetime,
      endDatetime,
    });

    if (conflicts.length) {
      return res
        .status(409)
        .json({ message: "Date/time is not available", conflicts });
    }

    const hall = await findHallById(hallId);
    if (!hall) return res.status(404).json({ message: "Hall not found" });

    const userId = req.user?.sub;

    const booking = await createBooking({
      userId: userId || null,
      guest_name: fullName,
      guest_email: email,
      guest_phone: phone,
      hallId,
      event_name: eventName,
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      guests_count: guestsCount,
      special_requirements: specialRequirements || "",
      status: "pending",
    });

    return res.status(201).json({ booking });
  } catch {
    return res.status(500).json({ message: "Could not create booking" });
  }
}

export async function myBookings(req, res) {
  const userId = req.user?.sub;
  const { status } = req.query || {};
  const bookings = await listBookings({ userId, status, isAdmin: false });
  return res.json({ bookings });
}

export async function adminList(req, res) {
  const { status, q, limit, offset } = req.query || {};
  const bookings = await listBookingsForAdmin({
    status,
    q,
    limit: Number(limit ?? 50),
    offset: Number(offset ?? 0),
  });
  return res.json({ bookings });
}

export async function adminApprove(req, res) {
  const { bookingId } = req.params;
  const booking = await approveBooking(bookingId);
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  return res.json({ booking });
}

export async function adminReject(req, res) {
  const { bookingId } = req.params;
  const booking = await rejectBooking(bookingId);
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  return res.json({ booking });
}

export async function userCancel(req, res) {
  const { bookingId } = req.params;
  const booking = await cancelBooking(bookingId);
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  return res.json({ booking });
}

export async function adminCounts(req, res) {
  const counts = await getBookingCounts();
  return res.json({ counts });
}
