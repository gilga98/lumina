/**
 * WeatherService — Open-Meteo API wrapper.
 * Fetches real-time weather data without requiring an API key.
 */
export class WeatherService {
  /**
   * Fetch current weather for given coordinates.
   * @param {number} lat
   * @param {number} lon
   * @returns {Promise<object>}
   */
  static async getCurrentWeather(lat, lon) {
    const CACHE_KEY = `weather_${lat.toFixed(2)}_${lon.toFixed(2)}`;
    const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds

    try {
      // Check cache first
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          console.log('Using cached weather data');
          return data;
        }
      }

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const data = await resp.json();
      const current = data.current_weather;
      
      const weatherInfo = {
        temp: Math.round(current.temperature),
        code: current.weathercode,
        description: WeatherService.getConditionText(current.weathercode),
        emoji: WeatherService.getConditionEmoji(current.weathercode),
        isHot: current.temperature > 30,
        isCold: current.temperature < 15,
        isRainy: [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(current.weathercode),
      };

      // Save to cache
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: weatherInfo,
        timestamp: Date.now()
      }));

      return weatherInfo;
    } catch (err) {
      console.error('Weather fetch failed:', err);
      return null;
    }
  }

  /**
   * Map WMO Weather Interpretation Codes to human text.
   */
  static getConditionText(code) {
    const map = {
      0: 'Clear sky',
      1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Fog', 48: 'Depositing rime fog',
      51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
      61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
      71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
      80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
      95: 'Thunderstorm',
    };
    return map[code] || 'Clear';
  }

  /**
   * Map WMO codes to emojis.
   */
  static getConditionEmoji(code) {
    if (code === 0) return '☀️';
    if (code <= 3) return '🌤️';
    if (code <= 48) return '🌫️';
    if (code <= 55) return '🌦️';
    if (code <= 65) return '🌧️';
    if (code <= 75) return '❄️';
    if (code <= 82) return '⛈️';
    return '🌈';
  }
}
