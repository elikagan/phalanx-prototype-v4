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
import { INCIDENTS, DRONES, SEARCH_ZONE, WAYPOINTS, PREFLIGHT_CHECKS } from './scenarios/san-diego-pursuit.js';

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

  // Screen routing
  state.on('currentScreen', renderScreen);

  // Initial render
  renderScreen(state.get('currentScreen'));
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

// Screens that show the map
const MAP_SCREENS = new Set([7, 8, 9, 10, 11, 12]);
// Screens that show the chat panel
const CHAT_SCREENS = new Set([7, 8, 9, 10, 11, 12]);
// Screens that show the chat input
const INPUT_SCREENS = new Set([9, 10, 11]);

function renderScreen(screen) {
  const contentEl = document.getElementById('screen-content');
  const renderer = screenRenderers[screen];
  if (!renderer || !contentEl) return;

  // Determine layout
  const showMap = MAP_SCREENS.has(screen);
  const showChat = CHAT_SCREENS.has(screen);
  const showInput = INPUT_SCREENS.has(screen);

  state.set({ showMap, showChat, showInput });

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

  if (showInput) {
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
    // Map screens: content goes into chat
    contentEl.innerHTML = '';
  }

  // Screen-specific setup
  setupScreen(screen);

  // Resize map after layout change
  if (showMap) {
    requestAnimationFrame(() => mapComponent.resize());
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
      state.goToScreen(5); // Skip to drone select for manual
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
          state.goToScreen(7); // Manual: skip briefing, go to search area
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
      // Reset and restart
      state.init();
      renderScreen(1);
      break;

    // Auth form
    case 'authenticate':
      state.set({ authenticated: true, orgName: 'Riverside County SAR' });
      state.goToScreen(2);
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
  }
}

function setupSearchAreaScreen() {
  const path = state.get('missionPath');
  chat.clear();

  if (path === '911') {
    // Pre-configured search zone
    state.set({
      searchZone: SEARCH_ZONE,
      dronePosition: { lat: 32.7210, lng: -117.1498 },
    });

    // Delay map operations until map is sized (was hidden before this screen)
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

  // Animate checks appearing
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
    showInput: true,
    dronePosition: { lat: 32.7210, lng: -117.1498 },
    droneHeading: 180,
    droneAltitude: 120,
    droneSpeed: 35,
  });

  const chatInput = document.getElementById('chat-input');
  chatInput?.classList.remove('hidden');

  chat.appendSara("Mission active. Drone is airborne and heading to search area. I'll monitor dispatch frequencies for updates.");
  chat.appendSara("Use the mic button or type to communicate with me.");
}

// ── Utility ────────────────────────────────────────────────
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
