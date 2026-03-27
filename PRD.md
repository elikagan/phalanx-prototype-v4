# Phalanx — Product Requirements Document
## Interactive Drone Mission Control Prototype

**Version:** v4 (clean rebuild)
**Date:** March 27, 2026
**Author:** Eli Kagan + Claude
**Status:** Ready for implementation

---

## 1. Executive Summary

Phalanx is an AI-powered drone mission control system for law enforcement and search-and-rescue operations. This document specifies a fully interactive prototype that demonstrates the core user experience: authenticating, selecting a mission, deploying a drone, conducting an AI-assisted search with voice commands, and tracking a target in real-time.

The prototype must be responsive (desktop 1024×768 + mobile), use real map tiles (Leaflet/satellite), and feel like a production application — not a slideshow. Every visual element on the map must correspond to what's described in the chat. Every transition must be smooth and intentional.

**This is a rebuild from scratch.** Previous prototype iterations (v1-v3) established all product decisions, UX flows, design system, and interaction patterns documented here. The implementation was brittle (single 3,700-line HTML file, hardcoded scripts, static images). This version uses a proper architecture with a state machine, real map, component-based rendering, and a demo orchestration layer.

---

## 2. Product Vision

### What Phalanx Does
An operator receives a 911 call about a vehicle pursuit. They open Phalanx, see the active incident, and SARA (the AI assistant) has already analyzed the dispatch transcripts — extracting vehicle description, last known location, speed, and direction. The operator selects the nearest drone, confirms the AI-generated search area, and launches. During the mission, they communicate with SARA via push-to-talk voice commands: "Focus south of Oak," "Get closer to that red car," "Lock on and orbit." SARA responds verbally and visually — the drone moves, the camera zooms, the map updates. Live radio chatter from ground units flows into the chat, and SARA surfaces relevant updates. When the target is found, the operator confirms and SARA maintains visual contact until ground units arrive.

### Core Principle
**The map and the conversation tell the same story.** If SARA says "rerouting to Washington and Dupont," the drone visually flies there. If the user says "zoom in," the FPV feed zooms. If dispatch reports the suspect turned west, the search area shifts west. There is never a disconnect between what's said and what's shown.

---

## 3. User Personas

### Primary: Field Operator
- Law enforcement or SAR professional
- Operating from a vehicle, command post, or office
- May be using a phone (mobile) or tablet/laptop (desktop)
- Needs to multitask — watching the feed, talking to dispatch, directing the drone
- Voice is the primary input method in the field

### Secondary: Incident Commander
- Supervising multiple units including drone operations
- Needs high-level status at a glance
- May review mission after the fact

---

## 4. Screen Flow

### 4.1 Authentication
**Screen 1: Login**
- Organization token input
- Pre-filled for demo: `pk_org_9f2a1b8c`
- On submit → authenticates, shows org name "Riverside County SAR"
- Advances to path selection

### 4.2 Path Selection
**Screen 2: Choose Mission Type**
- Two options presented by SARA:
  - "Select an Active Incident" → 911 Response Path
  - "Start Manual Mission" → Manual Path
- Clean card-based UI, not buttons in a chat bubble

### 4.3 911 Response Path

**Screen 3a: Incident List**
- 3-4 active incident cards
- Each card contains:
  - Priority badge (P1 red, P2 amber, P3 gray)
  - Incident type (Vehicle Pursuit, Missing Person, Suspicious Vehicle)
  - Location (street address)
  - Time (absolute + relative: "9:15 PM · 12 min ago")
  - Responding units count
  - One-sentence narrative description
  - Small map thumbnail with incident pin
- Tapping a card selects it and advances

**Demo incidents:**
1. **Vehicle Pursuit (P1)** — "Red sedan fled traffic stop at high speed, heading southbound on Madison. 3 units in pursuit." — 1200 Madison Ave, 9:15 PM, 12 min ago, 3 units
2. **Missing Person (P2)** — "72-year-old male wandered from care facility. Last seen wearing gray jacket near Maple Park." — Maple Park area, 8:45 PM, 42 min ago, 1 unit
3. **Suspicious Vehicle (P3)** — "Black van idling in residential area for 15+ minutes. No plates visible." — Oak & 5th, 9:30 PM, 2 min ago, 0 units

**Screen 4a: SARA Analysis**
- SARA analyzes dispatch transcripts for the selected incident
- UI sequence:
  1. "I've analyzed 3 dispatch recordings for incident #4471."
  2. Collapsible thinking block: "View source transcripts" — expands to show raw dispatch text with highlighted keywords
  3. Extracted target profile card:
     - Vehicle: Red sedan (Honda)
     - Plate: Partial — **7X3
     - Last seen: Madison & Oak — **12 min ago at 9:15 PM**
     - Speed: ~45 mph southbound
     - Suspect: Male, dark clothing
     - Responding: 3 units
  4. "Ready to select a drone for this mission?"
  5. Buttons: "Select Drone" (primary) / "Edit Target Info" (secondary)

**Screen 5a: Drone Selection (Distance-Sorted)**
- Same drone cards as manual path BUT:
  - Sorted by distance from the selected incident
  - Each card shows: drone name, status, battery, signal, **distance from incident**, **map thumbnail showing drone location relative to incident**
  - Closest available drone is visually emphasized

**Demo drones:**
1. **Delta SA-128** — Available, 98% battery, 1.2 km from incident (closest)
2. **Delta SA-064** — Available, 67% battery, 3.8 km from incident
3. **Delta SA-256** — In Mission (J. Torres), 54% battery
4. **Delta SA-032** — Offline

**Screen 6a: Mission Briefing**
- SARA presents a mission summary before launch
- "Based on the incident data, here's the mission plan:"
- Summary card:
  - Target: Red sedan (Honda), partial plate **7X3
  - Last known: Madison & Oak, 12 min ago
  - Direction: Southbound at ~45 mph
  - Search area: 500m radius, southbound bias from last known position
  - Drone: DSA-128, ETA to search area: 45 seconds
  - Responding units: 3 (Unit 42, Unit 38, Unit 51)
- "Confirm to proceed to search area setup."
- Button: "Confirm Mission" (primary)

### 4.4 Manual Path

**Screen 3b: Drone Selection**
- Same drone cards, no distance sorting (no incident selected yet)
- User picks a drone

**Screen 4b: Target Description (Chat)**
- SARA asks: "What are you looking for?"
- Pre-scripted chat exchange where user describes a red Nissan Pathfinder with roof rack and bumper dent
- SARA confirms target and asks about license plate, identifying features, reference image
- "Ready to set up the search area?"

### 4.5 Converged Flow

**Screen 7: Search Area**
- Split layout: map (left/fullscreen on mobile) + chat (right/drawer)
- **911 path:** Search area is pre-configured by SARA
  - Elliptical zone biased south from Madison & Oak
  - "LAST KNOWN" waypoint marker at Madison & Oak
  - "SEARCH ZONE — SOUTHBOUND" label
  - Drone positioned at north edge of zone
  - SARA explains reasoning: "Based on dispatch data... ~45 mph × 12 min elapsed"
  - Lawnmower sweep pattern runs north-to-south
  - Button: "Confirm Search Area"
- **Manual path:** Empty map with draggable circle boundary
  - User sets the search area manually
  - Button: "Done" → locks boundary

**Screen 8: Takeoff / Pre-Flight**
- Same map with locked boundary
- Pre-flight checklist: Battery ✓, GPS ✓, Signal ✓, Compass ✓, Airspace ✓, Weather ✓
- "All systems go. Drone is ready for takeoff."
- Button on map: "Launch Mission"

**Screen 9: Mission in Progress**
- **This is the core experience screen.** The user spends the most time here.
- Split layout: FPV video feed (left/fullscreen) + chat (right/drawer)
- FPV/Map toggle: thumbnail in corner, tap to swap
- HUD overlay on video: altitude, speed, heading, coordinates, recording indicator
- Telemetry bar: battery, progress, altitude, signal, time
- Map thumbnail: shows drone position, search zone, flight trail
- Chat: SARA status updates + radio chatter + user voice commands
- PTT input: textarea + mic button + send button (desktop), FAB (mobile)

**Screen 10: Target Spotted**
- Alert state: target bounding box appears on video feed
- "POTENTIAL TARGET" label
- SARA: "I've detected a red SUV matching your target description."
- Choice buttons: "Yes, Confirm Target" / "No, Continue Search"
- Map thumbnail: search zone removed, target marker + orbit circle added

**Screen 11: Orbiting Target**
- Confirmed target: green bounding box, "TARGET CONFIRMED" label
- SARA narrates changes: "Vehicle is stationary," "Person exiting driver side"
- User can give voice commands: "Get closer," "Zoom in on driver side"
- Map: drone orbiting target, green orbit circle
- Exec buttons: "Return Home" / "Abort"

**Screen 12: Returning Home**
- Map view: animated return path from target to home
- Drone marker moving toward home point
- Faded target marker showing where drone came from
- Telemetry: RTH mode, ETA, battery
- SARA: "Drone returning home. ETA 2:30."
- "Touchdown confirmed. Motors disarmed."
- Button: "View Mission Summary"

**Screen 13: Mission Complete**
- Full-width chat layout
- Summary card: duration, area covered, target found (yes), battery used, distance flown, max altitude
- "Flight recording and mission data have been saved."
- "It is now safe to turn off your drone."
- Button: "Start New Mission"

---

## 5. The Demo Narrative (8 Scripted Exchanges)

During screens 9-13, the user interacts with SARA through a scripted sequence. On desktop, the text pre-types into the input field. On mobile, the user holds the FAB and words appear word-by-word. Each exchange triggers map/video actions.

### Exchange 1: Radio Awareness
- **User:** "SARA, what's the latest from dispatch on this vehicle?"
- **SARA:** "Last update 2 minutes ago. Unit 42 had visual near Madison and Oak. Suspect heading southbound, headlights off."
- **Radio:** Unit 42 reports visual on red sedan near Madison & Oak
- **Map:** No change

### Exchange 2: Redirect Search
- **User:** "Focus the search south of Oak. Check the side streets off Dupont."
- **SARA:** "Confirmed. Adjusting search pattern. Prioritizing residential blocks south of Oak along Dupont."
- **Map:** Search zone shifts south, drone rotates, lawnmower pattern redraws
- **FPV:** Camera pans southward (CSS transform shift)

### Exchange 3: Radio Interrupt (SARA-initiated)
- **SARA:** "Dispatch update — Unit 38 reports suspect vehicle turned west on Elm. Updating search area."
- **Radio:** Unit 38: suspect vehicle turned west on Elm Street
- **Map:** Search zone shifts west, waypoint at Elm & Dupont

### Exchange 4: Visual Contact
- **User:** "I see something on the feed. Red car parked on Elm, near the alley. Can you get closer?"
- **SARA:** "Moving in. Descending to 60 meters for closer visual."
- **Map:** Fly to Elm location, zoom to high detail
- **FPV:** Zoom in (CSS scale transform on aerial.jpg)
- **Telemetry:** Altitude changes from 120m to 60m

### Exchange 5: Target Confirmation → Screen 10
- **User:** "That's it. Red Honda, dented bumper. Lock on and orbit."
- **SARA:** "Target acquired. Entering orbit mode. Maintaining visual on red sedan, Elm Street."
- **Map:** Red target marker + orbit circle, search zone removed, drone on orbit ring
- **FPV:** Target bounding box appears
- **Screen transition:** → Screen 10 (Target Spotted)

### Exchange 6: Live Surveillance
- **User:** "Someone's getting out. Zoom in on the driver side."
- **SARA:** "Adjusting camera. One individual exiting driver side, heading east on foot."
- **Radio:** SARA relays to dispatch: "Phalanx has visual. Suspect exiting vehicle, eastbound on foot."
- **Map:** Drone repositions on orbit
- **FPV:** Zoom tighter

### Exchange 7: Vehicle Moves (SARA-initiated)
- **SARA:** "Vehicle is moving. Second occupant driving. Heading south on Dupont. Tracking."
- **Map:** Target marker moves south, drone follows, trail extends
- **FPV:** Camera tracks moving vehicle

### Exchange 8: Mission Complete → Screen 12
- **User:** "Ground units have the suspect. Good work. Return home."
- **SARA:** "Confirmed. Returning to base. ETA 3 minutes. Mission data saved."
- **Map:** Return path line, drone heading home
- **Screen transition:** → Screen 12 (Returning Home)

---

## 6. Live Radio Chatter

Radio updates from ground units appear in the chat alongside SARA messages. They are visually distinct and collapsible.

### Appearance
- Subtle left border (not colored — gray like other borders)
- "DISPATCH UPDATE" label in dim mono text + timestamp
- One-line summary visible by default
- "View transcript" expands to show raw radio text
- Radio icon in topbar with badge count of unread updates

### Behavior
- Radio messages are SARA-initiated — they appear automatically at scripted moments
- SARA may summarize: "Dispatch update — Unit 38 reports suspect turned west on Elm."
- Tapping the badge scrolls to the latest radio message

### Demo radio script
1. Exchange 1: "Unit 42 reports visual on red sedan near Madison & Oak" (9:21 PM)
2. Exchange 3: "Unit 38: suspect vehicle turned west on Elm Street" (9:25 PM)
3. Exchange 6: "SARA → Dispatch: Suspect exiting vehicle, eastbound on foot" (9:29 PM)

---

## 7. Push-to-Talk (PTT)

### Desktop
- Chat input area: multi-line textarea + mic button + send button
- Always visible, no mode toggle
- Mic button: click and hold to record. Words transcribe into textarea word-by-word.
- Release: remaining words fill, auto-submits
- Send button: submits whatever's in the textarea
- Both input methods always available simultaneously (like iOS keyboard mic)

### Mobile
- FAB (floating action button): big blue circle, bottom-right
- Press and hold: drawer opens, waveform animates, words appear word-by-word in chat
- Release: transcription complete, scan line sweeps, SARA responds
- Drawer stays open until user closes it (swipe down, tap outside)
- When drawer closed: SARA messages appear as toast notification above FAB
- Keyboard + options buttons: fixed bottom-left, always visible on mission screens

### PTT Animation Sequence (mobile)
1. Press FAB → FAB turns red, drawer slides up (400ms)
2. Waveform visible → words appear one by one (220ms intervals)
3. Release → fill remaining words instantly
4. Waveform fades out (opacity only, 300ms)
5. Scan line sweeps (1200ms)
6. User text dims (color transition, 400ms)
7. SARA message appears → words one by one (120ms intervals)
8. Done → user closes drawer manually

Each step waits for the previous to finish. Sequential, not parallel.

---

## 8. Map & Video Requirements

### Map (Leaflet)
- Satellite tiles (Esri World Imagery, no API key)
- Real coordinates: Pasadena, CA area
- Pinch/zoom/pan gestures must ALWAYS work
- Elements:
  - **Drone marker:** rotatable icon, faces direction of travel
  - **Search zone:** dashed circle/ellipse, labeled, can be biased directionally
  - **Waypoints:** crosshair icon + mono label
  - **Target:** pulsing red/green marker + dashed orbit circle + label
  - **Flight trail:** polyline showing drone path
  - **Unit markers:** ground unit positions from radio chatter (optional)
- When UI covers the map (drawer, chat panel), map recenters to visible area
  - CSS transform on map container (not Leaflet API)
  - Tesla-style magnetic easing: 1200-1800ms

### FPV Video Feed
- `aerial.jpg` as background image
- Zoom effect via CSS `transform: scale() translate()` — animated per exchange
- HUD overlay: crosshair, corner brackets, telemetry text
- Scan lines (repeating gradient)
- Target bounding box: position, size, color animate per exchange
- Recording indicator

### FPV/Map Toggle
- Small thumbnail in corner shows the alternate view
- Tap to swap: smooth transition between map and FPV
- Map shows drone position + context; FPV shows what the drone sees

---

## 9. Design System

### Aesthetic
Between military dashboard and modern minimal AI tech. NOT a video game. Clean, minimal, self-confident. Great spacing, typography, hierarchy. No busy edge borders or button decoration. No gratuitous glows, gradients, or shadows. Every element earns its place.

### Colors

**Backgrounds (5-tier layering):**
| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-sidebar` | `#141417` | Sidebar, panels |
| `--bg-base` | `#18181b` | App background |
| `--bg-content` | `#1c1c1f` | Content areas |
| `--bg-card` | `#212126` | Cards, inputs |
| `--bg-hover` | `#28282e` | Hover states |

**Text (5-tier hierarchy):**
| Token | Hex | Usage |
|-------|-----|-------|
| `--text-bright` | `#d0d0d6` | Headings, emphasis |
| `--text` | `#b4b4bc` | Body text, SARA messages |
| `--text-muted` | `#6e6e78` | Secondary info |
| `--text-dim` | `#4e4e56` | Labels, metadata |
| `--text-ghost` | `#3a3a42` | Placeholders, disabled |

**Accent:**
| Token | Hex | Usage |
|-------|-----|-------|
| `--accent` | `#5f8fad` | Accent blue |
| `--accent-btn` | `#3d6b85` | Primary button background |
| `--accent-btn-text` | `#d4e0e8` | Primary button text |

**Semantic (muted, professional):**
| Token | Hex | Usage |
|-------|-----|-------|
| `--green` | `#4a9a65` | Active, success, confirmed |
| `--red` | `#b85454` | Critical, danger, recording |
| `--amber` | `#a89540` | Caution, radio chatter |
| `--blue` | `#5a8fbf` | Info |

**Borders:**
| Token | Hex |
|-------|-----|
| `--border-subtle` | `#242429` |
| `--border` | `#2c2c33` |
| `--border-strong` | `#3a3a42` |

### Typography
- **UI:** System sans-serif (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`)
- **Technical data:** Monospace stack (`'SF Mono', 'Fira Code', 'Consolas', 'JetBrains Mono', monospace`)
- **Icons:** Google Material Symbols Outlined
- Minimum body text: 13px. Minimum labels: 11px. Line height: 1.5 body, 1.2 labels.

### Borders & Radii
- Radii: 4px small, 6px default, 8px large
- No pill shapes unless explicitly needed

### Chat Hierarchy
- **SARA messages:** Left-aligned, accent blue left border, max-width 82%, white text
- **User messages:** Right-aligned, subtle right border, max-width 82%, gray text
- User text is gray because you already know what you said. SARA text is bright because it's the important information.

---

## 10. Motion Design Rules

These are non-negotiable. They were established through painful iteration where every violation caused a visible failure.

1. **NEVER flash elements in/out of the DOM.** Every appearance/disappearance: animated (slide, fade, or both). Minimum 200ms.
2. **NEVER animate container height.** Fixed heights + internal scroll. Show/hide with `translateY`.
3. **NEVER duplicate content across containers.** Content lives in ONE DOM location. Animate between states, not between containers.
4. **NEVER call layout-measuring during animations.** Measure before, animate after.
5. **Word-by-word transcription is sacred.** PTT must show live transcription. Never show full sentence instantly.
6. **Map gestures must always work.** No overlays blocking touch events.
7. **Every animation has easing.** No linear. Minimum 300ms. `cubic-bezier(.32,.72,0,1)` default.
8. **One animation per element at a time.** Sequential, not parallel.
9. **Map recenters when UI covers it.** Offset = UI coverage / 2. Tesla-style magnetic easing.
10. **No hardcoded pixel offsets.** Use vh/vw, calc(), CSS custom properties.

---

## 11. Responsive Strategy

### Breakpoint: 768px

### Desktop (≥768px)
- 1024×768 fixed frame centered on page
- Split layout: map/video left, chat right (on map screens)
- Full-width chat layout for non-map screens
- Textarea + mic + send in chat panel
- Topbar: logo, status, pills, radio badge, clock

### Mobile (<768px)
- Fullscreen Leaflet map
- Bottom drawer (fixed 30vh, internal scroll, translateY show/hide)
- FAB bottom-right for PTT
- Keyboard + options buttons bottom-left
- SARA toast when drawer closed
- Drag handle at bottom center
- Top/bottom gradients for legibility over map
- FAB only visible on mission screens (9-11)

### Per-Screen Mobile Controls

| Screen | FAB | KB + Options | Drawer |
|--------|-----|-------------|--------|
| 1-2 | — | — | — |
| 3a-6a | — | — | — |
| 3b-4b | — | KB only | — |
| 7-8 | — | — | — |
| 9-11 | ✓ | ✓ | ✓ |
| 12 | — | Options | ✓ |
| 13 | — | — | — |

---

## 12. Technical Architecture (Recommended)

### State Machine
The app is driven by state, not DOM manipulation. State includes:
- `currentScreen` — which screen is active
- `missionPath` — '911' or 'manual'
- `selectedIncident` — incident data object
- `selectedDrone` — drone data object
- `dronePosition` — {lat, lng, heading, altitude}
- `targetPosition` — {lat, lng} or null
- `targetStatus` — 'none' | 'detected' | 'confirmed' | 'tracking'
- `searchZone` — {center, radius, bias}
- `narrativeIndex` — which exchange we're on
- `chatHistory` — array of message objects

When state changes, views update reactively. The demo script changes state; the UI renders from state.

### Demo Orchestration Layer
A single `demo-script.js` file defines the entire demo narrative:
```javascript
const demoScript = {
  incidents: [...],
  drones: [...],
  exchanges: [...],
  radioEvents: [...],
  mapActions: {
    'redirectSouth': (state) => { state.searchZone.center.lat -= 0.002; ... },
    'targetAcquired': (state) => { state.targetPosition = {...}; state.targetStatus = 'detected'; ... },
    ...
  }
};
```

Changing the demo = editing this one file. The UI adapts automatically.

### File Structure
```
index.html          — Entry point, password gate
app.js              — State machine, screen routing, event handling
components/
  chat.js           — Chat rendering (append-only, no innerHTML)
  map.js            — Leaflet map, markers, overlays
  fpv.js            — FPV view, CSS transforms, HUD
  topbar.js         — Status bar, pills, radio badge
  drawer.js         — Mobile drawer, FAB, toast
  input.js          — Textarea, mic, send (desktop + mobile)
styles/
  base.css          — Reset, variables, typography
  layout.css        — Responsive grid, breakpoints
  components.css    — Chat, cards, buttons, inputs
  map.css           — Map overlays, markers, HUD
  mobile.css        — Drawer, FAB, gradients, toast
  animations.css    — All transitions and keyframes
demo-script.js      — Narrative, exchanges, radio events, map actions
```

### Tech Stack
- **Build:** Vite (fast dev server, HMR)
- **Language:** Vanilla JS (no framework — keep it simple)
- **Map:** Leaflet + Esri World Imagery tiles
- **Icons:** Google Material Symbols Outlined
- **Fonts:** System sans-serif + JetBrains Mono (CDN)
- **Deploy:** GitHub Pages

---

## 13. Wireframe Mode

Toggle via `?wireframe` URL parameter. CSS-only override:
- White backgrounds, no color
- Simple 1px borders
- System sans-serif only
- Map/video areas show gray placeholders with labels
- All status colors become gray
- Purpose: show functionality without distraction of styling

---

## 14. Open Questions

1. Should the 911 incident list auto-refresh with simulated new incidents?
2. Should SARA proactively suggest switching to a higher-priority incident mid-mission?
3. Do we need a "dispatcher" role view in addition to the operator view?
4. What happens if drone battery gets critical during a 911 response?
5. Should there be an "evidence capture" button that bookmarks moments in the recording?
6. Should the summary screen include a timeline/replay of the mission?

---

## 15. Success Criteria

The prototype is successful when:
1. A non-technical person can walk through the 911 demo path and understand what's happening without explanation
2. Every map/video visual matches the corresponding chat text at every moment
3. The PTT voice interaction feels natural and high-end on both desktop and mobile
4. Transitions are smooth enough that you don't notice them — they just feel right
5. The app feels like a real product, not a prototype
