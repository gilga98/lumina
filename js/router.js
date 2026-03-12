/**
 * Router — Lightweight hash-based SPA router.
 * Single Responsibility: URL→page mapping and navigation state.
 */
export class Router {
  /**
   * @param {Object<string, Function>} routes — map of hash paths to render functions
   */
  constructor(routes) {
    this._routes = routes;
    this._currentRoute = null;
    this._onBeforeNavigate = null;
    this._onAfterNavigate = null;

    window.addEventListener('hashchange', () => this._handleRoute());
  }

  /** Register a callback before navigation (e.g., to revoke URLs). */
  onBeforeNavigate(fn) { this._onBeforeNavigate = fn; }

  /** Register a callback after navigation. */
  onAfterNavigate(fn) { this._onAfterNavigate = fn; }

  /** Start the router — render the initial route. */
  start() {
    if (!window.location.hash) {
      window.location.hash = '#/dashboard';
    } else {
      this._handleRoute();
    }
  }

  /** Navigate programmatically. */
  navigate(hash) {
    window.location.hash = hash;
  }

  /** Get current route path. */
  get current() {
    return this._currentRoute;
  }

  /** @private */
  _handleRoute() {
    const hash = window.location.hash || '#/dashboard';
    const path = hash.replace('#', '');

    if (this._onBeforeNavigate) this._onBeforeNavigate(this._currentRoute, path);

    this._currentRoute = path;
    const renderFn = this._routes[path] || this._routes['/dashboard'];

    const app = document.getElementById('app');
    if (app && renderFn) {
      app.innerHTML = '';
      renderFn(app);
    }

    this._updateNav(path);

    if (this._onAfterNavigate) this._onAfterNavigate(path);
  }

  /** Update bottom nav active state. */
  _updateNav(path) {
    document.querySelectorAll('.nav-item').forEach((item) => {
      const itemPath = item.dataset.route;
      item.classList.toggle('active', itemPath === path);
    });
  }
}
