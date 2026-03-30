/**
 * Topbar Component
 *
 * Status text, pills (drone/target/boundary), radio badge, clock.
 * Subscribes to: currentScreen, selectedDrone, targetStatus, radioCount
 */

import * as state from '../state.js';

let clockInterval = null;

export function init() {
  updateClock();
  clockInterval = setInterval(updateClock, 1000);

  state.on('currentScreen', updateStatus);
  state.on('selectedDrone', updatePills);
  state.on('targetStatus', updatePills);
  state.on('radioCount', updateRadioBadge);
  state.on('currentScreen', updateRadioVisibility);
}

function updateClock() {
  const el = document.getElementById('topbar-clock');
  if (!el) return;
  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  el.textContent = `${h12}:${m} ${ampm}`;
}

function updateStatus(screen) {
  const el = document.getElementById('topbar-status');
  if (!el) return;

  const labels = {
    1: 'Authentication',
    2: 'Mission Type',
    3: 'Incidents',
    4: 'Analysis',
    5: 'Drone Selection',
    6: 'Mission Briefing',
    7: 'Search Area',
    8: 'Pre-Flight',
    9: 'Mission Active',
    10: 'Target Spotted',
    11: 'Orbiting Target',
    12: 'Returning Home',
    13: 'Mission Complete',
    14: 'Live Scene',
  };

  el.textContent = labels[screen] || '';
}

function updatePills() {
  const el = document.getElementById('topbar-pills');
  if (!el) return;

  const drone = state.get('selectedDrone');
  const target = state.get('targetStatus');
  const pills = [];

  if (drone) {
    pills.push(`<span class="pill"><span class="material-symbols-outlined">flight</span>${drone.name}</span>`);
  }

  if (target && target !== 'none') {
    const label = target === 'confirmed' || target === 'tracking' ? 'TARGET LOCKED' : 'TARGET DETECTED';
    const pillClass = target === 'confirmed' || target === 'tracking' ? 'pill-green' : 'pill-red';
    pills.push(`<span class="pill ${pillClass}">${label}</span>`);
  }

  el.innerHTML = pills.join('');
}

function updateRadioBadge(count) {
  const badge = document.getElementById('radio-badge');
  if (!badge) return;

  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function updateRadioVisibility(screen) {
  const btn = document.getElementById('topbar-radio');
  if (!btn) return;

  // Show radio button on mission screens (7+)
  if (screen >= 7) {
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}
