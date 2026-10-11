const { createClient } = require('@supabase/supabase-js');

let adminClient = null;

function isSupabaseAuthConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseAdmin() {
  if (!isSupabaseAuthConfigured()) {
    return null;
  }
  if (!adminClient) {
    adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

async function verifyAccessToken(accessToken) {
  const admin = getSupabaseAdmin();
  if (!admin || !accessToken) {
    return null;
  }

  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data?.user) {
    return null;
  }
  return data.user;
}

async function fetchEmergencyContactsForUser(userId) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return null;
  }

  const { data, error } = await admin
    .from('emergency_contacts')
    .select('id, phone_e164, name, relationship')
    .eq('user_id', userId);

  if (error) {
    throw new Error('Failed to load guardian contacts for authorization');
  }
  return data || [];
}

async function fetchProfilePhone(userId) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return null;
  }

  const { data, error } = await admin.from('profiles').select('phone_e164').eq('id', userId).maybeSingle();
  if (error) {
    return null;
  }
  return data?.phone_e164 || null;
}

const UNDEFINED_COLUMN = '42703';
let safeZoneColumnsWarned = false;

/**
 * Profile facts used in emergency messages. The name comes from the authenticated user's own
 * profile row; the safety zone only exists if all persisted columns are set.
 */
async function fetchAlertProfile(userId) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { fullName: null, safeZone: null };
  }

  let fullName = null;
  const nameResult = await admin.from('profiles').select('full_name').eq('id', userId).maybeSingle();
  if (!nameResult.error) {
    fullName = nameResult.data?.full_name || null;
  }

  let safeZone = null;
  const zoneResult = await admin
    .from('profiles')
    .select('safe_zone_latitude, safe_zone_longitude, safe_zone_radius_m')
    .eq('id', userId)
    .maybeSingle();
  if (zoneResult.error) {
    if (zoneResult.error.code === UNDEFINED_COLUMN && !safeZoneColumnsWarned) {
      safeZoneColumnsWarned = true;
      console.warn('[Supabase] Safety-zone columns missing; apply migration 20261011000000. Zone omitted from alerts.');
    }
  } else if (zoneResult.data) {
    safeZone = {
      latitude: zoneResult.data.safe_zone_latitude,
      longitude: zoneResult.data.safe_zone_longitude,
      radiusM: zoneResult.data.safe_zone_radius_m,
    };
  }

  return { fullName, safeZone };
}

function createSupabaseAccounts() {
  return {
    verifyAccessToken,
    getEmergencyContacts: fetchEmergencyContactsForUser,
    getAlertProfile: fetchAlertProfile,
  };
}

module.exports = {
  isSupabaseAuthConfigured,
  getSupabaseAdmin,
  verifyAccessToken,
  fetchEmergencyContactsForUser,
  fetchProfilePhone,
  fetchAlertProfile,
  createSupabaseAccounts,
};
