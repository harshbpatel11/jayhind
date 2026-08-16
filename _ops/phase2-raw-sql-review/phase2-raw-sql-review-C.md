# Phase 2 / task 2.3 — adversarial raw-SQL tenancy review (batch C)

**Reviewer stance:** cold context, no memory of authoring this code. Every statement treated as
leaking another company's data until the predicate was traced.
**Repo:** `/home/ubuntu/projects/jayhind-client-back`
**Date:** 2026-08-14
**Scope:** 6 files, **46 raw-SQL call sites** (verified count — `.query(` call count equals
`QueryTypes.` use count in every file, so no site is hidden by a line-wrapped call).

## Headline

**0 confirmed leaks.** All 46 sites carry a real `:companyId` predicate in the SQL text itself,
sourced from `TenantContext.requireCompanyId()`. I specifically hunted for the CI guard's known
bypass — a `companyId` bound into `replacements` but never referenced in the WHERE, or mentioned
only in a comment — and **found none**: mechanical count of `':companyId'` occurrences inside the
SQL strings meets or exceeds the query-call count in every file (dashboard has 17 for 16 calls,
because `cashBankBalance` correctly scopes both its outer query and its subquery).

Two corroborating signals that these files were remediated deliberately rather than to satisfy the
guard: none of the six uses the weak `TenantContext.getCompanyId()` accessor, and none uses a
`crossCompany` escape hatch anywhere.

Three items are raised below that are **not** leaks but should not be silently accepted: one
shared, unscoped correlated subquery affecting 8 statutory-report queries (X-1), one SQL-identifier
interpolation (H-14), and one known-but-worth-restating schema inconsistency around statutory
numbering (J-INFO).

### How I judged "transitively scoped"

Most of these aggregates drive off a *fact* table (`journal_lines`, `journal_entries`, `trx`,
`trx_items`, `employees`, `leave_applications`, `stock_movements`) and join *dimension* tables by
primary key (`JOIN trx_groups g ON g.id = jl.trxGroupId`). A PK-equality join returns at most one
row per driving row, so it cannot widen the result set beyond the scoped driver. I accepted that as
scoped, and in each case below I name the predicate doing the work. Where a join could widen the
set, or a subquery introduces an independent row source, I checked it separately.

I confirmed every table named in these queries is genuinely company-scoped in the schema
(`trx_natures`, `trx_groups`, `trx_accounts`, `journal_entries`, `journal_lines`,
`job_work_configuration`, `financial_year`, `job_work_dispatch`, `leave_application`, `employee`,
`leave_type`, `gst_return_filing`, `gst_return_adjustment`, `gst_return_document` all declare
`companyId`), so the ORM calls interleaved with the raw SQL in these files are auto-scoped by the
hooks and are not a side door.

---

## 1. `src/services/reports.service.ts` — 11 sites

The plan's stated worst case ("unscoped, it returns every company's turnover summed into one
number, with no error anywhere"). Every one of the 11 is scoped. The file is consistent about
scoping on the **fact** table, which is the correct choice — the money lives in `journal_lines` /
`journal_entries` / `trx_payment_receipts`, and those are what carry the predicate.

### R1 — `reports.service.ts:57` — `trialBalance()` — **CONFIRMED SCOPED**
```sql
FROM journal_lines jl
JOIN journal_entries je ON je.id = jl.journalEntryId
JOIN trx_groups    g  ON g.id = jl.trxGroupId
JOIN trx_natures   n  ON n.id = g.trxNatureId
WHERE je.date <= :to
  AND jl.companyId = :companyId
```
`jl.companyId = :companyId` bounds the driving table; the three joins are all PK-equality lookups
(`je.id`, `g.id`, `n.id`) so none widens the set. **`GROUP BY` runs after `WHERE`**, so the
aggregate never mixes companies before a filter narrows it — I checked this specifically on all
three statement queries, since a `HAVING`-only filter would have hidden mixing rather than
prevented it. `HAVING openingNet <> 0 …` operates on already-scoped aggregates.
`companyId` comes from `TenantContext.requireCompanyId()` (line 74), not from `params`, which only
carries `from`/`to`.

### R2 — `reports.service.ts:133` — `profitAndLoss()` — **CONFIRMED SCOPED**
Same join shape; `AND jl.companyId = :companyId` at line 145. `n.accountNature IN (:income,
:expense)` is a bound-parameter filter over the already-scoped set. GROUP BY after WHERE.

### R3 — `reports.service.ts:191` — `balanceSheet()` — **CONFIRMED SCOPED**
`AND jl.companyId = :companyId` (line 201). Same reasoning as R1.

### R4 — `reports.service.ts:255` — `dayBook()` — **CONFIRMED SCOPED**
Drives off `journal_entries` instead, and correctly moves the predicate with it:
`AND je.companyId = :companyId` (line 270), with `journal_lines` joined as the child
(`jl.journalEntryId = je.id`). The optional filter is the one branch worth checking:
```ts
${voucherType ? 'AND je.voucherType = :voucherType' : ''}
```
This is a conditionally-added *fragment*, but the companyId predicate sits outside it and is
unconditional — there is no code path where the optional filter's absence drops the scope. The
value travels as a `:voucherType` bind, not interpolated.

### R5 — `reports.service.ts:325` — `accountBook()` account list — **CONFIRMED SCOPED**
```sql
FROM trx_accounts WHERE type IN (:types) AND deletedAt IS NULL AND companyId = :companyId
  ${accountId ? 'AND id = :accountId' : ''}
```
Scoped. `:types` is bound from an internal literal array (`['CASH']` /
`['BANK','CHEQUE','DEBIT_CARD']`, lines 402/406), never caller input. `accountId` is caller-supplied
but travels as a bind **and** is ANDed with the companyId predicate — so a caller passing another
company's account id gets zero rows, not that account. This query is the root of the transitive
chain for R6/R7 below: `ids` (line 332) is by construction a company-A-only id list.

### R6 — `reports.service.ts:338` — `accountBook()` opening balance — **CONFIRMED SCOPED**
`WHERE jl.trxAccountId IN (:ids) AND je.date < :from AND jl.companyId = :companyId`. Belt and
braces: scoped **directly** by `jl.companyId`, and independently by `:ids` which came from the
scoped R5. Either alone would suffice.

### R7 — `reports.service.ts:346` — `accountBook()` lines — **CONFIRMED SCOPED** *(with a defense-in-depth note)*
Outer query scoped by `jl.companyId = :companyId` and `:ids` from R5. The item I looked hardest at
is the correlated subquery in the SELECT list — exactly the "pasted in without the outer query's
discipline" shape:
```sql
(SELECT GROUP_CONCAT(DISTINCT g2.name SEPARATOR ', ')
   FROM journal_lines jl2 JOIN trx_groups g2 ON g2.id = jl2.trxGroupId
  WHERE jl2.journalEntryId = je.id AND jl2.id <> jl.id) AS particulars
```
`jl2` has **no `companyId` predicate of its own**. It is scoped only transitively: it is correlated
to `je.id`, and `je` is reachable only from a company-A `jl` row. This holds because every leg of one
journal entry is written in a single request through `PostingService.persistLines` →
`JournalLine.bulkCreate`, and the `beforeBulkCreate` hook stamps `companyId` from the one active
`TenantContext` onto every instance — so all lines of an entry necessarily share one company.
Verdict is scoped, but `AND jl2.companyId = jl.companyId` would cost nothing and would make the
subquery independently correct rather than dependent on an invariant enforced two layers away.

### R8 — `reports.service.ts:439` — `voucherRegister()` — **CONFIRMED SCOPED**
`AND pr.companyId = :companyId` (line 459) on the driving `trx_payment_receipts`. `LEFT JOIN users
u` is the documented-global identity table (allowed, and the name returned belongs to a party on
company A's own voucher). `trx_accounts` / `trx_groups` are PK lookups bounded by `pr`.
*Non-tenancy observation, flagged only because I was reading closely:* `JOIN trx_accounts a ON a.id
= pr.trxAccountId` is an INNER join, and `trx_payment_receipts.trxAccountId` became nullable for
multi-line journals (Phase B.2). Multi-line journals will silently drop out of the payment register.
Not a security issue; worth a separate ticket.

### R9 — `reports.service.ts:506` — `groupStatement()` group metadata — **CONFIRMED SCOPED**
`WHERE g.id = :groupId AND g.companyId = :companyId LIMIT 1`. `params.groupId` is caller-controlled,
so this is the file's most directly attackable input — and it is correctly ANDed with the company
predicate. A cross-company `groupId` returns no row.

### R10 — `reports.service.ts:515` — `groupStatement()` opening — **CONFIRMED SCOPED**
`WHERE jl.trxGroupId = :groupId AND je.date < :from AND jl.companyId = :companyId`. Note this does
**not** rely on R9 having found a row — it carries its own predicate. That matters: R9's result is
only used for display (`group?.groupName`), and the code does not throw when R9 returns nothing. So
if the scope lived only in R9, a cross-company `groupId` would have leaked balances while showing a
null name. It doesn't, because R10 and R11 are each independently scoped. **This is the single most
important correct decision in the file.**

### R11 — `reports.service.ts:524` — `groupStatement()` lines — **CONFIRMED SCOPED**
`AND jl.companyId = :companyId` (line 535). Same independence as R10. A cross-company `groupId`
yields an empty statement with a null group name — no leak, and not even an existence oracle, since
"group belongs to another company" and "group does not exist" produce byte-identical responses.

---

## 2. `src/services/dashboard.service.ts` — 16 sites

All 16 scoped. Notably disciplined about subqueries and about keeping `WHERE` ahead of `GROUP BY`
on every top-N list.

| Site | Method | Predicate | Verdict |
|---|---|---|---|
| `dashboard.service.ts:98` | `voucherTotals` | `FROM trx … AND companyId = :companyId` (l.113) | **CONFIRMED SCOPED** |
| `dashboard.service.ts:139` | `nearestDues` | `t.companyId = :companyId` (l.146); `users` join is global-identity | **CONFIRMED SCOPED** |
| `dashboard.service.ts:157` | `pendingApprovals` | `AND companyId = :companyId` | **CONFIRMED SCOPED** |
| `dashboard.service.ts:170` | `cashBankBalance` | **both levels** — see below | **CONFIRMED SCOPED** |
| `dashboard.service.ts:182` | `partyOutstanding` | `jl.companyId = :companyId`; `trx_groups` PK-join | **CONFIRMED SCOPED** |
| `dashboard.service.ts:202` | `profitMtd` | `jl.companyId = :companyId` (l.211) | **CONFIRMED SCOPED** |
| `dashboard.service.ts:229` | `gstLiability` | `jl.companyId = :companyId` (l.235) | **CONFIRMED SCOPED** |
| `dashboard.service.ts:253` | `inventoryValue` | `product_quantity … companyId = :companyId` | **CONFIRMED SCOPED** |
| `dashboard.service.ts:262` | `stockAlertCount` | `pq.companyId = :companyId` | **CONFIRMED SCOPED** |
| `dashboard.service.ts:283` | `cogsMtd` | `stock_movements … companyId = :companyId` | **CONFIRMED SCOPED** |
| `dashboard.service.ts:310` | `productStats` (status) | `products … companyId = :companyId`, GROUP BY after WHERE | **CONFIRMED SCOPED** |
| `dashboard.service.ts:315` | `productStats` (out-of-stock) | `pq.companyId = :companyId` | **CONFIRMED SCOPED** |
| `dashboard.service.ts:335` | `stockAlertProducts` | `pq.companyId = :companyId`, `LIMIT 10` after | **CONFIRMED SCOPED** |
| `dashboard.service.ts:355` | `topProducts` | `ti.companyId = :companyId` (l.363) | **CONFIRMED SCOPED** |
| `dashboard.service.ts:377` | `topParties` | `t.companyId = :companyId` (l.383) | **CONFIRMED SCOPED** |
| `dashboard.service.ts:399` | `monthlyTrend` | `companyId = :companyId` (l.404), GROUP BY `ym` after | **CONFIRMED SCOPED** |

**D4 (`:170`) deserves a specific callout** — it is the one place in these six files where a
subquery introduces an independent row source, and it is scoped at *both* levels:
```sql
FROM journal_lines jl
WHERE jl.companyId = :companyId
  AND jl.trxGroupId IN (SELECT DISTINCT trxGroupId FROM trx_accounts
                         WHERE deletedAt IS NULL AND companyId = :companyId)
```
Had the inner `companyId` been omitted, company A's cash/bank KPI would have included any of A's
journal lines that happened to sit on a group id also used by B's accounts. It's there.

**D14/D15/D16 (top-N lists)** were checked for the pagination-level bug specifically — i.e. a
`LIMIT` applied to a set that was grouped across companies before narrowing. In all three the
company predicate is in the `WHERE`, so grouping and `LIMIT` both operate on an already-scoped set.
Correct level.

---

## 3. `src/services/gst-returns/gstr3b.service.ts` — 1 site

### G1 — `gstr3b.service.ts:264` — `computeGlTieOut()` — **CONFIRMED SCOPED**
```sql
FROM journal_lines jl
JOIN journal_entries je ON je.id = jl.journalEntryId
JOIN trx_groups tg ON tg.id = jl.trxGroupId
WHERE tg.systemKey = :key AND je.date >= :from AND je.date <= :to AND je.sourceType = 'trx'
  AND jl.companyId = :companyId
```
Scoped on the fact table; both joins PK-equality; `GROUP BY je.sourceId` after `WHERE`. Runs once
per group key in a loop (line 262) — the predicate is inside the loop body, so every iteration is
scoped, not just the first. `:key` is bound from the module-level `OUTPUT_GROUPS`/`INPUT_GROUPS`
literals, never caller input.

Worth recording: the plan's changelog notes this exact site was found *red* by the Phase 0.3 recount
(it had shipped with Phase G without a `RAW_SQL_ALLOWLIST` entry). It has since been remediated with
a genuine predicate rather than being permanently exempted — the current `RAW_SQL_ALLOWLIST`
contains only `health.service.ts:57` and `posting.service.ts:211`. That is the right outcome.

**The rest of this file's DB access is ORM** (`GstReturnFiling`, `GstReturnAdjustment`,
`GstReturnDocument`) and I verified all three entities declare `companyId`, so the global hooks
scope them. This matters more than usual here: `GstReturnFiling.findOne({ where: { returnType,
period } })` (lines 135, 184, 316) has no company predicate in the code, and would return another
company's filing if the entity were unscoped. It is scoped. (See J-INFO for the related *unique
index* issue on this table, which is a different problem.)

---

## 4. `src/services/leave.service.ts` — 1 site

### L1 — `leave.service.ts:220` — `onLeaveTodayFor()` — **CONFIRMED SCOPED**
```sql
FROM leave_applications la
JOIN employees e ON e.id = la.employeeId AND e.deletedAt IS NULL
WHERE la.deletedAt IS NULL AND la.status = :status
  AND CURDATE() BETWEEN la.fromDate AND la.toDate
  AND e.userId IN (:userIds)
  AND la.companyId = :companyId
```
This is the FR-55 cross-module read called from the Job Work board, so `userIds` is effectively
caller-influenced (it is the board page's owner ids). Checked accordingly: `la.companyId` bounds the
driving table, `employees` is a PK-equality join off `la.employeeId`, and `e.userId IN (:userIds)`
is a bound list that can only *narrow*. An attacker supplying arbitrary user ids learns only
whether those identities are on approved leave **within their own company** — the answer for any
identity outside it is always empty. No leak.

Defense-in-depth note: `employees` carries its own `companyId` and could add `AND e.companyId =
:companyId`. Since `users` is a global identity table and one identity can (post-Phase-1) hold
membership in several companies, that redundant predicate is cheap insurance for the day the
`users`↔`employees` relationship stops being one-company-per-identity.

---

## 5. `src/services/hr-dashboard.service.ts` — 14 sites

All 14 tenancy-scoped. One flagged for SQL-identifier interpolation (H-14).

All 13 sites in `summary()` share one `repl` object built at line 33 from
`TenantContext.requireCompanyId()` (line 32) — a single verified source, so they cannot disagree
with each other.

| Site | Query | Predicate | Verdict |
|---|---|---|---|
| `hr-dashboard.service.ts:43` | byDepartment | `e.companyId = :companyId`; `departments` LEFT JOIN by PK | **CONFIRMED SCOPED** |
| `hr-dashboard.service.ts:51` | byEmploymentType | `e.companyId = :companyId` | **CONFIRMED SCOPED** |
| `hr-dashboard.service.ts:58` | byDesignation | `e.companyId = :companyId`; `LIMIT 12` after GROUP BY | **CONFIRMED SCOPED** |
| `hr-dashboard.service.ts:65` | byGender | `companyId = :companyId` | **CONFIRMED SCOPED** |
| `hr-dashboard.service.ts:71` | byStatus | `companyId = :companyId` | **CONFIRMED SCOPED** |
| `hr-dashboard.service.ts:78` | hires/separations | `companyId = :companyId` | **CONFIRMED SCOPED** |
| `hr-dashboard.service.ts:86` | onLeaveToday | `leave_applications … companyId = :companyId` | **CONFIRMED SCOPED** |
| `hr-dashboard.service.ts:94` | payroll YTD | `payroll_runs … companyId = :companyId` | **CONFIRMED SCOPED** |
| `hr-dashboard.service.ts:101` | payroll trend | `companyId = :companyId`; GROUP BY after WHERE | **CONFIRMED SCOPED** |
| `hr-dashboard.service.ts:113` | attendanceToday | `attendance_records … companyId = :companyId` | **CONFIRMED SCOPED** |
| `hr-dashboard.service.ts:120` | leaveByType | `la.companyId = :companyId`; `leave_types` PK-join | **CONFIRMED SCOPED** |
| `hr-dashboard.service.ts:130` | pendingLeaveList | `la.companyId = :companyId`; `employees`/`leave_types` PK-joins | **CONFIRMED SCOPED** |
| `hr-dashboard.service.ts:142` | recentHires | `e.companyId = :companyId` | **CONFIRMED SCOPED** |
| `hr-dashboard.service.ts:182` | `upcoming()` | `companyId = :companyId` — but see H-14 | **SUSPECT (injection hardening; tenancy is fine)** |

The `payrollTrendRaw.slice(-12)` at line 110 is a JS-side trim of an already-scoped result — the
company predicate is not doing double duty as the trend window, so no "predicate on the wrong level"
issue.

### H-14 — `hr-dashboard.service.ts:182` — **SUSPECT / NEEDS HUMAN JUDGMENT (SQL injection hardening)**
Tenancy verdict is **scoped** (`AND companyId = :companyId`, line 186, bound from
`requireCompanyId()` at line 189). Flagged separately, per the brief's instruction to call out raw
interpolation as its own concern:
```ts
private upcoming(column: 'dateOfBirth' | 'dateOfJoining'): Promise<any[]> {
  return this.sequelize.query(
    `SELECT id, employeeCode, firstName, lastName, ${column} AS onDate,
            ((DAYOFYEAR(${column}) - DAYOFYEAR(CURDATE()) + 366) % 366) AS inDays
       FROM employees
      WHERE deletedAt IS NULL AND ${column} IS NOT NULL AND companyId = :companyId
        AND ((DAYOFYEAR(${column}) - DAYOFYEAR(CURDATE()) + 366) % 366) <= 30 …
```
`${column}` is interpolated **four times** directly into the statement. It is **not exploitable
today**: the method is `private`, the parameter is a two-member string-literal union, and the only
two call sites (lines 153–154) pass hardcoded literals. But the union is a *compile-time* guarantee
only — it erases at runtime. If this method is ever made public, or a caller passes a value derived
from a DTO/query param (a plausible "let the user choose the column" feature request), it becomes a
direct SQL-injection sink, and the injected text sits inside the same statement as the tenancy
predicate — so it could also be used to neutralise the `companyId` filter. Cheap fix: map the union
to a literal via a lookup object at the top of the method so the SQL contains no interpolation, or
keep the interpolation but assert membership in an allow-list at runtime. **Human decision: accept
as-is with a comment, or harden.**

*(For contrast, the interpolations in `reports.service.ts` — `${liveEntrySql('je')}`,
`${voucherType ? … : ''}`, `${accountId ? … : ''}` — inject SQL **fragments** chosen by code, never
values; every value in that file travels as a bind. Those are safe.)*

---

## 6. `src/services/job-work-number.service.ts` — 3 sites

The `FOR UPDATE` sequence lock. The brief asked specifically whether the SELECT…FOR UPDATE, the
read and the subsequent UPDATE/INSERT are all scoped consistently by the same companyId, with no
window for another company's counter row to be locked, bumped or read. **They are.**

`companyId` is resolved **once** at line 131 (`const companyId = TenantContext.requireCompanyId()`)
and the same const is threaded into all three statements — so the three cannot drift apart even in
principle.

### J1 — `job-work-number.service.ts:132` — INSERT — **CONFIRMED SCOPED**
```sql
INSERT INTO job_work_sequences (companyId, scope, lastValue, createdAt, updatedAt)
VALUES (:companyId, :scope, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE scope = scope
```
The `ON DUPLICATE KEY` behaviour depends entirely on which unique key it collides against, so I
verified the actual index rather than trusting the code comment. **Live schema confirms**
`job_work_sequences` has `PRIMARY KEY (companyId, scope)` — the comment's claim is true. So the
no-op upsert targets this company's own counter row and cannot touch another's. Had the key been
`scope` alone, company B's INSERT would have collided with A's row, B's subsequent SELECT would find
nothing, `next` would reset to 1 every time, and the UPDATE would match zero rows — the counter
would never advance for B.

### J2 — `job-work-number.service.ts:139` — SELECT … FOR UPDATE — **CONFIRMED SCOPED**
```sql
SELECT lastValue FROM job_work_sequences WHERE scope = :scope AND companyId = :companyId FOR UPDATE
```
Locks exactly the `(companyId, scope)` row — i.e. the full primary key, so this is a single-row
lock, not a range/gap lock that could block another company's allocation. Runs inside the caller's
transaction (`transaction` passed through), so the lock is held until the caller commits, which is
the whole design intent.

### J3 — `job-work-number.service.ts:145` — UPDATE — **CONFIRMED SCOPED**
```sql
UPDATE job_work_sequences SET lastValue = :next, updatedAt = NOW()
 WHERE scope = :scope AND companyId = :companyId
```
Same full-PK predicate as the locked read. No window between J2 and J3 in which a different
company's row could be bumped: both name the same `(companyId, scope)` pair from the same const,
and J2's `FOR UPDATE` holds that row for the duration.

The surrounding ORM calls are auto-scoped: `JobWorkConfiguration.findOne` (line 154) and
`FinancialYear.findOne` (lines 173/176) both hit entities carrying `companyId`, so the settings
singleton and FY name read are this company's, not row 1's — worth noting because
`findOne({ order: [['id','ASC']] })` with no where clause *looks* like a "first row anywhere" read.

### J-INFO — statutory numbers collide across companies (**known, tracked as Phase 3 — not a Phase 2 raw-SQL defect**)
Raised for completeness because it determines whether J1–J3's correctness actually holds
end-to-end, which the brief asked me to verify. Verified against the **live** `jayhind_client`
schema, not just the baseline file:

| table | unique index | columns |
|---|---|---|
| `job_work_sequences` | `PRIMARY` | `companyId, scope` ✅ |
| `job_work_orders` | `job_work_orders_jobWorkNo` | `jobWorkNo` ⚠️ global |
| `job_work_challans` | `job_work_challans_challanNo` | `challanNo` ⚠️ global |
| `job_work_dispatches` | `job_work_dispatches_dispatchNo` | `dispatchNo` ⚠️ global |

The counter is per-company but the document-number uniqueness is global, so two companies each
minting their first order both produce `JW-000001` and the second `INSERT` fails on a global unique
violation (surfacing, per this codebase's own `CustomExceptionFilter` behaviour, as a generic
400 "Invalid request parameters"). This is an integrity/availability problem and a weak
cross-tenant oracle, **not** a data disclosure.

**It is already known and deliberately sequenced**: `MASTER_DEVELOPMENT_PLAN.md` Phase 3 / §20.10
("Re-scope 69+ UNIQUE constraints", currently `[ ]`), held until after Phase 2 by the plan's own
ordering rule 4 — *"re-scoping a UNIQUE key while queries are still unscoped converts a clean
constraint violation into silent cross-company row reuse; the failure gets quieter, which is the
wrong direction."* I agree with that sequencing and am not arguing for it to be pulled forward. The
same class affects ~46 other constraints on scoped tables (`trx_groups.systemKey`,
`trx_accounts.code`, `transaction_configurations.trxType`, `gst_return_filings (returnType,
period)`, `employees.employeeCode`, `financial_years.name`, `roles.name`, …).

One **specific interaction worth carrying into Phase 3's ticket**, which I did not find already
written down: `nextDispatchNo` (lines 101–109) has a defensive clash-walk that tries candidate
suffixes until it finds a free one — but it probes via `JobWorkDispatch.findOne(...)`, an **ORM**
call, which the tenant hooks scope to the current company. So the mitigation can only see *its own
company's* clashes and is structurally blind to the global `dispatchNo` index that is the constraint
actually capable of firing. The comment's stated intent ("walk forward rather than fail: a document
number that silently repeats is far worse than one that skips a letter") is therefore not achieved
across companies. Re-scoping the index to `(companyId, dispatchNo)` in Phase 3 resolves this too —
it just shouldn't be assumed the walk-forward already covers it.

---

## Cross-cutting finding

### X-1 — `liveEntrySql()`'s unscoped `NOT EXISTS` — **SUSPECT / NEEDS HUMAN JUDGMENT (defense-in-depth)**
**Defined at `src/const/posting.const.ts:59` — outside the 6 assigned files, but interpolated into
8 of the 11 `reports.service.ts` queries** (R1, R2, R3, R4, R6, R7, R10, R11):
```ts
export const liveEntrySql = (alias = 'je'): string =>
  `${alias}.isReversal = 0 AND NOT EXISTS (SELECT 1 FROM journal_entries jrev WHERE jrev.reversedEntryId = ${alias}.id)`;
```
The `jrev` subquery introduces a second, independent row source over `journal_entries` with **no
`companyId` predicate**, correlated only on a globally-unique PK (`jrev.reversedEntryId = je.id`).

- **Not a disclosure.** It returns no columns; it can only *exclude* rows from the outer query.
- **The risk it carries is suppression, not leakage.** If a row in company B had `reversedEntryId`
  pointing at a company-A entry id, that entry would silently vanish from A's trial balance, P&L,
  balance sheet, day book, cash/bank book and group statement — with no error anywhere, and the
  reports would still foot and still "balance", because a full entry drops out on both sides.
- **I traced whether that is reachable and it is not, today.** `reversedEntryId` is only ever
  written by `PostingService.reverseSource` (`posting.service.ts:897`) as `reversedEntryId:
  live.id`, where `live` comes from `JournalEntry.findAll({ where: { sourceType, sourceId } })` —
  an ORM read, hence auto-scoped by the `beforeFind` hook to the active company. So no API path
  lets company B name company A's entry.

So: correct today, but the guarantee lives entirely in a different file's ORM call, and this
fragment is pasted into the statutory reports where a silent row disappearance is the
highest-consequence failure mode in the application. Adding `AND jrev.companyId = ${alias}.companyId`
is a one-line change with no behavioural effect on correct data. **Human judgment: worth doing,
since it is the only unscoped independent row source remaining across these 46 sites.**

*(The interpolated `${alias}` is an identifier, and every call site in these files passes the
literal `'je'` — not an injection concern.)*

---

## Summary table

| File | Sites | Confirmed scoped | Confirmed leak | Suspect |
|---|---:|---:|---:|---:|
| `src/services/reports.service.ts` | 11 | 11 | 0 | 0 *(+X-1 affects 8 of them)* |
| `src/services/dashboard.service.ts` | 16 | 16 | 0 | 0 |
| `src/services/gst-returns/gstr3b.service.ts` | 1 | 1 | 0 | 0 |
| `src/services/leave.service.ts` | 1 | 1 | 0 | 0 |
| `src/services/hr-dashboard.service.ts` | 14 | 14 | 0 | 1 *(H-14, injection hardening only)* |
| `src/services/job-work-number.service.ts` | 3 | 3 | 0 | 0 *(+J-INFO, known Phase 3)* |
| **Total** | **46** | **46** | **0** | **2 cross-cutting + 1 known** |

## Triage list

**CONFIRMED LEAK — none.**

**SUSPECT / needs human judgment:**
1. **X-1 — `src/const/posting.const.ts:59` (`liveEntrySql`), reaching `reports.service.ts` sites
   57, 133, 191, 255, 338, 346, 515, 524.** Unscoped `NOT EXISTS` over `journal_entries`. Not
   exploitable via any current API path (verified through `PostingService.reverseSource`); risk is
   silent row *suppression* from statutory reports, not disclosure. One-line hardening available.
   **Highest-value item in this batch.**
2. **H-14 — `src/services/hr-dashboard.service.ts:182`.** Four-fold SQL-identifier interpolation of
   `${column}`. Tenancy is correctly scoped; this is an injection-hardening item only, currently
   unreachable (private method, literal-union parameter, two hardcoded call sites).

**Informational / already tracked:**
3. **J-INFO — `job_work_orders` / `job_work_challans` / `job_work_dispatches`.** Global unique
   indexes on statutory document numbers vs. per-company sequence counters. Known, tracked as
   Phase 3 §20.10, correctly sequenced after Phase 2. Sub-point worth adding to that ticket:
   `nextDispatchNo`'s clash-walk mitigation probes via a tenant-scoped ORM call and is therefore
   blind to the global index that actually fires.

**Non-tenancy observation (separate ticket):**
4. `reports.service.ts:451` — `JOIN trx_accounts a ON a.id = pr.trxAccountId` is an INNER join on a
   column that became nullable for multi-line journals (Phase B.2), so those vouchers silently drop
   out of the payment register.

## Method notes / limits of this review

- Verdicts are from reading the code plus verifying the schema against the **live**
  `jayhind_client` database (`information_schema`) — I did not execute the queries or run a
  two-company data fixture. IS-4's exhaustive per-site sweep with both companies holding
  non-trivial data (named as still-open in the plan's own §1.1 "Next gate") remains the right
  complement to this pass, and would empirically confirm the transitive-scoping arguments in R1–R7,
  D5–D7 and L1.
- I accepted PK-equality dimension joins as non-widening. That is sound relationally, but it does
  assume referential integrity between scoped tables (e.g. a company-A `journal_line` never points
  at a company-B `trx_group`). Every write path I checked stamps `companyId` from one
  `TenantContext` per transaction, so the invariant holds by construction — but it is an invariant,
  not a constraint the database enforces, and no FK in this schema is composite on `companyId`.
- The CI guard's syntactic weakness described in the brief is real, but **it is not masking anything
  in these six files** — I checked each site for the specific bypasses (bind-without-predicate,
  comment-only mention, one-branch-of-two scoped) and found none.
