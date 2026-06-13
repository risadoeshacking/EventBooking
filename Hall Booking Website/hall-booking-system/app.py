import os
from flask import Flask, jsonify, send_from_directory, request, g
from werkzeug.middleware.proxy_fix import ProxyFix
from flask_cors import CORS
import jwt as pyjwt
import bcrypt
import psycopg2


FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")


def create_app() -> Flask:
    app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
    app.wsgi_app = ProxyFix(app.wsgi_app)

    # CORS similar to Express: allow origin + credentials
    CORS(app, supports_credentials=True)

    # JSON size limit similar (~1mb). Flask default is fine; enforce lightly.
    app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024

    app.before_request(lambda: setattr(g, "user", None))

    # -------- DB --------
    def get_conn():
        # Uses DATABASE_URL from .env (same naming as Node)
        # psycopg2 uses SSL automatically if DATABASE_URL includes sslmode=require
        import psycopg2
        return psycopg2.connect(os.environ["DATABASE_URL"])

    # -------- Auth helpers --------
    JWT_SECRET = os.environ.get("JWT_SECRET", "")
    JWT_EXPIRES_IN = os.environ.get("JWT_EXPIRES_IN", "7d")

    def jwt_sign(payload: dict) -> str:
        return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")

    def auth_required():
        header = request.headers.get("Authorization", "")
        token = header[7:] if header.startswith("Bearer ") else None
        if not token:
            return jsonify({"message": "Unauthorized"}), 401
        try:
            payload = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            g.user = payload
        except Exception:
            return jsonify({"message": "Unauthorized"}), 401
        return None

    def admin_required():
        err = auth_required()
        if err:
            return err
        if (g.user or {}).get("role") != "admin":
            return jsonify({"message": "Forbidden"}), 403
        return None

    # -------- Routes --------
    @app.get("/health")
    def health():
        return jsonify({"ok": True})

    # SPA fallback + static
    @app.route("/")
    @app.route("/<path:filename>")
    def frontend_files(filename=None):
        # If path has a file extension, try serving from frontend.
        if filename is None or "." in filename:
            # Attempt to serve exact file
            if filename is None:
                return send_from_directory(FRONTEND_DIR, "index.html")
            try:
                return send_from_directory(FRONTEND_DIR, filename)
            except Exception:
                pass
        # SPA fallback
        return send_from_directory(FRONTEND_DIR, "index.html")

    # --------- API: Auth ---------
    required_fields_auth_register = [
        "fullName", "email", "phone", "password", "confirmPassword"]
    required_fields_auth_login = ["email", "password"]

    def require_fields(fields):
        data = request.get_json(silent=True) or {}
        missing = [f for f in fields if str(data.get(f, "")).strip() == ""]
        if missing:
            return jsonify({"message": "Missing required fields", "missing": missing}), 400
        return None

    @app.post("/api/auth/register")
    def register():
        err = require_fields(required_fields_auth_register)
        if err:
            return err
        data = request.get_json() or {}
        full_name = data.get("fullName")
        email = data.get("email")
        phone = data.get("phone")
        password = data.get("password")
        confirm_password = data.get("confirmPassword")

        if password != confirm_password:
            return jsonify({"message": "Passwords do not match"}), 400

        try:
            with get_conn() as conn:
                with conn.cursor(row_factory=dict) as cur:
                    cur.execute(
                        "SELECT * FROM users WHERE email=%s LIMIT 1", (email,))
                    existing = cur.fetchone()
                    if existing:
                        return jsonify({"message": "Email already in use"}), 409

                    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(12)).decode(
                        "utf-8"
                    )
                    cur.execute(
                        """
                        INSERT INTO users (full_name,email,phone,password_hash)
                        VALUES (%s,%s,%s,%s)
                        RETURNING *;
                        """,
                        (full_name, email, phone, password_hash),
                    )
                    user = cur.fetchone()

            token = jwt_sign(
                {"sub": str(user["id"]), "email": user["email"], "role": "user"})
            return (
                jsonify(
                    {
                        "token": token,
                        "user": {
                            "id": str(user["id"]),
                            "fullName": user["full_name"],
                            "email": user["email"],
                            "phone": user["phone"],
                        },
                    }
                ),
                201,
            )
        except Exception:
            return jsonify({"message": "Registration failed"}), 500

    @app.post("/api/auth/login")
    def login():
        err = require_fields(required_fields_auth_login)
        if err:
            return err
        data = request.get_json() or {}
        email = data.get("email")
        password = data.get("password")

        try:
            with get_conn() as conn:
                with conn.cursor(row_factory=dict) as cur:
                    cur.execute(
                        "SELECT * FROM users WHERE email=%s LIMIT 1", (email,))
                    user = cur.fetchone()

                    if user:
                        ok = bcrypt.checkpw(password.encode(
                            "utf-8"), user["password_hash"].encode("utf-8"))
                        if not ok:
                            return jsonify({"message": "Invalid credentials"}), 401

                        token = jwt_sign(
                            {"sub": str(user["id"]), "email": user["email"], "role": "user"})
                        return jsonify(
                            {
                                "token": token,
                                "user": {
                                    "id": str(user["id"]),
                                    "fullName": user["full_name"],
                                    "email": user["email"],
                                    "phone": user["phone"],
                                    "role": "user",
                                },
                            }
                        )

                    # admin
                    cur.execute(
                        "SELECT id,email,password_hash,role FROM admins WHERE email=%s LIMIT 1", (email,))
                    admin = cur.fetchone()
                    if not admin:
                        return jsonify({"message": "Invalid credentials"}), 401

                    ok = bcrypt.checkpw(password.encode(
                        "utf-8"), admin["password_hash"].encode("utf-8"))
                    if not ok:
                        return jsonify({"message": "Invalid credentials"}), 401

                    token = jwt_sign(
                        {"sub": str(admin["id"]), "email": admin["email"], "role": "admin"})
                    return jsonify({"token": token, "user": {"id": str(admin["id"]), "email": admin["email"], "role": "admin"}})
        except Exception:
            return jsonify({"message": "Login failed"}), 500

    @app.get("/api/auth/me")
    def me():
        err = auth_required()
        if err:
            return err
        return jsonify({"user": g.user})

    # --------- API: Halls ---------
    @app.get("/api/halls")
    def halls_list():
        try:
            with get_conn() as conn:
                with conn.cursor(row_factory=dict) as cur:
                    cur.execute(
                        """
                        SELECT id,name,slug,capacity,price_per_hour,description,features,image_urls,created_at
                        FROM halls ORDER BY created_at DESC;
                        """
                    )
                    halls = cur.fetchall()
            return jsonify({"halls": halls})
        except Exception:
            return jsonify({"halls": []})

    @app.get("/api/halls/<slug>")
    def halls_by_slug(slug):
        try:
            with get_conn() as conn:
                with conn.cursor(row_factory=dict) as cur:
                    cur.execute(
                        "SELECT * FROM halls WHERE slug=%s LIMIT 1", (slug,))
                    hall = cur.fetchone()
                    if not hall:
                        return jsonify({"message": "Hall not found"}), 404
            return jsonify({"hall": hall})
        except Exception:
            return jsonify({"message": "Hall not found"}), 404

    @app.post("/api/halls/availability")
    def hall_availability():
        data = request.get_json() or {}
        hall_id = data.get("hallId")
        start_datetime = data.get("startDatetime")
        end_datetime = data.get("endDatetime")

        if not hall_id or not start_datetime or not end_datetime:
            return jsonify({"message": "hallId, startDatetime, endDatetime required"}), 400

        try:
            with get_conn() as conn:
                with conn.cursor(row_factory=dict) as cur:
                    cur.execute(
                        """
                        SELECT * FROM bookings
                        WHERE hall_id=%s
                          AND status IN ('pending','approved')
                          AND start_datetime < %s
                          AND end_datetime > %s
                        ORDER BY start_datetime ASC;
                        """,
                        (hall_id, end_datetime, start_datetime),
                    )
                    conflicts = cur.fetchall()
            return jsonify({"available": len(conflicts) == 0, "conflicts": conflicts})
        except Exception:
            return jsonify({"available": False, "conflicts": []}), 500

    @app.get("/api/halls/<hallId>/booked-dates")
    def hall_booked_dates(hallId):
        try:
            with get_conn() as conn:
                with conn.cursor(row_factory=dict) as cur:
                    cur.execute(
                        """
                        SELECT DISTINCT start_datetime::date as date
                        FROM bookings
                        WHERE hall_id=%s AND status IN ('pending','approved')
                        ORDER BY date ASC;
                        """,
                        (hallId,),
                    )
                    rows = cur.fetchall()
            dates = [r["date"].isoformat() for r in rows]
            return jsonify({"bookedDates": dates})
        except Exception:
            return jsonify({"bookedDates": []})

    @app.get("/api/halls/admin")
    def halls_admin_list():
        err = admin_required()
        if err:
            return err
        limit = int(request.args.get("limit", 50))
        offset = int(request.args.get("offset", 0))
        with get_conn() as conn:
            with conn.cursor(row_factory=dict) as cur:
                cur.execute(
                    """
                    SELECT * FROM halls ORDER BY created_at DESC LIMIT %s OFFSET %s;
                    """,
                    (limit, offset),
                )
                halls = cur.fetchall()
        return jsonify({"halls": halls})

    @app.post("/api/halls/admin")
    def halls_admin_create():
        err = admin_required()
        if err:
            return err
        data = request.get_json() or {}
        name = data.get("name")
        slug = data.get("slug")
        if not name or not slug:
            return jsonify({"message": "name and slug required"}), 400

        with get_conn() as conn:
            with conn.cursor(row_factory=dict) as cur:
                cur.execute(
                    """
                    INSERT INTO halls (name,slug,capacity,price_per_hour,description,features,image_urls)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                    RETURNING *;
                    """,
                    (
                        name,
                        slug,
                        data.get("capacity"),
                        data.get("price_per_hour", 0),
                        data.get("description", ""),
                        data.get("features", []),
                        data.get("image_urls", []),
                    ),
                )
                hall = cur.fetchone()
        return jsonify({"hall": hall}), 201

    @app.put("/api/halls/admin/<hallId>")
    def halls_admin_update(hallId):
        err = admin_required()
        if err:
            return err
        data = request.get_json() or {}
        with get_conn() as conn:
            with conn.cursor(row_factory=dict) as cur:
                cur.execute(
                    "SELECT * FROM halls WHERE id=%s LIMIT 1", (hallId,))
                existing = cur.fetchone()
                if not existing:
                    return jsonify({"message": "Hall not found"}), 404

                nxt = {
                    "name": data.get("name", existing["name"]),
                    "slug": data.get("slug", existing["slug"]),
                    "capacity": data.get("capacity", existing["capacity"]),
                    "price_per_hour": data.get("price_per_hour", existing["price_per_hour"]),
                    "description": data.get("description", existing["description"]),
                    "features": data.get("features", existing["features"]),
                    "image_urls": data.get("image_urls", existing["image_urls"]),
                }
                cur.execute(
                    """
                    UPDATE halls
                    SET name=%s,slug=%s,capacity=%s,price_per_hour=%s,description=%s,features=%s,image_urls=%s,updated_at=NOW()
                    WHERE id=%s
                    RETURNING *;
                    """,
                    (
                        nxt["name"],
                        nxt["slug"],
                        nxt["capacity"],
                        nxt["price_per_hour"],
                        nxt["description"],
                        nxt["features"],
                        nxt["image_urls"],
                        hallId,
                    ),
                )
                hall = cur.fetchone()
        return jsonify({"hall": hall})

    @app.delete("/api/halls/admin/<hallId>")
    def halls_admin_delete(hallId):
        err = admin_required()
        if err:
            return err
        with get_conn() as conn:
            with conn.cursor(row_factory=dict) as cur:
                cur.execute(
                    "DELETE FROM halls WHERE id=%s RETURNING id;", (hallId,))
                row = cur.fetchone()
                if not row:
                    return jsonify({"message": "Hall not found"}), 404
        return jsonify({"deletedId": row["id"]})

    @app.get("/api/halls/admin/<hallId>/utilization")
    def halls_admin_utilization(hallId):
        err = admin_required()
        if err:
            return err
        with get_conn() as conn:
            with conn.cursor(row_factory=dict) as cur:
                cur.execute(
                    """
                    SELECT h.id as hall_id,
                           h.name as hall_name,
                           COUNT(b.*)::int as total_bookings,
                           COALESCE(SUM(b.total_amount),0)::numeric as total_amount
                    FROM halls h
                    LEFT JOIN bookings b ON b.hall_id = h.id AND b.status = 'approved'
                    WHERE h.id=%s
                    GROUP BY h.id;
                    """,
                    (hallId,),
                )
                rows = cur.fetchall()
        stats = rows[0] if rows else None
        return jsonify({"stats": stats})

    # --------- API: Bookings ---------
    @app.post("/api/bookings")
    def bookings_create():
        err = auth_required()
        if err:
            return err
        data = request.get_json() or {}

        hall_id = data.get("hallId")
        event_name = data.get("eventName")
        start_datetime = data.get("startDatetime")
        end_datetime = data.get("endDatetime")

        if not hall_id or not event_name or not start_datetime or not end_datetime:
            return jsonify({"message": "Missing booking data"}), 400

        # time range validation left to postgres overlap rules; JS validates too
        # Find conflicts
        try:
            with get_conn() as conn:
                with conn.cursor(row_factory=dict) as cur:
                    cur.execute(
                        """
                        SELECT * FROM bookings
                        WHERE hall_id=%s
                          AND status IN ('pending','approved')
                          AND start_datetime < %s
                          AND end_datetime > %s
                        ORDER BY start_datetime ASC;
                        """,
                        (hall_id, end_datetime, start_datetime),
                    )
                    conflicts = cur.fetchall()

                    if conflicts:
                        return jsonify({"message": "Date/time is not available", "conflicts": conflicts}), 409

                    cur.execute(
                        "SELECT * FROM halls WHERE id=%s LIMIT 1", (hall_id,))
                    hall = cur.fetchone()
                    if not hall:
                        return jsonify({"message": "Hall not found"}), 404

                    user_id = g.user.get("sub")
                    booking_type = data.get("bookingType")
                    userId = user_id if booking_type == "user" else None

                    guests_count = data.get("guestsCount", 0)
                    booking = {
                        "user_id": userId,
                        "guest_name": data.get("fullName"),
                        "guest_email": data.get("email"),
                        "guest_phone": data.get("phone"),
                        "hall_id": hall_id,
                        "event_name": event_name,
                        "start_datetime": start_datetime,
                        "end_datetime": end_datetime,
                        "guests_count": guests_count,
                        "special_requirements": data.get("specialRequirements", ""),
                        "status": "pending",
                    }

                    cur.execute(
                        """
                        INSERT INTO bookings (
                          user_id,guest_name,guest_email,guest_phone,hall_id,event_name,
                          start_datetime,end_datetime,guests_count,special_requirements,status
                        )
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        RETURNING *;
                        """,
                        (
                            booking["user_id"],
                            booking["guest_name"],
                            booking["guest_email"],
                            booking["guest_phone"],
                            booking["hall_id"],
                            booking["event_name"],
                            booking["start_datetime"],
                            booking["end_datetime"],
                            booking["guests_count"],
                            booking["special_requirements"],
                            booking["status"],
                        ),
                    )
                    row = cur.fetchone()

            return jsonify({"booking": row}), 201
        except Exception:
            return jsonify({"message": "Could not create booking"}), 500

    @app.get("/api/bookings/me")
    def bookings_my():
        err = auth_required()
        if err:
            return err
        user_id = g.user.get("sub")
        status = request.args.get("status")

        with get_conn() as conn:
            with conn.cursor(row_factory=dict) as cur:
                where = "WHERE user_id=%s"
                params = [user_id]
                if status:
                    where += " AND status=%s"
                    params.append(status)

                cur.execute(
                    f"""
                    SELECT b.*, h.name AS hall_name, u.full_name AS user_name
                    FROM bookings b
                    JOIN halls h ON h.id=b.hall_id
                    LEFT JOIN users u ON u.id=b.user_id
                    {where}
                    ORDER BY b.created_at DESC;
                    """,
                    tuple(params),
                )
                bookings = cur.fetchall()
        return jsonify({"bookings": bookings})

    @app.post("/api/bookings/cancel/<bookingId>")
    def bookings_cancel(bookingId):
        err = auth_required()
        if err:
            return err
        with get_conn() as conn:
            with conn.cursor(row_factory=dict) as cur:
                cur.execute(
                    """
                    UPDATE bookings
                    SET status='cancelled', cancelled_at=NOW()
                    WHERE id=%s AND status IN ('pending','approved')
                    RETURNING *;
                    """,
                    (bookingId,),
                )
                row = cur.fetchone()
                if not row:
                    return jsonify({"message": "Booking not found"}), 404
        return jsonify({"booking": row})

    @app.get("/api/bookings/admin/counts")
    def bookings_admin_counts():
        err = admin_required()
        if err:
            return err
        with get_conn() as conn:
            with conn.cursor(row_factory=dict) as cur:
                cur.execute(
                    """
                    SELECT
                      COUNT(*) FILTER (WHERE status='pending')::int as pending,
                      COUNT(*) FILTER (WHERE status='approved')::int as approved,
                      COUNT(*) FILTER (WHERE status='rejected')::int as rejected,
                      COUNT(*) FILTER (WHERE status='cancelled')::int as cancelled
                    FROM bookings;
                    """
                )
                counts = cur.fetchone()
        return jsonify({"counts": counts})

    @app.get("/api/bookings/admin")
    def bookings_admin_list():
        err = admin_required()
        if err:
            return err
        status = request.args.get("status")
        q = request.args.get("q")
        limit = int(request.args.get("limit", 50))
        offset = int(request.args.get("offset", 0))

        conditions = []
        params = []
        if status:
            conditions.append("status=%s")
            params.append(status)
        if q:
            conditions.append("(event_name ILIKE %s OR guest_name ILIKE %s)")
            params.extend([f"%{q}%", f"%{q}%"])

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        with get_conn() as conn:
            with conn.cursor(row_factory=dict) as cur:
                cur.execute(
                    f"""
                    SELECT b.*, h.name AS hall_name, u.full_name AS user_name
                    FROM bookings b
                    JOIN halls h ON h.id=b.hall_id
                    LEFT JOIN users u ON u.id=b.user_id
                    {where}
                    ORDER BY b.created_at DESC
                    LIMIT %s OFFSET %s;
                    """,
                    tuple(params + [limit, offset]),
                )
                bookings = cur.fetchall()
        return jsonify({"bookings": bookings})

    @app.post("/api/bookings/admin/approve/<bookingId>")
    def bookings_admin_approve(bookingId):
        err = admin_required()
        if err:
            return err
        with get_conn() as conn:
            with conn.cursor(row_factory=dict) as cur:
                cur.execute(
                    """
                    UPDATE bookings
                    SET status='approved', approved_at=NOW()
                    WHERE id=%s
                    RETURNING *;
                    """,
                    (bookingId,),
                )
                row = cur.fetchone()
                if not row:
                    return jsonify({"message": "Booking not found"}), 404
        return jsonify({"booking": row})

    @app.post("/api/bookings/admin/reject/<bookingId>")
    def bookings_admin_reject(bookingId):
        err = admin_required()
        if err:
            return err
        with get_conn() as conn:
            with conn.cursor(row_factory=dict) as cur:
                cur.execute(
                    """
                    UPDATE bookings
                    SET status='rejected', rejected_at=NOW()
                    WHERE id=%s
                    RETURNING *;
                    """,
                    (bookingId,),
                )
                row = cur.fetchone()
                if not row:
                    return jsonify({"message": "Booking not found"}), 404
        return jsonify({"booking": row})

    # --------- API: Admin dashboard + users ---------
    @app.get("/api/admin/dashboard")
    def admin_dashboard():
        err = admin_required()
        if err:
            return err

        with get_conn() as conn:
            with conn.cursor(row_factory=dict) as cur:
                cur.execute(
                    """
                    SELECT
                      COUNT(*) FILTER (WHERE status='pending')::int as pending,
                      COUNT(*) FILTER (WHERE status='approved')::int as approved,
                      COUNT(*) FILTER (WHERE status='rejected')::int as rejected,
                      COUNT(*) FILTER (WHERE status='cancelled')::int as cancelled
                    FROM bookings;
                    """
                )
                counts = cur.fetchone()

                cur.execute("SELECT COUNT(*)::int as count FROM users;")
                users_count = cur.fetchone()["count"]

                cur.execute("SELECT COUNT(*)::int as total_halls FROM halls;")
                total_halls = cur.fetchone()["total_halls"]

        return jsonify({"counts": counts, "usersCount": users_count, "totalHalls": total_halls})

    @app.get("/api/users/admin")
    def admin_users_list():
        err = admin_required()
        if err:
            return err
        q = request.args.get("q")
        limit = int(request.args.get("limit", 50))
        offset = int(request.args.get("offset", 0))

        with get_conn() as conn:
            with conn.cursor(row_factory=dict) as cur:
                if q:
                    cur.execute(
                        """
                        SELECT id,full_name,email,phone,created_at
                        FROM users
                        WHERE full_name ILIKE %s OR email ILIKE %s
                        ORDER BY created_at DESC
                        LIMIT %s OFFSET %s;
                        """,
                        (f"%{q}%", f"%{q}%", limit, offset),
                    )
                else:
                    cur.execute(
                        """
                        SELECT id,full_name,email,phone,created_at
                        FROM users
                        ORDER BY created_at DESC
                        LIMIT %s OFFSET %s;
                        """,
                        (limit, offset),
                    )
                users = cur.fetchall()
        return jsonify({"users": users})

    @app.put("/api/users/admin/<userId>")
    def admin_user_update(userId):
        err = admin_required()
        if err:
            return err
        data = request.get_json() or {}
        full_name = data.get("fullName")
        phone = data.get("phone")

        with get_conn() as conn:
            with conn.cursor(row_factory=dict) as cur:
                cur.execute(
                    """
                    UPDATE users
                    SET full_name=COALESCE(%s, full_name), phone=COALESCE(%s, phone)
                    WHERE id=%s
                    RETURNING id, full_name, email, phone;
                    """,
                    (full_name, phone, userId),
                )
                row = cur.fetchone()
                if not row:
                    return jsonify({"message": "User not found"}), 404
        return jsonify({"user": row})

    @app.delete("/api/users/admin/<userId>")
    def admin_user_delete(userId):
        err = admin_required()
        if err:
            return err
        with get_conn() as conn:
            with conn.cursor(row_factory=dict) as cur:
                cur.execute(
                    "DELETE FROM users WHERE id=%s RETURNING id;", (userId,))
                row = cur.fetchone()
                if not row:
                    return jsonify({"message": "User not found"}), 404
        return jsonify({"deletedId": row["id"]})

    # Start Flask
    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    app.run(host="0.0.0.0", port=port, debug=False)
