/**
 * OnboardingPage — First-time setup flow.
 * Handles welcome, privacy notice, password creation, and profile setup.
 */
export class OnboardingPage {
  /**
   * @param {import('../services/db-service.js').DBService} db
   * @param {import('../services/auth-service.js').AuthService} auth
   * @param {Function} onComplete — called when onboarding finishes
   */
  constructor(db, auth, onComplete) {
    this._db = db;
    this._auth = auth;
    this._onComplete = onComplete;
    this._step = 0;
  }

  render() {
    const overlay = document.createElement('div');
    overlay.className = 'onboarding-container';
    overlay.id = 'onboarding';
    document.body.appendChild(overlay);
    this._renderStep();
  }

  _renderStep() {
    const el = document.getElementById('onboarding');
    if (!el) return;
    const steps = [this._stepWelcome, this._stepPrivacy, this._stepPassword, this._stepProfile];
    if (this._step < steps.length) steps[this._step].call(this, el);
  }

  _stepWelcome(el) {
    el.innerHTML = `
      <div class="onboarding-slide">
        <div class="ob-icon">🌸</div>
        <h1>Welcome to Lumina</h1>
        <p>Your premium, private pregnancy companion. Every moment of your journey, beautifully tracked and securely stored.</p>
        <div class="ob-privacy-badge">🔒 Zero-Knowledge Privacy</div>
        <p style="font-size:0.8rem;color:var(--charcoal-light);max-width:300px;">Your data is encrypted on your device. We can never see it — not even us.</p>
        <div style="margin-top:auto;width:100%;max-width:340px;padding-bottom:40px;">
          <button class="lumina-btn primary full-width" id="ob-next">Begin Your Journey</button>
          <button class="lumina-btn secondary full-width" id="ob-restore" style="margin-top:10px;">Restore from Backup</button>
        </div>
      </div>`;
    document.getElementById('ob-next').addEventListener('click', () => { this._step = 1; this._renderStep(); });
    document.getElementById('ob-restore').addEventListener('click', () => this._handleRestore());
  }

  _stepPrivacy(el) {
    el.innerHTML = `
      <div class="onboarding-slide">
        <div class="ob-icon">🛡️</div>
        <h1>Your Privacy Matters</h1>
        <p>Lumina uses military-grade encryption to protect your most personal moments.</p>
        <div class="ob-warning">
          <p><strong>⚠️ Important:</strong> Your data is locked exclusively to this device. We cannot see it, and we <strong>cannot reset your password</strong>. Please choose a password you will remember.</p>
        </div>
        <div style="text-align:left;max-width:300px;">
          <p style="font-size:0.8rem;margin-bottom:8px;"><span style="color:var(--sage-green);">✓</span> All data encrypted with AES-256</p>
          <p style="font-size:0.8rem;margin-bottom:8px;"><span style="color:var(--sage-green);">✓</span> Works completely offline</p>
          <p style="font-size:0.8rem;margin-bottom:8px;"><span style="color:var(--sage-green);">✓</span> No accounts, no tracking</p>
          <p style="font-size:0.8rem;"><span style="color:var(--sage-green);">✓</span> Backup anytime to your files</p>
        </div>
        <div style="margin-top:auto;width:100%;max-width:340px;padding-bottom:40px;">
          <button class="lumina-btn primary full-width" id="ob-next">I Understand, Continue</button>
        </div>
      </div>`;
    document.getElementById('ob-next').addEventListener('click', () => { this._step = 2; this._renderStep(); });
  }

  _stepPassword(el) {
    el.innerHTML = `
      <div class="onboarding-slide">
        <div class="ob-icon">🔐</div>
        <h1>Create Master Password</h1>
        <p>This password encrypts all your data. Choose something memorable — there is no "forgot password" option.</p>
        <div class="ob-form">
          <input type="password" class="lumina-input" id="ob-pw1" placeholder="Master Password" autocomplete="new-password">
          <input type="password" class="lumina-input" id="ob-pw2" placeholder="Confirm Password" autocomplete="new-password">
          <p id="ob-pw-error" style="color:var(--dusty-rose);font-size:0.8rem;min-height:20px;text-align:center;"></p>
          <button class="lumina-btn primary full-width" id="ob-pw-submit">Set Password</button>
        </div>
      </div>`;
    document.getElementById('ob-pw-submit').addEventListener('click', () => this._setupPassword());
  }

  _stepProfile(el) {
    el.innerHTML = `
      <div class="onboarding-slide">
        <div class="ob-icon">👶</div>
        <h1>About Your Pregnancy</h1>
        <p>This helps us personalize your daily check-ins.</p>
        <div class="ob-form">
          <input type="text" class="lumina-input" id="ob-name" placeholder="Your name (optional)">
          <div>
            <label style="font-size:0.75rem;font-weight:600;color:var(--charcoal-light);display:block;margin-bottom:6px;">First Day of Last Period (LMP)</label>
            <input type="date" class="lumina-input" id="ob-lmp" required>
          </div>
          <p id="ob-profile-error" style="color:var(--dusty-rose);font-size:0.8rem;min-height:20px;text-align:center;"></p>
          <button class="lumina-btn primary full-width" id="ob-finish">Start My Journey 🌟</button>
        </div>
      </div>`;
    document.getElementById('ob-finish').addEventListener('click', () => this._finishSetup());
  }

  async _setupPassword() {
    const pw1 = document.getElementById('ob-pw1')?.value;
    const pw2 = document.getElementById('ob-pw2')?.value;
    const err = document.getElementById('ob-pw-error');
    if (!pw1 || pw1.length < 4) { err.textContent = 'Password must be at least 4 characters.'; return; }
    if (pw1 !== pw2) { err.textContent = 'Passwords do not match.'; return; }
    try {
      err.textContent = 'Setting up encryption...';
      await this._auth.setup(pw1);
      this._step = 3;
      this._renderStep();
    } catch (e) { err.textContent = 'Setup failed. Please try again.'; }
  }

  async _finishSetup() {
    const lmp = document.getElementById('ob-lmp')?.value;
    const err = document.getElementById('ob-profile-error');
    if (!lmp) { err.textContent = 'Please enter your LMP date.'; return; }
    const name = document.getElementById('ob-name')?.value.trim() || '';
    await this._db.put('settings', { id: 'profile', name, lmpDate: lmp, doctorName: '', doctorClinic: '', doctorPhone: '' });
    document.getElementById('onboarding')?.remove();
    if (this._onComplete) this._onComplete();
  }

  _handleRestore() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.lumina';
    input.addEventListener('change', async (e) => {
      if (!e.target.files.length) return;
      const pw = prompt('Enter the Master Password used for this backup:');
      if (!pw) return;
      const { BackupService } = await import('../services/backup-service.js');
      const bs = new BackupService(this._db);
      const ok = await bs.importBackup(e.target.files[0], pw);
      if (ok) { alert('Backup restored! The app will reload.'); location.reload(); }
      else alert('Wrong password or corrupted backup file.');
    });
    input.click();
  }
}
