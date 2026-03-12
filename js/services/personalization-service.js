import { ContentService } from './content-service.js';

/**
 * PersonalizationService — Core logic for contextual recommendations.
 * Combines weather, location, gestational week, and food habits.
 * Powered by externalized data via ContentService.
 */
export class PersonalizationService {
  /**
   * Generates a holistic recommendation object.
   * @param {object} context { weather, week, habits, profile }
   */
  static async getRecommendations(context) {
    const { weather, week, habits, profile } = context;
    const data = await ContentService.getRecommendationsData();
    if (!data) return null;
    
    return {
      food: PersonalizationService._getFoodRecs(data.food, weather, habits, week),
      activity: PersonalizationService._getActivityRecs(data.activities, weather, week),
      supplements: PersonalizationService._getSupplementRecs(data.supplements, week, habits),
    };
  }

  static _getFoodRecs(foodData, weather, habits, week) {
    const diet = habits?.diet || 'any';
    
    const recommendations = {
      good: [],
      avoid: [...foodData.default_avoid],
    };

    // Weather-based
    let weatherKey = 'default';
    if (weather?.isHot) weatherKey = 'hot';
    else if (weather?.isCold) weatherKey = 'cold';
    else if (weather?.isRainy) weatherKey = 'rainy';
    
    recommendations.good.push(...(foodData.weather_rules[weatherKey] || foodData.weather_rules.default));

    // Diet-based adjustments
    const adj = foodData.diet_adjustments[diet];
    if (adj) {
      recommendations.good = recommendations.good.filter(f => 
        !adj.exclude.some(ex => f.toLowerCase().includes(ex))
      );
      recommendations.good.push(...adj.include);
    }

    // Week-based (contextual)
    foodData.gestational_rules.forEach(rule => {
      if (week >= rule.min_week && week <= rule.max_week) {
        recommendations.good.push(...rule.include);
      }
    });

    return recommendations;
  }

  static _getActivityRecs(actData, weather, week) {
    const activities = { indoor: [], outdoor: [] };
    const isBadWeather = weather?.isRainy || weather?.isHot || weather?.isCold;
    const rules = isBadWeather ? actData.weather_rules.bad_weather : actData.weather_rules.good_weather;

    activities.indoor.push(...rules.indoor);
    activities.outdoor.push(...rules.outdoor);

    // Adjust for late pregnancy
    actData.gestational_adjustments.forEach(adj => {
      if (week >= adj.min_week && week <= adj.max_week) {
        if (adj.outdoor_prefix) {
          activities.outdoor = activities.outdoor.map(a => `${adj.outdoor_prefix}${a.toLowerCase()}`);
        }
        if (adj.indoor_add) {
          activities.indoor.push(...adj.indoor_add);
        }
      }
    });

    return activities;
  }

  static _getSupplementRecs(suppData, week, habits) {
    const recs = {
      take: [...suppData.default_take],
      avoid: [...suppData.default_avoid],
    };

    suppData.gestational_rules.forEach(rule => {
      if (week >= rule.min_week && week <= rule.max_week) {
        recs.take.push(...rule.take);
      }
    });

    const dietRules = suppData.diet_rules[habits?.diet];
    if (dietRules) {
      recs.take.push(...dietRules);
    }

    return recs;
  }
}
