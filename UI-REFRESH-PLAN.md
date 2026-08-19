# Jayhind ERP UI refresh — plan

*Primarily `jayhindi-client-front`; `jayhind-client-back` changes where the design
needs data the API doesn't serve today (see **Backend-side work** and decision 13).*

> **Reference:** the Claude Design canvas artifact "Jayhind ERP — All Screens"
> (101 screens across all 12 modules + 38 dialog patterns), which mirrors
> `src/core/navigation/navigation.config.ts` route-for-route.
> **Canvas URL:** https://claude.ai/code/artifact/a0d7de26-dede-4323-a8dc-c8dc16b599da
> — this is the single source of truth for every screen shape, token value and
> component pattern named in this plan; when a phase says "the mockup shows X",
> this is the artifact it means. Re-open it at the start of each phase's
> Inventory step rather than relying on memory of it from an earlier phase.
> **Local extraction:** the canvas is a bundled React app, not static HTML per
> screen — [`_ops/ui-refresh/reference/`](_ops/ui-refresh/reference/) holds
> every screen's actual data (`screens-spec.js`), every dialog (`dialogs-spec.js`),
> the canvas's own render logic and exact token hex values
> (`canvas-app-shell.jsx`), and a README explaining the row-cell shorthand.
> Grep this before re-fetching the artifact — it's the same data, already decoded.
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
| P0 | Foundation | tokens, fonts, icons, shared primitives | **done, browser-verified, committed** (`84f656c`) |
| P1 | Dashboard (+ app shell) | 1 screen + sidebar/topbar chrome | **signed off 2026-08-18** |
| P2 | Product & Service | ~14 screens (2 gates) | **P2.1 signed off 2026-08-18**; **P2.2 done, browser-verified 2026-08-19** |
| **N** | **Two-column nav + KPI strip** | **retrofit across P1 + P2.1, and the shape for P3+** | **signed off 2026-08-18**, after a shell-bug correction (duplicate collapse control, stepped header hairline) |
| P3 | Transaction | ~45 screens (4 gates) | **done — all four gates browser-verified 2026-08-19** |
| P4 | Chat | 1 screen | **done, browser-verified 2026-08-19** |
| P5 | Job Work | ~12 screens | **done, browser-verified 2026-08-19** |
| P6 | Human Resources | ~15 screens | **done, browser-verified 2026-08-19** |
| P7 | Users & Roles, Profile, Party Portal | ~8 screens | **done, browser-verified 2026-08-19** |
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

**P0 not verified at the time:** status chips on voucher rows — the test tenant had
no voucher data. **Closed early, in P1:** P1 had to seed real vouchers to check its
own approval queue (see below), so the Pending Approvals grid was driven with live
`pending` rows and the chips were confirmed by eye in both themes. P3.1 no longer
inherits this. No Karma specs (see decision 6).

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
   (`PaginatedResponse.isDeleted`). There is no server-supported "All", so the
   control is an Active|Archived segmented one. ~~With a count on the current tab
   only~~ — **settled in P2.1 (B-1)**: the list response now carries both counts,
   computed over the request's own filters, so both tabs are numbered and neither
   can contradict the grid. The missing third tab stays missing on purpose: "All"
   would mean mixing live and archived rows in one list, which no screen in this
   app treats as one set.
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

14. **The navigation is two columns, and the KPI row is one strip** (added on
    your instruction, 2026-08-18, from the Claude Design canvas). An icon rail of
    modules that never collapses, beside a panel of the active module's pages;
    and dashboard KPIs as a single divided band instead of a 4-up card grid.
    Retrofitted into the already-shipped phases (see **Phase N**) and **the
    default shape for every phase after it** — a new dashboard uses
    `ds-stat-strip`, a new module needs no tab bar of its own, and a new
    top-level module declares `subtitle` + `shortName` in
    `navigation.config.ts`. Four sub-decisions, all yours:
    - the rail is the **existing top-level nav 1:1** — no nav restructure, so
      permission keys and `check-mirrors` are untouched;
    - the panel is **always shown**; a module with no child routes lists its own
      screen's real in-page sections, and one with none lists its single
      destination rather than an invented sub-page;
    - the strip is **one line where it fits, stepping down rather than
      scrolling**; no KPI is dropped and none hides behind a gesture;
    - scope was **the shell everywhere + the strip on the two finished
      dashboards** — Job Work, HR and Party Portal keep `ds-stat-card` until
      their own phase.

**One product-level call this plan makes** (flagged for review, small and
reversible): the mockup's voucher **form** screens show compliance status
(e-Invoice / e-Way Bill) inline as informational icons *before* approval, while
today the app only surfaces that via a post-approval dialog
(`EwayBillDialogService` / `EinvoiceDialogService`), a deliberate existing pattern.
**P3.2** adds a small **read-only preview strip** to the voucher form (module
licence flags + party GSTIN + invoice value threshold — all already available
client-side) showing what *will* happen on approval, without changing the actual
post-approval flow. Purely additive, no backend change, easy to drop if unwanted.

15. **Artifact-conformance audit, 2026-08-18** (your instruction — check
    already-shipped work against the artifact, fix what doesn't match). Two
    calls, both via AskUserQuestion:
    - **Dashboard shape (P1 Business, P2.1 Product) — match the artifact
      exactly.** Rebuilt both to the `dash` shape (KPI strip, one merged
      attention queue beside a new breakdown-bars panel, trend chart);
      removed the three widgets (Top Products/Customers, Live System Monitor,
      Quick Actions) that appear nowhere in the artifact's 7 dash-kind
      screens. See mismatch 10, and the "Corrected 2026-08-18" addenda under
      P1 and P2.1.
    - **Product/Service list columns — add what's missing, keep both
      dimensions.** Category and a Stock Health second column added
      *alongside* the existing Manufacturer/Cost-Sale-Price/catalogue-status
      columns, not instead of them; GST% and a summary strip added to match
      the artifact. See mismatch 11.
    - The nav-panel accordion/filter/short-label gaps found in the same audit
      needed no decision — pure conformance, fixed outright (mismatch 12).
    - One artifact KPI, Product Dashboard's "Price changes", has zero backing
      anywhere in the schema (no price-revision approval workflow exists at
      all) — shipped as 5 real cards instead of a fabricated 6th, per this
      plan's own rule (**B-13**, your call whether to build the workflow).

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
| B-1 | view-tabs showing counts on **both** Active and Archived | `activeCount` + `archivedCount` on the paginated list response — one extra `count()` in `paginateNew`, over the request's own composed where/include, no new endpoint | P2.1 | **done** |
| B-2 | dashboard queue rows that can be acted on without leaving the screen | already served by existing endpoints (`sendDueReminderNow`, the approve path) — **no backend change** | P1 | none needed |
| B-3 | voucher form showing e-Invoice / e-Way Bill status *before* approval | `GET /trx/:id/compliance-preview` (or a field on the existing detail response) returning what approval will trigger and why — replaces the client-side inference the strip would otherwise do. Shipped as `GET /trx/:id/compliance-preview` + `CompliancePreviewService` + `compliance-preview.const.ts` (15 specs), reusing both gateways' own `getEligibility` under a new `{ preApproval: true }` option so the preview and the post-approval dialog cannot drift | P3.2 | **done** |
| B-4 | drag-and-drop kanban on the Job Work board | a status-mutation endpoint (`PATCH /job-work/:id/stage`) with lifecycle validation server-side, plus a socket broadcast so two users dragging don't clobber each other | P5 | **your call** (decision 3) |
| B-5 | filter chips as saved/preset filters rather than hand-declared per screen | preset filter definitions persisted per company + a `filterPresets` field on the list config | — | **your call** — hand-declared chips (decision 8) cover the design as drawn; this is only worth it if you want user-defined presets |
| B-6 | chat presence / unread counts as the mockup shows them | checked in P4: `chat.service.ts` already returns per-conversation `unreadCount` and serves `GET /chat/unread-count`; the gateway already relays `chat:typing` and tracks per-socket `chat:focus`, and the screen consumes all three. Presence is not broadcast — and the reference shows no presence dots — so nothing is missing | P4 | **none needed** |
| B-7 | KPI cards / trend chart on the module dashboards (Product, Transaction, Job Work, HR) | the mockup's card set may not match what each dashboard endpoint returns; any gap becomes an added field on that dashboard's existing response, not a new endpoint | P2.1, P3.1, P5, P6 | **Product: revised — see B-12.** P2.1's "no gap" finding was wrong; a full artifact-vs-shipped audit on 2026-08-18 found the Product dashboard's KPI *set* itself didn't match the reference (see mismatch 10). Transaction: checked in P3.1, retheme-in-place (mismatch 13). **Job Work: done — see B-18.** HR: checked in P6 — the dashboard endpoint already serves everything its screen shows; no gap (mismatch 16) |
| B-8 | dashboard approval queue readable during billing grace | `@ReadOnlyRequest()` on `POST /approvals/pending/:sourceType` — a genuine read the P0-era sweep of 52 handlers missed; without it a past-due company sees a 402 where its approval queue should be | P1 | **done** |
| B-9 | Approve button offered only where the server would actually allow it | the queue gates on `canApprove`, but segregation of duties (`allowSelfApproval: 0`) *also* bars approving a voucher you submitted — a per-row `canApprove` flag on the approvals list response would let both this panel and the Pending Approvals screen hide the button instead of failing on click | — | **your call** — see mismatch 6 |
| B-10 | Business Dashboard "Cash position" breakdown panel — individual bank/cash/UPI/wallet balances, not just the one aggregate `cashBankBalance` figure | `cashByAccount: {name, balance}[]` on `/dashboard/kpis`, reading `TrxAccount.balance` (already engine-maintained, same read `getFundsSummary()` uses) — no new SQL derivation, just a scoped `TrxAccount.findAll()` | P1 (retrofit) | **done** |
| B-11 | Product Dashboard KPIs the reference shows that the API didn't return — Services count, Slow-moving stock value | `servicesCount` (count of `itemType='service'` rows, mirrors `productStats()`'s own goods-only carve-out) and `slowMovingValue` (stock value with no `stock_movements` row in 90+ days) added to `/dashboard/kpis` | P2.1 (retrofit) | **done** |
| B-12 | Product Dashboard's breakdown panel and trend chart — "Value by category" bars, "Stock in vs out" (Received/Issued) trend | `stockValueByCategory: {category, value}[]` (each product bucketed to its single earliest-assigned category — `product_category` is many-rows-possible, naive summing would double-count) and `stockTrend: {months, received, issued}` (from `stock_movements.direction`, already carrying everything needed) added to `/dashboard/kpis` | P2.1 (retrofit) | **done** |
| B-13 | Product Dashboard's sixth reference KPI, "Price changes" (pending price-revision approvals) | genuinely doesn't exist: no price-revision entity, no status column, no approval workflow anywhere in the schema — `ProductPriceDetails` only has `autoManaged`, and `ProductPriceCaptureService` approves *vouchers*, not prices. Would need real new schema + a request/approve workflow, not a query | P2.1 | **your call** — shipped as 5 real cards instead of a fabricated 6th, per this plan's own rule (§ below). Flag if you want the workflow built; it's a feature, not a retheme |
| B-14 | Product List's Category column and stock-health second Status column | `productCategories` relation added to the `Product` entity + `findAll()`'s include (each product may carry >1 category — no bucketing needed here, the grid just lists every name); stock-health computed client-side from the `productQuantity` fields already on every row (no new field) | P2.1 (retrofit) | **done** |
| B-15 | Product List's summary strip (Products / In stock / Below reorder / Stock value) | new `GET /products/summary` on the existing `products` controller/permission lane (`@SharedRead()`, matching `list`'s own gating) — its own small queries rather than reusing `DashboardService`'s (that lives in a different NestJS module; importing it just for three numbers would add a cross-module dependency) | P2.1 (retrofit) | **done** |
| B-16 | The five product masters' usage count — the reference's Products / Used by / Applies to / Items column | `CommonDataService.attachReferenceCounts(page, Product, <fk>, 'productCount')` — one grouped count over the page's own ids, wired into all five masters' `findAll`. Through the ORM, so tenant scoping and the paranoid clause apply; not an `include` + `COUNT`, which would need a GROUP BY and break `totalItems` | P2.2 | **done** |
| B-17 | The voucher form's **Vehicle no** header field, and the reference's "vehicle number captured" clause on the e-Way Bill preview line | a vehicle number exists only on the `eway_bills` row, which is created *after* approval — the voucher itself carries no transport details at all. Would need a column on `trx` (or a transport sub-form), a DTO field, and the e-Way Bill generate step pre-filling from it | P3.2 | **your call** — a feature, not a retheme. The preview line ships saying what is actually known (`raise it after approval`) rather than a clause it cannot stand behind |
| B-18 | The Job Work dashboard's `dash`-shape data — WIP by operation, an orders-in-vs-delivered trend, an attention queue, and WIP / ready-to-bill / rejection-rate KPIs | added to the existing `/job-work-dashboard/summary` response (no new endpoint): `wipByOperation`, `orderTrend`, `queue`, `wipValue`, `readyToBillValue`, `rejectionRate`. Built from the module's existing report methods plus one grouped read of `job_work_operations`; money keys omitted rather than zeroed without `job-work-costing` (§10.5), and `rejectionRate` omitted when nothing has been inspected | P5 | **done** — this is B-7's Job Work half |

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

**Still owed from P0 — settled at the start of P1:**
- `filter-chips` primitive (the fourth one) — the Dashboard has no list toolbar,
  so it is **deferred to P2.1**, where the Product list is its first real consumer.
- ~~Commit the whole P0 working tree as its own baseline commit~~ — done
  (`84f656c`, submodule pointer bumped in `c06d0c0`).

---

# P1 — Dashboard (+ the app shell around it) *(done — awaiting review)*

**Why the shell is in this phase:** you cannot look at the dashboard without
looking at the sidebar, topbar, breadcrumb and module tabs that frame it, and every
later phase inherits that chrome. Doing it here means one review of the frame
instead of noticing it on every subsequent screenshot.

**Screens:** `dashboard` (1), plus the always-visible shell.

## What shipped

**Dashboard body**
- **Pending Approvals is now a queue, not just a number.** A `queue-panel` beside
  Nearest Dues lists what is waiting, oldest first, with a per-row **Approve**
  wired to the same `VoucherApprovalUiService` the voucher grids use — same
  confirm dialog, same endpoint, same toast. On success the queue *and* the KPI
  card are both re-read, so the count can't sit there stale next to a row that
  has gone.
- **The card and the queue count the same thing.** The KPI's own SQL is
  `status = pending AND isCurrent`, but the approvals endpoint's queue is
  `status IN (draft, pending)`. Rather than let the panel list more rows than the
  card claims, the request AND-composes a `status = pending` filter onto it.
  Drafts are excluded deliberately: nobody is waiting on a voucher its maker
  never submitted.
- **KPI grid is 8 cards, 4-up.** It was 10 across three grids, and the last grid
  held two cards in a four-track row — a permanently half-empty row. The two dues
  figures moved into the Nearest Dues panel's title, where they caption the queue
  they actually describe, and `.ds-grid--kpi` now declares explicit tracks
  (4 / 2 / 1 at 1440 / 1024 / 480) instead of `auto-fill`, which re-counted the
  tracks from the window and broke 8 cards as 5+3 on a wide monitor.

**Primitive changes** (pushed down into `queue-panel`, per decision 10 — both
consumers needed them, so they are not dashboard-local)
- `summary` — a headline figure in the title row, pre-formatted by the caller;
  the panel never totals anything itself.
- `linkRoute` / `linkLabel` — a footer link to the full screen, pinned to the
  card's bottom edge so two panels side by side line up whatever their row counts.
- **Rows wrap on a narrow card.** The one-line row overflowed straight out of the
  card at 480 — the amount and the Approve button were simply outside it. Now a
  **container query**, not a media query: a panel's width comes from the grid it
  sits in (~490px each when two share a 1440px row), so the browser width is the
  wrong thing to ask (CLAUDE.md §9).
- `stat-card` gets a phone density step: 8 KPIs stacked at ~205px each was
  1600px of scrolling before any content. Whitespace and display size only —
  labels, hints and tap targets unchanged. ~205px → ~152px.

**Shell**
- **`.matero-header` was dead CSS.** It was styled in three files and applied to
  *no element* — `app-header` never carried the class — so the header's
  background, blur and z-index, and `admin.component.scss`'s
  `.matero-header-fixed .matero-header { position: sticky }`, had never done
  anything. The class is now on the component host, and the component's own rules
  address the host through `:host` (an encapsulated `.matero-header` selector is
  rewritten to match *content* elements and would still miss the host).
- Shell variables in `_reboot.scss` route through the bare tokens instead of
  `--mat-sys-*` and two hand-picked greys. The header keeps its translucency via
  `color-mix()` over the real surface token, so it follows the palette switcher.
- **Active nav item**: `--primary-bg` wash instead of the saturated
  `--primary-container` (which read as a selected *button* at that size and
  competed with the page's own primary actions), plus weight 600 — the half that
  survives the collapsed rail, where the fill is a 4rem stub and the label is
  hidden. A leading accent bar was tried and abandoned: the item is a 1.5rem pill
  with `overflow: hidden`, so a bar at x=0 is clipped away everywhere except the
  item's exact vertical centre.
- **Material Symbols axes pinned globally.** The npm package's stylesheet sets no
  `font-variation-settings` at all, so every glyph rendered at whatever the
  browser defaulted to. Now `FILL 0, wght 400` app-wide, and the active nav
  destination takes `FILL 1, wght 500` — Material's own convention, and the same
  glyph on the same variable font, so no second icon name and no second file.
- Phone density on the header toolbar; the breadcrumb still drops at 480.
- Remaining hardcoded colour in the shell moved onto tokens — `menu-hub`,
  `user-panel`, `customizer` (shadows and scrim). One `#fff` is left, with a
  comment: it is the tick on a palette swatch whose background *is* the hue being
  previewed, so a token there would make it vanish on light hues.

**Backend (B-8):** `@ReadOnlyRequest()` on `POST /approvals/pending/:sourceType`.
The dashboard now depends on that endpoint, and it is a genuine read that the
P0-era sweep of 52 handlers missed — without it a company in billing read-only
grace gets a 402 where its approval queue should be. No other backend change was
needed (B-2 confirmed: the approve path and `sendDueReminderNow` already exist).

## Verification

`jayhindi-client-front`: lint 0 errors · breakpoint-guard OK · build clean.
`jayhind-client-back`: lint 0 errors · build clean · **95 suites / 1320 tests
pass** · `dump-routes` boots the real `AppModule` and still maps 707 routes.
`check-mirrors` in sync.

Browser pass — dashboard driven in Playwright Chromium, **light and dark at all
four breakpoints**, against the running stack. Screenshots and the probe report
in [`_ops/ui-refresh/p1/`](_ops/ui-refresh/p1/). Measured, not just looked at:
KPI track count 4/2/2/1 as intended · queue rows and Approve buttons present ·
amounts in IBM Plex Mono with `tabular-nums` · active nav at weight 600 on
`--primary-bg` with a filled icon, idle icons muted and unfilled · header
background now resolving (it did not before) · breadcrumb hidden at 480 · **no
horizontal overflow at any width** · **no console errors**.

**Approve was driven end-to-end, not just rendered:** 4 rows → 3, summary
"4 waiting" → "3 waiting", KPI card 4 → 3, no page errors.

### The test data question

No company in the dev database had a single voucher, so the approval queue, the
dues queue and P0's voucher status chips had nothing to render and could not be
checked by eye. Rather than ship the centrepiece of this phase unverified,
[`qa-artifacts/scripts/seed-voucher-fixture.js`](qa-artifacts/scripts/seed-voucher-fixture.js)
seeds a small fixture **through the API** — never straight into MySQL — so every
row went through the same DTO validation, tenant scoping and posting rules the
app uses. It is re-runnable and skips what already exists. Doing it this way
found three real rules the fixture had to obey rather than bypass: a party needs
an address before a voucher can resolve its GST split, a freshly provisioned
company has `approvalRequired: 0` (so nothing ever reaches the pending queue
until it is switched on), and segregation of duties means the account that
submits may not approve. P3.1 inherits the fixture.

## Not done in this phase, on purpose

- The `filter-chips` primitive — the Dashboard has no list toolbar. It lands in
  P2.1 with the Product list, its first real consumer.
- Mismatches **5, 6 and 7** in the log below: the customizer FAB overlapping card
  content, the Approve button being offered where segregation of duties will
  refuse it (**B-9**), and the voucher grid's unformatted Amount column. The
  first two are global/pre-existing and want a decision from you rather than a
  quiet fix inside a dashboard phase; the third belongs to P3.1.

## Corrected 2026-08-18 — dash-shape conformance audit

The canvas URL landed in the plan header this session, and against your
instruction to check already-shipped work against it, a full audit turned up a
real structural gap: **every dash-kind screen in the artifact (all 7 —
Business, Product, Job Work, HR ×2, Users & Roles, Party Portal) uses the
identical shape** — KPI strip → [one attention queue | a breakdown-bars panel]
→ trend chart — and this screen didn't match it. You picked "match the mockup
exactly" (see the two AskUserQuestion decisions this session); here's what
changed:

- **KPI strip: 8 cards → 6**, matching `S['dashboard'].kpis` exactly (Cash &
  Bank, Receivable, Payable, Net Profit, Stock Value, GST Liability). Approvals
  and Stock Alerts are counts, not money — they moved to where the artifact
  always put them: captioning the queue below.
- **Two queue panels (Pending Approvals, Nearest Dues) → one merged
  "Needs your attention" queue.** `attentionQueue` concatenates both sources
  (approvals first — they block a process — dues after); `attentionSummary`
  folds all three counts into one caption; `attentionLinks` gives the merged
  queue two footer links instead of one, since `ds-queue-panel`'s `linkRoute`/
  `linkLabel` inputs became a `links: {route,label}[]` array to support this
  (its only consumer at the time, so no other screen was touched).
- **New "Cash Position" breakdown panel** (`ds-breakdown-bars`, a new shared
  primitive — every dash screen in the artifact carries one of these beside
  its queue) — backed by **B-10**.
- **Top Products / Top Customers rank panels, Live System Monitor and Quick
  Actions removed.** None appear anywhere in the artifact's 7 dash-kind
  screens. `rank-panel.component.ts` and `quick-actions-card.component.ts`
  are deleted outright (zero remaining consumers after this and the P2.1
  correction below); `live-system-monitor.component.ts` too — its backing
  `SystemMetricsService` and the backend's `GET /dashboard` OS-stats route are
  left in place, unconsumed, in case a future ops-only page wants them; flag if
  you'd rather those removed too.
- Dashboard's nav-panel `sections` in `navigation.config.ts` dropped the two
  entries (`dash-rankings`, `dash-monitor`) whose destinations no longer exist
  — a panel entry may never point at a screen band that isn't there (Phase N's
  own rule).

**Verification:** `jayhind-client-back` — 95 suites / 1326 tests pass ·
`tsc --noEmit` clean · lint 0 errors · `ci-guard-raw-sql` clean (new queries)
· `dump-routes` boots clean, `products/summary` registered.
`jayhindi-client-front` — `tsc --noEmit` clean · lint 0 errors ·
breakpoint-guard OK · production build clean. `check-mirrors` in sync (nav
`shortName` values changed, no permission-key/licence mapping touched).
Backend queries confirmed executing against live seeded data in
`.dev-logs/client-back.log` (real `trx_accounts` balances, real stock-movement
sums). **Browser pass done** —
[`qa-artifacts/scripts/ui-refresh-dash-audit.js`](qa-artifacts/scripts/ui-refresh-dash-audit.js),
screenshots in [`_ops/ui-refresh/dash-audit/`](_ops/ui-refresh/dash-audit/),
light + dark at 480/1440, **108/112 checks green**. The 4 "failures" are one
false-negative repeated across all four runs: the merged queue correctly shows
no "view all" links because this tenant (`lg@yopmail.com`) genuinely has zero
pending approvals and zero dues — confirmed by eye (the empty-state message
renders correctly) rather than assumed. This tenant has no seeded catalogue
either, so the KPI/panel/column *structure* is verified but not populated
data — P1's own `seed-voucher-fixture.js` / P2.1's `seed-catalogue-fixture.js`
would still be the way to check chip tones and real numbers if that's wanted
before sign-off.

# Phase N — Two-column navigation + KPI strip *(done — awaiting review)*

Out of band with the module ordering on purpose: this is a **shape** change, not
a module. It landed after P2.1 because the two finished phases had to be brought
onto it before P3 copies the pattern into 45 more screens.

## What shipped

**The navigation is now two columns.**
- `app-nav-rail` — every top-level module as an icon with a short label, 1:1 with
  `navigation.config.ts` and filtered by exactly the same permission + licence
  rules the old single column used. It never collapses.
- `app-sidemenu` — rewritten from "a flat list of the 12 modules" into "the
  ACTIVE module's own pages", grouped by the config's `sub` nodes (`Overview`
  first, then one heading per group, in the config's own order — nothing is
  re-sorted). `MenuService.activeModule` resolves it from the URL's first
  segment against the permission-filtered tree, so a module the role cannot see
  can never become active.
- **Only the panel collapses.** That is what made the split worth doing: the old
  column had to choose between showing every module and showing a module's
  pages, and collapsing it to a 4rem stub of unlabelled icons took away both.
  The header's nav button now collapses the panel instead of closing the whole
  nav, and is always offered — hiding it while collapsed left no way back
  except hovering the rail.
- **A module with no child routes still gets a panel.** Dashboard and Company
  Configuration declare `sections` — in-page anchors whose `id` exists on that
  screen — and the panel scroll-links them with an `IntersectionObserver`
  marking where you are. Chat, Files, Audit Log and Export declare none, so they
  show their single destination rather than an invented sub-page. **No panel
  entry points at a destination that does not exist.**
- New optional `NavItem` fields, all display-only: `subtitle`, `shortName`,
  `sections`. `shortName` exists because a 3.5rem rail holds about ten
  characters and "Compan…" / "Human R…" are worse than a chosen word; the
  tooltip and the `aria-label` both carry the real name.

**The per-module tab bars are retired.** `ModuleLayoutComponent` (Product, HR,
Job Work, Users & Roles) is now nothing but its `<router-outlet>`. The panel
lists the same tree, in the same order, with the same permission filtering, at
full width — Product's seven tabs had already outgrown a 1440px row and were
paging behind chevrons. Keeping both would have shown every module's page list
twice on one screen.

**The KPI row is one divided strip** (`ds-stat-strip`, new primitive). Applied to
the Dashboard (P1) and the Product dashboard (P2.1) — 8 figures each, the same
eight numbers from the same `getKpis()` call, no data added or dropped.
- Track count follows the strip's **own** width, via container queries, not the
  window's: the content column is ~288px narrower whenever the nav panel is
  open, so a viewport query says "1440, go 8-across" while the strip is actually
  1088px and every figure ellipses (CLAUDE.md §9). Steps are 1 / 2 / 4 /
  one-per-item at 0 / 480 / 720 / 1024 container width.
- Dividers are the grid's own 1px gap painted in the border colour, so there is
  no doubled line at a row's end and no `:last-child` rule to break when the
  track count changes.
- The figure steps down to 0.9375rem at the densest step so a crore-scale rupee
  amount fits instead of ellipsing — **measured**, not assumed (see below).
- `ds-stat-card` is untouched and still in use by the Job Work, HR and Party
  Portal dashboards until their own phases.

**Two real bugs fixed on the way, both surfaced by the browser pass:**
- **`CountUpDirective` formatted numbers in the browser's default locale.** On an
  `en-US` browser every headline figure on every dashboard rendered ₹132,400
  instead of ₹1,32,400 — Western grouping in an Indian-market ERP that already
  pins its date locale for the same reason. Now `en-IN` explicitly. This fixes
  `ds-stat-card` too, so it reaches screens no phase has touched yet.
- **The shell's own layout thresholds were 599/960**, two values on no scale the
  app uses. Now 720/1024, from the governed four (CLAUDE.md §9): overlay nav
  below 720, rail-only to 1023, both columns at 1024 and up.

## Verification

`npm run lint` 0 errors · breakpoint-guard OK · `npm run build` clean ·
`check-mirrors` in sync. No backend change in this phase.

Browser pass —
[`qa-artifacts/scripts/ui-refresh-nav-strip.js`](qa-artifacts/scripts/ui-refresh-nav-strip.js),
screenshots and report in [`_ops/ui-refresh/nav-strip/`](_ops/ui-refresh/nav-strip/).
Measured across light + dark at 480/720/1024/1440 **and** on four module shapes
(a leaf with sections, a leaf without, a module with groups, the 26-link
Transaction panel):
- strip tracks 1 / 2 / 2 / 8 at the four widths (the 1024 case is 2 because the
  content column there is 672px with the panel open — collapsing it gives 4);
- **zero clipped text anywhere**: not one rail label, panel link, panel title,
  strip label or strip value overflows its box at any width, in either theme;
- a crore-scale ₹1,23,45,678 injected into the tightest 8-across cell **fits**;
- no horizontal overflow at any width; **no console errors**;
- collapse driven end-to-end: 288px → 72px, content margin follows, all 11 rail
  icons still present, expand returns to 288px;
- rail navigation driven: clicking the People icon re-titles the panel "Human
  Resources" and re-fills it with Overview / Attendance / Leave / Payroll /
  Masters;
- section scroll driven: clicking "Sales vs purchases" scrolls the content 645px
  and the panel's active marker follows.

## Not done in this phase, on purpose

- **Transaction keeps its right-hand rail**, so that module currently shows its
  page list twice. Deliberate: the rail's "Menu" group is not just a list — it
  also drops entries the admin hid company-wide (`hiddenTransactionMenus`) and
  hides Pending Approvals when no voucher type needs approval. Deleting it
  without moving those two rules into the panel would be a functional
  regression, and the rules are Transaction's own. **This is the first item for
  P3.1**, together with folding Quick Voucher Entry (the part the panel genuinely
  cannot show, since `vouchers` is `hidden: true`) into whatever replaces it.
- Job Work, HR and Party Portal dashboards keep the card grid until their phases
  (your scope decision).

## Corrected 2026-08-18 — nav panel gaps found in the artifact audit

The same audit that found the dashboard shape gap (see P1's addendum above)
also read `canvas-app-shell.jsx` (the artifact's own render logic) against
`sidemenu.component.ts` and found three real behavioural gaps, all fixed now
— none needed a decision, they're pure conformance with no downside:

- **Rail short-labels corrected** on 7 of 12 modules (`navigation.config.ts`):
  Dashboard→**Home**, Transaction→**Books**, Product→**Stock** (was
  "Products"), Job Work→**Shop**, Users & Roles→**Access** (was "Users"),
  Audit Log→**Audit**, My Account→**Portal** (was "Account").
- **Accordion collapse for dense modules** — the artifact collapses a
  module's page-groups once it has more than 14 items (one group pinned open,
  the rest closed with a chevron toggle and a collapsed-count badge); the real
  panel showed every group flat regardless of length — Transaction's ~26
  currently-listed items (more once P3.1 restores the voucher-type groups
  the panel doesn't show yet, see Phase N's own "not done" note above) made
  for one long unscannable list. `SidemenuComponent.groups` now carries
  `pinned`/`open`/`key` per group; the first group and any group holding the
  active route default open, everything else defaults closed and remembers
  what you last toggled it to.
- **Panel filter box** — the artifact shows a "Filter this module…" input
  above any panel with more than 10 items; added, filtering by name and
  auto-expanding whichever collapsed groups match.
- `MenuService.url` — new public accessor (was tracked privately already,
  just unexposed) so the sidemenu can tell which group holds the active route
  without standing up a second router subscription.
- **Not done:** per-item badge counts (`NavItem.badge` exists, the template
  now renders one if set, but nothing sets one yet — wiring real counts
  in touches per-module data loading, one nav item at a time, better done as
  each owning phase ships its data rather than as a batch here).

# P2 — Product & Service

Two gates, because 14 screens is more than one useful review.

### P2.1 — Product list, Service list, Product dashboard *(done — awaiting review)*

**Screens:** Product List, Service List, Product Dashboard, plus the Product
add/edit dialog. **This is the gate where the list shape gets settled** —
everything in P3–P8 copies it, so the four changes below are all made in the
*primitive*, not in the two screens that happen to consume them first.

**Backend (B-1) — both-side view counts.** `paginateNew` (the one choke point
every list endpoint goes through) now returns `activeCount` + `archivedCount`
alongside `totalItems`, so the Active|Archived tabs are both numbered as the
mockup draws them. This closes mismatch 1 and reverses decision 7.
- Exactly **one** extra query per list: the view just read already reported its
  own count, so only the opposite side is unknown, and it is a `count()` (no
  rows fetched) with `order`/`attributes`/`limit`/`offset` dropped.
- The opposite count reuses the **same composed where/include** as the list, so
  the tabs describe the universe the grid is showing — filter the list to Draft
  and the tabs read 2 / 0, not 5 / 1. Verified in the browser, not just asserted.
- Sent only for soft-deletable models, tested by the same
  `findAndCountAllDeleted` the archived read itself goes through; an entity with
  no archived view sends neither and the toolbar falls back to one count.
- 6 new Jest specs beside the 8 existing `paginateNew` ones.

**Backend (B-7) — no change needed, and that is a finding, not a skip.** Every
figure on the Product dashboard already comes from `getKpis()`: all 8 KPI cards,
both charts, both panels. The only derived number on the screen is the gross
profit *percentage* badge, computed from two served fields and labelled as a
ratio. Nothing on that dashboard is a client-side guess, so there was nothing to
add. (B-7 stays open for P3.1/P5/P6, which have their own dashboards.)

**`filter-chips`** — the fourth P0 primitive, deferred to its first real
consumer, now shipped as `ds-filter-chips` + `[filterChips]` on
`paginated-table`. A chip carries a fragment of the **same `Filters` map the
filter dialog builds**, so chips and the dialog are one mechanism rather than
two: a chip on `status` leaves a dialog filter on `name` alone. Single-select on
purpose (the chips of one row are alternative answers to one question), and the
lit chip is **derived from the live filter map**, never stored — so editing that
filter in the dialog un-lights the chip that no longer describes the list.
Product and Service get Active/Draft/Inactive presets.

**`status-chip` on grid `tag` columns.** `type: 'tag'` rendered one
primary-tinted pill whatever the value said. Tag cells now render through
`ds-status-chip`, and a column may declare `tone` (and `tagIcon`) as a value or
a function of the row. Product/Service map Active→success, Draft→warning,
Inactive→muted, with icons.
- **App-wide effect, deliberate:** a column that declares no tone gets the
  neutral one, so the 13 tag columns in modules not yet reviewed (HR, tax rates,
  audit log…) now read as neutral labels instead of uniformly primary-blue. That
  is the honest default — a grid cannot know that "Draft" is bad news — and each
  of those columns gets its real tones in its own phase.

**`ds-form-section`** — the *form* shape's section chrome (icon + title + a
hairline tying the header to its own fields), added to the design system rather
than to the product form, because the voucher form (P3.2) and the employee form
(P6) are the same shape and must not each invent their own. The product add/edit
dialog is its first consumer.

**Also fixed in passing:** the product form's GST-rate hint said in its own
comment "green when it filled itself in" while the code used `--mat-sys-primary`
(blue). It is `--success` now, i.e. what the comment always claimed.

**P2.1 verified:** client-back `npm run build` clean · `npm run lint:ci` 0 errors ·
**1326 Jest tests in 95 suites, all passing** (up from 1310/94 — the 16 new ones
are `paginateNew`'s counts) · client-front `npm run build` clean ·
`npm run lint` 0 errors · breakpoint guard OK · `check-mirrors` in sync ·
driven in Playwright Chromium against the running stack, light + dark, at
480/720/1024/1440, with **zero console errors, zero failed requests** and no
horizontal overflow at any width. Measured rather than eyeballed (`qa-artifacts/scripts/ui-refresh-p2.js`):
- both view tabs numbered from the server (`Active 5 / Archived 1` on Product,
  `3 / 1` on Service), and correct on the archived view too;
- **the counts follow the filter** — clicking the Draft chip takes the grid from
  5 rows to 2, all of them Draft, and the tabs to `2 / 0`; clicking All restores 5;
- the three status tones resolve to three distinct colour pairs in **both**
  themes, each with its icon glyph rendering;
- numeric cells still `right / IBM Plex Mono / tabular-nums`;
- the form's section headers carry their hairline and themed icon in both themes
  — worth measuring because that rule is global CSS applying into an overlay;
- the dashboard's re-pointed colour rules resolve to real themed values
  (alert-row border, alert badge), checked with actual alert rows on screen.

**Test data:** the tenant had one product, all Active, nothing archived, and no
reorder levels anywhere — so chips, tones, the Archived tab and the dashboard's
Stock Alerts panel had nothing to render.
`qa-artifacts/scripts/seed-catalogue-fixture.js` seeds a real catalogue through
the **API** (never straight into MySQL, so every row passes the same DTO
validation and tenant scoping the app uses): 5 goods + 3 services across all
three statuses, one of each archived, and stock levels that put two products at
or below their reorder level.

**One environment flake, recorded rather than hidden:** two of the four full
sweeps logged transient `ERR_CONNECTION_REFUSED` against `:3000` on the last
context of the screens loop (`product-dashboard 1440/dark`), which also lost its
data that run. It is not the screen and not volume: a clean full sweep, three
isolated loads of that exact screen and 24 sequential ones were all green with
`health/live` returning 200, and the final committed run has both counters at
zero. The harness now records the failed request's **URL and reason**, not just
the page's console line, so a recurrence names the endpoint instead of leaving
it to inference.

**Not done in P2.1, on purpose:** the Product **view** dialog is left to the P9
dialogs sweep — it is a dialog pattern, not a list or form shape, and P9 owns
those. Product/Service list screens themselves are complete.

## Corrected 2026-08-18 — artifact conformance audit (dashboard + list columns)

Same session, same audit as P1's addendum above. Two AskUserQuestion decisions
governed the fix: **dashboard shape → match the artifact exactly**;
**list columns → add what's missing, keep both dimensions** (i.e. don't drop
real data the artifact's example rows don't happen to show).

**Product Dashboard — rebuilt to the `dash` shape** (was carrying its own
Top-Products bar chart + leaderboard + a Product-Status donut, none of which
appear in `S['product/dashboard']` or anywhere else in the artifact's dash
vocabulary):
- KPI strip **8 cards → 5**: Products, Services, Stock Value, Below Reorder,
  Slow Moving — matching the artifact's own 6, minus "Price changes" (**B-13**,
  no real data behind it anywhere in this app — shipped honest rather than
  fabricated).
- Stock Alerts card retitled "Stock Needing Action" (the artifact's queue
  title) and kept as its own progress-bar list rather than forced into
  `ds-queue-panel`'s icon/amount row shape — a reorder alert reads better as
  "available vs. reorder level" than as a currency amount, and there's no
  working create-PO action to put behind a button yet (§9 — never offer an
  action the server would refuse; **B-4** is that action, if you schedule it).
- New "Value by Category" breakdown panel (`ds-breakdown-bars`) and "Stock In
  vs Out" trend chart (`buildStockInOutChart`, Received/Issued) — backed by
  **B-11/B-12**. `buildTopProductsChart`/`buildProductStatusChart` deleted
  from `dashboard-charts.ts` (zero remaining consumers).

**Product List columns** — Category added (new `productCategories` relation
on the `Product` entity + `findAll()` include — a product may carry more than
one, the grid lists every name, comma-joined); Manufacturer and the Cost/Sale
Price split **kept** (per your "keep both dimensions" call); a second
**Stock Health** tag column added beside the existing catalogue-lifecycle
Status (computed client-side from `productQuantity`, already on every row —
see `stock-health.util.ts`; its "at/below reorder" threshold matches the
backend's own `stockAlertCount()` exactly, so the two can't disagree about
which rows count); a **summary strip** above the grid (Products / In Stock /
Below Reorder / Stock Value) — backed by **B-15**.

**Service List** — GST% column added, reading `pricing.salesTax.rate`, already
on every row via the same relation the price tiers use (no backend change).

**Verification:** same clean bill as the P1 addendum — `jayhind-client-back`
95/1326 tests pass, `tsc`/lint/`ci-guard-raw-sql`/`dump-routes` all clean
(`products/summary` registered); `jayhindi-client-front` `tsc`/lint/breakpoint-
guard/build all clean. `check-mirrors` in sync. Browser pass done — same run as
P1's addendum, 108/112 checks green (product dashboard 5-KPI set, Value by
Category panel, Stock In vs Out chart, product-list summary strip + Category +
Stock Health columns, service-list GST column all confirmed rendering in both
themes at both widths). This tenant has no catalogue seeded, so structure is
verified, not populated data — see P1's addendum for the same caveat.

### P2.2 — Masters, product management, stock conversion, configuration *(done — browser-verified 2026-08-19)*
**Files:** `product/masters/**` (manufacturer, measurement unit, return policy,
product condition, warranty, categories & tags), `product/product-management/**`
(quantity, price, media), `product/stock-conversion/**` (conversions, BOM
templates), `product/product-configuration/**` (general settings, dynamic fields),
`styles/design-system/_settings.scss` (new), `app/app.config.ts`
- Same list shape for the six masters, the **gallery** variant for Product Media,
  the **settings** shape for configuration.

**What shipped**

- **en-IN is now the app's locale, not a per-call-site formatter.** The
  conversion and BOM money cells printed `₹126,200.00` — US grouping — because
  `| currency:'INR'` renders under Angular's default `en-US` and no `LOCALE_ID`
  was ever provided. That is mismatch 7 again, in its pipe form, at **87 call
  sites** across HR, party portal, invoice scanning, e-Way Bill and stock
  conversion. Registering `en-IN` in `app.config.ts` fixes all of them at the
  root rather than rewriting each cell (decision 10: fix the primitive).
  Verified safe for dates first — every `| date` in the app passes an explicit
  format string, so the only ones affected are the named `mediumDate` /
  `medium` / `shortTime` forms, which move from US ordering to the day-first
  ordering this app already uses everywhere else.
- **The five masters now say what uses them (B-16).** Manufacturer / Measurement
  Unit / Return Policy / Product Condition / Product Warranty listed only
  Id-Name-Description; the reference gives each a usage count (Products / Used
  by / Applies to / Items). `CommonDataService.attachReferenceCounts` stamps it
  from one grouped query over the page's own ids — through the ORM, so tenant
  scoping and the paranoid clause apply, and a master reports the products
  **still** using it. Deliberately not an `include` + `COUNT` on `paginateNew`:
  that needs a GROUP BY, which turns `findAndCountAll`'s COUNT into one row per
  group and breaks `totalItems`. The column is `sortable: false` on purpose —
  it is computed after pagination, so there is no DB column to sort on and
  offering one would be a button the server cannot honour (§9).
- **Quantity gained a reorder level and a stock-health chip**, reading the same
  `available` vs `minimumAvailableQuantity` verdict the Product List's own
  Stock Health column uses — `stock-health.util.ts` now exposes `stockHealthOf`
  over the levels alone, so the screen where those two figures are *edited*
  cannot disagree with the list that reports them. No backend change: both
  figures were already on the row.
- **Two more hand-rolled status pills folded onto `ds-status-chip`** —
  conversions' `.sc-status` and BOM templates' `.bt-flag`, each with its own
  frozen success/error hues. That is the fourth and fifth copy of a vocabulary
  P0 made a primitive. Both stylesheets shrank to nothing or near it; Dynamic
  Fields' three `.df-chip` variants went the same way, and its empty state is
  the shared `ds-empty-state` now.
- **Product Media is the reference's `files` shape.** It was a grid whose
  columns were multer's own bookkeeping — `encoding`, `mimetype`, `filename`,
  `path` — which say nothing about a picture. It now opens as a tile gallery
  (thumbnail, name, size · date, tinted type icon for non-images, click to
  preview through the shared `document-viewer`), with a toggle back to a table
  for the sort/filter/bulk work tiles cannot do. Column count follows the
  panel's width via a container query, not the viewport's (§9).
- **Product Configuration is the reference's `settings` shape.** The accordion
  hid half the decisions behind a disclosure; it is grouped setting cards now —
  label plus what it does on the left, the control on the right. Built as a
  shared partial (`styles/design-system/_settings.scss`), not per-screen,
  because Transaction, Job Work, HR and Site Configuration all have one of
  these and must not drift into five ideas of what a setting looks like.
- **Categories & Tags lost a dead table and gained an empty state.** The screen
  rendered a two-column `<table mat-table>` above the tree with no data source
  at all — a header row over an empty elevation box. And on a company with no
  categories yet it rendered *nothing*: toolbar over blank space. Both fixed.
- **Test data**: [`qa-artifacts/scripts/seed-catalogue-fixture.js`](qa-artifacts/scripts/seed-catalogue-fixture.js),
  same doctrine as the voucher fixture — through the API, re-runnable. It seeds
  a category tree with children and tags, the five masters, three products
  across them, and **lakh-scale prices on purpose**: en-IN grouping only differs
  from the US form past six digits, so a fixture of two-digit rates cannot
  prove the locale change worked.

**P2.2 verified:** `npm run build` clean · `npm run lint` 0 errors ·
breakpoint guard OK · `check-mirrors` in sync · client-back `npm run build`
clean and **95 suites / 1326 Jest tests passing** · driven in Playwright
Chromium against the running stack, light + dark at 480/720/1024/1440 —
**213/213 checks green**, no console errors, no failed requests, no horizontal
overflow. Screenshots in [`_ops/ui-refresh/p2.2/`](_ops/ui-refresh/p2.2/).

Two of those checks were *rewritten* mid-pass because they were passing
vacuously: the usage-count check confirmed the column existed but never read a
cell (the bulk-select column's blank `<th>` was being filtered out, shifting
every index by one), and the en-IN check reported green on `₹24.00`, an amount
too short to distinguish the two groupings at all. Both now assert the value —
counts read `3` and `6`, money reads `₹1,26,200.00`.

---

# P3 — Transaction

The biggest module (~45 screens, 129 files). Four gates.

### P3.1 — Voucher lists + Pending Approvals + Transaction dashboard *(in progress)*
**Files:** `transaction/vouchers/trx/{trx.ts,trx.html,trx.scss}`,
`transaction/vouchers/{trx-pay-rece,trx-journal,trx-contra}/**`,
`transaction/pending-approvals/**`, `transaction/transaction-dashboard/**`,
`shared/voucher-list-toolbar/**`, `shared/voucher-summary/**`,
`styles/design-system/_app.scss`
- `filter-chips` in the toolbar; e-Way Bill / e-Invoice inline chips and voucher
  status chips onto the `status-chip` primitive.
- **Re-checks the P0 voucher-chip refactor by eye** — the one thing P0 could not
  verify. Needs a tenant with voucher data seeded before the browser pass.
- Covers all 14 voucher types that share `trx.ts` (purchase requisition, purchase
  order, goods receipt, purchase, debit note, quotation, sales order, delivery
  challan, sales, credit note, payment, receipt, journal, contra).

**What shipped so far**

- **Status is chips, not a dropdown.** `voucher-list-toolbar` rendered a `Status`
  select beside Period and Quick-search; it is now a `ds-filter-chips` row, so
  the one question these screens get asked all day is answered in one click
  rather than two. The chips carry **counts from the same `TrxSummary.byStatus`
  the summary bar renders**, so a chip's number and the bar's badge cannot
  disagree; a host with no summary (the scan queue) gets bare labels, which is
  `ds-filter-chips`' own "no count reported" rule rather than a wrong zero.
  The chip `filters` map is deliberately empty — this toolbar owns `status`
  through `VoucherFilterCriteria`, so the row presents that one field instead of
  becoming a second filter mechanism beside it.
- **Mismatch 7 closed.** The Amount column printed a bare `24500`. A new shared
  `utils/currency.util.ts` (`formatInrAmount`) formats every money column across
  the trx, payment/receipt, journal and contra lists and all three Pending
  Approvals tabs — en-IN grouping, so ₹1,32,400 rather than ₹132,400. It also
  replaced the Product list's own private copy of the same formatter.
- **Transaction dashboard rethemed in place, not rebuilt** (your call — see
  mismatch 13). Its fund cards had every colour frozen as a hex
  (`#2e7d32`, `#0277bd`, `rgba(0,0,0,.05)`…) and stale `--mat-sys-*` fallbacks,
  so the whole strip stayed light-mode-coloured in dark; all of it now runs on
  the bare tokens, and its money figures carry the app's tabular mono like every
  other numeric surface.
- **Compliance cells detoned off hardcoded hex.** `trx.scss`'s e-Way Bill /
  e-Invoice chips were `#16a34a` / `#dc2626` / `#f59e0b` with
  `--mat-sys-on-surface` mixes; they are the design system's
  `--success`/`--error`/`--warning` pairs now, so they follow the theme.
- **Summary bar likewise.** `voucher-summary-bar` carried a second hardcoded copy
  of the same status hues (`rgba(217,119,6,.14)`…) that the status chip renders
  from tokens — the two drifted apart in dark mode. Now one vocabulary. Its own
  narrow-width rule was a viewport `@media` on a bar whose width comes from the
  content column, so it is a container query now (CLAUDE.md §9).
- **Test data**, per the plan's own rule that a browser pass needs real rows:
  [`qa-artifacts/scripts/seed-voucher-fixture.js`](qa-artifacts/scripts/seed-voucher-fixture.js)
  seeds the fixture **through the API**, never into MySQL, so every row passes
  the same DTO validation, tenant scoping, numbering and posting rules the app
  uses. Re-runnable and idempotent per voucher. Building it this way surfaced
  four real rules it had to obey rather than bypass: a party needs an **address**
  before GST can resolve a place of supply; **segregation of duties** refuses to
  let the account that submitted a voucher approve it (so the fixture creates a
  genuine second "checker" user instead of switching `allowSelfApproval` on);
  **negative-stock check** refuses a sales approval for stock no approved
  purchase has brought in yet; and a payment/receipt is refused unless it
  actually allocates against an invoice.

### P3.2 — The voucher entry form *(done — browser-verified 2026-08-19)*
**Files:** `transaction/vouchers/trx/trx-add-edit/**`,
`src/styles/design-system/_voucher.scss` (1234 lines),
`shared/voucher-compliance/**` (new), plus **B-3** in `jayhind-client-back`
- The single biggest retheme in the project: systematic token pass across the
  `.vch-*` classes, `tabular-nums` on line-item and totals columns, line-item table
  density, sticky totals bar.
- Adds the **read-only compliance preview strip**, backed by **B-3**. The
  post-approval flow is untouched.

**What shipped**

- **The whole `.vch-*` sheet is theme-aware, from one place.** Every colour
  indirected through `--mat-sys-*` with a frozen light-mode hex fallback
  (`var(--mat-sys-surface, #fff)`, `var(--mat-sys-error, #d32f2f)`, …), so any
  role Material did not define stayed at a light literal in dark mode. All 18
  such references are gone: the `--vch-*` token block at the top of the file now
  resolves to the P0 bare tokens, which re-bases 1,234 lines at once.
- **The titlebar follows the theme.** It was `#1e293b` on `#f1f5f9`, commented
  "stable across light/dark" — which in practice meant a dark slate bar sitting
  on a light form. A `.theme-dark .vch-shell` override then escaped it to a
  neutral `--surface-2`, so the two schemes had two different designs for the
  same element. It is `--primary-container` / `--on-primary-container` now —
  one design, and the override is gone as redundant. Measured: light
  `rgb(215,227,255)` on `rgb(0,69,143)`, dark exactly inverted.
- **Voucher figures read like every other number in the app.** `tabular-nums`
  was already broad but IBM Plex Mono was on only 3 selectors; the line-item
  amount, the GST cell, the footer totals and the amount input carry it now.
  Tabular figures alone stop digits jittering — they do not make a column read
  as a column.
- **The compliance preview strip (B-3, mismatch 3).** Three lines above the
  sticky footer saying what approving this voucher will do: e-Invoice, e-Way
  Bill, stock. **The strip derives nothing.** Every input is a server decision —
  the module licence, the company's toggles, the configured e-Way Bill
  threshold, the party's GSTIN, the per-voucher-type negative-stock override,
  live stock on hand — so re-deriving any of them in the template would be a
  second implementation of rules the API owns, and the first disagreement would
  have the strip confidently describing an approval that then behaved
  differently. It renders `GET /trx/:id/compliance-preview` verbatim, and the
  browser pass asserts the DOM against that same response rather than counting
  boxes.
- **The gateway answers are the existing ones, asked differently.** Both
  `getEligibility` methods return "approve the voucher first" for any unapproved
  voucher — the exact state a preview is drawn in, so reusing them as-is would
  have made every preview say that and nothing else. They take a
  `{ preApproval: true }` option now which skips **only** that gate; every other
  block reason stays shared, so the preview and the post-approval dialog cannot
  drift apart.
- **The stock line mirrors `InventoryService`'s own decisions** rather than
  inventing new ones: the voucher type decides direction, a type with
  `updateInventory` off moves nothing, service lines are skipped, and the
  per-type `negativeStockCheck` overrides the company flag exactly as at posting
  time. It also sums a product appearing on more than one line — two lines of 60
  against 100 on hand is short even though neither line is. Tone tracks what the
  server will actually **do**: an error when the check will refuse the approval,
  only a warning when negative stock is permitted.

**P3.2 verified:** client-back `npm run build` clean, **96 suites / 1341 Jest
tests** (15 new specs on `compliance-preview.const.ts`), `dump-routes` boots the
real `AppModule` and lists `GET /trx/:id/compliance-preview`, no raw SQL added ·
client-front build clean, lint 0 errors, breakpoint guard OK, `check-mirrors` in
sync · driven in Playwright Chromium, light + dark at 480/720/1024/1440 —
**33/33 checks green**. Screenshots in [`_ops/ui-refresh/p3.2/`](_ops/ui-refresh/p3.2/).

Two harness checks were rewritten mid-pass for measuring the wrong thing, both
worth recording because they are easy traps: reading `borderTopColor` off an
element that sets no border reports its `color` instead, and
`getPropertyValue('--vch-border')` hands back the *unresolved*
`light-dark(#c4c6d0, #44474e)` literal — identical in both themes, because
`light-dark()` resolves where it is **used**, not where the custom property is
computed. The pass now applies each token to a probe element inside the shell
and reads the used value back; all seven `--vch-*` roles are confirmed to
actually move between themes.

**What the browser pass could NOT exercise:** the test tenant has e-Invoice and
e-Way Bill switched off, so both gateway signals render in their `muted`
"switched off" branch. The 15 unit specs cover the required / blocked / already
-registered / sub-threshold / services-only branches; the browser pass proves
the DOM mirrors whatever the server returns. Turning the gateways on needs real
GSP credentials, which a fixture cannot honestly fake.

### P3.3 — Statements, registers and reports *(done — browser-verified 2026-08-19)*
**Files:** `transaction/reports/reports.shared.scss` (the one sheet all 14
reports use), `transaction/{party-statement,gst-returns}/**`,
`reports/{trial-balance,balance-sheet,stock-ledger}/**`
- Report shape: period selector + dense numeric grid + export bar. Almost entirely
  typography and alignment, which is exactly what IBM Plex Mono + `tabular-nums`
  from P0 were for. **No backend change** — these screens already return
  everything the reference shows.

**What shipped**

- **A silent alignment bug across all 14 reports, found by measuring.**
  `.report-table .num` set `text-align: right`, and every numeric *header*
  rendered left anyway. The cause is a real Angular trap worth recording: under
  emulated encapsulation every compound selector gains an attribute, so
  `.report-table thead th` becomes three compounds (one class, three
  attributes, two elements) while `.report-table .num` becomes two — the first
  outranks the second even though the second has more classes. The
  `font-family` in the same block still applied, which is exactly why it looked
  like it had worked. Numeric headers are now right-aligned explicitly, over
  their figures, which is also what the reference's `>` header prefix means.
- **The mono face is on body cells only.** A column header is a word
  ("Opening Dr"), not a figure; setting it in a tabular mono makes the label
  read as data.
- **A permanently-frozen pill fixed.** `.voucher-block .vtype` (Day Book, Group
  Statement) used `var(--ds-primary-soft, #e7efff)` — and `--ds-primary-soft`
  **is not defined anywhere in the design system**, so the fallback was not a
  fallback at all: every render was a literal light-mode blue, in both themes.
  It is `--primary-bg` now. Measured live: light `rgb(230,238,251)`, dark
  `rgb(15,35,64)`.
- **Every other frozen fallback in the shared sheet is gone** — twelve
  `var(--ds-x, #hex)` pairs across the table, section rows, subtotals, grand
  totals and the KPI band, all now bare tokens.
- **Two more hand-rolled pills onto `ds-status-chip`**: `.balance-chip`
  (Trial Balance, Balance Sheet, GSTR-3B ×2) and `.dir-chip` (Stock Ledger's
  IN/OUT badge). That is the sixth and seventh copy of a vocabulary P0 made a
  primitive.
- **The KPI band is one divided band**, matching `ds-stat-strip`'s shape
  decision (decision 14), with its figures in mono/tabular. Deliberately still
  its own class rather than the component: a report's headline figures are read
  *with* the grid under them, so they take the grid's typography and skip the
  count-up animation, which is dashboard punctuation and pure noise over a
  number someone is reading off a statement.
- **`.report-columns` is a container query now.** Two side-by-side statements
  (Income/Expense, Assets/Liabilities) collapsed to one column on a viewport
  `@media` — but what decides whether two tables fit is the *content* column,
  which is ~288px narrower whenever the nav panel is open (CLAUDE.md §9).
- **`.empty-note` deliberately kept.** Of its 37 sites most are terse
  `<td colspan>` placeholders inside a table; `ds-empty-state`'s icon art and
  48px padding belong on an empty *screen*, not an empty table body.

**P3.3 verified:** build clean · lint 0 errors · breakpoint guard OK ·
`check-mirrors` in sync · 18 screens driven in Playwright Chromium, light + dark
at 480/720/1024/1440 — **258/258 checks green**, en-IN grouping exercised on 18
real six-figure amounts, no console errors, no failed requests, no horizontal
overflow. Screenshots in [`_ops/ui-refresh/p3.3/`](_ops/ui-refresh/p3.3/).

### P3.4 — Masters, configuration, data import, invoice scanning *(done — browser-verified 2026-08-19)*
**Files:** `transaction/masters/**` (nature, group, financial year, GST rates),
`transaction/transaction-config/**`, `data-import/**`, `invoice-scanning/**`,
`scripts/token-guard.js` (new), `styles/design-system/_tokens.scss`
- Settings shape + the **scan** variant (upload → queue → review), whose chips were
  already folded onto `status-chip` in P0 and get their visual check here.
- **No backend change.**

**What shipped**

- **A whole class of frozen-colour bug, found and then made impossible.**
  P3.3 turned up one `var(--ds-primary-soft, #e7efff)` whose token is declared
  nowhere — so the "fallback" was never a fallback, it was the value, on every
  render, in both themes. An app-wide audit for the same shape found **19 more
  across nine modules**, including `--ds-shadow-1` introduced two phases
  earlier *in this refresh*. All 20 now point at tokens that exist.
  - The failure mode is nasty precisely because it looks fine: the page
    renders, the colour is plausible, and nothing in the source says the token
    is missing. Only the theme switch reveals it, and only if someone looks at
    that screen in the other theme.
  - So [`scripts/token-guard.js`](jayhindi-client-front/scripts/token-guard.js)
    now fails `npm run lint` on any `var(--ds-*, …)` naming a token
    `src/styles/` does not declare — a sibling of `breakpoint-guard.js`, wired
    into both `lint` and `lint:ci`, with **no grandfather list**. Scope is the
    `--ds-*` namespace on purpose: a component may legitimately define and
    default its own local property (the stat strip's `--strip-cols`, a print
    template's `--accent`), but a `--ds-*` the design system does not define is
    always a mistake. Verified to actually fail on injected drift.
- **The last `--mat-sys-*` fallbacks in this module are gone** — scan review's
  panel surfaces, the data-import detail's 54 raw values, the mapping and
  voucher-review dialogs, GST rates' chip.
- **Scan review's document stage was a literal `#1e293b`.** It is `--surface-3`
  now: still darker than the app surface in both themes, because a scan is a
  photo of white paper and needs a surround to read against, but taken from the
  theme rather than frozen. The page inside it stays `#fff` deliberately — that
  is the document, not chrome, and it is the one hex left in the module.
- **Transaction Configuration's own chips fold onto `ds-status-chip`** — the
  `.tcfg__chip` (ok/info/warn) and `.tcfg__badge--warn` pills, the eighth and
  ninth copies of that vocabulary.
- **The config screen keeps its card grid**, deliberately, rather than becoming
  the `ds-settings` shape P2.2 built. Same reasoning as mismatch 13: each card
  carries a show/hide toggle, a set of derived state chips *and* a Configure
  action into a per-voucher editor. Flattening that into label-plus-control
  rows would delete two of the three.
- **Test data**: [`qa-artifacts/scripts/seed-data-import-fixture.js`](qa-artifacts/scripts/seed-data-import-fixture.js)
  uploads the Tally masters fixture this repo already ships, through
  `POST /import/upload` exactly as the dialog does, and parses it — the Data
  Import list and detail render nothing at all on a tenant that has never
  imported. It stops **before committing** the staged rows: the goal is a batch
  to look at, not a second chart of accounts in the tenant the other fixtures
  use.

**P3.4 verified:** build clean · lint 0 errors · breakpoint guard OK ·
**token guard OK** · `check-mirrors` in sync · 8 screens driven in Playwright
Chromium, light + dark at 480/720/1024/1440 — **105/105 checks green**, every
screen's card and chip surface proven to resolve differently in the two themes,
no console errors, no failed requests, no horizontal overflow. Screenshots in
[`_ops/ui-refresh/p3.4/`](_ops/ui-refresh/p3.4/).

**What the browser pass could NOT exercise:** `scan-review` needs a scanned
invoice, which needs the OCR sidecar (Qwen3-8B on CPU) running and a real
document through it — not something a fixture can honestly fake. Its stylesheet
was rethemed and is covered by the token guard and the build; its rendered
surfaces are unverified. The scan **queue** was driven (empty).

---

# P4 — Chat *(done — browser-verified 2026-08-19)*

**Screens:** 1. **Files:** `src/components/admin/chat/**` (4 files)
- The mockup's chat variant: conversation list, message column, composer,
  presence/unread treatment.
- **Backend (B-6): no change needed** — confirmed by reading the code rather
  than assumed. `chat.service.ts` already returns a per-conversation
  `unreadCount` on the conversation list and serves `GET /chat/unread-count`;
  `socketGateWay.ts` already relays `chat:typing` and tracks per-socket
  `chat:focus`, and the screen already consumes all three. Online/offline
  presence is *not* broadcast — and the reference's chat screen does not show
  presence dots either (its threads are initials + name + last message + time),
  so there is nothing missing to build.

**What shipped**

- **A three-way colour collision, fixed.** The selected conversation row, the
  avatar *inside* that row, and your own message bubbles were all
  `--primary-container`. Two consequences, both visible: the avatar vanished
  into the row exactly when the row was the one you were looking at, and "mine"
  differed from "theirs" only by alignment — not a difference you can see while
  scanning a thread.
  - Selected row → `--primary-bg`, the faint wash the design system defines for
    a selected row for precisely this reason.
  - Own bubble → solid `--primary` on `--on-primary`, per the reference.
    Measured live: **6.46:1 in light, 7.74:1 in dark** — a tint becoming a fill
    is exactly where contrast breaks, so the pass computes the ratio rather
    than trusting it.
  - Incoming bubble → `--surface` with a `--border` hairline, per the
    reference. The pane behind is `--surface` too, so the border is what draws
    the bubble rather than a fill competing with the solid primary opposite it.
- **The last `--ds-*` colour aliases in `chat.scss` are gone** — the file now
  reads the bare tokens directly.
- **Test data**: [`qa-artifacts/scripts/seed-chat-fixture.js`](qa-artifacts/scripts/seed-chat-fixture.js)
  seeds **both sides** of a conversation. A one-sided thread cannot show an
  incoming bubble at all, so it signs in as the voucher fixture's own checker
  account to send the incoming message and as the primary user to reply.

**P4 verified:** build clean · lint 0 errors · breakpoint guard OK · token guard
OK · driven in Playwright Chromium, light + dark at 480/720/1024/1440 —
**22/22 checks green**, including measured AA contrast on both bubble kinds in
both themes and all three formerly-colliding surfaces proven distinct. No
console errors, no failed requests, no horizontal overflow. Screenshots in
[`_ops/ui-refresh/p4/`](_ops/ui-refresh/p4/).

---

# P5 — Job Work *(done — browser-verified 2026-08-19)*

**Screens:** 12. **Files:** `job-work/**` (dashboard, board, ready queue,
challans, billing run, reports, six masters), `utils/dashboard-charts.ts`, plus
**B-18** in `jayhind-client-back`
- Board gets the **visual** retheme only — grouped-list behavior stays (decision 3).
- **B-4 (drag-and-drop) remains your call** and was not built.
- Challans use the form shape from P3.2; masters use the list shape from P2.2.

**What shipped**

- **The dashboard is the reference's `dash` shape now** — KPI strip, attention
  queue beside a WIP-by-operation breakdown, and a six-month trend chart —
  matching the rebuild P1 and P2.1 already had (mismatch 10). It was a 6-up
  `ds-stat-card` grid over a "By status" chip row, with no queue, no breakdown
  and no chart.
- **Every figure on it is server-computed (B-18)**, including the queue's
  wording and each row's route. The screen composes and formats and derives
  nothing, and the browser pass asserts the DOM against the same payload rather
  than counting boxes: queue titles in order, breakdown bar names in order.
  - `wipByOperation` buckets each live order to its **current** operation —
    the lowest-sequence one not yet completed or skipped, the same "where is it
    now" question the board answers. An order whose operations are all done but
    which is not yet delivered is left out rather than bucketed into a fake
    "Other" bar nobody can act on.
  - `orderTrend` counts orders received vs delivered off the order row's own
    `createdAt` / `deliveredAt`. Its chart is a new
    `buildJobWorkOrderTrendChart` rather than a reuse of the stock one: these
    are **orders**, not money, so the tooltip has no ₹ and the axis has
    `minInterval: 1` — a "2.5 orders" gridline is nonsense.
  - `rejectionRate` is **absent, not 0, when nothing has been inspected**. A 0%
    rejection rate on zero inspections reads as flawless quality rather than as
    no data, so the card is dropped instead.
  - **Money follows §10.5's absent-not-zero rule**: `wipValue` and
    `readyToBillValue` are omitted entirely for a viewer without
    `job-work-costing`, and the strip simply carries four cards instead of six.
    A ₹0 WIP value would read as "nothing in progress" rather than "not your
    business". The breakdown falls back to order *counts* for that viewer, so
    the panel still answers which operations the work is sitting on.
- **The board gained the reference's two affordances**: a per-column tone dot
  (the stage, deliberately *not* the risk — colouring a column by risk would
  make "In progress" look like a problem because one late order sits in it) and
  a per-card progress bar.
  - The bar has **two segments on purpose**. A job-work order has two different
    kinds of progress and one bar cannot honestly stand for both: an
    accepted-only bar reads 0% for the entire time an order is actually being
    worked on, and a received-only one calls material arriving "progress" when
    nothing has been made yet. Material in is the faint segment, work accepted
    the solid one. The pass asserts the accepted segment never runs past the
    received one.
- **Test data**: [`qa-artifacts/scripts/seed-job-work-fixture.js`](qa-artifacts/scripts/seed-job-work-fixture.js)
  seeds three operation types, four orders spread across the promised date (one
  already overdue, one due tomorrow) and material receipts against two of them.
  The receipts exist specifically so the progress bars have a width to be wrong
  at — a board of 0% bars renders correctly and proves nothing. Idempotent
  **per step**, not per run: an earlier version bailed out entirely once orders
  existed, which silently skipped the receipts.

**P5 verified:** client-back build clean, **96 suites / 1341 Jest tests**,
`dump-routes` boots the real `AppModule` (709 routes, unchanged — B-18 extends
an existing response rather than adding an endpoint), **`ci-guard-raw-sql` now
green** (see below) · client-front build clean, lint 0 errors, breakpoint guard
OK, token guard OK, `check-mirrors` in sync · 12 screens driven in Playwright
Chromium, light + dark at 480/720/1024/1440 — **157/157 checks green**, no
console errors, no failed requests, no horizontal overflow. Screenshots in
[`_ops/ui-refresh/p5/`](_ops/ui-refresh/p5/).

**Fixed in passing:** `ci-guard-raw-sql` had been **red on four pre-existing
sites** in `company-hard-delete.service.ts` — the orphaned-identity sweep
(§6.5). All four are correctly cross-company: they run after this company's
`company_members` rows are gone, and the question they ask is "does this
identity belong to any *other* company?" — a `companyId` predicate would invert
the answer and delete the login of someone still active elsewhere. Allow-listed
with that justification, on the same reasoning the plan's own §13 note gives:
a permanently-red guard is one nobody reads.

---

# P6 — Human Resources *(done — browser-verified 2026-08-19)*

**Screens:** 16. **Files:** `hr/**`, `utils/hr-status.util.ts` (new)
- Reuses dash / list / form / settings shapes wholesale. The calendar screens are
  the only ones needing their own look at density.
- **No backend change.**

**What shipped**

- **HR had four private status vocabularies and two that said nothing.**
  `ess-badge`, `pr-pill`, `fd-badge` and `ess-chip` were four separate pill
  families, and the Daily Attendance and Leave Applications grids used
  `type: 'tag'` with **no tone at all** — every status the same neutral grey,
  on the two columns where the tone is perfectly knowable (mismatch 8's exact
  failure). All six now read from one `utils/hr-status.util.ts`, so a day cell,
  a grid chip and the dashboard's pending-leave table cannot disagree about
  what "half day" looks like.
  - Two calls in that file are deliberate rather than obvious, and are
    commented as such: **holiday and weekly-off are muted, not success** —
    nobody was present, and a green company holiday would say they were; and a
    **pending application is a warning, not neutral** — it is a decision
    somebody still owes, which is the whole point of the leave list.
- **The attendance calendar carried a parallel palette of eight frozen hexes.**
  `attendance.config.ts` set `color: '#16a34a'`, `'#dc2626'`, `'#f59e0b'`,
  `'#6366f1'`, `'#0ea5e9'`, `'#94a3b8'`, `'#0d9488'`, `'#eab308'` with
  `textColor: '#ffffff'` — on the most colour-heavy screen in the module. Worse
  than merely light-mode-frozen: white on `--success` would fail contrast in
  dark, where that token is a pale green. Every status is now a
  `var(--<tone>-bg)` fill with its own `var(--<tone>)` as the text — the exact
  pairing `ds-status-chip` uses, which the design system guarantees is AA on
  its surface in both schemes. Measured live: light `rgb(227,244,233)` →
  dark `rgb(18,48,31)`.
- **The HR dashboard's eleven figures are one strip.** They were a 5-up
  fund-card grid over a separate 6-item mini-stat row — two visually unrelated
  blocks and ~200px of card chrome for figures that are read together
  (decision 14). The fund cards' second lines became each figure's own `hint`,
  so nothing that was on screen was dropped.
- **The dashboard itself is rethemed in place, not rebuilt** — the same call
  P3.1 made for the Transaction dashboard (mismatch 13, now mismatch 16). It is
  a real analytics workbench: a date-range filter, six charts and two
  searchable, CSV-exportable tables. Matching the reference's generic `dash`
  shape exactly would delete all of that to replace it with a duplicate of the
  Business dashboard.
- **Test data**: [`qa-artifacts/scripts/seed-hr-fixture.js`](qa-artifacts/scripts/seed-hr-fixture.js)
  seeds four employees, twelve attendance records **deliberately spanning
  present / absent / half-day / leave**, and three leave applications left
  pending / approved / rejected. The spread is the point: a month where
  everyone was present renders a wall of one colour and is exactly as
  uninformative as the untoned tag columns this phase fixed, so the pass
  asserts *more than one tone* and only real, varied data can satisfy it.

**P6 verified:** build clean · lint 0 errors · breakpoint guard OK · token guard
OK · `check-mirrors` in sync · 16 screens driven in Playwright Chromium, light +
dark at 480/720/1024/1440 — **243/243 checks green**, no console errors, no
failed requests, no horizontal overflow. Screenshots in
[`_ops/ui-refresh/p6/`](_ops/ui-refresh/p6/).

Three harness corrections, all of the same family as the earlier phases' and
all worth recording because each one was a check passing on nothing:
the fixture linked no employee to the signed-in account (the login response
returns `identity`, not `user`, so the optional `userId` was silently omitted
and every `/ess/*` call answered its correct 404 — self-service rendered empty
and "chips render" passed on zero chips); `/hr/attendance/daily` loads the
**calendar** component, which renders tinted day cells rather than
`ds-status-chip`, so the pass now measures the rendered fills there instead;
and the expected `/ess/*` 404 is ignored by **explicit pattern** rather than by
relaxing the console-error check, so any other 404 still fails the pass.

**Noticed, not changed:** `AttendanceDailyComponent`
(`hr/attendance/attendance-daily/attendance-daily.ts`) is **unreachable** — no
route loads it, and only its sibling `attendance-manual` dialog is imported
from that folder. Its status column was given a tone along with the rest, so it
is correct if it is ever routed, but deleting a component is beyond a retheme's
remit. Flagged for your call.

---

# P7 — Users & Roles, Profile, Party Portal *(done — browser-verified 2026-08-19)*

**Files:** `users-roles/**`, `profile/**`, `party-portal/**`
- **No backend change.**

**What shipped**

- **A success ribbon that had been rendering blue.** `user-add-edit.scss`'s
  `.gst-filled` — the "auto-fill landed" confirmation — read
  `var(--mat-sys-primary, #2e7d32)`: a *green* fallback behind the **primary**
  token. Both the comment above it and the fallback said green; the token was
  simply the wrong one, so every render was blue. It is `var(--success)` now.
- **An accounting vocabulary borrowed for a user state.** The Users dashboard
  coloured its active/inactive flag with
  `[attr.data-nature]="r.isActive ? 'Income' : 'Liability'"` — the ledger's own
  nature attribute, on a person. Both that and the user-kind badge are
  `ds-status-chip` now, as is the permission dialog's "Read only" marker.
- **The permission matrix is verified inside its dialog, not from the list.**
  It is the densest grid in the app (75 module rows × 6 actions) and it opens
  in a `MatDialog`, so driving `/users-roles/roles` alone measures the roles
  list and never the matrix. The pass now opens it and asserts its host really
  is a query container (`container-type: inline-size`) — the rule that narrows
  it *must* be a container query, because the dialog sets its width and a
  viewport query would report "wide" while the matrix is squeezed. Confirmed
  `inline-size`, 75 rows, no page overflow at any of the four widths in either
  theme.
- **The matrix stopped restating its own font stack.** It carried
  `font-family: "Inter", "Roboto", Arial, sans-serif` — how a screen quietly
  drifts off the design system's type. It inherits now.
- **Party Portal driven in its own right** — all five of its screens, not as a
  themed copy of the staff app.

**P7 verified:** build clean · lint 0 errors · breakpoint guard OK · token guard
OK · `check-mirrors` in sync · 11 screens (including the matrix dialog) driven
in Playwright Chromium, light + dark at 480/720/1024/1440 — **160/160 checks
green**, no console errors, no failed requests, no horizontal overflow.
Screenshots in [`_ops/ui-refresh/p7/`](_ops/ui-refresh/p7/).

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
| 1 | P0 | Mockup's All/Active/Archived tabs vs. the binary `isDeleted` data model | **Closed in P2.1.** Both tabs now carry a count (B-1), computed over the request's own filters. Still two tabs, not three — see decision 7 |
| 2 | P0 | Mockup assumes Google Fonts CDN | Self-hosted npm packages instead (decision 9) |
| 3 | P3.2 | Mockup shows pre-approval compliance status; app surfaces it post-approval | **Closed in P3.2.** Read-only preview strip backed by a real preview endpoint (B-3); the post-approval flow is untouched. The strip renders the server's answer verbatim and derives nothing |
| 4 | P5 | Mockup's board is drag-and-drop kanban | The API can now be built (B-4, decision 13) — still **your call** whether to schedule it; retheme-only otherwise |
| 5 | P1 | The theme **customizer FAB** (`position: fixed; right: 2rem; bottom: 5rem`) sits on top of whatever is in the bottom-right of the page — on the dashboard it covers the Nearest Dues panel's "View all dues →" link, in both themes and at every width | **Not fixed — needs your call.** It is global chrome, not a dashboard problem: it overlaps content on every screen, and moving or hiding it is a product decision (is the palette switcher a shipping feature or a development tool?). Options: dock it into the header's icon cluster, hide it under `NODE_ENV=production`, or leave it. |
| 6 | P1 | The dashboard offers **Approve** whenever the role holds `canApprove`, but the server additionally refuses a voucher you submitted yourself (`allowSelfApproval: 0`). Clicking it then fails with a 403 — against §9's "a screen must never offer an action the server will refuse" | **Not fixed — pre-existing and app-wide**, not introduced here: the Pending Approvals screen gates its own buttons the same way. The honest fix is a per-row `canApprove` on the approvals list response (**B-9**), which is a backend change worth doing once for both consumers rather than a client-side guess in this phase. Verified meanwhile that the failure is *safe*: the dialog opens, the server refuses, the error surfaces, and the queue and KPI card stay truthful. |
| 7 | P1 | The voucher grid's **Amount** column prints `24500`, not `₹24,500` — right-aligned and monospaced (P0 did its half) but unformatted | Left for **P3.1**, which owns the voucher lists. Noted here because P1's browser pass is what surfaced it. |
| 9 | N | Transaction shows its page list twice — the new nav panel and the module's own right-hand rail | **Not fixed on purpose.** The rail also applies `hiddenTransactionMenus` and the approval gate, which the panel does not; removing it without moving those rules would be a functional regression. **First item for P3.1** — see Phase N. |
| 8 | P2.1 | Grid `tag` columns rendered one primary-tinted pill for every value, so a Status column and a Type column looked identical and neither said anything | Tag cells now render through `ds-status-chip` with an optional per-column `tone`. **Ripples app-wide by design** (decision 10): the 13 tag columns in modules not yet reviewed lose the blue tint and read as neutral labels until their own phase colours them. Neutral is the honest default — a grid cannot know "Draft" is bad news |
| 10 | P1, P2.1 | Full artifact-vs-shipped audit (2026-08-18, on your instruction): the Business and Product dashboards both diverged from the artifact's `dash` shape — 2 same-type queue panels instead of 1 merged queue + a breakdown-bars panel, no breakdown panel at all, KPI counts/sets that didn't match, and (Business only) three widgets — Top Products/Customers, Live System Monitor, Quick Actions — absent from every one of the artifact's 7 dash-kind screens | **Fixed — "match the artifact exactly"** (your call via AskUserQuestion). See the "Corrected 2026-08-18" addenda under P1 and P2.1 above; backend work tracked as **B-10–B-13** |
| 11 | P2.1 | Product/Service list columns diverged: Product's Status column meant catalogue lifecycle where the artifact's means stock health (same header, different data); Category was dropped for Manufacturer; a single Rate became Cost+Sale Price; Service List had no GST column; neither list had the artifact's summary strip | **Fixed — "add what's missing, keep both dimensions"** (your call). Category and a second Stock Health column added rather than replacing anything; Manufacturer and the Cost/Sale split kept; GST% and the summary strip added. See P2.1's addendum above; backend tracked as **B-14/B-15** |
| 13 | P3.1 | The artifact defines `transaction/dashboard` as literally the same object as the Business dashboard (`S['transaction/dashboard'] = S['dashboard']`) — the generic KPI-strip → queue + breakdown → trend-chart `dash` shape. The real screen is a different thing entirely: a financial analytics workbench with an FY + date-range filter, live Cash/Bank/UPI/Wallet fund cards deep-linking to group statements, three charts and three searchable, CSV-exportable analytics tables (Nature, Top Groups, Accounts) | **Retheme in place — deliberate deviation** (your call). Matching the artifact exactly would have deleted the FY selector, the fund cards and all three analytics tables to replace them with a duplicate of the Business dashboard. The artifact's entry reads as a placeholder (a literal alias of another screen) rather than a considered design for this one, and the shipped screen serves a real job the generic shape does not. It gets the token/mono/breakpoint pass and keeps every feature. Revisit if you'd rather the tables moved to Reports and the dashboard became the generic shape |
| 15 | P3.2 | The reference's voucher form shows a **Vehicle no** header field and promises "vehicle number captured" on the e-Way Bill compliance line. This app's voucher carries no transport details — a vehicle number lives on the `eway_bills` row, which does not exist until after approval | **Shipped without it, deliberately** (this plan's own rule: no screen displays something the backend did not produce). The preview line says `raise it after approval` instead, and a spec asserts it never mentions a vehicle. Tracked as **B-17** — your call whether to build the transport fields |
| 16 | P6 | The reference's HR dashboard is the generic `dash` shape (KPI strip → queue + breakdown → trend). The real screen is an analytics workbench: a date-range filter, six charts, and two searchable CSV-exportable tables (headcount by department, pending leave) | **Rethemed in place — deliberate deviation**, the same call mismatch 13 made for the Transaction dashboard and for the same reason: matching the reference exactly would delete the filter, five of six charts and both exportable tables to replace them with a duplicate of the Business dashboard. It gets the KPI strip (decision 14), the shared status vocabulary and the token pass, and keeps every feature. Revisit if you'd rather the tables moved to Reports |
| 14 | N | The shell shipped two controls doing the same thing — the header's hamburger and the nav panel's own `left_panel_close` button both collapsed the panel, side by side — and the panel head (61px, hairlined) did not match the toolbar beside it (64px, no hairline), so the divider stepped at the seam | **Fixed** (your report, 2026-08-18). One collapse control (the header's); the panel head is toolbar-height and the hairline runs unbroken across rail, panel and toolbar. Mobile's close/X stays — it closes the whole overlay, a different action |
| 12 | N | Nav panel: 7 of 12 rail short-labels drifted from the artifact's wording; no accordion collapse for modules over the artifact's own 14-item threshold (Transaction's panel was one long flat list); no filter box above panels over 10 items, though the artifact shows one | **Fixed**, no decision needed — pure conformance, no downside. See Phase N's "Corrected 2026-08-18" addendum above |

## Verification reference

- `npm run lint` (client-front) — includes `scripts/breakpoint-guard.js` (no raw
  px outside 480/720/1024/1440) **and, since P3.4, `scripts/token-guard.js`** (no
  `var(--ds-*, …)` naming a token the design system does not declare). Both must
  stay green; neither has a grandfather list.
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
