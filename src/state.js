/**
 * Phalanx State Machine
 *
 * Reactive pub/sub state. Components subscribe to specific keys.
 * State changes trigger only relevant listeners.
 */

const listeners = new Map();
let state = {};

// Keys to persist across page reloads
const PERSIST_KEYS = ['currentScreen', 'missionPath', 'selectedIncident', 'selectedDrone', 'searchZone', 'authenticated', 'orgName'];
const STORAGE_KEY = 'phalanx-state';

function _saveState() {
  try {
    const snapshot = {};
    for (const k of PERSIST_KEYS) {
      if (state[k] !== undefined && state[k] !== null) snapshot[k] = state[k];
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (_) { /* quota or private mode */ }
}

function _loadState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

/** Subscribe to a state key. Returns unsubscribe function. */
export function on(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key).delete(fn);
}

/** Get current value of a state key. */
export function get(key) {
  return key ? state[key] : { ...state };
}

/** Set one or more state keys. Fires listeners for changed keys. */
export function set(updates) {
  const changed = [];
  for (const [key, value] of Object.entries(updates)) {
    if (state[key] !== value) {
      state[key] = value;
      changed.push(key);
    }
  }
  // Fire listeners after all keys are updated (consistent reads)
  for (const key of changed) {
    if (listeners.has(key)) {
      for (const fn of listeners.get(key)) {
        fn(state[key], key);
      }
    }
  }
  // Persist to sessionStorage
  if (changed.some(k => PERSIST_KEYS.includes(k))) _saveState();
}

/** Initialize with default state, restoring persisted state from sessionStorage. */
export function init() {
  const saved = _loadState();

  state = {
    // Navigation
    currentScreen: saved?.currentScreen || 1,
    missionPath: saved?.missionPath || null,

    // Mission data
    selectedIncident: saved?.selectedIncident || null,
    selectedDrone: saved?.selectedDrone || null,
    targetDescription: null,

    // Drone telemetry
    dronePosition: { lat: 32.7157, lng: -117.1611 },
    droneHeading: 0,
    droneAltitude: 120,
    droneSpeed: 0,
    droneBattery: 98,

    // Target
    targetPosition: null,
    targetStatus: 'none',

    // Search
    searchZone: saved?.searchZone || null,

    // Demo narrative
    narrativeIndex: 0,

    // Chat
    chatHistory: [],

    // UI state
    showMap: false,
    showChat: false,
    showInput: false,
    showFpv: false,
    fpvActive: false,
    drawerOpen: false,
    isMobile: window.innerWidth < 768,
    radioCount: 0,

    // Auth
    authenticated: saved?.authenticated || false,
    orgName: saved?.orgName || '',
  };

  // Notify all listeners of initial state
  for (const [key, fns] of listeners) {
    if (state[key] !== undefined) {
      for (const fn of fns) fn(state[key], key);
    }
  }
}

/** Transition to a screen. Central routing point. */
export function goToScreen(screen, { pushHistory = true } = {}) {
  const prev = state.currentScreen;
  set({ currentScreen: screen });
  if (pushHistory && prev !== screen) {
    history.pushState({ screen }, '', '');
  }
}

// Replace initial history entry with current screen so back button stays in-app
history.replaceState({ screen: _loadState()?.currentScreen || 1 }, '', '');

// Browser back/forward button support
window.addEventListener('popstate', (e) => {
  if (e.state?.screen != null) {
    goToScreen(e.state.screen, { pushHistory: false });
  }
});
