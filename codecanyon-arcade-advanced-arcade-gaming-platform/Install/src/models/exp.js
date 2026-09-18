import executeQuery from "../utils/mysql.js";

// Get user's current EXP and level data
const getUserExpData = async (userId) => {
    return await executeQuery(
        "SELECT id, level, exp_points, total_exp_earned FROM users WHERE id = ? LIMIT 1", 
        [userId]
    );
}

// Get level requirements for a specific level
const getLevelRequirements = async (level) => {
    return await executeQuery(
        "SELECT * FROM exp_ranks WHERE level = ? LIMIT 1", 
        [level]
    );
}

// Update user's EXP and level
const updateUserExp = async (userId, newExpPoints, newLevel, expGained) => {
    return await executeQuery(
        "UPDATE users SET exp_points = ?, level = ?, total_exp_earned = total_exp_earned + ? WHERE id = ?",
        [newExpPoints, newLevel, expGained, userId]
    );
}

// Log EXP event
const logExpEvent = async (userId, eventType, expAmount, description, sourceId = null) => {
    return await executeQuery(
        "INSERT INTO exp_events (user_id, event_type, event_source_id, exp_amount, description, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
        [userId, eventType, sourceId, expAmount, description]
    );
}

// Get user's EXP history
const getUserExpHistory = async (userId, limit = 50) => {
    return await executeQuery(
        "SELECT * FROM exp_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
        [userId, limit]
    );
}

// Get EXP events for a specific event type
const getExpEventsByType = async (userId, eventType, limit = 10) => {
    return await executeQuery(
        "SELECT * FROM exp_events WHERE user_id = ? AND event_type = ? ORDER BY created_at DESC LIMIT ?",
        [userId, eventType, limit]
    );
}

// Get total EXP earned by event type
const getExpByEventType = async (userId, eventType) => {
    return await executeQuery(
        "SELECT COALESCE(SUM(exp_amount), 0) as total_exp FROM exp_events WHERE user_id = ? AND event_type = ?",
        [userId, eventType]
    );
}

// Get recent EXP events for all users (leaderboard data)
const getRecentExpEvents = async (limit = 20) => {
    return await executeQuery(`
        SELECT e.*, u.username, u.avatar 
        FROM exp_events e 
        JOIN users u ON e.user_id = u.id 
        WHERE u.is_active = 1 
        ORDER BY e.created_at DESC 
        LIMIT ?
    `, [limit]);
}

// Get top users by level
const getTopUsersByLevel = async (limit = 10) => {
    return await executeQuery(`
        SELECT u.id, u.username, u.avatar, u.level, u.exp_points, u.total_exp_earned
        FROM users u 
        WHERE u.is_active = 1 AND u.user_type != 'admin'
        ORDER BY u.level DESC, u.exp_points DESC 
        LIMIT ?
    `, [limit]);
}

// Get user's rank by level
const getUserRank = async (userId) => {
    const result = await executeQuery(`
        SELECT COUNT(*) + 1 as rank
        FROM users u1
        JOIN users u2 ON u2.id = ?
        WHERE u1.is_active = 1 
        AND u1.user_type != 'admin'
        AND (u1.level > u2.level OR (u1.level = u2.level AND u1.exp_points > u2.exp_points))
    `, [userId]);
    return result[0]?.rank || 1;
}

// Check if user has earned EXP for a specific action today
const hasEarnedExpToday = async (userId, eventType, sourceId = null) => {
    const today = new Date().toISOString().split('T')[0];
    const query = sourceId 
        ? "SELECT COUNT(*) as count FROM exp_events WHERE user_id = ? AND event_type = ? AND event_source_id = ? AND DATE(created_at) = ?"
        : "SELECT COUNT(*) as count FROM exp_events WHERE user_id = ? AND event_type = ? AND DATE(created_at) = ?";
    
    const params = sourceId ? [userId, eventType, sourceId, today] : [userId, eventType, today];
    const result = await executeQuery(query, params);
    return result[0]?.count > 0;
}

// Get EXP settings from database
const getExpSettings = async () => {
    const settings = await executeQuery(
        "SELECT name, value FROM settings WHERE name LIKE 'exp_%'"
    );
    const expSettings = {};
    settings.forEach(setting => {
        expSettings[setting.name] = setting.value;
    });
    return expSettings;
}

// Get top users by EXP for leaderboard (all-time)
const getTopUsersByExp = async (limit = 50) => {
    return await executeQuery(`
        SELECT 
            u.id,
            u.username,
            u.first_name,
            u.last_name,
            u.email,
            u.avatar,
            u.oauth_avatar,
            u.level,
            u.exp_points,
            u.total_exp_earned,
            u.created_at
        FROM users u 
        WHERE u.is_active = 1 AND u.user_type != 'admin'
        ORDER BY u.total_exp_earned DESC, u.level DESC, u.exp_points DESC
        LIMIT ?
    `, [limit]);
}

// Get top users by EXP for weekly leaderboard
const getWeeklyTopUsersByExp = async (limit = 50) => {
    return await executeQuery(`
        SELECT 
            u.id,
            u.username,
            u.first_name,
            u.last_name,
            u.email,
            u.avatar,
            u.oauth_avatar,
            u.level,
            u.exp_points,
            u.total_exp_earned,
            COALESCE(SUM(e.exp_amount), 0) as weekly_exp_gained,
            u.created_at
        FROM users u 
        LEFT JOIN exp_events e ON u.id = e.user_id 
            AND e.created_at >= CURDATE() - INTERVAL 7 DAY
        WHERE u.is_active = 1 AND u.user_type != 'admin'
        GROUP BY u.id, u.username, u.first_name, u.last_name, u.email, u.avatar, u.oauth_avatar, 
                 u.level, u.exp_points, u.total_exp_earned, u.created_at
        HAVING weekly_exp_gained > 0 OR u.total_exp_earned > 0
        ORDER BY weekly_exp_gained DESC, u.total_exp_earned DESC, u.level DESC
        LIMIT ?
    `, [limit]);
}

// Get top users by EXP for monthly leaderboard
const getMonthlyTopUsersByExp = async (limit = 50) => {
    return await executeQuery(`
        SELECT 
            u.id,
            u.username,
            u.first_name,
            u.last_name,
            u.email,
            u.avatar,
            u.oauth_avatar,
            u.level,
            u.exp_points,
            u.total_exp_earned,
            COALESCE(SUM(e.exp_amount), 0) as monthly_exp_gained,
            u.created_at
        FROM users u 
        LEFT JOIN exp_events e ON u.id = e.user_id 
            AND e.created_at >= CURDATE() - INTERVAL 30 DAY
        WHERE u.is_active = 1 AND u.user_type != 'admin'
        GROUP BY u.id, u.username, u.first_name, u.last_name, u.email, u.avatar, u.oauth_avatar, 
                 u.level, u.exp_points, u.total_exp_earned, u.created_at
        HAVING monthly_exp_gained > 0 OR u.total_exp_earned > 0
        ORDER BY monthly_exp_gained DESC, u.total_exp_earned DESC, u.level DESC
        LIMIT ?
    `, [limit]);
}

export {
    getUserExpData,
    getLevelRequirements,
    updateUserExp,
    logExpEvent,
    getUserExpHistory,
    getExpEventsByType,
    getExpByEventType,
    getRecentExpEvents,
    getTopUsersByLevel,
    getUserRank,
    hasEarnedExpToday,
    getExpSettings,
    getTopUsersByExp,
    getWeeklyTopUsersByExp,
    getMonthlyTopUsersByExp
}