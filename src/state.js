/**
 * Phalanx State Machine
 *
 * Reactive pub/sub state. Components subscribe to specific keys.
 * State changes trigger only relevant listeners.
 */

const listeners = new Map();
let state = {};

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
}

/** Initialize with default state. */
export function init() {
  state = {
    // Navigation
    currentScreen: 1,
    missionPath: null,        // '911' | 'manual'

    // Mission data
    selectedIncident: null,
    selectedDrone: null,
    targetDescription: null,

    // Drone telemetry
    dronePosition: { lat: 32.7157, lng: -117.1611 },
    droneHeading: 0,
    droneAltitude: 120,
    droneSpeed: 0,
    droneBattery: 98,

    // Target
    targetPosition: null,
    targetStatus: 'none',     // 'none' | 'detected' | 'confirmed' | 'tracking'

    // Search
    searchZone: null,         // { center: [lat, lng], radius, bias }

    // Demo narrative
    narrativeIndex: 0,

    // Chat
    chatHistory: [],

    // UI state
    showMap: false,
    showChat: false,
    showInput: false,
    showFpv: false,
    fpvActive: false,         // true = FPV is main view, false = map is main
    drawerOpen: false,
    isMobile: window.innerWidth < 768,
    radioCount: 0,

    // Auth
    authenticated: false,
    orgName: '',
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

// Replace initial history entry with screen 1 so back button stays in-app
history.replaceState({ screen: 1 }, '', '');

// Browser back/forward button support
window.addEventListener('popstate', (e) => {
  if (e.state?.screen != null) {
    goToScreen(e.state.screen, { pushHistory: false });
  }
});
