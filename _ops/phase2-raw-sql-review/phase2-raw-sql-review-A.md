# Phase 2 / task 2.3 — adversarial raw-SQL tenancy review (batch A)

**Repo:** `/home/ubuntu/projects/jayhind-client-back`
**Date:** 2026-08-14
**Scope:** 7 files, 17 raw-SQL call sites
**Method:** every `sequelize.query(` site read in the context of its enclosing function; every table in
every statement classified against the live schema (`src/migrations/00000000000000-initial-schema.ts`)
for whether it actually carries a `companyId` column; every transitive-scoping claim traced to the
*named* earlier query that establishes it.

**Headline:** no confirmed cross-company leak in the SQL of these 7 files. All 17 sites parameterize
every value (`:name` binds only — **zero string interpolation anywhere**, so no SQL-injection surface
in this batch either). 15 sites carry a real, correct `companyId` predicate sourced from
`TenantContext.requireCompanyId()`. Two sites need human judgment: one is the documented `user_details`
exception whose *stated justification is factually wrong* under Phase 1's own data model, and one is
structurally invisible to the CI guard.

---

## Ground rules applied

From `tenant-context.ts` / `tenant-scoping.hooks.ts`:

- `TenantContext.requireCompanyId()` throws loudly rather than returning a default — so any site
  sourcing from it either has a verified company or fails closed. **All 15 companyId-bearing sites in
  this batch use it** (none read a companyId out of a DTO, request param, or entity field a caller
  could influence). That is the single most important positive finding here.
- The ORM hooks scope any model whose `rawAttributes` declares `companyId` (`isTenantScopedModel`).
  So an `.findByPk` / `.findAll` on `JobWorkOrder`, `TrxAccount`, `Machine`, `FinancialYear`,
  `JournalEntry` etc. is auto-scoped and is a *legitimate* anchor for a transitive-scoping argument.
- `users`, `user_details`, `states` carry **no** `companyId` (verified against the schema, not
  assumed) — the first two by design, `user_details` as the documented D-02 debt.

Schema facts verified for this review (all confirmed `HAS companyId`): `trx`, `trx_items`,
`trx_item_taxes`, `trx_charges`, `tax`, `trx_groups`, `trx_natures`, `trx_accounts`, `journal_lines`,
`journal_entries`, `stock_movements`, `financial_years`, `hr_sequences`, `machines`, `operation_types`,
`job_work_orders`, `job_work_operations`, `job_work_dispatches`, `stock_conversions`,
`stock_conversion_items`, `bom_templates`, `bom_template_items`.
Confirmed `NO companyId`: `users`, `user_details`.

---

## 1. `src/services/health.service.ts` — 1 site

### `health.service.ts:57` — DB liveness probe — **CONFIRMED SCOPED** (correct exception)

```ts
await this.sequelize.query('SELECT 1');
```

Verified rather than taken on faith: read the whole file (79 lines). This is the entirety of the raw
SQL in it. `SELECT 1` names **no table**, no FROM clause, no bind, and returns a constant. There is
nothing for a `companyId` predicate to scope, and no row of tenant data can traverse it. It is called
from `checkDatabase()` → `readiness()` → `GET /health/ready`, a `@Public()` route that by design runs
with no tenant context at all — which is precisely why it *must not* call `requireCompanyId()`.

The allowlist entry `'src/services/health.service.ts:57'` is accurate both in line number and in
justification. ✅

---

## 2. `src/services/employee-code.service.ts` — 3 sites

All three are one logical operation (`next()`), so they are judged together as a sequence, per the
FOR-UPDATE brief. `const companyId = TenantContext.requireCompanyId()` is captured **once**, at line 24,
and the same local is threaded into all three statements — so there is no window in which the three
statements could disagree about which company they are acting for.

### `employee-code.service.ts:26` — counter-row upsert — **CONFIRMED SCOPED**

```sql
INSERT INTO hr_sequences (companyId, scope, lastValue, createdAt, updatedAt)
 VALUES (:companyId, :scope, 0, NOW(), NOW())
 ON DUPLICATE KEY UPDATE scope = scope
```

The correctness of this whole file rests on one schema fact, which I verified rather than trusted from
the file's own comment:

```
UNIQUE KEY `scope` (`companyId`,`scope`)     -- initial-schema.ts:959
```

The unique key is **composite on (companyId, scope)**, so company B's insert does not collide with
company A's row; each company gets its own counter row. Had the key been on `scope` alone, this would
have been a cross-company *correctness* bug (B's `ON DUPLICATE KEY` would no-op against A's row, the
scoped SELECT below would then find nothing, and B would mint `EMP-YYYY-0001` forever). It is not.

Lock note: `INSERT … ON DUPLICATE KEY UPDATE` that hits the duplicate takes an X lock on the existing
row, so by the time line 33's `FOR UPDATE` runs the row is already held by this transaction. ✅

### `employee-code.service.ts:33` — locked read — **CONFIRMED SCOPED**

```sql
SELECT lastValue FROM hr_sequences WHERE scope = :scope AND companyId = :companyId FOR UPDATE
```

Both key columns in the predicate, matching the composite unique key exactly, so the `FOR UPDATE` lock
lands on this company's row and no other. ✅

### `employee-code.service.ts:39` — counter bump — **CONFIRMED SCOPED**

```sql
UPDATE hr_sequences SET lastValue = :next, updatedAt = NOW() WHERE scope = :scope AND companyId = :companyId
```

Same predicate shape as the locked read, same `companyId` local. **Lock/read/write are consistently
scoped by one identical companyId with no intervening re-resolution** — the specific property the brief
asked about. No window where a different company's counter could be locked or bumped. ✅

*(Non-tenancy aside, not a finding: `formatEmployeeCode(year, next)` embeds the year in the code while
`EMPLOYEE_CODE_SCOPE` is year-less, so the counter does not reset per year. Intentional or not, it has
no tenancy dimension.)*

---

## 3. `src/services/trx-group.service.ts` — 1 site

### `trx-group.service.ts:102` — "does an account back this group?" delete guard — **CONFIRMED SCOPED**

```sql
SELECT id FROM trx_accounts WHERE trxGroupId = :id AND deletedAt IS NULL AND companyId = :companyId LIMIT 1
```
```ts
{ type: QueryTypes.SELECT, replacements: { id, companyId: TenantContext.requireCompanyId() } }
```

One table, explicit `companyId` predicate, `requireCompanyId()` source, fully parameterized.

Adversarial pass on the surrounding function (`remove(id, userId)`), since `id` is caller-controlled:
the ORM read immediately above at **line 97** (`TrxGroup.findByPk(id, { paranoid: false })`) is
auto-scoped by the `beforeFind` hook, so a cross-company group id 404s *before* this query is reached.
Even if it were reached, this query is independently scoped, and the eventual erase goes through
`super.remove(id, userId)` → the ORM, scoped again. Defense is layered, not single-point. ✅

---

## 4. `src/services/closing-stock.service.ts` — 1 site

### `closing-stock.service.ts:54` — whole-ledger movement replay — **CONFIRMED SCOPED**

```sql
SELECT id, productId, direction, quantity, unitCost, isReversal, reversedMovementId
  FROM stock_movements
 WHERE date <= :asOfDate AND companyId = :companyId
 ORDER BY productId ASC, id ASC
```

This is the highest-blast-radius statement in the batch — it is an unbounded scan of the *entire*
stock ledger with no id predicate whatsoever, feeding the number that gets posted to the GL as the
company's closing inventory value. The **only** thing standing between company A and company B's stock
history is `companyId = :companyId`, and it is present, bound from `requireCompanyId()`. There is no
JOIN, no subquery, no UNION, no branch — nothing that could conditionally drop the predicate. `asOfDate`
(user-controllable via `asOfDateOverride`) is parameterized. ✅

Surrounding function checked too: `resolveYear` uses `FinancialYear.findOne` (scoped model → hook),
and `hasLiveEntry`/`reverseSource` operate on `JournalEntry`, which I confirmed carries `companyId`
and is therefore hook-scoped — so `sourceId = financialYearId` cannot collide across companies.

---

## 5. `src/services/product-reference.service.ts` — 1 site

### `product-reference.service.ts:96` — "what still points at this product?" — **CONFIRMED SCOPED** (but see guard note)

Nine correlated subqueries in one statement. I checked **each one independently**, because this is
exactly the shape where a pasted-in subquery loses the outer query's discipline:

| # | subquery | scoped? |
|---|---|---|
| 1 | `trx_items ti WHERE ti.productId=:productId AND ti.companyId=:companyId` | ✅ |
| 2 | `trx_items ti JOIN trx t ON t.id=ti.trxId WHERE ti.companyId=:companyId` | ✅ on `ti`; `trx` transitive (see below) |
| 3 | `stock_movements sm WHERE sm.companyId=:companyId` | ✅ |
| 4 | `stock_conversions sc WHERE sc.companyId=:companyId AND (… OR sc.id IN (SELECT … FROM stock_conversion_items sci WHERE sci.companyId=:companyId))` | ✅ **both** levels |
| 5 | same shape, samples variant | ✅ both levels |
| 6 | `bom_templates bt WHERE bt.companyId=:companyId AND (… OR bt.id IN (SELECT … FROM bom_template_items bti WHERE bti.companyId=:companyId))` | ✅ **both** levels |
| 7 | same shape, samples variant | ✅ both levels |
| 8 | `job_work_orders jw WHERE jw.productId=:productId AND jw.companyId=:companyId` | ✅ |
| 9 | same, samples variant | ✅ |

The nested-`IN` subqueries (4–7) are the ones most likely to have been written without a scope, and
they are the ones I most expected to find open. **They are scoped at both levels.** That is the
single best-executed statement in this batch.

The one JOIN without its own predicate is #2's `JOIN trx t ON t.id = ti.trxId`. `trx` *is* a scoped
table, so on paper this is a widening join. In practice it is PK-equality against `ti.trxId` where
`ti` is already constrained to `companyId = :companyId`, so it can only ever resolve the one voucher
that this company's own line item points at. Not a leak; noted below as hardening.

`:samples` is bound from the module constant `SAMPLE_LIMIT`, not from a caller.

> ⚠️ **CI-guard blindness — the clearest example in this batch.** The SQL lives in a separate class
> constant, `ProductReferenceService.SQL` (lines 50–93). `statementSpan()` starts at the
> `sequelize.query(` line (96) and walks forward to the closing paren — so the span it inspects is
> lines 96–99, which contains the SQL *identifier* but **not one character of the SQL itself**. The
> guard passes solely because `companyId:` appears in the `replacements` object at line 98. If someone
> deleted every `AND …companyId = :companyId` from the constant tomorrow and left the bind in place,
> `ci-guard-raw-sql` would still report green. The site is correct today; it is simply not *guarded*
> today. Any future edit to `ProductReferenceService.SQL` gets zero automated protection.

---

## 6. `src/services/job-work-board.service.ts` — 4 sites

### `job-work-board.service.ts:215` — board summary risk counters — **CONFIRMED SCOPED**

```sql
SELECT SUM(CASE WHEN promisedDate … THEN 1 ELSE 0 END) AS overdue,
       SUM(CASE WHEN … THEN 1 ELSE 0 END) AS atRisk
  FROM job_work_orders
 WHERE deletedAt IS NULL AND companyId = :companyId
```

Checked specifically for the "aggregate mixes companies before an outer filter narrows it" failure
mode named in the brief: **it does not**. There is no subquery and no GROUP BY; the `WHERE` (carrying
`companyId`) is evaluated per row *before* `SUM(CASE …)` accumulates, so nothing from another company
is ever inside the aggregate. Single table, no JOIN. `:today` parameterized. ✅

Sibling ORM aggregate at line 201 (`JobWorkOrder.findAll` with `group: ['status']`) — same question,
same answer: `applyReadScope` AND-composes `{companyId}` into `options.where`, and Sequelize emits
`WHERE` before `GROUP BY`, so the grouping is intra-company.

> **Secondary, non-tenancy observation (worth a ticket, not a security finding):** `summary()`'s doc
> comment promises "totals over the whole filtered set", and `composeFilteredWhere(JobWorkOrder, dto,
> options)` at line 199 is applied to the byStatus aggregate — but this raw risk query ignores `dto`
> entirely. So `overdue`/`atRisk` are always company-wide totals even when the user has filtered the
> board (e.g. by owner, per FR-54's handover filter). The tenancy scope is correct; the *business*
> scope drifts from the strip's stated contract.

### `job-work-board.service.ts:369` — per-page dispatch aggregate — **CONFIRMED SCOPED**

```sql
FROM job_work_dispatches d
LEFT JOIN machines m ON m.id = d.machineId
LEFT JOIN users   u ON u.id = d.vendorUserId
WHERE d.jobWorkOrderId IN (:orderIds) AND d.companyId = :companyId
```

Scoped **twice over**, which is why this one is comfortable:

1. `d.companyId = :companyId` is explicit, from `requireCompanyId()`.
2. `:orderIds` is not caller-supplied — both callers derive it from an already-scoped ORM read:
   `list()` line 156 `commonDataService.paginateNew(JobWorkOrder, …)` (hook-scoped), and
   `readyQueue()` line 254 `JobWorkOrder.findAll(…)` (hook-scoped). `aggregateFor` is `private`, so
   those are the only two entry points.

`machines` is a scoped table joined without its own predicate. I traced whether a dispatch could name
a foreign machine: `JobWorkDispatchService.assertMachineUsable` (line 431) resolves it via
`Machine.findByPk(machineId, { transaction })` — an ORM read, hook-scoped — so a cross-company
`machineId` is rejected at write time and `d.machineId` can only name this company's machine.
`users` is a global identity table, correctly unscoped. ✅

### `job-work-board.service.ts:423` — per-page operation aggregate — **CONFIRMED SCOPED**

```sql
FROM job_work_operations o
JOIN operation_types t ON t.id = o.operationTypeId
WHERE o.jobWorkOrderId IN (:orderIds) AND o.companyId = :companyId
```

Same double-scoping as above (`o.companyId` **and** `:orderIds` from a scoped read). `operation_types`
is a scoped table joined on PK equality from an already-scoped row — transitive, and only a label
(`t.name`) is selected from it. ✅

### `job-work-board.service.ts:543` — `awaitingReturn()`, the Ready Queue's third section — **CONFIRMED SCOPED** (weakest link in the batch)

```sql
FROM job_work_dispatches d
JOIN job_work_orders     o  ON o.id  = d.jobWorkOrderId
JOIN job_work_operations op ON op.id = d.operationId
JOIN operation_types     t  ON t.id  = op.operationTypeId
LEFT JOIN users u ON u.id = d.vendorUserId
LEFT JOIN users p ON p.id = o.partyUserId
WHERE d.status IN ('sent','at-vendor','partially-received')
  AND o.deletedAt IS NULL
  AND d.companyId = :companyId
```

This deserved the hardest look and I gave it one, because it is the only site in the batch that is
**both** unbounded (no `:orderIds` pre-filter — it scans the whole dispatch table) **and** multi-join
(three scoped tables reached transitively, three levels deep), resting on a **single** `companyId`
predicate on the driving table. If `d.companyId` were ever wrong, or if a dispatch could point at
another company's order, this query would render another company's `jobWorkNo`, `partDescription`,
`partyName` and `vendorName` directly onto the shop-floor Ready Queue.

I traced the invariant rather than assuming it:

- `job_work_dispatches.companyId` is stamped by `applyCreateScope` from `TenantContext` — it cannot be
  forged from a DTO (`applyCreateScope` throws `mismatchError` on an explicit mismatched value).
- `d.jobWorkOrderId` cannot cross companies: every dispatch write path goes through
  `JobWorkOrderService.lockOrder(id, transaction)` (`job-work-order.service.ts:774`), which is
  `JobWorkOrder.findByPk(id, { lock: … })` — an ORM read, hook-scoped, 404-ing a foreign order id.
  That is the *named* earlier query the transitive claim rests on.
- `d.operationId` → `job_work_operations` and `op.operationTypeId` → `operation_types` are likewise
  PK-equality hops from rows already constrained by the above.

Verdict stands at CONFIRMED SCOPED, but it is the one site here whose correctness depends entirely on
an invariant enforced in *another file*. Adding `AND o.companyId = :companyId` (the bind is already in
scope) would make it self-evidently correct at zero cost. Recommended as hardening.

---

## 7. `src/services/posting.service.ts` — 6 sites

### `posting.service.ts:166` — GST portion of a voucher's tax — **CONFIRMED SCOPED**

```sql
COALESCE((SELECT SUM(tit.taxAmount) FROM trx_item_taxes tit
            JOIN trx_items ti ON ti.id = tit.trxItemId
            JOIN tax       t  ON t.id  = tit.taxId
           WHERE ti.trxId = :id AND t.type IN (…) AND tit.companyId = :companyId), 0)
+ COALESCE((SELECT SUM(tc.taxAmount) FROM trx_charges tc
            JOIN tax t2 ON t2.id = tc.taxId
           WHERE tc.trxId = :id AND t2.type IN (…) AND tc.companyId = :companyId), 0)
```

**Both** COALESCE branches carry a `companyId` predicate — checked specifically because a two-branch
sum is precisely the shape where one arm gets scoped and its sibling does not. Neither is conditional;
there is no `IF`/`CASE` around either. `companyId` is hoisted to a local at line 165 from
`requireCompanyId()` and bound into both. `:id` is `trx.id` from an entity loaded through a scoped
path. `trx_items` and `tax` are joined on PK equality from already-scoped rows (`tit`/`tc`) —
transitive; noted below as hardening. ✅

### `posting.service.ts:211` — party GSTIN/state lookup — 🟡 **SUSPECT / NEEDS HUMAN JUDGMENT**

```sql
SELECT ud.gstNo AS gstNo, s.name AS stateName
  FROM user_details ud
  LEFT JOIN states s ON s.id = ud.stateId
 WHERE ud.userId = :uid AND ud.deletedAt IS NULL ORDER BY ud.id LIMIT 1
```

This is the second allowlisted site. `user_details` genuinely has no `companyId` column (verified in
the schema, not assumed), and `states` is a global reference table — so there is no predicate available
to add here today. That part of the exception is real.

**What does not hold is the justification's stated premise.** The allowlist says:

> *"`uid` already names one specific identity row, so this is not a leak vector today (one identity,
> one company) — it becomes one the moment an identity can hold party-financial state in more than one
> company."*

Two problems with that reasoning:

1. **"one identity, one company" is not the model this codebase migrated *to*.** `users` is explicitly
   a *global* identity table with no `companyId` (confirmed), and `company_members` exists precisely so
   one identity can hold membership in several companies. A `users.id` therefore carries **no company
   scoping of its own**, so `ud.userId = :uid` narrows the row set without narrowing the *company*.
2. **Nothing on the write path constrains `:uid` to a party of the active company.** `:uid` is
   `trx.supplierUserId`. I traced where that is validated: `TrxWriteService.resolveSupplierDetails`
   (`trx-write.service.ts:482–502`) does `UserDetails.findOne({ where: { userId: dto.supplierUserId } })`
   — and `user_details` is *not* a scoped model, so the ORM hook adds nothing. There is no
   `company_members` / `company_parties` membership check on that path. Meanwhile the party *picker*
   (`UserProfileService.findParties`, `user-profile.service.ts:50–57`) **is** properly scoped — it
   joins `membership` (`company_members`, a scoped model) with `required: true`. That asymmetry —
   scoped read, unscoped write — is the classic IDOR shape.

**Concrete scenario** (why this is SUSPECT rather than CONFIRMED SCOPED): a user in company A posts a
voucher with `supplierUserId` set to an identity that is a party only in company B (an id the UI would
never offer, but the API accepts). This query then reads company B's party's `gstNo` and address state.
The direct exfiltration is narrow — the value is not returned to the client; it only decides
`isInterState`, so at most one bit leaks back, observable as CGST/SGST vs IGST on the attacker's own
voucher. The larger issue is integrity, not confidentiality: `journal_lines.partyUserId` then carries
a foreign identity into company A's per-party ledger and outstanding reports.

**Judgment:** the *query* is not the defect and cannot be fixed here — the fix is a membership check on
the write path (or D-02 landing). But the allowlist justification should be rewritten: it currently
tells the next reviewer the risk is gated by an invariant ("one identity, one company") that Phase 1
deliberately removed. That is worse than no justification, because it invites the next person to stop
looking. **Recommend: keep the exemption, correct the text, and open a ticket for the write-path
membership check.**

*(Guard mechanics footnote, in this site's favour: the `companyId`-mentioning comment sits at lines
204–210, i.e. **above** the call, and `statementSpan` walks **forward** from line 211 — so the comment
does not accidentally satisfy the guard, and the allowlist entry is genuinely doing the work. Had that
comment been placed one line lower, the site would have passed silently with no allowlist entry at all.
That is the guard's documented weakness, avoided here by luck of formatting rather than by design.)*

### `posting.service.ts:351` — active financial year start date — **CONFIRMED SCOPED**

```sql
SELECT startDate FROM financial_years WHERE isActive = 1 AND deletedAt IS NULL AND companyId = :companyId LIMIT 1
```

Single table, explicit predicate, `requireCompanyId()`. Worth noting the failure mode is safe:
without the predicate, `LIMIT 1` on a multi-company table would silently date every opening-balance
entry off *another company's* financial year. It is present. ✅

### `posting.service.ts:420` — group's account nature — **CONFIRMED SCOPED**

```sql
SELECT n.accountNature FROM trx_natures n JOIN trx_groups g ON g.trxNatureId = n.id
 WHERE g.id = :id AND g.companyId = :companyId
```

`g` explicitly scoped; `trx_natures` reached by PK equality from the scoped `g` (transitive). `:id` is
`group.id` from a `TrxGroup` entity the caller loaded through the ORM. Failure mode if the group were
foreign: no row → `debitNatured` falls to `false` → wrong-sided opening entry. Not a leak, and the
predicate prevents it anyway. ✅

### `posting.service.ts:925` — rebuild `trx_groups.currentBalance` — **CONFIRMED SCOPED**

```sql
UPDATE trx_groups g
   SET g.currentBalance = COALESCE((SELECT SUM(jl.debit - jl.credit) FROM journal_lines jl
                                     WHERE jl.trxGroupId = g.id AND jl.companyId = :companyId), 0)
 WHERE g.companyId = :companyId
```

**Both levels scoped** — the correlated subquery *and* the outer UPDATE — which is exactly the
"aggregate before the filter" trap the brief flags, and it is handled correctly here. This is a
destructive full-table UPDATE; an unscoped outer `WHERE` would have rewritten every company's balance
cache from a partial sum. `companyId` hoisted once at line 924 from `requireCompanyId()` and reused by
both statements. ✅

The in-code comment claims the subquery filters were never a read risk because `jl.trxGroupId = g.id`
is a globally-unique PK match — that is correct, and the filters are belt-and-braces. The **outer**
`WHERE g.companyId` is the load-bearing one.

### `posting.service.ts:932` — rebuild `trx_accounts.balance` — **CONFIRMED SCOPED**

Identical shape and identical analysis to :925, on `trx_accounts`/`jl.trxAccountId`. Both levels
scoped, same hoisted `companyId`. ✅

---

## Cross-cutting findings

### F1 — No SQL injection surface in this batch
All 17 sites use `:name` replacement binds exclusively. I grepped these files for `sequelize.literal(`
and for `${…}` inside SQL template literals: **zero hits inside any SQL string**. Every `${}` in these
files is in a `narration`/error-message string, never in a statement. Nothing is concatenated into SQL,
including the `companyId` itself.

### F2 — `requireCompanyId()` is used consistently; no caller-influenced companyId anywhere
Every one of the 15 companyId-bearing sites sources it from `TenantContext.requireCompanyId()`. Not one
reads it from a DTO, a route param, a header, or an entity field. Because `requireCompanyId()` throws
rather than defaulting, a cron/script path that forgot to open a context fails loudly instead of
running unscoped. This is the strongest structural property of the remediation.

### F3 — The CI guard is green, and that green means less than it appears
`npx ts-node -r tsconfig-paths/register scripts/ci-guard-raw-sql.ts` → `OK — no un-allow-listed raw SQL
sites (scanned 651 files)`. Concretely, in *this batch*:

- **`product-reference.service.ts:96` passes without the guard ever seeing its SQL.** The statement
  lives in the class constant `ProductReferenceService.SQL`; the span the guard inspects (lines 96–99)
  contains only the identifier and the `replacements` object. The bind alone satisfies the regex.
  Delete every predicate from the constant and CI stays green.
- **`posting.service.ts:211` avoided a false pass by formatting luck.** Its `companyId`-mentioning
  comment sits above the call; `statementSpan` walks forward. One line lower and the site would have
  passed with no allowlist entry.
- **The allowlist is keyed by `file:line`.** It is fail-*safe* if an allowlisted query moves (it starts
  being checked and, for the `user_details` one, would then fail). It is fail-*open* if an unrelated new
  query happens to land on line 57 of `health.service.ts` or line 211 of `posting.service.ts` — that
  new query would be silently exempted. Both line numbers are currently accurate; that is worth
  re-verifying whenever either file is edited.

### F4 — Systematic pattern: scoped driving table, unscoped PK-equality JOINs
Seven joins across five statements reach a scoped table without its own `companyId` predicate, relying
on PK equality from an already-scoped row:

| site | unscoped join | anchor establishing the scope |
|---|---|---|
| `posting:166` | `trx_items ti`, `tax t`, `tax t2` | `tit.companyId` / `tc.companyId` in same WHERE |
| `posting:420` | `trx_natures n` | `g.companyId` in same WHERE |
| `product-reference:96` (#2) | `trx t` | `ti.companyId` in same WHERE |
| `job-work-board:369` | `machines m` | `d.companyId`; write-side `Machine.findByPk` (scoped) |
| `job-work-board:423` | `operation_types t` | `o.companyId` |
| `job-work-board:543` | `job_work_orders o`, `job_work_operations op`, `operation_types t` | `d.companyId`; `lockOrder` → `JobWorkOrder.findByPk` (scoped) |

None is a leak *given the FK-consistency invariant* (a scoped row's FK never points across companies,
which the ORM create-hook plus scoped write-path lookups do maintain). But note that MySQL enforces
none of this — the FKs are single-column, not composite `(companyId, id)` — so the invariant is
application-maintained only. `job-work-board:543` is the one worth actually changing, being three hops
deep with no `:orderIds` backstop; the rest are single-hop and low value.

---

## Summary table

| File | Sites | Confirmed scoped | Confirmed leak | Suspect |
|---|---:|---:|---:|---:|
| `src/services/posting.service.ts` | 6 | 5 | 0 | 1 |
| `src/services/job-work-board.service.ts` | 4 | 4 | 0 | 0 |
| `src/services/trx-group.service.ts` | 1 | 1 | 0 | 0 |
| `src/services/health.service.ts` | 1 | 1 | 0 | 0 |
| `src/services/employee-code.service.ts` | 3 | 3 | 0 | 0 |
| `src/services/product-reference.service.ts` | 1 | 1 | 0 | 0 |
| `src/services/closing-stock.service.ts` | 1 | 1 | 0 | 0 |
| **Total** | **17** | **16** | **0** | **1** |

---

## Triage list

### CONFIRMED LEAK
*None in this batch.*

### SUSPECT / NEEDS HUMAN JUDGMENT
1. **`src/services/posting.service.ts:211`** — the allowlisted `user_details` query. The query itself
   cannot be scoped (no column exists) and is not the defect. The problem is that its written
   justification rests on "one identity, one company", which Phase 1's own `users`-is-global /
   `company_members` model contradicts — and no write path constrains `trx.supplierUserId` to a party
   of the active company (`TrxWriteService.resolveSupplierDetails`, `trx-write.service.ts:482–502`,
   queries the unscoped `user_details` with no membership check, while the picker
   `UserProfileService.findParties` **is** scoped via `membership`). Narrow confidentiality impact
   (one bit, via the intra/inter-state GST split); real integrity impact (a foreign `partyUserId`
   entering company A's `journal_lines`). **Owner decision needed:** correct the allowlist text, and
   open a ticket for a membership check on the party write path.

### HARDENING / PROCESS (not leaks, but worth acting on)
2. **`src/services/product-reference.service.ts:96`** — correct today, but **structurally invisible to
   `ci-guard-raw-sql`** (SQL in a class constant, guard sees only the bind). Either inline the SQL,
   or teach the guard to follow a same-class `static readonly` SQL constant.
3. **`src/services/job-work-board.service.ts:543`** (`awaitingReturn`) — unbounded scan with three
   transitively-scoped JOINs and no `:orderIds` backstop. Add `AND o.companyId = :companyId`; the bind
   is already in scope, cost is zero.
4. **`raw-sql-guard.const.ts` allowlist is line-number-keyed** — fail-open if an unrelated new query
   lands on an allowlisted line. Consider keying on a nearby content hash or an in-code
   `// @raw-sql-allow:` marker instead.
5. **`src/services/job-work-board.service.ts:215`** — non-tenancy: the `overdue`/`atRisk` counters
   ignore the `PaginationListDto` filters that `summary()`'s own doc comment and its sibling ORM
   aggregate both honour, so the strip reports company-wide risk against a filtered board.
