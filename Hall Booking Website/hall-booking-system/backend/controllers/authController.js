import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { createUser, findUserByEmail } from "../models/User.js";
import { findAdminByEmail } from "../models/Admin.js";
import { requireFields } from "../middleware/validation.js";

function signToken({ sub, email, role }) {
  return jwt.sign({ sub, email, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

export async function register(req, res) {
  try {
    const { fullName, email, phone, password, confirmPassword } =
      req.body || {};

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const existing = await findUserByEmail(email);
    if (existing)
      return res.status(409).json({ message: "Email already in use" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser({ fullName, email, phone, passwordHash });

    const token = signToken({ sub: user.id, email: user.email, role: "user" });
    return res
      .status(201)
      .json({
        token,
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          phone: user.phone,
        },
      });
  } catch {
    return res.status(500).json({ message: "Registration failed" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    // First try user
    const user = await findUserByEmail(email);
    if (user) {
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ message: "Invalid credentials" });

      const token = signToken({
        sub: user.id,
        email: user.email,
        role: "user",
      });
      return res.json({
        token,
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          phone: user.phone,
          role: "user",
        },
      });
    }

    // Then try admin
    const admin = await findAdminByEmail(email);
    if (!admin) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken({
      sub: admin.id,
      email: admin.email,
      role: "admin",
    });
    return res.json({
      token,
      user: { id: admin.id, email: admin.email, role: "admin" },
    });
  } catch {
    return res.status(500).json({ message: "Login failed" });
  }
}

export async function me(req, res) {
  return res.json({ user: req.user || null });
}

export const registerValidation = requireFields([
  "fullName",
  "email",
  "phone",
  "password",
  "confirmPassword",
]);
export const loginValidation = requireFields(["email", "password"]);
