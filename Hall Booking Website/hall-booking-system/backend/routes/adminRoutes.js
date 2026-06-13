import express from "express";
import { authRequired } from "../middleware/auth.js";
import { adminRequired } from "../middleware/adminAuth.js";

import { dashboard } from "../controllers/adminController.js";

const router = express.Router();

router.get("/dashboard", authRequired, adminRequired, dashboard);

export default router;
