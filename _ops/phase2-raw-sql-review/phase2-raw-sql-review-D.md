# Phase 2 / task 2.3 — adversarial raw-SQL tenancy review (batch D)

**Repo:** `/home/ubuntu/projects/jayhind-client-back`
**Files reviewed:** `inventory.service.ts`, `party-statement.service.ts`, `financial-dashboard.service.ts`, `voucher-reference.service.ts`
**Date:** 2026-08-14
**Reviewer stance:** the claim "every raw-SQL site was remediated in Phase 2" is treated as unproven. Every site below was traced against the actual schema (`src/migrations/00000000000000-initial-schema.ts`) and against the write paths that populate the columns each JOIN keys on.

---

## 0. Headline

**All four files pass the CI guard (`findUnallowedRawSql`) today. Four of the sites inside them are genuine cross-tenant leaks.** Three of the four are in `financial-dashboard.service.ts`, where the money table (`journal_lines`) carries a `companyId` column that the three analytics queries never use — they scope only the *master* table they anchor on and then LEFT JOIN the ledger in with no predicate at all. The fourth is in `voucher-reference.service.ts`, where the batched counting query drops the `t.companyId` predicate that its own single-row sibling twelve lines away does carry.

Two structural observations that matter more than any single site:

- **`voucher-reference.service.ts` is invisible to the CI guard.** The guard regex is `\bsequelize\s*\.\s*query\s*(?:<[^>]*>)?\s*\(`. That literal appears **exactly once** in the file — line 72, inside the private `query()` wrapper — and that one span mentions `companyId`, so the guard is green. The **ten actual SQL statements** in the file are passed to `this.query(...)`, which the regex does not match at all. The guard has never looked at a single one of them, including the leaking one at line 254. The wrapper's own doc comment ("`Every call site's SQL carries its own AND <alias>.companyId = :companyId predicate`") is a claim the guard cannot check and which is, in fact, false for three of the ten statements.
- **The dashboard's three leaking sites each mention `companyId` in the span** (on the anchor master table), which is all the guard requires. This is the exact failure mode the review brief predicted: "scopes one branch while leaving a sibling open."

**SQL injection:** clean across all four files. Every value travels as a named bind (`:companyId`, `:partyId`, `:ids`, …). The three places that interpolate into the SQL string interpolate only compile-time constants, never request data:
- `party-statement.service.ts:449-450` — `${column}` is a hard-coded literal supplied by the two internal callers (`'date'`, `'je.date'`).
- `party-statement.service.ts:405` — `${expr}` is a ternary over a `'debit' | 'credit'` union parameter.
- `posting.const.ts:59` `liveEntrySql(alias)` — `alias` is hard-coded (`'je'`) at every call site.

---

## 1. `src/services/inventory.service.ts`

4 raw-SQL sites. **All 4 correctly scoped.** One separate, non-raw-SQL cross-tenant read found in the same file.

### 1.1 `inventory.service.ts:502` — `costPricesFor()` — **CONFIRMED SCOPED**

```sql
SELECT productId, price
  FROM product_price_details
 WHERE productId IN (:productIds) AND priceType = :costTier AND deletedAt IS NULL AND companyId = :companyId
```
```ts
replacements: { productIds, costTier: PriceTypeEnum.COST, companyId: TenantContext.requireCompanyId() },
```

Single table, tenant-scoped, explicit `companyId` predicate, value from `TenantContext.requireCompanyId()`. `productIds` is caller-supplied and **not** verified upstream (it is whatever `onHandFor` was handed), but that does not matter here: the `companyId` predicate is applied on the same row, so a foreign product id simply returns nothing rather than another company's price. Fully parameterized.

### 1.2 `inventory.service.ts:629` — `valuationSummary()` — **CONFIRMED SCOPED**

```sql
FROM product_quantity pq
JOIN products p ON p.id = pq.productId AND p.deletedAt IS NULL
WHERE pq.deletedAt IS NULL AND pq.companyId = :companyId
```

`products` is tenant-scoped and carries **no** `companyId` predicate here. I traced whether that is exploitable and concluded it is not:

- The join is `p.id = pq.productId` — a join onto `products`' **primary key**, so it returns at most one row per anchor row. It cannot widen the result set.
- The anchor (`pq`) is explicitly scoped, so the only way a foreign product's `name` could surface is a `product_quantity` row in company A whose `productId` points at company B's product.
- The schema makes that effectively unwritable: `product_quantity` has `CONSTRAINT fk_product_quantity_productId FOREIGN KEY (productId) REFERENCES products (id)` **and** a *global* `UNIQUE KEY productId (productId)` (migration lines 2081-2100 — note it is `UNIQUE(productId)`, not `UNIQUE(companyId, productId)`). Since product ids never repeat across companies, one bucket row exists per product platform-wide, and `getOrCreateBucket`'s create for a foreign product id would collide on that unique key rather than persist a cross-company bucket.

Verdict: transitively scoped through `pq.companyId` + a PK FK. Adding `AND p.companyId = pq.companyId` would still be correct defense-in-depth and costs nothing.

### 1.3 `inventory.service.ts:647` — `reorderAlerts()` — **CONFIRMED SCOPED**

Identical shape and identical reasoning to 1.2 — `pq.companyId = :companyId` on the anchor, `products` joined on its PK. Only `pq` columns and `p.name` are projected.

### 1.4 `inventory.service.ts:759` — `distinctMovementProductIds()` — **CONFIRMED SCOPED**

```sql
SELECT DISTINCT productId FROM stock_movements WHERE companyId = :companyId
```

Single table, explicit predicate, `TenantContext.requireCompanyId()`. This is the id source for the no-argument `rebuildBalances()` sweep, so the sweep cannot reach into another company's ledger.

### 1.5 ⚠️ `inventory.service.ts:766-769` — `allowNegativeStock()` — **CONFIRMED CROSS-TENANT READ** (not raw SQL, reported because it is a real isolation defect in an assigned file)

```ts
private async allowNegativeStock(tx?: Transaction): Promise<boolean> {
    const cfg = await Company.findOne({ attributes: ['allowNegativeStock'], transaction: tx });
    return !!cfg?.allowNegativeStock;
}
```

**There is no `where` clause.** `Company` (`src/entities/company.entity.ts`) is the tenant table itself: it declares `id`, not `companyId`. `isTenantScopedModel()` (`tenant-scoping.hooks.ts:38-41`) tests `rawAttributes.hasOwnProperty('companyId')`, so it returns **false** for `Company`, and `applyReadScope` therefore adds nothing. This `findOne` returns the **first row of `companies`** — company 1 — for every tenant on the box.

Concrete two-company scenario: company 1 has "Allow negative stock" ON. Company 7 has it OFF. A user in company 7 approves a Sales invoice for a voucher type with no `transaction_configurations` row (the only path that reaches this fallback — see `apply()` line 161). `allowNegativeStock()` reads company 1's flag, returns `true`, and company 7's stock is driven negative in violation of their own setting. The inverse is worse: company 1 flips the flag OFF and company 7's legitimate negative-stock workflow starts refusing.

This is a control-plane leak rather than a data leak, but it is a *write guard* being decided by another tenant's configuration. Fix is one line: `Company.findByPk(TenantContext.requireCompanyId(), …)`. **Worth grepping the whole codebase for other bare `Company.findOne()` / `Company.findAll()` calls — the hooks provably do not protect this model.**

---

## 2. `src/services/party-statement.service.ts`

6 raw-SQL sites. **5 confirmed scoped, 1 suspect.** The specific question asked — can the party-facing portal path be tricked by a manipulated party id into returning another company's ledger — is **answered no**, see 2.7.

### 2.1 `party-statement.service.ts:144` — `profile()` — **CONFIRMED SCOPED**

```sql
FROM users u
LEFT JOIN company_members cm ON cm.identityId = u.id AND cm.companyId = :companyId AND cm.deletedAt IS NULL
LEFT JOIN company_parties cp ON cp.identityId = u.id AND cp.companyId = :companyId AND cp.deletedAt IS NULL
LEFT JOIN user_details d ON d.userId = u.id AND d.deletedAt IS NULL
LEFT JOIN cities c … LEFT JOIN states s … LEFT JOIN countries co …
WHERE u.id = :partyId AND u.deletedAt IS NULL
```

- `users` — correctly unscoped (global identity table, per the ground rules).
- `company_members` / `company_parties` — both tenant-scoped, both carry `companyId = :companyId` **in the ON clause**, which is the right place for a LEFT JOIN (an ON-clause predicate on the joined side nulls the columns rather than dropping the anchor row, which is exactly what the `userKind` gate below needs).
- `cities` / `states` / `countries` — global reference tables, correctly unscoped.
- `user_details` — the documented D-02 exception (no `companyId` column). It is keyed off `u.id`, which is the party id under test. It is **not** the only thing preventing a cross-company read: the `cm.userKind` gate is.

The gate at lines 161-163 is what makes this safe: `if (row.userKind !== UserKind.Party) throw`. `cm.userKind` can only be non-null if a `company_members` row exists **for this company**. So a `partyId` naming a party of company B returns `userKind = null` → 400 "This user is not a trading party". The party's own financial state (`cp.openingBalance`) likewise comes only from the scoped `company_parties` row.

Two residual notes, neither a leak:
- The identity fields returned (`u.name/email/phone`, and all of `user_details`: GST, PAN, address) are genuinely shared across companies under the current identity model. If one human is a party in both A and B, both admins see the same PAN/address. That is the known D-02 debt, not a regression.
- Minor enumeration oracle: "Party not found" (404) vs "not a trading party" (400) distinguishes *global* user-id existence from *this company's* membership. A company-A admin can therefore probe how many user rows exist platform-wide. Very low severity; worth collapsing to one message if it is cheap.

### 2.2 `party-statement.service.ts:186` — `summary()` totals — **CONFIRMED SCOPED**

Single table (`trx`), `AND companyId = :companyId` present, `TenantContext.requireCompanyId()`. The `${clause}` interpolation is `dateClause('date', range)` → `AND date >= :from AND date <= :to` with the bounds as **named binds**; only the column name (a hard-coded `'date'`) is interpolated. The clause is appended *after* the `companyId` predicate and joined with `AND`, so no optional-filter branch can displace the scope.

### 2.3 `party-statement.service.ts:241` — `statement()` — **SUSPECT / NEEDS HUMAN JUDGMENT**

```sql
FROM journal_lines jl
JOIN journal_entries je ON je.id = jl.journalEntryId
JOIN trx_groups g ON g.id = jl.trxGroupId
LEFT JOIN trx t ON je.sourceType = :trxSource AND t.id = je.sourceId     -- ← no companyId
WHERE jl.partyUserId = :partyId
  AND g.systemKey IN (:debtors, :creditors)
  AND jl.companyId = :companyId
  AND je.isReversal = 0 AND NOT EXISTS (SELECT 1 FROM journal_entries jrev WHERE jrev.reversedEntryId = je.id)
```

The **anchor is correct** and this is the important half: `jl.companyId = :companyId` scopes the money table itself, so the debit/credit figures and the running balance are this company's. `je` and `g` are joined on their primary keys from that scoped row (real FKs: `journal_lines_ibfk_1 → journal_entries(id)`, `fk_journal_lines_trxGroupId → trx_groups(id)`), so both are transitively scoped.

What makes this **suspect rather than confirmed** is the `LEFT JOIN trx t`:

- `je.sourceId` is **not a foreign key**. Per the architecture doc's own note (§11, "cancel/delete/restore"), `journal_entries` names its voucher by a plain `sourceType`/`sourceId` pair precisely *so that* no FK exists. There is therefore **no referential-integrity guarantee at all** backing this join — unlike every other transitive chain in this file.
- `t.companyId` is absent, and `t.deletedAt` is not checked either.
- The projected column is `t.invoiceNo`, which lands in `voucherNo` on every statement line and is printed on the signed hard copy.

I could not construct a reachable write path that puts a foreign `sourceId` on a `journal_entries` row — `PostingService` always sets `sourceId` from the voucher it just resolved through a scoped read, and reversals copy it. So I cannot promote this to CONFIRMED LEAK. But the safety here rests entirely on "no code ever writes a cross-company `sourceId`," with nothing in the schema and nothing in this query enforcing it, on a soft (non-FK) reference. That is exactly the invariant class the brief asked me to flag rather than assume. **Fix is one predicate: `AND t.companyId = :companyId` in the ON clause** (ON, not WHERE — it is a LEFT JOIN).

### 2.4 `party-statement.service.ts:372` — `balanceBefore()` — **CONFIRMED SCOPED**

`jl.companyId = :companyId` on the anchor; `je` and `g` joined on PKs from that scoped row; `:from` bound. Same shared `liveEntrySql` caveat as 2.6. This is the opening-balance figure the printed statement leads with, and it is correctly scoped.

### 2.5 `party-statement.service.ts:406` — `controlBalance()` — **CONFIRMED SCOPED** (tenancy)

```sql
FROM journal_lines jl
JOIN trx_groups g ON g.id = jl.trxGroupId AND g.systemKey = :systemKey
WHERE jl.partyUserId = :partyId AND jl.companyId = :companyId
```

Anchored on `jl.companyId`; `g` on its PK. `${expr}` is a ternary over the typed `'debit' | 'credit'` parameter — not injectable.

*Out-of-scope correctness note, flagged in passing:* this is the only party-balance query in the file that does **not** join `journal_entries` and apply `liveEntrySql`, so reversed/cancelled entries appear to be counted in `payable`/`receivable`. That would make the `summary()` KPI disagree with `statement()`'s closing balance. Not a tenancy issue — worth a separate ticket.

### 2.6 `party-statement.service.ts:418` — `monthlyTrend()` — **CONFIRMED SCOPED**

Single table (`trx`), explicit `AND companyId = :companyId`, `GROUP BY month` applied **after** the WHERE, so no cross-company aggregation window exists. All values bound.

### 2.7 The party-portal question, answered explicitly — **NOT EXPLOITABLE via party id**

Both planes reach the same service:
- admin: `PartyStatementController` (`party-statement/:partyId/*`, `@Permissions('trx', ['canView'])`) passes the path param straight through, `ParseIntPipe` only.
- party self-service: `PartyPortalService` passes `req.user.id`.

So `partyId` **is** attacker-controlled on the admin plane and is never re-validated by `summary`/`statement`/`pendingBills`/`transactions`/`payments` (only `profile()` gates it). That is safe anyway, because **every** party-keyed read ANDs the party key with `companyId`:

| method | party key | company key |
|---|---|---|
| `summary` :186 | `supplierUserId = :partyId` | `companyId = :companyId` |
| `statement` :241 | `jl.partyUserId = :partyId` | `jl.companyId = :companyId` |
| `balanceBefore` :372 | `jl.partyUserId = :partyId` | `jl.companyId = :companyId` |
| `controlBalance` :406 | `jl.partyUserId = :partyId` | `jl.companyId = :companyId` |
| `monthlyTrend` :418 | `supplierUserId = :partyId` | `companyId = :companyId` |
| `pendingBills` :306 | ORM `supplierUserId` | ORM hook (`Trx` is scoped) |
| `transactions`/`payments` :339/:350 | ORM `supplierUserId`/`userId` | ORM hook |

A company-A admin passing company B's party id gets **empty results**, not B's ledger. The "same name / same id" attack the brief asked about fails because `users.id` is global but the ledger rows are not. The one residual dependency I cannot verify from these files alone: this rests entirely on `TenantContextGuard` populating `companyId` from a **re-verified** `company_members` row rather than from the JWT claim — the design doc says it does, and that guard is outside this batch.

---

## 3. `src/services/financial-dashboard.service.ts`

6 raw-SQL sites. **3 confirmed scoped, 3 CONFIRMED LEAKS.** This file is the worst of the four.

The common defect: `journal_lines` **has a `companyId` column** (`fk_journal_lines_company`, `idx_journal_lines_company`, migration line ~1515) and **none of the three analytics queries use it**. Each scopes only the chart-of-accounts master it anchors on, then LEFT JOINs the entire platform's ledger onto it and sums. The `companyId` predicate that satisfies the CI guard restricts *which rows appear*, not *which money is summed into them* — precisely the "aggregate that groups across companies before an outer filter narrows it" pattern.

### 3.1 `financial-dashboard.service.ts:128` — `getMasterCounts()` — **CONFIRMED SCOPED**

Three independent scalar subqueries, each with its own `AND companyId = :companyId`, over `trx_natures` / `trx_groups` / `trx_accounts`. No branch omits it. Bound.

### 3.2 `financial-dashboard.service.ts:156` — `getFinancialSummary()` — **CONFIRMED SCOPED**

```sql
FROM journal_lines jl
JOIN journal_entries je ON je.id = jl.journalEntryId
WHERE jl.companyId = :companyId AND ${liveEntrySql('je')}
```

**Anchored on the money table itself** — this is the shape the other three should have had. `je` joins on its PK via a real FK. All `SUM`/`COUNT` aggregates are computed over a row set already narrowed by `jl.companyId`. (Shared `liveEntrySql` caveat: §3.7.)

### 3.3 🚨 `financial-dashboard.service.ts:198` — `getNatureAnalytics()` — **CONFIRMED LEAK**

```sql
FROM trx_natures n
LEFT JOIN trx_groups   g  ON g.trxNatureId = n.id AND g.deletedAt IS NULL   -- ← no companyId
LEFT JOIN journal_lines      jl ON jl.trxGroupId    = g.id                  -- ← no companyId
LEFT JOIN journal_entries    je ON je.id            = jl.journalEntryId
WHERE n.deletedAt IS NULL AND n.companyId = :companyId
GROUP BY n.id, n.name, n.accountNature, n.trxType
```

`n.companyId` is the **only** tenancy predicate in the statement. Both `trx_groups` and `journal_lines` — two tenant-scoped tables, one of which is the general ledger — are joined with none. And unlike the `products` joins in §1.2, `g.trxNatureId = n.id` is a **one-to-many** join, so it genuinely widens the row set: every group in the platform pointing at this nature is pulled in, and every journal line of every such group is then summed into `totalDebit` / `totalCredit`.

**Concrete two-company scenario (write path verified, not hypothesised):**

1. `TrxGroupService.create` (`src/services/trx-group.service.ts:32-53`) does `TrxGroup.create({ ...createTrxGroupDto, currentBalance: 0, isSystem: false })`. `trxNatureId` comes **straight off the DTO** (`src/dto/trx-group.dto.ts:17`, validated only as a number) and is **never checked against the caller's company**. The `beforeValidate` hook stamps `companyId` = the caller's company; it does not touch `trxNatureId`.
2. The DB does not stop it either: `CONSTRAINT fk_trx_groups_trxNatureId FOREIGN KEY (trxNatureId) REFERENCES trx_natures (id)` (migration line 2791) enforces **existence only**, not company.
3. A user in **company B** POSTs a new Chart-of-Accounts group with `trxNatureId` = a small integer belonging to **company A** (nature ids are low, dense, and trivially guessable). The row persists as `companyId = B, trxNatureId = <A's nature>`.
4. Company B posts ordinary vouchers to that group. `journal_lines` rows are written with `companyId = B, trxGroupId = <B's group>`.
5. **Company A opens the Financial Dashboard.** `n` = A's nature (passes `n.companyId = A`). `g` matches B's group (no predicate). `jl` matches B's journal lines (no predicate). B's rupee debits and credits are summed into A's nature row, and `COUNT(DISTINCT g.id)` reports B's group in A's `groupCount`.

What crosses: **real monetary totals** (`totalDebit`, `totalCredit`, and the derived `net`) plus a group count. Company A cannot see B's line detail, but sees B's aggregate money attributed to A's own account nature — and A's dashboard totals silently stop reconciling with A's trial balance.

**Fix:** `AND g.companyId = :companyId` on the `trx_groups` ON clause **and** `AND jl.companyId = :companyId` on the `journal_lines` ON clause (ON, not WHERE — they are LEFT JOINs and moving these to WHERE would drop natures with no activity).

### 3.4 🚨 `financial-dashboard.service.ts:236` — `getGroupAnalytics()` — **CONFIRMED LEAK**

```sql
FROM trx_groups g
JOIN trx_natures n ON n.id = g.trxNatureId
LEFT JOIN journal_lines   jl ON jl.trxGroupId = g.id        -- ← no companyId
LEFT JOIN journal_entries je ON je.id          = jl.journalEntryId
WHERE g.deletedAt IS NULL AND g.companyId = :companyId
GROUP BY g.id, g.name, n.name, n.accountNature, g.currentBalance
HAVING txnCount > 0
ORDER BY txnCount DESC
LIMIT 20
```

Anchor `g` is scoped. `journal_lines` is not. The direction of the leak is the mirror image of 3.3: instead of a foreign *group* attaching to our nature, a foreign *journal line* attaches to our group.

**Concrete two-company scenario (write path verified):**

1. The N-line Journal voucher feature lets the client name the ledger head per line: `CreateUpdateTrxPaymentReceiptDto` carries `trxGroupId` (`src/dto/trx-payment-receipt.dto.ts:23`, and `:102` on the line sub-DTO), validated as a number only.
2. On approval, `PostingService.postPaymentReceipt` (line ~250) maps the stored lines to `legInputs` using `l.trxGroupId` verbatim, calls `postJournalLines` (`posting.service.ts:798`), which calls `persistLines` (`:943`) → `JournalLine.bulkCreate([{ journalEntryId, trxGroupId: leg.trxGroupId, … }])`. **At no point is `trxGroupId` resolved against the caller's company.**
3. The `beforeValidate`/`beforeCreate` hooks stamp `companyId` = B on the new `journal_lines` rows but do not validate `trxGroupId`. The FK `fk_journal_lines_trxGroupId → trx_groups(id)` (migration line 1529) checks existence only.
4. The one thing that *would* have surfaced the mistake is silenced: `persistLines:984` does `TrxGroup.increment({ currentBalance: delta }, { where: { id } })`, and the ORM hook AND-composes `companyId = B` into that WHERE — so it updates **0 rows and throws nothing**. The bad line is written; the balance cache is quietly not updated.
5. A user in **company B** submits a multi-line Journal with `lines[].trxGroupId` = one of **company A's** `trx_groups.id` values and approves it. Result: `journal_lines(companyId = B, trxGroupId = <A's group>)`.
6. **Company A opens the Financial Dashboard.** `g` = A's group. `jl` matches B's line (no predicate). B's debit/credit are summed into A's `totalDebit`/`totalCredit`, and B's line is counted in A's `txnCount` — which is also the `ORDER BY` key and the `HAVING` filter, so **company B controls which of company A's groups appear in A's "top 20 by activity" list and in what order**.

Secondary, lower-severity leg in the same statement: `JOIN trx_natures n ON n.id = g.trxNatureId` has no `companyId`. Given the 3.3 write path (a group can carry a foreign `trxNatureId`), the `natureName` column of A's own group row can render **company B's nature name** — a small string disclosure.

**Fix:** `AND jl.companyId = :companyId` on the `journal_lines` ON clause; `AND n.companyId = g.companyId` on the natures join.

### 3.5 🚨 `financial-dashboard.service.ts:276` — `getAccountAnalytics()` — **CONFIRMED LEAK**

```sql
FROM trx_accounts a
JOIN trx_groups g ON g.id = a.trxGroupId                     -- ← no companyId
LEFT JOIN journal_lines   jl ON jl.trxAccountId = a.id        -- ← no companyId
LEFT JOIN journal_entries je ON je.id            = jl.journalEntryId
WHERE a.deletedAt IS NULL AND a.companyId = :companyId
GROUP BY a.id, a.name, a.type, g.name, a.balance
```

Same defect, keyed on `trxAccountId` instead of `trxGroupId`. `journal_lines.trxAccountId` is nullable with `CONSTRAINT journal_lines_ibfk_3 FOREIGN KEY (trxAccountId) REFERENCES trx_accounts (id)` — existence-only, no company. `trxAccountId` is likewise client-supplied on the Payment/Receipt DTO (`src/dto/trx-payment-receipt.dto.ts:62`, the cash/bank account picker) and flows through `PostingService.post`'s `cashAccountId` into `persistLines` without a company check.

**Scenario:** a user in company B saves a Payment/Receipt naming **company A's** `trx_accounts.id` as the cash account and approves it. The resulting `journal_lines` row is `companyId = B, trxAccountId = <A's account>`. Company A's dashboard then reports B's amounts inside A's account row's period `totalDebit`/`totalCredit`. Note this list has **no LIMIT**, so it covers A's entire chart of accounts.

`JOIN trx_groups g ON g.id = a.trxGroupId` is the same secondary string-disclosure leg as 3.4 — A's account row can display B's group name in `groupName`.

**Fix:** `AND jl.companyId = :companyId` on the ledger join; `AND g.companyId = a.companyId` on the groups join.

### 3.6 `financial-dashboard.service.ts:309` — `getMonthlyTrend()` — **CONFIRMED SCOPED**

```sql
FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journalEntryId
WHERE je.date BETWEEN … AND jl.companyId = :companyId AND ${liveEntrySql('je')}
GROUP BY month
```

Anchored on `jl.companyId`, `je` on its PK FK, `GROUP BY` applied after the WHERE. Correct. It is worth noting that this query and 3.2 — the two that *are* right — are exactly the two that anchor on `journal_lines` rather than on a master table, which is the pattern the other three should be rewritten to.

### 3.7 Cross-cutting: `liveEntrySql()` contains an unscoped correlated subquery — **SUSPECT**

`src/const/posting.const.ts:59-60`:
```ts
export const liveEntrySql = (alias = 'je'): string =>
  `${alias}.isReversal = 0 AND NOT EXISTS (SELECT 1 FROM journal_entries jrev WHERE jrev.reversedEntryId = ${alias}.id)`;
```

The `NOT EXISTS` subquery reads `journal_entries` — a tenant-scoped table — with **no `companyId` predicate**, and it is inlined into 7 of the sites in this batch (`financial-dashboard` 3.2/3.3/3.4/3.5/3.6, `party-statement` 2.3/2.4) plus every other consumer in the codebase.

Directionally this can only **suppress** rows, never reveal them: a company-B `journal_entries` row whose `reversedEntryId` equalled a company-A entry id would make company A's own entry vanish from A's P&L, dashboard and party statements. That is an integrity/availability concern, not confidentiality. I found no user-controlled write path for `reversedEntryId` (it is always set internally to the entry being reversed, itself found through a scoped read), so I am not promoting it to a leak — but it is a shared fragment sitting in a lot of financial reporting, and the fix is a single `AND jrev.companyId = ${alias}.companyId` inside the subquery, applied once.

---

## 4. `src/services/voucher-reference.service.ts`

10 SQL statements behind 1 wrapper. **8 confirmed scoped, 1 CONFIRMED LEAK, 1 suspect.**

### 4.0 `voucher-reference.service.ts:72` — the `query()` wrapper — **structural note**

```ts
private query<T = any>(sql: string, replacements: Record<string, unknown>, transaction?: Transaction) {
  return this.sequelize.query(sql, { type: QueryTypes.SELECT,
    replacements: { ...replacements, companyId: TenantContext.requireCompanyId() }, transaction });
}
```

Injecting `companyId` centrally is a good pattern — it guarantees the *bind* is always available. It guarantees nothing about the *predicate*, and the doc comment above it ("Every call site's SQL carries its own `AND <alias>.companyId = :companyId` predicate") is the unverified claim that turns out to be false at 4.3, 4.6 and (critically) 4.8. **This is also the file's entire CI-guard surface**: line 72 is the only `sequelize.query(` in the file, its span contains `companyId`, guard green, ten statements never examined.

### 4.1 `voucher-reference.service.ts:82` — `forTrx` settlements — **CONFIRMED SCOPED**

```sql
FROM trx_payment_receipt_trxs a
JOIN trx_payment_receipts pr ON pr.id = a.trxPaymentReceiptId
WHERE a.trxId = :id AND pr.deletedAt IS NULL AND pr.isCurrent = 1 AND pr.companyId = :companyId
```
`a` (an allocation, tenant-scoped) carries no predicate of its own, but it is the **child** of `pr` on `pr`'s primary key, and `pr.companyId` is enforced — so only allocations belonging to this company's payments survive. `:id` (`trxId`) is caller-supplied and unverified, but a foreign trx id yields rows in `a` whose parent `pr` is in the other company, which `pr.companyId` then excludes → empty result, no disclosure.

### 4.2 🎯 `voucher-reference.service.ts:93` — `forTrx` children / `JSON_CONTAINS` — **CONFIRMED SCOPED**

This is the site the brief specifically asked about, and it is **correct**:

```sql
FROM trx t
WHERE t.deletedAt IS NULL AND t.isCurrent = 1 AND t.id <> :id AND t.companyId = :companyId
  AND (t.trxAgainstId = :id OR JSON_CONTAINS(COALESCE(t.trxAgainstIds, JSON_ARRAY()), CAST(:id AS JSON)))
```

`t.companyId = :companyId` is ANDed **on the same row** as the containment test — it does not rely on the referenced ids having been scoped when they were written. That matters, because they were not: `trxAgainstIds` is a plain `json DEFAULT NULL` column (migration line 2606) which **cannot carry a foreign key in MySQL at all**, and `trxAgainstId`'s FK (`fk_trx_trxAgainstId → trx(id)`, line 2648) is existence-only. So the containment test genuinely can match a foreign row, and this predicate is the only thing stopping it. Correct as written.

### 4.3 `voucher-reference.service.ts:103` — `forTrx` source — **SUSPECT / NEEDS HUMAN JUDGMENT**

```sql
FROM trx me JOIN trx src ON src.id = me.trxAgainstId
WHERE me.id = :id AND src.deletedAt IS NULL AND src.companyId = :companyId
```

`src` (the projected row) is scoped ✓. **`me` is not scoped at all**, and `me.id = :id` is the raw, unverified caller-supplied path parameter. So the query happily resolves a foreign company's voucher into `me`, then follows its `trxAgainstId` and filters the destination by our company.

Why not a confirmed leak: for a foreign `me` to yield a row, `me.trxAgainstId` would have to point at one of *our* vouchers — a cross-company `trxAgainstId`. That is *writable* (see 4.8 step 1) but it would be the attacker linking their own voucher to ours, and the returned row is then our own voucher, disclosed to us. No foreign data reaches the response. Why it still deserves attention: the pattern is dangerous, the fix is free (`AND me.companyId = :companyId`), and leaving one alias in a self-join unscoped is exactly the kind of thing that becomes a leak the next time a column is added to the SELECT list.

### 4.4 `voucher-reference.service.ts:109` — `forTrx` e-Way Bills — **CONFIRMED SCOPED**
```sql
SELECT id, ewbNo, status, createdAt FROM eway_bills WHERE trxId = :id AND companyId = :companyId ORDER BY id
```
Single table, explicit predicate, bound.

### 4.5 `voucher-reference.service.ts:113` — `forTrx` e-Invoices — **CONFIRMED SCOPED**
Identical shape over `einvoices`.

### 4.6 `voucher-reference.service.ts:203` — `forPaymentReceipt()` — **CONFIRMED SCOPED**

```sql
FROM trx_payment_receipt_trxs a JOIN trx t ON t.id = a.trxId
WHERE a.trxPaymentReceiptId = :id AND t.deletedAt IS NULL AND t.companyId = :companyId
```
`a` unscoped but joined to the scoped, projected `t` on `t`'s PK. `:id` (receiptId) is unverified; a foreign receipt id produces allocations pointing at foreign `trx` rows, which `t.companyId` excludes → empty. Note `a.amount` **is** projected, but only for rows that survived `t.companyId`, so it cannot carry foreign data.

### 4.7 `voucher-reference.service.ts:243` — `activeCountsForTrxIds` settlements — **CONFIRMED SCOPED**
```sql
FROM trx_payment_receipt_trxs a JOIN trx_payment_receipts pr ON pr.id = a.trxPaymentReceiptId
WHERE a.trxId IN (:ids) AND pr.deletedAt IS NULL AND pr.isCurrent = 1 AND pr.status <> 'cancelled'
  AND pr.companyId = :companyId
GROUP BY a.trxId
```
Scoped through `pr` before the `GROUP BY`, so the aggregation window is already narrowed. `:ids` bound as a list.

### 4.8 🚨 `voucher-reference.service.ts:254` — `activeCountsForTrxIds` children — **CONFIRMED LEAK**

```sql
SELECT s.id trxId, COUNT(DISTINCT t.id) n
  FROM trx s
  JOIN trx t ON t.deletedAt IS NULL AND t.isCurrent = 1 AND t.status <> 'cancelled' AND t.id <> s.id
   AND (t.trxAgainstId = s.id OR JSON_CONTAINS(COALESCE(t.trxAgainstIds, JSON_ARRAY()), CAST(s.id AS JSON)))
 WHERE s.id IN (:ids) AND s.companyId = :companyId
 GROUP BY s.id
```

**`t` — the counted side — has no `companyId` predicate.** Compare with its own single-row sibling at 4.2 (line 96), twelve lines earlier in the same file, which does. The scoping is asymmetric between the two implementations of the same question, which is itself proof that the remediation was applied by hand and missed one.

**Concrete two-company scenario (write path verified):**

1. `trxAgainstId` / `trxAgainstIds` are **never validated against the caller's company**. `TrxWriteService.assertAgainstConstraints` (`trx-write.service.ts:358-359`) begins `if (dto.trxType !== TrxType.DebitNote && dto.trxType !== TrxType.CreditNote) return;` — so for a Purchase, Sales, or any workflow voucher there is **no check at all**. `TrxService.createUpdate` then does `Trx.create(dto as any, options)` (`trx.service.ts:60/82`), persisting both fields verbatim. `trxAgainstIds` is a bare JSON column with no FK; `trxAgainstId`'s FK is existence-only.
2. A user in **company B** saves any ordinary voucher (a Sales invoice will do) with `trxAgainstIds: [<company A's trx id>]`. `trx.id` is a single global auto-increment across all companies, so A's ids are dense and guessable. The row persists as `companyId = B`, `trxAgainstIds = [A's id]`, `isCurrent = 1`, `status <> 'cancelled'`.
3. **Company A opens any voucher list.** The grid batches its row-action gating through `activeCountsForTrxIds([...this page's ids...])`. `s` is scoped to A ✓. `t` is not — B's voucher satisfies the `JSON_CONTAINS` join and is counted.
4. Company A's response carries `n ≥ 1` for a voucher that has, in A's world, nothing pointing at it. The grid greys out **Cancel and Delete** on A's own voucher with no explanation the user can act on — and clicking "Linked documents" shows an **empty** panel, because that path goes through `forTrx` (4.2), which *is* scoped. The two disagree by construction.

What crosses the boundary: an aggregate **count derived from company B's rows appears in company A's response**, and company B can unilaterally and silently disable company A's ability to cancel or delete their own vouchers from the grid. It is a count rather than field values, so I would rate it lower-severity than the three dashboard leaks — but it is unambiguously a cross-tenant data flow plus a cross-tenant availability defect, and it also functions as an oracle (a company-B user can flip `n` on a chosen id to confirm that id exists somewhere on the platform).

Worth noting for triage: the **server-side enforcement is not affected** — the cancel/delete guards call `activeSummariesForTrx` → `forTrx` (scoped), so an operator who forces the request through would still be allowed to cancel. The damage is confined to the grid's gating and the count itself.

**Fix:** add `AND t.companyId = :companyId` to the ON clause, matching line 96 exactly.

### 4.9 `voucher-reference.service.ts:262` — `activeCountsForTrxIds` e-Way Bills — **CONFIRMED SCOPED**
```sql
SELECT trxId, COUNT(*) n FROM eway_bills WHERE trxId IN (:ids) AND status = 'generated' AND companyId = :companyId GROUP BY trxId
```
Predicate in the WHERE, applied before the `GROUP BY`.

### 4.10 `voucher-reference.service.ts:265` — `activeCountsForTrxIds` e-Invoices — **CONFIRMED SCOPED**
Identical shape over `einvoices`.

---

## 5. Summary table

| File | Raw-SQL sites | Confirmed scoped | Confirmed leak | Suspect |
|---|---:|---:|---:|---:|
| `src/services/inventory.service.ts` | 4 | 4 | 0 | 0 |
| `src/services/party-statement.service.ts` | 6 | 5 | 0 | 1 |
| `src/services/financial-dashboard.service.ts` | 6 | 3 | **3** | 0 |
| `src/services/voucher-reference.service.ts` | 10 | 8 | **1** | 1 |
| **Total** | **26** | **20** | **4** | **2** |

Plus 2 findings outside the raw-SQL count: 1 confirmed cross-tenant ORM read (`inventory.service.ts:766`) and 1 suspect shared SQL fragment (`posting.const.ts:59`, inlined into 7 of the 26 sites).

---

## 6. Triage list

### CONFIRMED LEAK — fix before Phase 2 can be called closed

| # | Site | What crosses | Fix |
|---|---|---|---|
| L1 | `financial-dashboard.service.ts:198` `getNatureAnalytics` | Company B's **rupee debit/credit totals** + group count, summed into company A's account-nature rows | `AND g.companyId = :companyId` and `AND jl.companyId = :companyId` on the two LEFT JOIN ON clauses |
| L2 | `financial-dashboard.service.ts:236` `getGroupAnalytics` | Company B's **rupee totals + txnCount** into company A's group rows; B also controls A's top-20 ordering (`txnCount` is the ORDER BY and HAVING key). Secondary: B's nature *name* rendered in A's row | `AND jl.companyId = :companyId` on the ledger join; `AND n.companyId = g.companyId` on the natures join |
| L3 | `financial-dashboard.service.ts:276` `getAccountAnalytics` | Company B's **rupee totals** into company A's per-account period figures (no LIMIT — A's whole chart of accounts). Secondary: B's group *name* in `groupName` | `AND jl.companyId = :companyId` on the ledger join; `AND g.companyId = a.companyId` on the groups join |
| L4 | `voucher-reference.service.ts:254` `activeCountsForTrxIds` (children) | An **active-reference count derived from company B's vouchers** in company A's response; B can silently disable Cancel/Delete on A's grid rows; existence oracle | `AND t.companyId = :companyId` on the ON clause — copy line 96 |

### CONFIRMED CROSS-TENANT READ (not raw SQL, same batch)

| # | Site | What crosses | Fix |
|---|---|---|---|
| L5 | `inventory.service.ts:766` `allowNegativeStock()` | Every tenant reads **company 1's** `allowNegativeStock` flag. `Company` has no `companyId` column so the ORM hooks provably do not scope it. Governs a stock write guard | `Company.findByPk(TenantContext.requireCompanyId(), …)`. Then grep the repo for every other bare `Company.find*` |

### SUSPECT — needs a human decision

| # | Site | Why | Suggested action |
|---|---|---|---|
| S1 | `party-statement.service.ts:241` `statement()` — `LEFT JOIN trx t ON … t.id = je.sourceId` | `je.sourceId` is a **deliberate non-FK** soft reference (architecture doc §11), so nothing in the schema backs this transitive chain; `t.invoiceNo` is printed on the signed statement. No reachable write path found for a foreign `sourceId`, but the invariant is unenforced | Add `AND t.companyId = :companyId` to the ON clause — free, and removes the reliance on an unenforceable invariant |
| S2 | `posting.const.ts:59` `liveEntrySql()` — `NOT EXISTS (SELECT 1 FROM journal_entries jrev WHERE jrev.reversedEntryId = <alias>.id)` | Unscoped correlated subquery over a tenant-scoped table, inlined into 7 sites in this batch and many more repo-wide. Can only *hide* rows (integrity/availability), never reveal. No user-controlled write path to `reversedEntryId` found | Add `AND jrev.companyId = ${alias}.companyId` inside the subquery — one edit fixes every consumer |

### Process findings (not code defects, but they are why the above survived)

1. **The CI guard cannot see `voucher-reference.service.ts` at all.** One `sequelize.query(` in the file (the wrapper), ten real statements behind `this.query(...)`. Any file that wraps its raw SQL in a helper is invisible. Consider extending `RAW_SQL_CALL` to any `\.query\s*(?:<[^>]*>)?\s*\(` and allow-listing the wrapper itself, or — better — matching on the SQL string literals rather than the call.
2. **Mentioning `companyId` on the anchor table satisfies the guard while the joined tables leak.** All three dashboard leaks are guard-green. A useful strengthening: for each statement, extract the table aliases and require a `companyId` predicate for each alias whose table is in the tenant-scope registry — still syntactic, but it would have caught L1/L2/L3/L4.
3. **The root cause behind L1–L4 is upstream of these files**: `trx_groups.trxNatureId`, `journal_lines.trxGroupId`, `journal_lines.trxAccountId`, `trx.trxAgainstId` and `trx.trxAgainstIds` are all client-supplied and **never validated to belong to the caller's company**, while every corresponding FK is existence-only. The ORM hooks stamp `companyId` on the *row* but never validate the *ids the row points at*. Fixing the four queries closes the reads; a `beforeValidate`-style FK-company assertion (or a service-level resolve-through-a-scoped-read on every inbound id) is what closes the class. Recommend raising that as its own Phase 2 item — it is very likely to have siblings in the ~19 raw-SQL files outside this batch.
