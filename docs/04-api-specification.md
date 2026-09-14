# API Specification

## Tuition Center Management System (TCMS)

|          |                                                                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version  | 2.0 (Reworked 2026-09-14 — decoupled architecture)                                                                                                 |
| Base URL | `https://<api-host>.onrender.com/api` (separate origin from the GitHub Pages frontend)                                                             |
| Format   | JSON over HTTPS, `Content-Type: application/json`                                                                                                  |
| Auth     | JWT access token as a bearer token (`Authorization: Bearer <token>`), held in memory on the SPA; see [02-architecture.md](./02-architecture.md) §5 |
| CORS     | API allow-lists the exact GitHub Pages origin(s); no credentials mode needed (bearer, not cookie, auth)                                            |
| Related  | [01-srs.md](./01-srs.md) · [05-roles-permissions.md](./05-roles-permissions.md) · [03-database-design.md](./03-database-design.md)                 |

---

## 1. Conventions

### 1.1 Standard response envelope

```json
// Success
{ "data": { /* resource or array */ }, "meta": { "page": 1, "pageSize": 20, "total": 137 } }

// Error
{ "error": { "code": "VALIDATION_ERROR", "message": "amount must be positive", "details": [ { "field": "amount", "issue": "..." } ] } }
```

### 1.2 Standard error codes

| HTTP | `error.code`              | Meaning                                                             |
| ---- | ------------------------- | ------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`        | Request body/query failed zod schema validation                     |
| 401  | `UNAUTHENTICATED`         | Missing/expired/invalid JWT                                         |
| 403  | `FORBIDDEN`               | Authenticated but not permitted for this resource/action            |
| 404  | `NOT_FOUND`               | Resource doesn't exist (or is out of the caller's scope — see note) |
| 409  | `CONFLICT`                | e.g., double-booking, over-capacity enrollment, duplicate email     |
| 422  | `BUSINESS_RULE_VIOLATION` | e.g., editing attendance outside window without override            |
| 429  | `RATE_LIMITED`            | Too many requests (notably `/api/auth/*`)                           |
| 500  | `INTERNAL_ERROR`          | Unhandled server error (logged, generic message to client)          |

> **Security note**: a resource that exists but is out of the caller's branch/ownership scope returns **404**, not 403, to avoid confirming the resource's existence to an unauthorized party (prevents enumeration/IDOR probing). Resources the caller's _role_ can never access at all (e.g., a Student calling a staff-only endpoint) return **403**.

### 1.3 Pagination

List endpoints accept `?page=1&pageSize=20&sort=-createdAt` and return `meta.total`.

### 1.4 Idempotency

Enrollment creation (`POST /api/enrollments`) accepts an optional `Idempotency-Key` header so a retried request near a batch's capacity limit doesn't risk a confusing duplicate-vs-rejected outcome on flaky networks.

---

## 2. Authentication (`/api/auth`)

| Method | Path                        | Role                                 | Description                                                                                                          |
| ------ | --------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/auth/register`        | Public                               | Student/Parent self-registration → creates `User` with `status=PENDING` (FR-AUTH-4)                                  |
| POST   | `/api/auth/login`           | Public                               | Email+password → returns `{ accessToken, refreshToken, user }` in the JSON body (no cookies set)                     |
| POST   | `/api/auth/logout`          | Any authenticated                    | Revokes the given refresh token (client discards its in-memory tokens)                                               |
| POST   | `/api/auth/refresh`         | Public (valid refresh token in body) | Issues a new access token (rotates refresh token); client sends `{ refreshToken }` in the request body, not a cookie |
| POST   | `/api/auth/forgot-password` | Public                               | Sends reset email with single-use token                                                                              |
| POST   | `/api/auth/reset-password`  | Public (valid token)                 | Sets new password                                                                                                    |
| GET    | `/api/auth/me`              | Any authenticated                    | Returns current user profile + role + branch scope                                                                   |

## 3. Users & Staff (`/api/users`)

| Method | Path                             | Role                                                  | Description                                         |
| ------ | -------------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| GET    | `/api/users`                     | Super Admin, Center Admin                             | List users (filter by role, branch, status)         |
| POST   | `/api/users`                     | Super Admin, Center Admin                             | Create staff/teacher account                        |
| GET    | `/api/users/:id`                 | Super Admin, Center Admin, self                       | Get user detail                                     |
| PATCH  | `/api/users/:id`                 | Super Admin, Center Admin, self (profile fields only) | Update user                                         |
| PATCH  | `/api/users/:id/status`          | Super Admin, Center Admin                             | Approve pending registration / suspend / deactivate |
| POST   | `/api/users/:id/change-password` | self                                                  | Change own password                                 |

## 4. Branches (`/api/branches`)

| Method | Path                | Role                       | Description            |
| ------ | ------------------- | -------------------------- | ---------------------- |
| GET    | `/api/branches`     | Any authenticated (scoped) | List branches in scope |
| POST   | `/api/branches`     | Super Admin                | Create branch          |
| GET    | `/api/branches/:id` | Scoped                     | Get branch detail      |
| PATCH  | `/api/branches/:id` | Super Admin                | Update branch settings |

## 5. Academic Structure (`/api/subjects`, `/api/grade-levels`, `/api/courses`)

| Method       | Path                | Role                    | Description                             |
| ------------ | ------------------- | ----------------------- | --------------------------------------- |
| GET/POST     | `/api/subjects`     | Read: all; Write: Admin | Manage subjects                         |
| GET/POST     | `/api/grade-levels` | Read: all; Write: Admin | Manage grade levels                     |
| GET/POST     | `/api/courses`      | Read: all; Write: Admin | Manage subject×grade course definitions |
| PATCH/DELETE | `/api/courses/:id`  | Admin                   | Update/retire a course                  |

## 6. Batches & Scheduling (`/api/batches`)

| Method | Path                                     | Role                         | Description                                                  |
| ------ | ---------------------------------------- | ---------------------------- | ------------------------------------------------------------ |
| GET    | `/api/batches`                           | Scoped (branch/own/enrolled) | List batches with filters (branch, course, status, term)     |
| POST   | `/api/batches`                           | Admin                        | Create a batch (FR-ACAD-3)                                   |
| GET    | `/api/batches/:id`                       | Scoped                       | Batch detail incl. schedule + enrollment count               |
| PATCH  | `/api/batches/:id`                       | Admin                        | Update capacity, teacher, room, status                       |
| POST   | `/api/batches/:id/schedules`             | Admin                        | Add a recurring weekly slot — **409** on overlap (FR-ACAD-4) |
| DELETE | `/api/batches/:id/schedules/:scheduleId` | Admin                        | Remove a slot                                                |
| POST   | `/api/batches/:id/archive`               | Admin                        | Archive at term end (FR-ACAD-5)                              |

## 7. Enrollment (`/api/enrollments`)

| Method | Path                   | Role                                             | Description                                                |
| ------ | ---------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| GET    | `/api/enrollments`     | Admin, Accountant (branch); Student/Parent (own) | List enrollments                                           |
| POST   | `/api/enrollments`     | Admin, Accountant                                | Enroll a student — **409** if batch at capacity (FR-ENR-1) |
| PATCH  | `/api/enrollments/:id` | Admin, Accountant                                | Change status (withdraw/complete)                          |

## 8. Class Sessions & Attendance

| Method | Path                                    | Role                                         | Description                                                                                    |
| ------ | --------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| GET    | `/api/batches/:id/sessions`             | Scoped                                       | List materialized sessions for a batch                                                         |
| POST   | `/api/batches/:id/sessions`             | Admin, Teacher (own batch)                   | Create an ad-hoc session (deviating from recurring pattern)                                    |
| GET    | `/api/sessions/:id/attendance`          | Scoped                                       | Get attendance roster for a session                                                            |
| PUT    | `/api/sessions/:id/attendance`          | Teacher (own batch, within edit window)      | Bulk upsert attendance for all enrolled students (FR-ATT-2)                                    |
| POST   | `/api/sessions/:id/attendance/override` | Admin                                        | Force-edit attendance outside the window — **requires `reason`**, writes `AuditLog` (FR-ATT-3) |
| GET    | `/api/students/:id/attendance`          | Admin/Teacher (scoped), Student/Parent (own) | Attendance history + percentage (FR-ATT-4)                                                     |

## 9. Dashboards & Reporting

| Method | Path                      | Role              | Description                                        |
| ------ | ------------------------- | ----------------- | -------------------------------------------------- |
| GET    | `/api/dashboard/summary`  | Any authenticated | Role-appropriate KPI payload (FR-RPT-1)            |
| GET    | `/api/reports/enrollment` | Admin             | Enrollment report, CSV export supported (FR-RPT-2) |     | GET | `/api/reports/attendance` | Admin | Attendance report, CSV export supported (FR-RPT-2) — added during M5 implementation to close a gap left by the original spec, which named "enrollment, attendance" as the two exportable reports in FR-RPT-2 but only listed the enrollment route here |

## 10. Audit

| Method | Path              | Role                                      | Description                          |
| ------ | ----------------- | ----------------------------------------- | ------------------------------------ |
| GET    | `/api/audit-logs` | Super Admin, Center Admin (branch-scoped) | Search/filter audit trail (FR-AUD-2) |

## 11. Internal/System

| Method | Path                                      | Role                                    | Description                                                            |
| ------ | ----------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| GET    | `/api/health`                             | Public (for uptime monitors)            | DB connectivity check                                                  |
| POST   | `/api/internal/jobs/materialize-sessions` | Shared-secret header (Vercel Cron only) | Generates upcoming `ClassSession` rows from `ClassSchedule` (FR-ATT-1) |

---

## 12. Example: Enroll a Student

**Request**

```
POST /api/enrollments
Content-Type: application/json
Idempotency-Key: 8f14e45f-...

{
  "batchId": "batch_c002",
  "studentProfileId": "stu_042"
}
```

**Response `201`**

```json
{
  "data": {
    "enrollment": {
      "id": "enr_7a1c",
      "batchId": "batch_c002",
      "studentProfileId": "stu_042",
      "status": "ACTIVE",
      "enrolledAt": "2026-09-14T10:22:00Z"
    }
  }
}
```

**Response `409` (batch at capacity)**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Batch has reached its enrollment capacity",
    "details": [{ "field": "batchId", "issue": "capacity 20/20 reached" }]
  }
}
```

---

## 13. Rate Limiting

`/api/auth/login`, `/api/auth/forgot-password`: 5 requests / 15 min per IP+email combination → `429 RATE_LIMITED` (FR-AUTH-6, OWASP A07).

---

## 14. Approval Gate

This API surface must be approved alongside [03-database-design.md](./03-database-design.md) and [05-roles-permissions.md](./05-roles-permissions.md) — endpoint shapes are finalized here before any route handler code is written.
