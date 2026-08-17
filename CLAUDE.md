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
node scripts/check-mirrors.js     # cross-repo constant drift (§13)
```

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
| `AUDIT_QUEUE_ENABLED`, `INVOICE_SCAN_QUEUE_ENABLED` | client-back | BullMQ/Redis; both degrade gracefully |
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
  `membershipVersion`, `identityId`, `licence`, `billingRestricted`.
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

#### Rules you must follow

1. **Never** add `{ crossCompany: true }` to make an error go away. It is legal in
   exactly two situations: (a) the query that *establishes* tenant context
   (`TenantContextGuard`), and (b) genuinely company-agnostic reads. Every use
   needs a comment saying why.
2. Code that runs **outside an HTTP request** — cron ticks, queue workers,
   seeders, `scripts/*.ts` — has **no store**. It must wrap work in
   `TenantContext.run({ companyId, … }, fn)` (see `due-reminder.service.ts`,
   `job-work-alerts.service.ts`, `maintenance.service.ts`) or pass
   `crossCompany` explicitly. There is no third option.
3. **Raw SQL is not covered by the hooks.** Every `sequelize.query(...)` must
   carry an explicit `companyId` bind — `TenantContext.requireCompanyId()`
   threaded into `replacements`. `npx ts-node scripts/ci-guard-raw-sql.ts`
   enforces this and judges *new* sites automatically.
4. **Never keep per-company state in a service field.** `@Injectable()` is a
   process singleton; a `private cache = new Map()` means the first company to
   populate an entry decides what every other company reads. If a cache is
   genuinely needed, key it `` `${companyId}:${…}` `` and expect
   `scripts/ci-guard-cached-state.ts` to require an allow-list entry.
5. `where` composition: use `andCompose`-style AND nesting, and count keys with
   `Reflect.ownKeys`, **not** `Object.keys` — an `Op.and`/`Op.or` where (search
   clauses, and Sequelize's own paranoid-delete wrapper) is keyed by a *symbol*,
   and `Object.keys` reports it as empty. That exact mistake once made
   `Model.update({…},{where:{id}})` update every row in the company.
6. When adding a `where` to an `include`, set `required` explicitly if the caller
   didn't. Sequelize silently flips `required: true` when an include carries a
   `where`, turning LEFT JOINs into INNER JOINs and making rows with nullable FKs
   vanish. The hooks already default it to `false`; don't undo that.

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

**`User.create()` may only be called in `services/users.service.ts`** — enforced
by `src/user-module-boundary.spec.ts`. Everything else goes through
`UsersService.create` / `UserProfileService.findOrLinkUser`.

### 4.5 Permissions — four independent gates

| Gate | Where | Grain | Admin bypass? |
|---|---|---|---|
| `RolesGuard` + `@Roles()` | global | role name | n/a |
| `RoleMenuGuard` + `@Permissions(key, actions)` | **opt-in** `@UseGuards` | per module key × action | **yes** — Admin is never locked out |
| `ModuleLicenceGuard` | global | licensed module | **no** — provider's decision |
| `BillingRestrictionGuard` | global | HTTP method | no |

**`@Permissions('<key>', ['canView'|'canAdd'|'canEdit'|'canDelete'|'canViewDelete'|'canApprove'])`**
keys are stable strings listed in `src/const/permission-registry.ts` — the single
source of truth, consumed by the seeder, the Admin full-access grant, the
editable permission matrix, and upsert validation. Rows live in
`role_menu_permissions` keyed by `(companyId, roleId, permissionKey)`; the guard
caches a role's whole map for 5 minutes.

**`@SharedRead()`** is the second lane: a **read-only** data source any
authenticated user may call (the product picker feeding voucher lines, the chart
of accounts feeding posting, employees feeding payroll). It bypasses both
`RoleMenuGuard`'s module check and `ModuleLicenceGuard` — otherwise Transaction
couldn't be sold without Product. **Security contract: only ever on read-only
handlers (GET, or POST `list`/search). Never on create/update/delete/restore.**
It is handler-scoped on purpose; a controller may not claim it wholesale.

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

### 4.8 Data layer

- **Sequelize 6 + sequelize-typescript**, injected via the `SEQUELIZE` token
  (`src/const/config-const.ts`).
- **Soft deletes**: `paranoid: true` + `SoftDeletableModel`. `BaseCrudService`
  gives `remove` (first call soft-deletes and stamps `deletedBy`; second call on
  an already-deleted row hard-deletes), `restore`, `bulkRemove`, `bulkRestore`
  (best-effort — a refused row lands in `skipped` with its own service's reason
  rather than failing the batch).
- **Migrations**: currently a single squashed `00000000000000-initial-schema.ts`
  in both backends. Add new ones with `npm run migration:create <name>`; never
  edit the squashed baseline.
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

Two lifecycle rules (`voucher-lifecycle.const.ts`):
1. **Nothing leaves the books while a live document depends on it** — an active
   payment, return note or e-Way Bill blocks cancel; a cancelled one doesn't.
2. **A voucher that ever posted is never erased.** `journal_entries` and
   `stock_movements` reference vouchers by a `sourceType`/`sourceId` pair, not a
   FK, so a hard delete silently orphans them. Such a voucher **archives**.

### 4.10 Async work

- **BullMQ + Redis** for the audit queue and the invoice-scan queue, registered
  via `AuditQueueModule.register()` / `InvoiceScanQueueModule.register()`. Both
  gated by env flags and both **degrade to in-process** when Redis is absent.
- **`@nestjs/schedule`** for cron work (due reminders, job-work alerts,
  maintenance, subscription billing). Remember §4.3 rule 2: cron code has no
  tenant store.
- **Socket.IO** (`src/socket/socketGateWay.ts`) for live notifications, chat,
  scan progress, active-user counts.

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

### 6.4 File storage — the ERP stores nothing

`client-back` no longer keeps a single uploaded byte. Files spool to disk,
stream to the hub via `openAsBlob` (never buffered in the heap — a 100 MB import
in RAM kills the process), and the temp copy is deleted. What stays is a
`hubFileId` on the owning row. Serving goes through the authenticated
`GET /files/:id/content`.

**The one exception** is `site-configuration-assets/` (company logo/favicon),
served statically because the login screen renders them before the app knows
whether the hub is reachable. The old `app.use('/uploads', express.static(...))`
handed any customer's invoices to anyone who could guess a filename — it is
**deliberately gone, not relocated. Do not add it back.**

Category strings (`scanned-invoices`, `attachments`, …) must match the hub's
`src/const/storage-key.const.ts` exactly or DTO validation rejects the upload.

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
  source of truth for sidebar, top menu, module tabs, breadcrumbs and the
  post-login landing resolver. The old runtime `menuMaster.json` / `menu_master`
  table is gone. Permissions stay dynamic: each `NavItem` carries a
  `permissionKey` matching the backend decorator, merged with the role's flat
  permission map at runtime. Containers use an empty `permissionKey` and become
  visible when any child is.
- **Post-login landing** is `menu.getFirstAccessibleRoute()`, never a hardcoded
  dashboard the role may not have.
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
4. **Raw SQL must bind `companyId`.** No exceptions; CI enforces it.
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
    `ValidationError`, `ForeignKeyConstraintError` before `DatabaseError`.
12. **Passwords are argon2**, tuned by `ARGON2_*` env vars. Never swap in bcrypt
    or hand-rolled hashing.

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

- **`POST` is used for paginated list/search endpoints** (`POST /products/list`)
  because pagination + filters need a body. Two consequences:
  - Audit is **opt-in** via `@Audit()` rather than verb-sniffing — a verb-only
    rule would log every list call as a "create".
  - A read-shaped POST must carry **`@ReadOnlyRequest()`** (or already carry
    `@SharedRead()`), or `BillingRestrictionGuard` refuses it during billing
    grace. **Only ever put it on a handler that writes nothing** — see the
    decorator's SECURITY CONTRACT. Forgetting it is safe (the handler just stays
    blocked during grace); adding it to a mutating handler is not.
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
| Unit (Jest) | `src/**/*.spec.ts` — 94 suites / 1310 tests in client-back, 8 / 160 in admin-back; mostly beside `const/*.const.ts` | `npm test` |
| Architecture guards | `src/user-module-boundary.spec.ts`, `src/const/ci-guards/*` | `npm test` + `scripts/ci-guard-*.ts` |
| Cross-repo mirror drift | `scripts/check-mirrors.js` (**this** repo — only it sees both submodules) | `node scripts/check-mirrors.js` |
| QA harnesses | `scripts/qa-*.ts` (~55 in client-back, 5 in admin-back) | `npx ts-node -r tsconfig-paths/register scripts/qa-<name>.ts` |
| Style guard | `scripts/breakpoint-guard.js` | `npm run lint` (client-front) |
| E2E / UI | `qa-artifacts/` (Playwright) | see its README |
| OCR | `jayhind-ocr-service/tests` (pytest, fake reader/extractor — no model download) | `pytest` |

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
   anything undeclared).
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
   well covered (1310 unit tests across 94 suites in client-back, 160 in
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
4. **`voucher-lifecycle` parity is checked by name, not behaviour.**
   `scripts/check-mirrors.js` verifies both sides export the same decision
   functions, but the two signatures differ by design
   (`(VoucherLifecycleState) => ActionVerdict` vs
   `(VoucherLifecycleRow, VoucherTypeFlags) => boolean`), so semantic drift
   between the rules is still possible. The real fix is a shared JSON table of
   test vectors both repos' suites run against.

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
| Which modules are licensed? | `src/const/module-licence.const.ts`, `src/services/company-licence.service.ts` |
| How do the two servers talk? | `client-back/src/services/master-hub/master-hub.client.ts`, both `guards/internal-service.guard.ts` |
| How are files stored? | `client-back/src/const/hub-upload.const.ts`, `admin-back/src/services/storage/` |
| How is a voucher posted? | `src/services/posting.service.ts`, `src/const/posting.const.ts` |
| What may a voucher have done to it? | `src/const/voucher-lifecycle.const.ts` |
| Identity vs. membership | `src/entities/company-member.entity.ts` |
| Frontend nav & permissions | `client-front/src/core/navigation/navigation.config.ts`, `guards/permission.guard.ts` |
| Breakpoints / responsive rules | `client-front/src/styles/design-system/_breakpoints.scss`, `scripts/breakpoint-guard.js` |
| All routes | `npx ts-node -r tsconfig-paths/register scripts/dump-routes.ts` (client-back) |
| API schema / request shapes | `/api/docs` + `/api/docs-json` on :3000 and :3100; `src/utility/swagger.ts` |
| The frozen cross-service contracts | `_ops/adr/frozen-contracts.md` |
| Which planning docs are missing, and what `§20.9` means | `_ops/README.md` |
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
