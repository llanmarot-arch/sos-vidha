import React from 'react';
import { View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { useThemedStyles } from '../theme/useTheme';

function createStyles(theme) {
  return {
    map: { flex: 1, minHeight: 280, borderRadius: theme.radius.lg, overflow: 'hidden' },
  };
}

export default function LiveMap({ latitude, longitude, accuracy = 15 }) {
  const { theme, styles } = useThemedStyles(createStyles);
  return (
    <MapView
      style={styles.map}
      region={{
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      showsUserLocation
      userInterfaceStyle={theme.scheme === 'light' ? 'light' : 'dark'}
    >
      <Marker coordinate={{ latitude, longitude }} pinColor={theme.color.criticalFill} />
      <Circle
        center={{ latitude, longitude }}
        radius={accuracy}
        strokeColor={theme.color.success}
        fillColor={theme.color.successSoft}
      />
    </MapView>
  );
}
