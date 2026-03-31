/**
 * Topbar Component
 *
 * Breadcrumb navigation: All Incidents › Incident › Drone
 * Plus target status pills and view toggle.
 */

import * as state from '../state.js';

// Screens where the breadcrumb should show
const BREADCRUMB_SCREENS = new Set([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);

export function init() {
  state.on('currentScreen', renderBreadcrumb);
  state.on('selectedIncident', renderBreadcrumb);
  state.on('selectedDrone', renderBreadcrumb);
  state.on('targetStatus', updatePills);

  // Initial render — state may already be set before listeners registered
  renderBreadcrumb();
}

function renderBreadcrumb() {
  const el = document.getElementById('topbar-breadcrumb');
  if (!el) return;

  const screen = Number(state.get('currentScreen'));
  const inc = state.get('selectedIncident');
  const drone = state.get('selectedDrone');
  const divider = document.querySelector('.topbar-divider');

  // No breadcrumb for auth/setup screens
  if (!BREADCRUMB_SCREENS.has(screen)) {
    el.innerHTML = '';
    if (divider) divider.style.display = 'none';
    return;
  }

  if (divider) divider.style.display = '';

  const crumbs = [];

  // Level 1: All Incidents (always present on breadcrumb screens)
  if (screen === 3) {
    // Current level — not clickable
    crumbs.push('<span class="breadcrumb-pill breadcrumb-current"><span class="incident-type">All Incidents</span></span>');
  } else {
    // Clickable — navigate back to fleet overview
    crumbs.push('<span class="breadcrumb-pill breadcrumb-link" data-nav="incidents"><span class="incident-type">All Incidents</span></span>');
  }

  // Level 2: Selected incident (screens 4+), combined with drone if present
  if (inc && screen >= 4) {
    const incNumber = inc.id.replace(/\D/g, '');
    const priorityColor = inc.priority === 1 ? 'var(--red)' : 'var(--amber)';
    const incHTML = `<span class="incident-priority" style="color:${priorityColor}">I${inc.priority}</span><span class="incident-type">${inc.type} #${incNumber}</span>`;

    if (drone && screen >= 5) {
      // Combined incident + drone pill — incident portion clickable back to screen 4
      crumbs.push(`<span class="breadcrumb-pill breadcrumb-current"><span class="breadcrumb-link-inner" data-nav="incident">${incHTML}</span><span class="breadcrumb-pill-sep">·</span><svg class="topbar-drone-icon" viewBox="0 0 24 24" width="12" height="12"><path d="M12 4 L3 18 L6 16.5 L12 15 L18 16.5 L21 18 Z" fill="currentColor" stroke="none"/></svg><span class="drone-name">${drone.name}</span></span>`);
    } else {
      // Current level — incident only
      crumbs.push(`<span class="breadcrumb-pill breadcrumb-current">${incHTML}</span>`);
    }
  }

  // Join with chevron separators
  el.innerHTML = crumbs.join('<span class="breadcrumb-sep">›</span>');

  // Attach click handlers to nav links (both pill-level and inner links)
  el.querySelectorAll('[data-nav]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = e.currentTarget.dataset.nav;
      if (target === 'incidents') {
        state.goToScreen(3);
      } else if (target === 'incident') {
        state.goToScreen(4);
      }
    });
  });
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
