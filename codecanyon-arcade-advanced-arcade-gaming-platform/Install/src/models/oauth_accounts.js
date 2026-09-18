import executeQuery from '../utils/mysql.js';
import { consoleLog } from '../utils/logger.js';

/**
 * Create or update OAuth account
 * @param {Object} accountData - OAuth account data
 * @returns {Object} Result
 */
export const createOrUpdateOAuthAccount = async (accountData) => {
    try {
        const {
            userId,
            provider,
            providerId,
            providerEmail,
            providerName,
            providerAvatar,
            accessToken,
            refreshToken,
            expiresAt
        } = accountData;

        // Check if account already exists
        const existingAccount = await getOAuthAccount(provider, providerId);
        
        if (existingAccount) {
            // Update existing account
            const query = `
                UPDATE oauth_accounts 
                SET provider_email = ?, provider_name = ?, provider_avatar = ?, 
                    access_token = ?, refresh_token = ?, expires_at = ?, updated_at = NOW()
                WHERE provider = ? AND provider_id = ?
            `;
            
            await executeQuery(query, [
                providerEmail,
                providerName,
                providerAvatar,
                accessToken,
                refreshToken,
                expiresAt,
                provider,
                providerId
            ]);
            
            consoleLog('info', 'OAuth account updated', { provider, providerId });
            return { success: true, updated: true, accountId: existingAccount.id };
        } else {
            // Create new account
            const query = `
                INSERT INTO oauth_accounts 
                (user_id, provider, provider_id, provider_email, provider_name, provider_avatar, access_token, refresh_token, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const result = await executeQuery(query, [
                userId,
                provider,
                providerId,
                providerEmail,
                providerName,
                providerAvatar,
                accessToken,
                refreshToken,
                expiresAt
            ]);
            
            consoleLog('info', 'OAuth account created', { provider, providerId, userId });
            return { success: true, created: true, accountId: result.insertId };
        }
    } catch (error) {
        consoleLog('error', 'Error creating/updating OAuth account', { error: error.message });
        return { success: false, error: error.message };
    }
};

/**
 * Get OAuth account by provider and provider ID
 * @param {string} provider - OAuth provider (facebook, google)
 * @param {string} providerId - Provider user ID
 * @returns {Object|null} OAuth account or null
 */
export const getOAuthAccount = async (provider, providerId) => {
    try {
        const query = `
            SELECT oa.*, u.username, u.email, u.is_active 
            FROM oauth_accounts oa
            JOIN users u ON oa.user_id = u.id
            WHERE oa.provider = ? AND oa.provider_id = ?
        `;
        
        const result = await executeQuery(query, [provider, providerId]);
        return result.length > 0 ? result[0] : null;
    } catch (error) {
        consoleLog('error', 'Error getting OAuth account', { error: error.message, provider, providerId });
        return null;
    }
};

/**
 * Get OAuth accounts for a user
 * @param {number} userId - User ID
 * @returns {Array} OAuth accounts
 */
export const getUserOAuthAccounts = async (userId) => {
    try {
        const query = `
            SELECT provider, provider_id, provider_email, provider_name, provider_avatar, created_at
            FROM oauth_accounts 
            WHERE user_id = ?
            ORDER BY created_at DESC
        `;
        
        const result = await executeQuery(query, [userId]);
        return result || [];
    } catch (error) {
        consoleLog('error', 'Error getting user OAuth accounts', { error: error.message, userId });
        return [];
    }
};

/**
 * Link OAuth account to existing user
 * @param {number} userId - User ID
 * @param {string} provider - OAuth provider
 * @param {string} providerId - Provider user ID
 * @returns {boolean} Success status
 */
export const linkOAuthAccount = async (userId, provider, providerId) => {
    try {
        const query = `
            UPDATE oauth_accounts 
            SET user_id = ?, updated_at = NOW()
            WHERE provider = ? AND provider_id = ?
        `;
        
        const result = await executeQuery(query, [userId, provider, providerId]);
        
        if (result.affectedRows > 0) {
            consoleLog('info', 'OAuth account linked to user', { userId, provider, providerId });
            return true;
        }
        
        return false;
    } catch (error) {
        consoleLog('error', 'Error linking OAuth account', { error: error.message, userId, provider, providerId });
        return false;
    }
};

/**
 * Unlink OAuth account from user
 * @param {number} userId - User ID
 * @param {string} provider - OAuth provider
 * @returns {boolean} Success status
 */
export const unlinkOAuthAccount = async (userId, provider) => {
    try {
        const query = `
            DELETE FROM oauth_accounts 
            WHERE user_id = ? AND provider = ?
        `;
        
        const result = await executeQuery(query, [userId, provider]);
        
        if (result.affectedRows > 0) {
            consoleLog('info', 'OAuth account unlinked', { userId, provider });
            return true;
        }
        
        return false;
    } catch (error) {
        consoleLog('error', 'Error unlinking OAuth account', { error: error.message, userId, provider });
        return false;
    }
};

/**
 * Check if email is already used by OAuth account
 * @param {string} email - Email to check
 * @param {string} excludeProvider - Provider to exclude from check
 * @param {string} excludeProviderId - Provider ID to exclude from check
 * @returns {Object|null} Existing account or null
 */
export const findOAuthAccountByEmail = async (email, excludeProvider = null, excludeProviderId = null) => {
    try {
        let query = `
            SELECT oa.*, u.username, u.email as user_email, u.is_active 
            FROM oauth_accounts oa
            JOIN users u ON oa.user_id = u.id
            WHERE oa.provider_email = ?
        `;
        let params = [email];
        
        if (excludeProvider && excludeProviderId) {
            query += ` AND NOT (oa.provider = ? AND oa.provider_id = ?)`;
            params.push(excludeProvider, excludeProviderId);
        }
        
        const result = await executeQuery(query, params);
        return result.length > 0 ? result[0] : null;
    } catch (error) {
        consoleLog('error', 'Error finding OAuth account by email', { error: error.message, email });
        return null;
    }
};

/**
 * Update OAuth account tokens
 * @param {string} provider - OAuth provider
 * @param {string} providerId - Provider user ID
 * @param {string} accessToken - New access token
 * @param {string} refreshToken - New refresh token (optional)
 * @param {Date} expiresAt - Token expiration (optional)
 * @returns {boolean} Success status
 */
export const updateOAuthTokens = async (provider, providerId, accessToken, refreshToken = null, expiresAt = null) => {
    try {
        const query = `
            UPDATE oauth_accounts 
            SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = NOW()
            WHERE provider = ? AND provider_id = ?
        `;
        
        const result = await executeQuery(query, [
            accessToken,
            refreshToken,
            expiresAt,
            provider,
            providerId
        ]);
        
        return result.affectedRows > 0;
    } catch (error) {
        consoleLog('error', 'Error updating OAuth tokens', { error: error.message, provider, providerId });
        return false;
    }
};

export default {
    createOrUpdateOAuthAccount,
    getOAuthAccount,
    getUserOAuthAccounts,
    linkOAuthAccount,
    unlinkOAuthAccount,
    findOAuthAccountByEmail,
    updateOAuthTokens
};