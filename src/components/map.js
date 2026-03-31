/**
 * Map Component — Leaflet satellite map
 *
 * MAP OVERLAY DESIGN SYSTEM (see DESIGN.md "Map Overlays" for full docs)
 *
 * LOUD:       Incident pin — amber/red dot, white icon, 40px
 * MEDIUM:     Route lines — white dotted (proposed) or #407CF5 solid (active)
 * MEDIUM:     Target marker — red/green 24px dot with pulse
 * QUIET:      Labels — dark pill bg rgba(0,0,0,0.45), light text, 10px
 * BACKGROUND: Search zones — amber fill, no stroke
 * BACKGROUND: Orbit zones — white dashed circle, blue fill 0.15
 *
 * ONE drone marker look: fleet-drone-dot (colored circle + white SVG)
 * ONE shadow style: 1px offset via .route-shadow CSS class
 * ONE label base: .route-label / .fleet-drone-label (same visual)
 */

import L from 'leaflet';
import 'leaflet-ellipse';
import 'leaflet.markercluster';
import * as state from '../state.js';
import { MAP_CENTER, MAP_ZOOM } from '../scenarios/san-diego-pursuit.js';

// ── Map Overlay Palette ────────────────────────────────────
// Sourced from Mapbox Navigation (night), QGroundControl, MIL-STD-2525
// Dark labels on satellite = industry standard for aviation/tactical maps
// See DESIGN.md "Map Color Palette" for documentation
const MC = {
  // Route — Mapbox Navigation night guidance
  routeBlue: '#407CF5',
  routeCasing: '#1B43B4',
  altRoute: '#5f8fad',        // matches --accent, for RTB/secondary routes

  // Incident — matches DESIGN.md status colors
  incidentRed: '#b85454',     // matches --red
  incidentAmber: '#D4A017',

  // Status — matches DESIGN.md
  green: '#4a9a65',           // matches --green
  amber: '#a89540',           // matches --amber

  // Search zone
  zoneFill: '#D4A017',        // amber, same as incident
};

let map = null;
let droneMarker = null;
let searchCircle = null;
let searchLabel = null;
let targetMarker = null;
let targetLabel = null;
let orbitCircle = null;
let flightTrail = null;
let flightTrailOutline = null;
let trailCoords = [];
const waypointMarkers = new Map();

// Overlay marker layers (incidents, fleet drones)
let incidentMarkers = [];
const incidentMarkerMap = new Map(); // id → { marker, tooltipEl }
let fleetMarkers = [];
let distanceLines = [];

// Cluster groups — markers aggregate at low zoom like a real map app
let incidentCluster = null;
let droneCluster = null;

// Patrol animation state
let patrolAnimations = [];

// Fleet drone SVG — white flying wing on colored circle
// This is the ONE drone look used everywhere (see DESIGN.md "Drone Marker")
const FLEET_DRONE_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 4 L3 18 L6 16.5 L12 15 L18 16.5 L21 18 Z" fill="#fff" stroke="none"/>
</svg>`;

export function init() {
  const el = document.getElementById('map');
  if (!el || map) return;

  map = L.map(el, {
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    zoomControl: false,
    attributionControl: false,
    minZoom: 10,
    maxZoom: 19,
    maxBounds: L.latLngBounds([32.4, -117.6], [33.3, -116.8]),
    maxBoundsViscosity: 1.0,
  });

  // Cluster groups — incidents and drones aggregate at low zoom
  incidentCluster = L.markerClusterGroup({
    maxClusterRadius: 50,
    disableClusteringAtZoom: 10,
    showCoverageOnHover: false,
    animate: true,
    iconCreateFunction: (cluster) => L.divIcon({
      html: `<div class="cluster-icon cluster-incident">${cluster.getChildCount()}</div>`,
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    }),
  });
  incidentCluster.addTo(map);

  droneCluster = L.markerClusterGroup({
    maxClusterRadius: 40,
    disableClusteringAtZoom: 10,
    showCoverageOnHover: false,
    animate: true,
    iconCreateFunction: (cluster) => L.divIcon({
      html: `<div class="cluster-icon cluster-drone">${cluster.getChildCount()}</div>`,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    }),
  });
  droneCluster.addTo(map);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
  }).addTo(map);

  if (window.innerWidth >= 768) {
    L.control.zoom({ position: 'bottomright' }).addTo(map);
  }

  // Flight trail — casing underneath (Mapbox style)
  flightTrailOutline = L.polyline([], {
    color: MC.routeCasing,
    weight: 7,
    opacity: 0.8,
    lineCap: 'round',
  }).addTo(map);
  // Flight trail — route on top
  flightTrail = L.polyline([], {
    color: MC.routeBlue,
    weight: 4,
    opacity: 1.0,
    lineCap: 'round',
  }).addTo(map);

  // Subscribe to state
  state.on('showMap', onShowMap);
  state.on('dronePosition', onDroneMove);
  state.on('droneHeading', onDroneHeading);
  state.on('searchZone', onSearchZone);
  state.on('targetPosition', onTargetPosition);
  state.on('targetStatus', onTargetStatus);
}

function onShowMap(show) {
  const container = document.getElementById('map-container');
  if (show) {
    container.classList.remove('hidden');
    requestAnimationFrame(() => map?.invalidateSize());
  } else {
    container.classList.add('hidden');
  }
}

function onDroneMove(pos) {
  if (!map) return;
  const latlng = [pos.lat, pos.lng];

  if (!droneMarker) {
    const heading = state.get('droneHeading') || 0;
    droneMarker = L.marker(latlng, {
      icon: L.divIcon({
        className: 'fleet-drone-marker',
        html: `<div class="fleet-drone-dot" style="--dot-color:#407CF5">
          <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(${Math.round(heading)}deg)">
            <path d="M12 4 L3 18 L6 16.5 L12 15 L18 16.5 L21 18 Z" fill="#fff" stroke="none"/>
          </svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
      zIndexOffset: 1000,
    }).addTo(map);
  } else {
    droneMarker.setLatLng(latlng);
  }

  trailCoords.push(latlng);
  if (flightTrailOutline) flightTrailOutline.setLatLngs(trailCoords);
  flightTrail.setLatLngs(trailCoords);
}

/** Hide the state-driven drone marker (use when showing fleet drone marker instead) */
export function hideDroneMarker() {
  if (droneMarker && map) {
    map.removeLayer(droneMarker);
    droneMarker = null;
  }
}

function onDroneHeading(heading) {
  if (!droneMarker) return;
  const el = droneMarker.getElement();
  if (!el) return;
  // Rotate the SVG inside the fleet-drone-dot, not the whole marker
  const svg = el.querySelector('svg');
  if (svg) {
    svg.style.transform = `rotate(${Math.round(heading)}deg)`;
  }
}

function onSearchZone(zone) {
  if (!map) return;

  if (searchCircle) { map.removeLayer(searchCircle); searchCircle = null; }
  if (searchLabel) { map.removeLayer(searchLabel); searchLabel = null; }

  if (!zone) return;

  // Normalize: { center, radiusX, radiusY, rotation } or legacy { center, radius }
  const rx = zone.radiusX || zone.radius || 500;
  const ry = zone.radiusY || zone.radius || 500;
  const tilt = zone.rotation || 0;

  searchCircle = L.ellipse(zone.center, [rx, ry], tilt, {
    color: '#D4A017',
    weight: 2,
    fillColor: '#D4A017',
    fillOpacity: 0.18,
    className: 'search-zone-shape',
  }).addTo(map);
}

// ── Editable Search Zone ──────────────────────────────────────────
//
// ALL select/dismiss/drag uses event delegation on the SVG overlay pane
// or native DOM events. ZERO reliance on Leaflet's event system for the
// ellipse path (Leaflet's hit detection breaks when geometry changes).
//
// UNSELECTED: amber stroke, pointer cursor, no handles
// SELECTED:   white fat stroke, grab cursor, handles visible, drag fill to move

let editHandles = [];
let _onChange = null;
let _selected = false;
let _editState = null;
let _editCleanup = null; // single cleanup function for all listeners

function _isZonePath(target) {
  return target?.classList?.contains('search-zone-shape') || target?.closest?.('.search-zone-shape');
}

function _isEditHandle(target) {
  return target?.closest?.('.edit-handle') || target?.closest?.('.edit-handle-rotate');
}

export function makeSearchZoneEditable(onChange) {
  if (!map || !searchCircle) return;
  clearEditHandles();
  _onChange = onChange;

  // Start unselected
  searchCircle.setStyle({ weight: 2, color: '#D4A017', fillOpacity: 0.18, interactive: true });
  const el = searchCircle.getElement();
  if (el) { el.style.cursor = 'pointer'; el.style.pointerEvents = 'auto'; }

  // Make incident markers pass-through so clicks reach the zone path beneath
  _setIncidentMarkersPassthrough(true);

  // All event handling via delegation on the map container + document
  const container = map.getContainer();

  // Click on zone path → select
  function onContainerClick(evt) {
    if (_isZonePath(evt.target) && !_selected) {
      evt.stopPropagation();
      _selectZone();
    }
  }

  // Pointerdown outside zone/handles → dismiss
  function onDocPointerdown(evt) {
    if (!_selected) return;
    if (_isZonePath(evt.target) || _isEditHandle(evt.target)) return;
    if (!container.contains(evt.target)) return; // ignore clicks in chat panel
    _deselectZone();
  }

  // Mousedown on zone path when selected → start drag
  let dragging = false;
  let dragStartPx = null;

  function onContainerMousedown(evt) {
    if (!_selected || !_isZonePath(evt.target)) return;
    evt.preventDefault();
    evt.stopPropagation();
    dragging = true;
    dragStartPx = { x: evt.clientX, y: evt.clientY };
    map.dragging.disable();
    const el2 = searchCircle?.getElement();
    if (el2) el2.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragUp);
  }

  function onDragMove(evt) {
    if (!dragging || !_editState) return;
    const s = _editState;
    const dx = evt.clientX - dragStartPx.x;
    const dy = evt.clientY - dragStartPx.y;
    dragStartPx = { x: evt.clientX, y: evt.clientY };
    // Convert pixel delta to latlng delta
    const center = map.latLngToContainerPoint(s.centerLL);
    s.centerLL = map.containerPointToLatLng(L.point(center.x + dx, center.y + dy));
    _rebuildEllipse(s);
  }

  function onDragUp() {
    if (!dragging) return;
    dragging = false;
    map.dragging.enable();
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragUp);
    const el2 = searchCircle?.getElement();
    if (el2) el2.style.cursor = 'grab';
    if (_editState && _onChange) {
      const s = _editState;
      _onChange({ center: [s.centerLL.lat, s.centerLL.lng], radiusX: s.rx, radiusY: s.ry, rotation: s.tilt });
    }
  }

  container.addEventListener('click', onContainerClick, true);
  container.addEventListener('mousedown', onContainerMousedown, true);
  document.addEventListener('pointerdown', onDocPointerdown);

  _editCleanup = () => {
    container.removeEventListener('click', onContainerClick, true);
    container.removeEventListener('mousedown', onContainerMousedown, true);
    document.removeEventListener('pointerdown', onDocPointerdown);
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragUp);
    if (dragging) { dragging = false; map.dragging.enable(); }
  };
}

function _rebuildEllipse(s) {
  if (!searchCircle) return;
  searchCircle.setLatLng(s.centerLL);
  searchCircle.setRadius([s.rx, s.ry]);
  searchCircle.setTilt(s.tilt);
  // leaflet-ellipse re-renders SVG on geometry changes, resetting style to
  // original options (amber). Re-apply selected style every time.
  if (_selected) {
    searchCircle.setStyle({ weight: 3, color: '#fff', fillOpacity: 0.25 });
  }
  const el = searchCircle.getElement();
  if (el) {
    el.style.cursor = _selected ? 'grab' : 'pointer';
    el.style.pointerEvents = 'auto';
  }
  if (s.handleN) _repositionHandles(s);
}

function _repositionHandles(s) {
  function edgePoint(bearing) {
    const b = (bearing - s.tilt) * Math.PI / 180;
    const cosB = Math.cos(b);
    const sinB = Math.sin(b);
    const dist = 1 / Math.sqrt((sinB / s.rx) ** 2 + (cosB / s.ry) ** 2);
    return _offsetByMeters(s.centerLL, dist, bearing);
  }
  const nPos = edgePoint(s.tilt);
  const sPos = edgePoint(s.tilt + 180);
  const ePos = edgePoint(s.tilt + 90);
  const wPos = edgePoint(s.tilt + 270);
  s.handleN.setLatLng(nPos);
  s.handleS.setLatLng(sPos);
  s.handleE.setLatLng(ePos);
  s.handleW.setLatLng(wPos);
  const stemEnd = _offsetByMeters(s.centerLL, s.ry * 1.3, s.tilt);
  s.rotHandle.setLatLng(stemEnd);
  s.rotStem.setLatLngs([nPos, stemEnd]);
  const labelPos = _offsetByMeters(s.centerLL, Math.min(s.rx, s.ry) * 0.45, s.tilt + 210);
  const labelText = Math.round(s.rx) === Math.round(s.ry)
    ? `${Math.round(s.rx)}m`
    : `${Math.round(s.rx)} × ${Math.round(s.ry)}m`;
  s.sizeLabel.setLatLng(labelPos);
  s.sizeLabel.setIcon(L.divIcon({
    className: 'map-label',
    html: `<span>${labelText}</span>`,
    iconSize: [0, 0], iconAnchor: [0, 0],
  }));
}

function _selectZone() {
  if (!map || !searchCircle || _selected) return;
  _selected = true;

  searchCircle.setStyle({ weight: 3, color: '#fff', fillOpacity: 0.25 });
  const el = searchCircle.getElement();
  if (el) el.style.cursor = 'grab';

  const s = {
    rx: searchCircle._mRadiusX,
    ry: searchCircle._mRadiusY,
    tilt: searchCircle._tiltDeg,
    centerLL: searchCircle.getLatLng(),
  };
  _editState = s;

  function fireChange() {
    if (_onChange) _onChange({ center: [s.centerLL.lat, s.centerLL.lng], radiusX: s.rx, radiusY: s.ry, rotation: s.tilt });
  }

  function edgePoint(bearing) {
    const b = (bearing - s.tilt) * Math.PI / 180;
    const cosB = Math.cos(b);
    const sinB = Math.sin(b);
    const dist = 1 / Math.sqrt((sinB / s.rx) ** 2 + (cosB / s.ry) ** 2);
    return _offsetByMeters(s.centerLL, dist, bearing);
  }

  function rebuild() { _rebuildEllipse(s); }

  // ── Size label ──
  s.sizeLabel = L.marker(edgePoint(s.tilt + 180), {
    icon: L.divIcon({
      className: 'map-label',
      html: `<span>${Math.round(s.rx)}m</span>`,
      iconSize: [0, 0], iconAnchor: [0, 0],
    }),
    interactive: false, zIndexOffset: 870,
  }).addTo(map);
  editHandles.push(s.sizeLabel);

  // ── Cardinal handles ──
  function mkHandle(pos) {
    const h = L.marker(pos, {
      icon: L.divIcon({ className: 'edit-handle', html: '', iconSize: [14, 14], iconAnchor: [7, 7] }),
      draggable: true, zIndexOffset: 880,
    }).addTo(map);
    editHandles.push(h);
    return h;
  }

  s.handleN = mkHandle(edgePoint(s.tilt));
  s.handleS = mkHandle(edgePoint(s.tilt + 180));
  s.handleE = mkHandle(edgePoint(s.tilt + 90));
  s.handleW = mkHandle(edgePoint(s.tilt + 270));

  s.handleN.on('drag', (e) => { s.ry = Math.max(80, Math.min(2000, s.centerLL.distanceTo(e.target.getLatLng()))); rebuild(); });
  s.handleS.on('drag', (e) => { s.ry = Math.max(80, Math.min(2000, s.centerLL.distanceTo(e.target.getLatLng()))); rebuild(); });
  s.handleE.on('drag', (e) => { s.rx = Math.max(80, Math.min(2000, s.centerLL.distanceTo(e.target.getLatLng()))); rebuild(); });
  s.handleW.on('drag', (e) => { s.rx = Math.max(80, Math.min(2000, s.centerLL.distanceTo(e.target.getLatLng()))); rebuild(); });

  [s.handleN, s.handleS, s.handleE, s.handleW].forEach(h => h.on('dragend', fireChange));

  // ── Rotation handle ──
  const stemEnd = _offsetByMeters(s.centerLL, s.ry * 1.3, s.tilt);
  const nEdge = edgePoint(s.tilt);
  s.rotStem = L.polyline([nEdge, stemEnd], {
    color: '#fff', weight: 1, opacity: 0.5, dashArray: '4 4',
  }).addTo(map);
  editHandles.push(s.rotStem);

  s.rotHandle = L.marker(stemEnd, {
    icon: L.divIcon({
      className: 'edit-handle edit-handle-rotate',
      html: '<span class="material-symbols-outlined edit-handle-icon">rotate_right</span>',
      iconSize: [18, 18], iconAnchor: [9, 9],
    }),
    draggable: true, zIndexOffset: 890,
  }).addTo(map);
  editHandles.push(s.rotHandle);

  s.rotHandle.on('drag', (e) => {
    const hPos = e.target.getLatLng();
    const mPerLat = 111320;
    const mPerLng = 111320 * Math.cos(s.centerLL.lat * Math.PI / 180);
    const dx = (hPos.lng - s.centerLL.lng) * mPerLng;
    const dy = (hPos.lat - s.centerLL.lat) * mPerLat;
    s.tilt = Math.atan2(dx, dy) * 180 / Math.PI;
    rebuild();
  });
  s.rotHandle.on('dragend', fireChange);

  _repositionHandles(s);
}

function _deselectZone() {
  if (!_selected) return;
  _selected = false;
  for (const h of editHandles) map?.removeLayer(h);
  editHandles = [];
  _editState = null;
  if (searchCircle) {
    searchCircle.setStyle({ weight: 2, color: '#D4A017', fillOpacity: 0.18 });
    const el = searchCircle.getElement();
    if (el) { el.style.cursor = 'pointer'; el.style.pointerEvents = 'auto'; }
  }
}

function _setIncidentMarkersPassthrough(passthrough) {
  for (const m of incidentMarkers) {
    const el = m.getElement?.();
    if (el) el.style.pointerEvents = passthrough ? 'none' : '';
  }
}

function _offsetByMeters(ll, meters, bearingDeg) {
  const R = 6371000;
  const lat1 = ll.lat * Math.PI / 180;
  const lng1 = ll.lng * Math.PI / 180;
  const brng = bearingDeg * Math.PI / 180;
  const d = meters / R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
  const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return L.latLng(lat2 * 180 / Math.PI, lng2 * 180 / Math.PI);
}

export function clearEditHandles() {
  if (_editCleanup) { _editCleanup(); _editCleanup = null; }
  for (const h of editHandles) map?.removeLayer(h);
  editHandles = [];
  _editState = null;
  _selected = false;
  _setIncidentMarkersPassthrough(false);
  if (searchCircle) {
    searchCircle.setStyle({ weight: 2, color: '#D4A017', fillOpacity: 0.18, interactive: false });
    const el = searchCircle.getElement();
    if (el) { el.style.cursor = ''; el.style.pointerEvents = ''; }
  }
  _onChange = null;
}

function offsetLatLng(center, distanceM, bearingDeg) {
  const R = 6371000;
  const lat1 = center.lat * Math.PI / 180;
  const lng1 = center.lng * Math.PI / 180;
  const brng = bearingDeg * Math.PI / 180;
  const d = distanceM / R;

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
  const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));

  return L.latLng(lat2 * 180 / Math.PI, lng2 * 180 / Math.PI);
}

// ── Patrol Animation ─────────────────────────────────────
// Generates lawnmower waypoints and animates drones along them

function generateLawnmowerWaypoints(zone) {
  const { center, widthM, heightM, legs } = zone;
  const centerLL = L.latLng(center[0], center[1]);
  const halfH = heightM / 2;
  const halfW = widthM / 2;
  const legSpacing = heightM / (legs - 1);
  const waypoints = [];

  for (let i = 0; i < legs; i++) {
    const northOffset = halfH - (i * legSpacing);
    const bearing = northOffset >= 0 ? 0 : 180;
    const midPoint = offsetLatLng(centerLL, Math.abs(northOffset), bearing);
    const westPoint = offsetLatLng(midPoint, halfW, 270);
    const eastPoint = offsetLatLng(midPoint, halfW, 90);

    if (i % 2 === 0) {
      waypoints.push([westPoint.lat, westPoint.lng]);
      waypoints.push([eastPoint.lat, eastPoint.lng]);
    } else {
      waypoints.push([eastPoint.lat, eastPoint.lng]);
      waypoints.push([westPoint.lat, westPoint.lng]);
    }
  }
  return waypoints;
}

function startPatrolAnimation(marker, drone) {
  if (!drone.patrolZone) return null;

  const fwd = generateLawnmowerWaypoints(drone.patrolZone);
  if (fwd.length < 2) return null;

  // Round-trip: forward + reverse for seamless loop
  const waypoints = [...fwd, ...[...fwd].reverse().slice(1)];
  const speedMps = drone.patrolZone.speedMps || 12;

  // Pre-compute segments
  const segments = [];
  let totalDist = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const from = L.latLng(waypoints[i - 1][0], waypoints[i - 1][1]);
    const to = L.latLng(waypoints[i][0], waypoints[i][1]);
    const dist = from.distanceTo(to);
    segments.push({ from: waypoints[i - 1], to: waypoints[i], dist, cumDist: totalDist });
    totalDist += dist;
  }

  const loopTime = totalDist / speedMps;
  const timeOffset = Math.random() * loopTime; // desync drones
  let startTime = null;
  let rafId = null;

  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = (timestamp - startTime) / 1000 + timeOffset;
    const t = (elapsed % loopTime) / loopTime;
    const targetDist = t * totalDist;

    // Find current segment
    let seg = segments[segments.length - 1];
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].cumDist + segments[i].dist >= targetDist) {
        seg = segments[i];
        break;
      }
    }

    // Interpolate position
    const p = seg.dist > 0 ? Math.max(0, Math.min(1, (targetDist - seg.cumDist) / seg.dist)) : 0;
    const lat = seg.from[0] + (seg.to[0] - seg.from[0]) * p;
    const lng = seg.from[1] + (seg.to[1] - seg.from[1]) * p;
    marker.setLatLng([lat, lng]);

    // Calculate heading from segment direction
    const dLng = (seg.to[1] - seg.from[1]) * Math.PI / 180;
    const lat1 = seg.from[0] * Math.PI / 180;
    const lat2 = seg.to[0] * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const heading = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;

    // Update SVG rotation
    const el = marker.getElement();
    if (el) {
      const svg = el.querySelector('svg');
      if (svg) svg.style.transform = `rotate(${Math.round(heading)}deg)`;
    }

    rafId = requestAnimationFrame(animate);
  }

  rafId = requestAnimationFrame(animate);
  return { cancel: () => { if (rafId) cancelAnimationFrame(rafId); } };
}

function onTargetPosition(pos) {
  if (!map) return;

  if (!pos) {
    if (targetMarker) { map.removeLayer(targetMarker); targetMarker = null; }
    if (targetLabel) { map.removeLayer(targetLabel); targetLabel = null; }
    if (orbitCircle) { map.removeLayer(orbitCircle); orbitCircle = null; }
    return;
  }

  const latlng = [pos.lat, pos.lng];

  if (!targetMarker) {
    targetMarker = L.marker(latlng, {
      icon: L.divIcon({
        className: 'target-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
      zIndexOffset: 900,
    }).addTo(map);
    targetLabel = L.marker(latlng, {
      icon: L.divIcon({
        className: 'target-map-label',
        html: 'TARGET DETECTED',
        iconSize: [130, 22],
        iconAnchor: [65, 34],
      }),
      interactive: false,
      zIndexOffset: 899,
    }).addTo(map);
  } else {
    targetMarker.setLatLng(latlng);
    if (targetLabel) targetLabel.setLatLng(latlng);
  }
}

function onTargetStatus(status) {
  if (!targetMarker) return;
  const el = targetMarker.getElement();
  if (!el) return;

  if (status === 'confirmed' || status === 'tracking') {
    // The divIcon element itself has the .target-marker class
    const dot = el.querySelector('.target-marker') || el.firstElementChild;
    if (dot) dot.classList.add('confirmed');
    if (targetLabel) {
      const labelEl = targetLabel.getElement();
      if (labelEl) {
        const lbl = labelEl.querySelector('.target-map-label') || labelEl.firstElementChild;
        if (lbl) {
          lbl.textContent = 'TARGET CONFIRMED';
          lbl.classList.add('confirmed');
        }
      }
    }
    const pos = state.get('targetPosition');
    if (pos && !orbitCircle) {
      orbitCircle = L.circle([pos.lat, pos.lng], {
        radius: 120,
        color: MC.green,
        weight: 2,
        dashArray: '2, 10',
        fillColor: MC.green,
        fillOpacity: 0.10,
      }).addTo(map);
    }
  }
}

export function addWaypoint(id, coordinates, label) {
  if (!map || waypointMarkers.has(id)) return;

  const marker = L.marker(coordinates, {
    icon: L.divIcon({
      className: 'waypoint-marker',
      html: `<div class="waypoint-crosshair"></div><div class="waypoint-label">${label}</div>`,
      iconSize: [80, 40],
      iconAnchor: [40, 8],
    }),
    interactive: false,
  }).addTo(map);

  waypointMarkers.set(id, marker);
}

export function removeWaypoint(id) {
  if (!map || !waypointMarkers.has(id)) return;
  map.removeLayer(waypointMarkers.get(id));
  waypointMarkers.delete(id);
}

export function flyTo(lat, lng, zoom, duration = 2) {
  if (!map) return;
  map.invalidateSize({ animate: false });
  const container = map.getContainer();
  if (!container.offsetWidth || !container.offsetHeight) {
    map.setView([lat, lng], zoom || map.getZoom());
  } else {
    map.flyTo([lat, lng], zoom || map.getZoom(), { duration });
  }
}

export function panTo(lat, lng) {
  if (!map) return;
  map.panTo([lat, lng]);
}

export function resize() {
  if (map) {
    requestAnimationFrame(() => map.invalidateSize());
  }
}

export function clearTrail() {
  trailCoords = [];
  if (flightTrail) flightTrail.setLatLngs([]);
  if (flightTrailOutline) flightTrailOutline.setLatLngs([]);
}

export function getMap() {
  return map;
}

// ── Incident Markers ──────────────────────────────────────
// The ONE loud element. Bright colors, white borders.

const INCIDENT_ICONS = {
  1: { color: MC.incidentRed },
  2: { color: MC.incidentAmber },
  3: { color: '#9AA0A6' },
};

export function showIncidents(incidents, onSelect, { skipFitBounds = false, assignedIncidentIds = new Set(), assignedDrones = new Map(), activeIncidentId = null } = {}) {
  clearIncidentMarkers();
  if (!map) return;

  const bounds = [];
  // If showing a single incident, treat it as active
  const isActive = (id) => activeIncidentId === id || incidents.length === 1;

  for (let i = 0; i < incidents.length; i++) {
    const inc = incidents[i];
    if (!inc.coordinates) continue;
    const incNumber = inc.id.replace(/\D/g, '');
    const hasLinkedDrone = assignedIncidentIds.has(inc.id);
    const linkedDrone = assignedDrones.get(inc.id);
    const dotColor = hasLinkedDrone ? '#407CF5' : '#D4A017';
    const activeClass = isActive(inc.id) ? ' incident-dot-active' : '';

    // Drone badge HTML — small circle with drone chevron, docked top-right
    const droneBadge = linkedDrone
      ? `<div class="incident-drone-badge">
          <svg viewBox="0 0 24 24" width="10" height="10" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4 L3 18 L6 16.5 L12 15 L18 16.5 L21 18 Z" fill="#fff" stroke="none"/>
          </svg>
        </div>`
      : '';

    const marker = L.marker(inc.coordinates, {
      icon: L.divIcon({
        className: 'incident-map-marker',
        html: `<div class="incident-dot${activeClass}" style="--dot-color:${dotColor}">
          <span class="material-symbols-outlined">${inc.icon || 'location_on'}</span>
          ${droneBadge}
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      }),
      zIndexOffset: 800,
    });
    incidentCluster.addLayer(marker);

    marker.on('click', () => onSelect?.(inc));
    marker._incidentId = inc.id;

    // Hover sync: map marker → chat card
    marker.on('mouseover', () => {
      document.querySelector(`.incident-card-compact[data-id="${inc.id}"]`)?.classList.add('incident-card-hover');
      const el = marker.getElement();
      if (el) el.querySelector('.incident-dot')?.classList.add('incident-dot-highlight');
    });
    marker.on('mouseout', () => {
      document.querySelector(`.incident-card-compact[data-id="${inc.id}"]`)?.classList.remove('incident-card-hover');
      const el = marker.getElement();
      if (el) el.querySelector('.incident-dot')?.classList.remove('incident-dot-highlight');
    });

    // Permanent label below marker
    const droneShort = linkedDrone ? linkedDrone.name.replace(/^Delta\s+/i, '') : '';
    const labelText = linkedDrone
      ? `<span class="incident-label-id incident-label-i${inc.priority}">I${inc.priority}</span> ${inc.type} #${incNumber} · <span style="color:#8ab4f8">${droneShort}</span>`
      : `<span class="incident-label-id incident-label-i${inc.priority}">I${inc.priority}</span> ${inc.type} #${incNumber}`;
    marker.bindTooltip(labelText, {
      permanent: true,
      direction: 'bottom',
      offset: [0, 4],
      className: 'marker-permanent-label',
    });

    incidentMarkers.push(marker);
    incidentMarkerMap.set(inc.id, marker);
    bounds.push(inc.coordinates);
  }

  if (!skipFitBounds) {
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    } else if (bounds.length === 1) {
      focusIncident(bounds[0], 15);
    }
  }
}

export function clearIncidentMarkers() {
  if (incidentCluster) incidentCluster.clearLayers();
  for (const m of incidentMarkers) map?.removeLayer(m);
  incidentMarkers = [];
  incidentMarkerMap.clear();
}

// Hover sync: chat card → map marker
export function highlightIncident(id) {
  const marker = incidentMarkerMap.get(id);
  if (!marker) return;
  const el = marker.getElement();
  if (el) el.querySelector('.incident-dot')?.classList.add('incident-dot-highlight');
}

export function unhighlightIncident(id) {
  const marker = incidentMarkerMap.get(id);
  if (!marker) return;
  const el = marker.getElement();
  if (el) el.querySelector('.incident-dot')?.classList.remove('incident-dot-highlight');
}

export function focusIncident(coordinates, zoom = 16) {
  if (!map || !coordinates) return;
  requestAnimationFrame(() => {
    map.invalidateSize();
    map.flyTo(coordinates, zoom, { duration: 1 });
  });
}

// ── Fleet Drone Markers ───────────────────────────────────
// Three types: surveillance (airborne), in-mission (assigned), standby (ground/home base)

export function showFleetDrones(drones, incidentCoords, onSelect, { skipFitBounds = false, incidents = [], onIncidentSelect = null, recommendedDroneId = null, skipRouteLines = false } = {}) {
  clearFleetMarkers();
  if (!map) return;

  // Build incident lookup for in-mission drone connections
  const incidentLookup = new Map();
  for (const inc of incidents) {
    if (inc.id && inc.coordinates) incidentLookup.set(inc.id, inc);
  }

  const bounds = [];
  if (incidentCoords) bounds.push(incidentCoords);

  let labelIndex = 0;

  // Group standby drones by base location
  const baseGroups = new Map();

  for (const drone of drones) {
    if (!drone.coordinates) continue;

    // Standby drones get grouped at their base
    if (drone.status === 'standby') {
      const baseKey = drone.coordinates.join(',');
      if (!baseGroups.has(baseKey)) {
        baseGroups.set(baseKey, { coords: drone.coordinates, base: drone.base, drones: [] });
      }
      baseGroups.get(baseKey).drones.push(drone);
      continue;
    }

    const isSurveillance = drone.status === 'surveillance';
    const isMission = drone.status === 'in-mission';
    const isAssigned = isMission && drone.assignedIncident;
    const isReroutable = isSurveillance; // surveillance drones can be sent to incidents
    const isRecommended = recommendedDroneId && drone.id === recommendedDroneId;

    // Assigned drones are represented by the drone badge on the incident marker.
    // Still draw the orbit zone, but skip the separate drone marker.
    if (isAssigned && incidentLookup.has(drone.assignedIncident)) {
      const assignedInc = incidentLookup.get(drone.assignedIncident);
      const targetCoords = assignedInc.coordinates;

      // Orbit/surveillance zone around incident (amber, matches other search zones)
      const orbitZone = L.circle(targetCoords, {
        radius: 300,
        color: '#D4A017',
        weight: 2,
        fillColor: '#D4A017',
        fillOpacity: 0.18,
        className: 'search-zone-shape',
        interactive: true,
        bubblingMouseEvents: false,
      }).addTo(map);
      if (onIncidentSelect) {
        orbitZone.on('click', () => onIncidentSelect(assignedInc));
      }
      orbitZone.on('add', () => {
        const p = orbitZone._path;
        if (p) p.style.cursor = 'pointer';
      });
      distanceLines.push(orbitZone);

      // Show drone on orbit perimeter — toggles with badge based on zoom
      const orbitAngle = 30;
      const dronePos = offsetLatLng(L.latLng(targetCoords[0], targetCoords[1]), 300, orbitAngle);
      const droneHeading = (orbitAngle + 90) % 360;

      const shortName = drone.name.replace(/^Delta\s+/i, '');
      const orbitDroneMarker = L.marker([dronePos.lat, dronePos.lng], {
        icon: L.divIcon({
          className: 'fleet-drone-marker',
          html: `<div class="fleet-drone-dot" style="--dot-color:#407CF5">
            <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(${droneHeading}deg)">
              <path d="M12 4 L3 18 L6 16.5 L12 15 L18 16.5 L21 18 Z" fill="#fff" stroke="none"/>
            </svg>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
        zIndexOffset: 950,
      }).addTo(map);
      orbitDroneMarker.bindTooltip(
        `<span style="color:#8ab4f8">${shortName}</span> · On scene · ${drone.battery}%`,
        { permanent: false, direction: 'right', offset: [8, 0], className: 'marker-permanent-label' },
      );
      distanceLines.push(orbitDroneMarker);

      // Mark orbit drone for CSS-based zoom toggle
      orbitDroneMarker.getElement()?.classList.add('orbit-drone-perimeter');
      orbitDroneMarker.on('add', () => {
        orbitDroneMarker.getElement()?.classList.add('orbit-drone-perimeter');
      });

      // Set zoom class on map container for CSS toggle
      if (!map._hasZoomClassHandler) {
        function updateZoomClass() {
          const z = map.getZoom();
          map.getContainer().classList.toggle('zoom-detail', z >= 14);
        }
        updateZoomClass();
        map.on('zoomend', updateZoomClass);
        map._hasZoomClassHandler = true;
        map._zoomClassHandler = updateZoomClass;
      }

      continue; // no separate fleet-style marker for this drone
    }

    // Color: blue if recommended, black otherwise
    const dotColor = isRecommended ? '#407CF5' : null;

    // Calculate heading toward incident (if we have one)
    let headingDeg = 0;
    if (incidentCoords) {
      const dLng = (incidentCoords[1] - drone.coordinates[1]) * Math.PI / 180;
      const lat1 = drone.coordinates[0] * Math.PI / 180;
      const lat2 = incidentCoords[0] * Math.PI / 180;
      const y = Math.sin(dLng) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
      headingDeg = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
    }

    const shortName = drone.name.replace(/^Delta\s+/i, '');
    const svgSize = isRecommended ? 16 : 13;
    const dotSize = isRecommended ? 32 : 26;
    const marker = L.marker(drone.coordinates, {
      icon: L.divIcon({
        className: 'fleet-drone-marker',
        html: `<div class="fleet-drone-dot"${dotColor ? ` style="--dot-color:${dotColor}"` : ''}>
          <svg viewBox="0 0 24 24" width="${svgSize}" height="${svgSize}" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(${Math.round(headingDeg)}deg)">
            <path d="M12 4 L3 18 L6 16.5 L12 15 L18 16.5 L21 18 Z" fill="#fff" stroke="none"/>
          </svg>
        </div>`,
        iconSize: [dotSize, dotSize],
        iconAnchor: [dotSize / 2, dotSize / 2],
      }),
      zIndexOffset: isReroutable ? 850 : 700,
      interactive: true,
    });
    droneCluster.addLayer(marker);

    // Permanent name label below marker
    marker.bindTooltip(shortName, {
      permanent: true,
      direction: 'bottom',
      offset: [0, 4],
      className: 'marker-permanent-label',
    });

    if (isReroutable) {
      marker.on('click', () => onSelect?.(drone));
    }

    // Hover popup with detail (can't use tooltip — already bound as permanent label)
    const statusLabel = isSurveillance ? `Surveillance — ${drone.patrol || 'patrol'}`
      : 'Offline';
    const popupContent = `<strong>${drone.name}</strong><br>${statusLabel} · ${drone.battery}% battery${drone.distanceFromIncident != null ? '<br>' + drone.distanceFromIncident + ' km from incident' : ''}`;
    marker.bindPopup(popupContent, {
      className: 'map-tooltip-popup',
      closeButton: false,
      offset: [0, -16],
      autoPan: false,
    });
    marker.on('mouseover', function() { this.openPopup(); });
    marker.on('mouseout', function() { this.closePopup(); });

    // Route line from drone to incident (skipped when caller draws its own route)
    if (incidentCoords && isReroutable && !skipRouteLines) {
      // Recommended = Level 3 (Emphasis), Alternatives = Level 2 (Default)
      const isRec = isRecommended;
      const w = isRec ? 4 : 3;
      const shadow = L.polyline([drone.coordinates, incidentCoords], {
        color: '#000', weight: w + 1, opacity: isRec ? 0.4 : 0.3,
        dashArray: '2, 10', lineCap: 'round',
        className: 'route-shadow',
      }).addTo(map);
      distanceLines.push(shadow);
      const line = L.polyline([drone.coordinates, incidentCoords], {
        color: '#fff', weight: w, opacity: isRec ? 0.95 : 0.75,
        dashArray: '2, 10', lineCap: 'round',
      }).addTo(map);
      distanceLines.push(line);

      // Calculate distance dynamically
      const R = 6371;
      const dLat = (incidentCoords[0] - drone.coordinates[0]) * Math.PI / 180;
      const dLng = (incidentCoords[1] - drone.coordinates[1]) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(drone.coordinates[0]*Math.PI/180)*Math.cos(incidentCoords[0]*Math.PI/180)*Math.sin(dLng/2)**2;
      const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const etaSec = Math.round(distKm / 60 * 3600);
      const etaMin = Math.floor(etaSec / 60);
      const etaRemSec = etaSec % 60;
      const etaStr = etaMin > 0 ? `${etaMin}m ${etaRemSec}s` : `${etaRemSec}s`;

      const mid = [
        (drone.coordinates[0] + incidentCoords[0]) / 2,
        (drone.coordinates[1] + incidentCoords[1]) / 2,
      ];
      // Recommended label is brighter, alternatives are dimmer
      const labelClass = isRecommended ? 'map-label map-label-primary' : 'map-label map-label-dim';
      const labelMarker = L.marker(mid, {
        icon: L.divIcon({
          className: labelClass,
          html: `<span>${distKm.toFixed(1)} km · ${etaStr}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        interactive: false,
        zIndexOffset: isRecommended ? 865 : 860,
      }).addTo(map);
      distanceLines.push(labelMarker);
      labelIndex++;
    }

    fleetMarkers.push(marker);
    bounds.push(drone.coordinates);

    // Start patrol animation for surveillance drones on fleet overview
    if (isSurveillance && drone.patrolZone && !incidentCoords) {
      const anim = startPatrolAnimation(marker, drone);
      if (anim) patrolAnimations.push(anim);
    }
  }

  // Render grouped standby (home base) markers
  for (const [, group] of baseGroups) {
    const count = group.drones.length;
    const ready = group.drones.filter(d => d.readyState === 'ready');
    const charging = group.drones.filter(d => d.readyState === 'charging');

    const marker = L.marker(group.coords, {
      icon: L.divIcon({
        className: 'fleet-drone-marker',
        html: `<div class="fleet-base-dot">
          <svg class="base-marker-icon" viewBox="0 0 24 24" width="14" height="14"><path d="M12 4 L3 18 L6 16.5 L12 15 L18 16.5 L21 18 Z" fill="#fff" stroke="none"/></svg>
          <span class="base-count">${count}</span>
        </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
      zIndexOffset: 600,
      interactive: true,
    });
    droneCluster.addLayer(marker);

    // Permanent label below marker
    marker.bindTooltip(`${baseName} · ${count}`, {
      permanent: true,
      direction: 'bottom',
      offset: [0, 4],
      className: 'marker-permanent-label',
    });

    // Build popup content with drone status rows
    const baseName = group.base || 'Home Base';
    let popupRows = '';
    for (const d of ready) {
      const shortName = d.name.replace(/^Delta\s+/i, '');
      popupRows += `<div class="base-popup-row"><span class="base-popup-status ready"></span><span class="base-popup-name">${shortName}</span><span class="base-popup-bat">${d.battery}%</span><span class="base-popup-state">Ready</span></div>`;
    }
    for (const d of charging) {
      const shortName = d.name.replace(/^Delta\s+/i, '');
      popupRows += `<div class="base-popup-row"><span class="base-popup-status charging"></span><span class="base-popup-name">${shortName}</span><span class="base-popup-bat">${d.battery}%</span><span class="base-popup-state">Charging</span></div>`;
    }

    const popupContent = `<div class="base-popup">
      <div class="base-popup-header">${baseName}</div>
      <div class="base-popup-summary">${ready.length} ready · ${charging.length} charging</div>
      <div class="base-popup-divider"></div>
      ${popupRows}
    </div>`;

    // Click popup — full details, stays open until click elsewhere
    marker.bindPopup(popupContent, {
      className: 'base-popup-container',
      offset: [0, -16],
      closeButton: false,
      autoPan: true,
      minWidth: 160,
      maxWidth: 220,
    });

    // Hide tooltip when popup is open so they don't overlap
    marker.on('popupopen', () => marker.closeTooltip());
    marker.on('click', () => marker.closeTooltip());

    fleetMarkers.push(marker);
    bounds.push(group.coords);
  }

  if (!skipFitBounds && bounds.length > 1) {
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
  }
}

export function fitAllMarkers(padding = [60, 60], maxZoom = 12) {
  if (!map) return;
  requestAnimationFrame(() => {
    map.invalidateSize();
    const allCoords = [];
    if (incidentCluster) {
      incidentCluster.eachLayer(m => allCoords.push([m.getLatLng().lat, m.getLatLng().lng]));
    }
    if (droneCluster) {
      droneCluster.eachLayer(m => allCoords.push([m.getLatLng().lat, m.getLatLng().lng]));
    }
    // Also include any non-clustered markers
    for (const m of [...incidentMarkers, ...fleetMarkers]) {
      if (m.getLatLng) allCoords.push([m.getLatLng().lat, m.getLatLng().lng]);
    }
    if (allCoords.length > 1) {
      map.fitBounds(allCoords, { padding, maxZoom });
    } else if (allCoords.length === 1) {
      map.setView(allCoords[0], maxZoom);
    }
  });
}

export function clearFleetMarkers() {
  for (const anim of patrolAnimations) anim.cancel();
  patrolAnimations = [];
  // Remove zoom class handler
  if (map?._zoomClassHandler) {
    map.off('zoomend', map._zoomClassHandler);
    map._hasZoomClassHandler = false;
    map._zoomClassHandler = null;
    map.getContainer().classList.remove('zoom-detail');
  }
  if (droneCluster) droneCluster.clearLayers();
  for (const m of fleetMarkers) map?.removeLayer(m);
  for (const l of distanceLines) map?.removeLayer(l);
  fleetMarkers = [];
  distanceLines = [];
}

export function clearOverlays() {
  clearIncidentMarkers();
  clearFleetMarkers();
  clearRouteLines();
  clearTrail();
  clearEditHandles();
}

// ── Route Lines with Labels ──────────────────────────────

let routeLineOverlays = [];

export function addRouteLine(from, to, { color = '#fff', weight = 3, opacity = 0.7, dashArray = '2, 10', label = '' } = {}) {
  if (!map) return;

  // Shadow line — 1px offset, subtle drop shadow effect
  const shadow = L.polyline([from, to], {
    color: '#000', weight: weight + 1, opacity: 0.3, dashArray, lineCap: 'round',
    className: 'route-shadow',
  }).addTo(map);
  routeLineOverlays.push(shadow);
  // Route line on top
  const line = L.polyline([from, to], { color, weight, opacity, dashArray, lineCap: 'round' }).addTo(map);
  routeLineOverlays.push(line);

  if (label) {
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const labelMarker = L.marker(mid, {
      icon: L.divIcon({
        className: 'map-label map-label-primary',
        html: `<span>${label}</span>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
      interactive: false,
      zIndexOffset: 865,
    }).addTo(map);
    routeLineOverlays.push(labelMarker);
  }
}

export function clearRouteLines() {
  for (const o of routeLineOverlays) map?.removeLayer(o);
  routeLineOverlays = [];
}

export function showReturnRoute(dronePos, basePos) {
  if (!map) return;
  const from = [dronePos.lat, dronePos.lng];
  const to = basePos;
  // Calculate distance
  const R = 6371;
  const dLat = (to[0] - from[0]) * Math.PI / 180;
  const dLng = (to[1] - from[1]) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(from[0]*Math.PI/180)*Math.cos(to[0]*Math.PI/180)*Math.sin(dLng/2)**2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const etaSec = Math.round(dist / 60 * 3600);
  const etaStr = etaSec >= 60 ? `${Math.floor(etaSec/60)}m ${etaSec%60}s` : `${etaSec}s`;

  addRouteLine(from, to, {
    color: MC.altRoute,
    label: `RTB · ${dist.toFixed(1)} km · ${etaStr}`,
  });
}

// ── Live Orbit Scene (drone actively on scene) ─────────
// One orbit zone, drone placed on perimeter pointing tangentially, TARGET LOCATED label
export function showLiveOrbitScene(center, drone, radius = 300) {
  if (!map) return;

  // Orbit zone — thick white dashed border, blue fill
  const zone = L.circle(center, {
    radius,
    color: '#fff',
    weight: 3.5,
    opacity: 0.8,
    dashArray: '2, 10',
    fillColor: '#407CF5',
    fillOpacity: 0.18,
  }).addTo(map);
  routeLineOverlays.push(zone);

  // Place drone on the orbit perimeter (NNE position, ~30 degrees)
  const orbitAngle = 30; // degrees from north, clockwise
  const dronePos = offsetLatLng(L.latLng(center[0], center[1]), radius, orbitAngle);
  // Heading tangent to orbit = orbitAngle + 90 (clockwise orbit)
  const droneHeading = (orbitAngle + 90) % 360;

  const shortName = drone.name.replace(/^Delta\s+/i, '');
  const droneMarkerEl = L.marker([dronePos.lat, dronePos.lng], {
    icon: L.divIcon({
      className: 'fleet-drone-marker',
      html: `<div class="fleet-drone-dot" style="--dot-color:#407CF5">
        <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(${droneHeading}deg)">
          <path d="M12 4 L3 18 L6 16.5 L12 15 L18 16.5 L21 18 Z" fill="#fff" stroke="none"/>
        </svg>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    }),
    zIndexOffset: 950,
    interactive: false,
  }).addTo(map);
  droneMarkerEl.bindTooltip(shortName, {
    permanent: false,
    direction: 'bottom',
    offset: [0, 4],
    className: 'marker-permanent-label',
  });
  routeLineOverlays.push(droneMarkerEl);

  // "TARGET LOCATED" label — positioned just below the incident, inside the zone
  const labelPos = offsetLatLng(L.latLng(center[0], center[1]), radius * 0.45, 180);
  const label = L.marker([labelPos.lat, labelPos.lng], {
    icon: L.divIcon({
      className: 'map-label map-label-amber',
      html: '<span>TARGET LOCATED</span>',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    }),
    interactive: false,
    zIndexOffset: 870,
  }).addTo(map);
  routeLineOverlays.push(label);
}

export function showSearchZonePreview(center, radius, fillOpacity = 0.18) {
  if (!map) return;
  const ellipse = L.ellipse(center, [radius, radius], 0, {
    color: '#D4A017',
    weight: 2,
    fillColor: '#D4A017',
    fillOpacity,
    className: 'search-zone-shape',
  }).addTo(map);
  routeLineOverlays.push(ellipse);
}
