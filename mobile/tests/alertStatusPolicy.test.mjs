import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyLocationError,
  describeDeliveryStatus,
  describeAlertLocation,
  isFinalDeliveryStatus,
} from '../services/apiClientPolicy.js';
import { mockApi } from '../services/mockApi.js';

describe('describeDeliveryStatus', () => {
  it('never describes a queued or sent message as delivered', () => {
    assert.doesNotMatch(describeDeliveryStatus('accepted').label, /deliver(ed)?$/i);
    assert.match(describeDeliveryStatus('accepted').label, /not yet confirmed/);
    assert.match(describeDeliveryStatus('sent').label, /delivery not yet confirmed/);
    assert.equal(describeDeliveryStatus('delivered').label, 'Delivered');
  });

  it('makes test mode, rate limiting and unknown outcomes explicit', () => {
    assert.match(describeDeliveryStatus('dry_run').label, /Not sent/);
    assert.match(describeDeliveryStatus('rate_limited').label, /Not sent/);
    assert.match(describeDeliveryStatus('unconfirmed').label, /could not confirm/);
    assert.equal(describeDeliveryStatus('nonsense').label, 'Status unknown');
  });

  it('keeps polling until a status is final', () => {
    assert.equal(isFinalDeliveryStatus('accepted'), false);
    assert.equal(isFinalDeliveryStatus('sent'), false);
    assert.equal(isFinalDeliveryStatus('delivered'), true);
    assert.equal(isFinalDeliveryStatus('failed'), true);
  });
});

describe('classifyLocationError', () => {
  it('maps browser geolocation codes', () => {
    assert.equal(classifyLocationError({ code: 1 }), 'PERMISSION_DENIED');
    assert.equal(classifyLocationError({ code: 2 }), 'POSITION_UNAVAILABLE');
    assert.equal(classifyLocationError({ code: 3 }), 'TIMEOUT');
  });

  it('maps Expo-style messages and defaults to unavailable', () => {
    assert.equal(classifyLocationError(new Error('Location permission not granted')), 'PERMISSION_DENIED');
    assert.equal(classifyLocationError(new Error('Request timed out')), 'TIMEOUT');
    assert.equal(classifyLocationError(new Error('???')), 'POSITION_UNAVAILABLE');
    assert.equal(classifyLocationError({ code: 'UNSUPPORTED' }), 'UNSUPPORTED');
  });
});

describe('describeAlertLocation', () => {
  it('tells the user what contacts were told about their location', () => {
    assert.match(describeAlertLocation({ status: 'FRESH' }), /current GPS location/);
    assert.match(describeAlertLocation({ status: 'STALE' }), /out of date/);
    assert.match(describeAlertLocation({ status: 'UNAVAILABLE' }), /unavailable/);
  });
});

describe('mockApi never fabricates location', () => {
  it('reports location unavailable when none was sent', async () => {
    const session = await mockApi.startSession({ mode: 'GEOFENCE', locationError: 'PERMISSION_DENIED' });
    assert.equal(session.location.status, 'UNAVAILABLE');
    assert.equal(session.location.reason, 'PERMISSION_DENIED');
    await assert.rejects(() => mockApi.getSession('unknown-session'), /Session not found/);
  });
});
