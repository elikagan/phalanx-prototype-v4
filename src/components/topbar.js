/**
 * Topbar Component
 *
 * Status text, pills (drone/target/boundary), incident/drone badges.
 * Subscribes to: currentScreen, selectedDrone, targetStatus
 */

import * as state from '../state.js';

export function init() {
  state.on('currentScreen', updateStatus);
  state.on('selectedDrone', updateDroneBadge);
  state.on('currentScreen', updateDroneBadge);
  state.on('targetStatus', updatePills);
  state.on('selectedIncident', updateIncidentBadge);
}

function updateStatus(screen) {
  const el = document.getElementById('topbar-status');
  if (!el) return;

  const labels = {
    1: 'Authentication',
    2: 'Mission Type',
    3: 'Incidents',
    4: '',
    5: 'Drone Selection',
    6: 'Mission Briefing',
    7: '',
    8: 'Pre-Flight',
    9: 'Mission Active',
    10: 'Target Spotted',
    11: 'Orbiting Target',
    12: 'Returning Home',
    13: 'Mission Complete',
    14: 'Live Scene',
  };

  // Show/hide incident badge based on screen
  updateIncidentBadge(state.get('selectedIncident'));

  // Hide status label when incident badge is visible — badge provides all context
  const badge = document.getElementById('topbar-incident-badge');
  const text = badge ? '' : (labels[screen] || '');
  el.textContent = text;
  el.style.display = text ? '' : 'none';

  // Show divider if status text OR incident badge is visible
  const divider = document.querySelector('.topbar-divider');
  if (divider) divider.style.display = (text || badge) ? '' : 'none';
}

function updateIncidentBadge(inc) {
  let badge = document.getElementById('topbar-incident-badge');
  const screen = state.get('currentScreen');

  // Only show on screens 4+ when an incident is selected
  if (!inc || !screen || screen < 4) {
    if (badge) badge.remove();
    return;
  }

  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'topbar-incident-badge';
    const leftSection = document.querySelector('.topbar-left');
    if (leftSection) leftSection.appendChild(badge);
  }

  const incNumber = inc.id.replace(/\D/g, '');
  const priorityColor = inc.priority === 1 ? 'var(--red)' : 'var(--amber)';
  badge.className = 'topbar-incident-badge';
  badge.innerHTML = `<span class="incident-priority" style="color:${priorityColor}">I${inc.priority}</span><span class="incident-type">${inc.type} #${incNumber}</span>`;
}

function updateDroneBadge() {
  let badge = document.getElementById('topbar-drone-badge');
  const drone = state.get('selectedDrone');
  const screen = state.get('currentScreen');

  // Show drone badge on screens 5+ (after drone selected) alongside incident badge
  if (!drone || !screen || screen < 5) {
    if (badge) badge.remove();
    return;
  }

  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'topbar-drone-badge';
    badge.className = 'topbar-drone-badge';
    // Insert right after incident badge in topbar-left
    const incBadge = document.getElementById('topbar-incident-badge');
    const leftSection = document.querySelector('.topbar-left');
    if (incBadge && incBadge.nextSibling) {
      leftSection.insertBefore(badge, incBadge.nextSibling);
    } else if (leftSection) {
      leftSection.appendChild(badge);
    }
  }

  badge.innerHTML = `<svg class="topbar-drone-icon" viewBox="0 0 24 24" width="12" height="12"><path d="M12 4 L3 18 L6 16.5 L12 15 L18 16.5 L21 18 Z" fill="currentColor" stroke="none"/></svg><span class="drone-name">${drone.name}</span>`;
}

function updatePills() {
  const el = document.getElementById('topbar-pills');
  if (!el) return;

  const target = state.get('targetStatus');
  const pills = [];

  if (target && target !== 'none') {
    const label = target === 'confirmed' || target === 'tracking' ? 'TARGET LOCKED' : 'TARGET DETECTED';
    const pillClass = target === 'confirmed' || target === 'tracking' ? 'pill-green' : 'pill-red';
    pills.push(`<span class="pill ${pillClass}">${label}</span>`);
  }

  el.innerHTML = pills.join('');
}
