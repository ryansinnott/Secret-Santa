// Socket connection
let socket = null;

// Store pending name claim info
let pendingClaimName = null;
let pendingRoomCode = null;

// Get the base path for API calls (handles subpath hosting)
var basePath = window.basePath || window.location.pathname.replace(/\/[^/]*$/, '');

// DOM Elements
const joinPhase = document.getElementById('join-phase');
const waitingPhase = document.getElementById('waiting-phase');
const numberPhase = document.getElementById('number-phase');
const roomCodeInput = document.getElementById('room-code-input');
const playerNameInput = document.getElementById('player-name-input');
const joinBtn = document.getElementById('join-btn');
const joinError = document.getElementById('join-error');
const playerNameDisplay = document.getElementById('player-name-display');
const yourNumber = document.getElementById('your-number');
const totalCount = document.getElementById('total-count');

// Check for room code in URL
const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room');

if (roomFromUrl) {
    roomCodeInput.value = roomFromUrl.toUpperCase();
    playerNameInput.focus();
} else {
    roomCodeInput.focus();
}

// Auto-uppercase room code
roomCodeInput.addEventListener('input', function() {
    this.value = this.value.toUpperCase();
});

// Enter key handling
roomCodeInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        playerNameInput.focus();
    }
});

playerNameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        joinGame();
    }
});

function showError(message) {
    joinError.textContent = message;
    joinError.classList.remove('hidden');
}

function hideError() {
    joinError.classList.add('hidden');
}

async function joinGame() {
    hideError();

    const roomCode = roomCodeInput.value.trim().toUpperCase();
    const playerName = playerNameInput.value.trim();

    if (!roomCode || roomCode.length !== 6) {
        showError('Please enter a valid 6-letter room code');
        return;
    }

    if (!playerName) {
        showError('Please enter your name');
        return;
    }

    // Check if room exists first
    try {
        const response = await fetch(`${basePath}/api/room/${roomCode}`);
        const data = await response.json();

        if (!data.exists) {
            showError('Room not found. Check the code and try again.');
            return;
        }
    } catch (error) {
        showError('Connection error. Please try again.');
        return;
    }

    // Connect via socket
    connectAndJoin(roomCode, playerName);
}

function connectAndJoin(roomCode, playerName) {
    socket = io({ path: basePath + '/socket.io' });

    socket.on('connect', () => {
        socket.emit('player-join', {
            roomCode: roomCode,
            playerName: playerName
        });
    });

    socket.on('join-success', (data) => {
        playerNameDisplay.textContent = data.playerName;
        joinPhase.classList.add('hidden');
        waitingPhase.classList.remove('hidden');
    });

    socket.on('join-error', (message) => {
        showError(message);
        socket.disconnect();
        socket = null;
    });

    socket.on('name-exists', (data) => {
        // Show the name exists modal
        pendingClaimName = data.name;
        pendingRoomCode = roomCode;
        showNameExistsModal(data.name);
    });

    socket.on('your-number', (data) => {
        yourNumber.textContent = data.number;
        totalCount.textContent = data.total;
        waitingPhase.classList.add('hidden');
        numberPhase.classList.remove('hidden');
    });

    socket.on('disconnect', () => {
        // Only show error if we're still in waiting phase
        if (!waitingPhase.classList.contains('hidden')) {
            waitingPhase.classList.add('hidden');
            joinPhase.classList.remove('hidden');
            showError('Disconnected from server. Please rejoin.');
        }
    });
}

// Show name exists modal
function showNameExistsModal(name) {
    document.getElementById('existing-name').textContent = name;
    document.getElementById('claim-name-text').textContent = name;
    document.getElementById('name-exists-modal').classList.remove('hidden');
}

// Hide name exists modal
function hideNameExistsModal() {
    document.getElementById('name-exists-modal').classList.add('hidden');
    pendingClaimName = null;
    pendingRoomCode = null;
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    playerNameInput.focus();
}

// Claim the existing name
function claimName() {
    if (!pendingClaimName || !pendingRoomCode || !socket) return;

    document.getElementById('name-exists-modal').classList.add('hidden');

    socket.emit('claim-name', {
        roomCode: pendingRoomCode,
        playerName: pendingClaimName
    });
}
