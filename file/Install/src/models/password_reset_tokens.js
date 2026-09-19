import executeQuery from '../utils/mysql.js';
import { consoleLog } from '../utils/logger.js';
import crypto from 'crypto';

/**
 * Create a new password reset token
 * @param {number} userId - User ID
 * @param {string} ipAddress - Client IP address
 * @param {string} userAgent - Client user agent
 * @returns {Object} Token data
 */
export const createPasswordResetToken = async (userId, ipAddress = null, userAgent = null) => {
    try {
        // Generate a secure random token
        const token = crypto.randomBytes(32).toString('hex');
        
        // Set expiration to 1 hour from now
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);
        
        const query = `
            INSERT INTO password_reset_tokens (user_id, token, expires_at, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const result = await executeQuery(query, [
            userId,
            token,
            expiresAt,
            ipAddress,
            userAgent
        ]);
        
        if (result.insertId) {
            consoleLog('info', 'Password reset token created', { userId, tokenId: result.insertId });
            return {
                id: result.insertId,
                token: token,
                expiresAt: expiresAt,
                success: true
            };
        }
        
        return { success: false, error: 'Failed to create token' };
    } catch (error) {
        consoleLog('error', 'Error creating password reset token', { error: error.message, userId });
        return { success: false, error: error.message };
    }
};

/**
 * Get password reset token by token string
 * @param {string} token - Reset token
 * @returns {Object|null} Token data or null
 */
export const getPasswordResetToken = async (token) => {
    try {
        const query = `
            SELECT prt.*, u.email, u.username, u.first_name, u.last_name
            FROM password_reset_tokens prt
            JOIN users u ON prt.user_id = u.id
            WHERE prt.token = ? AND prt.expires_at > NOW() AND prt.used_at IS NULL
            ORDER BY prt.created_at DESC
            LIMIT 1
        `;
        
        const result = await executeQuery(query, [token]);
        return result.length > 0 ? result[0] : null;
    } catch (error) {
        consoleLog('error', 'Error getting password reset token', { error: error.message, token });
        return null;
    }
};

/**
 * Mark password reset token as used
 * @param {string} token - Reset token
 * @returns {boolean} Success status
 */
export const markTokenAsUsed = async (token) => {
    try {
        const query = `
            UPDATE password_reset_tokens 
            SET used_at = NOW()
            WHERE token = ? AND used_at IS NULL
        `;
        
        const result = await executeQuery(query, [token]);
        return result.affectedRows > 0;
    } catch (error) {
        consoleLog('error', 'Error marking token as used', { error: error.message, token });
        return false;
    }
};

/**
 * Delete expired password reset tokens
 * @returns {number} Number of tokens deleted
 */
export const deleteExpiredTokens = async () => {
    try {
        const query = `
            DELETE FROM password_reset_tokens 
            WHERE expires_at < NOW() OR used_at IS NOT NULL
        `;
        
        const result = await executeQuery(query, []);
        
        if (result.affectedRows > 0) {
            consoleLog('info', `Cleaned up ${result.affectedRows} expired password reset tokens`);
        }
        
        return result.affectedRows;
    } catch (error) {
        consoleLog('error', 'Error deleting expired tokens', { error: error.message });
        return 0;
    }
};

/**
 * Get recent password reset attempts for a user
 * @param {number} userId - User ID
 * @param {number} hours - Hours to look back (default 24)
 * @returns {Array} Recent attempts
 */
export const getRecentResetAttempts = async (userId, hours = 24) => {
    try {
        const query = `
            SELECT COUNT(*) as attempt_count, MAX(created_at) as last_attempt
            FROM password_reset_tokens 
            WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
        `;
        
        const result = await executeQuery(query, [userId, hours]);
        return result[0] || { attempt_count: 0, last_attempt: null };
    } catch (error) {
        consoleLog('error', 'Error getting recent reset attempts', { error: error.message, userId });
        return { attempt_count: 0, last_attempt: null };
    }
};

/**
 * Check if user has exceeded reset attempts limit
 * @param {number} userId - User ID
 * @param {number} maxAttempts - Maximum attempts allowed (default 5)
 * @param {number} timeWindow - Time window in hours (default 24)
 * @returns {boolean} Whether limit is exceeded
 */
export const hasExceededResetLimit = async (userId, maxAttempts = 5, timeWindow = 24) => {
    try {
        const attempts = await getRecentResetAttempts(userId, timeWindow);
        return attempts.attempt_count >= maxAttempts;
    } catch (error) {
        consoleLog('error', 'Error checking reset limit', { error: error.message, userId });
        return false; // Allow reset on error to prevent lockout
    }
};

export default {
    createPasswordResetToken,
    getPasswordResetToken,
    markTokenAsUsed,
    deleteExpiredTokens,
    getRecentResetAttempts,
    hasExceededResetLimit
};