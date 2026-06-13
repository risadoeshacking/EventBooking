import express from "express";
import { authRequired } from "../middleware/auth.js";
import {
  getHalls,
  getHall,
  checkAvailability,
  getBookedDates,
  adminListHalls,
  adminCreateHall,
  adminUpdateHall,
  adminDeleteHall,
  adminUtilization,
} from "../controllers/hallController.js";
import { adminRequired } from "../middleware/adminAuth.js";

const router = express.Router();

router.get("/", getHalls);
router.get("/:slug", getHall);

router.post("/availability", checkAvailability);
router.get("/:hallId/booked-dates", getBookedDates);

// Admin hall management
router.get("/admin", authRequired, adminRequired, adminListHalls);
router.post("/admin", authRequired, adminRequired, adminCreateHall);
router.put("/admin/:hallId", authRequired, adminRequired, adminUpdateHall);
router.delete("/admin/:hallId", authRequired, adminRequired, adminDeleteHall);
router.get(
  "/admin/:hallId/utilization",
  authRequired,
  adminRequired,
  adminUtilization
);

export default router;
