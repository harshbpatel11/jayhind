# Phase 2 / task 2.3 — adversarial raw-SQL tenancy review (batch B)

**Repo:** `/home/ubuntu/projects/jayhind-client-back`
**Date:** 2026-08-14
**Scope:** 6 assigned service files, every `sequelize.query(` site in each.
**Method:** read each call site plus the enclosing function and its callers; traced every
table referenced (including JOINs and correlated subqueries) for a `companyId` predicate or a
verified transitive chain; checked bind-vs-interpolation on every value; checked WHERE-vs-GROUP BY
ordering on every aggregate; checked pagination/LIMIT nesting levels.

---

## 0. Ground truth established before reviewing (so verdicts below are anchored)

**`TenantContext.requireCompanyId()` is a trustworthy source.** `src/guards/tenant-context.guard.ts`
re-reads `company_members` live on every non-`@Public()` request (`crossCompany: true` on that one
bootstrap query only), refuses on inactive membership, `membershipVersion` drift, or a suspended
company, and only then calls `TenantContext.populate({ companyId: member.companyId, ... })`. The
value stored is `member.companyId` — read back off the verified DB row, **not** the JWT claim it was
matched against. So every site below that binds `TenantContext.requireCompanyId()` is sourcing a
server-verified value that no request param, body field or header can influence. ✔

**All 19 raw sites in these 6 files are parameterised.** Every `companyId` reaches SQL as a
`:companyId` named replacement. The only string interpolation into SQL text anywhere in these files
is of compile-time TypeScript constants (`UserKind.Staff`, `UserStatus.Active`,
`this.MEMBERSHIP_JOIN`) or a two-branch static fragment (`trx.service.ts:388`). **No user-controlled
value is interpolated into any SQL string in these 6 files — zero SQL-injection findings here.**

**A useful accidental fail-safe worth preserving** (`users-dashboard.service.ts`): because
`MEMBERSHIP_JOIN` is a shared fragment carrying a `:companyId` bind, a future query that pastes it in
but forgets `companyId` in `replacements` does **not** silently run unscoped — Sequelize's
`injectReplacements` throws on a named parameter with no entry. That is a stronger guarantee than the
CI guard provides, and it is the pattern the other five files should copy.

---

## 1. `src/services/job-work-challan.service.ts` — 1 site

### 1.1 `job-work-challan.service.ts:816` — `dispatchedFromFirstStep()`

```sql
SELECT COALESCE(SUM(d.quantity), 0) AS total
  FROM job_work_dispatches d
  JOIN job_work_operations o ON o.id = d.operationId
 WHERE d.jobWorkOrderId = :orderId
   AND d.status <> 'cancelled'
   AND d.companyId = :companyId
   AND o.sequence = (
         SELECT MIN(o2.sequence) FROM job_work_operations o2
          WHERE o2.jobWorkOrderId = :orderId AND o2.status <> 'skipped' AND o2.companyId = :companyId
       )
```
`{ replacements: { orderId, companyId: TenantContext.requireCompanyId() }, transaction, type: 'SELECT' as any }`

**Verdict: CONFIRMED SCOPED.**

- Driving table `d` (`job_work_dispatches`, scoped) carries `d.companyId = :companyId`. ✔
- The **correlated subquery** on `job_work_operations o2` carries its own `o2.companyId = :companyId`
  — this is the exact thing that is usually missed, and it is present. ✔
- Alias `o` (`job_work_operations`) has **no** predicate of its own, but it is joined on
  `o.id = d.operationId`, a primary-key equality against an already-scoped row. An inner PK join
  cannot widen the result set; `o` is by construction the single operation row `d` names. Transitively
  scoped, and the outer `d.companyId` filter is what bounds the whole statement.
- `orderId` is a caller-supplied id, but it is **not** load-bearing for isolation: even with company
  B's `orderId`, `d.companyId = :companyId` yields zero rows and the subquery returns NULL. The
  function is fail-safe against a hostile `orderId`. ✔
- No `GROUP BY`, single aggregate over a filtered set — no pre-aggregation mixing.

*Hardening suggestion (not a defect):* add `AND o.companyId = :companyId` for symmetry with `o2`.

---

## 2. `src/services/trx.service.ts` — 5 sites

### 2.1 `trx.service.ts:333` — `convertedQuantitiesByProduct()`

```sql
  FROM trx t
  JOIN trx_items ti ON ti.trxId = t.id
 WHERE t.trxAgainstId = :sourceId AND t.trxType = :targetType AND t.isCurrent = true
   AND t.deletedAt IS NULL AND t.status NOT IN (:cancelled, :rejected)
   AND t.companyId = :companyId
 GROUP BY ti.productId
```

**Verdict: CONFIRMED SCOPED.**

- `t` (`trx`) explicitly scoped. ✔
- `ti` (`trx_items`, itself a scoped table) has no own predicate; scoped transitively through the PK
  join `ti.trxId = t.id` against a company-filtered `t`. Inner join, cannot widen.
- **GROUP BY ordering checked:** `WHERE` (containing `t.companyId`) is evaluated before `GROUP BY` in
  SQL semantics, so the aggregate never groups across companies and is then hidden by a later filter.
  This is the "aggregate mixes first, filter hides it after" failure mode the brief asked about — it
  does not occur here. ✔
- `sourceId` is caller-supplied but non-load-bearing (a foreign `sourceId` returns an empty map).

### 2.2 `trx.service.ts:365` — `itemQuantitiesByProduct()`

```sql
  FROM trx_items ti WHERE ti.trxId IN (:trxIds) AND ti.companyId = :companyId GROUP BY ti.productId
```

**Verdict: CONFIRMED SCOPED.** Direct predicate on the one table referenced; `trxIds` bound as an
array replacement; no join, no subquery. A caller passing another company's `trxIds` gets an empty
map. Strongest of the five.

*Non-tenancy note:* no `ti.deletedAt`/parent-`trx` liveness filter here (unlike 2.1/2.3) — `TrxItem`
is not paranoid so this is fine today, but it means this query counts items of soft-deleted/cancelled
vouchers. Callers must supply already-filtered `trxIds`. Out of tenancy scope; flagged for the owner.

### 2.3 `trx.service.ts:391` — `returnedQuantitiesByProduct()`

```sql
  FROM trx t JOIN trx_items ti ON ti.trxId = t.id
 WHERE t.trxType = :trxType AND t.isCurrent = true AND t.deletedAt IS NULL
   AND t.status NOT IN (:cancelled, :rejected)
   AND (t.trxAgainstId IN (:trxIds) OR JSON_OVERLAPS(t.trxAgainstIds, CAST(:idsJson AS JSON)))
   AND t.companyId = :companyId
   ${exclude}
```

**Verdict: CONFIRMED SCOPED.**

- `t.companyId` present, and critically it sits **outside** the `OR` group. This is the one branch
  risk in this file: `(A OR B) AND companyId` is correct; `A OR (B AND companyId)` would have leaked.
  Operator precedence and the explicit parenthesisation are both correct as written. ✔
- `ti` transitively scoped via PK join to filtered `t` (same as 2.1).
- `${exclude}` (line 388) is a **two-branch static string literal** (`''` or
  `' AND COALESCE(t.mainId, t.id) <> :excludeRootId'`) — the value itself travels as the bound
  `:excludeRootId`. Not an injection vector. ✔
- `:idsJson` is `JSON.stringify(trxIds)` passed as a **replacement value**, not concatenated. ✔

### 2.4 `trx.service.ts:490` — `vendorOutstanding()`

```sql
SELECT jl.partyUserId AS vendorId, u.name AS vendorName,
       ROUND(COALESCE(SUM(jl.credit - jl.debit), 0), 2) AS outstanding
  FROM journal_lines jl
  JOIN trx_groups g ON g.id = jl.trxGroupId AND g.systemKey = :creditorsCtrl
  LEFT JOIN users u ON u.id = jl.partyUserId
 WHERE jl.partyUserId IS NOT NULL AND jl.companyId = :companyId
 GROUP BY jl.partyUserId, u.name
HAVING outstanding <> 0
```

**Verdict: CONFIRMED SCOPED** (with one defence-in-depth gap noted).

- `journal_lines` — the driving, money-bearing table — is explicitly scoped. ✔
- **GROUP BY / HAVING ordering explicitly checked.** `WHERE jl.companyId` is applied before
  `GROUP BY`; `HAVING outstanding <> 0` only prunes zero-balance groups afterwards. There is no window
  in which company B's journal lines are summed into a group that a later predicate then hides. ✔
- `LEFT JOIN users u` — `users` is a documented global identity table with no `companyId`, correctly
  so. `u.name` is only reached for a `partyUserId` that already appears on a company-A journal line,
  so no foreign identity is enumerated. ✔
- **Gap (not a leak):** `JOIN trx_groups g` carries **no `g.companyId = :companyId`**, although
  `trx_groups` *is* a scoped table (`src/entities/trx-group.entity.ts:40`). It is transitively scoped
  through `g.id = jl.trxGroupId` (PK join off a company-filtered row). This holds **only** while the
  invariant "a journal line never references another company's group" holds. That invariant is
  strong here — journal lines are written by `PostingService` under an active tenant context and
  `trxGroupId` is never client-supplied on this path — so I am calling it scoped rather than suspect.
  Recommend adding `AND g.companyId = :companyId` anyway: it costs nothing and removes the reliance.

### 2.5 `trx.service.ts:518` — `customerOutstanding()`

**Verdict: CONFIRMED SCOPED.** Byte-for-byte the same shape as 2.4 with
`SundryDebtorsControl` and `debit - credit`. Same evidence, same `trx_groups` hardening suggestion.

---

## 3. `src/services/user-profile.service.ts` — 1 site

### 3.1 `user-profile.service.ts:289` — `nextEmployeeCode()`

```sql
SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(employeeCode, '-', -1) AS UNSIGNED)), 0) + 1 AS n
  FROM employees WHERE employeeCode LIKE :like AND companyId = :companyId
```
`{ replacements: { like: `EMP-${year}-%`, companyId: TenantContext.requireCompanyId() }, transaction }`

**Verdict on tenancy: CONFIRMED SCOPED.** Single table, explicit predicate, `like` bound as a value
(the `${year}` interpolation is into the **replacement value**, never into SQL text). ✔

> ⚠️ **But this correct scoping creates a cross-tenant collision — see Finding F-1 below.** Making the
> MAX per-company while `employees.employeeCode` retains a **global** `UNIQUE` index means company B's
> first employee is assigned a code company A already owns. This is a defect *introduced by* the
> Phase 2 remediation, not one it inherited.

*Also noted (non-raw, same file):* every ORM path in this service correctly binds
`companyId: TenantContext.requireCompanyId()` explicitly on `CompanyMember`/`CompanyParty` lookups
(lines 73, 103, 112, 234–235, 313) rather than leaning on the hook alone — good practice, since these
are the tables the hook scopes but whose `identityId` comes from a caller-supplied user id.

---

## 4. `src/services/job-work-party-portal.service.ts` — 2 sites

### 4.1 `job-work-party-portal.service.ts:93` — dispatch aggregate

```sql
SELECT id, jobWorkOrderId, operationId, quantity, qtyOk, qtyRejected, qtyRework,
       reworkToOperationId, status, mode
  FROM job_work_dispatches
 WHERE jobWorkOrderId IN (:orderIds) AND companyId = :companyId
```

**Verdict: CONFIRMED SCOPED** — and additionally **confirmed vendor-identity-safe**.

- `companyId` from `TenantContext.requireCompanyId()` (line 91), bound. ✔
- `orderIds` come from `list()`'s own `paginateNew(JobWorkOrder, dto, { where: { partyUserId: userId } })`
  — ORM, so the tenant hook already scoped it — **and** the raw query re-asserts `companyId` rather
  than trusting that chain. Belt and braces; correct. ✔
- **Column projection audited against FR-51:** the SELECT list names 10 columns explicitly. It does
  **not** read `vendorUserId`, `machineId`, `rate`, `estimatedCost`, `actualCost`, `assignedUserId`
  or any name column. The bytes genuinely never leave MySQL, as the file header claims. ✔
- `mode` is the only field that even hints at outsourcing, and it is consumed solely by
  `describePartyLocation()` (`job-work-flow.const.ts:389`), which I read: it buckets to the literal
  strings `'with us'` / `'with our job worker'` and joins quantities. **No vendor or machine name can
  reach the response through this path.** ✔

### 4.2 `job-work-party-portal.service.ts:100` — operation aggregate

```sql
SELECT id, jobWorkOrderId, sequence, status FROM job_work_operations
 WHERE jobWorkOrderId IN (:orderIds) AND companyId = :companyId ORDER BY sequence ASC
```

**Verdict: CONFIRMED SCOPED.** Same evidence as 4.1. Projection is 4 non-sensitive columns.

### 4.3 ⚠️ FINDING — money-inference oracle on the party portal (non-raw-SQL, but in scope per the brief)

The brief asked me to flag internal-field leakage here "even if it's arguably a different bug class."
This is one, and it is concrete and reachable.

`list()` (line 63) passes the caller's `PaginationListDto` **straight** into `paginateNew`:

```ts
async list(userId: number, dto: PaginationListDto) {
  const page = await this.commonDataService.paginateNew(JobWorkOrder, dto, {
    where: { partyUserId: userId }, order: [...] });
```

`CommonDataService.applyFieldFilter` (`common-data.service.ts:306`) and `applySorting` (:265) accept
**any attribute the model declares** — there is no allow-list. `checkDataTypeAndFilterType` (:420)
accepts `DECIMAL` for `type: 'numeric'`. `JobWorkOrder` declares the money columns `rate` (:115),
`totalValue` (:118), `materialValue` (:129) and `ownMaterialCost` (:132) — every one of which is in
`JOB_WORK_MONEY_KEYS` (`job-work-costing-visibility.const.ts:23-38`) and is therefore **stripped from
the response body** by `@ScrubJobWorkMoney()` on `PartyPortalController.jobWorkList` (:59-63).

`JobWorkBoardService` guards exactly this with `assertNoMoneySortOrFilter()`
(`job-work-board.service.ts:341`), which **refuses** (403) a money-named sort/filter for any caller
without `job-work-costing`, and its own comment explains why silently ignoring it is wrong.
**`JobWorkPartyPortalService.list` applies no equivalent check** — and a trading party by definition
never holds `job-work-costing`.

**Concrete exploit** (single company, so not a tenancy break — an FR-51 confidentiality break):

```http
POST /party-portal/job-work/list
{ "page":1, "pageSize":1,
  "filters": { "ownMaterialCost": [ {"type":"numeric","value":1000,"matchMode":"gte","operator":"and"} ] } }
```

The response body has `ownMaterialCost` scrubbed, but `totalItems` is not — so the party binary-searches
`value` and recovers our internal own-material cost per order to the rupee. Same for `rate` and
`totalValue`. `sort: [{"field":"rate","order":-1}]` additionally discloses the full rate ordering of
their orders directly. The interceptor is doing its job on the response; the *query parameters* are
the unguarded channel.

**Verdict: CONFIRMED LEAK (intra-company / FR-51 violation, not cross-tenant).**
**Fix:** call the same `assertNoMoneySortOrFilter(dto, false)` (or hoist it to a shared helper) at the
top of `JobWorkPartyPortalService.list`.

---

## 5. `src/services/users-dashboard.service.ts` — 9 sites

All nine share one join fragment (line 39):

```ts
private readonly MEMBERSHIP_JOIN =
  `JOIN company_members cm ON cm.identityId = u.id AND cm.companyId = :companyId`;
```

`companyId` is taken once from `TenantContext.requireCompanyId()` (line 45) and threaded into every
call's `replacements`. This is the right pattern for scoping a **global** table (`users`) — the
`INNER JOIN` to a company-filtered `company_members` is what bounds the population, and `users`
correctly has no `companyId` of its own.

| # | Line | Query | Verdict |
|---|------|-------|---------|
| 5.1 | 49 | identity KPI roll-up (`totals`) | **CONFIRMED SCOPED** |
| 5.2 | 66 | deleted-user count | **CONFIRMED SCOPED** |
| 5.3 | 74 | `byRole` split | **SUSPECT** (see 5.10) |
| 5.4 | 86 | `byKind` split | **CONFIRMED SCOPED** |
| 5.5 | 93 | `byStatus` split | **CONFIRMED SCOPED** |
| 5.6 | 102 | 12-month registration trend | **CONFIRMED SCOPED** |
| 5.7 | 115 | period KPIs (`inPeriod`) | **CONFIRMED SCOPED** |
| 5.8 | 125 | `recentUsers` (LIMIT 15) | **SUSPECT** (see 5.10) |
| 5.9 | 135 | `recentLogins` (LIMIT 15) | **SUSPECT** (see 5.10) |

Evidence common to all nine:

- `INNER JOIN` (not `LEFT`) on `company_members` — a `LEFT JOIN` here would have produced
  every identity in the database with NULL membership columns. It is correctly an inner join. ✔
- **GROUP BY ordering checked on 5.3–5.7:** the `cm.companyId` predicate lives in the `ON` clause of
  an inner join, i.e. it is applied during join evaluation, strictly before `GROUP BY`. No
  cross-company pre-aggregation. ✔
- **LIMIT nesting checked on 5.8/5.9:** both are single-level statements — `WHERE`, `ORDER BY`,
  `LIMIT 15` all at the same level, with the scope predicate in the join `ON` of that same level.
  There is no inner/outer split for the predicate to land on the wrong side of. ✔
- Interpolated values (`${UserKind.Staff}`, `${UserStatus.Active}`, `${this.MEMBERSHIP_JOIN}`) are
  TypeScript compile-time constants — no injection vector. ✔
- 5.9 `recentLogins` passes `repl` (`{from,to,companyId}`) although its SQL references neither `:from`
  nor `:to`. Harmless (Sequelize errors on *missing*, not surplus, replacements). Cosmetic only.

### 5.10 ⚠️ SUSPECT — `LEFT JOIN roles r ON r.id = cm.roleId` carries no `companyId` (lines 80, 128, 138)

`roles` **is** a tenant-scoped table — `src/entities/roles.entity.ts:13` declares `companyId`, and the
baseline schema gives it a per-company FK. Yet all three joins to it are unscoped:

```sql
FROM users u JOIN company_members cm ON cm.identityId = u.id AND cm.companyId = :companyId
     LEFT JOIN roles r ON r.id = cm.roleId
```

The join is transitively scoped **only** by the invariant *"`company_members.roleId` always names a
role belonging to `company_members.companyId`."* **I could not verify that invariant — nothing
enforces it:**

- `UsersService.create` (`users.service.ts:100-116`) destructures `roleId` off the DTO and writes it
  onto `CompanyMember.create({ companyId: this.resolveCompanyId(), ..., roleId, ... })` with **no
  check that the role belongs to that company**. `UsersService.update` (:212, `patch.roleId = roleId`)
  does the same.
- There is no composite FK `(companyId, roleId)` on `company_members` — only a plain FK to `roles.id`.
- The tenant-scoping hooks cannot help: they scope *reads of* `Role`, not the *value written into*
  `CompanyMember.roleId`.

**Concrete scenario:** an authenticated **admin of company A** creates or edits a user with
`{"roleId": <a role id belonging to company B>}`. The membership row is accepted. Company A's Users
dashboard then renders company B's role **name** in `byRole`, `recentUsers` and `recentLogins`,
because these raw queries resolve the name through the unscoped `roles` join. Note the ORM path does
*not* do this — `UsersService.attachMembership` uses `Role.findByPk(roleId)`, which the hook scopes, so
it returns `null`. The raw SQL here is strictly more permissive than the ORM equivalent, which is
precisely the divergence this review exists to catch.

**Severity:** low as a data leak (a role name, and it requires a deliberate malformed write by a
privileged user), but it is a real unscoped join on a scoped table and the fix is one clause:
`LEFT JOIN roles r ON r.id = cm.roleId AND r.companyId = :companyId`.

**Escalation, out of scope but found on the way:** the same unvalidated `roleId` write is a bigger
question than the dashboard. Whoever owns Phase 2 should confirm `RoleMenuGuard` fails **closed** when
a membership names a foreign role (I expect it does — `role_menu_permissions` is scoped, so the
permission map would come back empty — but it should be asserted, not assumed). Worth an isolation
(IS-case) test either way.

---

## 6. `src/services/trx-account.service.ts` — 1 site

### 6.1 `trx-account.service.ts:56` — `nextCode()`

```sql
SELECT COALESCE(MAX(CAST(SUBSTRING(code, 5) AS UNSIGNED)), 0) AS maxNum
  FROM trx_accounts WHERE code LIKE 'ACC-%' AND companyId = :companyId
```

**Verdict on tenancy: CONFIRMED SCOPED.** Single table, explicit bound predicate, `'ACC-%'` is a
literal. ✔

> ⚠️ **Same collision class as 3.1 — see Finding F-1.** `trx_accounts.code` carries a **global**
> `UNIQUE KEY uq_trx_accounts_code (code)`.

*Non-tenancy note:* this is a `MAX`-scan sequence with no `FOR UPDATE`, inside the caller's
transaction. The codebase's own doctrine (`JobWorkNumberService`, `CLAUDE.md` §15) calls this pattern
racy and says not to copy it. The unique index is the backstop, so a concurrent clash surfaces as an
error rather than a duplicate code — acceptable, but now interacts badly with F-1.

*Also checked (non-raw, same file):* `assertNameUnique` (:50), `freeGroupName` (:71, note
`paranoid: false` — the `beforeFind` hook still applies, so it stays scoped) and `createBackingGroup`
(:84) all go through the ORM and are hook-scoped. `getFundsSummary` (:168) is ORM. ✔

---

## 7. Findings that cross file boundaries

### F-1 — 🔴 Per-company sequences writing into globally-UNIQUE columns (2 of the 6 files)

Both `nextEmployeeCode()` (`user-profile.service.ts:289`) and `nextCode()`
(`trx-account.service.ts:56`) were correctly remediated to compute `MAX(...)` **per company** — but
the columns they feed are still **globally** unique in the schema
(`src/migrations/00000000000000-initial-schema.ts`):

```
employees:     UNIQUE KEY `employeeCode` (`employeeCode`)
trx_accounts:  UNIQUE KEY `uq_trx_accounts_code` (`code`)
```

**Concrete two-company scenario:** company A creates employees `EMP-2026-0001`, `EMP-2026-0002`.
Company B then creates its *first* employee. Its per-company `MAX` is 0, so `nextEmployeeCode()`
returns `EMP-2026-0001` → `INSERT` violates the global unique key → `SequelizeUniqueConstraintError`,
which `CustomExceptionFilter` renders as the generic **400 "Invalid request parameters"** (exactly the
misleading surface `CLAUDE.md` §7 warns about). It is not transient: every retry recomputes the same
colliding code, so **company B can never onboard an employee** until the codes happen to diverge —
which they cannot, because no row can be inserted. Identical logic for `ACC-0001` on financial accounts.

This is not a leak; it is a hard cross-tenant coupling **introduced by the scoping fix itself**, and it
will only surface the day a second company exists — i.e. it is invisible on this single-company dev box
and will fail on the first real multi-tenant install.

**Fix:** widen both unique keys to `(companyId, code)` / `(companyId, employeeCode)` in the baseline
schema, in the same change as the per-company `MAX`. Then audit the other sequence columns
(`job_work_sequences`, `conversionNo`, `invoiceNo`, `hr_sequences`) for the same pattern.

### F-2 — 🔴 The CI guard's regex misses two real raw-SQL call shapes (guard blind spot)

`RAW_SQL_CALL = /\bsequelize\s*\.\s*query\s*(?:<[^>]*>)?\s*\(/` (`raw-sql-guard.const.ts:36`) requires
the identifier `sequelize` **immediately** before `.query(`. Its own doc comment (line 26) claims it
matches `tx.query(`; **it does not**. Two shapes used in this repo evade it entirely:

1. **`Model.sequelize!.query(...)`** — the `!` non-null assertion breaks `\s*\.\s*`.
2. **A private `this.query(...)` wrapper** around `sequelize.query`.

I ran a repo-wide sweep for these while establishing what "the guard proves" means. All 19 sites in my
6 assigned files use the matched form, so **my batch is unaffected** — but the sweep turned up
guard-invisible sites elsewhere, and one of them is a live cross-tenant leak. Reporting for triage;
**I did not audit these files** (out of assignment):

- 🔴 **`src/services/job-work-masters.service.ts:560` — `holdingsFor()` — CONFIRMED LEAK.**
  ```sql
  SELECT vendorUserId, COUNT(*) AS n FROM job_work_dispatches
   WHERE vendorUserId IN (:vendorIds) AND status IN ('sent','at-vendor','partially-received')
   GROUP BY vendorUserId
  ```
  **No `companyId` anywhere**, on a scoped table, and the guard never sees the statement
  (`JobWorkDispatch.sequelize!.query<...>`). `vendorIds` come from `paginateNew(User, ...)` — `User`
  being a *global* table scoped only through its `membership` include — so the ids are identities, and
  **identities are shared across companies by design** post-Phase-1. Scenario: vendor "Shreeji VMC" is
  a party of both company A and company B. Company A opens the vendor picker; the `lotsHeld` figure it
  shows includes company B's live dispatches to that vendor. Company A learns a volume signal about
  another tenant's shop floor. Needs `AND companyId = :companyId`.
- 🟡 **`src/services/chat.service.ts:303` — `unreadByConversation()` — SUSPECT.** No `companyId` on
  `chat_messages`/`chat_participants` (both scoped tables); appears transitively bounded by
  `p.userId = :userId` and by `conversationIds` sourced upstream, but the chain needs its own review.
  Also guard-invisible (`ChatMessage.sequelize!.query`).
- 🟡 **`src/services/voucher-reference.service.ts` — 11 sites** (lines 82, 93, 103, 109, 113, 203, 243,
  254, 262, 265) all behind a private `this.query(...)` wrapper. **Every one is invisible to the CI
  guard.** This service is what decides whether a voucher can be cancelled or deleted, so an unscoped
  read here would be both a leak and a correctness hazard. Recommend assigning it as a batch.

**Fix the guard:** relax to `/\.\s*query\s*(?:<[^>]*>)?\s*\(/` with a small exempt-identifier list
(`req`, `request`), *or* better, invert it — flag any `.query(` whose span lacks `companyId` — and add
a lint rule banning private raw-SQL wrappers that hide the call shape.

### F-3 — 🟡 The guard's "companyId appears in the span" test passes on all 19 of my sites *for the right reason* — but that is luck, not proof

Confirming the brief's premise from the other direction: I checked whether any of my 19 sites would
pass the guard while being wrong. None do — every one references `:companyId` in an actual `WHERE`/`ON`
predicate, not merely in `replacements` or a comment. **But note the two nearest misses**, which show
how thin the margin is: `users-dashboard.service.ts` sites 5.1–5.9 mention `companyId` in the span only
via the interpolated `${this.MEMBERSHIP_JOIN}` variable *and* the `replacements` object — the guard
cannot see whether the fragment actually contains a predicate, so had `MEMBERSHIP_JOIN` ever been
edited to drop `AND cm.companyId = :companyId`, **all nine queries would still pass CI** while
returning every company's users. (Sequelize's missing-replacement error would catch it at runtime, but
CI would be green.) Likewise the unscoped `roles` join (5.10) is entirely invisible to a
statement-level substring test.

### F-4 — 🟢 Schema note: the `defaultValue: 1` bridge is gone from the entities but not from the DB

`CREATE TABLE trx_accounts` (and `employees`, and every other scoped table I read) still carries
`` `companyId` int NOT NULL DEFAULT '1' `` in the baseline schema, even though `CLAUDE.md` §7 records
that the bridge default was removed from all 109 entities. The ORM path is safe (the `beforeValidate`
hook stamps the real value), but **any raw `INSERT`, migration or seeder that omits `companyId`
silently lands the row in company 1**. None of my 6 files perform a raw INSERT, so this is
informational — but it should be dropped from the schema before a second company exists, or it is a
silent mis-attribution waiting to happen.

---

## 8. Summary table

| File | Raw sites | Confirmed scoped | Confirmed leak | Suspect |
|---|---:|---:|---:|---:|
| `src/services/job-work-challan.service.ts` | 1 | 1 | 0 | 0 |
| `src/services/trx.service.ts` | 5 | 5 | 0 | 0 |
| `src/services/user-profile.service.ts` | 1 | 1 | 0 | 0 |
| `src/services/job-work-party-portal.service.ts` | 2 | 2 | 0 | 0 |
| `src/services/users-dashboard.service.ts` | 9 | 6 | 0 | 3 |
| `src/services/trx-account.service.ts` | 1 | 1 | 0 | 0 |
| **Total (raw-SQL sites)** | **19** | **16** | **0** | **3** |

Plus, outside the raw-SQL site count, in the assigned files: **1 confirmed leak** (F/4.3, intra-company
money oracle on the party portal) and **1 confirmed cross-tenant defect** (F-1, colliding sequences).

## 9. Triage list

### CONFIRMED LEAK

1. **`job-work-party-portal.service.ts:63` (`list`)** — party-controllable `sort`/`filters` reach
   `job_work_orders.rate` / `totalValue` / `materialValue` / `ownMaterialCost`, giving a trading party a
   binary-search oracle over money the `@ScrubJobWorkMoney()` interceptor removes from the body.
   Violates FR-51. Fix: apply `JobWorkBoardService.assertNoMoneySortOrFilter(dto, false)`.
2. **F-1 — `user-profile.service.ts:289` + `trx-account.service.ts:56`** — per-company `MAX` sequences
   feeding globally-`UNIQUE` `employees.employeeCode` / `trx_accounts.code`. Second company cannot
   create employees or financial accounts. Fix: composite unique `(companyId, <code>)`.
3. **F-2 — `job-work-masters.service.ts:560` (`holdingsFor`)** *(outside my 6 files; found via the
   guard-gap sweep)* — fully unscoped `SELECT ... FROM job_work_dispatches`, invisible to CI, leaks
   another tenant's live dispatch counts for any shared vendor identity.

### SUSPECT / NEEDS HUMAN JUDGMENT

4. **`users-dashboard.service.ts:80, :128, :138`** — `LEFT JOIN roles r ON r.id = cm.roleId` with no
   `r.companyId`. Relies on an unenforced invariant; `UsersService.create/update` writes an
   unvalidated `roleId` onto `company_members`. Fix the join; separately decide whether to validate
   `roleId` at the write.
5. **F-2 — `chat.service.ts:303`** *(outside my 6 files)* — unscoped raw query on `chat_messages` /
   `chat_participants`, guard-invisible; transitive chain unverified.
6. **F-2 — `voucher-reference.service.ts` × 11 sites** *(outside my 6 files)* — entirely invisible to
   the CI guard behind a private `this.query()` wrapper; unreviewed. Recommend assigning as a batch.

### HARDENING (no leak found, cheap to close)

7. `trx.service.ts:495, :523` — add `AND g.companyId = :companyId` to the `trx_groups` join.
8. `job-work-challan.service.ts:819` — add `AND o.companyId = :companyId` for symmetry with `o2`.
9. Fix `RAW_SQL_CALL` in `raw-sql-guard.const.ts:36` to match `Model.sequelize!.query(` and ban
   private raw-SQL wrappers (F-2).
10. Drop the `companyId ... DEFAULT '1'` column default from the baseline schema (F-4).

## 10. Bottom line on the claim under review

For these 6 files the "all raw-SQL sites remediated" claim is **substantially true**: 16 of 19 sites
are correctly and defensibly scoped, every one sources `companyId` from the verified `TenantContext`,
and none interpolates a user-controlled value into SQL. The remediation was done thoughtfully — the
correlated subquery in `job-work-challan.service.ts` and the `OR`-group parenthesisation in
`trx.service.ts:399` are both the subtle cases done right.

What the claim does **not** cover, and what a green CI guard actively obscures: unscoped **joins** to
scoped tables inside otherwise-scoped statements (item 4), the entire class of call sites the guard's
regex cannot see (items 3, 5, 6), non-SQL parameter channels that reach scoped/sensitive columns
(item 1), and schema-level tenancy assumptions the SQL fix depends on (item 2). Items 2 and 3 are the
two I would not ship a second company without.
