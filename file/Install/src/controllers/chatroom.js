import response from "../utils/response.js";
import { consoleLog } from "../utils/logger.js";
import i18n from '../utils/i18n.js';
import {
    sanitizeRequestBody
} from "../utils/sanitize.js";
import {
    update
} from "../models/crud.js";
import {
    awardChatroomMessageExp,
    awardSocialInteractionExp
} from "../utils/exp.js";
import {
    getUserById,
    getUserByUsername,
    getRecentChatroomActivity
} from "../models/users.js";
import {
    getOnlineUsers,
    getChatroomOnlineUsers,
    broadcast,
    getChatHistory,
    notifyUserFollowed,
    notifyUserUnfollowed
} from "../utils/websocket.js";
import {
    followUser,
    unfollowUser,
    isFollowing
} from "../models/follows.js";
import {
    awardFollowUserExp
} from "../utils/exp.js";
import { getSetting } from '../models/settings.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const index = async (req, res) => { 
    try {
        // Get site name from system settings
        const siteName = await getSetting('site_name') || 'ARCADE';
        
        const pageData = {
            page: "chatroom",
            title: `${i18n.translateSync('chatroom.page_title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
            description: i18n.translateSync('chatroom.page_description', {}, req.language?.current || 'en'),
            user: res.locals.user,
            userLevel: res.locals.user?.level || 1,
            userExp: res.locals.user?.exp_points || 0,
            userRank: res.locals.user?.level || 1
        };

        res.render("chatroom/pages/default", pageData);
    } catch (error) {
        consoleLog('error', 'Error loading chatroom page', { error: error.message });
        
        // Fallback if settings fetch fails
        const pageData = {
            page: "chatroom",
            title: i18n.translateSync('chatroom.page_title', {}, req.language?.current || 'en'),
            description: i18n.translateSync('chatroom.page_description', {}, req.language?.current || 'en'),
            user: res.locals.user,
            userLevel: res.locals.user?.level || 1,
            userExp: res.locals.user?.exp_points || 0,
            userRank: res.locals.user?.level || 1
        };

        res.render("chatroom/pages/default", pageData);
    }
};

const awardChatroomExpEndpoint = async (req, res) => {
    if (!res.locals.user) {
        return response(res, 401, i18n.translateSync('api.chatroom.auth_required', {}, req.language?.current || 'en'));
    }

    const request = sanitizeRequestBody(req.body);
    
    if (!request.action) {
        return response(res, 400, i18n.translateSync('api.chatroom.action_type_required', {}, req.language?.current || 'en'));
    }

    try {
        let expResult = null;
        
        switch (request.action) {
            case 'message':
                expResult = await awardChatroomMessageExp(res.locals.user.id, req);
                break;
            case 'social_interaction':
                if (!request.interaction) {
                    return response(res, 400, i18n.translateSync('api.chatroom.interaction_type_required', {}, req.language?.current || 'en'));
                }
                expResult = await awardSocialInteractionExp(res.locals.user.id, request.interaction, req);
                break;
            default:
                return response(res, 400, i18n.translateSync('api.chatroom.invalid_action_type', {}, req.language?.current || 'en'));
        }

        if (expResult && expResult.success) {
            return response(res, 200, i18n.translateSync('api.chatroom.exp_awarded', {}, req.language?.current || 'en'), {
                expGained: expResult.expGained,
                totalExp: expResult.totalExp,
                leveledUp: expResult.leveledUp,
                newLevel: expResult.newLevel,
                message: expResult.message
            });
        }

        return response(res, 400, expResult?.message || i18n.translateSync('api.chatroom.exp_award_failed', {}, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', 'Award chatroom EXP error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.chatroom.exp_award_error', {}, req.language?.current || 'en'));
    }
};

// Update user chatroom character selection
const updateChatroomCharacterEndpoint = async (req, res) => {
    try {
        if (!res.locals.user) {
            return response(res, 401, i18n.translateSync('api.chatroom.auth_required', {}, req.language?.current || 'en'));
        }

        const request = sanitizeRequestBody(req.body);
        const { character } = request;

        if (!character || !character.trim()) {
            return response(res, 400, i18n.translateSync('api.chatroom.character_required', {}, req.language?.current || 'en'));
        }

        // Validate character type by checking available character types
        const charactersPath = path.join(process.cwd(), 'public', 'chatroom', 'characters');
        const validCharacters = [];
        
        try {
            if (fs.existsSync(charactersPath)) {
                const items = fs.readdirSync(charactersPath, { withFileTypes: true });
                for (const item of items) {
                    if (item.isDirectory()) {
                        const characterJsonPath = path.join(charactersPath, item.name, 'character.json');
                        if (fs.existsSync(characterJsonPath)) {
                            validCharacters.push(item.name);
                        }
                    }
                }
            }
        } catch (error) {
            consoleLog('warning', 'Could not read character types for validation', { error: error.message });
        }
        
        // Fallback to known characters if directory read fails
        if (validCharacters.length === 0) {
            validCharacters.push('Fighter', 'Ninja', 'Samurai');
        }
        
        if (!validCharacters.includes(character)) {
            return response(res, 400, i18n.translateSync('api.chatroom.invalid_character_type', { types: validCharacters.join(', ') }, req.language?.current || 'en'));
        }

        // Update user's chatroom character
        const result = await update(res.locals.user.id, null, 'users', {
            chatroom_character: character
        });

        if (result && result > 0) {
            // Update session data
            req.session.user.chatroom_character = character;
            
            return response(res, 200, i18n.translateSync('api.chatroom.character_updated', {}, req.language?.current || 'en'), {
                character: character
            });
        } else {
            return response(res, 500, i18n.translateSync('api.chatroom.character_update_failed', {}, req.language?.current || 'en'));
        }
    } catch (error) {
        consoleLog('error', 'Update chatroom character error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.chatroom.character_update_error', {}, req.language?.current || 'en'));
    }
};

// Save user chatroom coordinates
const saveChatroomCoordinatesEndpoint = async (req, res) => {
    try {
        if (!res.locals.user) {
            return response(res, 401, i18n.translateSync('api.chatroom.auth_required', {}, req.language?.current || 'en'));
        }

        const request = sanitizeRequestBody(req.body);
        const { x, z } = request;

        // Validate that coordinates are valid numbers but store as text for precision
        const xCoord = parseFloat(x);
        const zCoord = parseFloat(z);

        if (isNaN(xCoord) || isNaN(zCoord)) {
            return response(res, 400, i18n.translateSync('api.chatroom.coordinates_required', {}, req.language?.current || 'en'));
        }

        // Store coordinates as text to preserve full floating-point precision
        const result = await update(res.locals.user.id, null, 'users', {
            chatroom_last_x: x.toString(),
            chatroom_last_z: z.toString(),
            chatroom_last_visit: new Date()
        });

        if (result && result > 0) {
            return response(res, 200, i18n.translateSync('api.chatroom.coordinates_saved', {}, req.language?.current || 'en'));
        } else {
            return response(res, 500, i18n.translateSync('api.chatroom.coordinates_save_failed', {}, req.language?.current || 'en'));
        }
    } catch (error) {
        consoleLog('error', 'Save chatroom coordinates error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.chatroom.coordinates_save_error', {}, req.language?.current || 'en'));
    }
};

// Get user chatroom data
const getChatroomDataEndpoint = async (req, res) => {
    try {
        if (!res.locals.user) {
            return response(res, 401, i18n.translateSync('api.chatroom.auth_required', {}, req.language?.current || 'en'));
        }

        // Fetch fresh user data from database to get latest coordinates
        const userData = await getUserById(res.locals.user.id);
        if (!userData || userData.length === 0) {
            return response(res, 404, i18n.translateSync('api.chatroom.user_not_found', {}, req.language?.current || 'en'));
        }

        const user = userData[0];
        
        return response(res, 200, i18n.translateSync('api.chatroom.chatroom_data_retrieved', {}, req.language?.current || 'en'), {
            character: user.chatroom_character || null,
            lastX: user.chatroom_last_x || 0,
            lastZ: user.chatroom_last_z || 0,
            lastVisit: user.chatroom_last_visit,
            hasCharacter: !!user.chatroom_character
        });
    } catch (error) {
        consoleLog('error', 'Get chatroom data error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.chatroom.chatroom_data_error', {}, req.language?.current || 'en'));
    }
};

// Get chatroom statistics for floating chat
const getChatroomStatsEndpoint = async (req, res) => {
    try {
        // Get chatroom-specific online user count (only users actually in the chatroom)
        const chatroomUsers = getChatroomOnlineUsers();
        const onlineCount = Array.isArray(chatroomUsers) ? chatroomUsers.length : 0;
        
        consoleLog('info', 'Chatroom stats requested', { 
            onlineCount, 
            chatroomUsers,
            endpoint: '/chatroom/stats' 
        });
        
        // Get recent chatroom activity (users who visited in last hour)
        const recentActivity = await getRecentChatroomActivity(5);
        
        return response(res, 200, i18n.translateSync('api.chatroom.stats_retrieved', {}, req.language?.current || 'en'), {
            onlineCount,
            recentActivity: recentActivity || []
        });
    } catch (error) {
        consoleLog('error', 'Get chatroom stats error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.chatroom.stats_error', {}, req.language?.current || 'en'));
    }
};

// Send floating chat message (no EXP rewards)
const sendFloatingChatMessageEndpoint = async (req, res) => {
    try {
        if (!res.locals.user) {
            return response(res, 401, i18n.translateSync('api.chatroom.message_auth_required', {}, req.language?.current || 'en'));
        }

        const request = sanitizeRequestBody(req.body);
        const { message } = request;

        if (!message || !message.trim()) {
            return response(res, 400, i18n.translateSync('api.chatroom.message_required', {}, req.language?.current || 'en'));
        }

        consoleLog('info', 'Floating chat message received', { 
            userId: res.locals.user.id, 
            username: res.locals.user.username, 
            message: message.trim() 
        });

        // Broadcast message through WebSocket (no EXP awarded)
        const messageData = {
            id: res.locals.user.id,
            name: res.locals.user.username,
            message: message.trim(),
            level: res.locals.user.level || 1,
            rankTitle: res.locals.user.rankTitle || 'Gamer',
            avatarUrl: res.locals.user.avatarUrl || '',
            timestamp: new Date().toISOString(),
            isFloatingChat: true // Flag to prevent EXP
        };
        
        consoleLog('info', 'Broadcasting floating chat message', { messageData });
        
        // Use existing WebSocket broadcast function for chat messages
        const broadcastResult = broadcast('chatMessage', messageData);
        
        consoleLog('info', 'Broadcast result', { broadcastResult });

        return response(res, 200, i18n.translateSync('api.chatroom.message_sent', {}, req.language?.current || 'en'), { messageData });
    } catch (error) {
        consoleLog('error', 'Send floating chat message error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.chatroom.message_send_error', {}, req.language?.current || 'en'));
    }
};

// Get recent chat history (last 15 messages)
const getChatHistoryEndpoint = async (req, res) => {
    try {
        const chatHistory = await getChatHistory();
        
        return response(res, 200, i18n.translateSync('api.chatroom.chat_history_retrieved', {}, req.language?.current || 'en'), {
            messages: chatHistory,
            count: chatHistory.length
        });
    } catch (error) {
        consoleLog('error', 'Get chat history error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.chatroom.chat_history_error', {}, req.language?.current || 'en'));
    }
};

// Check if current user is following another user
const checkFollowStatusEndpoint = async (req, res) => {
    try {
        if (!res.locals.user) {
            return response(res, 401, i18n.translateSync('api.chatroom.auth_required', {}, req.language?.current || 'en'));
        }

        const { username } = req.params;
        
        if (!username) {
            return response(res, 400, i18n.translateSync('api.chatroom.username_required', {}, req.language?.current || 'en'));
        }

        // Find the target user
        const targetUser = await getUserByUsername(username);
        if (!targetUser || targetUser.length === 0) {
            return response(res, 404, i18n.translateSync('api.chatroom.user_not_found', {}, req.language?.current || 'en'));
        }

        const followingId = targetUser[0].id;
        
        // Can't check follow status for yourself
        if (followingId === res.locals.user.id) {
            return response(res, 400, i18n.translateSync('api.chatroom.cannot_check_self', {}, req.language?.current || 'en'));
        }

        // Check if currently following
        const isCurrentlyFollowing = await isFollowing(res.locals.user.id, followingId);
        
        return response(res, 200, i18n.translateSync('api.chatroom.follow_status_retrieved', {}, req.language?.current || 'en'), {
            isFollowing: isCurrentlyFollowing,
            targetUser: {
                id: targetUser[0].id,
                username: targetUser[0].username
            }
        });
    } catch (error) {
        consoleLog('error', 'Check follow status error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.chatroom.follow_status_error', {}, req.language?.current || 'en'));
    }
};

// Follow user from chatroom
const followUserFromChatroomEndpoint = async (req, res) => {
    try {
        if (!res.locals.user) {
            return response(res, 401, i18n.translateSync('api.chatroom.auth_required', {}, req.language?.current || 'en'));
        }

        const request = sanitizeRequestBody(req.body);
        
        if (!request.username) {
            return response(res, 400, i18n.translateSync('api.chatroom.username_required', {}, req.language?.current || 'en'));
        }

        // Find the user to follow
        const targetUser = await getUserByUsername(request.username);
        if (!targetUser || targetUser.length === 0) {
            return response(res, 404, i18n.translateSync('api.chatroom.user_not_found', {}, req.language?.current || 'en'));
        }

        const followingId = targetUser[0].id;
        
        // Can't follow yourself
        if (followingId === res.locals.user.id) {
            return response(res, 400, i18n.translateSync('api.chatroom.cannot_follow_self', {}, req.language?.current || 'en'));
        }

        // Check if already following
        const alreadyFollowing = await isFollowing(res.locals.user.id, followingId);
        if (alreadyFollowing) {
            return response(res, 400, i18n.translateSync('api.chatroom.already_following', {}, req.language?.current || 'en'));
        }

        const result = await followUser(res.locals.user.id, followingId);
        if (result) {
            // Award EXP for following a user (if function exists)
            let expResult = null;
            try {
                expResult = await awardFollowUserExp(res.locals.user.id, followingId, targetUser[0].username, req);
            } catch (expError) {
                consoleLog('warning', 'Failed to award follow EXP', { error: expError.message });
            }
            
            // Send real-time notification to the target user (if function exists)
            try {
                await notifyUserFollowed(res.locals.user.id, followingId, {
                    followerUsername: res.locals.user.username,
                    followerAvatar: res.locals.user.avatarUrl
                });
            } catch (notifyError) {
                consoleLog('warning', 'Failed to send follow notification', { error: notifyError.message });
            }
            
            return response(res, 200, i18n.translateSync('api.chatroom.follow_success', { username: targetUser[0].username }, req.language?.current || 'en'), {
                expResult: expResult,
                isFollowing: true,
                targetUser: {
                    id: targetUser[0].id,
                    username: targetUser[0].username
                }
            });
        }

        return response(res, 500, i18n.translateSync('api.chatroom.follow_failed', {}, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', 'Follow user from chatroom error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.chatroom.follow_error', {}, req.language?.current || 'en'));
    }
};

// Unfollow user from chatroom
const unfollowUserFromChatroomEndpoint = async (req, res) => {
    try {
        if (!res.locals.user) {
            return response(res, 401, i18n.translateSync('api.chatroom.auth_required', {}, req.language?.current || 'en'));
        }

        const request = sanitizeRequestBody(req.body);
        
        if (!request.username) {
            return response(res, 400, i18n.translateSync('api.chatroom.username_required', {}, req.language?.current || 'en'));
        }

        // Find the user to unfollow
        const targetUser = await getUserByUsername(request.username);
        if (!targetUser || targetUser.length === 0) {
            return response(res, 404, i18n.translateSync('api.chatroom.user_not_found', {}, req.language?.current || 'en'));
        }

        const followingId = targetUser[0].id;
        
        // Check if currently following
        const currentlyFollowing = await isFollowing(res.locals.user.id, followingId);
        if (!currentlyFollowing) {
            return response(res, 400, i18n.translateSync('api.chatroom.not_following', {}, req.language?.current || 'en'));
        }

        const result = await unfollowUser(res.locals.user.id, followingId);
        if (result) {
            // Send real-time notification to the target user (if function exists)
            try {
                await notifyUserUnfollowed(res.locals.user.id, followingId, {
                    unfollowerUsername: res.locals.user.username,
                    unfollowerAvatar: res.locals.user.avatarUrl
                });
            } catch (notifyError) {
                consoleLog('warning', 'Failed to send unfollow notification', { error: notifyError.message });
            }
            
            return response(res, 200, i18n.translateSync('api.chatroom.unfollow_success', { username: targetUser[0].username }, req.language?.current || 'en'), {
                isFollowing: false,
                targetUser: {
                    id: targetUser[0].id,
                    username: targetUser[0].username
                }
            });
        }

        return response(res, 500, i18n.translateSync('api.chatroom.unfollow_failed', {}, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', 'Unfollow user from chatroom error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.chatroom.unfollow_error', {}, req.language?.current || 'en'));
    }
};

// Get available character types from filesystem
const getCharacterTypesEndpoint = async (req, res) => {
    try {
        const charactersPath = path.join(process.cwd(), 'public', 'chatroom', 'characters');
        
        // Check if the characters directory exists
        if (!fs.existsSync(charactersPath)) {
            consoleLog('warning', 'Characters directory not found', { path: charactersPath });
            return response(res, 200, i18n.translateSync('api.chatroom.character_types_retrieved', {}, req.language?.current || 'en'), ['Fighter']);
        }
        
        // Read directory contents
        const items = fs.readdirSync(charactersPath, { withFileTypes: true });
        
        // Filter for directories only and check if they have character.json
        const characterTypes = [];
        for (const item of items) {
            if (item.isDirectory()) {
                const characterJsonPath = path.join(charactersPath, item.name, 'character.json');
                if (fs.existsSync(characterJsonPath)) {
                    characterTypes.push(item.name);
                }
            }
        }
        
        // Fallback to Fighter if no characters found
        const availableTypes = characterTypes.length > 0 ? characterTypes : ['Fighter'];
        
        consoleLog('info', 'Character types loaded', { 
            charactersPath, 
            availableTypes,
            foundCount: characterTypes.length 
        });
        
        return response(res, 200, i18n.translateSync('api.chatroom.character_types_retrieved', {}, req.language?.current || 'en'), availableTypes);
    } catch (error) {
        consoleLog('error', 'Get character types error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.chatroom.character_types_error', {}, req.language?.current || 'en'), ['Fighter']);
    }
};


export {
    index,
    awardChatroomExpEndpoint,
    updateChatroomCharacterEndpoint,
    saveChatroomCoordinatesEndpoint,
    getChatroomDataEndpoint,
    getChatroomStatsEndpoint,
    sendFloatingChatMessageEndpoint,
    getChatHistoryEndpoint,
    checkFollowStatusEndpoint,
    followUserFromChatroomEndpoint,
    unfollowUserFromChatroomEndpoint,
    getCharacterTypesEndpoint
}