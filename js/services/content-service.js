/**
 * ContentService — Loads weekly pregnancy data from external JSON files.
 * DRY: Centralizes all content access with in-memory caching.
 * Externalized: JSON files in data/weeks/ can be enriched without code changes.
 */
export class ContentService {
  /** @type {Map<number, object>} */
  static _cache = new Map();
  static _allLoaded = false;

  /** Available week numbers (must match files in data/weeks/) */
  static AVAILABLE_WEEKS = Array.from({length: 40}, (_, i) => i + 1);

  /**
   * Load a single week's data from JSON.
   * @param {number} week
   * @returns {Promise<object>}
   */
  static async loadWeek(week) {
    if (ContentService._cache.has(week)) return ContentService._cache.get(week);

    const padded = String(week).padStart(2, '0');
    try {
      const resp = await fetch(`./data/weeks/week-${padded}.json`);
      if (!resp.ok) return ContentService._fallback(week);
      const data = await resp.json();
      ContentService._cache.set(week, data);
      return data;
    } catch {
      return ContentService._fallback(week);
    }
  }

  /**
   * Preload ALL week data into cache.
   * @returns {Promise<void>}
   */
  static async preloadAll() {
    if (ContentService._allLoaded) return;
    await Promise.all(ContentService.AVAILABLE_WEEKS.map(w => ContentService.loadWeek(w)));
    ContentService._allLoaded = true;
  }

  /**
   * Get content for a specific week (cached or fallback).
   * @param {number} week
   * @returns {Promise<object>}
   */
  static async getWeekData(week) {
    // Try exact match first
    if (ContentService._cache.has(week)) return ContentService._cache.get(week);
    const data = await ContentService.loadWeek(week);
    if (data.week === week) return data;
    // Find nearest available week
    return ContentService._findNearest(week);
  }

  /**
   * Get all weeks sorted.
   * @returns {Promise<object[]>}
   */
  static async getAllWeeks() {
    await ContentService.preloadAll();
    return ContentService.AVAILABLE_WEEKS
      .map(w => ContentService._cache.get(w))
      .filter(Boolean);
  }

  /**
   * Get milestone data for all weeks (timeline).
   * @returns {Promise<Array>}
   */
  static async getMilestones() {
    const weeks = await ContentService.getAllWeeks();
    return weeks.map(w => ({
      week: w.week,
      title: w.milestoneTitle,
      description: w.milestoneDescription,
      fruitEmoji: w.fruitEmoji,
      fruitName: w.fruitName,
    }));
  }

  /** Find nearest cached week to the given week. */
  static _findNearest(week) {
    let closest = ContentService.AVAILABLE_WEEKS[0];
    for (const w of ContentService.AVAILABLE_WEEKS) {
      if (w <= week) closest = w;
    }
    return ContentService._cache.get(closest) || ContentService._generateEmpty(week);
  }

  /** Fallback: synthesize minimal week data if JSON is missing. */
  static _fallback(week) {
    const nearest = ContentService._findNearest(week);
    if (nearest && nearest.week !== week) return nearest;
    return ContentService._generateEmpty(week);
  }

  /** Generate an empty week placeholder. */
  static _generateEmpty(week) {
    return {
      week,
      fruitName: '?',
      fruitEmoji: '🌱',
      babySize: '—',
      babyWeight: '—',
      illustration: null,
      babyDevelopment: 'Content for this week is not yet available.',
      bodyChanges: 'Content coming soon.',
      tips: [],
      dosAndDonts: { do: [], dont: [] },
      travelAdvisory: { safe: true, level: 'green', note: 'Consult your doctor.' },
      nutrition: [],
      exercises: [],
      warningSignsToWatch: [],
      milestoneTitle: `Week ${week}`,
      milestoneDescription: '',
    };
  }

  /** Default habits for the daily tracker. */
  static getDefaultHabits() {
    return [
      { id: 'water', emoji: '💧', text: 'Drink 2.5L of water' },
      { id: 'vitamin', emoji: '💊', text: 'Take Prenatal Vitamin' },
      { id: 'stretch', emoji: '🧘‍♀️', text: '15 mins of light stretching' },
      { id: 'walk', emoji: '🚶‍♀️', text: '20 minute walk' },
      { id: 'sleep', emoji: '😴', text: '8 hours of restful sleep' },
    ];
  }

  /** Symptom options for the logger. */
  static getSymptomOptions() {
    return [
      { id: 'nauseous', icon: '🤢', label: 'Nauseous' },
      { id: 'exhausted', icon: '😴', label: 'Exhausted' },
      { id: 'energetic', icon: '✨', label: 'Energetic' },
      { id: 'headache', icon: '🤕', label: 'Headache' },
      { id: 'anxious', icon: '😟', label: 'Anxious' },
      { id: 'happy', icon: '😊', label: 'Happy' },
      { id: 'cramping', icon: '😣', label: 'Cramping' },
      { id: 'bloated', icon: '🫧', label: 'Bloated' },
      { id: 'backpain', icon: '🔙', label: 'Back Pain' },
      { id: 'swollen', icon: '🦶', label: 'Swollen' },
    ];
  }

  /**
   * Formats a raw paragraph into list items with visual cues.
   * @param {string} text 
   * @param {'baby' | 'body' | 'tip' | 'exercise' | 'nutrition' | 'warning'} type 
   * @returns {string} HTML string of <li> items
   */
  static formatToPoints(text, type = 'baby') {
    if (!text) return '';
    const emojiMap = {
      baby: '👶',
      body: '🤰',
      tip: '💡',
      exercise: '🧘‍♀️',
      nutrition: '🍎',
      warning: '⚠️'
    };
    const emoji = emojiMap[type] || '✦';
    
    // Split by sentences, but be careful with abbreviations like cm. or g.
    // A simple regex approach: split by period followed by space.
    return text.split(/(?<=\w\.)\s+/).map(sentence => {
      const trimmed = sentence.trim();
      if (!trimmed) return '';
      return `<li><span class="point-emoji">${emoji}</span> ${trimmed}</li>`;
    }).join('');
  }

  /**
   * Get personalized recommendation rules from JSON.
   */
  static async getRecommendationsData() {
    try {
      const resp = await fetch(`./data/recommendations.json`);
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }
}
