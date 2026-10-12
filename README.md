# SOS-Vidha

Production personal-safety application in active development. React Native (Expo) client and Node.js backend. Do not treat untested device, carrier, or live-provider behavior as verified.

## Architecture

```
mobile/          Expo SDK 52 app (Safe Zone + Transit SafeGuard)
backend/         Express + Socket.io + Twilio telephony server
```

### Modules

| Module | Description |
|--------|-------------|
| **Safe Zone** | Geofence with 30s countdown, 10s fast countdown when moving >35 km/h away |
| **Transit SafeGuard** | Route deviation monitor using Mapbox/Google Directions polylines |
| **Duress Disarm** | Biometric + PIN disarm; duress PIN silently triggers emergency |
| **Backend** | Real-time location streaming, Twilio Voice + SMS, live tracking page |

## Quick Start

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with Twilio credentials
npm install
npm run dev
```

Server runs on `http://localhost:3001`.

### Mobile

```bash
cd mobile
cp .env.example .env
# Set EXPO_PUBLIC_API_URL to your machine IP (not localhost on physical device)
npm install
npx expo start
```

> **Physical device testing:** Replace `localhost` with your LAN IP (e.g. `192.168.1.42:3001`).

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/session/start` | Start GEOFENCE or TRANSIT session |
| `POST` | `/api/session/disarm` | Standard or duress disarm |
| `GET` | `/api/session/:id` | Session status + location |
| `GET` | `/track/:id` | Public live tracking page |
| `GET` | `/health` | Health check |

## Socket Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `join-room` | Client → Server | Join session room |
| `location-stream` | Client → Server | Stream GPS updates |
| `TRIGGER_EMERGENCY` | Client → Server | Initiate Twilio alerts |
| `HEARTBEAT` | Client → Server | Keep session alive |
| `HEARTBEAT_LOST` | Client → Server | Report unexpected disconnect |
| `LOCATION_UPDATE` | Server → Client | Broadcast location |
| `EMERGENCY_ACK` | Server → Client | Confirm emergency dispatched |

## Environment Variables

### Backend (`backend/.env`)

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `PUBLIC_BASE_URL` — base URL for tracking links
- `PORT` — default `3001`

### Mobile (`mobile/.env`)

- `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SOCKET_URL`
- `EXPO_PUBLIC_MAPBOX_TOKEN` or `EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY`

## Key Files

- `backend/server.js` — Express + Socket.io + Twilio
- `mobile/services/locationTracker.js` — Background GPS, geofence & route deviation engine
- `mobile/screens/HomeScreen.js` — Map UI, mode controls, status bar
- `mobile/components/DisarmModal.js` — Biometric + duress PIN disarm
- `mobile/utils/geo.js` — Haversine + point-to-segment distance math

## Production Notes

1. Replace in-memory `SessionStore` with Redis for horizontal scaling.
2. Use EAS Build for production mobile binaries with background location entitlements.
3. Verify Twilio numbers are verified for trial accounts.
4. Store duress PIN as salted hash server-side in production (currently compared in-memory for demo parity with mobile-side entry).
5. Add TLS termination (nginx/Caddy) in front of the backend.

## Deploy Web App to Netlify

The Expo web client can be deployed as a static site. The backend must be hosted separately (Railway, Render, Fly.io, etc.) for live SOS sessions.

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: SOS-Vidha safety app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sos-vidha.git
git push -u origin main
```

### 2. Connect Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git**
2. Select your `sos-vidha` repository
3. Netlify reads `netlify.toml` automatically:
   - **Base directory:** `mobile`
   - **Build command:** `npm ci && npx expo export --platform web`
   - **Publish directory:** `mobile/dist`
4. Under **Site settings → Environment variables**, add:
   - `EXPO_PUBLIC_API_URL` = your deployed backend URL (e.g. `https://sos-vidha-api.onrender.com`)
   - `EXPO_PUBLIC_SOCKET_URL` = same as above
5. Deploy. Your site will be at `https://your-site.netlify.app`

> Without a backend URL, the app runs in **mock mode** (local simulation). GPS, maps, contacts, and WhatsApp `wa.me` links still work from any device.

### 3. Access from other devices

Open your Netlify URL on any phone or laptop. Allow location permission when prompted on the **LIVE** tab.

## License

MIT
