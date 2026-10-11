import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AppButton from './AppButton';
import { tokens } from '../theme/tokens';
import { shareLiveLocation, copyToClipboard, buildMapsUrl } from '../services/locationShareService';
import { shareToContactWhatsApp } from '../services/whatsappAlertService';

export default function LiveLocationSharePanel({
  location,
  sessionId,
  trackingUrl,
  contacts = [],
}) {
  const [status, setStatus] = useState(null);
  const [sharing, setSharing] = useState(false);

  const payload = {
    sessionId,
    trackingUrl,
    latitude: location?.latitude,
    longitude: location?.longitude,
    timestamp: location?.timestamp,
    accuracy: location?.accuracy,
  };

  const handleCopy = async () => {
    const text = trackingUrl || (location ? buildMapsUrl(location.latitude, location.longitude) : '');
    const ok = await copyToClipboard(text);
    setStatus(ok ? 'Link copied.' : "Couldn't copy the link.");
    setTimeout(() => setStatus(null), 4000);
  };

  const handleShare = async () => {
    setSharing(true);
    const result = await shareLiveLocation(payload);
    setSharing(false);
    setStatus(result.success ? 'Location shared.' : 'Sharing was cancelled.');
    setTimeout(() => setStatus(null), 4000);
  };

  const handleWhatsAppAll = async () => {
    if (!contacts.length) {
      setStatus('Add an emergency contact first.');
      return;
    }
    setSharing(true);
    for (const contact of contacts) {
      await shareToContactWhatsApp(contact, payload);
    }
    setSharing(false);
    setStatus(`WhatsApp opened for ${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'}.`);
    setTimeout(() => setStatus(null), 4000);
  };

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Feather name="share-2" size={20} color={tokens.color.primary} />
        <Text style={styles.title} accessibilityRole="header" aria-level={2}>
          Share my location
        </Text>
      </View>

      <Text style={styles.subtitle}>Send a link so your contacts can see where you are.</Text>

      {location ? (
        <View style={styles.coordsBox}>
          <Text style={styles.coordsLabel}>Your current location</Text>
          <Text style={styles.coords}>
            {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
          </Text>
          <Text style={styles.meta}>
            Accurate to about {location.accuracy?.toFixed?.(0) ?? '—'} m · Updated{' '}
            {new Date(location.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      ) : (
        <Text style={styles.waiting}>Finding your location…</Text>
      )}

      {trackingUrl ? (
        <Text style={styles.trackUrl} numberOfLines={2}>
          {trackingUrl}
        </Text>
      ) : null}

      {status ? (
        <Text style={styles.status} accessibilityLiveRegion="polite" role="status">
          {status}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <AppButton
          label="Send on WhatsApp to all contacts"
          variant="primary"
          onPress={handleWhatsAppAll}
          loading={sharing}
          disabled={!location || contacts.length === 0}
        />
        <AppButton label="Share another way" variant="ghost" onPress={handleShare} loading={sharing} disabled={!location} />
        <AppButton label="Copy link" variant="ghost" onPress={handleCopy} disabled={!trackingUrl && !location} />
      </View>

      {contacts.length > 0 ? (
        <View style={styles.contactList}>
          <Text style={styles.contactTitle} accessibilityRole="header" aria-level={3}>
            Send to one person
          </Text>
          {contacts.map((contact) => (
            <AppButton
              key={contact.id}
              label={`WhatsApp ${contact.name}`}
              variant="ghost"
              onPress={() => shareToContactWhatsApp(contact, payload)}
              disabled={!location}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: tokens.spacing.lg,
    marginBottom: tokens.spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: tokens.spacing.sm },
  title: { ...tokens.typography.title, color: tokens.color.text },
  subtitle: { color: tokens.color.textMuted, fontSize: 15, lineHeight: 22, marginBottom: tokens.spacing.md },
  coordsBox: {
    backgroundColor: tokens.color.primarySoft,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  coordsLabel: { color: tokens.color.textMuted, fontSize: 14 },
  coords: { color: tokens.color.text, fontWeight: '700', marginTop: 4, fontSize: 17 },
  meta: { color: tokens.color.textSubtle, fontSize: 14, marginTop: 4, lineHeight: 20 },
  waiting: { color: tokens.color.textMuted, marginBottom: tokens.spacing.sm, fontSize: 15 },
  trackUrl: { ...tokens.typography.mono, color: tokens.color.primary, marginBottom: tokens.spacing.sm },
  status: { color: tokens.color.success, fontWeight: '700', fontSize: 15, marginBottom: tokens.spacing.sm },
  actions: { gap: tokens.spacing.sm },
  contactList: { marginTop: tokens.spacing.md, gap: tokens.spacing.sm },
  contactTitle: { color: tokens.color.text, fontWeight: '700', fontSize: 16, marginBottom: 4 },
});
