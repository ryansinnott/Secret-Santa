const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Trust proxy for correct protocol detection behind reverse proxy
app.set('trust proxy', true);

// Base path for hosting at a subpath (e.g., '/projects/secretsanta')
const BASE_PATH = process.env.BASE_PATH || '';

// Optional: Full base URL override (e.g., 'https://syntrava.com.au/projects/secretsanta')
const BASE_URL = process.env.BASE_URL || '';

const io = new Server(server, {
    path: BASE_PATH + '/socket.io'
});

// Serve static files from public folder
app.use(BASE_PATH, express.static(path.join(__dirname, 'public')));

// Store active game rooms
const rooms = new Map();

// Generate a random 6-character room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars like O, 0, I, 1
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Fisher-Yates shuffle
function shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// API endpoint to create a new room
app.get(BASE_PATH + '/api/create-room', async (req, res) => {
    let code = generateRoomCode();

    // Make sure code is unique
    while (rooms.has(code)) {
        code = generateRoomCode();
    }

    // Create the room
    rooms.set(code, {
        players: [],
        started: false,
        assignments: null
    });

    // Generate QR code URL
    // Priority: BASE_URL env var > Referer header > constructed from request
    let baseUrl;
    if (BASE_URL) {
        baseUrl = BASE_URL;
    } else {
        // Try to get the base URL from the Referer header (most reliable for subpath hosting)
        const referer = req.get('referer');
        if (referer) {
            // Extract base URL from referer (remove filename if present)
            baseUrl = referer.replace(/\/[^/]*\.[^/]*$/, '').replace(/\/$/, '');
        } else {
            baseUrl = `${req.protocol}://${req.get('host')}${BASE_PATH}`;
        }
    }
    const joinUrl = `${baseUrl}/join.html?room=${code}`;
    console.log('Generated join URL:', joinUrl);

    try {
        const qrCodeDataUrl = await QRCode.toDataURL(joinUrl, {
            width: 300,
            margin: 2,
            color: {
                dark: '#1a472a',
                light: '#ffffff'
            }
        });

        res.json({
            success: true,
            code: code,
            joinUrl: joinUrl,
            qrCode: qrCodeDataUrl
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to generate QR code' });
    }
});

// API endpoint to check if room exists
app.get(BASE_PATH + '/api/room/:code', (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = rooms.get(code);

    if (room) {
        res.json({
            exists: true,
            started: room.started,
            playerCount: room.players.length
        });
    } else {
        res.json({ exists: false });
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Host joins their room
    socket.on('host-join', (roomCode) => {
        const code = roomCode.toUpperCase();
        socket.join(code);
        socket.roomCode = code;
        socket.isHost = true;

        const room = rooms.get(code);
        if (room) {
            // Send current player list to host
            socket.emit('player-list', room.players);
        }
    });

    // Player joins a room
    socket.on('player-join', ({ roomCode, playerName }) => {
        const code = roomCode.toUpperCase();
        const room = rooms.get(code);

        if (!room) {
            socket.emit('join-error', 'Room not found');
            return;
        }

        if (room.started) {
            socket.emit('join-error', 'Game has already started');
            return;
        }

        // Check for duplicate names
        if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
            socket.emit('join-error', 'Name already taken');
            return;
        }

        // Add player to room
        const player = {
            id: socket.id,
            name: playerName
        };
        room.players.push(player);

        socket.join(code);
        socket.roomCode = code;
        socket.playerName = playerName;

        // Confirm join to player
        socket.emit('join-success', { playerName });

        // Notify host of updated player list
        io.to(code).emit('player-list', room.players);
    });

    // Host adds a manual player (for QR mode)
    socket.on('add-manual-player', ({ roomCode, playerName }) => {
        const code = roomCode.toUpperCase();
        const room = rooms.get(code);

        if (!room) {
            return;
        }

        if (room.started) {
            return;
        }

        // Check for duplicate names
        if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
            return;
        }

        // Add manual player (no socket id, they won't receive their number on a device)
        const player = {
            id: 'manual-' + Date.now(),
            name: playerName,
            isManual: true
        };
        room.players.push(player);

        // Notify host of updated player list
        io.to(code).emit('player-list', room.players);
    });

    // Host starts the game
    socket.on('start-game', (data) => {
        // Support both old format (string) and new format (object)
        const roomCode = typeof data === 'string' ? data : data.roomCode;
        const publicNumbers = typeof data === 'object' ? data.publicNumbers : false;

        const code = roomCode.toUpperCase();
        const room = rooms.get(code);

        if (!room || room.players.length < 2) {
            socket.emit('start-error', 'Need at least 2 players');
            return;
        }

        room.started = true;

        // Shuffle and assign numbers
        const shuffledPlayers = shuffle(room.players);
        room.assignments = shuffledPlayers.map((player, index) => ({
            id: player.id,
            name: player.name,
            number: index + 1
        }));

        // Prepare response for host
        const gameStartedData = {
            totalPlayers: room.players.length
        };

        // If public numbers, include assignments for ladder display
        if (publicNumbers) {
            gameStartedData.assignments = room.assignments.map(a => ({
                number: a.number,
                name: a.name
            }));
        }

        // Notify host that game started
        socket.emit('game-started', gameStartedData);

        // Send each player their number privately
        room.assignments.forEach(assignment => {
            io.to(assignment.id).emit('your-number', {
                number: assignment.number,
                total: room.assignments.length
            });
        });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        if (socket.roomCode && !socket.isHost) {
            const room = rooms.get(socket.roomCode);
            if (room && !room.started) {
                // Remove player from room
                room.players = room.players.filter(p => p.id !== socket.id);

                // Notify host of updated player list
                io.to(socket.roomCode).emit('player-list', room.players);
            }
        }
    });
});

// Clean up old rooms periodically (every hour)
setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms.entries()) {
        // Remove rooms older than 2 hours
        if (room.createdAt && now - room.createdAt > 2 * 60 * 60 * 1000) {
            rooms.delete(code);
        }
    }
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Silly Santa server running on http://localhost:${PORT}`);
});
