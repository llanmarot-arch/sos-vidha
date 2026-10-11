import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import ScreenHeader from '../../components/ScreenHeader';
import SentinelRadar from '../../components/SentinelRadar';
import { tokens } from '../../theme/tokens';
import { requestLocationPermissions, getCurrentPosition } from '../../services/webLocationService';
import { LoadingState } from '../../components/UiStates';

export default function WebSentinelScreen() {
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await requestLocationPermissions();
      try {
        const pos = await getCurrentPosition();
        setCoords({ latitude: pos.latitude, longitude: pos.longitude });
      } catch {
        setCoords({ latitude: 28.6139, longitude: 77.209 });
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingState message="Looking for people nearby…" />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Nearby help"
        subtitle="Let SOS-Vidha users close to you know you need help. Your exact location stays hidden."
        status="Connected"
      />
      <SentinelRadar latitude={coords.latitude} longitude={coords.longitude} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.color.bg0 },
  content: { padding: tokens.spacing.lg, paddingBottom: 40 },
});
