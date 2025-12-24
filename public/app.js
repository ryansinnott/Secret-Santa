// Socket connection
let socket = null;

// Current room code (for revealed mode)
let currentRoomCode = null;

// Get the base path for API calls (handles subpath hosting)
var basePath = window.basePath || window.location.pathname.replace(/\/[^/]*$/, '');

// Secret mode data
let players = [];
let assignments = [];
let currentIndex = 0;

// DOM Elements - Mode Selection
const modeSelection = document.getElementById('mode-selection');

// DOM Elements - Secret Mode
const secretSetup = document.getElementById('secret-setup');
const secretReveal = document.getElementById('secret-reveal');
const nameInput = document.getElementById('name-input');
const playerList = document.getElementById('player-list');
const playerCount = document.getElementById('player-count');
const startBtn = document.getElementById('start-btn');
const currentNumber = document.getElementById('current-number');
const currentName = document.getElementById('current-name');
const currentIndexSpan = document.getElementById('current-index');
const totalPlayers = document.getElementById('total-players');
const nextBtn = document.getElementById('next-btn');
const restartBtn = document.getElementById('restart-btn');

// DOM Elements - Revealed Mode
const revealedSetup = document.getElementById('revealed-setup');
const revealedStarted = document.getElementById('revealed-started');
const createRoomBtn = document.getElementById('create-room-btn');
const roomInfo = document.getElementById('room-info');
const qrCode = document.getElementById('qr-code');
const roomCodeText = document.getElementById('room-code-text');
const joinedCount = document.getElementById('joined-count');
const joinedList = document.getElementById('joined-list');
const startRevealedBtn = document.getElementById('start-revealed-btn');
const assignedCount = document.getElementById('assigned-count');

// ==========================================
// MODE SELECTION
// ==========================================

function selectMode(mode) {
    modeSelection.classList.add('hidden');

    if (mode === 'secret') {
        secretSetup.classList.remove('hidden');
        nameInput.focus();
    } else {
        revealedSetup.classList.remove('hidden');
        initSocket();
    }
}

function goBack() {
    // Hide all phases
    secretSetup.classList.add('hidden');
    secretReveal.classList.add('hidden');
    revealedSetup.classList.add('hidden');
    revealedStarted.classList.add('hidden');

    // Reset data
    players = [];
    assignments = [];
    currentIndex = 0;
    currentRoomCode = null;
    updatePlayerList();

    // Reset room info
    roomInfo.classList.add('hidden');
    createRoomBtn.classList.remove('hidden');

    // Show mode selection
    modeSelection.classList.remove('hidden');

    // Disconnect socket if connected
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

// ==========================================
// SECRET MODE FUNCTIONS
// ==========================================

// Add name when Enter is pressed
nameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addName();
    }
});

function addName() {
    const name = nameInput.value.trim();

    if (name === '') {
        return;
    }

    if (players.includes(name)) {
        alert('This name is already in the list!');
        return;
    }

    players.push(name);
    updatePlayerList();
    nameInput.value = '';
    nameInput.focus();
}

function removeName(index) {
    players.splice(index, 1);
    updatePlayerList();
}

function updatePlayerList() {
    playerList.innerHTML = '';

    players.forEach((name, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${name}</span>
            <button class="remove-btn" onclick="removeName(${index})">×</button>
        `;
        playerList.appendChild(li);
    });

    playerCount.textContent = players.length;
    startBtn.disabled = players.length < 2;
}

function shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function startSecretGame() {
    if (players.length < 2) {
        alert('Please add at least 2 players!');
        return;
    }

    const shuffledPlayers = shuffle(players);

    assignments = shuffledPlayers.map((name, index) => ({
        number: index + 1,
        name: name
    }));

    currentIndex = 0;
    showCurrentPerson();

    secretSetup.classList.add('hidden');
    secretReveal.classList.remove('hidden');

    totalPlayers.textContent = assignments.length;
}

function showCurrentPerson() {
    const person = assignments[currentIndex];

    currentNumber.textContent = person.number;
    currentName.textContent = person.name;
    currentIndexSpan.textContent = currentIndex + 1;

    const card = document.querySelector('.reveal-card');
    card.style.animation = 'none';
    card.offsetHeight;
    card.style.animation = 'fadeIn 0.5s ease-out';

    if (currentIndex >= assignments.length - 1) {
        nextBtn.classList.add('hidden');
        restartBtn.classList.remove('hidden');
    } else {
        nextBtn.classList.remove('hidden');
        restartBtn.classList.add('hidden');
    }
}

function nextPerson() {
    if (currentIndex < assignments.length - 1) {
        currentIndex++;
        showCurrentPerson();
    }
}

function restart() {
    players = [];
    assignments = [];
    currentIndex = 0;
    currentRoomCode = null;

    updatePlayerList();

    // Hide all phases
    secretReveal.classList.add('hidden');
    secretSetup.classList.add('hidden');
    revealedSetup.classList.add('hidden');
    revealedStarted.classList.add('hidden');

    // Reset room info
    roomInfo.classList.add('hidden');
    createRoomBtn.classList.remove('hidden');
    joinedList.innerHTML = '';
    joinedCount.textContent = '0';
    startRevealedBtn.disabled = true;

    // Show mode selection
    modeSelection.classList.remove('hidden');

    // Disconnect socket
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

// ==========================================
// REVEALED MODE FUNCTIONS
// ==========================================

function initSocket() {
    if (socket) return;

    socket = io({ path: basePath + '/socket.io' });

    socket.on('player-list', (players) => {
        updateJoinedList(players);
    });

    socket.on('game-started', (data) => {
        revealedSetup.classList.add('hidden');
        revealedStarted.classList.remove('hidden');
        assignedCount.textContent = data.totalPlayers;
    });

    socket.on('start-error', (message) => {
        alert(message);
    });
}

async function createRoom() {
    try {
        const response = await fetch(basePath + '/api/create-room');
        const data = await response.json();

        if (data.success) {
            currentRoomCode = data.code;

            qrCode.src = data.qrCode;
            roomCodeText.textContent = data.code;

            createRoomBtn.classList.add('hidden');
            roomInfo.classList.remove('hidden');

            // Join as host
            socket.emit('host-join', data.code);
        } else {
            alert('Failed to create room. Please try again.');
        }
    } catch (error) {
        alert('Error creating room. Please try again.');
        console.error(error);
    }
}

function updateJoinedList(players) {
    joinedList.innerHTML = '';

    players.forEach((player, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${index + 1}. ${player.name}</span>`;
        joinedList.appendChild(li);
    });

    joinedCount.textContent = players.length;
    startRevealedBtn.disabled = players.length < 2;
}

function startRevealedGame() {
    if (!currentRoomCode) return;

    socket.emit('start-game', currentRoomCode);
}
