# UI Mockups

Working name used in the mockup: **Punchcard** (placeholder — easy to rename later; nods to the physical time-clock punch card this app replaces).

## Design plan

- **Color** — a warm, timepiece-inspired palette rather than a generic SaaS blue/purple:
  - `--ink` `#161310` (warm near-black text, dark mode ground)
  - `--paper` `#F3EFE7` (warm parchment paper, light mode ground — evokes a watch manual/dial card, not cold grey)
  - `--accent` `#C08A3E` (brass/copper — the "case" of the clock; used for primary actions and focus states only)
  - `--live` `#1E8E82` (teal — reserved for "currently working / live" state, kept distinct from the brass accent so state and action never compete)
  - `--good` `#3F9142` (completed-day / positive semantic)
  - `--warn` `#C1543A` (missed day / attention semantic)
- **Type** — Manrope (display, geometric and confident, used only for headings/big numerals), Source Sans 3 (body, quiet workhorse for tables and labels), JetBrains Mono (the live session timer and every tabular number — a stopwatch should look like a stopwatch). _(The mockup below approximates these with tuned system-font stacks because the Artifact sandbox blocks font CDNs; the real Vite app self-hosts the actual webfont files, no CDN involved.)_
- **Layout** — a bento dashboard: one wide hero card (status, Clock In/Out, live timer) beside four compact stat cards, a GitHub-style streak heatmap strip, a Monthly Logs table with year/month chip pickers and weekly/monthly subtotal rows, a six-chip Report summary, and a History toolbar preview (search, filter, pagination) below it.

## What the mockup demonstrates

- Dashboard hero + stat cards, light **and** dark mode (toggle in the mockup header)
- Clock In → Clock Out interaction (click the button — it flips state and the timer starts ticking, purely client-side for demonstration)
- Attendance streak heatmap (bonus feature)
- Monthly Logs table with weekly/monthly totals
- Reports summary chips
- History toolbar pattern (search / status filter / sort / pagination)

## Not implemented in the mockup (by design — this is a visual reference, not the app)

- Real data, auth, or network calls
- Routing between pages (this is a single illustrative scroll, not the final IA — Phase 3 wires up React Router per `docs/02-folder-structure.md`)
- Responsive breakpoints beyond a quick resize check (Phase 3 implements the full Tailwind responsive system)

The live, interactive mockup is published as a Claude Artifact and linked in the chat response for this phase.
