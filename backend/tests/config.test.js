const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadConfig, validateStartupConfig } = require('../lib/config');

const FULL_PROD = {
  NODE_ENV: 'production',
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  PUBLIC_SERVER_URL: 'https://sos.example.org',
  TWILIO_ACCOUNT_SID: 'AC123',
  TWILIO_AUTH_TOKEN: 'tok',
  TWILIO_PHONE_NUMBER: '+15550000000',
  DATA_ENCRYPTION_KEY: 'ab'.repeat(32),
  CORS_ORIGINS: 'https://sos.example.org',
};

describe('startup configuration', () => {
  it('accepts a complete production configuration', () => {
    const config = loadConfig(FULL_PROD);
    assert.deepEqual(validateStartupConfig(config).errors, []);
    assert.equal(config.secureMode, true);
    assert.equal(config.alertsLiveSend, true);
  });

  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PUBLIC_SERVER_URL', 'TWILIO_AUTH_TOKEN']) {
    it(`fails in production without ${key}`, () => {
      const env = { ...FULL_PROD, [key]: '' };
      assert.ok(validateStartupConfig(loadConfig(env)).errors.length > 0);
    });
  }

  it('fails in production with a non-https public URL', () => {
    const env = { ...FULL_PROD, PUBLIC_SERVER_URL: 'http://sos.example.org' };
    assert.match(validateStartupConfig(loadConfig(env)).errors.join(' '), /https/);
  });

  it('never sends live alerts without Supabase authentication', () => {
    const env = { ...FULL_PROD, NODE_ENV: 'development', SUPABASE_URL: '', SMS_LIVE_SEND: 'true' };
    assert.equal(loadConfig(env).alertsLiveSend, false);
  });

  it('keeps development in dry-run unless explicitly enabled', () => {
    assert.equal(loadConfig({ ...FULL_PROD, NODE_ENV: 'development' }).alertsLiveSend, false);
    assert.equal(loadConfig({ ...FULL_PROD, NODE_ENV: 'development', SMS_LIVE_SEND: 'true' }).alertsLiveSend, true);
  });

  it('allows local development without accounts', () => {
    const config = loadConfig({ NODE_ENV: 'development' });
    assert.equal(config.secureMode, false);
    assert.deepEqual(validateStartupConfig(config).errors, []);
    assert.match(validateStartupConfig(config).warnings.join(' '), /DATA_ENCRYPTION_KEY/);
  });

  it('fails in production without an encryption key', () => {
    const env = { ...FULL_PROD, DATA_ENCRYPTION_KEY: '' };
    assert.match(validateStartupConfig(loadConfig(env)).errors.join(' '), /DATA_ENCRYPTION_KEY/);
  });

  it('rejects a partial encryption key', () => {
    const env = { NODE_ENV: 'development', DATA_ENCRYPTION_KEY: 'abcd' };
    assert.match(validateStartupConfig(loadConfig(env)).errors.join(' '), /64 hex/);
  });

  it('warns when production has no browser origins', () => {
    const env = { ...FULL_PROD, CORS_ORIGINS: '' };
    const result = validateStartupConfig(loadConfig(env));
    assert.deepEqual(result.errors, []);
    assert.match(result.warnings.join(' '), /CORS_ORIGINS/);
  });

  it('refuses to start when Supabase is only partly configured', () => {
    const config = loadConfig({ NODE_ENV: 'development', SUPABASE_URL: 'https://x.supabase.co' });
    assert.equal(config.supabaseConfigured, false);
    assert.match(validateStartupConfig(config).errors.join(' '), /partial authentication/);
  });

  it('server.js exits non-zero in production when auth configuration is missing', () => {
    const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'server.js')], {
      cwd: path.join(__dirname, '..'),
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        NODE_ENV: 'production',
        PORT: '0',
        SUPABASE_URL: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
        PUBLIC_SERVER_URL: 'https://sos.example.org',
        TWILIO_ACCOUNT_SID: 'AC123',
        TWILIO_AUTH_TOKEN: 'tok',
        TWILIO_PHONE_NUMBER: '+15550000000',
      },
      encoding: 'utf8',
      timeout: 15000,
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required/);
    assert.doesNotMatch(result.stdout, /Server running/);
  });
});
