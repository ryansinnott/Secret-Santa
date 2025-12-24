// Socket connection
let socket = null;

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
        const response = await fetch(`/api/room/${roomCode}`);
        const data = await response.json();

        if (!data.exists) {
            showError('Room not found. Check the code and try again.');
            return;
        }

        if (data.started) {
            showError('This game has already started.');
            return;
        }
    } catch (error) {
        showError('Connection error. Please try again.');
        return;
    }

    // Connect via socket
    socket = io();

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
