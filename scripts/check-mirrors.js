#!/usr/bin/env node
/**
 * Cross-repo mirror drift guard.
 *
 * Several constants are deliberately duplicated between `jayhind-client-back`
 * (the enforcer) and `jayhindi-client-front` (which mirrors them only so the UI
 * never offers an action the server will refuse). Until now those pairs were
 * kept in step **by comment alone** — "⚠️ Mirror of …, keep the two in sync" —
 * which is a request, not a guarantee.
 *
 * This repo is the only place that can check them: each sub-project is an
 * independent git repo, so neither one's own CI can see the other's tree. The
 * orchestration repo pins both as submodules and therefore sees both at once.
 *
 * Run:  node scripts/check-mirrors.js       (exit 0 = in sync, 1 = drift)
 *
 * ## What this proves, and what it does not
 * Checks 1–3 are exact **data** comparisons — a key added on one side and not
 * the other fails the build, which is the drift that actually bites (the menu
 * offers a module the server 403s, or hides one it would allow).
 *
 * Check 4 is deliberately weaker and says so in its output. The
 * voucher-lifecycle pair cannot be compared as data: the backend answers
 * `(VoucherLifecycleState) => ActionVerdict` while the frontend answers
 * `(VoucherLifecycleRow, VoucherTypeFlags) => boolean`. Same rules, different
 * shapes, so only *behaviour* is comparable and that needs both suites running
 * a shared vector table. Until that exists, this checks the weaker invariant
 * that neither side has gained or lost a decision function — which catches "a
 * new rule was added to one side only", the most common way that pair drifts.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BACK = path.join(ROOT, 'jayhind-client-back');
const FRONT = path.join(ROOT, 'jayhindi-client-front');

const failures = [];
const notes = [];

function read(file) {
  if (!fs.existsSync(file)) {
    failures.push(`missing file: ${path.relative(ROOT, file)} (submodule not checked out?)`);
    return null;
  }
  return fs.readFileSync(file, 'utf8');
}

/** Body of `export enum <name> { … }` → { MemberName: 'value' }. */
function parseEnum(src, name) {
  const m = new RegExp(`export enum ${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(src);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const e = /^\s*(\w+)\s*=\s*['"]([^'"]*)['"]\s*,?/.exec(line);
    if (e) out[e[1]] = e[2];
  }
  return out;
}

/**
 * Body of `export const <name>… = { … };` → { key: value }, for the two literal
 * shapes these files use: `'quoted-key': LicensedModule.X` / `bareKey: …` and
 * `[LicensedModule.X]: 'label'`. Comment lines are skipped, so the (differing)
 * prose around each entry never counts as drift.
 */
function parseRecord(src, name) {
  const m = new RegExp(`export const ${name}\\b[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`).exec(src);
  if (!m) return null;
  const out = {};
  for (const raw of m[1].split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue;
    const e =
      /^\[?\s*(?:LicensedModule\.)?['"]?([\w.-]+)['"]?\s*\]?\s*:\s*(?:LicensedModule\.)?['"]?([^'",]+)['"]?\s*,?/.exec(
        line,
      );
    if (e) out[e[1]] = e[2].trim();
  }
  return out;
}

/** Names of every `export function <name>` in a file. */
function parseExportedFunctions(src) {
  return [...src.matchAll(/export function (\w+)/g)].map((m) => m[1]).sort();
}

/** Compare two key→value maps and record every difference. */
function diffMaps(label, a, b, aName, bName) {
  if (!a || !b) {
    failures.push(`${label}: could not parse one side (a=${!!a} b=${!!b}) — has the literal's shape changed?`);
    return;
  }
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const k of keys) {
    if (!(k in a)) failures.push(`${label}: '${k}' is in ${bName} but missing from ${aName}`);
    else if (!(k in b)) failures.push(`${label}: '${k}' is in ${aName} but missing from ${bName}`);
    else if (a[k] !== b[k]) failures.push(`${label}: '${k}' is '${a[k]}' in ${aName} but '${b[k]}' in ${bName}`);
  }
}

// ── 1–3. module-licence: enum, labels, permissionKey → module ────────────────
const backLic = read(path.join(BACK, 'src/const/module-licence.const.ts'));
const frontLic = read(path.join(FRONT, 'src/core/navigation/module-licence.ts'));

if (backLic && frontLic) {
  diffMaps('LicensedModule', parseEnum(backLic, 'LicensedModule'), parseEnum(frontLic, 'LicensedModule'), 'client-back', 'client-front');
  diffMaps('LICENSED_MODULE_LABEL', parseRecord(backLic, 'LICENSED_MODULE_LABEL'), parseRecord(frontLic, 'LICENSED_MODULE_LABEL'), 'client-back', 'client-front');
  diffMaps('MODULE_BY_PERMISSION_KEY', parseRecord(backLic, 'MODULE_BY_PERMISSION_KEY'), parseRecord(frontLic, 'MODULE_BY_PERMISSION_KEY'), 'client-back', 'client-front');
}

// ── 4. Every permissionKey the frontend nav uses must exist in the backend ───
// registry, or the menu shows an item whose permission can never be granted.
const registry = read(path.join(BACK, 'src/const/permission-registry.ts'));
const navConfig = read(path.join(FRONT, 'src/core/navigation/navigation.config.ts'));

if (registry && navConfig) {
  const known = new Set([...registry.matchAll(/\bkey:\s*'([^']+)'/g)].map((m) => m[1]));
  // Keys used by @Permissions(...) but deliberately absent from the matrix —
  // only Admin (who bypasses RoleMenuGuard) can reach them. Documented in
  // permission-registry.ts's own header note.
  const intentionallyUnlisted = new Set(['payment-terms', 'tag', 'site-configuration']);
  const navKeys = new Set(
    [...navConfig.matchAll(/permissionKey:\s*'([^']*)'/g)].map((m) => m[1]).filter(Boolean),
  );
  for (const k of [...navKeys].sort()) {
    if (!known.has(k) && !intentionallyUnlisted.has(k)) {
      failures.push(`navigation.config.ts uses permissionKey '${k}', which is not in client-back's PERMISSION_REGISTRY`);
    }
  }
}

// ── 5. voucher-lifecycle: same decision functions on both sides ──────────────
const backVl = read(path.join(BACK, 'src/const/voucher-lifecycle.const.ts'));
const frontVl = read(path.join(FRONT, 'src/utils/voucher-lifecycle.util.ts'));

if (backVl && frontVl) {
  const DECISIONS = /^can[A-Z]/;
  const b = parseExportedFunctions(backVl).filter((n) => DECISIONS.test(n));
  const f = parseExportedFunctions(frontVl).filter((n) => DECISIONS.test(n));
  for (const n of b) if (!f.includes(n)) failures.push(`voucher-lifecycle: '${n}' exists in client-back but not client-front`);
  for (const n of f) if (!b.includes(n)) failures.push(`voucher-lifecycle: '${n}' exists in client-front but not client-back`);
  notes.push(
    `voucher-lifecycle: ${b.length} decision function(s) present on both sides. ` +
      'Names only — the two signatures differ by design, so semantic parity is NOT checked here.',
  );
}

// ── Report ──────────────────────────────────────────────────────────────────
for (const n of notes) console.log(`note: ${n}`);

if (failures.length) {
  console.error(`\n✗ mirror drift — ${failures.length} problem(s):\n`);
  for (const f of failures) console.error(`  • ${f}`);
  console.error('\nThese constants are duplicated on purpose (the server enforces, the UI mirrors');
  console.error('so it never offers what the server refuses). Fix both sides in the same change.\n');
  process.exit(1);
}

console.log('\n✓ all mirrored constants are in sync\n');
