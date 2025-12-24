// Secret mode data
let players = [];
let assignments = [];
let currentIndex = 0;

// DOM Elements
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

// Add name when Enter is pressed
nameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addName();
    }
});

// Focus on input when page loads
nameInput.focus();

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

        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => removeName(index);

        li.appendChild(nameSpan);
        li.appendChild(removeBtn);
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
    window.location.href = 'index.html';
}
