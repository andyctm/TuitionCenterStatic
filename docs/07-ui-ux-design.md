# UI/UX Design

## Tuition Center Management System (TCMS)

|             |                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Version     | 1.0 (Draft — pending approval)                                                                                                   |
| Perspective | Senior UI/UX Designer (applying the **impeccable** skill's "Operate" mode — this is a task-completion app, not a marketing site) |
| Related     | [01-srs.md](./01-srs.md) · [05-roles-permissions.md](./05-roles-permissions.md)                                                  |

> This is the **shape** phase (plan before code): information architecture, design tokens, and screen-level layout decisions. No component code is generated yet — actual pixel-level craft (the `impeccable` skill's `craft-floor` quality bar, live screenshots, micro-polish) happens once this shape is approved and implementation begins on a real Next.js project.

---

## 1. Design Mode

**Operate**, per impeccable's mode taxonomy: the visitor (staff/teacher/student/parent) is here to _complete a task_ — mark attendance, check a schedule, enroll a student — not to be persuaded or entertained. Design priorities in order: **scanability > consistency > native platform expectations > brand expression**. Brand personality shows up in precise details (color use for status, a confident type scale, calm empty states) rather than loud visual flourishes.

### Why Operate, not Persuade

A tuition center's internal staff tool and a parent's attendance-checking view are both repeat-use, task-driven surfaces. Optimizing for "delight on first view" (Persuade-mode thinking) would trade away the information density and low-friction repetition that daily users need. Risk of getting this wrong: a beautiful-but-slow attendance-marking flow actively costs teachers time every single school day — the opposite of the point of the system.

---

## 2. Design Tokens

### 2.1 Color

| Token                     | Value                          | Usage                                           |
| ------------------------- | ------------------------------ | ----------------------------------------------- |
| `--color-primary`         | `#1E4B8F` (deep academic blue) | Primary actions, active nav, links              |
| `--color-primary-hover`   | `#163A6E`                      | Hover/pressed state                             |
| `--color-accent`          | `#E8A33D` (warm amber)         | Secondary emphasis, highlights (used sparingly) |
| `--color-success`         | `#1D8A5C`                      | PRESENT, ACTIVE statuses                        |
| `--color-warning`         | `#B8860B`                      | LATE, PENDING statuses                          |
| `--color-danger`          | `#C0392B`                      | ABSENT, error states                            |
| `--color-neutral-900..50` | Slate scale                    | Text, borders, surfaces                         |

**Why a status-driven palette**: this system's core UI job is communicating _state_ (is this student present? is this batch full?) at a glance across dense tables. A consistent success/warning/danger mapping used identically for attendance and enrollment status means a user who learns the color code once reads every screen faster. Risk: color alone fails colorblind users (~8% of men) — every status also carries a text label and, in tables, an icon (see §6 Accessibility).

### 2.2 Typography

| Token         | Value                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `--font-sans` | Inter (UI text) — high x-height, clean tabular numerals                                                                 |
| `--font-mono` | JetBrains Mono (student/reference codes only)                                                                           |
| Scale         | 12 / 14 / 16 / 20 / 24 / 32 (px) — a restrained 6-step scale; body text defaults to 14px in dense tables, 16px in forms |

### 2.3 Spacing & Layout

- 4px base unit, spacing scale 4/8/12/16/24/32/48.
- App shell: fixed left sidebar (240px, collapsible to icon rail on tablet) + top bar (breadcrumb, user menu) + content area with a 1280px max content width on desktop, full-bleed tables below that.
- Mobile (< 640px): sidebar collapses to a bottom tab bar (max 5 items) for Student/Parent roles specifically, since they are mobile-first personas (SRS §2.2); Admin/Teacher/Accountant retain a hamburger-triggered drawer since they're desktop-first.

---

## 3. Information Architecture per Role

| Role         | Primary nav items                                                                 |
| ------------ | --------------------------------------------------------------------------------- |
| Super Admin  | Dashboard · Branches · Users · Courses · Batches · Reports · Audit Log · Settings |
| Center Admin | Dashboard · Batches · Enrollment · Attendance · Reports                           |
| Accountant   | Dashboard · Enrollment · Reports                                                  |
| Teacher      | Dashboard (today's sessions) · My Batches · Attendance                            |
| Student      | Home (next class) · Schedule · Attendance                                         |
| Parent       | Home (per-child switcher) · Schedule · Attendance                                 |

**Why per-role navigation instead of one universal menu with permission-hidden items**: a single shared nav tree with items grayed out/hidden per permission (common shortcut) still forces every role to mentally parse a menu shaped for someone else's job. A Teacher does not think in terms of "Branches" or "Audit Log" — giving each role a nav built around _their_ job vocabulary reduces cognitive load (NFR-7: ≤3 clicks to core actions). Risk: six nav trees to maintain instead of one; mitigated by building the nav as declarative role→item config, not six hand-coded components.

---

## 4. Key Screens (layout intent, not final pixels)

### 4.1 Teacher — "Today" Dashboard

- Hero row: today's date + a horizontal list of today's session cards (batch name, time, room), each with a single primary action **"Mark Attendance"** if not yet done, or a subtle "✓ Marked" state if complete.
- Below: "Pending" panel — unmarked attendance older than today (flagged in `--color-warning`).
- **Why cards over a table here**: a teacher has at most a handful of sessions per day; a scannable card row gets them to the one action they need (mark attendance) faster than a dense table would, which is optimized for browsing many rows, not picking one of five.

### 4.2 Attendance Marking Screen

- Roster table: student photo-initial avatar, name, a 4-state segmented control (Present/Absent/Late/Excused) defaulting to Present (opt-out is faster than opt-in for the common case), remarks field revealed only when non-Present is selected (progressive disclosure — keeps the default path uncluttered).
- Sticky save bar at the bottom showing "23 of 25 marked" and a single "Save Attendance" button — disabled until all students have a status, to prevent partial/forgotten submissions (an explicit UX guard against FR-ATT-2's completeness expectation).
- Past-window edit attempt: instead of silently disabling controls, show an inline banner "This session is outside the 72-hour edit window — request an admin override" with a link, so the teacher understands _why_, not just that something is disabled.

### 4.3 Accountant — Enrollment Screen

- Enrollment list defaults to a filter of `status = ACTIVE` for the accountant's assigned branch(es) — the actionable subset for day-to-day front-desk work.
- Enrolling a student opens a focused modal (student search, batch picker showing live seat counts) rather than a full navigation away — this is a high-frequency, short task that shouldn't cost a page load.
- Over-capacity attempts show the error inline next to the batch picker immediately (client-side check mirroring the server rule), before the user even submits, cutting round-trips.

### 4.4 Parent — Home

- Child switcher (if >1 linked student) as a persistent top-of-content tab strip, not a dropdown buried in settings — switching children is the single most frequent action for multi-child parents.
- Next-class card is the single most prominent element (batch name, time, room) since "when is my child's next class" is the #1 reason parents open the app.

---

## 5. Empty, Loading, and Error States

- **Empty**: every empty list state names the _reason_ and the _next action_ ("No batches yet — create your first batch" with the CTA inline), never a bare "No data."
- **Loading**: skeleton rows matching the eventual table shape (not a generic spinner) for anything above ~300ms, to preserve layout stability and perceived speed.
- **Error (network/500)**: a retry-capable inline error card, never a full-page crash; the app shell (nav, header) stays interactive.
- **Validation errors**: inline, next to the field, in plain language derived from the same zod schema messages used server-side (single source of truth — see [02-architecture.md](./02-architecture.md) §6).

---

## 6. Accessibility (WCAG 2.1 AA — NFR-6)

- Every status color pairs with a text label and, in compact table cells, a small icon (✔/●/✖) so color is never the only channel.
- All interactive controls reachable and operable via keyboard; focus rings visible (never `outline: none` without a replacement).
- Form fields have explicit `<label>`s (not placeholder-only labels, which disappear on input and fail low-vision users).
- Minimum contrast 4.5:1 for body text, 3:1 for large text/icons — verified against the token palette above (deep blue on white, amber reserved for accents, not body text on light backgrounds).
- Segmented attendance controls and touch targets ≥ 44×44px on mobile (teachers may mark attendance from a tablet in a classroom).

---

## 7. Responsive Behavior

| Breakpoint          | Layout change                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ≥ 1024px (desktop)  | Fixed sidebar + content, tables show all columns                                                                                                             |
| 640–1023px (tablet) | Collapsible icon-rail sidebar; secondary table columns collapse into an expandable row detail                                                                |
| < 640px (mobile)    | Student/Parent: bottom tab bar, single-column cards instead of tables. Admin/Teacher/Accountant: hamburger drawer, same card-based collapse for dense tables |

---

## 8. Risks in This Design (for [09-review-qa.md](./09-review-qa.md))

- **Six separate nav configs** increase the surface area for "this role can't find X" bugs during QA — mitigated by a single declarative config object, not six components, and an explicit QA pass per role (see UAT scenarios per module).
- **Segmented attendance control defaulting to Present** speeds the common case but risks a teacher rushing through and missing a genuinely absent student — mitigated by requiring every row to be explicitly touched-or-confirmed before the completeness counter allows Save (exact UX mechanism to be finalized with the product owner during implementation).
- **Card-based mobile collapse** for dense admin tables (enrollment) may hide information admins are used to scanning in bulk — flagged as a UAT scenario to validate with an actual Center Admin before shipping.

---

## 9. Approval Gate

This UI/UX shape must be approved before any component code, and before running the full `impeccable` live-craft workflow (screenshots, pixel-level polish) against a real Next.js implementation.
