import executeQuery from "../utils/mysql.js";
import { consoleLog } from "../utils/logger.js";

/**
 * Follow a user
 * @param {number} followerId - ID of the user who is following
 * @param {number} followingId - ID of the user being followed
 * @returns {Promise} - Result of the follow operation
 */
export async function followUser(followerId, followingId) {
    try {
        const result = await executeQuery(
            "INSERT INTO follows (follower_id, following_id) VALUES (?, ?)",
            [followerId, followingId]
        );
        return result;
    } catch (error) {
        consoleLog('database', 'Follow user error', { error: error.message });
        throw error;
    }
}

/**
 * Unfollow a user
 * @param {number} followerId - ID of the user who is unfollowing
 * @param {number} followingId - ID of the user being unfollowed
 * @returns {Promise} - Result of the unfollow operation
 */
export async function unfollowUser(followerId, followingId) {
    try {
        const result = await executeQuery(
            "DELETE FROM follows WHERE follower_id = ? AND following_id = ?",
            [followerId, followingId]
        );
        return result;
    } catch (error) {
        consoleLog('database', 'Unfollow user error', { error: error.message });
        throw error;
    }
}

/**
 * Check if user is following another user
 * @param {number} followerId - ID of the user who might be following
 * @param {number} followingId - ID of the user being checked
 * @returns {Promise<boolean>} - True if following, false otherwise
 */
export async function isFollowing(followerId, followingId) {
    try {
        const result = await executeQuery(
            "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
            [followerId, followingId]
        );
        return result.length > 0;
    } catch (error) {
        consoleLog('database', 'Check following status error', { error: error.message });
        return false;
    }
}

/**
 * Get users that a specific user is following
 * @param {number} userId - ID of the user
 * @returns {Promise<Array>} - Array of users being followed
 */
export async function getFollowing(userId) {
    try {
        const result = await executeQuery(`
            SELECT u.*, f.created_at as followed_at
            FROM follows f 
            JOIN users u ON f.following_id = u.id 
            WHERE f.follower_id = ? AND u.is_active = 1
            ORDER BY f.created_at DESC
        `, [userId]);
        return result;
    } catch (error) {
        consoleLog('database', 'Get following error', { error: error.message });
        return [];
    }
}

/**
 * Get users that are following a specific user (followers)
 * @param {number} userId - ID of the user
 * @returns {Promise<Array>} - Array of followers
 */
export async function getFollowers(userId) {
    try {
        const result = await executeQuery(`
            SELECT u.*, f.created_at as followed_at
            FROM follows f 
            JOIN users u ON f.follower_id = u.id 
            WHERE f.following_id = ? AND u.is_active = 1
            ORDER BY f.created_at DESC
        `, [userId]);
        return result;
    } catch (error) {
        consoleLog('database', 'Get followers error', { error: error.message });
        return [];
    }
}

/**
 * Get follow counts for a user
 * @param {number} userId - ID of the user
 * @returns {Promise<Object>} - Object with following and followers counts
 */
export async function getFollowCounts(userId) {
    try {
        const [followingResult, followersResult] = await Promise.all([
            executeQuery("SELECT COUNT(*) as count FROM follows WHERE follower_id = ?", [userId]),
            executeQuery("SELECT COUNT(*) as count FROM follows WHERE following_id = ?", [userId])
        ]);
        
        return {
            following: followingResult[0]?.count || 0,
            followers: followersResult[0]?.count || 0
        };
    } catch (error) {
        consoleLog('database', 'Get follow counts error', { error: error.message });
        return {
            following: 0,
            followers: 0
        };
    }
}

/**
 * Get mutual follows (users who follow each other)
 * @param {number} userId - ID of the user
 * @returns {Promise<Array>} - Array of users with mutual follow relationship
 */
export async function getMutualFollows(userId) {
    try {
        const result = await executeQuery(`
            SELECT u.*, f1.created_at as followed_at
            FROM follows f1 
            JOIN follows f2 ON f1.following_id = f2.follower_id AND f1.follower_id = f2.following_id
            JOIN users u ON f1.following_id = u.id 
            WHERE f1.follower_id = ? AND u.is_active = 1
            ORDER BY f1.created_at DESC
        `, [userId]);
        return result;
    } catch (error) {
        consoleLog('database', 'Get mutual follows error', { error: error.message });
        return [];
    }
}

/**
 * Get suggested users to follow (users not currently followed)
 * @param {number} userId - ID of the user
 * @param {number} limit - Maximum number of suggestions to return
 * @returns {Promise<Array>} - Array of suggested users
 */
export async function getSuggestedFollows(userId, limit = 10) {
    try {
        const result = await executeQuery(`
            SELECT u.*, 
                   (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count
            FROM users u 
            WHERE u.id != ? 
              AND u.is_active = 1
              AND u.id NOT IN (
                  SELECT following_id FROM follows WHERE follower_id = ?
              )
            ORDER BY followers_count DESC, u.created_at DESC 
            LIMIT ?
        `, [userId, userId, limit]);
        return result;
    } catch (error) {
        consoleLog('database', 'Get suggested follows error', { error: error.message });
        return [];
    }
}

/**
 * Get follow relationship by ID
 * @param {number} id - ID of the follow relationship
 * @returns {Promise<Array>} - Follow relationship data
 */
export async function getFollowById(id) {
    try {
        const result = await executeQuery("SELECT * FROM follows WHERE id = ?", [id]);
        return result;
    } catch (error) {
        consoleLog('database', 'Get follow by ID error', { error: error.message });
        return [];
    }
}

/**
 * Remove all follows for a user (for account deletion)
 * @param {number} userId - ID of the user
 * @returns {Promise} - Result of the removal operation
 */
export async function removeAllFollows(userId) {
    try {
        const result = await executeQuery(
            "DELETE FROM follows WHERE follower_id = ? OR following_id = ?",
            [userId, userId]
        );
        return result;
    } catch (error) {
        consoleLog('database', 'Remove all follows error', { error: error.message });
        throw error;
    }
}