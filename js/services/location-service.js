/**
 * LocationService — Standard Geolocation API wrapper.
 * Handles coordinates and provides a simple city lookup.
 */
export class LocationService {
  static _cachedLocation = null;

  /**
   * Get current latitude and longitude.
   * @returns {Promise<{lat: number, lon: number}>}
   */
  static async getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) => reject(err),
        { timeout: 10000 }
      );
    });
  }

  /**
   * Get city name from coordinates using a free reverse geocoding API.
   * Using BigDataCloud's free client-side API as it doesn't require a key for basic usage.
   * @param {number} lat
   * @param {number} lon
   * @returns {Promise<string>}
   */
  static async getCityName(lat, lon) {
    try {
      const resp = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
      if (!resp.ok) return 'Unknown Location';
      const data = await resp.json();
      return data.city || data.locality || 'Nearby';
    } catch {
      return 'Unknown Location';
    }
  }

  /**
   * Returns a cached or fresh location object.
   */
  static async getLocation() {
    if (LocationService._cachedLocation) return LocationService._cachedLocation;
    try {
      const coords = await LocationService.getCurrentPosition();
      const city = await LocationService.getCityName(coords.lat, coords.lon);
      LocationService._cachedLocation = { ...coords, city };
      return LocationService._cachedLocation;
    } catch (err) {
      console.warn('Location access denied or failed:', err);
      return null;
    }
  }
}
