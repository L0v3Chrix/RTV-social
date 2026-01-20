/**
 * Kill Switch Infrastructure
 *
 * Emergency controls for halting autonomous operations.
 */

export * from './types.js';
export { createKillSwitchService } from './kill-switch-service.js';
export { createAutoTripMonitor, type AutoTripMonitor } from './auto-trip.js';
