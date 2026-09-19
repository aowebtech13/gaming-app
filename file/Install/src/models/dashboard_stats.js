import executeQuery from "../utils/mysql.js";
import CacheUtils from '../utils/cache.js';

// Initialize dashboard stats cache
CacheUtils.initCache('dashboard-stats', 5 * 60 * 1000); // 5 minutes

const getTotalUsers = async () => {
    const data = await executeQuery("SELECT COUNT(*) as total FROM users WHERE is_active = 1", []);
    return data[0]?.total || 0;
}

const getTotalGames = async () => {
    const data = await executeQuery("SELECT COUNT(*) as total FROM games WHERE is_active = 1", []);
    return data[0]?.total || 0;
}

const getTotalCategories = async () => {
    const data = await executeQuery("SELECT COUNT(*) as total FROM categories WHERE is_active = 1", []);
    return data[0]?.total || 0;
}

const getTotalPages = async () => {
    const data = await executeQuery("SELECT COUNT(*) as total FROM pages WHERE is_published = 1", []);
    return data[0]?.total || 0;
}

const getTotalGamePlays = async () => {
    const data = await executeQuery("SELECT SUM(play_count) as total FROM games WHERE is_active = 1", []);
    return data[0]?.total || 0;
}

const getTotalFavorites = async () => {
    const data = await executeQuery("SELECT COUNT(*) as total FROM favorites", []);
    return data[0]?.total || 0;
}

const getTotalComments = async () => {
    const data = await executeQuery("SELECT COUNT(*) as total FROM game_comments WHERE is_active = 1", []);
    return data[0]?.total || 0;
}

const getTotalRatings = async () => {
    const data = await executeQuery("SELECT COUNT(*) as total FROM game_ratings", []);
    return data[0]?.total || 0;
}

const getNewUsersToday = async () => {
    const data = await executeQuery("SELECT COUNT(*) as total FROM users WHERE DATE(created_at) = CURDATE() AND is_active = 1", []);
    return data[0]?.total || 0;
}

const getNewUsersThisWeek = async () => {
    const data = await executeQuery("SELECT COUNT(*) as total FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND is_active = 1", []);
    return data[0]?.total || 0;
}

const getNewUsersThisMonth = async () => {
    const data = await executeQuery("SELECT COUNT(*) as total FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND is_active = 1", []);
    return data[0]?.total || 0;
}

const getActiveUsersToday = async () => {
    const data = await executeQuery("SELECT COUNT(*) as total FROM users WHERE DATE(last_login) = CURDATE() AND is_active = 1", []);
    return data[0]?.total || 0;
}

const getTopPlayedGames = async (limit = 5) => {
    // Sanitize limit for MySQL 9.3+ compatibility
    const safeLimit = Math.max(1, Math.min(1000, parseInt(limit) || 5));
    
    const data = await executeQuery(`
        SELECT g.id, g.title, g.play_count, g.thumbnail, c.name as category_name
        FROM games g
        LEFT JOIN categories c ON g.category_id = c.id
        WHERE g.is_active = 1
        ORDER BY g.play_count DESC
        LIMIT ${safeLimit}
    `, []);
    return data;
}

const getTopRatedGames = async (limit = 5) => {
    // Sanitize limit for MySQL 9.3+ compatibility
    const safeLimit = Math.max(1, Math.min(1000, parseInt(limit) || 5));
    
    const data = await executeQuery(`
        SELECT g.id, g.title, g.thumbnail, c.name as category_name,
               AVG(r.rating) as avg_rating, COUNT(r.rating) as rating_count
        FROM games g
        LEFT JOIN categories c ON g.category_id = c.id
        LEFT JOIN game_ratings r ON g.id = r.game_id
        WHERE g.is_active = 1
        GROUP BY g.id
        HAVING COUNT(r.rating) > 0
        ORDER BY avg_rating DESC, rating_count DESC
        LIMIT ${safeLimit}
    `, []);
    return data;
}

const getRecentUsers = async (limit = 5) => {
    // Sanitize limit for MySQL 9.3+ compatibility
    const safeLimit = Math.max(1, Math.min(1000, parseInt(limit) || 5));
    
    const data = await executeQuery(`
        SELECT id, username, first_name, last_name, created_at, user_type, level
        FROM users
        WHERE is_active = 1
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
    `, []);
    return data;
}

const getRecentComments = async (limit = 5) => {
    // Sanitize limit for MySQL 9.3+ compatibility
    const safeLimit = Math.max(1, Math.min(1000, parseInt(limit) || 5));
    
    const data = await executeQuery(`
        SELECT gc.id, gc.comment, gc.created_at, u.username, g.title as game_title
        FROM game_comments gc
        LEFT JOIN users u ON gc.user_id = u.id
        LEFT JOIN games g ON gc.game_id = g.id
        WHERE gc.is_active = 1
        ORDER BY gc.created_at DESC
        LIMIT ${safeLimit}
    `, []);
    return data;
}

const getCategoryStats = async () => {
    const data = await executeQuery(`
        SELECT c.name, c.icon, c.color, COUNT(g.id) as game_count, SUM(g.play_count) as total_plays
        FROM categories c
        LEFT JOIN games g ON c.id = g.category_id AND g.is_active = 1
        WHERE c.is_active = 1
        GROUP BY c.id
        ORDER BY game_count DESC
    `, []);
    return data;
}

const getUserTypeStats = async () => {
    const data = await executeQuery(`
        SELECT user_type, COUNT(*) as count
        FROM users
        WHERE is_active = 1
        GROUP BY user_type
        ORDER BY count DESC
    `, []);
    return data;
}

const getPopularSearches = async (limit = 10) => {
    // Sanitize limit for MySQL 9.3+ compatibility
    const safeLimit = Math.max(1, Math.min(1000, parseInt(limit) || 10));
    
    const data = await executeQuery(`
        SELECT query, search_count, last_searched
        FROM search_queries
        ORDER BY search_count DESC
        LIMIT ${safeLimit}
    `, []);
    return data;
}

const getSystemStats = async () => {
    const cacheKey = 'system-overview';
    
    // Try to get cached data
    const cached = await CacheUtils.get('dashboard-stats', cacheKey);
    if (cached) {
        return cached;
    }

    // Gather all stats
    const stats = {
        totals: {
            users: await getTotalUsers(),
            games: await getTotalGames(),
            categories: await getTotalCategories(),
            pages: await getTotalPages(),
            gamePlays: await getTotalGamePlays(),
            favorites: await getTotalFavorites(),
            comments: await getTotalComments(),
            ratings: await getTotalRatings()
        },
        users: {
            newToday: await getNewUsersToday(),
            newThisWeek: await getNewUsersThisWeek(),
            newThisMonth: await getNewUsersThisMonth(),
            activeToday: await getActiveUsersToday()
        },
        topGames: {
            mostPlayed: await getTopPlayedGames(5),
            topRated: await getTopRatedGames(5)
        },
        recent: {
            users: await getRecentUsers(5),
            comments: await getRecentComments(5)
        },
        categories: await getCategoryStats(),
        userTypes: await getUserTypeStats(),
        popularSearches: await getPopularSearches(10)
    };

    // Cache the results
    await CacheUtils.put('dashboard-stats', cacheKey, stats);
    
    return stats;
}

export {
    getTotalUsers,
    getTotalGames,
    getTotalCategories,
    getTotalPages,
    getTotalGamePlays,
    getTotalFavorites,
    getTotalComments,
    getTotalRatings,
    getNewUsersToday,
    getNewUsersThisWeek,
    getNewUsersThisMonth,
    getActiveUsersToday,
    getTopPlayedGames,
    getTopRatedGames,
    getRecentUsers,
    getRecentComments,
    getCategoryStats,
    getUserTypeStats,
    getPopularSearches,
    getSystemStats
}