import { ContentService } from '../services/content-service.js';
import { GestationalEngine } from '../services/gestational-engine.js';
import { CalendarService } from '../services/calendar-service.js';
import { LocationService } from '../services/location-service.js';
import { WeatherService } from '../services/weather-service.js';
import { PersonalizationService } from '../services/personalization-service.js';

/**
 * DashboardPage — Morning Check-In with date navigation,
 * medical illustrations, custom habits, medication reminders, and travel advisory.
 */
export class DashboardPage {
  constructor(db, auth) {
    this._db = db;
    this._auth = auth;
    this._currentDate = CalendarService.toISO(new Date());
  }

  async render(container) {
    const profile = await this._db.get('settings', 'profile') || {};
    if (!profile.lmpDate) {
      container.innerHTML = '<div class="page-container"><p>Please set your LMP date in Settings.</p></div>';
      return;
    }
    this._profile = profile;
    this._container = container;
    await this._renderForDate(this._currentDate);
  }

  async _renderForDate(dateISO) {
    this._currentDate = dateISO;
    const today = CalendarService.toISO(new Date());
    const isToday = dateISO === today;
    const viewDate = CalendarService.fromISO(dateISO);

    const ge = GestationalEngine.calculate(this._profile.lmpDate, viewDate);

    // Parallel fetch for all primary data
    const [
      weekData,
      habitsRecord,
      symptomsRecord,
      medications,
      customHabits,
      locationData
    ] = await Promise.all([
      ContentService.getWeekData(ge.week),
      this._db.get('habits', dateISO),
      this._db.get('symptoms', dateISO),
      this._db.getAll('medications'),
      this._db.getAll('custom_habits'),
      LocationService.getLocation()
    ]);

    const completedHabits = habitsRecord?.completed || [];
    const loggedSymptoms = symptomsRecord?.symptoms || [];
    const allHabits = [...ContentService.getDefaultHabits(), ...customHabits];

    // Personalization & Weather
    let weatherData = null;
    let recommendations = null;

    // Fetch weather if location is available
    if (locationData) {
      weatherData = await WeatherService.getCurrentWeather(locationData.lat, locationData.lon);
    }

    // Recommendations only for Today
    if (isToday) {
      recommendations = await PersonalizationService.getRecommendations({
        weather: weatherData,
        week: ge.week,
        habits: this._profile, // Profile contains food habits
        profile: this._profile
      });
    }

    this._container.innerHTML = `
      <div class="page-container">
        <!-- Hero Section -->
        <div class="hero-section">
          <!-- Date Navigator Integrated -->
          <div class="date-navigator">
            <button class="date-nav-btn" id="date-prev">‹</button>
            <button class="date-nav-label" id="date-picker-btn">
              ${isToday ? 'Today' : CalendarService.formatLong(viewDate)}
            </button>
            <button class="date-nav-btn" id="date-next">›</button>
            ${!isToday ? '<button class="date-today-btn" id="date-today">Today</button>' : ''}
          </div>

          <!-- Weather Widget (New) -->
          ${weatherData ? `
            <div class="weather-widget">
              <span class="weather-emoji">${weatherData.emoji}</span>
              <div class="weather-info">
                <span class="weather-temp">${weatherData.temp}°C</span>
                <span class="weather-loc">${locationData?.city || 'Nearby'} · ${weatherData.description}</span>
              </div>
            </div>
          ` : ''}

          <h1 class="playfair">${GestationalEngine.getGreeting()}, ${this._profile.name || 'Mama'}</h1>
          <p class="hero-week sage-text">${isToday ? `Week ${ge.week}, Day ${ge.day}` : `Week ${ge.week} · ${CalendarService.formatShort(viewDate)}`}</p>
          ${isToday ? `<p class="hero-countdown">${ge.daysRemaining} days to meet your little one</p>` : ''}

          <!-- Fruit + Medical Illustration Toggle -->
          <div class="hero-visual">
            <div class="hero-fruit" id="hero-visual-fruit">
              <span class="fruit-emoji">${weekData.fruitEmoji}</span>
            </div>
            ${weekData.illustration ? `
              <div class="hero-medical hidden" id="hero-visual-medical">
                <img src="${weekData.illustration}" alt="Week ${ge.week} development" class="medical-illustration" loading="lazy" onerror="this.parentElement.classList.add('hidden'); document.getElementById('hero-visual-fruit').classList.remove('hidden'); document.getElementById('toggle-view').classList.add('hidden');">
              </div>
            ` : ''}
          </div>
          ${weekData.illustration ? '<button class="view-toggle-btn" id="toggle-view">👁️ See baby\'s development</button>' : ''}
          <p class="fruit-label"><em>Baby is the size of a ${weekData.fruitName}</em></p>

          <!-- Stats -->
          <div class="hero-stats">
            <div class="stat"><strong>${weekData.babySize}</strong><small>LENGTH</small></div>
            <div class="stat"><strong>${weekData.babyWeight}</strong><small>WEIGHT</small></div>
            <div class="stat"><strong>${GestationalEngine.trimesterLabel(ge.trimester)}</strong><small>TRIMESTER</small></div>
          </div>
        </div>

        <!-- Journey Progress -->
        ${isToday ? `
        <div class="lumina-card">
          <div class="card-header"><span class="dot green"></span>JOURNEY PROGRESS <span class="float-right">${Math.round(ge.progress)}%</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${ge.progress}%"></div></div>
          <small>Due ${ge.dueDateFormatted || ge.dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</small>
        </div>` : ''}

        <!-- Travel Advisory -->
        ${weekData.travelAdvisory ? `
        <div class="guidance-card ${weekData.travelAdvisory.level === 'green' ? 'success' : 'danger'}">
          <div class="guidance-header">✈️ Travel Advisory</div>
          <p style="font-size: 0.9rem;">${weekData.travelAdvisory.note}</p>
        </div>` : ''}

        <!-- Medication Reminders -->
        <div class="lumina-card">
          <div class="card-header">
            <span class="dot sage"></span>💊 MEDICATION REMINDERS
            <button class="section-action float-right" id="add-med-dash-btn">+ Add</button>
          </div>
          <div class="med-list" id="med-reminders">
            ${medications.length === 0 ? '<p style="text-align:center;color:var(--charcoal-light);padding:10px;font-size:0.8rem;">No medications scheduled.</p>' : ''}
            ${medications.filter(m => m.active !== false).map(m => `
              <div class="med-item" data-id="${m.id}">
                <div class="med-info">
                  <strong>${m.name}</strong>
                  <small>${m.dosage || ''} · ${m.frequency || ''}</small>
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                  <button class="med-edit-dash-btn" data-id="${m.id}" style="background:none; border:none; padding:4px; cursor:pointer; opacity:0.6;">✏️</button>
                  <button class="med-check ${this._isMedTaken(habitsRecord, m.id) ? 'taken' : ''}" data-med="${m.id}">
                    ${this._isMedTaken(habitsRecord, m.id) ? '✓' : '○'}
                  </button>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Daily Briefing -->
        <h2 class="section-title playfair">Today's Briefing</h2>
        <div class="insight-card">
          <h4><span class="dot sage"></span>BABY'S DEVELOPMENT</h4>
          <ul class="rich-list">
            ${ContentService.formatToPoints(weekData.babyDevelopment, 'baby')}
          </ul>
        </div>
        <div class="insight-card" style="border-left-color: var(--dusty-rose-light);">
          <h4 style="color: var(--dusty-rose);"><span class="dot rose"></span>YOUR BODY</h4>
          <ul class="rich-list">
            ${ContentService.formatToPoints(weekData.bodyChanges, 'body')}
          </ul>
        </div>

        <!-- Personalized Guide (New) -->
        ${recommendations ? `
          <h2 class="section-title playfair">Personalized for You</h2>
          <div class="lumina-card personalized-card">
            <div class="card-header"><span class="dot gold"></span>✨ TAILORED GUIDE</div>
            
            <div class="rec-section">
              <h4>🥗 Good to Eat</h4>
              <div class="chip-container">
                ${recommendations.food.good.map(f => `<span class="rec-chip positive">${f}</span>`).join('')}
              </div>
            </div>

            <div class="rec-section">
              <h4>🧘 Activities</h4>
              <div class="chip-container">
                ${recommendations.activity.outdoor.map(a => `<span class="rec-chip secondary">🌿 ${a}</span>`).join('')}
                ${recommendations.activity.indoor.map(a => `<span class="rec-chip secondary">🏠 ${a}</span>`).join('')}
              </div>
            </div>

            <div class="rec-section">
              <h4>💊 Supplements & Care</h4>
              <div class="chip-container">
                ${recommendations.supplements.take.map(s => `<span class="rec-chip primary">✓ ${s}</span>`).join('')}
              </div>
              <p class="rec-note">Avoid: ${recommendations.supplements.avoid.join(', ')}</p>
            </div>

            <div class="rec-section warning">
              <h4>🚫 What to Avoid</h4>
              <div class="chip-container">
                ${recommendations.food.avoid.map(f => `<span class="rec-chip danger">${f}</span>`).join('')}
              </div>
              ${this._profile.allergies ? `<p class="rec-note">Reminder: Based on your preference for <strong>${this._profile.allergies}</strong>.</p>` : ''}
            </div>
          </div>
        ` : ''}

        ${weekData.nutrition?.length ? `
        <div class="guidance-card success">
          <div class="guidance-header">🥗 Nutrition Focus</div>
          <ul class="rich-list">
            ${weekData.nutrition.map(n => `<li>${n}</li>`).join('')}
          </ul>
        </div>` : ''}

        ${weekData.warningSignsToWatch?.length ? `
        <div class="guidance-card danger">
          <div class="guidance-header">⚠️ Warning Signs</div>
          <ul class="rich-list dont-list">
            ${weekData.warningSignsToWatch.map(w => `<li>${w}</li>`).join('')}
          </ul>
        </div>` : ''}

        <!-- Daily Habits -->
        <h2 class="section-title playfair">Daily Habits</h2>
        <div class="habits-grid" id="habits-grid">
          ${allHabits.map(h => `
            <button class="habit-item ${completedHabits.includes(h.id) ? 'done' : ''}" data-habit="${h.id}">
              <span class="habit-emoji">${h.emoji}</span>
              <span class="habit-text">${h.text}</span>
              ${completedHabits.includes(h.id) ? '<span class="habit-check">✓</span>' : ''}
            </button>
          `).join('')}
          <button class="habit-item add-habit" id="add-custom-habit">
            <span class="habit-emoji">➕</span>
            <span class="habit-text">Add Habit</span>
          </button>
        </div>

        <!-- Symptom Logger -->
        <h2 class="section-title playfair">How are you feeling?</h2>
        <div class="symptom-scroll" id="symptom-scroll">
          ${ContentService.getSymptomOptions().map(s => `
            <button class="symptom-chip ${loggedSymptoms.includes(s.id) ? 'active' : ''}" data-symptom="${s.id}">
              ${s.icon} ${s.label}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    this._attachListeners(dateISO, allHabits, ge.dueDate);
  }

  _isMedTaken(habitsRecord, medId) {
    return (habitsRecord?.meds || []).includes(medId);
  }

  _attachListeners(dateISO, allHabits, dueDate) {
    // Date navigation
    document.getElementById('date-prev')?.addEventListener('click', () => {
      const d = CalendarService.fromISO(this._currentDate);
      d.setDate(d.getDate() - 1);
      this._renderForDate(CalendarService.toISO(d));
    });
    document.getElementById('date-next')?.addEventListener('click', () => {
      const d = CalendarService.fromISO(this._currentDate);
      d.setDate(d.getDate() + 1);
      
      const next = CalendarService.toISO(d);
      const limit = CalendarService.toISO(dueDate);
      if (next <= limit) this._renderForDate(next);
    });
    document.getElementById('date-today')?.addEventListener('click', () => {
      this._renderForDate(CalendarService.toISO(new Date()));
    });

    // Date picker button
    document.getElementById('date-picker-btn')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'date';
      input.value = this._currentDate;
      input.max = CalendarService.toISO(dueDate);
      input.style.position = 'absolute';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.addEventListener('change', () => {
        if (input.value) this._renderForDate(input.value);
        input.remove();
      });
      input.showPicker?.() || input.click();
    });

    // Medical illustration toggle
    document.getElementById('toggle-view')?.addEventListener('click', () => {
      const fruit = document.getElementById('hero-visual-fruit');
      const med = document.getElementById('hero-visual-medical');
      const btn = document.getElementById('toggle-view');
      if (fruit && med) {
        const showingFruit = !fruit.classList.contains('hidden');
        fruit.classList.toggle('hidden', showingFruit);
        med.classList.toggle('hidden', !showingFruit);
        btn.textContent = showingFruit ? '🍋 See size comparison' : '👁️ See baby\'s development';
      }
    });

    // Habit toggles
    document.querySelectorAll('.habit-item[data-habit]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.habit;
        const record = await this._db.get('habits', dateISO) || { id: dateISO, completed: [], meds: [] };
        const list = record.completed;
        const idx = list.indexOf(id);
        if (idx >= 0) list.splice(idx, 1);
        else list.push(id);
        await this._db.put('habits', record);
        btn.classList.toggle('done');
        const check = btn.querySelector('.habit-check');
        if (idx >= 0 && check) check.remove();
        else if (idx < 0) {
          const s = document.createElement('span');
          s.className = 'habit-check';
          s.textContent = '✓';
          btn.appendChild(s);
        }
      });
    });

    // Symptom toggles
    document.querySelectorAll('.symptom-chip').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.symptom;
        const record = await this._db.get('symptoms', dateISO) || { id: dateISO, symptoms: [] };
        const list = record.symptoms;
        const idx = list.indexOf(id);
        if (idx >= 0) list.splice(idx, 1);
        else list.push(id);
        await this._db.put('symptoms', record);
        btn.classList.toggle('active');
      });
    });

    // Medication check
    document.querySelectorAll('.med-check').forEach(btn => {
      btn.addEventListener('click', async () => {
        const medId = btn.dataset.med;
        const record = await this._db.get('habits', dateISO) || { id: dateISO, completed: [], meds: [] };
        if (!record.meds) record.meds = [];
        const idx = record.meds.indexOf(medId);
        if (idx >= 0) { record.meds.splice(idx, 1); btn.classList.remove('taken'); btn.textContent = '○'; }
        else { record.meds.push(medId); btn.classList.add('taken'); btn.textContent = '✓'; }
        await this._db.put('habits', record);
      });
    });

    // Add custom habit
    document.getElementById('add-custom-habit')?.addEventListener('click', () => this._showAddHabitModal());

    // Dashboard Medication Management
    document.getElementById('add-med-dash-btn')?.addEventListener('click', () => this._showMedModal());
    document.querySelectorAll('.med-edit-dash-btn').forEach(btn => {
      btn.addEventListener('click', () => this._showMedModal(btn.dataset.id));
    });
  }

  async _showMedModal(editId = null) {
    const existing = editId ? await this._db.get('medications', editId) : null;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <h3>${existing ? 'Edit Medication' : 'Add Medication'}</h3>
        <input type="text" class="lumina-input" id="med-name" placeholder="Medication name" value="${existing?.name || ''}">
        <input type="text" class="lumina-input" id="med-dosage" placeholder="Dosage (e.g., 400mcg)" value="${existing?.dosage || ''}">
        <select class="lumina-input" id="med-frequency">
          <option value="Once daily" ${existing?.frequency === 'Once daily' ? 'selected' : ''}>Once daily</option>
          <option value="Twice daily" ${existing?.frequency === 'Twice daily' ? 'selected' : ''}>Twice daily</option>
          <option value="Three times daily" ${existing?.frequency === 'Three times daily' ? 'selected' : ''}>Three times daily</option>
          <option value="Weekly" ${existing?.frequency === 'Weekly' ? 'selected' : ''}>Weekly</option>
          <option value="As needed" ${existing?.frequency === 'As needed' ? 'selected' : ''}>As needed</option>
        </select>
        <input type="time" class="lumina-input" id="med-time" value="${existing?.time || '09:00'}">
        <input type="text" class="lumina-input" id="med-notes" placeholder="Notes (optional)" value="${existing?.notes || ''}">
        <div style="display:flex;gap:10px;margin-top:10px;">
          <button class="lumina-btn primary full-width" id="med-save">Save</button>
          ${existing ? '<button class="lumina-btn danger full-width" id="med-delete">Delete</button>' : ''}
          <button class="lumina-btn secondary full-width" id="med-cancel">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay); setTimeout(() => overlay.classList.add("active"), 10);

    document.getElementById('med-cancel').addEventListener('click', () => overlay.remove());
    if (document.getElementById('med-delete')) {
      document.getElementById('med-delete').addEventListener('click', async () => {
        if (!confirm('Delete this medication correctly?')) return;
        await this._db.delete('medications', editId);
        overlay.remove();
        await this._renderForDate(this._currentDate);
      });
    }
    document.getElementById('med-save').addEventListener('click', async () => {
      const name = document.getElementById('med-name').value.trim();
      if (!name) return;
      const id = editId || `med-${Date.now()}`;
      await this._db.put('medications', {
        id,
        name,
        dosage: document.getElementById('med-dosage').value.trim(),
        frequency: document.getElementById('med-frequency').value,
        time: document.getElementById('med-time').value,
        notes: document.getElementById('med-notes').value.trim(),
        active: true,
      });
      overlay.remove();
      await this._renderForDate(this._currentDate);
    });
  }

  _showAddHabitModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <h3>Add Custom Habit</h3>
        <input type="text" class="lumina-input" id="custom-habit-emoji" placeholder="Emoji (e.g., 🧘‍♀️)" maxlength="4">
        <input type="text" class="lumina-input" id="custom-habit-text" placeholder="Habit description">
        <div style="display:flex;gap:10px;margin-top:10px;">
          <button class="lumina-btn primary full-width" id="custom-habit-save">Save</button>
          <button class="lumina-btn secondary full-width" id="custom-habit-cancel">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay); setTimeout(() => overlay.classList.add("active"), 10);

    document.getElementById('custom-habit-cancel').addEventListener('click', () => overlay.remove());
    document.getElementById('custom-habit-save').addEventListener('click', async () => {
      const emoji = document.getElementById('custom-habit-emoji').value.trim() || '⭐';
      const text = document.getElementById('custom-habit-text').value.trim();
      if (!text) return;
      const id = `custom-${Date.now()}`;
      await this._db.put('custom_habits', { id, emoji, text });
      overlay.remove();
      await this._renderForDate(this._currentDate);
    });
  }
}
