import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MapView({ style, children, ...rest }) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>Map unavailable in shim — use LiveMap.web</Text>
      {children}
    </View>
  );
}

export function Marker() {
  return null;
}

export function Circle() {
  return null;
}

export function Polyline() {
  return null;
}

export const PROVIDER_DEFAULT = 'default';

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#94A3B8',
    fontSize: 12,
  },
});
