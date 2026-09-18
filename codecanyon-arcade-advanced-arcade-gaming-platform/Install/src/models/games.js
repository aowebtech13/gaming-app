import executeQuery from "../utils/mysql.js";
import CacheUtils from '../utils/cache.js';
import { consoleLog } from '../utils/logger.js';

// Initialize top searches cache
CacheUtils.initCache('top-searches', 6 * 60 * 60 * 1000); // 6 hours

// Initialize popular tags cache
CacheUtils.initCache('popular-tags', 2 * 60 * 60 * 1000); // 2 hours

// Initialize featured games cache
CacheUtils.initCache('featured-games', 30 * 60 * 1000); // 30 minutes

const getGameById = async (id) => {
    const data = await executeQuery("SELECT * FROM games WHERE id = ? LIMIT 1", [id]);
    return data;
}

const getGameBySlug = async (slug) => {
    const data = await executeQuery("SELECT * FROM games WHERE slug = ? LIMIT 1", [slug]);
    return data;
}

const getGamesByCategory = async (categoryId) => {
    const data = await executeQuery("SELECT * FROM games WHERE category_id = ? AND is_active = 1", [categoryId]);
    return data;
}

const getGamesByTag = async (tag, limit = 20, offset = 0) => {
    // Ensure parameters are integers to avoid MySQL type issues
    const safeLimit = parseInt(limit) || 20;
    const safeOffset = parseInt(offset) || 0;
    
    const data = await executeQuery(
        "SELECT * FROM games WHERE tags LIKE ? AND is_active = 1 ORDER BY play_count DESC LIMIT ? OFFSET ?", 
        [`%${tag}%`, safeLimit, safeOffset]
    );
    return data;
}

const getTopRatedGames = async (limit = 20, offset = 0) => {
    // Ensure parameters are integers to avoid MySQL type issues
    const safeLimit = parseInt(limit) || 20;
    const safeOffset = parseInt(offset) || 0;
    
    // Temporary fix: Use string interpolation instead of prepared statements
    const query = `SELECT g.*, c.name as category_name,
            AVG(r.rating) as avg_rating, 
            COUNT(r.rating) as total_ratings 
     FROM games g 
     INNER JOIN game_ratings r ON g.id = r.game_id 
     LEFT JOIN categories c ON g.category_id = c.id
     WHERE g.is_active = 1 
     GROUP BY g.id, c.name 
     HAVING COUNT(r.rating) > 0 
     ORDER BY avg_rating DESC, total_ratings DESC 
     LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    
    const data = await executeQuery(query, []);
    return data;
}

const getPopularGames = async (limit = 20, offset = 0) => {
    // Ensure parameters are integers to avoid MySQL type issues
    const safeLimit = parseInt(limit) || 20;
    const safeOffset = parseInt(offset) || 0;
    
    const data = await executeQuery(
        "SELECT g.*, c.name as category_name, COUNT(f.id) as favorite_count FROM games g LEFT JOIN favorites f ON g.id = f.game_id LEFT JOIN categories c ON g.category_id = c.id WHERE g.is_active = 1 GROUP BY g.id, c.name ORDER BY favorite_count DESC, g.play_count DESC LIMIT ? OFFSET ?", 
        [safeLimit, safeOffset]
    );
    return data;
}

const getTrendingGames = async (limit = 20, offset = 0) => {
    // Ensure parameters are integers to avoid MySQL type issues
    const safeLimit = parseInt(limit) || 20;
    const safeOffset = parseInt(offset) || 0;
    
    const data = await executeQuery(
        "SELECT * FROM games WHERE is_active = 1 ORDER BY play_count DESC, created_at DESC LIMIT ? OFFSET ?", 
        [safeLimit, safeOffset]
    );
    return data;
}

const getFeaturedGames = async (limit = 20, offset = 0) => {
    try {
        // Ensure parameters are integers to avoid MySQL type issues
        const safeLimit = parseInt(limit) || 20;
        const safeOffset = parseInt(offset) || 0;
        
        // Try to get cached featured games for homepage requests (limit 6, offset 0)
        if (safeLimit <= 6 && safeOffset === 0) {
            const cacheKey = `featured-games-${safeLimit}`;
            let featuredGames = await CacheUtils.get('featured-games', cacheKey);
            
            if (!featuredGames) {
                // Cache miss - fetch fresh data
                featuredGames = await executeQuery(
                    `SELECT g.*, c.name as category_name 
                     FROM games g 
                     LEFT JOIN categories c ON g.category_id = c.id 
                     WHERE g.is_featured = 1 AND g.is_active = 1 
                     ORDER BY g.play_count DESC, g.created_at DESC 
                     LIMIT ? OFFSET ?`, 
                    [safeLimit, safeOffset]
                );
                
                // Cache the result for 30 minutes
                await CacheUtils.put('featured-games', cacheKey, featuredGames);
            }
            
            return featuredGames;
        } else {
            // For pagination or larger requests, don't cache
            const data = await executeQuery(
                `SELECT g.*, c.name as category_name 
                 FROM games g 
                 LEFT JOIN categories c ON g.category_id = c.id 
                 WHERE g.is_featured = 1 AND g.is_active = 1 
                 ORDER BY g.play_count DESC, g.created_at DESC 
                 LIMIT ? OFFSET ?`, 
                [safeLimit, safeOffset]
            );
            return data;
        }
    } catch (error) {
        consoleLog('database', 'Error fetching featured games', { error: error.message });
        return [];
    }
}

const getRecentGames = async (userId = null, limit = 20, offset = 0) => {
    // Ensure parameters are integers to avoid MySQL type issues
    const safeLimit = parseInt(limit) || 20;
    const safeOffset = parseInt(offset) || 0;
    
    if (userId) {
        // User-specific recent games
        const safeUserId = parseInt(userId);
        const query = `SELECT g.*, c.name as category_name, lp.played_at FROM games g INNER JOIN last_played lp ON g.id = lp.game_id LEFT JOIN categories c ON g.category_id = c.id WHERE lp.user_id = ${safeUserId} AND g.is_active = 1 ORDER BY lp.played_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;
        const data = await executeQuery(query, []);
        return data;
    } else {
        // Global recent games (recently created/updated)
        const query = `SELECT g.*, c.name as category_name FROM games g LEFT JOIN categories c ON g.category_id = c.id WHERE g.is_active = 1 ORDER BY g.created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;
        const data = await executeQuery(query, []);
        return data;
    }
}

const getFavoriteGames = async (userId, limit = 20, offset = 0) => {
    // Ensure parameters are integers to avoid MySQL type issues
    const safeUserId = parseInt(userId);
    const safeLimit = parseInt(limit) || 20;
    const safeOffset = parseInt(offset) || 0;
    
    const data = await executeQuery(
        "SELECT g.*, f.created_at as favorited_at FROM games g INNER JOIN favorites f ON g.id = f.game_id WHERE f.user_id = ? AND g.is_active = 1 ORDER BY f.created_at DESC LIMIT ? OFFSET ?", 
        [safeUserId, safeLimit, safeOffset]
    );
    return data;
}

const getAllGames = async (limit = null, offset = 0) => {
    if (limit === null) {
        // Return all games without pagination (for sitemap generation and thumbnail grid)
        const data = await executeQuery(
            "SELECT id, slug, title, description, category_id, tags, thumbnail, play_count, is_active, created_at, updated_at FROM games WHERE is_active = 1 ORDER BY created_at DESC",
            []
        );
        return data;
    } else {
        // Return paginated results
        // Ensure parameters are integers to avoid MySQL type issues
        const safeLimit = parseInt(limit) || 20;
        const safeOffset = parseInt(offset) || 0;
        
        const data = await executeQuery(
            "SELECT * FROM games WHERE is_active = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?", 
            [safeLimit, safeOffset]
        );
        return data;
    }
}

const searchGames = async (query, limit = 20, offset = 0) => {
    // Ensure parameters are integers to avoid MySQL type issues
    const safeLimit = parseInt(limit) || 20;
    const safeOffset = parseInt(offset) || 0;
    
    const searchTerm = `%${query}%`;
    const data = await executeQuery(
        `SELECT g.*, c.name as category_name 
         FROM games g 
         LEFT JOIN categories c ON g.category_id = c.id 
         WHERE g.is_active = 1 
         AND (g.title LIKE ? OR g.description LIKE ? OR g.tags LIKE ?) 
         ORDER BY 
            CASE 
                WHEN g.title LIKE ? THEN 1
                WHEN g.tags LIKE ? THEN 2 
                ELSE 3 
            END,
            g.play_count DESC, 
            g.created_at DESC 
         LIMIT ? OFFSET ?`, 
        [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, safeLimit, safeOffset]
    );
    return data;
}

const getSearchCount = async (query) => {
    const searchTerm = `%${query}%`;
    const data = await executeQuery(
        `SELECT COUNT(*) as total 
         FROM games 
         WHERE is_active = 1 
         AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)`,
        [searchTerm, searchTerm, searchTerm]
    );
    return data[0]?.total || 0;
}

const getTotalGameCount = async () => {
    const data = await executeQuery(
        "SELECT COUNT(*) as total FROM games WHERE is_active = 1",
        []
    );
    return data[0]?.total || 0;
}

const trackSearchQuery = async (query) => {
    try {
        const trimmedQuery = query.trim().toLowerCase();
        if (!trimmedQuery || trimmedQuery.length < 2) return;
        
        // Create a simple hash for the query to avoid duplicate storage issues
        const crypto = await import('crypto');
        const queryHash = crypto.createHash('md5').update(trimmedQuery).digest('hex');
        
        // Check if query already exists
        const existing = await executeQuery(
            "SELECT id, search_count FROM search_queries WHERE query_hash = ? LIMIT 1",
            [queryHash]
        );
        
        if (existing && existing.length > 0) {
            // Update existing query count and last_searched
            await executeQuery(
                "UPDATE search_queries SET search_count = search_count + 1, last_searched = NOW() WHERE id = ?",
                [existing[0].id]
            );
        } else {
            // Insert new query
            await executeQuery(
                "INSERT INTO search_queries (query, query_hash, search_count, last_searched) VALUES (?, ?, 1, NOW())",
                [trimmedQuery, queryHash]
            );
        }
    } catch (error) {
        consoleLog('database', 'Error tracking search query', { error: error.message });
        // Don't throw error to avoid breaking search functionality
    }
}

const getTopSearches = async (limit = 10) => {
    try {
        // Ensure parameters are integers to avoid MySQL type issues
        const safeLimit = parseInt(limit) || 10;
        
        // Try to get cached top searches
        const cacheKey = `top-searches-${safeLimit}`;
        let topSearches = await CacheUtils.get('top-searches', cacheKey);
        
        if (!topSearches) {
            // Cache miss - fetch fresh data
            const data = await executeQuery(
                `SELECT query, search_count, last_searched 
                 FROM search_queries 
                 WHERE last_searched >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                 ORDER BY search_count DESC, last_searched DESC 
                 LIMIT ?`,
                [safeLimit]
            );
            
            topSearches = data || [];
            
            // Cache the result for 6 hours
            await CacheUtils.put('top-searches', cacheKey, topSearches);
        }
        
        return topSearches;
    } catch (error) {
        consoleLog('database', 'Error fetching top searches', { error: error.message });
        return [];
    }
}

const incrementPlayCount = async (gameId) => {
    const data = await executeQuery(
        "UPDATE games SET play_count = COALESCE(play_count, 0) + 1 WHERE id = ?", 
        [gameId]
    );
    return data;
}

const getRelatedGames = async (gameId, categoryId, tags, limit = 6) => {
    try {
        // First, try to get games from the same category
        let categoryGames = [];
        if (categoryId) {
            categoryGames = await executeQuery(
                `SELECT g.*, c.name as category_name 
                 FROM games g 
                 LEFT JOIN categories c ON g.category_id = c.id 
                 WHERE g.category_id = ? AND g.id != ? AND g.is_active = 1 
                 ORDER BY RAND() LIMIT ?`,
                [categoryId, gameId, limit]
            );
        }
        
        // If we have enough games from category, return them
        if (categoryGames.length >= limit) {
            return categoryGames.slice(0, limit);
        }
        
        // Otherwise, get games with matching tags
        let tagGames = [];
        if (tags && tags.trim()) {
            const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
            if (tagArray.length > 0) {
                // Create LIKE conditions for each tag
                const tagConditions = tagArray.map(() => "tags LIKE ?").join(" OR ");
                const tagParams = tagArray.map(tag => `%${tag}%`);
                
                tagGames = await executeQuery(
                    `SELECT g.*, c.name as category_name 
                     FROM games g 
                     LEFT JOIN categories c ON g.category_id = c.id 
                     WHERE (${tagConditions}) AND g.id != ? AND g.is_active = 1 
                     ORDER BY RAND() LIMIT ?`,
                    [...tagParams, gameId, limit - categoryGames.length]
                );
            }
        }
        
        // Combine category games and tag games, removing duplicates
        const combinedGames = [...categoryGames];
        const existingIds = new Set(categoryGames.map(game => game.id));
        
        for (const game of tagGames) {
            if (!existingIds.has(game.id) && combinedGames.length < limit) {
                combinedGames.push(game);
                existingIds.add(game.id);
            }
        }
        
        // If still not enough games, get popular games as fallback
        if (combinedGames.length < limit) {
            const fallbackGames = await executeQuery(
                `SELECT g.*, c.name as category_name 
                 FROM games g 
                 LEFT JOIN categories c ON g.category_id = c.id 
                 WHERE g.id != ? AND g.is_active = 1 
                 ORDER BY RAND() LIMIT ?`,
                [gameId, limit - combinedGames.length]
            );
            
            for (const game of fallbackGames) {
                if (!existingIds.has(game.id) && combinedGames.length < limit) {
                    combinedGames.push(game);
                    existingIds.add(game.id);
                }
            }
        }
        
        return combinedGames.slice(0, limit);
    } catch (error) {
        consoleLog('database', 'Error fetching related games', { error: error.message });
        return [];
    }
}

const getPopularTags = async (limit = 10) => {
    try {
        // Ensure parameters are integers to avoid MySQL type issues
        const safeLimit = parseInt(limit) || 10;
        
        // Try to get cached popular tags
        const cacheKey = `popular-tags-${safeLimit}`;
        let popularTags = await CacheUtils.get('popular-tags', cacheKey);
        
        if (!popularTags) {
            // Cache miss - fetch fresh data
            // Get top games based on combination of ratings and play count
            const data = await executeQuery(
                `SELECT g.tags, g.play_count, 
                        COALESCE(AVG(r.rating), 0) as avg_rating,
                        COUNT(r.rating) as rating_count
                 FROM games g 
                 LEFT JOIN game_ratings r ON g.id = r.game_id 
                 WHERE g.is_active = 1 AND g.tags IS NOT NULL AND g.tags != ''
                 GROUP BY g.id, g.tags, g.play_count
                 HAVING (rating_count > 0 AND avg_rating >= 3) OR g.play_count > 10
                 ORDER BY avg_rating DESC, g.play_count DESC
                 LIMIT 200`,
                []
            );
            
            // Process tags from the top games
            const tagCounts = {};
            
            data.forEach(game => {
                if (game.tags && game.tags.trim()) {
                    // Split tags by comma and clean them
                    const tags = game.tags.split(',')
                        .map(tag => tag.trim().toLowerCase())
                        .filter(tag => tag && tag.length > 1);
                    
                    tags.forEach(tag => {
                        if (!tagCounts[tag]) {
                            tagCounts[tag] = {
                                tag: tag,
                                count: 0,
                                weight: 0
                            };
                        }
                        
                        // Weight based on rating and play count
                        const weight = (game.avg_rating || 0) + (game.play_count || 0) * 0.1;
                        tagCounts[tag].count += 1;
                        tagCounts[tag].weight += weight;
                    });
                }
            });
            
            // Convert to array, sort by weight and count, then limit
            popularTags = Object.values(tagCounts)
                .sort((a, b) => {
                    // Primary sort by weight, secondary by count
                    if (b.weight !== a.weight) {
                        return b.weight - a.weight;
                    }
                    return b.count - a.count;
                })
                .slice(0, safeLimit)
                .map(item => ({
                    tag: item.tag,
                    count: item.count
                }));
            
            // Cache the result for 2 hours
            await CacheUtils.put('popular-tags', cacheKey, popularTags);
        }
        
        return popularTags;
    } catch (error) {
        consoleLog('database', 'Error fetching popular tags', { error: error.message });
        return [];
    }
}

// Helper function to parse and get optimized image URL
const getOptimizedImageUrl = (imageData, size = 'standard', supportsWebP = true) => {
    if (!imageData) {
        return '/assets/images/default-avatar.jpg';
    }
    
    // Handle old format (simple path)
    if (typeof imageData === 'string' && !imageData.startsWith('{')) {
        return imageData.startsWith('/') ? imageData : `/${imageData}`;
    }
    
    // Handle new format (JSON)
    try {
        const parsedData = typeof imageData === 'string' ? JSON.parse(imageData) : imageData;
        
        if (!parsedData.webp || !parsedData.original) {
            return '/assets/images/default-avatar.jpg';
        }
        
        const sizeData = supportsWebP ? parsedData.webp[size] : parsedData.original[size];
        
        if (!sizeData) {
            // Fallback to available size
            const availableSizes = Object.keys(supportsWebP ? parsedData.webp : parsedData.original);
            const fallbackSize = availableSizes.includes('standard') ? 'standard' : availableSizes[0];
            const fallbackData = supportsWebP ? parsedData.webp[fallbackSize] : parsedData.original[fallbackSize];
            return fallbackData ? `/${fallbackData.relativePath}` : '/assets/images/default-avatar.jpg';
        }
        
        return `/${sizeData.relativePath}`;
    } catch (error) {
        return '/assets/images/default-avatar.jpg';
    }
};

// Helper function to generate picture HTML for responsive images
const generateGamePictureHTML = (imageData, alt = '', className = '', size = 'standard') => {
    if (!imageData) {
        return `<img src="/assets/images/default-avatar.jpg" alt="${alt}" class="${className}" loading="lazy" />`;
    }
    
    // Handle old format (simple path)
    if (typeof imageData === 'string' && !imageData.startsWith('{')) {
        const src = imageData.startsWith('/') ? imageData : `/${imageData}`;
        return `<img src="${src}" alt="${alt}" class="${className}" loading="lazy" />`;
    }
    
    // Handle new format (JSON with WebP support)
    try {
        const parsedData = typeof imageData === 'string' ? JSON.parse(imageData) : imageData;
        
        if (!parsedData.webp || !parsedData.original) {
            return `<img src="/assets/images/default-avatar.jpg" alt="${alt}" class="${className}" loading="lazy" />`;
        }
        
        const webpImage = parsedData.webp[size];
        const originalImage = parsedData.original[size];
        
        if (!webpImage || !originalImage) {
            return `<img src="/assets/images/default-avatar.jpg" alt="${alt}" class="${className}" loading="lazy" />`;
        }
        
        return `<picture class="${className}">
            <source srcset="/${webpImage.relativePath}" type="image/webp">
            <img src="/${originalImage.relativePath}" alt="${alt}" loading="lazy">
        </picture>`;
    } catch (error) {
        return `<img src="/assets/images/default-avatar.jpg" alt="${alt}" class="${className}" loading="lazy" />`;
    }
};

const getRandomGames = async (limit = 20, categoryId = null) => {
    const safeLimit = parseInt(limit) || 20;
    
    let query, params;
    
    if (categoryId) {
        query = `
            SELECT g.*, c.name as category_name 
            FROM games g 
            LEFT JOIN categories c ON g.category_id = c.id 
            WHERE g.is_active = 1 AND g.category_id = ? 
            ORDER BY RAND() 
            LIMIT ?
        `;
        params = [categoryId, safeLimit];
    } else {
        query = `
            SELECT g.*, c.name as category_name 
            FROM games g 
            LEFT JOIN categories c ON g.category_id = c.id 
            WHERE g.is_active = 1 
            ORDER BY RAND() 
            LIMIT ?
        `;
        params = [safeLimit];
    }
    
    const data = await executeQuery(query, params);
    return data;
}

const getGameByImportId = async (importId) => {
    const data = await executeQuery("SELECT id, slug, title FROM games WHERE import_id = ? LIMIT 1", [parseInt(importId)]);
    return data.length > 0 ? data[0] : null;
}

export {
    getGameById,
    getGameBySlug,
    getGamesByCategory,
    getGamesByTag,
    getTopRatedGames,
    getPopularGames,
    getTrendingGames,
    getFeaturedGames,
    getRecentGames,
    getFavoriteGames,
    getAllGames,
    searchGames,
    getSearchCount,
    getTotalGameCount,
    trackSearchQuery,
    getTopSearches,
    incrementPlayCount,
    getRelatedGames,
    getRandomGames,
    getPopularTags,
    getOptimizedImageUrl,
    generateGamePictureHTML,
    getGameByImportId
}