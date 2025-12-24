// Socket connection
let socket = null;

// Current room code
let currentRoomCode = null;

// Get the base path for API calls (handles subpath hosting)
var basePath = window.basePath || window.location.pathname.replace(/\/[^/]*$/, '');

// DOM Elements
const revealedSetup = document.getElementById('revealed-setup');
const revealedLadder = document.getElementById('revealed-ladder');
const createRoomBtn = document.getElementById('create-room-btn');
const roomInfo = document.getElementById('room-info');
const qrCode = document.getElementById('qr-code');
const roomCodeText = document.getElementById('room-code-text');
const joinedCount = document.getElementById('joined-count');
const joinedList = document.getElementById('joined-list');
const startRevealedBtn = document.getElementById('start-revealed-btn');
const ladderList = document.getElementById('ladder-list');

// Initialize socket connection
function initSocket() {
    if (socket) return;

    socket = io({ path: basePath + '/socket.io' });

    socket.on('player-list', (players) => {
        updateJoinedList(players);
    });

    socket.on('game-started', (data) => {
        revealedSetup.classList.add('hidden');

        // Always show ladder view
        if (data.assignments) {
            showLadder(data.assignments);
        }
        revealedLadder.classList.remove('hidden');
    });

    socket.on('start-error', (message) => {
        alert(message);
    });
}

async function createRoom() {
    // Initialize socket if not already done
    initSocket();

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

    // Always request public numbers for ladder display
    socket.emit('start-game', { roomCode: currentRoomCode, publicNumbers: true });
}

// Show the ladder with all assignments
function showLadder(assignments) {
    ladderList.innerHTML = '';

    assignments.forEach((assignment, index) => {
        const li = document.createElement('li');
        li.style.animationDelay = `${index * 0.1}s`;
        li.innerHTML = `
            <span class="ladder-number">${assignment.number}</span>
            <span class="ladder-name">${assignment.name}</span>
        `;
        ladderList.appendChild(li);
    });
}

function restart() {
    window.location.href = 'index.html';
}
