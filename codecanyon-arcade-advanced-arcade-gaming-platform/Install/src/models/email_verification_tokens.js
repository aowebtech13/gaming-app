import executeQuery from '../utils/mysql.js';
import { consoleLog } from '../utils/logger.js';
import { getSetting } from './settings.js';
import crypto from 'crypto';

/**
 * Create a new email verification token
 * @param {number} userId - User ID
 * @param {string} ipAddress - Client IP address
 * @param {string} userAgent - Client user agent
 * @returns {Object} Token data
 */
export const createEmailVerificationToken = async (userId, ipAddress = null, userAgent = null) => {
    try {
        // Generate a secure random token
        const token = crypto.randomBytes(32).toString('hex');
        
        // Set expiration based on configurable setting (default 24 hours)
        const expiryHours = await getSetting('email_verification_token_expiry_hours', '24');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + parseInt(expiryHours));
        
        const query = `
            INSERT INTO email_verification_tokens (user_id, token, expires_at, ip_address, user_agent)
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
            consoleLog('info', 'Email verification token created', { userId, tokenId: result.insertId });
            return {
                id: result.insertId,
                token: token,
                expiresAt: expiresAt,
                success: true
            };
        }
        
        return { success: false, error: 'Failed to create token' };
    } catch (error) {
        consoleLog('error', 'Error creating email verification token', { error: error.message, userId });
        return { success: false, error: error.message };
    }
};

/**
 * Get email verification token by token string
 * @param {string} token - Verification token
 * @returns {Object|null} Token data or null
 */
export const getEmailVerificationToken = async (token) => {
    try {
        const query = `
            SELECT evt.*, u.email, u.username, u.first_name, u.last_name
            FROM email_verification_tokens evt
            JOIN users u ON evt.user_id = u.id
            WHERE evt.token = ? AND evt.expires_at > NOW() AND evt.used_at IS NULL
            ORDER BY evt.created_at DESC
            LIMIT 1
        `;
        
        const result = await executeQuery(query, [token]);
        return result.length > 0 ? result[0] : null;
    } catch (error) {
        consoleLog('error', 'Error getting email verification token', { error: error.message, token });
        return null;
    }
};

/**
 * Mark email verification token as used
 * @param {string} token - Verification token
 * @returns {boolean} Success status
 */
export const markTokenAsUsed = async (token) => {
    try {
        const query = `
            UPDATE email_verification_tokens 
            SET used_at = NOW()
            WHERE token = ? AND used_at IS NULL
        `;
        
        const result = await executeQuery(query, [token]);
        return result.affectedRows > 0;
    } catch (error) {
        consoleLog('error', 'Error marking email verification token as used', { error: error.message, token });
        return false;
    }
};

/**
 * Delete expired email verification tokens
 * @returns {number} Number of tokens deleted
 */
export const deleteExpiredTokens = async () => {
    try {
        const query = `
            DELETE FROM email_verification_tokens 
            WHERE expires_at < NOW() OR used_at IS NOT NULL
        `;
        
        const result = await executeQuery(query, []);
        
        if (result.affectedRows > 0) {
            consoleLog('info', `Cleaned up ${result.affectedRows} expired email verification tokens`);
        }
        
        return result.affectedRows;
    } catch (error) {
        consoleLog('error', 'Error deleting expired email verification tokens', { error: error.message });
        return 0;
    }
};

/**
 * Get recent email verification attempts for a user
 * @param {number} userId - User ID
 * @param {number} hours - Hours to look back (default 24)
 * @returns {Array} Recent attempts
 */
export const getRecentVerificationAttempts = async (userId, hours = 24) => {
    try {
        const query = `
            SELECT COUNT(*) as attempt_count, MAX(created_at) as last_attempt
            FROM email_verification_tokens 
            WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
        `;
        
        const result = await executeQuery(query, [userId, hours]);
        return result[0] || { attempt_count: 0, last_attempt: null };
    } catch (error) {
        consoleLog('error', 'Error getting recent verification attempts', { error: error.message, userId });
        return { attempt_count: 0, last_attempt: null };
    }
};

/**
 * Check if user has exceeded verification attempts limit
 * @param {number} userId - User ID
 * @param {number} maxAttempts - Maximum attempts allowed (default 5)
 * @param {number} timeWindow - Time window in hours (default 24)
 * @returns {boolean} Whether limit is exceeded
 */
export const hasExceededVerificationLimit = async (userId, maxAttempts = 5, timeWindow = 24) => {
    try {
        const attempts = await getRecentVerificationAttempts(userId, timeWindow);
        return attempts.attempt_count >= maxAttempts;
    } catch (error) {
        consoleLog('error', 'Error checking verification limit', { error: error.message, userId });
        return false; // Allow verification on error to prevent lockout
    }
};

export default {
    createEmailVerificationToken,
    getEmailVerificationToken,
    markTokenAsUsed,
    deleteExpiredTokens,
    getRecentVerificationAttempts,
    hasExceededVerificationLimit
};