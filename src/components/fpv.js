/**
 * FPV Component — First Person Video feed
 *
 * Uses a second Leaflet map at high zoom to simulate drone camera.
 * HUD overlay, scan lines, target bounding box on top.
 */

import L from 'leaflet';
import * as state from '../state.js';

let fpvMap = null;
let targetBoxEl = null;
let staticMode = false;
let onTargetAction = null; // callback for target menu actions

/** Initialize FPV view inside a container */
export function init(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="fpv-view" id="fpv-view">
      <div class="fpv-map" id="fpv-map"></div>
      <div class="fpv-scanlines"></div>
      <div class="hud-overlay">
        <div class="hud-corner tl"></div>
        <div class="hud-corner tr"></div>
        <div class="hud-corner bl"></div>
        <div class="hud-corner br"></div>
        <div class="hud-crosshair"></div>
        <div class="hud-rec"><span class="hud-rec-dot"></span>REC</div>
        <div class="hud-text top-right" id="hud-telemetry">
          ALT <span id="hud-alt">120</span>m<br>
          SPD <span id="hud-spd">35</span> km/h<br>
          HDG <span id="hud-hdg">180</span>°
        </div>
        <div class="hud-text bottom-left" id="hud-coords">
          32.7210°N 117.1498°W
        </div>
        <div class="hud-text bottom-right" id="hud-time"></div>
      </div>
      <div class="target-box-container" id="target-box-container"></div>
    </div>
  `;

  // Create Leaflet map for FPV at high zoom
  const fpvEl = document.getElementById('fpv-map');
  if (fpvEl) {
    const pos = state.get('dronePosition') || { lat: 32.7210, lng: -117.1498 };
    fpvMap = L.map(fpvEl, {
      center: [pos.lat, pos.lng],
      zoom: 19,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      keyboard: false,
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      maxNativeZoom: 19,
    }).addTo(fpvMap);
  }

  // Subscribe to telemetry
  state.on('droneAltitude', updateAlt);
  state.on('droneSpeed', updateSpd);
  state.on('droneHeading', updateHdg);
  state.on('dronePosition', onDroneMove);

  // Update clock
  updateHudTime();
  setInterval(updateHudTime, 1000);
}

/** Move the FPV map to follow the drone */
function onDroneMove(pos) {
  if (!fpvMap || !pos) return;
  fpvMap.setView([pos.lat, pos.lng], fpvMap.getZoom(), { animate: true, duration: 1 });
  updateCoords(pos);
}

/** Set FPV zoom level (simulates altitude change) */
export function setTransform({ scale }) {
  if (!fpvMap) return;
  // Map scale to zoom: scale 1 = zoom 19, scale 1.5 = zoom 20, scale 0.7 = zoom 18
  const zoom = Math.round(17 + (scale * 2));
  fpvMap.setZoom(Math.min(20, Math.max(16, zoom)), { animate: true });
}

/** Show/update target circle on FPV */
export function showTargetBox({ top, left, size, status }, actionCallback) {
  const container = document.getElementById('target-box-container');
  if (!container) return;

  container.innerHTML = '';
  onTargetAction = actionCallback || null;

  const circle = document.createElement('div');
  circle.className = `target-circle ${status === 'confirmed' ? 'confirmed' : ''}`;
  circle.style.cssText = `top:${top};left:${left};width:${size};cursor:pointer;pointer-events:auto`;

  const label = document.createElement('div');
  label.className = `target-box-label ${status === 'confirmed' ? 'confirmed' : 'potential'}`;
  label.textContent = status === 'confirmed' ? 'TARGET CONFIRMED' : 'POTENTIAL TARGET';
  circle.appendChild(label);

  circle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTargetMenu(circle);
  });

  container.appendChild(circle);
  targetBoxEl = circle;

  // Click anywhere on the FPV view to close menu
  document.getElementById('fpv-view')?.addEventListener('click', (e) => {
    if (!e.target.closest('.target-circle') && !e.target.closest('.compass-point')) {
      closeTargetMenu();
    }
  });
}

/** Toggle the radial compass menu around the target circle */
function toggleTargetMenu(circle) {
  // Remove existing compass points
  const existing = circle.parentElement.querySelectorAll('.compass-point');
  if (existing.length > 0) {
    closeTargetMenu();
    return;
  }

  const directions = [
    { label: 'N', angle: 0 },
    { label: 'NE', angle: 45 },
    { label: 'E', angle: 90 },
    { label: 'SE', angle: 135 },
    { label: 'S', angle: 180 },
    { label: 'SW', angle: 225 },
    { label: 'W', angle: 270 },
    { label: 'NW', angle: 315 },
  ];

  // Get circle center in container coordinates
  const circleRect = circle.getBoundingClientRect();
  const containerRect = circle.parentElement.getBoundingClientRect();
  const cx = circleRect.left - containerRect.left + circleRect.width / 2;
  const cy = circleRect.top - containerRect.top + circleRect.height / 2;
  const arrowRadius = circleRect.width / 2 + 24; // just outside the circle

  // Hide the label while compass arrows are showing
  const label = circle.querySelector('.target-box-label');
  if (label) label.style.display = 'none';

  for (const dir of directions) {
    const btn = document.createElement('button');
    btn.className = 'compass-point';
    btn.title = `View from ${dir.label}`;
    btn.innerHTML = `<span class="material-symbols-outlined icon-sm" style="transform:rotate(${dir.angle}deg)">arrow_upward</span>`;
    const rad = (dir.angle - 90) * Math.PI / 180;
    btn.style.left = `${cx + Math.cos(rad) * arrowRadius}px`;
    btn.style.top = `${cy + Math.sin(rad) * arrowRadius}px`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onTargetAction) onTargetAction('reposition', dir.label);
      closeTargetMenu();
    });
    circle.parentElement.appendChild(btn);
  }

  // Show action buttons in the chat panel (not on the FPV)
  if (onTargetAction) onTargetAction('menu-opened', null);
}

/** Close the compass arrows and action panel */
function closeTargetMenu() {
  const container = document.getElementById('target-box-container');
  if (container) {
    container.querySelectorAll('.compass-point').forEach(el => el.remove());
    document.getElementById('target-actions-panel')?.remove();
  }
  // Restore the label
  const label = targetBoxEl?.querySelector('.target-box-label');
  if (label) label.style.display = '';
}

/** Hide target bounding box */
export function hideTargetBox() {
  closeTargetMenu();
  const container = document.getElementById('target-box-container');
  if (container) container.innerHTML = '';
  targetBoxEl = null;
}

/** Switch FPV to a static image instead of satellite tiles */
export function setStaticImage(imageSrc) {
  const fpvEl = document.getElementById('fpv-map');
  if (!fpvEl) return;
  staticMode = true;
  // Hide the Leaflet map, show a static image background
  fpvEl.style.background = `url('${imageSrc}') center/cover no-repeat`;
  // Hide all Leaflet panes so they don't cover the background image
  const panes = fpvEl.querySelectorAll('.leaflet-pane');
  panes.forEach(p => p.style.display = 'none');
}

/** Clear static image and restore satellite tiles */
function clearStaticImage() {
  const fpvEl = document.getElementById('fpv-map');
  if (!fpvEl || !staticMode) return;
  staticMode = false;
  fpvEl.style.background = '';
  // Restore Leaflet panes
  const panes = fpvEl.querySelectorAll('.leaflet-pane');
  panes.forEach(p => p.style.display = '');
  // Re-add the tile layer
  if (fpvMap) {
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      maxNativeZoom: 19,
    }).addTo(fpvMap);
  }
}

/** Reset FPV to default state */
export function reset() {
  clearStaticImage();
  if (fpvMap) fpvMap.setZoom(19, { animate: false });
  hideTargetBox();
}

/** Invalidate FPV map size (call after layout changes) */
export function resize() {
  if (fpvMap) {
    requestAnimationFrame(() => fpvMap.invalidateSize());
  }
}

function updateAlt(val) {
  const el = document.getElementById('hud-alt');
  if (el) el.textContent = val;
}

function updateSpd(val) {
  const el = document.getElementById('hud-spd');
  if (el) el.textContent = val;
}

function updateHdg(val) {
  const el = document.getElementById('hud-hdg');
  if (el) el.textContent = val;
}

function updateCoords(pos) {
  const el = document.getElementById('hud-coords');
  if (el) el.textContent = `${pos.lat.toFixed(4)}°N ${Math.abs(pos.lng).toFixed(4)}°W`;
}

function updateHudTime() {
  const el = document.getElementById('hud-time');
  if (!el) return;
  const now = new Date();
  const h = now.getHours() % 12 || 12;
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  el.textContent = `${h}:${m}:${s}`;
}
