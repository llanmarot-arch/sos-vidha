import { API_BASE_URL } from '../constants/config';
import { mockApi } from './mockApi';
import {
  isDevMockEnabledFromEnv,
  validateSessionStartResponse,
  userFacingBackendUnavailableMessage,
} from './apiClientPolicy';

let mockFallbackActive = false;
let endpointLogged = false;
/** @type {null | (() => Promise<string | null> | string | null)} */
let accessTokenProvider = null;

export function setAccessTokenProvider(provider) {
  accessTokenProvider = provider;
}

async function authHeaders() {
  if (!accessTokenProvider) {
    return {};
  }
  const token = await accessTokenProvider();
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

export function isDevMockEnabled() {
  return isDevMockEnabledFromEnv();
}

export function isMockFallbackActive() {
  return mockFallbackActive && isDevMockEnabled();
}

function logEndpointConnected() {
  if (!endpointLogged) {
    console.info(`[SOS API] Endpoint connected: ${API_BASE_URL}`);
    endpointLogged = true;
  }
  mockFallbackActive = false;
}

function logDevMockEngaged() {
  if (!mockFallbackActive) {
    console.warn('[SOS API] Dev mock enabled (EXPO_PUBLIC_ALLOW_MOCK_API=true) — mock adapter engaged');
  }
  mockFallbackActive = true;
}

async function tryFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const bearer = await authHeaders();
  const headers = { ...bearer, ...(options.headers || {}) };

  try {
    const response = await fetch(url, { ...options, headers, signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const err = new Error(
        body.error || (response.status >= 500 ? `Server error ${response.status}` : `Request failed (${response.status})`)
      );
      err.status = response.status;
      err.code = body.code || null;
      err.incidentId = typeof body.incidentId === 'string' ? body.incidentId : null;
      err.deliveries = Array.isArray(body.deliveries) ? body.deliveries : null;
      throw err;
    }

    logEndpointConnected();
    return response.json();
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Safety server request timed out.');
    }
    throw error;
  }
}

async function withDevMockFallback(realCall, mockCall) {
  try {
    return await realCall();
  } catch (error) {
    if (!isDevMockEnabled()) {
      throw error;
    }
    logDevMockEngaged();
    return mockCall();
  }
}

function wrapNetworkError(error) {
  const message = error?.message || 'Request failed';
  if (
    !isDevMockEnabled() &&
    (message.includes('timed out') ||
      message.includes('Network request failed') ||
      message.includes('Failed to fetch') ||
      message.includes('fetch'))
  ) {
    return new Error(userFacingBackendUnavailableMessage());
  }
  return error instanceof Error ? error : new Error(message);
}

export const apiClient = {
  /** Real health probe — never uses mock fallback. */
  async probeBackend() {
    try {
      return await tryFetch(`${API_BASE_URL}/health`);
    } catch (error) {
      throw wrapNetworkError(error);
    }
  },

  async healthCheck() {
    if (isDevMockEnabled()) {
      return withDevMockFallback(
        () => tryFetch(`${API_BASE_URL}/health`),
        () => mockApi.getHealth()
      );
    }
    try {
      return await tryFetch(`${API_BASE_URL}/health`);
    } catch (error) {
      throw wrapNetworkError(error);
    }
  },

  async startSession(payload) {
    let session;
    try {
      session = await withDevMockFallback(
        () =>
          tryFetch(`${API_BASE_URL}/api/session/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        () => mockApi.startSession(payload)
      );
    } catch (error) {
      throw wrapNetworkError(error);
    }

    const validation = validateSessionStartResponse(session);
    if (!validation.ok) {
      throw new Error(validation.error);
    }
    return session;
  },

  /**
   * Sends a locally saved incident. Never falls back to the dev mock: only a real server response may mark
   * an incident as received. HTTP errors keep `status`/`code`/`incidentId`; network errors have no `status`.
   */
  async syncIncident(payload) {
    const session = await tryFetch(`${API_BASE_URL}/api/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const validation = validateSessionStartResponse(session);
    if (!validation.ok) {
      throw Object.assign(new Error(validation.error), { status: 502 });
    }
    return session;
  },

  async disarmSession(payload) {
    try {
      return await withDevMockFallback(
        () =>
          tryFetch(`${API_BASE_URL}/api/session/disarm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        () => mockApi.disarmSession(payload)
      );
    } catch (error) {
      throw wrapNetworkError(error);
    }
  },

  async getSession(sessionId) {
    try {
      return await withDevMockFallback(
        () => tryFetch(`${API_BASE_URL}/api/session/${sessionId}`),
        () => mockApi.getSession(sessionId)
      );
    } catch (error) {
      throw wrapNetworkError(error);
    }
  },

  async getAlertStatus(sessionId) {
    try {
      return await withDevMockFallback(
        () => tryFetch(`${API_BASE_URL}/api/session/${encodeURIComponent(sessionId)}/alerts`),
        () => mockApi.getAlertStatus(sessionId)
      );
    } catch (error) {
      throw wrapNetworkError(error);
    }
  },

  async sendWhatsAppAlerts(payload) {
    try {
      return await withDevMockFallback(
        () =>
          tryFetch(`${API_BASE_URL}/api/notify/whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        () => mockApi.sendWhatsApp(payload)
      );
    } catch (error) {
      throw wrapNetworkError(error);
    }
  },
};
