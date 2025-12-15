let tg = window.Telegram.WebApp;
tg.expand();
tg.setHeaderColor('#0b0b14');
tg.setBackgroundColor('#0b0b14');

const API_BASE = 'https://api.sixapp.online'; 
const UPLOAD_AUDIO_URL = API_BASE + '/audio/upload';
const UPLOAD_TEXT_URL = API_BASE + '/text/upload';
const SEARCH_URL = API_BASE + '/search';
const VOTE_URL = API_BASE + '/vote';
const GIFT_URL = API_BASE + '/gift';

// User State
const u = tg.initDataUnsafe.user;
let USER_ID, myName = "Игрок", myPhoto = "";
let myGender = "male";

if (u && u.id) {
    USER_ID = u.id;
    myName = u.first_name;
    myPhoto = u.photo_url || "";
} else {
    let stored = localStorage.getItem('six_id_v2025');
    if (!stored) {
        stored = Math.floor(Math.random() * 1000000) + 1;
        localStorage.setItem('six_id_v2025', stored);
    }
    USER_ID = parseInt(stored);
}

let searchInterval = null;
let currentPhase = "";
let currentAudio = null;
let currentPlayerId = null;
let hasVoted = false;
let lastVotesMap = null;
let selectedGiftType = null;

// UI Elements
const screenLobby = document.getElementById('screen-lobby');
const screenSearch = document.getElementById('screen-search');
const screenGame = document.getElementById('screen-game');
const gridContainer = document.getElementById('table-grid');
const svgLayer = document.getElementById('connections-layer');
const textModal = document.getElementById('text-input-modal');
const textArea = document.getElementById('custom-text-input');
const charCount = document.getElementById('char-count');
const profileModal = document.getElementById('profile-modal');
const profileImg = document.getElementById('profile-large-img');

// --- NAVIGATION ---

function forceExit() {
    if (searchInterval) clearInterval(searchInterval);
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    screenGame.classList.remove('active');
    screenSearch.classList.remove('active');
    screenLobby.classList.add('active');
    currentPhase = "";
    currentPlayerId = null;
    hasVoted = false;
    selectedGiftType = null;
    updateGiftUI();
    resetSVG();
    closeProfileModal();
}

async function startSearching() {
    screenLobby.classList.remove('active');
    screenSearch.classList.add('active');
    
    // Сброс блокировки кнопок при старте
    document.getElementById('mic-btn').classList.remove('disabled');
    document.getElementById('kb-btn').classList.remove('disabled');
    
    if (searchInterval) clearInterval(searchInterval);
    
    searchInterval = setInterval(async () => {
        try {
            const res = await fetch(SEARCH_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ user_id: USER_ID, name: myName, photo: myPhoto })
            });
            const data = await res.json();
            
            if (data.status === 'in_game') {
                if (!screenGame.classList.contains('active')) {
                    screenSearch.classList.remove('active');
                    screenGame.classList.add('active');
                }
                updateGame(data);
            }
            // Авто-выход в лобби
            if (data.status === 'in_game' && data.phase === 'results' && data.time_left <= 0) {
                 forceExit();
            }
        } catch (e) { console.error(e); }
    }, 1000);
}

// --- GAME LOGIC ---

function updateGame(data) {
    document.getElementById('game-timer').innerText = `00:${data.time_left < 10 ? '0'+data.time_left : data.time_left}`;
    document.getElementById('q-text-val').innerText = data.question;
    document.querySelector('.q-label').innerText = 'РАУНД ' + data.round;

    const me = data.players.find(p => p.id === USER_ID);
    if (me) myGender = me.gender;

    if (currentPhase !== data.phase) {
        currentPhase = data.phase;
        handlePhaseChange(data.phase);
    }

    renderPlayers(data.players, data.phase);

    if (data.phase === 'results' && data.votes_map) {
        if (JSON.stringify(data.votes_map) !== JSON.stringify(lastVotesMap)) {
            lastVotesMap = data.votes_map;
            drawConnectionLines(data.votes_map, data.matches);
        }
    }
}

function handlePhaseChange(phase) {
    const btns = document.querySelectorAll('.action-btn');
    resetSVG();
    
    if (phase === 'recording') {
        // Принудительная разблокировка
        btns.forEach(b => b.classList.remove('disabled'));
        document.getElementById('player-box-content').style.display = 'none';
        document.getElementById('q-box-content').style.display = 'block';
    } else {
        btns.forEach(b => b.classList.add('disabled'));
    }

    if (phase === 'voting') tg.HapticFeedback.notificationOccurred('warning');
    if (phase === 'results') tg.HapticFeedback.notificationOccurred('success');
}

function renderPlayers(players, phase) {
    const existingCards = document.querySelectorAll('.player-card');
    existingCards.forEach(c => c.remove());

    const women = players.filter(p => p.gender === 'female');
    const men = players.filter(p => p.gender === 'male');

    const sorted = [];
    for (let i = 0; i < 3; i++) {
        if (women[i]) sorted.push(women[i]);
        if (men[i]) sorted.push(men[i]);
    }

    sorted.forEach(p => {
        const isMe = p.id === USER_ID;
        const card = document.createElement('div');
        card.className = `player-card ${p.gender === 'female' ? 'team-left' : 'team-right'}`;
        card.id = `player-${p.id}`;
        
        if (phase === 'voting' && p.gender === myGender && !isMe) card.style.opacity = "0.3";
        if (currentPlayerId === p.id) card.classList.add('playing');

        card.innerHTML = `
            <div class="avatar" style="background-image:url('${p.photo || ''}')">
                <div class="status-check" style="display:${p.has_answer ? 'flex' : 'none'}">✅</div>
            </div>
            <div class="name-tag" style="${isMe ? 'color:var(--neon-blue)' : ''}">${isMe ? 'ВЫ' : p.name}</div>
        `;

        card.onclick = () => {
            if (isMe) return;
            if (selectedGiftType) { sendGiftToPlayer(p, selectedGiftType); return; }
            if (phase === 'listening' && p.has_answer) activateSpotlight(p);
            if (phase === 'voting') castVote(p);
            // В Results открываем профиль по клику, если уже был spy?
            // Пока оставим просто логику подарков
            if (phase === 'results') {
                 if(confirm("Купить SPY-просмотр за 100 монет?")) sendGiftToPlayer(p, 'spy');
            }
        };

        gridContainer.appendChild(card);
    });
}

// --- VFX: PARTICLES ---

function spawnParticles(element, type) {
    const emojis = { fire: '🔥', ice: '❄️', drink: '🫧', spy: '👁️' };
    const emoji = emojis[type] || '✨';
    
    for (let i = 0; i < 20; i++) {
        const p = document.createElement('span');
        p.className = 'particle';
        p.innerText = emoji;
        
        const tx = (Math.random() - 0.5) * 250 + 'px';
        const ty = (Math.random() - 0.5) * 250 + 'px';
        
        p.style.setProperty('--tx', tx);
        p.style.setProperty('--ty', ty);
        
        element.appendChild(p);
        setTimeout(() => p.remove(), 1000);
    }
}

// --- INPUT MODAL ---

function openTextInput() {
    if (currentPhase !== 'recording') return;
    textModal.style.display = 'flex';
    textArea.value = "";
    textArea.focus();
}

function closeTextInput() {
    textModal.style.display = 'none';
}

textArea.oninput = () => {
    charCount.innerText = `${textArea.value.length}/50`;
};

async function submitTextInput() {
    const val = textArea.value.trim();
    if (!val) {
        textModal.style.animation = 'shake 0.3s';
        setTimeout(() => textModal.style.animation = '', 300);
        return;
    }

    closeTextInput();
    try {
        await fetch(UPLOAD_TEXT_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, text: val })
        });
        tg.HapticFeedback.notificationOccurred('success');
    } catch(e) { console.error(e); }
}

// --- SPY MODAL ---

function openProfileModal(url) {
    if (!url) return;
    profileImg.src = url;
    profileModal.classList.add('active');
}

function closeProfileModal() {
    profileModal.classList.remove('active');
}

// --- GIFTS ---

function selectGift(type) {
    selectedGiftType = (selectedGiftType === type) ? null : type;
    tg.HapticFeedback.impactOccurred('light');
    updateGiftUI();
}

function updateGiftUI() {
    document.querySelectorAll('.gift-btn').forEach(btn => {
        btn.classList.toggle('selected', selectedGiftType && btn.getAttribute('onclick').includes(selectedGiftType));
    });
}

async function sendGiftToPlayer(player, type) {
    try {
        const res = await fetch(GIFT_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, target_id: player.id, gift_type: type })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            tg.HapticFeedback.notificationOccurred('success');
            document.getElementById('user-balance').innerText = data.new_balance + ' 🪙';
            
            const card = document.getElementById(`player-${player.id}`);
            spawnParticles(card, type);
            
            // Визуальный эффект
            card.classList.add(`fx-${type}`);
            setTimeout(() => card.classList.remove(`fx-${type}`), 2000);

            // ЛОГИКА SPY: Открываем фото
            if (type === 'spy') {
                setTimeout(() => openProfileModal(player.photo), 1000);
            }
        } else {
            alert(data.msg === 'No money' ? "Недостаточно монет!" : "Ошибка");
        }
    } catch (e) { console.error(e); }
    
    selectedGiftType = null;
    updateGiftUI();
}

// --- CORE ACTIONS ---

async function castVote(player) {
    if (hasVoted || player.gender === myGender) return;
    hasVoted = true;
    try {
        await fetch(VOTE_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, target_id: player.id })
        });
        tg.HapticFeedback.notificationOccurred('success');
        const card = document.getElementById(`player-${player.id}`);
        if(card) card.style.opacity = "0.5";
    } catch(e) { hasVoted = false; }
}

function activateSpotlight(player) {
    if (currentPlayerId === player.id) { stopPlayback(); return; }
    if (currentAudio) currentAudio.pause();

    currentPlayerId = player.id;
    document.getElementById('q-box-content').style.display = 'none';
    const pBox = document.getElementById('player-box-content');
    pBox.style.display = 'flex';

    if (player.answer_type === 'audio') {
        pBox.innerHTML = `<div class="play-btn" onclick="stopPlayback()">⏸</div><div class="wave-visual"><div class="wave-fill"></div></div>`;
        currentAudio = new Audio(player.answer_content);
        currentAudio.play();
        currentAudio.onended = stopPlayback;
    } else {
        pBox.innerHTML = `<div class="answer-text-display">"${player.answer_content}"</div>`;
    }
}

function stopPlayback() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    currentPlayerId = null;
    document.getElementById('player-box-content').style.display = 'none';
    document.getElementById('q-box-content').style.display = 'block';
}

// --- MIC ---

let isRecording = false, mediaRecorder, audioChunks = [];
async function toggleRecording() {
    const btn = document.getElementById('mic-btn');
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const blob = new Blob(audioChunks, { type: 'audio/ogg' });
                const fd = new FormData();
                fd.append('audio_file', blob);
                fd.append('user_id', USER_ID);
                await fetch(UPLOAD_AUDIO_URL, { method: 'POST', body: fd });
                tg.HapticFeedback.notificationOccurred('success');
            };
            audioChunks = [];
            mediaRecorder.start();
            isRecording = true;
            btn.classList.add('recording');
        } catch(e) { alert("Mic Error"); }
    } else {
        isRecording = false;
        btn.classList.remove('recording');
        if(mediaRecorder) mediaRecorder.stop();
    }
}

// --- SVG HELPERS ---

function resetSVG() {
    svgLayer.innerHTML = `<defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#00f3ff" /></marker>
        <marker id="arrowhead-match" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#00ff88" /></marker>
    </defs>`;
}

function drawConnectionLines(votes, matches) {
    resetSVG();
    const rect = gridContainer.getBoundingClientRect();
    // AVATAR_RADIUS = 55 (приблизительно половина от 100px + отступ)
    const OFFSET = 55;

    for (const [voter, target] of Object.entries(votes)) {
        const el1 = document.getElementById(`player-${voter}`);
        const el2 = document.getElementById(`player-${target}`);
        if (el1 && el2) {
            const r1 = el1.querySelector('.avatar').getBoundingClientRect();
            const r2 = el2.querySelector('.avatar').getBoundingClientRect();
            const x1 = r1.left + r1.width/2 - rect.left;
            const y1 = r1.top + r1.height/2 - rect.top;
            const x2 = r2.left + r2.width/2 - rect.left;
            const y2 = r2.top + r2.height/2 - rect.top;

            // Math to stop line at circle edge
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const endX = x2 - OFFSET * Math.cos(angle);
            const endY = y2 - OFFSET * Math.sin(angle);
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1); line.setAttribute('y1', y1);
            line.setAttribute('x2', endX); line.setAttribute('y2', endY);
            
            const matched = matches && matches.some(m => (m[0]==voter && m[1]==target) || (m[1]==voter && m[0]==target));
            line.setAttribute('class', matched ? 'line-match' : 'line-normal');
            line.setAttribute('marker-end', matched ? 'url(#arrowhead-match)' : 'url(#arrowhead)');
            svgLayer.appendChild(line);
        }
    }
}