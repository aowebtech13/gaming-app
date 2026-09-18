import executeQuery from "../utils/mysql.js";
import crypto from 'crypto';

const logSearchQuery = async (query) => {
    if (!query || query.trim() === '') return;
    
    const trimmedQuery = query.trim().toLowerCase();
    const queryHash = crypto.createHash('md5').update(trimmedQuery).digest('hex');
    
    // Check if query already exists
    const existing = await executeQuery(
        "SELECT id, search_count FROM search_queries WHERE query_hash = ? LIMIT 1",
        [queryHash]
    );
    
    if (existing && existing.length > 0) {
        // Update existing query count
        return await executeQuery(
            "UPDATE search_queries SET search_count = search_count + 1, last_searched = NOW() WHERE id = ?",
            [existing[0].id]
        );
    } else {
        // Insert new query
        return await executeQuery(
            "INSERT INTO search_queries (query, query_hash, search_count, last_searched) VALUES (?, ?, 1, NOW())",
            [trimmedQuery, queryHash]
        );
    }
}

const getPopularSearchQueries = async (limit = 20) => {
    return await executeQuery(
        "SELECT query, search_count, last_searched FROM search_queries ORDER BY search_count DESC, last_searched DESC LIMIT ?",
        [limit]
    );
}

const getRecentSearchQueries = async (limit = 50) => {
    return await executeQuery(
        "SELECT query, search_count, last_searched FROM search_queries ORDER BY last_searched DESC LIMIT ?",
        [limit]
    );
}

const searchQueryExists = async (query) => {
    const queryHash = crypto.createHash('md5').update(query.trim().toLowerCase()).digest('hex');
    const result = await executeQuery(
        "SELECT id FROM search_queries WHERE query_hash = ? LIMIT 1",
        [queryHash]
    );
    return result && result.length > 0;
}

const getSearchQueryStats = async () => {
    return await executeQuery(`
        SELECT 
            COUNT(*) as total_unique_queries,
            SUM(search_count) as total_searches,
            AVG(search_count) as avg_searches_per_query,
            MAX(search_count) as max_searches_for_query,
            DATE(last_searched) as date,
            COUNT(DISTINCT DATE(last_searched)) as active_days
        FROM search_queries 
        WHERE last_searched >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(last_searched)
        ORDER BY date DESC
    `, []);
}

const cleanupOldSearchQueries = async (daysToKeep = 365) => {
    return await executeQuery(
        "DELETE FROM search_queries WHERE last_searched < DATE_SUB(NOW(), INTERVAL ? DAY) AND search_count < 2",
        [daysToKeep]
    );
}

const cleanupSearchQueriesKeepTop = async (keepTopN = 1000) => {
    return await executeQuery(`
        DELETE FROM search_queries 
        WHERE id NOT IN (
            SELECT id FROM (
                SELECT id FROM search_queries 
                ORDER BY search_count DESC, last_searched DESC 
                LIMIT ?
            ) as temp
        )
    `, [keepTopN]);
}

export {
    logSearchQuery,
    getPopularSearchQueries,
    getRecentSearchQueries,
    searchQueryExists,
    getSearchQueryStats,
    cleanupOldSearchQueries,
    cleanupSearchQueriesKeepTop
}