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

// SYNC GAME API
const SYNC_START_URL = API_BASE + '/game/sync/start';
const SYNC_ACCEPT_URL = API_BASE + '/game/sync/accept';
const SYNC_STATE_URL = API_BASE + '/game/sync/state';
const SYNC_ANSWER_URL = API_BASE + '/game/sync/answer';

// User State
const u = tg.initDataUnsafe.user;
let USER_ID, myName = "Игрок", myPhoto = "";
let myGender = "male";
const BOT_USERNAME = "TheSixAppBot"; 

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

// Sync Game State
let syncGameInterval = null;
let isSyncPanelOpen = false;

// Profile State
let tempGender = "male";

// UI Elements
const screenLobby = document.getElementById('screen-lobby');
const screenSearch = document.getElementById('screen-search');
const screenGame = document.getElementById('screen-game');
const screenProcessing = document.getElementById('screen-processing');
const screenChatList = document.getElementById('screen-chat-list');
const screenChatRoom = document.getElementById('screen-chat-room');
const screenProfile = document.getElementById('screen-profile');
const screenShop = document.getElementById('screen-shop');
const screenRules = document.getElementById('screen-rules');

const gridContainer = document.getElementById('table-grid');
const svgLayer = document.getElementById('connections-layer');
const profileModal = document.getElementById('profile-modal');
const profileImg = document.getElementById('profile-large-img');
const gameBottomSheet = document.getElementById('game-bottom-sheet');
const giftModal = document.getElementById('gift-modal');

// --- GIFT CONFIGURATION (NO EMOJIS) ---
const GIFT_DESCRIPTIONS = {
    'heart': "LIKE: Tap a player to send",
    'spy': "SPY: Tap a player to reveal photo",
    'xray': "X-RAY: Tap a player to reveal all"
};

const GIFT_ICONS = {
    'heart': '<path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>',
    'spy': '<path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>',
    'xray': '<path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z"/>'
};

const GIFT_COLORS = {
    'heart': 'var(--color-heart)',
    'spy': 'var(--color-spy)',
    'xray': 'var(--color-xray)'
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
    } else if (screenName === 'game') {
        screenGame.classList.add('active');
    } else if (screenName === 'processing') {
        screenProcessing.classList.add('active');
    }
}

function forceExit() {
    if (searchInterval) clearInterval(searchInterval);
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    
    screenGame.classList.remove('active');
    screenSearch.classList.remove('active');
    screenProcessing.classList.remove('active');
    switchScreen('lobby');
    
    currentPhase = "";
    currentPlayerId = null;
    hasVoted = false;
    selectedGiftType = null;
    isXrayActive = false;
    lastGameData = null;
    
    resetSVG();
    closeProfileModal();
    closeGiftModal();
    stopPlayback();
    cancelGiftSelection()
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
                alert("BANNED");
                forceExit();
                return;
            }

            if (data.status === 'in_game') {
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
            
            myName = u.name;
        } else if (data.msg === 'BANNED') {
            alert("BANNED");
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
            alert("Profile Saved");
        } else {
            alert("Error saving profile");
        }
    } catch (e) { console.error(e); }
}

// --- GAME LOGIC ---

function updateGame(data) {
    lastGameData = data;

    if (data.phase === 'processing') {
        if (!screenProcessing.classList.contains('active')) {
            screenSearch.classList.remove('active');
            screenGame.classList.remove('active');
            switchScreen('processing');
        }
        if (currentPhase !== data.phase) {
            currentPhase = data.phase;
            handlePhaseChange(data.phase);
        }
        return;
    } else {
        if (screenProcessing.classList.contains('active')) {
            switchScreen('game');
        }
        if (screenSearch.classList.contains('active')) {
            screenSearch.classList.remove('active');
            switchScreen('game');
        }
    }

    document.getElementById('game-timer').innerText = `00:${data.time_left < 10 ? '0'+data.time_left : data.time_left}`;
    document.getElementById('q-text-val').innerText = data.question;
    document.querySelector('.q-label').innerText = 'ROUND ' + data.round;

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
    const statusText = document.getElementById('game-status-text');
    resetSVG();
    
    // Reset Spotlight UI
    stopPlayback();

    // --- UPDATE STATUS TEXT (GREEN INSTRUCTIONS) ---
    if (phase === 'recording') {
        statusText.innerText = "TAP MIC TO SPEAK";
        btns.forEach(b => b.classList.remove('disabled'));
    } else if (phase === 'listening') {
        statusText.innerText = "TAP PLAYER TO LISTEN";
        if (isRecording) {
            isRecording = false;
            document.getElementById('mic-btn').classList.remove('recording');
            if(mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        }
        btns.forEach(b => b.classList.add('disabled'));
        document.querySelector('.gift-menu-btn').classList.remove('disabled');
    } else if (phase === 'voting') {
        statusText.innerText = "TAP AVATAR TO VOTE";
        btns.forEach(b => b.classList.add('disabled'));
        document.querySelector('.gift-menu-btn').classList.remove('disabled');
        tg.HapticFeedback.notificationOccurred('warning');
    } else if (phase === 'results') {
        statusText.innerText = "MATCH RESULTS";
        btns.forEach(b => b.classList.add('disabled'));
        document.querySelector('.gift-menu-btn').classList.remove('disabled');
        tg.HapticFeedback.notificationOccurred('success');
    }
}

function triggerAvatarAnim(wrapper, type) {
    if (!wrapper) return;
    
    // 1. Clean previous animations
    wrapper.classList.remove('anim-tap', 'anim-heart', 'anim-spy', 'anim-xray');
    wrapper.querySelectorAll('.fx-container').forEach(el => el.remove()); // Cleanup old FX
    
    // Create a container for temporary FX elements
    const fxContainer = document.createElement('div');
    fxContainer.className = 'fx-container';
    wrapper.appendChild(fxContainer);

    // 2. Apply Effect
    if (type === 'tap') {
        wrapper.classList.add('anim-tap');
        const ripple = document.createElement('div');
        ripple.className = 'fx-ripple';
        fxContainer.appendChild(ripple);
    }
    else if (type === 'heart') {
        wrapper.classList.add('anim-heart');
        const emojis = ['❤️', '💖', '🔥', '😍'];
        for(let i=0; i<6; i++) {
            const p = document.createElement('div');
            p.className = 'fx-heart-particle';
            p.innerText = emojis[Math.floor(Math.random()*emojis.length)];
            // Random scatter math
            p.style.setProperty('--tx', (Math.random()*100 - 50) + 'px'); 
            p.style.animationDelay = (Math.random()*0.3) + 's';
            fxContainer.appendChild(p);
        }
    }
    else if (type === 'spy') {
        wrapper.classList.add('anim-spy');
        
        // 1. Создаем контейнер для Spy эффектов
        const spyContainer = document.createElement('div');
        spyContainer.className = 'fx-spy-container';
        
        // 2. Создаем вращающийся луч (Radar Sweep)
        const sweep = document.createElement('div');
        sweep.className = 'fx-radar-sweep';
        spyContainer.appendChild(sweep);
        
        // 3. Создаем кольца сонара (Sonar Rings)
        const r1 = document.createElement('div');
        r1.className = 'fx-sonar-ring sonar-1';
        spyContainer.appendChild(r1);
        
        const r2 = document.createElement('div');
        r2.className = 'fx-sonar-ring sonar-2';
        spyContainer.appendChild(r2);
        
        // 4. Добавляем в основной контейнер эффектов
        fxContainer.appendChild(spyContainer);
    }
    else if (type === 'xray') {
        wrapper.classList.add('anim-xray');
        // Clone image for RGB shift effect
        const avatarDiv = wrapper.querySelector('.avatar');
        if (avatarDiv) {
            const bgImage = avatarDiv.style.backgroundImage;
            const r = document.createElement('div'); r.className = 'fx-rgb red'; r.style.backgroundImage = bgImage;
            const b = document.createElement('div'); b.className = 'fx-rgb blue'; b.style.backgroundImage = bgImage;
            fxContainer.appendChild(r);
            fxContainer.appendChild(b);
        }
    }

    // 3. Cleanup after animation (1.5s safety)
    setTimeout(() => {
        wrapper.classList.remove('anim-tap', 'anim-heart', 'anim-spy', 'anim-xray');
        fxContainer.remove();
    }, 1500);
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
        
        if (currentPlayerId === p.id) {
            card.classList.add('playing');
        }

        let blurClass = '';
        if (phase === 'results') {
            blurClass = ''; 
        } else if (isMe || isXrayActive) {
            blurClass = 'reveal'; 
        } else {
            blurClass = 'blur-mask'; 
        }
        
        const badgePosClass = isLeftTeam ? 'pos-right' : 'pos-left';

        const showCheck = p.has_answer && phase !== 'voting' && phase !== 'results';

        card.innerHTML = `
            <div class="avatar-wrapper">
                <div class="avatar ${blurClass}" style="background-image:url('${p.photo || ''}')"></div>
                <div class="status-check ${badgePosClass}" style="display:${showCheck ? 'flex' : 'none'}">
                    <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
            </div>
            <div class="name-tag" style="${isMe ? 'color:var(--neon-blue)' : ''}">${isMe ? 'YOU' : p.name}</div>
        `;

        card.onclick = () => {
            if (selectedGiftType) { sendGiftToPlayer(p, selectedGiftType); return; }
            
            // --- NEW: Trigger Tap Animation ---
            const wrapper = card.querySelector('.avatar-wrapper');
            triggerAvatarAnim(wrapper, 'tap');
            // ----------------------------------
        
            if (isMe) return;
            if (phase === 'listening' && p.has_answer) activateSpotlight(p);
            if (phase === 'voting') castVote(p);
            if (phase === 'results') {
                    openStoicModal(p);
            }
        };

        grid.appendChild(card);
    });
}

// --- INPUT (SYSTEM PROMPT) ---

async function openTextInput() {
    if (currentPhase !== 'recording') return;
    
    const text = prompt("Your answer (max 50 chars):", "");
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

// --- SPY MODAL & STOIC MODAL ---

function openProfileModal(url) {
    // Generic view for chat images
    if (!url) return;
    document.getElementById('profile-large-img').src = url;
    document.getElementById('stoic-name').innerText = "PROFILE VIEW";
    document.getElementById('stoic-city').innerText = "";
    document.getElementById('modal-actions-container').innerHTML = '';
    document.getElementById('profile-modal').classList.add('active');
}

function openStoicModal(player) {
    // 1. Set Info
    document.getElementById('profile-large-img').src = player.photo;
    document.getElementById('stoic-name').innerText = player.name;
    // If city/age is not available in game data, show generic or hide
    document.getElementById('stoic-city').innerText = "PLAYER"; 
    
    // 2. Open Modal
    const modal = document.getElementById('profile-modal');
    modal.classList.add('active');

    // 3. Generate Actions
    const actionsDiv = document.getElementById('modal-actions-container');
    actionsDiv.innerHTML = '';

    if (!lastVotesMap) return;

    const theyVotedForMe = lastVotesMap[player.id] === USER_ID;
    const iVotedForThem = lastVotesMap[USER_ID] === player.id;
    const isMatch = theyVotedForMe && iVotedForThem;

    if (isMatch) {
        // Mutual Match -> Write
        const btn = document.createElement('button');
        btn.className = 'stoic-btn btn-write';
        btn.innerText = 'WRITE MESSAGE';
        btn.onclick = () => {
             closeProfileModal();
             openChatWithUser(player.id, player.name, player.photo);
        };
        actionsDiv.appendChild(btn);
    } else {
        // No Match (or one-sided) -> 2nd Chance
        const btn = document.createElement('button');
        btn.className = 'stoic-btn btn-chance';
        btn.innerText = '2ND CHANCE (100 COINS)';
        btn.onclick = () => {
            closeProfileModal();
            buySecondChance(player.id, player.name, player.photo);
        };
        actionsDiv.appendChild(btn);
    }
}

function closeProfileModal() {
    profileModal.classList.remove('active');
}

// --- GIFTS & VFX ---

function openGiftModal() {
    giftModal.classList.add('active');
}

function closeGiftModal() {
    giftModal.classList.remove('active');
}

function selectGift(type) {
    // 1. Close Modal
    try {
        document.getElementById('gift-modal').classList.remove('active');
    } catch(e) {}

    // 2. Set Type
    selectedGiftType = type;

    // 3. Show Sticky Bar with Dynamic Icon
    const bar = document.getElementById('gift-sticky-bar');
    const title = document.getElementById('sticky-gift-name');
    const iconContainer = document.querySelector('.sticky-icon');
    
    if (bar && title && iconContainer) {
        title.innerText = type.toUpperCase();
        
        // Inject SVG
        iconContainer.innerHTML = `<svg viewBox="0 0 24 24">${GIFT_ICONS[type]}</svg>`;
        // Set Color
        iconContainer.style.color = GIFT_COLORS[type];
        
        bar.classList.remove('hidden');
    }
    
    // Haptic
    if (window.Telegram && Telegram.WebApp.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.selectionChanged();
    }
}

function cancelGiftSelection() {
    selectedGiftType = null;
    const bar = document.getElementById('gift-sticky-bar');
    if (bar) bar.classList.add('hidden'); 
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
                // --- NEW: Trigger Gift Animation ---
                const wrapper = card.querySelector('.avatar-wrapper');
                triggerAvatarAnim(wrapper, type);
                // -----------------------------------
            }
        
            if (type === 'spy') {
                setTimeout(() => openProfileModal(player.photo), 1400); // Delay slightly for animation
            }
            else if (type === 'xray') {
                isXrayActive = true;
                document.querySelectorAll('.avatar.blur-mask').forEach(el => {
                    el.classList.remove('blur-mask');
                    el.classList.add('reveal');
                });
            }

        } else {
            alert(data.msg === 'No money' ? "Not enough coins!" : "Error");
        }
    } catch (e) { console.error(e); }
    
    selectedGiftType = null;
    cancelGiftSelection(); // Hide bar immediately
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
    if (selectedGiftType) {
        sendGiftToPlayer(player, selectedGiftType);
        return; 
    }

    // --- SPOTLIGHT LOGIC ---
    
    if (currentPlayerId === player.id) { stopPlayback(); return; }
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }

    currentPlayerId = player.id;

    // Highlight Card
    document.querySelectorAll('.player-card').forEach(c => c.classList.remove('playing'));
    const card = document.getElementById(`player-${player.id}`);
    if (card) card.classList.add('playing');

    // Toggle Header
    document.getElementById('question-view').classList.add('hidden');
    
    const spotlightView = document.getElementById('spotlight-view');
    const spotlightContent = document.getElementById('spotlight-content');
    const spotlightName = document.getElementById('spotlight-name');
    
    spotlightView.classList.remove('hidden');
    spotlightName.innerText = player.name;
    spotlightContent.innerHTML = "";

    // Content (Audio or Text)
    if (player.answer_type === 'audio') {
        spotlightContent.innerHTML = `
            <div class="waveform-container active">
                <div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div>
                <div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div>
            </div>`;
        
        currentAudio = new Audio(player.answer_content);
        currentAudio.play();
        currentAudio.onended = stopPlayback;
    } else {
        const textDiv = document.createElement('div');
        textDiv.className = 'typewriter-text';
        textDiv.style.whiteSpace = 'pre-wrap';
        textDiv.innerText = player.answer_content; 
        spotlightContent.appendChild(textDiv);
    }
}

function stopPlayback() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    currentPlayerId = null;
    
    // Toggle Header Views Back
    document.getElementById('spotlight-view').style.display = 'none';
    document.getElementById('spotlight-view').classList.add('hidden');
    document.getElementById('question-view').style.display = 'flex';

    // Remove Ripple
    document.querySelectorAll('.player-card').forEach(c => c.classList.remove('playing'));
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
        <marker id="arrowhead-match" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#ffd700" /></marker>
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
    // Update Tab UI
    document.getElementById('tab-active').classList.toggle('active', filter === 'active');
    document.getElementById('tab-archive').classList.toggle('active', filter === 'archived');

    const container = document.getElementById('chat-list-container');
    container.innerHTML = '';
    
    const filtered = loadedChats.filter(c => c.status === filter);
    
    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#555; margin-top:50px;">${filter === 'active' ? 'No active chats' : 'Archive empty'}</div>`;
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
    if (!confirm("Restore chat for 50 coins?")) return;
    
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
            alert(data.msg === 'No money' ? "Not enough coins!" : "Error");
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
        } else if (m.type === 'game_invite') {
            div.className = 'glass-bubble';
            const isMe = m.sender_id === USER_ID;
            
            const btnText = isMe ? 'RETURN TO GAME' : 'JOIN GAME';
            const clickAction = isMe ? 'openGamePanel()' : 'acceptGame()';
            
            div.innerHTML = `
                <div class="glass-title">SYNC GAME</div>
                <div class="glass-subtitle">${isMe ? 'Waiting for opponent...' : 'Match answers to win'}</div>
                <button class="glass-btn" onclick="${clickAction}">${btnText}</button>
            `;
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
            alert(data.msg || "Send Error");
        }
    } catch (e) { console.error(e); }
}

// --- SYNC GAME LOGIC ---

async function sendGameInvite() {
    if (!currentChatId) return;
    try {
        const res = await fetch(SYNC_START_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, chat_id: currentChatId })
        });
        const data = await res.json();
        if (data.status === 'success') {
            fetchMessages();
            openGamePanel();
        } else {
            alert(data.msg);
        }
    } catch (e) { console.error(e); }
}

async function acceptGame() {
    if (!currentChatId) return;
    try {
        const res = await fetch(SYNC_ACCEPT_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, chat_id: currentChatId })
        });
        const data = await res.json();
        if (data.status === 'success') {
            openGamePanel();
        } else {
            alert(data.msg);
        }
    } catch (e) { console.error(e); }
}

function openGamePanel() {
    isSyncPanelOpen = true;
    gameBottomSheet.classList.add('active');
    if (syncGameInterval) clearInterval(syncGameInterval);
    syncGameInterval = setInterval(pollSyncGame, 1000);
    pollSyncGame(); // Immediate call
}

function closeGamePanel() {
    isSyncPanelOpen = false;
    gameBottomSheet.classList.remove('active');
    if (syncGameInterval) clearInterval(syncGameInterval);
}

async function pollSyncGame() {
    if (!currentChatId || !isSyncPanelOpen) return;
    
    try {
        const res = await fetch(SYNC_STATE_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, chat_id: currentChatId })
        });
        const data = await res.json();
        
        if (data.status === 'none') {
            closeGamePanel();
            return;
        }
        
        // Update UI
        let hearts = "";
        for(let i=0; i<data.lives; i++) hearts += "❤️";
        document.getElementById('sync-lives').innerText = hearts;
        document.getElementById('sync-round').innerText = "ROUND " + data.round;
        
        const qText = document.getElementById('sync-question-text');
        const optionsContainer = document.querySelector('.sync-options');
        const statusText = document.getElementById('sync-status-text');
        
        if (data.status === 'game_over') {
            qText.innerText = "GAME OVER";
            optionsContainer.innerHTML = "";
            statusText.innerText = "Lives depleted.";
            return;
        }
        
        if (data.status === 'waiting') {
            qText.innerText = "Waiting for opponent...";
            optionsContainer.innerHTML = "";
            return;
        }
        
        // Active Game
        if (data.question) {
            qText.innerText = data.question.q;
            
            // Dynamic Buttons
            optionsContainer.innerHTML = "";
            data.question.options.forEach((optText, index) => {
                const btn = document.createElement('button');
                btn.className = 'glass-opt-btn';
                btn.innerText = optText;
                btn.onclick = () => submitSyncAnswer(index);
                
                if (data.has_answered) {
                    btn.disabled = true;
                    btn.style.opacity = 0.5;
                }
                
                optionsContainer.appendChild(btn);
            });
        }
        
        if (data.has_answered) {
            statusText.innerText = data.waiting_for_opponent ? "Waiting for opponent..." : "Processing...";
        } else {
            statusText.innerText = "Choose wisely!";
        }
        
    } catch (e) { console.error(e); }
}

async function submitSyncAnswer(option) {
    try {
        await fetch(SYNC_ANSWER_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, chat_id: currentChatId, option: option })
        });
        tg.HapticFeedback.impactOccurred('medium');
        pollSyncGame();
    } catch (e) { console.error(e); }
}

// --- NEW FEATURES: SECOND CHANCE & INSTANT WRITE ---

async function buySecondChance(targetId, name, photo) {
    if (!confirm(`Use "Second Chance" for 100 coins? This creates a chat with ${name}.`)) return;

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
            forceExit(); 
            openChat(data.chat_id, name, photo, targetId);
        } else {
            alert(data.msg === 'No money' ? "Not enough coins!" : "Error: " + data.msg);
        }
    } catch (e) { console.error(e); }
}

async function openChatWithUser(targetId, name, photo) {
    try {
        const res = await fetch(CHAT_CHECK_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: USER_ID, target_id: targetId })
        });
        const data = await res.json();

        if (data.status === 'success') {
            forceExit(); 
            openChat(data.chat_id, name, photo, targetId);
        } else {
            alert("Error: Chat not found");
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
    
    let reason = null;

    if (tg.showPopup) {
        tg.showPopup({
            title: 'Report User',
            message: 'Select a reason for reporting:',
            buttons: [
                {id: 'spam', type: 'default', text: 'Spam'},
                {id: 'abuse', type: 'destructive', text: 'Abuse/Insult'},
                {id: '18+', type: 'destructive', text: '18+ Content'},
                {id: 'cancel', type: 'cancel'}
            ]
        }, async (btnId) => {
            if (btnId && btnId !== 'cancel') {
                await sendReport(btnId);
            }
        });
    } else {
        reason = prompt("Reason (Spam, Abuse, 18+):");
        if (reason) {
            await sendReport(reason);
        }
    }
}

async function sendReport(reason) {
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
            alert("Report sent. Thank you!");
        } else {
            alert("Error sending report.");
        }
    } catch (e) { console.error(e); }
}