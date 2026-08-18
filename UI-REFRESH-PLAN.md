# Jayhind ERP UI refresh — plan

*Primarily `jayhindi-client-front`; `jayhind-client-back` changes where the design
needs data the API doesn't serve today (see **Backend-side work** and decision 13).*

> **Reference:** the Claude Design canvas artifact "Jayhind ERP — All Screens"
> (101 screens across all 12 modules + 38 dialog patterns), which mirrors
> `src/core/navigation/navigation.config.ts` route-for-route.
>
> **Rollout shape (decided 2026-08-18):** *one module per phase*, each phase
> finished, built, browser-checked and committed on its own, then handed over for
> your review **before the next module starts**. That way the new look lands
> screen-family by screen-family, you see it live in parallel with the work, and
> any mismatch against the mockup is caught while the pattern is still cheap to
> change instead of after it has been copied into 100 screens.
>
> **Backend is in scope.** Where the mockup shows something the API cannot supply,
> the phase carries a real `jayhind-client-back` change (a field, a count, a preview
> endpoint) shipped in the same commit pair — never a placeholder or a client-side
> guess. Those items are tracked as **B-1 … B-7** below.

## Progress

| # | Phase | Scope | State |
|---|---|---|---|
| P0 | Foundation | tokens, fonts, icons, shared primitives | **done, browser-verified — pending commit** |
| P1 | Dashboard (+ app shell) | 1 screen + sidebar/topbar chrome | queue-panel done, shell pass pending |
| P2 | Product & Service | ~14 screens (2 gates) | not started |
| P3 | Transaction | ~45 screens (4 gates) | not started |
| P4 | Chat | 1 screen | not started |
| P5 | Job Work | ~12 screens | not started |
| P6 | Human Resources | ~15 screens | not started |
| P7 | Users & Roles, Profile, Party Portal | ~8 screens | not started |
| P8 | Files, Audit Log, Export, Site Config | ~6 screens | not started |
| P9 | Dialogs sweep | shared dialog partials + 8 dialog categories | not started |

**Done in P0:** bare-name token layer with `--ds-*` kept as aliases; Material
Symbols + IBM Plex Mono self-hosted (both CDN `<link>`s removed); `ds-status-chip`,
`ds-queue-panel`, `ds-view-tabs` primitives; the two duplicate status chips folded
onto one; numeric table columns right-aligned in tabular mono (107 columns
app-wide); dashboard "Nearest Dues" now actionable via the real
`sendDueReminderNow` endpoint.

**P0 verified:** build clean · lint 0 errors · breakpoint guard OK ·
`check-mirrors` in sync · driven in a real browser (light + dark) against the
running stack — icon glyphs render, numeric cells confirmed
`right / IBM Plex Mono / tabular-nums`, view-tabs show live counts, all six chip
tones pass AA in dark mode.

**P0 not verified:** status chips on voucher rows — the test tenant has no voucher
data, so that refactor is covered by build + token probes, not by eye. It gets
re-checked by eye in **P3.1**, where voucher data is seeded anyway. No Karma specs
(see decision 6).

---

## Context

The mockup is not a loose mood board — it is a data-driven reference built on a
Material-3-style token system (bare `--primary` / `--surface` / `--on-surface` /
`--border` / `--muted` / status colors with light+dark hex pairs, `-bg` suffix for
tinted backgrounds), IBM Plex Mono for tabular numbers, and a handful of recurring
screen shapes:

| Shape | What it is | Where it recurs |
|---|---|---|
| **dash** | KPI cards + attention queue + trend chart | Dashboard, Product/Transaction/Job Work/HR dashboards |
| **list** | view-tabs + filter chips + sortable grid with status chips + bulk bar | every master, every voucher list, employees, files |
| **form** | header fields + line items + totals + compliance status | voucher entry, product add/edit, employee, challan |
| **board** | kanban | Job Work board |
| **settings** | grouped setting cards | product/transaction/job-work config, site config, user config |
| plus | scan, chat, files, gallery variants | invoice scanning, chat, file manager, product media |

Three parallel audits of the current codebase (design tokens & shared components,
navigation/route coverage, sample screen implementations) found the app is in good
shape structurally — all 101 screens are real implemented components, not stubs,
and route/permission wiring has no functional bugs. The gap is almost entirely
visual/interaction-pattern: token naming, icon font generation, numeric typography,
and a few missing shared UI primitives. This plan brings the app in line with the
reference while fixing the concrete mismatches review surfaces along the way.

---

## Decisions locked in

1. **Tokens** — the new bare-name token set is canonical in `_tokens.scss`; the
   existing `--ds-*` custom properties are redefined as thin `var()` aliases
   pointing at them, so the ~100+ files already referencing `--ds-*` keep working
   and no flag-day rename is needed. `--ds-*` names get dropped from templates
   progressively as each module phase retouches its screens; full removal is a
   stretch goal, not a blocker.
2. **Numeric font** — IBM Plex Mono (matches the mockup exactly), which also fixes
   the latent bug where `_voucher.scss` referenced an undefined `--ds-font-mono`.
3. **Structural scope** — build the missing shared primitives (status-chip,
   view-tabs, filter-chips, actionable queue-panel), not just a restyle. Real
   drag-and-drop kanban for the job-work board is **out of scope**: it needs a CDK
   DragDrop rebuild plus a status-mutation API path that doesn't exist server-side.
   The board gets the same visual retheme as every other screen but keeps its
   current click-to-open grouped-list behavior. **Reopened by decision 13** — the
   API path can now be built; see **B-4**. Still not scheduled by default, because
   it is a feature build rather than a refresh: say the word and it becomes its own
   phase.
4. **Rollout order** — foundation first, then **one module per phase in this
   order**: Dashboard → Product → Transaction → Chat → Job Work → HR →
   Users & Roles → remaining utility modules → dialogs last. (Your ordering; note
   Transaction is the highest-traffic module, so Product landing first exists to
   prove the list patterns on a smaller surface before the 1230-line voucher form.)
5. **`--muted` dark-mode fix** — measured bug, not a preference: `--muted`
   inherited Material's `on-surface-variant`, which in dark M3 is `#e0e2ec`
   against an `--on-surface` of `#e3e2e6` — a **1.00:1 separation**, so every hint,
   chip label and secondary metadata rendered identical to body text. Light mode
   was fine (1.85:1). Now `light-dark(#44474e, #a2a3ad)`: light unchanged, dark
   gets 1.94:1 separation and still passes AA at 7.41:1 on surface.
6. **Tests** — this environment has no Chrome, so the Karma target cannot run, and
   the repo has zero existing specs with an unproven harness. Verification is done
   in a real browser via the repo's Playwright Chromium instead; no unrunnable spec
   files are committed. The CLAUDE.md §13 test-coverage gap is left where it is.
7. **View-tabs are two tabs, not three.** The mockup shows All/Active/Archived with
   live counts on each, but the data model is binary
   (`PaginatedResponse.isDeleted`) with `totalItems` describing only the view
   actually returned. There is no server-supported "All", and counting the other
   side costs a second request per list screen. Shipped as an Active|Archived
   segmented control with a count on the current tab only. **Reopened by decision
   13** — the list endpoints can return both counts in one response; see **B-1**.
8. **Filter chips on high-traffic screens only.** The filter system is generic
   (columns declare `filterType`, the dialog builds match-mode conditions); it has
   no concept of preset values, so chips must be hand-declared per screen. They go
   on the Transaction voucher lists (P3.1) and the Product list (P2.1); everywhere
   else keeps the existing Filter dialog.
9. **Fonts are self-hosted, not CDN.** `styles.scss` already self-hosts Inter with
   the note "no external CDN — PWA/offline friendly", so IBM Plex Mono and Material
   Symbols are npm packages (`@fontsource/ibm-plex-mono`, `material-symbols`), not
   Google Fonts `<link>`s. This also removed two CDN `<link>`s from `index.html`
   that contradicted that intent — including the Material Icons one, which left
   every icon blank until the CDN answered.
10. **One module per phase, sequential.** No module starts until the previous one's
    review gate is signed off. If a review turns up a pattern-level mismatch (a
    chip tone, a table density, a card shape), it is fixed in the *primitive* and
    the already-shipped phases are re-checked before moving on — that is the whole
    point of small phases.
11. **A commit per phase.** P0 gets committed as its own baseline commit before P1
    starts; every module phase is one commit on `main` in the
    `jayhindi-client-front` submodule, with the submodule pointer bumped in this
    repo in the same pass (per CLAUDE.md §12). A module that reviews badly can be
    reverted on its own.
12. **The gate is "build + browser pass".** Before handing a phase over I run
    lint/build/breakpoint-guard, drive every screen in the phase in Playwright
    Chromium in **light and dark** at the four governed breakpoints
    (480/720/1024/1440), and hand you a screenshot set plus a written list of any
    mismatch against the mockup I couldn't resolve. Then I stop until you say go.
13. **Backend changes are in scope when the design needs them** (added on your
    instruction, 2026-08-18). Where a screen in the mockup cannot be built honestly
    from what the API returns today, the fix is a real `jayhind-client-back` change
    — a new field, a count, a preview endpoint, a status mutation — not a fake
    number or a client-side guess. Rules that still hold, from CLAUDE.md:
    - a new endpoint gets a DTO, `@UseGuards(RoleMenuGuard)` + `@Permissions(...)`,
      `@Audit()` if it mutates, and registration in its **feature module** (§12);
    - a read-shaped `POST` needs `@ReadOnlyRequest()` or billing grace refuses it
      (§10); never put it on anything that writes;
    - a new permission key means `permission-registry.ts` +
      `module-licence.const.ts` + both frontend mirrors + the seeder, then
      `node scripts/check-mirrors.js` (§12);
    - anything on the `/internal/*` or `/api/v1/*` planes means **both repos change
      together**, sub-repo pushed first, submodule pointer bumped here (§12);
    - migrations are additive — never edit the squashed baseline (§4.8).
    Backend work ships **in the same phase and commit pair** as the screen that
    needs it (client-back commit + client-front commit + submodule bumps), so a
    phase is never half-landed. Each item is listed as **B-n** below and pulled
    into its phase.

**One product-level call this plan makes** (flagged for review, small and
reversible): the mockup's voucher **form** screens show compliance status
(e-Invoice / e-Way Bill) inline as informational icons *before* approval, while
today the app only surfaces that via a post-approval dialog
(`EwayBillDialogService` / `EinvoiceDialogService`), a deliberate existing pattern.
**P3.2** adds a small **read-only preview strip** to the voucher form (module
licence flags + party GSTIN + invoice value threshold — all already available
client-side) showing what *will* happen on approval, without changing the actual
post-approval flow. Purely additive, no backend change, easy to drop if unwanted.

---

## The per-phase protocol (same for every module)

Every phase below is executed with these six steps. They are not repeated in each
phase description.

1. **Inventory** — list the module's routes from `navigation.config.ts` and map
   each to its component files, so no screen in the module is silently skipped.
2. **Retheme** — replace `--ds-*` / hardcoded values with the new bare tokens,
   apply the shape for that screen type (dash / list / form / board / settings),
   swap ad-hoc chips and toolbars onto the shared primitives.
3. **Check the four breakpoints** — `@media` only where the *browser* width is what
   matters; container queries where a dialog or panel sets the width (CLAUDE.md §9).
4. **Verify** — `npm run lint` (includes `scripts/breakpoint-guard.js`),
   `npm run build`, and `node scripts/check-mirrors.js` from the repo root if
   `module-licence.ts` or `navigation.config.ts` was touched.
5. **Browser pass** — every screen in the module, light + dark, 480/720/1024/1440,
   against the running stack (`./dev.sh start client-back client-front`).
   Screenshots captured to `_ops/ui-refresh/<phase>/`.
6. **Gate** — commit the phase, bump the submodule pointer, hand over the
   screenshots + a mismatch list. **Stop.** Next phase begins only on your go-ahead;
   anything you flag is fixed in-phase (and pushed down into the primitive if it is
   a pattern, not a one-off).

---

## Backend-side work (`jayhind-client-back`)

Everything the mockup asks for that the current API cannot serve. Each item says
what it costs and whether I'd do it; the ones marked **planned** are already folded
into their phase, the ones marked **your call** are written up but not scheduled.

| # | What the design needs | Backend change | Phase | Status |
|---|---|---|---|---|
| B-1 | view-tabs showing counts on **both** Active and Archived | add `archivedCount` (and `activeCount`) to the paginated list response — one extra `COUNT` in the existing query path, no new endpoint | P2.1 | **planned** |
| B-2 | dashboard queue rows that can be acted on without leaving the screen | already served by existing endpoints (`sendDueReminderNow`, the approve path) — **no backend change** | P1 | none needed |
| B-3 | voucher form showing e-Invoice / e-Way Bill status *before* approval | `GET /trx/:id/compliance-preview` (or a field on the existing detail response) returning what approval will trigger and why — replaces the client-side inference the strip would otherwise do | P3.2 | **planned** |
| B-4 | drag-and-drop kanban on the Job Work board | a status-mutation endpoint (`PATCH /job-work/:id/stage`) with lifecycle validation server-side, plus a socket broadcast so two users dragging don't clobber each other | P5 | **your call** (decision 3) |
| B-5 | filter chips as saved/preset filters rather than hand-declared per screen | preset filter definitions persisted per company + a `filterPresets` field on the list config | — | **your call** — hand-declared chips (decision 8) cover the design as drawn; this is only worth it if you want user-defined presets |
| B-6 | chat presence / unread counts as the mockup shows them | check what `socketGateWay` already broadcasts before adding anything | P4 | **investigate first** |
| B-7 | KPI cards / trend chart on the module dashboards (Product, Transaction, Job Work, HR) | the mockup's card set may not match what each dashboard endpoint returns; any gap becomes an added field on that dashboard's existing response, not a new endpoint | P2.1, P3.1, P5, P6 | **investigate per phase** |

**How each phase handles this:** step 1 of the per-phase protocol (Inventory) now
also diffs the mockup's screen against the API response that feeds it. Anything the
API can't supply is either added as a **B-n** item in that phase, or — if it's
bigger than the phase — written into this table as "your call" and the screen ships
without it rather than with a placeholder. **No screen in this refresh displays a
number the backend didn't actually produce.**

---

# P0 — Foundation *(done — commit pending)*

Already implemented in the working tree; listed here for the record.

- **Tokens** (`src/styles/design-system/_tokens.scss`): bare-name roles
  (`--primary`, `--primary-container`, `--on-primary`, `--on-primary-container`,
  `--primary-bg`, `--surface`, `--on-surface`, `--border`, `--border-strong`,
  `--muted`, `--success`/`-bg`, `--warning`/`-bg`, `--error`/`-bg`, `--info`/`-bg`)
  with light defaults + dark overrides; every `--ds-*` role redefined as an alias.
- **Icons**: Material Symbols (Outlined) self-hosted; CDN links removed.
- **Typography**: IBM Plex Mono wired to `--font-mono`/`--ds-font-mono`;
  `tabular-nums` + right alignment on numeric columns in
  `data-table.component.scss` and `_voucher.scss`.
- **Hardcoded hex killed** in `_voucher.scss` (`--vch-titlebar-bg: #1e293b`,
  `--vch-titlebar-fg: #f1f5f9`, `.vch-titlebar__icon { color: #93c5fd }`).
- **Primitives** in `src/components/shared/ui/`: `status-chip.component.ts`
  (tone-based, with `voucher-status-chip` and `scan-status-chip` folded onto it),
  `view-tabs.component.ts`, `queue-panel.component.ts`.
- **Doc fix**: `src/core/navigation/module-licence.ts` — its comment claimed a
  "Support Desk" module that has no nav item or route in this app.

**Still owed from P0, done at the start of P1:**
- `filter-chips` primitive (the fourth one) — built in P1 only if the Dashboard
  needs it, otherwise deferred to P2.1 where the Product list is its first real
  consumer.
- Commit the whole P0 working tree as its own baseline commit.

---

# P1 — Dashboard (+ the app shell around it)

**Why the shell is in this phase:** you cannot look at the dashboard without
looking at the sidebar, topbar, breadcrumb and module tabs that frame it, and every
later phase inherits that chrome. Doing it here means one review of the frame
instead of noticing it on every subsequent screenshot. If you would rather keep
this phase to the dashboard body alone, say so and the shell moves to its own P1b.

**Screens:** `dashboard` (1), plus the always-visible shell.

**Files:**
- `src/components/admin/dashboard/dashboard.component.{ts,html}`
- `src/components/admin/layout/**` (sidebar, topbar, breadcrumb, module tabs)
- `src/components/admin/module-layout/**`, `src/components/admin/menu-hub/**`

**Work:**
- Dashboard is already fully token-driven with an ECharts trend chart
  (`utils/dashboard-charts.ts`) — mostly free after P0.
- Pending Approvals / Dues sections move from `rank-panel` to `queue-panel` with
  real per-row actions (Approve / Remind), wired to the services those actions
  already call elsewhere. *(Dues half already done in P0.)*
- KPI cards onto the mockup's stat-card shape and `tabular-nums`.
- Shell: tokens, Material Symbols weight/fill consistency, active-item treatment,
  density at 480/720.

**Backend:** none expected (B-2 — the actions already have endpoints). Confirmed
during inventory.

**Risk to watch at review:** KPI card density on 1440 (the mockup runs 4-up; the
app currently reflows differently), and sidebar contrast in dark mode after the
`--muted` change.

---

# P2 — Product & Service

Two gates, because 14 screens is more than one useful review.

### P2.1 — Product list, Service list, Product dashboard
**Files:** `src/components/admin/product/{product,service}/**`,
`product/dashboard/**`
- First real consumer of **`view-tabs`** (Active|Archived) and the **`filter-chips`**
  row in `paginated-table`'s toolbar.
- `status-chip` on stock/status columns; numeric columns tabular.
- Product add/edit form onto the **form** shape (header fields + sections).
- **Backend (B-1):** add both-side counts to the paginated list response so
  view-tabs can show Active *and* Archived counts as the mockup draws them. Lands
  in the same commit pair as this phase.
- **Backend (B-7):** diff the Product dashboard's KPI set against what its endpoint
  returns; add fields if the mockup asks for something real that isn't there.
- **This is the gate where the list shape gets settled.** Everything in P3–P8
  copies it, so mismatches found here are cheap and mismatches found later are not.

### P2.2 — Masters, product management, stock conversion, configuration
**Files:** `product/masters/**` (manufacturer, measurement unit, return policy,
product condition, warranty, categories & tags), `product/product-management/**`
(quantity, price, media), `product/stock-conversion/**` (conversions, BOM
templates), `product/product-configuration/**` (general settings, dynamic fields)
- Mechanical once P2.1 is signed off: same list shape for the six masters, the
  **gallery** variant for Product Media, the **settings** shape for configuration.

---

# P3 — Transaction

The biggest module (~45 screens, 129 files). Four gates.

### P3.1 — Voucher lists + Pending Approvals + Transaction dashboard
**Files:** `transaction/vouchers/trx/{trx.ts,trx.html}`,
`transaction/pending-approvals/**`, `transaction/dashboard/**`
- `view-tabs` + `filter-chips` in the toolbar; e-Way Bill / e-Invoice inline chips
  and voucher status chips onto the `status-chip` primitive.
- **Re-checks the P0 voucher-chip refactor by eye** — the one thing P0 could not
  verify. Needs a tenant with voucher data seeded before the browser pass.
- Covers all 14 voucher types that share `trx.ts` (purchase requisition, purchase
  order, goods receipt, purchase, debit note, quotation, sales order, delivery
  challan, sales, credit note, payment, receipt, journal, contra).

### P3.2 — The voucher entry form
**Files:** `transaction/vouchers/trx/trx-add-edit/**`,
`src/styles/design-system/_voucher.scss` (1230 lines)
- The single biggest retheme in the project: systematic token pass across the
  `.vch-*` classes, `tabular-nums` on line-item and totals columns, line-item table
  density, sticky totals bar.
- Adds the **read-only compliance preview strip** described above, backed by
  **B-3** — a real server-side preview of what approval will trigger, rather than
  the frontend re-deriving licence flags, GSTIN and thresholds itself. The
  post-approval flow is untouched.
- Reviewed on its own precisely because it is where a wrong call costs the most.

### P3.3 — Statements, registers and reports
**Files:** `transaction/{outstanding,party-statement,dues,gst-returns,
chart-of-accounts}/**`, `transaction/reports/**` (trial balance, P&L, balance
sheet, day book, group statement, cash book, bank book, daily cash, payment
register, receipt register, stock ledger, valuation summary, reorder alerts)
- Report shape: period selector + dense numeric grid + export bar. Almost entirely
  typography and alignment, which is exactly what IBM Plex Mono + `tabular-nums`
  from P0 were for.

### P3.4 — Masters, configuration, data import, invoice scanning
**Files:** `transaction/masters/**` (nature, group, financial year, GST rates),
`transaction/transaction-config/**`, `data-import/**`, `invoice-scanning/**`
- Settings shape + the **scan** variant (upload → queue → review), whose chips were
  already folded onto `status-chip` in P0 and get their visual check here.

---

# P4 — Chat

**Screens:** 1. **Files:** `src/components/admin/chat/**` (4 files)
- The mockup's chat variant: conversation list, message column, composer,
  presence/unread treatment.
- **Backend (B-6):** check what `socket/socketGateWay.ts` already broadcasts for
  presence and unread before adding anything — likely no change.
- Small and self-contained — a deliberate breather between Transaction and Job
  Work, and a good check that the token layer holds up on a non-grid screen.

---

# P5 — Job Work

**Screens:** ~12. **Files:** `job-work/**` (48 files) — dashboard, board,
ready queue, challans, billing run, reports, masters (operation types, machines,
vendor capabilities, route templates, party billing settings, settings)
- Board gets the **visual** retheme only — grouped-list behavior stays (decision 3).
  Column headers, card shape, tone bars, counts all follow the mockup's board shape.
- **Backend (B-4), your call:** real drag-and-drop needs a stage-mutation endpoint
  with server-side lifecycle validation plus a socket broadcast. Now buildable under
  decision 13, but it is a feature, not a retheme — tell me to schedule it and it
  becomes P5b rather than quietly expanding this phase.
- Challans use the form shape from P3.2; masters use the list shape from P2.2.

---

# P6 — Human Resources

**Screens:** ~15. **Files:** `hr/**` (46 files) — HR dashboard, self-service,
employees, attendance (daily, reports, shifts), leave (applications, calendar,
types, holidays), payroll, masters
- Reuses dash / list / form / settings shapes wholesale. The calendar screens are
  the only ones needing their own look at density.

---

# P7 — Users & Roles, Profile, Party Portal

**Files:** `users-roles/**` (14), `profile/**`, `party-portal/**` (8)
- Users & Roles: list shape + the permission matrix, which is the densest grid in
  the app and the one most likely to need a container query rather than a media
  query.
- Party Portal ("My Account") is a distinct audience — check it in its own right,
  not just as a themed copy.

---

# P8 — Files, Audit Log, Export, Site Configuration

**Files:** `file-manager/**`, `audit-log/**`, `company-export/**`,
`site-configrations-component/**`
- Files: the mockup's files variant (breadcrumb + grid/list toggle + preview).
- Audit Log: dense read-only list, timestamps in mono.
- Site Configuration: settings shape — and the one place whose assets are served
  statically (CLAUDE.md §6.4), so no upload-path changes here, styling only.

---

# P9 — Dialogs sweep

- Retheme the shared dialog partials: `src/styles/custom/_form-dialog.scss`,
  `_resizable-dialog.scss`, `_side-panel-dialog.scss`, `_form-errors.scss`.
- Walk the mockup's 8 dialog categories (Pickers, Voucher actions, Compliance,
  Data & grid, Print & share, Stock & shop floor, People & access, System) against
  the app's real `MatDialog` usages — `confirmation-dialog`,
  `document-viewer-dialog`, `grid-filter`, `EwayBillDialogService` /
  `EinvoiceDialogService` dialogs, invite/permission dialogs, and the rest.
- The route audit found no missing screens, so expect retheme + a confirmation
  pass, not new dialog builds. Anything genuinely missing gets listed for a
  separate decision rather than built silently here.

---

## Small independent fixes

- ~~`module-licence.ts` stale "Support Desk" comment~~ — fixed in P0.
- Optional, not required by this refresh: `module-licence.ts`'s enum values
  (`jobwork`, `files`) vs. nav's route segments (`job-work`, `file-manager`) differ
  in spelling. Harmless today — the mirror matches by `permissionKey`, not route
  path — but worth normalizing if anyone touches that file for other reasons.

---

## Mismatch log

Filled in during the review gates. A row here is a difference between the mockup
and what the app can actually do; resolving it is a decision, not a bug fix.

| # | Phase | Mismatch | Resolution |
|---|---|---|---|
| 1 | P0 | Mockup's All/Active/Archived tabs vs. the binary `isDeleted` data model | Shipped Active\|Archived with a count on the current tab (decision 7); **both-side counts now planned as B-1 in P2.1** |
| 2 | P0 | Mockup assumes Google Fonts CDN | Self-hosted npm packages instead (decision 9) |
| 3 | P3.2 | Mockup shows pre-approval compliance status; app surfaces it post-approval | Read-only preview strip backed by a real preview endpoint (B-3), no change to the post-approval flow |
| 4 | P5 | Mockup's board is drag-and-drop kanban | The API can now be built (B-4, decision 13) — still **your call** whether to schedule it; retheme-only otherwise |

## Verification reference

- `npm run lint` (client-front) — includes `scripts/breakpoint-guard.js`; must stay
  green (no raw px outside 480/720/1024/1440).
- `npm run build` — must stay clean.
- `node scripts/check-mirrors.js` from the `jayhind/` repo root whenever
  `module-licence.ts` or `navigation.config.ts` is touched.
- Browser pass per phase, light + dark, all four breakpoints, against a running
  `client-back` + `client-front`.
- `npm test` (Karma) is **not** runnable in this environment (decision 6).

For any phase that carries a **B-n** backend change, add:
- `npm run lint` + `npm run build` + `npm test` (Jest, 1310 tests, no DB) in
  `jayhind-client-back`;
- `npx ts-node -r tsconfig-paths/register scripts/dump-routes.ts` before/after if a
  controller or module was touched;
- `npx ts-node scripts/ci-guard-raw-sql.ts` if any raw SQL was added;
- `node scripts/check-mirrors.js` from the repo root if a permission key or licence
  mapping changed;
- both submodule pointers bumped in this repo in the same pass.
