# Phase 2, task 2.3 — adversarial raw-SQL review, 2026-08-14

> ⚠️ **Status as of 2026-08-14, entry 1.33 — this doc is a same-day snapshot,
> not fully current.** The "What's still open" list below was written right
> after part (1) and predates entries 1.29/1.30, which closed most of it
> (IS-4's exhaustive sweep, prove-it-fails on all 8 originally-scoped cases,
> per-commit CI wiring) — see `MASTER_DEVELOPMENT_PLAN.md` §1.1/§20.9 for the
> current, authoritative status. **Section E has been updated in place**:
> items 1, 2, 3, 4 and 7 are now marked FIXED (2, 4 and 7 on 2026-08-14,
> entry 1.31; 1 and 3 on 2026-08-14, entry 1.33 — operator approved both).
> Item 3's fix went further than its own original text proposed: the free
> join fix was applied AND the write-side `roleId` validation was added
> (rather than merely turned into an isolation-suite case, since building
> that case immediately proved the guard does NOT already fail closed — see
> its own entry). Items 5 and 6 are unchanged, still open — 5 was not asked
> about this round; 6 is already correctly sequenced into Phase 3, not a
> live decision. The operator's own unhurried read of all 23 files (item 3
> of §5.4's three-part substitute) remains not started — that item is
> unaffected by any of this.

**What this is.** `MASTER_DEVELOPMENT_PLAN.md` §5.4 mandates a three-part
replacement for the "second developer reviews every raw-SQL file" control this
solo/AI-assisted programme has no second developer to provide: (1) a cold-context
adversarial AI review pass per file, (2) the isolation suite as the primary
control, (3) the operator's own unhurried read. This document — and the four
batch reports beside it (`phase2-raw-sql-review-{A,B,C,D}.md`) — is the record
of (1). **(3) has not happened and is not something an AI session can do on the
operator's behalf** — see "What's still open" below.

**Method.** The 23 files named in §7.4 were split into four batches by line
count (~1,800–2,300 lines each) and handed to four independent subagents, each
started with **no memory of writing any of this code** and instructed to treat
every raw-SQL statement as leaking another company's data until the code itself
proved otherwise. Each batch report traces every site against the live schema
and the actual write paths that populate the columns each JOIN keys on — not
just against the claim that the site was "already remediated."

## Headline result

The claim on record going into this ("Phase 2 remediated every one of the 96
sites... each now carries an explicit `companyId` bind") was **true
syntactically and false in four places semantically** — a `companyId` bind can
satisfy the CI guard while a JOIN two lines away leaks another tenant's rows
into an aggregate. The review also, by simply following its own brief
("grep for the guard's blind spots"), surfaced a **second, much larger and more
severe bug the raw-SQL census was never going to catch at all**: a systemic
`Company.findOne()`-with-no-predicate pattern across 14 call sites in 13 files
that never went anywhere near the raw-SQL guard, because they're plain ORM
reads on a model (`Company`) the tenant-scoping hooks provably cannot protect
(it has `id`, not `companyId` — it IS the tenant row).

**Everything below marked "FIXED" has been fixed, verified by a clean `tsc`
build, all three CI guards green, `npm test` at 1,148/1,148 (unchanged from the
recorded baseline), and `dump-routes.ts` still booting 684 routes.**

## A. Confirmed cross-tenant leaks in raw SQL — 6 found, 6 FIXED

| # | Site | What crossed | Fix |
|---|---|---|---|
| L1 | `financial-dashboard.service.ts` `getNatureAnalytics` (was :198) | Company B's rupee debit/credit totals + group count, summed into company A's account-nature dashboard rows | Added `AND g.companyId = :companyId` / `AND jl.companyId = :companyId` to the two LEFT JOINs |
| L2 | `financial-dashboard.service.ts` `getGroupAnalytics` (was :236) | Company B's rupee totals + txnCount into A's group rows; B controlled A's "top 20 by activity" ordering | Added `AND jl.companyId = :companyId` on the ledger join, `AND n.companyId = :companyId` on the natures join |
| L3 | `financial-dashboard.service.ts` `getAccountAnalytics` (was :276) | Company B's rupee totals into A's per-account figures, no LIMIT — A's whole chart of accounts | Added `AND jl.companyId = :companyId` / `AND g.companyId = :companyId` |
| L4 | `voucher-reference.service.ts` `activeCountsForTrxIds` children (was :254) | An active-reference count derived from company B's vouchers, surfacing in A's grid response; B could silently disable Cancel/Delete on A's own rows; also an existence oracle | Added `AND t.companyId = :companyId`, copying the sibling query 12 lines above it |
| L5 | `job-work-masters.service.ts` `holdingsFor` (:560) | A vendor shared across two companies (identities are global post-Phase-1): company A's "lots held" figure for that vendor included company B's live dispatches | Added `AND companyId = :companyId`; this site was **entirely invisible to the CI guard** (see part C) — found by group B following its own brief past its assigned 6 files |
| L6 | `inventory.service.ts` `allowNegativeStock` (:766–769) | Not raw SQL — a bare `Company.findOne()` — every tenant read **company 1's** negative-stock flag, governing a real stock write guard | The seed finding for part B below |

Root cause common to L1–L4, named explicitly in the batch-D report: `trx_groups.trxNatureId`,
`journal_lines.trxGroupId`/`.trxAccountId`, and `trx.trxAgainstId`/`.trxAgainstIds`
are all client-supplied on save and **never validated to belong to the
caller's company** — every corresponding FK is existence-only, not
company-aware. Fixing these four queries closes the *reads*; a
`beforeValidate`-style FK-company assertion (or resolving every inbound
cross-table id through a scoped read before it's written) is what would close
the *class*. Recommended as a follow-up item, not attempted here — see below.

## B. A second, larger bug found via the review's own recommendation — 14 sites, FIXED

Group D's report on `inventory.service.ts:766` ended with: *"Worth grepping
the whole codebase for other bare `Company.findOne()` / `Company.findAll()`
calls — the hooks provably do not protect this model."* Doing exactly that
turned up 17 more call sites. Two (`due-reminder.service.ts:51`,
`job-work-alerts.service.ts:101`) are legitimate — both `findAll({ where:
{ status: Active } })` inside a `@Cron` sweep that deliberately iterates every
company. One (`master-hub/activation.service.ts:278`) is inside
`OnModuleInit`-driven background reconciliation with no HTTP request and
therefore no `TenantContext` open at all — today's activation model is
genuinely installation-wide, not company-scoped (that's Phase 6's job, not
Phase 2's), so it was deliberately left alone rather than made to throw.

**The other 14 were a real, silent, systemic bug**: every one of them read
**company 1's** row for every tenant on the box, for data ranging from
cosmetic (company name shown in a due-reminder email) to **GST-compliance
critical**:

| File : line | What it governs | Severity |
|---|---|---|
| `posting.service.ts:200` (`isInterState`) | Whether **every voucher posted by every company** splits GST as CGST+SGST or IGST | 🔴 Highest — a real tax-law violation the moment a second company's home state differs from company 1's |
| `eway-bill.service.ts:437` (`loadSite`) | The consignor identity on every e-Way Bill | 🔴 Statutory document, wrong company's GSTIN |
| `einvoice/einvoice.service.ts:309` (`resolveSeller`) | The INV-01 SellerDtls on every e-Invoice | 🔴 Statutory document, wrong company's GSTIN |
| `gst-returns/gst-return-assembly.service.ts:37` (`resolveCompanyContext`) | The company GSTIN/state code feeding **every GSTR-1/GSTR-3B return** | 🔴 Statutory filing built off the wrong company's GSTIN |
| `invoice-matching.service.ts:130` (`companyIdentity`) | The GSTIN OCR invoice-matching compares against | 🟠 Wrong-company GSTIN comparison |
| `site-configurations.service.ts:59` (`findCompany`) | Company Configuration screen — name/GSTIN/PAN/address/logo, **read AND written** | 🔴 Every tenant's admin edits company 1's row |
| `product-configuration.service.ts:46,75` | `allowNegativeStock` read + write | 🟠 Same class as L6 |
| `financial-year.service.ts:154` (`isEnforced`) | Period-lock enforcement | 🟠 Wrong company's lock setting |
| `transaction-configuration.service.ts:87` | Transaction sidebar visibility, read+write | 🟡 Cosmetic but silently cross-tenant |
| `chat.service.ts:95` (`assertChatEnabled`) | Chat kill switch | 🟡 Company B's toggle governs company A's chat |
| `job-work-challan-print.service.ts:46` | Company letterhead on printed Rule-55 challans | 🟠 Statutory print document |
| `due-reminder.service.ts:133` (`remindNow`) | Company name in due-reminder email | 🟡 Cosmetic |
| `einvoice/einvoice-configuration.service.ts:92` (`getEffective`) | Seller legal name fallback | 🟡 Cosmetic-ish, feeds e-Invoice |

**Fix applied uniformly**: `Company.findOne()` → `Company.findByPk(TenantContext.requireCompanyId())`,
same pattern as `inventory.service.ts`'s original fix, with `TenantContext`
imported where it wasn't already. Every one of these sits inside an
HTTP-request or already-tenant-scoped code path (verified individually, not
assumed — e.g. `chat.service.ts`'s callers already depend on `ChatConversation.create`
being hook-scoped, which requires a live context to not throw; `posting.service.ts`
runs inside the voucher-save transaction or an explicit `TenantContext.run()`
during Tally import), so `requireCompanyId()`'s fail-loud behaviour is safe
everywhere it was added — nowhere does this introduce a new crash on a
previously-working path. `master-hub/activation.service.ts` was the one
candidate site deliberately **not** touched, for the reason above.

This is not fully closed as a *class*: a repo-wide check for the analogous
bug on OTHER un-scoped-by-design tables (anything without a `companyId`
column that a service nonetheless expects "the one row for my company" from)
was not performed. `Company` was checked exhaustively; nothing else was.

## C. CI guard hardened — regex widened, one file's SQL inlined

`src/const/ci-guards/raw-sql-guard.const.ts`'s `RAW_SQL_CALL` regex required
the literal identifier `sequelize` immediately before `.query(`. Two real call
shapes in this codebase evaded it completely:

1. **`Model.sequelize!.query(...)`** (the `!` non-null assertion breaks
   `\bsequelize\s*\.\s*query`) — this is exactly how L5 (`job-work-masters.service.ts:560`)
   and a second, already-correctly-scoped site (`chat.service.ts:304`) went
   unreviewed by CI.
2. **A private wrapper method** — `voucher-reference.service.ts`'s `private
   query(...)` wraps `this.sequelize.query(...)` once and is called from ten
   sites; the guard only ever saw the one `sequelize.query(` inside the
   wrapper (which mentions `companyId` and passes), never any of the ten real
   statements behind it — including L4, the live leak.

**Fixed**: `RAW_SQL_CALL` widened to `/\.\s*query\s*(?:<[^>]*>)?\s*\(/` — any
`<receiver>.query(` call, regardless of receiver name. A repo-wide sweep
before making this change confirmed no non-SQL `.query(` call exists under
`src/` that this newly (and wrongly) flags — an Express `req.query` object has
no trailing `(`, so it was never a collision risk. The guard now genuinely
checks every one of `voucher-reference.service.ts`'s ten statements and both
guard-evading `job-work-masters.service.ts`/`chat.service.ts` sites.

**Also fixed**: `product-reference.service.ts:96` was correct but
structurally invisible to the guard for a different reason — its SQL lived in
a separate `private static readonly SQL` class constant, and the guard's
span-walker starts at the `sequelize.query(` call site and never sees text
declared earlier in the file. Inlined the SQL directly into the call (pure
refactor, every predicate re-verified unchanged) so the guard's span now
actually contains the statement it's supposed to be checking.

**Verified**: `npx ts-node -r tsconfig-paths/register scripts/ci-guard-raw-sql.ts`
→ green scanning 651 files, with the widened regex actually exercising every
site this batch found. `ci-guard-cached-state.ts` and `ci-guard-scope-registry.ts`
unaffected, still green. `tsc --noEmit` clean. `npm test` → 1,148/1,148
(matches the recorded baseline in `_ops/baseline/BASELINE-2026-08-13.md` +
Phase 1's growth). `dump-routes.ts` → 684 routes, app boots.

## D. Free hardening applied alongside the fixes above

Several sites the reviewers called "correct but resting on an invariant
enforced two files away" got the belt-and-braces predicate added at zero risk,
since the bind was already in scope in every case:
- `voucher-reference.service.ts` `forTrx` source query — added `AND me.companyId = :companyId`
  to the self-join (was scoped only on the `src` side).
- `chat.service.ts` `unreadByConversation` — added `AND m.companyId = :companyId`
  (was transitively scoped via an already-scoped `conversationIds` list; now
  directly scoped too).

## E. SUSPECT — flagged for the operator's own judgment, NOT auto-fixed

These are not confirmed leaks (no reachable write path was found for any of
them), but each rests on an invariant the schema does not enforce, and each
reviewer stopped short of fixing them because the right fix is a judgment
call, not a mechanical one:

1. **`posting.service.ts:211`** — the allow-listed `user_details` query. ✅
   **FIXED 2026-08-14 (entry 1.33)**. The query itself still can't be scoped
   (no `companyId` column exists there — the D-02 identity/party-financial
   split is still pending), but the **allow-list's own justification text
   was wrong**: it said "one identity, one company," exactly the assumption
   Phase 1's `company_members` model removed. Operator approved fixing both
   halves rather than deferring: `TrxWriteService.assertSupplierIsCompanyMember`
   (new, `trx-write.service.ts`) now refuses `resolveSupplierDetails`'s save
   whenever `dto.supplierUserId` is not a live `company_members` row for the
   caller's own company — closing the real integrity gap (a foreign
   `partyUserId` entering company A's `journal_lines`) rather than merely
   the confidentiality one. Both the query's own comment and the allow-list
   entry (`raw-sql-guard.const.ts`) were rewritten to state the REAL
   invariant this now rests on (membership verified at write time) instead
   of the false one. Every `Trx`-creating path funnels through
   `TrxWriteService.saveTrx` (manual entry, Invoice Scanning, Data Import,
   Job Work billing — verified by grep, not assumed), so the fix closes the
   class for every one of them; two sibling resolvers with the identical
   unscoped-read shape (`InvoiceScanApproveService.resolvePartyDetailsId`,
   `JobWorkBillingService.resolvePartyDetailsId`) were traced and found to
   already flow into this same `saveTrx` gate before anything is posted, so
   they needed no separate fix — noted, not silently left unexamined.
   Verified: `tsc --noEmit` clean, `npm test` 1,150/1,150 (unchanged),
   `qa-isolation.ts` 129/129 on the restarted live server.
2. **`posting.const.ts:59`, `liveEntrySql()`** — ✅ **FIXED 2026-08-14 (entry
   1.31)**. An unscoped `NOT EXISTS` subquery over `journal_entries`, inlined
   into ~11 report/dashboard queries across the codebase. Two independent
   reviewers (batches C and D) flagged this as the single highest-value
   hardening item in the whole review: it cannot leak (no columns returned),
   but it could silently **suppress** a company's own entry from its own
   trial balance/P&L/balance sheet if a foreign `reversedEntryId` ever
   pointed at it. No reachable write path was found (`reversedEntryId` is
   only ever set from an already-scoped ORM read in
   `PostingService.reverseSource`) — so this was safe, fragile by
   construction, not a live leak. The operator approved applying the exact
   one-line fix this entry already specified: `AND jrev.companyId =
   ${alias}.companyId` added to the `NOT EXISTS` subquery. Verified:
   `qa-isolation.ts` 125/0 post-fix on the restarted live server, including
   every IS-4 check against a site that inlines this fragment
   (`financial-dashboard.service.ts`, `reports.service.ts`'s day-book/P&L/
   balance-sheet, `party-statement.service.ts`).
3. **`users-dashboard.service.ts:80,128,138`** — `LEFT JOIN roles r ON r.id = cm.roleId`
   with no `r.companyId`. ✅ **FIXED 2026-08-14 (entry 1.33)**. The join fix
   (`AND r.companyId = :companyId`, all three sites) was applied as proposed
   — free, no functional risk. The write-side question was **not** left as
   "almost certainly fails closed" — the operator asked for the isolation-
   suite case to actually prove it rather than assume it, and building that
   case immediately disproved the assumption: `RoleMenuGuard`'s permission
   lookup (`RoleMenuPermission.findAll({ where: { roleId } })`) IS scoped and
   does fail closed (a foreign roleId resolves to an empty permission map),
   **but `AuthService.generateAccessToken` resolves `roleName` at LOGIN via
   `CompanyMember.findOne({ ..., include: [{ model: Role }], crossCompany:
   true })`** — deliberately unscoped, because no `TenantContext` exists yet
   at that point. A `company_members.roleId` pointing at another company's
   role would have its REAL name read with no scoping at all, so a `roleId`
   that happened to name another company's role literally called "Admin"
   would mint a JWT `RoleMenuGuard`'s `user.roleName === 'Admin'` bypass (and
   `RolesGuard`'s `@Roles([...])` checks) treat as a full, unconditional
   admin session — `role_menu_permissions` scoping is irrelevant to this path
   entirely, since Admin never consults it. `UsersService.assertRoleBelongsToCompany`
   (new) now refuses `create`/`update` whenever `roleId` does not resolve to
   a `Role` row belonging to the caller's own company (a plain scoped
   `Role.findOne`, `crossCompany`-aware for the one no-context self-signup
   path). Proven, not assumed: `qa-isolation.ts`'s new "E.3" section drives
   real HTTP `POST /users` and `PUT /users/:id` calls with another company's
   real `roleId` and asserts both are refused (400) with no partial row
   written and no membership silently mutated. Building the fixture also
   surfaced (not introduced) a live instance of the ALREADY-DOCUMENTED,
   already Phase-3/4-flagged `ROLE_ID` hard-coded-literal gap (see this
   file's own note a few lines below, and `role-satellite.const.ts`) —
   Company B's own trading-party fixture had been silently landing company
   A's `Employee` roleId via `resolveDefaultRoleId`'s fallback every run
   until now; the fix refused it for the first time, which is correct
   behaviour, not a regression, and the harness's own fixture was updated to
   pass an explicit, real Company-B `roleId` rather than relying on that
   default. Verified: `tsc --noEmit` clean, `npm test` 1,150/1,150
   (unchanged), all 3 CI guards green, `dump-routes.ts` 684 routes
   (unchanged), `qa-isolation.ts` 129/129 on the restarted live server (up
   from 125 — the party fixture succeeding end-to-end unlocked several more
   IS-1 deep-tier and IS-4 checks that previously could not run at all).
4. **`party-statement.service.ts:241`**, `LEFT JOIN trx t ON t.id = je.sourceId` —
   ✅ **FIXED 2026-08-14 (entry 1.31)**. `sourceId` is a deliberate non-FK soft
   reference (architecture doc §11), so nothing in the schema backs this join;
   `t.invoiceNo` prints on the signed statement. No reachable write path was
   found — safe today, fragile by construction. Operator approved the exact
   one-line fix already specified here: `AND t.companyId = :companyId` added
   to the join. Verified: `qa-isolation.ts`'s `party-statement.service.ts:
   statement (ledger rows) for B's own party answers 200` check, and the
   whole suite at 125/0 post-fix on the restarted live server.
5. **`hr-dashboard.service.ts:182`** — `${column}` interpolated 4× (SQL
   identifier, not a value; not exploitable today — private method, two
   hardcoded literal call sites) — an injection-hardening item, not a tenancy
   one.
6. **`job-work-sequences`/`job_work_orders`/`job_work_challans`/`job_work_dispatches`
   and ~45 other UNIQUE constraints** (`trx_groups.systemKey`, `trx_accounts.code`,
   `employees.employeeCode`, `financial_years.name`, `roles.name`, …) — per-company
   counters feeding **globally-unique** columns. `employees.employeeCode` and
   `trx_accounts.code` specifically: company B's first employee/account
   collides with company A's `EMP-2026-0001`/`ACC-0001` and cannot be
   created — invisible on this single-company box, guaranteed on the first
   real second company. **Already known and correctly sequenced** — this is
   exactly what `MASTER_DEVELOPMENT_PLAN.md` Phase 3 / §20.10 exists to fix,
   and ordering rule 4 explicitly holds it until Phase 2 closes ("re-scoping a
   UNIQUE key while queries are still unscoped converts a clean constraint
   violation into silent cross-company row reuse"). Not touched here; flagged
   so Phase 3's ticket can cite the two concrete examples and the
   `nextDispatchNo` clash-walk blind spot batch C found (it probes via a
   tenant-scoped ORM call and so cannot see the global index that actually
   fires).
7. **Non-tenancy, flagged in passing by the reviewers**:
   `reports.service.ts` payment-register INNER-joins `trx_accounts` on a
   column that became nullable for multi-line journals (Phase B.2), so those
   vouchers silently drop out of the register — **still not acted on**.
   `job-work-party-portal.service.ts:63` passed a trading party's raw
   `sort`/`filters` into `paginateNew` with no `assertNoMoneySortOrFilter`
   guard (unlike `JobWorkBoardService`), letting a party binary-search their
   own scrubbed `ownMaterialCost`/`rate`/`totalValue` via `totalItems` — an
   FR-51 confidentiality break, not a cross-tenant one. ✅ **FIXED 2026-08-14
   (entry 1.31)**: `JobWorkPartyPortalService.list()` gained the same guard
   shape as `JobWorkBoardService`'s, but unconditional (a party never has
   `job-work-costing` and never should, unlike a staff user who might).
   Verified live over real HTTP with a hand-signed JWT for a real active
   party membership (id 4): a plain request succeeds, sorting by
   `ownMaterialCost` or filtering by `rate` both refuse with a 403 naming the
   guard, and sorting by a legitimate field (`promisedDate`) still succeeds.
   `qa-job-work.ts` also gained 2 regression checks in its existing FR-51
   section, though the harness's own fixture setup is currently broken by an
   unrelated Phase 1.3/2.1 regression — see BL-3/R20 in
   `MASTER_DEVELOPMENT_PLAN.md`.

## What's still open (per §20.9's own exit checklist)

- **The operator's own unhurried read of all 23 files** (§5.4 point 3) — not
  started, and not something this session can substitute for; it is the one
  place the plan requires a human specifically because an AI review, however
  adversarial, still shares the same class of blind spot the human is there
  to catch.
- **IS-4's exhaustive per-site sweep with both companies holding non-trivial
  data** — this review is a static code read (batch C's own words: "I did not
  execute the queries or run a two-company data fixture"); IS-4 would
  empirically confirm the transitive-scoping arguments this review makes for
  the sites judged CONFIRMED SCOPED.
- **The "prove it fails" pass** — none of the 8 already-green IS cases (nor
  the fixes made today) have been demonstrated to actually fail when their
  protection is deliberately removed.
- **Wiring the isolation suite into per-commit CI** — unstarted infrastructure
  work (needs a MySQL service in CI).
- **The E.2 `liveEntrySql()` hardening and the E.1 `user_details` allow-list
  correction** — deliberately left for the operator's decision, not applied.
- **A repo-wide check for the `Company.findOne()` bug's siblings** on other
  tables that are legitimately un-scoped by design but might have an
  analogous "the one row for my company" assumption baked into a caller —
  only `Company` was checked exhaustively.
