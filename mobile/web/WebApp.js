import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import WebShell from '../components/WebShell';
import WebDashboardScreen from '../screens/web/WebDashboardScreen';
import WebLiveSessionScreen from '../screens/web/WebLiveSessionScreen';
import WebContactsScreen from '../screens/web/WebContactsScreen';
import WebSentinelScreen from '../screens/web/WebSentinelScreen';
import WebSettingsScreen from '../screens/web/WebSettingsScreen';
import { tokens } from '../theme/tokens';
import { apiClient } from '../services/apiClient';

const TABS = [
  { id: 'dashboard', label: 'COMMAND', icon: 'home' },
  { id: 'live', label: 'LIVE', icon: 'activity' },
  { id: 'sentinel', label: 'SENTINEL', icon: 'users' },
  { id: 'contacts', label: 'GUARDIANS', icon: 'phone' },
  { id: 'settings', label: 'SYSTEM', icon: 'settings' },
];

export default function WebApp() {
  const [tab, setTab] = useState('dashboard');

  useEffect(() => {
    apiClient.healthCheck();
  }, []);

  const renderScreen = () => {
    switch (tab) {
      case 'live':
        return <WebLiveSessionScreen />;
      case 'sentinel':
        return <WebSentinelScreen />;
      case 'contacts':
        return <WebContactsScreen />;
      case 'settings':
        return <WebSettingsScreen />;
      default:
        return <WebDashboardScreen onNavigate={setTab} />;
    }
  };

  return (
    <WebShell>
      <View style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.main}>{renderScreen()}</View>
        <View style={styles.tabBar}>
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.7}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTab(item.id)}
              >
                <Feather
                  name={item.icon}
                  size={18}
                  color={active ? tokens.color.primaryBright : tokens.color.textSubtle}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </WebShell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg0 },
  main: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.bg1,
    paddingBottom: Platform.OS === 'web' ? 10 : 0,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
  tabActive: { backgroundColor: 'rgba(0,128,128,0.12)' },
  tabLabel: { color: tokens.color.textSubtle, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  tabLabelActive: { color: tokens.color.primaryBright },
});
