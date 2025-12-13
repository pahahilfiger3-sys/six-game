let tg = window.Telegram.WebApp;
tg.expand();
tg.setHeaderColor('#0b0b14'); tg.setBackgroundColor('#0b0b14');

function log(msg) {
    console.log(msg);
}

const API_BASE = 'https://api.sixapp.online'; 
const UPLOAD_URL = API_BASE + '/audio/upload';
const SEARCH_URL = API_BASE + '/search';
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
let currentAudioId = null; // <--- FIX: ID вместо URL

// UI Elements
const screenLobby = document.getElementById('screen-lobby');
const screenSearch = document.getElementById('screen-search');
const screenGame = document.getElementById('screen-game');
const gridContainer = document.querySelector('.table-grid');

function forceExit() {
    sendDebug("EXIT", "User quit");
    if (searchInterval) clearInterval(searchInterval);
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    screenGame.classList.remove('active');
    screenSearch.classList.remove('active');
    screenLobby.classList.add('active');
    currentPhase = "";
    currentAudioId = null;
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
}

function handlePhaseChange(phase) {
    sendDebug("PHASE", phase);
    const controls = document.getElementById('controls');
    const playerBox = document.getElementById('player-box-content');
    const qBox = document.getElementById('q-box-content');

    if (phase === 'recording') {
        controls.style.display = 'flex';
        playerBox.style.display = 'none';
        qBox.style.display = 'block';
        if (currentAudio) currentAudio.pause();
        currentAudioId = null;
    } 
    else if (phase === 'listening') {
        controls.style.display = 'none';
        tg.HapticFeedback.notificationOccurred('success');
    }
    else if (phase === 'voting') {
        if (currentAudio) currentAudio.pause();
    }
}

// ГЕНЕРАЦИЯ СЕТКИ ИГРОКОВ (3 ЖЕНЩИНЫ СЛЕВА, 3 МУЖЧИНЫ СПРАВА)
function renderPlayers(players, phase) {
    gridContainer.innerHTML = '';

    // 1. Сортировка по полу
    const women = players.filter(p => p.gender === 'female');
    const men = players.filter(p => p.gender === 'male');

    // 2. Чередование для Grid (Ж, М, Ж, М, Ж, М)
    // Grid заполняется построчно: Col1, Col2, Col1, Col2...
    const sortedPlayers = [];
    for (let i = 0; i < 3; i++) {
        if (women[i]) sortedPlayers.push(women[i]);
        if (men[i]) sortedPlayers.push(men[i]);
    }

    sortedPlayers.forEach((p) => {
        const isMe = p.id === USER_ID;
        const isFemale = p.gender === 'female';
        
        const card = document.createElement('div');
        // Если женщина - team-left, мужчина - team-right
        card.className = `player-card ${isFemale ? 'team-left' : 'team-right'}`;
        
        // FIX: Сравниваем по ID, а не по URL
        if (currentAudioId === p.id && currentAudioId !== null) {
            card.classList.add('playing');
        }

        const avatarUrl = p.photo || 'https://randomuser.me/api/portraits/lego/1.jpg';
        const checkDisplay = (p.has_audio) ? 'flex' : 'none';
        
        card.innerHTML = `
            <div class="avatar" style="background-image:url('${avatarUrl}')">
                <div class="status-check" style="display:${checkDisplay}">✅</div>
            </div>
            <div class="name-tag" style="${isMe ? 'color:var(--neon-blue)' : ''}">${isMe ? 'ВЫ' : p.name}</div>
        `;

        if (phase === 'listening' && p.audio_url && !isMe) {
             card.onclick = () => playOpponentAudio(p.audio_url, p.name, p.id);
        }

        gridContainer.appendChild(card);
    });
}

function playOpponentAudio(url, name, id) {
    if (currentAudioId === id) {
        stopAudio();
        return;
    }

    sendDebug("PLAY", `Playing ${name} (${id})`);
    tg.HapticFeedback.impactOccurred('light');

    if (currentAudio) currentAudio.pause();

    // UI Spotlight update
    document.getElementById('q-box-content').style.display = 'none';
    const pBox = document.getElementById('player-box-content');
    pBox.style.display = 'flex';
    pBox.innerHTML = `
        <div class="play-btn" onclick="stopAudio()">⏸</div>
        <div style="font-size:10px; color:var(--neon-pink); margin-right:5px; white-space:nowrap;">${name}</div>
        <div class="wave-visual"><div class="wave-fill" style="animation: fillWave 10s linear forwards;"></div></div>
    `;

    currentAudio = new Audio(url);
    currentAudioId = id; // Сохраняем ID текущего
    
    // Мгновенное обновление UI (пока не пришел fetch)
    document.querySelectorAll('.player-card').forEach(el => el.classList.remove('playing'));
    // Находим карточку по клику сложно, проще дождаться ререндера или найти по тексту, 
    // но так как ререндер каждую секунду, визуально задержка минимальна.
    
    currentAudio.play().catch(e => console.error(e));
    currentAudio.onended = stopAudio;
}

function stopAudio() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    currentAudioId = null;
    document.getElementById('player-box-content').style.display = 'none';
    document.getElementById('q-box-content').style.display = 'block';
    document.querySelectorAll('.player-card').forEach(el => el.classList.remove('playing'));
}

// --- RECORDING LOGIC ---
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

async function toggleRecording() {
    const btn = document.getElementById('mic-btn');
    
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

    fetch(UPLOAD_URL, { method: 'POST', body: formData })
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