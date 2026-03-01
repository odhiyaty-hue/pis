import { db, UI, navigate } from './app.js';
import {
    collection, addDoc, getDocs, doc, updateDoc,
    query, where, orderBy, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// ---- SHORT DB REFS ----
const tourColl = collection(db, 'tournaments');
const playersColl = collection(db, 'players');
const groupsColl = collection(db, 'groups');
const matchesColl = collection(db, 'matches');

const DB = {
    // Tournaments
    createTournament: (d) => addDoc(tourColl, { ...d, status: 'open', createdAt: serverTimestamp() }),
    getTournaments: () => getDocs(query(tourColl, orderBy('createdAt', 'desc'))).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
    getTournament: (id) => getDoc(doc(db, 'tournaments', id)).then(d => d.exists() ? { id: d.id, ...d.data() } : null),
    updateTournament: (id, data) => updateDoc(doc(db, 'tournaments', id), data),

    // Players
    addPlayer: (d) => addDoc(playersColl, { ...d, status: 'pending', group: null, points: 0, goalsFor: 0, goalsAgainst: 0, eliminated: false, createdAt: serverTimestamp() }),
    getPlayersByTournament: (tid) => getDocs(query(playersColl, where('tournamentId', '==', tid))).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
    async checkName(tid, name) {
        const snap = await getDocs(query(playersColl, where('tournamentId', '==', tid), where('gameName', '==', name)));
        return !snap.empty;
    },
    getApproved: (tid) => getDocs(query(playersColl, where('tournamentId', '==', tid), where('status', '==', 'approved'))).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
    setPlayerStatus: (id, status) => updateDoc(doc(db, 'players', id), { status }),
    async addStats(id, pts, gf, ga) {
        const ref = doc(db, 'players', id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const d = snap.data();
            await updateDoc(ref, { points: (d.points || 0) + pts, goalsFor: (d.goalsFor || 0) + gf, goalsAgainst: (d.goalsAgainst || 0) + ga });
        }
    },

    // Groups
    createGroup: (tid, name, players) => addDoc(groupsColl, { tournamentId: tid, name, players: players.map(p => p.id), createdAt: serverTimestamp() }),
    assignGroup: (id, group) => updateDoc(doc(db, 'players', id), { group }),
    getGroups: (tid) => getDocs(query(groupsColl, where('tournamentId', '==', tid))).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),

    // Matches
    createMatch: (d) => addDoc(matchesColl, { ...d, score1: null, score2: null, winnerId: null, status: 'pending_result', createdAt: serverTimestamp() }),
    getMatchesByStage: (tid, stage) => getDocs(query(matchesColl, where('tournamentId', '==', tid), where('stage', '==', stage))).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
    updateMatch: (id, data) => updateDoc(doc(db, 'matches', id), data)
};

// ---- IMGBB ----
async function uploadImage(file) {
    const fd = new FormData(); fd.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=9bb81c4b08af039ce7c30f5b05deb2ea`, { method: 'POST', body: fd });
    const data = await res.json();
    if (data.success) return data.data.url;
    throw new Error('فشل رفع الصورة');
}

// ---- PAGE ROUTER ----
document.addEventListener('pageLoaded', e => {
    const m = { home: initHome, register: initRegister, login: initLogin, admin: initAdmin, groups: initGroups, matches: initMatches, bracket: initBracket };
    m[e.detail.page]?.();
});

// ========================
// HOME - Tournament List
// ========================
async function initHome() {
    const container = document.getElementById('tournaments-list');
    try {
        const tours = await DB.getTournaments();
        const open = tours.filter(t => t.status === 'open' || t.status === 'active');
        if (!open.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i><p>لا توجد بطولات متاحة حالياً</p></div>';
            return;
        }
        container.innerHTML = open.map(t => {
            const isActive = t.status === 'active';
            const statusColor = isActive ? 'var(--neon-blue)' : 'var(--neon)';
            const statusText = isActive ? 'جارية' : 'مفتوح التسجيل';
            const statusIcon = isActive ? 'fa-play-circle' : 'fa-door-open';
            return `
            <div class="card glow" style="cursor:pointer;" onclick="${isActive ? `navigate('/matches')` : `joinTournament('${t.id}','${t.name}')`}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <h3 style="font-size:17px;color:var(--text);">${t.name}</h3>
                    <span style="font-size:12px;color:${statusColor};background:rgba(0,255,136,.1);padding:3px 10px;border-radius:20px;border:1px solid ${statusColor};">
                        <i class="fas ${statusIcon}"></i> ${statusText}
                    </span>
                </div>
                <div style="display:flex;gap:16px;font-size:13px;color:var(--muted);">
                    <span><i class="fas fa-users"></i> ${t.maxPlayers} لاعب</span>
                    <span><i class="fas fa-layer-group"></i> ${t.playersPerGroup} في المجموعة</span>
                    <span><i class="fas fa-trophy"></i> ${t.system === 'round_robin' ? 'دوري + إقصاء' : 'إقصاء مباشر'}</span>
                </div>
                ${!isActive ? `<button class="btn btn-primary mt-1" style="padding:9px;" onclick="event.stopPropagation(); joinTournament('${t.id}','${t.name}')"><i class="fas fa-user-plus"></i> انضم الآن</button>` : `<button class="btn btn-outline-blue mt-1" style="padding:9px;" onclick="event.stopPropagation(); navigate('/matches')"><i class="fas fa-eye"></i> متابعة المباريات</button>`}
            </div>`;
        }).join('');
    } catch (e) { console.error(e); container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation"></i><p>خطأ في التحميل</p></div>'; }
}

window.joinTournament = (id, name) => {
    sessionStorage.setItem('joinTourId', id);
    sessionStorage.setItem('joinTourName', name);
    navigate('/register');
};

// ========================
// REGISTER
// ========================
function initRegister() {
    const tourId = sessionStorage.getItem('joinTourId');
    const tourName = sessionStorage.getItem('joinTourName');
    if (!tourId) { UI.toast('اختر بطولة أولاً', 'error'); navigate('/'); return; }
    const titleEl = document.getElementById('register-title');
    if (titleEl) titleEl.innerText = `التسجيل في: ${tourName}`;
    document.getElementById('tournament-id').value = tourId;

    const fileInput = document.getElementById('avatar-file');
    const preview = document.getElementById('avatar-preview');
    fileInput.onchange = () => {
        const f = fileInput.files[0];
        if (f) { preview.src = URL.createObjectURL(f); preview.classList.remove('hidden'); }
    };

    document.getElementById('register-form').onsubmit = async (e) => {
        e.preventDefault();
        const realName = document.getElementById('real-name').value.trim();
        const gameName = document.getElementById('game-name').value.trim();
        const file = fileInput.files[0];
        if (!realName || !gameName) return UI.toast('الرجاء ملء جميع الحقول', 'error');
        if (!file) return UI.toast('الرجاء اختيار صورة', 'error');
        UI.showLoader();
        try {
            if (await DB.checkName(tourId, gameName)) { UI.toast('اسم الحساب مسجل مسبقاً!', 'error'); return; }
            const avatarUrl = await uploadImage(file);
            await DB.addPlayer({ realName, gameName, avatarUrl, tournamentId: tourId });
            UI.toast('تم إرسال طلب التسجيل بنجاح!');
            sessionStorage.removeItem('joinTourId'); sessionStorage.removeItem('joinTourName');
            navigate('/');
        } catch (err) { UI.toast(err.message, 'error'); }
        finally { UI.hideLoader(); }
    };
}

// ========================
// LOGIN
// ========================
function initLogin() {
    document.getElementById('login-form').onsubmit = (e) => {
        e.preventDefault();
        const u = document.getElementById('admin-user').value;
        const p = document.getElementById('admin-pass').value;
        if (u === 'admin' && p === '123456') {
            localStorage.setItem('isAdmin', 'true');
            document.getElementById('nav-admin')?.classList.remove('hidden');
            UI.toast('تم تسجيل الدخول بنجاح');
            navigate('/admin');
        } else {
            UI.toast('بيانات الدخول غير صحيحة', 'error');
        }
    };
}

// ========================
// ADMIN
// ========================
let adminActiveTour = null;
let adminActiveStage = 'groups';

async function initAdmin() {
    const el = document.getElementById('admin-tournaments-list');
    if (!el) return;

    document.getElementById('btn-logout').onclick = () => {
        localStorage.removeItem('isAdmin');
        document.getElementById('nav-admin')?.classList.add('hidden');
        navigate('/');
    };

    document.getElementById('btn-create-tournament').onclick = async () => {
        const name = document.getElementById('tour-name').value.trim();
        const maxPlayers = parseInt(document.getElementById('tour-max-players').value);
        const playersPerGroup = parseInt(document.getElementById('tour-per-group').value);
        const system = document.getElementById('tour-system').value;
        if (!name) return UI.toast('ادخل اسم البطولة', 'error');
        if (maxPlayers < 4) return UI.toast('يجب أن يكون الحد الأدنى 4 لاعبين', 'error');
        UI.showLoader();
        try {
            await DB.createTournament({ name, maxPlayers, playersPerGroup, system });
            UI.toast('تم إنشاء البطولة بنجاح!');
            document.getElementById('tour-name').value = '';
            await loadAdminTournaments();
        } catch (e) { UI.toast(e.message, 'error'); }
        finally { UI.hideLoader(); }
    };

    await loadAdminTournaments();
}

async function loadAdminTournaments() {
    const el = document.getElementById('admin-tournaments-list');
    const tours = await DB.getTournaments();
    if (!tours.length) {
        el.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i><p>لا توجد بطولات بعد</p></div>';
        return;
    }
    el.innerHTML = tours.map(t => {
        const statusColor = t.status === 'active' ? 'var(--neon-blue)' : t.status === 'open' ? 'var(--neon)' : 'var(--muted)';
        const statusText = t.status === 'active' ? 'جارية' : t.status === 'open' ? 'مفتوحة' : 'منتهية';
        return `
        <div class="card" style="border-color:rgba(255,255,255,.08);margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="font-size:15px;">${t.name}</strong>
                <span style="font-size:12px;color:${statusColor};">${statusText}</span>
            </div>
            <div style="font-size:12px;color:var(--muted);margin:6px 0;">${t.maxPlayers} لاعب · ${t.playersPerGroup} في كل مجموعة</div>
            <button onclick="selectAdminTour('${t.id}')" style="background:var(--bg-glass);border:1px solid var(--border);color:var(--text);width:100%;border-radius:10px;padding:8px;font-family:'Cairo',sans-serif;font-weight:600;cursor:pointer;font-size:13px;margin-top:6px;">
                <i class="fas fa-sliders"></i> إدارة البطولة
            </button>
        </div>`;
    }).join('');
}

window.selectAdminTour = async (id) => {
    adminActiveTour = id;
    UI.showLoader();
    try {
        const tour = await DB.getTournament(id);
        const players = await DB.getPlayersByTournament(id);
        const pending = players.filter(p => p.status === 'pending');
        const approved = players.filter(p => p.status === 'approved');

        const pSection = document.getElementById('admin-players-section');
        pSection.classList.remove('hidden');
        document.getElementById('admin-tour-name-label').innerText = tour.name;
        document.getElementById('admin-player-count-badge').innerText = ` (${approved.length}/${tour.maxPlayers})`;

        const pList = document.getElementById('admin-players-list');
        pList.innerHTML = players.length === 0
            ? '<div class="empty-state" style="padding:16px 0;"><i class="fas fa-user-slash"></i><p>لا يوجد لاعبون بعد</p></div>'
            : players.map(p => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
                <div style="display:flex;gap:10px;align-items:center;">
                    <img src="${p.avatarUrl}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid var(--border);">
                    <div>
                        <strong>${p.gameName}</strong><br>
                        <small style="color:var(--muted);">${p.realName}</small>
                    </div>
                </div>
                ${p.status === 'pending'
                    ? `<button onclick="approvePlayer('${p.id}')" style="background:var(--neon);color:#000;border:none;border-radius:10px;padding:7px 12px;font-weight:700;font-family:'Cairo',sans-serif;cursor:pointer;font-size:13px;">قبول</button>`
                    : `<span style="color:var(--neon);font-size:12px;"><i class="fas fa-check-circle"></i> مقبول</span>`}
            </div>`).join('');

        // Show Start button if enough approved players & not started
        const startBtn = document.getElementById('btn-start-tournament');
        if (tour.status === 'open' && approved.length >= tour.maxPlayers) {
            startBtn.classList.remove('hidden');
            startBtn.onclick = () => startTournament(id, tour);
        } else {
            startBtn.classList.add('hidden');
        }

        // If tournament active, show matches section
        const mSection = document.getElementById('admin-matches-section');
        if (tour.status === 'active') {
            mSection.classList.remove('hidden');
            await loadAdminMatches(id, 'groups');
            document.getElementById('admin-tab-groups').onclick = async () => { adminActiveStage = 'groups'; setAdminTab('groups'); await loadAdminMatches(id, 'groups'); };
            document.getElementById('admin-tab-knockout').onclick = async () => { adminActiveStage = 'knockout'; setAdminTab('knockout'); await loadAdminMatches(id, 'knockout'); };
        } else {
            mSection.classList.add('hidden');
        }

        pSection.scrollIntoView({ behavior: 'smooth' });
    } catch (e) { console.error(e); UI.toast('خطأ', 'error'); }
    finally { UI.hideLoader(); }

    // Result modal save
    document.getElementById('btn-save-result').onclick = async () => {
        const mId = document.getElementById('result-match-id').value;
        const p1Id = document.getElementById('result-p1-id').value;
        const p2Id = document.getElementById('result-p2-id').value;
        const stage = document.getElementById('result-stage').value;
        const s1 = parseInt(document.getElementById('result-score1').value);
        const s2 = parseInt(document.getElementById('result-score2').value);
        if (isNaN(s1) || isNaN(s2)) return UI.toast('أدخل النتيجة', 'error');
        UI.showLoader();
        try {
            await DB.updateMatch(mId, { score1: s1, score2: s2, status: 'approved' });
            if (stage === 'groups') {
                let p1pts = 0, p2pts = 0;
                if (s1 > s2) p1pts = 3; else if (s2 > s1) p2pts = 3; else { p1pts = 1; p2pts = 1; }
                await DB.addStats(p1Id, p1pts, s1, s2);
                await DB.addStats(p2Id, p2pts, s2, s1);
            }
            UI.toast('تم حفظ النتيجة!');
            document.getElementById('result-entry-modal').classList.add('hidden');
            await loadAdminMatches(adminActiveTour, stage);
        } catch (e) { UI.toast(e.message, 'error'); }
        finally { UI.hideLoader(); }
    };
    document.getElementById('btn-cancel-result').onclick = () => document.getElementById('result-entry-modal').classList.add('hidden');
};

async function startTournament(tid, tour) {
    if (!confirm(`بدء بطولة "${tour.name}" وإجراء القرعة؟`)) return;
    UI.showLoader();
    try {
        const players = await DB.getApproved(tid);
        if (players.length < 4) throw new Error('لا يكفي عدد اللاعبين');
        const shuffled = players.sort(() => Math.random() - 0.5);
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let gi = 0;
        const ppg = tour.playersPerGroup || 4;
        for (let i = 0; i < shuffled.length; i += ppg) {
            const chunk = shuffled.slice(i, i + ppg);
            const gName = 'المجموعة ' + letters[gi++];
            await DB.createGroup(tid, gName, chunk);
            for (const p of chunk) await DB.assignGroup(p.id, gName);
            for (let a = 0; a < chunk.length; a++)
                for (let b = a + 1; b < chunk.length; b++)
                    await DB.createMatch({ tournamentId: tid, group: gName, stage: 'groups', player1Id: chunk[a].id, player2Id: chunk[b].id, player1Name: chunk[a].gameName, player2Name: chunk[b].gameName });
        }
        await DB.updateTournament(tid, { status: 'active' });
        UI.toast('تم بدء البطولة وإجراء القرعة بنجاح! 🎉');
        await selectAdminTour(tid);
    } catch (e) { UI.toast(e.message, 'error'); }
    finally { UI.hideLoader(); }
}

window.approvePlayer = async (id) => {
    UI.showLoader();
    try { await DB.setPlayerStatus(id, 'approved'); UI.toast('تمت الموافقة'); await selectAdminTour(adminActiveTour); }
    catch (e) { UI.toast('خطأ', 'error'); }
    finally { UI.hideLoader(); }
};

function setAdminTab(active) {
    const g = document.getElementById('admin-tab-groups');
    const k = document.getElementById('admin-tab-knockout');
    if (!g || !k) return;
    g.className = active === 'groups' ? 'btn btn-primary' : 'btn btn-outline';
    g.style.cssText = 'flex:1;margin:0;padding:8px;font-size:13px;' + (active !== 'groups' ? 'border-color:var(--muted);color:var(--muted);' : '');
    k.className = active === 'knockout' ? 'btn btn-blue' : 'btn btn-outline';
    k.style.cssText = 'flex:1;margin:0;padding:8px;font-size:13px;' + (active !== 'knockout' ? 'border-color:var(--muted);color:var(--muted);' : '');
}

async function loadAdminMatches(tid, stage) {
    const container = document.getElementById('admin-matches-list');
    const matches = await DB.getMatchesByStage(tid, stage);
    if (!matches.length) {
        container.innerHTML = '<div class="empty-state" style="padding:16px 0;"><i class="fas fa-futbol"></i><p>لا توجد مباريات بعد</p></div>';
        return;
    }
    container.innerHTML = matches.map(m => {
        const done = m.status === 'approved';
        return `
        <div style="padding:12px 0;border-bottom:1px solid var(--border);">
            <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">${m.group || ''}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                <span style="font-weight:700;font-size:14px;flex:1;text-align:right;">${m.player1Name}</span>
                ${done ? `<span style="color:var(--neon);font-size:20px;font-weight:900;">${m.score1} : ${m.score2}</span>` : `<span style="color:var(--muted);font-size:13px;">VS</span>`}
                <span style="font-weight:700;font-size:14px;flex:1;text-align:left;">${m.player2Name}</span>
            </div>
            <div style="text-align:center;margin-top:8px;">
                <button onclick="openResultEntry('${m.id}','${m.player1Id}','${m.player2Id}','${m.player1Name}','${m.player2Name}','${stage}',${m.score1 ?? 0},${m.score2 ?? 0})"
                    style="background:${done ? 'var(--bg-glass)' : 'var(--neon)'};color:${done ? 'var(--muted)' : '#000'};border:${done ? '1px solid var(--border)' : 'none'};border-radius:10px;padding:7px 18px;font-weight:700;font-family:'Cairo',sans-serif;cursor:pointer;font-size:13px;">
                    <i class="fas fa-${done ? 'pen' : 'plus'}"></i> ${done ? 'تعديل' : 'إدخال النتيجة'}
                </button>
            </div>
        </div>`;
    }).join('');
}

window.openResultEntry = (matchId, p1Id, p2Id, p1Name, p2Name, stage, s1, s2) => {
    document.getElementById('result-match-id').value = matchId;
    document.getElementById('result-p1-id').value = p1Id;
    document.getElementById('result-p2-id').value = p2Id;
    document.getElementById('result-stage').value = stage;
    document.getElementById('result-p1-label').innerText = p1Name;
    document.getElementById('result-p2-label').innerText = p2Name;
    document.getElementById('result-match-label').innerText = `${p1Name} ضد ${p2Name}`;
    document.getElementById('result-score1').value = s1 || 0;
    document.getElementById('result-score2').value = s2 || 0;
    document.getElementById('result-entry-modal').classList.remove('hidden');
};

// ========================
// TOURNAMENT SELECTOR HELPER
// ========================
async function buildTourSelector(containerId, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    const tours = await DB.getTournaments();
    const active = tours.filter(t => t.status === 'active');
    if (!active.length) { container.innerHTML = ''; return null; }
    if (active.length === 1) { container.innerHTML = ''; return active[0].id; }
    container.innerHTML = `<div class="form-group"><select id="tour-select-${containerId}" style="margin-bottom:0;">${active.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}</select></div>`;
    const sel = document.getElementById(`tour-select-${containerId}`);
    sel.onchange = () => onSelect(sel.value);
    return active[0].id;
}

// ========================
// GROUPS
// ========================
async function initGroups() {
    const container = document.getElementById('groups-container');
    let tid = await buildTourSelector('tour-selector-groups', (id) => renderGroups(id, container));
    if (tid) await renderGroups(tid, container);
    else container.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i><p>لا توجد بطولات جارية</p></div>';
}

async function renderGroups(tid, container) {
    UI.showLoader();
    try {
        const groups = await DB.getGroups(tid);
        const all = await DB.getApproved(tid);
        const map = {}; all.forEach(p => map[p.id] = p);
        if (!groups.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-users-slash"></i><p>لم يتم إجراء القرعة بعد</p></div>';
            return;
        }
        container.innerHTML = groups.map(g => {
            const gp = g.players.map(id => map[id]).filter(Boolean).sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
            });
            return `
            <div class="card glow">
                <h3 style="color:var(--neon-blue);margin-bottom:12px;font-size:16px;">${g.name}</h3>
                <table class="group-table">
                    <thead><tr><th style="text-align:right;">اللاعب</th><th>ف+</th><th>ف-</th><th>فارق</th><th style="color:var(--neon);">نقاط</th></tr></thead>
                    <tbody>
                    ${gp.map((p, i) => `
                        <tr>
                            <td style="text-align:right;"><div style="display:flex;align-items:center;gap:8px;">${i === 0 ? '🥇' : i === 1 ? '🥈' : ''}
                                <img src="${p.avatarUrl}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;"><span>${p.gameName}</span></div></td>
                            <td style="color:var(--neon);">${p.goalsFor || 0}</td>
                            <td style="color:var(--danger);">${p.goalsAgainst || 0}</td>
                            <td>${(p.goalsFor || 0) - (p.goalsAgainst || 0)}</td>
                            <td style="font-weight:900;color:var(--neon);font-size:16px;">${p.points || 0}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        }).join('');
    } catch (e) { console.error(e); UI.toast('خطأ', 'error'); }
    finally { UI.hideLoader(); }
}

// ========================
// MATCHES
// ========================
async function initMatches() {
    const container = document.getElementById('matches-container');
    let tid = await buildTourSelector('tour-selector-matches', (id) => renderMatches(id, 'groups', container));
    if (tid) await renderMatches(tid, 'groups', container);
    else { container.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i><p>لا توجد بطولات جارية</p></div>'; return; }

    document.getElementById('tab-groups').onclick = async function () {
        this.className = 'btn btn-primary'; this.style.cssText = 'flex:1;margin:0;padding:10px;';
        const t = document.getElementById('tab-knockout'); t.className = 'btn btn-outline'; t.style.cssText = 'flex:1;margin:0;padding:10px;border-color:var(--muted);color:var(--muted);';
        const selEl = document.getElementById(`tour-select-tour-selector-matches`);
        const useTid = selEl ? selEl.value : tid;
        UI.showLoader(); await renderMatches(useTid, 'groups', container); UI.hideLoader();
    };
    document.getElementById('tab-knockout').onclick = async function () {
        this.className = 'btn btn-blue'; this.style.cssText = 'flex:1;margin:0;padding:10px;';
        const t = document.getElementById('tab-groups'); t.className = 'btn btn-outline'; t.style.cssText = 'flex:1;margin:0;padding:10px;border-color:var(--muted);color:var(--muted);';
        const selEl = document.getElementById(`tour-select-tour-selector-matches`);
        const useTid = selEl ? selEl.value : tid;
        UI.showLoader(); await renderMatches(useTid, 'knockout', container); UI.hideLoader();
    };
}

async function renderMatches(tid, stage, container) {
    const matches = await DB.getMatchesByStage(tid, stage);
    if (!matches.length) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-futbol"></i><p>لا توجد مباريات حالياً</p></div>';
        return;
    }
    container.innerHTML = matches.map(m => {
        const done = m.status === 'approved';
        return `
        <div class="match-card">
            <div style="text-align:center;font-size:12px;color:${done ? 'var(--neon)' : 'var(--muted)'};margin-bottom:10px;font-weight:600;">
                ${m.group || ''} · ${done ? 'اكتملت' : 'قيد الانتظار'}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <span style="text-align:right;flex:1;font-weight:700;font-size:15px;">${m.player1Name}</span>
                <span class="match-score" style="color:${done ? 'var(--neon)' : 'var(--muted)'};">${done ? `${m.score1} : ${m.score2}` : '- : -'}</span>
                <span style="text-align:left;flex:1;font-weight:700;font-size:15px;">${m.player2Name}</span>
            </div>
        </div>`;
    }).join('');
}

// ========================
// BRACKET
// ========================
async function initBracket() {
    const container = document.getElementById('bracket-container');
    let tid = await buildTourSelector('tour-selector-bracket', (id) => renderBracket(id, container));
    if (tid) await renderBracket(tid, container);
    else container.innerHTML = '<div class="empty-state"><i class="fas fa-sitemap"></i><p>لا توجد بطولات جارية</p></div>';
}

async function renderBracket(tid, container) {
    UI.showLoader();
    try {
        const matches = await DB.getMatchesByStage(tid, 'knockout');
        if (!matches.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-sitemap"></i><p>لم تبدأ الأدوار الإقصائية بعد</p></div>'; return; }
        container.innerHTML = matches.map(m => {
            const w1 = m.status === 'approved' && m.score1 > m.score2;
            const w2 = m.status === 'approved' && m.score2 > m.score1;
            return `
            <div class="bracket-match">
                <div class="player-row${w1 ? ' win' : ''}"><span class="name">${m.player1Name}</span><span class="score" style="color:${w1 ? 'var(--neon)' : 'var(--muted)'};">${m.score1 !== null ? m.score1 : '-'}</span></div>
                <div class="player-row${w2 ? ' win' : ''}"><span class="name">${m.player2Name}</span><span class="score" style="color:${w2 ? 'var(--neon)' : 'var(--muted)'};">${m.score2 !== null ? m.score2 : '-'}</span></div>
            </div>`;
        }).join('');
    } catch (e) { UI.toast('خطأ', 'error'); }
    finally { UI.hideLoader(); }
}
