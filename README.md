# Tuition Center Management System (TCMS)

Decoupled architecture: a static HTML/CSS/vanilla-JS frontend (`frontend/`, hosted on GitHub
Pages) and a separate Node.js/Express REST API (`backend/`, hosted on Render), sharing one Neon
Postgres database via Prisma. See [docs/00-index.md](./docs/00-index.md) for the full design
package and [docs/02-architecture.md](./docs/02-architecture.md) for why this shape was chosen.

## Repo layout

- `frontend/` — static SPA (no build step). Open `index.html` directly or serve it with any
  static file server.
- `backend/` — Express + TypeScript + Prisma REST API.
- `docs/` — SRS, architecture, database design, API spec, roles/permissions, SDD, UI/UX,
  implementation plan, and QA/risk register.

## Backend: local setup

```powershell
cd backend
copy .env.example .env   # fill in a real Neon DATABASE_URL and JWT secrets
npm install
npx prisma migrate dev   # creates tables from prisma/schema.prisma
npm run dev              # starts the API on http://localhost:4000
```

Useful scripts (run inside `backend/`): `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Frontend: local setup

`frontend/` has no build step. Serve it with any static file server, e.g.:

```powershell
cd frontend
npx serve .
```

`frontend/js/config.js` points the SPA at the API's base URL — defaults to
`http://localhost:4000/api` for local development.

## CI/CD

- `.github/workflows/ci.yml` — lints, typechecks, tests, and builds `backend/` on every push/PR;
  optionally provisions a Neon preview branch per PR if `NEON_API_KEY`/`NEON_PROJECT_ID` repo
  secrets are configured (Settings → Secrets and variables → Actions).
- `.github/workflows/deploy-frontend.yml` — deploys `frontend/` to GitHub Pages on push to `main`
  (requires GitHub Pages to be enabled for this repo, source = GitHub Actions).
- The backend (`backend/`) deploys to Render via Render's own GitHub integration (connect the repo
  in the Render dashboard, root directory `backend/`, build command
  `npm ci --include=dev && npx prisma generate && npm run build`, start command `npm start`,
  **pre-deploy command `npx prisma migrate deploy`** so migrations run before the new version
  receives traffic) — no GitHub Actions step is needed for this, Render listens to pushes directly.
  Set `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ALLOWED_ORIGINS` in Render's
  environment variables (see `backend/.env.example`).
  **Important:** `--include=dev` is required — with `NODE_ENV=production` set (as it should be),
  Render's build step skips devDependencies by default, so `prisma` (a devDependency, pinned to
  `^6.19.3`) never gets installed; `npx prisma generate` then silently downloads the _latest_
  `prisma` from npm instead (currently v7, which replaced `generate`/`migrate` with an incompatible
  "Prisma Platform" CLI) and fails with `CLI.UNKNOWN_COMMAND`.
