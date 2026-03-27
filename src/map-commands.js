/**
 * Map Command Executor
 *
 * Executes structured commands from SARA/orchestrator on the map.
 * Each command type maps to a map component operation.
 */

import * as state from './state.js';
import * as mapComponent from './components/map.js';

const DRONE_HOME = { lat: 32.7200, lng: -117.1550 }; // DSA-128 home base

/** Execute a single map command */
export async function execute(cmd) {
  switch (cmd.action) {
    case 'flyTo':
      mapComponent.flyTo(cmd.lat, cmd.lng, cmd.zoom, cmd.duration || 2);
      state.set({ dronePosition: { lat: cmd.lat, lng: cmd.lng } });
      await wait((cmd.duration || 2) * 1000);
      break;

    case 'shiftSearchZone':
      state.set({
        searchZone: {
          center: cmd.center,
          radius: state.get('searchZone')?.radius || 500,
          bias: cmd.bias || null,
        },
      });
      mapComponent.flyTo(cmd.center[0], cmd.center[1], null, 1.5);
      await wait(1500);
      break;

    case 'rotateDrone':
      state.set({ droneHeading: cmd.heading });
      await wait(300);
      break;

    case 'addWaypoint':
      mapComponent.addWaypoint(cmd.id, cmd.coordinates, cmd.label);
      await wait(200);
      break;

    case 'removeWaypoint':
      mapComponent.removeWaypoint(cmd.id);
      await wait(200);
      break;

    case 'updateTelemetry':
      if (cmd.key === 'altitude') {
        state.set({ droneAltitude: cmd.value });
      } else if (cmd.key === 'speed') {
        state.set({ droneSpeed: cmd.value });
      }
      break;

    case 'setTarget':
      state.set({
        targetPosition: { lat: cmd.coordinates[0], lng: cmd.coordinates[1] },
        targetStatus: cmd.status || 'detected',
      });
      await wait(300);
      break;

    case 'removeSearchZone':
      state.set({ searchZone: null });
      await wait(200);
      break;

    case 'startOrbit':
      // Drone enters orbit pattern around target
      state.set({ droneSpeed: 20 });
      await wait(300);
      break;

    case 'repositionOrbit':
      // Adjust drone position on the orbit ring
      const target = state.get('targetPosition');
      if (target) {
        const angle = (cmd.angle || 0) * (Math.PI / 180);
        const orbitRadius = 0.0007; // ~80m in lat/lng
        state.set({
          dronePosition: {
            lat: target.lat + Math.cos(angle) * orbitRadius,
            lng: target.lng + Math.sin(angle) * orbitRadius,
          },
        });
      }
      await wait(300);
      break;

    case 'moveTarget':
      state.set({
        targetPosition: { lat: cmd.coordinates[0], lng: cmd.coordinates[1] },
      });
      mapComponent.flyTo(cmd.coordinates[0], cmd.coordinates[1], null, 2);
      if (cmd.heading != null) {
        state.set({ droneHeading: cmd.heading });
      }
      await wait(2000);
      break;

    case 'followTarget':
      // Drone follows target — just update position to track
      const tgt = state.get('targetPosition');
      if (tgt) {
        state.set({
          dronePosition: { lat: tgt.lat + 0.0005, lng: tgt.lng + 0.0003 },
        });
      }
      await wait(300);
      break;

    case 'returnHome':
      // Animate return path
      state.set({
        targetStatus: 'none',
        droneSpeed: 45,
        droneHeading: 0,
      });
      mapComponent.flyTo(DRONE_HOME.lat, DRONE_HOME.lng, 15, 3);
      state.set({ dronePosition: DRONE_HOME });
      await wait(3000);
      state.set({ droneSpeed: 0 });
      break;

    default:
      console.warn('Unknown map command:', cmd.action);
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
