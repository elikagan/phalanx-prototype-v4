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
let fleetMarkers = [];
let distanceLines = [];

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
  });

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

  if (zone.bias) {
    const origin = zone.origin || zone.center;
    const pts = generateOblong(origin, zone.center, zone.radius, zone.bias);
    searchCircle = L.polygon(pts, {
      color: '#D4A017',
      weight: 2,
      fillColor: '#D4A017',
      fillOpacity: 0.18,
      smoothFactor: 2,
      className: 'search-zone-shape',
    }).addTo(map);
  } else {
    searchCircle = L.circle(zone.center, {
      radius: zone.radius,
      color: '#D4A017',
      weight: 2,
      fillColor: '#D4A017',
      fillOpacity: 0.18,
      className: 'search-zone-shape',
    }).addTo(map);
  }

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
      className: 'map-label',
      html: `<span>${Math.round(radius)}m radius</span>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
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
        className: 'map-label',
        html: `<span>${Math.round(clamped)}m radius</span>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }));
    });
    handle.on('dragend', () => {
      if (onChange) onChange({ center: [center.lat, center.lng], radius: searchCircle.getRadius() });
    });

    editHandles.push(handle);
  }

  const centerHandle = L.marker(center, {
    icon: L.divIcon({
      className: 'edit-handle center-handle',
      html: '<span class="material-symbols-outlined edit-handle-icon">open_with</span>',
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
  });
  centerHandle.on('dragend', (e) => {
    const c = e.target.getLatLng();
    if (onChange) onChange({ center: [c.lat, c.lng], radius: searchCircle.getRadius() });
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

export function showIncidents(incidents, onSelect, { skipFitBounds = false, assignedIncidentIds = new Set() } = {}) {
  clearIncidentMarkers();
  if (!map) return;

  const bounds = [];

  for (let i = 0; i < incidents.length; i++) {
    const inc = incidents[i];
    if (!inc.coordinates) continue;
    const incNumber = inc.id.replace(/\D/g, '');
    const hasLinkedDrone = assignedIncidentIds.has(inc.id);
    const dotColor = hasLinkedDrone ? '#407CF5' : '#D4A017';
    const marker = L.marker(inc.coordinates, {
      icon: L.divIcon({
        className: 'incident-map-marker',
        html: `<div class="incident-dot" style="--dot-color:${dotColor}">
          <span class="material-symbols-outlined">${inc.icon || 'location_on'}</span>
        </div>
        <div class="incident-map-label">${inc.type} #${incNumber}</div>`,
        iconSize: [200, 56],
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

    // Color: blue if assigned/recommended, black otherwise
    const dotColor = (isAssigned || isRecommended) ? '#407CF5' : '#1c1c1f';

    // Calculate heading toward incident (if we have one)
    let headingDeg = 0;
    const targetCoords = isAssigned && incidentLookup.has(drone.assignedIncident)
      ? incidentLookup.get(drone.assignedIncident).coordinates
      : incidentCoords;
    if (targetCoords) {
      const dLng = (targetCoords[1] - drone.coordinates[1]) * Math.PI / 180;
      const lat1 = drone.coordinates[0] * Math.PI / 180;
      const lat2 = targetCoords[0] * Math.PI / 180;
      const y = Math.sin(dLng) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
      headingDeg = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
    }

    const shortName = drone.name.replace(/^Delta\s+/i, '');
    const isDimmed = isReroutable && !isRecommended && !isAssigned;
    const dotDimClass = isDimmed ? ' fleet-drone-dot-dim' : '';
    const svgSize = isDimmed ? 13 : 16;
    const marker = L.marker(drone.coordinates, {
      icon: L.divIcon({
        className: 'fleet-drone-marker',
        html: `<div class="fleet-drone-dot${dotDimClass}" style="--dot-color:${dotColor}">
          <svg viewBox="0 0 24 24" width="${svgSize}" height="${svgSize}" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(${Math.round(headingDeg)}deg)">
            <path d="M12 4 L3 18 L6 16.5 L12 15 L18 16.5 L21 18 Z" fill="#fff" stroke="none"/>
          </svg>
        </div>
        <div class="fleet-drone-label">${shortName}</div>`,
        iconSize: [120, 48],
        iconAnchor: [20, 20],
      }),
      zIndexOffset: isAssigned ? 900 : isReroutable ? 850 : 700,
      interactive: isReroutable || isAssigned,
    }).addTo(map);

    if (isReroutable) {
      marker.on('click', () => onSelect?.(drone));
    }
    // In-mission drone click → open its assigned incident
    if (isAssigned && onIncidentSelect && incidentLookup.has(drone.assignedIncident)) {
      marker.on('click', () => onIncidentSelect(incidentLookup.get(drone.assignedIncident)));
    }

    const statusLabel = isSurveillance ? `Surveillance — ${drone.patrol || 'patrol'}`
      : isMission ? `In Mission (${drone.operator})`
      : 'Offline';
    const tooltip = L.tooltip({
      direction: 'top',
      offset: [0, -20],
      className: 'map-tooltip',
    });
    tooltip.setContent(`<strong>${drone.name}</strong><br>${statusLabel} · ${drone.battery}% battery${drone.distanceFromIncident != null ? '<br>' + drone.distanceFromIncident + ' km from incident' : ''}`);
    marker.bindTooltip(tooltip);

    // In-mission drone: draw solid route line + orbit zone to its assigned incident
    if (isAssigned && incidentLookup.has(drone.assignedIncident)) {
      const assignedInc = incidentLookup.get(drone.assignedIncident);
      const targetCoords = assignedInc.coordinates;

      // Orbit/surveillance zone around incident (blue tint, shows active coverage)
      // Clickable — clicking anywhere in the zone opens the incident
      const orbitZone = L.circle(targetCoords, {
        radius: 300,
        color: '#fff',
        weight: 3,
        opacity: 0.7,
        dashArray: '2, 10',
        fillColor: '#407CF5',
        fillOpacity: 0.15,
        interactive: true,
        bubblingMouseEvents: false,
      }).addTo(map);
      if (onIncidentSelect) {
        orbitZone.on('click', () => onIncidentSelect(assignedInc));
      }
      // Set pointer cursor on the SVG path
      const pathEl = orbitZone._path || orbitZone.getElement?.();
      if (pathEl) pathEl.style.cursor = 'pointer';
      // Also set it after it's added to the map (in case _path isn't ready yet)
      orbitZone.on('add', () => {
        const p = orbitZone._path;
        if (p) p.style.cursor = 'pointer';
      });
      distanceLines.push(orbitZone);

      // Solid route line (Level 4 — active assignment, not proposed)
      // 1px offset shadow, not thick centered casing
      const shadow = L.polyline([drone.coordinates, targetCoords], {
        color: '#000', weight: 4, opacity: 0.3, lineCap: 'round', interactive: false,
        className: 'route-shadow',
      }).addTo(map);
      distanceLines.push(shadow);
      const line = L.polyline([drone.coordinates, targetCoords], {
        color: '#407CF5', weight: 3, opacity: 0.8, lineCap: 'round', interactive: false,
      }).addTo(map);
      distanceLines.push(line);
    }

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
          <span class="material-symbols-outlined base-marker-icon">home</span>
          <span class="base-count">${count}</span>
        </div>
        <div class="fleet-drone-label">${group.base || 'Home Base'}</div>`,
        iconSize: [120, 48],
        iconAnchor: [20, 20],
      }),
      zIndexOffset: 600,
      interactive: false,
    }).addTo(map);

    // Tooltip with ready vs charging breakdown
    let tooltipContent = `<strong>${group.base || 'Home Base'}</strong>`;
    if (ready.length > 0) {
      const readyNames = ready.map(d => `${d.name.replace(/^Delta\s+/i, '')} (${d.battery}%)`).join(', ');
      tooltipContent += `<br>✓ ${ready.length} ready for launch<br><span class="tooltip-detail">${readyNames}</span>`;
    }
    if (charging.length > 0) {
      const chargingNames = charging.map(d => `${d.name.replace(/^Delta\s+/i, '')} (${d.battery}%)`).join(', ');
      tooltipContent += `<br>⚡ ${charging.length} charging<br><span class="tooltip-detail">${chargingNames}</span>`;
    }

    const tooltip = L.tooltip({
      direction: 'top',
      offset: [0, -20],
      className: 'map-tooltip',
    });
    tooltip.setContent(tooltipContent);
    marker.bindTooltip(tooltip);

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
      </div>
      <div class="fleet-drone-label">${shortName}</div>`,
      iconSize: [120, 48],
      iconAnchor: [20, 20],
    }),
    zIndexOffset: 950,
    interactive: false,
  }).addTo(map);
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
  const circle = L.circle(center, {
    radius,
    color: '#D4A017',
    weight: 2,
    fillColor: '#D4A017',
    fillOpacity,
    className: 'search-zone-shape',
  }).addTo(map);
  routeLineOverlays.push(circle);
}
