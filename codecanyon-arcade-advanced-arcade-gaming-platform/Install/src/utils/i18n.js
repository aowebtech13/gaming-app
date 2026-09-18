import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { consoleLog } from './logger.js';
import { getSetting } from '../models/settings.js';
import CacheUtils from './cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

class I18n {
    constructor() {
        this.languagesDir = path.join(rootDir, 'languages');
        this.fallbackLanguage = 'en'; // Fallback if database is not available
        this.languageCache = CacheUtils.initCache('i18n-languages', 6 * 60 * 60 * 1000); // 6 hours
        this.metadataCache = CacheUtils.initCache('i18n-metadata', 24 * 60 * 60 * 1000); // 24 hours
    }

    /**
     * Get default language from database settings
     * @returns {Promise<string>} Default language code
     */
    async getDefaultLanguage() {
        try {
            const defaultLang = await getSetting('default_language');
            return defaultLang || this.fallbackLanguage;
        } catch (error) {
            consoleLog('warn', 'Failed to get default language from settings, using fallback', { error });
            return this.fallbackLanguage;
        }
    }

    /**
     * Load language file with caching
     * @param {string} languageCode 
     * @returns {Object} Language data
     */
    async loadLanguage(languageCode) {
        try {
            // Check cache first
            const cacheKey = `lang-${languageCode}`;
            const cachedData = await CacheUtils.get('i18n-languages', cacheKey);
            
            if (cachedData !== null) {
                return cachedData;
            }
            
            // Load from disk if not cached
            const languageFile = path.join(this.languagesDir, `${languageCode}.json`);
            
            if (!await fs.pathExists(languageFile)) {
                // Cache empty object for non-existent files
                await CacheUtils.put('i18n-languages', cacheKey, {});
                return {};
            }
            
            const fileContent = await fs.readFile(languageFile, 'utf8');
            const languageData = JSON.parse(fileContent);
            
            // Cache the loaded data
            await CacheUtils.put('i18n-languages', cacheKey, languageData);
            
            return languageData;
        } catch (error) {
            consoleLog('error', `Failed to load language file ${languageCode}`, { error });
            return {};
        }
    }

    /**
     * Get available languages with caching
     * @returns {Array} List of available language codes
     */
    async getAvailableLanguages() {
        try {
            // Check cache first
            const cacheKey = 'available-languages';
            const cachedLanguages = await CacheUtils.get('i18n-metadata', cacheKey);
            
            if (cachedLanguages !== null) {
                return cachedLanguages;
            }
            
            // Load from disk if not cached
            const files = await fs.readdir(this.languagesDir);
            const languages = files
                .filter(file => file.endsWith('.json'))
                .map(file => file.replace('.json', ''));
            
            // Cache the result
            await CacheUtils.put('i18n-metadata', cacheKey, languages);
            
            return languages;
        } catch (error) {
            consoleLog('error', 'Failed to get available languages', { error });
            return [this.fallbackLanguage];
        }
    }

    /**
     * Check if language is RTL with caching
     * @param {string} languageCode 
     * @returns {boolean}
     */
    async isRTL(languageCode) {
        try {
            // Check cache first
            const cacheKey = `rtl-${languageCode}`;
            const cachedRTL = await CacheUtils.get('i18n-metadata', cacheKey);
            
            if (cachedRTL !== null) {
                return cachedRTL;
            }
            
            // Load from language data if not cached
            const languageData = await this.loadLanguage(languageCode);
            const isRTL = languageData._meta?.isRTL || false;
            
            // Cache the result
            await CacheUtils.put('i18n-metadata', cacheKey, isRTL);
            
            return isRTL;
        } catch (error) {
            consoleLog('error', `Failed to check RTL for language ${languageCode}`, { error });
            return false;
        }
    }

    /**
     * Get nested property value from object using dot notation
     * @param {Object} obj 
     * @param {string} path 
     * @returns {*}
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Replace variables in translation string
     * @param {string} text 
     * @param {Object} variables 
     * @returns {string}
     */
    interpolate(text, variables = {}) {
        if (!text || typeof text !== 'string') return text;

        return text.replace(/\{(\w+)\}/g, (match, key) => {
            return variables[key] !== undefined ? variables[key] : match;
        });
    }

    /**
     * Translate a key
     * @param {string} key Translation key (e.g. 'nav.profile')
     * @param {Object} variables Variables for interpolation
     * @param {string} languageCode Language code
     * @returns {Promise<string>} Translated string
     */
    async translate(key, variables = {}, languageCode = null) {
        try {
            // Get default language from database if not provided
            if (!languageCode) {
                languageCode = await this.getDefaultLanguage();
            }
            
            // Load target language fresh every time
            const languageData = await this.loadLanguage(languageCode);
            let translation = this.getNestedValue(languageData, key);

            // Fallback to default language if not found
            const defaultLanguage = await this.getDefaultLanguage();
            if (translation === undefined && languageCode !== defaultLanguage) {
                const defaultData = await this.loadLanguage(defaultLanguage);
                translation = this.getNestedValue(defaultData, key);
            }

            // Final fallback to key itself
            if (translation === undefined) {
                translation = key;
            }

            // Interpolate variables
            return this.interpolate(translation, variables);
        } catch (error) {
            consoleLog('error', `Translation error for key "${key}"`, { error });
            return key; // Return key as fallback
        }
    }

    /**
     * Synchronous translation for template use
     * @param {string} key Translation key
     * @param {Object} variables Variables for interpolation
     * @param {string} languageCode Language code
     * @returns {string} Translated string
     */
    translateSync(key, variables = {}, languageCode = null) {
        try {
            // Use fallback language if no language code provided (can't make async DB call in sync method)
            if (!languageCode) {
                languageCode = this.fallbackLanguage;
            }
            
            // Load directly from file system synchronously using ES6 imports
            const languageFilePath = path.join(this.languagesDir, `${languageCode}.json`);
            
            let languageData = {};
            if (fs.pathExistsSync(languageFilePath)) {
                const fileContent = fs.readFileSync(languageFilePath, 'utf8');
                languageData = JSON.parse(fileContent);
            }
            
            let translation = this.getNestedValue(languageData, key);
            
            // Fallback to default language if not found
            if (translation === undefined && languageCode !== this.fallbackLanguage) {
                const defaultFilePath = path.join(this.languagesDir, `${this.fallbackLanguage}.json`);
                
                if (fs.pathExistsSync(defaultFilePath)) {
                    const fileContent = fs.readFileSync(defaultFilePath, 'utf8');
                    const defaultData = JSON.parse(fileContent);
                    translation = this.getNestedValue(defaultData, key);
                }
            }
            
            // Final fallback to key itself
            if (translation === undefined) {
                translation = key;
            }
            
            // Interpolate variables
            return this.interpolate(translation, variables);
        } catch (error) {
            consoleLog('error', `Sync translation error for key "${key}"`, { error });
            return key; // Return key as fallback
        }
    }

    /**
     * Translate with pluralization support
     * @param {string} key Translation key
     * @param {number} count Count for pluralization
     * @param {Object} variables Variables for interpolation
     * @param {string} languageCode Language code
     * @returns {Promise<string>} Translated string
     */
    async translatePlural(key, count, variables = {}, languageCode = this.defaultLanguage) {
        const pluralKey = count === 1 ? key : `${key}_plural`;
        const mergedVariables = { count, ...variables };
        return this.translate(pluralKey, mergedVariables, languageCode);
    }

    /**
     * Get language metadata with caching
     * @param {string} languageCode 
     * @returns {Promise<Object>}
     */
    async getLanguageInfo(languageCode) {
        try {
            // Check cache first
            const cacheKey = `info-${languageCode}`;
            const cachedInfo = await CacheUtils.get('i18n-metadata', cacheKey);
            
            if (cachedInfo !== null) {
                return cachedInfo;
            }
            
            // Load from language data if not cached
            const languageData = await this.loadLanguage(languageCode);
            const meta = languageData._meta || {};
            
            const languageInfo = {
                code: languageCode,
                name: meta.name || languageCode,
                nativeName: meta.nativeName || languageCode,
                isRTL: meta.isRTL || false,
                flag: meta.flag || '🌐'
            };
            
            // Cache the result
            await CacheUtils.put('i18n-metadata', cacheKey, languageInfo);
            
            return languageInfo;
        } catch (error) {
            consoleLog('error', `Failed to get language info for ${languageCode}`, { error });
            return {
                code: languageCode,
                name: languageCode,
                nativeName: languageCode,
                isRTL: false,
                flag: '🌐'
            };
        }
    }

    /**
     * Get all translations for a language (for client-side)
     * @param {string} languageCode 
     * @returns {Object}
     */
    async getAllTranslations(languageCode) {
        return await this.loadLanguage(languageCode);
    }

    /**
     * Clear language caches (for cache invalidation)
     * @param {string} languageCode - Specific language to clear, or null for all
     */
    async clearLanguageCache(languageCode = null) {
        try {
            if (languageCode) {
                // Clear specific language cache
                await CacheUtils.del('i18n-languages', `lang-${languageCode}`);
                await CacheUtils.del('i18n-metadata', `rtl-${languageCode}`);
                await CacheUtils.del('i18n-metadata', `info-${languageCode}`);
                consoleLog('info', `Cleared cache for language: ${languageCode}`);
            } else {
                // Clear all language caches
                await CacheUtils.clear('i18n-languages');
                await CacheUtils.clear('i18n-metadata');
                consoleLog('info', 'Cleared all language caches');
            }
        } catch (error) {
            consoleLog('error', 'Failed to clear language cache', { error, languageCode });
        }
    }
}

// Create singleton instance
const i18n = new I18n();

/**
 * Global translation function
 * @param {string} key Translation key
 * @param {Object} variables Variables for interpolation
 * @param {string} languageCode Language code
 * @returns {Promise<string>} Translated string
 */
export async function __(key, variables = {}, languageCode = 'en') {
    return await i18n.translate(key, variables, languageCode);
}

/**
 * Global pluralization function
 * @param {string} key Translation key
 * @param {number} count Count for pluralization
 * @param {Object} variables Variables for interpolation
 * @param {string} languageCode Language code
 * @returns {Promise<string>} Translated string
 */
export async function __n(key, count, variables = {}, languageCode = 'en') {
    return await i18n.translatePlural(key, count, variables, languageCode);
}

export default i18n;