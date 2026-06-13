import express from "express";
import {
  login,
  register,
  me,
  loginValidation,
  registerValidation,
} from "../controllers/authController.js";

const router = express.Router();

// validation middleware
router.post("/register", registerValidation, register);
router.post("/login", loginValidation, login);
router.get("/me", me);

export default router;
