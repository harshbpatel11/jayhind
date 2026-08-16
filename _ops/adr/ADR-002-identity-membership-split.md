# ADR-002 · Identity and membership are different things — and existing FKs stay on the identity

**Status:** Decided, 2026-08-12 (SRS/review merge). Frozen 2026-08-13 (Phase 0.1).
**Plan reference:** `MASTER_DEVELOPMENT_PLAN.md` §7.2 (D-02), §7.2a (D-02a).

## Context

Today's `users` table conflates four concerns: authentication identity, a
single global role, party financial state, and staff/party discrimination.
Once one human can belong to several companies (the `jayhindadmin2@gmail.com`
scenario — Admin of one company *and* a party user of another, one password,
one login), those four concerns can no longer live on one row keyed only by
identity.

Dozens of existing columns reference `users.id` today —
`preparedByUserId`, `supplierUserId`, `partyUserId`, `approvedByUserId`,
`ownerUserId`, `vendorUserId`, `senderUserId`, and more, across the
transaction, job-work, chat and HR domains.

## Decision

**Split identity from membership:**

```
identities (users, global)          company_members (per company)
──────────────────────────          ────────────────────────────
id                                  id
email          UNIQUE  ◀────────────identityId ──┐
password (argon2id)                 companyId  ──┼── UNIQUE(identityId, companyId)
name, phone                         roleId       │
failedLoginCount, lockedUntil       userKind     │
mustChangePassword                  status       │
lastLoginAt                         isDefault    │
                                    membershipVersion
                                    joinedAt     │
                                                 ▼
                          company_parties (per company, party rows only)
                          ─────────────────────────────────────────────
                          identityId, companyId, gstNo, panNo,
                          openingBalance, currentBalance, addresses…
```

- One email = one human = one row in `users`.
- Role lives on the membership, never on the identity. Switching company
  switches role. The global `users.roleId` is retired.
- Party financial state is company-scoped: a party of company A is not a
  party of company B, and their opening balances are unrelated numbers.

**D-02a, the highest-leverage sub-decision: existing foreign keys that
reference `users.id` are NOT repointed at `company_members.id`.** They
continue to reference the global identity. The owning row's own `companyId`
supplies the scope, so `(trx.companyId, trx.supplierUserId)` is unambiguous
without a schema change to the referencing column itself.

## What this costs

- `user_details` today mixes identity-adjacent fields with company-scoped
  party-financial fields (gstNo, panNo, address, opening/current balance) in
  one table — Phase 1 has to split it, and until that split lands the tenant
  -scope registry classifies the whole table `scoped` as a conservative
  default (Phase 0.2), because the party-financial columns are exactly what
  an isolation leak would expose.
- Every read of "who is this row's supplier/preparer/approver" must now be
  interpreted **only** within the row's own `companyId` — a raw user id alone
  is meaningless without that context. Isolation case **IS-7** exists
  specifically to test this.
- A membership carries its own `roleId`, `userKind` and `status` — meaning
  authorization code that today reads `user.roleId` directly must be rewritten
  to read the active membership's role instead (Phase 4).

## The rule that makes D-02a safe

*A row's `companyId` is authoritative; a user id inside that row is only ever
interpreted within that company.* This is the load-bearing invariant the rest
of the migration depends on for every one of the dozens of `*UserId` columns
that stay pointed at the identity table.

## What would reverse this decision

**Repointing every existing `*UserId` FK at `company_members.id` instead** —
the alternative D-02a explicitly rejects. This would require:

1. Rewriting every join, every Sequelize `include`, every raw query and every
   seeded fixture in the project that currently reads `user.id` off one of
   these columns — the most heavily referenced part of the schema.
2. A one-time data migration to translate every existing `*UserId` value into
   the corresponding `company_members.id`, which cannot be done blindly
   before Phase 1 creates memberships in the first place.
3. Re-deriving `(companyId, userId)` uniqueness assumptions that today's rule
   gets for free from `(row.companyId, row.userId)` alone.

This is why the plan states plainly: **do not let anyone "tidy" this later.**
The FK-graph decision is deliberately the cheaper of two correct designs, and
reversing it is strictly more expensive than living with it, for no
compensating benefit — the isolation guarantee (ADR-001) does not depend on
which side the FK points at, only on every read being correctly scoped by the
owning row's own `companyId`.

## Consequence for every later phase

Phase 2's isolation suite (IS-7 specifically) is what proves this invariant
holds across all ~112 scoped tables and the ~23 raw-SQL files in Appendix B.
Any new controller or service that reads a `*UserId` column must resolve it
only inside the request's own tenant context (§7.3 Layer 1), never as a
free-standing lookup.
