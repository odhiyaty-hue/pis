import { DB } from './db.js';
import { UI } from './ui.js';

// ---- CONFIGURATION ----
// User provided ImgBB API Key
const IMGBB_API_KEY = "9bb81c4b08af039ce7c30f5b05deb2ea";

// Generic function to upload to ImgBB
async function uploadToImgBB(file) {
    const formData = new FormData();
    formData.append('image', file);
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            return data.data.url;
        } else {
            throw new Error(data.error.message || "Upload failed");
        }
    } catch (e) {
        console.error("ImgBB Upload Error:", e);
        // Fallback for demonstration if API key is invalid
        return "https://i.ibb.co/dummy/default.png";
    }
}

// Router Event Listener
document.addEventListener('pageLoaded', (e) => {
    const page = e.detail.page;
    if (page === 'register') initRegister();
    if (page === 'login') initLogin();
    if (page === 'admin') initAdmin();
    if (page === 'groups') initGroups();
    if (page === 'matches') initMatches();
    if (page === 'bracket') initBracket();
});

// ---- REGISTER LOGIC ----
function initRegister() {
    const form = document.getElementById('register-form');
    const avatarInput = document.getElementById('avatar-file');
    const avatarPreview = document.getElementById('avatar-preview');

    avatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            avatarPreview.src = URL.createObjectURL(file);
            avatarPreview.classList.remove('hidden');
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        UI.showLoader();
        try {
            const realName = document.getElementById('real-name').value.trim();
            const gameName = document.getElementById('game-name').value.trim();
            const file = avatarInput.files[0];

            if (!file) throw new Error("الرجاء اختيار صورة");

            // Check if game name exists
            const exists = await DB.checkGameNameExists(gameName);
            if (exists) {
                UI.showToast("اسم الحساب داخل اللعبة مسجل مسبقاً!", "error");
                UI.hideLoader();
                return;
            }

            // Upload to ImgBB
            const avatarUrl = await uploadToImgBB(file);

            // Save to Firestore
            await DB.addPlayer({ realName, gameName, avatarUrl });

            UI.showToast("تم إرسال طلب التسجيل بنجاح!");
            form.reset();
            avatarPreview.classList.add('hidden');
            window.navigate('/');
        } catch (error) {
            UI.showToast(error.message, "error");
        } finally {
            UI.hideLoader();
        }
    });
}

// ---- LOGIN LOGIC ----
function initLogin() {
    const form = document.getElementById('login-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('admin-user').value;
        const pass = document.getElementById('admin-pass').value;

        // Static Credentials as per requirements
        if (user === 'admin' && pass === '123456') {
            localStorage.setItem('isAdmin', 'true');
            document.getElementById('nav-admin').classList.remove('hidden');
            UI.showToast("تم تسجيل الدخول بنجاح");
            window.navigate('/admin');
        } else {
            UI.showToast("بيانات الدخول غير صحيحة", "error");
        }
    });
}

// ---- ADMIN LOGIC ----
async function initAdmin() {
    // Render pending players
    const playersList = document.getElementById('admin-pending-players');
    const matchesList = document.getElementById('admin-pending-matches');
    if (!playersList) return;

    UI.showLoader();
    try {
        const allPlayers = await DB.getAllPlayers();
        const pendingPlayers = allPlayers.filter(p => p.status === 'pending');

        document.getElementById('pending-count').innerText = pendingPlayers.length;

        if (pendingPlayers.length === 0) {
            playersList.innerHTML = "<p class='text-center'>لا توجد طلبات جديدة</p>";
        } else {
            playersList.innerHTML = pendingPlayers.map(p => `
                <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; gap:10px; align-items:center;">
                        <img src="${p.avatarUrl}" style="width:40px; height:40px; border-radius:50%;">
                        <div>
                            <strong>${p.gameName}</strong><br>
                            <small>${p.realName}</small>
                        </div>
                    </div>
                    <button class="btn btn-primary" style="padding:5px 10px; width:auto; margin:0;" onclick="approvePlayer('${p.id}')">قبول</button>
                </div>
            `).join('');
        }

        // Render matches awaiting approval
        const allPendingMatches = await DB.getMatchesByStage('groups'); // groups
        const knockoutMatches = await DB.getMatchesByStage('knockout'); // knockout
        const matchesToApprove = [...allPendingMatches, ...knockoutMatches].filter(m => m.status === 'pending_approval');

        document.getElementById('matches-count').innerText = matchesToApprove.length;
        if (matchesToApprove.length === 0) {
            matchesList.innerHTML = "<p class='text-center'>لا توجد نتائج جديدة للمراجعة</p>";
        } else {
            matchesList.innerHTML = matchesToApprove.map(m => `
                <div class="card neon-border">
                    <div style="font-size:12px; color:var(--text-muted); text-align:center; margin-bottom:5px;">${m.group}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${m.player1Name}</strong>
                        <strong style="color:var(--neon-green)">${m.score1} : ${m.score2}</strong>
                        <strong>${m.player2Name}</strong>
                    </div>
                    <button class="btn btn-secondary mt-1" style="font-size:14px; padding:8px;" onclick="viewMatchProof('${m.id}', '${m.screenshotUrl}', '${m.player1Id}', '${m.player2Id}', ${m.score1}, ${m.score2}, '${m.stage}')">عرض الاعتماد</button>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error(e);
        UI.showToast("خطأ في تحميل البيانات", "error");
    } finally {
        UI.hideLoader();
    }

    // Attach generate groups event
    document.getElementById('btn-generate-groups').addEventListener('click', async () => {
        if (!confirm("هل أنت متأكد من إنشاء المجموعات؟ سيتم إعادة توزيع اللاعبين!")) return;
        UI.showLoader();
        try {
            const players = await DB.getApprovedPlayers();
            if (players.length < 4) throw new Error("يجب الموافقة على 4 لاعبين على الأقل");

            // Shuffle
            const shuffled = players.sort(() => 0.5 - Math.random());
            // Divide into groups of 4
            let groupIndex = 0;
            const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

            for (let i = 0; i < shuffled.length; i += 4) {
                const chunk = shuffled.slice(i, i + 4);
                const gName = "المجموعة " + letters[groupIndex];
                await DB.createGroup(gName, chunk);

                // assign players to group
                for (const p of chunk) {
                    await DB.assignPlayerToGroup(p.id, gName);
                }

                // Generate Round Robin matches for this group
                // combinations: 0-1, 0-2, 0-3, 1-2, 1-3, 2-3
                for (let a = 0; a < chunk.length; a++) {
                    for (let b = a + 1; b < chunk.length; b++) {
                        await DB.createMatch({
                            group: gName,
                            player1Id: chunk[a].id,
                            player2Id: chunk[b].id,
                            player1Name: chunk[a].gameName,
                            player2Name: chunk[b].gameName
                        });
                    }
                }
                groupIndex++;
            }
            UI.showToast("تم إنشاء المجموعات والمباريات بنجاح");
        } catch (e) {
            UI.showToast(e.message, "error");
        } finally {
            UI.hideLoader();
        }
    });
}

window.approvePlayer = async (id) => {
    UI.showLoader();
    try {
        await DB.updatePlayerStatus(id, 'approved');
        UI.showToast("تمت الموافقة على اللاعب");
        initAdmin(); // Refresh
    } catch (e) {
        UI.showToast("خطأ", "error");
    } finally {
        UI.hideLoader();
    }
};

window.viewMatchProof = (matchId, imgUrl, p1Id, p2Id, s1, s2, stage) => {
    document.getElementById('admin-proof-img').src = imgUrl;
    const modal = document.getElementById('admin-match-modal');
    modal.classList.remove('hidden');

    document.getElementById('btn-approve-match').onclick = async () => {
        UI.showLoader();
        try {
            await DB.updateMatchResult(matchId, { status: 'approved' });

            // Only update points for Group Stage matches!
            if (stage === 'groups') {
                let p1Pts = 0, p2Pts = 0;
                if (s1 > s2) { p1Pts = 3; }
                else if (s2 > s1) { p2Pts = 3; }
                else { p1Pts = 1; p2Pts = 1; }

                await DB.updatePlayerStats(p1Id, p1Pts, s1, s2);
                await DB.updatePlayerStats(p2Id, p2Pts, s2, s1);
            }

            UI.showToast("تم اعتماد النتيجة وتحديث النقاط!");
            modal.classList.add('hidden');
            initAdmin();
        } catch (e) { UI.showToast("خطأ", "error"); }
        finally { UI.hideLoader(); }
    };

    document.getElementById('btn-reject-match').onclick = async () => {
        UI.showLoader();
        try {
            await DB.updateMatchResult(matchId, { status: 'pending_result', screenshotUrl: null, score1: null, score2: null });
            UI.showToast("تم رفض النتيجة");
            modal.classList.add('hidden');
            initAdmin();
        } catch (e) { UI.showToast("خطأ", "error"); }
        finally { UI.hideLoader(); }
    };

    document.getElementById('btn-close-admin-modal').onclick = () => modal.classList.add('hidden');
};

// ---- GROUPS LOGIC ----
async function initGroups() {
    const container = document.getElementById('groups-container');
    UI.showLoader();
    try {
        const groups = await DB.getGroups();
        const players = await DB.getApprovedPlayers();
        const playersMap = {};
        players.forEach(p => playersMap[p.id] = p);

        if (groups.length === 0) {
            container.innerHTML = "<p class='text-center'>لم يتم إجراء القرعة بعد.</p>";
            return;
        }

        let html = '';
        groups.forEach(g => {
            // Get players for this group
            let groupPlayers = g.players.map(pid => playersMap[pid]).filter(p => p);

            // Sort by Points > GD (GF-GA) > GF
            groupPlayers.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                const gdB = b.goalsFor - b.goalsAgainst;
                const gdA = a.goalsFor - a.goalsAgainst;
                if (gdB !== gdA) return gdB - gdA;
                return b.goalsFor - a.goalsFor;
            });

            html += `
                <div class="card">
                    <h3 style="color:var(--neon-blue); margin-bottom:10px;">${g.name}</h3>
                    <table style="width:100%; text-align:center; border-collapse:collapse; font-size:14px;">
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.1); color:var(--text-muted)">
                            <th style="text-align:right; padding:5px;">اللاعب</th>
                            <th>لعب</th>
                            <th>فارق</th>
                            <th>نقاط</th>
                        </tr>
                        ${groupPlayers.map(p => `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
                                <td style="text-align:right; padding:8px 0;">
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <img src="${p.avatarUrl}" style="width:24px; height:24px; border-radius:50%">
                                        <span>${p.gameName}</span>
                                    </div>
                                </td>
                                <td>${(p.goalsFor || 0) + (p.goalsAgainst || 0) > 0 ? '?' : '0'}</td>
                                <td>${(p.goalsFor || 0) - (p.goalsAgainst || 0)}</td>
                                <td style="font-weight:bold; color:var(--neon-green)">${p.points || 0}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) {
        console.error(e);
        UI.showToast("خطأ في تحميل المجموعات", "error");
    } finally {
        UI.hideLoader();
    }
}

// ---- MATCHES LOGIC ----
async function initMatches() {
    const container = document.getElementById('matches-container');
    UI.showLoader();
    try {
        const matches = await DB.getMatchesByStage('groups');
        const renderMatchesList = (list) => {
            if (list.length === 0) {
                container.innerHTML = "<p class='text-center'>لا توجد مباريات حالياً.</p>";
                return;
            }

            let html = '';
            list.forEach(m => {
                const statusColor = m.status === 'approved' ? 'var(--neon-green)' : (m.status === 'pending_approval' ? 'yellow' : 'var(--text-muted)');
                const statusText = m.status === 'approved' ? 'اكتملت' : (m.status === 'pending_approval' ? 'مراجعة' : 'لم تلعب');

                html += `
                    <div class="card neon-border">
                        <div style="text-align:center; font-size:12px; color:var(--neon-blue); margin-bottom:10px;">${m.group} - <span style="color:${statusColor}">${statusText}</span></div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="text-align:center; flex:1">
                                <strong style="font-size:16px">${m.player1Name}</strong>
                            </div>
                            <div style="font-size:24px; font-weight:800; padding:0 20px;">
                                ${m.score1 !== null ? m.score1 : '-'} : ${m.score2 !== null ? m.score2 : '-'}
                            </div>
                            <div style="text-align:center; flex:1">
                                <strong style="font-size:16px">${m.player2Name}</strong>
                            </div>
                        </div>
                        ${m.status === 'pending_result' ? `<button class="btn btn-secondary mt-1" style="font-size:14px; padding:8px;" onclick="openResultModal('${m.id}', '${m.player1Name}', '${m.player2Name}')">رفع النتيجة</button>` : ''}
                    </div>
                `;
            });
            container.innerHTML = html;
        };

        renderMatchesList(matches);

        // Tab logic
        document.getElementById('tab-groups').onclick = async function () {
            this.className = "btn btn-primary";
            document.getElementById('tab-knockout').className = "btn btn-secondary";
            UI.showLoader();
            const grpMatches = await DB.getMatchesByStage('groups');
            renderMatchesList(grpMatches);
            UI.hideLoader();
        }
        document.getElementById('tab-knockout').onclick = async function () {
            this.className = "btn btn-primary";
            document.getElementById('tab-groups').className = "btn btn-secondary";
            UI.showLoader();
            const koMatches = await DB.getMatchesByStage('knockout');
            renderMatchesList(koMatches);
            UI.hideLoader();
        }

        if (matches.length === 0) {
            container.innerHTML = "<p class='text-center'>لا توجد مباريات حالياً.</p>";
            return;
        }

        let html = '';
        matches.forEach(m => {
            const statusColor = m.status === 'approved' ? 'var(--neon-green)' : (m.status === 'pending_approval' ? 'yellow' : 'var(--text-muted)');
            const statusText = m.status === 'approved' ? 'اكتملت' : (m.status === 'pending_approval' ? 'قيد المراجعة' : 'لم تلعب بعد');

            html += `
                <div class="card neon-border">
                    <div style="text-align:center; font-size:12px; color:var(--neon-blue); margin-bottom:10px;">${m.group} - <span style="color:${statusColor}">${statusText}</span></div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="text-align:center; flex:1">
                            <strong style="font-size:16px">${m.player1Name}</strong>
                        </div>
                        <div style="font-size:24px; font-weight:800; padding:0 20px;">
                            ${m.score1 !== null ? m.score1 : '-'} : ${m.score2 !== null ? m.score2 : '-'}
                        </div>
                        <div style="text-align:center; flex:1">
                            <strong style="font-size:16px">${m.player2Name}</strong>
                        </div>
                    </div>
                    ${m.status === 'pending_result' ? `<button class="btn btn-secondary mt-1" style="font-size:14px; padding:8px;" onclick="openResultModal('${m.id}', '${m.player1Name}', '${m.player2Name}')">رفع النتيجة</button>` : ''}
                </div>
            `;
        });
        container.innerHTML = html;

        // Modal Logic
        const modal = document.getElementById('result-modal');
        const btnClose = document.getElementById('btn-close-modal');
        const btnSubmit = document.getElementById('btn-submit-result');

        window.openResultModal = (id, p1, p2) => {
            document.getElementById('modal-match-id').value = id;
            document.getElementById('modal-p1-label').innerText = `${p1} (أهداف)`;
            document.getElementById('modal-p2-label').innerText = `${p2} (أهداف)`;
            modal.classList.remove('hidden');
        };

        btnClose.onclick = () => modal.classList.add('hidden');

        btnSubmit.onclick = async () => {
            const id = document.getElementById('modal-match-id').value;
            const s1 = parseInt(document.getElementById('modal-score1').value);
            const s2 = parseInt(document.getElementById('modal-score2').value);
            const file = document.getElementById('modal-screenshot').files[0];

            if (isNaN(s1) || isNaN(s2) || !file) {
                UI.showToast("الرجاء إدخال النتيجة واختيار صورة", "error");
                return;
            }

            UI.showLoader();
            try {
                const screenshotUrl = await uploadToImgBB(file);
                await DB.updateMatchResult(id, {
                    score1: s1,
                    score2: s2,
                    screenshotUrl,
                    status: 'pending_approval' // Admin needs to approve
                });
                UI.showToast("تم رفع النتيجة بنجاح وبانتظار الموافقة");
                modal.classList.add('hidden');
                initMatches(); // reload
            } catch (e) {
                UI.showToast(e.message, "error");
            } finally {
                UI.hideLoader();
            }
        };

    } catch (e) {
        UI.showToast("خطأ في تحميل المباريات", "error");
    } finally {
        UI.hideLoader();
    }
}

// ---- BRACKET LOGIC ----
async function initBracket() {
    const container = document.getElementById('bracket-container');
    UI.showLoader();
    try {
        const matches = await DB.getMatchesByStage('knockout');
        if (matches.length === 0) {
            container.innerHTML = "<p class='text-center mt-2' style='color:var(--text-muted)'>لم تبدأ الأدوار الإقصائية بعد.</p>";
            return;
        }

        // Just display them in a list style for mobile convenience instead of a complex tree
        let html = '<div style="display:flex; flex-direction:column; gap:15px; width:100%;">';
        matches.forEach(m => {
            let winColor1 = (m.status === 'approved' && m.score1 > m.score2) ? "var(--neon-green)" : "white";
            let winColor2 = (m.status === 'approved' && m.score2 > m.score1) ? "var(--neon-green)" : "white";

            html += `
                <div class="card neon-border" style="position:relative; overflow:hidden;">
                    <div style="position:absolute; right:0; top:0; bottom:0; width:5px; background:var(--neon-blue);"></div>
                    <div style="display:flex; justify-content:space-between; padding:10px;">
                        <span style="color:${winColor1}">${m.player1Name}</span>
                        <span>${m.score1 !== null ? m.score1 : '-'}</span>
                    </div>
                    <div style="border-top:1px solid rgba(255,255,255,0.05); margin:5px 0;"></div>
                    <div style="display:flex; justify-content:space-between; padding:10px;">
                        <span style="color:${winColor2}">${m.player2Name}</span>
                        <span>${m.score2 !== null ? m.score2 : '-'}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;

    } catch (e) {
        UI.showToast("خطأ", "error");
    } finally {
        UI.hideLoader();
    }
}
