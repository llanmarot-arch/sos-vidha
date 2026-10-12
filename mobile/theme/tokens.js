import { createTheme } from './palette';
import { readAppearance } from './appearance';

export { createTheme } from './palette';

/** Fallback for non-React callers. Screens should use useTheme() so colours update live. */
export const tokens = createTheme(readAppearance());

export const SOS_STATES = {
  IDLE: 'IDLE',
  HOLDING: 'HOLDING',
  COUNTDOWN: 'COUNTDOWN',
  DISPATCHING: 'DISPATCHING',
  ACTIVE_ALERT: 'ACTIVE_ALERT',
};
