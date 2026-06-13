/* ============================================================
   EventSpace — Standalone Static Server (No DB Required)
   Serves the frontend and provides mock API endpoints.
   Includes admin panel with authentication.
   Everything works out of the box.
   ============================================================ */

const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const app = express();

app.use(express.json());

// ─── JWT Config ───
const JWT_SECRET =
  process.env.JWT_SECRET || "eventspace_standalone_secret_2026";
const JWT_EXPIRES = "7d";

// ─── Admin credentials (hardcoded for standalone mode) ───
const ADMIN_EMAIL = "admin@eventspace.com";
const ADMIN_PASSWORD = "Admin123";
const ADMIN_NAME = "Admin User";

// ─── Mock API endpoints (must be before static middleware) ───

// GET /api/halls — Hall list
const HALLS = {
  "hall-1": {
    id: 1,
    slug: "hall-1",
    name: "The Grand Ballroom",
    capacity: 300,
    price_per_hour: 2500,
    description:
      "Elegant 300-capacity venue with crystal chandeliers, marble floors, and premium audiovisual systems.",
    features: [
      "Crystal Chandeliers",
      "Marble Floors",
      "Premium AV",
      "Full Bar",
    ],
    image_urls: [
      "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80",
    ],
  },
  "hall-2": {
    id: 2,
    slug: "hall-2",
    name: "The Sapphire Lounge",
    capacity: 120,
    price_per_hour: 1500,
    description:
      "Intimate 120-capacity space with modern decor, ambient lighting, and a private bar area.",
    features: [
      "Modern Decor",
      "Ambient Lighting",
      "Private Bar",
      "Dance Floor",
    ],
    image_urls: [
      "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=80",
    ],
  },
};

app.get("/api/halls", function (req, res) {
  res.json({ halls: Object.values(HALLS) });
});

app.get("/api/halls/:slug", function (req, res) {
  var hall = HALLS[req.params.slug];
  if (!hall) return res.status(404).json({ error: "Hall not found" });
  res.json({ hall });
});

// ─── ADMIN AUTH ───

// POST /api/admin/login
app.post("/api/admin/login", function (req, res) {
  var email = req.body.email || "";
  var password = req.body.password || "";

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    var token = jwt.sign(
      { id: 1, email: ADMIN_EMAIL, role: "admin", name: ADMIN_NAME },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );
    return res.json({
      token: token,
      user: { id: 1, email: ADMIN_EMAIL, name: ADMIN_NAME, role: "admin" },
    });
  }

  return res.status(401).json({ message: "Invalid email or password" });
});

// POST /api/login (regular user login - simplified)
app.post("/api/login", function (req, res) {
  var email = req.body.email || "";
  var password = req.body.password || "";

  // Simple mock: accept any email with password "password123" or as admin
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    var token = jwt.sign(
      { id: 1, email: ADMIN_EMAIL, role: "admin", name: ADMIN_NAME },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );
    return res.json({
      token: token,
      user: { id: 1, email: ADMIN_EMAIL, name: ADMIN_NAME, role: "admin" },
    });
  }

  if (password === "password123" || password.length >= 6) {
    var userId = Math.floor(Math.random() * 1000) + 10;
    var token = jwt.sign(
      { id: userId, email: email, role: "user", name: email.split("@")[0] },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );
    return res.json({
      token: token,
      user: {
        id: userId,
        email: email,
        name: email.split("@")[0],
        role: "user",
      },
    });
  }

  return res.status(401).json({ message: "Invalid credentials" });
});

// Auth middleware
function authMiddleware(req, res, next) {
  var header = req.headers.authorization || "";
  var token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    var payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

// GET /api/admin/me
app.get("/api/admin/me", authMiddleware, adminMiddleware, function (req, res) {
  res.json({ user: req.user });
});

// ─── TIME-SLOT BASED BOOKING SYSTEM ───
var TIME_SLOT_BOOKINGS = {};

// Pre-populate some sample bookings
function initSampleBookings() {
  var sampleDates = [
    "2026-07-04",
    "2026-07-10",
    "2026-07-15",
    "2026-07-20",
    "2026-07-25",
    "2026-08-01",
    "2026-08-08",
    "2026-08-14",
    "2026-08-22",
    "2026-09-05",
    "2026-09-12",
    "2026-09-19",
  ];
  sampleDates.forEach(function (date) {
    TIME_SLOT_BOOKINGS["1|" + date] = [9, 10, 14, 15, 18];
    TIME_SLOT_BOOKINGS["2|" + date] = [11, 12, 13, 16, 17];
  });

  var sampleDates2 = [
    "2026-07-05",
    "2026-07-12",
    "2026-07-18",
    "2026-07-22",
    "2026-07-28",
    "2026-08-03",
    "2026-08-10",
    "2026-08-17",
    "2026-08-25",
    "2026-09-02",
    "2026-09-10",
    "2026-09-18",
  ];
  sampleDates2.forEach(function (date) {
    TIME_SLOT_BOOKINGS["2|" + date] = [8, 9, 14, 15, 19];
  });
}
initSampleBookings();

// GET /api/halls/:id/slots?date=2026-07-04
app.get("/api/halls/:id/slots", function (req, res) {
  var hallId = req.params.id;
  var date = req.query.date;
  if (!date)
    return res.status(400).json({ error: "Date query param required" });
  var key = hallId + "|" + date;
  var bookedHours = TIME_SLOT_BOOKINGS[key] || [];
  res.json({ date: date, hallId: parseInt(hallId), bookedHours: bookedHours });
});

// GET /api/halls/:id/booked-dates
app.get("/api/halls/:id/booked-dates", function (req, res) {
  var hallId = req.params.id;
  var dates = [];
  Object.keys(TIME_SLOT_BOOKINGS).forEach(function (key) {
    if (key.startsWith(hallId + "|")) {
      var datePart = key.split("|")[1];
      if (TIME_SLOT_BOOKINGS[key].length > 0) dates.push(datePart);
    }
  });
  dates = dates.filter(function (d, i) {
    return dates.indexOf(d) === i;
  });
  res.json({ bookedDates: dates });
});

// POST /api/bookings — Create a time-slot booking
var bookings = [];
app.post("/api/bookings", function (req, res) {
  var hallId = req.body.hallId;
  var eventName = req.body.eventName || "Event";
  var startDatetime = req.body.startDatetime;
  var hour = req.body.hour;
  var fullName = req.body.fullName || "Guest";
  var email = req.body.email || "guest@example.com";
  var phone = req.body.phone || "N/A";
  var notes = req.body.specialRequirements || "";

  if (!startDatetime && hour === undefined) {
    return res.status(400).json({ message: "startDatetime or hour required" });
  }

  var bookingDate = startDatetime ? startDatetime.slice(0, 10) : null;
  var bookingHour =
    hour !== undefined
      ? parseInt(hour)
      : startDatetime
      ? new Date(startDatetime).getHours()
      : 10;

  if (bookingHour < 8 || bookingHour > 19) {
    return res
      .status(400)
      .json({ message: "Hour must be between 8 and 19 (8AM-8PM)" });
  }

  var key = String(hallId) + "|" + bookingDate;
  if (!TIME_SLOT_BOOKINGS[key]) TIME_SLOT_BOOKINGS[key] = [];

  if (TIME_SLOT_BOOKINGS[key].indexOf(bookingHour) >= 0) {
    return res
      .status(409)
      .json({ message: "This time slot is already booked" });
  }

  TIME_SLOT_BOOKINGS[key].push(bookingHour);

  var booking = {
    id: bookings.length + 1,
    hallId: hallId || 1,
    eventName: eventName,
    date: bookingDate,
    hour: bookingHour,
    timeLabel: formatHour(bookingHour),
    fullName: fullName,
    email: email,
    phone: phone,
    notes: notes,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };

  bookings.push(booking);
  res
    .status(201)
    .json({ booking: booking, message: "Booking confirmed successfully" });
});

function formatHour(h) {
  if (h === 12) return "12:00 PM";
  if (h < 12) return h + ":00 AM";
  return h - 12 + ":00 PM";
}

// GET /api/bookings
app.get("/api/bookings", function (req, res) {
  res.json({ bookings: bookings });
});

// GET /api/bookings/admin — Admin view of all bookings
app.get(
  "/api/bookings/admin",
  authMiddleware,
  adminMiddleware,
  function (req, res) {
    // Return all bookings including in-memory and from time slots
    var allBookings = bookings.map(function (b) {
      return {
        id: b.id,
        event_name: b.eventName || "Event",
        hall_name: HALLS["hall-" + b.hallId]
          ? HALLS["hall-" + b.hallId].name
          : "Hall " + b.hallId,
        start_datetime:
          b.date + "T" + String(b.hour || 10).padStart(2, "0") + ":00:00",
        guest_name: b.fullName,
        status: b.status || "confirmed",
        email: b.email,
        phone: b.phone,
        hour: b.hour,
        timeLabel: b.timeLabel,
      };
    });

    var limit = parseInt(req.query.limit) || allBookings.length;
    res.json({ bookings: allBookings.slice(-limit).reverse() });
  }
);

// GET /api/bookings/admin/counts
app.get(
  "/api/bookings/admin/counts",
  authMiddleware,
  adminMiddleware,
  function (req, res) {
    var confirmed = bookings.filter(function (b) {
      return b.status === "confirmed";
    }).length;
    res.json({
      counts: { pending: 0, approved: confirmed, rejected: 0, cancelled: 0 },
    });
  }
);

// Health check
app.get("/health", function (req, res) {
  res.json({ ok: true, server: "standalone", db: false });
});

// ── Serve admin & frontend static files ──
app.use("/admin", express.static(path.join(__dirname, "admin")));
app.use(express.static(path.join(__dirname, "frontend")));

// ── Fallback: serve index.html for SPA routing ──
app.use(function (req, res) {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// ── Start ──
var PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", function () {
  console.log("");
  console.log("  EventSpace - Premium Hall Booking System");
  console.log("  ──────────────────────────────────────────────");
  console.log("  Mode:    Standalone (no database required)");
  console.log("  URL:     http://localhost:" + PORT);
  console.log("  Status:  Running");
  console.log("");
  console.log("  Home         → http://localhost:" + PORT + "/");
  console.log(
    "  Hall 1       → http://localhost:" + PORT + "/eventspace.html?hall=hall-1"
  );
  console.log(
    "  Hall 2       → http://localhost:" + PORT + "/eventspace.html?hall=hall-2"
  );
  console.log(
    "  Admin Panel  → http://localhost:" + PORT + "/admin/dashboard.html"
  );
  console.log("");
  console.log("  ─── Admin Credentials ───");
  console.log("  Email:    " + ADMIN_EMAIL);
  console.log("  Password: " + ADMIN_PASSWORD);
  console.log("");
});
