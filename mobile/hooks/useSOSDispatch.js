import { useEffect, useRef, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { apiClient } from '../services/apiClient';
import { buildSessionPinPayload } from '../utils/pinCrypto';
import { useSOSFlowStore } from '../store/useSOSFlowStore';
import { useContactsStore } from '../store/useContactsStore';
import { useBlackBoxStore } from '../store/useBlackBoxStore';
import { SOS_STATES } from '../theme/tokens';
import { connectSocket, emitTriggerEmergency, disconnectSocket } from '../services/socketService';
import {
  startLiveTracking,
  stopLiveTracking,
  getCurrentPosition,
  setStreamSessionId,
} from '../services/webLocationService';
import { dispatchWhatsAppAlerts } from '../services/whatsappAlertService';

const ABORT_SECONDS = 3;
const DEMO_STANDARD_PIN = '1234';
const DEMO_DURESS_PIN = '9999';

export function useSOSDispatch() {
  const countdownTimer = useRef(null);
  const dispatchRef = useRef(null);

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearCountdownTimer();
      stopLiveTracking();
      disconnectSocket();
      useBlackBoxStore.getState().stopRecording();
    },
    [clearCountdownTimer]
  );

  const dispatchSOS = useCallback(async () => {
    useSOSFlowStore.getState().transition(SOS_STATES.DISPATCHING);
    clearCountdownTimer();

    try {
      await apiClient.healthCheck();
      const contacts = useContactsStore.getState().contacts;
      if (contacts.length < 1) throw new Error('ADD AT LEAST ONE GUARDIAN CONTACT');

      let location = { latitude: 28.6139, longitude: 77.209 };
      try {
        location = await getCurrentPosition();
      } catch {
        /* fallback coords */
      }

      const primary = contacts[0];
      const secondary = contacts[1] || contacts[0];

      const pinPayload = await buildSessionPinPayload(DEMO_STANDARD_PIN, DEMO_DURESS_PIN);
      const session = await apiClient.startSession({
        mode: 'GEOFENCE',
        userPhone: '+919999999999',
        contact1: primary.phone,
        contact2: secondary.phone,
        pinSalt: pinPayload.pinSalt,
        standardPinHash: pinPayload.standardPinHash,
        duressPinHash: pinPayload.duressPinHash,
        geofence: {
          center: { latitude: location.latitude, longitude: location.longitude },
          radiusMeters: 500,
        },
        initialLocation: location,
      });

      useSOSFlowStore.getState().setSession(session.sessionId, session.trackingUrl);
      useSOSFlowStore.getState().transition(SOS_STATES.ACTIVE_ALERT);

      setStreamSessionId(session.sessionId);
      connectSocket(session.sessionId);
      emitTriggerEmergency(session.sessionId, 'WEB_SOS_HOLD');
      await startLiveTracking(session.sessionId);
      await useBlackBoxStore.getState().startRecording();

      await dispatchWhatsAppAlerts(contacts, {
        sessionId: session.sessionId,
        trackingUrl: session.trackingUrl,
        latitude: location.latitude,
        longitude: location.longitude,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (err) {
      useSOSFlowStore.getState().setDispatchError(err.message || 'DISPATCH FAILED');
    }
  }, [clearCountdownTimer]);

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
    const { sessionId } = useSOSFlowStore.getState();
    if (sessionId) {
      await apiClient.disarmSession({ sessionId, method: 'BIOMETRIC', disarmToken: 'web-demo' }).catch(() => {});
    }
    useBlackBoxStore.getState().stopRecording();
    stopLiveTracking();
    disconnectSocket();
    useSOSFlowStore.getState().reset();
  }, []);

  return { beginCountdown, abortCountdown, cancelAlert, dispatchSOS };
}
