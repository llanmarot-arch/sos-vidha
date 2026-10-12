import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useThemedStyles } from '../theme/useTheme';

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

function createStyles(theme) {
  return {
    wrapper: { flex: 1, borderRadius: theme.radius.lg, overflow: 'hidden', backgroundColor: theme.color.surface },
    map: { flex: 1, minHeight: 280, width: '100%' },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.color.surface,
    },
    fallback: { flex: 1, backgroundColor: theme.color.surface },
    offlineOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.color.warningSoft,
      justifyContent: 'center',
      padding: theme.spacing.lg,
      gap: 6,
      zIndex: 1000,
    },
    offlineTitle: { color: theme.color.warning, fontWeight: '800', fontSize: 18, letterSpacing: 0.5 },
    offlineText: { color: theme.color.text, fontSize: 15, lineHeight: 22 },
    offlineCoords: { ...theme.typography.mono, color: theme.color.text, fontSize: 15 },
    partialBanner: {
      position: 'absolute',
      left: 8,
      right: 8,
      bottom: 8,
      backgroundColor: theme.color.warningSoft,
      borderRadius: theme.radius.md,
      padding: 8,
      zIndex: 1000,
    },
    partialText: { color: theme.color.text, fontSize: 14 },
  };
}

export default function LiveMap({ latitude, longitude, accuracy = 15, heartbeat = 'Live' }) {
  const { theme, styles } = useThemedStyles(createStyles);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const [ready, setReady] = useState(false);
  // 'loading' | 'ok' | 'partial' | 'unavailable' — based only on tiles that actually loaded or failed.
  const [tiles, setTiles] = useState('loading');
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;

    let cancelled = false;

    (async () => {
      const L = await ensureLeaflet();
      if (!L || cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: true }).setView([latitude, longitude], 16);
      // Standard OSM tiles are fetched on demand only; they must never be prefetched or bundled for offline use.
      const layer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      });
      let loadedCount = 0;
      layer.on('tileload', () => {
        loadedCount += 1;
        setTiles((t) => (t === 'partial' ? 'partial' : 'ok'));
      });
      layer.on('tileerror', () => setTiles(loadedCount > 0 ? 'partial' : 'unavailable'));
      layer.addTo(map);

      const ink = themeRef.current.color;
      markerRef.current = L.circleMarker([latitude, longitude], {
        radius: 9,
        color: ink.criticalFill,
        fillColor: ink.criticalFill,
        fillOpacity: 0.95,
        weight: 2,
      }).addTo(map);

      circleRef.current = L.circle([latitude, longitude], {
        radius: accuracy,
        color: ink.accentOnSurface,
        fillColor: ink.accentOnSurface,
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
    markerRef.current.setStyle({
      color: theme.color.criticalFill,
      fillColor: theme.color.criticalFill,
    });
    circleRef.current.setStyle({
      color: theme.color.accentOnSurface,
      fillColor: theme.color.accentOnSurface,
    });
    circleRef.current.setRadius(accuracy);
    mapRef.current.panTo(latLng, { animate: true, duration: 0.4 });
  }, [latitude, longitude, accuracy, heartbeat, theme]);

  if (Platform.OS !== 'web') {
    return <View style={styles.fallback} />;
  }

  return (
    <View style={styles.wrapper}>
      <View ref={containerRef} style={styles.map} />
      {!ready ? <View style={styles.loadingOverlay} /> : null}
      {tiles === 'unavailable' ? (
        <View style={styles.offlineOverlay} accessibilityRole="alert">
          <Text style={styles.offlineTitle}>OFFLINE MAP UNAVAILABLE</Text>
          <Text style={styles.offlineText}>
            Map tiles could not load and none are cached on this device. Your GPS position is still recorded:
          </Text>
          <Text style={styles.offlineCoords}>
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
            {accuracy != null ? ` (±${Math.round(accuracy)} m)` : ''}
          </Text>
        </View>
      ) : null}
      {tiles === 'partial' ? (
        <View style={styles.partialBanner}>
          <Text style={styles.partialText}>Some map tiles could not load. Parts of the map may be missing.</Text>
        </View>
      ) : null}
    </View>
  );
}
