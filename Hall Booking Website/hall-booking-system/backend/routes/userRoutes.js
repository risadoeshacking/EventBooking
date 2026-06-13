import express from "express";
import { authRequired } from "../middleware/auth.js";

import {
  adminUsersList,
  adminDeleteUser,
  adminUpdateUser,
} from "../controllers/adminController.js";
import { adminRequired } from "../middleware/adminAuth.js";

const router = express.Router();

// Admin user management
router.get("/admin", authRequired, adminRequired, adminUsersList);
router.put("/admin/:userId", authRequired, adminRequired, adminUpdateUser);
router.delete("/admin/:userId", authRequired, adminRequired, adminDeleteUser);

export default router;
