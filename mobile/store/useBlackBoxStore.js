import { create } from 'zustand';

export const useBlackBoxStore = create((set, get) => ({
  recording: false,
  silentMode: false,
  frameCount: 0,
  bufferKb: 0,
  signature: null,
  spectrum: new Array(16).fill(0),
  tickInterval: null,

  setSilentMode: (silentMode) => set({ silentMode }),

  startRecording: async () => {
    const { tickInterval } = get();
    if (tickInterval) clearInterval(tickInterval);
    set({
      recording: false,
      frameCount: 0,
      bufferKb: 0,
      signature: null,
      spectrum: new Array(16).fill(0),
      tickInterval: null,
    });
  },

  stopRecording: () => {
    const { tickInterval } = get();
    if (tickInterval) clearInterval(tickInterval);
    set({ recording: false, tickInterval: null });
  },
}));
