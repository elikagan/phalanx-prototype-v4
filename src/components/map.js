/**
 * Map Component — Leaflet satellite map
 *
 * Owns: map instance, markers, overlays, drone animation.
 * Subscribes to: showMap, dronePosition, droneHeading, searchZone, targetPosition, targetStatus
 */

import L from 'leaflet';
import * as state from '../state.js';
import { MAP_CENTER, MAP_ZOOM } from '../scenarios/san-diego-pursuit.js';

let map = null;
let droneMarker = null;
let searchCircle = null;
let searchLabel = null;
let targetMarker = null;
let targetLabel = null;
let orbitCircle = null;
let flightTrail = null;
let trailCoords = [];
const waypointMarkers = new Map();

// Overlay marker layers (incidents, fleet drones)
let incidentMarkers = [];
let fleetMarkers = [];
let distanceLines = [];

// Drone SVG icon — stealth flying wing (top-down, nose points up)
const DRONE_SVG = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 6 L4 24 L8 22 L16 20 L24 22 L28 24 Z"
    fill="#5f8fad" stroke="#3d6b85" stroke-width="1" opacity="0.95"/>
  <path d="M16 6 L16 20" stroke="#d0d0d6" stroke-width="0.5" opacity="0.4"/>
</svg>`;

// Smaller stealth drone for fleet markers
const FLEET_DRONE_SVG = (color) => `<svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 4 L3 18 L6 16.5 L12 15 L18 16.5 L21 18 Z"
    fill="${color}" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/>
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

  // Esri World Imagery satellite tiles (free, no API key)
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
  }).addTo(map);

  // Zoom control bottom-right (desktop)
  if (window.innerWidth >= 768) {
    L.control.zoom({ position: 'bottomright' }).addTo(map);
  }

  // Flight trail polyline
  flightTrail = L.polyline([], {
    color: '#5f8fad',
    weight: 3,
    opacity: 0.7,
    dashArray: '8 4',
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
    // Invalidate size after display change
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

  // Add to flight trail
  trailCoords.push(latlng);
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

  // Remove existing
  if (searchCircle) { map.removeLayer(searchCircle); searchCircle = null; }
  if (searchLabel) { map.removeLayer(searchLabel); searchLabel = null; }

  if (!zone) return;

  if (zone.bias) {
    // Oblong search zone: stretched in the direction of travel from the origin point
    const origin = zone.origin || zone.center;
    const pts = generateOblong(origin, zone.center, zone.radius, zone.bias);
    searchCircle = L.polygon(pts, {
      color: '#7ab0d0',
      weight: 3,
      dashArray: '10 6',
      fillColor: '#5f8fad',
      fillOpacity: 0.22,
      smoothFactor: 2,
    }).addTo(map);
  } else {
    searchCircle = L.circle(zone.center, {
      radius: zone.radius,
      color: '#5f8fad',
      weight: 3,
      dashArray: '8 6',
      fillColor: '#5f8fad',
      fillOpacity: 0.20,
    }).addTo(map);
  }

  // Label at the widest part of the zone
  const labelText = zone.bias
    ? `SEARCH ZONE — ${zone.bias.toUpperCase()}BOUND`
    : 'SEARCH ZONE';
  searchLabel = L.marker(zone.center, {
    icon: L.divIcon({
      className: 'search-zone-label',
      html: labelText,
      iconSize: [200, 20],
      iconAnchor: [100, 10],
    }),
    interactive: false,
  }).addTo(map);
}

/**
 * Generate a teardrop/oblong shape from origin stretching toward center.
 * Narrow at origin (last known), widens toward the search center, rounded at far end.
 * Total length ~2x radius, max width ~1x radius.
 */
function generateOblong(origin, center, radius, bias) {
  const segments = 64;
  const rLat = radius / 111320;
  const rLng = radius / (111320 * Math.cos(center[0] * Math.PI / 180));

  // Direction angle from origin to center
  // In lat/lng: lat is Y (north+), lng is X (east+)
  const dLat = center[0] - origin[0];
  const dLng = center[1] - origin[1];
  const angle = Math.atan2(dLng, dLat);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // Total length of shape: from origin to 2x radius past origin
  const length = rLat * 2.5;
  const maxWidth = rLng * 1.2;

  const right = [];
  const left = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;

    // Position along the travel axis from origin
    const along = t * length;

    // Width profile: teardrop — starts at 0, widens to max around 60%, rounds off
    let w;
    if (t < 0.08) {
      // Point at origin
      w = maxWidth * 0.05 * (t / 0.08);
    } else if (t < 0.6) {
      // Expanding — smooth ease-out curve
      const mt = (t - 0.08) / 0.52;
      w = maxWidth * (0.05 + 0.95 * (1 - (1 - mt) * (1 - mt)));
    } else {
      // Rounded far end — semicircle
      const ft = (t - 0.6) / 0.4;
      w = maxWidth * Math.cos(ft * Math.PI / 2);
    }

    // Generate points on both sides, rotated to match travel direction
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
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
      zIndexOffset: 900,
    }).addTo(map);
    // Target label
    targetLabel = L.marker(latlng, {
      icon: L.divIcon({
        className: 'target-map-label',
        html: 'TARGET DETECTED',
        iconSize: [140, 20],
        iconAnchor: [70, 36],
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
    // Update label to confirmed
    if (targetLabel) {
      const labelEl = targetLabel.getElement();
      if (labelEl) {
        labelEl.querySelector('.target-map-label').textContent = 'TARGET CONFIRMED';
        labelEl.querySelector('.target-map-label').classList.add('confirmed');
      }
    }
    // Add orbit circle
    const pos = state.get('targetPosition');
    if (pos && !orbitCircle) {
      orbitCircle = L.circle([pos.lat, pos.lng], {
        radius: 80,
        color: '#4a9a65',
        weight: 2.5,
        dashArray: '6 4',
        fillColor: '#4a9a65',
        fillOpacity: 0.06,
      }).addTo(map);
    }
  }
}

/** Add a waypoint marker to the map */
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

/** Remove a waypoint */
export function removeWaypoint(id) {
  if (!map || !waypointMarkers.has(id)) return;
  map.removeLayer(waypointMarkers.get(id));
  waypointMarkers.delete(id);
}

/** Smoothly fly the map view to a location */
export function flyTo(lat, lng, zoom, duration = 2) {
  if (!map) return;
  // Ensure map knows its current container size (may have been hidden at init)
  map.invalidateSize({ animate: false });
  const container = map.getContainer();
  // Fall back to setView if map has no rendered size (e.g. behind FPV layer)
  if (!container.offsetWidth || !container.offsetHeight) {
    map.setView([lat, lng], zoom || map.getZoom());
  } else {
    map.flyTo([lat, lng], zoom || map.getZoom(), { duration });
  }
}

/** Pan map without animation */
export function panTo(lat, lng) {
  if (!map) return;
  map.panTo([lat, lng]);
}

/** Invalidate map size (call after layout changes) */
export function resize() {
  if (map) {
    requestAnimationFrame(() => map.invalidateSize());
  }
}

/** Clear flight trail */
export function clearTrail() {
  trailCoords = [];
  if (flightTrail) flightTrail.setLatLngs([]);
}

/** Get the raw Leaflet map instance (for advanced usage) */
export function getMap() {
  return map;
}

// ── Incident Markers ──────────────────────────────────────

const INCIDENT_ICONS = {
  1: { color: '#b85454', icon: 'P1' },
  2: { color: '#a89540', icon: 'P2' },
  3: { color: '#5c5c66', icon: 'P3' },
};

/** Show incident markers on the map. Returns cleanup function. */
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
          <span class="material-symbols-outlined" style="font-size:20px;color:var(--icon-on-status)">${inc.icon || 'location_on'}</span>
        </div>
        <div class="incident-map-label">${inc.type} #${incNumber}</div>`,
        iconSize: [160, 54],
        iconAnchor: [22, 22],
      }),
      zIndexOffset: 800,
    }).addTo(map);

    marker.on('click', () => onSelect?.(inc));

    // Hover tooltip
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

/** Clear all incident markers */
export function clearIncidentMarkers() {
  for (const m of incidentMarkers) map?.removeLayer(m);
  incidentMarkers = [];
}

/** Highlight a specific incident (zoom to it) */
export function focusIncident(coordinates, zoom = 16) {
  if (!map || !coordinates) return;
  requestAnimationFrame(() => {
    map.invalidateSize();
    map.flyTo(coordinates, zoom, { duration: 1 });
  });
}

// ── Fleet Drone Markers ───────────────────────────────────

const FLEET_COLORS = {
  available: '#5f8fad',
  'in-mission': '#a89540',
  offline: '#3a3a42',
};

/** Show drone fleet markers on map with optional distance lines to a point */
export function showFleetDrones(drones, incidentCoords, onSelect, { skipFitBounds = false } = {}) {
  clearFleetMarkers();
  if (!map) return;

  const bounds = [];
  if (incidentCoords) bounds.push(incidentCoords);

  for (const drone of drones) {
    if (!drone.coordinates) continue;
    const color = FLEET_COLORS[drone.status] || FLEET_COLORS.offline;
    const isAvailable = drone.status === 'available';

    const isAssigned = drone.status === 'in-mission' && drone.assignedIncident;
    const marker = L.marker(drone.coordinates, {
      icon: L.divIcon({
        className: 'fleet-drone-marker',
        html: `<div class="fleet-drone-dot${isAssigned ? ' linked' : ''}" style="--drone-color:${color}">
          ${FLEET_DRONE_SVG(color)}
        </div>
        <div class="fleet-drone-label">${drone.name}${drone.distanceFromIncident != null ? ' · ' + drone.distanceFromIncident + ' km' : ''}</div>`,
        iconSize: [140, 52],
        iconAnchor: [20, 20],
      }),
      zIndexOffset: isAvailable ? 850 : 700,
      interactive: isAvailable,
    }).addTo(map);

    if (isAvailable) {
      marker.on('click', () => onSelect?.(drone));
    }

    // Hover tooltip
    const statusLabel = drone.status === 'available' ? 'Available'
      : drone.status === 'in-mission' ? `In Mission (${drone.operator})`
      : 'Offline';
    const tooltip = L.tooltip({
      direction: 'top',
      offset: [0, -20],
      className: 'map-tooltip',
    });
    tooltip.setContent(`<strong>${drone.name}</strong><br>${statusLabel} · ${drone.battery}% battery${drone.distanceFromIncident != null ? '<br>' + drone.distanceFromIncident + ' km from incident' : ''}`);
    marker.bindTooltip(tooltip);

    // Distance line from drone to incident with midpoint label
    if (incidentCoords && isAvailable) {
      const line = L.polyline([drone.coordinates, incidentCoords], {
        color,
        weight: 3,
        opacity: 0.7,
        dashArray: '12 8',
      }).addTo(map);
      distanceLines.push(line);

      // Midpoint label with distance + ETA
      if (drone.distanceFromIncident != null) {
        const mid = [
          (drone.coordinates[0] + incidentCoords[0]) / 2,
          (drone.coordinates[1] + incidentCoords[1]) / 2,
        ];
        const etaSec = Math.round(drone.distanceFromIncident / 60 * 3600);
        const etaLabel = etaSec >= 60 ? `${Math.round(etaSec / 60)}m ${etaSec % 60}s` : `${etaSec}s`;
        const labelMarker = L.marker(mid, {
          icon: L.divIcon({
            className: 'route-line-label',
            html: `${drone.distanceFromIncident} km · ${etaLabel} ETA`,
            iconSize: [120, 22],
            iconAnchor: [60, 11],
          }),
          interactive: false,
          zIndexOffset: 860,
        }).addTo(map);
        distanceLines.push(labelMarker);
      }
    }

    fleetMarkers.push(marker);
    bounds.push(drone.coordinates);
  }

  if (!skipFitBounds && bounds.length > 1) {
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
  }
}

/** Fit map to show all currently visible markers (incidents + drones) */
export function fitAllMarkers(padding = [60, 60], maxZoom = 12) {
  if (!map) return;
  // Ensure Leaflet knows the actual container size before fitting
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

/** Clear fleet drone markers and distance lines */
export function clearFleetMarkers() {
  for (const m of fleetMarkers) map?.removeLayer(m);
  for (const l of distanceLines) map?.removeLayer(l);
  fleetMarkers = [];
  distanceLines = [];
}

/** Clear all overlay markers (incidents + fleet + route lines) */
export function clearOverlays() {
  clearIncidentMarkers();
  clearFleetMarkers();
  clearRouteLines();
}

// ── Route Lines with Labels ──────────────────────────────

let routeLineOverlays = [];

/** Draw a route line from→to with a midpoint label. Returns cleanup ref. */
export function addRouteLine(from, to, { color = '#5f8fad', weight = 3, dashArray = '12 8', opacity = 0.7, label = '' } = {}) {
  if (!map) return;

  const line = L.polyline([from, to], { color, weight, opacity, dashArray }).addTo(map);
  routeLineOverlays.push(line);

  if (label) {
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const labelMarker = L.marker(mid, {
      icon: L.divIcon({
        className: 'route-line-label',
        html: label,
        iconSize: [140, 22],
        iconAnchor: [70, 11],
      }),
      interactive: false,
      zIndexOffset: 860,
    }).addTo(map);
    routeLineOverlays.push(labelMarker);
  }
}

/** Clear all manually added route lines */
export function clearRouteLines() {
  for (const o of routeLineOverlays) map?.removeLayer(o);
  routeLineOverlays = [];
}

/** Show a preview search zone circle (fainter, for briefing screens) */
export function showSearchZonePreview(center, radius, fillOpacity = 0.08) {
  if (!map) return;
  const circle = L.circle(center, {
    radius,
    color: '#5f8fad',
    weight: 2,
    dashArray: '8 6',
    fillColor: '#5f8fad',
    fillOpacity,
  }).addTo(map);
  routeLineOverlays.push(circle);
}
