import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { tokens } from '../theme/tokens';

export default function WebShell({ children }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [deviceView, setDeviceView] = useState(true);

  if (Platform.OS !== 'web' || !isDesktop) {
    return <View style={styles.fluidRoot}>{children}</View>;
  }

  return (
    <View style={styles.desktopRoot}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          <Feather name="shield" size={18} color={tokens.color.primaryBright} />
          <Text style={styles.toolbarTitle}>SOS-VIDHA SECURE CONSOLE</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.toggleBtn}
          onPress={() => setDeviceView((v) => !v)}
        >
          <Feather name={deviceView ? 'maximize-2' : 'smartphone'} size={14} color={tokens.color.primaryBright} />
          <Text style={styles.toggleText}>{deviceView ? 'EXPAND VIEWPORT' : 'DEVICE VIEWPORT'}</Text>
        </TouchableOpacity>
      </View>

      {deviceView ? (
        <View style={styles.deviceStage}>
          <View style={styles.deviceFrame}>
            <View style={styles.notch} />
            <View style={styles.statusStrip}>
              <Text style={styles.statusTime}>09:41</Text>
              <Text style={styles.statusBrand}>SOS-VIDHA</Text>
              <View style={styles.statusRight}>
                <Feather name="wifi" size={11} color={tokens.color.textMuted} />
                <Text style={styles.statusBattery}>100%</Text>
              </View>
            </View>
            <View style={styles.deviceContent}>{children}</View>
          </View>
        </View>
      ) : (
        <View style={styles.fluidStage}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  desktopRoot: { flex: 1, backgroundColor: tokens.color.bg0, minHeight: '100vh' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.md,
    borderBottomWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.bg1,
  },
  toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toolbarTitle: { color: tokens.color.text, fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toggleText: { color: tokens.color.primaryBright, fontWeight: '700', fontSize: 10, letterSpacing: 0.6 },
  deviceStage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.xl },
  deviceFrame: {
    width: tokens.device.width,
    height: tokens.device.height,
    borderRadius: 40,
    backgroundColor: tokens.color.bg0,
    borderWidth: 1,
    borderColor: '#27272A',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 20 },
    elevation: 24,
  },
  notch: {
    alignSelf: 'center',
    width: 110,
    height: 26,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    backgroundColor: tokens.color.bg0,
  },
  statusStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 4,
    backgroundColor: tokens.color.bg0,
  },
  statusTime: { color: tokens.color.text, fontSize: 11, fontWeight: '700' },
  statusBrand: { color: tokens.color.textSubtle, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  statusRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBattery: { color: tokens.color.text, fontSize: 11, fontWeight: '700' },
  deviceContent: { flex: 1 },
  fluidStage: { flex: 1 },
  fluidRoot: { flex: 1, backgroundColor: tokens.color.bg0 },
});
