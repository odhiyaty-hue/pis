import { UI } from './ui.js';

class AppRouter {
    constructor() {
        this.routes = {
            '/': 'pages/home.html',
            '/register': 'pages/register.html',
            '/groups': 'pages/groups.html',
            '/matches': 'pages/matches.html',
            '/bracket': 'pages/bracket.html',
            '/admin': 'pages/admin.html',
            '/login': 'pages/login.html'
        };

        this.init();
    }

    init() {
        // Handle nav clicks
        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.addEventListener('click', (e) => {
                e.preventDefault();
                const path = nav.getAttribute('data-path');
                this.navigate(path);
            });
        });

        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            this.handleRoute(window.location.pathname);
        });

        // Check login state
        const isAdmin = localStorage.getItem('isAdmin') === 'true';
        if (isAdmin) {
            document.getElementById('nav-admin').classList.remove('hidden');
        }

        // Initial route map depending on where we land
        // Since we don't have a real server, we use hash or simple path if supported
        // For simplicity, we track state in a variable or hash.
        // Let's use hash based routing to ensure it works on Live Server without rewrite rules
        if (!window.location.hash) {
            window.location.hash = '#/';
        }
        this.handleRoute(window.location.hash.slice(1) || '/');

        // Listen to hash changes too
        window.addEventListener('hashchange', () => {
            this.handleRoute(window.location.hash.slice(1) || '/');
        });
    }

    navigate(path) {
        window.location.hash = '#' + path;
        // update nav active state
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-path="${path}"]`);
        if (activeNav) activeNav.classList.add('active');
    }

    async handleRoute(path) {
        let file = this.routes[path] || this.routes['/'];

        UI.showLoader();
        try {
            const response = await fetch(file);
            if (!response.ok) throw new Error('Page not found');
            const html = await response.text();

            // Inject content
            UI.mainContent.innerHTML = html;

            // Re-execute scripts if any exist in the injected template
            // We use modules, so we'll init specific page handlers dynamically
            this.initPageHandler(path);

        } catch (error) {
            console.error('Routing error:', error);
            UI.showToast('حدث خطأ في تحميل الصفحة', 'error');
            UI.mainContent.innerHTML = '<h1 class="title">خطأ 404 - الصفحة غير موجودة</h1>';
        } finally {
            UI.hideLoader();
        }
    }

    async initPageHandler(path) {
        // In a more robust setup, each HTML could load its own script.
        // But here we dispatch a custom event or dynamically import
        try {
            // Examples: import('./handlers/register.js')
            // For now, we will dispatch an event on document with the page name
            const pageName = path === '/' ? 'home' : path.slice(1);
            const event = new CustomEvent('pageLoaded', { detail: { page: pageName } });
            document.dispatchEvent(event);
        } catch (e) {
            console.error(e);
        }
    }
}

// Global App instance
window.appRouter = new AppRouter();

// Provide a global way to navigate (like inside button listeners)
window.navigate = (path) => {
    window.appRouter.navigate(path);
};
