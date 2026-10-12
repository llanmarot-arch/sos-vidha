import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AppButton from './AppButton';
import { useThemedStyles } from '../theme/useTheme';
import { shareLiveLocation, copyToClipboard, buildMapsUrl } from '../services/locationShareService';
import { shareToContactWhatsApp } from '../services/whatsappAlertService';

export default function LiveLocationSharePanel({
  location,
  sessionId,
  trackingUrl,
  contacts = [],
}) {
  const { theme, styles } = useThemedStyles(createStyles);
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
        <Feather name="share-2" size={20} color={theme.color.accentOnSurface} />
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

function createStyles(theme) {
  return {
  panel: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: theme.spacing.sm },
  title: { ...theme.typography.title, color: theme.color.text },
  subtitle: { color: theme.color.textMuted, fontSize: 15, lineHeight: 22, marginBottom: theme.spacing.md },
  coordsBox: {
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  coordsLabel: { color: theme.color.textMuted, fontSize: 14 },
  coords: { color: theme.color.text, fontWeight: '700', marginTop: 4, fontSize: 17 },
  meta: { color: theme.color.textSubtle, fontSize: 14, marginTop: 4, lineHeight: 20 },
  waiting: { color: theme.color.textMuted, marginBottom: theme.spacing.sm, fontSize: 15 },
  trackUrl: { ...theme.typography.mono, color: theme.color.accentOnSurface, marginBottom: theme.spacing.sm },
  status: { color: theme.color.success, fontWeight: '700', fontSize: 15, marginBottom: theme.spacing.sm },
  actions: { gap: theme.spacing.sm },
  contactList: { marginTop: theme.spacing.md, gap: theme.spacing.sm },
  contactTitle: { color: theme.color.text, fontWeight: '700', fontSize: 16, marginBottom: 4 },
  };
}
