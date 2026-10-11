/**
 * Pure helpers for SOS session authorization (unit-testable).
 */

function guardianPhonesRegistered(contacts, contact1, contact2) {
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return false;
  }
  const phones = new Set(contacts.map((c) => String(c.phone_e164)));
  return phones.has(String(contact1)) && phones.has(String(contact2));
}

const { userOwnsSession, isSecureTrackingEnabled } = require('./trackingSecurity');

function userMayAccessSession(session, userId) {
  return userOwnsSession(session, userId, isSecureTrackingEnabled());
}

module.exports = {
  guardianPhonesRegistered,
  userMayAccessSession,
  userOwnsSession,
};
