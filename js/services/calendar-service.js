/**
 * CalendarService — Calendar utilities and ICS export.
 * Provides month grid generation and RFC 5545 ICS file creation.
 */
export class CalendarService {

  /**
   * Generate a month grid (6 rows × 7 cols) for a given year/month.
   * Each cell: { date: Date, day: number, inMonth: boolean, iso: string }
   * @param {number} year
   * @param {number} month — 0-indexed (0=Jan … 11=Dec)
   * @returns {Array<Array<object>>}
   */
  static getMonthGrid(year, month) {
    const firstDay = new Date(year, month, 1);
    const startDow = firstDay.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid = [];
    let dayCounter = 1 - startDow;

    for (let row = 0; row < 6; row++) {
      const week = [];
      for (let col = 0; col < 7; col++) {
        const d = new Date(year, month, dayCounter);
        week.push({
          date: d,
          day: d.getDate(),
          inMonth: dayCounter >= 1 && dayCounter <= daysInMonth,
          iso: CalendarService.toISO(d),
        });
        dayCounter++;
      }
      grid.push(week);
      if (dayCounter > daysInMonth) break;
    }
    return grid;
  }

  /** Format date as YYYY-MM-DD */
  static toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Parse ISO to Date */
  static fromISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  /** Format date as "March 12, 2026" */
  static formatLong(date) {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  /** Format date as "Mar 12" */
  static formatShort(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /**
   * Generate an ICS file for given appointments + auto-milestones.
   * @param {Array<object>} appointments — [{title, date, time, notes}]
   * @param {Array<object>} milestones — [{week, title, description}]
   * @param {string} lmpDate — LMP ISO string
   * @returns {string} ICS file content
   */
  static generateICS(appointments = [], milestones = [], lmpDate = null) {
    let ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Lumina//Pregnancy Companion//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Lumina Pregnancy',
    ];

    // Add appointments
    for (const appt of appointments) {
      ics.push(...CalendarService._makeEvent(
        appt.title,
        appt.date,
        appt.time || '09:00',
        appt.notes || '',
        'APPOINTMENT'
      ));
    }

    // Add milestones as all-day events based on LMP
    if (lmpDate) {
      const lmp = CalendarService.fromISO(lmpDate);
      for (const m of milestones) {
        const eventDate = new Date(lmp);
        eventDate.setDate(eventDate.getDate() + m.week * 7);
        const iso = CalendarService.toISO(eventDate);
        ics.push(...CalendarService._makeAllDayEvent(
          `🌸 ${m.title} (Week ${m.week})`,
          iso,
          m.description,
          'MILESTONE'
        ));
      }

      // Add due date
      const dueDate = new Date(lmp);
      dueDate.setDate(dueDate.getDate() + 280);
      ics.push(...CalendarService._makeAllDayEvent(
        '🎉 Due Date — Baby Day!',
        CalendarService.toISO(dueDate),
        'Your estimated due date! Get ready to meet your little one!',
        'DUEDATE'
      ));
    }

    ics.push('END:VCALENDAR');
    return ics.join('\r\n');
  }

  static _makeEvent(title, dateISO, time, notes, category) {
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@lumina`;
    const [h, m] = (time || '09:00').split(':');
    const dt = dateISO.replace(/-/g, '') + `T${h.padStart(2,'0')}${m.padStart(2,'0')}00`;
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${dt}`,
      `DURATION:PT1H`,
      `SUMMARY:${CalendarService._escapeICS(title)}`,
      `DESCRIPTION:${CalendarService._escapeICS(notes)}`,
      `CATEGORIES:${category}`,
      'END:VEVENT',
    ];
  }

  static _makeAllDayEvent(title, dateISO, notes, category) {
    const uid = `${dateISO}-${category}-${Math.random().toString(36).slice(2)}@lumina`;
    const dt = dateISO.replace(/-/g, '');
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${dt}`,
      `SUMMARY:${CalendarService._escapeICS(title)}`,
      `DESCRIPTION:${CalendarService._escapeICS(notes)}`,
      `CATEGORIES:${category}`,
      'END:VEVENT',
    ];
  }

  static _escapeICS(str) {
    return (str || '').replace(/[\\;,\n]/g, (c) => {
      if (c === '\n') return '\\n';
      return '\\' + c;
    });
  }

  /**
   * Trigger a file download of the ICS content.
   * @param {string} icsContent
   * @param {string} filename
   */
  static downloadICS(icsContent, filename = 'lumina-pregnancy.ics') {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
