import passport from 'passport';
import { consoleLog } from '../utils/logger.js';
import { isOAuthProviderEnabled } from '../utils/passport.js';
import { sendWelcomeEmail } from '../utils/mail.js';
import { getSetting } from '../models/settings.js';
import { getUserLanguagePreference } from '../models/users.js';
import i18n from '../utils/i18n.js';

/**
 * Initiate Facebook OAuth
 */
export const facebookAuth = async (req, res, next) => {
    try {
        const enabled = await isOAuthProviderEnabled('facebook');
        if (!enabled) {
            return res.redirect('/login?error=facebook_disabled');
        }

        passport.authenticate('facebook', { 
            scope: ['email'],
            state: req.query.returnTo || '/' // Store return URL in state
        })(req, res, next);
    } catch (error) {
        consoleLog('error', 'Facebook auth initialization error', { error: error.message });
        res.redirect('/login?error=oauth_error');
    }
};

/**
 * Handle Facebook OAuth callback
 */
export const facebookCallback = async (req, res, next) => {
    try {
        passport.authenticate('facebook', async (err, result) => {
            if (err) {
                consoleLog('error', 'Facebook OAuth callback error', { error: err.message });
                return res.redirect('/login?error=oauth_error');
            }

            if (!result || !result.success) {
                const errorMsg = result?.error || 'Facebook authentication failed';
                consoleLog('warn', 'Facebook OAuth failed', { error: errorMsg });
                return res.redirect(`/login?error=${encodeURIComponent(errorMsg)}`);
            }

            const { user, isNewUser } = result;

            // Load user's language preference if not a new user
            if (!isNewUser) {
                try {
                    const languagePreference = await getUserLanguagePreference(user.id);
                    if (languagePreference) {
                        user.language_preference = languagePreference;
                        // Set the language preference in session so middleware picks it up
                        req.session.language = languagePreference;
                    }
                } catch (error) {
                    consoleLog('warn', 'Failed to load user language preference during Facebook OAuth', { 
                        error: error.message, 
                        userId: user.id 
                    });
                }
            }

            // Clear session theme on OAuth login (fallback to database setting)
            delete req.session.selectedTheme;

            // Set user session
            req.session.user = user;
            req.session.isLoggedIn = true;

            // Send welcome email for new users
            if (isNewUser) {
                try {
                    const siteName = await getSetting('site_name', 'ARCADE');
                    const userName = user.first_name || user.username;
                    await sendWelcomeEmail(user.email, userName, siteName, req.language?.current || 'en', req);
                } catch (emailError) {
                    consoleLog('warn', 'Failed to send welcome email', { 
                        error: emailError.message, 
                        userId: user.id 
                    });
                }
            }

            // Get return URL from state or default to dashboard
            const returnTo = req.query.state && req.query.state !== '/' ? req.query.state : '/';
            
            consoleLog('info', 'Facebook OAuth login successful', { 
                userId: user.id, 
                email: user.email,
                isNewUser 
            });

            res.redirect(returnTo);
        })(req, res, next);
    } catch (error) {
        consoleLog('error', 'Facebook callback error', { error: error.message });
        res.redirect('/login?error=oauth_error');
    }
};

/**
 * Initiate Google OAuth
 */
export const googleAuth = async (req, res, next) => {
    try {
        const enabled = await isOAuthProviderEnabled('google');
        if (!enabled) {
            return res.redirect('/login?error=google_disabled');
        }

        passport.authenticate('google', { 
            scope: ['profile', 'email'],
            state: req.query.returnTo || '/' // Store return URL in state
        })(req, res, next);
    } catch (error) {
        consoleLog('error', 'Google auth initialization error', { error: error.message });
        res.redirect('/login?error=oauth_error');
    }
};

/**
 * Handle Google OAuth callback
 */
export const googleCallback = async (req, res, next) => {
    try {
        passport.authenticate('google', async (err, result) => {
            if (err) {
                consoleLog('error', 'Google OAuth callback error', { error: err.message });
                return res.redirect('/login?error=oauth_error');
            }

            if (!result || !result.success) {
                const errorMsg = result?.error || 'Google authentication failed';
                consoleLog('warn', 'Google OAuth failed', { error: errorMsg });
                return res.redirect(`/login?error=${encodeURIComponent(errorMsg)}`);
            }

            const { user, isNewUser } = result;

            // Load user's language preference if not a new user
            if (!isNewUser) {
                try {
                    const languagePreference = await getUserLanguagePreference(user.id);
                    if (languagePreference) {
                        user.language_preference = languagePreference;
                        // Set the language preference in session so middleware picks it up
                        req.session.language = languagePreference;
                    }
                } catch (error) {
                    consoleLog('warn', 'Failed to load user language preference during Google OAuth', { 
                        error: error.message, 
                        userId: user.id 
                    });
                }
            }

            // Clear session theme on OAuth login (fallback to database setting)
            delete req.session.selectedTheme;

            // Set user session
            req.session.user = user;
            req.session.isLoggedIn = true;

            // Send welcome email for new users
            if (isNewUser) {
                try {
                    const siteName = await getSetting('site_name', 'ARCADE');
                    const userName = user.first_name || user.username;
                    await sendWelcomeEmail(user.email, userName, siteName, req.language?.current || 'en', req);
                } catch (emailError) {
                    consoleLog('warn', 'Failed to send welcome email', { 
                        error: emailError.message, 
                        userId: user.id 
                    });
                }
            }

            // Get return URL from state or default to dashboard
            const returnTo = req.query.state && req.query.state !== '/' ? req.query.state : '/';
            
            consoleLog('info', 'Google OAuth login successful', { 
                userId: user.id, 
                email: user.email,
                isNewUser 
            });

            res.redirect(returnTo);
        })(req, res, next);
    } catch (error) {
        consoleLog('error', 'Google callback error', { error: error.message });
        res.redirect('/login?error=oauth_error');
    }
};

/**
 * Handle OAuth errors and provide user-friendly messages
 */
export const handleOAuthError = (req, res) => {
    const error = req.query.error;
    let errorMessage = i18n.translateSync('api.oauth.auth_error', {}, req.language?.current || 'en');

    switch (error) {
        case 'facebook_disabled':
            errorMessage = i18n.translateSync('api.oauth.facebook_disabled', {}, req.language?.current || 'en');
            break;
        case 'google_disabled':
            errorMessage = i18n.translateSync('api.oauth.google_disabled', {}, req.language?.current || 'en');
            break;
        case 'oauth_error':
            errorMessage = i18n.translateSync('api.oauth.auth_error', {}, req.language?.current || 'en');
            break;
        case 'access_denied':
            errorMessage = i18n.translateSync('api.oauth.access_denied', {}, req.language?.current || 'en');
            break;
        default:
            if (error) {
                errorMessage = decodeURIComponent(error);
            }
    }

    // Render login page with error
    const pageData = {
        page: "login",
        title: `${i18n.translateSync('auth.oauth_error.title', {}, req.language?.current || 'en')} · ${res.locals.site_name || 'ARCADE'}`,
        description: i18n.translateSync('auth.oauth_error.description', { siteName: res.locals.site_name || 'ARCADE' }, req.language?.current || 'en'),
        error: errorMessage
    };

    res.render("pages/login", pageData);
};

export default {
    facebookAuth,
    facebookCallback,
    googleAuth,
    googleCallback,
    handleOAuthError
};