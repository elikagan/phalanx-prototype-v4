# Design System — Phalanx v4

## Product Context
- **What this is:** Autonomous drone mission control demo for USAvionix
- **Who it's for:** Public safety agencies, defense decision-makers evaluating drone C2 platforms
- **Space/industry:** Defense/public safety drone command & control (peers: Skydio, DJI FlightHub, Auterion, Palantir AIP)
- **Project type:** Interactive prototype / demo app (tablet + mobile)

## Aesthetic Direction
- **Direction:** Industrial-Utilitarian
- **Decoration level:** Minimal — typography and spacing do the work
- **Mood:** Calm authority. The operator should feel like they're using serious, trusted equipment, not playing a video game. Quiet confidence, not dramatic.
- **Reference sites:** USAvionix marketing site (usavionix.vercel.app), Skydio Enterprise, Palantir AIP, Auterion

## Typography
- **Display/Hero:** Geist (500 weight) — matches USAvionix marketing site, geometric clarity
- **Body:** Geist (400 weight) — clean, excellent readability at small sizes
- **UI/Labels:** Geist (500 weight, uppercase + letter-spacing for labels)
- **Data/Tables:** Geist Mono — tabular-nums, technical readout feel
- **Code:** Geist Mono
- **Loading:** CDN via `https://cdn.jsdelivr.net/npm/geist@1.3.1/dist/fonts/`
- **Scale:**
  - 11px — small labels, metadata, timestamps
  - 12px — body secondary, table cells
  - 13px — body primary (base)
  - 14px — subheadings, emphasis
  - 16px — section titles
  - 20px — screen titles
  - 28px — hero/display (gate screen only)

## Color

### Backgrounds — 4 tiers
| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-base` | `#111113` | App background, full-bleed areas |
| `--bg-surface` | `#161618` | Panels, sidebars, chat area |
| `--bg-card` | `#1c1c1f` | Cards, inputs, elevated containers |
| `--bg-elevated` | `#232327` | Hover states, active cards, dropdowns |

### Text — 4 levels
| Token | Hex | Usage |
|-------|-----|-------|
| `--text-primary` | `#e0e0e4` | Headings, primary content, SARA messages |
| `--text-secondary` | `#9898a0` | Body text, descriptions |
| `--text-muted` | `#5c5c66` | Labels, timestamps, inactive items |
| `--text-ghost` | `#3a3a42` | Borders doubling as text, disabled states |

### Accent
| Token | Hex | Usage |
|-------|-----|-------|
| `--accent` | `#5f8fad` | Links, highlights, selected states |
| `--accent-dim` | `#3d6b85` | Primary button background |
| `--accent-text` | `#d4e0e8` | Text on accent backgrounds |

### Status — muted, professional
| Token | Hex | Usage |
|-------|-----|-------|
| `--green` | `#4a9a65` | Success, systems go, check marks |
| `--red` | `#b85454` | Error, critical alerts, targets |
| `--amber` | `#a89540` | Warning, caution, pending |

### Borders
| Token | Hex | Usage |
|-------|-----|-------|
| `--border-subtle` | `#1e1e22` | Soft dividers between same-tier surfaces |
| `--border` | `#28282e` | Default borders, card outlines |
| `--border-strong` | `#3a3a42` | Emphasized borders, focus rings |

## Spacing
- **Base unit:** 4px
- **Density:** Compact — this is a tactical tool, not a consumer app
- **Scale:** 2px / 4px / 8px / 12px / 16px / 24px / 32px / 48px

## Layout
- **Approach:** Grid-disciplined
- **Responsive breakpoint:** 768px (mobile/desktop split)
- **Desktop:** Topbar + main area (map/FPV left, chat panel right)
- **Mobile:** Full-bleed map + bottom drawer + FAB
- **Max content width:** None (full viewport, this is a control interface)
- **Border radius:** `--r-sm: 4px` / `--r-md: 6px` / `--r-lg: 8px`

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (sharp ease-out for enters/reveals)
- **Duration:**
  - Micro (hover, toggle): 150ms
  - State change (expand, select): 250ms
  - Panel (drawer, modal): 400ms
- **Rules:** No decorative animation. No bouncing. No particle effects. Transitions serve the operator's spatial model.

## Map Route Lines — 4 Emphasis Levels

All route lines use a dark casing underneath for legibility on satellite imagery. Dots are achieved with very short dashes + `lineCap: 'round'`.

| Level | Name | Use Case | Weight | Dash | Opacity | Color | Casing |
|-------|------|----------|--------|------|---------|-------|--------|
| 1 | Ghost | Alternative routes, not selected | 2 | `'2, 12'` | 0.45 | `#fff` | 5px, 0.2 |
| 2 | Default | Proposed route, standard | 3 | `'2, 10'` | 0.7 | `#fff` | 7px, 0.3 |
| 3 | Emphasis | Recommended / selected route | 4 | `'2, 10'` | 0.95 | `#fff` | 8px, 0.4 |
| 4 | Solid | Active mission, confirmed path | 4 | none | 0.9 | `#407CF5` | 8px, 0.4 |

**Rules:**
- `lineCap: 'round'` on ALL lines (dots, not ticks)
- Casing is always solid black, never dashed
- Dash `'2, 10'` = 2px dot + 10px gap = evenly spaced round dots
- Ghost level uses wider gap (`'2, 12'`) so dots feel sparser
- Only Level 4 (active/confirmed) uses color. All others are white.

## Component Rules
- No gratuitous borders, glows, gradients, or shadows
- Every visual element earns its place — if removing it doesn't hurt comprehension, remove it
- Buttons: `--accent-dim` bg + `--accent-text` text for primary; `--bg-card` bg + `--text-secondary` text for secondary
- Inputs: `--bg-card` bg, `--border` border, `--text-primary` text, `--border-strong` on focus
- Cards: `--bg-card` bg, `--border` border, `--r-md` radius
- Chat bubbles: SARA uses `--text-primary` (not secondary — readability over hierarchy in chat)
- Status badges: pill shape, muted color bg at 15% opacity, status color text

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-27 | Geist + Geist Mono as type stack | Matches USAvionix marketing site, geometric clarity fits industrial aesthetic |
| 2026-03-27 | 4-tier background system | Replaces v1-v3's 5-tier system, cleaner separation with fewer tiers |
| 2026-03-27 | Compact 4px base spacing | Tactical tool, data-dense screens, operator efficiency |
| 2026-03-27 | Minimal-functional motion | Operators need clarity, not delight. Every animation serves spatial understanding |
| 2026-03-27 | Fresh component design | v1-v3 components carried over without thought. All components designed from scratch for v4 |
