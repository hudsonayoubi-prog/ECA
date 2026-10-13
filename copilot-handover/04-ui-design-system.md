# 04 · UI design system

Source of truth: CSS custom properties and classes in `project/src/head.html`. Screens: `project/assets/screenshots/`.

## Brand intent
Red Bull Australia corporate feel: deep navy for structure, restrained yellow for highlights and the primary field action (Start Audit), white working surfaces, red only for problems, green only for done/on track. No Red Bull logos or trademarks are drawn; the "ECA" wordmark is plain text on a yellow tile.

## Colour tokens (light theme)

| Token | Hex | Use |
|---|---|---|
| `--brand` | #0B2A5B | Nav rail, headings, primary buttons, selected states, University tag, chart series 1 |
| `--brand-2` | #163E80 | Hover / pressed primary |
| `--brand-tint` | #E8EEF8 | Selected backgrounds, info banners, code monograms |
| `--accent` | #F2B705 | Start Audit button, TAFE tag, Due Soon, focus outline |
| `--accent-ink` | #5C4500 | Text on yellow tints |
| `--accent-tint` | #FFF5D1 | Due-soon chips, "you" row in tables |
| `--danger` / `--danger-ink` / `--danger-tint` | #C8102E / #9B0B22 / #FDE8EB | Overdue, destructive, errors |
| `--good` / `--good-tint` | #1E7B45 / #E3F4EA | Completed, On Track, positive deltas |
| `--none-tint` | #F1F2F5 | No Visit Recorded (dashed border) |
| `--bg` / `--canvas` / `--surface` / `--surface-2` | #FFFFFF / #F5F6F9 / #FFFFFF / #F8F9FB | Page, background, cards, inset areas |
| `--line` / `--line-strong` | #E2E5EC / #C9CED9 | Borders, dividers |
| `--ink` / `--ink-2` / `--ink-3` | #0F1A2E / #4A5568 / #6B7385 | Text: primary / secondary / muted |
| `--on-brand` | #FFFFFF | Text on navy |

Dark theme: full token set redefined under `@media (prefers-color-scheme: dark)` (guarded by `:root:not([data-theme="light"])`) and `:root[data-theme="dark"]`. Brand becomes #8FB2F0, accent #F2C230, surfaces #131B2C. The University tag switches to #8FB2F0 with dark text.

**Data-viz colours:** series navy #0B2A5B, teal #0F8B8D, amber #B88A00 (dark mode: #8FB2F0, #3FC1C3, #F2C230). Brand comparison: Red Bull navy, competitors greys #6B7385 → #E5E8EE. Status fills: On Track green, Due Soon yellow, Overdue red, No Visit hatched grey. Medals: gold #F2B705, silver #D5DAE3, bronze #E0A06A.

## Typography
- Body: **Barlow** 400/500/600/700, 15 px, line-height 1.45 (Google Fonts).
- Display/headings: **Barlow Condensed** 500/600/700. `h1` 30 px/700, `h2` 21 px/600, `h3` 16 px/600 (Barlow).
- KPI values 32 px condensed 700; KPI labels 12 px uppercase, letter-spacing .06em; eyebrows 12 px uppercase .08em.
- Numbers use `font-variant-numeric: tabular-nums` (`.num`).
- Excel exports use Arial (styles in `XLSX_MINI`).

## Spacing, shape, elevation
- Spacing scale in use: 4, 6, 8, 10, 12, 14, 16, 18, 20, 24 px. Page padding 24 px desktop, 16 px mobile; section gap 20 px; card padding 18 px.
- Radius: `--radius` 12 px (cards, sheets), `--radius-sm` 8 px (inputs, small), 10 px (buttons), pill 999 px (chips).
- Shadow: `--shadow` 0 1px 2px rgba(15,26,46,.06), 0 4px 14px rgba(15,26,46,.06). Sheets: 0 20px 60px rgba(0,0,0,.3).

## Layout and breakpoints

| Width | Behaviour |
|---|---|
| ≥ 1024 px | Fixed left navy rail 248 px (wordmark, yellow Start Audit, nav, signed-in user, sign out); sticky top bar; content max 1240 px |
| ≤ 1023 px | Rail hidden; **bottom bar** with 5 buttons: Home, Visits, **Audit** (navy filled), Leaders, More (sheet with the other pages); toasts and audit footer lift above the bar |
| ≤ 1100 px | 3-column grids → 2 |
| ≤ 760 px | 2/3-column grids → 1; KPI grid → 2 columns |
| ≤ 640 px | Forms → 1 column; modals become bottom sheets (radius 16 px top, max 92% height); toolbar fields 50% width; `.hide-m` table columns hidden |
| 375 px | No horizontal scroll (tested: scrollWidth ≤ viewport) |
Safe-area insets respected (`env(safe-area-inset-*)`).

## Core components and states

| Component | Class / function | States |
|---|---|---|
| Button | `.btn`, `.primary`, `.ghost`, `.danger`, `.sm`, `.start-cta` | default, hover (navy border/text), focus (3 px yellow outline), disabled (45% opacity, not-allowed) |
| Icon button | `.iconbtn` (+ `.dot` badge for unread count) | as button |
| Text / select / textarea | `Text`, `Select` → `.input` | focus 2 px navy outline; invalid `aria-invalid="true"` red border + tint + error text (`role="alert"`); hint text |
| Segmented control | `Seg` → `.seg`, `.seg.big` | `aria-pressed`; big Yes/No variant green / grey |
| Filter chip / toggle chip | `.fchip` | `aria-pressed`, navy when on; competitor chips show ✓ / + |
| Stepper | `Stepper` → `.stepper-num` | − / value / + (44 px), no negatives |
| Status chip | `StatusChip` → `.chip.good/.warn/.bad/.none/.muted` | colour + icon + text always together |
| Kind tag | `KindChip` | University: `.chip.unitag` navy/white; TAFE: `.chip.tafe` yellow/dark |
| Institution badge | `InstBadge` → `.ulogo` | logo image (1.6:1 frame) or code monogram (navy on tint) |
| KPI tile | `Kpi` → `.kpi` | tones good/warn/bad/none add a 4 px left border |
| Card / tile | `.card`, `.ucard` (button tiles), `.vcard` (visit cards with status top border) | hover border navy, focus outline |
| Table | `.tbl-wrap table` | sticky look header (uppercase 12 px), right-aligned numbers, row hover, clickable rows `tr.click` |
| Tabs | `.tabs` | `aria-selected`, 3 px navy underline |
| Modal / sheet | `Modal` → `.scrim .sheet` with `.sheet-h/.sheet-b/.sheet-f` | `role="dialog" aria-modal`, close button, Escape closes, sticky header/footer |
| Banner | `.banner.info/.warn/.bad/.good` | icon + text, `role="alert"` for errors |
| Empty state | `Empty` | title, body, optional action |
| Toast | `.toast` | bottom centre, auto-dismiss after 3.2 s |
| Stepper nav (audit) | `.stepper .step` | current (navy), done (✓ green), missing (! red) |
| Sync chip | `SyncChip` | Connecting…, Loading shared data…, Live · shared (green), Saving…, Not saved, View only, This browser only (yellow, opens help) |

## Motion
Only colour/border transitions of 120 ms on buttons, nav, chips, rows and tiles, and only when `prefers-reduced-motion: no-preference`. No other animation.

## Accessibility rules (must keep)
- Every input has a visible `<label>`; groups have `aria-label`/`aria-labelledby`.
- Focus always visible: 3 px `--accent` outline, 2 px offset.
- Status never by colour alone (icon + text).
- Touch targets ≥ 40 px (bottom bar 48 px, big Yes/No 46 px, steppers 44 px).
- Charts: SVG with `role="img"` + `aria-label`, `<title>` tooltips per bar/point, values printed, `.sr` captions.
- Dialogs trap context with `aria-modal`; toasts and errors announced.
- Contrast: body text on white ≥ 7:1; yellow is never used for text on white (only as fill with dark text).

## Copy style
Australian English, plain and warm. Sentence case headings. Buttons are verbs ("Start Audit", "Download Excel", "Approve and remove"). Errors say what to do ("Enter a phone number with at least 8 digits, e.g. 0412 345 678.").
