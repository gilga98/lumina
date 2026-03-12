import { BackupService } from '../services/backup-service.js';

/**
 * SettingsPage — Profile, medications, backup/restore, security.
 * Full CRUD on medications and profile.
 */
export class SettingsPage {
  constructor(db, auth, showToast, onClearAll) {
    this._db = db;
    this._auth = auth;
    this._toast = showToast;
    this._clearAll = onClearAll;
  }

  async render(container) {
    const profile = await this._db.get('settings', 'profile') || {};
    const medications = await this._db.getAll('medications');

    container.innerHTML = `
      <div class="page-container">
        <h1 class="page-title playfair">Settings</h1>

        <!-- Profile Section -->
        <div class="settings-section">
          <h3 class="settings-section-title">PROFILE</h3>
          <div class="lumina-card">
            <div class="form-group">
              <label>Your Name</label>
              <input type="text" class="lumina-input" id="set-name" value="${profile.name || ''}" placeholder="Optional">
            </div>
            <div class="form-group">
              <label>Last Menstrual Period (LMP)</label>
              <input type="date" class="lumina-input" id="set-lmp" value="${profile.lmpDate || ''}">
            </div>
            <div class="form-group">
              <label>Doctor's Name</label>
              <input type="text" class="lumina-input" id="set-doc-name" value="${profile.doctorName || ''}" placeholder="Dr. ...">
            </div>
            <div class="form-group">
              <label>Clinic Name</label>
              <input type="text" class="lumina-input" id="set-doc-clinic" value="${profile.doctorClinic || ''}" placeholder="Optional">
            </div>
            <div class="form-group">
              <label>Doctor's Phone</label>
              <input type="tel" class="lumina-input" id="set-doc-phone" value="${profile.doctorPhone || ''}" placeholder="+91...">
            </div>
            <button class="lumina-btn primary full-width" id="save-profile">Save Profile</button>
          </div>
        </div>

        <!-- Medications Section -->
        <div class="settings-section">
          <h3 class="settings-section-title">💊 MEDICATIONS</h3>
          <div class="med-manage-list" id="med-list">
            ${medications.map(m => `
              <div class="lumina-card med-manage-item">
                <div>
                  <strong>${m.name}</strong>
                  <p>${m.dosage || ''} · ${m.frequency || 'Daily'}</p>
                  <small>${m.time || ''} ${m.notes ? '· ' + m.notes : ''}</small>
                </div>
                <div class="med-manage-actions">
                  <button class="med-edit-btn" data-id="${m.id}">✏️</button>
                  <button class="med-delete-btn" data-id="${m.id}">🗑️</button>
                </div>
              </div>
            `).join('')}
            ${medications.length === 0 ? '<p style="text-align:center;color:var(--charcoal-light);padding:20px;">No medications added yet.</p>' : ''}
          </div>
          <button class="lumina-btn primary full-width" id="add-med-btn">+ Add Medication</button>
        </div>

        <!-- Custom Habits Section -->
        <div class="settings-section">
          <h3 class="settings-section-title">🎯 CUSTOM HABITS</h3>
          <div id="custom-habits-list"></div>
          <button class="lumina-btn secondary full-width" id="manage-habits-btn">Manage Custom Habits</button>
        </div>

        <!-- Data & Security -->
        <div class="settings-section">
          <h3 class="settings-section-title">DATA & SECURITY</h3>
          ${this._settingsRow('💾', 'Create Secure Backup', 'Export encrypted .lumina file', 'create-backup')}
          ${this._settingsRow('📥', 'Restore from Backup', 'Import a .lumina file', 'restore-backup')}
          ${this._settingsRow('🔑', 'Change Master Password', 'Update your encryption password', 'change-password')}
        </div>

        <!-- Danger Zone -->
        <div class="settings-section">
          <h3 class="settings-section-title danger">DANGER ZONE</h3>
          <div class="lumina-card danger-card">
            ${this._settingsRow('🗑️', 'Clear All Data', 'This cannot be undone', 'clear-data', true)}
          </div>
        </div>

        <!-- App Info -->
        <div class="lumina-card" style="text-align:center;margin-top:20px;">
          <p>🌸</p>
          <p><strong>Lumina</strong></p>
          <p style="font-size:0.75rem;color:var(--charcoal-light);">v2.0 • Your data never leaves your device.</p>
          <p style="font-size:0.7rem;color:var(--charcoal-light);">Made with ❤️ for expecting mothers</p>
        </div>
      </div>

      <!-- Medication Modal -->
      <div class="modal-overlay hidden" id="med-modal">
        <div class="modal-card">
          <h3 id="med-modal-title">Add Medication</h3>
          <input type="text" class="lumina-input" id="med-name" placeholder="Medication name (e.g., Folic Acid)">
          <input type="text" class="lumina-input" id="med-dosage" placeholder="Dosage (e.g., 400mcg)">
          <select class="lumina-input" id="med-frequency">
            <option value="Once daily">Once daily</option>
            <option value="Twice daily">Twice daily</option>
            <option value="Three times daily">Three times daily</option>
            <option value="Weekly">Weekly</option>
            <option value="As needed">As needed</option>
          </select>
          <input type="time" class="lumina-input" id="med-time" value="09:00">
          <input type="text" class="lumina-input" id="med-notes" placeholder="Notes (optional)">
          <div style="display:flex;gap:10px;margin-top:10px;">
            <button class="lumina-btn primary full-width" id="med-save">Save</button>
            <button class="lumina-btn secondary full-width" id="med-cancel">Cancel</button>
          </div>
        </div>
      </div>
    `;

    this._profile = profile;
    this._attachListeners();
    this._loadCustomHabits();
  }

  _settingsRow(icon, title, subtitle, id, isDanger = false) {
    return `
      <button class="settings-row ${isDanger ? 'danger' : ''}" id="${id}">
        <div class="settings-row-icon">${icon}</div>
        <div class="settings-row-text">
          <strong class="${isDanger ? 'danger-text' : ''}">${title}</strong>
          <small>${subtitle}</small>
        </div>
        <span class="settings-row-arrow">›</span>
      </button>`;
  }

  async _loadCustomHabits() {
    const habits = await this._db.getAll('custom_habits');
    const list = document.getElementById('custom-habits-list');
    if (!list) return;
    if (habits.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--charcoal-light);padding:10px;">No custom habits. Add them from the dashboard.</p>';
      return;
    }
    list.innerHTML = habits.map(h => `
      <div class="lumina-card" style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;margin-bottom:6px;">
        <span>${h.emoji} ${h.text}</span>
        <button class="custom-habit-del" data-id="${h.id}" style="background:none;border:none;font-size:1.1rem;cursor:pointer;">🗑️</button>
      </div>`).join('');

    list.querySelectorAll('.custom-habit-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this habit?')) return;
        await this._db.delete('custom_habits', btn.dataset.id);
        this._loadCustomHabits();
      });
    });
  }

  _attachListeners() {
    // Save profile
    document.getElementById('save-profile')?.addEventListener('click', async () => {
      const updated = {
        id: 'profile',
        name: document.getElementById('set-name').value.trim(),
        lmpDate: document.getElementById('set-lmp').value,
        doctorName: document.getElementById('set-doc-name').value.trim(),
        doctorClinic: document.getElementById('set-doc-clinic').value.trim(),
        doctorPhone: document.getElementById('set-doc-phone').value.trim(),
      };
      await this._db.put('settings', updated);
      this._toast('Profile saved ✓');
    });

    // Medications
    document.getElementById('add-med-btn')?.addEventListener('click', () => this._openMedModal());
    document.querySelectorAll('.med-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => this._openMedModal(btn.dataset.id));
    });
    document.querySelectorAll('.med-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this medication?')) return;
        await this._db.delete('medications', btn.dataset.id);
        this._toast('Medication removed');
        // Re-render settings
        const container = document.getElementById('bottom-nav')?.previousElementSibling?.querySelector('#app') || this._findAppContainer();
        if (container) this.render(container);
        else location.hash = '#/settings';
      });
    });
    document.getElementById('med-cancel')?.addEventListener('click', () => {
      document.getElementById('med-modal').classList.add('hidden');
    });
    document.getElementById('med-save')?.addEventListener('click', () => this._saveMed());

    // Backup
    document.getElementById('create-backup')?.addEventListener('click', async () => {
      const key = this._auth.key;
      if (!key) return;
      const bs = new BackupService(this._db);
      await bs.exportBackup(key);
      this._toast('Backup created ✓');
    });

    // Restore
    document.getElementById('restore-backup')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.lumina';
      input.addEventListener('change', async (e) => {
        if (!e.target.files.length) return;
        const pw = prompt('Enter the master password for this backup:');
        if (!pw) return;
        const bs = new BackupService(this._db);
        const ok = await bs.importBackup(e.target.files[0], pw);
        if (ok) { this._toast('Backup restored!'); location.reload(); }
        else this._toast('Wrong password or corrupted backup.', 'error');
      });
      input.click();
    });

    // Change password
    document.getElementById('change-password')?.addEventListener('click', async () => {
      const current = prompt('Enter your current master password:');
      if (!current) return;
      const newPw = prompt('Enter your new master password (min 4 chars):');
      if (!newPw || newPw.length < 4) { this._toast('Password must be at least 4 characters', 'error'); return; }
      const confirm2 = prompt('Confirm new password:');
      if (newPw !== confirm2) { this._toast('Passwords do not match', 'error'); return; }
      const ok = await this._auth.changePassword(current, newPw);
      if (ok) this._toast('Password changed ✓');
      else this._toast('Current password is incorrect', 'error');
    });

    // Clear data
    document.getElementById('clear-data')?.addEventListener('click', () => {
      if (!confirm('⚠️ This will permanently delete ALL your data. Are you sure?')) return;
      if (!confirm('This CANNOT be undone. Type "DELETE" to confirm.')) return;
      this._clearAll();
    });

    // Manage habits
    document.getElementById('manage-habits-btn')?.addEventListener('click', () => this._loadCustomHabits());
  }

  _findAppContainer() {
    return document.getElementById('app');
  }

  async _openMedModal(editId = null) {
    const modal = document.getElementById('med-modal');
    modal.classList.remove('hidden');

    if (editId) {
      const med = await this._db.get('medications', editId);
      if (med) {
        document.getElementById('med-modal-title').textContent = 'Edit Medication';
        document.getElementById('med-name').value = med.name;
        document.getElementById('med-dosage').value = med.dosage || '';
        document.getElementById('med-frequency').value = med.frequency || 'Once daily';
        document.getElementById('med-time').value = med.time || '09:00';
        document.getElementById('med-notes').value = med.notes || '';
        modal.dataset.editId = editId;
      }
    } else {
      document.getElementById('med-modal-title').textContent = 'Add Medication';
      document.getElementById('med-name').value = '';
      document.getElementById('med-dosage').value = '';
      document.getElementById('med-frequency').value = 'Once daily';
      document.getElementById('med-time').value = '09:00';
      document.getElementById('med-notes').value = '';
      delete modal.dataset.editId;
    }
  }

  async _saveMed() {
    const name = document.getElementById('med-name').value.trim();
    if (!name) { this._toast('Please enter a medication name', 'error'); return; }

    const modal = document.getElementById('med-modal');
    const id = modal.dataset.editId || `med-${Date.now()}`;

    await this._db.put('medications', {
      id,
      name,
      dosage: document.getElementById('med-dosage').value.trim(),
      frequency: document.getElementById('med-frequency').value,
      time: document.getElementById('med-time').value,
      notes: document.getElementById('med-notes').value.trim(),
      active: true,
    });

    modal.classList.add('hidden');
    this._toast('Medication saved ✓');
    location.hash = '#/settings'; // Force re-render
  }
}
