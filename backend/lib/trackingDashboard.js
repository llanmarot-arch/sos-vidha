const { resolvePublicServerUrl } = require('./serverUrl');

function embedJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function mapDisplayStatus(status) {
  switch (status) {
    case 'MONITORING':
      return 'NORMAL';
    case 'WARNING':
      return 'ROUTE_DEVIATION_WARNING';
    case 'DURESS_ACTIVE':
      return 'DURESS_ACTIVE';
    case 'EMERGENCY':
      return 'EMERGENCY';
    default:
      return status || 'UNKNOWN';
  }
}

function renderTrackingDashboard(sessionId, session, options = {}) {
  const trackerTokenForSocket = options.trackerToken || '';
  const useSecureSocket = Boolean(options.secureTracking);
  const publicUrl = options.publicUrl || resolvePublicServerUrl(options.port);
  const staleAfterMs = options.staleAfterMs || 120000;
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || '';
  const shortId = /^[0-9a-f]{8}-/i.test(String(sessionId)) ? String(sessionId).slice(0, 8) : 'unknown';
  const loc = session.location;
  const displayStatus = mapDisplayStatus(session.status);
  const speedKmh = loc?.speed != null ? (loc.speed * 3.6).toFixed(1) : '—';
  const battery = loc?.batteryLevel != null ? Math.round(loc.batteryLevel * 100) : '—';
  const lastFix = loc?.timestamp
    ? new Date(loc.timestamp).toLocaleString()
    : 'No GPS fix received';
  const accuracy = loc?.accuracy != null ? `±${Math.round(loc.accuracy)} m` : 'Not reported';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="referrer" content="strict-origin"/>
  <meta name="robots" content="noindex, nofollow"/>
  <title>SOS-Vidha · Live Guardian Track</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="/socket.io/socket.io.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0F172A;
      color: #F8FAFC;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      padding: 16px;
      background: linear-gradient(180deg, #1E293B 0%, #0F172A 100%);
      border-bottom: 1px solid #334155;
    }
    header h1 { font-size: 1.1rem; font-weight: 800; letter-spacing: 0.04em; }
    header p { color: #94A3B8; font-size: 0.8rem; margin-top: 4px; }
    #map { flex: 1; min-height: 55vh; width: 100%; z-index: 1; }
    .hud {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding: 14px 16px 20px;
      background: #0F172A;
    }
    .card {
      background: #1E293B;
      border: 1px solid #334155;
      border-radius: 14px;
      padding: 12px 14px;
    }
    .card.full { grid-column: 1 / -1; }
    .label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748B; }
    .value { font-size: 1.05rem; font-weight: 700; margin-top: 4px; }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 999px;
      font-weight: 800;
      font-size: 0.75rem;
      letter-spacing: 0.06em;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    .status-NORMAL { background: rgba(16,185,129,.15); color: #10B981; }
    .status-NORMAL .dot { background: #10B981; }
    .status-ROUTE_DEVIATION_WARNING { background: rgba(245,158,11,.15); color: #F59E0B; }
    .status-ROUTE_DEVIATION_WARNING .dot { background: #F59E0B; }
    .status-DURESS_ACTIVE, .status-EMERGENCY { background: rgba(239,68,68,.18); color: #EF4444; }
    .status-DURESS_ACTIVE .dot, .status-EMERGENCY .dot { background: #EF4444; }
    .footer { text-align: center; color: #475569; font-size: 0.7rem; padding-bottom: 12px; }
  </style>
</head>
<body>
  <header>
    <h1>SOS-Vidha Live Guardian</h1>
    <p>Session ${shortId}… · Real-time safety telemetry</p>
  </header>
  <div id="map"></div>
  <div class="hud">
    <div class="card full">
      <div class="label">Status</div>
      <div class="status-pill status-${displayStatus}" id="statusPill">
        <span class="dot"></span>
        <span id="statusText">${displayStatus}</span>
      </div>
    </div>
    <div class="card">
      <div class="label">Speed</div>
      <div class="value" id="speedValue">${speedKmh} km/h</div>
    </div>
    <div class="card">
      <div class="label">Battery</div>
      <div class="value" id="batteryValue">${battery}${battery !== '—' ? '%' : ''}</div>
    </div>
    <div class="card full">
      <div class="label">Last GPS fix (device time)</div>
      <div class="value" id="lastFixValue">${lastFix}</div>
      <div class="label" id="staleNote" style="margin-top:6px;color:#F59E0B"></div>
    </div>
    <div class="card">
      <div class="label">Accuracy</div>
      <div class="value" id="accuracyValue">${accuracy}</div>
    </div>
    <div class="card">
      <div class="label">Coordinates</div>
      <div class="value" id="coordsValue">${loc ? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}` : 'Location unavailable'}</div>
    </div>
  </div>
  <div class="footer">Connected to ${publicUrl}</div>
  <script>
    const sessionId = ${embedJson(sessionId)};
    const mapboxToken = ${embedJson(mapboxToken)};
    const staleAfterMs = ${Number(staleAfterMs)};
    const initialLocation = ${embedJson(
      loc ? { latitude: loc.latitude, longitude: loc.longitude, timestamp: loc.timestamp } : null
    )};

    const map = L.map('map', { zoomControl: true });
    if (initialLocation) {
      map.setView([initialLocation.latitude, initialLocation.longitude], 15);
    } else {
      map.setView([0, 0], 2);
    }

    if (mapboxToken) {
      L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=' + mapboxToken, {
        attribution: '© Mapbox © OpenStreetMap',
        tileSize: 512,
        zoomOffset: -1,
        maxZoom: 20,
      }).addTo(map);
    } else {
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
    }

    const markerIcon = L.divIcon({
      className: '',
      html: '<div style="width:18px;height:18px;background:#EF4444;border:3px solid #fff;border-radius:50%;box-shadow:0 0 12px rgba(239,68,68,.8)"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    let marker = null;
    let trail = null;
    const trailPoints = [];
    let latestFixTime = initialLocation ? initialLocation.timestamp : null;

    function plot(lat, lng) {
      if (!marker) {
        marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
        trail = L.polyline([], { color: '#10B981', weight: 3, opacity: 0.7 }).addTo(map);
        map.setView([lat, lng], 15);
      }
      marker.setLatLng([lat, lng]);
      trailPoints.push([lat, lng]);
      if (trailPoints.length > 200) trailPoints.shift();
      trail.setLatLngs(trailPoints);
      map.panTo([lat, lng], { animate: true, duration: 0.5 });
    }

    function refreshStaleNote() {
      const note = document.getElementById('staleNote');
      if (!latestFixTime) {
        note.textContent = 'No GPS fix has been received from the device.';
        return;
      }
      const ageMs = Date.now() - latestFixTime;
      note.textContent = ageMs > staleAfterMs
        ? 'Stale: this fix is ' + Math.round(ageMs / 60000) + ' min old and may not show the current position.'
        : '';
    }

    if (initialLocation) plot(initialLocation.latitude, initialLocation.longitude);
    refreshStaleNote();
    setInterval(refreshStaleNote, 15000);

    function mapStatus(s) {
      if (s === 'MONITORING') return 'NORMAL';
      if (s === 'WARNING') return 'ROUTE_DEVIATION_WARNING';
      return s || 'UNKNOWN';
    }

    function updateHud(payload) {
      const display = mapStatus(payload.status);
      const pill = document.getElementById('statusPill');
      pill.className = 'status-pill status-' + display;
      document.getElementById('statusText').textContent = display;

      const loc = payload.location;
      if (!loc || loc.timestamp == null) return;

      plot(loc.latitude, loc.longitude);
      latestFixTime = loc.timestamp;
      refreshStaleNote();

      document.getElementById('coordsValue').textContent =
        loc.latitude.toFixed(5) + ', ' + loc.longitude.toFixed(5);
      document.getElementById('accuracyValue').textContent =
        loc.accuracy != null ? '±' + Math.round(loc.accuracy) + ' m' : 'Not reported';
      document.getElementById('speedValue').textContent =
        loc.speed != null ? (loc.speed * 3.6).toFixed(1) + ' km/h' : '—';
      document.getElementById('batteryValue').textContent =
        loc.batteryLevel != null ? Math.round(loc.batteryLevel * 100) + '%' : '—';
      document.getElementById('lastFixValue').textContent = new Date(loc.timestamp).toLocaleString();
    }

    const socketAuth = ${embedJson(
      useSecureSocket
        ? { trackerToken: trackerTokenForSocket, sessionId }
        : { sessionId }
    )};
    const socket = io({ transports: ['websocket', 'polling'], auth: socketAuth });
    socket.on('connect', () => {
      socket.emit('join-tracker', {
        sessionId,
        trackerToken: ${embedJson(trackerTokenForSocket || null)},
      });
    });
    socket.on('TRACKER_SNAPSHOT', (data) => updateHud(data));
    socket.on('LOCATION_UPDATE', (data) => updateHud(data));
    socket.on('SESSION_STATUS', (data) => {
      const pill = document.getElementById('statusPill');
      const display = mapStatus(data.status);
      pill.className = 'status-pill status-' + display;
      document.getElementById('statusText').textContent = display;
    });
    socket.on('TRACKING_ENDED', () => {
      document.getElementById('statusText').textContent = 'TRACKING ENDED';
      document.getElementById('staleNote').textContent = 'This tracking link is no longer active.';
      socket.disconnect();
    });
    socket.on('ERROR', () => {
      document.getElementById('staleNote').textContent = 'This tracking link is invalid or has expired.';
    });
  </script>
</body>
</html>`;
}

module.exports = { renderTrackingDashboard, mapDisplayStatus };
