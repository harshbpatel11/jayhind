# Pilot Contracting Pack — clarification C-5 / Phase P.1

**Prepared:** 2026-08-13. **Purpose:** Phase P.1's exit criteria
(`MASTER_DEVELOPMENT_PLAN.md` §20.5): a contract including the migration
window, honestly-stated support hours, a DPA + sub-processor list, and the
cap-of-three recorded internally — signed on terms that do not make Phase 8
(the eventual multi-tenant migration) harder than it needs to be.

**⚠️ This is a drafting aid, not a contract.** Nothing here has been
reviewed by a lawyer. Every bracketed `[ ]` field is a placeholder only the
operator can fill in (entity name, address, governing law, pricing, dates).
Before anything here is signed by anyone: **have it reviewed by counsel**,
same caveat clarification C-21 already puts on the wider compliance pack.
What this pack *does* do is make sure the engineering-verifiable claims in
it — what's backed up, what support actually looks like, what data leaves
this server and to whom — are true today, not aspirational. That part is
this seat's job; the legal wrapper around it is not.

---

## 1. The shape of the deal — the four conditions, restated for a sales conversation

Non-negotiable, per §20.5. Useful to have in your own words before the
prospect asks *"can we run this ourselves"* or *"can we stay on the old
version once the multi-tenant platform ships"*:

1. **One build, no forks.** The pilot runs the exact same software as every
   other pilot and, later, every other tenant. Never a customer-specific
   branch — that would reintroduce the version-drift problem this whole
   platform exists to remove (§5.3, P3).
2. **The migration window is contracted up front, in writing, before the
   first invoice.** The pilot is told plainly: at a date we choose, with a
   scheduled maintenance window, their installation is migrated onto the
   shared multi-tenant platform. This is not a surprise sprung on them later
   — it is a term of the deal from day one.
3. **We host it. Always.** Our infrastructure, our backups, never the
   customer's server. This is what keeps the migration ours to schedule
   rather than something we have to negotiate access for.
4. **Cap at three, then stop.** Say so internally, even if not in the
   customer-facing contract — the rehearsal value is in the first one or
   two; every pilot beyond three adds cost and migration risk for
   diminishing return.

**Who pilot #1 should be** (§20.5's own selection criteria — worth having in
mind while prospecting, not just after someone says yes): simple books,
**monthly filing** (not QRMP — §4.3 C-13 is unbuilt), **no advances** (§4.3
C-17 — GSTR-1 tables 11A/11B are unsupported today), **no exports or SEZ
supplies** (the known export-tax-split bug, `_ops/ca-review/`, is a live
defect until it's fixed). Each of these is a real Phase G edge the first
filing should not have to prove. Their own CA becomes the reviewer for
`_ops/ca-review/C-15-CA-REVIEW-PACKET.md` — turning C-15's external
dependency into a customer deliverable, per §20.5's own framing.

## 2. Term sheet / contract skeleton

*(Structure only — actual contract drafting is counsel's job. This is the
list of clauses P.1's exit checklist actually requires, with the
engineering-true content for each filled in.)*

**Parties.** `[Legal entity name]` ("Provider") and `[Customer legal name]`
("Customer"), GSTIN `[customer GSTIN]`.

**Term & renewal.** `[TBD — annual, with the migration clause below applying
regardless of term length]`.

**Services.** Hosted access to the Provider's GST-compliant ERP platform —
accounting, inventory, invoicing, payroll/attendance, and GST return
preparation (GSTR-1/GSTR-3B; **the Customer or their CA uploads the
generated return to the GST portal — the Provider's platform does not file
directly**, see §4 below).

**The migration clause (condition 2 — the one clause that must not be
skipped or softened):**

> *Provider may, at its discretion and on no less than `[N]` days' written
> notice, migrate Customer's installation to a shared multi-tenant version
> of the platform. Provider will schedule this migration during a
> maintenance window agreed with Customer, will back up Customer's data
> immediately before migration, and will verify Customer's data is
> complete and accessible on the new platform before considering the
> migration complete.*

**Hosting (condition 3).** *All Customer data is hosted on Provider's own
infrastructure. Provider does not deploy Customer-specific installations on
Customer's own servers.*

**Support hours — stated honestly, per §15.3.** *Support is available
`[business hours, e.g. Mon–Sat 10:00–19:00 IST]`, via `[channel — email/
phone/the in-app Support Desk]`. **There is no 24×7 on-call arrangement.***
This is not a weaker offer dressed up — §15.3 is explicit that promising
paging that doesn't exist is the wrong choice between two honest options,
and a solo operator genuinely has nobody to page at 3 a.m. Say so plainly
rather than implying otherwise.

**Data protection.** See the DPA in §3.

**Termination & data return.** *On termination, Provider will make
Customer's data available for export within `[N]` days.* ⚠️ **Do not
promise a specific export format or an automated self-service download yet**
— the structured offboarding export bundle (CSV/XLSX per table, Tally-
compatible voucher export, file-store zip, statutory-register PDF) is
§9.6's own deliverable, scoped into **Phase S**, which has not been built.
What genuinely exists today: a `mysqldump` of the customer's data and their
files from the upload store can be produced by the operator on request —
promise *that* capability, in those terms, not a polished self-service
export that isn't built yet.

**Governing law / jurisdiction / liability cap / indemnity.** `[Counsel's
job entirely — nothing engineering-verifiable to contribute here]`.

## 3. Data Processing Agreement (DPA) + sub-processor list

Everything below is what's actually true of this installation today, not a
generic DPA template's boilerplate.

**What data is processed.** Customer's accounting records, inventory,
employee/payroll data (if the HR module is licensed), and any documents
uploaded (invoices, attachments, scanned bills). GST-related data (GSTIN,
turnover, tax figures) is generated from the above, not sent anywhere
external — see the GSP row below.

**Where it's hosted.** A single server, currently `[Oracle Cloud
Infrastructure — inferred from this host's own kernel/instance naming
(`oracle` kernel flavour, OCI-pattern instance name); confirm the exact
tenancy, region and any data-residency commitment with whoever administers
the cloud account before this goes in front of a customer]`. **There is
currently no secondary region, no geographic redundancy, and no data
-residency guarantee beyond "wherever this one server physically is."** If
the customer's own compliance requirements need a named region/country
commitment, that needs deciding and (if it requires moving infrastructure)
costing before signature — this is exactly clarification **C-6** (§4.1),
still open.

**Sub-processors — the complete list, not a boilerplate one:**

| Sub-processor | What it touches | What it does NOT touch |
|---|---|---|
| **Transactional email relay** (Gmail SMTP, the operator's own account — O1.5) | Password-reset emails, due-date reminders, any email the app sends | Never the ledger data itself — email is a delivery channel, not storage. ⚠️ **Known gap, disclose it**: this relay has no bounce/complaint webhook, and Gmail's own sending limits (500/day) were never meant for production. A dedicated transactional-email provider is the intended pre-launch replacement — see `CLAUDE.md` §9 item 3 |
| **WhiteBooks (GSP)** | e-Way Bill and e-Invoice generation, if those modules are licensed and used | GSTR-1/GSTR-3B — those are generated **entirely locally**, no data leaves the server for return preparation (Phase G's whole design; §20.4) |
| **GST registry lookup (Jamku)** | Read-only GSTIN validation calls, hub-side only | Not customer transaction data — a lookup against a public registry |
| *(none)* | **OCR / invoice scanning** | Runs **fully locally on this server** (`jayhind-ocr-service`, CPU-only, no external API call of any kind) — a genuine, stateable differentiator: no invoice image or extracted data is ever sent to a third-party AI service |
| *(none)* | **GST return filing itself** | The system produces the upload file; a human uploads it. No GSP call, no data transmitted to GSTN, in this version |

**Data retention.** Books and supporting documents (invoices, attachments,
e-invoice/e-way-bill artifacts) are retained for the statutory floor — **6
years under GST §36, 8 years under the Companies Act §128** — and this floor
cannot be shortened by any setting, including at Customer's own request
(§14.5, NFR-014).

**Backup and restore — ⚠️ read this before writing any number into a
contract.** §16.5 is explicit: *"Nothing until it is true."* RPO/RTO figures
are only permitted in a customer contract once **both** a point-in-time
restore has been proven (O2.1) **and** an actual restore has been performed
and verified (O2.2) — and per the roadmap's own sequencing, **Phase O2 comes
after Phases 1–9, well after Phase P**. So at the point pilot #1 signs,
**do not commit to a specific RPO/RTO number**. What can honestly be said:

> *Provider performs regular backups of Customer's data and will perform
> and verify a test restore before Customer's live data is migrated onto
> the platform (per Phase P.2's own exit criterion). Specific recovery-time
> commitments will be provided once Provider's disaster-recovery
> infrastructure (point-in-time recovery, replica) is complete.*

This is a real, load-bearing finding from re-reading §16.5 against the
roadmap's own phase order while drafting this pack — worth flagging exactly
because a specific-sounding RPO/RTO clause is the easiest thing for a
term-sheet template to accidentally over-promise, and the roadmap's own
sequencing makes it provably premature today.

**Seeded/default credentials.** Before Customer's data is onboarded, every
credential this installation was seeded with — admin passwords, the dev
API key, sandbox GSP credentials — is rotated (NFR-010). This is a P.2 exit
-checklist item, not yet done; do not represent the platform as production
-hardened until it is.

## 4. What NOT to say yet — a pre-flight check for the sales conversation

Read this immediately before any real conversation with a prospect, so
nothing gets promised that isn't true today:

- ❌ "We guarantee 99.9% uptime" / any specific RPO or RTO number — not
  provable until O2.1 + O2.2 (§16.5). ✅ *"We back up regularly and will
  prove a restore before your data lands."*
- ❌ "24×7 support" — ✅ state the actual business hours (§2 above).
- ❌ "You can export everything yourself anytime" — the self-service export
  bundle is unbuilt (§9.6, Phase S). ✅ *"We'll produce your data on
  request within [N] days."*
- ❌ "Your GST returns are filed automatically" — this system prepares the
  return; a human still uploads it to the GST portal (§20.4's own scope
  boundary).
- ❌ "The system is fully audited/certified" — no external security audit
  or compliance certification has been performed on this platform.
- ✅ Safe to say plainly: OCR runs locally with no third-party AI service
  involved; GST returns are prepared with a proven ₹0 reconciliation to the
  books (`_ops/ca-review/`); the migration timing is entirely in the
  customer's contract, not a surprise.

## 5. P.1 exit checklist — mapped to this pack

- [ ] Migration window contracted in writing → §2, the migration clause
- [ ] Support hours stated honestly (no 24×7 paging that does not exist) →
      §2, support-hours clause + §4's pre-flight check
- [ ] DPA + sub-processor list attached → §3
- [ ] Cap of three recorded and agreed internally → §1, item 4 — **record
      the actual agreement here once made**: `[ ]`

**Still open, and this pack cannot close them:** a real legal entity to
name as Provider, actual pricing (C-4 gives the axis — per-company base +
module add-ons — not an amount), a governing-law/jurisdiction choice, and
counsel's review of everything in §2 and §3. Those are the operator's
decisions and counsel's drafting, not engineering output.
