import executeQuery from "../utils/mysql.js";

const getLeaderboardByGame = async (gameId, limit = 10) => {
    return await executeQuery(`
        SELECT 
            gl.id,
            gl.game_id,
            gl.user_id,
            gl.username,
            gl.high_score,
            gl.score_count,
            gl.first_score_date,
            gl.last_score_date,
            gl.rank_position,
            gl.updated_at
        FROM game_leaderboards gl 
        WHERE gl.game_id = ? 
        ORDER BY gl.rank_position ASC 
        LIMIT ?
    `, [gameId, limit]);
}

const getTopPlayers = async (limit = 50) => {
    return await executeQuery(`
        SELECT 
            gl.user_id,
            gl.username,
            COUNT(gl.game_id) as games_played,
            SUM(gl.high_score) as total_score,
            AVG(gl.high_score) as avg_score,
            MAX(gl.high_score) as best_score,
            SUM(gl.score_count) as total_attempts,
            u.avatar,
            u.oauth_avatar,
            u.first_name,
            u.last_name
        FROM game_leaderboards gl 
        LEFT JOIN users u ON gl.user_id = u.id
        GROUP BY gl.user_id, gl.username, u.avatar, u.oauth_avatar, u.first_name, u.last_name
        ORDER BY total_score DESC, games_played DESC
        LIMIT ?
    `, [limit]);
}

const getWeeklyTopPlayers = async (limit = 50) => {
    return await executeQuery(`
        SELECT 
            gl.user_id,
            gl.username,
            COUNT(gl.game_id) as games_played,
            SUM(gl.high_score) as total_score,
            AVG(gl.high_score) as avg_score,
            MAX(gl.high_score) as best_score,
            SUM(gl.score_count) as total_attempts,
            u.avatar,
            u.oauth_avatar,
            u.first_name,
            u.last_name
        FROM game_leaderboards gl 
        LEFT JOIN users u ON gl.user_id = u.id
        WHERE gl.last_score_date >= CURDATE() - INTERVAL 7 DAY
        GROUP BY gl.user_id, gl.username, u.avatar, u.oauth_avatar, u.first_name, u.last_name
        ORDER BY total_score DESC, games_played DESC
        LIMIT ?
    `, [limit]);
}

const getMonthlyTopPlayers = async (limit = 50) => {
    return await executeQuery(`
        SELECT 
            gl.user_id,
            gl.username,
            COUNT(gl.game_id) as games_played,
            SUM(gl.high_score) as total_score,
            AVG(gl.high_score) as avg_score,
            MAX(gl.high_score) as best_score,
            SUM(gl.score_count) as total_attempts,
            u.avatar,
            u.oauth_avatar,
            u.first_name,
            u.last_name
        FROM game_leaderboards gl 
        LEFT JOIN users u ON gl.user_id = u.id
        WHERE gl.last_score_date >= CURDATE() - INTERVAL 30 DAY
        GROUP BY gl.user_id, gl.username, u.avatar, u.oauth_avatar, u.first_name, u.last_name
        ORDER BY total_score DESC, games_played DESC
        LIMIT ?
    `, [limit]);
}

const getUserLeaderboards = async (userId, limit = 20) => {
    return await executeQuery(`
        SELECT 
            gl.id,
            gl.game_id,
            gl.high_score,
            gl.score_count,
            gl.rank_position,
            gl.first_score_date,
            gl.last_score_date,
            g.title as game_title
        FROM game_leaderboards gl
        LEFT JOIN games g ON gl.game_id = g.id
        WHERE gl.user_id = ?
        ORDER BY gl.high_score DESC
        LIMIT ?
    `, [userId, limit]);
}

const updateLeaderboard = async (gameId, userId, username, newScore) => {
    // Check if user already has a leaderboard entry for this game
    const existing = await executeQuery(
        "SELECT id, high_score, score_count FROM game_leaderboards WHERE game_id = ? AND user_id = ? LIMIT 1",
        [gameId, userId]
    );

    if (existing && existing.length > 0) {
        // Update existing entry if new score is higher
        const currentHighScore = existing[0].high_score;
        if (newScore > currentHighScore) {
            return await executeQuery(
                "UPDATE game_leaderboards SET high_score = ?, score_count = score_count + 1, last_score_date = NOW(), updated_at = NOW() WHERE id = ?",
                [newScore, existing[0].id]
            );
        } else {
            // Just increment score count
            return await executeQuery(
                "UPDATE game_leaderboards SET score_count = score_count + 1, last_score_date = NOW(), updated_at = NOW() WHERE id = ?",
                [existing[0].id]
            );
        }
    } else {
        // Create new leaderboard entry
        return await executeQuery(
            "INSERT INTO game_leaderboards (game_id, user_id, username, high_score, score_count, first_score_date, last_score_date) VALUES (?, ?, ?, ?, 1, NOW(), NOW())",
            [gameId, userId, username, newScore]
        );
    }
}

const recalculateRankings = async (gameId) => {
    // Update rank positions for a specific game
    return await executeQuery(`
        UPDATE game_leaderboards gl1
        SET rank_position = (
            SELECT COUNT(*) + 1
            FROM game_leaderboards gl2
            WHERE gl2.game_id = gl1.game_id 
            AND gl2.high_score > gl1.high_score
        )
        WHERE gl1.game_id = ?
    `, [gameId]);
}

const recalculateAllRankings = async () => {
    // Update rank positions for all games
    return await executeQuery(`
        UPDATE game_leaderboards gl1
        SET rank_position = (
            SELECT COUNT(*) + 1
            FROM game_leaderboards gl2
            WHERE gl2.game_id = gl1.game_id 
            AND gl2.high_score > gl1.high_score
        )
    `, []);
}

const getLeaderboardStats = async () => {
    return await executeQuery(`
        SELECT 
            COUNT(DISTINCT game_id) as total_games_with_scores,
            COUNT(DISTINCT user_id) as total_players,
            COUNT(*) as total_leaderboard_entries,
            AVG(high_score) as avg_high_score,
            MAX(high_score) as highest_score,
            SUM(score_count) as total_score_submissions
        FROM game_leaderboards
    `, []);
}

const getGameRankings = async (gameId) => {
    return await executeQuery(`
        SELECT 
            rank_position,
            username,
            high_score,
            score_count,
            last_score_date
        FROM game_leaderboards 
        WHERE game_id = ? AND rank_position IS NOT NULL
        ORDER BY rank_position ASC
    `, [gameId]);
}

const deleteLeaderboardEntry = async (id) => {
    return await executeQuery("DELETE FROM game_leaderboards WHERE id = ?", [id]);
}

export {
    getLeaderboardByGame,
    getTopPlayers,
    getWeeklyTopPlayers,
    getMonthlyTopPlayers,
    getUserLeaderboards,
    updateLeaderboard,
    recalculateRankings,
    recalculateAllRankings,
    getLeaderboardStats,
    getGameRankings,
    deleteLeaderboardEntry
}