/**
 * San Diego Vehicle Pursuit — Demo Scenario
 *
 * Real San Diego coordinates. Real street names.
 * All incidents, drones, and timeline events for the 911 path.
 */

// Map center: San Diego, roughly Balboa Park area
export const MAP_CENTER = [32.7157, -117.1611];
export const MAP_ZOOM = 14;

// Incident locations
export const INCIDENTS = [
  {
    id: 'inc-4471',
    priority: 1,
    type: 'Vehicle Pursuit',
    location: '1200 Madison Ave',
    coordinates: [32.7245, -117.1498],
    time: '9:15 PM',
    elapsed: '12 min ago',
    units: 3,
    narrative: 'Red sedan fled traffic stop at high speed, heading southbound on Madison. 3 units in pursuit.',
    icon: 'directions_car',
  },
  {
    id: 'inc-4468',
    priority: 2,
    type: 'Missing Person',
    location: 'Maple Park area',
    coordinates: [32.7098, -117.1532],
    time: '8:45 PM',
    elapsed: '42 min ago',
    units: 1,
    narrative: '72-year-old male wandered from care facility. Last seen wearing gray jacket near Maple Park.',
    icon: 'person_search',
  },
  {
    id: 'inc-4473',
    priority: 3,
    type: 'Suspicious Vehicle',
    location: 'Oak & 5th',
    coordinates: [32.7185, -117.1565],
    time: '9:30 PM',
    elapsed: '2 min ago',
    units: 0,
    narrative: 'Black van idling in residential area for 15+ minutes. No plates visible.',
    icon: 'local_shipping',
  },
];

// Fleet drones
export const DRONES = [
  {
    id: 'dsa-128',
    name: 'Delta SA-128',
    status: 'available',
    battery: 98,
    signal: 'strong',
    coordinates: [32.7200, -117.1550],
    distanceFromIncident: 1.2, // km from inc-4471
  },
  {
    id: 'dsa-064',
    name: 'Delta SA-064',
    status: 'available',
    battery: 67,
    signal: 'good',
    coordinates: [32.7050, -117.1700],
    distanceFromIncident: 3.8,
  },
  {
    id: 'dsa-256',
    name: 'Delta SA-256',
    status: 'in-mission',
    battery: 54,
    signal: 'good',
    operator: 'J. Torres',
    coordinates: [32.7300, -117.1400],
    distanceFromIncident: null,
  },
  {
    id: 'dsa-032',
    name: 'Delta SA-032',
    status: 'offline',
    battery: 12,
    signal: 'none',
    coordinates: null,
    distanceFromIncident: null,
  },
];

// SARA analysis data for the vehicle pursuit incident
export const SARA_ANALYSIS = {
  incidentId: 'inc-4471',
  transcriptsAnalyzed: 3,
  transcriptText: `[21:15] Unit 42: "Dispatch, I've got a red sedan, possible Honda, refusing to stop. Heading south on Madison, speed approximately 45. Partial plate: seven-x-ray-three."
[21:18] Unit 38: "Copy, I'm picking up at Oak and Madison. Vehicle still southbound."
[21:22] Unit 51: "Suspect has headlights off, weaving through residential. Lost visual near Elm."`,
  target: {
    vehicle: 'Red sedan (Honda)',
    plate: 'Partial — **7X3',
    lastSeen: 'Madison & Oak',
    lastSeenTime: '12 min ago at 9:15 PM',
    speed: '~45 mph southbound',
    suspect: 'Male, dark clothing',
    respondingUnits: 3,
  },
};

// Mission briefing data
export const MISSION_BRIEFING = {
  target: 'Red sedan (Honda), partial plate **7X3',
  lastKnown: 'Madison & Oak, 12 min ago',
  direction: 'Southbound at ~45 mph',
  searchArea: '500m radius, southbound bias from last known position',
  drone: 'DSA-128, ETA to search area: 45 seconds',
  respondingUnits: ['Unit 42', 'Unit 38', 'Unit 51'],
};

// Search zone config
export const SEARCH_ZONE = {
  center: [32.7180, -117.1498],
  radius: 500,
  bias: 'south',
};

// Waypoints
export const WAYPOINTS = {
  lastKnown: {
    coordinates: [32.7245, -117.1498],
    label: 'LAST KNOWN',
  },
  searchCenter: {
    coordinates: [32.7180, -117.1498],
    label: 'SEARCH ZONE — SOUTHBOUND',
  },
  elmStreet: {
    coordinates: [32.7145, -117.1530],
    label: 'ELM & DUPONT',
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
    saraText: "Last update 2 minutes ago. Unit 42 had visual near Madison and Oak. Suspect heading southbound, headlights off.",
    radio: {
      time: '9:21 PM',
      unit: 'Unit 42',
      text: 'Unit 42 reports visual on red sedan near Madison & Oak',
    },
    mapActions: [],
  },
  {
    id: 'ex-2',
    screen: 9,
    userText: "Focus the search south of Oak. Check the side streets off Dupont.",
    saraText: "Confirmed. Adjusting search pattern. Prioritizing residential blocks south of Oak along Dupont.",
    radio: null,
    mapActions: [
      { action: 'shiftSearchZone', center: [32.7150, -117.1520], bias: 'south' },
      { action: 'rotateDrone', heading: 180 },
    ],
  },
  {
    id: 'ex-3',
    screen: 9,
    userText: null, // SARA-initiated
    saraText: "Dispatch update — Unit 38 reports suspect vehicle turned west on Elm. Updating search area.",
    radio: {
      time: '9:25 PM',
      unit: 'Unit 38',
      text: 'Unit 38: suspect vehicle turned west on Elm Street',
    },
    mapActions: [
      { action: 'shiftSearchZone', center: [32.7145, -117.1545], bias: 'west' },
      { action: 'addWaypoint', id: 'elm', coordinates: [32.7145, -117.1530], label: 'ELM & DUPONT' },
    ],
  },
  {
    id: 'ex-4',
    screen: 9,
    userText: "I see something on the feed. Red car parked on Elm, near the alley. Can you get closer?",
    saraText: "Moving in. Descending to 60 meters for closer visual.",
    radio: null,
    mapActions: [
      { action: 'flyTo', lat: 32.7145, lng: -117.1530, zoom: 18, duration: 2.5 },
      { action: 'updateTelemetry', key: 'altitude', value: 60 },
    ],
  },
  {
    id: 'ex-5',
    screen: 10,
    userText: "That's it. Red Honda, dented bumper. Lock on and orbit.",
    saraText: "Target acquired. Entering orbit mode. Maintaining visual on red sedan, Elm Street.",
    radio: null,
    mapActions: [
      { action: 'setTarget', coordinates: [32.7145, -117.1530], status: 'confirmed' },
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
    saraText: "Vehicle is moving. Second occupant driving. Heading south on Dupont. Tracking.",
    radio: null,
    mapActions: [
      { action: 'moveTarget', coordinates: [32.7120, -117.1530], heading: 180 },
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
