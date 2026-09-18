import bcrypt from 'bcrypt';
import axios from 'axios';
import response from '../utils/response.js';
import { consoleLog } from '../utils/logger.js';
import i18n from '../utils/i18n.js';
import { getSetting } from '../models/settings.js';
import { getUserByUsernameOrEmail, updateLastLogin, checkUserExists, createUser, getUserByEmail, updateUserPassword, verifyUserById, updateUserVerificationStatus, getUserLanguagePreference } from '../models/users.js';
import { awardDailyLoginExp } from '../utils/exp.js';
import { 
    createPasswordResetToken, 
    getPasswordResetToken, 
    markTokenAsUsed as markPasswordTokenAsUsed, 
    hasExceededResetLimit 
} from '../models/password_reset_tokens.js';
import { 
    createEmailVerificationToken, 
    getEmailVerificationToken,
    markTokenAsUsed as markEmailTokenAsUsed,
    hasExceededVerificationLimit 
} from '../models/email_verification_tokens.js';
import { getUserById } from '../models/users.js';
import { sendPasswordResetEmail, sendWelcomeEmail, sendEmailVerificationEmail } from '../utils/mail.js';

const login = async (req, res) => {
    // Redirect to homepage if user is already logged in
    if (res.locals.user) {
        return res.redirect('/');
    }

    const pageData = {
        page: "default/login",
        title: `Login &middot; ${res.locals.site_name || 'ARCADE'}`,
        description: "Sign in to your account"
    };

    res.render("pages/login", pageData);
};

const register = async (req, res) => {
    // Redirect to homepage if user is already logged in
    if (res.locals.user) {
        return res.redirect('/');
    }

    // Check if user registration is enabled
    const registrationEnabled = await getSetting('user_registration_enabled', '1');
    if (registrationEnabled !== '1') {
        return res.redirect('/auth/login');
    }

    const pageData = {
        page: "default/register",
        title: `Register &middot; ${res.locals.site_name || 'ARCADE'}`,
        description: "Create your account"
    };

    res.render("pages/register", pageData);
};

const processLogin = async (req, res) => {
    try {
        const { username, password, remember, 'g-recaptcha-response': recaptchaResponse } = req.body;

        // Validate required fields
        if (!username || !password) {
            return response(res, 400, i18n.translateSync('auth.credentials_required', {}, req.language?.current || 'en'));
        }

        // Verify reCAPTCHA (only if keys are configured)
        const recaptchaSecret = await getSetting('recaptcha_secret_key');
        const recaptchaSiteKey = await getSetting('recaptcha_site_key');
        
        if (recaptchaSecret && recaptchaSiteKey && recaptchaSecret.trim() !== '' && recaptchaSiteKey.trim() !== '') {
            if (!recaptchaResponse) {
                return response(res, 400, i18n.translateSync('api.auth.recaptcha_required', {}, req.language?.current || 'en'));
            }

            try {
                const recaptchaVerification = await axios.post(
                    `https://www.google.com/recaptcha/api/siteverify`,
                    null,
                    {
                        params: {
                            secret: recaptchaSecret,
                            response: recaptchaResponse,
                            remoteip: req.ip
                        }
                    }
                );

                if (!recaptchaVerification.data.success) {
                    return response(res, 400, i18n.translateSync('api.auth.recaptcha_failed', {}, req.language?.current || 'en'));
                }
            } catch (error) {
                consoleLog('error', 'reCAPTCHA verification error', { error: error.message });
                return response(res, 500, i18n.translateSync('api.auth.recaptcha_failed', {}, req.language?.current || 'en'));
            }
        }

        // Find user by username or email
        const users = await getUserByUsernameOrEmail(username);

        if (users.length === 0) {
            return response(res, 401, i18n.translateSync('auth.invalid_credentials', {}, req.language?.current || 'en'));
        }

        const user = users[0];

        // Check if user is active
        if (!user.is_active) {
            return response(res, 401, i18n.translateSync('auth.account_inactive', {}, req.language?.current || 'en'));
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return response(res, 401, i18n.translateSync('auth.invalid_credentials', {}, req.language?.current || 'en'));
        }

        // Check if user email is verified (skip for OAuth users or if verification is disabled)
        const emailVerificationEnabled = await getSetting('email_verification_enabled', '1');
        if (emailVerificationEnabled === '1' && !user.is_verified && !user.oauth_provider) {
            return response(res, 401, i18n.translateSync('api.auth.verify_email_first', {}, req.language?.current || 'en'), {
                error_type: "email_not_verified",
                user_id: user.id,
                email: user.email
            });
        }

        // Check if maintenance mode is enabled and restrict login to admins only
        const maintenanceEnabled = await getSetting('maintenance_mode', '0');
        if (maintenanceEnabled === '1' && user.user_type !== 'admin') {
            return response(res, 403, i18n.translateSync('api.auth.maintenance_admin_only', {}, req.language?.current || 'en'));
        }

        // Update last login
        await updateLastLogin(user.id);

        // Load user's language preference
        const languagePreference = await getUserLanguagePreference(user.id);
        if (languagePreference) {
            user.language_preference = languagePreference;
            // Set the language preference in session so middleware picks it up
            req.session.language = languagePreference;
        }

        // Clear session theme on login (fallback to database setting)
        delete req.session.selectedTheme;
        
        // Set session
        req.session.user = user;
        
        // Handle remember me functionality
        if (remember === 'on' || remember === '1' || remember === true) {
            // Extend session cookie expiration to 30 days
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
        }

        // Award daily login EXP (async, don't wait for it)
        awardDailyLoginExp(user.id, req).catch(err => {
            consoleLog('error', 'Daily login EXP error', { error: err.message });
        });
        
        return response(res, 200, i18n.translateSync('api.auth.login_successful', {}, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', 'Login error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.auth.login_error', {}, req.language?.current || 'en'));
    }
};

const processRegister = async (req, res) => {
    try {
        // Check if user registration is enabled
        const registrationEnabled = await getSetting('user_registration_enabled', '1');
        if (registrationEnabled !== '1') {
            return response(res, 403, i18n.translateSync('api.auth.registration_disabled', {}, req.language?.current || 'en'));
        }

        const { 
            username, 
            email, 
            password, 
            confirm_password, 
            first_name, 
            last_name,
            'g-recaptcha-response': recaptchaResponse 
        } = req.body;

        // Validate required fields
        if (!username || !email || !password || !confirm_password || !first_name || !last_name) {
            return response(res, 400, i18n.translateSync('api.auth.all_fields_required', {}, req.language?.current || 'en'));
        }

        // Validate password match
        if (password !== confirm_password) {
            return response(res, 400, i18n.translateSync('api.auth.passwords_no_match', {}, req.language?.current || 'en'));
        }

        // Validate password strength
        if (password.length < 6) {
            return response(res, 400, i18n.translateSync('api.auth.password_min_length', {}, req.language?.current || 'en'));
        }

        // Verify reCAPTCHA (only if keys are configured)
        const recaptchaSecret = await getSetting('recaptcha_secret_key');
        const recaptchaSiteKey = await getSetting('recaptcha_site_key');
        
        if (recaptchaSecret && recaptchaSiteKey && recaptchaSecret.trim() !== '' && recaptchaSiteKey.trim() !== '') {
            if (!recaptchaResponse) {
                return response(res, 400, i18n.translateSync('api.auth.recaptcha_required', {}, req.language?.current || 'en'));
            }

            try {
                const recaptchaVerification = await axios.post(
                    `https://www.google.com/recaptcha/api/siteverify`,
                    null,
                    {
                        params: {
                            secret: recaptchaSecret,
                            response: recaptchaResponse,
                            remoteip: req.ip
                        }
                    }
                );

                if (!recaptchaVerification.data.success) {
                    return response(res, 400, i18n.translateSync('api.auth.recaptcha_failed', {}, req.language?.current || 'en'));
                }
            } catch (error) {
                consoleLog('error', 'reCAPTCHA verification error', { error: error.message });
                return response(res, 500, i18n.translateSync('api.auth.recaptcha_failed', {}, req.language?.current || 'en'));
            }
        }

        // Check if username or email already exists
        const existingUsers = await checkUserExists(username, email);

        if (existingUsers.length > 0) {
            const existingUser = existingUsers[0];
            if (existingUser.username === username) {
                return response(res, 400, i18n.translateSync('api.auth.username_exists', {}, req.language?.current || 'en'));
            }
            if (existingUser.email === email) {
                return response(res, 400, i18n.translateSync('api.auth.email_exists', {}, req.language?.current || 'en'));
            }
        }

        // Get default language from settings for new user
        const defaultLanguage = await i18n.getDefaultLanguage();
        
        // Create user
        const result = await createUser({
            username,
            email,
            password,
            first_name,
            last_name,
            language_preference: defaultLanguage
        });

        if (result.success) {
            // Check if email verification is enabled
            const emailVerificationEnabled = await getSetting('email_verification_enabled', '1');

            if (emailVerificationEnabled === '1') {
                // Email verification is ENABLED - do NOT create session
                // User must verify email before they can log in
                
                // Create email verification token
                const tokenResult = await createEmailVerificationToken(
                    result.userId,
                    req.ip,
                    req.get('User-Agent')
                );

                if (tokenResult.success) {
                    // Send verification email (async, don't wait for it to complete)
                    const siteName = await getSetting('site_name', 'ARCADE');
                    const userName = first_name || username;
                    
                    sendEmailVerificationEmail(email, userName, tokenResult.token, siteName, req.language?.current || 'en', req).catch(emailError => {
                        consoleLog('error', 'Failed to send verification email', { 
                            userId: result.userId, 
                            email: email,
                            error: emailError.message 
                        });
                    });

                    return response(res, 200, i18n.translateSync('api.auth.registration_success_verify', {}, req.language?.current || 'en'));
                } else {
                    consoleLog('error', 'Failed to create verification token', { 
                        userId: result.userId, 
                        error: tokenResult.error 
                    });
                    return response(res, 200, i18n.translateSync('api.auth.registration_success_email_issue', {}, req.language?.current || 'en'));
                }
            } else {
                // Email verification is DISABLED - create session and log user in immediately
                
                // Auto-verify user in database if verification is disabled
                await verifyUserById(result.userId);

                // Clear session theme on registration (fallback to database setting)
                delete req.session.selectedTheme;

                // Create session for the new user (log them in)
                req.session.user = {
                    id: result.userId,
                    username: username,
                    email: email,
                    first_name: first_name,
                    last_name: last_name,
                    user_type: 'user',
                    avatar: null,
                    is_active: true,
                    is_verified: true, // Auto-verified when verification is disabled
                    language_preference: defaultLanguage
                };

                // Send welcome email directly
                const siteName = await getSetting('site_name', 'ARCADE');
                const userName = first_name || username;
                
                sendWelcomeEmail(email, userName, siteName, req.language?.current || 'en', req).catch(emailError => {
                    consoleLog('error', 'Failed to send welcome email', { 
                        userId: result.userId, 
                        email: email,
                        error: emailError.message 
                    });
                });

                return response(res, 200, i18n.translateSync('api.auth.registration_success_welcome', {}, req.language?.current || 'en'));
            }
        } else {
            return response(res, 500, i18n.translateSync('api.auth.account_create_failed', {}, req.language?.current || 'en'));
        }

    } catch (error) {
        consoleLog('error', 'Registration error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.auth.registration_error', {}, req.language?.current || 'en'));
    }
};

const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                consoleLog('error', 'Session destroy error', { error: err.message });
                return response(res, 500, i18n.translateSync('api.auth.logout_failed', {}, req.language?.current || 'en'));
            }
            
            res.clearCookie('connect.sid');
            return response(res, 200, i18n.translateSync('api.auth.logout_successful', {}, req.language?.current || 'en'));
        });
    } catch (error) {
        consoleLog('error', 'Logout error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.auth.logout_error', {}, req.language?.current || 'en'));
    }
};

const forgotPassword = async (req, res) => {
    // Redirect to homepage if user is already logged in
    if (res.locals.user) {
        return res.redirect('/');
    }

    const pageData = {
        page: "default/forgot-password",
        title: `Forgot Password · ${res.locals.site_name || 'ARCADE'}`,
        description: `Reset your ${res.locals.site_name || 'ARCADE'} account password`
    };

    res.render("pages/forgot-password", pageData);
};

const processForgotPassword = async (req, res) => {
    try {
        const { email, 'g-recaptcha-response': recaptchaResponse } = req.body;

        // Validate required fields
        if (!email) {
            return response(res, 400, i18n.translateSync('api.auth.all_fields_required', {}, req.language?.current || 'en'));
        }

        // Verify reCAPTCHA (only if keys are configured)
        const recaptchaSecret = await getSetting('recaptcha_secret_key');
        const recaptchaSiteKey = await getSetting('recaptcha_site_key');
        
        if (recaptchaSecret && recaptchaSiteKey && recaptchaSecret.trim() !== '' && recaptchaSiteKey.trim() !== '') {
            if (!recaptchaResponse) {
                return response(res, 400, i18n.translateSync('api.auth.recaptcha_required', {}, req.language?.current || 'en'));
            }

            try {
                const recaptchaVerification = await axios.post(
                    `https://www.google.com/recaptcha/api/siteverify`,
                    null,
                    {
                        params: {
                            secret: recaptchaSecret,
                            response: recaptchaResponse,
                            remoteip: req.ip
                        }
                    }
                );

                if (!recaptchaVerification.data.success) {
                    return response(res, 400, i18n.translateSync('api.auth.recaptcha_failed', {}, req.language?.current || 'en'));
                }
            } catch (error) {
                consoleLog('error', 'reCAPTCHA verification error', { error: error.message });
                return response(res, 500, i18n.translateSync('api.auth.recaptcha_failed', {}, req.language?.current || 'en'));
            }
        }

        // Find user by email
        const users = await getUserByEmail(email);

        if (users.length === 0) {
            // Don't reveal if email exists or not for security
            return response(res, 200, i18n.translateSync('api.auth.password_reset_sent', {}, req.language?.current || 'en'));
        }

        const user = users[0];

        // Check if user is active
        if (!user.is_active) {
            return response(res, 200, i18n.translateSync('api.auth.password_reset_sent', {}, req.language?.current || 'en'));
        }

        // Check rate limiting
        const hasExceededLimit = await hasExceededResetLimit(user.id, 5, 24);
        if (hasExceededLimit) {
            return response(res, 429, i18n.translateSync('api.auth.password_reset_rate_limit', {}, req.language?.current || 'en'));
        }

        // Create password reset token
        const tokenResult = await createPasswordResetToken(
            user.id, 
            req.ip, 
            req.get('User-Agent')
        );

        if (!tokenResult.success) {
            consoleLog('error', 'Failed to create password reset token', { userId: user.id });
            return response(res, 500, i18n.translateSync('errors.generic', {}, req.language?.current || 'en'));
        }

        // Send password reset email
        try {
            const siteName = await getSetting('site_name', 'ARCADE');
            const userName = user.first_name || user.username;
            
            const emailResult = await sendPasswordResetEmail(
                user.email, 
                userName, 
                tokenResult.token, 
                siteName,
                req.language?.current || 'en',
                req
            );

            if (emailResult.success) {
                consoleLog('info', 'Password reset email sent', { 
                    userId: user.id, 
                    email: user.email,
                    tokenId: tokenResult.id
                });
            } else {
                consoleLog('error', 'Failed to send password reset email', { 
                    userId: user.id, 
                    error: emailResult.error 
                });
            }
        } catch (emailError) {
            consoleLog('error', 'Password reset email error', { 
                userId: user.id, 
                error: emailError.message 
            });
        }

        // Always return success message for security
        return response(res, 200, i18n.translateSync('api.auth.password_reset_sent', {}, req.language?.current || 'en'));

    } catch (error) {
        consoleLog('error', 'Forgot password error', { error: error.message });
        return response(res, 500, i18n.translateSync('errors.generic', {}, req.language?.current || 'en'));
    }
};

const resetPassword = async (req, res) => {
    const { token } = req.params;

    // Redirect to homepage if user is already logged in
    if (res.locals.user) {
        return res.redirect('/');
    }

    if (!token) {
        return res.redirect('/forgot-password?error=invalid_token');
    }

    // Verify token
    const tokenData = await getPasswordResetToken(token);
    if (!tokenData) {
        const pageData = {
            page: "default/reset-password",
            title: `Reset Password · ${res.locals.site_name || 'ARCADE'}`,
            description: "Reset your password",
            error: i18n.translateSync('api.auth.invalid_reset_token', {}, req.language?.current || 'en')
        };
        return res.render("pages/reset-password", pageData);
    }

    const pageData = {
        page: "reset-password",
        title: `Reset Password · ${res.locals.site_name || 'ARCADE'}`,
        description: "Reset your password",
        token: token,
        email: tokenData.email
    };

    res.render("pages/reset-password", pageData);
};

const processResetPassword = async (req, res) => {
    try {
        const { token, password, confirm_password, 'g-recaptcha-response': recaptchaResponse } = req.body;

        // Validate required fields
        if (!token || !password || !confirm_password) {
            return response(res, 400, i18n.translateSync('api.auth.all_fields_required', {}, req.language?.current || 'en'));
        }

        // Validate password match
        if (password !== confirm_password) {
            return response(res, 400, i18n.translateSync('api.auth.passwords_no_match', {}, req.language?.current || 'en'));
        }

        // Validate password strength
        if (password.length < 6) {
            return response(res, 400, i18n.translateSync('api.auth.password_min_length', {}, req.language?.current || 'en'));
        }

        // Verify reCAPTCHA (only if keys are configured)
        const recaptchaSecret = await getSetting('recaptcha_secret_key');
        const recaptchaSiteKey = await getSetting('recaptcha_site_key');
        
        if (recaptchaSecret && recaptchaSiteKey && recaptchaSecret.trim() !== '' && recaptchaSiteKey.trim() !== '') {
            if (!recaptchaResponse) {
                return response(res, 400, i18n.translateSync('api.auth.recaptcha_required', {}, req.language?.current || 'en'));
            }

            try {
                const recaptchaVerification = await axios.post(
                    `https://www.google.com/recaptcha/api/siteverify`,
                    null,
                    {
                        params: {
                            secret: recaptchaSecret,
                            response: recaptchaResponse,
                            remoteip: req.ip
                        }
                    }
                );

                if (!recaptchaVerification.data.success) {
                    return response(res, 400, i18n.translateSync('api.auth.recaptcha_failed', {}, req.language?.current || 'en'));
                }
            } catch (error) {
                consoleLog('error', 'reCAPTCHA verification error', { error: error.message });
                return response(res, 500, i18n.translateSync('api.auth.recaptcha_failed', {}, req.language?.current || 'en'));
            }
        }

        // Verify token
        const tokenData = await getPasswordResetToken(token);
        if (!tokenData) {
            return response(res, 400, i18n.translateSync('api.auth.invalid_reset_token', {}, req.language?.current || 'en'));
        }

        // Update user password (hashing handled by updateUserPassword function)
        const updateResult = await updateUserPassword(tokenData.user_id, password);
        if (!updateResult) {
            return response(res, 500, i18n.translateSync('errors.generic', {}, req.language?.current || 'en'));
        }

        // Mark token as used
        await markPasswordTokenAsUsed(token);

        consoleLog('info', 'Password reset successful', { 
            userId: tokenData.user_id, 
            email: tokenData.email 
        });

        return response(res, 200, i18n.translateSync('api.auth.password_reset_success', {}, req.language?.current || 'en'), { 
            redirect: '/login' 
        });

    } catch (error) {
        consoleLog('error', 'Reset password error', { error: error.message });
        return response(res, 500, i18n.translateSync('errors.generic', {}, req.language?.current || 'en'));
    }
};

const verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.redirect('/login?error=invalid_token');
        }

        // Verify token
        const tokenData = await getEmailVerificationToken(token);
        if (!tokenData) {
            return res.redirect('/login?error=invalid_or_expired_token');
        }

        // Update user verification status
        const updateResult = await updateUserVerificationStatus(tokenData.user_id);

        if (updateResult.affectedRows === 0) {
            return res.redirect('/login?error=verification_failed');
        }

        // Mark token as used
        await markEmailTokenAsUsed(token);

        // Send welcome email now that user is verified
        const siteName = await getSetting('site_name', 'ARCADE');
        const userName = tokenData.first_name || tokenData.username;
        
        sendWelcomeEmail(tokenData.email, userName, siteName, req.language?.current || 'en', req).catch(emailError => {
            consoleLog('error', 'Failed to send welcome email after verification', { 
                userId: tokenData.user_id, 
                email: tokenData.email,
                error: emailError.message 
            });
        });

        consoleLog('info', 'Email verification successful', { 
            userId: tokenData.user_id, 
            email: tokenData.email 
        });

        // Redirect to login with success message
        return res.redirect('/login?success=email_verified');
    } catch (error) {
        consoleLog('error', 'Email verification error', { error: error.message });
        return res.redirect('/login?error=verification_failed');
    }
};

const resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return response(res, 400, i18n.translateSync('api.auth.all_fields_required', {}, req.language?.current || 'en'));
        }

        // Find user by email
        const users = await getUserByEmail(email);
        if (users.length === 0) {
            // Don't reveal if email exists or not for security
            return response(res, 200, i18n.translateSync('api.auth.verification_email_sent', {}, req.language?.current || 'en'));
        }

        const user = users[0];

        // Check if user is already verified
        if (user.is_verified) {
            return response(res, 400, i18n.translateSync('api.auth.email_already_verified', {}, req.language?.current || 'en'));
        }

        // Check if user is active
        if (!user.is_active) {
            return response(res, 200, i18n.translateSync('api.auth.verification_email_sent', {}, req.language?.current || 'en'));
        }

        // Check rate limiting using configurable settings
        const resendLimit = await getSetting('email_verification_resend_limit_per_day', '5');
        const hasExceededLimit = await hasExceededVerificationLimit(user.id, parseInt(resendLimit), 24);
        if (hasExceededLimit) {
            return response(res, 429, i18n.translateSync('api.auth.verification_rate_limit', {}, req.language?.current || 'en'));
        }

        // Create new verification token
        const tokenResult = await createEmailVerificationToken(
            user.id,
            req.ip,
            req.get('User-Agent')
        );

        if (!tokenResult.success) {
            consoleLog('error', 'Failed to create verification token', { userId: user.id });
            return response(res, 500, i18n.translateSync('api.auth.verification_email_failed', {}, req.language?.current || 'en'));
        }

        // Send verification email
        try {
            const siteName = await getSetting('site_name', 'ARCADE');
            const userName = user.first_name || user.username;
            
            const emailResult = await sendEmailVerificationEmail(
                user.email,
                userName,
                tokenResult.token,
                siteName,
                req.language?.current || 'en',
                req
            );

            if (emailResult.success) {
                consoleLog('info', 'Verification email resent', { 
                    userId: user.id, 
                    email: user.email,
                    tokenId: tokenResult.id
                });
            } else {
                consoleLog('error', 'Failed to send verification email', { 
                    userId: user.id, 
                    error: emailResult.error 
                });
            }
        } catch (emailError) {
            consoleLog('error', 'Verification email error', { 
                userId: user.id, 
                error: emailError.message 
            });
        }

        // Always return success message for security
        return response(res, 200, i18n.translateSync('api.auth.verification_email_sent', {}, req.language?.current || 'en'));

    } catch (error) {
        consoleLog('error', 'Resend verification email error', { error: error.message });
        return response(res, 500, i18n.translateSync('errors.generic', {}, req.language?.current || 'en'));
    }
};

export {
    login,
    register,
    processLogin,
    processRegister,
    logout,
    forgotPassword,
    processForgotPassword,
    resetPassword,
    processResetPassword,
    verifyEmail,
    resendVerificationEmail
};