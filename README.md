# Starling Translations CMS

Production-ready novel showcase + administrator CMS.

## Features

- Public novel catalogue
- One `CHECK IT OUT` button per novel
- Each button opens that novel's Patreon URL
- Secure admin login using an environment-configured username/password
- Add, edit and delete novels without changing code
- Upload novel covers
- PostgreSQL database for persistent novel data
- PostgreSQL-backed sessions for persistent admin login sessions
- Ready for Render deployment

## Local setup

1. Install Node.js 18+.
2. Create a PostgreSQL database.
3. Copy `.env.example` to `.env`.
4. Fill in `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
5. Run `npm install`.
6. Run `npm start`.
7. Open `http://localhost:3000`.
8. Admin panel: `http://localhost:3000/admin`.

## GitHub + Render deployment

1. Create a GitHub repository and upload the contents of this folder.
2. Create a PostgreSQL database on a hosted provider such as Neon, Supabase or Render Postgres.
3. On Render, create a **Web Service** from the GitHub repository.
4. Build command: `npm install`
5. Start command: `npm start`
6. Set these environment variables in Render:
   - `NODE_ENV=production`
   - `DATABASE_URL=<your PostgreSQL connection string>`
   - `SESSION_SECRET=<long random secret>`
   - `ADMIN_USERNAME=<your admin username>`
   - `ADMIN_PASSWORD=<strong unique password>`
7. Deploy.

The database tables are created automatically on first startup.

## Cover images

Covers are stored as image data inside PostgreSQL. This keeps the application self-contained and avoids dependence on a local disk that may be ephemeral on free hosting. The CMS limits cover uploads to 2 MB.

## Security

Do not commit `.env` or production credentials to GitHub. Use Render's Environment settings for secrets. Use a strong admin password and a long random session secret.


## Authentication note
The administrator login uses a signed, HttpOnly cookie based on `SESSION_SECRET`.
No login-session table is required in PostgreSQL. Keep the existing `SESSION_SECRET`
unchanged in Render when redeploying this version.
