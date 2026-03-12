/**
 * GestationalEngine — Pure calculation utility.
 * Single Responsibility: pregnancy date math.
 * No side effects, no DOM, no storage.
 */
export class GestationalEngine {
  static TOTAL_DAYS = 280; // 40 weeks from LMP

  /**
   * Calculate gestational age from LMP date.
   * @param {string|Date} lmpDate — Last Menstrual Period date
   * @param {Date} [today] — optional override for testing
   * @returns {{
   *   week: number,
   *   day: number,
   *   totalDays: number,
   *   trimester: number,
   *   daysRemaining: number,
   *   dueDate: Date,
   *   progress: number,
   *   dueDateFormatted: string
   * }}
   */
  static calculate(lmpDate, today = new Date()) {
    const lmp = new Date(lmpDate);
    lmp.setHours(0, 0, 0, 0);
    const now = new Date(today);
    now.setHours(0, 0, 0, 0);

    const diffMs = now - lmp;
    const totalDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const week = Math.floor(totalDays / 7);
    const day = totalDays % 7;

    let trimester;
    if (week < 13) trimester = 1;
    else if (week < 28) trimester = 2;
    else trimester = 3;

    const dueDate = new Date(lmp);
    dueDate.setDate(dueDate.getDate() + GestationalEngine.TOTAL_DAYS);

    const daysRemaining = Math.max(0, Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24)));
    const progress = Math.min(100, (totalDays / GestationalEngine.TOTAL_DAYS) * 100);

    const dueDateFormatted = dueDate.toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    });

    return {
      week,
      day,
      totalDays,
      trimester,
      daysRemaining,
      dueDate,
      progress,
      dueDateFormatted,
    };
  }

  /**
   * Get a human-friendly trimester label.
   */
  static trimesterLabel(trimester) {
    const labels = { 1: 'First Trimester', 2: 'Second Trimester', 3: 'Third Trimester' };
    return labels[trimester] || '';
  }

  /**
   * Get a greeting based on time of day.
   */
  static getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }
}
