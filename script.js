let tg = window.Telegram.WebApp;
tg.expand();
tg.setHeaderColor('#0b0b14'); tg.setBackgroundColor('#0b0b14');

function log(msg) {
    const el = document.getElementById('debug-console');
    if(el) el.innerText = msg + "\n" + el.innerText;
    console.log(msg);
}

const UPLOAD_URL = 'https://api.sixapp.online/audio/upload';
const SEARCH_URL = 'https://api.sixapp.online/search';
// --- (NEW) URL для логов ---
const LOG_URL = 'https://api.sixapp.online/log';

// --- (NEW) Функция отправки логов на сервер ---
function sendDebug(type, payload) {
    try {
        fetch(LOG_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: type, payload: payload })
        }).catch(err => console.error("Log error:", err));
    } catch (e) {
        console.error("Critical log fail", e);
    }
}

// ИДЕНТИФИКАЦИЯ
const u = tg.initDataUnsafe.user;
let USER_ID, myName = "Игрок", myPhoto = "";

if (u && u.id) {
    USER_ID = u.id;
    myName = u.first_name || "Аноним";
    myPhoto = u.photo_url || "";
} else {
    let storedId = localStorage.getItem('six_real_id_v5'); 
    if (!storedId) {
        storedId = Math.floor(Math.random() * 1000000) + 1;
        localStorage.setItem('six_real_id_v5', storedId);
    }
    USER_ID = parseInt(storedId);
    myName = "Тест " + USER_ID;
}

// --- (NEW) Лог загрузки ---
sendDebug("LIFECYCLE", `Page Loaded ID:${USER_ID}`);

// --- (NEW) Перехват ошибок JS ---
window.onerror = function(msg, url, line) {
    sendDebug("JS_ERROR", `${msg} at line ${line}`);
};

document.getElementById('debug-id').innerText = "ID: " + USER_ID;
document.getElementById('my-name-label').innerText = myName;
if (myPhoto) document.getElementById('my-avatar').style.backgroundImage = `url('${myPhoto}')`;

let searchInterval = null;
let currentPhase = "";
let currentAudio = null;

// ВЫХОД
function forceExit() {
    // --- (NEW) Лог выхода ---
    sendDebug("CRITICAL", "Force Exit Triggered");
    
    log("🛑 EXIT");
    if (searchInterval) clearInterval(searchInterval);
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    document.getElementById('screen-game').classList.remove('active');
    document.getElementById('screen-search').classList.remove('active');
    document.getElementById('screen-lobby').classList.add('active');
    currentPhase = "";
}

async function startSearching() {
    // --- (NEW) Лог старта ---
    sendDebug("ACTION", "Clicked Start Searching");
    
    tg.HapticFeedback.impactOccurred('heavy');
    document.getElementById('screen-lobby').classList.remove('active');
    document.getElementById('screen-search').classList.add('active');
    startPolling();
}

function startPolling() {
    if (searchInterval) clearInterval(searchInterval);

    searchInterval = setInterval(async () => {
        try {
            const response = await fetch(SEARCH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: USER_ID, name: myName, photo: myPhoto })
            });
            const data = await response.json();
            
            if (data.status === 'in_game') {
                if (!document.getElementById('screen-game').classList.contains('active')) {
                    sendDebug("PHASE", "Entered Game Screen");
                    document.getElementById('screen-search').classList.remove('active');
                    document.getElementById('screen-game').classList.add('active');
                }
                updateGameUI(data);
            }
            else if (data.status === 'searching') {
                if (document.getElementById('screen-game').classList.contains('active')) {
                     sendDebug("CRITICAL", "Game ended by server");
                     alert("Игра завершена!");
                     forceExit();
                }
            }
        } catch (error) { console.error("Poll err"); }
    }, 1000); 
}

function updateGameUI(data) {
    // 1. Таймер
    const timer = document.getElementById('game-timer');
    let tl = data.time_left;
    timer.innerText = `00:${tl < 10 ? '0'+tl : tl}`;
    
    document.getElementById('q-text-val').innerText = data.question;

    // 2. Раунды
    if (data.round) document.querySelector('.q-label').innerText = 'РАУНД ' + data.round;

    // 3. Соперник
    const oppNameEl = document.getElementById('opponent-name');
    if (oppNameEl.innerText !== data.opponent_name) {
        oppNameEl.innerText = data.opponent_name;
        const oppAva = document.getElementById('opponent-avatar');
        const photo = (data.opponent_photo && data.opponent_photo !== "null") ? data.opponent_photo : 'https://randomuser.me/api/portraits/lego/1.jpg';
        oppAva.style.backgroundImage = `url('${photo}')`;
        oppAva.classList.add('blurred');
    }

    // 4. Смена Фаз
    if (currentPhase !== data.phase) {
        // --- (NEW) Лог смены фаз ---
        sendDebug("PHASE_CHANGE", `${currentPhase} -> ${data.phase}`);
        
        currentPhase = data.phase;
        log(`ФАЗА: ${currentPhase}`);
        
        if (currentPhase === 'recording') {
            document.getElementById('controls').style.display = 'flex'; 
            document.getElementById('player-box-content').style.display = 'none';
            document.getElementById('q-box-content').style.display = 'block';
            document.querySelectorAll('.notify-badge').forEach(e => e.remove());
        } 
        else if (currentPhase === 'listening') {
            document.getElementById('controls').style.display = 'none'; 
            tg.HapticFeedback.notificationOccurred('warning');
        }
        else if (currentPhase === 'voting') {
            forceExit(); 
        }
    }

    // 5. Значок Play
    if (data.phase === 'listening' && data.opponent_audio) {
         const oppCard = document.getElementById('opponent-card');
         if (!oppCard.querySelector('.notify-badge')) {
             const badge = document.createElement('div');
             badge.className = 'notify-badge';
             badge.innerText = '▶️';
             oppCard.onclick = function() { playOpponentAudio(data.opponent_audio); };
             oppCard.appendChild(badge);
             tg.HapticFeedback.notificationOccurred('success');
         }
    }
}

function playOpponentAudio(audioUrl) {
     log("Play: " + audioUrl);
     sendDebug("ACTION", "Playing Audio");
     tg.HapticFeedback.impactOccurred('medium');
     if (currentAudio) { currentAudio.pause(); }

     document.getElementById('q-box-content').style.display = 'none';
     const pBox = document.getElementById('player-box-content');
     pBox.style.display = 'flex';
     pBox.innerHTML = `
        <div class="play-btn" onclick="stopAudio()">⏸</div>
        <div style="font-size:10px; color:var(--neon-pink); margin-right:5px;">СЛУШАЕМ...</div>
        <div class="wave-visual"><div class="wave-fill" style="animation: fillWave 5s linear forwards;"></div></div>
    `;

    currentAudio = new Audio(audioUrl);
    currentAudio.play().catch(e => log(e));
    currentAudio.onended = function() { stopAudio(); };
}

function stopAudio() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    document.getElementById('player-box-content').style.display = 'none';
    document.getElementById('q-box-content').style.display = 'block';
}

let isRecording = false;
let mediaRecorder; 
let audioChunks = []; 

async function toggleRecording() {
    if (currentPhase !== 'recording') return;
    const btn = document.getElementById('mic-btn');
    
    if (!isRecording) {
        try {
            sendDebug("ACTION", "Start Recording");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
            mediaRecorder.onstop = sendAudioData;
            audioChunks = [];
            mediaRecorder.start();
            isRecording = true;
            btn.classList.add('recording');
            tg.HapticFeedback.impactOccurred('medium');
        } catch (err) { 
            sendDebug("ERROR", "Mic permission failed");
            alert('Mic Error'); 
        }
    } else {
        sendDebug("ACTION", "Stop Recording");
        isRecording = false;
        btn.classList.remove('recording');
        if (mediaRecorder) mediaRecorder.stop();
    }
}

function sendAudioData() {
    if (audioChunks.length === 0) return;
    const audioBlob = new Blob(audioChunks, { type: 'audio/ogg; codecs=opus' });
    const formData = new FormData();
    formData.append('audio_file', audioBlob, `voice_${Date.now()}.ogg`);
    formData.append('user_id', USER_ID); 
    
    const pBox = document.getElementById('player-box-content');
    document.getElementById('q-box-content').style.display = 'none';
    pBox.style.display = 'flex';
    pBox.innerHTML = `<div style="color:#00ff88; font-size:12px;">ОТПРАВКА...</div>`;

    fetch(UPLOAD_URL, { method: 'POST', body: formData })
    .then(res => res.json())
    .then(data => {
        sendDebug("ACTION", "Audio Uploaded");
        pBox.style.display = 'none';
        document.getElementById('q-box-content').style.display = 'block';
    })
    .catch(err => {
        sendDebug("ERROR", "Upload Failed");
        alert('Upload Error');
    });
}

function sendGift(type) { 
    sendDebug("ACTION", "Gift Sent: " + type);
    tg.HapticFeedback.impactOccurred('medium'); 
    alert(`Подарок: ${type}`); 
}
function buyPack() {
    sendDebug("ACTION", "Buy Pack Clicked");
}