/**
 * LockScreen — PIN/Password entry screen.
 * Premium, minimal design with shake animation on error.
 */
export class LockScreen {
  /**
   * @param {import('../services/auth-service.js').AuthService} auth
   * @param {Function} onUnlock — called after successful unlock
   */
  constructor(auth, onUnlock) {
    this._auth = auth;
    this._onUnlock = onUnlock;
  }

  /** Show the lock screen overlay. */
  show() {
    const el = document.getElementById('lock-screen');
    if (el) {
      el.classList.remove('hidden');
      const input = el.querySelector('.lock-input');
      if (input) { input.value = ''; input.focus(); }
      return;
    }
    this._create();
  }

  /** Hide the lock screen. */
  hide() {
    const el = document.getElementById('lock-screen');
    if (el) el.classList.add('hidden');
  }

  _create() {
    const div = document.createElement('div');
    div.id = 'lock-screen';
    div.innerHTML = `
      <svg class="lock-logo" viewBox="0 0 80 80" fill="none">
        <circle cx="40" cy="40" r="38" fill="rgba(143,174,139,0.1)" stroke="var(--sage-green)" stroke-width="2"/>
        <path d="M28 35v-4a12 12 0 1 1 24 0v4" stroke="var(--sage-green)" stroke-width="2.5" stroke-linecap="round"/>
        <rect x="24" y="35" width="32" height="22" rx="4" fill="var(--sage-green)" opacity="0.85"/>
        <circle cx="40" cy="45" r="3" fill="white"/>
        <path d="M40 48v4" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <h2 class="lock-title">Welcome Back</h2>
      <p class="lock-subtitle">Enter your password to unlock</p>
      <div class="lock-input-wrapper">
        <input type="password" class="lock-input" id="lock-password" placeholder="Master Password" autocomplete="current-password">
        <button class="lock-submit-btn" id="lock-submit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
      <p class="lock-error" id="lock-error"></p>
      <button class="lock-reset-btn" id="lock-reset">Forgot Password?</button>
    `;
    document.body.appendChild(div);

    document.getElementById('lock-submit').addEventListener('click', () => this._tryUnlock());
    document.getElementById('lock-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._tryUnlock();
    });
    
    document.getElementById('lock-reset').addEventListener('click', () => {
      if (typeof window.onLuminaResetRequest === 'function') {
        window.onLuminaResetRequest();
      } else {
        alert('Reset not available.');
      }
    });

    setTimeout(() => document.getElementById('lock-password')?.focus(), 300);
  }

  async _tryUnlock() {
    const input = document.getElementById('lock-password');
    const error = document.getElementById('lock-error');
    const pw = input?.value;
    if (!pw) return;

    error.textContent = '';
    const success = await this._auth.unlock(pw);

    if (success) {
      this.hide();
      if (this._onUnlock) this._onUnlock();
    } else {
      input.classList.add('shake');
      error.textContent = 'Incorrect password. Please try again.';
      setTimeout(() => input.classList.remove('shake'), 500);
      input.value = '';
      input.focus();
    }
  }
}
