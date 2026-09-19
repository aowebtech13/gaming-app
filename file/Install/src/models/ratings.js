import executeQuery from "../utils/mysql.js";
import CacheUtils from '../utils/cache.js';
import { isIP } from 'net';

// Initialize rating cache - 5 minutes
CacheUtils.initCache('game-ratings', 5 * 60 * 1000);

// Utility function to extract real IP address from request
const extractIPAddress = (req) => {
    // Check X-Real-IP header first (most reliable for single proxy)
    if (req.headers['x-real-ip']) {
        return req.headers['x-real-ip'].trim();
    }
    
    // Check X-Forwarded-For header (may contain multiple IPs)
    if (req.headers['x-forwarded-for']) {
        const ips = req.headers['x-forwarded-for'].split(',');
        return ips[0].trim(); // Use first (client) IP
    }
    
    // Fallback to request IP
    return req.ip || req.connection.remoteAddress || '127.0.0.1';
};

// Utility function to validate IP address format using Node.js built-in
const validateIPAddress = (ip) => {
    if (!ip || typeof ip !== 'string') return false;
    
    // isIP returns 4 for IPv4, 6 for IPv6, 0 for invalid
    // This handles IPv4-mapped IPv6 addresses like ::ffff:192.168.2.20
    return isIP(ip) !== 0;
};

const getRating = async (gameId, userId) => {
    const data = await executeQuery(`
        SELECT rating 
        FROM game_ratings 
        WHERE game_id = ? AND user_id = ?
    `, [gameId, userId]);
    return data[0]?.rating || null;
};

const setRating = async (gameId, userId, rating) => {
    const data = await executeQuery(`
        INSERT INTO game_ratings (game_id, user_id, rating) 
        VALUES (?, ?, ?) 
        ON DUPLICATE KEY UPDATE rating = ?, updated_at = CURRENT_TIMESTAMP
    `, [gameId, userId, rating, rating]);
    
    // Clear cache for this game's rating stats
    await CacheUtils.del('game-ratings', `stats-${gameId}`);
    
    return data;
};

// Guest rating functions for IP-based tracking using game_ratings table
const getRatingByIP = async (gameId, ipAddress) => {
    if (!validateIPAddress(ipAddress)) {
        return null;
    }
    
    const data = await executeQuery(`
        SELECT rating 
        FROM game_ratings 
        WHERE game_id = ? AND user_id = 0 AND ip_address = ?
    `, [gameId, ipAddress]);
    return data[0]?.rating || null;
};

const setRatingByIP = async (gameId, ipAddress, rating) => {
    if (!validateIPAddress(ipAddress)) {
        throw new Error('Invalid IP address format');
    }
    
    const data = await executeQuery(`
        INSERT INTO game_ratings (game_id, user_id, rating, ip_address) 
        VALUES (?, 0, ?, ?) 
        ON DUPLICATE KEY UPDATE rating = ?, updated_at = CURRENT_TIMESTAMP
    `, [gameId, rating, ipAddress, rating]);
    
    // Clear cache for this game's rating stats
    await CacheUtils.del('game-ratings', `stats-${gameId}`);
    
    return data;
};

const getGameRatingStats = async (gameId) => {
    // Try to get from cache first
    let stats = await CacheUtils.get('game-ratings', `stats-${gameId}`);
    
    if (!stats) {
        // Cache miss - calculate from database including both user and guest ratings
        const [userRatings] = await executeQuery(`
            SELECT AVG(rating) as avg_rating, COUNT(*) as total_ratings 
            FROM game_ratings 
            WHERE game_id = ? AND user_id > 0
        `, [gameId]);
        
        const [guestRatings] = await executeQuery(`
            SELECT AVG(rating) as avg_rating, COUNT(*) as total_ratings 
            FROM game_ratings 
            WHERE game_id = ? AND user_id = 0
        `, [gameId]);
        
        const userAvg = userRatings?.avg_rating || 0;
        const userCount = userRatings?.total_ratings || 0;
        const guestAvg = guestRatings?.avg_rating || 0;
        const guestCount = guestRatings?.total_ratings || 0;
        
        // Calculate combined average
        const totalCount = userCount + guestCount;
        let combinedAvg = 0;
        
        if (totalCount > 0) {
            combinedAvg = ((userAvg * userCount) + (guestAvg * guestCount)) / totalCount;
        }
        
        stats = {
            rating: parseFloat(combinedAvg).toFixed(2),
            total_ratings: totalCount,
            user_ratings: userCount,
            guest_ratings: guestCount
        };
        
        // Cache the result
        await CacheUtils.put('game-ratings', `stats-${gameId}`, stats);
    }
    
    return stats;
};

// Check if a user or IP has already rated a game
const hasUserRated = async (gameId, userId, ipAddress = null) => {
    if (userId && userId > 0) {
        // Check authenticated user rating
        const rating = await getRating(gameId, userId);
        return rating !== null;
    } else if (ipAddress) {
        // Check guest IP rating
        const rating = await getRatingByIP(gameId, ipAddress);
        return rating !== null;
    }
    return false;
};

export {
    getRating,
    setRating,
    getGameRatingStats,
    getRatingByIP,
    setRatingByIP,
    extractIPAddress,
    validateIPAddress,
    hasUserRated
};