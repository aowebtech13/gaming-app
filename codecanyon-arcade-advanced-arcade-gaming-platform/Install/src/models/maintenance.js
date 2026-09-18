import executeQuery from "../utils/mysql.js";

// Database optimization operations
const optimizeTable = async (tableName) => {
    return await executeQuery(`OPTIMIZE TABLE ${tableName}`, []);
}

const optimizeAllTables = async () => {
    const tables = [
        'users', 'games', 'categories', 'favorites', 'follows', 
        'last_played', 'game_comments', 'game_ratings', 'settings',
        'pages', 'search_queries', 'exp_events', 'exp_ranks', 'game_scores', 
        'game_leaderboards', 'password_reset_tokens', 'oauth_accounts', 
        'email_logs', 'cron_logs', 'email_verification_tokens'
    ];
    
    const results = [];
    for (const table of tables) {
        try {
            await optimizeTable(table);
            results.push(`Optimized table: ${table}`);
        } catch (error) {
            results.push(`Failed to optimize table ${table}: ${error.message}`);
        }
    }
    
    return results;
}

// Leaderboard ranking updates
const updateGameLeaderboardRankings = async () => {
    return await executeQuery(`
        UPDATE game_leaderboards gl
        SET rank_position = (
            SELECT ranking FROM (
                SELECT user_id, game_id, 
                       ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY high_score DESC) as ranking
                FROM game_leaderboards
            ) ranked
            WHERE ranked.user_id = gl.user_id AND ranked.game_id = gl.game_id
        )
    `, []);
}

// User statistics for monthly reports
const getUserStatistics = async () => {
    return await executeQuery(`
        SELECT 
            COUNT(*) as total_users,
            COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_users,
            COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_users_30d,
            COUNT(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as active_users_30d
        FROM users
    `, []);
}

// Game statistics for monthly reports
const getGameStatistics = async () => {
    return await executeQuery(`
        SELECT 
            COUNT(*) as total_games,
            COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_games,
            SUM(play_count) as total_plays,
            AVG(play_count) as avg_plays_per_game
        FROM games
    `, []);
}

// Top games by plays for monthly reports
const getTopGamesByPlays = async (limit = 10) => {
    return await executeQuery(`
        SELECT title, play_count, category_id
        FROM games 
        WHERE is_active = 1
        ORDER BY play_count DESC 
        LIMIT ?
    `, [limit]);
}

// Activity statistics for monthly reports
const getActivityStatistics = async () => {
    return await executeQuery(`
        SELECT 
            COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as comments_30d,
            COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as comments_7d
        FROM game_comments
    `, []);
}

// Search statistics for monthly reports
const getSearchStatistics = async () => {
    return await executeQuery(`
        SELECT 
            COUNT(*) as total_unique_queries,
            SUM(search_count) as total_searches,
            AVG(search_count) as avg_searches_per_query
        FROM search_queries
    `, []);
}

// Update last run timestamp for cron jobs
const updateCronLastRun = async (cronType) => {
    const settingName = `cron_last_run_${cronType}`;
    return await executeQuery(
        "INSERT INTO settings (name, value) VALUES (?, NOW()) ON DUPLICATE KEY UPDATE value = NOW()",
        [settingName]
    );
}

export {
    optimizeTable,
    optimizeAllTables,
    updateGameLeaderboardRankings,
    getUserStatistics,
    getGameStatistics,
    getTopGamesByPlays,
    getActivityStatistics,
    getSearchStatistics,
    updateCronLastRun
}