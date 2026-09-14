# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Full application (future, gated behind design sign-off): Next.js 14+ (App Router), TypeScript,
Prisma ORM, Neon PostgreSQL, GitHub, Vercel (mandated by stakeholder in Prompt.txt / docs/01-srs.md).
This current phase (per explicit user request) builds only static HTML/CSS/JS visual mockups of the
web GUI — no framework, no data wiring, no backend — for stakeholder approval before any Next.js code
is written, per docs/00-index.md's approval gate.

## Users

Six roles, all reached via the same responsive web app (docs/05-roles-permissions.md):

- **Super Admin** — center owner/system operator. Desktop-first, medium proficiency. Manages
  branches, users, courses, org-wide settings.
- **Center Admin** — branch/operations manager. Desktop-first, medium proficiency. Manages batches,
  enrollment, attendance oversight, reports for their branch(es).
- **Accountant (Front Desk)** — enrollment/front-desk staff. Desktop-first, low-medium proficiency.
  High-frequency enrollment task.
- **Teacher** — subject teachers. Desktop/tablet, low-medium proficiency. Daily attendance marking is
  the core repeat task.
- **Student** — enrolled learners, often minors. Mobile-first. Checks schedule/attendance.
- **Parent/Guardian** — progress viewer, may have multiple linked children. Mobile-first, low
  proficiency. Primary need: "when is my child's next class."

## Product Purpose

Digitizes student enrollment, class/batch scheduling, and attendance tracking for a single tuition
business that may operate multiple physical branches, replacing spreadsheet/manual processes
(docs/01-srs.md §1.1-1.2).

## Positioning

A single-tenant, multi-branch academic-operations tool scoped tightly to enrollment/scheduling/
attendance — explicitly NOT fees/invoicing, NOT exam/result recording, NOT notifications, NOT
multi-tenant SaaS. That narrow scope is a deliberate choice (docs/01-srs.md §1.2 "Out of scope") so
the product can be simple and fast at the three jobs it does own, rather than a generic all-in-one
school ERP.

## Operating Context

- Teachers mark attendance once per session per batch, often from a tablet in a classroom, within a
  72-hour edit window (docs/07-ui-ux-design.md §4.2).
- Front-desk accountants enroll students into batches with live seat-count checks against a hard
  capacity limit.
- Parents check a per-child schedule/attendance view, switching between children when they have more
  than one enrolled.
- Center/Super Admins configure branches, courses, batches (weekly recurring schedule, teacher/room
  assignment) and review reports.
- Student/Parent accounts self-register but require Admin approval (`PENDING` status) before login.

## Capabilities and Constraints

- Modern evergreen browsers only (Chrome, Edge, Safari, Firefox — last 2 versions), no IE11.
- Responsive from 360px mobile up through desktop (docs/01-srs.md §2.3).
- Six distinct role-scoped navigation trees rather than one universal permission-hidden menu — see
  docs/07-ui-ux-design.md §3 for the rationale.
- Status-driven color system (present/absent/late/excused; active/pending) is a core recurring UI
  vocabulary reused across attendance and enrollment screens.
- Undecided: exact copy/microcopy, real student/teacher names and photos (mockups will use
  representative placeholder data, not fabricated "real" testimonials).

## Brand Commitments

No existing brand identity, logo, or name beyond "Tuition Center Management System (TCMS)". Visual
direction (color tokens, type scale, spacing) is already specified in docs/07-ui-ux-design.md §2 and
is treated as the binding visual authority for this build — see that doc before inventing a new
palette.

## Evidence on Hand

- docs/07-ui-ux-design.md — approved-pending design tokens, IA, key screen layout intent, a11y and
  responsive rules. Primary visual authority for this build.
- docs/01-srs.md, docs/05-roles-permissions.md — functional requirements and full role/permission
  matrix.
- docs/04-api-specification.md, docs/03-database-design.md — data shapes to inform realistic mock
  content (field names, statuses, entities) even though this phase has no real API.
- tuition_school_dummy_data.xlsx (repo root) — real-shaped sample data (classes, teachers, students,
  schedule) usable as representative placeholder content in mockups.
- No real photos/logos on hand — mockups use initials/avatars and neutral placeholder imagery per
  docs/07-ui-ux-design.md's avatar treatment.

## Product Principles

1. Scanability over decoration — every screen's job is to get one task done fast, not to impress on
   first view (Operate mode, not Persuade).
2. One consistent status color vocabulary (success/warning/danger) reused everywhere, always paired
   with text/icon, never color alone.
3. Role-specific navigation and IA, not one shared menu with hidden items — each role sees only their
   own job's vocabulary.
4. Progressive disclosure for the uncommon case (e.g., remarks field only appears for non-Present
   attendance) keeps the default fast path uncluttered.
5. Mobile-first for Student/Parent, desktop-first for staff/Admin/Teacher/Accountant — the two device
   populations get genuinely different shell layouts, not one shell squeezed to fit both.

## Accessibility & Inclusion

WCAG 2.1 AA (NFR-6): 4.5:1 body text contrast, 3:1 for large text/icons; color never the only status
channel; explicit `<label>`s (no placeholder-only labels); visible focus rings; ≥44×44px touch targets
on mobile controls (docs/07-ui-ux-design.md §6).
