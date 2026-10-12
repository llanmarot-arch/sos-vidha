const HOUR_MS = 60 * 60 * 1000;

function positiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function flag(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return String(value).trim().toLowerCase() === 'true';
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseEncryptionKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return { key: null, invalid: false };
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) return { key: null, invalid: true };
  return { key: raw.toLowerCase(), invalid: false };
}

function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const supabaseUrlSet = Boolean(String(env.SUPABASE_URL || '').trim());
  const supabaseKeySet = Boolean(String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim());
  const supabaseConfigured = supabaseUrlSet && supabaseKeySet;
  const twilioValues = [env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_PHONE_NUMBER];
  const twilioConfigured = twilioValues.every(Boolean);
  const twilioPartial = !twilioConfigured && twilioValues.some(Boolean);
  const explicitPublicUrl = String(env.PUBLIC_SERVER_URL || env.PUBLIC_BASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const encryptionKey = parseEncryptionKey(env.DATA_ENCRYPTION_KEY);

  return {
    nodeEnv,
    isProduction,
    port: positiveNumber(env.PORT, 3001),
    supabaseConfigured,
    supabasePartial: supabaseUrlSet !== supabaseKeySet,
    // Identity checks are mandatory whenever accounts exist or the server runs in production.
    secureMode: supabaseConfigured || isProduction,
    explicitPublicUrl,
    twilio: {
      configured: twilioConfigured,
      partial: twilioPartial,
      accountSid: env.TWILIO_ACCOUNT_SID || null,
      authToken: env.TWILIO_AUTH_TOKEN || null,
      fromNumber: env.TWILIO_PHONE_NUMBER || null,
      whatsappFrom: env.TWILIO_WHATSAPP_NUMBER || null,
    },
    // Real messages are only sent when callers are authenticated (Supabase) and either the
    // server runs in production or live sending was explicitly enabled for a controlled test.
    alertsLiveSend:
      twilioConfigured && supabaseConfigured && (isProduction || flag(env.SMS_LIVE_SEND)),
    voiceEnabled: flag(env.TWILIO_VOICE_ENABLED, true),
    trackerTtlMs: positiveNumber(env.TRACKER_TOKEN_TTL_MS, 12 * HOUR_MS),
    locationStaleAfterMs: positiveNumber(env.LOCATION_STALE_AFTER_MS, 2 * 60 * 1000),
    locationMaxAccuracyM: positiveNumber(env.LOCATION_MAX_ACCURACY_M, 500),
    smsTimeZone: env.SMS_TIMEZONE || 'Asia/Kolkata',
    emergencyNumber: env.EMERGENCY_NUMBER || '112',
    smsMaxRecipients: positiveNumber(env.SMS_MAX_RECIPIENTS, 5),
    smsMaxIncidentsPerHour: positiveNumber(env.SMS_MAX_INCIDENTS_PER_HOUR, 5),
    smsMaxAttempts: positiveNumber(env.SMS_MAX_ATTEMPTS, 3),
    smsRetryBaseMs: positiveNumber(env.SMS_RETRY_BASE_MS, 2000),
    sessionStartMaxPerIp: positiveNumber(env.SESSION_START_MAX_PER_IP, 30),
    sessionStartMaxPerUser: positiveNumber(env.SESSION_START_MAX_PER_USER, 10),
    sessionStartWindowMs: positiveNumber(env.SESSION_START_WINDOW_MS, 10 * 60 * 1000),
    disarmMaxAttempts: positiveNumber(env.DISARM_MAX_ATTEMPTS, 8),
    disarmWindowMs: positiveNumber(env.DISARM_WINDOW_MS, 15 * 60 * 1000),
    geocoding: {
      enabled: flag(env.REVERSE_GEOCODING_ENABLED) && Boolean(env.MAPBOX_ACCESS_TOKEN),
      mapboxToken: env.MAPBOX_ACCESS_TOKEN || null,
    },
    trustProxy: env.TRUST_PROXY || null,
    dataEncryptionKey: encryptionKey.key,
    dataEncryptionKeyInvalid: encryptionKey.invalid,
    corsOrigins: parseList(env.CORS_ORIGINS),
    dispatchLeaseMs: positiveNumber(env.DISPATCH_LEASE_MS, 60000),
    heartbeatLostThresholdMs: positiveNumber(env.HEARTBEAT_LOST_THRESHOLD_MS, 60000),
    heartbeatCheckIntervalMs: positiveNumber(env.HEARTBEAT_CHECK_INTERVAL_MS, 15000),
    sessionCleanupIntervalMs: positiveNumber(env.SESSION_CLEANUP_INTERVAL_MS, 300000),
  };
}

function validateStartupConfig(config) {
  const errors = [];
  const warnings = [];

  if (config.supabasePartial) {
    errors.push(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set. Refusing to start with partial authentication configuration.'
    );
  }
  if (config.dataEncryptionKeyInvalid) {
    errors.push('DATA_ENCRYPTION_KEY must be 64 hex characters (32 bytes).');
  }

  if (config.isProduction) {
    if (!config.supabaseConfigured) {
      errors.push('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.');
    }
    if (!config.trustProxy) {
      warnings.push(
        'TRUST_PROXY is unset. Set it only when a reverse proxy overwrites X-Forwarded-For; leaving it unset is correct when this process is reached directly.'
      );
    }
    if (!config.explicitPublicUrl) {
      errors.push('PUBLIC_SERVER_URL is required in production (tracking links must not use a guessed LAN address).');
    } else if (!config.explicitPublicUrl.startsWith('https://')) {
      errors.push('PUBLIC_SERVER_URL must use https:// in production (tracking links carry an access capability).');
    }
    if (!config.twilio.configured) {
      errors.push('TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER are required in production.');
    }
    if (!config.dataEncryptionKey) {
      errors.push(
        'DATA_ENCRYPTION_KEY is required in production so an active incident can be restored after a restart.'
      );
    }
    if (config.corsOrigins.length === 0) {
      warnings.push(
        'CORS_ORIGINS is empty. Cross-origin browser clients are blocked. Native apps are unaffected.'
      );
    }
  } else {
    if (config.twilio.partial) {
      warnings.push('Twilio is partially configured; emergency alerts will run in dry-run mode.');
    }
    if (!config.alertsLiveSend) {
      warnings.push('Emergency alerts are in DRY-RUN mode: no SMS or calls will be sent.');
    }
    if (!config.dataEncryptionKey) {
      warnings.push('DATA_ENCRYPTION_KEY is unset. Active incidents cannot be restored after a restart.');
    }
  }

  return { errors, warnings };
}

module.exports = { loadConfig, validateStartupConfig };
