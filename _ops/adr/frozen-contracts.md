# Frozen contracts

> **Provenance.** This document is a **reconstruction, verified against the
> source**, not a recovered original. ~153 files across the two backends cite
> `_ops/adr/frozen-contracts.md` and `MASTER_DEVELOPMENT_PLAN.md`, but neither
> document exists in this working tree or anywhere in this repo's git history.
> Rather than leave those citations pointing at nothing, the contracts they
> refer to have been re-derived from the code that enforces them and the code
> that consumes them, and every row below was checked against both sides on
> 2026-08-17. Where the original said something this cannot recover (rationale
> that lives only in the missing plan), the code's own doc comments are cited
> instead — those are detailed and were written alongside the decisions.
>
> **The code is the source of truth.** If this file and the source ever
> disagree, the source wins and this file is wrong. See
> [`../../CLAUDE.md`](../../CLAUDE.md) §15.

"Frozen" means: **the status code and the `code` string are a contract between
the two backends and the two frontends.** Changing either silently breaks a
client that recognises it. Add new codes freely; do not repurpose or renumber
these.

## The error-code table

Every response carrying one of these uses the standard error envelope:

```jsonc
{ "status": false, "message": "<user-facing sentence>", "statusCode": <int>,
  "path": "...", "timestamp": "...", "code": "<FROZEN_CODE>" }
```

| `code` | Status | Thrown by | Means | Client behaviour |
|---|---|---|---|---|
| `NO_MEMBERSHIP` | 403 | `client-back` `TenantContextGuard` | The JWT carries no `companyId`, or the membership row is missing / not `active` | End the session — `session.expire()`; there is nothing to refresh into |
| `MEMBERSHIP_STALE` | 409 | `client-back` `TenantContextGuard` | `company_members.membershipVersion` no longer matches the token's copy — role or permissions changed since it was minted | Single-flight `POST /auth/refresh`, then retry the original request. **No re-login** |
| `COMPANY_SUSPENDED` | 403 | `client-back` `TenantContextGuard` | `companies.status` is not `active` (suspended or archived) | End the session, same as `NO_MEMBERSHIP` |
| `FEATURE_DISABLED` | 403 | `client-back` `ModuleLicenceGuard` | The acting company is not licensed for the module this handler belongs to. Body also carries `module` | Re-read the licence (`LicenceService.load()`) so the menu drops the item, then toast the server's sentence |
| `SUBSCRIPTION_PAST_DUE` | 402 | `client-back` `BillingRestrictionGuard` | The company is in billing read-only grace and this was a mutating request | Toast the server's sentence. Reads keep working — there is deliberately no dedicated branch, it falls through the generic error path |

### Verified enforcement / consumption points

| Contract | Enforced in | Consumed in |
|---|---|---|
| `NO_MEMBERSHIP`, `COMPANY_SUSPENDED` | `client-back/src/guards/tenant-context.guard.ts` | `client-front/src/interceptors/message.interceptor.ts` → `session.expire()` |
| `MEMBERSHIP_STALE` | `client-back/src/guards/tenant-context.guard.ts` | `client-front/src/interceptors/auth.interceptor.ts` → `TokenRefreshService.refresh()` + retry |
| `FEATURE_DISABLED` | `client-back/src/guards/module-licence.guard.ts` | `client-front/src/interceptors/message.interceptor.ts` → `licence.load()` |
| `SUBSCRIPTION_PAST_DUE` | `client-back/src/guards/billing-restriction.guard.ts` | `client-front/src/interceptors/message.interceptor.ts`, generic toast path |

## Other frozen surfaces

These are not error codes but carry the same "both repos change together" rule.

### 1. The success envelope

```ts
{ status: true, data: <payload>, message?: string }
```

Returned explicitly by every handler. `ApiService`/`ApiResponse<T>` on both
frontends is typed against it.

### 2. The internal plane

`INTERNAL_SERVICE_KEY` in the `x-api-key` header authenticates **both**
directions between the backends. Both guards (`client-back` and `admin-back`
`internal-service.guard.ts`) compare it sha256-widened and timing-safe, and
**fail closed when it is unset** — deliberately the opposite of the licence
doctrine, where a missing flag reads as ON.

- ERP → hub: `/api/v1/ewb`, `/api/v1/einvoice`, `/api/v1/ocr`, `/api/v1/gst`,
  `/api/v1/hsn`
- hub → ERP: `/internal/companies/provision`, `/internal/*`

Handlers on this plane are `@Public()`, which means **no user JWT**, not "no
auth". They carry no user and no tenant context.

> The pre-Phase-6.2 `MASTER_API_KEY` fallback was removed on 2026-08-17. Neither
> side reads it any more.

### 3. File categories

The category string travels in the upload and must match the hub's
`src/const/storage-key.const.ts` exactly, or the hub's DTO validation rejects
it. The ERP's copy is `client-back/src/const/hub-upload.const.ts`
(`HubFileCategory`) — e.g. `scanned-invoices`, `attachments`.

### 4. The `ExtractedInvoice` schema

`schemaVersion 1`. Produced by `jayhind-ocr-service`, proxied by the hub,
consumed by `client-back/src/const/invoice-scan-contract.ts`. A change touches
three repos.

### 5. Licence flags

Nine boolean columns on `companies` — six `LicensedModule` (`product`,
`transaction`, `chat`, `files`, `hr`, `jobwork`) and three gateway capabilities
(`ewb`, `einvoice`, `ocr`). The hub's `Company` entity is a thin projection over
the ERP's own table.

**A missing or unreadable flag reads as ON** (`ALL_ON`) — a company row
predating a newly-added module must never go dark.

Mirrored on the frontend in `client-front/src/core/navigation/module-licence.ts`.
Drift between the two is now caught by
[`scripts/check-mirrors.js`](../../scripts/check-mirrors.js) in the
orchestration repo.

### 6. Identity vs. membership (referred to in-source as ADR-004 / D-02)

- `users` — one identity per email, global, no `companyId`.
- `company_members` — one row per (identity, company), carrying `roleId`,
  `userKind`, `status`, `membershipVersion`.

Frozen consequences:

- Role/kind/status are **per membership**, never on `User`. `User.roleId` is
  retired — do not resurrect it.
- Existing `*UserId` foreign keys (`preparedByUserId`, `supplierUserId`, …)
  point at `users.id`, **never** at `company_members.id`.
- `User.create()` may only be called in `services/users.service.ts` — enforced
  by `src/user-module-boundary.spec.ts`.
- Bump `membershipVersion` on any role/permission change; that is what makes
  `MEMBERSHIP_STALE` fire instead of the client waiting out the token TTL.

## Changing any of this

Both repos change together. Push the sub-repo first, then bump the submodule
pointer in this orchestration repo:

```bash
cd jayhind-client-back && git push
cd .. && git add jayhind-client-back && git commit -m "bump jayhind-client-back" && git push
```
