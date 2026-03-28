/**
 * Screen Renderers
 *
 * Each function returns an HTML string for its screen.
 * Event handlers are bound after render in app.js via bindScreenEvents().
 */

import { INCIDENTS, DRONES, SARA_ANALYSIS, MISSION_BRIEFING, PREFLIGHT_CHECKS, MISSION_SUMMARY } from './scenarios/san-diego-pursuit.js';

// Screen 1: Login
export function screen1() {
  return `
    <div class="screen screen-center fade-in">
      <form id="auth-form" class="stack-12" style="width:100%;max-width:320px">
        <div class="text-center mb-8">
          <div class="org-label">Riverside County SAR</div>
        </div>
        <input type="email" id="auth-email" value="j.martinez@riverside-sar.gov"
          class="form-input" placeholder="Email">
        <input type="password" id="auth-password" value="password123"
          class="form-input" placeholder="Password">
        <button type="submit" class="btn-primary w-full mt-4">Sign In</button>
        <div class="text-center">
          <a href="#" class="card-desc" style="text-decoration:none" onclick="event.preventDefault()">Forgot password?</a>
        </div>
      </form>
    </div>
  `;
}

// Screen 2: Mission Type Selection
export function screen2() {
  return `
    <div class="screen screen-center fade-in">
      <div class="screen-title">Authenticated</div>
      <div class="screen-subtitle">Welcome, Riverside County SAR. How would you like to proceed?</div>
      <div class="row-12" style="flex-wrap:wrap;justify-content:center">
        <div class="card card-interactive text-left" data-action="path-911" style="width:240px;cursor:pointer">
          <div class="card-header-row">
            <span class="material-symbols-outlined card-icon" style="color:var(--red)">emergency</span>
            <span class="card-title">Active Incidents</span>
          </div>
          <div class="card-desc">Select from current 911 dispatches with AI-analyzed intelligence</div>
        </div>
        <div class="card card-interactive text-left" data-action="path-manual" style="width:240px;cursor:pointer">
          <div class="card-header-row">
            <span class="material-symbols-outlined card-icon" style="color:var(--accent)">flight_takeoff</span>
            <span class="card-title">Manual Mission</span>
          </div>
          <div class="card-desc">Configure a custom search with target description and area</div>
        </div>
      </div>
    </div>
  `;
}

// Screen 3: Incident Map (911 path) — panel content for chat-history
export function screen3() {
  const cards = INCIDENTS.map(inc => {
    const priorityClass = `priority-p${inc.priority}`;
    const priorityLabel = `P${inc.priority}`;
    return `
      <div class="card card-interactive incident-card" data-action="select-incident" data-id="${inc.id}">
        <div class="incident-info">
          <div class="card-header-row tight">
            <span class="${priorityClass}">${priorityLabel}</span>
            <span class="incident-type">${inc.type}</span>
          </div>
          <div class="incident-location">
            <span class="material-symbols-outlined" style="font-size:14px;vertical-align:-2px">location_on</span>
            ${inc.location}
          </div>
          <div class="incident-time">${inc.time} · ${inc.elapsed}</div>
          <div class="incident-narrative">${inc.narrative}</div>
          <div class="incident-meta">
            <span class="incident-meta-text">${inc.units} unit${inc.units !== 1 ? 's' : ''} responding</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="panel-header">
      <div class="panel-title">Active Incidents</div>
      <div class="panel-subtitle">${INCIDENTS.length} tracked · San Diego County</div>
    </div>
    <div class="stack-8">
      ${cards}
    </div>
  `;
}

// Screen 4: SARA Analysis (911 path) — panel content
export function screen4() {
  const t = SARA_ANALYSIS.target;
  return `
    <div class="panel-header">
      <div class="panel-title">Incident Analysis</div>
      <div class="panel-subtitle">SARA processed ${SARA_ANALYSIS.transcriptsAnalyzed} dispatch recordings</div>
    </div>

    <div class="card mb-12">
      <div class="section-label">Extracted Target Profile</div>
      <div class="data-grid">
        <span class="data-label">Vehicle</span><span class="data-value">${t.vehicle}</span>
        <span class="data-label">Plate</span><span class="data-value mono">${t.plate}</span>
        <span class="data-label">Last seen</span><span class="data-value">${t.lastSeen} — ${t.lastSeenTime}</span>
        <span class="data-label">Speed</span><span class="data-value">${t.speed}</span>
        <span class="data-label">Suspect</span><span class="data-value">${t.suspect}</span>
        <span class="data-label">Units</span><span class="data-value">${t.respondingUnits} responding</span>
      </div>
    </div>

    <details class="card mb-12" style="cursor:pointer">
      <summary class="card-desc" style="padding:4px 0">View source transcripts</summary>
      <pre class="transcript-pre">${SARA_ANALYSIS.transcriptText}</pre>
    </details>

    <div class="row-8 mt-16">
      <button class="btn-primary" data-action="to-drone-select">Select Drone</button>
      <button class="btn-secondary" data-action="edit-target">Edit Target Info</button>
    </div>
  `;
}

// Screen 5: Drone Selection — panel content
export function screen5() {
  const path = arguments[0] || '911';
  const sorted = path === '911'
    ? [...DRONES].sort((a, b) => (a.distanceFromIncident ?? Infinity) - (b.distanceFromIncident ?? Infinity))
    : DRONES;

  const cards = sorted.map((drone, i) => {
    const isAvailable = drone.status === 'available';
    const isClosest = path === '911' && i === 0 && isAvailable;
    const statusLabel = drone.status === 'available' ? 'Available'
      : drone.status === 'in-mission' ? `In Mission (${drone.operator})`
      : 'Offline';
    const statusClass = drone.status;
    const distText = drone.distanceFromIncident != null ? `${drone.distanceFromIncident} km` : '—';

    return `
      <div class="card ${isAvailable ? 'card-interactive' : ''} drone-card ${isClosest ? 'selected' : ''} ${!isAvailable ? 'disabled' : ''}"
        ${isAvailable ? `data-action="select-drone" data-id="${drone.id}"` : ''}>
        <div class="flex-1">
          <div class="card-header-row tight">
            <span class="drone-name">${drone.name}</span>
            <span class="drone-status ${statusClass}">${statusLabel}</span>
          </div>
          <div class="drone-stats">
            <span class="stat"><span class="material-symbols-outlined">battery_full</span>${drone.battery}%</span>
            <span class="stat"><span class="material-symbols-outlined">signal_cellular_alt</span>${drone.signal}</span>
            ${path === '911' ? `<span class="stat"><span class="material-symbols-outlined">straighten</span>${distText}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="panel-header">
      <div class="panel-title">Select Drone</div>
      <div class="panel-subtitle">${path === '911' ? 'Sorted by distance from incident' : 'Available fleet'}</div>
    </div>
    <div class="stack-8">
      ${cards}
    </div>
  `;
}

// Screen 6: Mission Briefing (911 path) — panel content
export function screen6() {
  const b = MISSION_BRIEFING;
  return `
    <div class="panel-header">
      <div class="panel-title">Mission Briefing</div>
      <div class="panel-subtitle">Review and confirm to proceed</div>
    </div>

    <div class="card mb-12">
      <div class="section-label">Mission Plan</div>
      <div class="data-grid">
        <span class="data-label">Target</span><span class="data-value">${b.target}</span>
        <span class="data-label">Last known</span><span class="data-value">${b.lastKnown}</span>
        <span class="data-label">Direction</span><span class="data-value">${b.direction}</span>
        <span class="data-label">Search area</span><span class="data-value">${b.searchArea}</span>
        <span class="data-label">Drone</span><span class="data-value">${b.drone}</span>
        <span class="data-label">Units</span><span class="data-value">${b.respondingUnits.join(', ')}</span>
      </div>
    </div>

    <button class="btn-primary w-full" data-action="confirm-mission">Confirm & Configure Search Area</button>
  `;
}

// Screen 7: Search Area (map + chat)
export function screen7() {
  return `<div class="screen fade-in" id="screen-7-content"></div>`;
}

// Screen 8: Takeoff / Pre-Flight
export function screen8() {
  const checks = PREFLIGHT_CHECKS.map(c => `
    <div class="checklist-item check-animate">
      <span class="material-symbols-outlined">${c.icon}</span>
      <span class="flex-1">${c.label}</span>
      <span class="check-value">${c.value} ✓</span>
    </div>
  `).join('');

  return `<div class="screen fade-in" id="screen-8-content">
    <div style="max-width:400px" class="mx-auto">
      ${checks}
    </div>
  </div>`;
}

// Screen 9: Mission in Progress (map + chat + FPV)
export function screen9() {
  return `<div class="screen fade-in" id="screen-9-content"></div>`;
}

// Screen 10: Target Spotted
export function screen10() {
  return `<div class="screen fade-in" id="screen-10-content"></div>`;
}

// Screen 11: Orbiting Target
export function screen11() {
  return `<div class="screen fade-in" id="screen-11-content"></div>`;
}

// Screen 12: Returning Home
export function screen12() {
  return `<div class="screen fade-in" id="screen-12-content"></div>`;
}

// Screen 13: Mission Complete
export function screen13() {
  const s = MISSION_SUMMARY;
  return `
    <div class="screen screen-center fade-in" style="padding:24px;max-width:560px" class="mx-auto">
      <div class="chat-msg chat-msg-sara chat-msg--static">
        <div class="chat-msg-label">SARA</div>
        <div class="chat-msg-text">Mission complete. Here's your summary.</div>
      </div>

      <div class="summary-card mb-20 w-full">
        <div class="section-label" style="letter-spacing:1px;margin-bottom:16px">Mission Summary</div>
        <div class="summary-grid">
          <div class="summary-stat"><span class="label">Duration</span><span class="value">${s.duration}</span></div>
          <div class="summary-stat"><span class="label">Area Covered</span><span class="value">${s.areaCovered}</span></div>
          <div class="summary-stat"><span class="label">Target Found</span><span class="value" style="color:var(--green)">${s.targetFound}</span></div>
          <div class="summary-stat"><span class="label">Battery Used</span><span class="value">${s.batteryUsed}</span></div>
          <div class="summary-stat"><span class="label">Distance Flown</span><span class="value">${s.distanceFlown}</span></div>
          <div class="summary-stat"><span class="label">Max Altitude</span><span class="value">${s.maxAltitude}</span></div>
        </div>
      </div>

      <div class="chat-msg chat-msg-sara chat-msg--static">
        <div class="chat-msg-label">SARA</div>
        <div class="chat-msg-text">Flight recording and mission data have been saved. It is now safe to turn off your drone.</div>
      </div>

      <button class="btn-primary" data-action="new-mission">Start New Mission</button>
    </div>
  `;
}
