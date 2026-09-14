# Tuition Center Management System — Design Index

**Status: APPROVED — implementation in progress starting with Module M0 (see [08-implementation-plan.md](./08-implementation-plan.md)).**

This folder contains the complete pre-implementation design package requested for the TCMS: SRS, Architecture, Database Design, API Specification, Roles & Permissions, SDD, UI/UX Design, Implementation Plan, and a Senior Dev/QA review. Read in this order:

1. [01-srs.md](./01-srs.md) — Software Requirements Specification (scope, functional/non-functional requirements)
2. [02-architecture.md](./02-architecture.md) — Architecture diagram, deployment topology, request/auth flows
3. [03-database-design.md](./03-database-design.md) — ERD + Prisma schema (design artifact)
4. [04-api-specification.md](./04-api-specification.md) — Full REST endpoint list, conventions, error model
5. [05-roles-permissions.md](./05-roles-permissions.md) — Roles, permission matrix, worked failure-mode examples
6. [06-sdd.md](./06-sdd.md) — Software Design Document, OpenSpec-style capability specs (requirements + scenarios)
7. [07-ui-ux-design.md](./07-ui-ux-design.md) — UI/UX shape (impeccable "Operate" mode): IA, tokens, key screens, a11y
8. [08-implementation-plan.md](./08-implementation-plan.md) — Module-by-module plan (Requirement → Solution Design → Tasks → Code Review → Unit/Integration/UAT Tests → Risk → Deployment Checklist)
9. [09-review-qa.md](./09-review-qa.md) — Senior dev/QA critique, consolidated risk register, OWASP mapping

---

## Resolved — Risk R-00 (superseded 2026-09-14)

**Risk R-00** ([09-review-qa.md](./09-review-qa.md) §4): the product owner initially confirmed the Next.js monolith, then reversed that decision the same day — the actual intended architecture is a **static SPA (vanilla HTML/CSS/JS, evolved from `mockups/`) hosted on GitHub Pages, plus a separate Node.js/Express REST API hosted on Render**, talking to Neon Postgres. See [02-architecture.md](./02-architecture.md) §1 for the updated design. No Next.js code was ever generated, so nothing needed to be rolled back — only the design docs were reworked.

## Existing data note

A separate, simpler prototype schema (Drizzle-managed: `classes`/`teachers`/`students`/`schedule`) already exists and was seeded from `tuition_school_dummy_data.xlsx` into the Neon project `TuitionCenter` (`steep-pine-14221605`) per an earlier ad-hoc request. It is **not** this design — see [03-database-design.md](./03-database-design.md)'s note and [08-implementation-plan.md](./08-implementation-plan.md) Module M2's "seed-data import" task, which migrates those rows into the full schema rather than discarding them.

---

## Sign-off checklist

- [x] SRS approved
- [x] Architecture approved (incl. R-00 resolved)
- [x] Database Design + ERD approved
- [x] API Specification approved
- [x] Roles & Permissions approved
- [x] SDD approved
- [x] UI/UX design approved
- [x] Implementation Plan approved
- [x] Senior Dev/QA review acknowledged

**Approved by product owner on 2026-09-14. Implementation begins at Module M0 in [08-implementation-plan.md](./08-implementation-plan.md).**
