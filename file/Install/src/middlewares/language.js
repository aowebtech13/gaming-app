import i18n from '../utils/i18n.js';
import { consoleLog } from '../utils/logger.js';
import { updateUserLanguagePreference } from '../models/users.js';

/**
 * Parse Accept-Language header to get preferred languages
 * @param {string} acceptLanguage 
 * @returns {Array} Array of language codes sorted by preference
 */
function parseAcceptLanguage(acceptLanguage) {
    if (!acceptLanguage) return [];

    return acceptLanguage
        .split(',')
        .map(lang => {
            const parts = lang.trim().split(';');
            const code = parts[0].toLowerCase();
            const quality = parts[1] ? parseFloat(parts[1].split('=')[1]) : 1.0;
            return { code: code.split('-')[0], quality }; // Extract main language code
        })
        .sort((a, b) => b.quality - a.quality)
        .map(lang => lang.code);
}

/**
 * Detect user's preferred language from various sources
 * @param {Object} req Express request object
 * @returns {Promise<string>} Detected language code
 */
async function detectLanguage(req) {
    const availableLanguages = await i18n.getAvailableLanguages();
    
    // 1. Check URL parameter (?lang=es)
    if (req.query.lang && availableLanguages.includes(req.query.lang)) {
        return req.query.lang;
    }

    // 2. Check session preference
    if (req.session?.language && availableLanguages.includes(req.session.language)) {
        return req.session.language;
    }

    // 3. Check user preference from database (if user is logged in)
    if (req.session.user?.language_preference && availableLanguages.includes(req.session.user.language_preference)) {
        return req.session.user.language_preference;
    }

    // 4. Check Accept-Language header
    const acceptLanguages = parseAcceptLanguage(req.headers['accept-language']);
    for (const lang of acceptLanguages) {
        if (availableLanguages.includes(lang)) {
            return lang;
        }
    }

    // 5. Default to database setting or fallback
    return await i18n.getDefaultLanguage();
}

/**
 * Language detection and setup middleware
 * @param {Object} req Express request object
 * @param {Object} res Express response object
 * @param {Function} next Next middleware function
 */
export default async function languageMiddleware(req, res, next) {
    try {
        // Detect current language
        const currentLanguage = await detectLanguage(req);
        
        // Store in session if it changed or doesn't exist
        if (!req.session.language || req.query.lang) {
            req.session.language = currentLanguage;
        }

        // Get available languages for language switcher
        const availableLanguages = await i18n.getAvailableLanguages();
        const languageInfo = await Promise.all(availableLanguages.map(code => i18n.getLanguageInfo(code)));

        // Get current language info and RTL status
        const currentLanguageInfo = await i18n.getLanguageInfo(currentLanguage);
        const isRTL = await i18n.isRTL(currentLanguage);

        // Store language data in request for other middlewares
        req.language = {
            current: currentLanguage,
            info: currentLanguageInfo,
            available: languageInfo,
            isRTL: isRTL
        };

        // Add language info to response locals for templates
        res.locals.currentLanguage = currentLanguage;
        res.locals.currentLanguageInfo = currentLanguageInfo;
        res.locals.availableLanguages = languageInfo;
        res.locals.isRTL = isRTL;

        next();
    } catch (error) {
        consoleLog('error', 'Language middleware error', { error });
        
        // Fallback to default language on error
        const fallbackLanguage = i18n.fallbackLanguage;
        const fallbackInfo = {
            code: fallbackLanguage,
            name: 'English',
            nativeName: 'English',
            isRTL: false
        };

        req.language = {
            current: fallbackLanguage,
            info: fallbackInfo,
            available: [fallbackInfo],
            isRTL: false
        };

        res.locals.currentLanguage = fallbackLanguage;
        res.locals.currentLanguageInfo = fallbackInfo;
        res.locals.availableLanguages = [fallbackInfo];
        res.locals.isRTL = false;

        next();
    }
}

/**
 * API endpoint for changing language
 * @param {Object} req Express request object
 * @param {Object} res Express response object
 */
export async function changeLanguage(req, res) {
    try {
        const { language } = req.body;
        
        if (!language) {
            return res.status(400).json({
                success: false,
                message: 'Language code is required'
            });
        }

        const availableLanguages = await i18n.getAvailableLanguages();
        
        if (!availableLanguages.includes(language)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid language code'
            });
        }

        // Update session
        req.session.language = language;

        // Update user preference in database if logged in
        if (req.session.user) {
            try {
                await updateUserLanguagePreference(req.session.user.id, language);
                // Update the user object in session
                req.session.user.language_preference = language;
            } catch (error) {
                consoleLog('error', 'Failed to update user language preference', { error });
                // Don't fail the request, just log the error
            }
        }

        res.json({
            success: true,
            language: language,
            languageInfo: i18n.getLanguageInfo(language),
            isRTL: i18n.isRTL(language),
            message: 'Language changed successfully'
        });

    } catch (error) {
        consoleLog('error', 'Change language error', { error });
        res.status(500).json({
            success: false,
            message: 'Failed to change language'
        });
    }
}

/**
 * API endpoint to get current language info
 * @param {Object} req Express request object
 * @param {Object} res Express response object
 */
export async function getLanguageInfo(req, res) {
    try {
        const currentLanguage = req.language?.current || i18n.defaultLanguage;
        const availableLanguages = await i18n.getAvailableLanguages();
        
        res.json({
            success: true,
            current: {
                code: currentLanguage,
                info: i18n.getLanguageInfo(currentLanguage),
                isRTL: i18n.isRTL(currentLanguage)
            },
            available: availableLanguages.map(code => ({
                code,
                info: i18n.getLanguageInfo(code),
                isRTL: i18n.isRTL(code)
            }))
        });
    } catch (error) {
        consoleLog('error', 'Get language info error', { error });
        res.status(500).json({
            success: false,
            message: 'Failed to get language information'
        });
    }
}