import { create } from 'zustand';
import { SOS_STATES } from '../theme/tokens';

export const useSOSFlowStore = create((set, get) => ({
  sosState: SOS_STATES.IDLE,
  holdProgress: 0,
  countdownSeconds: 0,
  sessionId: null,
  trackingUrl: null,
  dispatchError: null,
  alertStartedAt: null,

  setHoldProgress: (holdProgress) => set({ holdProgress }),

  transition: (sosState, extra = {}) => set({ sosState, ...extra }),

  reset: () =>
    set({
      sosState: SOS_STATES.IDLE,
      holdProgress: 0,
      countdownSeconds: 0,
      sessionId: null,
      trackingUrl: null,
      dispatchError: null,
      alertStartedAt: null,
    }),

  setSession: (sessionId, trackingUrl) =>
    set({ sessionId, trackingUrl, alertStartedAt: Date.now() }),

  setCountdown: (countdownSeconds) => set({ countdownSeconds }),

  setDispatchError: (dispatchError) => set({ dispatchError, sosState: SOS_STATES.IDLE }),
}));
