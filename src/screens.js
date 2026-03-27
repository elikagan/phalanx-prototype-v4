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
      <div class="chat-msg chat-msg-sara" style="max-width:420px;margin-bottom:24px;opacity:1;transform:none">
        <div class="chat-msg-label">SARA</div>
        <div class="chat-msg-text">Welcome to Phalanx Mission Control. Enter your organization token to begin.</div>
      </div>
      <form id="auth-form" style="display:flex;gap:8px;width:100%;max-width:420px;justify-content:center">
        <input type="text" id="auth-token" value="pk_org_9f2a1b8c" class="auth-input"
          style="flex:1;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);
          color:var(--text);font-family:var(--font-mono);font-size:13px;padding:10px 16px;outline:none">
        <button type="submit" class="btn-primary">Authenticate</button>
      </form>
    </div>
  `;
}

// Screen 2: Mission Type Selection
export function screen2() {
  return `
    <div class="screen screen-center fade-in">
      <div class="chat-msg chat-msg-sara" style="max-width:460px;margin-bottom:32px;opacity:1;transform:none">
        <div class="chat-msg-label">SARA</div>
        <div class="chat-msg-text">Authenticated. Welcome, Riverside County SAR. How would you like to proceed?</div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
        <div class="card card-interactive" data-action="path-911" style="width:240px;text-align:left;cursor:pointer">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span class="material-symbols-outlined" style="color:var(--red);font-size:20px">emergency</span>
            <span style="font-size:14px;font-weight:500;color:var(--text-bright)">Active Incidents</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted)">Select from current 911 dispatches with AI-analyzed intelligence</div>
        </div>
        <div class="card card-interactive" data-action="path-manual" style="width:240px;text-align:left;cursor:pointer">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span class="material-symbols-outlined" style="color:var(--accent);font-size:20px">flight_takeoff</span>
            <span style="font-size:14px;font-weight:500;color:var(--text-bright)">Manual Mission</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted)">Configure a custom search with target description and area</div>
        </div>
      </div>
    </div>
  `;
}

// Screen 3: Incident List (911 path)
export function screen3() {
  const cards = INCIDENTS.map(inc => {
    const priorityClass = `priority-p${inc.priority}`;
    const priorityLabel = `P${inc.priority}`;
    return `
      <div class="card card-interactive incident-card" data-action="select-incident" data-id="${inc.id}">
        <div class="incident-info">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
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
            <span style="font-size:11px;color:var(--text-dim)">${inc.units} unit${inc.units !== 1 ? 's' : ''} responding</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="screen fade-in" style="padding:24px;max-width:560px;margin:0 auto">
      <div class="chat-msg chat-msg-sara" style="margin-bottom:20px;opacity:1;transform:none">
        <div class="chat-msg-label">SARA</div>
        <div class="chat-msg-text">I'm tracking ${INCIDENTS.length} active incidents. Select one for mission intelligence.</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${cards}
      </div>
    </div>
  `;
}

// Screen 4: SARA Analysis (911 path)
export function screen4() {
  const t = SARA_ANALYSIS.target;
  return `
    <div class="screen fade-in" style="padding:24px;max-width:560px;margin:0 auto">
      <div class="chat-msg chat-msg-sara" style="margin-bottom:16px;opacity:1;transform:none">
        <div class="chat-msg-label">SARA</div>
        <div class="chat-msg-text">I've analyzed ${SARA_ANALYSIS.transcriptsAnalyzed} dispatch recordings for incident #4471.</div>
      </div>

      <details class="card" style="margin-bottom:16px;cursor:pointer">
        <summary style="font-size:12px;color:var(--text-muted);padding:4px 0">View source transcripts</summary>
        <pre style="font-family:var(--font-mono);font-size:11px;color:var(--text-dim);line-height:1.6;
          margin-top:12px;white-space:pre-wrap">${SARA_ANALYSIS.transcriptText}</pre>
      </details>

      <div class="card" style="margin-bottom:16px">
        <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">
          Extracted Target Profile
        </div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:13px">
          <span style="color:var(--text-dim)">Vehicle</span><span style="color:var(--text-bright)">${t.vehicle}</span>
          <span style="color:var(--text-dim)">Plate</span><span style="color:var(--text-bright);font-family:var(--font-mono)">${t.plate}</span>
          <span style="color:var(--text-dim)">Last seen</span><span style="color:var(--text-bright)">${t.lastSeen} — ${t.lastSeenTime}</span>
          <span style="color:var(--text-dim)">Speed</span><span style="color:var(--text-bright)">${t.speed}</span>
          <span style="color:var(--text-dim)">Suspect</span><span style="color:var(--text-bright)">${t.suspect}</span>
          <span style="color:var(--text-dim)">Units</span><span style="color:var(--text-bright)">${t.respondingUnits} responding</span>
        </div>
      </div>

      <div class="chat-msg chat-msg-sara" style="margin-bottom:16px;opacity:1;transform:none">
        <div class="chat-msg-label">SARA</div>
        <div class="chat-msg-text">Ready to select a drone for this mission?</div>
      </div>

      <div style="display:flex;gap:8px">
        <button class="btn-primary" data-action="to-drone-select">Select Drone</button>
        <button class="btn-secondary" data-action="edit-target">Edit Target Info</button>
      </div>
    </div>
  `;
}

// Screen 5: Drone Selection
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
      <div class="card ${isAvailable ? 'card-interactive' : ''} drone-card ${isClosest ? 'selected' : ''}"
        ${isAvailable ? `data-action="select-drone" data-id="${drone.id}"` : ''}
        style="${!isAvailable ? 'opacity:0.5;cursor:default' : ''}">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
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
    <div class="screen fade-in" style="padding:24px;max-width:560px;margin:0 auto">
      <div class="chat-msg chat-msg-sara" style="margin-bottom:20px;opacity:1;transform:none">
        <div class="chat-msg-label">SARA</div>
        <div class="chat-msg-text">${path === '911'
          ? 'Here are available drones, sorted by distance from the incident. I recommend Delta SA-128 — closest at 1.2 km.'
          : 'Select a drone for your mission.'}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${cards}
      </div>
    </div>
  `;
}

// Screen 6: Mission Briefing (911 path)
export function screen6() {
  const b = MISSION_BRIEFING;
  return `
    <div class="screen fade-in" style="padding:24px;max-width:560px;margin:0 auto">
      <div class="chat-msg chat-msg-sara" style="margin-bottom:16px;opacity:1;transform:none">
        <div class="chat-msg-label">SARA</div>
        <div class="chat-msg-text">Based on the incident data, here's the mission plan:</div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">
          Mission Summary
        </div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:13px">
          <span style="color:var(--text-dim)">Target</span><span style="color:var(--text-bright)">${b.target}</span>
          <span style="color:var(--text-dim)">Last known</span><span style="color:var(--text-bright)">${b.lastKnown}</span>
          <span style="color:var(--text-dim)">Direction</span><span style="color:var(--text-bright)">${b.direction}</span>
          <span style="color:var(--text-dim)">Search area</span><span style="color:var(--text-bright)">${b.searchArea}</span>
          <span style="color:var(--text-dim)">Drone</span><span style="color:var(--text-bright)">${b.drone}</span>
          <span style="color:var(--text-dim)">Units</span><span style="color:var(--text-bright)">${b.respondingUnits.join(', ')}</span>
        </div>
      </div>

      <div class="chat-msg chat-msg-sara" style="margin-bottom:16px;opacity:1;transform:none">
        <div class="chat-msg-label">SARA</div>
        <div class="chat-msg-text">Confirm to proceed to search area setup.</div>
      </div>

      <button class="btn-primary" data-action="confirm-mission">Confirm Mission</button>
    </div>
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
      <span style="flex:1">${c.label}</span>
      <span style="color:var(--green);font-family:var(--font-mono);font-size:12px">${c.value} ✓</span>
    </div>
  `).join('');

  return `<div class="screen fade-in" id="screen-8-content">
    <div style="max-width:400px;margin:0 auto">
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
    <div class="screen screen-center fade-in" style="padding:24px;max-width:560px;margin:0 auto">
      <div class="chat-msg chat-msg-sara" style="margin-bottom:20px;opacity:1;transform:none;max-width:100%">
        <div class="chat-msg-label">SARA</div>
        <div class="chat-msg-text">Mission complete. Here's your summary.</div>
      </div>

      <div class="summary-card" style="margin-bottom:20px;width:100%">
        <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:16px">
          Mission Summary
        </div>
        <div class="summary-grid">
          <div class="summary-stat"><span class="label">Duration</span><span class="value">${s.duration}</span></div>
          <div class="summary-stat"><span class="label">Area Covered</span><span class="value">${s.areaCovered}</span></div>
          <div class="summary-stat"><span class="label">Target Found</span><span class="value" style="color:var(--green)">${s.targetFound}</span></div>
          <div class="summary-stat"><span class="label">Battery Used</span><span class="value">${s.batteryUsed}</span></div>
          <div class="summary-stat"><span class="label">Distance Flown</span><span class="value">${s.distanceFlown}</span></div>
          <div class="summary-stat"><span class="label">Max Altitude</span><span class="value">${s.maxAltitude}</span></div>
        </div>
      </div>

      <div class="chat-msg chat-msg-sara" style="margin-bottom:20px;opacity:1;transform:none;max-width:100%">
        <div class="chat-msg-label">SARA</div>
        <div class="chat-msg-text">Flight recording and mission data have been saved. It is now safe to turn off your drone.</div>
      </div>

      <button class="btn-primary" data-action="new-mission">Start New Mission</button>
    </div>
  `;
}
