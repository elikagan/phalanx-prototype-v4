/**
 * Map Component — Leaflet satellite map
 *
 * MAP OVERLAY DESIGN SYSTEM
 * Modeled after Google Maps satellite view. Hierarchy is everything.
 *
 * LOUD  (1 thing):  Incident pin — bright red, white border. The emergency.
 * MEDIUM:           Route lines — #1A73E8 Google blue, thin (3px), dark outline.
 * QUIET:            Labels — white pill, dark text, small. Info when you need it.
 * BACKGROUND:       Search zones — thin dashed outline, barely-there fill.
 *
 * Rules:
 *   - Only the incident marker should grab your eye
 *   - Route lines are visible but calm
 *   - Labels are white chips, not colored billboards
 *   - Drone markers are dark circles with subtle icons
 *   - Less stroke weight = more professional
 */

import L from 'leaflet';
import * as state from '../state.js';
import { MAP_CENTER, MAP_ZOOM } from '../scenarios/san-diego-pursuit.js';

// ── Map Overlay Palette ────────────────────────────────────
// Hierarchy: incident (red) > routes (blue) > labels (white) > zones (ghost)
const MC = {
  // Route
  routeBlue: '#1A73E8',       // Google Maps blue
  routeOutline: '#0D47A1',    // darker blue outline (not black, not white)
  altRoute: '#9AA0A6',        // gray for secondary routes

  // Incident (the ONE loud thing)
  incidentRed: '#EA4335',
  incidentAmber: '#F9AB00',

  // Status
  green: '#34A853',
  amber: '#F9AB00',

  // Labels — white chips with dark text (Google Maps style)
  labelBg: 'rgba(255, 255, 255, 0.95)',
  labelText: '#202124',       // near-black
  labelBorder: 'rgba(0, 0, 0, 0.12)',
  labelShadow: '0 1px 3px rgba(0,0,0,0.3)',

  // Search zone (background-level, barely there)
  zoneLine: 'rgba(255, 255, 255, 0.5)',
  zoneFill: 'rgba(255, 255, 255, 0.06)',

  // Drone
  droneBlue: '#1A73E8',
  droneMission: '#F9AB00',
  droneOffline: '#5F6368',
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
let fleetMarkers = [];
let distanceLines = [];

// Drone SVG — stealth flying wing, white fill for satellite visibility
const DRONE_SVG = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 6 L4 24 L8 22 L16 20 L24 22 L28 24 Z"
    fill="#fff" stroke="${MC.routeOutline}" stroke-width="0.8" opacity="0.95"/>
  <path d="M16 6 L16 20" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>
</svg>`;

// Fleet drone SVG — colored fill
const FLEET_DRONE_SVG = (color) => `<svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 4 L3 18 L6 16.5 L12 15 L18 16.5 L21 18 Z"
    fill="${color}" stroke="rgba(255,255,255,0.5)" stroke-width="0.8"/>
</svg>`;

const droneIcon = L.divIcon({
  className: 'drone-marker',
  html: DRONE_SVG,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

export function init() {
  const el = document.getElementById('map');
  if (!el || map) return;

  map = L.map(el, {
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    zoomControl: false,
    attributionControl: false,
  });

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
  }).addTo(map);

  if (window.innerWidth >= 768) {
    L.control.zoom({ position: 'bottomright' }).addTo(map);
  }

  // Flight trail — dark outline underneath
  flightTrailOutline = L.polyline([], {
    color: MC.routeOutline,
    weight: 5,
    opacity: 0.4,
    lineCap: 'round',
  }).addTo(map);
  // Flight trail — blue line on top
  flightTrail = L.polyline([], {
    color: MC.routeBlue,
    weight: 3,
    opacity: 0.9,
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
    droneMarker = L.marker(latlng, { icon: droneIcon, zIndexOffset: 1000 }).addTo(map);
  } else {
    droneMarker.setLatLng(latlng);
  }

  trailCoords.push(latlng);
  if (flightTrailOutline) flightTrailOutline.setLatLngs(trailCoords);
  flightTrail.setLatLngs(trailCoords);
}

function onDroneHeading(heading) {
  if (!droneMarker) return;
  const el = droneMarker.getElement();
  if (el) {
    el.style.transform = `${el.style.transform.replace(/rotate\([^)]*\)/, '')} rotate(${heading}deg)`;
  }
}

function onSearchZone(zone) {
  if (!map) return;

  if (searchCircle) { map.removeLayer(searchCircle); searchCircle = null; }
  if (searchLabel) { map.removeLayer(searchLabel); searchLabel = null; }

  if (!zone) return;

  if (zone.bias) {
    const origin = zone.origin || zone.center;
    const pts = generateOblong(origin, zone.center, zone.radius, zone.bias);
    searchCircle = L.polygon(pts, {
      color: MC.zoneLine,
      weight: 1.5,
      dashArray: '6 4',
      fillColor: '#fff',
      fillOpacity: 0.06,
      smoothFactor: 2,
    }).addTo(map);
  } else {
    searchCircle = L.circle(zone.center, {
      radius: zone.radius,
      color: MC.zoneLine,
      weight: 1.5,
      dashArray: '6 4',
      fillColor: '#fff',
      fillOpacity: 0.06,
    }).addTo(map);
  }

  const labelText = zone.bias
    ? `SEARCH ZONE — ${zone.bias.toUpperCase()}BOUND`
    : 'SEARCH ZONE';
  searchLabel = L.marker(zone.center, {
    icon: L.divIcon({
      className: 'search-zone-label',
      html: labelText,
      iconSize: [180, 20],
      iconAnchor: [90, 10],
    }),
    interactive: false,
  }).addTo(map);
}

function generateOblong(origin, center, radius, bias) {
  const segments = 64;
  const rLat = radius / 111320;
  const rLng = radius / (111320 * Math.cos(center[0] * Math.PI / 180));

  const dLat = center[0] - origin[0];
  const dLng = center[1] - origin[1];
  const angle = Math.atan2(dLng, dLat);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const length = rLat * 2.5;
  const maxWidth = rLng * 1.2;

  const right = [];
  const left = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const along = t * length;

    let w;
    if (t < 0.08) {
      w = maxWidth * 0.05 * (t / 0.08);
    } else if (t < 0.6) {
      const mt = (t - 0.08) / 0.52;
      w = maxWidth * (0.05 + 0.95 * (1 - (1 - mt) * (1 - mt)));
    } else {
      const ft = (t - 0.6) / 0.4;
      w = maxWidth * Math.cos(ft * Math.PI / 2);
    }

    right.push([
      origin[0] + along * cosA - w * sinA,
      origin[1] + along * sinA + w * cosA,
    ]);
    left.unshift([
      origin[0] + along * cosA + w * sinA,
      origin[1] + along * sinA - w * cosA,
    ]);
  }

  return [...right, ...left];
}

// ── Editable Search Zone (drag handles) ──────────────────

let editHandles = [];

export function makeSearchZoneEditable(onChange) {
  if (!map || !searchCircle) return;
  clearEditHandles();

  const isCircle = typeof searchCircle.getRadius === 'function';
  if (!isCircle) return;

  const center = searchCircle.getLatLng();
  const radius = searchCircle.getRadius();

  const radiusLabel = L.marker(center, {
    icon: L.divIcon({
      className: 'route-label',
      html: `${Math.round(radius)}m radius`,
      iconSize: [110, 22],
      iconAnchor: [55, 11],
    }),
    interactive: false,
    zIndexOffset: 870,
  }).addTo(map);
  editHandles.push(radiusLabel);

  const dirs = [
    { name: 'N', bearing: 0 },
    { name: 'E', bearing: 90 },
    { name: 'S', bearing: 180 },
    { name: 'W', bearing: 270 },
  ];

  for (const dir of dirs) {
    const handlePos = offsetLatLng(center, radius, dir.bearing);
    const handle = L.marker(handlePos, {
      icon: L.divIcon({
        className: 'edit-handle',
        html: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
      draggable: true,
      zIndexOffset: 880,
    }).addTo(map);

    handle.on('drag', (e) => {
      const hPos = e.target.getLatLng();
      const newRadius = center.distanceTo(hPos);
      const clamped = Math.max(100, Math.min(2000, newRadius));
      searchCircle.setRadius(clamped);
      for (let i = 0; i < dirs.length; i++) {
        const hp = offsetLatLng(center, clamped, dirs[i].bearing);
        editHandles[i + 1].setLatLng(hp);
      }
      radiusLabel.setIcon(L.divIcon({
        className: 'route-label',
        html: `${Math.round(clamped)}m radius`,
        iconSize: [110, 22],
        iconAnchor: [55, 11],
      }));
      if (onChange) onChange({ center: [center.lat, center.lng], radius: clamped });
    });

    editHandles.push(handle);
  }

  const centerHandle = L.marker(center, {
    icon: L.divIcon({
      className: 'edit-handle center-handle',
      html: '<span class="material-symbols-outlined" style="font-size:12px;color:#5F6368">open_with</span>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    }),
    draggable: true,
    zIndexOffset: 890,
  }).addTo(map);

  centerHandle.on('drag', (e) => {
    const newCenter = e.target.getLatLng();
    const r = searchCircle.getRadius();
    searchCircle.setLatLng(newCenter);
    radiusLabel.setLatLng(newCenter);
    if (searchLabel) searchLabel.setLatLng(newCenter);
    for (let i = 0; i < dirs.length; i++) {
      const hp = offsetLatLng(newCenter, r, dirs[i].bearing);
      editHandles[i + 1].setLatLng(hp);
    }
    if (onChange) onChange({ center: [newCenter.lat, newCenter.lng], radius: r });
  });

  editHandles.push(centerHandle);
}

export function clearEditHandles() {
  for (const h of editHandles) map?.removeLayer(h);
  editHandles = [];
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
    el.querySelector('.target-marker')?.classList.add('confirmed');
    if (targetLabel) {
      const labelEl = targetLabel.getElement();
      if (labelEl) {
        labelEl.querySelector('.target-map-label').textContent = 'TARGET CONFIRMED';
        labelEl.querySelector('.target-map-label').classList.add('confirmed');
      }
    }
    const pos = state.get('targetPosition');
    if (pos && !orbitCircle) {
      orbitCircle = L.circle([pos.lat, pos.lng], {
        radius: 80,
        color: MC.green,
        weight: 1.5,
        dashArray: '6 4',
        fillColor: MC.green,
        fillOpacity: 0.06,
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

export function showIncidents(incidents, onSelect, { skipFitBounds = false, assignedIncidentIds = new Set() } = {}) {
  clearIncidentMarkers();
  if (!map) return;

  const bounds = [];

  for (let i = 0; i < incidents.length; i++) {
    const inc = incidents[i];
    if (!inc.coordinates) continue;
    const { color } = INCIDENT_ICONS[inc.priority] || INCIDENT_ICONS[3];
    const incNumber = inc.id.replace(/\D/g, '');
    const hasLinkedDrone = assignedIncidentIds.has(inc.id);
    const marker = L.marker(inc.coordinates, {
      icon: L.divIcon({
        className: 'incident-map-marker',
        html: `<div class="incident-dot${hasLinkedDrone ? ' linked' : ''}" style="--dot-color:${color}">
          <span class="material-symbols-outlined" style="font-size:18px;color:#fff">${inc.icon || 'location_on'}</span>
        </div>
        <div class="incident-map-label">${inc.type} #${incNumber}</div>`,
        iconSize: [160, 56],
        iconAnchor: [20, 20],
      }),
      zIndexOffset: 800,
    }).addTo(map);

    marker.on('click', () => onSelect?.(inc));

    const tooltip = L.tooltip({
      direction: 'top',
      offset: [0, -20],
      className: 'map-tooltip',
    });
    tooltip.setContent(`<strong>P${inc.priority} · ${inc.type} #${incNumber}</strong><br>${inc.location} · ${inc.elapsed}<br>${inc.units} unit${inc.units !== 1 ? 's' : ''} responding`);
    marker.bindTooltip(tooltip);

    incidentMarkers.push(marker);
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
  for (const m of incidentMarkers) map?.removeLayer(m);
  incidentMarkers = [];
}

export function focusIncident(coordinates, zoom = 16) {
  if (!map || !coordinates) return;
  requestAnimationFrame(() => {
    map.invalidateSize();
    map.flyTo(coordinates, zoom, { duration: 1 });
  });
}

// ── Fleet Drone Markers ───────────────────────────────────
// Medium volume. Dark circles, subtle icons.

export function showFleetDrones(drones, incidentCoords, onSelect, { skipFitBounds = false } = {}) {
  clearFleetMarkers();
  if (!map) return;

  const bounds = [];
  if (incidentCoords) bounds.push(incidentCoords);

  let labelIndex = 0;

  for (const drone of drones) {
    if (!drone.coordinates) continue;
    const isAvailable = drone.status === 'available';
    const isMission = drone.status === 'in-mission';
    const color = isAvailable ? MC.droneBlue
      : isMission ? MC.droneMission
      : MC.droneOffline;

    const isAssigned = isMission && drone.assignedIncident;
    const marker = L.marker(drone.coordinates, {
      icon: L.divIcon({
        className: 'fleet-drone-marker',
        html: `<div class="fleet-drone-dot${isAssigned ? ' linked' : ''}" style="--drone-color:${color}">
          ${FLEET_DRONE_SVG(color)}
        </div>
        <div class="fleet-drone-label">${drone.name}${drone.distanceFromIncident != null ? ' · ' + drone.distanceFromIncident + ' km' : ''}</div>`,
        iconSize: [150, 52],
        iconAnchor: [20, 20],
      }),
      zIndexOffset: isAvailable ? 850 : 700,
      interactive: isAvailable,
    }).addTo(map);

    if (isAvailable) {
      marker.on('click', () => onSelect?.(drone));
    }

    const statusLabel = drone.status === 'available' ? 'Available'
      : isMission ? `In Mission (${drone.operator})`
      : 'Offline';
    const tooltip = L.tooltip({
      direction: 'top',
      offset: [0, -20],
      className: 'map-tooltip',
    });
    tooltip.setContent(`<strong>${drone.name}</strong><br>${statusLabel} · ${drone.battery}% battery${drone.distanceFromIncident != null ? '<br>' + drone.distanceFromIncident + ' km from incident' : ''}`);
    marker.bindTooltip(tooltip);

    // Route line — thin, calm, Google Maps style
    if (incidentCoords && isAvailable) {
      // Dark blue outline (just slightly wider)
      const outline = L.polyline([drone.coordinates, incidentCoords], {
        color: MC.routeOutline,
        weight: 5,
        opacity: 0.4,
        lineCap: 'round',
      }).addTo(map);
      distanceLines.push(outline);
      // Blue route line
      const line = L.polyline([drone.coordinates, incidentCoords], {
        color: MC.routeBlue,
        weight: 3,
        opacity: 0.9,
        lineCap: 'round',
      }).addTo(map);
      distanceLines.push(line);

      // White chip label — quiet, informational
      if (drone.distanceFromIncident != null) {
        const t = 0.35 + labelIndex * 0.3;
        const mid = [
          drone.coordinates[0] + (incidentCoords[0] - drone.coordinates[0]) * t,
          drone.coordinates[1] + (incidentCoords[1] - drone.coordinates[1]) * t,
        ];
        const etaSec = Math.round(drone.distanceFromIncident / 60 * 3600);
        const etaMin = Math.floor(etaSec / 60);
        const etaRemSec = etaSec % 60;
        const etaStr = etaMin > 0 ? `${etaMin}m ${etaRemSec}s` : `${etaRemSec}s`;
        const labelMarker = L.marker(mid, {
          icon: L.divIcon({
            className: 'route-label',
            html: `${drone.distanceFromIncident} km · ${etaStr}`,
            iconSize: [120, 22],
            iconAnchor: [60, 11],
          }),
          interactive: false,
          zIndexOffset: 860,
        }).addTo(map);
        distanceLines.push(labelMarker);
        labelIndex++;
      }
    }

    fleetMarkers.push(marker);
    bounds.push(drone.coordinates);
  }

  if (!skipFitBounds && bounds.length > 1) {
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
  }
}

export function fitAllMarkers(padding = [60, 60], maxZoom = 12) {
  if (!map) return;
  requestAnimationFrame(() => {
    map.invalidateSize();
    const allCoords = [
      ...incidentMarkers.map(m => [m.getLatLng().lat, m.getLatLng().lng]),
      ...fleetMarkers.map(m => [m.getLatLng().lat, m.getLatLng().lng]),
    ];
    if (allCoords.length > 1) {
      map.fitBounds(allCoords, { padding, maxZoom });
    } else if (allCoords.length === 1) {
      map.setView(allCoords[0], maxZoom);
    }
  });
}

export function clearFleetMarkers() {
  for (const m of fleetMarkers) map?.removeLayer(m);
  for (const l of distanceLines) map?.removeLayer(l);
  fleetMarkers = [];
  distanceLines = [];
}

export function clearOverlays() {
  clearIncidentMarkers();
  clearFleetMarkers();
  clearRouteLines();
}

// ── Route Lines with Labels ──────────────────────────────

let routeLineOverlays = [];

export function addRouteLine(from, to, { color = MC.routeBlue, weight = 3, opacity = 0.9, label = '' } = {}) {
  if (!map) return;

  const outline = L.polyline([from, to], { color: MC.routeOutline, weight: weight + 2, opacity: 0.4, lineCap: 'round' }).addTo(map);
  routeLineOverlays.push(outline);
  const line = L.polyline([from, to], { color, weight, opacity, lineCap: 'round' }).addTo(map);
  routeLineOverlays.push(line);

  if (label) {
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const labelMarker = L.marker(mid, {
      icon: L.divIcon({
        className: 'route-label',
        html: label,
        iconSize: [130, 22],
        iconAnchor: [65, 11],
      }),
      interactive: false,
      zIndexOffset: 860,
    }).addTo(map);
    routeLineOverlays.push(labelMarker);
  }
}

export function clearRouteLines() {
  for (const o of routeLineOverlays) map?.removeLayer(o);
  routeLineOverlays = [];
}

export function showSearchZonePreview(center, radius, fillOpacity = 0.06) {
  if (!map) return;
  const circle = L.circle(center, {
    radius,
    color: MC.zoneLine,
    weight: 1.5,
    dashArray: '6 4',
    fillColor: '#fff',
    fillOpacity,
  }).addTo(map);
  routeLineOverlays.push(circle);
  const label = L.marker(center, {
    icon: L.divIcon({
      className: 'search-zone-label',
      html: 'SEARCH AREA',
      iconSize: [110, 20],
      iconAnchor: [55, 10],
    }),
    interactive: false,
  }).addTo(map);
  routeLineOverlays.push(label);
}
