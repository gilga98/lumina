import { CalendarService } from '../services/calendar-service.js';
import { ContentService } from '../services/content-service.js';

/**
 * CalendarPage — Month calendar view with appointments, milestones, and ICS export.
 * Features: month navigation, day detail panel, add/edit/delete appointments.
 */
export class CalendarPage {
  /**
   * @param {import('../services/db-service.js').DBService} db
   * @param {Function} showToast
   */
  constructor(db, showToast) {
    this._db = db;
    this._toast = showToast;
    this._year = new Date().getFullYear();
    this._month = new Date().getMonth();
    this._selectedDate = CalendarService.toISO(new Date());
  }

  async render(container) {
    const profile = await this._db.get('settings', 'profile') || {};
    const appointments = await this._db.getAll('appointments');
    const symptoms = await this._db.getAll('symptoms');
    const habits = await this._db.getAll('habits');

    container.innerHTML = `
      <div class="page-container">
        <h1 class="page-title playfair">Calendar</h1>
        <p class="page-subtitle">Your pregnancy journey at a glance</p>

        <!-- Month Navigation -->
        <div class="calendar-month-nav">
          <button class="cal-nav-btn" id="cal-prev">‹</button>
          <h3 id="cal-month-label">${this._monthLabel()}</h3>
          <button class="cal-nav-btn" id="cal-next">›</button>
        </div>

        <!-- Calendar Grid -->
        <div class="calendar-grid" id="cal-grid"></div>

        <!-- Day Detail Panel -->
        <div class="cal-day-detail" id="cal-day-detail"></div>

        <!-- Actions -->
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button class="lumina-btn primary full-width" id="cal-add-appt">+ Add Appointment</button>
          <button class="lumina-btn secondary full-width" id="cal-export">📅 Export ICS</button>
        </div>
      </div>

      <!-- Add/Edit Appointment Modal -->
      <div class="modal-overlay hidden" id="appt-modal">
        <div class="modal-card">
          <h3 id="appt-modal-title">New Appointment</h3>
          <input type="text" class="lumina-input" id="appt-title" placeholder="Appointment title (e.g., OB Visit)">
          <input type="date" class="lumina-input" id="appt-date">
          <input type="time" class="lumina-input" id="appt-time" value="09:00">
          <textarea class="lumina-input" id="appt-notes" placeholder="Notes (optional)" rows="3"></textarea>
          <div class="form-check" style="margin:10px 0;">
            <label><input type="checkbox" id="appt-reminder"> Set reminder (1 day before)</label>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="lumina-btn primary full-width" id="appt-save">Save</button>
            <button class="lumina-btn secondary full-width" id="appt-cancel">Cancel</button>
          </div>
          <button class="lumina-btn danger full-width hidden" id="appt-delete" style="margin-top:8px;">Delete Appointment</button>
        </div>
      </div>
    `;

    this._profile = profile;
    this._appointments = appointments;
    this._symptoms = symptoms;
    this._habits = habits;
    this._renderGrid();
    this._showDayDetail(this._selectedDate);
    this._attachListeners();
  }

  _monthLabel() {
    return new Date(this._year, this._month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  _renderGrid() {
    const grid = CalendarService.getMonthGrid(this._year, this._month);
    const today = CalendarService.toISO(new Date());
    const apptDates = new Set(this._appointments.map(a => a.date));
    const symptomDates = new Set(this._symptoms.map(s => s.id));
    const habitDates = new Set(this._habits.map(h => h.id));

    let html = '<div class="cal-header-row">Su Mo Tu We Th Fr Sa</div>'.replace(/ /g, '</span><span class="cal-header-cell">');
    html = `<div class="cal-header-row"><span class="cal-header-cell">Su</span><span class="cal-header-cell">Mo</span><span class="cal-header-cell">Tu</span><span class="cal-header-cell">We</span><span class="cal-header-cell">Th</span><span class="cal-header-cell">Fr</span><span class="cal-header-cell">Sa</span></div>`;

    for (const week of grid) {
      html += '<div class="cal-week-row">';
      for (const cell of week) {
        const cls = [
          'cal-day',
          cell.inMonth ? '' : 'out-month',
          cell.iso === today ? 'today' : '',
          cell.iso === this._selectedDate ? 'selected' : '',
        ].filter(Boolean).join(' ');

        const dots = [];
        if (apptDates.has(cell.iso)) dots.push('appt');
        if (symptomDates.has(cell.iso)) dots.push('symptom');
        if (habitDates.has(cell.iso)) dots.push('habit');

        const dotHtml = dots.length
          ? `<div class="cal-dots">${dots.map(d => `<span class="cal-dot ${d}"></span>`).join('')}</div>`
          : '';

        html += `<button class="${cls}" data-date="${cell.iso}">${cell.day}${dotHtml}</button>`;
      }
      html += '</div>';
    }

    document.getElementById('cal-grid').innerHTML = html;
    document.getElementById('cal-month-label').textContent = this._monthLabel();

    // Attach day click handlers
    document.querySelectorAll('.cal-day').forEach(btn => {
      btn.addEventListener('click', () => {
        this._selectedDate = btn.dataset.date;
        document.querySelectorAll('.cal-day.selected').forEach(el => el.classList.remove('selected'));
        btn.classList.add('selected');
        this._showDayDetail(btn.dataset.date);
      });
    });
  }

  _showDayDetail(iso) {
    const panel = document.getElementById('cal-day-detail');
    const date = CalendarService.fromISO(iso);
    const dayAppts = this._appointments.filter(a => a.date === iso);
    const daySymptoms = this._symptoms.find(s => s.id === iso);
    const dayHabits = this._habits.find(h => h.id === iso);

    let html = `<h4>${CalendarService.formatLong(date)}</h4>`;

    if (dayAppts.length) {
      html += '<div class="cal-section"><span class="cal-section-label">📋 APPOINTMENTS</span>';
      for (const a of dayAppts) {
        html += `<div class="cal-entry appt" data-id="${a.id}">
          <strong>${a.title}</strong>
          <span>${a.time || ''}</span>
          ${a.notes ? `<p>${a.notes}</p>` : ''}
          <button class="cal-edit-btn" data-id="${a.id}">✏️</button>
        </div>`;
      }
      html += '</div>';
    }

    if (daySymptoms?.symptoms?.length) {
      html += `<div class="cal-section"><span class="cal-section-label">🩺 SYMPTOMS</span>
        <div class="cal-chips">${daySymptoms.symptoms.map(s => `<span class="cal-chip">${s}</span>`).join('')}</div></div>`;
    }

    if (dayHabits?.completed?.length) {
      html += `<div class="cal-section"><span class="cal-section-label">✅ HABITS COMPLETED</span>
        <div class="cal-chips">${dayHabits.completed.map(h => `<span class="cal-chip">${h}</span>`).join('')}</div></div>`;
    }

    if (!dayAppts.length && !daySymptoms?.symptoms?.length && !dayHabits?.completed?.length) {
      html += '<p class="cal-empty">No entries for this day</p>';
    }

    html += `<button class="lumina-btn small secondary" id="cal-add-for-day" style="margin-top:8px;">+ Add entry for this day</button>`;
    panel.innerHTML = html;

    // Attach edit buttons
    panel.querySelectorAll('.cal-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._openApptModal(btn.dataset.id);
      });
    });

    document.getElementById('cal-add-for-day')?.addEventListener('click', () => {
      this._openApptModal(null, iso);
    });
  }

  _attachListeners() {
    document.getElementById('cal-prev')?.addEventListener('click', () => {
      this._month--;
      if (this._month < 0) { this._month = 11; this._year--; }
      this._renderGrid();
    });
    document.getElementById('cal-next')?.addEventListener('click', () => {
      this._month++;
      if (this._month > 11) { this._month = 0; this._year++; }
      this._renderGrid();
    });
    document.getElementById('cal-add-appt')?.addEventListener('click', () => this._openApptModal());
    document.getElementById('cal-export')?.addEventListener('click', () => this._exportICS());
    document.getElementById('appt-cancel')?.addEventListener('click', () => this._closeApptModal());
    document.getElementById('appt-save')?.addEventListener('click', () => this._saveAppt());
    document.getElementById('appt-delete')?.addEventListener('click', () => this._deleteAppt());
  }

  _openApptModal(id = null, defaultDate = null) {
    const modal = document.getElementById('appt-modal');
    const titleEl = document.getElementById('appt-modal-title');
    const delBtn = document.getElementById('appt-delete');
    modal.classList.remove('hidden');

    if (id) {
      const appt = this._appointments.find(a => a.id === id);
      if (appt) {
        titleEl.textContent = 'Edit Appointment';
        document.getElementById('appt-title').value = appt.title;
        document.getElementById('appt-date').value = appt.date;
        document.getElementById('appt-time').value = appt.time || '09:00';
        document.getElementById('appt-notes').value = appt.notes || '';
        document.getElementById('appt-reminder').checked = !!appt.reminder;
        delBtn.classList.remove('hidden');
        modal.dataset.editId = id;
      }
    } else {
      titleEl.textContent = 'New Appointment';
      document.getElementById('appt-title').value = '';
      document.getElementById('appt-date').value = defaultDate || this._selectedDate;
      document.getElementById('appt-time').value = '09:00';
      document.getElementById('appt-notes').value = '';
      document.getElementById('appt-reminder').checked = false;
      delBtn.classList.add('hidden');
      delete modal.dataset.editId;
    }
  }

  _closeApptModal() {
    document.getElementById('appt-modal').classList.add('hidden');
  }

  async _saveAppt() {
    const title = document.getElementById('appt-title').value.trim();
    const date = document.getElementById('appt-date').value;
    const time = document.getElementById('appt-time').value;
    const notes = document.getElementById('appt-notes').value.trim();
    const reminder = document.getElementById('appt-reminder').checked;

    if (!title || !date) { this._toast('Please enter a title and date', 'error'); return; }

    const modal = document.getElementById('appt-modal');
    const id = modal.dataset.editId || `appt-${Date.now()}`;

    await this._db.put('appointments', { id, title, date, time, notes, reminder });
    this._appointments = await this._db.getAll('appointments');
    this._closeApptModal();
    this._renderGrid();
    this._showDayDetail(date);
    this._toast('Appointment saved ✓');
  }

  async _deleteAppt() {
    const modal = document.getElementById('appt-modal');
    const id = modal.dataset.editId;
    if (!id) return;
    if (!confirm('Delete this appointment?')) return;

    await this._db.delete('appointments', id);
    this._appointments = await this._db.getAll('appointments');
    this._closeApptModal();
    this._renderGrid();
    this._showDayDetail(this._selectedDate);
    this._toast('Appointment deleted');
  }

  async _exportICS() {
    const milestones = await ContentService.getMilestones();
    const lmp = this._profile?.lmpDate;
    const ics = CalendarService.generateICS(this._appointments, milestones, lmp);
    CalendarService.downloadICS(ics);
    this._toast('Calendar exported ✓');
  }
}
