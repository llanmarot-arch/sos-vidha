import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { tokens } from '../theme/tokens';
import { applyLiveAppearance } from '../theme/appearance';

export default function WebShell({ children }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  useEffect(() => {
    applyLiveAppearance();
  }, []);

  if (Platform.OS !== 'web' || !isDesktop) {
    return <View style={styles.fluidRoot}>{children}</View>;
  }

  return (
    <View style={styles.desktopRoot}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopRoot: {
    flex: 1,
    minHeight: '100vh',
    backgroundColor: tokens.color.canvas,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    backgroundColor: tokens.color.bg0,
    shadowColor: '#14213D',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  fluidRoot: { flex: 1, backgroundColor: tokens.color.bg0 },
});
