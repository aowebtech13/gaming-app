import axios from 'axios';
import fs from 'fs';
import path from 'path';
import unzipper from 'unzipper';
import { detectRomSystem, detectRomSystemFromZipBuffer } from './rom.js';
import ImageProcessor from './image_processor.js';
import { getCategoryByName } from '../models/categories.js';
import { consoleLog } from './logger.js';
import { create } from '../models/crud.js';
import { generateUniqueSlug } from './sanitize.js';
import CacheUtils from './cache.js';

// Cache for available icons to avoid repeated filesystem calls
let availableIconsCache = null;

/**
 * Gets list of available heroicons from the filesystem
 * @returns {Promise<string[]>} Array of available icon names (without .svg extension)
 */
async function getAvailableHeroicons() {
    if (availableIconsCache !== null) {
        return availableIconsCache;
    }
    
    try {
        const heroiconsDir = path.join(process.cwd(), 'public', 'assets', 'images', 'heroicons');
        
        if (!fs.existsSync(heroiconsDir)) {
            consoleLog('warn', 'Heroicons directory not found', { path: heroiconsDir });
            availableIconsCache = [];
            return availableIconsCache;
        }
        
        const files = fs.readdirSync(heroiconsDir);
        const iconNames = files
            .filter(file => file.endsWith('.svg'))
            .map(file => file.replace('.svg', ''));
        
        availableIconsCache = iconNames;
        consoleLog('info', 'Loaded available heroicons', { count: iconNames.length });
        
        return availableIconsCache;
    } catch (error) {
        consoleLog('error', 'Failed to load available heroicons', { error: error.message });
        availableIconsCache = [];
        return availableIconsCache;
    }
}

/**
 * Checks if a specific heroicon exists
 * @param {string} iconName - Icon name (without .svg extension)
 * @returns {Promise<boolean>} Whether the icon exists
 */
async function isHeroiconAvailable(iconName) {
    if (!iconName) return false;
    
    const availableIcons = await getAvailableHeroicons();
    return availableIcons.includes(iconName);
}

/**
 * Gets a valid heroicon name, falling back to default if the requested one doesn't exist
 * @param {string} requestedIcon - The requested icon name
 * @param {string} defaultIcon - Default icon to use if requested doesn't exist (default: 'squares-2x2')
 * @returns {Promise<string>} Valid icon name
 */
async function getValidHeroicon(requestedIcon, defaultIcon = 'squares-2x2') {
    if (!requestedIcon) {
        return defaultIcon;
    }
    
    const iconExists = await isHeroiconAvailable(requestedIcon);
    
    if (iconExists) {
        return requestedIcon;
    }
    
    // Check if default icon exists, if not use a guaranteed fallback
    const defaultExists = await isHeroiconAvailable(defaultIcon);
    if (defaultExists) {
        consoleLog('warn', 'Requested icon not found, using default', { 
            requestedIcon, 
            defaultIcon 
        });
        return defaultIcon;
    }
    
    // Last resort - use 'heart' as it's a common icon
    const heartExists = await isHeroiconAvailable('heart');
    if (heartExists) {
        consoleLog('warn', 'Default icon not found, using heart', { 
            requestedIcon, 
            defaultIcon 
        });
        return 'heart';
    }
    
    // If even heart doesn't exist, just return the default and let the UI handle it
    consoleLog('error', 'No valid heroicon found, returning default anyway', { 
        requestedIcon, 
        defaultIcon 
    });
    return defaultIcon;
}

/**
 * Gets appropriate heroicon based on category name
 * @param {string} categoryName - Category name to get icon for
 * @returns {Promise<string>} Appropriate icon name
 */
async function getIconForCategory(categoryName) {
    if (!categoryName) {
        return await getValidHeroicon('squares-2x2');
    }
    
    // Category to icon mapping
    const categoryIconMap = {
        // Game genres
        'action': 'bolt',
        'adventure': 'map',
        'puzzle': 'puzzle-piece',
        'racing': 'truck',
        'driving': 'truck',
        'sports': 'trophy',
        'fighting': 'hand-raised',
        'shooting': 'viewfinder-circle',
        'rpg': 'user-group',
        'strategy': 'squares-2x2',
        'simulation': 'computer-desktop',
        'arcade': 'rocket-launch',
        'platform': 'arrow-up',
        'platformer': 'arrow-up',
        'educational': 'academic-cap',
        'music': 'musical-note',
        'card': 'rectangle-group',
        'board': 'table-cells',
        'trivia': 'question-mark-circle',
        'word': 'chat-bubble-left',
        'math': 'calculator',
        'memory': 'light-bulb',
        'skill': 'star',
        'casual': 'heart',
        'multiplayer': 'users',
        'horror': 'exclamation-triangle',
        'sci-fi': 'rocket-launch',
        'fantasy': 'sparkles',
        'retro': 'tv',
        'classic': 'squares-2x2',
        // Common variations
        'action-adventure': 'bolt',
        'role-playing': 'user-group',
        'first-person-shooter': 'viewfinder-circle',
        'real-time-strategy': 'squares-2x2'
    };
    
    // Try to find a match by category name (case insensitive)
    const categoryKey = categoryName.toLowerCase().replace(/[^a-z0-9]/g, '');
    let iconName = null;
    
    // Direct match
    if (categoryIconMap[categoryKey]) {
        iconName = categoryIconMap[categoryKey];
    } else {
        // Partial match
        for (const [key, value] of Object.entries(categoryIconMap)) {
            if (categoryKey.includes(key) || key.includes(categoryKey)) {
                iconName = value;
                break;
            }
        }
    }
    
    // If no mapping found, use default
    if (!iconName) {
        iconName = 'squares-2x2';
    }
    
    // Validate the icon exists
    return await getValidHeroicon(iconName);
}

/**
 * Maps API category to local category ID, creating the category if it doesn't exist
 * @param {string} apiCategory - Category from API
 * @returns {Promise<number>} Local category ID
 */
export async function mapApiCategoryToLocal(apiCategory) {
    if (!apiCategory) return 1; // Default category
    
    // Create a mapping object for common categories
    const categoryMap = {
        'Action': 'Action',
        'Adventure': 'Adventure', 
        'RPG': 'RPG',
        'Strategy': 'Strategy',
        'Sports': 'Sports',
        'Platform': 'Platform',
        'Puzzle': 'Puzzle',
        'Racing': 'Racing',
        'Shooter': 'Shooter',
        'Simulation': 'Simulation',
        'Fighting': 'Fighting',
        'Action-Adventure': 'Action',
        'Action Adventure': 'Action'
    };
    
    const mappedCategory = categoryMap[apiCategory] || apiCategory;
    
    try {
        // Try to find exact match using model
        let category = await getCategoryByName(mappedCategory);
        if (category) {
            return category.id;
        }
        
        // If no exact match, try to find by original API category name
        if (mappedCategory !== apiCategory) {
            category = await getCategoryByName(apiCategory);
            if (category) {
                return category.id;
            }
        }
        
        // If category doesn't exist, create it
        const newCategoryId = await createCategory(mappedCategory);
        if (newCategoryId) {
            consoleLog('info', 'Created new category during import', { 
                categoryName: mappedCategory, 
                categoryId: newCategoryId,
                originalApiCategory: apiCategory
            });
            return newCategoryId;
        }
        
        // Default to first category if creation fails
        return 1;
    } catch (error) {
        consoleLog('error', 'Category mapping error', { error: error.message });
        return 1; // Default category
    }
}

/**
 * Creates a new category with default values
 * @param {string} categoryName - Name of the category to create
 * @returns {Promise<number|null>} Created category ID or null if failed
 */
async function createCategory(categoryName) {
    try {
        // Generate unique slug for the category
        const categorySlug = await generateUniqueSlug(categoryName, 'categories');
        
        // Default colors for auto-created categories
        const defaultColors = [
            '#3B82F6', // Blue
            '#10B981', // Green
            '#F59E0B', // Yellow
            '#EF4444', // Red
            '#8B5CF6', // Purple
            '#06B6D4', // Cyan
            '#F97316', // Orange
            '#84CC16', // Lime
            '#EC4899', // Pink
            '#6B7280'  // Gray
        ];
        
        // Get a random color from the default colors
        const randomColor = defaultColors[Math.floor(Math.random() * defaultColors.length)];
        
        // Get appropriate icon for the category
        const iconName = await getIconForCategory(categoryName);
        
        // Create category with default values
        const categoryData = {
            name: categoryName,
            slug: categorySlug,
            description: `Auto-created category for ${categoryName} games`,
            color: randomColor,
            icon: iconName,
            is_active: 1,
            sort_order: 0
        };
        
        const categoryId = await create('categories', categoryData);
        
        if (categoryId) {
            // Invalidate category-related caches
            await CacheUtils.invalidateCache('sidebar-categories');
            await CacheUtils.invalidateCache('random-categories');
            
            consoleLog('info', 'Successfully created new category', {
                categoryName,
                categoryId,
                slug: categorySlug,
                color: randomColor,
                icon: iconName
            });
            return categoryId;
        }
        
        return null;
    } catch (error) {
        consoleLog('error', 'Failed to create category', {
            categoryName,
            error: error.message
        });
        return null;
    }
}

/**
 * Downloads and processes thumbnail from API
 * @param {string} thumbnailUrl - URL of thumbnail
 * @param {string} gameSlug - Game slug for filename
 * @returns {Promise<string>} Processed thumbnail data
 */
export async function downloadAndProcessThumbnail(thumbnailUrl, gameSlug) {
    try {
        const response = await axios.get(thumbnailUrl, {
            responseType: 'arraybuffer',
            timeout: 30000 // 30 seconds
        });
        
        const buffer = Buffer.from(response.data);
        const uploadsDir = path.join(process.cwd(), 'uploads', 'images', 'games');
        
        // Use existing image processor
        const processedImages = await ImageProcessor.processImage(
            buffer,
            `${gameSlug}_thumbnail.jpg`,
            'games',
            uploadsDir,
            gameSlug
        );
        
        // Return JSON string for database storage
        return JSON.stringify({
            webp: processedImages.webp,
            original: processedImages.original,
            metadata: processedImages.metadata
        });
    } catch (error) {
        consoleLog('warn', 'Thumbnail download failed', { error: error.message });
        return null; // Continue without thumbnail
    }
}

/**
 * Downloads and processes game file from API
 * NOTE: ALL API game files are ZIP files that need extraction
 * @param {string} gameFileUrl - URL of game file (always a ZIP)
 * @param {string} gameSlug - Game slug for filename
 * @param {string} gameType - Type of game (rom, html, flash)
 * @param {string} romType - ROM type (if applicable)
 * @returns {Promise<string>} Processed game file path
 */
export async function downloadAndProcessGameFile(gameFileUrl, gameSlug, gameType, romType) {
    try {
        const response = await axios.get(gameFileUrl, {
            responseType: 'arraybuffer',
            timeout: 300000 // 300 seconds for game files
        });
        
        const buffer = Buffer.from(response.data);
        const gameUploadsDir = path.join(process.cwd(), 'uploads', 'games');
        
        // Ensure directory exists
        if (!fs.existsSync(gameUploadsDir)) {
            fs.mkdirSync(gameUploadsDir, { recursive: true });
        }
        
        // All API files are ZIP files - extract them first
        const tempZipPath = path.join(gameUploadsDir, `temp_${gameSlug}_${Date.now()}.zip`);
        const tempExtractDir = path.join(gameUploadsDir, `temp_extract_${gameSlug}_${Date.now()}`);
        
        // Save ZIP file temporarily
        fs.writeFileSync(tempZipPath, buffer);
        
        // Extract ZIP file to temporary directory
        fs.mkdirSync(tempExtractDir, { recursive: true });
        await new Promise((resolve, reject) => {
            unzipper.Open.buffer(buffer)
                .then(directory => directory.extract({ path: tempExtractDir }))
                .then(() => resolve())
                .catch(reject);
        });
        
        // Clean up temporary ZIP file
        fs.unlinkSync(tempZipPath);
        
        let relativePath;
        
        if (gameType === 'html') {
            // For HTML5 games, extract to directory (same as built-in system)
            const gameDir = path.join(gameUploadsDir, `${gameSlug}_${Date.now()}`);
            
            // Move extracted content to final location
            fs.renameSync(tempExtractDir, gameDir);
            
            // Always point to index.html (same as built-in system)
            relativePath = `uploads/games/${path.basename(gameDir)}/index.html`;
        } else if (gameType === 'flash') {
            // For Flash games, find SWF file in extracted content
            const swfFile = findFileInDir(tempExtractDir, '.swf');
            if (!swfFile) {
                throw new Error('No SWF file found in the ZIP archive');
            }
            
            // Store directly in games directory (same as built-in system)
            const fileName = `game_${gameSlug}_${Date.now()}.swf`;
            const filePath = path.join(gameUploadsDir, fileName);
            
            // Copy SWF file to final location
            fs.copyFileSync(swfFile, filePath);
            relativePath = `uploads/games/${fileName}`;
            
            // Clean up temporary extraction directory
            fs.rmSync(tempExtractDir, { recursive: true, force: true });
        } else if (gameType === 'rom') {
            // For ROM games, detect system from ZIP buffer and store ZIP as-is
            // This follows the original implementation that doesn't extract ROM ZIP files
            const detectedRomSystem = await detectRomSystemFromZipBuffer(buffer);
            const finalRomSystem = romType || detectedRomSystem;
            
            const romSystemDir = path.join(gameUploadsDir, 'roms', finalRomSystem);
            if (!fs.existsSync(romSystemDir)) {
                fs.mkdirSync(romSystemDir, { recursive: true });
            }
            
            // Store the ZIP file as-is (following original implementation)
            const fileName = `game_${gameSlug}_${Date.now()}.zip`;
            const filePath = path.join(romSystemDir, fileName);
            fs.writeFileSync(filePath, buffer);
            relativePath = `uploads/games/roms/${finalRomSystem}/${fileName}`;
            
            // Clean up temporary extraction directory (not needed for ROM)
            fs.rmSync(tempExtractDir, { recursive: true, force: true });
        } else {
            // Clean up temporary extraction directory
            fs.rmSync(tempExtractDir, { recursive: true, force: true });
            throw new Error(`Unsupported game type: ${gameType}`);
        }
        
        return relativePath;
    } catch (error) {
        consoleLog('error', 'Game file download failed', { error: error.message });
        throw new Error(`Failed to download game file: ${error.message}`);
    }
}

/**
 * Helper function to find first file with specific extension in directory
 * @param {string} dir - Directory to search
 * @param {string} extension - File extension to look for
 * @returns {string|null} Full path to found file or null
 */
function findFileInDir(dir, extension) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
        const filePath = path.join(dir, file.name);
        
        if (file.isFile() && file.name.toLowerCase().endsWith(extension.toLowerCase())) {
            return filePath;
        } else if (file.isDirectory()) {
            const found = findFileInDir(filePath, extension);
            if (found) return found;
        }
    }
    
    return null;
}

/**
 * Helper function to find first file with any of the specified extensions
 * @param {string} dir - Directory to search
 * @param {string[]} extensions - Array of file extensions to look for
 * @returns {string|null} Full path to found file or null
 */
function findFileInDirByExtensions(dir, extensions) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
        const filePath = path.join(dir, file.name);
        
        if (file.isFile()) {
            const fileExtension = path.extname(file.name).toLowerCase();
            if (extensions.includes(fileExtension)) {
                return filePath;
            }
        } else if (file.isDirectory()) {
            const found = findFileInDirByExtensions(filePath, extensions);
            if (found) return found;
        }
    }
    
    return null;
}