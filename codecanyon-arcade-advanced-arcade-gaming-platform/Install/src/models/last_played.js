import executeQuery from "../utils/mysql.js";

const getLastPlayedByUserId = async (userId, limit = 10) => {
    const query = `
        SELECT g.id, g.title, g.slug, g.thumbnail, g.category_id, 
               lp.played_at, c.name as category_name
        FROM last_played lp
        JOIN games g ON g.id = lp.game_id
        LEFT JOIN categories c ON c.id = g.category_id
        WHERE lp.user_id = ? AND g.is_active = 1
        ORDER BY lp.played_at DESC
        LIMIT ?
    `;
    const data = await executeQuery(query, [userId, limit]);
    return data;
};

const addLastPlayed = async (userId, gameId) => {
    // First, check if this game was already played recently
    const existingQuery = "SELECT id FROM last_played WHERE user_id = ? AND game_id = ?";
    const existing = await executeQuery(existingQuery, [userId, gameId]);
    
    if (existing.length > 0) {
        // Update the played_at timestamp
        const updateQuery = "UPDATE last_played SET played_at = NOW() WHERE user_id = ? AND game_id = ?";
        const data = await executeQuery(updateQuery, [userId, gameId]);
        return data;
    } else {
        // Insert new record
        const insertQuery = "INSERT INTO last_played (user_id, game_id) VALUES (?, ?)";
        const data = await executeQuery(insertQuery, [userId, gameId]);
        return data;
    }
};

const removeLastPlayed = async (userId, gameId) => {
    const query = "DELETE FROM last_played WHERE user_id = ? AND game_id = ?";
    const data = await executeQuery(query, [userId, gameId]);
    return data;
};

const clearLastPlayedByUserId = async (userId) => {
    const query = "DELETE FROM last_played WHERE user_id = ?";
    const data = await executeQuery(query, [userId]);
    return data;
};

export {
    getLastPlayedByUserId,
    addLastPlayed,
    removeLastPlayed,
    clearLastPlayedByUserId
};