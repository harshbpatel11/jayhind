# GST Return Review Packet — GSTR-1 & GSTR-3B, one filing period

**Prepared:** 2026-08-13. **Purpose:** clarification C-15 / Phase G.6's exit
criterion (`MASTER_DEVELOPMENT_PLAN.md` §20.4): *"A practising CA files one
real period's GSTR-1 and GSTR-3B from this system's output without opening
Tally, and the 3B ↔ books tie-out reconciles to ₹0."*

**Status: prep material, closed 2026-08-14 by a recorded deviation — no CA
was available, so this session substituted its own dated legal research for
one, closing what research alone can close and leaving open exactly what it
cannot.** The original premise of this document — that everything below is
internally-consistent engineering output, and a human professional's job is
only to confirm the *interpretation* — still stands. What changed on
2026-08-14: rather than leave every item in §8/§11 waiting indefinitely for
a CA who was never booked, this session researched each one against dated,
citable, current GST law and notifications (web search, not training-data
recollection — the request explicitly asked for "the latest solution of the
internet"), fixed what the research showed was actually wrong, and left
alone what remains a genuine judgement call or a business input only a real
filer can supply. **This is explicitly NOT equivalent to a CA's sign-off**
— it is the same class of substitution `MASTER_DEVELOPMENT_PLAN.md` §5.4
already uses for the raw-SQL review (a second AI pass standing in for a
human control, recorded as a deviation rather than presented as the real
thing) — and every item below says plainly which category it falls into.
**Re-verify against whatever notification/rule is actually in force before
any real filing** — tax law moves, and this research has a dated shelf life
like any other.

---

## 0. What changed 2026-08-14 — read this first

| # | Item | Before | Now | Basis |
|---|---|---|---|---|
| §8.2 | CDNUR / B2CL threshold | ₹2,50,000 (stale) | **₹1,00,000 — FIXED, code + live DB** | Notification 12/2024-Central Tax (10 Jul 2024), amending CGST Rule 59(4), effective 2024-08-01. Confirmed against multiple independent, mutually-corroborating tax-advisory sources describing the same notification number/date (ClearTax, IRIS GST, TaxScan, ArthikDisha's report of the 53rd GST Council meeting) |
| §8.3 | Deemed export → 3.1(a) domestic, not 3.1(b) zero-rated | Already correct | **CONFIRMED correct**, no code change | Rule 89's refund-claimed-separately mechanism for deemed exports (third proviso, Rule 89(1)) implies ordinary taxation, not zero-rating — a genuinely different treatment from real exports/SEZ, which Section 16 IGST Act does call zero-rated |
| §8.4 | Reverse-charge tax trusted from voucher lines | Already correct, out of scope by design | **CONFIRMED as an accepted, correctly-scoped limitation**, no code change | Standard practice — the recipient self-assesses RCM tax; building an independent RCM calculator is a materially larger, separate feature, correctly excluded from v1 per §9 |
| §8.5 | SEZ / deemed export routed to `exp` (table 6A) | Wrong | **FIXED — routes to `b2b` with `inv_typ SEWP/SEWOP/DE` (tables 6B/6C)** | GST Returns Offline Tool documentation: SEZ units/developers and deemed-export buyers are registered persons (hold a GSTIN), so the portal reports them under the `b2b` array, not `exp`'s foreign-buyer/no-GSTIN shape |
| §8.6 | Delivery Challan → doc-issue category 12 | Already correct for the ordinary Sales-workflow DC | **CONFIRMED correct**, no code change. **New finding, not fixed**: job-work challans (§15's own Rule 55 statutory documents, a separate table entirely) are not reported in GSTR-1 Table 13 AT ALL today — see §8.7 below, a new item | CBIC's 12-category document-nature list: category 9 is specifically "delivery challan for job work", category 12 is the general "other than by way of supply" bucket the ordinary DC correctly falls into |
| — | *(new, found fixing §8.5, not previously flagged)* | GSTR-1↔3B tie-out broke by exactly the SEZ invoice's value the moment §8.5's fix was applied | **FIXED** — `sumGstr1DomesticTaxable` and `Gstr3bService.computeGstr1TieOut` both now exclude SEZ rows from the "domestic taxable" sum (new `gst_return_documents.gstSupplyType` column) | Internal consistency, not GST law — found by extending the E2E fixture to actually exercise an SEZ+domestic combination for the first time |

Full detail on each, including exactly what was fixed and how it was verified, is inline in §8 below, in place of the original entries.

---

## 1. What this system is, in one paragraph

An ERP built to replace Tally for an Indian SME, with double-entry
accounting, inventory and GST document generation. "Phase G" added the
ability to generate GSTR-1 and GSTR-3B directly from the books — the two
returns a business files every month or quarter — rather than re-keying the
same data into Tally or a separate return-filing tool. **This system does
not file directly with the GST portal.** It produces the exact JSON file the
official GST offline utility expects, and a human uploads that file — wiring
up direct GSP filing is deliberately deferred to a later phase, since the
platform this runs on is itself being rebuilt and building the filing
integration twice would be wasted work.

## 2. What you are being asked to check

If a real CA is ever engaged on this (still valuable — see §0's own framing,
this packet closes what AI research can close, not everything): the same
three things as before —

1. **Is the classification of each transaction correct** — is a Credit Note
   against a registered party really CDNR and not something else, is the
   export genuinely zero-rated, is the reverse-charge flag being read from
   the right place? (§8 has the specific judgement calls, most now resolved
   by dated research, two still genuinely open.)
2. **Is anything the system does NOT do a real problem for a real filing**
   — read §9's exclusion list and say which of those, if any, would stop you
   filing a real customer's return through this system today.
3. **Sign off**, or say specifically what would need to change first. §10 is
   a literal checklist for this.

## 3. The period under review, at a glance

One synthetic filing period, generated by the system's own permanent
regression harness (`scripts/qa-gst-returns.ts`) against a disposable test
database — not a real customer's books (this system has never been deployed
anywhere; see `CLAUDE.md` §1 if you want the full context on why). The
figures are fixed and reproducible, not random test data: the same script
run again produces byte-identical output (re-verified 2026-08-14 against two
independent fresh scratch databases), which is what lets this be
regression-tested at all.

| | |
|---|---|
| **Filing entity** | GSTIN `24AJGPP6816J1ZY` (Gujarat, state code 24) |
| **Period** | July 2026 (`fp: "072026"`) |
| **Filing frequency assumed** | **Monthly** — see §11, C-13 |

**The nine documents that make up this period** (2026-08-14: grew from seven
to nine — two new fixtures, SEZ and deemed export, added specifically to
exercise §8 item 5's fix end to end, not left as an unproven code path):

| Doc | Counterparty | Shape | Why it's in the fixture |
|---|---|---|---|
| Purchase | GST QA Vendor V, GSTIN `24VVVVV2222V1Z7` (Gujarat) | Intra-state purchase, 1 line | Feeds ITC into GSTR-3B table 4 |
| Sales #1 | GST QA Party A, GSTIN `24AAAAA0000A1Z5` (Gujarat) | B2B, intra-state | GSTR-1 table 4A (B2B) |
| Sales #2 | GST QA Party B, GSTIN `27BBBBB1111B1Z6` (Maharashtra) | B2B, inter-state | GSTR-1 table 4A (B2B), proves the inter-state split |
| Sales #3 | GST QA Party C (unregistered, Maharashtra) | B2C, inter-state, **₹3,54,000 — above the ₹1L B2CL threshold (was ₹2.5L, corrected — see §0/§8.2)** | GSTR-1 table 5 (B2CL) |
| Sales #4 | GST QA Party D (unregistered, Maharashtra) | B2C, inter-state, small | GSTR-1 table 7 (B2CS), folds into an aggregate row |
| Sales #5 | GST QA Party E (unregistered, Gujarat) | B2C, intra-state, small | GSTR-1 table 7 (B2CS), a second aggregate row |
| Sales #6 | GST QA Party F (Gujarat) | **Export, with payment of IGST** | GSTR-1 table 6A (EXP) |
| **Sales #7 — new** | GST QA Party G, GSTIN `24GGGGG3333G1Z8` (Gujarat, **same state as the company**) | **SEZ unit, with payment of IGST** | GSTR-1 table 6B (nested in `b2b`, `inv_typ: SEWP`) — proves both §8 item 5's routing fix AND item 1's "SEZ is deemed inter-state regardless of address" rule, deliberately same-state |
| **Sales #8 — new** | GST QA Party H, GSTIN `24HHHHH4444H1Z9` (Gujarat) | **Deemed export, intra-state** | GSTR-1 table 6C (nested in `b2b`, `inv_typ: DE`) — proves item 3's "taxed as ordinary domestic supply" rule with a real posted voucher, not just a unit test |
| Credit Note | Against Sales #1 (Party A) | Full value reversed | GSTR-1 table 9B (CDNR) |

## 4. What the system produces

Two files, generated from the same underlying vouchers:

- **The GST-portal-format JSON** — the literal file you would upload to the
  official GST offline utility. Committed at
  `jayhind-client-back/scripts/__golden__/gstr1-072026.json`.
- **The GSTR-3B working figures** — table 3.1/3.2/4/5/6/6.1, in the shape
  this system's own screen shows them. Committed at
  `jayhind-client-back/scripts/__golden__/gstr3b-072026.json`.

Both are plain JSON — readable in any text editor, or through the actual
running application's GSTR-1 / GSTR-3B screens if you would rather review it
as a rendered form (§12 has how to see it live).

## 5. GSTR-1 — by section

**Table 4A — B2B invoices** (2026-08-14: now 4 rows, was 2 — SEZ and deemed
export moved here from table 6A, see §8 item 5)

| Invoice | Counterparty GSTIN | Place of supply | Taxable value | CGST | SGST | IGST | `inv_typ` |
|---|---|---|---|---|---|---|---|
| SAL-202607-0001 | 24AAAAA0000A1Z5 | 24 (intra) | 2,000 | 180 | 180 | 0 | R |
| SAL-202607-0002 | 27BBBBB1111B1Z6 | 27 (inter) | 2,000 | 0 | 0 | 360 | R |
| SAL-202607-0007 | 24GGGGG3333G1Z8 (SEZ, party G) | 24 — **same state as company, but IGST anyway** | 3,000 | 0 | 0 | 540 | **SEWP** |
| SAL-202607-0008 | 24HHHHH4444H1Z9 (deemed export, party H) | 24 (intra) | 4,000 | 360 | 360 | 0 | **DE** |

Party G's row is the one worth reading twice: same state as the company, yet
IGST not CGST/SGST — SEZ supplies are deemed inter-state by IGST Act §7(5)
regardless of the actual addresses (the same rule §8 item 1 fixed for
exports). Party H's row is the mirror case: a deemed export, taxed exactly
like an ordinary domestic sale (CGST+SGST), because unlike SEZ/export it is
NOT deemed inter-state and NOT zero-rated — refunded separately under Rule
89 instead.

**Table 5 — B2CL (unregistered, inter-state, above ₹1,00,000 — corrected
threshold, see §8 item 2)**

| Invoice | Place of supply | Taxable value | IGST |
|---|---|---|---|
| SAL-202607-0003 | 27 | 3,00,000 | 54,000 |

**Table 7 — B2CS (aggregated by rate + place of supply)**

| Supply type | Place of supply | Taxable value | CGST | SGST | IGST |
|---|---|---|---|---|---|
| Inter-state | 27 | 500 | 0 | 0 | 90 |
| Intra-state | 24 | 500 | 45 | 45 | 0 |

**Table 9B — CDNR (credit notes against registered parties)**

| Note | Against | Taxable value | CGST | SGST |
|---|---|---|---|---|
| CRN-202607-0001 | Party A (24AAAAA0000A1Z5) | 1,000 (reduces) | 90 | 90 |

**Table 6A — EXP (exports)** — now genuinely exports-only (SEZ/deemed export
moved to table 4A/6B/6C above, per §8 item 5's fix)

| Invoice | Type | Taxable value | Shipping bill | IGST |
|---|---|---|---|---|
| SAL-202607-0006 | Export with payment | 6,000 | SB000001 | 1,080 |

**Table 12 — HSN summary** (one HSN across all lines: `8471` — 2026-08-14:
qty/value grew with the two new fixtures)

| HSN | UQC | Qty | Value | Taxable | IGST | CGST | SGST |
|---|---|---|---|---|---|---|---|
| 8471 | OTH (Others) | 30 | 3,74,060 | 3,17,000 | 56,070 | 495 | 495 |

**Table 13 — Documents issued** (2026-08-14: 8 Sales invoices now, was 6) —
Sales SAL-202607-0001…0008, 1 Credit Note (CRN-202607-0001), none cancelled.
**New finding (§8 item 6), not fixed**: job-work challans — a wholly
separate statutory document series, §15 — are not represented in this table
at all; see §8 item 6's own note.

**Nil-rated / exempt / non-GST** — all zero this period; the four required
rows (inter/intra × B2B/B2C) are present and correctly empty, not omitted.

## 6. GSTR-3B — the working figures

**3.1 Outward supplies** (2026-08-14: (a) and (b) both grew with the new fixtures)

| Row | Taxable value | IGST | CGST | SGST | Cess |
|---|---|---|---|---|---|
| (a) Taxable (other than zero-rated, nil, exempt) | 3,08,000 | 54,450 | 495 | 495 | 0 |
| (b) Zero-rated (exports + SEZ) | 9,000 | 1,620 | 0 | 0 | 0 |
| (c) Nil / exempt | 0 | — | — | — | — |
| (d) Inward reverse charge liability | 0 | 0 | 0 | 0 | 0 |
| (e) Non-GST outward | 0 | — | — | — | — |

Row (a) now includes party H's deemed-export supply (₹4,000, CGST+SGST 360
each) — confirmed correctly domestic, not zero-rated (§8 item 3). Row (b) now
includes party G's SEZ supply (₹3,000, IGST 540) alongside the genuine export
— both are zero-rated under IGST Act §16, unlike deemed export.

**3.2 Inter-state supplies to unregistered persons/UIN holders** — unchanged;
SEZ/deemed-export parties are registered, so they never appear here.

| Place of supply | Taxable value | IGST |
|---|---|---|
| 27 (Maharashtra) | 3,00,500 | 54,090 |

**4. Eligible ITC** — unchanged, purchase side untouched by this update.

| | Taxable value | IGST | CGST | SGST |
|---|---|---|---|---|
| Import of goods | 0 | 0 | 0 | 0 |
| Import of services | 0 | 0 | 0 | 0 |
| Inward supplies liable to RCM | 0 | 0 | 0 | 0 |
| All other ITC | 20,000 | 0 | 1,800 | 1,800 |
| **Net ITC available** | | | | **₹3,600** |
| ITC reversed (Rule 42/43) | 0 | — | — | — |
| ITC reversed (others) | 0 | — | — | — |
| Ineligible ITC (Sec 17(5)) | 0 | 0 | 0 | 0 |

**6.1 Tax payable vs paid** — not computed by this system (§9 explains why:
it needs the live cash/credit ledger balance on the GST portal, which this
system cannot see). **Enter this by hand at filing time.**

## 7. The reconciliation — does the return tie to the books?

This is the literal wording of Phase G's exit criterion: *the 3B ↔ books
tie-out reconciles to ₹0*. Two independent checks, both computed fresh from
the general ledger (not from the return itself), both passing on this exact
period — **now genuinely exercising both SEZ and deemed export, not just the
2026-08-13 fixture's single export line**:

1. **GSTR-3B's own output vs the general ledger** — for each of the six tax
   heads (CGST output, SGST output, IGST output, CGST input, SGST input,
   IGST input), the amount GSTR-3B reports is compared against what actually
   posted to that GL account for the period. Difference: **₹0**, all six
   heads.
2. **GSTR-3B's 3.1 figures vs GSTR-1's own totals for the same period** — the
   two returns are generated independently (different code paths reading the
   same underlying vouchers) and must still agree with each other. Difference:
   **₹0**.

**2026-08-14 finding, fixed the same day**: adding the SEZ fixture to prove
§8 item 5's routing fix initially BROKE tie-out 2 by exactly the SEZ
invoice's own value (₹3,000 taxable / ₹540 tax) — because once SEZ moved
into GSTR-1's `b2b` section (correct for the portal JSON), two separate
"sum domestic taxable" computations (one pure function, one DB-backed
service method — they had silently diverged into two implementations) both
started counting it as ordinary domestic turnover, while GSTR-3B correctly
kept it zero-rated. Both were fixed to exclude an SEZ invoice from the
domestic-taxable sum even when it lives inside a `b2b`-labelled row
(deemed export is deliberately NOT excluded — confirmed correctly
domestic on both sides). This is exactly the kind of drift the tie-out
exists to catch, and it caught it the first time real SEZ data reached it.

Both checks are permanent, automated, and re-run on every code change
(`qa-gst-returns.ts`, now 38 checks, up from 34) — a future change that
breaks either tie-out fails the build before it ships, not after a customer
notices.

## 8. Judgement calls — status as of 2026-08-14

**1. ✅ Real bug, found and fixed 2026-08-13 — the export tax split.**
Unchanged from the original packet — GSTR-3B row 3.1(b) used to compute an
export's tax as CGST+SGST when the buyer happened to share the company's
state, wrong under IGST Act §7(5). Fixed in `isInterStateSupply`
(`gst.const.ts`): a voucher flagged export/SEZ (with or without payment) is
now unconditionally inter-state, deliberately excluding deemed export (taxed
domestically, refunded separately under Rule 89). The fix also corrected the
same latent bug in e-Way Bill/e-Invoice generation for export/SEZ movements,
and a separate bug where e-Invoices never declared their real export/SEZ/
deemed-export status on the actual IRP submission. Never filed anywhere
real — caught in a test fixture. Still worth a real CA's independent read if
one is ever engaged: does the fix's own scope (SEZ+export forced
inter-state, deemed export left on the ordinary address-based rule) match
how you'd actually want this classified?

**2. ✅ RESOLVED 2026-08-14 — the CDNUR/B2CL threshold was stale, now
fixed.** The system used ₹2,50,000 for both the CDNUR eligibility test and
the B2CL threshold (they share one config value, confirmed correct design —
both are governed by the same rule). Research finding: **Notification
No. 12/2024–Central Tax (dated 10 July 2024)** amended CGST Rule 59(4) to
substitute "two and a half lakh rupees" with "one lakh rupees", effective
**1 August 2024** — confirmed against multiple independent, dated,
mutually-corroborating sources (ClearTax, IRIS GST, TaxScan, and reporting
of the 53rd GST Council meeting recommendation that produced the
notification), all citing the same notification number and date. This has
been in force for over two years as of this review. Fixed: seeded default
(`08_gst_return_reference.seeder.js`), schema default
(`gst_return_configurations.b2clThreshold`), and the live dev database's own
row, all updated to ₹1,00,000; `thresholdsConfirmed` set `true` with the
research trail recorded in the seeder's own comment. **This was dated legal
research standing in for a CA's confirmation, not a judgement call** — the
number is a fact, verifiable against the notification text itself, which is
exactly the kind of item AI research can close without a human's
professional judgement. Still worth a spot-check before a real filing that
no *newer* notification has since moved it again.

**3. ✅ CONFIRMED 2026-08-14, no code change needed — deemed-export
classification.** The system taxes deemed-export supplies as ordinary
3.1(a) domestic turnover, never as zero-rated 3.1(b), even though it groups
deemed-export with true exports for other purposes (like requiring the
recipient's GSTIN). Research confirms this is correct: Rule 89's third
proviso lets the *supplier or recipient* claim a refund of tax paid on a
deemed-export supply — a refund mechanism, not a zero-rating one — which is
the same distinction that separates a deemed export from a real export or
SEZ supply under IGST Act §16. **Now exercised by a real posted voucher**
(party H, §3/§5), not just a unit test.

**4. ✅ CONFIRMED 2026-08-14, no code change needed — reverse-charge tax
figure.** For a purchase marked reverse-charge, the tax amount reported is
whatever the voucher's own lines already carry — the recipient's own
self-assessment, trusted as-is. This is standard practice (the taxpayer is
the one liable to self-assess RCM tax), and building an independent
calculator to check it is a materially larger, separate feature —
correctly out of scope for v1 per §9, not an oversight.

**5. ✅ RESOLVED 2026-08-14 — SEZ/deemed export now correctly routed to
`b2b`, not `exp`.** The original packet flagged this as unproven ("this
fixture doesn't exercise SEZ/deemed-export"). Research against the GST
Returns Offline Tool's own documentation confirmed the real portal schema:
SEZ units/developers and deemed-export buyers are registered persons (hold
a GSTIN, unlike a genuine export's foreign buyer), so the portal reports
them under the `b2b` array, tagged `inv_typ: 'SEWP'|'SEWOP'|'DE'` (tables
6B/6C), never under `exp`'s table-6A shape. Fixed in
`TABLE_6A_EXPORT_GST_SUPPLY_TYPES` (`gst-classification.const.ts`,
narrower than the pre-existing `EXPORT_GST_SUPPLY_TYPES`) and the
`b2b`/`cdnr` portal-JSON mappers, which now read each invoice's own
`gstSupplyType` to set `inv_typ` instead of a hardcoded `'R'`. **Fixing this
surfaced and closed a genuine tie-out bug** — see §7's own account. **One
residual uncertainty, not resolved**: the CDNR wire shape only supports
`inv_typ: 'R'|'DE'` (no `SEWP`/`SEWOP` slot), so a credit/debit note against
an SEZ invoice — untested, no fixture raises one — still maps to `'R'`.
Flagged in the code's own comments for a real filer to confirm if this ever
comes up.

**6. ✅ CONFIRMED 2026-08-14 for the case that exists, plus one NEW finding
for the case that doesn't yet — Delivery Challan → document-issue
category.** The ordinary Sales-workflow "Delivery Challan" (Quote→SO→DC→
Sales, `CLAUDE.md` §4) mapping to document category 12 ("delivery challan,
cases other than by way of supply, excluding 9–11") is confirmed correct:
it is genuinely not a job-work challan (category 9), an approval-basis
challan (category 10), or a liquid-gas challan (category 11), so the
general bucket is the right one. **New finding, not previously flagged,
not fixed here**: this ERP also has a wholly separate, dedicated
`job_work_challans` table (§15 — the Rule 55 statutory print module, its
own numbering series `JW/2026-27/001`), and **these are not represented in
GSTR-1 Table 13 at all** — neither under category 9 (the category that
literally exists for them) nor anywhere else. `gstr1-docs.const.ts`'s own
header comment already documents a deliberate v1 scope cut (Receipt/
Payment/Refund vouchers, a different entity than `Trx`) — this is the same
class of gap, just not one anybody had named yet. **Not fixed in this
pass**: building it properly means reaching into the job-work module's own
numbering from the GST-returns assembly layer, a real cross-module design
question (not a bug-fix-sized change), so it is recorded here and as a new
tracked item in `MASTER_DEVELOPMENT_PLAN.md` §21 rather than rushed. If the
intended first real customer does job work AND GST filing together, this
is a real pre-filing gap to close first.

## 9. What this system deliberately does NOT do

Read this before assuming a gap is an oversight — each of these is a stated
scope boundary, not a bug:

| Concept | This system builds | This system does **not** build |
|---|---|---|
| Reverse charge | A flag on the voucher; the `rchrg` marker in GSTR-1; rows 3.1(d)/4(A)(3) in 3B | Automatic RCM self-invoicing, RCM liability posting, RCM payment tracking |
| Exempt / nil-rated / non-GST | A classification on the product; table 8 and rows 3.1(c)/3.1(e) | Exempt-turnover apportionment, Rule 42/43 reversal calculation |
| Cess | A tax type, a per-line amount, cess columns in both returns | Cess rate masters, quantity-based (specific-rate) cess |
| Ineligible ITC | A flag + reason on the purchase voucher; table 4(D) | A Section 17(5) rule engine that decides eligibility automatically |
| **Job-work challans in Table 13** *(new, §8 item 6)* | Nothing yet | Reporting the `job_work_challans` series (Rule 55 documents) in the document-issued register at all |

**Also out of scope, by design, with the reason:**

- **Direct GSP/portal filing** — the platform this runs on is itself being
  rebuilt; wiring up filing now means building it twice. v1 produces the
  upload file; a human uploads it.
- **GSTR-2B/2A reconciliation** — needs data pulled live from the GST portal.
- **GSTR-9/9C** (annual returns) — cheap to add once monthly filing exists,
  not useful before it does.
- **TDS/TCS and e-commerce operator supplies** — not present in this
  system's data model at all. Emitted as zero and **flagged in the UI as
  unsupported**, specifically so a zero is never mistaken for a computed
  figure.
- **Rule 42/43 ITC reversal** — entered manually into 3B row 4(B); not
  calculated.
- **Composition dealers / UIN holders / ISD** — the system has no concept of
  any of these on a party record; the relevant 3B sections say so
  explicitly (`"supported": false`, with a stated reason) rather than
  silently reporting zero.
- **Table 6.1 (tax paid)** — needs the live GST-portal cash/credit ledger
  balance, which this system has no way to see. Entered by hand at filing.

## 10. Sign-off checklist

*(Phase G.6's own exit-checklist item, restated as a form. Kept exactly as
originally written — this section is for a REAL CA, if one is ever engaged;
the 2026-08-14 AI-substitute closure described in §0 does not fill this in
on a CA's behalf, because it isn't one.)*

- [ ] I have reviewed §5–§6 (the GSTR-1 and GSTR-3B output) and the
      classification of each transaction is correct for the facts stated.
- [ ] I have reviewed §7 (the reconciliation) and understand what "ties to
      ₹0" does and does not prove.
- [ ] I have reviewed §8's items (most now AI-research-resolved, two —
      1 and 5's residual CDNR/SEZ note — still worth independent judgement).
      For each, my view is: _____________
      (attach notes, or mark "agree as resolved" / "needs a fix before I'd
      file with this" per item).
- [ ] I have reviewed §9 (exclusions, including the new job-work-challan
      Table 13 gap) and confirm none of them would stop me filing **a simple
      monthly return with no advances, no exports, no QRMP, no job work**
      through this system today. *(If any would, name it.)*
- [ ] Overall: ☐ **I would file this return as shown** ☐ **I would not,
      because:** _____________

**Reviewer:** _____________ **Date:** _____________ **Membership no.:** _____________

## 11. Open configuration questions — status as of 2026-08-14

- **The ₹1,00,000 B2CL/CDNUR threshold and the 4-digit HSN reporting
  requirement — RESOLVED for the threshold, CONFIRMED for HSN.** The
  threshold is now ₹1,00,000 (§8 item 2 — a dated, current fact, fixed in
  code). The 4-digit default for HSN reporting is confirmed still correct
  for aggregate turnover up to ₹5 crore (6-digit above that, per CBIC
  Notification 78/2020-CT and its successors) — this system's
  `hsnDigitCount` is genuinely per-installation configurable (not
  hardcoded), so the seeded default of 4 stays as a default, not a fixed
  answer; a real customer above ₹5 crore turnover would set it to 6 at
  onboarding.
- **Monthly or QRMP?** Still open, still a build question not a research
  one — built and proven for monthly filing only. QRMP (quarterly filing
  with the IFF) remains a real, un-built addition if the first real
  customer needs it. Not attempted in this pass — a genuinely separate
  feature, not a correctness fix.
- **Which GST offline-utility version is the JSON in §4 targeting?** Still
  genuinely open — this sandbox has no way to download and diff against the
  GSTN offline utility's actual current schema file (web search returns
  documentation and advisories, not the binary/schema itself). The
  structural elements this research DID confirm (the `inv_typ` codes, the
  b2b/exp table split) are corroborated against current, dated advisory
  sources, which is meaningfully more confidence than the 2026-08-13
  packet had, but it is not the same as running the actual utility. Confirm
  against whatever the offline utility expects at the moment of a real
  filing.
- **Does the intended first real customer take advances?** Unchanged, still
  open, still a business-input question — GSTR-1 tables 11A/11B (advances)
  remain unsupported, emitted empty, and would need to be built first if a
  real customer needs them.

## 12. If you'd rather see this running live

Everything above was generated by
`jayhind-client-back/scripts/qa-gst-returns.ts`, a permanent, repeatable test
— not a one-off. To regenerate it (requires a MySQL clone, never run against
real data):

```bash
cd jayhind-client-back
mysqldump jayhind_client | mysql jayhind_client_ca_review_scratch
DB_NAME_DEVELOPMENT=jayhind_client_ca_review_scratch \
  npx ts-node -r tsconfig-paths/register scripts/qa-gst-returns.ts --force
```

Or, to see the actual application screens this data would render as
(GSTR-1, GSTR-3B, and the Filing Register), the operator can walk through
`/transaction/gst-returns` on the running dev instance directly — ask them
for a screen-share or a login.

---

*This packet is generated from `MASTER_DEVELOPMENT_PLAN.md` §20.4 (Phase G,
specifically G.2's derivation-engine documentation and G.6's own review
agenda) and the committed golden files
`jayhind-client-back/scripts/__golden__/{gstr1,gstr3b}-072026.json`. If the
underlying code changes, regenerate the golden files and re-derive the
tables above from them — do not hand-edit this document's numbers without
also re-running the harness. Last regenerated 2026-08-14 alongside the
`b2clThreshold`/SEZ-routing fixes described in §0.*
