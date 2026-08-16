# ADR-003 · Enforcement — four layers

**Status:** Decided, 2026-08-12 (SRS/review merge; layer 4 added the same day after review found three process-level caches bypassing the first three). Frozen 2026-08-13 (Phase 0.1).
**Plan reference:** `MASTER_DEVELOPMENT_PLAN.md` §7.3 (D-03).

## Context

ADR-001 chose a shared schema with no database-level row security, which
means isolation must be enforced entirely in application code, at every layer
data can move through. The original SRS had three layers; a review pass
found a fourth class of state that bypasses all three.

## Decision

Four layers, each covering the previous layer's blind spot:

**Layer 1 — request-scoped tenant context (`AsyncLocalStorage`).**
`TenantContextGuard` sits between `AuthGuard` and `RolesGuard`, reads the
verified `companyId` from the JWT, confirms the membership is live, and
stores it in an ALS store for the request's lifetime. ALS (not NestJS
request-scoped providers) because request scoping would force the whole
injection subtree — 133 services — to become request-scoped, a severe
performance regression, and because ALS reaches Sequelize hooks, which are
not part of Nest's DI graph at all.

**Layer 2 — Sequelize hooks, applied globally.**
`beforeFind`/`beforeCount`/`beforeCreate`/`beforeBulkCreate`/`beforeUpdate`/
`beforeBulkUpdate`/`beforeDestroy`/`beforeBulkDestroy` inject or assert
`companyId` for every model the tenant-scope registry (ADR reference: Phase
0.2, `src/const/tenant-scope-registry.const.ts`) marks `scoped`. Reads
AND-compose `where.companyId` the way `CommonDataService.composeFilteredWhere`
already composes caller/search/filter clauses (never overwriting a caller's
`Op.and` — the exact footgun already documented in `CLAUDE.md` §11). Writes
stamp `companyId` from context; a mismatched explicit value is a hard error,
never a silent overwrite. Escape hatch: an explicit `{ crossCompany: true }`
option, greppable, allowed only on the platform plane and in migration
scripts.

**Layer 3 — the scope registry, with a spec that enforces completeness.**
`src/const/tenant-scope-registry.const.ts` (built in Phase 0.2, this same
programme phase) classifies every entity `scoped | global | platform`. A
co-located spec asserts the registry's key set equals the set of entities
actually on disk, so a new, unclassified entity is a failing test, never a
silent leak.

**Layer 4 — state that outlives a request** *(the layer the SRS did not
have)*. Process-level caches are invisible to layers 1–3: not a Sequelize
query (hooks never run), not raw SQL (the CI guard never sees them), not an
entity (the registry does not classify them). Four known sites today (all
`class`-field `Map`s on `@Injectable()` singletons):

| Location | Severity once shared |
|---|---|
| `transaction-configuration.service.ts` | Leaks how a company's vouchers post to its ledger |
| `import-voucher-commit.service.ts` (×2) | **Worse** — leaks a foreign key written into the ledger; the Tally-import onboarding path, so this would fire during a new customer's first hour (risk R16) |
| `import/adapters/erp-adapter.registry.ts` | Safe — stateless, keyed by `ErpSource`, recorded so a later reviewer does not "fix" it |

Controls: re-key each real cache `(companyId, …)` in Phase 2.4; a CI grep for
class-field `new Map(` in `src/services/` with a reviewed allow-list
(`src/const/ci-guards/cached-state-guard.const.ts`, live since O1.2); an
isolation case (**IS-15**) proving a cached read returns company A's value
after company B has warmed the same entry; and, until Phase 2 lands, a
`TODO(multi-tenant)` comment naming IS-15 on each real cache — **not** a fix
now, because re-keying by `companyId` is impossible before that column
exists.

## What this costs

Four independent mechanisms to build, test and keep in sync, rather than one
database-level guarantee (which ADR-001 already declined). Each layer has its
own CI guard and its own isolation-suite cases, which is real ongoing
maintenance surface — but each layer is also cheap in isolation and catches a
failure mode none of the others can see (a raw query bypasses layers 1–2
entirely; a process cache bypasses all of 1–3).

## What would reverse this decision

Collapsing to fewer layers only makes sense if a cheaper enforcement
mechanism becomes available — e.g., if MySQL row-level security or a proxy
that string-injects `WHERE companyId = ?` at the connection level were
adopted, which would itself reverse ADR-001's "isolation is an application
guarantee" framing. Short of that, dropping any one of the four layers
reopens exactly the blind spot it exists to close:

- Dropping Layer 1 removes the only mechanism raw SQL and cached state can
  read `companyId` from at all.
- Dropping Layer 2 means every one of the ~112 scoped tables needs manual
  scoping on every query site instead of by default.
- Dropping Layer 3 means an unclassified new entity fails silently instead of
  failing a build.
- Dropping Layer 4 reopens the exact bug class that made this ADR a four-,
  not three-, layer design (the Tally-import GL-group cache, risk R16).

## Consequence for every later phase

Phase 2 is where all four layers are actually built and where the isolation
suite (IS-1…IS-15) proves them. Every phase after Phase 1 that adds new
mutable process state on an `@Injectable()` singleton must ask whether it
needs Layer 4 treatment before it ships, not after a leak is found in
production.
