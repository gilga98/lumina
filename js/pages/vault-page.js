import { ImageService } from '../services/image-service.js';
import { ContentService } from '../services/content-service.js';
import { GestationalEngine } from '../services/gestational-engine.js';
import { CalendarService } from '../services/calendar-service.js';

/**
 * VaultPage — Secure media vault with encrypted image gallery,
 * past-date uploads, CRUD on images/notes, 40-week timeline, and Care Connect.
 */
export class VaultPage {
  constructor(db, auth, toastFn) {
    this._db = db;
    this._auth = auth;
    this._toast = toastFn || (msg => alert(msg));
    this._imageService = new ImageService();
    this._activeTab = 'gallery';
  }

  async render(container) {
    const profile = await this._db.get('settings', 'profile') || {};
    const ge = profile.lmpDate ? GestationalEngine.calculate(profile.lmpDate) : null;
    const milestones = await ContentService.getMilestones();

    container.innerHTML = `
      <div class="page-container">
        <h1 class="page-title playfair">Medical Vault</h1>
        <p class="page-subtitle">🔒 Encrypted on this device only</p>

        <!-- Tabs -->
        <div class="tab-bar">
          <button class="tab-btn active" data-tab="gallery">📸 Gallery</button>
          <button class="tab-btn" data-tab="timeline">📅 Timeline</button>
          <button class="tab-btn" data-tab="doctor">🩺 Care Connect</button>
          <button class="tab-btn" data-tab="notes">📝 Notes</button>
        </div>

        <!-- Tab Content -->
        <div id="vault-tab-content"></div>
      </div>

      <!-- Image Detail Modal -->
      <div class="modal-overlay hidden" id="image-modal">
        <div class="modal-card image-modal">
          <img id="modal-image" src="" alt="Photo">
          <div class="image-modal-actions">
            <label>Category: <select class="lumina-input" id="modal-category">
              <option value="scans">Scans</option>
              <option value="prescriptions">Prescriptions</option>
              <option value="tests">Tests</option>
              <option value="bump">Bump Progress</option>
            </select></label>
            <label>Date: <input type="date" class="lumina-input" id="modal-date"></label>
            <div style="display:flex;gap:10px;">
              <button class="lumina-btn primary full-width" id="modal-save">Save Changes</button>
              <button class="lumina-btn danger full-width" id="modal-delete">Delete</button>
            </div>
            <button class="lumina-btn secondary full-width" id="modal-close">Close</button>
          </div>
        </div>
      </div>
    `;

    this._profile = profile;
    this._ge = ge;
    this._milestones = milestones;
    this._renderTab(this._activeTab);
    this._attachTabListeners();
  }

  cleanup() {
    this._imageService.revokeAll();
  }

  _attachTabListeners() {
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
    const content = document.getElementById('vault-tab-content');
    if (tab === 'gallery') await this._renderGallery(content);
    else if (tab === 'timeline') this._renderTimeline(content);
    else if (tab === 'doctor') await this._renderDoctor(content);
    else if (tab === 'notes') await this._renderNotes(content);
  }

  async _renderGallery(content) {
    const images = await this._db.getAll('vault_images');
    const categories = ['all', 'scans', 'prescriptions', 'tests', 'bump'];

    // Sort by date descending
    images.sort((a, b) => (b.dateTaken || '').localeCompare(a.dateTaken || ''));

    content.innerHTML = `
      <div class="gallery-filters-wrapper">
        <div class="gallery-categories">
          ${categories.map(c => `<button class="cat-btn ${c === 'all' ? 'active' : ''}" data-cat="${c}">${c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}</button>`).join('')}
        </div>
      </div>
      <div class="vault-container" id="vault-container">
        ${images.length === 0 ? '<p class="gallery-empty">No photos yet. Upload your first scan!</p>' : ''}
      </div>
      <div class="upload-section">
        <input type="file" accept="image/*" id="vault-file" class="hidden" multiple>
        <div class="upload-controls">
          <label>Date: <input type="date" class="lumina-input" id="upload-date" value="${CalendarService.toISO(new Date())}"></label>
          <label>Category: <select class="lumina-input" id="upload-category">
            <option value="scans">Scans</option>
            <option value="prescriptions">Prescriptions</option>
            <option value="tests">Tests</option>
            <option value="bump">Bump Progress</option>
          </select></label>
        </div>
        <button class="lumina-btn primary full-width" id="vault-upload-btn">📷 Upload Photo</button>
      </div>
    `;

    this._images = images;
    this._renderGalleryGrid('all');

    // Category filter
    document.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderGalleryGrid(btn.dataset.cat);
      });
    });

    // Upload
    const uploadBtn = document.getElementById('vault-upload-btn');
    uploadBtn?.addEventListener('click', () => document.getElementById('vault-file')?.click());
    document.getElementById('vault-file')?.addEventListener('change', (e) => {
      if (uploadBtn) {
        uploadBtn.textContent = '⏳ Uploading...';
        uploadBtn.disabled = true;
      }
      this._handleUpload(e);
    });
  }

  async _renderGalleryGrid(filterCat) {
    const container = document.getElementById('vault-container');
    if (!container) return;
    container.innerHTML = '';

    const categories = ['scans', 'prescriptions', 'tests', 'bump'];
    const filtered = filterCat === 'all' ? this._images : this._images.filter(img => (img.category || 'scans') === filterCat);

    if (filterCat === 'all') {
      for (const cat of categories) {
        const catImages = filtered.filter(img => (img.category || 'scans') === cat);
        if (catImages.length > 0) {
          const section = document.createElement('div');
          section.className = 'vault-section';
          section.innerHTML = `<h3 class="vault-section-title">${cat.charAt(0).toUpperCase() + cat.slice(1)}</h3>`;
          const grid = document.createElement('div');
          grid.className = 'vault-grid';
          section.appendChild(grid);
          container.appendChild(section);
          for (const img of catImages) {
            await this._addImageThumb(grid, img);
          }
        }
      }
    } else {
      const grid = document.createElement('div');
      grid.className = 'vault-grid';
      container.appendChild(grid);
      for (const img of filtered) {
        await this._addImageThumb(grid, img);
      }
    }
  }

  async _addImageThumb(grid, img) {
    const div = document.createElement('div');
    div.className = 'vault-thumb-container';
    div.dataset.id = img.id;
    div.dataset.category = img.category || 'scans';
    
    let imgHtml = `
      <div class="vault-thumb">
        <div class="thumb-inner" style="background-color:var(--bg-secondary);display:flex;align-items:center;justify-content:center;height:100%;">
          <span>🔒</span>
        </div>
      </div>`;

    const key = this._auth.key;
    if (key && img.data && img.data.iv && img.data.ciphertext) {
      try {
        const { CryptoService } = await import('../services/crypto-service.js');
        const decrypted = await CryptoService.decrypt(key, img.data.iv, img.data.ciphertext);
        const url = this._imageService.createSecureURL(decrypted);
        img.url = url; // Save for modal
        imgHtml = `
          <div class="vault-thumb unlocked">
            <img src="${url}" alt="Photo">
          </div>`;
      } catch (err) {
        console.error("Failed to decrypt image thumb", err);
      }
    }

    div.innerHTML = `
      ${imgHtml}
      <small class="thumb-date">${img.dateTaken || '—'}</small>
    `;
    div.addEventListener('click', () => this._showImageModal(img));
    grid.appendChild(div);
  }

  async _handleUpload(e) {
    const files = e.target.files;
    if (!files.length) return;
    const dateTaken = document.getElementById('upload-date')?.value || CalendarService.toISO(new Date());
    const category = document.getElementById('upload-category')?.value || 'scans';
    const key = this._auth.key;
    if (!key) return;

    const { CryptoService } = await import('../services/crypto-service.js');

    for (const file of files) {
      const compressed = await this._imageService.compress(file);
      const encrypted = await CryptoService.encrypt(key, compressed);
      const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await this._db.put('vault_images', {
        id,
        data: encrypted,
        dateTaken,
        category,
        name: file.name,
        createdAt: new Date().toISOString(),
      });
    }

    this._toast('Photo uploaded successfully ✓');
    this._renderTab('gallery');
  }

  _showImageModal(img) {
    if (!img.url) {
      this._toast('Image not properly decrypted', 'error');
      return;
    }
    try {
      document.getElementById('modal-image').src = img.url;
      document.getElementById('modal-category').value = img.category || 'scans';
      document.getElementById('modal-date').value = img.dateTaken || '';
      document.getElementById('image-modal').classList.remove('hidden');
      document.getElementById('image-modal').dataset.id = img.id;

      document.getElementById('modal-save').onclick = async () => {
        img.category = document.getElementById('modal-category').value;
        img.dateTaken = document.getElementById('modal-date').value;
        await this._db.put('vault_images', img);
        document.getElementById('image-modal').classList.add('hidden');
        this._renderTab('gallery');
      };

      document.getElementById('modal-delete').onclick = async () => {
        if (!confirm('Delete this photo permanently?')) return;
        await this._db.delete('vault_images', img.id);
        document.getElementById('image-modal').classList.add('hidden');
        this._renderTab('gallery');
      };

      document.getElementById('modal-close').onclick = () => {
        document.getElementById('image-modal').classList.add('hidden');
      };
    } catch (err) {
      this._toast('Failed to open image.', 'error');
    }
  }

  _renderTimeline(content) {
    const currentWeek = this._ge?.week || 1;

    let html = '<div class="timeline">';
    for (const m of this._milestones) {
      const isPast = m.week <= currentWeek;
      const isCurrent = m.week === currentWeek || (m.week <= currentWeek && this._milestones.findIndex(x => x.week > currentWeek) === this._milestones.indexOf(m) + 1);
      html += `
        <div class="timeline-item ${isPast ? 'past' : 'future'} ${m.week === currentWeek ? 'current' : ''}">
          <div class="timeline-dot ${isPast ? 'filled' : ''}"></div>
          <div class="timeline-card ${m.week === currentWeek ? 'current-card' : ''}">
            <span class="timeline-week">${m.fruitEmoji} WEEK ${m.week}</span>
            <h4>${m.title}</h4>
            <p>${m.description}</p>
          </div>
        </div>`;
    }
    html += '</div>';
    content.innerHTML = html;

    // Scroll to current week
    setTimeout(() => {
      const cur = content.querySelector('.timeline-item.current');
      cur?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  }

  async _renderDoctor(content) {
    content.innerHTML = `
      <div class="doctor-card">
        <div class="doctor-icon">🩺</div>
        <h3>${this._profile.doctorName || 'Your Doctor'}</h3>
        <p>${this._profile.doctorClinic || 'Tap Settings to add details'}</p>
        ${this._profile.doctorPhone ? `
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px;">
            <a href="tel:${this._profile.doctorPhone}" class="doctor-btn primary full-width">📞 Call</a>
            <a href="https://wa.me/${this._profile.doctorPhone.replace(/\D/g, '')}" target="_blank" class="doctor-btn secondary full-width">💬 WhatsApp</a>
          </div>` : ''}
      </div>`;
  }

  async _renderNotes(content) {
    const notes = await this._db.getAll('notes');
    notes.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    content.innerHTML = `
      <div class="notes-list">
        ${notes.map(n => `
          <div class="note-item" data-id="${n.id}">
            <div class="note-header">
              <strong>${n.title || 'Note'}</strong>
              <div class="note-actions">
                <button class="note-edit-btn" data-id="${n.id}">✏️</button>
                <button class="note-delete-btn" data-id="${n.id}">🗑️</button>
              </div>
            </div>
            <p>${n.text || ''}</p>
            <small>${n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}</small>
          </div>
        `).join('')}
        ${notes.length === 0 ? '<p class="gallery-empty">No notes yet.</p>' : ''}
      </div>
      <button class="lumina-btn primary full-width" id="add-note-btn" style="margin-top:12px;">+ Add Note</button>
    `;

    document.getElementById('add-note-btn')?.addEventListener('click', () => this._showNoteModal());
    content.querySelectorAll('.note-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const n = notes.find(x => x.id === btn.dataset.id);
        if (n) this._showNoteModal(n);
      });
    });
    content.querySelectorAll('.note-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this note?')) return;
        await this._db.delete('notes', btn.dataset.id);
        this._renderTab('notes');
      });
    });
  }

  _showNoteModal(existing = null) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <h3>${existing ? 'Edit Note' : 'New Note'}</h3>
        <input type="text" class="lumina-input" id="note-title" placeholder="Title" value="${existing?.title || ''}">
        <textarea class="lumina-input" id="note-text" rows="5" placeholder="Write your note...">${existing?.text || ''}</textarea>
        <div style="display:flex;gap:10px;margin-top:10px;">
          <button class="lumina-btn primary full-width" id="note-save">Save</button>
          <button class="lumina-btn secondary full-width" id="note-cancel">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('note-cancel').addEventListener('click', () => overlay.remove());
    document.getElementById('note-save').addEventListener('click', async () => {
      const title = document.getElementById('note-title').value.trim();
      const text = document.getElementById('note-text').value.trim();
      if (!text) return;
      const id = existing?.id || `note-${Date.now()}`;
      await this._db.put('notes', { id, title, text, createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
      overlay.remove();
      this._toast('Note saved ✓');
      this._renderTab('notes');
    });
  }
}
