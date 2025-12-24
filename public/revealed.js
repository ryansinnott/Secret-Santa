// Socket connection
let socket = null;

// Current room code
let currentRoomCode = null;

// Current assignments (for managing participants)
let currentAssignments = [];

// Index of participant to remove
let removeIndex = null;

// Manual entry players list
let manualPlayers = [];

// Mystery mode state
let mysteryCurrentIndex = 0;
let hideOrderEnabled = false;

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

// Manual entry elements
const entryMethodCards = document.querySelector('.entry-method-cards');
const qrMode = document.getElementById('qr-mode');
const manualMode = document.getElementById('manual-mode');
const backToMethods = document.getElementById('back-to-methods');
const backToHome = document.getElementById('back-to-home');
const manualNameInput = document.getElementById('manual-name-input');
const manualPlayerList = document.getElementById('manual-player-list');
const manualPlayerCount = document.getElementById('manual-player-count');
const manualStartBtn = document.getElementById('manual-start-btn');

// Entry method selection
function showQRMode() {
    entryMethodCards.classList.add('hidden');
    backToHome.classList.add('hidden');
    qrMode.classList.remove('hidden');
    backToMethods.classList.remove('hidden');
}

function showManualMode() {
    entryMethodCards.classList.add('hidden');
    backToHome.classList.add('hidden');
    manualMode.classList.remove('hidden');
    backToMethods.classList.remove('hidden');
    manualNameInput.focus();
}

function showMethodSelection() {
    entryMethodCards.classList.remove('hidden');
    backToHome.classList.remove('hidden');
    qrMode.classList.add('hidden');
    manualMode.classList.add('hidden');
    backToMethods.classList.add('hidden');
}

// Manual entry functions
function addManualName() {
    const name = manualNameInput.value.trim();

    if (name === '') return;

    if (manualPlayers.includes(name)) {
        alert('This name is already in the list!');
        return;
    }

    manualPlayers.push(name);
    updateManualPlayerList();
    manualNameInput.value = '';
    manualNameInput.focus();
}

function removeManualName(index) {
    manualPlayers.splice(index, 1);
    updateManualPlayerList();
}

function updateManualPlayerList() {
    manualPlayerList.innerHTML = '';

    manualPlayers.forEach((name, index) => {
        const li = document.createElement('li');

        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => removeManualName(index);

        li.appendChild(nameSpan);
        li.appendChild(removeBtn);
        manualPlayerList.appendChild(li);
    });

    manualPlayerCount.textContent = manualPlayers.length;
    manualStartBtn.disabled = manualPlayers.length < 2;
}

function shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function startManualGame() {
    if (manualPlayers.length < 2) {
        alert('Please add at least 2 players!');
        return;
    }

    const shuffledPlayers = shuffle(manualPlayers);

    currentAssignments = shuffledPlayers.map((name, index) => ({
        number: index + 1,
        name: name
    }));

    revealedSetup.classList.add('hidden');

    // Check if mystery mode is enabled
    const mysteryModeToggle = document.getElementById('mystery-mode-toggle');
    if (mysteryModeToggle && mysteryModeToggle.checked) {
        // Start mystery mode reveal
        mysteryCurrentIndex = 0;
        showMysteryReveal();
    } else {
        // Show ladder
        revealedLadder.classList.remove('hidden');
        renderLadder();
    }
}

// Add enter key support for manual input
document.addEventListener('DOMContentLoaded', function() {
    if (manualNameInput) {
        manualNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addManualName();
            }
        });
    }
});

// Initialize socket connection
function initSocket() {
    if (socket) return;

    socket = io({ path: basePath + '/socket.io' });

    socket.on('player-list', (players) => {
        updateJoinedList(players);
    });

    socket.on('game-started', (data) => {
        revealedSetup.classList.add('hidden');

        // Show ladder view
        if (data.assignments) {
            showLadder(data.assignments);
        }
        revealedLadder.classList.remove('hidden');

        // Check if hide order was enabled
        const hideOrderToggle = document.getElementById('hide-order-toggle');
        if (hideOrderToggle && hideOrderToggle.checked) {
            document.getElementById('show-order-toggle').checked = false;
            document.querySelector('.ladder-container').style.display = 'none';
        }
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
        const span = document.createElement('span');
        span.textContent = `${index + 1}. ${player.name}`;
        li.appendChild(span);
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

// Add a player manually in QR code mode
function addQRManualPlayer() {
    const nameInput = document.getElementById('qr-manual-name');
    const name = nameInput.value.trim();

    if (!name) return;
    if (!currentRoomCode) {
        alert('Please generate a QR code first');
        return;
    }

    // Emit to server to add manual player
    socket.emit('add-manual-player', { roomCode: currentRoomCode, playerName: name });
    nameInput.value = '';
    nameInput.focus();
}

// Add enter key support for QR manual input
document.addEventListener('DOMContentLoaded', function() {
    const qrManualInput = document.getElementById('qr-manual-name');
    if (qrManualInput) {
        qrManualInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addQRManualPlayer();
            }
        });
    }
});

// Show the ladder with all assignments
function showLadder(assignments) {
    currentAssignments = assignments;
    renderLadder();
}

function renderLadder() {
    ladderList.innerHTML = '';

    currentAssignments.forEach((assignment, index) => {
        const li = document.createElement('li');
        li.style.animationDelay = `${index * 0.1}s`;

        const numberSpan = document.createElement('span');
        numberSpan.className = 'ladder-number';
        numberSpan.textContent = index + 1;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'ladder-name';
        nameSpan.textContent = assignment.name;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'ladder-remove-btn';
        removeBtn.textContent = '✕';
        removeBtn.onclick = () => showConfirmRemove(index, assignment.name);

        li.appendChild(numberSpan);
        li.appendChild(nameSpan);
        li.appendChild(removeBtn);
        ladderList.appendChild(li);
    });
}

// Show add participant modal
function showAddParticipant() {
    document.getElementById('add-participant-modal').classList.remove('hidden');
    document.getElementById('new-participant-name').value = '';
    document.getElementById('specific-position').value = '';
    document.querySelector('input[name="position"][value="random"]').checked = true;
}

// Hide add participant modal
function hideAddParticipant() {
    document.getElementById('add-participant-modal').classList.add('hidden');
}

// Add a new participant
function addParticipant() {
    const nameInput = document.getElementById('new-participant-name');
    const name = nameInput.value.trim();

    if (!name) {
        alert('Please enter a name');
        return;
    }

    const positionType = document.querySelector('input[name="position"]:checked').value;
    let position;

    if (positionType === 'random') {
        position = Math.floor(Math.random() * (currentAssignments.length + 1));
    } else if (positionType === 'last') {
        position = currentAssignments.length;
    } else {
        const specificPos = parseInt(document.getElementById('specific-position').value);
        if (isNaN(specificPos) || specificPos < 1) {
            alert('Please enter a valid position number');
            return;
        }
        position = Math.min(specificPos - 1, currentAssignments.length);
    }

    // Insert at position
    currentAssignments.splice(position, 0, { name: name, number: position + 1 });

    // Re-render
    renderLadder();
    hideAddParticipant();
}

// Show confirm remove modal
function showConfirmRemove(index, name) {
    removeIndex = index;
    document.getElementById('remove-name').textContent = name;
    document.getElementById('confirm-remove-modal').classList.remove('hidden');
}

// Hide confirm remove modal
function hideConfirmRemove() {
    removeIndex = null;
    document.getElementById('confirm-remove-modal').classList.add('hidden');
}

// Confirm and remove participant
function confirmRemove() {
    if (removeIndex !== null) {
        currentAssignments.splice(removeIndex, 1);
        renderLadder();
    }
    hideConfirmRemove();
}

function restart() {
    window.location.href = 'index.html';
}

// Mystery mode functions
function showMysteryReveal() {
    const mysteryReveal = document.getElementById('mystery-reveal');
    mysteryReveal.classList.remove('hidden');
    document.getElementById('mystery-total-players').textContent = currentAssignments.length;
    showMysteryCurrentPerson();
}

function showMysteryCurrentPerson() {
    const person = currentAssignments[mysteryCurrentIndex];

    document.getElementById('mystery-current-number').textContent = person.number;
    document.getElementById('mystery-current-name').textContent = person.name;
    document.getElementById('mystery-current-index').textContent = mysteryCurrentIndex + 1;

    const card = document.querySelector('#mystery-reveal .reveal-card');
    if (card) {
        card.style.animation = 'none';
        card.offsetHeight;
        card.style.animation = 'fadeIn 0.5s ease-out';
    }

    const nextBtn = document.getElementById('mystery-next-btn');
    const restartBtn = document.getElementById('mystery-restart-btn');

    if (mysteryCurrentIndex >= currentAssignments.length - 1) {
        nextBtn.classList.add('hidden');
        restartBtn.classList.remove('hidden');
    } else {
        nextBtn.classList.remove('hidden');
        restartBtn.classList.add('hidden');
    }
}

function mysteryNextPerson() {
    if (mysteryCurrentIndex < currentAssignments.length - 1) {
        mysteryCurrentIndex++;
        showMysteryCurrentPerson();
    }
}

// Help modal functions
function showMysteryModeHelp() {
    document.getElementById('mystery-help-modal').classList.remove('hidden');
}

function showHideOrderHelp() {
    document.getElementById('hide-order-help-modal').classList.remove('hidden');
}

function hideHelpModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// Toggle order visibility on ladder
function toggleOrderVisibility() {
    const showOrderToggle = document.getElementById('show-order-toggle');
    const ladderContainer = document.querySelector('.ladder-container');

    if (showOrderToggle.checked) {
        ladderContainer.style.display = 'block';
    } else {
        ladderContainer.style.display = 'none';
    }
}
