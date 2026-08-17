# `_ops/` — operational notes and decision records

## Read this first: what is and isn't here

Roughly **153 source files** across `jayhind-client-back` and
`jayhind-admin-back` cite planning documents that **do not exist in this
repository or in its git history**:

- `MASTER_DEVELOPMENT_PLAN.md` — cited by section (`§7.3`, `§20.9`, `§20.13`,
  "Phase 2, task 2.1", …) in almost every architectural doc comment.
- `_ops/adr/frozen-contracts.md` — the frozen status/`code` table.
- `_ops/adr/ADR-002-identity-membership-split.md` — the identity/membership
  split (also referred to as ADR-004 / D-02 in other comments).
- `_ops/nightly-logs/`, `_ops/adr/`, `_staging/` — referenced by the top-level
  `README.md`.

They were presumably kept outside this tree. The citations are therefore dead
links, and that is the single largest comprehension gap for anyone — human or
AI — reading this codebase for the first time.

**This is not as bad as it sounds.** The doc comments in the source are
unusually detailed and were written alongside the decisions; they routinely
explain not just what a rule is but which bug motivated it. In practice the
source is self-sufficient and the missing documents are a *navigation* problem,
not a knowledge one.

## What was done about it

1. **[`../CLAUDE.md`](../CLAUDE.md)** is now the working architectural map for
   the whole stack — the role the plan document played for a newcomer. It is
   written to be read by an AI or a human before making a change.
2. **[`adr/frozen-contracts.md`](adr/frozen-contracts.md)** has been
   reconstructed and verified line-by-line against the code that enforces and
   consumes each contract. It is explicitly labelled as a reconstruction.

Deliberately **not** done: re-writing `MASTER_DEVELOPMENT_PLAN.md`. Its content
is a historical record of phases, tasks and decisions; inventing a plausible
one would produce a document that *looks* authoritative while being fiction.
The section references in the source are left as-is — they are still useful as
stable identifiers ("§20.9" reliably means the tenant-isolation phase) even
without the document.

## If you have the originals

Drop them in here and they will line up with the existing citations. Then delete
this notice, and remove gap #1 from `CLAUDE.md` §13.

## Reading the in-source section references

Common ones, decoded from the comments that cite them:

| Reference | Subject |
|---|---|
| §7.2 / D-02 / ADR-002 / ADR-004 | identity vs. membership split (`company_members`) |
| §7.3 | the three-layer tenant isolation model |
| §8.2 | `membershipVersion`, `MEMBERSHIP_STALE`, token refresh |
| §9.4 / §20.14 / Phase S.4 | subscriptions, billing, read-only grace |
| §12.3 | the frozen error-code table |
| §20.1 | the CI guards (raw SQL, cached state, scope registry) |
| §20.9 / Phase 2 | `TenantContext` + Sequelize scoping hooks |
| §20.11 / Phase 4.3 | permission metadata read with `getAllAndOverride` |
| §20.12 / Phase 5 | file storage moving to the hub |
| §20.13 / Phase 6.x | licence flags on `companies`; activation subsystem retired |
| §20.16 / Qc.x | frontend breakpoint scale conversion |
| §20.17 / Phase 8.x | rate limiting, OCR queue fairness |
