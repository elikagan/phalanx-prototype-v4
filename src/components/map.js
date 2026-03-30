/**
 * Map Component — Leaflet satellite map
 *
 * MAP OVERLAY COLOR SYSTEM (separate from UI design tokens)
 * These are tuned for satellite imagery visibility, not dark-UI aesthetics.
 *
 *   Route blue:    #4285F4  (Google Maps blue — proven on satellite)
 *   Route outline: #ffffff  (white border, not black — pops on any terrain)
 *   Search zone:   #00B4D8  (bright cyan — distinct from route blue)
 *   Alert red:     #EA4335  (bright, unmistakable)
 *   Confirm green: #34A853  (bright, clear)
 *   Amber:         #FBBC04  (bright warning/in-mission)
 *   Label bg:      #4285F4  (blue pill) or rgba(30,30,34,0.92) (dark pill)
 *   Drone fill:    #4285F4  (matches routes for cohesion)
 */

import L from 'leaflet';
import * as state from '../state.js';
import { MAP_CENTER, MAP_ZOOM } from '../scenarios/san-diego-pursuit.js';

// ── Map Overlay Palette ────────────────────────────────────
const MAP_COLORS = {
  route: '#4285F4',       // bright blue
  routeOutline: '#ffffff', // white outline for contrast on satellite
  search: '#00B4D8',      // bright cyan (distinct from route blue)
  alert: '#EA4335',       // bright red
  confirm: '#34A853',     // bright green
  amber: '#FBBC04',       // bright amber
  droneAvailable: '#4285F4',
  droneMission: '#FBBC04',
  droneOffline: '#666',
  labelBg: 'rgba(30, 30, 34, 0.92)',
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

// Drone SVG icon — stealth flying wing (top-down, nose points up)
// Bright blue fill with white stroke for satellite visibility
const DRONE_SVG = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 6 L4 24 L8 22 L16 20 L24 22 L28 24 Z"
    fill="${MAP_COLORS.route}" stroke="#fff" stroke-width="1.2" opacity="0.95"/>
  <path d="M16 6 L16 20" stroke="rgba(255,255,255,0.5)" stroke-width="0.5"/>
</svg>`;

// Smaller stealth drone for fleet markers
const FLEET_DRONE_SVG = (color) => `<svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 4 L3 18 L6 16.5 L12 15 L18 16.5 L21 18 Z"
    fill="${color}" stroke="#fff" stroke-width="1"/>
</svg>`;

const droneIcon = L.divIcon({
  className: 'drone-marker',
  html: DRONE_SVG,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
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

  // Flight trail — white outline underneath
  flightTrailOutline = L.polyline([], {
    color: '#ffffff',
    weight: 7,
    opacity: 0.5,
    lineCap: 'round',
  }).addTo(map);
  // Flight trail — bright blue line on top
  flightTrail = L.polyline([], {
    color: MAP_COLORS.route,
    weight: 4,
    opacity: 0.95,
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

  // Add to flight trail (both outline and colored line)
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

  // Remove existing
  if (searchCircle) { map.removeLayer(searchCircle); searchCircle = null; }
  if (searchLabel) { map.removeLayer(searchLabel); searchLabel = null; }

  if (!zone) return;

  if (zone.bias) {
    // Oblong search zone
    const origin = zone.origin || zone.center;
    const pts = generateOblong(origin, zone.center, zone.radius, zone.bias);
    searchCircle = L.polygon(pts, {
      color: MAP_COLORS.search,
      weight: 3,
      dashArray: '10 6',
      fillColor: MAP_COLORS.search,
      fillOpacity: 0.18,
      smoothFactor: 2,
    }).addTo(map);
  } else {
    searchCircle = L.circle(zone.center, {
      radius: zone.radius,
      color: MAP_COLORS.search,
      weight: 3,
      dashArray: '8 6',
      fillColor: MAP_COLORS.search,
      fillOpacity: 0.15,
    }).addTo(map);
  }

  // Label
  const labelText = zone.bias
    ? `SEARCH ZONE — ${zone.bias.toUpperCase()}BOUND`
    : 'SEARCH ZONE';
  searchLabel = L.marker(zone.center, {
    icon: L.divIcon({
      className: 'search-zone-label',
      html: labelText,
      iconSize: [200, 24],
      iconAnchor: [100, 12],
    }),
    interactive: false,
  }).addTo(map);
}

/**
 * Generate a teardrop/oblong shape from origin stretching toward center.
 */
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

/** Make the current search zone circle editable with drag handles */
export function makeSearchZoneEditable(onChange) {
  if (!map || !searchCircle) return;
  clearEditHandles();

  const isCircle = typeof searchCircle.getRadius === 'function';
  if (!isCircle) return; // Only circles are editable, not oblongs

  const center = searchCircle.getLatLng();
  const radius = searchCircle.getRadius();

  // Radius label that updates
  const radiusLabel = L.marker(center, {
    icon: L.divIcon({
      className: 'route-line-label',
      html: `${Math.round(radius)}m radius`,
      iconSize: [130, 28],
      iconAnchor: [65, 14],
    }),
    interactive: false,
    zIndexOffset: 870,
  }).addTo(map);
  editHandles.push(radiusLabel);

  // 4 drag handles at N, E, S, W
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
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
      draggable: true,
      zIndexOffset: 880,
    }).addTo(map);

    handle.on('drag', (e) => {
      const hPos = e.target.getLatLng();
      const newRadius = center.distanceTo(hPos);
      const clamped = Math.max(100, Math.min(2000, newRadius));
      searchCircle.setRadius(clamped);
      // Update all handles
      for (let i = 0; i < dirs.length; i++) {
        const hp = offsetLatLng(center, clamped, dirs[i].bearing);
        editHandles[i + 1].setLatLng(hp); // +1 because [0] is radiusLabel
      }
      // Update radius label
      radiusLabel.setIcon(L.divIcon({
        className: 'route-line-label',
        html: `${Math.round(clamped)}m radius`,
        iconSize: [130, 28],
        iconAnchor: [65, 14],
      }));
      if (onChange) onChange({ center: [center.lat, center.lng], radius: clamped });
    });

    editHandles.push(handle);
  }

  // Center drag handle (reposition entire zone)
  const centerHandle = L.marker(center, {
    icon: L.divIcon({
      className: 'edit-handle center-handle',
      html: '<span class="material-symbols-outlined" style="font-size:14px;color:#fff">open_with</span>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
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
    // Update directional handles
    for (let i = 0; i < dirs.length; i++) {
      const hp = offsetLatLng(newCenter, r, dirs[i].bearing);
      editHandles[i + 1].setLatLng(hp);
    }
    if (onChange) onChange({ center: [newCenter.lat, newCenter.lng], radius: r });
  });

  editHandles.push(centerHandle);
}

/** Clear all edit handles */
export function clearEditHandles() {
  for (const h of editHandles) map?.removeLayer(h);
  editHandles = [];
}

/** Calculate a lat/lng offset by distance (meters) and bearing (degrees) */
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
        iconSize: [150, 24],
        iconAnchor: [75, 38],
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
        color: MAP_COLORS.confirm,
        weight: 2.5,
        dashArray: '6 4',
        fillColor: MAP_COLORS.confirm,
        fillOpacity: 0.08,
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
      iconSize: [80, 44],
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
  map.invalidateSize({ animate: false });
  const container = map.getContainer();
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
  if (flightTrailOutline) flightTrailOutline.setLatLngs([]);
}

/** Get the raw Leaflet map instance (for advanced usage) */
export function getMap() {
  return map;
}

// ── Incident Markers ──────────────────────────────────────

// Bright, satellite-visible incident colors
const INCIDENT_ICONS = {
  1: { color: '#EA4335', icon: 'P1' },   // bright red
  2: { color: '#FBBC04', icon: 'P2' },   // bright amber
  3: { color: '#999', icon: 'P3' },       // muted gray
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
          <span class="material-symbols-outlined" style="font-size:20px;color:#fff">${inc.icon || 'location_on'}</span>
        </div>
        <div class="incident-map-label">${inc.type} #${incNumber}</div>`,
        iconSize: [160, 60],
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

/** Show drone fleet markers on map with optional distance lines to a point */
export function showFleetDrones(drones, incidentCoords, onSelect, { skipFitBounds = false } = {}) {
  clearFleetMarkers();
  if (!map) return;

  const bounds = [];
  if (incidentCoords) bounds.push(incidentCoords);

  // Track label positions to offset overlapping ones
  let labelIndex = 0;

  for (const drone of drones) {
    if (!drone.coordinates) continue;
    const isAvailable = drone.status === 'available';
    const isMission = drone.status === 'in-mission';
    const color = isAvailable ? MAP_COLORS.droneAvailable
      : isMission ? MAP_COLORS.droneMission
      : MAP_COLORS.droneOffline;

    const isAssigned = isMission && drone.assignedIncident;
    const marker = L.marker(drone.coordinates, {
      icon: L.divIcon({
        className: 'fleet-drone-marker',
        html: `<div class="fleet-drone-dot${isAssigned ? ' linked' : ''}" style="--drone-color:${color}">
          ${FLEET_DRONE_SVG(color)}
        </div>
        <div class="fleet-drone-label">${drone.name}${drone.distanceFromIncident != null ? ' · ' + drone.distanceFromIncident + ' km' : ''}</div>`,
        iconSize: [160, 56],
        iconAnchor: [21, 21],
      }),
      zIndexOffset: isAvailable ? 850 : 700,
      interactive: isAvailable,
    }).addTo(map);

    if (isAvailable) {
      marker.on('click', () => onSelect?.(drone));
    }

    // Hover tooltip
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

    // Route line from drone to incident — white-outline + bright blue
    if (incidentCoords && isAvailable) {
      // White outline (wider, underneath) — reads on any satellite terrain
      const outline = L.polyline([drone.coordinates, incidentCoords], {
        color: '#ffffff',
        weight: 7,
        opacity: 0.5,
        lineCap: 'round',
      }).addTo(map);
      distanceLines.push(outline);
      // Bright blue route line on top
      const line = L.polyline([drone.coordinates, incidentCoords], {
        color: MAP_COLORS.route,
        weight: 4,
        opacity: 0.95,
        lineCap: 'round',
      }).addTo(map);
      distanceLines.push(line);

      // Midpoint label with distance + ETA
      // Offset vertically for multiple drones so labels don't stack
      if (drone.distanceFromIncident != null) {
        const t = 0.35 + labelIndex * 0.3; // stagger along the line (35%, 65%, etc.)
        const mid = [
          drone.coordinates[0] + (incidentCoords[0] - drone.coordinates[0]) * t,
          drone.coordinates[1] + (incidentCoords[1] - drone.coordinates[1]) * t,
        ];
        const etaSec = Math.round(drone.distanceFromIncident / 60 * 3600);
        const etaLabel = etaSec >= 60 ? `${Math.round(etaSec / 60)}m ${etaSec % 60}s` : `${etaSec}s`;
        const labelMarker = L.marker(mid, {
          icon: L.divIcon({
            className: 'route-line-label',
            html: `${drone.distanceFromIncident} km · ${etaLabel}`,
            iconSize: [140, 28],
            iconAnchor: [70, 14],
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

/** Fit map to show all currently visible markers (incidents + drones) */
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

/** Draw a route line from→to with a midpoint label (white-outline + bright blue). */
export function addRouteLine(from, to, { color = MAP_COLORS.route, weight = 4, opacity = 0.95, label = '' } = {}) {
  if (!map) return;

  // White outline underneath
  const outline = L.polyline([from, to], { color: '#ffffff', weight: weight + 4, opacity: 0.5, lineCap: 'round' }).addTo(map);
  routeLineOverlays.push(outline);
  // Bright colored line on top
  const line = L.polyline([from, to], { color, weight, opacity, lineCap: 'round' }).addTo(map);
  routeLineOverlays.push(line);

  if (label) {
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const labelMarker = L.marker(mid, {
      icon: L.divIcon({
        className: 'route-line-label',
        html: label,
        iconSize: [150, 28],
        iconAnchor: [75, 14],
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

/** Show a search zone circle around the target area */
export function showSearchZonePreview(center, radius, fillOpacity = 0.12) {
  if (!map) return;
  // Outer glow ring
  const glow = L.circle(center, {
    radius: radius + 50,
    color: MAP_COLORS.search,
    weight: 1,
    opacity: 0.25,
    fillColor: MAP_COLORS.search,
    fillOpacity: 0.04,
  }).addTo(map);
  routeLineOverlays.push(glow);
  // Main circle — solid outline, visible fill
  const circle = L.circle(center, {
    radius,
    color: MAP_COLORS.search,
    weight: 3,
    opacity: 0.9,
    fillColor: MAP_COLORS.search,
    fillOpacity,
  }).addTo(map);
  routeLineOverlays.push(circle);
  // Label
  const label = L.marker(center, {
    icon: L.divIcon({
      className: 'search-zone-label',
      html: 'SEARCH AREA',
      iconSize: [130, 24],
      iconAnchor: [65, 12],
    }),
    interactive: false,
  }).addTo(map);
  routeLineOverlays.push(label);
}
