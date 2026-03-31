/**
 * San Diego Vehicle Pursuit — Demo Scenario
 *
 * Real San Diego coordinates. Real street names.
 * All incidents, drones, and timeline events for the 911 path.
 */

// Map center: San Diego metro area
export const MAP_CENTER = [32.7350, -117.1500];
export const MAP_ZOOM = 12;

// Incident locations — spread across San Diego
export const INCIDENTS = [
  {
    id: 'inc-4471',
    priority: 1,
    type: 'Vehicle Pursuit',
    location: 'El Cajon Blvd & 30th St',
    coordinates: [32.7510, -117.1290],
    time: '9:15 PM',
    elapsed: '12 min ago',
    units: 3,
    narrative: 'Red sedan fled traffic stop at high speed, heading southbound on 30th. 3 units in pursuit.',
    icon: 'directions_car',
  },
  {
    id: 'inc-4468',
    priority: 2,
    type: 'Missing Person',
    location: 'Mission Hills',
    coordinates: [32.7530, -117.1950],
    time: '8:45 PM',
    elapsed: '42 min ago',
    units: 1,
    narrative: '72-year-old male wandered from care facility. Last seen wearing gray jacket near Pioneer Park.',
    icon: 'person_search',
  },
  {
    id: 'inc-4473',
    priority: 3,
    type: 'Suspicious Vehicle',
    location: 'National City, E 8th St',
    coordinates: [32.6750, -117.0990],
    time: '9:30 PM',
    elapsed: '2 min ago',
    units: 0,
    narrative: 'Black van idling in residential area for 15+ minutes. No plates visible.',
    icon: 'local_shipping',
  },
];

// Fleet drones — realistic mix of ground, surveillance, and mission
// Statuses: 'standby' (ground/home), 'surveillance' (airborne patrol), 'in-mission' (assigned), 'offline'
export const DRONES = [
  // ── Surveillance drones (airborne, can be rerouted) ──
  {
    id: 'dsa-128',
    name: 'Delta SA-128',
    status: 'surveillance',
    battery: 72,
    signal: 'strong',
    coordinates: [32.7350, -117.1050],
    distanceFromIncident: 2.3,
    patrol: 'North Park grid',
  },
  {
    id: 'dsa-064',
    name: 'Delta SA-064',
    status: 'surveillance',
    battery: 67,
    signal: 'good',
    coordinates: [32.7680, -117.1820],
    distanceFromIncident: 4.8,
    patrol: 'Hillcrest grid',
  },
  {
    id: 'dsa-091',
    name: 'Delta SA-091',
    status: 'surveillance',
    battery: 81,
    signal: 'strong',
    coordinates: [32.7150, -117.1650],
    distanceFromIncident: 5.1,
    patrol: 'Downtown grid',
  },
  // ── In-mission drone (assigned to incident) ──
  {
    id: 'dsa-256',
    name: 'Delta SA-256',
    status: 'in-mission',
    battery: 54,
    signal: 'good',
    operator: 'J. Torres',
    assignedIncident: 'inc-4473',
    coordinates: [32.6750, -117.0990],
    distanceFromIncident: null,
  },
  // ── Standby drones (on ground at home bases) ──
  // readyState: 'ready' (charged, preflight done) or 'charging' (refueling)
  {
    id: 'dsa-032',
    name: 'Delta SA-032',
    status: 'standby',
    readyState: 'ready',
    battery: 98,
    signal: 'strong',
    base: 'Kearny Mesa HQ',
    coordinates: [32.7990, -117.1530],
  },
  {
    id: 'dsa-044',
    name: 'Delta SA-044',
    status: 'standby',
    readyState: 'ready',
    battery: 100,
    signal: 'strong',
    base: 'Kearny Mesa HQ',
    coordinates: [32.7990, -117.1530],
  },
  {
    id: 'dsa-019',
    name: 'Delta SA-019',
    status: 'standby',
    readyState: 'charging',
    battery: 41,
    signal: 'strong',
    base: 'Kearny Mesa HQ',
    coordinates: [32.7990, -117.1530],
  },
  {
    id: 'dsa-077',
    name: 'Delta SA-077',
    status: 'standby',
    readyState: 'ready',
    battery: 95,
    signal: 'strong',
    base: 'National City Station',
    coordinates: [32.7100, -117.1350],
  },
  {
    id: 'dsa-015',
    name: 'Delta SA-015',
    status: 'standby',
    readyState: 'charging',
    battery: 23,
    signal: 'strong',
    base: 'National City Station',
    coordinates: [32.7100, -117.1350],
  },
];

// SARA analysis data for the vehicle pursuit incident
export const SARA_ANALYSIS = {
  incidentId: 'inc-4471',
  transcriptsAnalyzed: 3,
  transcriptText: `[21:15] Unit 42: "Dispatch, I've got a red sedan, possible Honda, refusing to stop. Heading south on 30th from El Cajon Blvd, speed approximately 45. Partial plate: seven-x-ray-three."
[21:18] Unit 38: "Copy, I'm picking up at University and 30th. Vehicle still southbound."
[21:22] Unit 51: "Suspect has headlights off, weaving through residential. Lost visual near Dwight."`,
  target: {
    vehicle: 'Red sedan (Honda)',
    plate: 'Partial — **7X3',
    lastSeen: 'El Cajon Blvd & 30th St',
    lastSeenTime: '12 min ago at 9:15 PM',
    speed: '~45 mph southbound',
    suspect: 'Male, dark clothing',
    respondingUnits: 3,
  },
};

// Mission briefing data
export const MISSION_BRIEFING = {
  target: 'Red sedan (Honda), partial plate **7X3',
  lastKnown: 'El Cajon Blvd & 30th St, 12 min ago',
  direction: 'Southbound at ~45 mph',
  searchArea: '500m radius, southbound bias from last known position',
  drone: 'DSA-128, ETA to search area: 90 seconds',
  respondingUnits: ['Unit 42', 'Unit 38', 'Unit 51'],
};

// Search zone config
export const SEARCH_ZONE = {
  origin: [32.7510, -117.1290],  // incident location (last known)
  center: [32.7440, -117.1290],  // center of search area (biased south)
  radius: 500,
  bias: 'south',
};

// Waypoints
export const WAYPOINTS = {
  lastKnown: {
    coordinates: [32.7510, -117.1290],
    label: 'LAST KNOWN',
  },
  searchCenter: {
    coordinates: [32.7440, -117.1290],
    label: 'SEARCH ZONE — SOUTHBOUND',
  },
  dwightSt: {
    coordinates: [32.7400, -117.1310],
    label: 'DWIGHT & 30TH',
  },
};

// Pre-flight checklist
export const PREFLIGHT_CHECKS = [
  { label: 'Battery', value: '98%', icon: 'battery_full' },
  { label: 'GPS Lock', value: '12 satellites', icon: 'satellite_alt' },
  { label: 'Signal', value: 'Strong', icon: 'signal_cellular_alt' },
  { label: 'Compass', value: 'Calibrated', icon: 'explore' },
  { label: 'Airspace', value: 'Clear — no TFR', icon: 'airplanemode_active' },
  { label: 'Weather', value: 'Clear, 5 mph wind', icon: 'air' },
];

// 8 scripted narrative exchanges (screens 9-13)
export const EXCHANGES = [
  {
    id: 'ex-1',
    screen: 9,
    userText: "SARA, what's the latest from dispatch on this vehicle?",
    saraText: "Last update 2 minutes ago. Unit 42 had visual near El Cajon and 30th. Suspect heading southbound, headlights off.",
    radio: {
      time: '9:21 PM',
      unit: 'Unit 42',
      text: 'Unit 42 reports visual on red sedan near El Cajon Blvd & 30th',
    },
    mapActions: [],
  },
  {
    id: 'ex-2',
    screen: 9,
    userText: "Focus the search south of University Ave. Check the side streets off 30th.",
    saraText: "Confirmed. Adjusting search pattern. Prioritizing residential blocks south of University along 30th.",
    radio: null,
    mapActions: [
      { action: 'shiftSearchZone', center: [32.7410, -117.1300], bias: 'south' },
      { action: 'rotateDrone', heading: 180 },
    ],
  },
  {
    id: 'ex-3',
    screen: 9,
    userText: null, // SARA-initiated
    saraText: "Dispatch update — Unit 38 reports suspect vehicle turned west on Dwight. Updating search area.",
    radio: {
      time: '9:25 PM',
      unit: 'Unit 38',
      text: 'Unit 38: suspect vehicle turned west on Dwight St',
    },
    mapActions: [
      { action: 'shiftSearchZone', center: [32.7400, -117.1330], bias: 'west' },
      { action: 'addWaypoint', id: 'dwight', coordinates: [32.7400, -117.1310], label: 'DWIGHT & 30TH' },
    ],
  },
  {
    id: 'ex-4',
    screen: 9,
    userText: "I see something on the feed. Red car parked on Dwight, near the alley. Can you get closer?",
    saraText: "Moving in. Descending to 60 meters for closer visual.",
    radio: null,
    mapActions: [
      { action: 'flyTo', lat: 32.7400, lng: -117.1310, zoom: 18, duration: 2.5 },
      { action: 'updateTelemetry', key: 'altitude', value: 60 },
    ],
  },
  {
    id: 'ex-5',
    screen: 10,
    userText: "That's it. Red Honda, dented bumper. Lock on and orbit.",
    saraText: "Target acquired. Entering orbit mode. Maintaining visual on red sedan, Dwight Street.",
    radio: null,
    mapActions: [
      { action: 'setTarget', coordinates: [32.7400, -117.1310], status: 'confirmed' },
      { action: 'removeSearchZone' },
      { action: 'startOrbit' },
    ],
  },
  {
    id: 'ex-6',
    screen: 11,
    userText: "Someone's getting out. Zoom in on the driver side.",
    saraText: "Adjusting camera. One individual exiting driver side, heading east on foot.",
    radio: {
      time: '9:29 PM',
      unit: 'SARA → Dispatch',
      text: 'Phalanx has visual. Suspect exiting vehicle, eastbound on foot.',
    },
    mapActions: [
      { action: 'repositionOrbit', angle: 45 },
    ],
  },
  {
    id: 'ex-7',
    screen: 11,
    userText: null, // SARA-initiated
    saraText: "Vehicle is moving. Second occupant driving. Heading south on 30th. Tracking.",
    radio: null,
    mapActions: [
      { action: 'moveTarget', coordinates: [32.7360, -117.1310], heading: 180 },
      { action: 'followTarget' },
    ],
  },
  {
    id: 'ex-8',
    screen: 12,
    userText: "Ground units have the suspect. Good work. Return home.",
    saraText: "Confirmed. Returning to base. ETA 3 minutes. Mission data saved.",
    radio: null,
    mapActions: [
      { action: 'returnHome' },
    ],
  },
];

// Mission summary (screen 13)
export const MISSION_SUMMARY = {
  duration: '14 min 32 sec',
  areaCovered: '0.8 km²',
  targetFound: 'Yes',
  batteryUsed: '22%',
  distanceFlown: '4.2 km',
  maxAltitude: '120m',
};
