# Jayhind ERP — Transaction module Tally parity plan

*A ledger-first rebuild of the accounting core. Primarily `jayhind-client-back`
(schema, posting engine, reports) and `jayhindi-client-front` (chart of accounts,
voucher entry, report drill-down), with `qa-artifacts` carrying the parity gate.*

> **Reference artifact:** "Tally Parity Programme" —
> **https://claude.ai/code/artifact/0f6e7461-3371-4d03-8f65-940d5650c8db**
> Same content as this file, laid out for reading. This file is the working copy
> and the one that gets edited as phases land; the artifact is re-published from
> it when a phase closes.
>
> **Scope was set by four decisions (2026-08-28), all taken at the maximal
> option** — see [§0](#0-scope-decisions). Every section below is written to
> those four answers.
>
> **Rollout shape:** one phase per hand-over. Each phase is finished, migrated,
> parity-checked against the harness and committed on its own before the next
> starts. P0–P4 is the coherent shippable unit; nothing after P4 blocks anything
> before it.

## Progress

**P0, P1 and P2a are done (2026-08-28).** The parity harness exists and has been
shown to **fail** on the exact defect P2 risks; the group tree exists, is seeded
in all 14 companies, and its own gate holds at 126/126. The **ledger layer now
exists too** — 1,351 ledgers across the 14 companies — and D5's resolution has
been run over all 41,690 journal lines as a **dry run**, with zero unresolvable.
Nothing in the accounting core has been touched: `trx_groups` is untouched,
every journal line still points at it, and the parity diff is still empty.

**P2b‑1 is done too: `journal_lines.ledgerId` exists, is backfilled on all
41,690 lines, is `NOT NULL` behind a foreign key, and is maintained by the
posting engine.**

**And P2b‑2 is done: the reports read it.** Every figure-bearing statement now
resolves through `ledgerId`, and the declared exception has appeared —
**76,445 moved paths across seven report families, every one of them declared,
nothing else.** `trxGroupId` survives as a shadow for two labels and a handful
of unaffected reads until D9. **P2b‑3 is next** — D6's four other holders of a
group id, the Ledger module and the import module.

> ⚠️ **Building D3 corrected this plan's own headline figure.** §4.2 and F14
> describe the declared exception as *"Sundry Debtors and Sundry Creditors each
> fall by ₹1,57,11,850"* across **63** parties. That is `Σ min(|debtorNet|,
> |creditorNet|)`, and it is wrong twice over. The true movement is
> **₹2,51,44,323.21**, across **76** parties. See
> [§P2a record](#p2a-record--2026-08-28).

| Phase | Title | Size | Status |
|---|---|---|---|
| P0 | Foundations and the parity harness | M | **done** — [§P0 record](#p0-record--2026-08-28) |
| P1 | Groups become a hierarchy | M | **done** — [§P1 record](#p1-record--2026-08-28) |
| P2a | The ledger layer exists (D1–D4) | L | **done** — [§P2a record](#p2a-record--2026-08-28) |
| P2b‑1 | The GL names a ledger (D5, D8's third cache) | M | **done** — [§P2b‑1 record](#p2b-1-record--2026-08-28) |
| P2b‑2 | Reports read the ledger (the declared exception appears) | M | **done** — [§P2b‑2 record](#p2b-2-record--2026-08-28) |
| P2b‑3 | D6; the Ledger module; the import module | L | not started |
| P3 | Reports, drill-down, and the Ledger report | L | not started |
| P4 | Voucher entry | XL | not started |
| P5 | Bill-wise details | L | not started |
| P6 | Trading Account and Gross Profit | M | not started |
| P7 | Cost centres | L | not started |
| P8 | Posting rules, budgets, interest, multi-currency, scenarios | L | not started |

Sizes are relative, not calendar.

### P0 record — 2026-08-28

Built, and verified against the live development database (14 companies, 41,690
journal lines, 564 groups, 27 instruments — the same figures the verification
pass measured).

| Artefact | What it is |
|---|---|
| `client-back/src/const/parity-snapshot.const.ts` | The flatten-and-diff **rule**, pure and dependency-free, with `parity-snapshot.const.spec.ts` beside it — **31 tests**. It knows no accounting: it turns any report payload into `path → scalar` and compares two such maps. §4.2's "do not write a second oracle" is satisfied by construction, because there is nothing here to restate. |
| `client-back/scripts/qa-coa-parity.ts` | The runner. `capture <label>` · `diff <before> <after> [--allow f]` · `selfcheck`. Calls the report services inside `TenantContext.run` rather than going over the wire — the services are what P2 changes, and fourteen logins plus a permission matrix between the harness and a number is noise. |
| `.github/workflows/ci.yml` in **both** backends | §13 still-open #1(a), closed. `npm test` · `npm run guards` (client-back) · `lint:ci` · `build`. |
| `npm run guards` (client-back) | All **five** tree-scanning guards, not the three §13 named. admin-back needs no equivalent — its one guard scans `src/**/*.ts` from inside its own spec. |

**What the snapshot covers**, per company: three periods (all-time, first FY,
active FY) × Trial Balance · P&L · Balance Sheet · Day Book · payment and
receipt registers · cash and bank book; then per-instrument cash/bank books,
daily cash on every day with instrument activity, a group statement for **every**
group, both Outstanding reports, and per party — over F13's **union** population,
not `company_parties` — summary, statement and pending bills. Plus the BUG-0042
cache census for `trx_groups.currentBalance` and `trx_accounts.balance`.

**Gate met.** `selfcheck` captures twice on unchanged code across all 14
companies and reports `PARITY HELD — the diff is empty`.

> ⚠️ **An empty diff proves nothing until the harness has been shown to fail**,
> which is this repo's own doctrine (§13 still-open #3: a rule that cannot fail
> reads as coverage). So the D5 failure mode was injected directly: one
> `journal_lines` row repointed from `Purchase` to `General Expenses` in company
> 15 — a **balanced** perturbation, which is what a mis-mapped backfill actually
> produces. Every total stayed identical and the Trial Balance still balanced.
> The harness reported **63 differences**, naming the ₹93,814.40 in each place
> it surfaced: both group statements and their running balances, the Day Book
> line, the P&L expense row, the Trial Balance. Reverting the row restored the
> empty diff.
>
> The **unmet-allowance** half was verified the same way: an exception list
> declaring a movement that had been reverted fails with *"1 declared
> exception(s) matched NOTHING"*. That is what keeps §4.2's exception a list
> rather than a tolerance.

**Three things P0 established that the plan should carry forward:**

1. **F13 and F14 reproduce exactly.** 362 `(companyId, partyUserId)` pairs on a
   control head; 63 dual-role parties; ₹1,80,78,934 debtor against ₹4,28,14,914
   creditor, **₹1,57,11,850 netting away**. D3's union population is what the
   harness already uses, so P2 inherits it rather than re-deriving it.
2. **The diff must be structural, and it is.** Rows are keyed by identity, not
   index, and `added`/`removed` are reported alongside `changed` — which is the
   only way the netted-to-exactly-zero party leaving the Trial Balance is
   visible at all (§4.2's last ⚠️).
3. **`npm run` swallows flags without `--`.** `npm run qa:coa-parity selfcheck
   --company 15` silently runs every company. Write `npm run qa:coa-parity --
   selfcheck --company 15`, or call the script directly.

---

### P1 record — 2026-08-28

The chart of accounts has a tree. Nothing posts to it yet — `trx_groups` is
untouched, every journal line still points at it, and `qa-coa-parity selfcheck`
is still an empty diff. P1 is additive by construction, which is what makes it
safe to have landed before P2 depends on it.

| Artefact | What it is |
|---|---|
| `src/const/provisioning/tally-chart.const.ts` (+ spec, **34 tests**) | Tally's 28 as a **tree**, plus `TRX_GROUP_TARGET` — §3.2's mapping as data. ⚠️ It does **not** re-type the 28 names: it reads them from `import/tally-nature-map.const.ts` and adds only the parent linkage and sort order, with a spec asserting the two key sets are identical (V3). |
| `src/const/materialised-path.const.ts` (+ spec, **22 tests**) | `buildPath` · `subtreePrefix` · `wouldCycle` · `rebuildSubtreePaths`. §3.3's re-parent rule, and the terminator that stops `/1/7/` collecting `/1/70/`. |
| `src/entities/acc-group.entity.ts` · `migrations/20260828000000-acc-groups.ts` | The table. DDL only — seeding reads the constant, so the names exist once. |
| `src/services/acc-group-seed.ts` | One seeding definition, shared by `CompanyProvisioningService` and `scripts/seed-acc-groups.ts` (BUG-0032's lesson: put it where a new caller cannot fail to import it). |
| `ReportsService.groupedTrialBalance()` | The opt-in grouped view. `trialBalance()` is untouched. |
| `scripts/qa-p1-group-tree.ts` | P1's gate. `npm run qa:p1-group-tree`. |

Seeded into all 14 companies: **392 groups** = 14 × (15 primary + 13 sub), 28
nature-ambiguous (Tally's own two, per company), zero malformed paths, zero
depth mismatches.

**Gate: 126 passed, 0 failed.** And, per P0's discipline, shown to fail — twice.
Stripping a path's terminator is caught by the structural check; the harder
injection, a **well-formed path pointing at the wrong parent**, was caught three
ways at once (per-nature NET, the roll-up identity, and the explicit
prefix-vs-parentId cross-check) while the Σ checks correctly stayed green.

#### ⚠️ The gate's own wording was half wrong, and the half that was wrong matters

P1's gate reads *"grouped Trial Balance totals equal the flat one, per nature
and overall"*. Two corrections, both load-bearing for P3:

1. **Closing columns are not regroup-invariant.** `closingDebit` is
   `max(net, 0)`, so merging the thirteen tax heads into Duties & Taxes **nets
   them before the max is taken** and the closing total legitimately falls. A
   gate asserting those equal would be asserting that grouping does not group.
   What ties the two reports is **Σ debit, Σ credit and Σ net** — pure sums,
   which survive any regrouping. The report exposes both.
2. **Per-nature totals do not match, by design** — see below.

#### ⚠️⚠️ A second declared exception to the parity gate: ₹1,54,85,553

§3.2 maps input **and** output GST to Duties & Taxes — correct, it is what Tally
does and it keeps GSTR reconciliation reading one subtree — without noticing
that Duties & Taxes hangs under **Current Liabilities**. Nature is inherited
(§3.3), so `TAX_INPUT`, `CGST_INPUT`, `SGST_INPUT` and `IGST_INPUT`, seeded
under Assets, become Liability-natured and carry a debit balance there, exactly
as a Tally input-GST ledger does.

Measured across the 14 companies: **₹1,54,85,553.06** (CGST 62,59,652 · SGST
62,59,649 · IGST 29,66,252 · `TAX_INPUT` nil). Assets and Liabilities both fall
by that figure, so **the Balance Sheet still balances while it happens** — the
same property that makes the dual-role party netting invisible to a "does it
still balance?" check (§4.2, R8).

Unlike R8's, this set is fully enumerable in advance — 4 heads × 14 companies —
and `NATURE_CHANGING_KEYS` carries it with a spec asserting it is **exactly**
those four, so a fifth head acquiring a nature change fails a test rather than
somebody's Balance Sheet. **Reversing the decision is one edit to
`TRX_GROUP_TARGET`**, pointing the four at a Current Assets child instead; that
is deliberately all it takes, because the mapping is data and nothing else
encodes it.

#### Three things the gate found that the plan had not

- **Instrument backing groups are not seeded heads.** `trx_accounts` silently
  auto-creates a `trx_groups` row per bank account, UPI handle and card (F5),
  so `TRX_GROUP_TARGET` cannot name them — company 28's Current Account, ₹4.99
  crore, was landing unmapped. They are routed by **AccountType**, derived from
  `bookForAccountType` so D-54's rule is reused rather than restated (§3.10) and
  a new account type is placed the day it is added.
- **Some backing groups have no account left.** Company 28 carries four whose
  `trx_accounts` row was hard-deleted and one whose row is soft-deleted, holding
  ₹1,23,456 each. `fallbackGroupForNature` places them by their own nature and
  the report lists them in `fellBackToNature`: **a fallback that is reported is
  safer than an omission that is not** — the alternative was a grouped Trial
  Balance quietly smaller than the flat one, which loses money and still
  balances.
- **The raw-SQL allow-list trap fired, exactly as CLAUDE.md §14 predicts.**
  Adding ten lines to `company-provisioning.service.ts` moved the `countries`
  probe from `:441` onto `:451` — an existing key, whose justification describes
  the **`states`** probe. It would have passed the guard carrying a reason
  written for a different statement. Every key was re-read against the query now
  at it, rather than having its number shifted.

---

### P2a record — 2026-08-28

**The chart of accounts has a postable leaf.** Nothing posts to it yet:
`journal_lines` still points at `trx_groups`, every report still reads it, and
`qa-coa-parity selfcheck` is still an empty diff. P2a is additive by
construction — the same property that made P1 safe to land before P2 depended on
it, applied one level down.

| Artefact | What it is |
|---|---|
| `src/const/ledger.const.ts` (+ spec, **30 tests**) | D3's derivation and **D5's precedence**, pure. `derivePartySide` · `displacedBalance` · `controlHeadDelta` · `resolveLedgerForLine` · the Ledger module's own rules. |
| `src/entities/acc-ledger.entity.ts` · `party-ledger-plan.entity.ts` · `migrations/20260828100000-acc-ledgers.ts` | The two tables. DDL only — seeding reads the constants, so the mapping exists once. |
| `src/services/acc-ledger-seed.ts` | D2, D3 and D4 as one function, shared by `CompanyProvisioningService` and `scripts/seed-acc-ledgers.ts` (BUG-0032's lesson, the same shape `seedAccGroups` uses). |
| `src/services/party-ledger-plan.ts` + `scripts/plan-party-ledgers.ts` | D3 steps 1–2: derive, and write the reviewable plan. Dry-runs by default. |
| `scripts/seed-acc-ledgers.ts` | D2/D3/D4 backfill. Dry-runs by default, one transaction per company. |
| `scripts/qa-p2-ledgers.ts` | P2a's gate. `npm run qa:p2-ledgers`. |

**Landed on all 14 companies:** 1,351 ledgers — 509 from legacy heads, 27
instruments claiming theirs, 815 parties — with 28 control heads deliberately
left without one, because they become **groups**. `party_ledger_plan` holds 815
rows. Every gate is green: **P2a 196/196 · P1 126/126 · parity diff empty ·
`npm test` 1,796/1,796 · all five guards · `check-mirrors` in sync.**

#### The gate that matters is D5's dry run

`resolveLedgerForLine` was run over **all 41,690 journal lines**, resolving
every one. That is the whole reason P2 was split: §4.1 D5 ends with a `NOT
NULL`, and V1/F13 records what discovering a gap *there* costs — a migration
stopping mid-flight on a live book. Finding out first costs one script run.

Shown to fail, per this repo's own doctrine (§13 still-open #3): soft-deleting
one party ledger produced *"5 unresolvable: no-party-ledger×5"* — V1's failure
mode reproduced in miniature — and named the plan row pointing at a dead ledger
in the same run.

#### ⚠️ The declared exception was computed with the wrong formula, and it is ₹94 lakh larger

§4.2, F14 and R8 all describe the movement as *"Sundry Debtors and Sundry
Creditors each fall by ₹1,57,11,850"* across **63** parties. That figure is
`Σ min(|debtorNet|, |creditorNet|)` and it is wrong in two independent ways:

1. **`min()` is only the movement when the party is parented to the side with
   the larger net — and parentage is by GROSS.** That is not an oversight in the
   parenting rule; it is the rule's whole point (§4.1 D3: *"gross, not net, so a
   party who has settled down to a small balance is still parented where their
   trading actually happens"*). A party with ₹5,000 outstanding on a ₹40 lakh
   history, against one ₹80,000 purchase unpaid, is correctly a debtor — and the
   whole ₹80,000 moves, not ₹5,000.
2. **A party can move a figure without being dual-role at all.** One net zero,
   the other not, and the gross pointing at the zero side. **Thirteen parties**
   on the development database are in exactly that state, and every one of them
   reports `isDualRole = false`. Keying the gate off "holds a live balance on
   both heads" would have left thirteen unexplained differences in a diff
   required to be empty apart from a named list.

The measured figures, reproduced two independent ways — from
`party_ledger_plan`'s own arithmetic, and from the journal lines through the
resolver:

| | Plan as written | Measured |
|---|---|---|
| Parties moving a figure | 63 | **76** |
| Δ Sundry Debtors | −₹1,57,11,850 | **−₹2,51,44,323.21** |
| Δ Sundry Creditors | −₹1,57,11,850 | **+₹2,51,44,323.21** |

⚠️ Note the **sign**, which the old wording also got wrong. The two heads move
by *exactly opposite* amounts — `controlHeadDelta` returns the pair and the gate
asserts it — which is why the Balance Sheet still balances. "Both fall by the
same figure" happens to be true only for an opposed pair; it is not the
mechanism, and describing it that way is what made a `min()` look right.

`displacedBalance` in `ledger.const.ts` carries the whole argument, and the plan
table stores the figure per party, so the exception stays **a list**.

#### Four things P2a established that P2b should carry

1. **`strictNullChecks: false` makes discriminated unions unreliable here.**
   `LedgerResolution` was written twice as a union — discriminated on
   `ledgerId: number | null`, then on an added `ok: true | false` — and neither
   narrowed at the obvious call site. It is now **one total shape**, and callers
   write `if (answer.ledgerId === null)` with no narrowing at all. A result type
   whose callers need `'failure' in x` to compile is one that will be got wrong.
2. **A derived column on the plan table can go stale, and it did.** Editing
   `chosenSide` directly leaves `displacedBalance` describing a migration that
   is not the one about to run — BUG-0034's shape a third time. It first
   surfaced as an unexplained ₹5,96,950.55 on a group total, three steps from
   its cause; checks (2b) and (2c) now name it. Note the asymmetry the fix
   established: **before D3 the plan row is a proposal and its figures refresh
   with the books; after D3 it is the record of a movement that happened**, and
   the decision lives in the ledger's `groupId`.
3. **"No plan rows" and "no parties" are different states.** The seed's first
   guard refused company 2 — which has neither a roster nor a posting — as
   un-planned. Comparing a count against zero answers a different question from
   comparing it against the population.
4. **The raw-SQL allow-list drifted again, exactly as CLAUDE.md §14 predicts.**
   Adding `seedAccLedgers` to `company-provisioning.service.ts` moved all seven
   of its entries; each was re-read against the statement now at its line before
   the number was changed. **Budget for this in every commit that edits a file
   with entries.**

---

### P2b‑1 record — 2026-08-28

**D5. The general ledger stops naming a group and starts naming a ledger.** This
is the first step of the programme that is not additive — everything before it
could have been dropped without touching a book.

`journal_lines.ledgerId` is backfilled on all **41,690** lines, `NOT NULL`,
behind `fk_journal_lines_ledger`. `trxGroupId` survives beside it as a shadow
(§3.1, R2), every report still reads it, and **`qa-coa-parity selfcheck` is
still an empty diff** — which is the point: repointing and re-reading are two
steps, and doing them together would have made a wrong figure and a wrong
mechanism indistinguishable.

| Artefact | What it is |
|---|---|
| `migrations/20260828200000-journal-line-ledger.ts` | D5 in five statements — nullable column · three backfills in precedence order · **verify** · tighten · index · FK — plus D8's rebuild of the third cache. |
| `PostingService.persistLines` | Resolves and stamps `ledgerId`, and maintains `acc_ledgers.currentBalance`, in the single writer of `journal_lines` (§4.9). |
| `src/services/ledger-resolution.ts` | `loadLedgerIndex` · `resolveOrCreateLedger` — posting-time resolution, provisioning a ledger on demand inside the posting transaction. |
| `PostingService.rebuildBalances` | Now rebuilds the third cache too, so the existing repair door still repairs everything. |
| `scripts/qa-p2-ledgers.ts` | Checks (10), (11) and (12) — see below. **229/229.** |

#### The backfill and the engine are one step, deliberately

A backfilled column the posting engine does not write **goes stale on the very
next voucher**, and a column that is stale but present is worse than one that is
absent, because the next reader believes it. So D5 is not "the migration": it is
the migration *and* `persistLines`, in one commit.

`ledgerId` being `NOT NULL` sharpens that. A resolution failing at runtime is not
a wrong figure — it is **every voucher approval throwing**. Which is why the gate
grew a twelfth property that actually posts.

#### Three new gate properties, and why each exists

- **(10) Every stored `ledgerId` equals what the pure rule answers**, over all
  41,690 lines. The migration *restates* `resolveLedgerForLine`'s precedence in
  SQL — a migration in this repo imports nothing, because it is a historical
  record and a rule it imported would change under it. That makes it a mirror,
  and §13 is four paragraphs on what an unchecked mirror costs. Shown to fail:
  repointing one line reports the drift and names the row. It **skips**, rather
  than passing, before the column exists.
- **(11) The third balance cache equals its own Σ.** `acc_ledgers.currentBalance`
  joins `trx_groups.currentBalance` and `trx_accounts.balance` as a duplicate of
  a sum, and BUG-0042's whole lesson is that a drifted one is invisible to every
  ledger-derived report. The census is the only thing that sees it.
- **(12) Posting still works** — a party opening balance for an identity with
  **no ledger**, exercising the branch that provisions one, asserting the line
  carries a ledgerId, the ledger landed under a control-head group, and the
  cache was maintained. Rolled back, and (12e) asserts nothing survived: a gate
  that leaves a journal entry behind changes the books it is checking, and the
  parity harness's next capture would have seen it.

#### ⚠️ A ledger is provisioned on demand, and a new party's side comes from the posting

A party invited today has no `party_ledger_plan` row and no ledger. Refusing to
post a receipt for want of a row the engine can create is a regression, not a
safety property — so `resolveOrCreateLedger` creates it, **inside the posting
transaction**, so it commits with the entry that needed it or rolls back with it.

Its side is taken from **the control head the first posting is on**, not from
`derivePartySide`'s no-activity default. At migration time there was a history to
weigh and a human to review it (R8); here there is neither — but there is better
information than a default, namely which side of the books this party has just
appeared on. It is also what Tally does: you place a party under a group the
first time you use them.

#### ⚠️⚠️ The new foreign key broke company hard delete, and nothing local would have said so

`journal_lines.ledgerId` is `ON DELETE RESTRICT`. The topological sort had
`acc_ledgers` at position 25 and `journal_lines` at 62 — so **every company hard
delete would have been refused**, by a foreign key that had no edge describing
it. Caught by asking the delete order directly, not by a test: `onDelete`
behaviour lives only in the raw migration SQL and never in Sequelize's
association metadata, which is exactly why
`company-hard-delete-order.const.ts` is hand-transcribed.

**A new FK between two tenant-scoped tables is a new line in that file**, in the
same commit. Its own spec passes either way — it verifies the graph is
consistent, not that the graph is complete — and the test that would have caught
it, `qa-artifacts/tests/cross-service/hard-delete.spec.ts`, needs a running
stack. Verified afterwards that all **119** `companyId`-bearing tables are still
in the order.

---

### P2b‑2 record — 2026-08-28

**The reports stopped reading the shadow.** Every figure-bearing statement now
aggregates by `journal_lines.ledgerId` and maps each ledger back to the legacy
head it is presented under; `trialBalance`, `profitAndLoss`, `balanceSheet`,
`groupedTrialBalance`, `groupStatement`, both Outstanding reports, the party
statement and the Financial Dashboard's two analytics panels. **This is the
step where the declared exception finally appears in a report**, and it did:

| | |
|---|---|
| Paths that moved | **76,445**, across **seven** report families and nothing else |
| Undeclared differences | **0** |
| Unmet allowances | **0** |
| Δ Sundry Debtors / Creditors | **−₹2,51,44,323.21 / +₹2,51,44,323.21** — exactly what `party_ledger_plan` declared |
| Journal lines reported under a different head than they were posted to | **4,281** live (5,393 including cancelled), across 8 companies |
| `qa-p2-ledgers` | **232/232**, with three new properties |

| Artefact | What it is |
|---|---|
| `src/const/ledger-presentation.const.ts` (+ spec, **15 tests**) | The transitional rule: **which legacy head a ledger reports under**. Two branches — a `legacyTrxGroupId` *is* that head (D2 and D4's 536 ledgers); a party ledger reports under the control head of the side D3 parented it to (815). `presentationJoinSql` / `presentationGroupExpr` are the same rule in SQL, written once for the ten statements that paste it. |
| `qa-coa-parity exceptions` | Writes the declared exception as a **list** — 513 entries, each naming the party or the head it is about. |
| `qa-p2-ledgers` (13) (13b) (14) | The presentation rule is total over every posting ledger; the SQL says what the pure rule says; and **no party is outstanding on both sides at once**. |

#### Why the reports still render the legacy chart

Because repointing and re-rendering are two steps — P2b‑1's argument, one phase
on. **P3** is where the Trial Balance becomes a tree of `acc_groups` and a line
names its ledger. P2b‑2 changes only the mechanism, so that a wrong figure and a
wrong mechanism stay distinguishable, and its gate is that **exactly one thing
moves**.

That it did is the result worth reading twice. Seven families changed —
`groupStatements` (75,407 paths, all on the two control heads of the 8 affected
companies), `trialBalance`, `balanceSheet`, `financialDashboard`,
`outstanding.vendor`, `outstanding.customer`, `parties.summary`. The Day Book,
both registers, the cash and bank books, daily cash, every party statement,
every pending-bill list and both cache censuses are **byte-identical**.

#### ⚠️ The gate was shown to fail, and the way it fails is the proof

P0's discipline: an empty diff proves nothing until the harness has been shown
to fail. So one `journal_lines` row in company 15 was repointed from the
`Purchase` ledger to `General Expenses` — **`ledgerId` only, leaving the shadow
`trxGroupId` untouched**, which is exactly the shape of a mis-mapped backfill.

- Under the new code the harness reported **47 differences**, naming
  ₹1,75,455.32 in every place it surfaced: the P&L expense rows, both Trial
  Balance periods, the dashboard's group panel.
- Under the **old** code, the same injected row produced **an empty diff**.

That second half is the phase's actual acceptance test. It is not "the reports
still answer the same"; it is *"the reports are reading the column we spent
P2b‑1 filling"* — and nothing else could have said so, because both versions
agree on every figure that is not a merged party's.

#### The exception is generated, and it is derived from the LINES

513 allowances, not 76,445, because §4.2's own test for an exception that has
stopped being one is *"a list nobody could review"*. One entry per **named row**
— a control head's statement, a Trial Balance row, a party's summary card, a
party's line in an Outstanding report — each carrying the party's name, the side
D3 parented them to, and the amount displaced.

Three things about it that are deliberate:

- **It is derived from the repointing, not from `party_ledger_plan`.** The plan
  is D3's *decision*, and `qa-p2-ledgers` (8b) already checks the movement
  against it. What the allow-file needs is the other question — *which figures
  does the repointing touch?* — and the honest source for that is every live
  journal line whose ledger's presentation head differs from the head it was
  posted to. The plan supplies only the **reason** text.
- **`judge` fails an allowance that matched nothing**, so the generator may not
  be generous. Getting that right needed three predicates, not one, and
  companies 32 and 33 are what proved it: their displaced lines predate the
  active financial year and net to zero on each head, so **that year's Trial
  Balance row does not move even though the head's membership did**. A period
  column moves iff a displaced line falls inside it; an opening moves iff the
  lines before it do not net; a closing — and every total, and the Balance Sheet
  — moves iff the lines up to the period's end do not net.
- **`periodsOf` is now shared by `capture` and `exceptions`**, because a period
  label is half of every allowance path. Two derivations of one label is the
  mirror problem this plan is about, one level down.

The file is **generated, not committed** (`scripts/_reports/` is gitignored, and
the ids in it are one installation's). Re-run `npm run qa:coa-parity --
exceptions` before every diff.

#### ⚠️⚠️ Two reads are deliberately still on the shadow, and they are LABELS

`dayBook`'s line label and `accountBook`'s `particulars` still join
`trx_groups` through `jl.trxGroupId`. They are not figures, and moving them now
would relabel **5,393 lines** to the *wrong* head's name on the way to the right
one — P3 turns both into the **ledger's** name, which is what a Tally user reads
in a Day Book ("Ramesh Traders", not "Customer Dues"). Moving them in this phase
would also have cost the gate a per-entry allowance list, i.e. the thing §4.2
says an exception may not become.

The other shadow readers, all of which answer the **same figure** either way
because their heads are 1:1 with a D2 ledger — listed so the D9 sweep has a
list rather than a grep (§13 still-open #3):

| Reader | Why it is unaffected |
|---|---|
| `DashboardService.cashBankBalance` · `.profitMtd` · `.gstLiability` | instrument and tax heads, one ledger each |
| `Gstr3bService` GL cross-check | tax heads |
| `ExportJobService` day-book export | a **label**, same class as the two above |
| `PostingService.rebuildBalances` | it maintains `trx_groups.currentBalance`, which **is** the shadow's own cache and must keep reading it |
| `party-ledger-plan.ts` | it measures the historical position *by head*; reading it through the ledger would make D3's own derivation circular |

`DashboardService.partyOutstanding` is the one that **was** moved, and had to be:
it is the KPI card sitting one screen from the Outstanding reports, and leaving
it behind would have shipped a card and a breakdown that count different rows —
BUG-0043's rule, which this codebase has already paid for twice.

#### The tape measure changed too, and both changes were needed before the capture

- **Outstanding rows had no identity.** `vendorId`/`customerId` are in no
  `IDENTITY_KEYS` entry, so those rows fell back to their **index** — and both
  reports are `ORDER BY outstanding DESC`, so one moved balance renumbered every
  row behind it and reported the whole report as changed. Property 2 of
  `parity-snapshot.const.ts`, failing on the one report the exception is most
  about.
- **The Financial Dashboard was not in the snapshot at all**, and the merge moves
  money between two account **natures** on its top panel. It is in now
  (`formatVersion` 2), with `monthlyTrend` replaced by a marker because it is
  the one figure in the whole snapshot derived from *today* rather than a stated
  period.

> ⚠️ `financialDashboard.topGroups` is a **top-20 ranking**. On this data every
> row it moved is one of the 16 control heads, so the exception stays
> attributable — but a ranking is the one shape a parity diff cannot attribute,
> and if a future capture shows a `topGroups` row that is **not** a control head,
> that is the ranking cascading. Do not widen the exception to cover it; drop the
> panel from the snapshot the way `monthlyTrend` is dropped.

---

### Verification pass — 2026-08-28

The plan was written from a reading of the source. It has since been checked
against the **running code and the live development database** (14 companies,
41,690 journal lines, 564 groups, 27 instruments), and against Tally's own
documentation. Most of it held. **Five things did not**, and two of them would
have broken the migration:

| # | What changed | Where |
|---|---|---|
| **V1** | `company_parties` covers **16 %** of the parties that actually have ledger postings. D3's population source was wrong and D5 would have failed on 84 % of party lines. | [§1.2 F13](#12-sixteen-findings) · [§4.1 D3](#41-order-of-operations) |
| **V2** | **63 parties carry live balances on BOTH control heads** — and **76** move a figure when merged, which is not the same set ([§P2a](#p2a-record--2026-08-28)). Merging them into one ledger shifts **₹2,51,44,323.21** between the two heads — so "every report renders identical numbers" **cannot hold**, and the Balance Sheet still balances while it happens. **Decided:** derive the side, human-review it, and make the netting the one enumerated exception to the gate. | [§1.2 F14](#12-sixteen-findings) · [R8](#risks) · [closed #4](#closed-on-2026-08-28) |
| **V3** | The repo **already has** a Tally 28-group table — `tally-nature-map.const.ts`, used by the Data Import module. A second one would be the mirror problem §13 warns about. | [§3.2](#32-mapping-todays-groups-onto-tallys-tree) |
| **V4** | The Data Import module is an unlisted consumer of the whole migration — and its biggest beneficiary. | [§1.2 F15](#12-sixteen-findings) · [P2](#p2--ledgers-become-the-postable-leaf-xl--the-hard-one) |
| **V5** | **Multi-GSTIN** — TallyPrime keeps several GST registrations in one company; we key one GSTIN per company. A parity gap the plan never named. **Decided:** reserve a nullable `registrationId` at D1, build later. | [§2.5](#25-what-tally-has-that-this-plan-does-not-cover) · [R9](#risks) · [closed #5](#closed-on-2026-08-28) |

What the pass **confirmed**, so it need not be re-litigated: the §2.1 group tree
(15 primary + 13 sub, Reserves & Surplus under Capital Account); the §3.7 cost
centre design, which matches Tally's own description clause for clause; the four
id holders in D6; `resolveSystemGroup` as the single seam; and F8 — `trx_natures`
is exactly four rows per company across all fourteen, with no drift to preserve.

---

## 0 · Scope decisions

Taken 2026-08-28. Each is load-bearing for a different part of the plan.

| Axis | Decision | What it forces |
|---|---|---|
| **Account model** | Full Tally model | New `acc_ledgers` becomes the postable leaf; `trx_groups` becomes a hierarchy; `journal_lines` is repointed. Parties and bank accounts become real ledgers. |
| **Entry UX** | Full Tally replacement | One keyboard-first Voucher Entry surface for every type, including Sales and Purchase. The current item grid survives as Tally's *Item Invoice* mode — see [§3.5](#35-voucher-entry--one-screen-two-modes) and risk [R1](#risks). |
| **Data** | Live — migrate in place | Every step reversible, every figure asserted identical before and after, no journal entry re-posted. Shadow columns stay for one release. |
| **Extra scope** | All four groups | Cost centres, Trading Account & Gross Profit, bill-wise details, plus budgets, interest, multi-currency and scenarios. |
| **Dual-role parties**<br>*(2026-08-28)* | Derive the side, **then have a human review it** | 63 parties are a debtor and a creditor at once, and **76** move a figure when merged (the two sets differ — [§P2a](#p2a-record--2026-08-28)). One ledger per party is kept — it is what Tally does — so ₹2,51,44,323.21 shifts from Sundry Debtors to Sundry Creditors. The assignment is written to a reviewable table before D5 and is overridable per row; the netting is the **one declared exception** to the parity gate. [§4.2](#42-the-parity-harness) · [R8](#risks) |
| **Multi-GSTIN**<br>*(2026-08-28)* | **Reserve the column now**, build later | `acc_ledgers`, the voucher header and `bill_references` each carry a nullable `registrationId` from D1. Not wired to anything in this programme. Retrofitting it after P2 has repointed every journal line and P5 has built the bill register would be a second migration over the same tables. [§2.5 X1](#25-what-tally-has-that-this-plan-does-not-cover) · [R9](#risks) |

> ⚠️ **One concern, on the record.** Full Tally replacement of **Sales and
> Purchase** entry is the single highest-risk item here. That path carries GST
> classification snapshots (`applyCatalogueSnapshots`), e-invoice IRN payloads,
> e-way bills, HSN/UQC resolution, stock movements and price capture. It is
> designed the way Tally itself resolves the tension — one voucher screen with
> two modes — so nothing on that path is rewritten, only re-hosted. **If the
> mode toggle is ever dropped, all of it has to be rebuilt inside the Dr/Cr
> grid.**

---

## 1 · What the Transaction module is today

The accounting core is sound double-entry. It stops one level short of the model
the users already know.

### 1.1 The chart of accounts is two levels and flat

| Table | Rows per company | Role |
|---|---|---|
| `trx_natures` | Exactly 4 | Asset · Liability · Income · Expense. Also carries `trxType` (debit/credit). Exposed as a **user-editable** Masters screen. |
| `trx_groups` | ~37 seeded | A **flat** list under a nature. **This is the postable leaf.** Carries `groupFor`, `systemKey`, `isSystem`, and two balance caches. |
| `trx_accounts` | 1 seeded | Cash/bank/UPI/card instruments. Each silently auto-creates and auto-renames a backing `trx_groups` row. |
| `journal_lines` | millions | `trxGroupId` NOT NULL · `trxAccountId` nullable (cash/bank legs only) · `partyUserId` nullable (party legs only). |

A prior refactor deliberately *removed* a ledger layer and merged it into groups
(`LEDGER_REMOVAL_PLAN.md`, cited in `trx-group.entity.ts`'s doc comment).
Everything downstream was rebuilt around that decision — which is why
re-introducing ledgers is structural, not additive.

### 1.2 Sixteen findings

Numbered because the rest of the plan refers back to them. F1–F12 were written
from the source; **F13–F16 came out of the 2026-08-28 verification pass** against
the running code and the live database, and two of them change the migration.

**F1 — A customer is not an account.** `[high]`
Every receivable posts to one shared `SUNDRY_DEBTORS_CONTROL` group; the party is
a *column on the line*. The Trial Balance therefore prints a single row,
"Customer Dues (Sundry Debtors)", where a Tally user expects a group that expands
to every customer. Per-party balances exist only in bespoke reports that group on
`partyUserId`.
*`posting.const.ts:101` · `reports.service.ts:56` · `party-statement.service.ts`*

**F2 — No group hierarchy at all.** `[high]`
`trx_groups` has no `parentId`. No Capital Account, no Fixed Assets, no Current
Assets, no Direct vs Indirect expense split. The Balance Sheet is two flat lists
of leaf heads with net profit appended.
*`reports.service.ts:218`*

**F3 — No Trading Account, and the code says so.** `[high]`
Closing stock is credited to **Income** via `CLOSING_STOCK_INCOME`, with a comment
admitting the reason: *"this app's P&L is a flat Income-vs-Expense split with no
separate Gross Profit / Trading Account concept."* There is no Gross Profit figure
anywhere in the product.
*`posting.const.ts` · `closing-stock.const.ts`*

**F4 — `groupFor` welds the chart of accounts to the voucher UI.** `[high]`
A head is pickable only in the voucher context its enum names — `purchase`,
`sales`, `payment`, `receipt`, `journal`, `charge`, `account`. A user who creates
"Electricity Expenses" as a journal head will not find it on a Payment voucher.
Tally decides pickability from the group's nature, never from a per-voucher enum,
so this is the most likely source of *"why can't I select my own ledger?"*.
*`trx-group.entity.ts:12`*

**F5 — Cash and bank live in a parallel universe.** `[medium]`
`trx_accounts` is a second account entity with its own balance cache, its own
opening balance, its own `AccountType` taxonomy — and a hidden shadow group per
row. Two balance caches, two opening-balance mechanisms, two sets of report code
(`cashBook`/`bankBook` vs `groupStatement`). In Tally a bank is a ledger under
Bank Accounts and nothing else.
*`trx-accounts.entity.ts` · `account-type.const.ts`*

**F6 — Four entry components, fourteen routes, one missing idea.** `[high]`
Each voucher type is its own route with its own field order, its own keyboard
behaviour and its own save semantics. Journal alone has a bolted-on
`simple`/`multi` mode toggle. Nothing offers the one thing a Tally operator does
all day: pick a voucher type with a function key and type Dr/Cr rows without
leaving the keyboard.

> ⚠️ **Corrected 2026-08-28.** This finding said *"six voucher screens"*. There
> are **four** entry components, and the largest of them already serves **ten**
> document types:
>
> | Component | Lines | Serves |
> |---|---|---|
> | `trx-add-edit` | **2,274** | purchase-requisition · purchase-order · goods-receipt · purchase · quotation · sales-order · delivery-challan · sales · credit-note · debit-note |
> | `trx-payment-receipt-add-edit` | 526 | payment · receipt |
> | `trx-journal-add-edit` | 353 | journal |
> | `trx-contra-add-edit` | 300 | contra |
>
> Both halves of that cut against the plan's sizing, in opposite directions.
> **Fewer components** to re-host than P4 assumed — but **six more document
> types**, and six of them (requisition, order, goods receipt, quotation, sales
> order, delivery challan) post **no GL at all** (`buildLegs ⇒ []`). Tally
> reaches those with `Ctrl+F8`/`Ctrl+F9` for orders and `Alt+F8`/`Alt+F9` for
> delivery and receipt notes, which §2.2 already lists and §3.5's key map only
> partially covers. **The unified screen has to host a document with no posting
> at all**, and that is a third mode, not a variant of the two named in §3.5.
>
> *`vouchers/` — 32 files across 6 folders; `trx-add-edit.ts` alone is 2,274 lines.*

**F7 — No drill-down.** `[medium]`
Balance Sheet → Group → Ledger → Voucher is the spine of how Tally is actually
used, and none of those links exist. `groupStatement` is reachable only as its own
report with a group picker.
*`reports/` — 15 flat report routes*

**F8 — The four natures are editable masters.** `[medium]`
`/masters/trx-nature` lets a user rename, add or delete an account nature. These
are structural — every report branches on them, and `ACCOUNT_NATURE_META` is a
total `Record` over the enum. Tally's primary groups cannot be deleted, and
neither should these.
*`masters/trx-nature` · `account-nature.const.ts`*

**F9 — Opening balances are a form field, not an account fact.** `[low]`
`trx_groups.openingBalance` and `trx_accounts.openingBalance` are posted as an
opening journal entry against `OPENING_BALANCE_EQUITY`. Correct as far as it goes,
but there is no Dr/Cr choice, no per-party opening bill breakdown, and no
"Difference in Opening Balances" figure — the number Tally shows when the two
sides do not agree.

**F10 — Absent entirely.** `[medium]`
Cost centres and cost categories · budgets · interest calculation · multi-currency
· scenarios · voucher classes · a ledger monthly summary · Bills
Receivable/Payable as first-class registers. All of these sit inside the requested
scope.

**F11 — Two derived balance caches that no report reads.** `[low]`
`trx_groups.currentBalance` and `trx_accounts.balance` are Σ-duplicates of
`journal_lines`, written only by `PostingService.persistLines`. Every statement
deliberately ignores them; the funds summary and Financial Dashboard read them. A
drift is invisible to the reports that matter. This constrains the migration —
see [§4](#4-migrating-live-books-without-moving-a-figure).

**F12 — Blast radius, re-measured 2026-08-28.** `[planning input]`
`trxGroupId` appears **168 times across 31 backend files** — verified exactly.
`trx_groups` appears **65 times across 17 files** (the plan said "65 raw SQL
sites"; 65 is the string count, and not all of it is SQL). The frontend has
**73 references across 20 files**, not the 55-across-14 first recorded.

The good news is where they concentrate: `posting.service.ts` (37) and
`reports.service.ts` (15), and **every system head resolves through one seam** —
`resolveSystemGroup()` at `posting.service.ts:1123`. Next after those two:
`voucher-import.const.ts` (13 — see F15), `dashboard.service.ts` (11),
`trx-payment-receipt.controller.ts` (9), `trx-account.service.ts` (8).

**F13 — The party registry the migration needs is not `company_parties`.** `[critical]`
Measured on the development database: **362** distinct `(companyId, partyUserId)`
pairs carry postings on a control head. `company_parties` holds a row for **58**
of them — **16 %**. On eight of the thirteen companies with party postings it
holds **none at all**:

| companyId | parties on the ledger | with a `company_parties` row |
|---|---|---|
| 28 | 187 | 53 |
| 29 | 80 | **0** |
| 30 | 40 | **0** |
| 31 | 20 | **0** |
| 15 · 16 | 10 each | **0** |
| 32 · 33 · 1 | 4 · 4 · 2 | **0** |

`company_members` (`userKind = 'party'`, keyed `identityId`) and `user_details`
each cover **362 of 362**. This is D-02's unfinished split showing through
(CLAUDE.md §4.3: *"`company_parties` still owns the per-company balances"* — and
little else). D3 is repopulated accordingly; see [§4.1](#41-order-of-operations).

**F14 — 63 parties are a debtor and a creditor at the same time.** `[critical]`
Trading both ways with one party is ordinary, and today it renders honestly:
their receivable sits in `SUNDRY_DEBTORS_CONTROL` and their payable in
`SUNDRY_CREDITORS_CONTROL`, as **two Trial Balance rows on opposite sides**.
Measured over live entries only (`liveEntrySql`), 63 parties hold a non-zero
balance on **both**, ₹1,80,78,934 gross on the debtor side against ₹4,28,14,914
on the creditor side.

⚠️ **This finding originally said ₹1,57,11,850 nets away the moment they become
one ledger. Both halves of that were wrong** (corrected 2026-08-28 while
building D3 — [§P2a](#p2a-record--2026-08-28)). The figure was
`Σ min(|debtorNet|, |creditorNet|)`, which is the movement only when a party is
parented to the side with the larger *net*, and §4.1 D3 parents by **gross**.
And 63 is not the population that matters: **76** parties move a figure, the
extra 13 having a zero net on the side their gross points at, so they never
appear as dual-role at all. The measured movement is **Sundry Debtors
−₹2,51,44,323.21, Sundry Creditors +₹2,51,44,323.21** — a shift between the two
heads, not a fall on both.

There is also **nothing to parent them by**: `UserKind` is `staff | party |
system`, `company_parties` has no role column, and `PartyDirection` is decided
**per voucher** by the posting engine, never stored on the party. The plan's
"by their declared role" has no field to read. See [R8](#risks) and
[closed #4](#closed-on-2026-08-28).

**F15 — The Data Import module already speaks Tally, and nobody told the plan.** `[medium]`
`src/const/import/` holds `tally-nature-map.const.ts` — Tally's 28 reserved
groups with their natures and a `resolveReservedAncestor` walk up a parsed
parent chain — plus `voucher-import.const.ts` (13 `trxGroupId` references),
`opening-balance.const.ts`, `party-import.const.ts` and four import services.
It is a **consumer** of everything P2 changes, and it is the migration's largest
single beneficiary: today it must **flatten** a customer's Tally tree into our
flat groups through a mapping-review screen, because there is no tree to import
*into*. After P2 there is. See [§3.2](#32-mapping-todays-groups-onto-tallys-tree)
and [P2](#p2--ledgers-become-the-postable-leaf-xl--the-hard-one).

**F16 — In fourteen companies, not one user has created an account head.** `[evidence]`
Every company carries exactly **one** `sales` group, one `purchase`, one
`journal`, one `debit-note` and one `credit-note`. All 196 non-system groups
across all fourteen companies are the seeded ones; the 40.3 groups per company
are the 37 of `TRX_GROUPS` plus the auto-created backing group per instrument.

Read two ways, both useful. It is the strongest available evidence for **F4** —
a chart of accounts nobody extends is one that cannot usefully be extended. And
it makes **D2 far safer than the plan assumed**: there is no corpus of
hand-made heads whose parentage has to be guessed. The mapping in §3.2 is,
today, exhaustive.

---

## 2 · Tally reference — what we are matching

Only the parts that constrain the design. Where two secondary sources disagreed on
whether a group is "primary" or a "sub-group", the **parent linkage** is what the
reports depend on, so that is what is recorded.

### 2.1 The 28 predefined groups

Two predefined **ledgers** also exist from birth: `Cash` under Cash-in-Hand, and
`Profit & Loss A/c` at the root. Users may add groups anywhere and nest them
without limit; predefined groups cannot be deleted.

```
BALANCE SHEET — Liabilities side
Capital Account
└─ Reserves & Surplus
Loans (Liability)
├─ Bank OD A/c          (alias: Bank OCC A/c)
├─ Secured Loans
└─ Unsecured Loans
Current Liabilities
├─ Duties & Taxes        ← every GST head, input AND output
├─ Provisions
└─ Sundry Creditors      ← one ledger per supplier
Suspense A/c
Branch / Divisions

BALANCE SHEET — Assets side
Fixed Assets
Investments
Current Assets
├─ Bank Accounts
├─ Cash-in-Hand          └─ ledger: Cash
├─ Deposits (Asset)
├─ Loans & Advances (Asset)
├─ Stock-in-Hand
└─ Sundry Debtors        ← one ledger per customer
Misc. Expenses (Asset)

PROFIT & LOSS
Sales Accounts
Purchase Accounts
Direct Incomes      ┐
Direct Expenses     ┴ above the Gross Profit line
Indirect Incomes    ┐
Indirect Expenses   ┴ below it
```

### 2.2 Voucher types and the keyboard

TallyPrime ships 24 predefined voucher types. The accounting set:

| Key | Voucher | Key | Voucher | Key | Voucher |
|---|---|---|---|---|---|
| `F4` | Contra | `F7` | Journal | `Alt+F5` | Debit Note |
| `F5` | Payment | `F8` | Sales | `Alt+F6` | Credit Note |
| `F6` | Receipt | `F9` | Purchase | `Alt+F7` | Stock Journal |
| `Ctrl+F8` | Sales Order | `Alt+F8` | Delivery Note | `Ctrl+F7` | Physical Stock |
| `Ctrl+F9` | Purchase Order | `Alt+F9` | Receipt Note | `Ctrl+F4` | Payroll |

Three general shortcuts do most of the work: **`Ctrl+A`** accepts and saves from
anywhere on the screen, **`Alt+C`** creates a master (ledger, stock item, cost
centre) without leaving the field that needed it, and **`Ctrl+H`** changes the
voucher's *mode* — which is how one Sales voucher serves both an accounting-only
bill and a stock invoice. **`F12`** opens per-screen configuration.

- **Accounting Invoice mode** — ledger rows only ("Consultancy Fees ₹50,000"). No
  stock. In our terms: no `trx_items` at all.
- **Item Invoice mode** — stock items first, each allocated to a sales/purchase
  ledger, then ledger rows for freight and tax. In our terms: **this is the form
  that exists today.**

### 2.3 Bill-wise details — the four reference types

Turned on per party ledger (*Maintain balances bill-by-bill*); the whole of
Tally's receivables/payables reporting derives from it.

| Type | Meaning | Creates a bill? | Our nearest equivalent |
|---|---|---|---|
| **New Ref** | This voucher raises a new debt — an invoice. | Yes | A `trx` row with an outstanding balance. |
| **Agst Ref** | Settles a named existing bill. | No — reduces one | `trx_payment_receipt_transactions` allocation rows. |
| **Advance** | Money moved before any bill exists; adjustable later. | Yes, as a negative-side reference | **Nothing.** Lands as unallocated party balance. |
| **On Account** | Deliberately unreferenced — the holding pen. | No | **Nothing named.** Same silent bucket as Advance. |

### 2.4 Cost centres

A parallel allocation dimension that never touches the ledger's own balance. Every
cost centre belongs to a **cost category**; Tally supplies one called *Primary Cost
Category* and a business may add more, so one expense can be allocated to a
department *and* a location at the same time. A **cost centre class** pre-defines a
percentage split so an operator picks one name and the allocation happens
automatically.

> **Design consequence — copy this exactly.** Allocations must **not** be extra
> journal lines. That would double GL volume and put a second, weaker balancing
> rule into the engine. One `cost_allocations` table pointing at
> `journal_lines.id` keeps the ledger untouched and makes cost reporting a join.

### 2.5 What Tally has that this plan does not cover

Found by the 2026-08-28 pass. Recorded here rather than folded into the phases,
because each is a **scope decision**, not an oversight to be silently corrected.

| # | Tally does | We do | Verdict |
|---|---|---|---|
| **X1** | **Several GST registrations inside one company** (TallyPrime 3.0+; extended again in 6.1). State-wise GSTINs share one set of books, one chart of accounts, one Balance Sheet, and file a return each. | `companies.gstin` is **one nullable column**. A business registered in three states needs three companies — so three charts of accounts, three sets of books, and no consolidated Balance Sheet. | **Genuine parity gap, unplanned.** Structural: it touches the voucher header, GST return assembly, the e-invoice and e-way paths, and the party master. See [R9](#risks), [closed #5](#closed-on-2026-08-28). |
| **X2** | **IMS — Invoice Management System.** Download supplier invoices, Accept / Reject / Pending inside the product, keep books and the IMS dashboard in sync (TallyPrime 5.0+). | Nothing. | **Adjacent, and getting less optional.** GSTR-3B Table 3.1/3.2 has been hard-locked since **July 2025**; ITC in Table 4 auto-populating from GSTR-2B is indicated for around **July 2026** and **is not yet firmly notified** — check the GSTN advisory before building to a date. Once it lands, ITC not accepted in IMS cannot be claimed, so a purchase carries an **IMS state** the purchase register has to show. §3.11 #5's dated field map covers a return's *shape* changing, not this *workflow*. |
| **X3** | **Connected Banking and auto-reconciliation** — bank statements pulled in, vouchers proposed from them, exact matches reconciled automatically (TallyPrime 6.0). | Manual entry only. | **Out of scope, and the plan already leaves room.** §3.1's call to keep `trx_accounts` as an instrument satellite — IFSC, UPI id, account number, credit limit — is exactly the row a statement importer needs to key on. Nothing here forecloses it. |

X2 and X3 are **not** proposed for this programme. They are written down so that
P8's flexibility layer is designed to *accept* them rather than be retrofitted
around them — and so that "Tally parity" is not later read as having promised
them.

**Sources:**
[Ledgers and Groups](https://help.tallysolutions.com/ledgers-and-groups-in-tallyprime/) ·
[Keyboard Shortcuts](https://help.tallysolutions.com/keyboard-shortcuts-tally-prime/) ·
[Cost Centres](https://help.tallysolutions.com/cost-centre-or-profit-centre-tally/) ·
[Managing Outstanding Receivables](https://help.tallysolutions.com/manage-receivables-outstanding-tally/) ·
[Voucher Types and Classes](https://help.tallysolutions.com/tally-prime/accounting/voucher-types-tally/) ·
[28 Predefined Groups](https://www.ankititsolutions.com/28-predefine-groups-in-tally-prime/) ·
[Bill-wise Details](https://tallysolutions.com/tally/bill-wise-details-report-in-tally-prime/) ·
[Multi-GSTIN in one company](https://tallysolutions.com/tally/manage-multi-gstin-in-single-company-with-tallyprime/) ·
[IMS in TallyPrime](https://tallysolutions.com/gst/gst-invoice-reconciliation-tallyprime-ims/) ·
[Release 6.0 notes](https://help.tallysolutions.com/release-notes-tallyprime-6/)

> **Verified 2026-08-28.** §2.1's tree was re-checked against Tally's own help
> and the 15-primary/13-sub arithmetic: Reserves & Surplus **is** under Capital
> Account, Current Liabilities **is** primary, and Bank OD A/c sits under Loans
> (Liability) — 1 + 3 + 3 + 6 = 13 sub-groups, which is the check that settles
> it when a secondary source garbles the table. §2.4's cost-centre design was
> re-checked the same way and matches Tally clause for clause, **including the
> property the design turns on**: allocations do not affect the trial balance.

---

## 3 · Target architecture

Eleven design decisions. Each names the files it lands in, because this repo's
conventions — pure rules in `src/const/*.const.ts` with a spec beside them,
registries that fail a test when unclassified — decide where a change is allowed
to go.

### 3.1 Schema

| Table | Status | Shape |
|---|---|---|
| `acc_groups` | **new** | `id · companyId · name · parentId (self FK, nullable) · path · depth · rootKey · nature (enum) · isPrimary · isSystem · systemKey · sortOrder`. `path` is a materialised path (`/1/7/22/`) so a report rolls up with a `LIKE 'path%'` prefix rather than a recursive CTE. |
| `acc_ledgers` | **new** | `id · companyId · name · groupId · code · isSystem · systemKey · billwise · costCentresApplicable · currencyId · openingBalance · openingSide (Dr/Cr) · openingDate · currentBalance · partyUserId (nullable) · trxAccountId (nullable) · legacyTrxGroupId (nullable) · registrationId (nullable — reserved, see below) · isActive`. **The postable leaf.** |
| `journal_lines` | altered | `+ ledgerId` (NOT NULL after backfill). `trxGroupId` demoted to a nullable shadow for one release. `trxAccountId` and `partyUserId` **kept** — denormalised, no longer the mechanism, and cheap for the reports that already index on them. |
| `trx_groups` | altered | Survives the migration as a read-only compatibility view of `acc_ledgers`, then is dropped in a later release. **Not** deleted in the same migration that repoints the lines. |
| `trx_accounts` | altered | Loses `balance`, `openingBalance` and `trxGroupId`; gains `ledgerId` (1:1). Becomes a pure **instrument-detail satellite** — IFSC, UPI id, credit limit — hanging off a ledger. `AccountType` and its `FundGroup` taxonomy survive untouched, so the cash/bank book derivation (D-54) keeps working. |
| `trx_natures` | **retired** | Replaced by `acc_groups.nature` plus the fixed `AccountNature` enum. The Masters screen and its permission key go (F8). |
| `cost_categories` · `cost_centres` · `cost_allocations` | **new** | [§3.7](#37-cost-centres-and-categories) |
| `bill_references` | **new** | [§3.6](#36-bill-wise-details) |
| `voucher_types` · `voucher_classes` · `posting_rules` | **new** | [§3.4](#34-the-posting-engine-becomes-an-interpreter), [§3.11](#311-the-flexibility-layer) |
| `statutory_heads` | **new** | [§3.11](#311-the-flexibility-layer) — the dated levy→ledger registry. |
| `budgets` · `budget_lines` · `currencies` · `exchange_rates` · `scenarios` | **new** | [§3.9](#39-budgets--interest--multi-currency--scenarios) |

> ⚠️ **`registrationId` is reserved, not implemented** (decided 2026-08-28, X1).
> `acc_ledgers`, the voucher header and `bill_references` each carry a nullable
> `registrationId` from D1, referencing nothing and read by nothing. It is there
> because multi-GSTIN is a real parity gap this programme does not close, and the
> cheapest moment to leave room for it is **before** P2 repoints every journal
> line and P5 builds the bill register — after that, adding it is a second
> migration over the same tables. **Do not wire it up opportunistically**: a
> column that is half-read is worse than one that is not read at all, and the
> whole point of reserving it is that the decision to use it is taken once,
> deliberately, later.

> ⚠️ **Why a materialised path and not a recursive CTE.** The three statement
> queries in `reports.service.ts` already carry measured optimiser hints and an
> aggregate-before-join restructuring because the naive four-table join took
> **9.9 s** on a 250k-voucher company. Adding a `WITH RECURSIVE` group walk on top
> of that is the wrong direction, and it also collides with `ci-guard-raw-sql`,
> which has no notion of a CTE and would need every derived table inside it to
> bind `companyId`. A stored `path` keeps the reports as flat aggregate-then-join
> and keeps the guard's job unchanged.

### 3.2 Mapping today's groups onto Tally's tree

Every existing `trx_groups` row becomes a **ledger** under the Tally group named
here. Nothing is deleted, nothing is merged, **no figure moves** — a group's total
is the sum of its child ledgers, so the Trial Balance value for "Sundry Debtors"
after migration equals the old "Customer Dues" line exactly.

| Today (`trx_groups`) | Becomes ledger under | Note |
|---|---|---|
| Cash In Hand *(system)* | Cash-in-Hand | Named **Cash**, matching Tally's predefined ledger. |
| Bank / UPI / wallet / card accounts | Bank Accounts · Cash-in-Hand | Routed by `AccountType` → `FundGroup`. Credit cards go to **Current Liabilities**, which is what `isLiabilityAccountType` already says. |
| Customer Dues (Sundry Debtors) | **Sundry Debtors** — becomes a *group* | One ledger per party. The control account stops being a ledger. |
| Supplier Dues (Sundry Creditors) | **Sundry Creditors** — becomes a *group* | Same. |
| CGST/SGST/IGST Input · Output · GST Input Credit · GST Output Payable · RCM Payable · TDS Payable | Duties & Taxes | Tally puts input and output GST in the same group. Keeps GSTR reconciliation reading from one subtree. |
| PF · ESI · PT Payable | Duties & Taxes | Statutory dues. |
| Salaries Payable | Provisions | Under Current Liabilities. |
| Employee Advances | Loans & Advances (Asset) | |
| Closing Stock | Stock-in-Hand | |
| Closing Stock (P&L) | **retired** | Dies with the Trading Account ([§3.8](#38-trading-account-and-gross-profit)). Historic lines keep pointing at the migrated ledger; only new postings stop using it. |
| Opening Balance Equity | Capital Account | Plus a new system ledger **Difference in Opening Balances** under Suspense A/c (F9). |
| Sales · Sales Return | Sales Accounts | |
| Purchase · Purchase Return | Purchase Accounts | |
| Freight · Labour · Packaging · Installation · Additional Charges | Direct Expenses | Re-parentable. Freight *charged to a customer* is arguably Indirect Income — that judgement is now the customer's to make, which is the point. |
| General Expenses · Salaries & Wages · Employer PF/ESI | Indirect Expenses | |
| Other Receipts | Indirect Incomes | |
| Other Payments | Indirect Expenses | |
| Party Receipt · Party Payment | **retired** | Artefacts of `groupFor` (F4). A receipt posts party ↔ bank; it never needed a head of its own. |

The mapping lives in `src/const/provisioning/tally-chart.const.ts` as pure data
with a `.spec.ts` beside it, exactly like `company-defaults.const.ts`. **Two
properties the spec must assert:** every seeded `TRX_GROUPS` key has a target, and
every target names a group that exists in the 28.

> ⚠️ **The 28 are already in this repo — do not write them twice** (V3).
> `src/const/import/tally-nature-map.const.ts` holds
> `TALLY_RESERVED_GROUP_NATURE`: all 28 reserved group names keyed lower-case,
> each with its `AccountNature`, and `null` on the two Tally itself leaves
> ambiguous (`branch / divisions`, `suspense a/c`) so nothing guesses a nature
> for them. Beside it, `resolveReservedAncestor` already walks a parsed parent
> chain up to the nearest reserved group — which is *exactly* the lookup a
> re-parenting rule needs.
>
> `tally-chart.const.ts` must therefore **extend** that file's table with the
> parent linkage and the sort order it lacks, and the two must share one list of
> names. Two independent transcriptions of the same 28 names in one repo is the
> mirror problem §13 spends four paragraphs on — and this one would have **no
> `check-mirrors.js` check behind it**, because both copies live in the same
> submodule and that script only compares across repos. A spec asserting the two
> tables have identical key sets is the cheapest thing that can fail here.

> ⚠️ **This table's "no figure moves" claim holds for every row above and fails
> for the parties** (F14). A group's total is the sum of its child ledgers, so
> each mapped head reappears intact. A party who is **both** a debtor and a
> creditor cannot: one ledger sits under one group, and the two control balances
> net. **76 parties, ₹2,51,44,323.21** — moved between the two heads rather than
> netted off both (the original *"63 parties, ₹1.57 crore"* was a `min()`; see
> [§P2a](#p2a-record--2026-08-28)). See [R8](#risks).

### 3.3 The Ledger module

**Backend**
- `modules/accounting/` gains `LedgerController`, `LedgerService`,
  `AccGroupController`, `AccGroupService`.
- Pure rules in `src/const/ledger.const.ts`: which groups accept a ledger, whether
  a ledger may be deleted (never, once posted — `posting-source-lifecycle.const.ts`'s
  rule generalised), and how a group's nature is inherited.
- **Nature is inherited from the root group and never stated on a ledger.** A
  ledger cannot be an Asset under Indirect Expenses.
- Re-parenting a group rewrites `path` for its whole subtree in one transaction,
  and is refused across natures once the subtree has postings.

**Frontend**
- `/transaction/ledgers` — a tree-plus-grid Chart of Accounts replacing today's
  three separate Masters screens (Nature, Group, Account).
- Ledger create/alter with Tally's field order: Name → Under → opening balance with
  Dr/Cr → bill-wise → cost centres → GST/statutory detail.
- `app-ledger-picker`, a paginated searchable select used by **every** voucher
  screen. Replaces the six different group pickers that exist today.
- `Alt+C` on the picker opens ledger-create inline and returns the new id to the
  field — Tally's create-on-the-fly. The repo already has `AddDialogService` for
  this shape.

> 🔒 **Security — easy to get wrong.** The ledger list needs `@SharedRead()`
> because every module's voucher screen picks from it. It must be declared
> **`@SharedRead({ parties: false })`**. A ledger list carries **bank account
> names and balances**, and D-46/BUG-0031 is exactly the case where "any
> authenticated user" quietly meant "including the customer you are invoicing".
> `shared-read-party.spec.ts` sweeps new routes automatically, so this fails
> loudly — but get it right at the decorator.

### 3.4 The posting engine becomes an interpreter

Today `buildLegs` is a switch over `PostingVoucherKind` and `LegRole`, with
`resolveRole` mapping a role to an id and `resolveSystemGroup` resolving a
`systemKey`. That is a good structure and it is *nearly* the Tally model already.
The change is to move the leg table out of code and into data:

```
posting_rules
  id · companyId · voucherTypeId · voucherClassId(null) · seq
  legRole      'party' | 'main' | 'statutory' | 'charge' | 'instrument' | 'roundoff'
  side         'dr' | 'cr' | 'signed'
  amountExpr   'net' | 'tax' | 'grandTotal' | 'charge' | 'net+charges'
  headCode     null | 'CGST_OUTPUT' | 'RCM_PAYABLE' | ...   → statutory_heads
  effectiveFrom / effectiveTo
```

`buildLegs` keeps its signature and its purity — it becomes a function of
`(rules, voucher)` instead of a switch, and `posting.const.spec.ts` keeps testing it
the same way. `resolveSystemGroup` becomes `resolveStatutoryLedger(code, onDate)`,
still one seam, still one method.

**What this buys:** the CGST/SGST/IGST split, the RCM leg (D-52), reverse charge
being purchase-only, the closing-stock pair — all become rows with dates instead of
branches. A new levy, a changed head, a state that wants a different control
account: a seed row and a migration, not a change to a file that eleven other
things depend on.

### 3.5 Voucher entry — one screen, two modes

A single routed component, `/transaction/voucher`, replaces the six entry screens.
It is the whole of the "full Tally replacement" decision.

| Element | Behaviour |
|---|---|
| **Voucher type** | `F4` Contra · `F5` Payment · `F6` Receipt · `F7` Journal · `F8` Sales · `F9` Purchase · `Alt+F5` Debit Note · `Alt+F6` Credit Note, plus `Ctrl+F8/F9` for orders. Switching type on an unsaved blank voucher is free; on a dirty one it asks. |
| **Mode** | `Ctrl+H` toggles **Accounting Invoice** ↔ **Item Invoice**. Contra, Payment, Receipt and Journal are accounting-only. Sales, Purchase and both notes default to Item Invoice and remember per voucher type. ⚠️ **A third mode is needed** — see below. |
| **Accounting mode grid** | Dr/Cr rows: side · ledger · amount · (bill-wise popup if the ledger is bill-wise) · (cost-centre popup if applicable). Running Dr and Cr totals with the difference shown live; save is refused while it is non-zero, **in the voucher's own words** rather than a form error. |
| **Item mode grid** | **The existing form, re-hosted.** `trx-add-edit`'s item grid, its pricing engine, its GST classification, its charges and its attachments move in as a child component. `applyCatalogueSnapshots`, `TrxWriteService`, the e-invoice and e-way bill paths, HSN/UQC and price capture are **untouched**. |
| **`Alt+C`** | Create ledger / stock item / cost centre inline from the field that needed it. |
| **`Ctrl+A`** | Accept and save from anywhere. `Ctrl+S` kept as an alias — several screens already bind it. |
| **`F12`** | Per-voucher-type configuration, replacing `/transaction-config/:trxType` as a modal rather than a route. |
| **Narration** | Always last, always full width, always present. It is the field Tally operators use most and it is currently folded behind a chip. |

> ⚠️ **Two modes was one short** (F6, 2026-08-28). `trx-add-edit` already serves
> **ten** document types, and six of them — purchase requisition, purchase order,
> goods receipt, quotation, sales order, delivery challan — post **no GL at all**
> (`buildLegs ⇒ []`). A document with items and no legs is neither Accounting
> Invoice (ledger rows, no stock) nor Item Invoice (stock rows allocated to
> ledgers, then tax): the Dr/Cr totals it would show are both zero, and the
> balancing rule the accounting grid rests on has nothing to say about it. Tally
> keeps these on their own keys — `Ctrl+F8`/`Ctrl+F9` for orders, `Alt+F8`/`Alt+F9`
> for delivery and receipt notes (§2.2). **Name the third mode before building
> the toggle**; retrofitting a "no posting" case into a grid whose invariant is
> "Dr must equal Cr" is how that invariant gets weakened.

> ⚠️ **What must not be lost.** The voucher options bar, `revealInvalidPanel`, the
> maker–checker lifecycle and `voucher-lifecycle.const.ts`'s rules all stay exactly
> as they are. The lifecycle is compared behaviourally across both repos by
> `check-mirrors.js` against **487 vectors** — if the entry rewrite changes a
> lifecycle answer, that check is what tells you, and the answer is to change the
> vectors deliberately or not at all.

### 3.6 Bill-wise details

```
bill_references
  id · companyId · ledgerId · journalLineId · voucherId
  refType  'new' | 'against' | 'advance' | 'on-account'
  refName          -- the bill number the operator sees
  againstRefId     -- set only for 'against'
  amount · dueDate · creditPeriodDays
```

A party ledger with `billwise = true` pops the reference grid on save, pre-filled:
a Sales voucher proposes **New Ref** with the invoice number; a Receipt proposes
**Agst Ref** rows for every open bill oldest-first. The existing allocation
machinery — `TrxPaymentReceiptController.buildAllocation`'s create-time cap and
`ApprovalService.applyReceiptSettlement`'s `FOR UPDATE` re-check (BUG-0029/0030) —
is what writes `against` rows. It is **not replaced**; it gains two sibling types
it never had.

**Advance** and **On Account** are the genuinely new behaviour, and they close a
real gap: today an unallocated receipt is a silent party balance with nothing
naming it. `outstanding.const.ts`'s two-sign rule (D-18 — a refund due is reported
beside the receivable, never netted into it) extends naturally: an Advance is a
negative-side open item, an On Account amount is reported as unapplied.

> **Reconciliation, finally.** BUG-0040 named the standing problem: a party's
> position exists twice — `journal_lines.partyUserId` on the control heads, and
> `trx` plus its allocations — and the two reconcile only if every term is
> accounted for. `bill_references` hangs off `journalLineId`, so it is derived from
> the **same rows** as the ledger side. D-55's synthesised opening-balance bill
> becomes an ordinary `refType: 'new'` row with no voucher behind it, and the two
> sides stop being two sides.

### 3.7 Cost centres and categories

```
cost_categories   id · companyId · name · allocateRevenue · allocateNonRevenue · isPrimary
cost_centres      id · companyId · categoryId · name · parentId · path
cost_allocations  id · companyId · journalLineId · costCentreId · amount
cost_centre_classes / _lines   -- percentage templates (Tally's Cost Centre Class)
```

- Enabled per ledger via `costCentresApplicable`, so it stays invisible to
  companies that do not use it.
- **Allocations never touch the GL.** The journal entry balances without them; a
  partial or missing allocation is a warning on a reconciliation report, not a
  refused save.
- Σ allocations per line must equal the line amount **per category** — that
  invariant is a pure function in `src/const/cost-allocation.const.ts` with its
  spec, and it is where the parallel-category rule lives.
- Reports: Cost Centre Summary, Category Summary, Cost Centre Breakup, Ledger
  Breakup — the four Tally ships.

### 3.8 Trading Account and Gross Profit

Direct/Indirect is the split that makes a Gross Profit line possible, and it
arrives free with the group hierarchy. The P&L becomes two stacked statements:

**Trading Account**
- `Dr` Opening Stock · Purchase Accounts · Direct Expenses
- `Cr` Sales Accounts · Direct Incomes · Closing Stock
- **= Gross Profit / Loss**, carried down

**Profit & Loss Account**
- Gross Profit b/d · `Cr` Indirect Incomes
- `Dr` Indirect Expenses
- **= Net Profit / Loss** → Balance Sheet

**This retires the `CLOSING_STOCK_INCOME` workaround (F3).** Closing stock appears
on the credit side of the Trading Account where it belongs, and the Balance Sheet
reads it from Stock-in-Hand. The change is **forward-only** — the same doctrine
D-19 and BUG-0034 set. Vouchers already posted keep their legs; the *statement* is
what changes, and it changes for history too because the statement is derived.

### 3.9 Budgets · Interest · Multi-currency · Scenarios

**Budgets.** `budgets` (name, period) + `budget_lines` (groupId *or* ledgerId *or*
costCentreId, amount, type: on closing balance / on nett transactions). Reports gain
a **Budget variance** column, which is a second aggregate over the same rows — no
engine change at all.

**Interest calculation.** Per-ledger simple/compound rate + basis (30-day month,
calendar, per annum), applied over `bill_references` for bill-wise parties and over
the running balance otherwise. Produces an *Interest Report*; posting it is an
explicit Debit Note the user accepts, **never automatic**. Pure rule in
`src/const/interest.const.ts`.

**Multi-currency.** `currencies` + `exchange_rates` (dated, buy/sell/standard).
`journal_lines` gains `currencyId · fcAmount · rate`; **`debit`/`credit` stay in
base currency and stay authoritative** — every existing report is unaffected by
construction. Unrealised gain/loss becomes a system ledger under Indirect
Income/Expense, computed on demand.

**Scenarios.** A named set of voucher types marked *optional* or *provisional*,
includable in a report without being in the books. A flag on `voucher_types` plus a
`scenarioId` filter threaded through the report layer — genuinely cheap once
`voucher_types` exists, which is why it is grouped here.

### 3.10 Reports and drill-down

The report layer keeps its architecture — derived purely from `journal_lines`,
caches deliberately not consulted — and gains a hierarchy and a spine.

| Report | Change |
|---|---|
| **Trial Balance** | Rows become **groups**, collapsed by default, expanding to sub-groups then ledgers — Tally's own default. A "Ledger-wise" toggle flattens it. Closing-only vs opening/movement/closing columns become a config, not a shape. |
| **Balance Sheet** | Liabilities \| Assets in Tally's section order, with Capital Account, Loans, Current Liabilities / Fixed Assets, Investments, Current Assets. Profit & Loss A/c shows opening plus current period as two lines. |
| **Profit & Loss** | Trading Account then P&L, per §3.8. |
| **Ledger** *(new)* | The report that does not exist today: one ledger, monthly summary rows, each expanding to its vouchers, each opening the voucher. This is what a Tally user means by "open the ledger". |
| **Group Summary** *(new)* | A group's children with closing balances — the intermediate step of every drill-down. |
| **Bills Receivable / Payable** *(new)* | Derived from `bill_references`, with ageing. Supersedes the two Outstanding screens, which keep redirecting. |
| **Cash / Bank Book** | Become instances of the Ledger report. `CASH_BOOK_ACCOUNT_TYPES`'s derivation (D-54) is preserved as the group assignment during migration, so no account can fall out of every book the way UPI did. |
| **Day Book** | Gains voucher-type filter chips and drill into the voucher. Otherwise unchanged. |
| **Cost Centre reports** *(new)* | Four, per §3.7. |

**The drill-down is one shared mechanism**, not per-report links: a `DrillTarget`
union (`group` \| `ledger` \| `voucher`) with a single resolver, so a new report
gets drill-down by emitting the right target. Tally's Esc-goes-back is a **route
stack**, not browser history — a report opened from a Balance Sheet returns to that
Balance Sheet with its date intact.

### 3.11 The flexibility layer

*This is the part of the plan that answers "future tax and government rule changes
adoptable with minimal change". It is five mechanisms, not one.*

| # | Mechanism | A change that used to be code, now data |
|---|---|---|
| 1 | **Dated statutory head registry**<br>`statutory_heads(companyId, code, ledgerId, effectiveFrom, effectiveTo)` | A new levy — a fresh cess, a state surcharge — is a head code and a ledger row. `resolveStatutoryLedger('CESS_OUTPUT', voucher.date)` finds it, or refuses with a message naming the code and the date. |
| 2 | **Dated tax components**<br>extends the `effectiveFrom/effectiveTo` already on the tax master (D-50) | A levy's *composition* changes — GST splitting three ways instead of two, a rate reform like 22-09-2025. The component table says which heads a supply attracts on its own document date; `gstLineTax` stays the primitive that charges each head at its own rate. |
| 3 | **Posting rules** (§3.4) | A leg's direction, its amount basis or its head changes — RCM's own arrival (D-52) would have been rows. A rule carries dates, so old vouchers keep posting the way they were posted. |
| 4 | **Voucher types & classes** | A new statutory document — a new note type, a self-invoice variant — is a `voucher_types` row with its own numbering series and posting rules. Today it is an enum member plus a migration plus eleven switch arms. |
| 5 | **Dated return field maps**<br>`return_field_map(returnCode, table, field, headCode, from, to)` | GSTR-1's or 3B's schema changes. The return assembler stops naming heads and starts asking the map — which is also what makes "which head fed this cell?" answerable on screen. |

> **The rule that keeps this honest.** Every one of these five is **dated**, and
> every resolution takes the **document's own date**, never today's. That is
> already the doctrine in this codebase — `tax-validity.const.ts`, the
> two-schedule `TAX_SLABS` seed, `applyCatalogueSnapshots`, `applyAsOfDateCost`.
> Extending it to heads, legs and return fields means a statutory change is
> **forward-only by construction**: adopting it cannot rewrite a return already
> filed.

---

## 4 · Migrating live books without moving a figure

**The acceptance test for this whole migration is one sentence: every report
renders identical numbers before and after.** Not "ties out" — identical, figure
for figure, on every company.

### 4.1 Order of operations

| Step | Action | Reversible by |
|---|---|---|
| **D1** | Create `acc_groups` and `acc_ledgers`. Seed the 28 Tally groups per company from `tally-chart.const.ts`, keyed and remapped exactly the way `CompanyProvisioningService` already does — **never a literal id**. | drop tables |
| **D2** | One ledger per existing `trx_groups` row, parented per §3.2, carrying `legacyTrxGroupId`. The correspondence is a stored column, so the mapping is auditable rather than reconstructed. | `legacyTrxGroupId` |
| **D3** | One ledger per party, under Sundry Debtors or Sundry Creditors — **population and parentage per the note below**. Name from `company_parties.displayName ?? users.name`, which finally gives `displayName` a reader, the sweep BUG-0040's note says is still owed. | `partyUserId` on the ledger |
| **D4** | One ledger per `trx_accounts` row, under Bank Accounts / Cash-in-Hand / Current Liabilities by `AccountType`. `trx_accounts.ledgerId` written. | `trxAccountId` on the ledger |
| **D5** | **Backfill `journal_lines.ledgerId`**, in this precedence: `partyUserId` set on a control head → that party's ledger; else `trxAccountId` set → that account's ledger; else → the ledger whose `legacyTrxGroupId` matches `trxGroupId`. Then `NOT NULL`. | the shadow `trxGroupId`, kept |
| **D6** | Repoint the other four holders of a group id: `trx.groupId`, `trx_charges.groupId`, `trx_payment_receipts.trxGroupId`, and journal voucher `lines[].trxGroupId`. | shadow columns |
| **D7** | Backfill `bill_references` from `trx` (New Ref) and `trx_payment_receipt_transactions` (Agst Ref), plus D-55's synthesised opening bills. | drop table |
| **D8** | Rebuild both caches through `PostingService.rebuildBalances` — the existing repair door at `POST /trx-accounts/rebuild-balances`. **Not** a second writer (F11, BUG-0042). | re-run |
| **D9** | Drop `trx_natures`, the `groupFor` column and the shadow columns — **a separate release**, after the parity gate has held in production for one cycle. | — |

> ⚠️ **D3 as first written would have failed on 84 % of party lines** (V1, F13).
> It said *"one ledger per `company_parties` row"*. That table holds **58** of the
> **362** `(companyId, partyUserId)` pairs that actually carry control-head
> postings, and **none at all** on eight of the thirteen companies with party
> activity — D-02's split was never finished, and `company_parties` ended up
> owning balances and little else. D5's first precedence rule (*"`partyUserId` set
> on a control head → that party's ledger"*) would then have found no ledger for
> five party lines in six, and the `NOT NULL` at the end of D5 is where the
> migration would have stopped.
>
> **The population is the union of two sets, and it must be a union:**
> `company_members WHERE userKind = 'party'` (815 rows — the roster, including
> parties who have never been invoiced) **∪** every distinct
> `(companyId, partyUserId)` on `journal_lines` (362 — including anyone whose
> membership has since been tombstoned but whose postings remain). Each covers
> 362 of 362 on its own today; taking the union is what stops the next
> tombstoned party from re-opening this. `company_parties` becomes what it
> already is — a **detail satellite** for GSTIN, PAN, address, `displayName` and
> the opening balance — read for the ledger's name and fields, never for its
> existence.
>
> ⚠️⚠️ **There is no role to parent them by, so D3 derives one and a human
> confirms it** (decided 2026-08-28). D3 said "by their declared role". `UserKind`
> is `staff | party | system`; `company_parties` has no such column; and
> `PartyDirection` is decided **per voucher** inside the posting engine and stored
> nowhere. The rule:
>
> 1. **Derive** the side from the control head carrying the party's larger
>    **gross** volume — gross, not net, so a party who has settled down to a
>    small balance is still parented where their trading actually happens.
>    A party with activity on one side only takes that side; a party with none
>    (453 of them: on the roster, never invoiced) goes under Sundry Debtors.
> 2. **Write the whole assignment to a reviewable table before D5**, carrying
>    both gross figures, the derived side and the netted amount — a `party_ledger_plan`
>    the migration reads rather than recomputes, so what shipped is auditable
>    afterwards rather than reconstructed from the rule.
> 3. **Every row is overridable** by an operator before D5 runs. The 63 that net
>    are the ones worth a human's attention and are flagged as such; the other 299
>    are unambiguous.
>
> Tally's own guidance is the same shape — *place the party where you would
> naturally look for them* — which is a judgement, not a computation, and that is
> exactly why step 3 exists. **The derivation is a proposal; the table is the
> decision.**

### 4.2 The parity harness

A script — `scripts/qa-coa-parity.ts`, in the family of the 67 that already exist
— snapshots every report for every company before D5 and re-runs them after:

- Trial Balance, P&L, Balance Sheet at three period boundaries each
- Every party statement and both Outstanding reports
- Cash book, bank book and daily cash for every account
- Day Book over the full history
- The census already written for BUG-0042: every cache compared against its Σ

Differences are reported **per figure**, not as a pass/fail. **The migration does
not ship until the diff is empty — except in exactly one place, named below.**

> ⚠️ **Do not write a second oracle.** `qa-artifacts/tests/reports/` is already
> 10,280 lines over 23 files, with `statement-rules.ts` (415 lines) and
> `party-rules.ts` **restating** the report rules rather than importing them —
> plus the BUG-0042 cache census in `outstanding.spec.ts`, which D8 needs
> anyway. The parity harness is a **snapshot-and-diff over those endpoints**,
> and it belongs beside them. A third restatement of what a Trial Balance means
> is a mirror that cannot fail.

> ⚠️⚠️ **The empty diff is not achievable once a party's two positions share one
> ledger, and pretending otherwise is how this gate gets switched off** (V2,
> F14). **76 parties** displace a balance between the two control heads:
> **Sundry Debtors falls by ₹2,51,44,323.21 and Sundry Creditors rises by
> exactly that.** The Balance Sheet still balances afterwards — the two moves
> are equal and opposite *by construction* — which is precisely why nothing but
> a figure-for-figure diff would catch it, and why a "does it still balance?"
> check is not a substitute.
>
> ⚠️ **This paragraph used to say 63 parties and ₹1,57,11,850 off EACH side, and
> both halves were wrong** (corrected 2026-08-28 while building D3 —
> [§P2a](#p2a-record--2026-08-28)). The figure was `Σ min(|debtorNet|,
> |creditorNet|)`, which is the movement only when a party is parented to the
> side with the larger *net* — and §4.1 D3 parents by **gross**, deliberately.
> And 13 of the 76 are not dual-role at all: one net zero, the other not, the
> gross pointing at the zero side. Keying the exception list off *"holds a live
> balance on both heads"* would have left thirteen unexplained differences in a
> diff required to be empty apart from a named list. `displacedBalance` in
> `src/const/ledger.const.ts` is the rule; `party_ledger_plan.displacedBalance`
> is the per-party figure.
>
> So the harness needs a **declared, enumerated exception**: the affected party
> set is computed **before** D3, written out with both gross figures and the net,
> and the diff is asserted to contain *those rows and nothing else*. An exception
> list that is a list is a gate; an exception that is a tolerance is not.
>
> ✅ **Built, and it is `npm run qa:coa-parity -- exceptions`** (P2b‑2). 513
> entries, one per **named row** rather than per path — 76,445 paths would be the
> list nobody could review that the sentence above is warning about. Each names
> the party or the head it is about, and each is derived from the **repointing
> itself** (every live line whose ledger's presentation head differs from the
> head it was posted to), with `party_ledger_plan` supplying only the reason
> text — so the allow-file and the plan are two independent derivations that have
> to agree.
>
> One more consequence, easy to miss: `trialBalance`'s
> `HAVING openingNet <> 0 OR periodDebit <> 0 OR periodCredit <> 0` suppresses
> zero rows. A dual-role party whose two sides net to **exactly** zero does not
> move a figure — it **disappears from the Trial Balance altogether**. That is a
> row count changing with no figure changing, and a diff keyed on figures alone
> will not see it.

> ⚠️ **Four things that will bite.**
> **(1)** MySQL 8's default `sql_mode` includes `ONLY_FULL_GROUP_BY` — a
> non-aggregated column beside a `GROUP BY` aborts the migration, which is exactly
> how `rcm-payable-head` shipped as a release that would not install (BUG-0051).
> **(2)** Write every step **idempotently**, checking `information_schema` first,
> so a re-run is a no-op.
> **(3)** The party-ledger step is the **volume** risk: a company with 5,000
> parties gets 5,000 ledgers — fine for the schema, wrong for a Trial Balance that
> renders leaves by default. Hence §3.10's collapsed-by-default. For calibration,
> the development database's largest company has **187** parties on the ledger
> against 40 groups, so the Trial Balance goes from ~40 rows to ~230 there — a
> five-fold jump, not the thousand-fold the 5,000-party case implies, but past
> the width at which a flat list is readable.
> **(4)** `journal_lines.trxGroupId` is `ON DELETE RESTRICT` against `trx_groups`,
> and D5 adds a second FK beside it. Adding `ledgerId` as `NOT NULL` in one
> statement is not available — the column arrives nullable, is backfilled, and is
> tightened in a **third** statement, with the FK added last. On the development
> database that is 41,690 rows; the 250k-voucher company is where the lock window
> has to be measured rather than assumed.

---

## 5 · Phases

Sizing is relative, not calendar. **P0–P4 is the core**: at the end of P4 the
product is Tally-shaped and everything after is additive. Each phase ships behind
its own gate and leaves the app working.

### P0 · Foundations and the parity harness `[M]`

Build the safety net before touching anything. `scripts/qa-coa-parity.ts`, a full
report snapshot of every QA company, and CI wiring for the three `ci-guard-*`
scripts on both backends (§13 still-open #1, which this programme cannot proceed
safely without).

**Gate:** snapshot is reproducible twice with an empty diff, on unchanged code.

### P1 · Groups become a hierarchy `[M]`

`acc_groups`, the 28 Tally groups, `tally-chart.const.ts` + spec, materialised path
and its rebuild-on-reparent. `trx_groups` untouched; nothing posts here yet. Trial
Balance gains an *optional* grouped view reading the new tree through
`legacyTrxGroupId`.

**Gate:** grouped Trial Balance totals equal the flat one, per nature and overall.

### P2 · Ledgers become the postable leaf `[XL — the hard one]`

> **Split into P2a and P2b (2026-08-28), and the split is the safety property.**
> P2a is everything that is **additive** — D1–D4, the tables and the ledgers —
> and it ends with D5's resolution run over every existing journal line as a
> **dry run**. P2b is the first step that is not additive. §4.1 D5 ends with a
> `NOT NULL`; V1/F13 records what discovering a gap *there* costs, and a script
> run is the cheap way to find out. **P2a is done** —
> [§P2a record](#p2a-record--2026-08-28).
>
> **P2b split again on 2026-08-28, on the same argument.** P2b‑1 is D5 — the
> lines name a ledger. **P2b‑2 is the reports reading it**, which is the only
> step in the whole programme that moves a figure, so it lands with the parity
> diff as its entire gate and nothing else in the commit to confuse a
> difference. **P2b‑3 is what remains:** D6's four other holders of a group id,
> the Ledger module's CRUD and `app-ledger-picker`, `resolveSystemGroup` →
> `resolveStatutoryLedger`, the remaining `trx_groups` sites, and the Data
> Import module below — all of it additive or mechanical, and all of it gated on
> the diff being empty again.

D1–D8. `acc_ledgers`, the party and instrument ledgers, `journal_lines.ledgerId`,
the four other id holders, `resolveSystemGroup` → `resolveStatutoryLedger`, and all
65 `trx_groups` sites. The Ledger module's own CRUD and the shared
`app-ledger-picker`.

**And the Data Import module, which is not optional here** (F15). `src/const/import/`
carries 13 `trxGroupId` references in `voucher-import.const.ts` alone, plus
`opening-balance.const.ts`, `party-import.const.ts` and four import services, all
resolving a **group** as the posting target. They repoint with everything else.

The upside is worth stating, because it is the clearest user-visible win in the
whole programme: today a Tally import must **flatten** the customer's own tree
into our flat groups through a mapping-review screen, since there is nothing to
import a hierarchy *into*. After P2 there is — `resolveReservedAncestor` already
walks the parsed parent chain, so the tree the customer arrives with can be
**preserved rather than reconciled**, and the mapping review shrinks to the
genuinely ambiguous rows.

**Gate (P2a, met):** `npm run qa:p2-ledgers` — the ledger layer is complete and
**D5 resolves every journal line**, proved by a dry run over all 41,690, with
the declared exception computed a second independent way and agreeing. The
parity diff stays empty throughout, because nothing has been repointed.

**Gate (P2b‑1, met):** D5 landed — 41,690 lines repointed, `NOT NULL`, FK — and
the parity diff is **still empty**, because no report reads the column yet. Plus
three new properties: the stored column against the pure rule, the third cache
against its own Σ, and a live posting that provisions a ledger and is rolled
back. `npm run qa:p2-ledgers` — 229/229.

**Gate (P2b‑2, met):** the parity diff contains **the enumerated party exception
and nothing else** — 76,445 paths, 0 undeclared, 0 unmet, against a 513-entry
allow-file generated by `qa-coa-parity exceptions` and derived from the
repointing itself. `npm test` (1,812), all five CI guards, `lint:ci`, `build`
and `node scripts/check-mirrors.js` green; `qa:p1-group-tree` 126/126 and
`qa:p2-ledgers` 232/232. Shown to fail: a `ledgerId` repointed with the shadow
left alone reports 47 differences under the new code and **an empty diff under
the old** — [§P2b‑2 record](#p2b-2-record--2026-08-28).

**Gate (P2b‑3):** D6's four other id holders repointed, the Ledger module's CRUD
and `app-ledger-picker`, `resolveSystemGroup` → `resolveStatutoryLedger` and the
import module. The parity diff is empty again *on top of* P2b‑2's exception —
nothing in that phase may move a figure. Re-import one real Tally backup and
assert the resulting tree matches the source's parentage.

### P3 · Reports, drill-down, and the Ledger report `[L]`

Trial Balance as a tree, Balance Sheet in Tally sections, the new Ledger and Group
Summary reports, the shared `DrillTarget` resolver and the Esc route stack.
Cash/Bank Book become Ledger instances.

**Gate:** Balance Sheet → group → ledger → voucher reachable in four clicks from
every leaf, and back out with Esc preserving the period.

### P4 · Voucher entry `[XL]`

The unified entry screen, its modes, the function keys, `Alt+C`, `Ctrl+A`,
`Ctrl+H`, `F12`. `groupFor` stops being consulted (F4) and the picker offers what
the group nature allows. The old routes redirect — **fourteen of them, not six**
(F6).

> ⚠️ **§3.5 names two modes and the code needs three** (F6). Six of the ten
> document types `trx-add-edit` serves — purchase requisition, purchase order,
> goods receipt, quotation, sales order, delivery challan — post **no GL at
> all** (`buildLegs ⇒ []`). They are workflow documents with items and no legs,
> which is neither Accounting Invoice (ledger rows, no stock) nor Item Invoice
> (stock rows allocated to ledgers, then tax). Tally reaches them with
> `Ctrl+F8`/`Ctrl+F9` and `Alt+F8`/`Alt+F9`, already listed in §2.2 and only
> partly in §3.5's key map. Decide the third mode before building the mode
> toggle, not after.

**Gate:** `check-mirrors.js` reports no lifecycle drift across all 487 vectors;
`qa:money`, `qa:print` and `qa:shell` green; a keyboard-only operator can post one
of each voucher type without a mouse.

### P5 · Bill-wise details `[L]`

§3.6 in full, including Advance and On Account, Bills Receivable/Payable, and the
reconciliation that closes BUG-0040's two-sided problem for good.

**Gate:** for every party in every QA company, the ledger-side balance equals Σ of
its open bill references. That equality is a **test**, not a report.

### P6 · Trading Account and Gross Profit `[M]`

§3.8. Direct/Indirect assignment reviewed per company, the two-statement P&L, and
`CLOSING_STOCK_INCOME` retired from new postings.

**Gate:** Net Profit after the split equals Net Profit before it, on every company
and every period.

### P7 · Cost centres `[L]`

§3.7 in full, including categories, classes and the four reports.

**Gate:** every Trial Balance figure is unchanged by the presence of allocations —
the proof that the GL was not touched.

### P8 · Posting rules, budgets, interest, multi-currency, scenarios `[L]`

§3.4's rule table and §3.9's four features. Sequenced last **deliberately**: the
rule table is only worth extracting once the leg set has stopped moving, and doing
it earlier would mean rewriting it twice.

**Gate:** re-posting every QA voucher through the rule interpreter produces
byte-identical journal lines to the switch it replaced.

> **If the programme has to be cut.** P0–P4 is the coherent unit — it delivers the
> ledger model, the reports and the entry screen, which is what "work like Tally"
> means to a user. P5 is the highest-value single addition after that. P8's rule
> table is the one that pays for itself over years rather than at launch, and it is
> also the cheapest to defer, since `resolveStatutoryLedger` is already the seam it
> needs.

---

## 6 · Repo guard-rails this programme trips

This codebase fails a test rather than shipping a silent gap, in nine specific
places that new tables and new routes touch. Each is a **build break**, not a
review comment — which is the good news.

| Guard | What this programme must do |
|---|---|
| `tenant-scope-registry.const.ts` | Classify all fourteen new entities as `scoped`. An unclassified entity is a failing test. |
| `company-hard-delete-order.const.ts` | Add every new FK edge to the hand-transcribed edge list. Kahn's algorithm and the `information_schema` census in `hard-delete.spec.ts` will both catch an omission — the census asserts a deleted company leaves **zero** rows in every `companyId`-bearing table. |
| `ci-guard-raw-sql.ts` | All 65 rewritten sites bind `companyId` for **every joined scoped table**, not just the driving one (BUG-0047). The join allow-list is empty; keep it empty. Note the allow-list is keyed `path:line`, so an edit in a file with entries moves them — re-read each key after this work. |
| `ci-guard-cached-state.ts` | The ledger tree is the exact shape that caused BUG-0036 — a per-company structure that begs to be memoised on a singleton service. **Do not cache it.** One indexed read per request. |
| `audit-coverage.const.ts` | Ledger and group mutations are identity-and-money adjacent; tag them `@Audit()` and add the controllers to the covered set, or the new handlers sit outside a line D-36 drew deliberately. |
| `shared-read-party.spec.ts` | Sweeps every `@SharedRead()` route as a trading party and asserts the allow-list **exactly**. The ledger picker will be swept the day it lands (§3.3). |
| `parent-scope.spec.ts` · §4.3 rule 7 | Every caller-supplied `ledgerId`, `groupId`, `costCentreId`, `billReferenceId` needs an ownership check before it is written against. These point at company-scoped tables, so `findByPk` under the hooks is enough — but a `*UserId` still needs `assertMemberIsOurs`. Put the checks at a **seam**, not per call site (BUG-0032). |
| `check-mirrors.js` (root repo) | Nine checks. New permission keys must land in `permission-registry.ts`, `module-licence.const.ts`, the frontend `module-licence.ts` and `navigation.config.ts` **together**. Retiring `trx-nature` means retiring it in four places. ⚠️ It compares **across submodules only**, so the second copy of Tally's 28 group names — `tally-chart.const.ts` beside `tally-nature-map.const.ts`, both in `client-back` — is invisible to it (§3.2, V3). That pair needs a co-located spec asserting identical key sets, or it is a mirror with nothing behind it. |
| Data Import — `src/const/import/` | Not a guard, but it fails the same way: `voucher-import.const.ts`, `opening-balance.const.ts`, `party-import.const.ts` and four services all resolve a **group** as the posting target and must repoint inside P2 (F15). `voucher-import.const.spec.ts` and `opening-balance.const.spec.ts` are where it shows. |
| D-49's writer list · `assertPostingAllowed` | The unified entry screen adds writers of `journal_entries` and `stock_movements`. Every one must clear the financial-period gate on **both** dates when it supersedes an approved voucher (BUG-0028). `grep -rn "reverseSource\|inventoryService.reverse"` is the check, and CLAUDE.md §4.9 must list every writer. |

And **CLAUDE.md itself**: §15 requires the map to be updated in the *same commit*
as the change, for guard-chain changes, new permission keys, new licensed modules
and cross-service contracts. This programme touches all four. Sections 4.3, 4.9,
10, 12 and 14 need rewriting as the phases land — **§4.9 most of all**, since much
of it describes a ledger layer that will no longer exist.

---

## 7 · Risks, and calls made

### Risks

| # | Risk | Mitigation in this plan |
|---|---|---|
| **R1** | `[high]` Full Tally entry replacement destabilises the GST/e-invoice/e-way/stock path. | Item Invoice mode **is** the current form, re-hosted as a child component. No rewrite of `TrxWriteService`, `applyCatalogueSnapshots`, the IRN payload or stock movement. P4's gate includes `qa:money` and `qa:print`. |
| **R2** | `[high]` Repointing `journal_lines` on live books. | Shadow column kept for a release; parity harness gates the ship; no journal entry is re-posted, only re-pointed; D9 is a separate release. |
| **R3** | `[med]` Party-ledger explosion makes the Trial Balance unusable. | Groups collapsed by default (Tally's own behaviour). Ledger-wise is a toggle, and it pages. |
| **R4** | `[med]` Hierarchy queries regress report performance, already tuned with optimiser hints at 250k vouchers. | Materialised `path`, no recursive CTE; reports stay aggregate-then-join; roll-up by path prefix. Re-measure against the same dataset at P3's gate. |
| **R5** | `[med]` Cost allocations inflate GL volume or introduce a second balancing rule. | Allocations are a satellite table keyed to `journal_lines.id`. The GL never sees them; P7's gate is that no Trial Balance figure moves. |
| **R6** | `[med]` Multi-currency changes the meaning of every amount column. | `debit`/`credit` stay base-currency and authoritative; foreign amounts are additive columns. Every existing report is unaffected by construction. |
| **R7** | `[med]` Programme size — nine phases across two repos and 137 QA specs. | P0–P4 is the shippable unit; each phase leaves the app working and has its own gate. Nothing after P4 blocks anything before it. |
| **R8** | `[high]` **Merging a party's two positions moves real figures, and balances while it does.** ~~63 parties, ₹1.57 crore off each of Sundry Debtors and Sundry Creditors~~ → **76 parties; Sundry Debtors −₹2,51,44,323.21 and Sundry Creditors +₹2,51,44,323.21, exactly opposite.** Added 2026-08-28 (F14); figure corrected the same day while building D3 ([§P2a](#p2a-record--2026-08-28)) — the original was `Σ min(|debtorNet|,|creditorNet|)`, which under-counts because parentage is by *gross*, and misses 13 parties that are not dual-role at all. | The one declared exception to the parity gate, enumerated party by party before D3 and asserted as *exactly* that set (§4.2). Gross positions survive in `bill_references` (P5), which is where Tally itself keeps them. The parenting rule is reviewed by a human, not computed — [closed #4](#closed-on-2026-08-28). |
| **R9** | `[med]` **Multi-GSTIN is a parity gap this plan does not close**, and closing it later is harder once every ledger, party and voucher has been repointed once (X1). | Decide *before* P2 whether registration becomes a dimension. If yes, `acc_ledgers` and the voucher header carry a `registrationId` from the start — a nullable column added at D1 costs nothing and retrofitting it after P4 means a second pass over the same tables. If no, say so on the record. [closed #5](#closed-on-2026-08-28). |

### Calls made without asking

- **One ledger per party per company** — *not* one per direction. A party who is
  both keeps one ledger and shows on the side its balance falls, which is what
  Tally does (it does not restrict a ledger from carrying an obverse balance —
  a Sundry Debtor may sit in credit).
  > ⚠️ **Revised 2026-08-28.** This call said "parented … by their declared
  > role". **There is no declared role** — `UserKind` is `staff | party |
  > system`, `company_parties` has no such column, and `PartyDirection` is
  > decided per voucher inside the posting engine and stored nowhere (F14). It
  > also turns out to move **₹2,51,44,323.21 between the two control heads**
  > across 76 parties, which the call was made without knowing (measured while
  > building D3 — [§P2a](#p2a-record--2026-08-28); the first estimate,
  > *"₹1.57 crore off each side across 63 parties"*, was a `min()`). The call itself
  > stands — it is what Tally does — but it is now [closed #4](#closed-on-2026-08-28)
  > rather than a decision already taken, and its cost is the single declared
  > exception to the parity gate (§4.2).
  `partyUserId` stays on the line as a denormalised aid.
- **`trx_accounts` survives as an instrument satellite** rather than being deleted.
  It holds real detail (IFSC, UPI id, credit limit) that a Tally ledger holds in
  its own bank-detail block, and keeping it preserves `AccountType`'s derived
  cash/bank book split (D-54).
- **`trx_natures` is retired, not fixed in place.** Four rows per company that must
  never differ from a code enum are a table pretending to be data.
- **Cost allocations are never journal lines.** Stated as an invariant rather than
  a preference, because the alternative quietly weakens the one rule the whole
  engine rests on.
- **Interest is never auto-posted.** It produces a report; posting is an explicit
  Debit Note a person accepts. Tally behaves the same way, and the alternative
  writes into a customer's books without them asking.
- **Posting rules come last (P8), not first.** Extracting a rule table before the
  leg set stops moving means writing it twice.

### Open — confirm before P2 starts

1. **Group naming on migration.** Should existing companies' groups be **renamed**
   to Tally's names, or keep their current names as ledgers under Tally-named
   groups? *This plan assumes the latter* — an operator's own head names survive,
   only the tree above them is new.
2. **Direct vs Indirect assignment (P6).** A per-company review step with a guided
   screen, or a defaulted mapping they can re-parent afterwards? *This plan assumes
   defaults plus re-parenting.*
3. **Old voucher routes.** Permanent redirect at P4, or kept live behind a setting
   for one release? *This plan assumes permanent redirect.* Note the count is
   **fourteen** routes, not six (F6).

### Closed on 2026-08-28

Both were raised by the verification pass as blocking for P2, and both were
answered the same day. Recorded here rather than deleted, so the reasoning is not
rediscovered.

4. ~~**How is a dual-role party parented, and who decides?**~~ `[R8]` →
   **derive, then have a human confirm.** One ledger per party stays — it is what
   Tally does, and Tally lets a ledger carry an obverse balance rather than
   splitting the party. The side is derived from **gross** volume on each control
   head, the whole assignment is written to a reviewable `party_ledger_plan`
   before D5 with both gross figures and the netted amount, and every row is
   overridable. The 63 that net are flagged for attention; the other 299 are
   unambiguous. See [§4.1 D3](#41-order-of-operations).

   The rejected options are worth keeping. **Two ledgers per dual-role party**
   would have made the parity diff genuinely empty and was refused because one
   business appearing as two account heads is a worse daily cost than a
   one-time, enumerated, reviewed movement. **Deriving silently** was refused as
   BUG-0034's shape — a fact derived from a master with nothing reading it back —
   where the first reader of the change would have been a customer whose
   creditors figure had dropped overnight.

5. ~~**Does a company get more than one GST registration?**~~ `[R9]` →
   **reserve the column, build later.** `acc_ledgers`, the voucher header and
   `bill_references` carry a nullable `registrationId` from D1, wired to nothing.
   Multi-GSTIN stays out of this programme's scope; what changes is that the
   option survives it. See [§3.1](#31-schema) and [§2.5 X1](#25-what-tally-has-that-this-plan-does-not-cover).

   Note the direction this cuts against: CLAUDE.md §5 records that `companies`
   *deliberately* replaced the old GSTIN-keyed `tenants` table, whose
   `UNIQUE(gstin)` stopped one owner running several companies on one
   registration. That fixed the reverse problem. Reserving the column is what
   keeps this one answerable without undoing that.
