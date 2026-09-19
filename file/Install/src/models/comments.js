import executeQuery from "../utils/mysql.js";

const getCommentsByGameId = async (gameId, limit = 5, offset = 0) => {
    const data = await executeQuery(`
        SELECT c.*, u.username, u.avatar 
        FROM game_comments c 
        JOIN users u ON c.user_id = u.id 
        WHERE c.game_id = ? AND c.is_active = 1 
        ORDER BY c.created_at DESC 
        LIMIT ? OFFSET ?
    `, [gameId, limit, offset]);
    return data;
};

const getCommentCountByGameId = async (gameId) => {
    const data = await executeQuery(`
        SELECT COUNT(*) as count 
        FROM game_comments 
        WHERE game_id = ? AND is_active = 1
    `, [gameId]);
    return data[0]?.count || 0;
};

const createComment = async (gameId, userId, comment) => {
    const data = await executeQuery(`
        INSERT INTO game_comments (game_id, user_id, comment) 
        VALUES (?, ?, ?)
    `, [gameId, userId, comment]);
    return data;
};

const deleteComment = async (commentId, userId) => {
    const data = await executeQuery(`
        UPDATE game_comments 
        SET is_active = 0 
        WHERE id = ? AND user_id = ?
    `, [commentId, userId]);
    return data;
};

const getCommentById = async (commentId) => {
    const data = await executeQuery(`
        SELECT c.*, u.username, g.title as game_title 
        FROM game_comments c 
        LEFT JOIN users u ON c.user_id = u.id 
        LEFT JOIN games g ON c.game_id = g.id 
        WHERE c.id = ?
    `, [commentId]);
    return data;
};

export {
    getCommentsByGameId,
    getCommentCountByGameId,
    createComment,
    deleteComment,
    getCommentById
};