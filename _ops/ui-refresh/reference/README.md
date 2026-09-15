# UI refresh reference — extracted from the canvas artifact

The canvas artifact named in `UI-REFRESH-PLAN.md`
(https://claude.ai/code/artifact/a0d7de26-dede-4323-a8dc-c8dc16b599da, "Jayhind
ERP — All Screens") is a Claude Design canvas: a single React app bundled into
the artifact page, not 101 separate files. Its screen content isn't visible to
a plain fetch (the bundler wraps everything in a manifest + a runtime that
renders client-side), so the three files here are decoded straight out of that
bundle — gunzip + base64-decoded, not retyped — and are the actual source the
canvas renders from. Re-extract the same way if the artifact is ever updated
(WebFetch the artifact URL, pull the `__bundler/manifest` script tag, find the
`application/javascript` entries, gunzip+base64-decode each).

- **`screens-spec.js`** — every non-dialog screen, keyed by route (mirrors
  `navigation.config.ts`, per its own header comment). One `S['route'] = {...}`
  per screen, `S['module/route']` for module-owned dashboards. Grep this file
  for a route key before starting any phase's Inventory step — it is the
  ground truth for KPIs, table columns, view-tab labels/counts, summary lines,
  actions, form fields, everything.
- **`dialogs-spec.js`** — the 38 dialog patterns across the 8 `dlg-*`
  categories (Pickers, Voucher actions, Compliance, Data & grid, Print &
  share, Stock & shop floor, People & access, System). Reference for P9.
- **`canvas-app-shell.jsx`** — the canvas's own render logic. Not a screen to
  build against directly, but it's the legend for every shorthand used in
  `screens-spec.js`'s row/cell arrays and the exact `--token` names + light/dark
  hex pairs the whole canvas is themed on (`:root` / `[data-theme="dark"]`
  block, copied here too for quick reference — see below).

## Cell-prefix legend (screens-spec.js row arrays)

Each row is an array of plain strings; the leading character is a shorthand
the canvas's `cell()` function (in `canvas-app-shell.jsx`) expands:

| Prefix | Meaning | Rendered as |
|---|---|---|
| `@tone:text` | status chip | `ds-status-chip`, tone ∈ `ok/warn/bad/info/mute` → success/warning/error/info/muted |
| `#text` | plain numeric | right-aligned, IBM Plex Mono, tabular-nums |
| `$text` | emphasized numeric | right-aligned, **bold**, IBM Plex Mono, tabular-nums |
| `~text` | muted text | `color:var(--muted)` |
| `!text` | emphasized text | `font-weight:600` |
| (none) | plain text | as-is |

Column headers prefixed `>` right-align that column's header.

## Token values the canvas is themed on

```
:root {
  --primary:#005cbb; --on-primary:#fff; --primary-container:#d7e3ff; --on-primary-container:#001b3f;
  --surface:#fff; --surface-1:#f7f7fa; --surface-2:#eeeef3; --on-surface:#16171c; --muted:#5b5d68;
  --border:#dcdce4; --border-strong:#c2c3ce;
  --success:#0d6b30; --success-bg:#e3f4e9; --warning:#9a4a08; --warning-bg:#fdeee0;
  --error:#ba1a1a; --error-bg:#ffe4e0; --info:#075985; --info-bg:#e2f1fb; --primary-bg:#e6eefb;
}
[data-theme="dark"] {
  --primary:#adc6ff; --on-primary:#002f65; --primary-container:#123a72; --on-primary-container:#d7e3ff;
  --surface:#16171a; --surface-1:#1c1d21; --surface-2:#232428; --on-surface:#e6e6ea; --muted:#a2a3ad;
  --border:#31323a; --border-strong:#44454f;
  --success:#5fd18b; --success-bg:#12301f; --warning:#f0b357; --warning-bg:#33240e;
  --error:#ff9d94; --error-bg:#3a1512; --info:#6fc3f0; --info-bg:#0e2836; --primary-bg:#0f2340;
}
```

Compared against `jayhindi-client-front/src/styles/design-system/_tokens.scss`
on 2026-08-18: `--success`/`-bg`, `--warning`/`-bg`, `--error-bg`, `--info`/`-bg`,
`--primary-bg` match exactly in both themes. `--primary`/`-container` are
deliberately routed through `--mat-sys-*` instead of hard-coded (so the runtime
palette switcher keeps working) rather than pinned to the canvas's blue — an
intentional divergence, not a gap. `--muted` matches in dark
(`#a2a3ad`) but the app's light value (`#44474e`) is darker than the canvas's
(`#5b5d68`) — both pass AA, the app's was independently measured (decision 5),
left as-is rather than auto-changed.

## Screen `kind`s and which app shape they map to

`dash` → dashboard shape · `list` → list shape (incl. `master()` helper —
adds the standard All/Active/Archived views + Add/Import actions) · `form` →
voucher/entry form shape · `board` → kanban · `settings` → grouped setting
cards · `scan` → invoice scanning · `chat`, `files`, `gallery` → their own
variants. All match `UI-REFRESH-PLAN.md`'s shape table.
