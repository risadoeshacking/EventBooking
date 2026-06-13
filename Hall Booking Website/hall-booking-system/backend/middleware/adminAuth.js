import jwt from "jsonwebtoken";

export function adminRequired(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Expect role in payload; allow both 'admin' and 'admins'
    if (payload?.role !== "admin")
      return res.status(403).json({ message: "Forbidden" });

    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}
