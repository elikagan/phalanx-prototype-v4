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

// Drone SVG icon
const DRONE_SVG = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 4 L20 12 L28 16 L20 20 L16 28 L12 20 L4 16 L12 12 Z"
    fill="#5f8fad" stroke="#3d6b85" stroke-width="1.5" opacity="0.9"/>
  <circle cx="16" cy="16" r="3" fill="#d0d0d6" opacity="0.8"/>
</svg>`;

const droneIcon = L.divIcon({
  className: 'drone-marker',
  html: DRONE_SVG,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
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
    weight: 2,
    opacity: 0.5,
    dashArray: '4 6',
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

  searchCircle = L.circle(zone.center, {
    radius: zone.radius,
    color: '#5f8fad',
    weight: 1.5,
    dashArray: '8 6',
    fillColor: '#5f8fad',
    fillOpacity: 0.06,
  }).addTo(map);

  // Label
  const labelText = zone.bias
    ? `SEARCH ZONE — ${zone.bias.toUpperCase()}BOUND`
    : 'SEARCH ZONE';
  searchLabel = L.marker(zone.center, {
    icon: L.divIcon({
      className: 'search-zone-label',
      html: labelText,
      iconSize: [200, 20],
      iconAnchor: [100, -zone.radius * 0.0004], // approximate offset above circle
    }),
    interactive: false,
  }).addTo(map);
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
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
      zIndexOffset: 900,
    }).addTo(map);
  } else {
    targetMarker.setLatLng(latlng);
  }
}

function onTargetStatus(status) {
  if (!targetMarker) return;
  const el = targetMarker.getElement();
  if (!el) return;

  if (status === 'confirmed' || status === 'tracking') {
    el.querySelector('.target-marker')?.classList.add('confirmed');
    // Add orbit circle
    const pos = state.get('targetPosition');
    if (pos && !orbitCircle) {
      orbitCircle = L.circle([pos.lat, pos.lng], {
        radius: 80,
        color: '#4a9a65',
        weight: 1.5,
        dashArray: '6 4',
        fill: false,
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
