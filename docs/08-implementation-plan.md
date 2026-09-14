# Implementation Plan

## Tuition Center Management System (TCMS)

|         |                                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Version | 2.0 (Approved 2026-09-14 — decoupled architecture)                                                                                                                             |
| Format  | Per module: Requirement → Solution Design → Implementation Tasks → Code Review Checklist → Unit Tests → Integration Tests → UAT Tests → Risk Assessment → Deployment Checklist |
| Related | [06-sdd.md](./06-sdd.md) (capabilities) · [03-database-design.md](./03-database-design.md) · [04-api-specification.md](./04-api-specification.md)                              |

> Modules M1–M6 below were written against the original Next.js-monolith design; read "API route"/"route handler" as "Express route" and "Vercel Cron" as "Render cron/`node-cron`" per the [02-architecture.md](./02-architecture.md) v2.0 rework — the endpoints, business rules, and test plans are otherwise unaffected by the hosting-model change. They will be updated in place as each module starts.
>
> Modules are built **in dependency order** matching the capability graph in [06-sdd.md](./06-sdd.md) §8. This plan and all preceding design docs are approved (see [00-index.md](./00-index.md)) — implementation of Module M0 is underway.

---

## Module M0 — Project Scaffolding & CI/CD

**Status: Implemented 2026-09-14**, except the Render web service itself (requires the product
owner's Render account — see the unchecked task below and [README.md](../README.md)).

### Requirement

Two independently deployable projects: a static HTML/CSS/vanilla-JS frontend (`frontend/`, deployable to GitHub Pages) and a Node.js + TypeScript + Express + Prisma REST API (`backend/`, deployable to Render), sharing one Neon Postgres database, with CI enforcing lint/typecheck/tests on every PR (SRS §2.4 constraints). Supersedes the original Next.js-monolith M0 per the 2026-09-14 architecture rework (see [02-architecture.md](./02-architecture.md)).

### Solution Design

Monorepo with `frontend/` (no build step — plain HTML/CSS/JS evolved from `mockups/`) and `backend/` (Express + TS strict + Prisma initialized against Neon). GitHub Actions workflow running `eslint`, `tsc --noEmit`, `vitest` for the backend, against a Neon preview branch created per PR; a separate job deploys `frontend/` to GitHub Pages and triggers a Render deploy for `backend/` on merge to `main` (see [02-architecture.md](./02-architecture.md) §3).

### Implementation Tasks

- [x] Scaffold `backend/` Express + TS project; enable `strict: true`, `noUncheckedIndexedAccess`.
- [x] Add Prisma to `backend/`, point `DATABASE_URL` at Neon; import the [03-database-design.md](./03-database-design.md) schema.
- [x] Move/adapt `mockups/` into `frontend/` as the real static SPA entry point (kept plain HTML/CSS/JS, no framework/build step).
- [x] Wire ESLint + Prettier + Husky pre-commit (lint-staged) at the repo root, covering `backend/`.
- [x] GitHub Actions: lint → typecheck → unit tests → integration tests (against Neon branch) → build, for `backend/`.
- [x] GitHub Actions: deploy `frontend/` to GitHub Pages on merge to `main` (`actions/deploy-pages`).
- [ ] Render web service created for `backend/`, auto-deploy on push to `main`, env vars configured per environment. **Requires the product owner's Render account** — steps documented in [README.md](../README.md); not something an automated agent can complete.
- [x] `prisma migrate deploy` wired into Render's pre-deploy/release step (documented in [README.md](../README.md) as the Render "Pre-Deploy Command" setting; not `db push`, to keep a migration history in prod).
- [x] CORS configured on `backend/` to allow only the GitHub Pages origin(s).

### Code Review Checklist

- [x] No secrets committed (`.env*` gitignored, `.env.example` present with placeholder values, in `backend/`).
- [x] `backend/tsconfig.json` strict mode confirmed, no blanket `// @ts-ignore`.
- [x] CI fails the build on any lint/type error (not just warns).
- [x] `frontend/` contains zero secrets or API keys (it's public static hosting).

### Unit Tests

- N/A (infra module) — covered by CI running successfully as its own verification.

### Integration Tests

- [ ] CI pipeline dry run: open a throwaway PR, confirm a Neon preview branch is created and destroyed on PR close.

### UAT Tests

- [ ] A second developer clones the repo, runs `npm install && npm run dev` in `backend/` with only `.env.example`-documented vars, and reaches a running API without tribal knowledge; opens `frontend/index.html` via a static server and it talks to the local API.

### Risk Assessment

| Risk                                                               | Likelihood | Impact | Mitigation                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neon preview branches accumulate and hit plan quota                | Medium     | Low    | CI job deletes the branch on PR close (`workflow_run` trigger)                                                                                                                                                  |
| Secrets leak via the public frontend                               | Low        | High   | `frontend/` is plain static files with no build/env-substitution step, so there is no mechanism to accidentally embed a server secret; CI greps `frontend/` for accidental secret-looking strings as a backstop |
| CORS misconfigured, blocking or over-permitting cross-origin calls | Medium     | Medium | Backend allow-lists exact origins; integration test asserts a disallowed origin is rejected                                                                                                                     |

### Deployment Checklist

- [ ] Production Render env vars set (`DATABASE_URL`, JWT secrets, email API key) — none reused from preview.
- [ ] `prisma migrate deploy` confirmed to run before traffic shifts to the new deployment.
- [ ] Neon point-in-time recovery window confirmed ≥ NFR-12's RPO target.
- [ ] GitHub Pages custom domain/HTTPS confirmed; production API base URL is the one baked into `frontend/js/config.js` (or equivalent), not a preview/dev URL.

---

## Module M1 — Authentication & User Management

_(SDD capability: `auth`; SRS: FR-AUTH-_, FR-USR-_)_

**Status: Implemented 2026-09-14** against in-memory fakes (73 passing tests, clean
typecheck/lint/build); not yet run against a real Neon database (none connected — see M0), and
`frontend/` isn't wired to call these endpoints yet.

### Requirement

See [06-sdd.md](./06-sdd.md) `auth` capability.

### Solution Design

Express routes under `/api/auth/*` and `/api/users/*`; bcrypt via `bcryptjs` (pure JS, no native build step); JWT via `jsonwebtoken` (the backend is a CommonJS Express app, not an ESM-only environment, so `jsonwebtoken` avoids `jose`'s ESM-only friction — see repo tooling notes); refresh tokens stored hashed in `RefreshToken` table with rotation on use. Tokens are returned as bearer tokens in the JSON response body (not cookies) per [02-architecture.md](./02-architecture.md) v2.0 §5. Rate limiting uses an in-memory sliding window (`express-rate-limit`) rather than Upstash Redis: Render runs `backend/` as a single long-lived process (not a serverless function), so in-process state persists across requests without an external store; revisit with a Redis-backed store only if the API is horizontally scaled to multiple instances.

### Implementation Tasks

- [x] `POST /api/auth/register`, `/login`, `/logout`, `/refresh`, `/forgot-password`, `/reset-password`; `GET /api/auth/me`.
- [x] `requireAuth`/`requireRole` middleware helpers.
- [x] Rate limiter on `/api/auth/*` (in-memory sliding window, 5 failed attempts per (email, IP) → 429 for 15 minutes per the `auth` capability).
- [x] Admin approval UI/endpoint for `PENDING` self-registrations (`PATCH /api/users/:id/status`). Endpoint done; the Center Admin **UI** wiring against this live API is deferred to when `frontend/` gets real `fetch()` calls.
- [x] `POST /api/users` staff/teacher creation (admin-only).

### Code Review Checklist

- [x] Passwords never logged, never returned in any response payload.
- [x] JWT secrets read only from env, never hardcoded/committed.
- [x] Tokens are only ever returned in the JSON response body, never set as cookies (cross-origin bearer-token model — see [02-architecture.md](./02-architecture.md) v2.0 §5).
- [x] All error paths return the standard error envelope ([04-api-specification.md](./04-api-specification.md) §1.1).

### Unit Tests

- [x] Password hashing round-trip; hash never equals plaintext.
- [x] JWT sign/verify, including expired-token rejection.
- [x] Rate limiter logic: 5 fails → blocked, resets after window.

### Integration Tests

- [ ] Full login → protected-route → refresh → logout flow against a real (preview-branch) DB. Covered instead against an in-memory fake repository (no live Neon DB connected yet — see M0); re-run against a real Neon preview branch once `DATABASE_URL` is configured.
- [x] Pending registration blocked from login; approved registration succeeds (full register → blocked → admin-approve → login chain, `backend/src/routes/registrationFlow.test.ts`).

### UAT Tests

- [ ] Center Admin approves a newly self-registered Parent account end-to-end via the UI.
- [ ] A Teacher logs in, session persists across a page refresh, and expires after inactivity per TTL.

### Risk Assessment

| Risk                             | Likelihood | Impact | Mitigation                                                                                                     |
| -------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| Refresh token replay after theft | Low        | High   | Rotation invalidates the old token on each refresh; a reused old token revokes the whole chain                 |
| Brute force on `/login`          | Medium     | Medium | Rate limiting + generic error message (no user-enumeration via distinct "email not found" vs "wrong password") |

### Deployment Checklist

- [ ] JWT secrets rotated from any values used during development.
- [ ] Rate limiter is in-memory per instance; documented explicitly as a single-instance assumption (see Solution Design) — revisit if Render is scaled to multiple instances.

---

## Module M2 — Branches & Academic Structure

_(SDD capability: `academic-structure`, `branch-scoping`; SRS: FR-ORG-_, FR-ACAD-_)_

**Status: Implemented 2026-09-14** against in-memory fakes (139 backend tests total); not yet run
against a real Neon database (none connected — see M0). The overlap check currently runs as a
service-layer check-then-insert (not yet wrapped in a DB-level serializable transaction or
`EXCLUDE` constraint — see the note on the Integration Tests item below); the seed-data import
script is deferred to when a live DB is connected.

### Requirement

See [06-sdd.md](./06-sdd.md) `academic-structure`/`branch-scoping`.

### Solution Design

`scopeToBranches(ctx)` service helper applied to every query; double-booking enforced via a transaction-level overlap check (Postgres `EXCLUDE` constraint if `btree_gist` is available on the Neon plan, else a serializable-transaction check — decided during this module, not deferred).

### Implementation Tasks

- [x] CRUD for `Branch`, `Subject`, `GradeLevel`, `Course`. (`Subject`/`GradeLevel` are list+create only per [04-api-specification.md](./04-api-specification.md) §5; `Course` also supports `PATCH`/`DELETE`.)
- [x] `Batch` CRUD incl. teacher/room assignment.
- [x] `ClassSchedule` create/delete with overlap validation.
- [x] Batch archive endpoint.
- [ ] **Seed-data import**: migrate the already-seeded prototype rows (`classes`/`teachers`/`students`/`schedule` in Neon project `TuitionCenter`) into `Course`/`Batch`/`User`(role=TEACHER)/`ClassSchedule` via a one-off migration script, preserving the original IDs as a reference field for traceability. Deferred until a Neon DB is actually connected (see M0).

### Code Review Checklist

- [x] Every list/get endpoint demonstrably applies branch scoping (test asserts a 404 for out-of-scope IDs, not just "happy path" coverage).
- [x] Overlap-check logic covers same-teacher AND same-room cases, and both directions of overlap (new-inside-existing, existing-inside-new).

### Unit Tests

- [x] Overlap detection function: exhaustive interval-overlap cases (touching-but-not-overlapping boundaries must NOT conflict, e.g. 16:00–17:00 then 17:00–18:00). (`src/academic/scheduleOverlap.test.ts`)
- [x] Branch-scope filter builder unit-tested in isolation from HTTP. (`src/lib/branchScope.test.ts`, plus `branchesService`/`batchesService` scoping tests)

### Integration Tests

- [ ] Concurrent schedule-creation race test (two overlapping requests fired near-simultaneously) — exactly one succeeds. Not yet meaningful against in-memory fakes (single-threaded, no real concurrency) or without a connected Neon DB; the current implementation is a check-then-insert in the service layer, **not** yet a DB-level serializable transaction or `EXCLUDE` constraint — this must be revisited before go-live per the Solution Design above (same class of gap flagged for `EnrolLment` in M3).
- [ ] Seed-data import script run against a scratch DB, row counts verified to match source.

### UAT Tests

- [ ] Center Admin creates a new Batch, assigns a Teacher and Room, and the system rejects a conflicting second Batch in the same room/time.
- [ ] Super Admin views Branches across the whole center; Center Admin at a single branch cannot see or select another branch when creating a Batch.

### Risk Assessment

| Risk                                                  | Likelihood | Impact | Mitigation                                                                                                                                                          |
| ----------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `btree_gist` extension unavailable on Neon free tier  | Medium     | Medium | Fallback to serializable-transaction overlap check in the service layer; documented decision point, not a silent gap                                                |
| Seed-data import introduces duplicate/orphaned rows   | Low        | Medium | Import script runs inside a transaction with a dry-run/report mode before committing                                                                                |
| Overlap check-then-insert races under concurrent load | Medium     | Medium | Not yet mitigated at the DB layer (see Integration Tests above) — wrap in a serializable transaction or `EXCLUDE` constraint once Neon is connected, before go-live |

### Deployment Checklist

- [ ] Confirm which overlap-enforcement strategy shipped (DB constraint vs. service-layer) and document it in the repo README.
- [ ] Seed-data import executed once against production, verified via row-count diff, script marked as run (idempotency guard) to prevent accidental re-run.

---

## Module M3 — Enrollment

_(SDD capability: `enrollment`; SRS: FR-ENR-_)*

### Requirement / Solution Design

See [06-sdd.md](./06-sdd.md) `enrollment` — capacity check + insert in one transaction.

### Implementation Tasks

- [ ] `POST/GET/PATCH /api/enrollments`.
- [ ] Capacity-checking transaction (serializable isolation or `SELECT ... FOR UPDATE` on the Batch row).

### Code Review Checklist

- [ ] Capacity check reads and the insert happen inside the same DB transaction (grep for any capacity check outside a `prisma.$transaction`).

### Unit Tests

- [ ] Capacity boundary: capacity−1 succeeds, capacity (exact) fails.

### Integration Tests

- [ ] Concurrency test: fire N parallel enrollment requests at a batch with 1 remaining seat; exactly 1 succeeds.

### UAT Tests

- [ ] Accountant enrolls a student into a nearly-full batch and receives a clear "batch full" message on the last rejected attempt.

### Risk Assessment

| Risk                                                     | Likelihood               | Impact | Mitigation                                                  |
| -------------------------------------------------------- | ------------------------ | ------ | ----------------------------------------------------------- |
| Serializable transactions increase contention under load | Low (small center scale) | Low    | Revisit with row-level locking if NFR-2 scale is approached |

### Deployment Checklist

- [ ] Load-test the enrollment endpoint at expected peak (start-of-term rush) before go-live.

---

## Module M4 — Attendance

_(SDD capability: `attendance`; SRS: FR-ATT-_)*

### Requirement / Solution Design

See [06-sdd.md](./06-sdd.md) `attendance` — materialized sessions + 72h edit window + audited override.

### Implementation Tasks

- [ ] Vercel Cron job: materialize `ClassSession` rows for the next 14 days from `ClassSchedule`.
- [ ] `PUT /api/sessions/:id/attendance` (bulk upsert, own-batch + window check).
- [ ] `POST /api/sessions/:id/attendance/override` (admin-only, mandatory reason, writes `AuditLog`).
- [ ] Attendance-percentage aggregation endpoint for Student/Parent view.

### Code Review Checklist

- [ ] Window check uses server time (not client-supplied timestamps) to prevent clock-tampering bypass.
- [ ] Override path is unreachable by any role except Admin (test asserts 403 for Teacher attempting the override endpoint, not just the normal endpoint).

### Unit Tests

- [ ] Window boundary: exactly 72h0m is inside vs. 72h1m is outside (pick and document one inclusive/exclusive convention).
- [ ] Attendance-percentage calculation with mixed statuses (excused excluded from denominator — a deliberate rule to confirm with the product owner).

### Integration Tests

- [ ] Materialization job run twice back-to-back does not create duplicate sessions (idempotent via the `(batchId, sessionDate)` unique constraint).

### UAT Tests

- [ ] Teacher marks attendance for today's class in under 3 clicks per [07-ui-ux-design.md](./07-ui-ux-design.md) (NFR-7).
- [ ] Center Admin performs an override on a stale session and can later find it in the Audit Log.

### Risk Assessment

| Risk                                                    | Likelihood | Impact | Mitigation                                                                             |
| ------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------- |
| Cron job failure silently stops session materialization | Medium     | Medium | Health-check alert if `ClassSession` count for "tomorrow" is zero when it shouldn't be |
| Excused-vs-denominator rule surprises stakeholders      | Medium     | Low    | Explicitly confirmed as a UAT scenario before ship                                     |

### Deployment Checklist

- [ ] Cron schedule confirmed against the center's actual timezone (not UTC-naive).

---

## Module M5 — Dashboards & Reporting

_(SDD capability: cross-cutting; SRS: FR-RPT-_)*

### Implementation Tasks

- [ ] `/api/dashboard/summary` returning role-appropriate KPIs.
- [ ] CSV export for enrollment/attendance reports.

### Code Review Checklist

- [ ] Large CSV exports are streamed, not built fully in memory (avoids Vercel function timeout — Risk R-03 in [02-architecture.md](./02-architecture.md)).

### Unit Tests

- [ ] KPI aggregation queries return correct counts against known fixture data.

### Integration Tests

- [ ] CSV export round-trips (generated file re-parses to the expected row count).

### UAT Tests

- [ ] Center Admin exports a monthly enrollment/attendance report and opens it successfully in Excel/Sheets.

### Risk Assessment

| Risk                                 | Likelihood | Impact | Mitigation                                                                                                                |
| ------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| Dashboard queries slow as data grows | Medium     | Medium | Covered by indexes in [03-database-design.md](./03-database-design.md) §6; revisit with `EXPLAIN ANALYZE` before scale-up |

### Deployment Checklist

- [ ] Report export function timeout verified against Vercel's plan limits for the expected largest report size.

---

## Module M6 — Audit Log & Hardening

_(SDD capability: `audit-log`; SRS: FR-AUD-_, NFR-4)*

### Implementation Tasks

- [ ] `AuditLog` write helper invoked from every mutating action identified in prior modules.
- [ ] `GET /api/audit-logs` with branch scoping + filters.
- [ ] Security hardening pass: security headers (CSP, `X-Frame-Options`), dependency audit, OWASP checklist review (full checklist in [09-review-qa.md](./09-review-qa.md)).

### Code Review Checklist

- [ ] Every capability's "writes an AuditLog entry" requirement from [06-sdd.md](./06-sdd.md) has a corresponding call site (cross-checked against the capability list, not assumed).

### Unit Tests

- [ ] Audit write helper captures before/after diffs correctly for a sample entity update.

### Integration Tests

- [ ] End-to-end: perform one action from each audited capability, confirm exactly one corresponding `AuditLog` row each.

### UAT Tests

- [ ] Super Admin searches the audit log by entity and by actor and finds the expected events.

### Risk Assessment

| Risk                                                          | Likelihood | Impact | Mitigation                                                                                                                                                                                  |
| ------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A future feature adds a mutation without wiring an audit call | Medium     | Medium | Add a lightweight lint/test convention: any route handler doing an attendance-override write must import the audit helper (enforced via a custom ESLint rule or code-review checklist gate) |

### Deployment Checklist

- [ ] Full OWASP Top 10 checklist signed off (see [09-review-qa.md](./09-review-qa.md)).
- [ ] Final go-live checklist (below) completed.

---

## Final Go-Live Checklist (applies across all modules)

- [ ] All module Deployment Checklists above completed.
- [ ] `prisma migrate deploy` run against production; migration history matches `prisma/migrations` in the repo.
- [ ] Environment variables audited for prod vs. preview separation (no shared secrets).
- [ ] Backup/restore drill performed once against a Neon branch (restore to a point-in-time, verify data) to validate NFR-12 before relying on it.
- [ ] Rollback plan documented: Vercel instant rollback to the previous deployment + Neon branch reset if a migration needs to be reverted.
- [ ] Product owner sign-off recorded against this Implementation Plan and all upstream design docs.
