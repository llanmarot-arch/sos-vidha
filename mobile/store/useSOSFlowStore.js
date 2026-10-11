import { create } from 'zustand';
import { SOS_STATES } from '../theme/tokens';

const initialAlertState = {
  sessionId: null,
  localIncidentId: null,
  trackingUrl: null,
  disarmToken: null,
  dispatchError: null,
  followUpError: null,
  alertStartedAt: null,
  alertLocation: null,
  alertsMode: null,
  deliveries: [],
  alertStatusError: null,
};

export const useSOSFlowStore = create((set, get) => ({
  sosState: SOS_STATES.IDLE,
  holdProgress: 0,
  countdownSeconds: 0,
  ...initialAlertState,

  setHoldProgress: (holdProgress) => set({ holdProgress }),

  transition: (sosState, extra = {}) => set({ sosState, ...extra }),

  reset: () =>
    set({
      sosState: SOS_STATES.IDLE,
      holdProgress: 0,
      countdownSeconds: 0,
      ...initialAlertState,
    }),

  /** `activatedAt` is the server-recorded activation time when the server provides one. */
  setSession: (sessionId, trackingUrl, disarmToken, { activatedAt, alertLocation, alertsMode, localIncidentId } = {}) =>
    set({
      sessionId,
      localIncidentId: localIncidentId || null,
      trackingUrl,
      disarmToken,
      alertStartedAt: activatedAt || Date.now(),
      alertLocation: alertLocation || null,
      alertsMode: alertsMode || null,
      dispatchError: null,
      followUpError: null,
    }),

  setCountdown: (countdownSeconds) => set({ countdownSeconds }),

  /** Only for failures before the server recorded an incident. */
  setDispatchError: (dispatchError) => set({ dispatchError, sosState: SOS_STATES.IDLE }),

  /** For failures after the incident exists: the alert stays active. */
  setFollowUpError: (followUpError) => set({ followUpError }),

  setAlertStatus: ({ deliveries, alertsMode, location }) =>
    set((state) => ({
      deliveries: Array.isArray(deliveries) ? deliveries : state.deliveries,
      alertsMode: alertsMode || state.alertsMode,
      alertLocation: location || state.alertLocation,
      alertStatusError: null,
    })),

  setAlertStatusError: (alertStatusError) => set({ alertStatusError }),

  upsertDelivery: (delivery) => {
    if (!delivery?.id) return;
    const deliveries = get().deliveries.filter((d) => d.id !== delivery.id);
    set({ deliveries: [...deliveries, delivery] });
  },
}));
