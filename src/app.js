/**
 * Phalanx v4 — App Entry
 *
 * State machine → screen routing → component init.
 * Clean rebuild from scratch. Zero code from v1-v3.
 */

import * as state from './state.js';
import * as screens from './screens.js';
import * as mapComponent from './components/map.js';
import * as topbar from './components/topbar.js';
import * as chat from './components/chat.js';
import * as fpv from './components/fpv.js';
import * as orchestrator from './orchestrator.js';
import { INCIDENTS, DRONES, SEARCH_ZONE, WAYPOINTS, PREFLIGHT_CHECKS, MISSION_SUMMARY, SARA_ANALYSIS, MISSION_BRIEFING } from './scenarios/san-diego-pursuit.js';

// ── Password Gate ──────────────────────────────────────────
const PASSWORD = 'phalanx';

// Auto-restore session if already authenticated
if (localStorage.getItem('phalanx-auth') === 'true') {
  document.getElementById('password-gate')?.classList.add('hidden');
  document.getElementById('app-shell')?.classList.remove('hidden');
  requestAnimationFrame(() => boot());
}

document.getElementById('gate-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('gate-input');
  const error = document.getElementById('gate-error');
  if (input.value === PASSWORD) {
    localStorage.setItem('phalanx-auth', 'true');
    document.getElementById('password-gate').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    boot();
  } else {
    error.textContent = 'Invalid access code';
    input.value = '';
    input.focus();
  }
});

// ── Boot ───────────────────────────────────────────────────
function boot() {
  state.init();
  state.set({ isMobile: window.innerWidth < 768 });

  // If returning from a reload, skip auth screens and go to incidents map
  if (localStorage.getItem('phalanx-auth') === 'true') {
    state.set({
      authenticated: true,
      orgName: 'Riverside County SAR',
      userName: 'J. Martinez',
      missionPath: '911',
      currentScreen: 3,
    });
    // Fix history so back button goes to incidents map, not login
    history.replaceState({ screen: 3 }, '', '');
  }
  topbar.init();
  mapComponent.init();

  // Responsive detection
  window.addEventListener('resize', () => {
    state.set({ isMobile: window.innerWidth < 768 });
    mapComponent.resize();
  });

  // Logo click → back to incidents map
  document.getElementById('topbar-logo')?.addEventListener('click', () => {
    if (state.get('authenticated')) {
      state.goToScreen(3);
    }
  });

  // Delegated click handler on screen-content
  document.getElementById('screen-content')?.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]');
    if (!action) return;
    handleAction(action.dataset.action, action.dataset);
  });

  // Delegated click handler on chat-history (for panel screens)
  document.getElementById('chat-history')?.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]');
    if (!action) return;
    handleAction(action.dataset.action, action.dataset);
  });

  // Single delegated submit handler on screen-content (for forms)
  document.getElementById('screen-content')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    if (form.id === 'auth-form') {
      // Demo: any submission logs in
      state.set({ authenticated: true, orgName: 'Riverside County SAR', userName: 'J. Martinez', missionPath: '911' });
      state.goToScreen(3);
    }
  });

  // Chat input: send button + enter key trigger next exchange
  setupChatInput();

  // Mobile controls: FAB, drawer, toast
  setupMobileControls();

  // Screen routing
  state.on('currentScreen', renderScreen);

  // Initial render
  renderScreen(state.get('currentScreen'));
}

// ── Chat Input ─────────────────────────────────────────────
function setupChatInput() {
  const sendBtn = document.getElementById('btn-send');
  const micBtn = document.getElementById('btn-mic');
  const textarea = document.getElementById('chat-textarea');

  // Send message
  const sendMessage = () => {
    const text = textarea.value.trim();
    if (!text) return;
    textarea.value = '';

    const screen = state.get('currentScreen');

    // On mission screens (9-11), trigger orchestrator
    if (screen >= 9 && screen <= 11) {
      if (orchestrator.isActive()) return;
      orchestrator.next();
      return;
    }

    // On setup screens (3-6), handle typed commands
    handleChatCommand(text, screen);
  };

  sendBtn?.addEventListener('click', sendMessage);

  textarea?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Mic button: hold-to-talk on desktop
  let micHoldTimer = null;
  micBtn?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (orchestrator.isActive()) return;
    micBtn.classList.add('recording');
    micHoldTimer = setTimeout(() => {
      textarea.value = '';
      orchestrator.next();
    }, 150);
  });
  micBtn?.addEventListener('pointerup', () => {
    micBtn?.classList.remove('recording');
    if (micHoldTimer) { clearTimeout(micHoldTimer); micHoldTimer = null; }
  });
  micBtn?.addEventListener('pointercancel', () => {
    micBtn?.classList.remove('recording');
    if (micHoldTimer) { clearTimeout(micHoldTimer); micHoldTimer = null; }
  });
}

// ── Mobile Controls ───────────────────────────────────────
// Screens that show mobile FAB + controls
const FAB_SCREENS = new Set([9, 10, 11]);
// Screens that show drawer (chat on mobile)
const DRAWER_SCREENS = new Set([9, 10, 11, 12]);

let drawerOpen = false;

function setupMobileControls() {
  const fab = document.getElementById('fab');
  const mobileControls = document.getElementById('mobile-controls');
  const kbBtn = document.getElementById('btn-keyboard');
  const optBtn = document.getElementById('btn-options');
  const chatPanel = document.getElementById('chat-panel');
  const toast = document.getElementById('sara-toast');

  if (!fab) return;

  // FAB press-and-hold PTT
  let pttTimer = null;
  let pttActive = false;

  fab.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (orchestrator.isActive()) return;
    fab.classList.add('recording');
    pttActive = true;

    // Open drawer if closed
    if (!drawerOpen) openDrawer();

    // Start PTT after brief hold (150ms prevents accidental taps)
    pttTimer = setTimeout(() => {
      if (pttActive) triggerMobilePTT();
    }, 150);
  });

  fab.addEventListener('pointerup', () => {
    fab.classList.remove('recording');
    pttActive = false;
    if (pttTimer) { clearTimeout(pttTimer); pttTimer = null; }
  });

  fab.addEventListener('pointercancel', () => {
    fab.classList.remove('recording');
    pttActive = false;
    if (pttTimer) { clearTimeout(pttTimer); pttTimer = null; }
  });

  // Toast tap opens drawer
  toast?.addEventListener('click', () => {
    openDrawer();
  });

  // Drawer drag handle (the ::before pseudo-element area)
  chatPanel?.addEventListener('click', (e) => {
    // Only close if tapping the drag handle area (top 20px of drawer)
    const rect = chatPanel.getBoundingClientRect();
    if (e.clientY - rect.top < 20 && drawerOpen) {
      closeDrawer();
    }
  });

  // Subscribe to SARA messages for toast
  state.on('lastSaraMessage', (msg) => {
    if (!state.get('isMobile') || drawerOpen) return;
    showToast(msg);
  });
}

function triggerMobilePTT() {
  if (orchestrator.isActive()) return;
  orchestrator.next();
}

function openDrawer() {
  const chatPanel = document.getElementById('chat-panel');
  if (!chatPanel) return;
  chatPanel.classList.remove('drawer-closed');
  drawerOpen = true;
  state.set({ drawerOpen: true });
  hideToast();
}

function closeDrawer() {
  const chatPanel = document.getElementById('chat-panel');
  if (!chatPanel) return;
  chatPanel.classList.add('drawer-closed');
  drawerOpen = false;
  state.set({ drawerOpen: false });
}

function showToast(text) {
  const toast = document.getElementById('sara-toast');
  if (!toast) return;
  toast.textContent = text.length > 80 ? text.substring(0, 80) + '…' : text;
  toast.classList.add('visible');
  // Auto-hide after 6s
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => hideToast(), 6000);
}

function hideToast() {
  const toast = document.getElementById('sara-toast');
  if (!toast) return;
  toast.classList.remove('visible');
}

/** Update mobile control visibility per screen */
function manageMobileControls(screen) {
  if (!state.get('isMobile')) return;

  const mobileControls = document.getElementById('mobile-controls');
  const fab = document.getElementById('fab');
  const kbBtn = document.getElementById('btn-keyboard');
  const optBtn = document.getElementById('btn-options');
  const chatPanel = document.getElementById('chat-panel');

  const showFab = FAB_SCREENS.has(screen);
  const showDrawer = DRAWER_SCREENS.has(screen);

  // Mobile controls container
  if (showFab) {
    mobileControls?.classList.remove('hidden');
    fab?.classList.remove('hidden');
    kbBtn?.classList.remove('hidden');
    optBtn?.classList.remove('hidden');
  } else {
    mobileControls?.classList.add('hidden');
    fab?.classList.add('hidden');
    kbBtn?.classList.add('hidden');
    optBtn?.classList.add('hidden');
  }

  // Drawer: on mobile, chat-panel starts closed
  if (showDrawer && state.get('isMobile')) {
    chatPanel?.classList.remove('hidden');
    if (!drawerOpen) chatPanel?.classList.add('drawer-closed');
  }
}

// ── Screen Routing ─────────────────────────────────────────
const screenRenderers = {
  1: screens.screen1,
  2: screens.screen2,
  3: screens.screen3,
  4: screens.screen4,
  5: screens.screen5,
  6: screens.screen6,
  7: screens.screen7,
  8: screens.screen8,
  9: screens.screen9,
  10: screens.screen10,
  11: screens.screen11,
  12: screens.screen12,
  13: screens.screen13,
  14: screens.screen14,
};

// Screens that show the map or FPV
const MAP_SCREENS = new Set([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14]);
// Screens that show the right panel (chat)
const CHAT_SCREENS = new Set([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14]);
// Screens that show the chat input
const INPUT_SCREENS = new Set([3, 4, 5, 6, 9, 10, 11, 14]);
// Screens that show FPV as default view
const FPV_SCREENS = new Set([9, 10, 11, 14]);

function renderScreen(screen) {
  const contentEl = document.getElementById('screen-content');
  const renderer = screenRenderers[screen];
  if (!renderer || !contentEl) return;

  // Determine layout
  const showMap = MAP_SCREENS.has(screen);
  const showChat = CHAT_SCREENS.has(screen);
  const showInput = INPUT_SCREENS.has(screen);
  const showFpv = FPV_SCREENS.has(screen);

  state.set({ showMap, showChat, showInput, fpvActive: showFpv });

  // Update panels
  const chatPanel = document.getElementById('chat-panel');
  const chatInput = document.getElementById('chat-input');

  if (showChat) {
    chatPanel?.classList.remove('hidden');
    if (showMap) {
      contentEl.classList.add('hidden');
    }
  } else {
    chatPanel?.classList.add('hidden');
    contentEl.classList.remove('hidden');
  }

  const isMobile = state.get('isMobile');

  // On mobile, chat input is replaced by FAB — always hide it
  if (showInput && !isMobile) {
    chatInput?.classList.remove('hidden');
  } else {
    chatInput?.classList.add('hidden');
  }

  // Render screen content
  if (!showMap) {
    contentEl.classList.remove('hidden');
    const path = state.get('missionPath');
    contentEl.innerHTML = renderer(path);
  } else {
    contentEl.innerHTML = '';
    // Show map
    const mapContainer = document.getElementById('map-container');
    mapContainer?.classList.remove('hidden');
  }

  // Clear overlay markers when entering non-setup screens (not live scene)
  if (screen >= 7 && screen !== 14) {
    mapComponent.clearOverlays();
  }

  // FPV layer
  manageFpvLayer(showFpv);

  // Telemetry bar
  manageTelemetryBar(showMap && (screen >= 9 || screen === 14));

  // Mobile controls visibility
  manageMobileControls(screen);

  // Screen-specific setup
  setupScreen(screen);

  // Resize map after layout change
  if (showMap) {
    requestAnimationFrame(() => mapComponent.resize());
  }
}

/** Show/hide FPV layer over the map */
function manageFpvLayer(show) {
  const mapContainer = document.getElementById('map-container');
  let fpvLayer = document.getElementById('fpv-layer');

  if (show) {
    mapContainer?.classList.remove('hidden');
    if (!fpvLayer) {
      fpvLayer = document.createElement('div');
      fpvLayer.id = 'fpv-layer';
      fpvLayer.className = 'fpv-view';
      mapContainer?.appendChild(fpvLayer);
      fpv.init(fpvLayer);
    }
    fpvLayer.style.display = 'block';
    fpv.resize();
  } else if (fpvLayer) {
    fpvLayer.style.display = 'none';
  }

  // Manage view toggle button
  manageViewToggle(show);
}

/** Show/hide view toggle thumbnail (FPV ↔ Map) — v3 thumbnail style */
function manageViewToggle(fpvActive) {
  const mapContainer = document.getElementById('map-container');
  let wrapper = document.getElementById('view-toggle-wrapper');

  if (!mapContainer) return;

  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.id = 'view-toggle-wrapper';
    wrapper.className = 'view-toggle-wrapper';
    wrapper.innerHTML = `
      <div class="view-thumb" id="view-thumb">
        <div class="view-thumb-label" id="view-thumb-label">MAP</div>
        <button class="view-toggle" title="Toggle map/video">
          <span class="material-symbols-outlined icon-sm">swap_horiz</span>
        </button>
      </div>
    `;
    mapContainer.appendChild(wrapper);

    wrapper.addEventListener('click', () => {
      const fpvLayer = document.getElementById('fpv-layer');
      const thumb = document.getElementById('view-thumb');
      const thumbLabel = document.getElementById('view-thumb-label');
      if (!fpvLayer) return;
      const isShowingFpv = fpvLayer.style.display !== 'none';

      if (isShowingFpv) {
        fpvLayer.style.display = 'none';
        thumb.classList.add('showing-map');
        thumbLabel.textContent = 'CAM';
        mapComponent.resize();
      } else {
        fpvLayer.style.display = 'block';
        thumb.classList.remove('showing-map');
        thumbLabel.textContent = 'MAP';
        fpv.resize();
      }
    });
  } else {
    mapContainer.appendChild(wrapper);
  }

  wrapper.style.display = fpvActive ? 'block' : 'none';
  const thumb = document.getElementById('view-thumb');
  const thumbLabel = document.getElementById('view-thumb-label');
  if (thumb) thumb.classList.remove('showing-map');
  if (thumbLabel) thumbLabel.textContent = 'MAP';
}

/** Show/hide telemetry bar */
function manageTelemetryBar(show) {
  let bar = document.getElementById('telemetry-bar');
  const mapContainer = document.getElementById('map-container');

  if (show && !bar) {
    bar = document.createElement('div');
    bar.id = 'telemetry-bar';
    bar.className = 'telemetry-bar-map';
    bar.innerHTML = `
      <div class="telem-item"><span class="telem-label">BAT</span><span class="telem-value" id="telem-bat">98%</span></div>
      <div class="telem-item"><span class="telem-label">ALT</span><span class="telem-value" id="telem-alt">120m</span></div>
      <div class="telem-item"><span class="telem-label">SPD</span><span class="telem-value" id="telem-spd">35 km/h</span></div>
      <div class="telem-item"><span class="telem-label">HDG</span><span class="telem-value" id="telem-hdg">180°</span></div>
      <div class="telem-item"><span class="telem-label">SIG</span><span class="telem-value" id="telem-sig">Strong</span></div>
    `;
    mapContainer?.appendChild(bar);

    // Subscribe to state updates for telemetry
    state.on('droneBattery', v => { const el = document.getElementById('telem-bat'); if (el) el.textContent = v + '%'; });
    state.on('droneAltitude', v => { const el = document.getElementById('telem-alt'); if (el) el.textContent = v + 'm'; });
    state.on('droneSpeed', v => { const el = document.getElementById('telem-spd'); if (el) el.textContent = v + ' km/h'; });
    state.on('droneHeading', v => { const el = document.getElementById('telem-hdg'); if (el) el.textContent = v + '°'; });
  }

  if (bar) bar.style.display = show ? 'flex' : 'none';
}

/** Handle typed text commands on setup screens */
function handleChatCommand(text, screen) {
  const lower = text.toLowerCase();

  // Show user message in chat
  chat.appendUser(text);

  // Screen 3: incident selection
  if (screen === 3) {
    // Match incident by ID fragment, type, or number
    const match = INCIDENTS.find(inc =>
      inc.id.includes(lower) ||
      inc.type.toLowerCase().includes(lower) ||
      lower.includes(inc.id.replace('inc-', ''))
    );
    if (match) {
      state.set({ selectedIncident: match });
      state.goToScreen(4);
      return;
    }
    chat.appendSara(`No incident matching "${text}". Try selecting from the list or clicking a marker on the map.`);
    return;
  }

  // Screen 4: deploy with selected drone
  if (screen === 4) {
    if (lower.includes('deploy') || lower.includes('launch') || lower.includes('go') || lower.includes('yes') || lower.includes('next')) {
      const inc = state.get('selectedIncident');
      if (inc?.coordinates) {
        state.set({ searchZone: { center: inc.coordinates, radius: SEARCH_ZONE.radius } });
      }
      state.goToScreen(8);
      return;
    }
    // Try to match a drone by name
    const match = DRONES.find(d =>
      d.status === 'surveillance' && (
        d.name.toLowerCase().includes(lower) ||
        d.id.includes(lower)
      )
    );
    if (match) {
      state.set({ selectedDrone: match });
      const inc = state.get('selectedIncident');
      if (inc?.coordinates) {
        state.set({ searchZone: { center: inc.coordinates, radius: SEARCH_ZONE.radius } });
      }
      state.goToScreen(8);
      return;
    }
    chat.appendSara("Say \"deploy\" or select a drone on the map.");
    return;
  }

  // Screen 5: drone selection (manual path)
  if (screen === 5) {
    const match = DRONES.find(d =>
      d.status === 'surveillance' && (
        d.name.toLowerCase().includes(lower) ||
        d.id.includes(lower)
      )
    );
    if (match) {
      state.set({ selectedDrone: match });
      state.goToScreen(8);
      return;
    }
    chat.appendSara(`No available drone matching "${text}". Select from the list or click a drone on the map.`);
    return;
  }
}

function handleAction(action, dataset) {
  switch (action) {
    case 'path-911':
      state.set({ missionPath: '911' });
      state.goToScreen(3);
      break;

    case 'path-manual':
      state.set({ missionPath: 'manual' });
      state.goToScreen(5);
      break;

    case 'select-incident': {
      const incident = INCIDENTS.find(i => i.id === dataset.id);
      if (!incident) break;
      const assignedDrone = DRONES.find(d => d.assignedIncident === incident.id);
      if (assignedDrone) {
        // Drone already on scene — show live feed
        state.set({ selectedIncident: incident, selectedDrone: assignedDrone });
        state.goToScreen(14);
      } else {
        state.set({ selectedIncident: incident });
        state.goToScreen(4);
      }
      break;
    }

    case 'to-drone-select':
      state.goToScreen(5);
      break;

    case 'select-drone': {
      const drone = DRONES.find(d => d.id === dataset.id);
      if (drone) {
        state.set({ selectedDrone: drone });
        const inc = state.get('selectedIncident');
        if (inc?.coordinates) {
          state.set({ searchZone: { center: inc.coordinates, radius: SEARCH_ZONE.radius } });
        }
        state.goToScreen(8);
      }
      break;
    }

    case 'confirm-search':
      state.goToScreen(8);
      break;

    case 'launch-mission':
      state.goToScreen(9);
      break;

    case 'new-mission':
      orchestrator.reset();
      fpv.reset();
      state.init();
      renderScreen(1);
      break;

    case 'view-summary':
      state.goToScreen(13);
      break;
  }
}

// ── Screen-Specific Setup ──────────────────────────────────
function setupScreen(screen) {
  switch (screen) {
    case 3:
      setupIncidentMapScreen();
      break;
    case 4:
      setupAnalysisScreen();
      break;
    case 5:
      setupDroneMapScreen();
      break;
    case 6:
      setupBriefingScreen();
      break;
    case 7:
      setupSearchAreaScreen();
      break;
    case 8:
      setupPreflightScreen();
      break;
    case 9:
      setupMissionScreen();
      break;
    case 10:
      setupTargetSpottedScreen();
      break;
    case 11:
      setupOrbitScreen();
      break;
    case 12:
      setupReturningScreen();
      break;
    case 13:
      setupCompleteScreen();
      break;
    case 14:
      setupLiveSceneScreen();
      break;
  }
}

async function setupIncidentMapScreen() {
  chat.clear();
  mapComponent.clearOverlays();

  // Which incidents have drones assigned?
  const assignedIncidentIds = new Set(
    DRONES.filter(d => d.assignedIncident).map(d => d.assignedIncident)
  );

  // Show incidents + drones on map, then fit to show everything at metro scale
  mapComponent.showIncidents(INCIDENTS, (inc) => {
    const assignedDrone = DRONES.find(d => d.assignedIncident === inc.id);
    if (assignedDrone) {
      state.set({ selectedIncident: inc, selectedDrone: assignedDrone });
      state.goToScreen(14);
    } else {
      state.set({ selectedIncident: inc });
      state.goToScreen(4);
    }
  }, { skipFitBounds: true, assignedIncidentIds });

  const handleIncidentClick = (inc) => {
    const assignedDrone = DRONES.find(d => d.assignedIncident === inc.id);
    if (assignedDrone) {
      state.set({ selectedIncident: inc, selectedDrone: assignedDrone });
      state.goToScreen(14);
    } else {
      state.set({ selectedIncident: inc });
      state.goToScreen(4);
    }
  };

  mapComponent.showFleetDrones(DRONES, null, () => {}, {
    skipFitBounds: true,
    incidents: INCIDENTS,
    onIncidentSelect: handleIncidentClick,
  });

  // Fit all markers with max zoom 12 so the full metro spread is visible
  mapComponent.fitAllMarkers([60, 60], 12);

  // Fleet status
  const surveillance = DRONES.filter(d => d.status === 'surveillance').length;
  const inMission = DRONES.filter(d => d.status === 'in-mission').length;
  const standby = DRONES.filter(d => d.status === 'standby').length;

  // Welcome message — typed out for a live feel
  const gen = chat.getGeneration();
  await chat.appendSaraWordByWord(
    `Welcome back. ${surveillance} drones on surveillance, ${inMission} responding to incidents. ${standby} on standby ready for launch.`
  );

  // Bail if user navigated away during the word-by-word typing
  if (chat.getGeneration() !== gen) return;

  // Compact incident cards — numbered, structured rows, expandable on hover
  const cardsHtml = INCIDENTS.map((inc, idx) => {
    const priorityClass = `priority-p${inc.priority}`;
    const droneOnScene = DRONES.find(d => d.status === 'in-mission' && d.assignedIncident === inc.id);
    const droneTag = droneOnScene
      ? `<span class="incident-drone-tag">${droneOnScene.name}</span>`
      : '';
    return `
      <div class="card card-interactive incident-card-compact" data-action="select-incident" data-id="${inc.id}">
        <div class="incident-compact-row">
          <span class="incident-number">#${inc.id.replace(/\D/g, '')}</span>
          <span class="${priorityClass}">P${inc.priority}</span>
          <span class="incident-compact-type">${inc.type}</span>
          <span class="incident-compact-meta">${inc.elapsed}</span>
          ${droneTag}
        </div>
        <div class="incident-compact-location">${inc.location}</div>
        <div class="incident-expand">
          <div class="incident-narrative-text">${inc.narrative}</div>
          <div class="incident-meta-text">${inc.units} unit${inc.units !== 1 ? 's' : ''} responding · ${inc.time}</div>
        </div>
      </div>`;
  }).join('');

  if (chat.getGeneration() !== gen) return;
  chat.appendSaraWithContent(
    `I'm tracking ${INCIDENTS.length} active incidents in San Diego County.`,
    `<div class="stack-4">${cardsHtml}</div>`
  );
}

function setupAnalysisScreen() {
  chat.clear();
  mapComponent.clearOverlays();
  const inc = state.get('selectedIncident');
  if (inc?.coordinates) {
    mapComponent.showIncidents([inc], () => {});
  }

  // Show surveillance drones on map (can be rerouted to incident)
  const availableDrones = DRONES.filter(d => d.status === 'surveillance');
  const closestDrone = [...availableDrones].sort((a, b) => {
    // Calculate distance dynamically
    if (!inc?.coordinates) return 0;
    const haversine = (coords) => {
      const R = 6371;
      const dLat = (inc.coordinates[0] - coords[0]) * Math.PI / 180;
      const dLng = (inc.coordinates[1] - coords[1]) * Math.PI / 180;
      const a2 = Math.sin(dLat/2)**2 + Math.cos(coords[0]*Math.PI/180)*Math.cos(inc.coordinates[0]*Math.PI/180)*Math.sin(dLng/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1-a2));
    };
    return haversine(a.coordinates) - haversine(b.coordinates);
  })[0];

  mapComponent.showFleetDrones(availableDrones, inc?.coordinates, (drone) => {
    state.set({ selectedDrone: drone });
    state.set({ searchZone: { center: inc.coordinates, radius: SEARCH_ZONE.radius } });
    state.goToScreen(8);
  }, { skipFitBounds: true, recommendedDroneId: closestDrone?.id });

  // Set state-driven search zone + editable handles
  if (inc?.coordinates) {
    state.set({ searchZone: { center: inc.coordinates, radius: SEARCH_ZONE.radius } });
    let searchAreaNoted = false;
    setTimeout(() => {
      mapComponent.makeSearchZoneEditable((zone) => {
        state.set({ searchZone: zone });
        if (!searchAreaNoted) {
          searchAreaNoted = true;
          const sizeText = zone.radiusX === zone.radiusY
            ? `${Math.round(zone.radiusX)}m radius`
            : `${Math.round(zone.radiusX)} × ${Math.round(zone.radiusY)}m`;
          chat.appendSystem(`Search area modified — ${sizeText}`);
        }
      });
    }, 300);
  }

  // Fit map to show incident + drones
  if (inc?.coordinates) {
    mapComponent.fitAllMarkers([60, 60], 14);
  }

  // Auto-select closest drone
  if (closestDrone) {
    state.set({ selectedDrone: closestDrone });
  }

  const t = SARA_ANALYSIS.target;

  // Calculate ETA for the recommended drone
  let distKm = closestDrone?.distanceFromIncident;
  if (!distKm && closestDrone && inc?.coordinates) {
    const R = 6371;
    const dLat2 = (inc.coordinates[0] - closestDrone.coordinates[0]) * Math.PI / 180;
    const dLng2 = (inc.coordinates[1] - closestDrone.coordinates[1]) * Math.PI / 180;
    const a2 = Math.sin(dLat2/2)**2 + Math.cos(closestDrone.coordinates[0]*Math.PI/180)*Math.cos(inc.coordinates[0]*Math.PI/180)*Math.sin(dLng2/2)**2;
    distKm = R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1-a2));
  }
  const etaSec = distKm ? Math.round(distKm / 60 * 3600) : null;
  const etaStr = etaSec ? (etaSec >= 60 ? `${Math.floor(etaSec/60)}m ${etaSec%60}s` : `${etaSec}s`) : null;
  const shortName = closestDrone?.name?.replace(/^Delta\s+/i, '') || 'Unknown';

  const profileHtml = `
    <div class="card mb-8">
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
    ${closestDrone ? `
    <div class="card mb-8 card-recommended">
      <div class="section-label">Recommended Drone</div>
      <div class="data-grid">
        <span class="data-label">Drone</span><span class="data-value">${closestDrone.name}</span>
        <span class="data-label">Distance</span><span class="data-value">${distKm?.toFixed(1)} km</span>
        <span class="data-label">ETA</span><span class="data-value">${etaStr}</span>
        <span class="data-label">Battery</span><span class="data-value">${closestDrone.battery}%</span>
        <span class="data-label">Status</span><span class="data-value">Surveillance — ${closestDrone.patrol || 'patrol'}</span>
      </div>
    </div>` : ''}`;

  chat.appendSaraWithContent(
    `I've analyzed ${SARA_ANALYSIS.transcriptsAnalyzed} dispatch recordings for this incident. ${closestDrone ? `${closestDrone.name} is the closest drone at ${distKm?.toFixed(1)} km, ETA ${etaStr}.` : 'No drones currently available.'}`,
    profileHtml,
    {
      choices: closestDrone ? [
        { label: `Deploy ${shortName}`, className: 'btn-deploy', action: () => {
          state.set({ searchZone: { center: inc.coordinates, radius: SEARCH_ZONE.radius } });
          state.goToScreen(8);
        }},
      ] : [],
    }
  );

  if (availableDrones.length > 1) {
    chat.appendSystem(`${availableDrones.length} drones available — select a different drone on the map to reassign.`);
  }
}

function setupDroneMapScreen() {
  chat.clear();
  mapComponent.clearOverlays();
  const inc = state.get('selectedIncident');
  const incCoords = inc?.coordinates || null;
  if (inc) mapComponent.showIncidents([inc], () => {});
  mapComponent.showFleetDrones(DRONES, incCoords, (drone) => {
    state.set({ selectedDrone: drone });
    const incForZone = state.get('selectedIncident');
    if (incForZone?.coordinates) {
      state.set({ searchZone: { center: incForZone.coordinates, radius: SEARCH_ZONE.radius } });
    }
    state.goToScreen(8);
  });

  const path = state.get('missionPath');
  const sorted = path === '911'
    ? [...DRONES].sort((a, b) => (a.distanceFromIncident ?? Infinity) - (b.distanceFromIncident ?? Infinity))
    : DRONES;

  const cardsHtml = sorted.map((drone, i) => {
    const isAvailable = drone.status === 'surveillance';
    const isClosest = path === '911' && i === 0 && isAvailable;
    const statusLabel = drone.status === 'surveillance' ? `Surveillance — ${drone.patrol || 'patrol'}`
      : drone.status === 'in-mission' ? `In Mission (${drone.operator})`
      : drone.status === 'standby' ? `Standby — ${drone.base || 'Home Base'}`
      : 'Offline';
    const distText = drone.distanceFromIncident != null ? `${drone.distanceFromIncident} km` : '—';
    return `
      <div class="card ${isAvailable ? 'card-interactive' : ''} drone-card ${isClosest ? 'selected' : ''} ${!isAvailable ? 'disabled' : ''}"
        ${isAvailable ? `data-action="select-drone" data-id="${drone.id}"` : ''}>
        <div class="flex-1">
          <div class="card-header-row tight">
            <span class="drone-name">${drone.name}</span>
            <span class="drone-status ${drone.status}">${statusLabel}</span>
          </div>
          <div class="drone-stats">
            <span class="stat"><span class="material-symbols-outlined">battery_full</span>${drone.battery}%</span>
            <span class="stat"><span class="material-symbols-outlined">signal_cellular_alt</span>${drone.signal}</span>
            ${path === '911' ? `<span class="stat"><span class="material-symbols-outlined">straighten</span>${distText}</span>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  chat.appendSaraWithContent(
    path === '911'
      ? 'Here are available drones, sorted by distance. I recommend Delta SA-128 — closest at 1.2 km.'
      : 'Select a drone for your mission.',
    `<div class="stack-8">${cardsHtml}</div>`
  );
}

function setupBriefingScreen() {
  chat.clear();
  mapComponent.clearOverlays();
  const inc = state.get('selectedIncident');
  const drone = state.get('selectedDrone');
  if (inc) mapComponent.showIncidents([inc], () => {});
  // Show drone marker only — no fleet route line (we draw our own below)
  if (drone) mapComponent.showFleetDrones([drone], inc?.coordinates || null, () => {}, { skipRouteLines: true });
  // Show search zone preview centered on incident + route line from drone
  if (inc?.coordinates) {
    mapComponent.showSearchZonePreview(inc.coordinates, SEARCH_ZONE.radius, 0.15);
  }
  if (drone?.coordinates && inc?.coordinates) {
    const dist = drone.distanceFromIncident || 2.3;
    const etaSec = Math.round(dist / 60 * 3600);
    const etaLabel = etaSec >= 60 ? `${Math.floor(etaSec / 60)}m ${etaSec % 60}s` : `${etaSec}s`;
    mapComponent.addRouteLine(drone.coordinates, inc.coordinates, {
      label: `${dist} km · ${etaLabel}`,
    });
  }
  if (inc?.coordinates && drone?.coordinates) {
    mapComponent.fitAllMarkers([60, 60], 13);
  } else if (inc?.coordinates) {
    mapComponent.focusIncident(inc.coordinates, 15);
  }

  const b = MISSION_BRIEFING;
  const briefingHtml = `
    <div class="card">
      <div class="section-label">Mission Plan</div>
      <div class="data-grid">
        <span class="data-label">Target</span><span class="data-value">${b.target}</span>
        <span class="data-label">Last known</span><span class="data-value">${b.lastKnown}</span>
        <span class="data-label">Direction</span><span class="data-value">${b.direction}</span>
        <span class="data-label">Search area</span><span class="data-value">${b.searchArea}</span>
        <span class="data-label">Drone</span><span class="data-value">${b.drone}</span>
        <span class="data-label">Units</span><span class="data-value">${b.respondingUnits.join(', ')}</span>
      </div>
    </div>`;

  chat.appendSaraWithContent(
    "Based on the incident data, here's the mission plan.",
    briefingHtml,
    {
      choices: [
        { label: 'Confirm & Configure Search Area', primary: true, action: () => state.goToScreen(8) },
      ],
    }
  );
}

function setupSearchAreaScreen() {
  const path = state.get('missionPath');
  chat.clear();
  mapComponent.clearOverlays();

  const inc = state.get('selectedIncident');
  const drone = state.get('selectedDrone');
  const incCoords = inc?.coordinates || SEARCH_ZONE.center;

  if (path === '911') {
    // Set up the search zone state
    const editableZone = { center: incCoords, radius: SEARCH_ZONE.radius };
    state.set({ searchZone: editableZone });

    // Track if user modifies the search area
    let searchAreaModified = false;
    const onSearchZoneChange = () => {
      if (!searchAreaModified) {
        searchAreaModified = true;
        chat.appendSystem('Search area modified by operator.');
      }
    };

    requestAnimationFrame(() => {
      mapComponent.resize();
      requestAnimationFrame(() => {
        // Show incident marker
        if (inc) mapComponent.showIncidents([inc], () => {});
        // Show selected drone as blue, with route line to incident
        if (drone) {
          mapComponent.showFleetDrones([drone], incCoords, () => {}, {
            skipRouteLines: true,
            recommendedDroneId: drone.id, // Always blue on this screen
          });
        }
        // Route line from drone to search zone
        if (drone?.coordinates) {
          const dist = drone.distanceFromIncident || 2.3;
          const etaSec = Math.round(dist / 60 * 3600);
          const etaLabel = etaSec >= 60 ? `${Math.floor(etaSec / 60)}m ${etaSec % 60}s` : `${etaSec}s`;
          mapComponent.addRouteLine(drone.coordinates, incCoords, {
            label: `${dist} km · ${etaLabel}`,
          });
        }
        // Last known waypoint
        mapComponent.addWaypoint('lastKnown', WAYPOINTS.lastKnown.coordinates, WAYPOINTS.lastKnown.label);
        // Fit and zoom
        if (drone?.coordinates) {
          mapComponent.fitAllMarkers([60, 60], 13);
        } else {
          mapComponent.flyTo(incCoords[0], incCoords[1], 14, 1.5);
        }
        // Make search zone editable with drag handles
        setTimeout(() => {
          mapComponent.makeSearchZoneEditable(onSearchZoneChange);
        }, 400);
      });
    });

    const shortName = drone?.name?.replace(/^Delta\s+/i, '') || 'drone';
    chat.appendSara(
      `${drone?.name || 'Drone'} assigned. Search area configured based on dispatch data. Drag handles to adjust.`,
      {
        choices: [
          { label: `Launch ${shortName}`, className: 'btn-deploy', action: () => { mapComponent.clearEditHandles(); state.goToScreen(9); } },
        ],
      }
    );
  } else {
    chat.appendSara(
      "Set your search area on the map. Drag to position, pinch to resize.",
      {
        choices: [
          { label: 'Done', primary: true, action: () => state.goToScreen(9) },
        ],
      }
    );
  }
}

async function setupPreflightScreen() {
  chat.clear();
  const gen = chat.getGeneration();

  chat.appendSara("Running pre-flight checks...");

  // Animate each check appearing one by one
  for (let i = 0; i < PREFLIGHT_CHECKS.length; i++) {
    await wait(350);
    if (chat.getGeneration() !== gen) return;
    const c = PREFLIGHT_CHECKS[i];
    chat.appendSystem(`${c.label} — ${c.value} ✓`);
  }

  await wait(600);
  if (chat.getGeneration() !== gen) return;

  chat.appendSystem('All checks passed. Launching...');
  await wait(800);
  if (chat.getGeneration() !== gen) return;
  state.goToScreen(9);
}

function setupMissionScreen() {
  chat.clear();
  mapComponent.clearOverlays();

  const drone = state.get('selectedDrone');
  const inc = state.get('selectedIncident');
  const droneCoords = drone?.coordinates || [32.7680, -117.1820];
  const incCoords = inc?.coordinates || SEARCH_ZONE.origin;

  state.set({
    dronePosition: { lat: droneCoords[0], lng: droneCoords[1] },
    droneHeading: 180,
    droneAltitude: 120,
    droneSpeed: 35,
  });

  // Start in map view (not FPV) so the operator sees the tactical picture
  const fpvLayer = document.getElementById('fpv-layer');
  const thumb = document.getElementById('view-thumb');
  const thumbLabel = document.getElementById('view-thumb-label');
  if (fpvLayer) fpvLayer.style.display = 'none';
  if (thumb) thumb.classList.add('showing-map');
  if (thumbLabel) thumbLabel.textContent = 'CAM';

  // Hide state-driven drone marker (teal SVG) — we use fleet drone marker instead
  mapComponent.hideDroneMarker();

  // Ensure search zone state is set so the state-driven circle renders
  if (!state.get('searchZone') && inc?.coordinates) {
    state.set({ searchZone: { center: incCoords, radius: SEARCH_ZONE.radius } });
  }

  // Map overlays
  if (inc) mapComponent.showIncidents([inc], () => {});
  // Drone marker only (blue, no fleet route lines — we draw our own route below)
  if (drone) {
    mapComponent.showFleetDrones([drone], incCoords, () => {}, { skipRouteLines: true, recommendedDroneId: drone.id });
  }
  // Route line from drone to incident with distance/ETA
  if (drone?.coordinates && inc?.coordinates) {
    const R = 6371;
    const dLat = (incCoords[0] - droneCoords[0]) * Math.PI / 180;
    const dLng = (incCoords[1] - droneCoords[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(droneCoords[0] * Math.PI / 180) * Math.cos(incCoords[0] * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const etaSec = Math.round(distKm / 60 * 3600);
    const etaStr = etaSec >= 60 ? `${Math.floor(etaSec / 60)}m ${etaSec % 60}s` : `${etaSec}s`;
    mapComponent.addRouteLine(droneCoords, incCoords, {
      label: `${distKm.toFixed(1)} km · ${etaStr}`,
    });
  }
  // Fit both drone and incident in view
  if (inc?.coordinates && drone?.coordinates) {
    mapComponent.fitAllMarkers([60, 60], 13);
  } else if (inc?.coordinates) {
    mapComponent.focusIncident(incCoords, 15);
  }

  // Editable search zone — operator can adjust during mission
  let searchAreaModified = false;
  setTimeout(() => {
    mapComponent.makeSearchZoneEditable(() => {
      if (!searchAreaModified) {
        searchAreaModified = true;
        chat.appendSystem('Search area modified by operator.');
      }
    });
  }, 500);

  // Resize map since we started in map view
  requestAnimationFrame(() => mapComponent.resize());

  const shortName = drone?.name?.replace(/^Delta\s+/i, '') || 'Drone';
  chat.appendSara(`${shortName} launched and en route to search area. Use the mic or type to communicate.`);

  // Pre-type first exchange into textarea after a delay
  setTimeout(() => orchestrator.preTypeNext(), 3000);
}

function setupTargetSpottedScreen() {
  // Screen 10: target detected, waiting for user confirmation
  // Chat already has the exchange messages from orchestrator
  chat.appendSara("Potential target identified. Confirm or continue search.", {
    choices: [
      { label: 'Yes, Confirm Target', primary: true, action: () => {
        state.set({ targetStatus: 'confirmed' });
        orchestrator.next(); // Trigger exchange 6
      }},
      { label: 'No, Continue Search', primary: false, action: () => {
        state.set({ targetStatus: 'none' });
        fpv.hideTargetBox();
      }},
    ],
  });
}

function setupOrbitScreen() {
  // Screen 11: confirmed target, orbiting
  // Orchestrator continues driving exchanges 6-7
  setTimeout(() => orchestrator.preTypeNext(), 1500);
}

async function setupReturningScreen() {
  // Screen 12: returning home — show RTB route line
  const dronePos = state.get('dronePosition');
  if (dronePos) {
    const basePos = [32.7210, -117.1498]; // Launch point
    mapComponent.showReturnRoute(dronePos, basePos);
  }

  await wait(2000);
  chat.appendSara("Touchdown confirmed. Motors disarmed.", {
    choices: [
      { label: 'View Mission Summary', primary: true, action: () => state.goToScreen(13) },
    ],
  });
}

async function setupLiveSceneScreen() {
  chat.clear();
  mapComponent.clearOverlays();

  const inc = state.get('selectedIncident');
  const drone = state.get('selectedDrone');

  // Use static aerial image for the FPV feed
  fpv.setStaticImage(`${import.meta.env.BASE_URL}aerial_view_red_car.png`);

  // Show target bounding box on the FPV — highlight the red car (clickable)
  await wait(400);
  fpv.showTargetBox({
    top: '50%', left: '50%', size: '18%',
    status: 'confirmed',
  }, handleTargetAction);

  // Show incident marker on the map
  if (inc) mapComponent.showIncidents([inc], () => {});
  // Show drone orbiting the incident — one clean orbit zone, drone on the perimeter
  if (inc?.coordinates && drone) {
    mapComponent.showLiveOrbitScene(inc.coordinates, drone, 300);
    mapComponent.focusIncident(inc.coordinates, 16);
  }

  const incNumber = inc?.id?.replace(/\D/g, '') || '—';

  // Status header
  chat.appendSaraWithContent(
    `Live feed from ${drone?.name || 'Unknown Drone'} on scene at ${inc?.type || 'Incident'} #${incNumber}.`,
    `<div class="card mb-8">
      <div class="section-label">Scene Status</div>
      <div class="data-grid">
        <span class="data-label">Incident</span><span class="data-value">${inc?.type} #${incNumber}</span>
        <span class="data-label">Location</span><span class="data-value">${inc?.location}</span>
        <span class="data-label">Priority</span><span class="data-value">${inc?.priority || 'P1'}</span>
        <span class="data-label">Drone</span><span class="data-value">${drone?.name} · ${drone?.battery}% battery</span>
        <span class="data-label">On scene</span><span class="data-value">${inc?.elapsed}</span>
        <span class="data-label">Altitude</span><span class="data-value">85m AGL</span>
        <span class="data-label">Target</span><span class="data-value text-green">CONFIRMED · Tracking</span>
      </div>
    </div>`
  );

  // Simulated live dispatch feed
  await wait(1500);
  chat.appendMessage('dispatch', 'DISPATCH', `Unit 7-Adam, be advised suspect vehicle is a red sedan, partial plate 7-X-ray-Foxtrot. Reporting party states vehicle has not moved in 20 minutes.`);

  await wait(2500);
  chat.appendMessage('dispatch', '7-ADAM', `Copy dispatch. We're 3 minutes out. Can the drone hold position?`);

  await wait(2000);
  chat.appendSara(`${drone?.name} is holding position at 85m AGL with clear line of sight. Target vehicle confirmed, tracking. Battery at ${drone?.battery}%, estimated 40 minutes remaining.`);

  await wait(3000);
  chat.appendMessage('dispatch', 'DISPATCH', `All units, update — neighbor reports a male subject exited the red sedan and is walking eastbound on foot. Subject is wearing a dark hoodie.`);

  await wait(4000);
  chat.appendMessage('radio', `${drone?.name?.toUpperCase() || 'DRONE'}`, `Visual on foot traffic near target vehicle. One individual matching description moving east on sidewalk.`);
}

function handleTargetAction(actionId, label) {
  const drone = state.get('selectedDrone');
  const droneName = drone?.name || 'Drone';

  // When the compass menu opens, show action buttons in the chat panel
  if (actionId === 'menu-opened') {
    showTargetActionsPanel();
    return;
  }

  const responses = {
    'reposition': `Repositioning ${droneName} to view from the ${label} side. Adjusting heading and altitude.`,
    'lock-follow': `Lock & Follow engaged. ${droneName} will auto-track the target vehicle if it moves. You'll be notified of any movement.`,
    'orbit': `Initiating 360° orbit around target at current altitude. Full sweep in 45 seconds.`,
    'zoom-in': `Dropping altitude to 40m for closer inspection. Zoom enhanced.`,
    'thermal': `Switching to thermal imaging. Two heat signatures detected inside the vehicle.`,
    'read-plate': `Enhancing plate capture... Plate reads: 7XFR-291, California. Running through NCIC.`,
    'spotlight': `Spotlight activated. Target vehicle illuminated. Be advised, this will alert the subject.`,
    'track-foot': `Switching tracking priority to the suspect on foot. ${droneName} will follow the individual heading eastbound.`,
    'geofence': `Geofence set at 200m radius around target. Alert will trigger if the vehicle crosses the boundary.`,
    'log-evidence': `Evidence logged. Timestamp ${new Date().toLocaleTimeString()}, screenshot captured and saved to incident #${state.get('selectedIncident')?.id?.replace(/\D/g, '') || '—'} report.`,
  };

  const response = responses[actionId] || `Command "${label}" acknowledged.`;
  chat.appendSara(response);
}

function showTargetActionsPanel() {
  // Remove existing panel
  document.getElementById('target-actions-panel')?.remove();

  const actions = [
    { id: 'lock-follow', icon: 'my_location', label: 'Lock & Follow' },
    { id: 'orbit', icon: '360', label: 'Orbit Target' },
    { id: 'zoom-in', icon: 'zoom_in', label: 'Zoom In' },
    { id: 'thermal', icon: 'thermostat', label: 'Thermal View' },
    { id: 'read-plate', icon: 'badge', label: 'Read Plate' },
    { id: 'spotlight', icon: 'flashlight_on', label: 'Spotlight' },
    { id: 'track-foot', icon: 'directions_walk', label: 'Track Suspect' },
    { id: 'geofence', icon: 'fence', label: 'Set Geofence' },
    { id: 'log-evidence', icon: 'photo_camera', label: 'Log Evidence' },
  ];

  const panel = document.createElement('div');
  panel.id = 'target-actions-panel';
  panel.className = 'target-actions-panel';

  for (const a of actions) {
    const btn = document.createElement('button');
    btn.className = 'target-action-item';
    btn.innerHTML = `<span class="material-symbols-outlined">${a.icon}</span><span>${a.label}</span>`;
    btn.addEventListener('click', () => handleTargetAction(a.id, a.label));
    panel.appendChild(btn);
  }

  document.getElementById('target-box-container')?.appendChild(panel);
}

function setupCompleteScreen() {
  // Screen 13: full-width chat with summary
  // Hide map, show content area with summary screen
  const contentEl = document.getElementById('screen-content');
  const chatPanel = document.getElementById('chat-panel');
  const mapContainer = document.getElementById('map-container');

  mapContainer?.classList.add('hidden');
  chatPanel?.classList.add('hidden');
  contentEl?.classList.remove('hidden');
  contentEl.innerHTML = screens.screen13();

  // Re-bind click handler for new-mission button
  // (already handled by delegated click on screen-content)
}

// ── Utility ────────────────────────────────────────────────
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
