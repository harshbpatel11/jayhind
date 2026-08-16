# Architecture Decision Records — multi-tenant migration

Phase 0.1 (`MASTER_DEVELOPMENT_PLAN.md` §20.7): the decisions that must not
drift between AI sessions (risk R14 — "context loss between AI sessions
produces architectural drift"). Each ADR states what the decision costs and
what would reverse it, per that sub-phase's own exit checklist.

**These are frozen.** Changing one is not "tidying" or "simplifying" — it is
re-opening a decision the whole schedule from Phase 1 onward is built on. If
new information genuinely warrants a change, write a new ADR that supersedes
the old one (status `Superseded by ADR-00N`); do not edit a decided ADR in
place, and do not change the code away from a live ADR without one.

| ADR | Decision | Plan reference |
|---|---|---|
| [ADR-001](ADR-001-isolation-strategy.md) | Shared schema + `companyId` discriminator (D-01) | §7.1 |
| [ADR-002](ADR-002-identity-membership-split.md) | Identity/membership split; existing FKs stay on the identity (D-02/D-02a) | §7.2, §7.2a |
| [ADR-003](ADR-003-enforcement-layers.md) | Four-layer enforcement (D-03) | §7.3 |
| [ADR-004](ADR-004-company-in-token.md) | Active company lives in the signed JWT (D-05) | §8.2 |
| [ADR-005](ADR-005-activation-retired.md) | Activation cryptography retired; hub becomes an internal platform admin (D-06) | §12.5, §13.6 |
| [frozen-contracts.md](frozen-contracts.md) | JWT payload + HTTP error-code table, frozen as of 2026-08-13 | §8.2, §12.3 |

Not yet decided and deliberately out of scope for Phase 0: everything in
`MASTER_DEVELOPMENT_PLAN.md` §4 (Clarifications Required) that hasn't already
been answered in §4.0.
