let tg = window.Telegram.WebApp;
tg.expand();
tg.setHeaderColor('#05050a');
tg.setBackgroundColor('#05050a');

const API_BASE = 'https://api.sixapp.online'; 
const UPLOAD_AUDIO_URL = API_BASE + '/audio/upload';
const UPLOAD_TEXT_URL = API_BASE + '/text/upload';
const SEARCH_URL = API_BASE + '/search';
const VOTE_URL = API_BASE + '/vote';
const GIFT_URL = API_BASE + '/gift';
const CHAT_LIST_URL = API_BASE + '/chat/list';
const CHAT_HISTORY_URL = API_BASE + '/chat/history';
const CHAT_SEND_URL = API_BASE + '/chat/send';
const CHAT_RESTORE_URL = API_BASE + '/chat/restore';
const CHAT_CHECK_URL = API_BASE + '/chat/check';
const USER_GET_URL = API_BASE + '/user/get';
const USER_UPDATE_URL = API_BASE + '/user/update';
const SECOND_CHANCE_URL = API_BASE + '/match/second_chance';
const REPORT_URL = API_BASE + '/report';

// User State
const u = tg.initDataUnsafe.user;
let USER_ID, myName = "Игрок", myPhoto = "";
let myGender = "male";
const BOT_USERNAME = "TheSixAppBot"; // Replace with actual bot username if needed

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
let isXrayActive = false;
let lastGameData = null;

// Chat State
let loadedChats = [];
let currentChatId = null;
let currentChatPartnerId = null;
let chatPollingInterval = null;

// Profile State
let tempGender = "male";

// UI Elements
const screenLobby = document.getElementById('screen-lobby');
const screenSearch = document.getElementById('screen-search');
const screenGame = document.getElementById('screen-game');
const screenChatList = document.getElementById('screen-chat-list');
const screenChatRoom = document.getElementById('screen-chat-room');
const screenProfile = document.getElementById('screen-profile');
const screenShop = document.getElementById('screen-shop');
const screenRules = document.getElementById('screen-rules');

const gridContainer = document.getElementById('table-grid');
const svgLayer = document.getElementById('connections-layer');
const profileModal = document.getElementById('profile-modal');
const profileImg = document.getElementById('profile-large-img');
const giftToast = document.getElementById('gift-info-toast');

const GIFT_DESCRIPTIONS = {
    'heart': "❤️ ЛАЙК: Выразить симпатию",
    'joker': "🃏 ДЖОКЕР: Сменить вопрос",
    'spy': "👁 ШПИОН: Открыть фото",
    'xray': "☢️ РЕНТГЕН: Увидеть всех"
};

// --- NAVIGATION ---

function switchScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    if (screenName === 'lobby') {
        screenLobby.classList.add('active');
        document.querySelector('.nav-item:nth-child(1)').classList.add('active');
    } else if (screenName === 'chatList') {
        screenChatList.classList.add('active');
        document.querySelector('.nav-item:nth-child(2)').classList.add('active');
    } else if (screenName === 'chatRoom') {
        screenChatRoom.classList.add('active');
    } else if (screenName === 'profile') {
        screenProfile.classList.add('active');
        document.querySelector('.nav-item:nth-child(4)').classList.add('active');
    } else if (screenName === 'shop') {
        screenShop.classList.add('active');
        document.querySelector('.nav-item:nth-child(3)').classList.add('active');
    } else if (screenName === 'rules') {
        screenRules.classList.add('active');
    }
}

function forceExit() {
    console.log('Force Exit Triggered');
    if (searchInterval) clearInterval(searchInterval);
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    
    screenGame.classList.remove('active');
    screenSearch.classList.remove('active');
    switchScreen('lobby');
    
    currentPhase = "";
    currentPlayerId = null;
    hasVoted = false;
    selectedGiftType = null;
    isXrayActive = false;
    lastGameData = null;
    
    updateGiftUI();
    resetSVG();
    closeProfileModal();
    giftToast.classList.remove('visible');
}

async function startSearching() {
    screenLobby.classList.remove('active');
    screenSearch.classList.add('active');
    
    document.getElementById('mic-btn').classList.remove('disabled');
    document.getElementById('kb-btn').classList.remove('disabled');
    
    if (searchInterval) clearInterval(searchInterval);
    
    searchInterval = setInterval(async () => {
        try {
            const res = await fetch(SEARCH_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ user_id: USER_ID, name: myName, photo: myPhoto, gender: myGender })
            });
            const data = await res.json();
            
            if (data.status === 'error' && data.msg === 'BANNED') {
                clearInterval(searchInterval);
                alert("⛔️ ВЫ ЗАБАНЕНЫ!");
                forceExit();
                return;
            }

            if (data.status === 'in_game') {
                if (!screenGame.classList.contains('active')) {
                    screenSearch.classList.remove('active');
                    screenGame.classList.add('active');
                }
                updateGame(data);
            }
            if (data.status === 'in_game' && data.phase === 'results' && data.time_left <= 0) {
                 forceExit();
            }
        } catch (e) { console.error(e); }
    }, 1000);
}

// --- PROFILE LOGIC ---

async function loadProfile() {
    switchScreen('profile');
    document.getElementById('profile-avatar-view').style.backgroundImage = `url('${myPhoto || "https://via.placeholder.com/150"}')`;
    
    try {
        const res = await fetch(USER_GET_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, name: myName })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            const u = data.user;
            document.getElementById('profile-balance').innerText = u.balance;
            document.getElementById('profile-karma').innerText = u.karma + '%';
            document.getElementById('input-name').value = u.name;
            document.getElementById('input-age').value = u.age || '';
            document.getElementById('input-city').value = u.city || '';
            
            myGender = u.gender;
            tempGender = u.gender;
            updateGenderToggleUI();
            
            // Update global vars
            myName = u.name;
        } else if (data.msg === 'BANNED') {
            alert("⛔️ ВЫ ЗАБАНЕНЫ!");
        }
    } catch (e) { console.error(e); }
}

function toggleGender(gender) {
    tempGender = gender;
    updateGenderToggleUI();
    tg.HapticFeedback.selectionChanged();
}

function updateGenderToggleUI() {
    document.querySelectorAll('.gender-option').forEach(el => {
        el.classList.toggle('active', el.dataset.type === tempGender);
    });
}

async function saveProfile() {
    const name = document.getElementById('input-name').value.trim();
    const age = parseInt(document.getElementById('input-age').value);
    const city = document.getElementById('input-city').value.trim();
    
    if (!name) return alert("Name required");
    if (age && (age < 16 || age > 99)) return alert("Age must be 16-99");
    
    try {
        const res = await fetch(USER_UPDATE_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                user_id: USER_ID,
                name: name,
                age: age || null,
                city: city || null,
                gender: tempGender
            })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            myGender = tempGender;
            myName = name;
            tg.HapticFeedback.notificationOccurred('success');
            alert("Profile Saved ✅");
        } else {
            alert("Error saving profile");
        }
    } catch (e) { console.error(e); }
}

// --- GAME LOGIC ---

function updateGame(data) {
    lastGameData = data;
    document.getElementById('game-timer').innerText = `00:${data.time_left < 10 ? '0'+data.time_left : data.time_left}`;
    document.getElementById('q-text-val').innerText = data.question;
    document.querySelector('.q-label').innerText = 'РАУНД ' + data.round;

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
    const women = players.filter(p => p.gender === 'female');
    const men = players.filter(p => p.gender === 'male');
    const sorted = [];
    for (let i = 0; i < 3; i++) {
        if (women[i]) sorted.push(women[i]);
        if (men[i]) sorted.push(men[i]);
    }

    const grid = document.getElementById('table-grid');
    const existingCards = Array.from(document.querySelectorAll('.player-card'));
    existingCards.forEach(c => c.remove());

    sorted.forEach(p => {
        const isMe = p.id === USER_ID;
        const isLeftTeam = p.gender === 'female';
        
        const card = document.createElement('div');
        card.className = `player-card ${isLeftTeam ? 'team-left' : 'team-right'}`;
        card.id = `player-${p.id}`;
        
        if (phase === 'voting' && p.gender === myGender && !isMe) card.style.opacity = "0.3";
        if (currentPlayerId === p.id) card.classList.add('playing');

        // BLUR & X-RAY LOGIC
        let blurClass = '';
        if (phase === 'results') {
            blurClass = ''; 
        } else if (isMe || isXrayActive) {
            blurClass = 'reveal'; 
        } else {
            blurClass = 'blur-mask'; 
        }
        
        const badgePosClass = isLeftTeam ? 'pos-right' : 'pos-left';

        // --- RESULTS BUTTONS LOGIC ---
        let actionButtonHtml = '';
        if (phase === 'results' && !isMe && lastVotesMap) {
            const theyVotedForMe = lastVotesMap[p.id] === USER_ID;
            const iVotedForThem = lastVotesMap[USER_ID] === p.id;
            
            if (theyVotedForMe && iVotedForThem) {
                // Mutual Match -> Write Button
                actionButtonHtml = `<button class="result-action-btn btn-write" onclick="event.stopPropagation(); openChatWithUser(${p.id}, '${p.name}', '${p.photo}')">💬 WRITE</button>`;
            } else if (theyVotedForMe && !iVotedForThem) {
                // Missed Opportunity -> Second Chance
                actionButtonHtml = `<button class="result-action-btn btn-second-chance" onclick="event.stopPropagation(); buySecondChance(${p.id}, '${p.name}', '${p.photo}')">⚡️ 2ND CHANCE (100 🪙)</button>`;
            }
        }

        card.innerHTML = `
            <div class="avatar-wrapper">
                <div class="avatar ${blurClass}" style="background-image:url('${p.photo || ''}')"></div>
                <div class="status-check ${badgePosClass}" style="display:${p.has_answer ? 'flex' : 'none'}">
                    <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                ${actionButtonHtml}
            </div>
            <div class="name-tag" style="${isMe ? 'color:var(--neon-blue)' : ''}">${isMe ? 'ВЫ' : p.name}</div>
        `;

        card.onclick = () => {
            if (selectedGiftType) { sendGiftToPlayer(p, selectedGiftType); return; }
            if (isMe) return;
            if (phase === 'listening' && p.has_answer) activateSpotlight(p);
            if (phase === 'voting') castVote(p);
            if (phase === 'results') {
                 if(confirm("Купить SPY-просмотр за 100 монет?")) sendGiftToPlayer(p, 'spy');
            }
        };

        grid.appendChild(card);
    });
}

// --- INPUT (SYSTEM PROMPT) ---

async function openTextInput() {
    if (currentPhase !== 'recording') return;
    
    const text = prompt("Ваш ответ (макс 50 символов):", "");
    if (!text || !text.trim()) return;

    try {
        await fetch(UPLOAD_TEXT_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, text: text.trim().substring(0, 50) })
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

// --- GIFTS & VFX ---

function selectGift(type) {
    if (selectedGiftType === type) {
        selectedGiftType = null;
        giftToast.classList.remove('visible');
    } else {
        selectedGiftType = type;
        giftToast.innerText = GIFT_DESCRIPTIONS[type];
        giftToast.classList.add('visible');
    }
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
            if (card) {
                const fxClass = `fx-${type}`;
                card.classList.add(fxClass);
                setTimeout(() => card.classList.remove(fxClass), 3000);
            }

            if (type === 'spy') {
                setTimeout(() => openProfileModal(player.photo), 500);
            }
            else if (type === 'joker') {
                alert("🃏 ДЖОКЕР! Вопрос раунда изменен!");
            }
            else if (type === 'xray') {
                isXrayActive = true;
                document.querySelectorAll('.avatar.blur-mask').forEach(el => {
                    el.classList.remove('blur-mask');
                    el.classList.add('reveal');
                });
            }

        } else {
            alert(data.msg === 'No money' ? "Недостаточно монет!" : "Ошибка");
        }
    } catch (e) { console.error(e); }
    
    selectedGiftType = null;
    giftToast.classList.remove('visible');
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
    const OFFSET = 60; 

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

// --- CHAT SYSTEM LOGIC ---

async function loadChatList(filter = 'active') {
    if (chatPollingInterval) clearInterval(chatPollingInterval);
    switchScreen('chatList');
    
    document.getElementById('tab-active').classList.toggle('active', filter === 'active');
    document.getElementById('tab-archive').classList.toggle('active', filter === 'archived');
    
    const container = document.getElementById('chat-list-container');
    container.innerHTML = '<div class="spinner" style="margin: 20px auto;"></div>';

    try {
        const res = await fetch(CHAT_LIST_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            loadedChats = data.chats;
            renderChatList(filter);
        }
    } catch (e) { console.error(e); }
}

function renderChatList(filter) {
    const container = document.getElementById('chat-list-container');
    container.innerHTML = '';
    
    const filtered = loadedChats.filter(c => c.status === filter);
    
    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#555; margin-top:50px;">${filter === 'active' ? 'Нет активных чатов' : 'Архив пуст'}</div>`;
        return;
    }

    filtered.forEach(chat => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        
        let actionBtn = '';
        if (filter === 'archived') {
            actionBtn = `<button class="chat-restore-btn" onclick="event.stopPropagation(); restoreChat(${chat.id})">RESTORE 50 🪙</button>`;
        }

        const avatarUrl = chat.partner_photo || 'https://via.placeholder.com/50/000000/FFFFFF/?text=?';

        div.innerHTML = `
            <div class="chat-avatar" style="background-image: url('${avatarUrl}')"></div>
            <div class="chat-info">
                <div class="chat-name">${chat.partner_name}</div>
                <div class="chat-preview">${chat.preview}</div>
            </div>
            ${actionBtn}
        `;
        
        if (filter === 'active') {
            div.onclick = () => openChat(chat.id, chat.partner_name, avatarUrl, chat.partner_id);
        }
        
        container.appendChild(div);
    });
}

async function restoreChat(chatId) {
    if (!confirm("Восстановить чат за 50 монет?")) return;
    
    try {
        const res = await fetch(CHAT_RESTORE_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, chat_id: chatId })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            document.getElementById('user-balance').innerText = data.new_balance + ' 🪙';
            loadChatList('active'); 
        } else {
            alert(data.msg === 'No money' ? "Недостаточно монет!" : "Ошибка");
        }
    } catch (e) { console.error(e); }
}

async function openChat(chatId, name, photo, partnerId) {
    currentChatId = chatId;
    currentChatPartnerId = partnerId;
    switchScreen('chatRoom');
    
    document.getElementById('chat-room-name').innerText = name;
    document.getElementById('chat-room-avatar').style.backgroundImage = `url('${photo}')`;
    document.getElementById('chat-room-avatar').onclick = () => openProfileModal(photo);
    document.getElementById('chat-room-name').onclick = () => openProfileModal(photo);
    
    await fetchMessages();
    
    if (chatPollingInterval) clearInterval(chatPollingInterval);
    chatPollingInterval = setInterval(fetchMessages, 3000);
}

async function fetchMessages() {
    if (!currentChatId) return;
    
    try {
        const res = await fetch(CHAT_HISTORY_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, chat_id: currentChatId })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            renderMessages(data.messages);
        }
    } catch (e) { console.error(e); }
}

function renderMessages(messages) {
    const area = document.getElementById('chat-messages-area');
    area.innerHTML = '';
    
    messages.forEach(m => {
        const div = document.createElement('div');
        
        if (m.type === 'system') {
            div.className = 'msg-bubble msg-system';
            div.innerText = m.text;
        } else {
            const isMe = m.sender_id === USER_ID;
            div.className = `msg-bubble ${isMe ? 'msg-right' : 'msg-left'}`;
            
            const date = new Date(m.timestamp * 1000);
            const timeStr = date.getHours().toString().padStart(2,'0') + ':' + date.getMinutes().toString().padStart(2,'0');
            
            div.innerHTML = `
                ${m.text}
                <span class="msg-time">${timeStr}</span>
            `;
        }
        area.appendChild(div);
    });
    
    area.scrollTop = area.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !currentChatId) return;
    
    input.value = ''; 
    
    try {
        const res = await fetch(CHAT_SEND_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, chat_id: currentChatId, text: text })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            fetchMessages(); 
        } else {
            alert(data.msg || "Ошибка отправки");
        }
    } catch (e) { console.error(e); }
}

// --- NEW FEATURES: SECOND CHANCE & INSTANT WRITE ---

async function buySecondChance(targetId, name, photo) {
    if (!confirm(`Использовать "Второй Шанс" за 100 монет? Это создаст чат с ${name}.`)) return;

    try {
        const res = await fetch(SECOND_CHANCE_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, target_id: targetId })
        });
        const data = await res.json();

        if (data.status === 'success') {
            tg.HapticFeedback.notificationOccurred('success');
            document.getElementById('user-balance').innerText = data.new_balance + ' 🪙';
            // Open chat immediately
            forceExit(); // Close game screen
            openChat(data.chat_id, name, photo, targetId);
        } else {
            alert(data.msg === 'No money' ? "Недостаточно монет!" : "Ошибка: " + data.msg);
        }
    } catch (e) { console.error(e); }
}

async function openChatWithUser(targetId, name, photo) {
    // We need to find the chat ID first
    try {
        const res = await fetch(CHAT_CHECK_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, target_id: targetId })
        });
        const data = await res.json();

        if (data.status === 'success') {
            forceExit(); // Close game screen
            openChat(data.chat_id, name, photo, targetId);
        } else {
            alert("Ошибка: Чат не найден");
        }
    } catch (e) { console.error(e); }
}

// --- REFERRAL & REPORTING ---

function inviteFriend() {
    const link = `https://t.me/${BOT_USERNAME}?start=${USER_ID}`;
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=Play Six with me!`);
}

async function reportUser() {
    if (!currentChatPartnerId) return;
    
    const reason = prompt("Причина жалобы (Спам, Оскорбления, 18+):");
    if (!reason) return;

    try {
        const res = await fetch(REPORT_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                user_id: USER_ID, 
                target_id: currentChatPartnerId, 
                reason: reason 
            })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            alert("Жалоба отправлена. Спасибо за бдительность!");
        } else {
            alert("Ошибка отправки жалобы.");
        }
    } catch (e) { console.error(e); }
}