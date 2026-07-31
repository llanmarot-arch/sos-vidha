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
  };

  const handleCopy = async () => {
    const text = trackingUrl || (location ? buildMapsUrl(location.latitude, location.longitude) : '');
    const ok = await copyToClipboard(text);
    setStatus(ok ? 'LINK COPIED TO CLIPBOARD' : 'COPY FAILED');
    setTimeout(() => setStatus(null), 2500);
  };

  const handleShare = async () => {
    setSharing(true);
    const result = await shareLiveLocation(payload);
    setSharing(false);
    setStatus(result.success ? 'LOCATION SHARED' : 'SHARE CANCELLED');
    setTimeout(() => setStatus(null), 2500);
  };

  const handleWhatsAppAll = async () => {
    if (!contacts.length) {
      setStatus('NO GUARDIAN CONTACTS REGISTERED');
      return;
    }
    setSharing(true);
    for (const contact of contacts) {
      await shareToContactWhatsApp(contact, payload);
    }
    setSharing(false);
    setStatus(`WHATSAPP OPENED FOR ${contacts.length} CONTACT(S)`);
    setTimeout(() => setStatus(null), 3000);
  };

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Feather name="navigation" size={16} color={tokens.color.primaryBright} />
        <Text style={styles.title}>LIVE LOCATION SHARING</Text>
      </View>

      <Text style={styles.subtitle}>
        Broadcast your real-time coordinates to guardians via link or WhatsApp.
      </Text>

      {location ? (
        <View style={styles.coordsBox}>
          <Text style={styles.coordsLabel}>CURRENT FIX</Text>
          <Text style={styles.coords}>
            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </Text>
          <Text style={styles.meta}>
            Accuracy ±{location.accuracy?.toFixed?.(0) ?? '—'}m · Updated{' '}
            {new Date(location.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      ) : (
        <Text style={styles.waiting}>AWAITING GPS FIX…</Text>
      )}

      {trackingUrl ? (
        <Text style={styles.trackUrl} numberOfLines={2}>
          {trackingUrl}
        </Text>
      ) : null}

      {status ? <Text style={styles.status}>{status}</Text> : null}

      <View style={styles.actions}>
        <AppButton label="COPY LIVE LINK" variant="ghost" onPress={handleCopy} disabled={!trackingUrl && !location} />
        <AppButton label="SHARE LOCATION" variant="primary" onPress={handleShare} loading={sharing} disabled={!location} />
        <AppButton
          label="SEND VIA WHATSAPP"
          variant="critical"
          onPress={handleWhatsAppAll}
          loading={sharing}
          disabled={!location || contacts.length === 0}
        />
      </View>

      {contacts.length > 0 ? (
        <View style={styles.contactList}>
          <Text style={styles.contactTitle}>SHARE TO INDIVIDUAL GUARDIAN</Text>
          {contacts.map((contact) => (
            <AppButton
              key={contact.id}
              label={`WHATSAPP · ${contact.name.toUpperCase()}`}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: tokens.spacing.sm },
  title: { ...tokens.typography.caption, color: tokens.color.primaryBright },
  subtitle: { color: tokens.color.textMuted, fontSize: 12, lineHeight: 18, marginBottom: tokens.spacing.md },
  coordsBox: {
    backgroundColor: tokens.color.bg2,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  coordsLabel: { ...tokens.typography.caption, color: tokens.color.textSubtle, fontSize: 9 },
  coords: { color: tokens.color.text, fontWeight: '800', fontFamily: 'monospace', marginTop: 4, fontSize: 13 },
  meta: { color: tokens.color.textSubtle, fontSize: 10, marginTop: 6 },
  waiting: { color: tokens.color.textSubtle, marginBottom: tokens.spacing.sm, fontSize: 12 },
  trackUrl: { ...tokens.typography.mono, color: tokens.color.primaryLight, fontSize: 10, marginBottom: tokens.spacing.sm },
  status: { color: tokens.color.primaryBright, fontWeight: '700', fontSize: 11, marginBottom: tokens.spacing.sm, letterSpacing: 0.4 },
  actions: { gap: tokens.spacing.sm },
  contactList: { marginTop: tokens.spacing.md, gap: tokens.spacing.sm },
  contactTitle: { ...tokens.typography.caption, color: tokens.color.textSubtle, fontSize: 9, marginBottom: 4 },
});
