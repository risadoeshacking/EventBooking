# EventSpace — Premium Hall Booking Platform

A modern, responsive hall booking platform (frontend + backend) with:

- JWT auth (users + admins)
- Guest booking
- FullCalendar booking calendar with real-time availability checks
- Admin and user dashboards
- PostgreSQL backend

## Tech Stack

- Frontend: HTML/CSS/JS (Tailwind via CDN), FullCalendar
- Backend: Node.js + Express
- Database: PostgreSQL

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Setup

1. Create a PostgreSQL database (e.g. `eventspace`).
2. Copy environment file:
   - `cp .env.example .env`
3. Install dependencies:
   - `npm install`
4. Run migrations:
   - This project includes SQL scripts in `databse/`.
   - Execute `databse/schema.sql` then `databse/seed.sql`.
5. Start server:
   - `npm run dev`

## Default Routes

- Frontend (static files): served under `/`
- API base: `http://localhost:3000/api`

## Notes

- Update `.env` with DB credentials and `JWT_SECRET`.
- Admin accounts can be seeded via `databse/seed.sql`.
