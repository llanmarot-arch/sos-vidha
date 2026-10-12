import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import ScreenHeader from '../../components/ScreenHeader';
import SentinelRadar from '../../components/SentinelRadar';
import { useThemedStyles } from '../../theme/useTheme';
import { requestLocationPermissions, getCurrentPosition } from '../../services/webLocationService';
import { LoadingState } from '../../components/UiStates';
import { useI18n } from '../../i18n/useI18n';

export default function WebSentinelScreen() {
  const { styles } = useThemedStyles(createStyles);
  const { t } = useI18n();
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await requestLocationPermissions();
      try {
        const pos = await getCurrentPosition();
        setCoords({ latitude: pos.latitude, longitude: pos.longitude });
      } catch {
        setCoords(null);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingState message={t('sentinel.loading')} />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader
        title={t('sentinel.title')}
        subtitle={t('sentinel.subtitle')}
      />
      <SentinelRadar latitude={coords?.latitude} longitude={coords?.longitude} />
    </ScrollView>
  );
}

function createStyles(theme) {
  return {
  root: { flex: 1, backgroundColor: theme.color.bg0 },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
};
}
