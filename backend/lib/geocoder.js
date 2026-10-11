/**
 * Optional reverse geocoding. Returns an address only when the provider actually returns one;
 * any error, timeout or empty result yields null. Results are used in the message only, never stored.
 */
function createMapboxGeocoder({ accessToken, fetchImpl = globalThis.fetch, timeoutMs = 2500 }) {
  return {
    async reverse(latitude, longitude) {
      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json` +
        `?limit=1&types=address,poi,neighborhood,locality,place&access_token=${encodeURIComponent(accessToken)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, { signal: controller.signal });
        if (!response.ok) return null;
        const json = await response.json();
        const name = json?.features?.[0]?.place_name;
        if (typeof name !== 'string' || !name.trim()) return null;
        return { text: name.trim().slice(0, 160), provider: 'Mapbox' };
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

module.exports = { createMapboxGeocoder };
