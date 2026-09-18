import passport from 'passport';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { getSetting } from '../models/settings.js';
import { getUserById, createUser } from '../models/users.js';
import { createOrUpdateOAuthAccount, getOAuthAccount, findOAuthAccountByEmail } from '../models/oauth_accounts.js';
import { consoleLog } from './logger.js';
import bcrypt from 'bcrypt';
import i18n from './i18n.js';

/**
 * Validate OAuth provider configuration
 * @param {string} provider - OAuth provider name
 * @param {Object} config - Provider configuration
 * @returns {Object} Validation result
 */
const validateOAuthConfig = (provider, config) => {
    const errors = [];
    
    if (!config.clientId || config.clientId.trim() === '') {
        errors.push(`${provider} client ID is required`);
    }
    
    if (!config.clientSecret || config.clientSecret.trim() === '') {
        errors.push(`${provider} client secret is required`);
    }
    
    if (!config.callbackURL || config.callbackURL.trim() === '') {
        errors.push(`${provider} callback URL is required`);
    } else {
        // Validate callback URL format
        try {
            const url = new URL(config.callbackURL);
            if (!['http:', 'https:'].includes(url.protocol)) {
                errors.push(`${provider} callback URL must use HTTP or HTTPS protocol`);
            }
        } catch (error) {
            errors.push(`${provider} callback URL format is invalid`);
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Get current site domain for callback URL validation
 * @returns {string} Site domain
 */
const getSiteDomain = async () => {
    try {
        const siteUrl = await getSetting('site_url', '');
        if (siteUrl) {
            const url = new URL(siteUrl);
            return url.origin;
        }
        return '';
    } catch (error) {
        consoleLog('warn', 'Could not determine site domain', { error: error.message });
        return '';
    }
};

/**
 * Validate callback URL against site domain
 * @param {string} callbackURL - Callback URL to validate
 * @param {string} siteDomain - Expected site domain
 * @returns {boolean} Whether callback URL is valid
 */
const validateCallbackURL = (callbackURL, siteDomain) => {
    if (!siteDomain) return true; // Skip validation if site domain not configured
    
    try {
        const callbackUrl = new URL(callbackURL);
        const siteUrl = new URL(siteDomain);
        return callbackUrl.origin === siteUrl.origin;
    } catch (error) {
        return false;
    }
};

/**
 * Initialize Passport.js with OAuth strategies
 */
export const initializePassport = async () => {
    try {
        // Serialize user for session
        passport.serializeUser((user, done) => {
            done(null, user.id);
        });

        // Deserialize user from session
        passport.deserializeUser(async (id, done) => {
            try {
                const users = await getUserById(id);
                const user = users && users.length > 0 ? users[0] : null;
                done(null, user);
            } catch (error) {
                consoleLog('error', 'User deserialization error', { error: error.message, userId: id });
                done(error, null);
            }
        });

        // Initialize strategies with error handling
        try {
            await initializeFacebookStrategy();
        } catch (error) {
            consoleLog('error', 'Facebook strategy initialization failed', { error: error.message });
        }

        try {
            await initializeGoogleStrategy();
        } catch (error) {
            consoleLog('error', 'Google strategy initialization failed', { error: error.message });
        }

        consoleLog('info', 'Passport.js initialized successfully');
        return true;
    } catch (error) {
        consoleLog('error', 'Failed to initialize Passport.js', { error: error.message, stack: error.stack });
        return false;
    }
};

/**
 * Initialize Facebook OAuth strategy
 */
const initializeFacebookStrategy = async () => {
    try {
        const [enabled, clientId, clientSecret, siteDomain] = await Promise.all([
            getSetting('enable_facebook_login', '0'),
            getSetting('facebook_app_id', ''),
            getSetting('facebook_app_secret', ''),
            getSiteDomain()
        ]);

        if (enabled !== '1') {
            consoleLog('info', 'Facebook OAuth disabled in settings');
            return;
        }

        const callbackURL = "/auth/facebook/callback";
        const config = {
            clientId,
            clientSecret,
            callbackURL
        };

        // Validate OAuth configuration
        const validation = validateOAuthConfig('Facebook', config);
        if (!validation.isValid) {
            consoleLog('error', 'Facebook OAuth configuration invalid', { 
                errors: validation.errors 
            });
            return;
        }

        // Validate callback URL against site domain
        if (siteDomain && !validateCallbackURL(callbackURL, siteDomain)) {
            consoleLog('warn', 'Facebook callback URL may not match site domain', { 
                callbackURL,
                siteDomain 
            });
        }

        passport.use('facebook', new FacebookStrategy({
            clientID: clientId,
            clientSecret: clientSecret,
            callbackURL: callbackURL,
            profileFields: ['id', 'displayName', 'name', 'emails', 'photos']
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                const result = await handleOAuthProfile('facebook', profile, accessToken, refreshToken);
                done(null, result);
            } catch (error) {
                consoleLog('error', 'Facebook OAuth error', { error: error.message, profile: profile?.id });
                done(error, null);
            }
        }));

        consoleLog('info', 'Facebook OAuth strategy initialized successfully', { 
            callbackURL,
            hasValidConfig: true 
        });
    } catch (error) {
        consoleLog('error', 'Failed to initialize Facebook strategy', { error: error.message });
    }
};

/**
 * Initialize Google OAuth strategy
 */
const initializeGoogleStrategy = async () => {
    try {
        const [enabled, clientId, clientSecret, siteDomain] = await Promise.all([
            getSetting('enable_google_login', '0'),
            getSetting('google_client_id', ''),
            getSetting('google_client_secret', ''),
            getSiteDomain()
        ]);

        if (enabled !== '1') {
            consoleLog('info', 'Google OAuth disabled in settings');
            return;
        }

        const callbackURL = "/auth/google/callback";
        const config = {
            clientId,
            clientSecret,
            callbackURL
        };

        // Validate OAuth configuration
        const validation = validateOAuthConfig('Google', config);
        if (!validation.isValid) {
            consoleLog('error', 'Google OAuth configuration invalid', { 
                errors: validation.errors 
            });
            return;
        }

        // Validate callback URL against site domain
        if (siteDomain && !validateCallbackURL(callbackURL, siteDomain)) {
            consoleLog('warn', 'Google callback URL may not match site domain', { 
                callbackURL,
                siteDomain 
            });
        }

        passport.use('google', new GoogleStrategy({
            clientID: clientId,
            clientSecret: clientSecret,
            callbackURL: callbackURL,
            scope: ['profile', 'email']
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                const result = await handleOAuthProfile('google', profile, accessToken, refreshToken);
                done(null, result);
            } catch (error) {
                consoleLog('error', 'Google OAuth error', { error: error.message, profile: profile?.id });
                done(error, null);
            }
        }));

        consoleLog('info', 'Google OAuth strategy initialized successfully', { 
            callbackURL,
            hasValidConfig: true 
        });
    } catch (error) {
        consoleLog('error', 'Failed to initialize Google strategy', { error: error.message });
    }
};

/**
 * Handle OAuth profile data and create/link user account
 * @param {string} provider - OAuth provider (facebook, google)
 * @param {Object} profile - OAuth profile data
 * @param {string} accessToken - OAuth access token
 * @param {string} refreshToken - OAuth refresh token
 * @returns {Object} User data or error
 */
const handleOAuthProfile = async (provider, profile, accessToken, refreshToken) => {
    try {
        const providerId = profile.id;
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
        const firstName = profile.name ? profile.name.givenName : '';
        const lastName = profile.name ? profile.name.familyName : '';
        const displayName = profile.displayName || `${firstName} ${lastName}`.trim();
        const avatarUrl = getProfilePicture(profile, provider);

        if (!email) {
            return { success: false, error: 'Email not provided by OAuth provider' };
        }

        // Check if OAuth account already exists
        let existingOAuthAccount = await getOAuthAccount(provider, providerId);
        
        if (existingOAuthAccount) {
            // Update OAuth account tokens
            await createOrUpdateOAuthAccount({
                userId: existingOAuthAccount.user_id,
                provider,
                providerId,
                providerEmail: email,
                providerName: displayName,
                providerAvatar: avatarUrl,
                accessToken,
                refreshToken,
                expiresAt: null // Set based on provider if needed
            });

            // Return existing user
            const users = await getUserById(existingOAuthAccount.user_id);
            const user = users && users.length > 0 ? users[0] : null;
            
            if (user && user.is_active) {
                consoleLog('info', 'OAuth login successful', { provider, userId: user.id, email });
                return { success: true, user };
            } else {
                return { success: false, error: 'Account is disabled' };
            }
        }

        // Check if user with this email already exists
        const existingUserByEmail = await findOAuthAccountByEmail(email);
        
        if (existingUserByEmail) {
            // Link OAuth account to existing user
            await createOrUpdateOAuthAccount({
                userId: existingUserByEmail.user_id,
                provider,
                providerId,
                providerEmail: email,
                providerName: displayName,
                providerAvatar: avatarUrl,
                accessToken,
                refreshToken,
                expiresAt: null
            });

            const users = await getUserById(existingUserByEmail.user_id);
            const user = users && users.length > 0 ? users[0] : null;
            
            consoleLog('info', 'OAuth account linked to existing user', { provider, userId: user.id, email });
            return { success: true, user };
        }

        // Create new user account
        const username = await generateUniqueUsername(displayName, email);
        const randomPassword = await bcrypt.hash(Math.random().toString(36), 12); // Random password since OAuth user won't use it
        
        // Get default language from settings for new OAuth user
        const defaultLanguage = await i18n.getDefaultLanguage();

        const newUserData = {
            username,
            email,
            password: randomPassword,
            first_name: firstName,
            last_name: lastName,
            user_type: 'user',
            is_verified: 1, // OAuth users are considered verified
            oauth_provider: provider,
            oauth_avatar: avatarUrl,
            language_preference: defaultLanguage
        };

        const userResult = await createUser(newUserData);
        
        if (userResult.success) {
            // Create OAuth account link
            await createOrUpdateOAuthAccount({
                userId: userResult.userId,
                provider,
                providerId,
                providerEmail: email,
                providerName: displayName,
                providerAvatar: avatarUrl,
                accessToken,
                refreshToken,
                expiresAt: null
            });

            const users = await getUserById(userResult.userId);
            const user = users && users.length > 0 ? users[0] : null;
            
            consoleLog('info', 'New user created via OAuth', { provider, userId: user.id, email });
            return { success: true, user, isNewUser: true };
        } else {
            return { success: false, error: 'Failed to create user account' };
        }

    } catch (error) {
        consoleLog('error', 'Error handling OAuth profile', { error: error.message, provider });
        return { success: false, error: error.message };
    }
};

/**
 * Generate unique username from display name and email
 * @param {string} displayName - Display name from OAuth
 * @param {string} email - Email from OAuth
 * @returns {string} Unique username
 */
const generateUniqueUsername = async (displayName, email) => {
    try {
        // Start with display name or email prefix
        let baseUsername = displayName ? 
            displayName.toLowerCase().replace(/[^a-z0-9]/g, '') :
            email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Ensure minimum length
        if (baseUsername.length < 3) {
            baseUsername = 'user' + baseUsername;
        }
        
        // Truncate if too long
        if (baseUsername.length > 20) {
            baseUsername = baseUsername.substring(0, 20);
        }
        
        let username = baseUsername;
        let counter = 1;
        
        // Check if username exists and append number if needed
        while (await usernameExists(username)) {
            username = baseUsername + counter;
            counter++;
            
            // Prevent infinite loop
            if (counter > 1000) {
                username = baseUsername + Date.now();
                break;
            }
        }
        
        return username;
    } catch (error) {
        // Fallback to timestamp-based username
        return 'user' + Date.now();
    }
};

/**
 * Check if username already exists
 * @param {string} username - Username to check
 * @returns {boolean} Whether username exists
 */
const usernameExists = async (username) => {
    try {
        const { executeQuery } = await import('./mysql.js');
        const query = 'SELECT id FROM users WHERE username = ? LIMIT 1';
        const result = await executeQuery(query, [username]);
        return result.length > 0;
    } catch (error) {
        return false; // Assume doesn't exist on error
    }
};

/**
 * Extract profile picture URL from OAuth profile
 * @param {Object} profile - OAuth profile
 * @param {string} provider - OAuth provider
 * @returns {string|null} Profile picture URL
 */
const getProfilePicture = (profile, provider) => {
    try {
        if (provider === 'facebook') {
            return profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null;
        } else if (provider === 'google') {
            return profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null;
        }
        return null;
    } catch (error) {
        return null;
    }
};

/**
 * Check if OAuth provider is enabled
 * @param {string} provider - OAuth provider (facebook, google)
 * @returns {boolean} Whether provider is enabled
 */
export const isOAuthProviderEnabled = async (provider) => {
    try {
        const enabled = await getSetting(`enable_${provider}_login`, '0');
        return enabled === '1';
    } catch (error) {
        return false;
    }
};

/**
 * Get OAuth provider configuration
 * @param {string} provider - OAuth provider
 * @returns {Object} Provider configuration
 */
export const getOAuthProviderConfig = async (provider) => {
    try {
        if (provider === 'facebook') {
            const [enabled, clientId] = await Promise.all([
                getSetting('enable_facebook_login', '0'),
                getSetting('facebook_app_id', '')
            ]);
            return { enabled: enabled === '1', clientId };
        } else if (provider === 'google') {
            const [enabled, clientId] = await Promise.all([
                getSetting('enable_google_login', '0'),
                getSetting('google_client_id', '')
            ]);
            return { enabled: enabled === '1', clientId };
        }
        return { enabled: false };
    } catch (error) {
        return { enabled: false };
    }
};

/**
 * Get OAuth provider validation status
 * @param {string} provider - OAuth provider (facebook, google)
 * @returns {Object} Validation status
 */
export const getOAuthProviderValidation = async (provider) => {
    try {
        let config = {};
        
        if (provider === 'facebook') {
            const [enabled, clientId, clientSecret] = await Promise.all([
                getSetting('enable_facebook_login', '0'),
                getSetting('facebook_app_id', ''),
                getSetting('facebook_app_secret', '')
            ]);
            
            config = {
                enabled: enabled === '1',
                clientId,
                clientSecret,
                callbackURL: '/auth/facebook/callback'
            };
        } else if (provider === 'google') {
            const [enabled, clientId, clientSecret] = await Promise.all([
                getSetting('enable_google_login', '0'),
                getSetting('google_client_id', ''),
                getSetting('google_client_secret', '')
            ]);
            
            config = {
                enabled: enabled === '1',
                clientId,
                clientSecret,
                callbackURL: '/auth/google/callback'
            };
        } else {
            return { isValid: false, errors: ['Unknown provider'] };
        }
        
        if (!config.enabled) {
            return { isValid: true, errors: [], disabled: true };
        }
        
        const validation = validateOAuthConfig(provider, config);
        const siteDomain = await getSiteDomain();
        
        if (siteDomain && !validateCallbackURL(config.callbackURL, siteDomain)) {
            validation.errors.push(`Callback URL may not match site domain (${siteDomain})`);
            validation.isValid = false;
        }
        
        return {
            ...validation,
            config: {
                enabled: config.enabled,
                hasClientId: !!config.clientId,
                hasClientSecret: !!config.clientSecret,
                callbackURL: config.callbackURL
            }
        };
    } catch (error) {
        return { isValid: false, errors: [error.message] };
    }
};

/**
 * Get comprehensive OAuth system status
 * @returns {Object} OAuth system status
 */
export const getOAuthSystemStatus = async () => {
    try {
        const [facebookStatus, googleStatus, siteDomain] = await Promise.all([
            getOAuthProviderValidation('facebook'),
            getOAuthProviderValidation('google'),
            getSiteDomain()
        ]);
        
        const enabledProviders = [];
        const validProviders = [];
        const errors = [];
        
        // Process Facebook status
        if (facebookStatus.config?.enabled) {
            enabledProviders.push('facebook');
            if (facebookStatus.isValid) {
                validProviders.push('facebook');
            } else {
                errors.push(...facebookStatus.errors.map(err => `Facebook: ${err}`));
            }
        }
        
        // Process Google status
        if (googleStatus.config?.enabled) {
            enabledProviders.push('google');
            if (googleStatus.isValid) {
                validProviders.push('google');
            } else {
                errors.push(...googleStatus.errors.map(err => `Google: ${err}`));
            }
        }
        
        return {
            isHealthy: errors.length === 0,
            enabledProviders,
            validProviders,
            errors,
            siteDomain,
            facebook: facebookStatus,
            google: googleStatus,
            lastChecked: new Date().toISOString()
        };
    } catch (error) {
        return {
            isHealthy: false,
            enabledProviders: [],
            validProviders: [],
            errors: [`System error: ${error.message}`],
            lastChecked: new Date().toISOString()
        };
    }
};

export default {
    initializePassport,
    isOAuthProviderEnabled,
    getOAuthProviderConfig,
    getOAuthProviderValidation,
    getOAuthSystemStatus
};