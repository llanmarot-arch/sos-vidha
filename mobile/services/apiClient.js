import { API_BASE_URL } from '../constants/config';
import { mockApi } from './mockApi';

let mockFallbackActive = false;
let endpointLogged = false;

export function isMockFallbackActive() {
  return mockFallbackActive;
}

function logEndpointStatus(connected) {
  if (connected) {
    console.info(`[SOS API] Endpoint connected: ${API_BASE_URL}`);
    mockFallbackActive = false;
  } else if (!mockFallbackActive) {
    console.warn('[SOS API] Backend offline -> Mock Adapter Engaged');
    mockFallbackActive = true;
  }
}

async function tryFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);

    if (response.status >= 500) {
      throw new Error(`Server error ${response.status}`);
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Request failed (${response.status})`);
    }

    if (!endpointLogged) {
      logEndpointStatus(true);
      endpointLogged = true;
    }
    return response.json();
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

async function withFallback(realCall, mockCall) {
  try {
    return await realCall();
  } catch (error) {
    logEndpointStatus(false);
    return mockCall();
  }
}

export const apiClient = {
  async healthCheck() {
    return withFallback(
      () => tryFetch(`${API_BASE_URL}/health`),
      () => mockApi.getHealth()
    );
  },

  async startSession(payload) {
    return withFallback(
      () =>
        tryFetch(`${API_BASE_URL}/api/session/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      () => mockApi.startSession(payload)
    );
  },

  async disarmSession(payload) {
    return withFallback(
      () =>
        tryFetch(`${API_BASE_URL}/api/session/disarm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      () => mockApi.disarmSession(payload)
    );
  },

  async getSession(sessionId) {
    return withFallback(
      () => tryFetch(`${API_BASE_URL}/api/session/${sessionId}`),
      () => mockApi.getSession(sessionId)
    );
  },

  async sendWhatsAppAlerts(payload) {
    return withFallback(
      () =>
        tryFetch(`${API_BASE_URL}/api/notify/whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      () => mockApi.sendWhatsApp(payload)
    );
  },
};
