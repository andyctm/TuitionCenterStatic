# Software Requirements Specification (SRS)

## Tuition Center Management System (TCMS)

|              |                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version      | 1.0 (Draft — pending approval)                                                                                                                                                                                                                                                                                                                                                        |
| Status       | **AWAITING SIGN-OFF — no application code will be generated until this and the linked design docs are approved**                                                                                                                                                                                                                                                                      |
| Stack        | Next.js 14+ (App Router), TypeScript, PostgreSQL (Neon), Prisma ORM, GitHub, Vercel                                                                                                                                                                                                                                                                                                   |
| Related docs | [02-architecture.md](./02-architecture.md) · [03-database-design.md](./03-database-design.md) · [04-api-specification.md](./04-api-specification.md) · [05-roles-permissions.md](./05-roles-permissions.md) · [06-sdd.md](./06-sdd.md) · [07-ui-ux-design.md](./07-ui-ux-design.md) · [08-implementation-plan.md](./08-implementation-plan.md) · [09-review-qa.md](./09-review-qa.md) |

---

## 1. Introduction

### 1.1 Purpose

This SRS defines the functional and non-functional requirements for a web-based **Tuition Center Management System** that digitizes student enrollment, class/batch scheduling, and attendance tracking for staff, teachers, students, and parents.

### 1.2 Scope

The system is a single-tenant SaaS-style web application for **one tuition center that may operate multiple branches**. It replaces spreadsheet/manual processes for:

- Student & guardian record-keeping
- Course/batch scheduling and teacher assignment
- Attendance tracking

**Out of scope** (documented so nobody assumes silent inclusion):

- Fees, invoicing, and payment recording — explicitly excluded from this system's scope; fee collection is handled outside TCMS.
- Exams/assessment result recording — explicitly excluded; academic results are handled outside TCMS.
- Study material distribution, announcements, and in-app/email notifications — explicitly excluded.
- Multi-tenant (multiple unrelated tuition centers on one deployment) — single-organization, multi-branch only.
- Native mobile apps — a responsive web app only.
- Video conferencing / online classes — out of scope.

### 1.3 Definitions, Acronyms, Abbreviations

| Term       | Meaning                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------- |
| Center     | The tuition business as a whole (one organization)                                                 |
| Branch     | A physical/operating location of the Center                                                        |
| Batch      | A scheduled group/class of students taking a Course with an assigned Teacher (also called "Class") |
| Enrollment | The link between a Student and a Batch                                                             |
| Session    | A single concrete occurrence of a Batch on a specific date (used for attendance)                   |
| Guardian   | A Parent or legal guardian linked to one or more Students                                          |
| RBAC       | Role-Based Access Control                                                                          |
| JWT        | JSON Web Token                                                                                     |
| SSR        | Server-Side Rendering                                                                              |

### 1.4 Intended Audience

Product owner (tuition center principal), center administrators, developers, QA, and future maintainers.

### 1.5 References

- Next.js App Router docs, Prisma docs, Neon docs (used during implementation; not reproduced here).

---

## 2. Overall Description

### 2.1 Product Perspective

Greenfield system. Browser-based client (Next.js/React) talking to a Next.js API-route backend over HTTPS, backed by Neon (serverless PostgreSQL) via Prisma. Deployed on Vercel; source controlled on GitHub with CI running lint/typecheck/tests on every PR.

### 2.2 User Classes and Characteristics

See [05-roles-permissions.md](./05-roles-permissions.md) for the full matrix. Summary:

| Role                    | Who                              | Technical proficiency | Primary device |
| ----------------------- | -------------------------------- | --------------------- | -------------- |
| Super Admin             | Center owner / system operator   | Medium                | Desktop        |
| Center Admin            | Branch/operations manager        | Medium                | Desktop        |
| Accountant (Front Desk) | Enrollment & front-desk staff    | Low–Medium            | Desktop        |
| Teacher                 | Subject teachers                 | Low–Medium            | Desktop/Tablet |
| Student                 | Enrolled learners (often minors) | Varies                | Mobile-first   |
| Parent/Guardian         | Progress viewer                  | Low                   | Mobile-first   |

### 2.3 Operating Environment

- Modern evergreen browsers (Chrome, Edge, Safari, Firefox — last 2 versions). No IE11 support.
- Responsive design: mobile (360px+), tablet, desktop.
- Hosting: Vercel (serverless functions for API routes, edge/CDN for static assets).
- Database: Neon PostgreSQL (serverless, autoscaling, branching for preview environments).

### 2.4 Design & Implementation Constraints

- Must use Next.js + TypeScript + Prisma + PostgreSQL (Neon) + GitHub + Vercel (mandated by stakeholder).
- Authentication via JWT (access + refresh token pair), not third-party auth-as-a-service, per stakeholder's architecture diagram.
- Must support Vercel's stateless serverless function model (no in-memory session state, no long-lived background workers in-process — see Risk R-01 in [09-review-qa.md](./09-review-qa.md)).

### 2.5 Assumptions and Dependencies

- One timezone per deployment (configurable per Center in Settings) for v1; multi-timezone is a v2 concern.
- Center Admin performs initial data seeding (branches, subjects) — no public self-registration for staff/teacher roles. Students/Parents may self-register but require Admin approval before activation.

---

## 3. Functional Requirements

Requirements are grouped by module and given IDs (`FR-<module>-<n>`) that are traced through to API endpoints, DB entities, and the implementation plan.

### 3.1 Authentication & Account Management (AUTH)

- **FR-AUTH-1**: Users authenticate with email + password; system issues a short-lived JWT access token and a longer-lived rotating refresh token, returned in the JSON response body as bearer tokens (held in memory by the SPA, not a cookie — see [02-architecture.md](./02-architecture.md) v2.0 §5).
- **FR-AUTH-2**: Passwords are stored using a salted, adaptive hash (bcrypt/argon2); never stored or logged in plaintext.
- **FR-AUTH-3**: System supports password reset via time-limited, single-use email token.
- **FR-AUTH-4**: Student/Parent self-registration creates an account in `PENDING` status; a Center Admin must approve before login is permitted.
- **FR-AUTH-5**: All API routes enforce role-based authorization; unauthorized access returns 403 without leaking resource existence.
- **FR-AUTH-6**: Accounts lock temporarily after N consecutive failed login attempts (brute-force mitigation).

### 3.2 Organization & Branch Management (ORG)

- **FR-ORG-1**: Super Admin manages Center-level settings (name, timezone, currency, academic terms).
- **FR-ORG-2**: Super Admin/Center Admin can create, edit, deactivate Branches.
- **FR-ORG-3**: Users (staff/teacher) are scoped to one or more Branches; data queries are branch-filtered for non-Super-Admin roles.

### 3.3 User & Staff Management (USR)

- **FR-USR-1**: Center Admin can create/edit/deactivate staff, teacher, accountant accounts and assign roles + branch scope.
- **FR-USR-2**: Center Admin can view an audit trail of user account changes.
- **FR-USR-3**: Users can view/edit their own profile (name, phone, avatar) and change their password.

### 3.4 Academic Structure (ACAD)

- **FR-ACAD-1**: Admin manages Subjects (name, code) and Grade/Levels (e.g., Grade 6–13).
- **FR-ACAD-2**: Admin manages Courses (Subject × Grade Level combination, e.g., "Grade 10 Mathematics").
- **FR-ACAD-3**: Admin/Teacher-assigning-Admin creates Batches (a scheduled offering of a Course): assigns Teacher, Branch, Room, capacity, term, and a weekly recurring schedule (day/time slots).
- **FR-ACAD-4**: System prevents double-booking: a Teacher or Room cannot have two Batches scheduled with overlapping day/time in the same Branch.
- **FR-ACAD-5**: Admin can close/archive a Batch at term end.

### 3.5 Enrollment (ENR)

- **FR-ENR-1**: Accountant/Admin enrolls a Student into a Batch; system rejects enrollment beyond Batch capacity.
- **FR-ENR-2**: Enrollment has status `ACTIVE`, `COMPLETED`, `WITHDRAWN`.
- **FR-ENR-3**: Withdrawing a student preserves historical enrollment/attendance records for that Batch.
- **FR-ENR-4**: A Student may be enrolled in multiple Batches concurrently.

### 3.6 Attendance (ATT)

- **FR-ATT-1**: System auto-generates a Class Session per Batch per scheduled occurrence (date-materialized from the weekly schedule) within a rolling window.
- **FR-ATT-2**: Teacher marks attendance (`PRESENT`/`ABSENT`/`LATE`/`EXCUSED`) per Student for each Session, with optional remarks.
- **FR-ATT-3**: Teacher can edit attendance for a Session up to 72 hours after the session date (configurable); later edits require Admin override, logged in the audit trail.
- **FR-ATT-4**: Student/Parent can view attendance history and per-batch attendance percentage.
- **FR-ATT-5**: Admin can view attendance reports across batches/branches with export (CSV).

### 3.7 Reporting & Dashboards (RPT)

- **FR-RPT-1**: Each role has a landing dashboard with role-relevant KPIs (e.g., Admin: active students, batches at capacity; Teacher: today's sessions, pending attendance; Student/Parent: next class, recent attendance).
- **FR-RPT-2**: Admin can export core reports (enrollment, attendance) as CSV.

### 3.8 Audit & Compliance (AUD)

- **FR-AUD-1**: All create/update/delete operations on attendance and user-management records write an immutable audit log entry (actor, action, entity, before/after diff, timestamp, IP).
- **FR-AUD-2**: Super Admin/Center Admin can search/filter the audit log.

---

## 4. Non-Functional Requirements

| ID     | Category             | Requirement                                                                                                                                    |
| ------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1  | Performance          | P95 API response time < 400ms for read endpoints under nominal load (Neon cold-start excluded, see Risk R-02).                                 |
| NFR-2  | Scalability          | Support ≥ 5,000 students, ≥ 200 concurrent staff/teacher users per Center without architectural change.                                        |
| NFR-3  | Availability         | Target 99.5% uptime (bounded by Vercel/Neon SLAs); graceful degradation with user-facing error states on backend failure.                      |
| NFR-4  | Security             | OWASP Top 10 mitigations (see [09-review-qa.md](./09-review-qa.md)); all traffic over HTTPS; secrets never in client bundle or source control. |
| NFR-5  | Data Privacy         | Student/guardian PII access is role-scoped and branch-scoped; exportable data limited to authorized roles.                                     |
| NFR-6  | Accessibility        | WCAG 2.1 AA for all authenticated app screens (contrast, keyboard nav, focus states, form labeling).                                           |
| NFR-7  | Usability            | Core staff workflows (mark attendance, enroll a student) completable in ≤ 3 clicks/taps from the relevant dashboard.                           |
| NFR-8  | Maintainability      | Strict TypeScript (`strict: true`, no implicit `any`), Prisma as single source of DB schema truth, ESLint + Prettier enforced in CI.           |
| NFR-9  | Auditability         | Attendance and user-management mutations are traceable to an actor and timestamp (see FR-AUD-1).                                               |
| NFR-10 | Internationalization | UI text centralized (not hardcoded inline) to allow future localization, even though v1 ships English-only.                                    |
| NFR-11 | Browser support      | Latest 2 versions of Chrome, Edge, Firefox, Safari; iOS Safari and Android Chrome for mobile.                                                  |
| NFR-12 | Backup & Recovery    | Neon point-in-time restore relied upon; documented RPO ≤ 24h, RTO ≤ 4h for v1 (see Deployment Checklist).                                      |

---

## 5. External Interface Requirements

- **UI**: Responsive web app, see [07-ui-ux-design.md](./07-ui-ux-design.md).
- **API**: JSON REST over HTTPS, see [04-api-specification.md](./04-api-specification.md).
- **Database**: PostgreSQL via Prisma Client, see [03-database-design.md](./03-database-design.md).
- **Email**: Transactional email provider (e.g., Resend/SendGrid) for password reset emails (integration detail decided in implementation plan).

---

## 6. Traceability Note

Every `FR-*` ID above is re-referenced in [06-sdd.md](./06-sdd.md) (capability specs), [04-api-specification.md](./04-api-specification.md) (endpoint mapping), and [08-implementation-plan.md](./08-implementation-plan.md) (module tasks + tests) so a requirement can be followed end-to-end from spec → design → code → test.

---

## 7. Approval Gate

> **No implementation code will be written until this SRS, the SDD, Database Design, API Specification, Roles & Permissions matrix, and UI/UX design are explicitly approved by the product owner.** See [00-index.md](./00-index.md) for the sign-off checklist.
