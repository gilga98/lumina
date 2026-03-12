/**
 * InstallBanner — PWA Install Prompt
 * Detects Android (beforeinstallprompt) and iOS (UA detection).
 * Dismissal remembered for 7 days via localStorage.
 */
export class InstallBanner {
  constructor() {
    this._deferredPrompt = null;
    this._isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    this._isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         navigator.standalone === true;
  }

  init() {
    // Don't show if already installed
    if (this._isStandalone) return;

    // Check if dismissed recently
    const dismissed = localStorage.getItem('lumina_install_dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    // Android: capture beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this._deferredPrompt = e;
      this._show('android');
    });

    // iOS: show after 30 seconds if on Safari
    if (this._isIOS) {
      setTimeout(() => this._show('ios'), 30000);
    }
  }

  _show(platform) {
    if (document.getElementById('install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'install-banner';
    banner.className = 'install-banner';

    if (platform === 'ios') {
      banner.innerHTML = `
        <div class="install-banner-content">
          <div class="install-banner-icon">📲</div>
          <div class="install-banner-text">
            <strong>Add Lumina to Home Screen</strong>
            <p>Tap <svg style="display:inline;vertical-align:middle;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg> then <strong>"Add to Home Screen"</strong></p>
          </div>
          <button class="install-banner-close" id="install-dismiss">✕</button>
        </div>`;
    } else {
      banner.innerHTML = `
        <div class="install-banner-content">
          <div class="install-banner-icon">✨</div>
          <div class="install-banner-text">
            <strong>Install Lumina</strong>
            <p>Get the full app experience with offline access</p>
          </div>
          <button class="lumina-btn primary small" id="install-accept">Install</button>
          <button class="install-banner-close" id="install-dismiss">✕</button>
        </div>`;
    }

    document.body.appendChild(banner);

    // Animate in
    requestAnimationFrame(() => banner.classList.add('show'));

    // Dismiss
    document.getElementById('install-dismiss')?.addEventListener('click', () => this._dismiss(banner));

    // Android install
    document.getElementById('install-accept')?.addEventListener('click', async () => {
      if (this._deferredPrompt) {
        this._deferredPrompt.prompt();
        const { outcome } = await this._deferredPrompt.userChoice;
        if (outcome === 'accepted') this._dismiss(banner);
        this._deferredPrompt = null;
      }
    });
  }

  _dismiss(el) {
    localStorage.setItem('lumina_install_dismissed', Date.now().toString());
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }
}
