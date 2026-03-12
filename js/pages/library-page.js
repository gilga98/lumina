import { ContentService } from '../services/content-service.js';
import { GestationalEngine } from '../services/gestational-engine.js';

/**
 * LibraryPage — Offline knowledge base with weekly articles,
 * do's/don'ts, YouTube links manager (CRUD), and travel guidelines.
 */
export class LibraryPage {
  constructor(db) {
    this._db = db;
    this._activeTab = 'thisWeek';
  }

  async render(container) {
    const profile = await this._db.get('settings', 'profile') || {};
    const ge = profile.lmpDate ? GestationalEngine.calculate(profile.lmpDate) : null;
    const weekData = ge ? await ContentService.getWeekData(ge.week) : null;
    const allWeeks = await ContentService.getAllWeeks();

    container.innerHTML = `
      <div class="page-container">
        <h1 class="page-title playfair">Library</h1>
        <p class="page-subtitle">Your offline pregnancy knowledge base</p>

        <div class="tab-bar">
          <button class="tab-btn active" data-tab="thisWeek">This Week</button>
          <button class="tab-btn" data-tab="dosdonts">Do's & Don'ts</button>
          <button class="tab-btn" data-tab="travel">Travel</button>
          <button class="tab-btn" data-tab="links">Saved Links</button>
        </div>

        <div id="library-content"></div>
      </div>
    `;

    this._weekData = weekData;
    this._allWeeks = allWeeks;
    this._ge = ge;
    this._renderTab(this._activeTab);

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._activeTab = btn.dataset.tab;
        this._renderTab(this._activeTab);
      });
    });
  }

  async _renderTab(tab) {
    const content = document.getElementById('library-content');
    if (tab === 'thisWeek') this._renderThisWeek(content);
    else if (tab === 'dosdonts') this._renderDosAndDonts(content);
    else if (tab === 'travel') await this._renderTravel(content);
    else if (tab === 'links') await this._renderLinks(content);
  }

  _renderThisWeek(content) {
    const w = this._weekData;
    if (!w) { content.innerHTML = '<p>Set your LMP date in Settings to see weekly content.</p>'; return; }

    content.innerHTML = `
      <div class="lumina-card">
        <div class="card-header"><span class="dot sage"></span>WEEK ${w.week}</div>
        <h3 class="playfair">${w.fruitEmoji} Baby is the size of a ${w.fruitName}</h3>
        <ul class="card-list">
          ${ContentService.formatToPoints(w.babyDevelopment, 'baby')}
          ${ContentService.formatToPoints(w.bodyChanges, 'body')}
        </ul>
      </div>

      ${w.tips?.length ? `
      <div class="lumina-card">
        <div class="card-header"><span class="dot sage"></span>TIPS FOR WEEK ${w.week}</div>
        <ul class="card-list">${w.tips.map(t => `<li><span class="point-emoji">💡</span> ${t}</li>`).join('')}</ul>
      </div>` : ''}

      ${w.exercises?.length ? `
      <div class="lumina-card">
        <div class="card-header"><span class="dot sage"></span>🏃‍♀️ RECOMMENDED EXERCISES</div>
        <ul class="card-list">${w.exercises.map(e => `<li><span class="point-emoji">🧘‍♀️</span> ${e}</li>`).join('')}</ul>
      </div>` : ''}

      ${w.nutrition?.length ? `
      <div class="lumina-card">
        <div class="card-header"><span class="dot green"></span>🥗 NUTRITION FOCUS</div>
        <ul class="card-list">${w.nutrition.map(n => `<li><span class="point-emoji">🍎</span> ${n}</li>`).join('')}</ul>
      </div>` : ''}

      <h3 class="playfair" style="margin-top:20px;">Browse by Week</h3>
      <div class="week-browser">
        ${this._allWeeks.map(wk => `
          <button class="week-btn ${wk.week === this._ge?.week ? 'current' : ''}" data-week="${wk.week}">
            ${wk.fruitEmoji}<br><small>Wk ${wk.week}</small>
          </button>
        `).join('')}
      </div>
    `;

    content.querySelectorAll('.week-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const week = parseInt(btn.dataset.week);
        this._weekData = await ContentService.getWeekData(week);
        this._renderThisWeek(content);
      });
    });
  }

  _renderDosAndDonts(content) {
    const w = this._weekData;
    if (!w) { content.innerHTML = '<p>Set your LMP date in Settings.</p>'; return; }

    content.innerHTML = `
      <div class="lumina-card">
        <div class="card-header"><span class="dot green"></span>✅ DO's FOR WEEK ${w.week}</div>
        <ul class="card-list do-list">${(w.dosAndDonts?.do || []).map(d => `<li><span class="point-emoji">✅</span> ${d}</li>`).join('')}</ul>
      </div>
      <div class="lumina-card">
        <div class="card-header"><span class="dot red"></span>❌ DON'Ts FOR WEEK ${w.week}</div>
        <ul class="card-list dont-list">${(w.dosAndDonts?.dont || []).map(d => `<li><span class="point-emoji">❌</span> ${d}</li>`).join('')}</ul>
      </div>
    `;
  }

  async _renderTravel(content) {
    // Show travel advisory per trimester
    const greenWeeks = this._allWeeks.filter(w => w.travelAdvisory?.level === 'green');
    const yellowWeeks = this._allWeeks.filter(w => w.travelAdvisory?.level === 'yellow');
    const redWeeks = this._allWeeks.filter(w => w.travelAdvisory?.level === 'red');
    const currentAdvisory = this._weekData?.travelAdvisory;
    const plans = await this._db.getAll('travel_plans');

    content.innerHTML = `
      ${currentAdvisory ? `
      <div class="lumina-card travel-card ${currentAdvisory.level}">
        <div class="card-header"><span class="dot ${currentAdvisory.level === 'green' ? 'green' : currentAdvisory.level === 'yellow' ? 'yellow' : 'red'}"></span>✈️ YOUR TRAVEL STATUS (Week ${this._weekData.week})</div>
        <p>${currentAdvisory.note}</p>
      </div>` : ''}

      <h3 class="section-title playfair" style="margin-top:16px;">My Travel Plans</h3>
      <div id="travel-plans-list" style="margin-bottom:16px;">
        ${plans.map(p => `
          <div class="lumina-card" style="padding:12px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div>
                <strong>${p.destination}</strong>
                <div style="font-size:0.8rem;color:var(--charcoal-light);margin-top:4px;">
                  🗓️ ${p.startDate} to ${p.endDate}
                </div>
                ${p.notes ? `<p style="font-size:0.85rem;margin-top:6px;">${p.notes}</p>` : ''}
              </div>
              <button class="travel-delete-btn" data-id="${p.id}" style="background:none;border:none;cursor:pointer;">🗑️</button>
            </div>
          </div>
        `).join('')}
        ${plans.length === 0 ? '<p style="font-size:0.85rem;color:var(--charcoal-light);text-align:center;">No upcoming trips planned.</p>' : ''}
      </div>
      <button class="lumina-btn primary full-width" id="add-travel-btn" style="margin-bottom:24px;">+ Add Trip</button>

      <h3 class="section-title playfair">Trimester Travel Guide</h3>

      <div class="lumina-card travel-card green">
        <div class="card-header"><span class="dot green"></span>🟢 SAFE TO TRAVEL (Weeks ${greenWeeks.map(w => w.week).join(', ')})</div>
        <ul class="card-list">
          <li>✦ Second trimester (weeks 14-28) is the ideal travel window</li>
          <li>✦ Carry your prenatal records when traveling</li>
          <li>✦ Walk the aisle hourly on flights</li>
          <li>✦ Wear compression stockings for flights over 4 hours</li>
          <li>✦ Stay hydrated and pack healthy snacks</li>
        </ul>
      </div>

      <div class="lumina-card travel-card yellow">
        <div class="card-header"><span class="dot yellow"></span>🟡 TRAVEL WITH CAUTION (Weeks ${yellowWeeks.map(w => w.week).join(', ')})</div>
        <ul class="card-list">
          <li>✦ Consult your OB before booking travel</li>
          <li>✦ Some airlines require a doctor's note after 28 weeks</li>
          <li>✦ Stay near medical facilities</li>
          <li>✦ Avoid destinations without good healthcare access</li>
        </ul>
      </div>

      <div class="lumina-card travel-card red">
        <div class="card-header"><span class="dot red"></span>🔴 AVOID TRAVEL (Weeks ${redWeeks.map(w => w.week).join(', ')})</div>
        <ul class="card-list">
          <li>✦ Stay within 1 hour of your hospital</li>
          <li>✦ Most airlines won't allow flying after 36 weeks</li>
          <li>✦ Keep your hospital bag packed and car fueled</li>
          <li>✦ Know the signs of labor and have a plan</li>
        </ul>
      </div>

      <div class="lumina-card">
        <div class="card-header"><span class="dot sage"></span>✈️ GENERAL TRAVEL CHECKLIST</div>
        <ul class="card-list">
          <li>☐ Pack prenatal vitamins and medications</li>
          <li>☐ Carry copies of prenatal records</li>
          <li>☐ Research nearby hospitals at destination</li>
          <li>☐ Ensure travel insurance covers pregnancy</li>
          <li>☐ Pack compression stockings for flights</li>
          <li>☐ Carry healthy snacks and extra water</li>
          <li>☐ Wear comfortable, loose clothing</li>
          <li>☐ Plan rest stops every 2 hours for road trips</li>
        </ul>
      </div>
    `;

    document.getElementById('add-travel-btn')?.addEventListener('click', () => this._showTravelModal());
    content.querySelectorAll('.travel-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this trip?')) return;
        await this._db.delete('travel_plans', btn.dataset.id);
        this._renderTab('travel');
      });
    });
  }

  _showTravelModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <h3>Add Upcoming Trip</h3>
        <input type="text" class="lumina-input" id="trip-dest" placeholder="Destination (e.g., London)">
        <label style="font-size:0.8rem;color:var(--charcoal-light);">Start Date</label>
        <input type="date" class="lumina-input" id="trip-start">
        <label style="font-size:0.8rem;color:var(--charcoal-light);">End Date</label>
        <input type="date" class="lumina-input" id="trip-end">
        <textarea class="lumina-input" id="trip-notes" placeholder="Notes (e.g., flight numbers, hospital nearby)" rows="3"></textarea>
        <div style="display:flex;gap:10px;margin-top:10px;">
          <button class="lumina-btn primary full-width" id="trip-save">Save</button>
          <button class="lumina-btn secondary full-width" id="trip-cancel">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('trip-cancel').addEventListener('click', () => overlay.remove());
    document.getElementById('trip-save').addEventListener('click', async () => {
      const dest = document.getElementById('trip-dest').value.trim();
      if (!dest) return;
      
      const plan = {
        id: `trip-${Date.now()}`,
        destination: dest,
        startDate: document.getElementById('trip-start').value,
        endDate: document.getElementById('trip-end').value,
        notes: document.getElementById('trip-notes').value.trim(),
        createdAt: new Date().toISOString()
      };
      
      await this._db.put('travel_plans', plan);
      overlay.remove();
      this._renderTab('travel');
    });
  }

  async _renderLinks(content) {
    const links = await this._db.getAll('youtube_links');
    content.innerHTML = `
      <div class="link-input-row">
        <input type="text" class="lumina-input" id="yt-url" placeholder="Paste YouTube URL">
        <button class="lumina-btn primary" id="yt-save">Save</button>
      </div>
      <div class="links-grid" id="links-grid">
        ${links.map(l => `
          <div class="link-card" data-id="${l.id}">
            <a href="${l.url}" target="_blank" rel="noopener">
              <img src="${l.thumbnail}" alt="${l.title || 'Video'}" class="link-thumb">
            </a>
            <div class="link-info">
              <input type="text" class="link-title-edit" value="${l.title || l.url}" data-id="${l.id}">
              <button class="link-delete" data-id="${l.id}">🗑️</button>
            </div>
          </div>
        `).join('')}
        ${links.length === 0 ? '<p style="text-align:center;padding:20px;color:var(--charcoal-light);">Save helpful pregnancy videos here</p>' : ''}
      </div>
    `;

    document.getElementById('yt-save')?.addEventListener('click', async () => {
      const url = document.getElementById('yt-url')?.value.trim();
      if (!url) return;
      const videoId = this._extractYTId(url);
      const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
      const id = `yt-${Date.now()}`;
      await this._db.put('youtube_links', { id, url, thumbnail, title: '', createdAt: new Date().toISOString() });
      document.getElementById('yt-url').value = '';
      this._renderLinks(content);
    });

    // Edit title
    content.querySelectorAll('.link-title-edit').forEach(input => {
      input.addEventListener('change', async () => {
        const link = links.find(l => l.id === input.dataset.id);
        if (link) {
          link.title = input.value.trim();
          await this._db.put('youtube_links', link);
        }
      });
    });

    // Delete
    content.querySelectorAll('.link-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this link?')) return;
        await this._db.delete('youtube_links', btn.dataset.id);
        this._renderLinks(content);
      });
    });
  }

  _extractYTId(url) {
    const match = url.match(/(?:youtu\.be\/|[?&]v=)([^&\s]+)/);
    return match?.[1] || null;
  }
}
