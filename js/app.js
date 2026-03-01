import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDy_ZCcsXGU7su6xHJY54OtuLcXOB8sZNs",
    authDomain: "pesef-43609.firebaseapp.com",
    projectId: "pesef-43609",
    storageBucket: "pesef-43609.firebasestorage.app",
    messagingSenderId: "11775033418",
    appId: "1:11775033418:web:9534cffaf99a085e07e6b3"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ---- UI ----
export const UI = {
    get loader() { return document.getElementById('loader'); },
    get main() { return document.getElementById('main-content'); },
    get toasts() { return document.getElementById('toast-container'); },
    showLoader() { this.loader.classList.remove('hidden'); },
    hideLoader() { this.loader.classList.add('hidden'); },
    toast(msg, type = 'success') {
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.innerHTML = `<i class="fas fa-${type === 'error' ? 'circle-xmark' : 'circle-check'}"></i> ${msg}`;
        this.toasts.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    }
};

// ---- ROUTER ----
const ROUTES = {
    '/': 'pages/home.html',
    '/register': 'pages/register.html',
    '/groups': 'pages/groups.html',
    '/matches': 'pages/matches.html',
    '/bracket': 'pages/bracket.html',
    '/admin': 'pages/admin.html',
    '/login': 'pages/login.html'
};

function updateNav(path) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const a = document.querySelector(`.nav-item[data-path="${path}"]`);
    if (a) a.classList.add('active');
}

async function loadRoute(path) {
    const file = ROUTES[path] || ROUTES['/'];
    UI.showLoader();
    try {
        const res = await fetch(file + '?v=' + Date.now());
        if (!res.ok) throw new Error('404');
        UI.main.innerHTML = await res.text();

        // Update background class specifically for each route
        const container = document.getElementById('app-container');
        const pageName = path === '/' ? 'home' : path.slice(1).replace(/\//g, '-');

        // Remove previous background classes using a robust method
        const classesToRemove = Array.from(container.classList).filter(c => c.startsWith('bg-'));
        classesToRemove.forEach(cls => container.classList.remove(cls));
        container.classList.add(`bg-${pageName}`);

        UI.main.classList.remove('page-enter');
        void UI.main.offsetWidth;
        UI.main.classList.add('page-enter');
        document.dispatchEvent(new CustomEvent('pageLoaded', { detail: { page: pageName } }));
    } catch (e) {
        UI.main.innerHTML = '<div class="error-page"><i class="fas fa-triangle-exclamation"></i><p>خطأ في تحميل الصفحة</p></div>';
    } finally {
        UI.hideLoader();
    }
}

export function navigate(path) {
    window.location.hash = '#' + path;
    updateNav(path);
}
window.navigate = navigate;

window.addEventListener('hashchange', () => {
    const path = window.location.hash.slice(1) || '/';
    updateNav(path);
    loadRoute(path);
});

if (localStorage.getItem('isAdmin') === 'true') {
    document.getElementById('nav-admin')?.classList.remove('hidden');
}

document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.path));
});

const initPath = window.location.hash.slice(1) || '/';
window.location.hash = '#' + initPath;
updateNav(initPath);
loadRoute(initPath);
