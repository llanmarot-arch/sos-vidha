import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { tokens } from '../theme/tokens';

export default function LiveMap({ latitude, longitude, accuracy = 15 }) {
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
    >
      <Marker coordinate={{ latitude, longitude }} pinColor={tokens.color.critical} />
      <Circle
        center={{ latitude, longitude }}
        radius={accuracy}
        strokeColor="rgba(16,185,129,0.8)"
        fillColor="rgba(16,185,129,0.15)"
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, minHeight: 280, borderRadius: tokens.radius.lg, overflow: 'hidden' },
});
