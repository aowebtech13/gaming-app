import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { consoleLog } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

/**
 * Read version from .version file
 * @returns {string} Version string or fallback
 */
export const getVersion = () => {
    try {
        const versionPath = path.join(rootDir, '.version');
        
        if (fs.existsSync(versionPath)) {
            const version = fs.readFileSync(versionPath, 'utf8').trim();
            return version || '1.0';
        }
        
        return '1.0';
    } catch (error) {
        consoleLog('warn', 'Failed to read version file', { error: error.message });
        return '1.0';
    }
};

/**
 * Get detailed version information
 * @returns {Object} Version details
 */
export const getVersionInfo = () => {
    try {
        const version = getVersion();
        return {
            version,
            fullVersion: `v${version}`,
            name: 'Arcade'
        };
    } catch (error) {
        consoleLog('warn', 'Failed to get version info', { error: error.message });
        return {
            version: '1.0',
            fullVersion: 'v1.0',
            name: 'Arcade'
        };
    }
};

export default {
    getVersion,
    getVersionInfo
};