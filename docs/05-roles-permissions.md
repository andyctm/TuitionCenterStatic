# Roles & Permissions Matrix

## Tuition Center Management System (TCMS)

|         |                                                                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Version | 1.0 (Draft — pending approval)                                                                                                     |
| Related | [01-srs.md](./01-srs.md) · [03-database-design.md](./03-database-design.md) · [04-api-specification.md](./04-api-specification.md) |

---

## 1. Role Definitions

| Role           | Scope                         | Description                                                                           |
| -------------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| `SUPER_ADMIN`  | Whole Center (all branches)   | System owner. Manages branches, global settings, all users including other admins.    |
| `CENTER_ADMIN` | One or more assigned Branches | Day-to-day operations manager: staff, courses, batches, reports for their branch(es). |
| `ACCOUNTANT`   | One or more assigned Branches | Front-desk/enrollment staff.                                                          |
| `TEACHER`      | Own assigned Batches only     | Marks attendance for batches they teach.                                              |
| `STUDENT`      | Own record only               | Views own schedule and attendance.                                                    |
| `PARENT`       | Own linked children only      | Views linked students' schedule and attendance.                                       |

### Why these six and not a dynamic permission engine

Tuition-center operations map cleanly onto a small, stable set of roles; a configurable permission engine (custom roles, per-field ACLs) is speculative complexity with no observed requirement. See [03-database-design.md](./03-database-design.md) §1 and [09-review-qa.md](./09-review-qa.md) for the documented v2 seam if that ever changes.

---

## 2. Permission Matrix

Legend: **C**reate · **R**ead · **U**pdate · **D**elete · `own` = restricted to the actor's own/linked records · `branch` = restricted to the actor's assigned branch(es) · — = no access

| Resource                       | Super Admin | Center Admin                        | Accountant                            | Teacher                        | Student      | Parent      |
| ------------------------------ | ----------- | ----------------------------------- | ------------------------------------- | ------------------------------ | ------------ | ----------- |
| Branch                         | CRUD        | R (own branch), U (settings)        | R (own branch)                        | R (own branch)                 | —            | —           |
| User (staff/teacher accounts)  | CRUD        | CRUD (branch)                       | R (branch)                            | R (self)                       | —            | —           |
| User (student/parent accounts) | CRUD        | CRUD (branch), approve registration | CR (branch), approve registration     | R (own batch students)         | RU (own)     | RU (own)    |
| Subject / GradeLevel / Course  | CRUD        | CRUD                                | R                                     | R                              | R            | R           |
| Batch                          | CRUD        | CRUD (branch)                       | R (branch), U (enroll count)          | R (own)                        | R (enrolled) | R (child's) |
| ClassSchedule                  | CRUD        | CRUD (branch)                       | R (branch)                            | R (own)                        | R (enrolled) | R (child's) |
| Enrollment                     | CRUD        | CRUD (branch)                       | CRUD (branch)                         | R (own batch)                  | R (own)      | R (child's) |
| ClassSession                   | CRUD        | CRUD (branch)                       | R (branch)                            | RU (own, materialize/cancel)   | R (enrolled) | R (child's) |
| Attendance                     | CRUD        | RU (branch, override after window)  | R (branch)                            | CRU (own batch, within window) | R (own)      | R (child's) |
| AuditLog                       | R (all)     | R (branch)                          | —                                     | —                              | —            | —           |
| Reports/Export                 | All         | Branch-scoped                       | Branch-scoped (enrollment/attendance) | Own batch only                 | —            | —           |

---

## 3. Worked Examples (concrete failure modes)

| Scenario                                                                                              | Actor                                                                         | Expected outcome                                                                                            | What breaks without this rule                                                                                                                                |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A Teacher at Branch "Colombo" tries to mark attendance for a Batch at Branch "Kandy"                  | Teacher `Mr. Perera` (assigned to Colombo only, not teaching the Kandy batch) | 403 Forbidden — not the assigned teacher for that batch                                                     | Without batch-ownership check, any teacher could tamper with another teacher's attendance, corrupting records used for parent-facing reports                 |
| A Parent requests `/api/students/S099/attendance` for a child that is not linked to them              | Parent `Mrs. Silva`, linked only to student `S042`                            | 403 Forbidden (not 404, but also not leaking existence details beyond a generic denial)                     | Without the `ParentStudent` link check, any authenticated parent could view another family's attendance/PII data — a serious privacy breach                  |
| A Center Admin for Branch "Galle" tries to view an Accountant's audit log entries from Branch "Kandy" | Center Admin scoped only to Galle                                             | Log entries from Kandy are filtered out of the result set                                                   | Without branch-scoping on `AuditLog` reads, cross-branch data leakage occurs even for legitimate admins who shouldn't see other branches' operational detail |
| An Accountant tries to enroll a student into a batch at another Branch they aren't assigned to        | Accountant `Ms. Fernando`, assigned only to Branch "Colombo"                  | 404 Not Found — the Kandy batch is out of scope                                                             | Without branch-scoping on enrollment writes, front-desk staff at one branch could silently modify another branch's roster                                    |
| A Teacher tries to edit attendance for a session that occurred 10 days ago                            | Teacher, no admin override flag                                               | 403 Forbidden — outside the 72h edit window (FR-ATT-3); must request Center Admin override, which is logged | Without the window + override log, late "corrections" to attendance become untraceable and open to abuse                                                     |

---

## 4. Authorization Enforcement Points

1. **Middleware** — decodes JWT, rejects if no valid session (401).
2. **Route-level guard** — a declarative `requireRole([...])` wrapper on every API route handler (403 if role not permitted at all).
3. **Service-layer scoping** — every query passes through `scopeToBranches()` / `scopeToOwn()` helpers so even a permitted role cannot fetch out-of-scope rows by ID-guessing (IDOR prevention — OWASP A01 Broken Access Control).
4. **UI-level hiding** — role-aware navigation/menus hide actions the user cannot perform (UX only; never the sole enforcement — server-side checks are authoritative).

---

## 5. Approval Gate

This matrix must be approved together with [01-srs.md](./01-srs.md) and the [04-api-specification.md](./04-api-specification.md) endpoint list before implementation.
