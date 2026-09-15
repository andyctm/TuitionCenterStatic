# Design

<!-- impeccable:design-schema 1 -->

## World

Operate-mode enterprise admin/portal system for a single-tenant, multi-branch tuition center.
Visual authority is pinned by docs/07-ui-ux-design.md — this file records what was actually built,
first as a visual mockup and now as the real static SPA in `frontend/` (see docs/00-index.md /
docs/02-architecture.md for the decoupled-architecture decision), not a new invention. Restrained color strategy: neutral slate surfaces, one primary
(deep academic blue) for actions/navigation, status colors reserved for state (attendance/enrollment),
amber accent used sparingly (never as body text).

## Palette

- Primary: `#1E4B8F` (hover `#163A6E`), tint `#E8EFFA` for active-nav / selected backgrounds.
- Accent: `#E8A33D` (used only for the login hero gradient glow and index-page kickers — never body text).
- Status: success `#1D8A5C`, warning `#B8860B`, danger `#C0392B`, info `#3B6E9E` — each with a matching
  10–15% tint background for badges/banners.
- Neutrals: slate 50–900 scale for text, borders, surfaces.

## Type

Single family (Inter) — pinned by the brief, deliberately not swapped for a "less common" face,
per docs/07-ui-ux-design.md §2.2 and the product's Operate mode (system stacks are a permission here,
not a slop tell). Fixed rem scale: 12/14/16/20/24/32px, no fluid/clamp sizing. JetBrains Mono reserved
for future student/reference codes (not yet used in these mockups).

## Components (in `frontend/css/styles.css`)

- App shell: fixed sidebar + topbar + content grid. Desktop-first roles (Admin/Center Admin/
  Accountant/Teacher) collapse to an icon rail at tablet width, then a hamburger-triggered drawer
  under 640px. Mobile-first roles (Student/Parent) drop the sidebar entirely below 640px in favor of
  a fixed bottom tab bar.
- Stat strip: a bordered row of inline stats (label/value/delta) — deliberately not a grid of
  icon+heading+text cards (banned by craft-floor as the category default).
- Status badge: icon + text + tint background, reused identically across attendance and enrollment.
- Segmented attendance control: 4-state button group (Present/Absent/Late/Excused), each selected
  state taking its status color as a solid fill.
- Roster row: student + segmented control + conditionally-revealed remarks field (progressive
  disclosure — hidden unless status ≠ Present).
- Sticky save bar: progress count + Save button disabled until every roster row has a status.
- Native `<dialog>` modal for the enrollment flow (seat picker with live counts, inline capacity
  error) — chosen because the brief explicitly calls for a focused modal here, not because modals are
  a default.
- Tab strip: child switcher on Parent Home and Parent Schedule, panel content swapped via `data-tab-panel` groups.
- Session card / next-class hero: used on Teacher Today and Student/Parent Home respectively.
- Weekly agenda (`.agenda-day` / `.agenda-item`): day-grouped list used on Student/Parent Schedule —
  chosen over a grid calendar for mobile scanability and consistency with the roster/table vocabulary.
- Batches management table + two modals (New Batch with an inline teacher/room double-booking
  warning per FR-ACAD-4, Edit Batch with an archive action) on `batches.html`.
- Branches/Users/Courses management tables + add/edit modals (`branches.html`, `users.html`,
  `courses.html`), reusing the same data-table + `<dialog>` pattern as Batches. Add Branch/Add User
  on `admin-dashboard.html` now open the same modals inline instead of only living on the list pages.
- Reports (`reports.html`): two filter+export panels (Enrollment, Attendance) mirroring the backend's
  `GET /api/reports/{enrollment,attendance}` CSV endpoints (M5) — no live export, button is visual only.
- Audit Log (`audit-log.html`): filterable table of the same entries teased in the dashboard's
  "Recent audit activity" panel, expanded with Action/Entity/Branch columns.
- Settings (`settings.html`): tab-strip (General/Academic/Security) reusing the Parent child-switcher
  tab pattern, each tab a form panel with its own Save action.

## Icons

Hand-authored inline SVG sprite (`frontend/js/icons.js`), single stroke weight (1.75), rounded
joins/caps, 20×20 viewBox — no emoji, no Unicode glyphs standing in for icons.

## Interaction (visual-only, no persistence)

`frontend/js/app.js` wires: mobile nav drawer toggle, segmented-control selection + remarks reveal +
save-bar completeness gating, native dialog open/close, seat-option click (capacity error), and the
Parent child-switcher tabs. No network calls yet, no localStorage — every reload resets to the
authored demo state until M1+ wires real API calls via `frontend/js/config.js` / `frontend/js/api.js`.

## Known accepted findings (brief overrides the mechanical detector)

- `overused-font` (Inter) — pinned by docs/07-ui-ux-design.md §2.2; not swapped.
- `flat-type-hierarchy` on login.html (12/14/20px, one step under the 1.25 ratio floor) — accepted for
  this single screen under the brief's deliberately restrained 6-step Operate scale; revisit only if a
  future pass adds more type-scale room on this page specifically.

## Not yet built

Password reset/self-registration flows — still out of scope for this pass. Batches (Center/Super
Admin), My Batches (Teacher), Schedule (Student/Parent), and Branches/Users/Courses/Reports/Audit
Log/Settings (Super Admin) were all added after the initial pass once nav placeholders and dead
buttons were noticed/reported.
