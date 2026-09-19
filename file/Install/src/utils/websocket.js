import { Server } from 'socket.io';
import { getUserById } from '../models/users.js';
import { consoleLog } from './logger.js';
import CacheUtils from './cache.js';

// Store active connections
const clients = new Map();

// Store game page viewers (gameId -> Set of socketIds)
const gameViewers = new Map();

// Store active chatroom connections per user (userId -> socketId)
const chatroomConnections = new Map();

// Chat history cache configuration
const CHAT_HISTORY_CACHE = 'chatroom-history';
const CHAT_HISTORY_LIMIT = 15;
const CHAT_HISTORY_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Initialize chat history cache
CacheUtils.initCache(CHAT_HISTORY_CACHE, CHAT_HISTORY_DURATION);

// Chat history management functions
async function addToChatHistory(messageData) {
    try {
        let history = await CacheUtils.get(CHAT_HISTORY_CACHE, 'messages') || [];
        
        // Add new message to history
        history.push(messageData);
        
        // Keep only the last 15 messages
        if (history.length > CHAT_HISTORY_LIMIT) {
            history = history.slice(-CHAT_HISTORY_LIMIT);
        }
        
        // Save back to cache
        await CacheUtils.put(CHAT_HISTORY_CACHE, 'messages', history);
        
        consoleLog('websocket', 'Message added to chat history', { totalMessages: history.length });
    } catch (error) {
        consoleLog('error', 'Failed to save chat history', { error: error.message });
    }
}

async function getChatHistory() {
    try {
        const history = await CacheUtils.get(CHAT_HISTORY_CACHE, 'messages') || [];
        consoleLog('websocket', 'Retrieved chat history', { messageCount: history.length });
        return history;
    } catch (error) {
        consoleLog('error', 'Failed to retrieve chat history', { error: error.message });
        return [];
    }
}

// Event types
export const EVENT_TYPES = {
    // Connection events
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',

    // Follow events
    USER_FOLLOWED: 'user_followed',
    USER_UNFOLLOWED: 'user_unfollowed',

    // Game events
    GAME_STARTED: 'game_started',
    GAME_FINISHED: 'game_finished',
    GAME_PERSONAL_BEST: 'personal_best_notification',

    // User events
    USER_ONLINE: 'user_online',
    USER_OFFLINE: 'user_offline',

    // EXP events
    EXP_GAINED: 'exp_gained',
    LEVEL_UP: 'level_up',

    // System events
    NOTIFICATION: 'notification',
    ERROR: 'error'
};

let io;

export function initWebSocketServer(server) {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        path: '/socket.io/',
        transports: ['websocket', 'polling']
    });

    // Middleware for authentication (optional for anonymous users)
    io.use(async (socket, next) => {
        try {
            const { userId, token } = socket.handshake.auth;

            if (userId && token) {
                // Authenticated user
                const user = await getUserById(userId);
                if (user && user.length > 0 && user[0].is_active) {
                    socket.userId = parseInt(userId);
                    socket.user = user[0];
                    socket.isAuthenticated = true;
                } else {
                    // Invalid credentials, treat as anonymous
                    socket.isAuthenticated = false;
                }
            } else {
                // Anonymous user
                socket.isAuthenticated = false;
            }

            next();
        } catch (error) {
            consoleLog('error', 'Socket.IO authentication error:', { error });
            // Allow connection as anonymous user
            socket.isAuthenticated = false;
            next();
        }
    });

    // ============================================================================
    // 🎮 Chatroom State Management Test
    // ============================================================================

    const gameState = {
        players: new Map(),
        rooms: new Map(),
        stats: {
            totalConnections: 0,
            currentConnections: 0,
            messagesExchanged: 0,
            startTime: Date.now()
        }
    };

    // ============================================================================
    // 🛠️ Utility Functions
    // ============================================================================

    /**
     * Check if a position collides with chatroom objects
     */
    const checkSpawnCollision = (x, z, playerRadius = 1) => {
        const mapRadius = 45; // Same as client-side
        
        // Check map boundaries (circular)
        const distanceFromCenter = Math.sqrt(x * x + z * z);
        if (distanceFromCenter + playerRadius > mapRadius) {
            return true; // Collision with boundary
        }
        
        // Define collision objects (same as client-side)
        const collisionObjects = [
            // Central fountain
            { type: 'circle', x: 0, z: 0, radius: 4.5 },
            
            // Corner pavilions
            { type: 'circle', x: -25, z: -25, radius: 2 },
            { type: 'circle', x: 25, z: -25, radius: 2 },
            { type: 'circle', x: -25, z: 25, radius: 2 },
            { type: 'circle', x: 25, z: 25, radius: 2 },
            
            // Pavilion pillars (6 pillars per pavilion)
            ...generatePavilionPillars(-25, -25),
            ...generatePavilionPillars(25, -25),
            ...generatePavilionPillars(-25, 25),
            ...generatePavilionPillars(25, 25),
            
            // Trees around perimeter
            { type: 'circle', x: -35, z: 0, radius: 1.5 },
            { type: 'circle', x: 35, z: 0, radius: 1.5 },
            { type: 'circle', x: 0, z: -35, radius: 1.5 },
            { type: 'circle', x: 0, z: 35, radius: 1.5 },
            { type: 'circle', x: -30, z: -30, radius: 1.5 },
            { type: 'circle', x: 30, z: -30, radius: 1.5 },
            { type: 'circle', x: -30, z: 30, radius: 1.5 },
            { type: 'circle', x: 30, z: 30, radius: 1.5 },
            
            // Lamp posts
            { type: 'circle', x: -10, z: -10, radius: 0.3 },
            { type: 'circle', x: 10, z: -10, radius: 0.3 },
            { type: 'circle', x: -10, z: 10, radius: 0.3 },
            { type: 'circle', x: 10, z: 10, radius: 0.3 }
        ];
        
        // Check collision with objects
        for (const obj of collisionObjects) {
            if (obj.type === 'circle') {
                const dx = x - obj.x;
                const dz = z - obj.z;
                const distance = Math.sqrt(dx * dx + dz * dz);
                if (distance < obj.radius + playerRadius) {
                    return true; // Collision detected
                }
            }
        }
        
        return false; // No collision
    };
    
    /**
     * Generate pavilion pillar positions
     */
    const generatePavilionPillars = (centerX, centerZ) => {
        const pillars = [];
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI * 2) / 6;
            pillars.push({
                type: 'circle',
                x: centerX + Math.cos(angle) * 4,
                z: centerZ + Math.sin(angle) * 4,
                radius: 0.5
            });
        }
        return pillars;
    };

    /**
     * Generate a random spawn position within safe bounds, avoiding collisions
     */
    const generateSpawnPosition = () => {
        let attempts = 0;
        const maxAttempts = 50;
        
        while (attempts < maxAttempts) {
            // Try spawning in the central plaza area first (safer zone)
            const isPlazaSpawn = Math.random() < 0.7; // 70% chance to spawn in plaza
            
            let x, z;
            if (isPlazaSpawn) {
                // Spawn in central plaza (radius 8-15)
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * 7 + 8;
                x = Math.cos(angle) * radius;
                z = Math.sin(angle) * radius;
            } else {
                // Spawn in outer areas
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * 15 + 20;
                x = Math.cos(angle) * radius;
                z = Math.sin(angle) * radius;
            }
            
            // Check if this position is safe
            if (!checkSpawnCollision(x, z)) {
                return { x, z };
            }
            
            attempts++;
        }
        
        // Fallback to center if no safe position found
        consoleLog('warning', 'Could not find safe spawn position, using fallback');
        return { x: 0, z: 12 }; // Safe position in front of fountain
    };

    /**
     * Generate a random color for new players
     */
    const generatePlayerColor = () => {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
            '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    };

    /**
     * Sanitize user input to prevent XSS
     */
    const sanitizeInput = (input) => {
        if (typeof input !== 'string') return '';
        return input
            .replace(/[<>]/g, '')
            .substring(0, 50)
            .trim();
    };

    // ============================================================================
    // 🎮 Chatroom Test
    // ============================================================================

    io.on('connection', async (socket) => {
        const userId = socket.userId || null;
        const user = socket.user || null;

        // chatroom test

        gameState.stats.totalConnections++;
        gameState.stats.currentConnections++;

        consoleLog('websocket', 'Player connected', { socketId: socket.id, totalConnections: gameState.stats.currentConnections });

        // 👤 Handle new player joining
        socket.on('newUser', ({ name, charType, level, rankTitle, avatarUrl, expPoints, x, z }) => {
            try {
                const sanitizedName = sanitizeInput(name) || 'Anonymous';
                
                // Check if user already has an active chatroom connection
                if (userId && chatroomConnections.has(userId)) {
                    const existingSocketId = chatroomConnections.get(userId);
                    const existingSocket = io.sockets.sockets.get(existingSocketId);
                    
                    if (existingSocket && existingSocket.connected) {
                        // Disconnect the existing connection
                        existingSocket.emit('chatroom_kicked', {
                            message: 'Chatroom opened in another tab. Only one connection allowed.'
                        });
                        existingSocket.disconnect(true);
                        
                        // Remove from players and update lists
                        if (gameState.players.has(existingSocketId)) {
                            gameState.players.delete(existingSocketId);
                            io.emit('playerDisconnected', existingSocketId);
                        }
                        
                        consoleLog('websocket', `Disconnected existing chatroom session for ${sanitizedName}`, { 
                            oldSocketId: existingSocketId, 
                            newSocketId: socket.id 
                        });
                    }
                    
                    // Remove old mapping
                    chatroomConnections.delete(userId);
                }
                
                // Register new chatroom connection for authenticated users
                if (userId) {
                    chatroomConnections.set(userId, socket.id);
                }
                
                let position;
                
                // Check if saved coordinates are provided and safe
                if (x !== undefined && z !== undefined) {
                    const savedX = parseFloat(x) || 0;
                    const savedZ = parseFloat(z) || 0;
                    
                    // Check if saved position is safe (not in collision)
                    if (!checkSpawnCollision(savedX, savedZ)) {
                        position = { x: savedX, z: savedZ };
                    } else {
                        // Saved position is unsafe, find a new safe position
                        consoleLog('websocket', `Saved position (${savedX}, ${savedZ}) is unsafe, generating new spawn position`);
                        position = generateSpawnPosition();
                    }
                } else {
                    // No saved coordinates, generate new spawn position
                    position = generateSpawnPosition();
                }

                const playerData = {
                    id: socket.id,
                    name: sanitizedName,
                    charType: charType || 'Fighter',
                    level: level || 1,
                    rankTitle: rankTitle || 'Gamer',
                    avatarUrl: avatarUrl || '',
                    expPoints: expPoints || 0,
                    x: position.x,
                    z: position.z,
                    color: generatePlayerColor(),
                    direction: 1,
                    joinedAt: new Date().toISOString(),
                    lastSeen: Date.now()
                };

                gameState.players.set(socket.id, playerData);

                // Send current players to new user
                const allPlayers = Object.fromEntries(gameState.players);
                socket.emit('currentPlayers', allPlayers);

                // Notify other players of new arrival
                socket.broadcast.emit('newPlayer', playerData);


                consoleLog('websocket', `${sanitizedName} joined as ${charType}`, { position: { x: position.x.toFixed(1), z: position.z.toFixed(1) } });

            } catch (error) {
                consoleLog('error', 'Error handling new user', { error: error.message });
                socket.emit('error', { message: 'Failed to join game' });
            }
        });

        // 🏃 Handle player movement
        socket.on('move', (data) => {
            try {
                const player = gameState.players.get(socket.id);
                if (!player) return;

                // Validate movement data
                if (typeof data.x !== 'number' || typeof data.z !== 'number') return;
                if (Math.abs(data.x) > 100 || Math.abs(data.z) > 100) return; // Anti-cheat bounds check

                // Update player position
                player.x = data.x;
                player.z = data.z;
                player.lastSeen = Date.now();

                if (typeof data.direction !== 'undefined') {
                    player.direction = data.direction;
                }

                // Store animation state for broadcasting
                if (data.animState) {
                    player.animState = data.animState;
                }

                // Broadcast movement to other players including animation state
                socket.broadcast.emit('playerMoved', {
                    id: socket.id,
                    x: player.x,
                    z: player.z,
                    direction: player.direction,
                    animState: player.animState
                });

            } catch (error) {
                consoleLog('error', 'Error handling player movement', { error: error.message });
            }
        });

        // 🎭 Handle immediate animation state changes
        socket.on('animationStateChanged', (data) => {
            try {
                const player = gameState.players.get(socket.id);
                if (!player) return;

                // Update player animation state
                if (data.animState) {
                    player.animState = data.animState;
                }
                if (typeof data.direction !== 'undefined') {
                    player.direction = data.direction;
                }
                
                player.lastSeen = Date.now();

                // Immediately broadcast animation state change to other players
                socket.broadcast.emit('animationStateChanged', {
                    id: socket.id,
                    animState: data.animState,
                    direction: data.direction,
                    isMoving: data.isMoving
                });

            } catch (error) {
                consoleLog('error', 'Error handling animation state change', { error: error.message });
            }
        });

        // 🚨 Handle escape/teleport command for stuck players
        socket.on('teleportHome', () => {
            try {
                const player = gameState.players.get(socket.id);
                if (!player) return;

                // Generate a safe spawn position
                const safePosition = generateSpawnPosition();
                
                // Update player position
                player.x = safePosition.x;
                player.z = safePosition.z;
                player.lastSeen = Date.now();

                // Notify the player and others of the teleportation with proper structure
                const teleportData = {
                    id: socket.id,
                    x: player.x,
                    z: player.z,
                    direction: player.direction,
                    animState: 'Idle' // Default to idle after teleport
                };
                socket.emit('playerMoved', teleportData);
                socket.broadcast.emit('playerMoved', teleportData);
                socket.emit('chatMessage', { 
                    id: 'system', 
                    name: 'System', 
                    message: 'You have been teleported to a safe location!' 
                });

                consoleLog('websocket', `${player.name} teleported to safety`, { 
                    position: { x: safePosition.x.toFixed(1), z: safePosition.z.toFixed(1) } 
                });

            } catch (error) {
                consoleLog('error', 'Error handling teleport', { error: error.message });
            }
        });

        // 🎭 Handle character change
        socket.on('changeCharacter', (data) => {
            try {
                const player = gameState.players.get(socket.id);
                if (!player) return;

                const { charType, x, z } = data;
                
                // Validate character type
                const validCharTypes = ['Fighter', 'Ninja', 'Samurai'];
                if (!validCharTypes.includes(charType)) {
                    socket.emit('error', { message: 'Invalid character type' });
                    return;
                }

                // Update player character type
                player.charType = charType;
                
                // Update position if provided
                if (typeof x === 'number' && typeof z === 'number') {
                    player.x = x;
                    player.z = z;
                }
                
                player.lastSeen = Date.now();

                // Notify all players (including self) of the character change
                io.emit('playerCharacterChanged', {
                    id: socket.id,
                    charType: charType,
                    x: player.x,
                    z: player.z,
                    name: player.name,
                    level: player.level,
                    rankTitle: player.rankTitle,
                    avatarUrl: player.avatarUrl,
                    expPoints: player.expPoints,
                    direction: player.direction
                });

                consoleLog('websocket', `${player.name} changed character to ${charType}`);

            } catch (error) {
                consoleLog('error', 'Error handling character change', { error: error.message });
                socket.emit('error', { message: 'Failed to change character' });
            }
        });

        // 💬 Handle chat messages
        socket.on('chatMessage', (message) => {
            try {
                const player = gameState.players.get(socket.id);
                if (!player) return;

                const sanitizedMessage = sanitizeInput(message);
                if (!sanitizedMessage) return;

                gameState.stats.messagesExchanged++;
                player.lastSeen = Date.now();

                const chatData = {
                    id: socket.id,
                    name: player.name,
                    message: sanitizedMessage,
                    level: player.level || 1,
                    rankTitle: player.rankTitle || 'Gamer',
                    avatarUrl: player.avatarUrl || '',
                    timestamp: new Date().toISOString()
                };

                // Save to chat history cache
                addToChatHistory(chatData);

                io.emit('chatMessage', chatData);
                consoleLog('websocket', 'Chat message', { playerName: player.name, message: sanitizedMessage });

            } catch (error) {
                consoleLog('error', 'Error handling chat message', { error: error.message });
            }
        });

        // 🎭 Handle animation events
        socket.on('playAnim', (data) => {
            try {
                const player = gameState.players.get(socket.id);
                if (!player) return;

                player.lastSeen = Date.now();

                // Validate animation data
                const validAnimations = ['Attack_1', 'Attack_2', 'Attack_3', 'Jump', 'Hurt', 'Dead', 'Shield'];
                if (data.animation && validAnimations.includes(data.animation)) {
                    socket.broadcast.emit('playAnim', { id: socket.id, ...data });
                }

            } catch (error) {
                consoleLog('error', 'Error handling animation', { error: error.message });
            }
        });


        // 🚪 Handle player disconnection
        socket.on('disconnect', (reason) => {
            try {
                const player = gameState.players.get(socket.id);
                const playerName = player ? player.name : 'Unknown';

                gameState.stats.currentConnections--;
                gameState.players.delete(socket.id);

                // Clean up chatroom connection mapping
                if (userId && chatroomConnections.get(userId) === socket.id) {
                    chatroomConnections.delete(userId);
                    consoleLog('websocket', `Cleaned up chatroom connection for user ${userId}`, {
                        playerName,
                        remainingChatroomConnections: chatroomConnections.size
                    });
                }

                // Notify other players
                io.emit('playerDisconnected', socket.id);


                consoleLog('websocket', `${playerName} disconnected`, { reason, remaining: gameState.stats.currentConnections });

            } catch (error) {
                consoleLog('error', 'Error handling disconnect', { error: error.message });
            }
        });

        // 📊 Handle stats request
        socket.on('getStats', () => {
            try {
                const uptime = Date.now() - gameState.stats.startTime;
                const stats = {
                    ...gameState.stats,
                    uptime: Math.floor(uptime / 1000),
                    activeRooms: gameState.rooms.size
                };
                socket.emit('serverStats', stats);
            } catch (error) {
                consoleLog('error', 'Error sending stats', { error: error.message });
            }
        });

        // end chatroom test

        const username = user ? user.username : 'Anonymous';
        consoleLog('websocket', 'User connected via Socket.IO', { username, userId, isAuthenticated: socket.isAuthenticated });

        // Store the connection
        const clientInfo = {
            socket,
            userId,
            user,
            connectedAt: new Date(),
            lastPing: new Date(),
            isAuthenticated: socket.isAuthenticated
        };

        clients.set(socket, clientInfo);

        // Join user to their personal room (if authenticated)
        if (userId) {
            await socket.join(`user_${userId}`);
        }

        // Send connection confirmation
        socket.emit(EVENT_TYPES.CONNECTED, {
            message: 'Connected successfully',
            user: user ? {
                id: user.id,
                username: user.username,
                avatarUrl: user.avatarUrl
            } : null
        });

        // Notify followers that user is online (only for authenticated users)
        if (userId) {
            await notifyFollowersUserOnline(userId);
        }

        // Handle ping messages
        socket.on('ping', (data) => {
            socket.emit('pong', { timestamp: Date.now(), ...data });
            const clientInfo = clients.get(socket);
            if (clientInfo) {
                clientInfo.lastPing = new Date();
            }
        });
        
        // Handle personal best achievements (only for authenticated users)
        socket.on('personal_best_achieved', async (data) => {
            consoleLog('debug', '[DEBUG] Received personal_best_achieved event', { 
                userId, 
                username: user?.username, 
                data: data,
                socketId: socket.id 
            });
            
            try {
                if (userId && user) {
                    const { gameTitle, score } = data;
                    consoleLog('debug', '[DEBUG] Processing personal best notification', {
                        userId,
                        username: user.username,
                        gameTitle,
                        score
                    });
                    
                    await notifyFollowersPersonalBest(userId, user.username, gameTitle, score);
                    consoleLog('debug', '[DEBUG] Personal best notification sent to followers');
                } else {
                    consoleLog('warning', '[DEBUG] Cannot process personal best - missing user info', {
                        hasUserId: !!userId,
                        hasUser: !!user,
                        socketId: socket.id
                    });
                }
            } catch (error) {
                consoleLog('error', '[DEBUG] Error handling personal best notification', { error, data });
            }
        });

        // Handle heartbeat
        socket.on('heartbeat', () => {
            const clientInfo = clients.get(socket);
            if (clientInfo) {
                clientInfo.lastPing = new Date();
            }
        });

        // Handle game events (only for authenticated users)
        socket.on('game:start', async (gameData) => {
            if (userId && user) {
                await notifyGameStarted(userId, {
                    ...gameData,
                    username: user.username
                });
            }
        });

        socket.on('game:finish', async (gameData) => {
            if (userId && user) {
                await notifyGameFinished(userId, {
                    ...gameData,
                    username: user.username
                });
            }
        });

        // Handle game page tracking
        socket.on('join_game_page', (gameId) => {
            if (!gameId) return;
            
            const gameIdStr = gameId.toString();
            consoleLog('websocket', 'User joining game page', { 
                gameId: gameIdStr, 
                socketId: socket.id, 
                username: user ? user.username : 'Anonymous' 
            });
            
            if (!gameViewers.has(gameIdStr)) {
                gameViewers.set(gameIdStr, new Set());
            }
            
            gameViewers.get(gameIdStr).add(socket.id);
            socket.currentGamePage = gameIdStr;
            
            const currentCount = gameViewers.get(gameIdStr).size;
            consoleLog('websocket', 'Game viewer count updated', { 
                gameId: gameIdStr, 
                viewerCount: currentCount 
            });
            
            // Broadcast updated count immediately
            broadcastGameViewerCount(gameIdStr);
        });
        
        socket.on('leave_game_page', (gameId) => {
            if (!gameId) return;
            
            const gameIdStr = gameId.toString();
            consoleLog('websocket', 'User leaving game page', { 
                gameId: gameIdStr, 
                socketId: socket.id, 
                username: user ? user.username : 'Anonymous' 
            });
            
            if (gameViewers.has(gameIdStr)) {
                gameViewers.get(gameIdStr).delete(socket.id);
                const currentCount = gameViewers.get(gameIdStr).size;
                
                if (currentCount === 0) {
                    gameViewers.delete(gameIdStr);
                }
                
                consoleLog('websocket', 'Game viewer count updated after leave', { 
                    gameId: gameIdStr, 
                    viewerCount: currentCount 
                });
                
                broadcastGameViewerCount(gameIdStr);
            }
            socket.currentGamePage = null;
        });

        // Handle room events
        socket.on('join_room', (roomName) => {
            socket.join(roomName);
            socket.emit('room_joined', { room: roomName });
        });

        socket.on('leave_room', (roomName) => {
            socket.leave(roomName);
            socket.emit('room_left', { room: roomName });
        });

        // Handle disconnect
        socket.on('disconnect', async (reason) => {
            const disconnectUsername = user ? user.username : 'Anonymous';
            consoleLog('websocket', 'User disconnected', { username: disconnectUsername, reason });

            // Enhanced game page tracking cleanup
            if (socket.currentGamePage) {
                const gameIdStr = socket.currentGamePage;
                cleanupGameViewer(gameIdStr, socket.id);
            }

            // Additional cleanup: remove socket from any other gameViewers sets
            // This handles cases where socket.currentGamePage wasn't set properly
            gameViewers.forEach((viewers, gameId) => {
                if (viewers.has(socket.id)) {
                    cleanupGameViewer(gameId, socket.id);
                }
            });

            // Notify followers that user is offline (only for authenticated users)
            if (userId) {
                await notifyFollowersUserOffline(userId);
            }

            // Remove from clients map
            clients.delete(socket);
        });

        // Handle errors
        socket.on('error', (error) => {
            consoleLog('error', 'Socket.IO error', { error });
            clients.delete(socket);
        });
    });

    consoleLog('server', 'Socket.IO server initialized');
}

// Utility function to send message to a specific client
export function sendToClient(socket, eventType, data = {}) {
    if (socket && socket.connected) {
        const message = {
            ...data,
            timestamp: new Date().toISOString()
        };

        socket.emit(eventType, message);
        return true;
    }
    return false;
}

// Send message to a specific user by ID
export function sendToUser(userId, eventType, data = {}) {
    if (!io) return false;

    const message = {
        ...data,
        timestamp: new Date().toISOString()
    };

    // Use Socket.IO rooms for efficient user targeting
    io.to(`user_${userId}`).emit(eventType, message);

    return true;
}

// Send message to multiple users
export function sendToUsers(userIds, eventType, data = {}) {
    consoleLog('debug', '[DEBUG] sendToUsers called', { userIds, eventType, data });
    
    if (!io) {
        consoleLog('error', '[DEBUG] Socket.IO instance not available');
        return {};
    }

    const message = {
        ...data,
        timestamp: new Date().toISOString()
    };
    
    consoleLog('debug', '[DEBUG] Sending message to users', { userIds, eventType, message });

    const results = {};
    userIds.forEach(userId => {
        const roomName = `user_${userId}`;
        consoleLog('debug', '[DEBUG] Emitting to room', { userId, roomName, eventType });
        io.to(roomName).emit(eventType, message);
        results[userId] = true;
    });

    consoleLog('debug', '[DEBUG] sendToUsers completed', { results });
    return results;
}

// Broadcast message to all connected clients
export function broadcast(eventType, data = {}, excludeUserIds = []) {
    if (!io) return 0;

    const message = {
        ...data,
        timestamp: new Date().toISOString()
    };

    // Cache chat messages from floating chat
    if (eventType === 'chatMessage' && data.isFloatingChat) {
        addToChatHistory(message);
    }

    if (excludeUserIds.length > 0) {
        // Broadcast to all except excluded users
        let sent = 0;
        clients.forEach((clientInfo, socket) => {
            if (!excludeUserIds.includes(clientInfo.userId)) {
                if (sendToClient(socket, eventType, message)) {
                    sent++;
                }
            }
        });
        return sent;
    } else {
        // Broadcast to all
        io.emit(eventType, message);
        return clients.size;
    }
}

// Get all Socket.IO connections for a specific user
function getUserClients(userId) {
    const userClients = [];

    clients.forEach((clientInfo, socket) => {
        if (clientInfo.userId === parseInt(userId)) {
            userClients.push(socket);
        }
    });

    return userClients;
}

// Check if a user is currently online
export function isUserOnline(userId) {
    if (!io) return false;

    const userRoom = `user_${userId}`;
    const sockets = io.sockets.adapter.rooms.get(userRoom);
    return sockets && sockets.size > 0;
}

// Get all online users
export function getOnlineUsers() {
    const onlineUsers = new Set();

    clients.forEach(clientInfo => {
        onlineUsers.add(clientInfo.userId);
    });

    return Array.from(onlineUsers);
}

// Get chatroom-specific online users
export function getChatroomOnlineUsers() {
    const onlineUsers = new Set();
    const staleConnections = [];
    
    // Get users from chatroom connections map
    chatroomConnections.forEach((socketId, userId) => {
        // Verify the socket is still connected
        if (io && io.sockets.sockets.get(socketId)?.connected) {
            onlineUsers.add(userId);
        } else {
            // Mark for cleanup
            staleConnections.push(userId);
        }
    });

    // Clean up stale connections
    staleConnections.forEach(userId => {
        chatroomConnections.delete(userId);
    });

    if (staleConnections.length > 0) {
        consoleLog('websocket', 'Cleaned up stale chatroom connections', { 
            removedConnections: staleConnections.length,
            remainingConnections: chatroomConnections.size
        });
    }

    consoleLog('websocket', 'Chatroom online users count', { 
        count: onlineUsers.size,
        users: Array.from(onlineUsers),
        totalConnections: chatroomConnections.size
    });

    return Array.from(onlineUsers);
}

// Get connection info for debugging
export function getConnectionInfo() {
    const info = {
        totalConnections: clients.size,
        uniqueUsers: new Set(),
        connections: []
    };

    clients.forEach((clientInfo, socket) => {
        if (clientInfo.userId) {
            info.uniqueUsers.add(clientInfo.userId);
        }
        info.connections.push({
            userId: clientInfo.userId,
            username: clientInfo.user ? clientInfo.user.username : 'Anonymous',
            connectedAt: clientInfo.connectedAt,
            lastPing: clientInfo.lastPing,
            connected: socket.connected,
            socketId: socket.id
        });
    });

    info.uniqueUsers = info.uniqueUsers.size;

    return info;
}

// Follow-specific notification functions
async function notifyFollowersUserOnline(userId) {
    try {
        // Import here to avoid circular dependency
        const { getFollowers } = await import('../models/follows.js');
        const followers = await getFollowers(userId);

        if (followers && followers.length > 0) {
            const followerIds = followers.map(follower => follower.id);

            sendToUsers(followerIds, EVENT_TYPES.USER_ONLINE, {
                userId: userId,
                message: 'Someone you follow came online'
            });
        }
    } catch (error) {
        consoleLog('error', 'Error notifying followers user online', { error });
    }
}

async function notifyFollowersUserOffline(userId) {
    try {
        // Import here to avoid circular dependency
        const { getFollowers } = await import('../models/follows.js');
        const followers = await getFollowers(userId);

        if (followers && followers.length > 0) {
            const followerIds = followers.map(follower => follower.id);

            sendToUsers(followerIds, EVENT_TYPES.USER_OFFLINE, {
                userId: userId,
                message: 'Someone you follow went offline'
            });
        }
    } catch (error) {
        consoleLog('error', 'Error notifying followers user offline', { error });
    }
}

// Follow event utilities
export async function notifyUserFollowed(followerId, followingId, followerData) {
    return sendToUser(followingId, EVENT_TYPES.USER_FOLLOWED, {
        followerId,
        followerUsername: followerData.followerUsername,
        followerAvatar: followerData.followerAvatar,
        message: `${followerData.followerUsername} started following you`
    });
}

export async function notifyUserUnfollowed(followerId, followingId, followerData) {
    return sendToUser(followingId, EVENT_TYPES.USER_UNFOLLOWED, {
        followerId,
        followerUsername: followerData.followerUsername,
        message: `${followerData.followerUsername} unfollowed you`
    });
}

// Game event utilities
export async function notifyGameStarted(userId, gameData) {
    try {
        const { getFollowers } = await import('../models/follows.js');
        const followers = await getFollowers(userId);
        const followerIds = followers ? followers.map(follower => follower.id) : [];

        return sendToUsers(followerIds, EVENT_TYPES.GAME_STARTED, {
            userId,
            gameId: gameData.gameId,
            gameTitle: gameData.gameTitle,
            message: `${gameData.username} started playing ${gameData.gameTitle}`
        });
    } catch (error) {
        consoleLog('error', 'Error notifying game started', { error });
        return false;
    }
}

export async function notifyGameFinished(userId, gameData) {
    try {
        const { getFollowers } = await import('../models/follows.js');
        const followers = await getFollowers(userId);
        const followerIds = followers ? followers.map(follower => follower.id) : [];

        return sendToUsers(followerIds, EVENT_TYPES.GAME_FINISHED, {
            userId,
            gameId: gameData.gameId,
            gameTitle: gameData.gameTitle,
            duration: gameData.duration,
            message: `${gameData.username} finished playing ${gameData.gameTitle}`
        });
    } catch (error) {
        consoleLog('error', 'Error notifying game finished', { error });
        return false;
    }
}

// EXP notification functions
export function notifyExpGained(userId, expData) {
    return sendToUser(userId, EVENT_TYPES.EXP_GAINED, {
        expGained: expData.expGained,
        totalExp: expData.totalExp,
        source: expData.source || 'unknown',
        description: expData.description,
        timestamp: new Date().toISOString()
    });
}

export function notifyLevelUp(userId, levelData) {
    return sendToUser(userId, EVENT_TYPES.LEVEL_UP, {
        oldLevel: levelData.oldLevel,
        newLevel: levelData.newLevel,
        expGained: levelData.expGained,
        totalExp: levelData.totalExp,
        timestamp: new Date().toISOString()
    });
}

// General notification utility
export function sendNotification(userId, message, type = 'info') {
    return sendToUser(userId, EVENT_TYPES.NOTIFICATION, {
        message,
        type,
        timestamp: new Date().toISOString()
    });
}

// Cleanup function for graceful shutdown
export function closeWebSocketServer() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
    
    if (io) {
        clients.forEach((clientInfo, socket) => {
            socket.disconnect(true);
        });

        // Clear all tracking maps
        gameViewers.clear();
        gameCountThrottle.clear();
        chatroomConnections.clear();
        clients.clear();

        io.close(() => {
            consoleLog('server', 'Socket.IO server closed and cleaned up');
        });
    }
}

// Additional Socket.IO specific utilities

// Join a user to a room
export function joinRoom(userId, roomName) {
    if (!io) return false;

    const userRoom = `user_${userId}`;
    const sockets = io.sockets.adapter.rooms.get(userRoom);

    if (sockets) {
        sockets.forEach(socketId => {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.join(roomName);
            }
        });
        return true;
    }

    return false;
}

// Remove a user from a room
export function leaveRoom(userId, roomName) {
    if (!io) return false;

    const userRoom = `user_${userId}`;
    const sockets = io.sockets.adapter.rooms.get(userRoom);

    if (sockets) {
        sockets.forEach(socketId => {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.leave(roomName);
            }
        });
        return true;
    }

    return false;
}

// Send message to a room
export function sendToRoom(roomName, eventType, data = {}) {
    if (!io) return false;

    const message = {
        ...data,
        timestamp: new Date().toISOString()
    };

    io.to(roomName).emit(eventType, message);
    return true;
}

// Get Socket.IO instance for advanced usage
export function getIO() {
    return io;
}

// Throttle map for game viewer count broadcasts
const gameCountThrottle = new Map();

// Helper function to clean up game viewer tracking
function cleanupGameViewer(gameId, socketId) {
    if (gameViewers.has(gameId)) {
        gameViewers.get(gameId).delete(socketId);
        if (gameViewers.get(gameId).size === 0) {
            gameViewers.delete(gameId);
            // Clean up throttle map entry when no more viewers
            gameCountThrottle.delete(gameId);
            consoleLog('websocket', 'Cleaned up empty game viewer tracking', { gameId });
        } else {
            broadcastGameViewerCount(gameId);
        }
    }
}

// Periodic cleanup function for stale entries
function performPeriodicCleanup() {
    let cleanedGameViewers = 0;
    let cleanedThrottleEntries = 0;
    let cleanedChatroomConnections = 0;
    
    // Clean up empty gameViewers entries
    for (const [gameId, viewers] of gameViewers.entries()) {
        if (viewers.size === 0) {
            gameViewers.delete(gameId);
            gameCountThrottle.delete(gameId);
            cleanedGameViewers++;
        }
    }
    
    // Clean up old throttle entries (older than 30 minutes)
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    for (const [gameId, timestamp] of gameCountThrottle.entries()) {
        if (timestamp < thirtyMinutesAgo && !gameViewers.has(gameId)) {
            gameCountThrottle.delete(gameId);
            cleanedThrottleEntries++;
        }
    }
    
    // Size-based cleanup if throttle map grows too large
    if (gameCountThrottle.size > 1000) {
        const entries = Array.from(gameCountThrottle.entries())
            .sort((a, b) => a[1] - b[1]) // Sort by timestamp (oldest first)
            .slice(0, 500); // Keep only newest 500 entries
        
        gameCountThrottle.clear();
        entries.forEach(([gameId, timestamp]) => {
            gameCountThrottle.set(gameId, timestamp);
        });
        
        cleanedThrottleEntries += 500;
    }
    
    // Clean up stale chatroom connections
    if (io) {
        const staleChatroomConnections = [];
        chatroomConnections.forEach((socketId, userId) => {
            const socket = io.sockets.sockets.get(socketId);
            if (!socket || !socket.connected) {
                staleChatroomConnections.push(userId);
            }
        });
        
        staleChatroomConnections.forEach(userId => {
            chatroomConnections.delete(userId);
            cleanedChatroomConnections++;
        });
    }
    
    if (cleanedGameViewers > 0 || cleanedThrottleEntries > 0 || cleanedChatroomConnections > 0) {
        consoleLog('websocket', 'Periodic cleanup completed', {
            cleanedGameViewers,
            cleanedThrottleEntries,
            cleanedChatroomConnections,
            remainingGameViewers: gameViewers.size,
            remainingThrottleEntries: gameCountThrottle.size,
            remainingChatroomConnections: chatroomConnections.size
        });
    }
}

// Set up periodic cleanup (every 15 minutes)
let cleanupInterval;
if (typeof setInterval !== 'undefined') {
    cleanupInterval = setInterval(performPeriodicCleanup, 15 * 60 * 1000);
}

// Broadcast game viewer count with light throttling
function broadcastGameViewerCount(gameId) {
    const now = Date.now();
    const lastBroadcast = gameCountThrottle.get(gameId) || 0;
    
    // Throttle to max 1 broadcast per 200ms per game (light throttling for performance)
    if (now - lastBroadcast < 200) {
        return;
    }
    
    gameCountThrottle.set(gameId, now);
    
    const viewerCount = gameViewers.has(gameId) ? gameViewers.get(gameId).size : 0;
    
    consoleLog('websocket', 'Broadcasting game viewer count', { 
        gameId: parseInt(gameId), 
        viewerCount,
        totalClients: clients.size
    });
    
    // Broadcast to all clients
    if (io) {
        io.emit('game_viewer_count', {
            gameId: parseInt(gameId),
            viewerCount: viewerCount
        });
    }
}

// Get current viewer count for a game
export function getGameViewerCount(gameId) {
    const gameIdStr = gameId.toString();
    return gameViewers.has(gameIdStr) ? gameViewers.get(gameIdStr).size : 0;
}

// Get all game viewer counts
export function getAllGameViewerCounts() {
    const counts = {};
    gameViewers.forEach((viewers, gameId) => {
        counts[gameId] = viewers.size;
    });
    return counts;
}

// Broadcast all game viewer counts (for testing/debugging)
export function broadcastAllGameViewerCounts() {
    gameViewers.forEach((viewers, gameId) => {
        broadcastGameViewerCount(gameId);
    });
}

// Notify followers of personal best achievement
export async function notifyFollowersPersonalBest(userId, username, gameTitle, score) {
    consoleLog('debug', '[DEBUG] notifyFollowersPersonalBest called', { userId, username, gameTitle, score });
    
    try {
        // Import here to avoid circular dependency
        const { getFollowers } = await import('../models/follows.js');
        consoleLog('debug', '[DEBUG] Getting followers for user', { userId });
        
        const followers = await getFollowers(userId);
        consoleLog('debug', '[DEBUG] Found followers', { 
            userId, 
            followerCount: followers?.length || 0,
            followers: followers?.map(f => ({ id: f.id, username: f.username })) || []
        });

        if (followers && followers.length > 0) {
            const followerIds = followers.map(follower => follower.id);
            
            const notificationData = {
                userId: userId,
                username: username,
                gameTitle: gameTitle,
                score: score,
                message: `${username} achieved a new personal best in ${gameTitle}: ${score.toLocaleString()} points!`,
                timestamp: new Date().toISOString()
            };
            
            consoleLog('debug', '[DEBUG] Sending personal_best_notification to followers', {
                followerIds,
                notificationData
            });

            sendToUsers(followerIds, EVENT_TYPES.GAME_PERSONAL_BEST, notificationData);
            consoleLog('debug', '[DEBUG] Personal best notification sent successfully');
        } else {
            consoleLog('debug', '[DEBUG] No followers found - no notifications to send', { userId, username });
        }
    } catch (error) {
        consoleLog('error', '[DEBUG] Error notifying followers of personal best', { error, userId, username, gameTitle, score });
    }
}

// Export chat history function for use in controllers
export { getChatHistory };