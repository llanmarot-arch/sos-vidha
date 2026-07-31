import { create } from 'zustand';
import * as Crypto from 'expo-crypto';

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
    if (tickInterval) return;

    const signature = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `blackbox-${Date.now()}`
    );

    const interval = setInterval(() => {
      const spectrum = Array.from({ length: 16 }, () => Math.random() * 100);
      set((state) => ({
        frameCount: state.frameCount + 1,
        bufferKb: state.bufferKb + Math.round(12 + Math.random() * 28),
        spectrum,
      }));
    }, 500);

    set({
      recording: true,
      frameCount: 0,
      bufferKb: 0,
      signature: signature.slice(0, 32),
      tickInterval: interval,
    });
  },

  stopRecording: () => {
    const { tickInterval } = get();
    if (tickInterval) clearInterval(tickInterval);
    set({ recording: false, tickInterval: null });
  },
}));
