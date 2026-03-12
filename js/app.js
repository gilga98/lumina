import { DBService } from './services/db-service.js';
import { AuthService } from './services/auth-service.js';
import { BackupService } from './services/backup-service.js';
import { ContentService } from './services/content-service.js';
import { Router } from './router.js';
import { DashboardPage } from './pages/dashboard-page.js';
import { LibraryPage } from './pages/library-page.js';
import { VaultPage } from './pages/vault-page.js';
import { SettingsPage } from './pages/settings-page.js';
import { CalendarPage } from './pages/calendar-page.js';
import { OnboardingPage } from './pages/onboarding-page.js';
import { LockScreen } from './pages/lock-screen.js';
import { InstallBanner } from './components/install-banner.js';

/**
 * AppController — Root orchestrator.
 * Wires together services, pages, and the router.
 * Follows Dependency Injection — passes services into page constructors.
 */
class AppController {
  constructor() {
    this._db = new DBService();
    this._auth = new AuthService(this._db);
    this._lockScreen = new LockScreen(this._auth, () => this._onUnlock());
    this._vaultPage = null;
    this._installBanner = new InstallBanner();

    // Auto-lock callback
    this._auth.onLock(() => {
      this._lockScreen.show();
    });

    // Touch auth on user activity (extends auto-lock timer)
    document.addEventListener('touchstart', () => this._auth.touch(), { passive: true });
    document.addEventListener('click', () => this._auth.touch());

    // Universal Reset Handler (for forgotten master passwords)
    window.onLuminaResetRequest = async () => {
      if (confirm('⚠️ WARNING ⚠️\n\nIf you reset the app, ALL your encrypted data, photos, and settings will be PERMANENTLY DELETED.\n\nAre you absolutely sure you want to start fresh?')) {
        const check = prompt('Type "RESET" to confirm permanent deletion of all data:');
        if (check === 'RESET') {
          await this._clearAllData();
        }
      }
    };
  }

  async init() {
    await this._db.open();

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err =>
        console.warn('SW registration failed:', err)
      );
    }

    // Preload content
    ContentService.preloadAll().catch(() => {});

    // Init install banner
    this._installBanner.init();

    // Attempt to restore session
    const restored = await this._auth.restoreSession();
    if (restored) {
      this._onUnlock();
      return;
    }

    // Check if first-time user
    const isSetup = await this._auth.isSetup();
    if (!isSetup) {
      this._showOnboarding();
      return;
    }

    // Show lock screen
    this._lockScreen.show();
  }

  _showOnboarding() {
    const onboarding = new OnboardingPage(this._db, this._auth, () => {
      this._startApp();
      this._checkBackupReminder();
    });
    onboarding.render();
  }

  _onUnlock() {
    this._startApp();
    this._checkBackupReminder();
  }

  _startApp() {
    // Initialize pages
    const toastFn = (msg, type) => this._showToast(msg, type);
    const dashboardPage = new DashboardPage(this._db, this._auth);
    const libraryPage = new LibraryPage(this._db);
    this._vaultPage = new VaultPage(this._db, this._auth);
    const calendarPage = new CalendarPage(this._db, toastFn);
    const settingsPage = new SettingsPage(
      this._db,
      this._auth,
      toastFn,
      () => this._clearAllData()
    );

    // Initialize router
    this._router = new Router({
      '/dashboard': (c) => dashboardPage.render(c),
      '/library': (c) => libraryPage.render(c),
      '/calendar': (c) => calendarPage.render(c),
      '/vault': (c) => this._vaultPage.render(c),
      '/settings': (c) => settingsPage.render(c),
    });

    // Revoke vault image URLs when navigating away from vault
    this._router.onBeforeNavigate((from) => {
      if (from === '/vault' && this._vaultPage) {
        this._vaultPage.cleanup();
      }
    });

    // Show bottom nav
    document.getElementById('bottom-nav').style.display = 'flex';

    // Attach nav click handlers
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const route = item.dataset.route;
        if (route) this._router.navigate('#' + route);
      });
    });

    this._router.start();
  }

  _showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  async _checkBackupReminder() {
    const backup = new BackupService(this._db);
    const shouldRemind = await backup.shouldRemindBackup();
    if (shouldRemind) {
      setTimeout(() => {
        this._showToast("💾 Don't forget to backup your latest milestones!", 'warning');
      }, 5000);
    }
  }

  async _clearAllData() {
    for (const store of DBService.STORES) {
      await this._db.clear(store);
    }
    location.reload();
  }
}

// --- Bootstrap ---
document.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.init();
});
