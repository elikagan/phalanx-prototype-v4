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
import { INCIDENTS, DRONES, SEARCH_ZONE, WAYPOINTS, PREFLIGHT_CHECKS, MISSION_SUMMARY } from './scenarios/san-diego-pursuit.js';

// ── Password Gate ──────────────────────────────────────────
const PASSWORD = 'phalanx';

document.getElementById('gate-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('gate-input');
  const error = document.getElementById('gate-error');
  if (input.value === PASSWORD) {
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
  topbar.init();
  mapComponent.init();

  // Responsive detection
  window.addEventListener('resize', () => {
    state.set({ isMobile: window.innerWidth < 768 });
    mapComponent.resize();
  });

  // Single delegated click handler on screen-content (set up once)
  document.getElementById('screen-content')?.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]');
    if (!action) return;
    handleAction(action.dataset.action, action.dataset);
  });

  // Single delegated submit handler on screen-content (for forms)
  document.getElementById('screen-content')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    if (form.id === 'auth-form') {
      const token = form.querySelector('#auth-token')?.value;
      if (token === 'pk_org_9f2a1b8c') {
        state.set({ authenticated: true, orgName: 'Riverside County SAR' });
        state.goToScreen(2);
      }
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

  // Send button triggers next orchestrated exchange
  sendBtn?.addEventListener('click', () => {
    if (orchestrator.isActive()) return;
    textarea.value = '';
    orchestrator.next();
  });

  // Enter key (without shift) also sends
  textarea?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (orchestrator.isActive()) return;
      textarea.value = '';
      orchestrator.next();
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
};

// Screens that show the map or FPV
const MAP_SCREENS = new Set([7, 8, 9, 10, 11, 12]);
// Screens that show the chat panel
const CHAT_SCREENS = new Set([7, 8, 9, 10, 11, 12]);
// Screens that show the chat input
const INPUT_SCREENS = new Set([9, 10, 11]);
// Screens that show FPV as default view
const FPV_SCREENS = new Set([9, 10, 11]);

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

  // Render screen content (for non-map screens)
  if (!showMap) {
    contentEl.classList.remove('hidden');
    const path = state.get('missionPath');
    contentEl.innerHTML = renderer(path);
  } else {
    contentEl.innerHTML = '';
  }

  // FPV layer
  manageFpvLayer(showFpv);

  // Telemetry bar
  manageTelemetryBar(showMap && (screen >= 9));

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
      fpvLayer.style.cssText = 'position:absolute;inset:0;z-index:5';
      mapContainer?.appendChild(fpvLayer);
      fpv.init(fpvLayer);
    }
    fpvLayer.style.display = 'block';
  } else if (fpvLayer) {
    fpvLayer.style.display = 'none';
  }

  // Manage view toggle button
  manageViewToggle(show);
}

/** Show/hide view toggle thumbnail (FPV ↔ Map) */
function manageViewToggle(fpvActive) {
  const mapContainer = document.getElementById('map-container');
  let toggle = document.getElementById('view-toggle');

  if (!mapContainer) return;

  if (!toggle) {
    toggle = document.createElement('button');
    toggle.id = 'view-toggle';
    toggle.className = 'view-toggle';
    toggle.innerHTML = '<span class="view-toggle-label">MAP</span>';
    // Append last so it's on top in the stacking order
    mapContainer.appendChild(toggle);

    toggle.addEventListener('click', () => {
      const fpvLayer = document.getElementById('fpv-layer');
      if (!fpvLayer) return;
      const isShowingFpv = fpvLayer.style.display !== 'none';

      if (isShowingFpv) {
        fpvLayer.style.display = 'none';
        toggle.innerHTML = '<span class="view-toggle-label">CAM</span>';
      } else {
        fpvLayer.style.display = 'block';
        toggle.innerHTML = '<span class="view-toggle-label">MAP</span>';
      }
      // Invalidate map when switching to map view
      mapComponent.resize();
    });
  } else {
    // Re-append to ensure it's on top of any newly created layers
    mapContainer.appendChild(toggle);
  }

  // Show toggle only when FPV is available
  toggle.style.display = fpvActive ? 'flex' : 'none';
  toggle.innerHTML = `<span class="view-toggle-label">MAP</span>`;
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
      if (incident) {
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
        if (state.get('missionPath') === '911') {
          state.goToScreen(6);
        } else {
          state.goToScreen(7);
        }
      }
      break;
    }

    case 'confirm-mission':
      state.goToScreen(7);
      break;

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
  }
}

function setupSearchAreaScreen() {
  const path = state.get('missionPath');
  chat.clear();

  if (path === '911') {
    state.set({
      searchZone: SEARCH_ZONE,
      dronePosition: { lat: 32.7210, lng: -117.1498 },
    });

    requestAnimationFrame(() => {
      mapComponent.resize();
      requestAnimationFrame(() => {
        mapComponent.addWaypoint('lastKnown', WAYPOINTS.lastKnown.coordinates, WAYPOINTS.lastKnown.label);
        mapComponent.flyTo(SEARCH_ZONE.center[0], SEARCH_ZONE.center[1], 15, 1.5);
      });
    });

    chat.appendSara(
      "Based on dispatch data, I've configured the search area. The suspect was last seen heading southbound at ~45 mph. Search zone is biased south from Madison & Oak.",
      {
        choices: [
          { label: 'Confirm Search Area', primary: true, action: () => state.goToScreen(8) },
        ],
      }
    );
  } else {
    chat.appendSara(
      "Set your search area on the map. Drag to position, pinch to resize.",
      {
        choices: [
          { label: 'Done', primary: true, action: () => state.goToScreen(8) },
        ],
      }
    );
  }
}

async function setupPreflightScreen() {
  chat.appendSara("Running pre-flight checks...");

  await wait(500);
  for (const check of PREFLIGHT_CHECKS) {
    chat.appendSara(`${check.label}: ${check.value} ✓`);
    await wait(300);
  }

  await wait(400);
  chat.appendSara("All systems go. Drone is ready for takeoff.", {
    choices: [
      { label: 'Launch Mission', primary: true, action: () => state.goToScreen(9) },
    ],
  });
}

function setupMissionScreen() {
  state.set({
    dronePosition: { lat: 32.7210, lng: -117.1498 },
    droneHeading: 180,
    droneAltitude: 120,
    droneSpeed: 35,
  });

  chat.appendSara("Mission active. Drone is airborne and heading to search area. I'll monitor dispatch frequencies for updates.");
  chat.appendSara("Use the mic button or type to communicate. I'll pre-type suggested commands.");

  // Pre-type first exchange into textarea after a delay
  setTimeout(() => orchestrator.preTypeNext(), 2000);
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
  // Screen 12: returning home
  await wait(2000);
  chat.appendSara("Touchdown confirmed. Motors disarmed.", {
    choices: [
      { label: 'View Mission Summary', primary: true, action: () => state.goToScreen(13) },
    ],
  });
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
