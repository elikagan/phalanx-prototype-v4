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

All dotted route lines use a 1px offset drop shadow (`.route-shadow` class) for legibility on satellite imagery. Dots are achieved with very short dashes + `lineCap: 'round'`.

| Level | Name | Use Case | Weight | Dash | Opacity | Color | Shadow |
|-------|------|----------|--------|------|---------|-------|--------|
| 1 | Ghost | Alternative routes, not selected | 2 | `'2, 12'` | 0.45 | `#fff` | weight+1, 0.2 |
| 2 | Default | Proposed route, standard | 3 | `'2, 10'` | 0.7 | `#fff` | weight+1, 0.3 |
| 3 | Emphasis | Recommended / selected route | 4 | `'2, 10'` | 0.95 | `#fff` | weight+1, 0.4 |
| 4 | Solid | Active mission, confirmed path | 4 | none | 0.9 | `#407CF5` | weight+1, 0.4 |

**Rules:**
- `lineCap: 'round'` on ALL lines (dots, not ticks)
- Shadow is always 1px offset via CSS `transform: translate(1px, 1px)`, same dash pattern as the route line
- Dash `'2, 10'` = 2px dot + 10px gap = evenly spaced round dots
- Ghost level uses wider gap (`'2, 12'`) so dots feel sparser
- Only Level 4 (active/confirmed) uses color. All others are white.

## Map Overlays — Complete System

All map overlays sit on satellite imagery. Dark backgrounds with light text is the standard for aviation/tactical maps (Mapbox Navigation night, QGroundControl).

### Hierarchy (loudest → quietest)
| Tier | Element | Purpose |
|------|---------|---------|
| LOUD | Incident pin | The emergency. Bright color dot (amber P1-P2, red critical), white icon, 40px |
| MEDIUM | Route lines | Movement paths. White dotted (proposed) or blue solid (active). See Route Lines below |
| MEDIUM | Target marker | Red 24px dot, white border, pulsing ring. Green when confirmed |
| QUIET | Labels | Info when you need it. Dark pill bg, light text. All share one base style |
| BACKGROUND | Search zones | Amber fill, no stroke, very subtle. Context, not focus |
| BACKGROUND | Orbit zones | White dashed circle, blue fill at 0.15-0.18 opacity |

### Drone Marker — One Look Everywhere
All drones use the fleet-drone-dot style: a colored circle (32px) with a white flying-wing SVG inside, rotated to heading. Never the old teal standalone SVG.

| Condition | Dot Color | Notes |
|-----------|-----------|-------|
| Available/surveillance | `#1c1c1f` (dark) | Quiet, blends with map |
| Recommended/selected | `#407CF5` (route blue) | Stands out from alternatives |
| In-mission/assigned | `#407CF5` (route blue) | Active assignment |

### Route Line Shadows
All route lines use a **1px offset drop shadow**, not thick centered casing. The shadow line is `weight + 1`, `opacity: 0.3`, black, with CSS `transform: translate(1px, 1px)` via the `.route-shadow` class. This creates a subtle depth effect without the heavy black border of centered casing.

### Map Labels — One Base Style
All map labels (route labels, drone labels, incident labels, target labels) share the same visual treatment:
- Font: Geist 10px, weight 500
- Text: `rgba(237, 239, 242, 0.9)` (near-white)
- Background: `rgba(0, 0, 0, 0.45)` (dark translucent)
- Padding: `1px 6px`, border-radius: `3px`
- Variants: `.route-label-primary` bumps bg to `0.6` and text to `#fff`. `.route-label-dim` reduces opacity to 0.5. Status labels (target-located, target-map) use status color text instead.

### Map Color Palette
Map-specific colors that pair with the satellite imagery. These are intentional deviations from UI tokens, not conflicts.

| Token | Hex | Usage | Notes |
|-------|-----|-------|-------|
| Route blue | `#407CF5` | Active route lines, flight trail, assigned markers | Mapbox Navigation standard |
| Route casing | `#1B43B4` | Flight trail outline (casing only on active trail) | Deep blue, not black |
| Alt route | `#5f8fad` | Return-to-base route, secondary routes | Matches `--accent` |
| Incident amber | `#D4A017` | P1-P2 incident dots, search zone fill | Warm amber for satellite contrast |
| Incident red | `#c95454` | Critical incidents, target-map-label | Desaturated red |
| Green | `#4a9a65` | Confirmed target, orbit zone | Matches `--green` |
| Label bg | `rgba(0, 0, 0, 0.45)` | All map label backgrounds | One value everywhere |
| Label text | `rgba(237, 239, 242, 0.9)` | All map label text | Near-white |

### Flight Trail
The flight trail uses thick centered casing (NOT offset shadow) because it's a continuous path, not a dotted route:
- Outline: `#1B43B4`, weight 7, opacity 0.8
- Route: `#407CF5`, weight 4, opacity 1.0
- Both use `lineCap: 'round'`
- Trail is cleared on every `clearOverlays()` call

## Chat Message Hierarchy

Messages in the chat panel follow a strict visual hierarchy. Not everything deserves the same prominence.

| Tier | Class | Font | Color | Border | Use Case |
|------|-------|------|-------|--------|----------|
| **SARA primary** | `.chat-msg-sara` | 13px body | `--text-primary` | 2px accent left | Main AI communication: instructions, analysis, questions |
| **Content block** | `.chat-content-block` | inherits | inherits | none | Rich cards, data grids, checklists embedded after SARA messages |
| **Action buttons** | `.chat-choices` | 12px | button styles | none | Primary/secondary buttons for operator decisions |
| **System note** | `.chat-msg-system` | 11px mono | `--text-muted` | none | Deemphasized status: "Search area modified", "All checks passed", availability notes |
| **User message** | `.chat-msg-user` | 13px body | `--text-muted` | 2px border right | Operator's spoken/typed input |
| **Dispatch** | `.chat-msg-dispatch` | 13px body | `--text-secondary` | 2px amber left | Incoming dispatch updates |
| **Radio chatter** | `.chat-msg-radio` | 10px mono | `--text-muted` | 2px border left | Background radio traffic, lowest priority |

**Rules:**
- System notes have no label ("SARA"), no border. They're ambient context, not conversation.
- SARA primary should be reserved for messages that require operator attention or action.
- Status confirmations ("All checks passed", "Search area modified") are system notes, not SARA messages.
- Content blocks appear directly after SARA messages. Never standalone.

## Component Rules
- No gratuitous borders, glows, gradients, or shadows
- Every visual element earns its place — if removing it doesn't hurt comprehension, remove it
- **No inline styles.** All styling via CSS classes. Only dynamic values (CSS custom properties, transform:rotate) may be inline.
- Buttons: `--accent-dim` bg + `--accent-text` text for primary; `--bg-card` bg + `--text-secondary` text for secondary
- Inputs: `--bg-card` bg, `--border` border, `--text-primary` text, `--border-strong` on focus
- Cards: `--bg-card` bg, `--border` border, `--r-md` radius. `.card-recommended` for accent left border.
- Chat bubbles: SARA uses `--text-primary` (not secondary — readability over hierarchy in chat)
- Status badges: pill shape, muted color bg at 15% opacity, status color text
- Pills: `.pill-green` / `.pill-red` for target status coloring (no inline color)
- Color text: use `.text-green`, `.text-red`, `.text-amber`, `.text-accent` utilities
- Icon sizes: `.icon-inline` (14px, inline with text), `.icon-xs` (12px), `.icon-sm` (16px), `.icon-md` (18px)
- Map markers: icon styles live in `map.css` (`.incident-dot .material-symbols-outlined`, `.base-marker-icon`, `.edit-handle-icon`)

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-27 | Geist + Geist Mono as type stack | Matches USAvionix marketing site, geometric clarity fits industrial aesthetic |
| 2026-03-27 | 4-tier background system | Replaces v1-v3's 5-tier system, cleaner separation with fewer tiers |
| 2026-03-27 | Compact 4px base spacing | Tactical tool, data-dense screens, operator efficiency |
| 2026-03-27 | Minimal-functional motion | Operators need clarity, not delight. Every animation serves spatial understanding |
| 2026-03-27 | Fresh component design | v1-v3 components carried over without thought. All components designed from scratch for v4 |
| 2026-03-30 | Unified map overlay system | One drone marker style, one shadow style (1px offset), one label base class, aligned palette, trail clears on screen change |
| 2026-03-30 | Chat message hierarchy | 7-tier system: SARA primary, content blocks, actions, system notes, user, dispatch, radio. Status updates deemphasized as system notes. |
| 2026-03-30 | Auto-sizing map labels | `.map-label` base class with `width: auto !important` replaces fixed `iconSize` labels. Pills fit their text content. |
| 2026-03-30 | Unified 911 drone selection flow | All drone selections (Deploy button + map click) go through same flow: analysis → search area → preflight → mission. No more briefing screen detour. |
