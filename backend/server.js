require('dotenv').config();

const { loadConfig, validateStartupConfig } = require('./lib/config');

const config = loadConfig(process.env);
const { errors, warnings } = validateStartupConfig(config);
for (const warning of warnings) {
  console.warn(`[Config] ${warning}`);
}
if (errors.length) {
  for (const error of errors) {
    console.error(`[Config] FATAL: ${error}`);
  }
  console.error('[Config] Refusing to start: required configuration is missing.');
  process.exit(1);
}

const { createSosServer } = require('./lib/app');
const { createSupabaseAccounts, getSupabaseAdmin } = require('./lib/supabaseAdmin');
const { MemoryIncidentRepository, SupabaseIncidentRepository } = require('./lib/incidentRepository');
const { createTwilioProvider } = require('./lib/twilioService');
const { createMapboxGeocoder } = require('./lib/geocoder');
const { resolvePublicServerUrl } = require('./lib/serverUrl');

const accounts = config.supabaseConfigured
  ? createSupabaseAccounts()
  : {
      verifyAccessToken: async () => null,
      getEmergencyContacts: async () => [],
      getAlertProfile: async () => ({ fullName: null, safeZone: null }),
    };
const incidents = config.supabaseConfigured
  ? new SupabaseIncidentRepository(getSupabaseAdmin())
  : new MemoryIncidentRepository();
const provider = createTwilioProvider(config.twilio);
const geocoder = config.geocoding.enabled
  ? createMapboxGeocoder({ accessToken: config.geocoding.mapboxToken })
  : null;
const publicServerUrl = config.explicitPublicUrl || resolvePublicServerUrl(config.port);

const sos = createSosServer({ config, accounts, incidents, provider, geocoder, publicServerUrl });

sos
  .start(config.port)
  .then(() => {
    console.log(`\n[SOS-Vidha] Server running on port ${config.port}`);
    console.log(`[SOS-Vidha] Public URL: ${publicServerUrl}`);
    console.log(`[SOS-Vidha] Auth: ${config.supabaseConfigured ? 'Supabase' : 'NOT CONFIGURED (dev only)'}`);
    console.log(`[SOS-Vidha] Alerts: ${config.alertsLiveSend ? 'LIVE' : 'DRY RUN (nothing is sent)'}`);
    return sos.recover().then(
      (result) => {
        console.log(
          `[Recovery] restored=${result.restored} skipped=${result.skipped} quarantined=${result.quarantined}\n`
        );
      },
      (err) => {
        console.error(`[Recovery] failed: ${err.message}`);
      }
    );
  })
  .catch((err) => {
    console.error(`[SOS-Vidha] Failed to listen: ${err.message}`);
    process.exit(1);
  });

module.exports = sos;
