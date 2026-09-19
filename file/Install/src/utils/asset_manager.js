import fs from 'fs';
import path from 'path';
import { consoleLog } from './logger.js';

/**
 * Asset Management Utility
 * Handles cleanup of game assets when games are deleted or updated
 */

/**
 * Deletes all assets associated with a game
 * @param {Object} gameData - Game data object containing asset paths
 * @returns {Promise<boolean>} Success status
 */
export async function deleteGameAssets(gameData) {
    try {
        const assetsDeleted = [];
        
        // Delete game thumbnail/image assets
        if (gameData.thumbnail) {
            const thumbnailDeleted = await deleteImageAssets(gameData.thumbnail, gameData.slug);
            if (thumbnailDeleted) {
                assetsDeleted.push('thumbnails');
            }
        }
        
        // Delete game file assets
        if (gameData.game_file) {
            const gameFileDeleted = await deleteGameFileAssets(gameData.game_file, gameData.game_type);
            if (gameFileDeleted) {
                assetsDeleted.push('game files');
            }
        }
        
        consoleLog('info', 'Game assets deleted successfully', {
            gameId: gameData.id,
            gameSlug: gameData.slug,
            assetsDeleted: assetsDeleted
        });
        
        return true;
    } catch (error) {
        consoleLog('error', 'Failed to delete game assets', {
            gameId: gameData.id,
            gameSlug: gameData.slug,
            error: error.message
        });
        return false;
    }
}

/**
 * Deletes image assets (thumbnails) for a game
 * @param {string} thumbnailData - JSON string containing image paths
 * @param {string} gameSlug - Game slug for directory identification
 * @returns {Promise<boolean>} Success status
 */
export async function deleteImageAssets(thumbnailData, gameSlug) {
    try {
        if (!thumbnailData) return true;
        
        const imageData = JSON.parse(thumbnailData);
        const deletedFiles = [];
        
        // Delete WebP versions (all sizes)
        if (imageData.webp) {
            for (const [sizeKey, sizeData] of Object.entries(imageData.webp)) {
                if (sizeData && sizeData.relativePath) {
                    const webpPath = path.join(process.cwd(), sizeData.relativePath);
                    if (fs.existsSync(webpPath)) {
                        fs.unlinkSync(webpPath);
                        deletedFiles.push(webpPath);
                        consoleLog('info', 'Deleted WebP image', { 
                            path: webpPath,
                            size: sizeKey 
                        });
                    }
                }
            }
        }
        
        // Delete original versions (all sizes)
        if (imageData.original) {
            for (const [sizeKey, sizeData] of Object.entries(imageData.original)) {
                if (sizeData && sizeData.relativePath) {
                    const originalPath = path.join(process.cwd(), sizeData.relativePath);
                    if (fs.existsSync(originalPath)) {
                        fs.unlinkSync(originalPath);
                        deletedFiles.push(originalPath);
                        consoleLog('info', 'Deleted original image', { 
                            path: originalPath,
                            size: sizeKey 
                        });
                    }
                }
            }
        }
        
        // Delete game-specific image directory if empty
        const gameImageDir = path.join(process.cwd(), 'uploads', 'images', 'games', gameSlug);
        if (fs.existsSync(gameImageDir)) {
            const files = fs.readdirSync(gameImageDir);
            if (files.length === 0) {
                fs.rmdirSync(gameImageDir);
                consoleLog('info', 'Deleted empty game image directory', { path: gameImageDir });
            }
        }
        
        consoleLog('info', 'Successfully deleted image assets', {
            gameSlug,
            deletedFiles: deletedFiles.length,
            files: deletedFiles
        });
        
        return true;
    } catch (error) {
        consoleLog('error', 'Failed to delete image assets', {
            thumbnailData,
            gameSlug,
            error: error.message
        });
        return false;
    }
}

/**
 * Deletes game file assets based on game type
 * @param {string} gameFilePath - Path to game file
 * @param {string} gameType - Type of game (html, flash, rom, embed)
 * @returns {Promise<boolean>} Success status
 */
export async function deleteGameFileAssets(gameFilePath, gameType) {
    try {
        if (!gameFilePath || gameType === 'embed') return true;
        
        const fullPath = path.join(process.cwd(), gameFilePath);
        
        if (gameType === 'html') {
            // For HTML5 games, delete the entire directory
            if (fs.existsSync(fullPath)) {
                const stats = fs.statSync(fullPath);
                if (stats.isDirectory()) {
                    // Delete directory recursively
                    fs.rmSync(fullPath, { recursive: true, force: true });
                    consoleLog('info', 'Deleted HTML5 game directory', { path: fullPath });
                } else {
                    // Delete single file
                    fs.unlinkSync(fullPath);
                    consoleLog('info', 'Deleted HTML5 game file', { path: fullPath });
                }
            }
        } else if (gameType === 'flash') {
            // For Flash games, delete the SWF file
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
                consoleLog('info', 'Deleted Flash game file', { path: fullPath });
            }
        } else if (gameType === 'rom') {
            // For ROM games, delete the ROM file
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
                consoleLog('info', 'Deleted ROM game file', { path: fullPath });
                
                // Check if ROM system directory is empty and delete if so
                const romDir = path.dirname(fullPath);
                const romSystemDir = path.basename(romDir);
                
                if (fs.existsSync(romDir)) {
                    const files = fs.readdirSync(romDir);
                    if (files.length === 0) {
                        fs.rmdirSync(romDir);
                        consoleLog('info', 'Deleted empty ROM system directory', { 
                            path: romDir,
                            romSystem: romSystemDir 
                        });
                    }
                }
            }
        }
        
        return true;
    } catch (error) {
        consoleLog('error', 'Failed to delete game file assets', {
            gameFilePath,
            gameType,
            error: error.message
        });
        return false;
    }
}

/**
 * Deletes old assets when a game is updated with new files
 * @param {Object} oldGameData - Previous game data
 * @param {Object} newGameData - New game data
 * @returns {Promise<boolean>} Success status
 */
export async function deleteOldAssets(oldGameData, newGameData) {
    try {
        let assetsDeleted = [];
        
        // Delete old thumbnail if a new one is uploaded
        // Check if thumbnail data exists in update (indicates new upload)
        if (newGameData.thumbnail && oldGameData.thumbnail) {
            const thumbnailDeleted = await deleteImageAssets(oldGameData.thumbnail, oldGameData.slug);
            if (thumbnailDeleted) {
                assetsDeleted.push('old thumbnails');
            }
        }
        
        // Delete old game file if a new one is uploaded
        if (newGameData.game_file && oldGameData.game_file && oldGameData.game_file !== newGameData.game_file) {
            const gameFileDeleted = await deleteGameFileAssets(oldGameData.game_file, oldGameData.game_type);
            if (gameFileDeleted) {
                assetsDeleted.push('old game files');
            }
        }
        
        if (assetsDeleted.length > 0) {
            consoleLog('info', 'Old game assets deleted during update', {
                gameId: oldGameData.id,
                gameSlug: oldGameData.slug,
                assetsDeleted: assetsDeleted
            });
        }
        
        return true;
    } catch (error) {
        consoleLog('error', 'Failed to delete old assets during update', {
            gameId: oldGameData.id,
            gameSlug: oldGameData.slug,
            error: error.message
        });
        return false;
    }
}

/**
 * Cleans up temporary files and directories
 * @param {string} tempPath - Path to temporary file or directory
 * @returns {Promise<boolean>} Success status
 */
export async function cleanupTempAssets(tempPath) {
    try {
        if (!tempPath || !fs.existsSync(tempPath)) return true;
        
        const stats = fs.statSync(tempPath);
        if (stats.isDirectory()) {
            fs.rmSync(tempPath, { recursive: true, force: true });
            consoleLog('info', 'Cleaned up temporary directory', { path: tempPath });
        } else {
            fs.unlinkSync(tempPath);
            consoleLog('info', 'Cleaned up temporary file', { path: tempPath });
        }
        
        return true;
    } catch (error) {
        consoleLog('error', 'Failed to cleanup temporary assets', {
            tempPath,
            error: error.message
        });
        return false;
    }
}

export default {
    deleteGameAssets,
    deleteImageAssets,
    deleteGameFileAssets,
    deleteOldAssets,
    cleanupTempAssets
};