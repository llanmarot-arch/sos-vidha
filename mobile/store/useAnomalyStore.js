import { create } from 'zustand';

export const ANOMALY_STATES = {
  NORMAL: 'NORMAL',
  COUNTDOWN: 'COUNTDOWN',
  TRIGGERED: 'TRIGGERED',
};

export const useAnomalyStore = create((set, get) => ({
  gForce: { x: 0, y: 0, z: 1 },
  heartRate: 72,
  spO2: 98,
  state: ANOMALY_STATES.NORMAL,
  countdown: 0,
  countdownTimer: null,
  sensorSub: null,

  setTelemetry: (gForce, heartRate, spO2) => set({ gForce, heartRate, spO2 }),

  simulateImpact: (onTrigger) => {
    const { countdownTimer, state } = get();
    if (state !== ANOMALY_STATES.NORMAL) return;

    if (countdownTimer) clearInterval(countdownTimer);

    set({ state: ANOMALY_STATES.COUNTDOWN, countdown: 10, gForce: { x: 4.2, y: -8.7, z: 2.1 }, heartRate: 142, spO2: 89 });

    const timer = setInterval(() => {
      const next = get().countdown - 1;
      if (next <= 0) {
        clearInterval(timer);
        set({ state: ANOMALY_STATES.TRIGGERED, countdown: 0, countdownTimer: null });
        onTrigger?.();
        return;
      }
      set({ countdown: next });
    }, 1000);

    set({ countdownTimer: timer });
  },

  abortCountdown: () => {
    const { countdownTimer } = get();
    if (countdownTimer) clearInterval(countdownTimer);
    set({ state: ANOMALY_STATES.NORMAL, countdown: 0, countdownTimer: null, heartRate: 72, spO2: 98 });
  },

  reset: () => {
    get().abortCountdown();
    set({ state: ANOMALY_STATES.NORMAL });
  },
}));
