import express from "express";
import { authRequired } from "../middleware/auth.js";
import { adminRequired } from "../middleware/adminAuth.js";

import {
  create,
  myBookings,
  adminList,
  adminApprove,
  adminReject,
  userCancel,
  adminCounts,
} from "../controllers/bookingController.js";

const router = express.Router();

// Create booking (user or guest)
router.post("/", create);

// User bookings
router.get("/me", authRequired, myBookings);
router.post("/cancel/:bookingId", authRequired, userCancel);

// Admin bookings
router.get("/admin/counts", authRequired, adminRequired, adminCounts);
router.get("/admin", authRequired, adminRequired, adminList);
router.post(
  "/admin/approve/:bookingId",
  authRequired,
  adminRequired,
  adminApprove
);
router.post(
  "/admin/reject/:bookingId",
  authRequired,
  adminRequired,
  adminReject
);

export default router;
