import { io } from 'socket.io-client';
import { SOCKET_URL, HEARTBEAT_INTERVAL_MS } from '../constants/config';

let socket = null;
let heartbeatTimer = null;

export function getSocket() {
  return socket;
}

export function connectSocket(sessionId, handlers = {}) {
  if (socket?.connected) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    socket.emit('join-room', { sessionId });
    handlers.onConnect?.();
    startHeartbeat(sessionId);
  });

  socket.on('ROOM_JOINED', (data) => handlers.onRoomJoined?.(data));
  socket.on('LOCATION_UPDATE', (data) => handlers.onLocationUpdate?.(data));
  socket.on('EMERGENCY_ACK', (data) => handlers.onEmergencyAck?.(data));
  socket.on('ERROR', (data) => handlers.onError?.(data));

  socket.on('disconnect', (reason) => {
    stopHeartbeat();
    handlers.onDisconnect?.(reason);
  });

  socket.on('connect_error', (err) => handlers.onError?.({ message: err.message }));

  return socket;
}

function startHeartbeat(sessionId) {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (socket?.connected) {
      socket.emit('HEARTBEAT', { sessionId });
    }
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export function emitLocationUpdate(sessionId, location, clientStatus = 'MONITORING') {
  if (!socket?.connected) return;
  socket.emit('location-stream', {
    sessionId,
    latitude: location.latitude,
    longitude: location.longitude,
    speed: location.speed ?? null,
    heading: location.heading ?? null,
    accuracy: location.accuracy ?? null,
    batteryLevel: location.batteryLevel ?? null,
    timestamp: location.timestamp || Date.now(),
    clientStatus,
  });
}

export function emitTriggerEmergency(sessionId, reason, duress = false) {
  if (!socket?.connected) return;
  socket.emit('TRIGGER_EMERGENCY', { sessionId, reason, duress });
}

export function emitHeartbeatLost(sessionId) {
  if (!socket?.connected) return;
  socket.emit('HEARTBEAT_LOST', { sessionId });
}

export function disconnectSocket() {
  stopHeartbeat();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
