# Jayhind ERP — AI Working Guide

Orientation for any AI (or human) making changes in this repo. Read the sections
relevant to what you're touching **before** editing; the invariants here are the
ones that, if broken, cause silent cross-tenant data leaks, permission bypasses,
or corrupted books.

**Golden rule of this codebase:** the source files carry unusually detailed doc
comments explaining *why* a thing is the way it is, often naming the exact bug
that motivated it. When a comment says "deliberately", "⚠️", "do not resurrect",
or "keep the two in sync" — believe it and read the whole comment before
changing that line. This file is the map; the comments are the territory.

---

## 1. What this is

A multi-tenant, GST-compliant ERP for the Indian market, split into a licensing
control plane ("Master Hub") and a client-facing ERP, each with its own Angular
frontend, plus a local invoice-OCR sidecar.

This repo (`jayhind/`) is **orchestration only** — this guide, `README.md`,
`dev.sh`. All application code lives in six git submodules, each an independent
repo pinned to a commit here (`.gitmodules`).

| Directory | Role | Stack | Port | Database |
|---|---|---|---|---|
| [jayhind-admin-back/](jayhind-admin-back/) | **Master Hub API** — licensing, subscriptions/billing, GSP gateway (e-Way Bill / e-Invoice), OCR proxy + archive, HSN/SAC master, file storage, support desk | NestJS 11 + Sequelize 6 | 3100 | `master_hub` (+ read/write on `jayhind_client`) |
| [jayhind-client-back/](jayhind-client-back/) | **Client ERP API** — accounting, inventory, HR, GST documents, job work, invoice scanning, chat, imports | NestJS 11 + Sequelize 6 | 3000 | `jayhind_client` |
| [jayhind-admin-front/](jayhind-admin-front/) | Hub admin console | Angular 21 (standalone, zoneless, signals) + Material | 4500 | — |
| [jayhindi-client-front/](jayhindi-client-front/) | Client ERP web app (PWA) | Angular 21 (standalone, zoneless, signals) + Material | 4300 | — |
| [jayhind-ocr-service/](jayhind-ocr-service/) | Invoice OCR + extraction sidecar, fully offline CPU | FastAPI + RapidOCR (ONNX) + Qwen3-8B (llama.cpp) | 8100 | — |
| [qa-artifacts/](qa-artifacts/) | E2E / UI QA harnesses and fixtures | Node + Playwright | — | — |

> ⚠️ The client frontend's **directory** is `jayhindi-client-front` (extra "i")
> while its repo/package is `jayhind-client-front`. Other services' CORS and
> `dev.sh` expect the directory spelling. Don't "fix" it.

Everything runs natively — **no Docker anywhere**. Branches in every repo:
`main` = development, `production` = production.

### Service topology

```
        ┌──────────────────┐              ┌───────────────────┐
        │ jayhind-admin-   │  4500        │ jayhindi-client-  │  4300
        │ front (console)  │              │ front (ERP app)   │
        └────────┬─────────┘              └─────────┬─────────┘
                 │ JWT                              │ JWT
                 ▼                                  ▼
        ┌──────────────────┐   INTERNAL_    ┌───────────────────┐
        │ jayhind-admin-   │◄──SERVICE_────►│ jayhind-client-   │
        │ back  (Hub) 3100 │    KEY         │ back  (ERP)  3000 │
        └───┬──────────┬───┘  (both ways)   └─────────┬─────────┘
            │          │                              │
   master_hub DB   ┌───▼──────────┐            jayhind_client DB
            └─────►│ CLIENT_      │◄───────────────────┘
                   │ SEQUELIZE    │ (hub's 2nd connection, read/write
                   └──────────────┘  on `companies` only)
            │
            ├──► GST portals / NIC e-Way Bill / IRP e-Invoice  (GSP)
            └──► jayhind-ocr-service :8100 (loopback)
```

**The client backend never calls a government API or the OCR sidecar directly.**
All external integration credentials live only in the hub; the ERP goes through
it. That separation is the reason the hub is a separate process at all.

---

## 2. Running the stack

```bash
./dev.sh                          # start everything that's set up, foreground
./dev.sh start admin-back client-back
./dev.sh start -d                 # detached
./dev.sh status                   # what's set up / running / listening
./dev.sh logs client-back         # tail one service
./dev.sh stop
```

Project names: `admin-back client-back admin-front client-front ocr`.
Logs land in `.dev-logs/`, PIDs in `.dev-pids/` (both gitignored).
Each project can still be run its own way (`npm start`, or `./scripts/serve.sh`
for OCR). Prerequisites: Node ≥ 24, MySQL 8, Redis (optional — queues degrade to
in-process), Python 3.12 (OCR only).

A typical full-stack session needs only `admin-back client-back admin-front
client-front`. Skip OCR unless working on OCR — it loads Qwen3-8B on CPU.

Per-service setup (migrations, seeders, `.env`) is in [README.md](README.md#per-project-setup).

### Commands you'll actually use

| Task | admin-back / client-back | admin-front / client-front | ocr |
|---|---|---|---|
| Run | `npm start` | `npm start` | `./scripts/serve.sh` |
| Build | `npm run build` | `npm run build` | — |
| Lint (fix) | `npm run lint` | `npm run lint` | `ruff check --fix .` |
| Lint (CI) | `npm run lint:ci` | `npm run lint:ci` | `ruff check .` |
| Unit tests | `npm test` (Jest) | `npm test` (Karma, client only) | `pytest` |
| Migrate | `npm run migrate` | — | — |
| Seed | `npm run seed:all` | — | — |
| New migration | `npm run migration:create <name>` | — | — |

`client-front`'s `lint` also runs `scripts/breakpoint-guard.js` (see §9).

From **this** repo (the only place that sees every submodule at once):

```bash
node scripts/check-mirrors.js     # cross-repo constant drift, data AND behaviour
```

It compares the mirrored **constants** as data, and the mirrored
`voucher-lifecycle` **rules** as behaviour — running both implementations against
`scripts/vectors/voucher-lifecycle.vectors.json`, one shared table living here
rather than copied into each submodule. Add vectors in the same commit as a rule.
It needs esbuild from one submodule's `node_modules` (any of them) and **fails
rather than falling back** to the old name-only check, because a mirror rule that
cannot fail reads as coverage.

Once the backends are up, their OpenAPI is at `http://localhost:3000/api/docs`
and `http://localhost:3100/api/docs` (schema JSON at `…/api/docs-json`).

---

## 3. `.env` and the shared secret

Both backends read `.env` (never committed; `.env.example` is the template).

**`INTERNAL_SERVICE_KEY` must be byte-identical in
`jayhind-admin-back/.env` and `jayhind-client-back/.env`.** It authenticates
every call *in both directions* between the two servers. Generate once with
`openssl rand -hex 64`. If it's missing or mismatched, internal calls **fail
closed with a clear error** (never a silent no-op) — including the hub's
"Create company" action, which asks the ERP to provision the company.

Both backends **fail to boot** on a missing/placeholder `JWT_SECRET`
(`main.ts`). `client-back` additionally fails boot if `PUSH_ENABLED=true` with
missing VAPID keys.

Notable keys:

| Key | Where | Notes |
|---|---|---|
| `INTERNAL_SERVICE_KEY` | both backs | shared secret, both directions, fails closed |
| `JWT_SECRET` | both backs | boot-time validated; separate per service |
| `MASTER_URL` | client-back | where the hub is (`http://localhost:3100`) |
| `CLIENT_API_URL` | admin-back | where the ERP is — **must be set on multi-host deploys** |
| `CLIENT_DB_NAME` | admin-back | the ERP's DB, for the hub's second connection |
| `ALLOWED_ORIGINS` | both backs | CSP + CORS list |
| `ALLOW_LOCALHOST_ORIGINS` | client-back | defaults on except under `NODE_ENV=production` |
| `OCR_SERVICE_URL` / `_KEY` / `_TIMEOUT_MS` | admin-back | the OCR sidecar |
| `AUDIT_QUEUE_ENABLED`, `INVOICE_SCAN_QUEUE_ENABLED` | client-back | BullMQ/Redis; both degrade gracefully — **and the degradation is a 2s deadline, not a rejection** (§4.10, BUG-0062): ioredis buffers a command issued while Redis is down and retries it for ever, so an unbounded `await queue.add(...)` is a hang rather than a fallback |
| `STORAGE_DRIVER`, `UPLOAD_ROOT` | both backs | file storage |
| `API_DOCS_ENABLED`, `API_DOCS_PATH` | both backs | OpenAPI/Swagger; **off by default under `NODE_ENV=production`** |

> ⚠️ **Rotate the OCR service key.** `admin-back/.env.example` previously
> committed a real-looking `OCR_SERVICE_KEY` and a live Cloudflare-tunnel
> `OCR_SERVICE_URL`. Both are now placeholders, but the old value remains in git
> history, so treat it as disclosed and issue a new one.

---

## 4. Backend architecture — `jayhind-client-back` (the big one)

~700 TS files. **Read this section before touching anything here.**

### 4.1 Layout

```
src/
├── main.ts               bootstrap: helmet+CSP, compression, CORS, ValidationPipe,
│                         global exception filter, socket adapter, shutdown hooks
├── app.module.ts         COMPOSITION ONLY — guard chain, interceptors, middleware
├── modules/<domain>/     thin feature modules that register controllers+services
├── controllers/          flat, one file per resource (+ controllers/internal/)
├── services/             flat, one file per concern (~140 files)
├── entities/             Sequelize models (~125)
├── dto/                  class-validator DTOs
├── guards/ decorators/ interceptors/ middleware/
├── const/                domain rules as PURE functions + `.spec.ts` beside them
├── database/             connection providers + tenant-scoping hooks
├── migrations/ seeders/
├── socket/               Socket.IO gateway
└── utility/              ApiException, BaseCrudService, exception filter, TenantContext
```

**Where a new controller/service goes:** register it in its feature module under
`src/modules/<domain>/`, **not** in `app.module.ts`. The only exception is a
genuinely global provider, which belongs in `SharedModule` (`@Global`, and it
re-exports `DatabaseModule` so the `SEQUELIZE` token stays injectable app-wide).

### 4.2 The request pipeline — order matters

```
TenantContextMiddleware   opens an EMPTY AsyncLocalStorage store for every request
CorrelationMiddleware     requestId / sessionId
        ↓
ThrottlerGuard            rate limit before any work — two dimensions:
                          'default' 100/min per IP, 'company' per companyId
AuthGuard                 verifies JWT → request.user   (skipped on @Public())
TenantContextGuard        re-verifies companyId against a LIVE company_members row,
                          then TenantContext.populate({companyId, licence, …})
RolesGuard                coarse @Roles() check
ModuleLicenceGuard        is this company licensed for this module?
BillingRestrictionGuard   read-only grace: refuses non-GET/HEAD/OPTIONS
        ↓
AuditInterceptor          writes an audit row for @Audit()-tagged handlers
CompanyConcurrencyInterceptor
        ↓
ValidationPipe            whitelist + forbidNonWhitelisted + transform
        ↓
controller → service → Sequelize (tenant-scoping hooks fire here)
        ↓
CustomExceptionFilter     maps Sequelize errors to 4xx, audits failures
```

`RoleMenuGuard` (fine-grained permissions) is **opt-in per controller** via
`@UseGuards(RoleMenuGuard)` — it is *not* in the global chain.

### 4.3 Multi-tenancy — the single most dangerous thing to get wrong

Three layers, all in play at once:

**Layer 1 — `TenantContext`** (`src/utility/tenant-context.ts`)
A module-level singleton wrapping `AsyncLocalStorage`. **Deliberately not a
NestJS request-scoped provider** — that would force ~128 services request-scoped,
and Sequelize hooks registered at bootstrap aren't in the DI graph at all.

- `TenantContextMiddleware` opens an empty store on **every** request.
- `TenantContextGuard` fills the *same object* in place via `populate()` once
  `request.user` exists, carrying `companyId`, `membershipId`,
  `membershipVersion`, `identityId`, `userKind`, `licence`, `billingRestricted`.
- `licence` and `billingRestricted` ride along **because the `companies` row is
  already loaded** — so a licence/billing change made in the hub console is live
  on the very next request, with no cache TTL to wait out.

**Layer 2 — Sequelize connection-level hooks**
(`src/database/tenant-scoping.hooks.ts`, registered once in `database.providers.ts`)

Hooks on `beforeFind`, `beforeCount`, `beforeValidate`, `beforeCreate`,
`beforeBulkCreate`, `beforeUpdate`, `beforeBulkUpdate`, `beforeDestroy`,
`beforeBulkDestroy`, `beforeUpsert`. A model is "scoped" if its `rawAttributes`
actually declare a `companyId` column — asked of the ORM, so it can never drift
from the schema.

- Reads get `companyId` AND-composed into `where`; nested `include` trees are
  recursively scoped too (that's the only thing scoping a scoped child of an
  unscoped parent, e.g. `User.findOne({ include: 'membership' })`).
- Writes are stamped with the active `companyId`; a **mismatched** explicit
  `companyId` is refused, never silently overwritten.
- No active context + no `crossCompany` = hard `TenantIsolationViolation`.

**Layer 3 — registries + CI guards** (`src/const/tenant-scope-registry.const.ts`,
`src/const/ci-guards/`). A new entity that isn't classified is a failing test.

> **`user_details` is company-scoped** (migration
> `20260820000000-user-details-company-scope`, 2026-08-20). The party master —
> address, GSTIN, PAN — is one row per (company, identity), because the same
> real supplier legitimately trades with several of our customers and each
> holds their own copy. GSTIN uniqueness is `UNIQUE(companyId, gstNo)`, **never
> global**; the old global unique is what produced "A record with this gstNo
> already exists" when a second company registered a party the first already
> had. Adding the column is also the only thing that put the table under the
> hooks at all (they key off `rawAttributes.companyId`), so removing it would
> silently un-scope every read and write of the party master.

`company_parties` still owns the per-company **balances**; the two tables now
agree on grain. D-02's full split (moving every reader onto `company_parties`)
remains unfinished, but the isolation gap it was meant to close is shut.

#### Rules you must follow

1. **Never** add `{ crossCompany: true }` to make an error go away. It is legal in
   exactly two situations: (a) the query that *establishes* tenant context
   (`TenantContextGuard`), and (b) genuinely company-agnostic reads. Every use
   needs a comment saying why — and the comment should name **the caller**, not
   the query, because that is where the safety actually lives. Whether the flag
   is safe depends entirely on where the id came from: off a membership the guard
   has already verified, or typed into a URL by whoever made the request.
   > ⚠️ The dangerous shape is a **shared private reader** with `crossCompany`
   > inside it. `role-permission.service.ts` had one, correctly justified for the
   > guard (its `roleId` comes from a verified membership, and it may run with no
   > context at all). A second caller then reused it from
   > `GET /role-permissions/:roleId`, where the id is caller-supplied — and any
   > company could read any other's role permission matrix, while the comment
   > went on being true. Nothing at the call site says the hooks are off. When a
   > route takes an id and the read underneath it is cross-company, look up the
   > owning row through the **scoped** model first and 404 on a miss; that is
   > what the matching write path was already doing, which is why only the read
   > was exposed.
2. Code that runs **outside an HTTP request** — cron ticks, queue workers,
   seeders, `scripts/*.ts` — has **no store**. It must wrap work in
   `TenantContext.run({ companyId, … }, fn)` (see `due-reminder.service.ts`,
   `job-work-alerts.service.ts`, `maintenance.service.ts`) or pass
   `crossCompany` explicitly. There is no third option.
3. **Raw SQL is not covered by the hooks.** Every `sequelize.query(...)` must
   carry an explicit `companyId` bind — `TenantContext.requireCompanyId()`
   threaded into `replacements`. `npx ts-node scripts/ci-guard-raw-sql.ts`
   enforces this and judges *new* sites automatically.
   > ⚠️ **The guard used to judge only a STATEMENT, and a statement can scope one
   > table while joining three others unscoped** (BUG-0047; the guard now checks
   > the joins too, and the sweep that added it closed 53 of them). `HrDashboardService`'s
   > four breakdowns bind `companyId` on `employees`/`leave_applications` — so
   > the guard passes — and then `LEFT JOIN departments d ON d.id =
   > e.departmentId` with no predicate at all, likewise `designations`,
   > `employment_types` and `leave_types`. Feed it an `employeeId` satellite
   > belonging to another company (rule 7, unchecked on `EmployeeService`) and
   > **that company's department NAME renders on this one's dashboard**.
   >
   > This is where BUG-0019's consolation stops applying. A rule-7 bug on a
   > company-scoped table is normally *silent*, because the read joins the
   > association through the same hooks and answers `null` — but **raw SQL is
   > not under the hooks**, so the join resolves and answers with a name. So
   > BUG-0022's question (*what does this id point at?*) has a second half:
   > **how is it READ?** The same unchecked id is invisible through Sequelize
   > and a disclosure through `sequelize.query`.
   >
   > `UsersDashboardService` is the one that gets it right and says why —
   > every `roles` join there carries its own `AND r.companyId = :companyId`
   > — and `FinancialDashboardService` scopes all of its. **Scope every joined
   > company-scoped table, not just the driving one.**
4. **Never keep per-company state in a service field.** `@Injectable()` is a
   process singleton; a `private cache = new Map()` means the first company to
   populate an entry decides what every other company reads. If a cache is
   genuinely needed, key it `` `${companyId}:${…}` `` and expect
   `scripts/ci-guard-cached-state.ts` to require an allow-list entry.
   > ⚠️ **A single row is worse than a Map, and the guard used to miss it**
   > (BUG-0036). `PrintConfigurationService` held `private cached:
   > PrintConfiguration | null = null` — no Map, so nothing flagged it — and
   > `print_configurations` is company-scoped. The first company to call
   > `GET /print-config` after a boot decided what every other company read,
   > and that route is the **one shared read a trading party may call** (D-46),
   > so what leaked was a tenant's `bankDetails` to another tenant's customers.
   > The write half was refused by `assertInstanceInScope` — layer 2 doing its
   > job — which turned it into a 500 nobody connected to the read. The guard
   > now also flags a class field whose **name** claims a lifetime (`cache`,
   > `cached`, `memo`, `snapshot`) whatever it holds. **The cheapest correct
   > answer is usually no cache**: one indexed read per request beats being
   > wrong, and it is the only shape that stays right when the row is edited.
5. `where` composition: use `andCompose`-style AND nesting, and count keys with
   `Reflect.ownKeys`, **not** `Object.keys` — an `Op.and`/`Op.or` where (search
   clauses, and Sequelize's own paranoid-delete wrapper) is keyed by a *symbol*,
   and `Object.keys` reports it as empty. That exact mistake once made
   `Model.update({…},{where:{id}})` update every row in the company.
6. When adding a `where` to an `include`, set `required` explicitly if the caller
   didn't. Sequelize silently flips `required: true` when an include carries a
   `where`, turning LEFT JOINs into INNER JOINs and making rows with nullable FKs
   vanish. The hooks already default it to `false`; don't undo that.
   > ⚠️ **That default cuts both ways, and the second direction is the quiet
   > one.** The hooks pin `required: false` on any include the caller left
   > unset — which is right for a read, and wrong for an include whose `where`
   > **is** the filter. Sequelize's own flip is what such a query is relying on;
   > the hook removes it, the predicate lands in the `ON` clause of a LEFT JOIN,
   > and it filters *nothing*. `assertKeepsAnAdmin` counted every active member
   > of the company instead of every active **admin**, so FR-017 never once
   > refused and the Hub could remove a company's last administrator (BUG-0018);
   > `resolveBillingAdminUserId` named whichever member sorted first — usually a
   > trading party — as a subscription invoice's preparer. Neither query was
   > wrong on its face and neither threw. **If an include's `where` decides
   > which rows come back, say `required: true` out loud.**
7. **The hooks scope by `companyId`. They do not scope by *parentage*.** A
   caller-supplied **parent id** — an `employeeId`, a `productId`, a `trxId` off
   the URL or the body — must be checked by the service before anything is
   written against it. Both hooks will behave perfectly while the row you create
   crosses the boundary:

   ```ts
   // GET /leave/balance/:employeeId, with employeeId belonging to ANOTHER company
   await LeaveBalance.findOrCreate({ where: { employeeId, leaveTypeId, year }, defaults: {…} });
   // beforeFind  → AND companyId = <mine>  → correctly finds nothing
   // beforeCreate → stamps  companyId = <mine> → creates a row pointing at THEIR employee
   ```

   That was a **read** writing four rows with a cross-company foreign key, on a
   route that provisions on read. The check is one line and belongs at the
   service's entry point, not in the shared helper underneath it:

   ```ts
   const employee = await Employee.findByPk(employeeId, { attributes: ['id'] });
   if (!employee) throw new ApiException('Employee not found', HttpStatus.NOT_FOUND);
   ```

   `findByPk` runs under the hooks, so "not found" already means "not this
   company's" — the two are the same sentence, and the 404 tells someone poking
   at ids nothing they did not know. Look for this shape wherever a service
   takes a parent id from the caller and a `findOrCreate`, a `create` or an
   `update` follows.

   > ⚠️ **The version that leaks is the easy one. Watch for the version that does
   > not** (BUG-0019). `POST|PUT /products` took **five** satellite ids from the
   > body — `measurementUnitId`, `manufacturerId`, `returnPolicyId`,
   > `productConditionId`, `productWarrantyId` — and checked none of them, and
   > `POST /product-tags` took three more. Nothing leaked, because the read path
   > includes those associations through the same hooks and answers `null`: the
   > only symptom was a product whose unit and manufacturer were **silently
   > blank** on the grid, on the Edit form, on the print preview and on the GST
   > invoice line, with no error anywhere. It also wedges the company hard delete
   > (§6.5) — those columns are `ON DELETE RESTRICT`, so erasing the *other*
   > company is refused by a row in this one. `ProductService
   > .assertSatellitesAreOurs` and `ProductTagsService.assertMappingIsOurs` are
   > the explicit checks; the latter runs **before** the `destroy` that clears the
   > existing mapping, because a guard placed after it wipes the product's tags on
   > the way to the 404.

   > ⚠️ **Which table the foreign key points at decides whether the same bug is
   > invisible or a leak** (BUG-0022). The job-work masters took **seven**
   > caller-supplied ids and checked none — `machines.operationTypeId` and
   > `.vendorUserId`, `vendor_capabilities`' two, and a route template's
   > `items[].operationTypeId` / `.defaultMachineId` / `.defaultVendorUserId` —
   > and `PUT /transaction-config/:trxType` took `defaultPaymentTermsId`. Five of
   > those name a **company-scoped** table and were silent in exactly BUG-0019's
   > way. The three naming **`users.id`** were not: `users` is the global identity
   > table (§4.4) and has **no `companyId` for the hooks to scope by**, so the
   > read resolved the association and answered it — `POST /vendor-capabilities`
   > with a stranger's identity id came back with that person's **name**, making a
   > master's create an enumeration oracle over every identity on the platform. So
   > when you audit a parent id, ask what it points at: a `*UserId` has no hook
   > behind it at all and needs a `CompanyMember` lookup
   > (`assertPartyIsOurs`, and `JobWorkPartySettingsService.assertParty` before
   > it), not a `findByPk`.

   > ⚠️ **It reached the voucher line, which is the busiest write in the product**
   > (BUG-0015). `productItems[].productId` and `productItems[].taxes[].taxId`
   > were both accepted from another company: the row was stamped with the
   > caller's `companyId` while its foreign key pointed into somebody else's
   > catalogue, and on approve stock moved and a price was captured against
   > *their* item. The product half looked guarded and was not — a foreign id
   > missed the tenant-scoped catalogue lookup and the voucher was refused by the
   > **HSN branch**, because the product it could not find had no `hsnCode`. So
   > the refusal depended on the client not sending the optional `hsnCode`, and
   > sending it walked straight through. **A check that exists as a side-effect of
   > an unrelated one is not a check**, and a refusal whose message does not
   > describe the actual problem ("HSN/SAC code missing for: Item #1663") is the
   > tell. `TrxWriteService.assertLineReferencesAreOurs` is the explicit one.

   > ⚠️ **And then it reached the same write's HEADER, where the unchecked id
   > decides which ledger the money lands in** (BUG-0025 — rule 7's sixth, and the
   > first whose symptom is a `journal_lines` row). `trx.groupId`,
   > `charges[].groupId` and a journal voucher's `lines[].trxGroupId` were all
   > accepted from another company and all **posted**: the line carried the
   > caller's `companyId` and the other tenant's `trxGroupId`. BUG-0019's
   > consolation — that a rule-7 bug on a company-scoped table leaks nothing,
   > because the read joins through the same hooks and answers `null` — **does not
   > apply here**, because `ReportsService.trialBalance` and `.profitAndLoss`
   > aggregate on `journal_lines.trxGroupId` and then `JOIN trx_groups g ON g.id =
   > agg.trxGroupId` with no `companyId` predicate: the other tenant's ledger NAME
   > is what this company's own trial balance renders, and their group's
   > `accountNature` decides whether the figure lands in income or in expenses.
   > `TrxWriteService.assertHeaderReferencesAreOurs`,
   > `TrxPaymentReceiptController.assertReferencesAreOurs` and the two account
   > checks at the top of `TrxContraController.saveContra` are the explicit ones.
   >
   > Two of that write's ids were already refused **by accident**, which is the
   > part worth remembering: a foreign `trxAccountId` failed `preApprove`'s funds
   > guard because `trxAccountService.findOne` runs under the hooks, so `!acc` and
   > "not enough money" share a branch — the answer was *"Low Balance To Settle
   > This Voucher"*, the draft stayed in the table with its cross-company FK, and
   > the TO side of a contra was not covered at all. **A check that exists as a
   > side-effect of an unrelated one is not a check.**
   >
   > Two more header ids are safe and deliberately have **no** added check, so
   > don't add one and assume it was missing: `supplierUserId` has
   > `assertSupplierIsCompanyMember` (it names `users.id` — §4.4 — so a `findByPk`
   > would prove nothing), and `supplierUserDetailsId` is *resolved* rather than
   > trusted by `resolveSupplierDetails`, which drops a foreign id and substitutes
   > the party's own row. `preparedByUserId` never reaches the row: the controller
   > overwrites it with the authenticated caller.

   > ⚠️ **The seventh was in the SAME MODULE as the fifth, and that is the part to
   > learn from** (BUG-0032). The job-work *masters* were fixed by BUG-0022; its
   > three ownership checks were written as **module-local functions** in
   > `job-work-masters.service.ts`, and nothing carried them the twenty lines to
   > the module's **transactional** writes. So the order, its inline operations,
   > the dispatch, the split, the challan and the material issue took **nine**
   > caller-supplied ids between them and checked none. Six named `users.id` and
   > `POST /job-work/board/list` — the module's landing screen — rendered the
   > stranger's own **name** (and the list its phone), because it reads them from a
   > raw `LEFT JOIN users` with no `companyId` predicate, correctly, since `users`
   > has none to predicate on.
   >
   > Two consequences worth carrying:
   >
   > - **Put the check where a new route cannot fail to import it.**
   >   `src/services/job-work-ownership.ts` is now the single definition of all of
   >   them (`assertMemberIsOurs` for a `*UserId`, `findByPk`-based helpers for the
   >   company-scoped tables), and it is wired at the **seams** rather than the
   >   call sites: `writeRouting`, which every routing write funnels through, and
   >   `split`, which `create` delegates to. This is the same failure as BUG-0024
   >   and BUG-0028 — **one rule enforced at the places somebody thought of** — so
   >   when a fix adds a check, ask what else in that module takes the same id.
   > - **The silent kind is not always harmless.** A foreign `operationTypeId`
   >   reads back `null` in BUG-0019's usual way, and that *also* empties the
   >   board's `progressLabel` and every refusal message that names the step
   >   (*"Nothing is ready for Shaping"* names nothing). One field's ownership check
   >   was load-bearing for the module's error messages.
   >
   > `job_work_orders.productId` is safe and deliberately has **no** added check —
   > `resolvePartName`'s `Product.findByPk` runs under the hooks — and the material
   > issue's `productId` was refused only **by accident**, by
   > `product_quantity`'s `UNIQUE(productId)`, answering *"A record with this
   > productId already exists"*. Rule 7's refrain, for the third time: **a check
   > that exists as a side-effect of an unrelated one is not a check.**

### 4.4 Identity vs. membership (ADR-004)

- `users` = one **identity** per email, global (no `companyId`).
- `company_members` = one row per (identity, company), carrying **`roleId`,
  `userKind`, `status`, `membershipVersion`**.

Role/kind/status are **per membership**, never on `User`. `User.roleId` is
retired — do not resurrect it. Switching company switches all of them.

Existing `*UserId` foreign keys across the schema (`preparedByUserId`,
`supplierUserId`, …) point at `users.id`, **never** at `company_members.id`.
Don't "tidy" that.

`membershipVersion` makes a permission change take effect without waiting out
the token TTL: bump it on any role/permission change, and the guard returns
`409 MEMBERSHIP_STALE`, which the frontend turns into a silent refresh.

> **"Any permission change" includes the permission MATRIX, not just the role
> assignment** (D-40). `RolePermissionService.upsertRolePermissions` busts its
> own 5-minute server cache, and for a long time that was all it did — so the
> server enforced the new matrix immediately while every holder of the role kept
> drawing its nav rail and its buttons from the map it fetched at sign-in, for
> the rest of the token's life. It now bumps `membershipVersion` on **every**
> membership holding the role, so the next request refreshes. Two consequences
> worth knowing before you read a `409` as a bug: a caller in flight when the
> matrix is saved trades an in-flight `403` for a `409` (both frozen contracts,
> §4.7 — the refreshed token answers `403` on the retry anyway), and **a test
> that edits a matrix and then reuses a cached token must follow the 409 with a
> refresh**, which is what the SPA does. The increment states `companyId`
> explicitly because `Model.increment` fires `beforeIncrement`, which the
> tenant-scoping hooks do not register for (§4.3).

**Access transitions are written to the MEMBERSHIP; only the Hub bars an
identity** (D-39). `PUT /users/:id/lifecycle`, the `status` field on
`PUT /users/:id`, and `DELETE /users/:id` all used to write the global `users`
row — the one ADR-004 gives no `companyId` and shares with every company the
person belongs to. One tenant's admin deactivating a shared person refused their
login *everywhere*; one tenant's admin deleting them removed them from another
tenant's Users grid, whose admin was never consulted, could not see why, and
could not undo it (the restore route belongs to the company that deleted them).
Meanwhile both `company_members` rows sat there `active` — so the column
`TenantContextGuard` actually enforces was never written by the endpoints named
for the job, and `NO_MEMBERSHIP` (§4.7, frozen) was **unreachable from the ERP**.

| Grain | Column | Written by | Read by |
|---|---|---|---|
| per company | `company_members.status` | the ERP's Users screen — lifecycle, edit-form `status`, delete | `TenantContextGuard` → `NO_MEMBERSHIP`; `listActiveMemberships` |
| platform-wide | `users.isActive` / `users.status` | **the Hub's `/internal/*` plane only** | `AuthService.login` |
| credential | `users.lockedUntil`, `failedLoginCount`, `mustChangePassword` | `AuthService.validateLogin` (5 failed sign-ins); *cleared* by activate/unlock | `AuthService.validateLogin` |

Three things that fall out of it, all deliberate:

- **`lock` and `deactivate` now do the same thing.** The only difference was
  ever the `users.status` label the ERP no longer writes, and both mean "not in
  this company". A lockout proper is the credential row, set by five failed
  sign-ins, and activate/unlock is what clears it.
- **A delete tombstones the `company_members` row**, and follows it with the
  identity **only when that was its last live membership anywhere** — which
  keeps the single-company case (nearly everyone) exactly as it was: archived
  view, `deletedBy`, restore. A shared identity just leaves this company's grid;
  re-adding them through `POST /users` revives the soft-deleted membership in
  place. Because Sequelize does not propagate `paranoid: false` into an include,
  `UsersService.findAll`/`findOne` pass it down to the `membership` join
  explicitly — without that the archived view and `loadTarget` both answer empty.
  > ⚠️ **The same omission cost a whole print route** (BUG-0038).
  > `JobWorkChallanPrintService.loadChallan` read with `paranoid: false` —
  > correctly, because a challan outlives its order and an archived one still
  > has to print — and did not pass it into the `order` include. An archived
  > order came back `null`, a cast to `JobWorkOrder` got it past the compiler,
  > and the next line dereferenced `order.id`: **every** challan's Rule 55 print
  > was a 500, because most finished orders are archived. Its sibling
  > `groupForPrint` wrote `order?.partyUserId`, so it did not throw — an
  > archived companion just **dropped off the printed sheet**. When you write
  > `paranoid: false`, write it on the includes too, and ask which of the two
  > shapes you are in: the one that throws, or the one that quietly returns less.
- **`CreateUpdateUserDto.status` accepts `active | inactive | exited` only.**
  `locked` is not a membership state, and `pending` belongs to
  `InvitationService`, which mints the token that makes it recoverable.

> ⚠️ **D-39 was applied to every WRITER of those columns and to the guard. It was
> not applied to the READERS, and one of them is still counting the wrong one**
> (BUG-0046). `UsersDashboardService` answers *"Active users"* with
> `SUM(u.isActive = 1)` — the platform-wide column the ERP no longer writes,
> on a row it shares with every other company the person belongs to. So the
> Users **dashboard** and the Users **grid** on the next screen disagree about
> who is active, and the dashboard is wrong in **both** directions at once:
> people this company deactivated are counted Active, and people barred by
> another tenant's Hub operator are counted Inactive. Its `deletedUsers` is the
> complement of the right answer — it counts globally-deleted identities who are
> still live members here, and misses every membership this company actually
> tombstoned, which the population filter has already dropped.
>
> The three counters that genuinely belong on the identity are `lockedUsers`
> (a **credential** fact, set by five failed sign-ins), `neverLoggedIn` and
> `activeLast30Days` (properties of the login, which is platform-wide). Everything
> else about *this company's* roster is `company_members.status`.
>
> **When a decision moves a column's meaning, grep for its readers, not only its
> writers.**

**`users.tokenVersion` is the same pattern for the identity, and it is what makes
sign-out actually end a session** (SEC-021). `AuthGuard` verifies a signature and
consults nothing else, so a signed-out access token used to keep reading the API
until it expired. The counter is minted into the token as a `tokenVersion` claim
and compared by `TenantContextGuard` against the live column — off the membership
row it already loads, so the check costs nothing extra — and answers
`401 SESSION_REVOKED` when they differ. Bump it on logout, logout-all and any
password change; a token minted before the column existed carries no claim and
reads as version 0, so a deploy signs nobody out.

> ⚠️ **There are exactly TWO minters of a JWT in this backend, and only one of
> them sets the claim** — a known open finding (BUG-0056). `AuthService` does;
> `ImpersonationService.start` builds its payload by hand and does not, so an
> absent claim reads as 0 and every support token is refused
> `401 SESSION_REVOKED` the moment the impersonated administrator's counter
> leaves zero — i.e. the first time they sign out or change their password. The
> session is opened, audited in the customer's own trail as somebody having come
> in, and then cannot read a single row. `grep -rn "signAsync\|jwtService.sign"
> src` names both minters, and that grep is the check rather than a code review.
> **When you add a claim the guard enforces, ask what else mints a token.**

**A session is two credentials, and they are revoked at different grains.** The
access token dies identity-wide (above); the refresh chain dies **per device**,
by `refresh_tokens.familyId` — the id of the first token in a rotation chain,
carried forward on each rotation and minted into the access token as
`sessionFamilyId`. So signing out on the laptop leaves the phone able to refresh:
it takes one 401 and recovers by itself. Presenting an **already-rotated** refresh
token is treated as reuse and revokes the whole family (SEC-022).

**`User.create()` may only be called in `services/users.service.ts`** — enforced
by `src/user-module-boundary.spec.ts`. Everything else goes through
`UsersService.create` / `UserProfileService.findOrLinkUser`.

#### Access is by invitation only — there is no sign-up

`POST /auth/register`, `AuthService.register`, `AuthUserDto`, the `/auth/signup`
screen and the `signupAllowed` flag on the public site-configuration response
were **all removed on 2026-08-20**. A user arrives one of two ways: an
authenticated admin creates them (`UsersService.create`), or they are invited
(`InvitationService` — in-app, or the Hub's "add an admin"). Public self sign-up
had no company to join, so it minted an identity that could authenticate and
then failed `NO_MEMBERSHIP` on every request.

`user_configurations.allowSignup` outlived the flag it gated by a few hours;
the whole table went next (below). Don't wire self sign-up back up without a
company-selection story for whoever signs up.

#### The User Configuration module is gone — how a new user gets its defaults

Removed outright on **2026-08-20**: the screen (`/users-roles/configuration/
settings`), the nav item, `GET|PUT /user-configuration`, the service,
controller, DTO and entity, the `user-configuration` permission key (out of
`permission-registry.ts`, `ALWAYS_AVAILABLE_PERMISSION_KEYS`,
`ADMIN_ONLY_PERMISSION_KEYS` and `CONFIG_URLS`), and the table itself
(migration `20260820100000-drop-user-configurations`, which also stopped
company provisioning seeding a row). Its three settings each had exactly one
defensible value, and `UsersService.addUserDefaultValue` is now where all
three live:

| Was | Is |
|---|---|
| `defaultPassword` — one company-wide literal every colleague already knew | a password **generated per user** (`src/const/generated-password.const.ts`), which the Add User form pre-fills, shows and lets the admin copy |
| `defaultUserVerified` | **always verified.** Switching it off only produced accounts that could not log in and no screen to fix them |
| `defaultRoleId` | the Add User form **requires** a role; the callers with no human choosing (Tally import parties, a voucher's quick-add party, HR onboarding) fall back to `SAFE_DEFAULT_ROLE_NAME`, resolved by NAME per company — `resolveDefaultRoleId` no longer takes a configured candidate |

The generator's alphabet is exactly what `CreateUpdateUserDto.password`
accepts, and one character of each required class is placed explicitly, so a
generated password can never be refused by the endpoint it was generated for.
`jayhindi-client-front/src/utils/password-generator.util.ts` is the form's own
copy — the two need not agree on output, only on that rule.

#### One identity, many companies — adding someone who already exists

`UsersService.create` with an e-mail that already belongs to a platform
identity **adds a membership to that identity** (`linkExistingIdentity`); it
never mints a second one. This applies to **every** role — party and staff
alike — because the person, not the role, is what is shared. It is the same
thing `CompanyAdminService.add` (the hub's "add an admin") has always done,
extended to the in-app *Add User* form.

- Already an **active** member of this company → `400`, "already a member".
  A Pending/Exited/soft-deleted membership is revived in place instead, with
  `membershipVersion` bumped.
- The linked membership is **never** `isDefault` — this company's admin does
  not get to decide where someone else's login lands.
- The identity row (`name`, `password`, `phone`, …) is **not touched**. Only
  the per-company records are written: `company_members`, `company_parties`,
  and `user_details` (see §4.3's note — the party master is company-scoped).

> ⚠️ This **replaced** the previous §11.3 enumeration-safety rule, which
> swapped a colliding party e-mail for a `@tally-import.invalid` placeholder
> and created a duplicate identity. That bought secrecy at the cost of making
> multi-company membership unreachable: a person who administered one company
> and was a party of another got two unrelated logins and could only sign into
> one. Product decision, 2026-08-20 — the login company chooser depends on it.
> Do not re-introduce the placeholder swap for a caller-supplied e-mail.
>
> **The bulk Tally import is the deliberate exception** and still never links:
> `ImportCommitService.resolvePartyEmail` resolves a colliding address to a
> placeholder *before* `UsersService.create` sees it, so a 500-ledger import
> cannot attach memberships to real people. Keep it that way.

An **edit** (`UsersService.update`) still refuses a colliding e-mail outright
for both kinds — pointing an existing row at another identity would be a merge
(whose vouchers and journal history win?), not a membership.

### 4.5 Permissions — four independent gates

| Gate | Where | Grain | Admin bypass? |
|---|---|---|---|
| `RolesGuard` + `@Roles()` | global | role name | n/a |
| `RoleMenuGuard` + `@Permissions(key, actions)` | **opt-in** `@UseGuards` | per module key × action | **yes** — Admin is never locked out |
| `ModuleLicenceGuard` | global | licensed module | **no** — provider's decision |
| `BillingRestrictionGuard` | global | HTTP method | no |
| `PartyOnlyGuard` | **opt-in** `@UseGuards` (the party portal, class-level) | identity **kind** | **no** — an admin is not a party |

**`@Permissions('<key>', ['canView'|'canAdd'|'canEdit'|'canDelete'|'canViewDelete'|'canApprove'])`**
keys are stable strings listed in `src/const/permission-registry.ts` — the single
source of truth, consumed by the seeder, the Admin full-access grant, the
editable permission matrix, and upsert validation. Rows live in
`role_menu_permissions` keyed by `(companyId, roleId, permissionKey)`; the guard
caches a role's whole map for 5 minutes.

**`@SharedRead()`** is the second lane: a **read-only** data source any
authenticated **colleague** may call (the product picker feeding voucher lines,
the chart of accounts feeding posting, employees feeding payroll). It bypasses
both `RoleMenuGuard`'s module check and `ModuleLicenceGuard` — otherwise
Transaction couldn't be sold without Product. **Security contract: only ever on
read-only handlers (GET, or POST `list`/search). Never on
create/update/delete/restore.** It is handler-scoped on purpose; a controller may
not claim it wholesale.

> ⚠️ **"Any authenticated user" never meant a trading party** (D-46, BUG-0031).
> Customers log into the same ERP as the staff who invoice them — that is the
> premise of the party portal — so that phrase quietly handed a customer every
> shared lookup in the application. **38 endpoints answered a party**, including
> the company's bank accounts with their **account numbers and IFSC codes**, the
> full staff list, the salary-component structure, the inventory valuation, the
> job-work machines' hourly cost rates, and **every other party's GSTIN, PAN and
> outstanding balance** — one customer reading another's tax identity inside the
> same tenant. Four of them had been filed separately (SEC-051/053/054/055)
> before anyone counted the rest.
>
> So `@SharedRead()` takes `{ parties?: boolean }`, defaulting to **false**, and
> `SharedReadPartyGuard` — **global**, unlike `RoleMenuGuard` — answers a party
> `403 PARTY_FORBIDDEN`. Global on purpose: `RoleMenuGuard` is opt-in per
> controller, which is right for a rule that *widens* access, and this one
> **narrows** it. A narrowing rule a controller can forget to install is not a
> rule. It is the mirror of `PartyOnlyGuard`, so "is this caller a party?" is now
> asked on both sides of the boundary.
>
> **The allow-list is one route** — `GET /print-config`, because the party portal
> prints the invoice they are entitled to. Before adding a second, ask the
> question this decorator got wrong the first time: **not "does a party need to
> read this?" but "would I put this figure in an e-mail to a customer?"**

**`PartyOnlyGuard`** (`src/guards/party-only.guard.ts`) is the one gate that asks
*who the caller is* rather than *what their role may do*. `/party-portal/*` is
written for a trading party reading their own documents — the self-scope comes
from `req.user.id`, not from a permission — so a permission key would have been
the wrong instrument (an admin could grant it to a staff role and aim the portal
at nobody). It reads `userKind` off `TenantContext`, i.e. off the live
`company_members` row, **not** off the JWT, so a kind change does not wait out the
token TTL. `403 { code: 'PARTY_ONLY' }`. It is class-level on purpose: unlike
`@SharedRead()`/`@ReadOnlyRequest()`, which are handler-scoped because they
*widen*, this one narrows. Mirrored on the frontend by
`guards/party-user.guard.ts`, which also does not exempt admins.

**`ADMIN_ONLY_PERMISSION_KEYS`** (`src/const/admin-only-permissions.const.ts`)
denies every non-admin outright, even one the permission table grants — used for
config surfaces holding credentials (`eway-bill-config`, `einvoice-config`, …).

Both `RoleMenuGuard` and `ModuleLicenceGuard` read metadata with
`reflector.getAllAndOverride([handler, class])`, **not** `get(handler)` — several
controllers declare `@Permissions(...)` once on the class. A handler-only read
returns `undefined` there and waves the whole module through. Never downgrade
those calls.

### 4.6 Module licensing

Six licensed modules (`LicensedModule`): `product`, `transaction`, `chat`,
`files`, `hr`, `jobwork` — plus three gateway capabilities (`ewb`, `einvoice`,
`ocr`) that gate calls the hub makes rather than nav subtrees. Flags are columns
on the `companies` row (`productEnabled`, …), mapped by a **total** `Record` so
adding an enum member without a column is a compile error.

- Unlicensed → `403 { code: 'FEATURE_DISABLED', module }`.
- **A missing/unknown flag reads as ON** (`ALL_ON`) — a company row predating a
  newly-added module must never go dark.
- Mirrored on the frontend in
  `jayhindi-client-front/src/core/navigation/module-licence.ts`. **Keep the two
  in sync.** The server is the enforcement; the frontend copy exists only so the
  menu doesn't offer something the server will refuse.

### 4.7 Frozen error contracts

These status+code pairs are contracts the frontend recognises. Don't change them.

| Code | Status | Meaning | Client behaviour |
|---|---|---|---|
| `NO_MEMBERSHIP` | 403 | membership deactivated/exited, or token has no `companyId` | sign in again |
| `MEMBERSHIP_STALE` | 409 | role/permissions changed since token was minted | silent `/auth/refresh` + retry |
| `COMPANY_SUSPENDED` | 403 | company suspended/archived | blocked |
| `FEATURE_DISABLED` | 403 | module not licensed | "your provider turned this off" |
| `SUBSCRIPTION_PAST_DUE` | 402 | billing read-only grace | reads still work |
| `PARTY_ONLY` | 403 | a staff/system account called a `/party-portal/*` route | the SPA never routes staff there (`partyUserGuard`) |
| `PARTY_FORBIDDEN` | 403 | a trading party called a `@SharedRead()` handler that is not party-readable (D-46) | not offered on screen; the party SPA calls only `/party-portal/*` and `GET /print-config` |
| `SESSION_REVOKED` | 401 | the access token predates the identity's last sign-out / password change (`users.tokenVersion`) | refresh, which succeeds on a device that did not sign out and fails on the one that did |

### 4.8 Data layer

- **Sequelize 6 + sequelize-typescript**, injected via the `SEQUELIZE` token
  (`src/const/config-const.ts`).
- **Soft deletes**: `paranoid: true` + `SoftDeletableModel`. `BaseCrudService`
  gives `remove` (first call soft-deletes and stamps `deletedBy`; second call on
  an already-deleted row hard-deletes), `restore`, `bulkRemove`, `bulkRestore`
  (best-effort — a refused row lands in `skipped` with its own service's reason
  rather than failing the batch).
- **Migrations**: a squashed `00000000000000-initial-schema.ts` baseline in both
  backends, plus incremental migrations on top of it in `client-back`
  (`20260820000000-user-details-company-scope`, then
  `20260820100000-drop-user-configurations`). Add new ones with
  `npm run migration:create <name>`; never edit the squashed baseline. Write
  each step idempotently (check `information_schema` before altering) so a
  re-run is a no-op rather than an error.
  > ⚠️ **Write the SQL for MySQL 8's DEFAULT `sql_mode`, which includes
  > `ONLY_FULL_GROUP_BY`.** A non-aggregated column beside a `GROUP BY` is an
  > *error* there, not an arbitrary pick — D-52's `rcm-payable-head` selected
  > `n.id` beside `GROUP BY n.companyId` and **aborted on every stock MySQL 8**,
  > so `RCM_PAYABLE` existed in no company and the ruling was code-only
  > (BUG-0051; `MIN(n.id)` is the fix). A migration that cannot run is not a late
  > schema change, it is a release that does not install — and nothing in the
  > loop compares the applied set against the directory, so `npm run migrate`
  > after pulling is on you.
- **The DB session runs in UTC.** No `timezone` is set on the Sequelize config,
  so Sequelize's `+00:00` default applies and every raw **`CURDATE()` / `NOW()`
  is the UTC day**. Against a business `DATE` column — `trx.date`, `dueDate`,
  `journal_entries.date` — that names *yesterday* between 00:00 and 05:30 IST,
  which is API-033's defect one layer below where `todayIso()` fixed it
  (BUG-0050: the dashboard's "Today" tiles, its month-to-date windows, the
  overdue cut; on the 1st of a month inside that window, "this month" reports the
  whole of last month). `NOW()` against a stored UTC timestamp — `updatedAt`,
  `lockedUntil`, `lastLoginAt` — is correct and is not the same question.
- **Transactions**: controllers open `await this.sequelize.transaction()` for
  multi-step writes and pass `{ transaction }` down. Commit on success, rollback
  and rethrow as `ApiException` on failure — see
  [product.controller.ts](jayhind-client-back/src/controllers/product.controller.ts)
  `create()` for the canonical shape.
- **Domain rules live in `src/const/*.const.ts` as pure, dependency-free
  functions**, each with a `.spec.ts` beside it. This is why the API guards and
  the UI buttons can read the same table
  (e.g. `voucher-lifecycle.const.ts` ↔ frontend `utils/voucher-lifecycle.util.ts`).
  Put new business rules there, not inline in a service.

### 4.9 Accounting core (don't improvise here)

`posting.service.ts` + `src/const/posting.const.ts` turn vouchers into
double-entry `journal_entries` / `journal_lines`, resolving accounts by
`systemKey` from the seeded chart of accounts, splitting GST intra/inter-state
from GSTIN state codes.

> **A journal line names a GROUP, not an account.** `journal_lines` carries both
> `trxGroupId` and `trxAccountId`, and in this schema the **group** is the
> postable leaf of the chart of accounts: every ordinary leg (party control, the
> GST heads, sales/purchase, an expense) names a `trx_groups` row and leaves
> `trxAccountId` **NULL**. Only the cash/bank leg of a payment, receipt, journal
> or contra names an account — and it names a group too. Anything that aggregates
> the ledger therefore groups by `trxGroupId`; keying by `trxAccountId` collapses
> the whole book into one anonymous bucket while every total stays right, which is
> how it goes unnoticed (it did, in the QA harness's own trial balance, until
> Phase 6B).

**CGST and SGST are two levies, not one figure halved** (BUG-0026). Each is
imposed at **half the rate on the line's own taxable value**, so on any one line
they are the same figure computed twice and are equal by construction.
`gstLineTax` in `src/const/gst.const.ts` is the primitive that charges them;
`splitGst` only divides a total that has already been arrived at. Computing one
full-rate tax per line and halving the *document* total instead made the two heads
differ by a paisa whenever the full-rate figure was odd — 882 of 2,534 intra-state
vouchers in the QA world — and GSTR-1, GSTR-3B and the recipient's ITC all carry
the heads separately, so a return whose CGST and SGST differ does not reconcile.
Charging each head separately also makes a line total exactly `2 × half`, which is
why `PostingService.computeTrxTaxAmounts` can still halve the document total with
**no rounding at all**; don't reintroduce a full-rate line tax and expect that
division to stay exact. Mirrored in `jayhindi-client-front/src/services/
pricing-engine.ts`, because the voucher form's preview is written to equal what
the server stores to the paisa.

**A voucher line snapshots its CLASSIFICATION from the item master, and both
halves of that are load-bearing** (BUG-0034). `trx_items` carries two facts
copied off `products` at save time — `hsnCode` and `gstSupplyClass` — and
`TrxWriteService.applyCatalogueSnapshots` is the one place that stamps them,
from a single read, deliberately together. Neither may be trusted from the
client: a stated `gstSupplyClass` let a **taxed** line be declared exempt, so
the ledger said taxable while GSTR-1 table 8 and GSTR-3B 3.1(c) said exempt
about the same line. And neither may be left to be resolved later: the column
was NULL on 21,554 of 21,569 lines (the SPA sets the field only on the product
form), so `GstReturnAssemblyService`'s fallback read the product's **live**
class and re-classifying an item rewrote the classification of invoices already
raised — and already filed. The fallback stays, because it is what keeps those
rows readable; the fix is forward-only, the same doctrine D-19 set for the
CGST/SGST split. **When you copy a fact from a master onto a document, ask what
reads it if you don't.**

**The rate schedule has a date, and this schema has nowhere to put it**
(GST-002/003, D-50). The 56th GST Council replaced 12 % and 28 % with 5 % and
18 % and added a **40 %** demerit rate, effective **22-09-2025**. Two
consequences that look like tidiness invitations and are not:

- `TAX_SLABS` (`src/const/provisioning/company-defaults.const.ts`) seeds
  **both** schedules, superseded rates included. A voucher is taxed by the
  schedule in force on its **own document date**, so a credit note against a
  pre-reform invoice and a Tally opening import both need 12 % and 28 % to
  resolve — `voucher-import.const.ts` can only map a rate it finds a slab for.
  Deleting a superseded rate is not a cleanup; it breaks history.
- **Both masters now carry `effectiveFrom`/`effectiveTo`** (D-50), inclusive
  document dates with NULL open at either end. `tax-validity.const.ts` is the
  pure rule and `GET /tax/active?asOfDate=` is how a picker asks; the hub's
  `hsn_codes` is keyed `(code, effectiveFrom)` so one code can carry a row per
  schedule — `effectiveFrom` is NOT NULL with a `1900-01-01` sentinel because
  MySQL treats NULLs in a unique index as *distinct*, which would have silently
  dropped the duplicate-code guarantee. What limits the blast radius either way
  is that the rate charged comes from the line's own tax **citation**, not from
  the master — a line citing 5 % on an 18 % product is charged 5 % — so documents
  already raised are safe whatever the master says next. Validity decides what a
  picker **offers**.
  ⚠️ **The hub's HSN data is still the pre-reform schedule** (598 codes at 12 %,
  185 at 28 %, none at 40 % — GST-002). The dating that makes a safe re-import
  possible has landed; the import itself needs the current CBIC file.

**Reverse charge is modelled, and the recipient owes the tax** (D-52). Under
§9(3)/§9(4) the supplier charges nothing, so an RCM **purchase** carries two
obligations where an ordinary one carries a single creditor balance: `buildLegs`
credits the party `net + charges` and credits `SystemGroupKey.RcmPayable` the
tax, leaving the input-GST legs on the debit side (GSTR-3B declares the same tax
twice — 3.1(d) as the liability, 4(A)(3) as the credit — so the books carry
both). `RCM_PAYABLE` is its **own** head, never a `*_OUTPUT` one: an RCM
liability is discharged in cash and may not be set off against ITC, so netting it
into output GST would let it be paid with credit on the very report someone
computes the cash payment from. It carries no `partyUserId` — the creditor is the
government. Reverse charge is **purchase-only**, matching the scope
`gstr3b.const.ts` already uses, so the ledger, the return and §31(3)(f)'s
self-invoice (`gst-returns/self-invoice.const.ts`, rendered by the print payload)
all agree about what an RCM document is. Forward-only: vouchers posted before
this are not re-posted.

**Compensation cess is not modelled** (D-53). `trx_items.cessAmount` is dropped —
it was a client-stated figure the server never derived, never billed and posted
to no head, read straight into GSTR-1's `csamt`. The **portal** field stays at a
literal `0`, because GSTR-1's schema requires `csamt`. Don't reintroduce a
client-supplied cess: if it is ever wanted, it is a rate on the item master
derived beside `gstLineTax`, not a column the client fills in.

**A cancelled voucher leaves a PAIR in BOTH ledgers, and only one of them has a
shared primitive for saying so** (BUG-0044). `journal_entries` carries
`isReversal` + `reversedEntryId`, and `liveEntrySql` in `posting.const.ts` is the
one definition of "this entry did not happen" — `FinancialDashboardService` uses
it on all five of its queries. `stock_movements` carries the **identical** two
columns, `isReversal` + `reversedMovementId`, and has **no such primitive**, so
every reader has to remember on its own. `DashboardService.stockInOutTrend` did
not: it buckets movements by raw `direction`, so a cancelled purchase adds its
value to *received* (its original IN) **and** to *issued* (its reversal OUT) —
the chart reports material issued that was never received, and on the QA world
that is ₹250bn over twelve months. `cogsMtd`, 44 lines above it in the same file,
signs by direction for exactly this reason and its comment says so.

Two things fall out of it. **The rule only bites on a GROSS figure** — a balance,
a running total or a signed sum cancels the pair by itself, which is why
forgetting it survives so long. And a reversal belongs in **neither** bucket of a
two-series chart: it cancels the one its *original* was filed under, so the
correction is a sign, not an exclusion (dropping `isReversal = 1` alone leaves
the original, which is what inflated the bar). When you add a gross aggregate over
`stock_movements`, ask what `liveEntrySql` would have done.

**A KPI card and the breakdown drawn under it must count the same rows, and a
doc comment saying so is not a mechanism** (BUG-0043, BUG-0045, D-56).
`DashboardService` answers "what is our stock worth" and "what is in the bank"
from more than one query each, and twice the narrow one sat directly beneath a
comment promising the wide one. `stockValueByCategory` joined `products ON
deletedAt IS NULL` while `inventoryValue` summed every bucket; `cashByAccount`
filtered `isActive: true` while `cashBankBalance` summed the ledger unfiltered —
under the words *"same scope … so the breakdown always sums to the KPI card
above it"*. D-56's ruling covers both: **archiving a product does not empty the
warehouse and deactivating an account is not a withdrawal**, so the money stays
counted and the panel adds up. Two things to carry — the second half of a fix
like this lives in a *different method of the same file*, so the check is *which
other reads answer this question* (a grep, not a review); and **a filter with
nothing to exclude is not a tested filter**, which is why the cash half survived
nine QA phases in a world where no tenant had an inactive account.

**Stock is sequenced by DOCUMENT DATE, not by insertion** (BUG-0012, D-17).
`replayStockLedger` / `byDateThenId` in `src/const/inventory.const.ts` is the one
place that defines the sequence, and the live buckets, each movement's stored
`runningBalance` / `valuationCost`, the closing-stock valuation and the
"what if this were reversed" preview all go through it, so they cannot disagree
about a product's weighted average. Two consequences worth knowing before
touching `InventoryService`:

- **A back-dated movement re-costs everything after it**, inside the same
  transaction — `writeMovement` asks `hasLaterMovement` and calls
  `rebuildBalances(productId, tx)` when the answer is yes. The ordinary case
  (today's voucher, a run of same-day lines) skips the replay, which is what keeps
  a 200-line invoice from rewriting a whole history 200 times. `MovementLike.date`
  is **required** for exactly this reason: a caller that selects movements without
  it cannot replay them.
- **An OUT's `unitCost` is derived and is re-written by the replay; an IN's is
  not.** A receipt's cost is the price on the document, a fact. An issue's is the
  average prevailing on its own date — which is what back-dating changes.
  Re-costing touches no journal entry, because stock valuation has **no leg in
  this ledger** (the goods head takes the line net; there is no COGS leg and no
  stock leg). That is what makes it a repair rather than a re-posting exercise, and
  `qa-artifacts/tests/transactions/recosting.spec.ts` asserts it rather than
  assuming it — if the ledger ever grows a stock leg, that test is what notices.
- **A conversion is costed AS OF ITS OWN DATE, and that is not a detail**
  (BUG-0033). A stock conversion is component OUTs *and* one finished IN, so both
  halves of the rule above apply to it at once — and it used to price the
  finished good's IN from `onHandFor`, i.e. the average at the **end** of the
  ledger, while the engine re-costed its OUTs to the average prevailing on the
  conversion's date. The two agreed only while the conversion sat last in every
  component's ledger; back-dated by a day past a purchase that moved an average,
  a conversion silently destroyed or invented inventory value, with no error and
  no GL trace (a conversion has no journal entry, so nothing reconciles it).
  `InventoryService.applyAsOfDateCost` is the fix, called from
  `planAndValidate` (create **and** edit, the latter excluding the conversion's
  own movements) and from `preview`, so the screen and the save agree.
  ⚠️ **It moves `avgCost` only.** Availability stays a question about *now* — a
  component bought last week can pay for an assembly back-dated to last month,
  and a shortage check against the older balance would refuse a run the company
  can plainly perform. The two questions have different tenses; conflating them
  is what caused the bug. The general form is worth keeping: **when a service
  snapshots a derived figure, ask what else the derivation depends on** — here
  `date`, which had become load-bearing in a different file two decisions
  earlier.
- ⚠️ **The replay SKIPS a cancelled pair, so neither of its rows ever gets a
  running balance written** — a known open finding (BUG-0049). `writeMovement`
  creates a reversal with `runningBalance: 0` and the comment *"backfilled by
  `rebuildBalances` below"*; `rebuildBalances` iterates `replay.rows`, and
  `replayStockLedger` drops the cancelled pair before it gets there — correctly,
  because a cancelled pair must not move the balance, and that is exactly why the
  backfill never happens. Every reversal row in the database reads `0`, the row
  it reverses keeps a figure that stopped being true when it was cancelled, and
  where the pair is **last** the stock ledger's visible closing contradicts the
  product's own bucket. The buckets, the valuation and COGS are unaffected —
  they come from the replay.
- ⚠️ **The negative-stock check is order-blind** and is a known open finding
  (BUG-0027): it compares against the product's *current total*, so an issue
  back-dated before the receipt that supplied it is accepted, and the ledger is
  negative in the middle of its own history while ending up correct. Don't read a
  negative running balance as corruption without checking the dates first.

Two lifecycle rules (`voucher-lifecycle.const.ts`):
1. **Nothing leaves the books while a live document depends on it** — an active
   payment, return note or e-Way Bill blocks cancel; a cancelled one doesn't.
2. **A voucher that ever posted is never erased.** `journal_entries` and
   `stock_movements` reference vouchers by a `sourceType`/`sourceId` pair, not a
   FK, so a hard delete silently orphans them. Such a voucher **archives**.

**The financial-period gate is on POSTING, not on the document** (BR-ACC-5, D-30).
`FinancialYearService.assertPostingAllowed` refuses a date that no year covers, one
in a `closed` year, or one on/before a year's soft `lockedUpTo`. A **draft** dated
inside a closed year is legitimate and `POST /trx` allows it deliberately —
somebody is capturing an invoice found in a drawer; it simply may not be approved.

> ⚠️ **Un-posting is a posting event too, and that cost a High** (BUG-0028). Three
> code paths write a reversal into a voucher's own period —
> `ApprovalService`'s Cancel boundary, `TrxWriteService`'s **approved-edit** branch
> (which reverses the live GL and stock before superseding the row with a draft),
> and `StockConversionService`. The gate was on the first only. So editing an
> approved voucher dated inside a closed year answered `200`, moved that closed
> year's books, left the voucher a draft — and the re-approve was then refused by
> the very gate the edit had walked past. A posted voucher in a closed period,
> silently un-posted and stranded, by someone correcting a remark. The edit branch
> now checks **both** dates: the existing one because that is where the reversal
> lands, the new one because the replacement has to be able to post on it (which
> turns a half-finished edit into a clean refusal).
>
> **`stock_movements` has a period too, on all FOUR of its writers** (D-49,
> ruled 2026-08-24). `grep -rn "reverseSource\|inventoryService.reverse"` names
> `ApprovalService`, `TrxWriteService`, `StockConversionService` and
> **`JobWorkMaterialService.cancel`** — the last of which was documented nowhere
> until Phase 6D counted them. The old reasoning for exempting a conversion was
> real as far as it went (it is value-neutral and posts no GL, so a closed year's
> *books* cannot move) and stopped one step short: its **stock** can, and closing
> stock is a figure the accounts the year was closed to fix actually carry. So a
> conversion is gated on create, on edit (**both** dates, BUG-0028's shape) and on
> cancel; and `JobWorkMaterialService.cancel` is gated on the **original
> movement's date**, because that is where its reversal lands — its `issue` dates
> the movement `new Date()` and so cannot be back-dated, but cancelling an issue
> made before a year closed used to write into that closed year.
>
> **When you add a writer of `journal_entries` or `stock_movements`, ask what
> gates the existing ones clear** — and that grep is the check, not a code
> review. This list must name every writer.

**`trx.paidAmount` is DERIVED and the client may not state it** (BUG-0030).
`CreateUpdateTrxDto` declares it required, so it arrives on every request, and for
a long time nothing between the DTO and Sequelize touched it — any caller who
could raise a voucher could mark it paid, with **no allocation row, no payment
voucher, no cash leg and no audit trail**, while the trial balance still balanced
(the receivable control head carried the full amount). `TrxWriteService` now forces
it to 0 alongside the four totals it already re-derives;
`ApprovalService.applyReceiptSettlement` is the only writer, exactly as it is the
only writer of the allocation rows it must agree with. That method also takes
`FOR UPDATE` on each target and **re-checks the over-payment cap inside the
transaction** — the create-time cap in `TrxPaymentReceiptController.buildAllocation`
reads a snapshot outside any lock, so two receipts of 60% each against one invoice
both landed (BUG-0029). The create-time cap is the courtesy; the approve-time one
is the enforcement.

**What a document owes is `outstanding.const.ts`, and it has two signs** (D-18,
BUG-0013). `allocated = Σ payments + Σ (note.grandTotal − note.paidAmount)` — a
return note reduces what is owed exactly as a payment does, but only **while it is
unrefunded**, because a note is itself a settleable document and settling it *is*
refunding it. Where the allocation exceeds the document, the excess is a **refund
due**, reported beside the receivable and never netted into it: a party with
₹50,000 of 90-day debt who is owed ₹50,000 back is not a party with nothing
outstanding, and the ageing buckets total the receivable alone. A note attached to
a document is **not** an open item of its own — listing it as one, on the positive
side, while the invoice it offset read as closed, is what made a party's total come
out overstated by the note's full value and pointing the wrong way.

> ⚠️ **A party's position exists TWICE, and reconciling them needs every term
> accounted for** (BUG-0040, closed by D-55). The ledger side is `journal_lines.partyUserId` on
> the two control heads (`SUNDRY_DEBTORS_CONTROL` / `SUNDRY_CREDITORS_CONTROL`) —
> what the party statement, the summary's `receivable`/`payable` and the
> Vendor/Customer Outstanding reports all read. The document side is `trx` and its
> allocation rows — what the bill-wise annexure and the list summary strips read.
> Neither is derived from the other, so they reconcile only if every term is
> accounted for, and one is not: a party's **opening balance** is posted straight
> to the control head (`sourceType: 'party-opening'`) with **no `trx` row behind
> it**. A report built from `trx` alone therefore lost it silently — the annexure
> showed no bills and every ageing bucket at zero for a party whose statement
> closes at ₹5,000 Dr.
>
> **D-55 makes it an open item of its own**, aged from the opening entry's own
> date. `PartyStatementService.openingBalanceBill` synthesises the row from
> `journal_lines`, deliberately rather than from `company_parties.openingBalance`:
> both sides then derive from the same rows and cannot drift, and it honours
> `liveEntrySql`, which the stored column would not — re-editing a party re-posts
> the opening entry as a reversal plus a replacement. The row carries `source:
> 'party-opening'` and `id: 0`, because there is no document to open.
>
> When you write a report about what a party owes, say which of the two sides you
> are reading and what the other one would answer.

**`trx_accounts.balance` and `trx_groups.currentBalance` are CACHES of
`journal_lines`, not facts** (BUG-0042). `PostingService.persistLines` increments
both by exactly the figures it writes to the ledger, in the same transaction, and
nothing else writes them — so each column is a duplicate of a Σ. Every statement
in `ReportsService` reads the lines (its header says the caches are *"deliberately
not consulted"*); `getFundsSummary` and the Financial Dashboard read the caches.
Two consequences:

- **A divergence is invisible to every ledger-derived report**, which is how nine
  drifted caches across two tenants survived eight QA phases. What sees it is one
  query comparing the column with the Σ — `qa-artifacts/tests/reports/
  outstanding.spec.ts` now runs it over every account and every group of every
  company.
- **The repair is `PostingService.rebuildBalances`**, reachable through
  `POST /trx-accounts/rebuild-balances` (`trx-accounts` `canEdit`) — the door
  `POST /inventory/rebuild-balances` has always had for the stock buckets. It had
  **no caller at all** until 2026-08-24, so a drifted cache could not be fixed
  through the application. If you add a writer of `journal_lines`, it must go
  through `persistLines`, or both caches are wrong from that moment on and nothing
  will tell you.

### 4.10 Async work

- **BullMQ + Redis** for the audit queue and the invoice-scan queue, registered
  via `AuditQueueModule.register()` / `InvoiceScanQueueModule.register()`. Both
  gated by env flags and both **degrade to in-process** when Redis is absent.
  > ⚠️ **A flag saying the queue is on is not evidence that it is**, and
  > `@Optional() @InjectQueue()` is what makes the difference invisible.
  > `BullModule.registerQueue()` does not mark its own module global, so the
  > token silently resolved to `undefined` regardless of
  > `INVOICE_SCAN_QUEUE_ENABLED` and every upload ran inline with **no queueing,
  > no fairness and no concurrency cap** — which is why
  > `invoice-scan-queue.module.ts` sets `global: true` and its comment calls that
  > flag load-bearing. The only honest test is a **side effect the queue path has
  > and the inline path does not**: `enqueueExtraction` `INCR`s
  > `ocr-fairness:company:<id>` before `queue.add`, and `runInline` never opens a
  > Redis connection. `qa-artifacts/tests/cross-service/ocr-pipeline.spec.ts`
  > asserts that counter, deliberately not the flag.
  > ⚠️ **A deterministic `jobId` makes every re-submission a duplicate**
  > (BUG-0060). The id is `scan-<id>` so `queuePosition` can look it up, and
  > BullMQ answers `add()` with an id it already holds by returning the existing
  > job and adding nothing — no error. A *failed* job is kept by
  > `removeOnFail: 100`, which is exactly the state somebody clicks **Re-extract**
  > from: `retry()` had already reset the row to `uploaded` and cleared
  > `errorReason`, so the caller was told *"Re-extraction queued"*, the failure
  > vanished from the screen, and the scan sat in `uploaded` for ever. It bit only
  > the path that needs it — a `needs_review` job is gone
  > (`removeOnComplete: true`), so its id is free — and `removeOnFail: 100` made
  > it non-deterministic, because the id frees itself once a hundred *other* scans
  > have failed behind it. `discardFinishedJob` clears the old job, and it sits in
  > **`enqueueExtraction`** rather than in `retry()`: three callers reach the queue
  > and only one showed the symptom (§13's still-open #4). An **active** job is
  > deliberately left alone — BullMQ throws on a locked job, and whatever the
  > running extraction concludes is the truth about that scan.
- **`@nestjs/schedule`** for cron work (due reminders, job-work alerts,
  maintenance, subscription billing) — **eleven `@Cron` methods**, every one of
  which takes the single-runner claim before doing any work
  (`ScheduledJobRunnerService.runOnce`, keyed by a *truncated*
  `startOfUtcDay`/`startOfUtcWeek` so two processes waking milliseconds apart race
  the identical value) and iterates tenants through
  `CompanyIterationService.forEachActiveCompany`, which opens the
  `TenantContext.run` each company needs. Remember §4.3 rule 2: cron code has no
  tenant store of its own. The guarantee is the plain
  `UNIQUE (jobKey, scheduledFor)` index — the service catches
  `UniqueConstraintError` and reads it as *"another process owns this run"*, so
  dropping that index would let every process win with nothing saying so.
- **Socket.IO** (`src/socket/socketGateWay.ts`) for live notifications, chat,
  scan progress, active-user counts. **This is the one delivery path in the
  product with no guard chain at all** — no `TenantContextGuard`, no
  `RoleMenuGuard`, no `SharedReadPartyGuard` — so the room name
  (`company:<id>:invoice-scan`) and `emitToUserInCompany`'s company filter *are*
  the whole of the tenant enforcement. The gateway's own doc records what the
  last version cost: a socket map keyed by user with no company on it, so *"a
  message raised in company A reached a tab open in company B"*. A socket with a
  missing or unverifiable token is **disconnected**, never registered into no
  company — which would exempt it from every company-scoped check rather than
  failing loudly. Note the refusal comes *after* the handshake, so a client sees
  `connect` and then a disconnect.
  > ⚠️ **The emitters were scoped and the SUBSCRIBERS were not** (BUG-0063), and
  > the two look alike enough that reviewing one reads as reviewing both.
  > `@SubscribeMessage('event')` let **any** authenticated socket emit an
  > arbitrary payload to every client of **every tenant** (`Broadcast` →
  > `server.emit`) and to any caller-supplied user id (`UtoUmessage` — §4.3
  > rule 7, with no hooks behind it); a **trading party** could do both, and the
  > SPA rendered the first as a **toast**. `TotalActiveUsersUpdate` broadcast the
  > *installation's* socket count, and `system-metrics` streamed the **host's**
  > hostname, CPU, load, memory, disk and network to any socket. All deleted or
  > scoped; `system-metrics` now refuses a party by a `userKind` recorded at
  > connection time, because on this plane there is nothing else to ask.
  >
  > Two rules fall out. **There is deliberately no `broadcast()` helper in that
  > class any more** — a bare `server.emit` in a multi-tenant gateway makes
  > forgetting the scope the default, and every other emitter there scopes by
  > remembering to. And when you add a `@SubscribeMessage`, answer both
  > questions: *which company does this go to*, and *may a customer ask for it?*
  > That second one is D-46 on its third plane, after `@SharedRead()` (BUG-0031)
  > and file delivery (BUG-0057).

---

## 5. Backend architecture — `jayhind-admin-back` (Master Hub)

Deliberately smaller and **single-module**: every controller and service is
registered by hand in `app.module.ts`. No `src/modules/`.

### Two planes

| Plane | Routes | Auth |
|---|---|---|
| **Admin** | `/auth`, `/companies`, `/plans`, `/subscriptions`, `/hsn-codes`, `/integration-settings`, `/ocr-review`, `/files`, `/dashboard`, `/support` | JWT (`AuthGuard`) |
| **Tenant/service** | `/api/v1/ewb`, `/api/v1/einvoice`, `/api/v1/ocr`, `/api/v1/gst`, `/api/v1/hsn`, `/internal/*` | `x-api-key` = `INTERNAL_SERVICE_KEY` (`InternalServiceGuard`) |

`/api/v1/*` and `/internal/*` handlers are `@Public()`, which here means **"no
user JWT"**, *not* "no auth" — `InternalServiceGuard` authenticates them with a
sha256-widened, timing-safe compare and **fails closed when the key is unset**.
These routes carry **no user and no tenant context**, so any handler must be
company-agnostic or state `companyId` explicitly in every write.

### Two database connections

- `SEQUELIZE` → `master_hub` (plans, subscriptions, invoices, usage, HSN master,
  error codes, integration config, OCR archive, stored files).
- `CLIENT_SEQUELIZE` → the **ERP's own** `jayhind_client` DB, used only for the
  `companies` table. The hub's `Company` entity is a **thin projection** — only
  identity, status, and the nine licence flags. **Do not grow it into a second
  definition of the ERP's row**; drift between two Sequelize models over one
  table is silent and nasty. Sequelize selects exactly the declared attributes,
  so a column added ERP-side needs no change here.
- The retired `tenants` table keyed installations by a **UNIQUE** GSTIN, which
  blocked one owner running several companies on one registration. `companies`
  inverts it: `UNIQUE(name)`, `UNIQUE(slug)`, plain index on `gstin`.

### Subscriptions & billing

`SubscriptionService` (lifecycle) → every write that could change effective
flags/quotas ends by calling `SubscriptionProjectionService`, so "the
subscription changed" and "the company's row reflects it" can't drift into two
steps someone forgets to do together. `UNIQUE(companyId)` prevents a second
subscription fragmenting billing history. `past_due` sets `billingRestricted` on
the company row → ERP `BillingRestrictionGuard` → `402 SUBSCRIPTION_PAST_DUE`.

---

## 6. Cross-service flows

### 6.1 Company provisioning (hub → ERP)

The console owns the screens; **the ERP owns the schema and domain knowledge**
(chart of accounts resolved by `systemKey`, the role→permission matrix, voucher
config, the financial year). So the console asks, and the ERP provisions itself.

```
admin-front → POST /companies (hub, JWT)
  → ErpClient → POST /internal/companies/provision  [x-api-key]
      → client-back InternalCompaniesController (@Public + InternalServiceGuard)
      → CompanyProvisioningService — one transaction, a few hundred rows,
        all or nothing (chart of accounts, roles + permission matrix,
        voucher config, financial year, tax slabs, HR reference data)
      ← { companyId, counts }
```

No tenant context exists on that route (the company doesn't exist yet), so
`CompanyProvisioningService` states `companyId` explicitly on every insert.

### 6.2 GSP calls (ERP → hub → government)

`MasterHubClient` (`client-back/src/services/master-hub/master-hub.client.ts`) is
**the only thing in the ERP that talks to the hub**. It sends
`x-api-key: INTERNAL_SERVICE_KEY` plus `x-company-id` from `TenantContext`, and
**surfaces the hub's error messages verbatim** — they're written for end users.

Per-call timeouts are deliberately **larger** than the hub's own upstream budget
so a slow upstream surfaces as the hub's specific error rather than a generic
timeout masking it: GSP 30s, GST 12s, HSN 8s (it sits behind debounced typing),
OCR 660s.

### 6.3 Invoice scanning (ERP → hub → OCR sidecar)

```
upload → client-back spools to ./tmp/uploads (multer, disk not memory)
       → forwarded to hub, temp deleted, only a numeric hubFileId is kept
       → enqueued (BullMQ) → InvoiceScanPipelineService
       → MasterHubClient.parseStored(hubFileId)   ← re-extract costs one small request
       → hub OcrProxyService → OCR sidecar :8100
       → ExtractedInvoice JSON → matching → status `needs_review`
       → socket + notification
```

Error handling distinguishes two cases, and this distinction matters:
`ExtractionFailedError` = the document is unreadable → mark `failed`, don't
retry. Anything else (sidecar down, timeout) = infrastructure → rethrow so
BullMQ retries with backoff.

### 6.4 File storage — the ERP owns it, and this section used to say the opposite

⚠️ **Read this if you are working from an older copy.** This section said *"the
ERP stores nothing"* — files spooled to disk, streamed to the hub via
`openAsBlob`, and only a `hubFileId` stayed behind. That was true until
**2026-08-15**, when storage was ported **into** `client-back`
(MASTER_DEVELOPMENT_PLAN.md §20.12). Phase 9B-1 found the map still describing
the previous building. `MasterHubClient` has no `fileUpload` any more, and
`openAsBlob` survives only in a doc comment.

**`client-back` is now the storage writer**, scoped per company:

```
<UPLOAD_ROOT>/companies/<companyId>_<slug>/<category>/<YYYY>/<MM>/<uuid>-<name>
```

- `STORAGE_PROVIDER` / `LocalDiskStorage` / `storage.factory.ts` — `local` is the
  only implemented driver; `s3`/`azure` throw rather than silently doing nothing.
- `stored_files` and `stored_folders` both carry a **`companyId`**, so the §4.3
  hooks scope every read and write. `FileStorageService` *additionally* checks the
  key's physical `companies/<id>_<slug>` prefix, as defence in depth against a row
  whose key drifted from its own company.
- **`hubFileId` on an owning row is a LOCAL id** — a `stored_files.id`. The column
  name is residue of the move. Don't read it as "the hub has this".
- The upload still spools to `./tmp/uploads` (multer, disk not memory — a 100 MB
  import buffered in RAM kills the process) and the spool is drained in a
  `finally` on **both** the success and the refusal path.
- Serving goes through the authenticated `GET /files/:id/content`.

> ⚠️ **`GET /files/:id/content` is not behind `RoleMenuGuard`, deliberately** —
> one route serves every module's files, so a single permission key would hide a
> product image from everyone entitled to see the product. Its comment used to
> conclude *"the worst an authenticated user can do is fetch a file belonging to
> their own company"*, which is **D-46's refuted premise one route over**
> (BUG-0057): customers log into the same ERP as the staff who invoice them, so a
> trading party was handed the scanned purchase invoices, the Tally imports, the
> export bundle, the job-work drawings and every other party's voucher
> attachments. The file *manager* was correctly gated from every angle — the
> metadata route, the listing, the tree, the usage and every mutation all answer a
> party `403` — which is exactly why nobody looked underneath it.
> `src/const/party-file-access.const.ts` is the allow-list (a voucher attachment
> on a voucher the portal would already list for them, and nothing else) and the
> check is in `FileStorageService.openStream`, **where the bytes leave**, so a
> second streaming route cannot forget it.

> ⚠️ **The owner guard has an escape hatch, and its three owners must use it**
> (BUG-0058). `removeFile` refuses any file carrying an `ownerModule` — *"this
> file belongs to a voucher record, remove it from that record instead"* — which
> is what stops the explorer destroying accounting evidence. `AttachmentService`,
> `ProductMediaService` and `InvoiceScanService` are the records it names, and all
> three called it **without `force`**, catching the refusal (two of them
> silently) and destroying the owning row anyway. The bytes were then unreachable,
> undeletable and still charged to `maxStorageBytes` — 39% of live owned files on
> the QA install. Repair: `scripts/purge-orphaned-files.ts`. **If you add a
> file-owning record, its delete passes `force: true`.**

**The one exception** is `site-configuration-assets/` (company logo/favicon),
served statically because the login screen renders them before the app knows
whether the hub is reachable. The old `app.use('/uploads', express.static(...))`
handed any customer's invoices to anyone who could guess a filename — it is
**deliberately gone, not relocated. Do not add it back.**

> ⚠️ **The filename in that directory carries the company id**
> (`company-<id>-logo.png`, `company-<id>-favicon.png`) — BUG-0023. It used to be
> a constant (`aakhaja-logo.png`), so the whole installation had one logo and one
> favicon: every `companies` row stored the same path, and one tenant's upload
> silently replaced every other tenant's brand on their login screen, their
> letterhead and the company switcher — while the upload handler's cleanup loop
> deleted the previous tenant's file first. The directory being **public** is the
> documented exception and is not the problem; a **shared name** is. Keep the id
> in the name, and keep the `.`/`-` terminator in the cleanup match, which is
> what stops `company-2-logo` matching `company-28-logo.png`.

> ⚠️ The category strings (`scanned-invoices`, `attachments`, …) **no longer
> travel anywhere.** `HubFileCategory` is re-exported as `FileCategory` and is now
> just a folder name in this app's own tree. The doc comments claiming they "must
> match the hub's `src/const/storage-key.const.ts` exactly or DTO validation
> rejects the upload" described the pre-2026-08-15 arrangement — the proof being
> `FileCategory.Export`, which has **no counterpart in the hub's enum at all** and
> is written every time a company export runs, so under the rule as stated every
> export would have been a 400.
>
> **Those comments were deleted on 2026-08-25**, and that was the fix rather than
> adding the check `scripts/check-mirrors.js` never had: **a mirror rule that
> cannot fail is worse than no rule, because it reads as coverage.** What is left
> in `hub-upload.const.ts` is a note saying the contract lapsed and when — kept
> deliberately, because the old claim was specific enough ("every drawing upload
> dies with a 400 reciting the hub's enum") that somebody would otherwise trust
> it. Changing a value here is still not free — it is the folder name of every
> file already written under it — but it is a migration in *this* app, not a
> two-repo change.

### 6.5 Tenant admins, the platform user directory, and hard delete (hub → ERP)

Three more `/internal/*` routes on `InternalCompaniesController`/
`InternalUsersController` (client-back), all `@Public() + InternalServiceGuard`,
none of them carrying a tenant context (same doctrine as provisioning):

- **`GET|POST /internal/companies/:id/admins`, `DELETE .../admins/:membershipId`**
  — `CompanyAdminService` lists/adds/removes a company's administrators after
  it already exists (provisioning only ever creates the *first* one). Add
  supports both a direct password (mirrors the first-admin flow) and an
  invite e-mail (`InvitationService.invite`, extended to accept
  `inviterUserId: number | null` + an `actorLabel` string for exactly this
  caller — there is no real `client-back` user behind a Hub operator).
  Remove sets the membership to `exited` (never a hard delete of the row) and
  is refused by `UsersService.assertKeepsAnAdmin` if it would leave the
  company with zero active admins (FR-017). Every write here is audited into
  the **customer's own** trail, `source: PLATFORM`, `username` = the Hub
  operator's display name — same visible-not-silent doctrine as impersonation.
- **`POST /internal/users/list`** — `PlatformUsersService`, the Hub's "Users"
  screen: every identity across every company, each with its own memberships
  (company + role + status). Deliberately cross-company — the documented
  exception in §4.3 rule 1(b) for a genuinely company-agnostic internal read.
- **`POST /internal/companies/:id/hard-delete`** — `CompanyHardDeleteService`.
  **Not** `CompanyService.archive()` (admin-back) — archive soft-deletes the
  `companies` row and reclaims platform-side storage while every ERP row
  stays put; this instead deletes every one of those rows too, **including
  posted vouchers, journal entries, GST return filings, e-Invoices and
  e-Way Bills**, then the `companies` row itself. No undo.
  - The FK-safe delete order is computed by
    `src/const/company-hard-delete-order.const.ts` (Kahn's algorithm over a
    hand-transcribed edge list — `onDelete` behaviour only exists in the raw
    migration SQL, not in Sequelize's own association metadata), verified by
    its own `.spec.ts` against every edge. The whole delete runs in one
    transaction, so a mistake in that order fails loudly and rolls back
    rather than partially destroying data.
  - Two rails enforced **server-side**, not just in the console: the company
    must already be `archived`, and the caller must restate the company's
    exact current name (`confirmName`). Both `CompanyService.hardDelete`
    (admin-back) and `CompanyHardDeleteService` (client-back) check the
    archived state independently.
  - **`user_details` IS in the delete graph** — and this line used to say the
    opposite, which is worth knowing if you are reading an older copy. It was
    excluded while the party master had no `companyId`; the 2026-08-20 migration
    gave it one (§4.3), so this company's rows are this company's to delete, and
    `company-hard-delete-order.const.ts` carries the edge with its own note on
    why it once did not. The original worry — that another company's `trx` can
    reference the same row — is answered by the `trx → user_details` edge in that
    same graph. `qa-artifacts/tests/cross-service/hard-delete.spec.ts` asserts a
    deleted company is left with **zero** rows in every `companyId`-bearing
    table, taken from `information_schema`, so an exclusion here is a failing
    test rather than a silent orphan.
  - **Orphaned identities are deleted too, but never someone else's login.**
    After the table purge, every identity who WAS a member of this company is
    re-checked: if `company_members` now has zero rows for them anywhere
    (i.e. they belonged to THIS company exclusively), their `users` row is
    deleted along with it — `user_details`/`refresh_tokens`/
    `authentication_token` cascade off `users.id` automatically;
    `push_subscriptions` (`RESTRICT`) and the self-referencing `users
    .deletedBy` (`RESTRICT`) are cleared explicitly first. An identity still
    active in another company keeps their login — only the membership in the
    deleted company is gone.

---

## 7. Frontend architecture (both Angular apps)

**Angular 21, standalone components, zoneless change detection, signals.** No
NgModules, no Zone.js. `provideZonelessChangeDetection()` in `app.config.ts`.

```
src/
├── app/          app.component, app.config.ts (providers), app.routes.ts
├── components/   admin/ (feature screens), auth/, shared/ (reusable UI)
├── core/         navigation/ (static nav tree + module-licence mirror)
├── services/     API + domain services
├── store/        auth.store.ts (signal store)
├── guards/       functional CanActivateFn guards
├── interceptors/ functional HttpInterceptorFn
├── styles/       design-system/, colors/, custom/, grid/, helpers/
└── environments/
```

### Patterns

- **Signals over RxJS state.** `AuthStore` holds `signal()`s exposed as
  `.asReadonly()`, with `computed()` derivations (`currentUser`,
  `isAuthenticated`, `isAdmin`, `isPartyUser`, …). Follow this shape for new
  stores. RxJS stays for HTTP.
- **`inject()` over constructor injection** in services, guards, interceptors.
- **Functional guards and interceptors** — `CanActivateFn`, `HttpInterceptorFn`.
  Interceptor order in `app.config.ts` is `[MessageInterceptor, AuthInterceptor,
  LoadingInterceptor]`.
- **Lazy routes**: `loadComponent` for leaves, `loadChildren` → a
  `*.routes.ts` per feature. `PreloadAllModules` + `withComponentInputBinding()`.
- **All API traffic goes through `ApiService`** (`get/post/put/delete/postBlob`),
  which prefixes `environment.apiBaseUrl` and sets the `skipLoader` header. Never
  call `HttpClient` directly for API routes.
- **Route permissions** are declared as route data:
  ```ts
  { path: 'roles', canActivate: [permissionGuard],
    data: { permission: { apiUrl: 'roles', action: 'canView' } }, … }
  ```
  `action` defaults to `canView`. The guard checks **licence first** (a provider
  decision, so it precedes even the Admin bypass), then Admin, then the
  permission map.
- **Navigation is static** — `core/navigation/navigation.config.ts` is the single
  source of truth for the nav rail, the module panel, the top menu, breadcrumbs
  and the post-login landing resolver. The old runtime `menuMaster.json` /
  `menu_master` table is gone. Permissions stay dynamic: each `NavItem` carries a
  `permissionKey` matching the backend decorator, merged with the role's flat
  permission map at runtime. Containers use an empty `permissionKey` and become
  visible when any child is.
- **The nav is two columns** (`client-front` only): `app-nav-rail` lists every
  top-level module as an icon and never collapses; `app-sidemenu` beside it lists
  the ACTIVE module's own pages, grouped **two ways**: a `sub` node becomes a
  heading (it is a URL segment too), and a run of consecutive leaves sharing a
  `group` label becomes one as well (a heading with NO url — `PANEL_GROUP`).
  Only the panel collapses (`options.sidenavCollapsed`), so every module stays
  one click away at any width. `MenuService.activeModule` — the URL's first
  segment matched against the permission-filtered tree — is what both columns
  read.
  - A top-level `NavItem` may declare `subtitle` (panel header caption),
    `shortName` (the rail's ~10-character label; the tooltip and `aria-label`
    keep the full name) and, for a module with **no child routes**, `sections`:
    in-page anchors whose `id` MUST exist on that screen. Two sections that share
    a vertical band must be **one** entry — see the Dashboard's `dash-queues`.
  - **A module with ONE destination renders no panel at all.**
    `MenuService.activeModuleHasPanel` is false when the (permission-filtered)
    module has no children and fewer than two `sections`: Chat, Files, Audit
    Log, Export, Branding. Both `SidebarComponent` (which element to render)
    and `AdminComponent` (`.matero-nav-panel-hidden`, which narrows the sidenav
    to the rail) read that ONE signal — if they disagree you get either a stray
    empty column or a content margin with nothing under it. The mobile overlay
    keeps its panel (`|| !showToggle`): nothing competes for width there, and
    the panel head carries the drawer's only close button.
  - **Above 14 pages the panel's groups collapse to an accordion**, except
    those listed in `PINNED_PANEL_GROUPS` — the everyday destinations, which
    must never need a click to reveal. Transaction (40 pages) is the reason
    both mechanisms exist, and since **2026-08-20** its panel reads: Overview ·
    **Daily Entry** (Sales, Purchase, Receipt, Payment, Journal, Contra — open)
    · Sales Cycle ▸ · Purchase Cycle ▸ · **Ledgers & GST** (open) · Reports ▸ ·
    Masters ▸ · Setup ▸. The order of `vouchers.children` in
    `navigation.config.ts` **is** that layout — it was document-flow order
    before, which reads well as a diagram and put Sales, the most-used screen
    in the app, ninth and behind a disclosure triangle. No route moved; only
    the `group` labels and the order did.
  - **The per-module tab bars are gone.** `ModuleLayoutComponent` is now only a
    `<router-outlet>`; the panel lists the same tree at full width without the
    horizontal scrolling seven tabs forced. Don't reintroduce them.
    Transaction's own right-hand rail is the one survivor, because it also
    carries rules the panel does not (the admin's `hiddenTransactionMenus` and
    the approval gate) plus Quick Voucher Entry.
- **Company settings are split by what they're FOR** (2026-08-20).
  `/site-configrations` ("Branding") keeps only the logo and favicon. Company
  name, GSTIN, PAN, address and the e-Way Bill / e-Invoice gateway cards live in
  **Transaction ▸ Configuration** (`/transaction/transaction-config`) as
  in-page sections beside the voucher settings — every one of them is printed on
  a voucher or applied to one, and the GSTIN is what splits CGST/SGST from IGST.
  Consequence, decided deliberately: the **Transaction licence now gates Company
  & GST** (that route's key is `transaction-config`). Both screens still call the
  same `PUT /site-configuration`, which applies **exactly the keys it is
  handed** — so each posts only its own half and neither may echo back the
  other's fields. `UpdateSiteConfigurationDto.name` is optional for that reason.
- **Post-login landing** is `menu.getFirstAccessibleRoute()`, never a hardcoded
  dashboard the role may not have.
- **Choosing a company** is a two-surface story, both driven by
  `CompanySwitchService`:
  - **At login**, an identity holding **more than one** live membership is sent
    to `/auth/select-company` (`SelectCompanyComponent`) instead of landing
    directly — their role, and so what they may see, differs per company, so
    the server's `pickDefaultMembership` choice is offered rather than imposed.
    One membership → no chooser, unchanged. The route is deliberately **not**
    behind `guestGuard`: the person is already authenticated by then.
  - **Mid-session**, the header `CompanySwitcherComponent` does the same job,
    and only renders when there is somewhere else to go.
  - Both go through `POST auth/switch-company`, so the **server** re-verifies
    the membership and mints the token. Picking a company is never a
    client-side preference. Choosing the already-active company (the one login
    minted) skips the round-trip.
- **Unsaved changes**: `canDeactivate: [pendingChangesGuard]` on form screens.
- **Token refresh** is single-flight (`TokenRefreshService`): a 401, a `409
  MEMBERSHIP_STALE`, or the proactive pre-expiry timer all await the *same*
  refresh, then retry the original request.

### `jayhind-admin-front` differences

Much smaller (~38 TS files), flatter: `core/` holds `api.service.ts`,
`auth.store.ts`, `socket.service.ts`, `toast.service.ts`, `tenant-features.ts`;
`components/` holds `shell`, `tenants`, `plans`, `files`, `hsn`, `ocr-review`,
`config`, `modules`, `error-codes`, `support`, `dashboard`. Same signal/standalone
conventions.

---

## 8. Security rules (non-negotiable)

1. **Never widen `@SharedRead()`** to a mutating handler, and never move it to a
   class. It bypasses both the module permission check and the licence gate.
   The same rule governs **`@ReadOnlyRequest()`**: it tells
   `BillingRestrictionGuard` the handler writes nothing, so putting it on a
   mutation lets a past-due company keep writing. Both are read handler-scoped
   precisely so a controller can't claim them wholesale for its own writes.
2. **Never trust the JWT alone for company membership.** `TenantContextGuard`
   re-verifies against a live `company_members` row on every request precisely
   because a token stays valid for its whole TTL after a suspension or
   revocation.
3. **Never disable or bypass the tenant-scoping hooks**, and never add
   `crossCompany` without a comment justifying it.
4. **Raw SQL must bind `companyId` — for every company-scoped table it names,
   not only the one it selects from.** No exceptions, and **CI now enforces both
   halves**: `ci-guard-raw-sql.ts` judges the statement *and* every joined
   company-scoped table, deriving the scoped-table set from the entity files on
   disk (`tableName` + a declared `companyId`) — the same proxy the hooks
   themselves use, so it cannot drift from the schema. The sweep that closed
   this gap found **53** unscoped joins, not the four BUG-0047 was filed for,
   including `ReportsService.trialBalance`'s `JOIN trx_groups` (the read half of
   BUG-0025, §4.9). The join allow-list is empty; keep it that way.
5. **`INTERNAL_SERVICE_KEY` fails closed.** Don't add a "if unset, allow"
   fallback. (This is the deliberate opposite of the licence doctrine, where a
   missing flag reads as ON — an ungranted licence must not black out a working
   ERP, but an unconfigured credential must be loud.)
6. **Query-string tokens (`?token=`) are honoured only where a route opts in**
   with `@AllowQueryToken()` — file streaming into `<img>`/`<iframe>`, which
   can't set a header. Never make it the default.
7. **No static file serving of user uploads.** See §6.4.
8. **Credential-holding config surfaces stay in `ADMIN_ONLY_PERMISSION_KEYS`.**
9. **Secrets never in git.** `.env`, `*.key`, `*.pem`, `*.sql` are gitignored at
   every level. `.env.example` is the only committed env file.
10. **`ValidationPipe` runs with `whitelist: true, forbidNonWhitelisted: true`** —
    every accepted field must be declared on a DTO. Don't relax it per-route.
11. **Errors must not leak internals.** Throw `ApiException(message, status)`;
    `CustomExceptionFilter` maps Sequelize errors to correct 4xx
    (`UniqueConstraintError` → 409, `ForeignKeyConstraintError` → 409,
    `ValidationError` → 400) and suppresses stacks under `NODE_ENV=production`.
    Note the subclass ordering in that filter — `UniqueConstraintError` before
    `ValidationError`, `ForeignKeyConstraintError` before `DatabaseError`. Two
    more rules live in the same filter, both in **both** backends:
    - **A middleware error keeps its own status.** An error carrying
      `expose === true` and a 4xx `status`/`statusCode` (the `http-errors`
      contract that body-parser and multer follow) is answered with that status,
      so an oversized body is a 413 rather than a 500. `expose` is the safety
      condition — the library sets it false for 5xx — so a 5xx still becomes the
      generic 'Internal Server Error'.
    - **A `catch` that rethrows calls `rethrowAfterRollback(err)`**
      (`src/utility/rethrow-after-rollback.ts`), and nothing else. The
      rollback-and-rethrow shape at the end of a transactional method — `catch
      (err) { await transaction.rollback(); throw new ApiException(err.message,
      HttpStatus.BAD_REQUEST); }` — got two things wrong at once, and the helper
      is where both answers now live:
      - it **overrode every status the block above it chose**, so a deliberate
        `404` eleven lines up reached the caller as a `400`. Nine sites did this
        and it is why D-5 looked like it had not landed on those routes.
      - it **laundered a Sequelize error's message onto the wire** (API-023).
        `err.message` there is raw MySQL: *"Cannot add or update a child row: a
        foreign key constraint fails (`jayhind_client_development`.`trx_item_taxes`,
        CONSTRAINT `fk_trx_item_taxes_taxId` …)"*, or *"Out of range value for
        column 'unitPrice' at row 1"* — the database name, table, constraint and
        column, to any authenticated caller. Worse, wrapping it **erased the class
        the filter switches on**, so the careful mapping four lines above
        (Unique → 409, FK → 409, Validation → 400, DatabaseError → 400 "Invalid
        request parameters") never ran. A Sequelize error must be rethrown
        **untouched**; a plain `Error` is still wrapped as a 400 with its own
        message, because those are written for people.
    - **`request.url` is never recorded raw**, in the error body's `path` or in
      the audit row's `description`. It can BE a credential: the
      `@AllowQueryToken()` routes (§8.6) accept a live bearer token in the query
      string, and echoing the failing URL handed it back to the caller and
      persisted it into `audit_logs`. Use `redactUrl()`
      (`src/const/redact-url.const.ts`) for anything that copies a URL.
12. **Passwords are argon2**, tuned by `ARGON2_*` env vars. Never swap in bcrypt
    or hand-rolled hashing.
13. **Every `@SubscribeMessage` handler scopes itself, because nothing else
    will.** The socket plane has no guard chain (§4.10), so each handler answers
    *"which company does this go to?"* and *"may a trading party ask for this?"*
    itself — or it answers neither, which is BUG-0063: a customer emitting into
    every tenant's UI and reading the host's metrics. And **never add a helper
    that wraps `server.emit`**; the one that existed is what made forgetting the
    scope the default, and it was deleted with the handler that used it.
    (Numbered last rather than inserted, so the §8.6 / §8.8 / §8.11 references
    scattered through this file and the source stay valid.)

---

## 9. UI/UX standards

- **Breakpoints: exactly four values — 480 / 720 / 1024 / 1440px**, as
  `$bp-phone`, `$bp-tablet`, `$bp-laptop`, `$bp-wide` with matching mixins in
  `src/styles/design-system/_breakpoints.scss`. The app's worst layout state was
  never the phone; it was intermediate widths, where 15 scattered breakpoint
  values left one card collapsed and its neighbour not.
  `scripts/breakpoint-guard.js` **fails the lint** on any raw px in a
  `@media`/`@container` width feature that isn't one of the four. The
  grandfather list is **empty** — full enforcement everywhere. A component
  usually needs only *one* of the four; pick the width where *this* component
  actually breaks rather than cargo-culting all four.
- **Container queries over viewport queries** whenever the component's width is
  set by a dialog or panel rather than the browser window — `@media` reads the
  *browser*, so inside a fixed-width dialog it reports "wide" while the content
  column is narrow. The nearest ancestor needs `container-type: inline-size`.
- **Design system** lives in `src/styles/design-system/` (`_tokens`, `_palettes`,
  `_variants`, `_app`, `_auth`, `_voucher`, `_component-lines`,
  `_job-work-table`). Use tokens; don't hardcode colours.
- **Material global defaults** (`app.config.ts`) — don't override per-component
  without reason: cards `appearance: 'outlined'`, form fields
  `appearance: 'outline'`.
- **Dashboard KPIs are one divided strip** (`ds-stat-strip`), not a grid of
  `ds-stat-card`s: the headline figures are read together in one glance, and the
  queues and charts under them are what the screen is for. Track count follows
  the strip's **own** width via container queries (the content column is ~288px
  narrower whenever the nav panel is open, so a viewport query asks the wrong
  question) — 1 / 2 / 4 / one-per-item at 0 / 480 / 720 / 1024. `ds-stat-card`
  stays for the dashboards not yet converted.
- **Numbers are formatted `en-IN`** (`count-up.directive.ts`), not the browser's
  default locale: Indian grouping is lakh/crore — ₹1,32,400, never ₹132,400.
- **The shell's own layout thresholds are on the four-value scale too**
  (`admin.component.ts`): nav is an overlay below 720, a rail-only column to
  1023, both columns at 1024 and up.
- **Dates are `dd/MM/yyyy` everywhere**, on native `Date` values, via
  `CustomDateAdapter` + `MAT_DATE_LOCALE: 'en-GB'`. Don't introduce a second date
  format or a parallel date library for display.
- **Dialogs** have shared SCSS partials in `styles/custom/`: `_form-dialog`,
  `_resizable-dialog`, `_side-panel-dialog`, `_form-errors`. Reuse them.
- **Shared components** in `components/shared/` — `data-table`,
  `paginated-table`, `app-select`, `confirmation-dialog`, `document-viewer`,
  `dynamic-field-renderer`, `voucher-*`, `period-selector`, `breadcrumb`. Check
  here before building a new one.
- **A screen must never offer an action the server will refuse.** Permission,
  licence and voucher-lifecycle mirrors exist so the button state matches the API
  — keep the mirrors in sync, and let the backend stay the enforcer.

---

## 10. API conventions

**Success envelope** — every handler returns it explicitly:

```ts
return { status: true, data: <payload>, message: 'Product created successfully' };
```

**Error envelope** (from `ApiException` / the global filter):

```ts
{ status: false, message: string, statusCode: number, path, timestamp, code? }
```

- **An audit row written from a SERVICE looks like one written by the
  interceptor** (D-48). `AuditInterceptor` has the `Request`, so it states the
  actor, the module and the category; a service writing inside a transaction —
  `ApprovalService` does, correctly, so the status change and its audit row commit
  together — has only a `userId`. That left **4,000+ transition rows** with no
  `module`, no `category` and no `username`, so the Audit Log's own module filter
  returned not one approval. `AuditService.withDefaults` now fills all of it:
  module/category from `moduleFor`/`categoryFor` (pure), and the actor from
  `TenantContext.actor`, which `TenantContextGuard` populates from the same
  `request.user`. **Put defaults in the service, not in each caller** — patching
  `ApprovalService` alone would have left the next service to repeat the omission.
  An explicitly-stated value always wins (`??`), `enqueue` fills them *before* the
  queue hop (the worker has no context, same reason it snapshots `companyId`), and
  **outside an HTTP request no actor is invented**. One more trap: the two paths
  used different words for one document — `auditEntityForSource` reconciles
  `JournalSourceType` onto the **controller's** `@Audit()` vocabulary, because
  that is what the screen filters by and what `ENTITY_CATEGORY_MAP` is keyed by.
- **The audit trail's scope is a decision, and it is enforced.** `@Audit()` is
  opt-in (a verb-only rule would log every `POST …/list` as a create), so the
  coverage is a choice rather than an accident: **money and identity first**
  (D-36). `payroll`, `employee`, `files`, `stock-conversion`, `users` and the three
  voucher controllers are inside the line and `src/const/ci-guards/audit-coverage.const.ts`
  keeps them there — a new mutating handler in one of them fails a DB-free unit
  test. Masters, job work, chat and notifications are deliberately outside it for
  now. Two things to know before reading a handler as unaudited: the voucher
  lifecycle transitions are audited from **`ApprovalService`**, inside the same
  transaction as the posting they perform (better than a decorator, and invisible
  to a static check — hence `SERVICE_AUDITED_HANDLERS`), and a `@Post` that reads
  needs `@ReadOnlyRequest()` rather than `@Audit()`.
- **A voucher line is written through `POST|PUT /trx`, and nowhere else.**
  `POST /trx-items` and `PUT /trx-items/:id` were removed (D-38) along with the
  `DELETE`/`restore` pair before them: they wrote a line without re-deriving the
  voucher's money or re-running posting, so an edit to a **posted** line left its
  journal entries untouched — a voucher silently out of step with the ledger it had
  already written. `trx-item-taxes` still has its writers because the SPA's list
  surface sits next to them; both check that every id they name is the caller's own.
- **`POST` is used for paginated list/search endpoints** (`POST /products/list`)
  because pagination + filters need a body. Two consequences:
  - Audit is **opt-in** via `@Audit()` rather than verb-sniffing — a verb-only
    rule would log every list call as a "create".
  - A read-shaped POST must carry **`@ReadOnlyRequest()`** (or already carry
    `@SharedRead()`), or `BillingRestrictionGuard` refuses it during billing
    grace. **Only ever put it on a handler that writes nothing** — see the
    decorator's SECURITY CONTRACT. Forgetting it is safe (the handler just stays
    blocked during grace); adding it to a mutating handler is not.
- **`pageSize` is capped at 1,000, and it CLAMPS rather than refusing.**
  `MAX_PAGE_SIZE` / `boundedPageSize()` in *both* backends'
  `src/const/pagination.const.ts`. It had no `@Max` at all, and one authenticated
  request could ask for a whole table — `POST /audit-logs/list
  { pageSize: 1000000 }` returned 19,381 rows and 12.64 MiB from a process that
  serves every tenant. Clamping is what makes the bound safe to add without
  breaking a caller (the response echoes the **clamped** value, and `totalPages`
  is computed from it), and it is also the one way it bites: **asking for more
  does not fail, it silently returns 1,000.** Anything that genuinely wants every
  row must page — `jayhindi-client-front/src/utils/fetch-all-pages.ts`, which
  eleven callers use. That is only sound because `withStableOrder` appends the
  primary key to every list's `ORDER BY`, so two pages of one query cannot
  overlap or skip a row. `PlatformUsersService` keeps a tighter 200 of its own,
  deliberately — it is the only list that reads across every company.
- **A filter naming a column no model declares is a `400`**, the same answer an
  undeclared *sort* column already got; it used to be dropped silently, which
  returned the **unfiltered** table to a caller who asked for a subset. A dotted
  `alias.column` key whose alias *this* query does not include is still applied
  to nothing — the frontend sends conditional dotted keys, so refusing it would
  break screens — but it is named in the response's `ignoredFilters`, present
  only when something was ignored. The grid renders that key, so a filter that
  did nothing says so on screen — which is the whole reason it may answer 200.
- **A NEGATIVE filter is widened with `OR col IS NULL`, and it has to be**
  (BUG-0048). `notContains`, `notEquals` and `dateIsNot` are the three negations
  the shared grid filter offers on **every** list screen, and SQL's three-valued
  logic makes `NULL NOT LIKE '%x%'` NULL rather than true — so a bare `NOT LIKE`
  silently drops every row whose column is empty, with no error and nothing in
  `ignoredFilters` to say so. On `products.availabilityDate`, empty on all 587 of
  a QA tenant's goods, *"is not 01/01/2000"* returned an **empty grid**. The rule
  it restores is the one to remember: **a filter and its negation must partition
  the population** — `contains X` + `notContains X` equals the grid's own row
  count. `notNull()` is the single definition, and **both backends have a copy**
  (`client-back/src/services/common-data.service.ts`,
  `admin-back/src/services/pagination.service.ts`); `scripts/check-mirrors.js`
  does not compare them, so a fourth negative match mode needs the same treatment
  in both places by hand.
- **A filter on a JOINED column marks that alias's include `required`, and that
  is deliberate.** Sequelize emits the entire top-level `where` inside the
  subquery it builds for a limited query with a duplicating include, while an
  include that is not `required` is joined in the OUTER query — so the condition
  and the join it names land in different halves of the statement and MySQL
  answers `ER_BAD_FIELD_ERROR`, which surfaces as a 400 (API-019). `required` is
  the only lever that moves the join in with the condition; `include.subQuery`
  is recomputed from it and spelling the condition Sequelize's own
  `$alias.column$` way changes nothing. The cost is an INNER JOIN on that alias,
  invisible for every positive match mode (`NULL LIKE '%x%'` is NULL, so a
  LEFT JOIN discarded those rows too) and visible only in a mixed `Op.or` group.
  A **HasMany** alias is not rescued by this — its condition would have to move
  into `include.where`. Sorting resolves the same aliases but never marks them
  required: a sort must order rows, never drop them.
- **Alias resolution asks the include tree, not the `as` key.** `resolveIncludeRef`
  (both backends) resolves an include declared without `as` (`{ model: TrxNature }`),
  one declared as `{ association: 'x' }`, and an alias nested a level down —
  `role` lives under `membership`, because `User.roleId` is retired, and Sequelize
  names that join `` `membership->role` ``. A blind `x.as` lookup is what made two
  grids' filters silently return every row (API-020), and it hit `commonSearch`
  too: an **unqualified** column key is resolved against the ROOT model, so the
  root's own columns were searched twice and the included model's never (API-022).
  An include whose alias cannot be resolved is skipped, never emitted unqualified.
- **A searched page returns the same shape as an unsearched one.** `commonSearch`
  and dotted sorts strip the HasMany includes so their own references resolve;
  `hydrateStrippedIncludes` re-reads the page's ids with the tree the caller asked
  for before the response goes out. Without it the Products grid's Category column
  blanked whenever someone typed in the search box (API-021).
- **`isDeleted` is the archived VIEW, not a hint.** Both paginators answer it with
  `paranoid: false` **plus** a `deletedAt IS NOT NULL` predicate — a caller's own
  `paranoid: false` shows both sides, so it cannot stand in for the predicate
  (that is how the hub's `/companies/list` answered the archived view with ten
  live companies). A model with no `deletedAt` gets an **empty page**, never the
  live list. Implement it in the paginator and nowhere else: the hub had a second
  copy in `hsn.service.ts`, and because the paginator strips the archived
  predicate back off the `where` to count the opposite view, the caller's copy
  survived the strip and the archived view reported `activeCount: 0` beside 22,609
  live rows.
- **The platform directory sorts and filters on an allow-list.** `/users/list`
  (hub → `/internal/users/list`) is the one read that spans every customer, and
  `User` declares `password`, `tokenVersion` and the reset-token columns. Sorting
  or filtering by any of them is a `400`, not a silent drop — and `commonSearch`
  there stays hand-written (name/email) rather than `applySearches`, which would
  expand to every string column the model has.
- `@HttpCode(200)` on POST list endpoints so they don't return 201.
- Route params validated with `ParseIntPipe`.
- Bulk endpoints take `BulkIdsDto` and return `bulkDeleteResponse` /
  `bulkRestoreResponse`, built from `BulkActionResult` = `{ affected, skipped }`.
- **`scripts/dump-routes.ts` is the safety net for module surgery.** It boots the
  real `AppModule` (proving every provider resolved) and prints every route
  sorted. Capture before a refactor, diff after:
  ```bash
  npx ts-node -r tsconfig-paths/register scripts/dump-routes.ts > before.txt
  ```
- **OpenAPI is generated, not hand-annotated.** Both backends publish Swagger UI
  at `/api/docs` and the schema at `/api/docs-json`. It comes from the
  `@nestjs/swagger` CLI plugin (wired in `nest-cli.json`), which reads the
  `class-validator` decorators already on every DTO — so it cannot drift from
  what `ValidationPipe` actually enforces, and adding a DTO field publishes
  itself. `introspectComments: true` means a field's doc comment becomes its
  description. **Don't hand-write `@ApiProperty` decorators**; fix the DTO
  instead. `dtoFileNameSuffix` includes `.controller.ts` because several DTOs are
  declared next to the controller that uses them.

---

## 11. Testing & QA

| Layer | Where | Run |
|---|---|---|
| Unit (Jest) | `src/**/*.spec.ts` — 112 suites / 1572 tests in client-back, 9 / 176 in admin-back; mostly beside `const/*.const.ts` | `npm test` |
| Architecture guards | `src/user-module-boundary.spec.ts`, `src/const/ci-guards/*` — raw-SQL, cached-state, scope-registry, marker-decorator and **`@Body()`-is-a-DTO** | `npm test` + `scripts/ci-guard-*.ts` |
| Rule-7 parent ids | `qa-artifacts/tests/transactions/jobwork-scope.spec.ts` and `tests/api/parent-scope.spec.ts` — every caller-supplied parent id on a write, probed with a stranger resolved from `company_members` (never from a fixture: the QA world **shares** an identity between two tenants on purpose) | `npm run qa:transactions` |
| Shared-read exposure | `qa-artifacts/tests/permissions/shared-read-party.spec.ts` — sweeps **every** `@SharedRead()` route as a trading party and asserts the allow-list exactly (D-46). Route list comes from the regenerated inventory, so a new shared read is swept the day it lands | `npm run qa:permissions` |
| The storage seam | `qa-artifacts/tests/storage/` — nine properties over the tree the ERP now owns (§6.4): the index against the **disk** as a census, keys inside their own company's folder, traversal refusals, the spool drained on refusal too, no static serving, who may be handed the bytes (BUG-0057), and every owned file still having its owner (BUG-0058) | `npm run qa:storage` |
| GSP path, mocked at the hub's outbound HTTP | `qa-artifacts/tests/gst/gsp-stub.ts` — a **schema-strict** WhiteBooks stub (D-2). Everything above the `fetch` is real: `MasterHubClient`, `InternalServiceGuard`, the hub's licence and GSTIN assertions, the session cache and retry, the error mapper, the metering. It validates the payload against the *restated* INV-01 / NIC schemas, so a green conformance test means the portal would have accepted it | `npm run qa:gst` |
| The hub↔ERP control plane | `qa-artifacts/tests/cross-service/` — a company's whole life across **both** databases, as ten agreement properties: provisioning is all-or-nothing *and* leaves a company that can post; a licence flip is live on the next request; hard delete is total (the census comes from `information_schema`, so a new table is covered the day it is created) and bounded (a shared login survives). ⚠️ It **creates and destroys companies** — every one is a `QA·9A …` scratch tenant and `destroyScratch` refuses anything else | `npm run qa:cross-service` |
| GST rules vs. the statute | `qa-artifacts/tests/gst/` — `gst-rules.ts` restates the rules from the Acts and notifications, and four specs measure the rate schedule, GSTIN validation, the computation matrix and the HSN master against it. Every rule is cited, with the date it was checked, in `qa-artifacts/docs/findings/gst.md` — **check that file before defending a GST number**, because rates and thresholds change by notification | `npx playwright test --project=api tests/gst` |
| Every displayed figure is reproducible | `qa-artifacts/tests/reports/` — the statements and books against `statement-rules.ts`, the party account and the stock position against `party-rules.ts`, both **restated** rather than imported. Includes the two census tests that compare the derived balance caches with `journal_lines` (BUG-0042) and the delta tests that ask whether a figure *moves* by the right amount, which is the half an equality test cannot see | `npm run qa:reports` |
| Async work & the deliberate outages | `qa-artifacts/tests/cross-service/` — nine properties (A1…A9) over what is allowed to be slow or absent: the scan pipeline's two error classes across four hops, the queue proved on a **side effect** rather than on its flag, Redis/hub/sidecar stopped one test at a time (D-29 via `framework/services.ts`), socket delivery measured with two real connections, and every `@Cron` method's single-runner claim. The fake OCR lane is the sidecar's **own** stub (D-32); `@real-model` is opt-in and excluded by `--grep-invert` | `npm run qa:cross-service` · `npm run qa:cross-service:real-model` |
| Cross-repo mirror drift | `scripts/check-mirrors.js` (**this** repo — only it sees both submodules). Checks 1–3 compare data; check 4 compares **behaviour**, running both `voucher-lifecycle` implementations against `scripts/vectors/` (§13.4). Needs esbuild from one submodule's `node_modules` and **fails loudly** rather than downgrading if none is present | `node scripts/check-mirrors.js` |
| QA harnesses | `scripts/qa-*.ts` (~55 in client-back, 5 in admin-back) | `npx ts-node -r tsconfig-paths/register scripts/qa-<name>.ts` |
| Style guard | `scripts/breakpoint-guard.js` | `npm run lint` (client-front) |
| E2E / UI | `qa-artifacts/` (Playwright) | see its README |
| OCR | `jayhind-ocr-service/tests` (pytest, fake reader/extractor — no model download) | `pytest` |
| Data repair | `client-back/scripts/fix-duplicate-party-identities.ts` — cleans up the duplicate/orphan identities the pre-2026-08-20 party rule left behind. **Dry-runs by default**; `--apply` writes, `--merge <from>:<to>` folds one identity into another (repointing every FK that actually holds rows, then deleting the source) | `npx ts-node -r tsconfig-paths/register scripts/fix-duplicate-party-identities.ts` |
| Data repair | `client-back/scripts/purge-orphaned-files.ts` — deletes the bytes BUG-0058 stranded (a `stored_files` row whose owning record is gone: unreachable, undeletable, still charged to the storage quota). **Dry-runs by default**; `--apply` writes, `--company <id>` narrows. Refuses to run on an `ownerModule` it has no back-reference mapped for | `npx ts-node -r tsconfig-paths/register scripts/purge-orphaned-files.ts` |

The QA scripts expect a **running stack** and hit real endpoints; the Jest suite
needs no DB. When you change a domain rule in `src/const/`, update its `.spec.ts`
in the same commit — that's where the rules are actually tested.

---

## 12. How to add things safely

### A new tenant-scoped entity
1. Model in `src/entities/` extending `SoftDeletableModel` (if soft-deletable),
   with a `companyId` column + `@ForeignKey(() => Company)`. The scoping hooks
   pick it up automatically from `rawAttributes`.
2. Register it in `database.providers.ts` `addModels([...])`.
3. Classify it in `src/const/tenant-scope-registry.const.ts` — **an unclassified
   entity is a failing test.**
4. Migration via `npm run migration:create`.
5. Run `npm test` — the scope-registry and boundary specs are your safety net.

### A new endpoint
1. DTO in `src/dto/` with class-validator decorators (`whitelist` strips
   anything undeclared). ⚠️ **A `@ValidateIf` may only read a field the CALLER
   sets.** `CreateUpdateProductDto` is shared by `POST /products` and
   `POST /services`, and each controller overrides `itemType` with its own — so a
   predicate reading `o.itemType` was reading the caller's value, not the row's,
   and `POST /services` refused a body for want of a measurement unit while
   D-9's mismatch refusal became unreachable (BUG-0019). A rule that depends on
   something the route decides belongs in the **service**, which is the first
   place that knows it. It must be a **class**: `ValidationPipe` reads
   class-validator metadata off the body's runtime class, so an inline
   `@Body() b: { … }`, an `interface`, a `Partial<Dto>` and a bare array all erase
   to `Object` and the raw JSON reaches the handler unchecked.
   `scripts/ci-guard-body-dto.ts` fails on all four (a bare array whose wire
   format cannot change may instead be validated in place with
   `@Body(new ParseArrayPipe({ items: Number }))`).
   ⚠️ **Never give an `@IsOptional()` field a property INITIALISER on a DTO an
   update route shares.** `ValidationPipe` runs with `transform: true`, so it
   *instantiates* the class: `status?: Status = Open` is not "the default when
   creating", it is a value the pipe supplies on **every** request that omits the
   field, `PUT` included — and the service then hands the whole object to
   Sequelize, which cannot tell "the caller said open" from "the caller said
   nothing". That is BUG-0020: renaming a **closed** financial year reopened it
   (defeating BR-ACC-5), editing the **active** one cleared `isActive` and left
   the company with no active year, and a rename of a tax slab reset its scope,
   calculation type, compounding, priority and `status` — un-archiving it into
   every rate picker. `whitelist: true` cannot help, because the property is
   declared rather than unknown. Put the default on the **column**
   (`@Column({ defaultValue })`), which is the one place a default cannot also be
   an instruction; an omitted field then arrives `undefined`, which Sequelize
   skips on an update and MySQL fills on an insert. A payload that genuinely
   replaces a collection wholesale (`CreateUpdateProductPricingDto`'s
   `prices = []`) is the legitimate exception — say so in a comment.
   ⚠️ **A DERIVED column must never be taken from the body, even when the DTO
   declares it.** `whitelist` only strips fields nobody declared, so a declared
   field the server owns sails straight into the row: `trx.paidAmount` did exactly
   that, and any caller who could raise a voucher could mark it paid with no
   payment behind it (BUG-0030). The pattern to copy is the one the voucher totals
   already follow — `totalAmount`, `totalTax`, `chargesTotal` and `grandTotal` are
   all re-derived from the persisted lines in `TrxWriteService` and the body's
   values ignored. Leave the DTO field if a client sends it; overwrite it in the
   service. **A figure the server owns is a figure the server writes.**
2. Service method in `src/services/` — pure domain rules go in
   `src/const/<x>.const.ts` with a `.spec.ts`.
3. Controller handler returning `{ status: true, data, message? }`.
4. Gate it: `@UseGuards(RoleMenuGuard)` + `@Permissions('<key>', ['canAdd'])`.
   Read-only cross-module lookup? `@SharedRead()` instead — read-only *only*.
   A read-shaped `POST` (list/search/report/export/preview) also needs
   `@ReadOnlyRequest()` so billing grace doesn't refuse it (§10).
5. New permission key → add to `src/const/permission-registry.ts`, map it in
   `src/const/module-licence.const.ts`, mirror both on the frontend
   (`core/navigation/module-licence.ts`, `navigation.config.ts`), and add it to
   the role-permission seeder.
6. Mutation? Tag `@Audit('<EntityType>')`.
7. Register the controller in its **feature module**, not `app.module.ts`.
8. Multi-step write? Open a transaction in the controller, pass `{ transaction }`
   down, rollback + `ApiException` on error.

### A new frontend screen
1. Standalone component + a `*.routes.ts` entry with `loadComponent`.
2. `canActivate: [permissionGuard]` + `data.permission`; add
   `canDeactivate: [pendingChangesGuard]` if it has a form.
3. Add the `NavItem` to `navigation.config.ts` with the matching `permissionKey`.
4. Use `ApiService`, signals for state, `inject()` for DI.
5. Styles: design-system tokens + the four breakpoints; check
   `components/shared/` before building new UI.
6. `npm run lint` (runs the breakpoint guard).

### Touching cross-service contracts
Changing an endpoint on the `/internal/*` or `/api/v1/*` plane, a `FileCategory`
string, the `ExtractedInvoice` schema, or a licence flag means **both repos change
together**. Push the sub-repo first, then bump the submodule pointer here:

```bash
cd jayhind-client-back && git push
cd .. && git add jayhind-client-back && git commit -m "bump jayhind-client-back" && git push
```

---

## 13. Known gaps & areas to improve

Honest list. The eight items previously here were worked through on
**2026-08-17**; what remains is below, followed by what was closed and how, so
nobody re-opens a settled question.

### Still open

1. **Test coverage is uneven — a program of work, not a bug.** `src/const/` is
   well covered (1572 unit tests across 112 suites in client-back, 176 in
   admin-back, all passing and needing no DB). Services and controllers rely
   mostly on the `qa-*.ts` harnesses, which need a live stack and aren't run in
   CI. Neither frontend has meaningful component tests (`admin-front` has no
   test target at all). This can't be closed in one change; the useful next
   steps, in order: (a) get the three `ci-guard-*.ts` scripts and `npm test`
   running in CI on both backends — they're fast and DB-free; (b) add a test
   target to `admin-front`; (c) convert the highest-value `qa-*.ts` harnesses
   into Jest suites with a seeded test DB.
2. **Migrations are a single squashed baseline** in both backends
   (`00000000000000-initial-schema.ts`). Correct while no environment is
   deployed. The moment one is, incremental migrations become mandatory and the
   baseline must never be edited again. Nothing to do today — this is a tripwire,
   not a defect.
3. **Licence flags fail open on a database read failure.** `licenceFor()`
   returns `ALL_ON` when the `companies` read throws, which grants the three
   *billable* gateway capabilities (`ewb`, `einvoice`, `ocr`) as well as the six
   nav modules. The fail-open itself is deliberate and documented ("a database
   hiccup must not black out an ERP") and is now loudly logged and attributable
   (see closed #8), but whether a DB outage should also authorise billable
   outbound GSP calls is a **product decision**, not a code cleanup — it needs
   the owner, so it was deliberately not changed.
4. **One rule enforced at some of the places that need it.** Not a single
   defect — a *shape*, and the one this codebase has produced most often:
   BUG-0024 (`allowDelete` honoured by the archive stage and not the erase),
   BUG-0028 (the financial-period gate honoured by `ApprovalService` and not by
   `TrxWriteService`'s approved-edit branch), BUG-0032 (three ownership checks
   written as module-local functions and never carried twenty lines to the
   module's transactional writes), BUG-0056 (one of two JWT minters setting the
   claim the guard enforces), BUG-0060 (the queue's duplicate-id no-op, fixed at
   the seam rather than at the one call site that showed it) and BUG-0062 (the
   same unreachable fallback in **both** queues, fixed with one shared rule).
   The check that finds all of them is the same question — *what are all the
   writers of this effect, and which of them clear this gate?* — and **it is a
   grep, not a code review**. There is no mechanism for it, which is why it is
   still open; what there is, is the habit, and the doc comments in each of those
   files now name their siblings.

### Closed on 2026-08-25

1. ~~`voucher-lifecycle` parity is checked by name, not behaviour~~ →
   [`scripts/vectors/voucher-lifecycle.vectors.json`](scripts/vectors/) is the
   shared table the gap itself asked for — the **exhaustive cross-product** of the six facts a
   decision turns on — 160 action vectors + 7 recall, **487 behavioural comparisons** — and `check-mirrors.js` now *runs* both
   implementations against it (`scripts/lib/load-mirror-module.js` bundles each
   pure module out of its own repo with esbuild, so the check needs one
   submodule's `node_modules` present and **fails loudly** rather than
   downgrading if none is).

   The table lives in **this** repo, not in either submodule: *"both repos' suites
   run against"* read literally would mean two copies of a vector file in two
   independent git repos, which is the same mirror problem one level up.

   Each row is compared **three** ways — backend, frontend, and the table's own
   restatement of the rule — and the third answer is not ceremony. Re-injecting
   BUG-0024 into `client-back` alone reports `DRIFT` and names the wider side;
   removing the same rule from **both** sides reports `RULE CHANGED`. A name check
   passes both; a two-way parity check passes the second. Only a restated table
   catches a rule both sides forgot together, which is why every `*-rules.ts`
   module in `qa-artifacts` is a restatement rather than an import.

   The name comparison is kept alongside, because it answers what the vectors
   cannot: *has a decision function appeared with no vector covering it?*
   **Add vectors in the same commit as a rule.**

2. ~~The two `FileCategory` enums are documented as a cross-service contract~~ →
   the claim is **deleted** (§6.4). It lapsed on 2026-08-15 when storage moved
   into the ERP, and `FileCategory.Export` — with no counterpart in the hub's enum
   at all, written on every company export — was the proof it had. A mirror rule
   that cannot fail is worse than no rule: it reads as coverage. The doc comments
   now record that it lapsed and when, rather than asserting a contract that is
   not there.

### Closed on 2026-08-17

1. ~~Referenced design docs missing~~ → [`_ops/README.md`](_ops/README.md)
   documents exactly which documents are absent and decodes the in-source `§`
   references; [`_ops/adr/frozen-contracts.md`](_ops/adr/frozen-contracts.md) is
   reconstructed and verified against both the enforcing and consuming code.
   `README.md` no longer points at paths that don't exist.
   `MASTER_DEVELOPMENT_PLAN.md` was deliberately **not** re-invented.
2. ~~`BillingRestrictionGuard` refuses read-shaped POSTs~~ → `@ReadOnlyRequest()`
   (`src/decorators/read-only-request.decorator.ts`), honoured by the guard
   alongside `@SharedRead()`, applied to **52 verified read handlers**. Markers
   rescue `POST` only — never PUT/PATCH/DELETE — so a mis-decorated destructive
   handler is still blocked by the method check. 15 specs.
3. ~~Mirrored constants drift silently~~ →
   [`scripts/check-mirrors.js`](scripts/check-mirrors.js) in this repo (the only
   place that sees both submodules). Compares the `LicensedModule` enum,
   `LICENSED_MODULE_LABEL`, `MODULE_BY_PERMISSION_KEY`, and every nav
   `permissionKey` against the backend registry. Verified to actually fail on
   injected drift.
4. ~~`.env.example` ships live-looking values~~ → both replaced with
   placeholders. **⚠️ The old `OCR_SERVICE_KEY` is in git history and should be
   rotated** (see §3).
5. ~~`MASTER_API_KEY` legacy fallback~~ → removed from `MasterHubClient`, from
   the hub's `InternalServiceGuard` (the half that actually *accepted* it), and
   from three QA scripts. `INTERNAL_SERVICE_KEY` only, failing closed.
6. ~~Permission cache not invalidated on write~~ → **this was wrong.**
   `role-permission.service.ts:165` already busts `role-perms:<roleId>` after
   every upsert. No change needed.
7. ~~No API schema/OpenAPI~~ → `@nestjs/swagger` + its CLI plugin in both
   backends, generated from the `class-validator` DTOs rather than hand-annotated.
   598 paths / 172 schemas (ERP), 81 / 43 (hub). See §10.
8. ~~Licence fail-open is silent~~ → the three cases (row read, row missing, read
   threw) are now distinguished and separately logged; "row missing" was
   previously silent. Semantics unchanged — see still-open #3.

Also fixed in passing: the `ci-guard-raw-sql` script had been **failing** on one
pre-existing site (`table-export.service.ts:81`, an `information_schema` column
lookup). Verified safe — every row-reading statement in that service binds
`companyId` — and allow-listed with that justification. A permanently-red guard
is one nobody reads.

---

## 14. Quick reference — where to look

| Question | File |
|---|---|
| What runs when a request arrives? | `client-back/src/app.module.ts` (doc comment) |
| How is tenancy enforced? | `src/utility/tenant-context.ts`, `src/database/tenant-scoping.hooks.ts` |
| Who can call what? | `src/const/permission-registry.ts`, `src/guards/role-menu-permissions.guard.ts` |
| May a trading party read this? | `src/guards/shared-read.decorator.ts`, `src/guards/shared-read-party.guard.ts` (D-46) |
| May a trading party receive this over a SOCKET? | nothing generic — the socket plane has no guard chain, so `src/socket/socketGateWay.ts` checks inline off the `userKind` it records at connection (BUG-0063) |
| May a trading party download this FILE? | `src/const/party-file-access.const.ts` (BUG-0057) — the shared-read guard does not cover the delivery route |
| Which modules are licensed? | `src/const/module-licence.const.ts`, `src/services/company-licence.service.ts` |
| How do the two servers talk? | `client-back/src/services/master-hub/master-hub.client.ts`, both `guards/internal-service.guard.ts` |
| How are files stored? | `client-back/src/services/storage/` + `src/const/storage-key.const.ts` — **local to the ERP since 2026-08-15**, §6.4. `hub-upload.const.ts` still holds the multer options and the category names; `admin-back/src/services/storage/` is the hub's own tree, no longer the ERP's |
| How is a voucher posted? | `src/services/posting.service.ts`, `src/const/posting.const.ts` |
| Which tax does this supply bear, and why? | `src/const/gst.const.ts` (`isInterStateSupply`, `gstLineTax`), `src/const/gst-returns/gst-classification.const.ts` (the deemed-inter-state set) |
| What unit code does a statutory document declare? | `src/const/uqc.const.ts` `resolveUqc` — the portal's own list, used by GSTR-1 table 12, the IRN payload and the e-way bill alike (BUG-0037) |
| Is this GSTIN real, and what does it say? | `src/const/gstin.const.ts` (grammar, check digit, state, PAN) |
| May this GSTIN be SAVED on a master? | `src/const/gstin.const.ts` `gstinProblems` — all four checks at once (D-51). The OCR/import lanes keep the old tolerance deliberately |
| Was this tax rate in force on that date? | `src/const/tax-validity.const.ts` `isInForceOn` (D-50) — mirrored on the frontend; the hub's HSN master is dated too |
| Which book does this account appear in? | `src/const/account-type.const.ts` `bookForAccountType` (D-54) — derived, so a new type cannot fall out of both |
| Who owes the tax on this purchase? | `src/const/posting.const.ts` `LegRole.RcmPayable` + `gst-returns/self-invoice.const.ts` (D-52) |
| Is a GST rule we implement still the current one? | `qa-artifacts/docs/findings/gst.md` — every rule cited to an official source with the date it was checked (Phase 7A) |
| What may a voucher have done to it? | `src/const/voucher-lifecycle.const.ts` |
| When may it post? | `src/const/financial-year.const.ts`, `src/services/financial-year.service.ts` `assertPostingAllowed` |
| What does a document still owe — and owe back? | `src/const/outstanding.const.ts` (D-18) |
| What does a PARTY owe, and which of the two answers am I reading? | `src/services/party-statement.service.ts` — the ledger side is the two control heads, the document side is `trx` (BUG-0040) |
| Why does the funds summary disagree with the trial balance? | the caches, not the ledger — §4.9, `POST /trx-accounts/rebuild-balances` (BUG-0042) |
| What does "today" mean on this server? | `src/const/local-day.const.ts` `todayIso` — the LOCAL day, not `new Date().toISOString().slice(0,10)`, which names yesterday between 00:00 and 05:30 IST (API-033). ⚠️ **`CURDATE()` in raw SQL is still the UTC day** — BUG-0050, §4.8 |
| Which stock movements went negative on a date? | `src/const/inventory.const.ts` `negativeOnDates` (D-44) |
| What did a component cost on the day it was consumed? | `src/services/inventory.service.ts` `applyAsOfDateCost` (BUG-0033) |
| What may a job work order / dispatch / challan have done to it? | `src/const/job-work-flow.const.ts` (the quantity rule everything derives from), `job-work-dispatch.const.ts` (the three invariants), `job-work-challan.const.ts` (the purpose table) |
| Is this job-work id the caller supplied actually ours? | `src/services/job-work-ownership.ts` (BUG-0022, BUG-0032) |
| Identity vs. membership | `src/entities/company-member.entity.ts` |
| How one person ends up in several companies | `client-back/src/services/users.service.ts` `linkExistingIdentity`, `company-admin.service.ts` `add` |
| Choosing/switching company | `client-back/src/services/auth.service.ts` `switchCompany`, `client-front/src/services/company-switch.service.ts`, `components/auth/select-company/` |
| Why one party has a row per company | `src/entities/user-details.entity.ts`, `src/migrations/20260820000000-user-details-company-scope.ts` |
| Frontend nav & permissions | `client-front/src/core/navigation/navigation.config.ts`, `guards/permission.guard.ts` |
| Breakpoints / responsive rules | `client-front/src/styles/design-system/_breakpoints.scss`, `scripts/breakpoint-guard.js` |
| All routes | `npx ts-node -r tsconfig-paths/register scripts/dump-routes.ts` (client-back) |
| API schema / request shapes | `/api/docs` + `/api/docs-json` on :3000 and :3100; `src/utility/swagger.ts` |
| The frozen cross-service contracts | `_ops/adr/frozen-contracts.md` |
| Which planning docs are missing, and what `§20.9` means | `_ops/README.md` |
| Is a queue's "degrade without Redis" fallback actually reachable? | `src/const/queue-deadline.const.ts` `withQueueDeadline` (BUG-0062) — ioredis buffers a command issued during an outage for ever, so an unbounded `await queue.add(...)` makes the `catch` below it dead code and hangs the request instead |
| Why did a re-extract do nothing? | `InvoiceScanService.discardFinishedJob` (BUG-0060) — BullMQ treats `add()` with a held `jobId` as a duplicate, and `removeOnFail: 100` holds a failed scan's id |
| Which of the three empty GSTIN answers is this? | `src/services/gst.service.ts` `lookupRaw` (BUG-0061) — unknown number vs. no registry key vs. hub unreachable; `fetchRaw` flattens all three and must not be used where a person reads the result |
| Do the two `voucher-lifecycle` files agree about what a rule MEANS? | `scripts/vectors/voucher-lifecycle.vectors.json` + `node scripts/check-mirrors.js` — 487 behavioural comparisons, each row checked against both sides *and* against the restated rule |
| Are the mirrored constants still in sync? | `node scripts/check-mirrors.js` |

---

## 15. Keeping this file current

Update this file in the **same commit** as the change when you:

- add or remove a service, port, or database;
- change the guard chain, its order, or any error code in §4.7;
- add a permission key, licensed module, or admin-only key;
- change a cross-service contract (`/internal/*`, `/api/v1/*`, file categories,
  the `ExtractedInvoice` schema);
- change a UI/UX standard (breakpoints, date format, Material defaults);
- add or remove a CI guard or a required env var;
- close one of the gaps in §13 (delete the entry — don't leave it stale).

Keep it accurate over exhaustive: this file is the map, and the doc comments in
the source are the territory. When they disagree, **the source wins** — and the
map should be fixed.
