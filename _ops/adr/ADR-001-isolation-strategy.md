# ADR-001 · Isolation strategy — shared schema with a `companyId` discriminator

**Status:** Decided, 2026-08-12 (SRS/review merge). Frozen 2026-08-13 (Phase 0.1).
**Plan reference:** `MASTER_DEVELOPMENT_PLAN.md` §7.1 (D-01).

## Context

The platform is moving from one MySQL database per customer installation to
one platform serving many companies. Three shapes were available: a database
per company, a schema per company, or one shared schema with a `companyId`
column on every scoped table.

## Decision

**Shared schema, `companyId INT NOT NULL` on every scoped table.**

| Option | Verdict |
|---|---|
| Database per company | Rejected — 120 tables × N databases means every migration runs N times, and cross-company queries ("list the companies this identity can access") span databases |
| Schema per company | Rejected — same migration fan-out, minus the server cost; connection-pool pressure still grows with tenant count |
| **Shared schema + `companyId`** | **Chosen** — one migration, one pool, trivial cross-company identity queries, lowest infrastructure cost |

## What this costs

Isolation becomes an **application** guarantee, not a **database** one. MySQL
has no row-level security, so there is no backstop if the application forgets
a scope. This single fact is why:

- Phase 2 (tenant context & enforcement) is the largest phase in the
  programme.
- The isolation suite (IS-1…IS-15) gates every phase after it (ordering rule
  2, §2.3).
- Raw-SQL remediation across the ~23 files in Appendix B is mandatory, not
  optional, and reviewed by a human, not merely tested.
- A missed scope is not a crash — it is silent, and at worst it leaks a
  whole company's ledger summed into one dashboard number (§7.4).

This is the single biggest ongoing engineering-discipline cost the platform
takes on by choosing this architecture. It is accepted because the
alternative (database/schema per company) reintroduces most of the current
platform's operational cost (§5.3, problems P1/P2) that this whole migration
exists to remove.

## Escape hatch, designed in from day one

`companies.shardKey` (nullable, Phase 1) is reserved so a future very large
company can be moved to its own database without a schema change. Nothing
reads it in v1 — it exists purely so this decision is reversible for one
outlier company without redesigning the schema at that point.

## What would reverse this decision

Reversing it wholesale (moving back to database- or schema-per-company) would
mean:

1. Standing up per-company provisioning (database creation, migration
   fan-out) that Phase 1–3's `companyId` work was specifically designed to
   avoid.
2. Writing a data-migration path to split the shared schema back into N
   databases, keyed by the very `companyId` column this ADR introduces —
   ironically, the column this decision adds is also what would make that
   split mechanically possible later, if ever needed.
3. Rewriting every cross-company platform-plane query (module licensing,
   billing, platform console reporting) that Phase 6 builds assuming a single
   shared schema.

In practice, the only reversal actually anticipated is the partial one the
escape hatch supports: moving **one** outsized company to its own database
via `shardKey`, not undoing the architecture for everyone. A full reversal
has never been costed and would be a new ADR, not an edit to this one.

## Consequence for every later phase

Phase 2's isolation suite is the primary control substituting for the
database-level guarantee this ADR declines to have (§5.4's "three-part review
substitute", risk R10/R13). Any phase that adds a new table must classify it
in the tenant-scope registry (`src/const/tenant-scope-registry.const.ts`,
Phase 0.2) before it can be trusted to be either correctly scoped or
correctly exempt.
