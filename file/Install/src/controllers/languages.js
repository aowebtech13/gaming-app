import i18n from '../utils/i18n.js';
import response from '../utils/response.js';
import { consoleLog } from '../utils/logger.js';
import { changeLanguage as changeLanguageMiddleware, getLanguageInfo } from '../middlewares/language.js';
import { updateUserLanguagePreference } from '../models/users.js';

/**
 * Get available languages
 */
export const getAvailableLanguages = async (req, res) => {
    try {
        const availableLanguages = await i18n.getAvailableLanguages();
        const languageInfo = availableLanguages.map(code => ({
            code,
            ...i18n.getLanguageInfo(code)
        }));

        return response(res, 200, 'Languages retrieved successfully', {
            languages: languageInfo,
            current: req.language?.current || 'en'
        });
    } catch (error) {
        consoleLog('error', 'Get available languages error', { error });
        return response(res, 500, i18n.translateSync('api.languages.get_failed', {}, req.language?.current || 'en'));
    }
};

/**
 * Change current language
 */
export const changeLanguage = async (req, res) => {
    try {
        const { language } = req.body;
        
        if (!language) {
            return response(res, 400, i18n.translateSync('api.languages.code_required', {}, req.language?.current || 'en'));
        }

        const availableLanguages = await i18n.getAvailableLanguages();
        
        if (!availableLanguages.includes(language)) {
            return response(res, 400, i18n.translateSync('api.languages.invalid_code', {}, req.language?.current || 'en'));
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

        return response(res, 200, i18n.translateSync('api.languages.changed_successfully', {}, req.language?.current || 'en'), {
            language: language,
            languageInfo: i18n.getLanguageInfo(language),
            isRTL: i18n.isRTL(language)
        });

    } catch (error) {
        consoleLog('error', 'Change language error', { error });
        return response(res, 500, i18n.translateSync('api.languages.change_failed', {}, req.language?.current || 'en'));
    }
};

/**
 * Get current language info
 */
export const getCurrentLanguage = async (req, res) => {
    try {
        const currentLanguage = req.language?.current || 'en';
        const availableLanguages = await i18n.getAvailableLanguages();
        
        return response(res, 200, 'Current language info retrieved successfully', {
            current: {
                code: currentLanguage,
                ...i18n.getLanguageInfo(currentLanguage),
                isRTL: i18n.isRTL(currentLanguage)
            },
            available: availableLanguages.map(code => ({
                code,
                ...i18n.getLanguageInfo(code),
                isRTL: i18n.isRTL(code)
            }))
        });
    } catch (error) {
        consoleLog('error', 'Get current language error', { error });
        return response(res, 500, i18n.translateSync('api.languages.info_failed', {}, req.language?.current || 'en'));
    }
};