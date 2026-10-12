import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, Platform } from 'react-native';
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
import { useThemedStyles } from '../theme/useTheme';
import { useI18n } from '../i18n/useI18n';
import { apiClient } from '../services/apiClient';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';
import { useProfileStore } from '../store/useProfileStore';
import { useContactsStore } from '../store/useContactsStore';
import { LoadingState } from '../components/UiStates';
import LogoMark from '../components/LogoMark';

const TABS = [
  { id: 'dashboard', labelKey: 'nav.home', icon: 'home' },
  { id: 'live', labelKey: 'nav.location', icon: 'map-pin' },
  { id: 'sentinel', labelKey: 'nav.nearby', icon: 'users' },
  { id: 'contacts', labelKey: 'nav.contacts', icon: 'phone' },
  { id: 'settings', labelKey: 'nav.settings', icon: 'settings' },
];

function AppHeader({ subtitle, onAccountPress, accountLabel }) {
  const { theme, styles } = useThemedStyles(createStyles);
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
          <Feather name="user" size={22} color={theme.color.onHeader} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function WebApp() {
  const { theme, styles } = useThemedStyles(createStyles);
  const { t } = useI18n();
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
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <AppHeader />
        <LoadingState message={t('loading.account')} />
      </WebShell>
    );
  }

  if (authRequired && !signedIn) {
    return (
      <WebShell>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <AppHeader subtitle={t('brand.subtitle')} />
        <View style={styles.main} role="main">
          <AuthFlow />
        </View>
      </WebShell>
    );
  }

  if (showProfile) {
    return (
      <WebShell>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <AppHeader subtitle={t('nav.openProfile')} />
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

  const activeTab = TABS.find((item) => item.id === tab);

  return (
    <WebShell>
      <View style={styles.root}>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <AppHeader
          subtitle={activeTab ? t(activeTab.labelKey) : ''}
          onAccountPress={signedIn ? () => setShowProfile(true) : null}
          accountLabel={t('nav.openProfile')}
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
                accessibilityLabel={t(item.labelKey)}
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.tabIndicator, active && styles.tabIndicatorActive]} />
                <Feather
                  name={item.icon}
                  size={22}
                  color={active ? theme.color.accentOnSurface : theme.color.textSubtle}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t(item.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </WebShell>
  );
}

function createStyles(theme) {
  return {
  root: { flex: 1, backgroundColor: theme.color.bg0 },
  main: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.color.header,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: Platform.OS === 'web' ? 14 : 44,
    paddingBottom: 14,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  brandText: { flex: 1 },
  brandName: { color: theme.color.onHeader, fontSize: 20, fontWeight: '700' },
  brandSub: { color: theme.color.onHeaderMuted, fontSize: 14, marginTop: 1 },
  accountBtn: {
    width: theme.minTouch,
    height: theme.minTouch,
    borderRadius: theme.minTouch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.bg1,
    paddingBottom: Platform.OS === 'web' ? 6 : 20,
  },
  tab: { flex: 1, alignItems: 'center', minHeight: 60, paddingBottom: 6, gap: 4 },
  tabIndicator: { height: 3, width: '60%', borderRadius: 2, backgroundColor: 'transparent', marginBottom: 6 },
  tabIndicatorActive: { backgroundColor: theme.color.accentOnSurface },
  tabLabel: { color: theme.color.textSubtle, fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: theme.color.accentOnSurface, fontWeight: '700' },
};
}
