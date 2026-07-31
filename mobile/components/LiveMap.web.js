import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { tokens } from '../theme/tokens';

let leafletLoaded = false;

async function ensureLeaflet() {
  if (leafletLoaded || Platform.OS !== 'web') return null;

  if (typeof document !== 'undefined' && !document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  const L = (await import('leaflet')).default;
  leafletLoaded = true;
  return L;
}

export default function LiveMap({ latitude, longitude, accuracy = 15, heartbeat = 'Live' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;

    let cancelled = false;

    (async () => {
      const L = await ensureLeaflet();
      if (!L || cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: true }).setView([latitude, longitude], 16);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom: 20,
      }).addTo(map);

      markerRef.current = L.circleMarker([latitude, longitude], {
        radius: 9,
        color: tokens.color.critical,
        fillColor: tokens.color.critical,
        fillOpacity: 0.95,
        weight: 2,
      }).addTo(map);

      circleRef.current = L.circle([latitude, longitude], {
        radius: accuracy,
        color: tokens.color.primary,
        fillColor: tokens.color.primary,
        fillOpacity: 0.12,
        weight: 1,
      }).addTo(map);

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return;
    const latLng = [latitude, longitude];
    markerRef.current.setLatLng(latLng);
    circleRef.current.setLatLng(latLng);
    circleRef.current.setRadius(accuracy);
    mapRef.current.panTo(latLng, { animate: true, duration: 0.4 });
  }, [latitude, longitude, accuracy, heartbeat]);

  if (Platform.OS !== 'web') {
    return <View style={styles.fallback} />;
  }

  return (
    <View style={styles.wrapper}>
      <View ref={containerRef} style={styles.map} />
      {!ready ? <View style={styles.loadingOverlay} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, borderRadius: tokens.radius.lg, overflow: 'hidden', backgroundColor: tokens.color.surface },
  map: { flex: 1, minHeight: 280, width: '100%' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: tokens.color.surface,
  },
  fallback: { flex: 1, backgroundColor: tokens.color.surface },
});
