/**
 * FPV Component — First Person Video feed
 *
 * Owns: FPV view with aerial.jpg, HUD overlay, scan lines, target bounding box.
 * CSS transforms simulate camera zoom/pan per exchange.
 */

import * as state from '../state.js';

let fpvEl = null;
let targetBoxEl = null;
let currentTransform = { scale: 1, translateX: 0, translateY: 0 };

/** Initialize FPV view inside a container */
export function init(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="fpv-view" id="fpv-view">
      <div class="fpv-image" id="fpv-image"></div>
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

  fpvEl = document.getElementById('fpv-image');

  // Subscribe to telemetry
  state.on('droneAltitude', updateAlt);
  state.on('droneSpeed', updateSpd);
  state.on('droneHeading', updateHdg);
  state.on('dronePosition', updateCoords);

  // Update clock
  updateHudTime();
  setInterval(updateHudTime, 1000);
}

/** Set CSS transform on the aerial image (zoom/pan) */
export function setTransform({ scale, translateX, translateY }) {
  currentTransform = { scale, translateX, translateY };
  if (fpvEl) {
    fpvEl.style.transform = `scale(${scale}) translate(${translateX}%, ${translateY}%)`;
  }
}

/** Show/update target bounding box on FPV */
export function showTargetBox({ top, left, width, height, status }) {
  const container = document.getElementById('target-box-container');
  if (!container) return;

  // Remove existing
  container.innerHTML = '';

  const box = document.createElement('div');
  box.className = `target-box ${status === 'confirmed' ? 'confirmed' : ''}`;
  box.style.cssText = `top:${top};left:${left};width:${width};height:${height}`;

  const label = document.createElement('div');
  label.className = `target-box-label ${status === 'confirmed' ? 'confirmed' : 'potential'}`;
  label.textContent = status === 'confirmed' ? 'TARGET CONFIRMED' : 'POTENTIAL TARGET';
  box.appendChild(label);

  container.appendChild(box);
  targetBoxEl = box;
}

/** Hide target bounding box */
export function hideTargetBox() {
  const container = document.getElementById('target-box-container');
  if (container) container.innerHTML = '';
  targetBoxEl = null;
}

/** Reset FPV to default state */
export function reset() {
  setTransform({ scale: 1, translateX: 0, translateY: 0 });
  hideTargetBox();
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
