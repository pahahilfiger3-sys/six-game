let tg = window.Telegram.WebApp;
tg.expand();
tg.setHeaderColor('#0b0b14'); tg.setBackgroundColor('#0b0b14');

function log(msg) {
    console.log(msg);
}

const API_BASE = 'https://api.sixapp.online'; 
const UPLOAD_AUDIO_URL = API_BASE + '/audio/upload';
const UPLOAD_TEXT_URL = API_BASE + '/text/upload';
const SEARCH_URL = API_BASE + '/search';
const VOTE_URL = API_BASE + '/vote';
const LOG_URL = API_BASE + '/log';

function sendDebug(type, payload) {
    fetch(LOG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type, payload: payload })
    }).catch(e => {});
}

// User Data
const u = tg.initDataUnsafe.user;
let USER_ID, myName = "Игрок", myPhoto = "";

if (u && u.id) {
    USER_ID = u.id;
    myName = u.first_name;
    myPhoto = u.photo_url || "";
} else {
    let stored = localStorage.getItem('six_id_v6');
    if (!stored) {
        stored = Math.floor(Math.random() * 1000000) + 1;
        localStorage.setItem('six_id_v6', stored);
    }
    USER_ID = parseInt(stored);
    myName = "Guest " + USER_ID;
}

let searchInterval = null;
let currentPhase = "";
let currentAudio = null;
let currentPlayerId = null;
let hasVoted = false;
let lastVotesMap = null;

// UI Elements
const screenLobby = document.getElementById('screen-lobby');
const screenSearch = document.getElementById('screen-search');
const screenGame = document.getElementById('screen-game');
const gridContainer = document.getElementById('table-grid');
const svgLayer = document.getElementById('connections-layer');

function forceExit() {
    sendDebug("EXIT", "User quit");
    if (searchInterval) clearInterval(searchInterval);
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    screenGame.classList.remove('active');
    screenSearch.classList.remove('active');
    screenLobby.classList.add('active');
    currentPhase = "";
    currentPlayerId = null;
    hasVoted = false;
    svgLayer.innerHTML = '';
}

async function startSearching() {
    screenLobby.classList.remove('active');
    screenSearch.classList.add('active');
    
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
            } else if (data.status === 'searching' && screenGame.classList.contains('active')) {
                alert('Игра завершена');
                forceExit();
            }
        } catch (e) { console.error(e); }
    }, 1000);
}

function updateGame(data) {
    document.getElementById('game-timer').innerText = `00:${data.time_left < 10 ? '0'+data.time_left : data.time_left}`;
    document.getElementById('q-text-val').innerText = data.question;
    document.querySelector('.q-label').innerText = 'РАУНД ' + data.round;

    if (currentPhase !== data.phase) {
        currentPhase = data.phase;
        handlePhaseChange(data.phase);
    }

    renderPlayers(data.players, data.phase);

    if (data.phase === 'results' && data.votes_map) {
        // Only redraw if votes changed or first time
        if (JSON.stringify(data.votes_map) !== JSON.stringify(lastVotesMap)) {
            lastVotesMap = data.votes_map;
            drawConnectionLines(data.votes_map, data.matches);
        }
    }
}

function handlePhaseChange(phase) {
    sendDebug("PHASE", phase);
    const btns = document.querySelectorAll('.action-btn');
    const playerBox = document.getElementById('player-box-content');
    const qBox = document.getElementById('q-box-content');
    
    // Reset states
    svgLayer.innerHTML = '';
    lastVotesMap = null;

    if (phase === 'recording') {
        btns.forEach(b => b.classList.remove('disabled'));
        playerBox.style.display = 'none';
        qBox.style.display = 'block';
        if (currentAudio) currentAudio.pause();
        currentPlayerId = null;
    } 
    else if (phase === 'voting') {
        btns.forEach(b => b.classList.add('disabled'));
        if (currentAudio) currentAudio.pause();
        tg.HapticFeedback.notificationOccurred('warning');
        hasVoted = false;
    }
    else if (phase === 'results') {
        btns.forEach(b => b.classList.add('disabled'));
        tg.HapticFeedback.notificationOccurred('success');
    }
    else {
        // Listening
        btns.forEach(b => b.classList.add('disabled'));
        if (phase === 'listening') {
            tg.HapticFeedback.notificationOccurred('success');
        }
    }
}

function renderPlayers(players, phase) {
    // Keep existing cards if possible to avoid flicker, but for simplicity we rebuild
    // To optimize: check if innerHTML needs update. For now, rebuild is safer for state.
    
    // Clear only cards, keep SVG
    const existingCards = document.querySelectorAll('.player-card');
    existingCards.forEach(c => c.remove());

    const women = players.filter(p => p.gender === 'female');
    const men = players.filter(p => p.gender === 'male');

    const sortedPlayers = [];
    for (let i = 0; i < 3; i++) {
        if (women[i]) sortedPlayers.push(women[i]);
        if (men[i]) sortedPlayers.push(men[i]);
    }

    sortedPlayers.forEach((p) => {
        const isMe = p.id === USER_ID;
        const isFemale = p.gender === 'female';
        
        const card = document.createElement('div');
        card.className = `player-card ${isFemale ? 'team-left' : 'team-right'}`;
        card.id = `player-${p.id}`; // ID for SVG positioning
        
        if (currentPlayerId === p.id && currentPlayerId !== null) {
            card.classList.add('playing');
        }

        const avatarUrl = p.photo || 'https://randomuser.me/api/portraits/lego/1.jpg';
        const checkDisplay = (p.has_answer) ? 'flex' : 'none';
        
        card.innerHTML = `
            <div class="avatar" style="background-image:url('${avatarUrl}')">
                <div class="status-check" style="display:${checkDisplay}">✅</div>
            </div>
            <div class="name-tag" style="${isMe ? 'color:var(--neon-blue)' : ''}">${isMe ? 'ВЫ' : p.name}</div>
        `;

        // Click Logic
        if (phase === 'listening' && p.has_answer && !isMe) {
             card.onclick = () => activateSpotlight(p);
        } else if (phase === 'voting' && !isMe) {
             card.onclick = () => castVote(p);
        } else if (phase === 'results' && !isMe) {
             card.onclick = () => {
                 if(confirm("Купить контакт этого игрока за 50 монет?")) {
                     alert("Функция в разработке!");
                 }
             };
        }

        gridContainer.appendChild(card);
    });
}

async function castVote(player) {
    if (hasVoted) return;
    if (!confirm(`Голосовать за ${player.name}?`)) return;

    hasVoted = true;
    try {
        await fetch(VOTE_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, target_id: player.id })
        });
        tg.HapticFeedback.notificationOccurred('success');
        // Visual feedback
        const card = document.getElementById(`player-${player.id}`);
        if(card) card.style.opacity = "0.5";
    } catch(e) { console.error(e); hasVoted = false; }
}

function activateSpotlight(player) {
    if (currentPlayerId === player.id) {
        stopPlayback();
        return;
    }

    sendDebug("SPOTLIGHT", `${player.name} (${player.answer_type})`);
    tg.HapticFeedback.impactOccurred('light');

    if (currentAudio) currentAudio.pause();

    document.getElementById('q-box-content').style.display = 'none';
    const pBox = document.getElementById('player-box-content');
    pBox.style.display = 'flex';
    pBox.innerHTML = '';

    currentPlayerId = player.id;
    document.querySelectorAll('.player-card').forEach(el => el.classList.remove('playing'));

    if (player.answer_type === 'audio') {
        pBox.innerHTML = `
            <div class="play-btn" onclick="stopPlayback()">⏸</div>
            <div style="font-size:10px; color:var(--neon-pink); margin-right:5px; white-space:nowrap;">${player.name}</div>
            <div class="wave-visual"><div class="wave-fill" style="animation: fillWave 10s linear forwards;"></div></div>
        `;
        currentAudio = new Audio(player.answer_content);
        currentAudio.play().catch(e => console.error(e));
        currentAudio.onended = stopPlayback;
    } 
    else if (player.answer_type === 'text') {
        pBox.innerHTML = `
            <div style="font-size:10px; color:var(--neon-pink); white-space:nowrap; margin-right:5px;">${player.name}:</div>
            <div class="answer-text-display">"${player.answer_content}"</div>
        `;
    }
}

function stopPlayback() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    currentPlayerId = null;
    document.getElementById('player-box-content').style.display = 'none';
    document.getElementById('q-box-content').style.display = 'block';
    document.querySelectorAll('.player-card').forEach(el => el.classList.remove('playing'));
}

// --- VISUALS: ARROWS ---
function drawConnectionLines(votesMap, matches) {
    svgLayer.innerHTML = ''; // Clear old lines
    const containerRect = gridContainer.getBoundingClientRect();

    // Helper to check if a pair is a match
    const isMatch = (id1, id2) => {
        if (!matches) return false;
        return matches.some(m => (m[0] == id1 && m[1] == id2) || (m[0] == id2 && m[1] == id1));
    };

    for (const [voterId, targetId] of Object.entries(votesMap)) {
        const fromEl = document.getElementById(`player-${voterId}`);
        const toEl = document.getElementById(`player-${targetId}`);

        if (fromEl && toEl) {
            const fromRect = fromEl.querySelector('.avatar').getBoundingClientRect();
            const toRect = toEl.querySelector('.avatar').getBoundingClientRect();

            // Calculate centers relative to the container
            const x1 = fromRect.left + fromRect.width / 2 - containerRect.left;
            const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
            const x2 = toRect.left + toRect.width / 2 - containerRect.left;
            const y2 = toRect.top + toRect.height / 2 - containerRect.top;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);

            if (isMatch(voterId, targetId)) {
                line.setAttribute('class', 'line-match');
            } else {
                line.setAttribute('class', 'line-normal');
            }

            svgLayer.appendChild(line);
        }
    }
}

// Redraw on resize
window.addEventListener('resize', () => {
    if (currentPhase === 'results' && lastVotesMap) {
        // Need matches data here, but it's not stored globally. 
        // Ideally, store full last data object. For now, lines might disappear until next poll.
        // Better: fetch will redraw in <1s.
    }
});

// --- INPUT LOGIC ---

async function sendTextAnswer() {
    const text = prompt("Ваш ответ:", "");
    if (!text || text.trim() === "") return;

    const pBox = document.getElementById('player-box-content');
    document.getElementById('q-box-content').style.display = 'none';
    pBox.style.display = 'flex';
    pBox.innerHTML = `<div style="color:#00ff88; font-size:12px;">ОТПРАВКА...</div>`;

    try {
        const res = await fetch(UPLOAD_TEXT_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, text: text })
        });
        const d = await res.json();
        if(d.status === 'success') {
            tg.HapticFeedback.notificationOccurred('success');
        } else {
            alert('Ошибка отправки');
        }
    } catch(e) { console.error(e); }
    
    pBox.style.display = 'none';
    document.getElementById('q-box-content').style.display = 'block';
}

let isRecording = false;
let mediaRecorder;
let audioChunks = [];

async function toggleRecording() {
    const btn = document.getElementById('mic-btn');
    if (btn.classList.contains('disabled')) return;
    
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = uploadAudio;
            audioChunks = [];
            mediaRecorder.start();
            isRecording = true;
            btn.classList.add('recording');
            tg.HapticFeedback.impactOccurred('medium');
        } catch (e) { alert("Mic Access Error"); }
    } else {
        isRecording = false;
        btn.classList.remove('recording');
        if (mediaRecorder) mediaRecorder.stop();
    }
}

function uploadAudio() {
    if (!audioChunks.length) return;
    const blob = new Blob(audioChunks, { type: 'audio/ogg; codecs=opus' });
    const formData = new FormData();
    formData.append('audio_file', blob);
    formData.append('user_id', USER_ID);

    const pBox = document.getElementById('player-box-content');
    document.getElementById('q-box-content').style.display = 'none';
    pBox.style.display = 'flex';
    pBox.innerHTML = `<div style="color:#00ff88; font-size:12px;">ОТПРАВКА...</div>`;

    fetch(UPLOAD_AUDIO_URL, { method: 'POST', body: formData })
    .then(r => r.json())
    .then(d => {
        if(d.status === 'success') {
            tg.HapticFeedback.notificationOccurred('success');
        } else {
            alert('Ошибка загрузки');
        }
        pBox.style.display = 'none';
        document.getElementById('q-box-content').style.display = 'block';
    })
    .catch(e => {
        console.error(e);
        pBox.style.display = 'none';
        document.getElementById('q-box-content').style.display = 'block';
    });
}

// --- GIFTS ---
function sendGift(type) {
    // Пока просто визуальный эффект или алерт
    console.log("Gift sent:", type);
    tg.HapticFeedback.notificationOccurred('success');
    // В будущем тут будет fetch запрос на списание монет
    alert(`Подарок ${type} отправлен! (Списано монет: 10)`);
}