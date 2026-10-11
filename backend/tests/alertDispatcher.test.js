const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createAlertDispatcher, mapProviderStatus } = require('../lib/alertDispatcher');
const { MemoryIncidentRepository } = require('../lib/incidentRepository');
const { classifyProviderError, ProviderConfigError } = require('../lib/twilioService');

const quiet = { info() {}, warn() {}, error() {} };
const RECIPIENTS = [
  { contactId: 'c1', name: 'Ravi', phone: '+919800000001' },
  { contactId: 'c2', name: 'Meera', phone: '+919800000002' },
];
const INCIDENT = { id: 'inc-1', userId: 'user-a' };

function httpError(status, code) {
  const err = new Error(`HTTP ${status}`);
  err.status = status;
  err.code = code;
  return err;
}

function fakeProvider(script = []) {
  const calls = [];
  let i = 0;
  return {
    calls,
    lookups: [],
    lookupResult: { supported: true, match: null },
    async send(message) {
      calls.push(message);
      const step = script[i++] ?? { sid: `SM${calls.length}`, status: 'queued' };
      if (step instanceof Error) throw step;
      return step;
    },
    async findRecentMessage(q) {
      this.lookups.push(q);
      return this.lookupResult;
    },
    validateWebhook: () => true,
  };
}

function setup({ provider, liveSend = true, maxAttempts = 3 } = {}) {
  const repo = new MemoryIncidentRepository();
  const sleeps = [];
  const dispatcher = createAlertDispatcher({
    repo,
    provider,
    liveSend,
    maxAttempts,
    retryBaseMs: 100,
    sleep: async (ms) => sleeps.push(ms),
    logger: quiet,
  });
  return { repo, dispatcher, sleeps };
}

describe('alert dispatcher', () => {
  it('reports a queued message as accepted, never as sent or delivered', async () => {
    const provider = fakeProvider([{ sid: 'SM1', status: 'queued' }]);
    const { dispatcher } = setup({ provider });
    const [d] = await dispatcher.dispatch({ incident: INCIDENT, recipients: [RECIPIENTS[0]], channel: 'sms', body: 'x' });
    assert.equal(d.status, 'accepted');
    assert.equal(d.providerMessageSid, 'SM1');
    assert.equal(d.sentAt, null);
    assert.equal(d.deliveredAt, null);
  });

  it('sends one message per recipient and never resends on duplicate dispatch', async () => {
    const provider = fakeProvider();
    const { dispatcher, repo } = setup({ provider });
    await dispatcher.dispatch({ incident: INCIDENT, recipients: RECIPIENTS, channel: 'sms', body: 'x' });
    await dispatcher.dispatch({ incident: INCIDENT, recipients: RECIPIENTS, channel: 'sms', body: 'x' });
    await Promise.all([
      dispatcher.dispatch({ incident: INCIDENT, recipients: RECIPIENTS, channel: 'sms', body: 'x' }),
      dispatcher.dispatch({ incident: INCIDENT, recipients: RECIPIENTS, channel: 'sms', body: 'x' }),
    ]);
    assert.equal(provider.calls.length, 2);
    assert.deepEqual(provider.calls.map((c) => c.to).sort(), ['+919800000001', '+919800000002']);
    assert.equal((await repo.listDeliveries('inc-1')).length, 2);
  });

  it('marks deliveries dry_run and sends nothing when live sending is off', async () => {
    const provider = fakeProvider();
    const { dispatcher } = setup({ provider, liveSend: false });
    const results = await dispatcher.dispatch({ incident: INCIDENT, recipients: RECIPIENTS, channel: 'sms', body: 'x' });
    assert.equal(provider.calls.length, 0);
    assert.deepEqual(results.map((d) => d.status), ['dry_run', 'dry_run']);
  });

  it('retries transient provider failures with backoff', async () => {
    const provider = fakeProvider([httpError(503), httpError(429), { sid: 'SM9', status: 'queued' }]);
    const { dispatcher, sleeps } = setup({ provider });
    const [d] = await dispatcher.dispatch({ incident: INCIDENT, recipients: [RECIPIENTS[0]], channel: 'sms', body: 'x' });
    assert.equal(provider.calls.length, 3);
    assert.deepEqual(sleeps, [100, 200]);
    assert.equal(d.status, 'accepted');
    assert.equal(d.attempts, 3);
  });

  it('marks failed after exhausting transient retries', async () => {
    const provider = fakeProvider([httpError(500), httpError(500), httpError(500)]);
    const { dispatcher } = setup({ provider });
    const [d] = await dispatcher.dispatch({ incident: INCIDENT, recipients: [RECIPIENTS[0]], channel: 'sms', body: 'x' });
    assert.equal(d.status, 'failed');
    assert.equal(provider.calls.length, 3);
  });

  it('does not retry permanent provider failures', async () => {
    const provider = fakeProvider([httpError(400, 21211)]);
    const { dispatcher } = setup({ provider });
    const [d] = await dispatcher.dispatch({ incident: INCIDENT, recipients: [RECIPIENTS[0]], channel: 'sms', body: 'x' });
    assert.equal(d.status, 'failed');
    assert.equal(d.providerErrorCode, '21211');
    assert.equal(provider.calls.length, 1);
  });

  it('does not resend after an ambiguous failure it cannot reconcile', async () => {
    const provider = fakeProvider([new Error('socket hang up')]);
    provider.lookupResult = { supported: false, match: null };
    const { dispatcher } = setup({ provider });
    const [d] = await dispatcher.dispatch({ incident: INCIDENT, recipients: [RECIPIENTS[0]], channel: 'sms', body: 'x' });
    assert.equal(d.status, 'unconfirmed');
    assert.equal(provider.calls.length, 1);
  });

  it('adopts the provider record when an ambiguous send actually went through', async () => {
    const provider = fakeProvider([new Error('ETIMEDOUT')]);
    provider.lookupResult = { supported: true, match: { sid: 'SM77', status: 'sent' } };
    const { dispatcher } = setup({ provider });
    const [d] = await dispatcher.dispatch({ incident: INCIDENT, recipients: [RECIPIENTS[0]], channel: 'sms', body: 'x' });
    assert.equal(provider.calls.length, 1);
    assert.equal(d.status, 'sent');
    assert.equal(d.providerMessageSid, 'SM77');
  });

  it('retries an ambiguous failure only after confirming no message exists', async () => {
    const provider = fakeProvider([new Error('ECONNRESET'), { sid: 'SM5', status: 'queued' }]);
    provider.lookupResult = { supported: true, match: null };
    const { dispatcher } = setup({ provider });
    const [d] = await dispatcher.dispatch({ incident: INCIDENT, recipients: [RECIPIENTS[0]], channel: 'sms', body: 'x' });
    assert.equal(provider.lookups.length, 1);
    assert.equal(provider.calls.length, 2);
    assert.equal(d.status, 'accepted');
  });

  it('marks rate-limited deliveries without contacting the provider', async () => {
    const provider = fakeProvider();
    const { dispatcher } = setup({ provider });
    const results = await dispatcher.dispatch({
      incident: INCIDENT,
      recipients: RECIPIENTS,
      channel: 'sms',
      body: 'x',
      rateLimited: true,
    });
    assert.equal(provider.calls.length, 0);
    assert.deepEqual(results.map((d) => d.status), ['rate_limited', 'rate_limited']);
  });

  it('applies status callbacks monotonically', async () => {
    const provider = fakeProvider([{ sid: 'SM1', status: 'queued' }]);
    const { dispatcher } = setup({ provider });
    await dispatcher.dispatch({ incident: INCIDENT, recipients: [RECIPIENTS[0]], channel: 'sms', body: 'x' });

    let d = await dispatcher.applyStatusCallback({ sid: 'SM1', providerStatus: 'sent' });
    assert.equal(d.status, 'sent');
    d = await dispatcher.applyStatusCallback({ sid: 'SM1', providerStatus: 'delivered' });
    assert.equal(d.status, 'delivered');
    d = await dispatcher.applyStatusCallback({ sid: 'SM1', providerStatus: 'queued' });
    assert.equal(d.status, 'delivered');
    d = await dispatcher.applyStatusCallback({ sid: 'SM1', providerStatus: 'failed' });
    assert.equal(d.status, 'delivered');
    assert.equal(await dispatcher.applyStatusCallback({ sid: 'unknown', providerStatus: 'delivered' }), null);
  });

  it('maps provider statuses conservatively', () => {
    assert.equal(mapProviderStatus('queued'), 'accepted');
    assert.equal(mapProviderStatus('sending'), 'accepted');
    assert.equal(mapProviderStatus('sent'), 'sent');
    assert.equal(mapProviderStatus('delivered'), 'delivered');
    assert.equal(mapProviderStatus('canceled'), 'failed');
    assert.equal(mapProviderStatus('made-up'), null);
  });

  it('classifies provider errors', () => {
    assert.equal(classifyProviderError(httpError(503)), 'transient');
    assert.equal(classifyProviderError(httpError(429)), 'transient');
    assert.equal(classifyProviderError(httpError(400)), 'permanent');
    assert.equal(classifyProviderError(new ProviderConfigError('x')), 'permanent');
    assert.equal(classifyProviderError(new Error('timeout')), 'ambiguous');
  });
});
