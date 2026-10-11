import { useEffect, useRef, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { apiClient } from '../services/apiClient';
import { classifyLocationError, isFinalDeliveryStatus } from '../services/apiClientPolicy';
import { useSOSFlowStore } from '../store/useSOSFlowStore';
import { useIncidentStore } from '../store/useIncidentStore';
import { useContactsStore } from '../store/useContactsStore';
import { useBlackBoxStore } from '../store/useBlackBoxStore';
import { SOS_STATES } from '../theme/tokens';
import { connectSocket, disconnectSocket } from '../services/socketService';
import {
  startLiveTracking,
  stopLiveTracking,
  getCurrentPosition,
  setStreamSessionId,
} from '../services/webLocationService';
import { dispatchWhatsAppAlerts } from '../services/whatsappAlertService';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';

const ABORT_SECONDS = 3;
const GPS_TIMEOUT_MS = 6000;
const ALERT_POLL_INTERVAL_MS = 5000;
const ALERT_POLL_MAX_MS = 3 * 60 * 1000;

async function captureLocation() {
  try {
    const location = await getCurrentPosition({ timeoutMs: GPS_TIMEOUT_MS });
    return { location, locationError: null };
  } catch (err) {
    return { location: null, locationError: err?.code || classifyLocationError(err) };
  }
}

export function useSOSDispatch() {
  const countdownTimer = useRef(null);
  const dispatchRef = useRef(null);
  const alertPollTimer = useRef(null);

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
  }, []);

  const stopAlertPolling = useCallback(() => {
    if (alertPollTimer.current) {
      clearInterval(alertPollTimer.current);
      alertPollTimer.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearCountdownTimer();
      stopAlertPolling();
      stopLiveTracking();
      disconnectSocket();
      useBlackBoxStore.getState().stopRecording();
    },
    [clearCountdownTimer, stopAlertPolling]
  );

  const refreshAlertStatus = useCallback(async (sessionId) => {
    try {
      const status = await apiClient.getAlertStatus(sessionId);
      if (useSOSFlowStore.getState().sessionId !== sessionId) return true;
      useSOSFlowStore.getState().setAlertStatus(status);
      const deliveries = status.deliveries || [];
      return deliveries.length > 0 && deliveries.every((d) => isFinalDeliveryStatus(d.status));
    } catch {
      useSOSFlowStore
        .getState()
        .setAlertStatusError('Could not refresh message status. Your SOS is still active on the server.');
      return false;
    }
  }, []);

  const startAlertPolling = useCallback(
    (sessionId) => {
      stopAlertPolling();
      const startedAt = Date.now();
      refreshAlertStatus(sessionId);
      alertPollTimer.current = setInterval(async () => {
        const done = await refreshAlertStatus(sessionId);
        if (done || Date.now() - startedAt > ALERT_POLL_MAX_MS) stopAlertPolling();
      }, ALERT_POLL_INTERVAL_MS);
    },
    [refreshAlertStatus, stopAlertPolling]
  );

  /** Runs once the server has confirmed the incident; from here later failures must not reset the alert. */
  const startServerFollowUp = useCallback(
    async (session, record) => {
      if (useSOSFlowStore.getState().sessionId === session.sessionId) return;
      const contacts = useContactsStore.getState().contacts;
      const fix = record?.location?.status === 'FIX' ? record.location : null;
      useSOSFlowStore.getState().setSession(session.sessionId, session.trackingUrl, session.disarmToken, {
        activatedAt: session.activatedAt,
        alertLocation: session.location,
        alertsMode: session.alerts?.mode,
        localIncidentId: record?.id,
      });
      useSOSFlowStore.getState().transition(SOS_STATES.ACTIVE_ALERT);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      startAlertPolling(session.sessionId);

      const failed = [];
      try {
        setStreamSessionId(session.sessionId);
        await connectSocket(session.sessionId, {
          onAlertStatus: (data) => {
            if (data?.sessionId === useSOSFlowStore.getState().sessionId) {
              useSOSFlowStore.getState().upsertDelivery(data.delivery);
            }
          },
        });
      } catch {
        failed.push('the live connection');
      }
      try {
        await startLiveTracking(session.sessionId);
      } catch {
        failed.push('live location updates');
      }
      try {
        await useBlackBoxStore.getState().startRecording();
      } catch {
        failed.push('audio recording');
      }
      if (failed.length) {
        useSOSFlowStore
          .getState()
          .setFollowUpError(
            `Your SOS is recorded, but ${failed.join(', ')} could not start. Call your contacts or 112 if you can.`
          );
      }

      dispatchWhatsAppAlerts(contacts, {
        sessionId: session.sessionId,
        trackingUrl: session.trackingUrl,
        latitude: fix?.latitude,
        longitude: fix?.longitude,
        timestamp: fix?.capturedAt,
        accuracy: fix?.accuracyM,
      }).catch(() => {});
    },
    [startAlertPolling]
  );

  const dispatchSOS = useCallback(async () => {
    const flow = useSOSFlowStore.getState();
    flow.transition(SOS_STATES.DISPATCHING);
    clearCountdownTimer();

    if (isSupabaseConfigured() && !useAuthStore.getState().session) {
      flow.setDispatchError('Sign in to activate SOS with your account.');
      return;
    }

    const incidents = useIncidentStore.getState();
    const contacts = useContactsStore.getState().contacts;
    // Saved on the phone before any network call, so the SOS survives no signal, a crash or a restart.
    let record = await incidents.findReusableUnsent().catch(() => null);
    try {
      if (!record) {
        record = await incidents.createIncident({ contacts });
      }
    } catch {
      flow.setDispatchError(
        'This phone could not save the SOS, so it was not sent. Call 112 or your contacts directly now.'
      );
      return;
    }
    if (record.location?.status !== 'FIX') {
      await incidents.setLocation(record.id, await captureLocation());
    }

    const result = await incidents.sync(record.id);
    if (!result?.session) {
      // Not confirmed by the server. The incident stays queued and its honest status is shown separately.
      useSOSFlowStore.getState().reset();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    await startServerFollowUp(result.session, result.record);
  }, [clearCountdownTimer, startServerFollowUp]);

  useEffect(() => {
    useIncidentStore.getState().init();
    const adopt = () => {
      if (!useIncidentStore.getState().pendingSession) return;
      const { sosState } = useSOSFlowStore.getState();
      const pending = useIncidentStore.getState().consumePendingSession();
      if (pending && (sosState === SOS_STATES.IDLE || sosState === SOS_STATES.DISPATCHING)) {
        startServerFollowUp(pending.session, pending.record);
      }
    };
    adopt();
    return useIncidentStore.subscribe(adopt);
  }, [startServerFollowUp]);

  dispatchRef.current = dispatchSOS;

  const beginCountdown = useCallback(() => {
    clearCountdownTimer();
    useSOSFlowStore.getState().transition(SOS_STATES.COUNTDOWN, { countdownSeconds: ABORT_SECONDS });

    countdownTimer.current = setInterval(() => {
      const current = useSOSFlowStore.getState().countdownSeconds - 1;
      if (current <= 0) {
        clearCountdownTimer();
        dispatchRef.current?.();
        return;
      }
      useSOSFlowStore.getState().setCountdown(current);
    }, 1000);
  }, [clearCountdownTimer]);

  const abortCountdown = useCallback(() => {
    clearCountdownTimer();
    useSOSFlowStore.getState().reset();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [clearCountdownTimer]);

  const cancelAlert = useCallback(async () => {
    const { sessionId, disarmToken, localIncidentId } = useSOSFlowStore.getState();
    if (sessionId && disarmToken) {
      try {
        await apiClient.disarmSession({ sessionId, method: 'BIOMETRIC', disarmToken });
      } catch {
        useSOSFlowStore
          .getState()
          .setFollowUpError(
            'Could not stop the SOS on the server. Your contacts may still be alerted. Check your connection and try again.'
          );
        return;
      }
      if (localIncidentId) useIncidentStore.getState().close(localIncidentId, 'DISARMED').catch(() => {});
    }
    stopAlertPolling();
    useBlackBoxStore.getState().stopRecording();
    stopLiveTracking();
    disconnectSocket();
    useSOSFlowStore.getState().reset();
  }, [stopAlertPolling]);

  return { beginCountdown, abortCountdown, cancelAlert, dispatchSOS };
}
