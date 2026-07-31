import {
  MAPBOX_ACCESS_TOKEN,
  GOOGLE_DIRECTIONS_API_KEY,
} from '../constants/config';
import { decodeMapboxPolyline6, decodePolyline } from '../utils/geo';

/**
 * Fetch optimal and alternative driving routes.
 * Prefers Mapbox Directions API; falls back to Google Directions API.
 */
export async function fetchTransitRoutes(origin, destination) {
  if (MAPBOX_ACCESS_TOKEN) {
    return fetchMapboxRoutes(origin, destination);
  }
  if (GOOGLE_DIRECTIONS_API_KEY) {
    return fetchGoogleRoutes(origin, destination);
  }

  throw new Error(
    'Configure EXPO_PUBLIC_MAPBOX_TOKEN or EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY in .env'
  );
}

async function fetchMapboxRoutes(origin, destination) {
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
    `?alternatives=true&geometries=polyline6&overview=full&access_token=${MAPBOX_ACCESS_TOKEN}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Mapbox Directions failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data.routes?.length) {
    throw new Error('No routes returned from Mapbox');
  }

  return data.routes.map((route, index) => ({
    id: `mapbox-${index}`,
    name: index === 0 ? 'Primary route' : `Alternative ${index}`,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    polyline: decodeMapboxPolyline6(route.geometry),
  }));
}

async function fetchGoogleRoutes(origin, destination) {
  const url =
    `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}` +
    `&destination=${destination.latitude},${destination.longitude}` +
    `&mode=driving&alternatives=true&key=${GOOGLE_DIRECTIONS_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Directions failed: ${res.status}`);
  }

  const data = await res.json();
  if (data.status !== 'OK' || !data.routes?.length) {
    throw new Error(data.error_message || 'No routes returned from Google');
  }

  return data.routes.map((route, index) => {
    const points = route.overview_polyline?.points;
    return {
      id: `google-${index}`,
      name: index === 0 ? 'Primary route' : `Alternative ${index}`,
      distanceMeters: route.legs?.[0]?.distance?.value ?? 0,
      durationSeconds: route.legs?.[0]?.duration?.value ?? 0,
      polyline: points ? decodePolyline(points) : [],
    };
  });
}

export async function geocodeDestination(query) {
  if (MAPBOX_ACCESS_TOKEN) {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?limit=1&access_token=${MAPBOX_ACCESS_TOKEN}`;
    const res = await fetch(url);
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) throw new Error('Destination not found');
    const [longitude, latitude] = feature.center;
    return { latitude, longitude, label: feature.place_name };
  }

  if (GOOGLE_DIRECTIONS_API_KEY) {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}` +
      `&key=${GOOGLE_DIRECTIONS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) throw new Error('Destination not found');
    return {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      label: result.formatted_address,
    };
  }

  throw new Error('Geocoding requires Mapbox or Google API key');
}
