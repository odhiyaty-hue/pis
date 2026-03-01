import { db, UI, navigate } from './app.js';
import {
    collection, addDoc, getDocs, doc, updateDoc,
    query, where, orderBy, getDoc
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const IMGBB_KEY = "9bb81c4b08af039ce7c30f5b05deb2ea";

// ---- IMGBB UPLOAD ----
async function uploadImage(file) {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: fd });
    const data = await res.json();
    if (data.success) return data.data.url;
    throw new Error('فشل رفع الصورة');
}

// ---- DB HELPERS ----
const playersColl = collection(db, 'players');
const groupsColl = collection(db, 'groups');
const matchesColl = collection(db, 'matches');

const DB = {
    addPlayer: (d) => addDoc(playersColl, { ...d, status: 'pending', group: null, points: 0, goalsFor: 0, goalsAgainst: 0, eliminated: false, createdAt: new Date() }),
    async checkName(name) {
        const snap = await getDocs(query(playersColl, where('gameName', '==', name)));
        return !snap.empty;
    },
    getAllPlayers: () => getDocs(query(playersColl, orderBy('createdAt', 'desc'))).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
    getApproved: () => getDocs(query(playersColl, where('status', '==', 'approved'))).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
    setStatus: (id, status) => updateDoc(doc(db, 'players', id), { status }),
    async addStats(id, pts, gf, ga) {
        const ref = doc(db, 'players', id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const d = snap.data();
            await updateDoc(ref, { points: (d.points || 0) + pts, goalsFor: (d.goalsFor || 0) + gf, goalsAgainst: (d.goalsAgainst || 0) + ga });
        }
    },
    createGroup: (name, players) => addDoc(groupsColl, { name, players: players.map(p => p.id), createdAt: new Date() }),
    assignGroup: (id, group) => updateDoc(doc(db, 'players', id), { group }),
    getGroups: () => getDocs(groupsColl).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
    createMatch: (d) => addDoc(matchesColl, { ...d, score1: null, score2: null, winnerId: null, screenshotUrl: null, status: 'pending_result', stage: d.stage || 'groups', createdAt: new Date() }),
    getMatchesByStage: (stage) => getDocs(query(matchesColl, where('stage', '==', stage))).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
    updateMatch: (id, data) => updateDoc(doc(db, 'matches', id), data)
};

// ---- PAGE ROUTER ----
document.addEventListener('pageLoaded', e => {
    const m = { register: initRegister, login: initLogin, admin: initAdmin, groups: initGroups, matches: initMatches, bracket: initBracket };
    m[e.detail.page]?.();
});

// ========================
// REGISTER
// ========================
function initRegister() {
    const form = document.getElementById('register-form');
    const fileInput = document.getElementById('avatar-file');
    const preview = document.getElementById('avatar-preview');

    fileInput.onchange = () => {
        const f = fileInput.files[0];
        if (f) { preview.src = URL.createObjectURL(f); preview.classList.remove('hidden'); }
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const realName = document.getElementById('real-name').value.trim();
        const gameName = document.getElementById('game-name').value.trim();
        const file = fileInput.files[0];
        if (!realName || !gameName) return UI.toast('الرجاء ملء جميع الحقول', 'error');
        if (!file) return UI.toast('الرجاء اختيار صورة', 'error');
        UI.showLoader();
        try {
            if (await DB.checkName(gameName)) { UI.toast('اسم الحساب مسجل مسبقاً!', 'error'); return; }
            const avatarUrl = await uploadImage(file);
            await DB.addPlayer({ realName, gameName, avatarUrl });
            UI.toast('تم إرسال طلب التسجيل بنجاح!');
            form.reset(); preview.classList.add('hidden');
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
async function initAdmin() {
    const pList = document.getElementById('admin-pending-players');
    const mList = document.getElementById('admin-pending-matches');
    if (!pList) return;

    UI.showLoader();
    try {
        const all = await DB.getAllPlayers();
        const pending = all.filter(p => p.status === 'pending');
        document.getElementById('pending-count').innerText = pending.length || '';

        pList.innerHTML = pending.length === 0
            ? '<div class="empty-state"><i class="fas fa-check-circle"></i><p>لا توجد طلبات جديدة</p></div>'
            : pending.map(p => `
            <div class="card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:12px;">
                <div style="display:flex;gap:10px;align-items:center;">
                    <img src="${p.avatarUrl}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid var(--border);">
                    <div>
                        <strong style="font-size:15px;">${p.gameName}</strong><br>
                        <small style="color:var(--muted);">${p.realName}</small>
                    </div>
                </div>
                <button onclick="approvePlayer('${p.id}')" style="background:var(--neon);color:#000;border:none;border-radius:10px;padding:8px 14px;font-weight:700;font-family:'Cairo',sans-serif;cursor:pointer;">قبول</button>
            </div>`).join('');

        const g = await DB.getMatchesByStage('groups');
        const k = await DB.getMatchesByStage('knockout');
        const toApprove = [...g, ...k].filter(m => m.status === 'pending_approval');
        document.getElementById('matches-count').innerText = toApprove.length || '';

        mList.innerHTML = toApprove.length === 0
            ? '<div class="empty-state"><i class="fas fa-check-circle"></i><p>لا توجد نتائج جديدة</p></div>'
            : toApprove.map(m => `
            <div class="card" style="margin-bottom:8px;">
                <div style="font-size:12px;color:var(--muted);text-align:center;margin-bottom:8px;">${m.group}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <span style="font-weight:700;">${m.player1Name}</span>
                    <span style="font-size:22px;font-weight:900;color:var(--neon);">${m.score1} : ${m.score2}</span>
                    <span style="font-weight:700;">${m.player2Name}</span>
                </div>
                <button onclick="viewProof('${m.id}','${m.screenshotUrl}','${m.player1Id}','${m.player2Id}',${m.score1},${m.score2},'${m.stage}')" style="background:var(--neon-blue);color:#000;border:none;border-radius:10px;width:100%;padding:9px;font-weight:700;font-family:'Cairo',sans-serif;cursor:pointer;">
                    <i class="fas fa-eye"></i> عرض الاعتماد
                </button>
            </div>`).join('');

    } catch (e) { console.error(e); UI.toast('خطأ في تحميل البيانات', 'error'); }
    finally { UI.hideLoader(); }

    // Generate Groups
    document.getElementById('btn-generate-groups').onclick = async () => {
        if (!confirm('هل أنت متأكد من إنشاء المجموعات؟')) return;
        UI.showLoader();
        try {
            const players = await DB.getApproved();
            if (players.length < 4) throw new Error('يجب الموافقة على 4 لاعبين على الأقل');
            const shuffled = players.sort(() => Math.random() - 0.5);
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            let gi = 0;
            for (let i = 0; i < shuffled.length; i += 4) {
                const chunk = shuffled.slice(i, i + 4);
                const gName = 'المجموعة ' + letters[gi++];
                await DB.createGroup(gName, chunk);
                for (const p of chunk) await DB.assignGroup(p.id, gName);
                for (let a = 0; a < chunk.length; a++)
                    for (let b = a + 1; b < chunk.length; b++)
                        await DB.createMatch({ group: gName, player1Id: chunk[a].id, player2Id: chunk[b].id, player1Name: chunk[a].gameName, player2Name: chunk[b].gameName });
            }
            UI.toast('تم إنشاء المجموعات والمباريات بنجاح');
            initAdmin();
        } catch (e) { UI.toast(e.message, 'error'); }
        finally { UI.hideLoader(); }
    };

    // Generate Knockout
    document.getElementById('btn-generate-knockout').onclick = async () => {
        if (!confirm('إنشاء شجرة الإقصاء؟')) return;
        UI.showLoader();
        try {
            const groups = await DB.getGroups();
            const all = await DB.getApproved();
            const map = {}; all.forEach(p => map[p.id] = p);
            let qualified = [];
            groups.forEach(g => {
                const gp = g.players.map(id => map[id]).filter(Boolean).sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
                });
                if (gp[0]) qualified.push(gp[0]);
                if (gp[1]) qualified.push(gp[1]);
            });
            qualified = qualified.sort(() => Math.random() - 0.5);
            for (let i = 0; i < qualified.length; i += 2)
                if (qualified[i] && qualified[i + 1])
                    await DB.createMatch({ stage: 'knockout', player1Id: qualified[i].id, player2Id: qualified[i + 1].id, player1Name: qualified[i].gameName, player2Name: qualified[i + 1].gameName, group: 'الإقصاء' });
            UI.toast('تم إنشاء مباريات الإقصاء');
        } catch (e) { UI.toast(e.message, 'error'); }
        finally { UI.hideLoader(); }
    };

    // Logout
    document.getElementById('btn-logout').onclick = () => {
        localStorage.removeItem('isAdmin');
        document.getElementById('nav-admin')?.classList.add('hidden');
        navigate('/');
    };
}

window.approvePlayer = async (id) => {
    UI.showLoader();
    try { await DB.setStatus(id, 'approved'); UI.toast('تمت الموافقة على اللاعب'); initAdmin(); }
    catch (e) { UI.toast('خطأ', 'error'); }
    finally { UI.hideLoader(); }
};

window.viewProof = (matchId, imgUrl, p1Id, p2Id, s1, s2, stage) => {
    const modal = document.getElementById('admin-match-modal');
    document.getElementById('admin-proof-img').src = imgUrl;
    modal.classList.remove('hidden');

    document.getElementById('btn-approve-match').onclick = async () => {
        UI.showLoader();
        try {
            await DB.updateMatch(matchId, { status: 'approved' });
            if (stage === 'groups') {
                let p1pts = 0, p2pts = 0;
                if (s1 > s2) p1pts = 3; else if (s2 > s1) p2pts = 3; else { p1pts = 1; p2pts = 1; }
                await DB.addStats(p1Id, p1pts, s1, s2);
                await DB.addStats(p2Id, p2pts, s2, s1);
            }
            UI.toast('تم اعتماد النتيجة وتحديث النقاط!');
            modal.classList.add('hidden'); initAdmin();
        } catch (e) { UI.toast('خطأ', 'error'); }
        finally { UI.hideLoader(); }
    };

    document.getElementById('btn-reject-match').onclick = async () => {
        UI.showLoader();
        try { await DB.updateMatch(matchId, { status: 'pending_result', screenshotUrl: null, score1: null, score2: null }); UI.toast('تم رفض النتيجة'); modal.classList.add('hidden'); initAdmin(); }
        catch (e) { UI.toast('خطأ', 'error'); }
        finally { UI.hideLoader(); }
    };

    document.getElementById('btn-close-admin-modal').onclick = () => modal.classList.add('hidden');
};

// ========================
// GROUPS
// ========================
async function initGroups() {
    const container = document.getElementById('groups-container');
    UI.showLoader();
    try {
        const groups = await DB.getGroups();
        const all = await DB.getApproved();
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
                    <thead><tr>
                        <th style="text-align:right;">اللاعب</th>
                        <th>ف+</th><th>ف-</th><th>فارق</th>
                        <th style="color:var(--neon);">نقاط</th>
                    </tr></thead>
                    <tbody>
                    ${gp.map((p, i) => `
                        <tr>
                            <td style="text-align:right;">
                                <div style="display:flex;align-items:center;gap:8px;">
                                    ${i === 0 ? '<span style="color:gold;font-size:11px;">🥇</span>' : i === 1 ? '<span style="font-size:11px;">🥈</span>' : ''}
                                    <img src="${p.avatarUrl}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;">
                                    <span>${p.gameName}</span>
                                </div>
                            </td>
                            <td style="color:var(--neon);">${p.goalsFor || 0}</td>
                            <td style="color:var(--danger);">${p.goalsAgainst || 0}</td>
                            <td>${(p.goalsFor || 0) - (p.goalsAgainst || 0)}</td>
                            <td style="font-weight:900;color:var(--neon);font-size:16px;">${p.points || 0}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        }).join('');
    } catch (e) { console.error(e); UI.toast('خطأ في تحميل المجموعات', 'error'); }
    finally { UI.hideLoader(); }
}

// ========================
// MATCHES
// ========================
async function initMatches() {
    const container = document.getElementById('matches-container');

    const renderList = (list) => {
        if (!list.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-futbol"></i><p>لا توجد مباريات حالياً</p></div>';
            return;
        }
        container.innerHTML = list.map(m => {
            const sColor = m.status === 'approved' ? 'var(--neon)' : m.status === 'pending_approval' ? '#ffc800' : 'var(--muted)';
            const sText = m.status === 'approved' ? 'اكتملت' : m.status === 'pending_approval' ? 'قيد المراجعة' : 'لم تلعب';
            return `
            <div class="match-card">
                <div style="text-align:center;font-size:12px;color:${sColor};margin-bottom:10px;font-weight:600;">${m.group} · ${sText}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                    <span style="text-align:right;flex:1;font-weight:700;font-size:15px;">${m.player1Name}</span>
                    <span class="match-score">${m.score1 !== null ? m.score1 : '-'} : ${m.score2 !== null ? m.score2 : '-'}</span>
                    <span style="text-align:left;flex:1;font-weight:700;font-size:15px;">${m.player2Name}</span>
                </div>
                ${m.status === 'pending_result' ? `<button onclick="openResultModal('${m.id}','${m.player1Name}','${m.player2Name}')" style="margin-top:12px;background:transparent;border:1px solid var(--neon-blue);color:var(--neon-blue);width:100%;padding:9px;border-radius:10px;font-weight:700;font-family:'Cairo',sans-serif;cursor:pointer;"><i class='fas fa-upload'></i> رفع النتيجة</button>` : ''}
            </div>`;
        }).join('');
    };

    UI.showLoader();
    try {
        const matches = await DB.getMatchesByStage('groups');
        renderList(matches);

        document.getElementById('tab-groups').onclick = async function () {
            this.className = 'btn btn-primary'; this.style.margin = '0'; this.style.flex = '1'; this.style.padding = '10px';
            const t = document.getElementById('tab-knockout');
            t.className = 'btn btn-outline'; t.style.margin = '0'; t.style.flex = '1'; t.style.padding = '10px'; t.style.borderColor = 'var(--muted)'; t.style.color = 'var(--muted)';
            UI.showLoader();
            renderList(await DB.getMatchesByStage('groups'));
            UI.hideLoader();
        };

        document.getElementById('tab-knockout').onclick = async function () {
            this.className = 'btn btn-blue'; this.style.margin = '0'; this.style.flex = '1'; this.style.padding = '10px';
            const t = document.getElementById('tab-groups');
            t.className = 'btn btn-outline'; t.style.margin = '0'; t.style.flex = '1'; t.style.padding = '10px'; t.style.borderColor = 'var(--muted)'; t.style.color = 'var(--muted)';
            UI.showLoader();
            renderList(await DB.getMatchesByStage('knockout'));
            UI.hideLoader();
        };

        // Modal
        window.openResultModal = (id, p1, p2) => {
            document.getElementById('modal-match-id').value = id;
            document.getElementById('modal-p1-label').innerText = `${p1} (أهداف)`;
            document.getElementById('modal-p2-label').innerText = `${p2} (أهداف)`;
            document.getElementById('result-modal').classList.remove('hidden');
        };

        document.getElementById('btn-close-modal').onclick = () => document.getElementById('result-modal').classList.add('hidden');

        document.getElementById('btn-submit-result').onclick = async () => {
            const id = document.getElementById('modal-match-id').value;
            const s1 = parseInt(document.getElementById('modal-score1').value);
            const s2 = parseInt(document.getElementById('modal-score2').value);
            const file = document.getElementById('modal-screenshot').files[0];
            if (isNaN(s1) || isNaN(s2) || !file) return UI.toast('أدخل النتيجة واختر صورة', 'error');
            UI.showLoader();
            try {
                const screenshotUrl = await uploadImage(file);
                await DB.updateMatch(id, { score1: s1, score2: s2, screenshotUrl, status: 'pending_approval' });
                UI.toast('تم رفع النتيجة بنجاح وبانتظار الموافقة');
                document.getElementById('result-modal').classList.add('hidden');
                initMatches();
            } catch (e) { UI.toast(e.message, 'error'); }
            finally { UI.hideLoader(); }
        };
    } catch (e) { UI.toast('خطأ في تحميل المباريات', 'error'); }
    finally { UI.hideLoader(); }
}

// ========================
// BRACKET
// ========================
async function initBracket() {
    const container = document.getElementById('bracket-container');
    UI.showLoader();
    try {
        const matches = await DB.getMatchesByStage('knockout');
        if (!matches.length) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-sitemap"></i><p>لم تبدأ الأدوار الإقصائية بعد</p></div>';
            return;
        }
        container.innerHTML = matches.map(m => {
            const w1 = m.status === 'approved' && m.score1 > m.score2;
            const w2 = m.status === 'approved' && m.score2 > m.score1;
            return `
            <div class="bracket-match">
                <div class="player-row${w1 ? ' win' : ''}">
                    <span class="name">${m.player1Name}</span>
                    <span class="score" style="color:${w1 ? 'var(--neon)' : 'var(--muted)'};">${m.score1 !== null ? m.score1 : '-'}</span>
                </div>
                <div class="player-row${w2 ? ' win' : ''}">
                    <span class="name">${m.player2Name}</span>
                    <span class="score" style="color:${w2 ? 'var(--neon)' : 'var(--muted)'};">${m.score2 !== null ? m.score2 : '-'}</span>
                </div>
            </div>`;
        }).join('');
    } catch (e) { UI.toast('خطأ', 'error'); }
    finally { UI.hideLoader(); }
}
