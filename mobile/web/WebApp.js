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
import WebProfileScreen from '../screens/web/WebProfileScreen';
import AuthFlow from './AuthFlow';
import { tokens } from '../theme/tokens';
import { apiClient } from '../services/apiClient';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';
import { useProfileStore } from '../store/useProfileStore';
import { useContactsStore } from '../store/useContactsStore';
import { LoadingState } from '../components/UiStates';
import LogoMark from '../components/LogoMark';

const TABS = [
  { id: 'dashboard', label: 'Home', icon: 'home' },
  { id: 'live', label: 'Location', icon: 'map-pin' },
  { id: 'sentinel', label: 'Nearby', icon: 'users' },
  { id: 'contacts', label: 'Contacts', icon: 'phone' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

function AppHeader({ subtitle, onAccountPress, accountLabel }) {
  return (
    <View style={styles.header} role="banner">
      <View style={styles.brandRow}>
        <LogoMark size={40} />
        <View style={styles.brandText}>
          <Text style={styles.brandName}>SOS-Vidha</Text>
          {subtitle ? <Text style={styles.brandSub}>{subtitle}</Text> : null}
        </View>
      </View>
      {onAccountPress ? (
        <TouchableOpacity
          onPress={onAccountPress}
          style={styles.accountBtn}
          accessibilityRole="button"
          accessibilityLabel={accountLabel}
        >
          <Feather name="user" size={22} color={tokens.color.onHeader} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function WebApp() {
  const [tab, setTab] = useState('dashboard');
  const [showProfile, setShowProfile] = useState(false);

  const initialized = useAuthStore((s) => s.initialized);
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const initialize = useAuthStore((s) => s.initialize);

  const authRequired = isSupabaseConfigured();
  const signedIn = Boolean(session?.user);

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    apiClient.healthCheck().catch(() => {});
  }, [signedIn]);

  useEffect(() => {
    if (signedIn && user?.id) {
      useProfileStore.getState().loadProfile(user.id);
      useContactsStore.getState().loadContacts(user.id);
    } else if (!authRequired) {
      useContactsStore.getState().loadContacts(null);
    } else {
      useContactsStore.getState().reset();
      useProfileStore.getState().clear();
    }
  }, [signedIn, user?.id, authRequired]);

  if (!initialized) {
    return (
      <WebShell>
        <StatusBar style={tokens.scheme === 'dark' ? 'light' : 'dark'} />
        <AppHeader />
        <LoadingState message="Loading your account…" />
      </WebShell>
    );
  }

  if (authRequired && !signedIn) {
    return (
      <WebShell>
        <StatusBar style={tokens.scheme === 'dark' ? 'light' : 'dark'} />
        <AppHeader subtitle="Your personal safety companion" />
        <View style={styles.main} role="main">
          <AuthFlow />
        </View>
      </WebShell>
    );
  }

  if (showProfile) {
    return (
      <WebShell>
        <StatusBar style={tokens.scheme === 'dark' ? 'light' : 'dark'} />
        <AppHeader subtitle="My profile" />
        <View style={styles.main} role="main">
          <WebProfileScreen
            onBack={() => setShowProfile(false)}
            onManageGuardians={() => {
              setShowProfile(false);
              setTab('contacts');
            }}
          />
        </View>
      </WebShell>
    );
  }

  const renderScreen = () => {
    switch (tab) {
      case 'live':
        return <WebLiveSessionScreen />;
      case 'sentinel':
        return <WebSentinelScreen />;
      case 'contacts':
        return <WebContactsScreen userId={user?.id} />;
      case 'settings':
        return <WebSettingsScreen onOpenProfile={() => setShowProfile(true)} signedIn={signedIn} />;
      default:
        return <WebDashboardScreen onNavigate={setTab} />;
    }
  };

  const activeTab = TABS.find((t) => t.id === tab);

  return (
    <WebShell>
      <View style={styles.root}>
        <StatusBar style={tokens.scheme === 'dark' ? 'light' : 'dark'} />
        <AppHeader
          subtitle={activeTab?.label}
          onAccountPress={signedIn ? () => setShowProfile(true) : null}
          accountLabel="Open my profile"
        />
        <View style={styles.main} role="main">
          {renderScreen()}
        </View>
        <View style={styles.tabBar} accessibilityRole="tablist" role="tablist" aria-label="Main sections">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.7}
                style={styles.tab}
                onPress={() => setTab(item.id)}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.tabIndicator, active && styles.tabIndicatorActive]} />
                <Feather
                  name={item.icon}
                  size={22}
                  color={active ? tokens.color.primary : tokens.color.textSubtle}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.color.header,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: Platform.OS === 'web' ? 14 : 44,
    paddingBottom: 14,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  brandText: { flex: 1 },
  brandName: { color: tokens.color.onHeader, fontSize: 20, fontWeight: '700' },
  brandSub: { color: tokens.color.onHeaderMuted, fontSize: 14, marginTop: 1 },
  accountBtn: {
    width: tokens.minTouch,
    height: tokens.minTouch,
    borderRadius: tokens.minTouch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.bg1,
    paddingBottom: Platform.OS === 'web' ? 6 : 20,
  },
  tab: { flex: 1, alignItems: 'center', minHeight: 60, paddingBottom: 6, gap: 4 },
  tabIndicator: { height: 3, width: '60%', borderRadius: 2, backgroundColor: 'transparent', marginBottom: 6 },
  tabIndicatorActive: { backgroundColor: tokens.color.primary },
  tabLabel: { color: tokens.color.textSubtle, fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: tokens.color.primary, fontWeight: '700' },
});
