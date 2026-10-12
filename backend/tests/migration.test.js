const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261012120000_incident_recovery.sql');

describe('incident recovery migration', () => {
  const sql = fs.readFileSync(file, 'utf8');

  it('is additive and does not delete existing data', () => {
    assert.doesNotMatch(sql, /\bdrop\s+table\b/i);
    assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
    assert.doesNotMatch(sql, /\btruncate\b/i);
    assert.match(sql, /create table if not exists public\.sos_incident_runtime/i);
    assert.match(sql, /add column if not exists lease_until/i);
    assert.match(sql, /add column if not exists idempotency_key/i);
    assert.match(sql, /persist_sos_incident/);
    assert.match(sql, /claim_alert_delivery_lease/);
  });

  it('keeps the encrypted runtime and the lease function off the client roles', () => {
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /revoke all on table public\.sos_incident_runtime from public, anon, authenticated/i);
    assert.match(sql, /revoke all on function public\.persist_sos_incident\(jsonb, text\) from public, anon, authenticated/i);
    assert.match(sql, /grant execute on function public\.persist_sos_incident\(jsonb, text\) to service_role/i);
    assert.match(sql, /revoke all on function public\.claim_alert_delivery_lease\(uuid, timestamptz\) from public, anon, authenticated/i);
    assert.match(sql, /30 days/);
    assert.match(sql, /exactly-once/i);
  });
});
