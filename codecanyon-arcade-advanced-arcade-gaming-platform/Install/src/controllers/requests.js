import php from "locutus/php/index.js";
import response from "../utils/response.js";
import i18n from '../utils/i18n.js';
import { consoleLog } from "../utils/logger.js";
import ImageProcessor from "../utils/image_processor.js";
import fs from "fs";
import path from "path";
import unzipper from 'unzipper';
import { detectRomSystem } from '../utils/rom.js';
import {
    sanitizeRequestBody,
    generateUniqueSlug,
} from "../utils/sanitize.js";
import {
    create,
    update,
    remove
} from "../models/crud.js";
import {
    getUserById,
    autoVerifyAllUsers,
    updateUserProfile
} from "../models/users.js";
import { getUserAvatarUrl } from "../utils/gravatar.js";
import {
    invalidatePageCache
} from "../models/pages.js";
import bcrypt from 'bcrypt';
import {
    getGameById,
    getGameBySlug,
    searchGames,
    getSearchCount,
    trackSearchQuery,
    getGameByImportId
} from "../models/games.js";
import scoreAPI from "../utils/score.js";
import {
    getCategoryById,
    getCategoryByName
} from "../models/categories.js";
import {
    getFavoriteById,
    checkIfFavorite,
    addFavorite,
    removeFavorite
} from "../models/favorites.js";
import {
    getTopUsersByExp,
    getWeeklyTopUsersByExp,
    getMonthlyTopUsersByExp
} from "../models/exp.js";
import {
    followUser,
    unfollowUser,
    isFollowing,
    getFollowById
} from "../models/follows.js";
import {
    getUserByUsername
} from "../models/users.js";
import {
    notifyUserFollowed,
    notifyUserUnfollowed
} from "../utils/websocket.js";
import {
    awardGameRatingExp,
    awardGameCommentExp,
    awardFollowUserExp
} from "../utils/exp.js";
import {
    setRating,
    getRating,
    getGameRatingStats,
    getRatingByIP,
    setRatingByIP,
    extractIPAddress,
    hasUserRated
} from "../models/ratings.js";
import {
    createComment,
    deleteComment,
    getCommentsByGameId,
    getCommentCountByGameId,
    getCommentById
} from "../models/comments.js";
import {
    upsertSetting,
    clearCache,
    getSetting
} from "../models/settings.js";
import {
    validateTemplate,
    getTemplateMetadata
} from "../utils/templates.js";
import {
    getPageById
} from "../models/pages.js";
import {
    getExpRankById
} from "../models/exp_ranks.js";
import {
    getExpEventById
} from "../models/exp_events.js";
import {
    getLevelTitle,
    getExpProgress,
    getExpForNextLevel
} from "../utils/exp.js";
import {
    getExpRankByLevel
} from "../models/exp_ranks.js";
import CacheUtils from '../utils/cache.js';
import axios from 'axios';
import {
    mapApiCategoryToLocal,
    downloadAndProcessThumbnail,
    downloadAndProcessGameFile
} from '../utils/importer.js';
import {
    deleteGameAssets,
    deleteOldAssets
} from '../utils/asset_manager.js';
import {
    createPlacement,
    updatePlacement,
    deletePlacement,
    getAllPlacements
} from '../models/ad_placements.js';
import {
    createAd,
    updateAd,
    deleteAd,
    getAdForGameContext,
    getRandomAdForPlacementSlug,
    getAdStats
} from '../models/ads.js';

// Initialize caches
CacheUtils.initCache('sidebar-categories', 7 * 24 * 60 * 60 * 1000); // 7 days
CacheUtils.initCache('homepage-games', 30 * 60 * 1000); // 30 minutes
CacheUtils.initCache('leaderboard-data', 5 * 60 * 1000); // 5 minutes for leaderboard

// Helper functions for data validation and parsing
const validateAndParseInt = (value, defaultValue = 0) => {
    if (value === null || value === undefined) return defaultValue;
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : Math.max(0, parsed);
};

const validateAndParseFloat = (value, defaultValue = 0) => {
    if (value === null || value === undefined) return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : Math.max(0, Math.round(parsed * 100) / 100);
};

const validateAndParseBigInt = (value, defaultValue = 0) => {
    if (value === null || value === undefined) return defaultValue;
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : Math.max(0, parsed);
};

const createRequest = async (req, res) => {
    const {
        tpl
    } = req.params;

    // Exclude content field from sanitization for pages to preserve HTML formatting
    // Exclude ad code fields from sanitization for ads to preserve HTML content
    const excludeFields = tpl === 'pages' ? ['content'] :
        tpl === 'ads' ? ['ad_code', 'fallback_ad_code'] : [];
    const request = sanitizeRequestBody(req.body, excludeFields);
    const files = req.files;

    switch (tpl) {
        case "users":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            if (!php.var.isset(request.username, request.email, request.password_hash)) {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            // Hash password before storing
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(request.password_hash, saltRounds);

            const doCreateUser = await create("users", {
                username: request.username,
                email: request.email,
                password: hashedPassword,
                first_name: request.first_name || null,
                last_name: request.last_name || null,
                country: request.country || null,
                date_of_birth: request.date_of_birth || null,
                bio: request.bio || null,
                user_type: request.user_type || 'user',
                is_active: request.is_active || 1,
                is_verified: request.is_verified || 0
            });

            if (doCreateUser) {
                return response(res, 200, i18n.translateSync('api.requests.user_created', {}, req.language?.current || 'en'));
            }

            break;
        case "games":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            if (!php.var.isset(request.title, request.category_id, request.game_type)) {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            // Generate unique slug if not provided
            const gameSlug = request.slug && request.slug.trim()
                ? await generateUniqueSlug(request.slug, 'games')
                : await generateUniqueSlug(request.title, 'games');

            // Validate and process files before creating database record
            let thumbnailPath = null;
            let gameFilePath = null;
            let tempGameDir = null;

            if (files && files.length > 0) {
                // Validate game image
                const gameImageFile = files.find(file => file.fieldname === 'game_image');
                if (gameImageFile) {
                    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
                    if (!allowedImageTypes.includes(gameImageFile.mimetype)) {
                        return response(res, 500, i18n.translateSync('api.requests.invalid_image_type', {}, req.language?.current || 'en'));
                    }
                }

                // Validate and process game file
                const gameFile = files.find(file => file.fieldname === 'game_file');
                if (gameFile && request.game_type !== 'embed') {
                    if (request.game_type === 'html' && path.extname(gameFile.originalname).toLowerCase() === '.zip') {
                        // Validate HTML5 zip file
                        try {
                            const zipBuffer = gameFile.buffer;
                            await new Promise((resolve, reject) => {
                                unzipper.Open.buffer(zipBuffer)
                                    .then(directory => {
                                        // Check if index.html exists in zip
                                        const hasIndex = directory.files.some(file =>
                                            file.path.toLowerCase() === 'index.html' ||
                                            file.path.toLowerCase().endsWith('/index.html')
                                        );

                                        if (!hasIndex) {
                                            reject(new Error('HTML5 game zip file must contain an index.html file'));
                                            return;
                                        }
                                        resolve();
                                    })
                                    .catch(reject);
                            });
                        } catch (error) {
                            return response(res, 500, error.message || "Invalid HTML5 game zip file");
                        }
                    } else if (request.game_type === 'flash' && path.extname(gameFile.originalname).toLowerCase() === '.swf') {
                        // Flash file validation passed
                    } else if (request.game_type === 'rom') {
                        // ROM file validation
                        const allowedRomExtensions = ['.nes', '.snes', '.sfc', '.gba', '.gb', '.gbc', '.md', '.gen', '.smd', '.n64', '.z64', '.v64', '.bin', '.cue', '.iso', '.zip'];
                        const fileExtension = path.extname(gameFile.originalname).toLowerCase();
                        if (!allowedRomExtensions.includes(fileExtension)) {
                            return response(res, 500, i18n.translateSync('api.requests.invalid_rom_format', { formats: allowedRomExtensions.join(', ') }, req.language?.current || 'en'));
                        }
                    } else {
                        return response(res, 500, i18n.translateSync('api.requests.invalid_game_file_type', {}, req.language?.current || 'en'));
                    }
                }
            }

            // Handle ROM system detection
            let romSystem = null;
            if (request.game_type === 'rom') {
                if (request.rom_system === 'automatic') {
                    // Auto-detect ROM system from uploaded file
                    const gameFile = files.find(file => file.fieldname === 'game_file');
                    if (gameFile) {
                        const fileData = gameFile.path || gameFile.buffer;
                        romSystem = await detectRomSystem(gameFile.originalname, fileData);
                    } else {
                        romSystem = 'unknown';
                    }
                } else {
                    romSystem = request.rom_system;
                }
            }

            const gameData = {
                title: request.title,
                slug: gameSlug,
                description: request.description || null,
                short_description: request.short_description || null,
                category_id: request.category_id,
                game_type: request.game_type,
                rom_system: romSystem,
                width: request.width || 800,
                height: request.height || 600,
                controls: request.controls || null,
                tags: request.tags || null,
                is_featured: request.is_featured || 0,
                is_active: request.is_active || 1,
                sort_order: request.sort_order || 0,
                api_enabled: request.api_enabled || 0
            };

            if (request.game_type === 'embed') {
                gameData.embed_url = request.embed_url;
            }

            // Create game record first
            const doCreateGame = await create("games", gameData);

            if (doCreateGame) {
                try {
                    // Process files after successful database creation
                    if (files && files.length > 0) {
                        // Handle game image upload with optimization
                        const gameImageFile = files.find(file => file.fieldname === 'game_image');
                        if (gameImageFile) {
                            const uploadsDir = path.join(process.cwd(), 'uploads', 'images', 'games');

                            try {
                                // Process image with multiple sizes and WebP conversion
                                const processedImages = await ImageProcessor.processImage(
                                    gameImageFile.buffer,
                                    gameImageFile.originalname,
                                    'games',
                                    uploadsDir,
                                    gameSlug
                                );

                                // Store processed image data as JSON for database
                                thumbnailPath = JSON.stringify({
                                    webp: processedImages.webp,
                                    original: processedImages.original,
                                    metadata: processedImages.metadata
                                });
                            } catch (error) {
                                consoleLog('error', 'Failed to process game image', { error: error.message });
                                // Fallback to original processing method
                                const uploadsDir = path.join(process.cwd(), 'uploads', 'images', 'games');
                                if (!fs.existsSync(uploadsDir)) {
                                    fs.mkdirSync(uploadsDir, { recursive: true });
                                }

                                const fileExtension = path.extname(gameImageFile.originalname);
                                const fileName = `game_${gameSlug}_${Date.now()}${fileExtension}`;
                                const filePath = path.join(uploadsDir, fileName);

                                fs.writeFileSync(filePath, gameImageFile.buffer);
                                thumbnailPath = `uploads/images/games/${fileName}`;
                            }
                        }

                        // Handle game file upload
                        const gameFile = files.find(file => file.fieldname === 'game_file');
                        if (gameFile && request.game_type !== 'embed') {
                            const gameUploadsDir = path.join(process.cwd(), 'uploads', 'games');

                            // Ensure directory exists
                            if (!fs.existsSync(gameUploadsDir)) {
                                fs.mkdirSync(gameUploadsDir, { recursive: true });
                            }

                            if (request.game_type === 'html') {
                                // Handle HTML5 zip file - extract to folder
                                const gameDir = path.join(gameUploadsDir, `${request.slug}_${Date.now()}`);
                                tempGameDir = gameDir;

                                fs.mkdirSync(gameDir, { recursive: true });

                                // Extract zip file
                                const zipBuffer = gameFile.buffer;
                                await new Promise((resolve, reject) => {
                                    unzipper.Open.buffer(zipBuffer)
                                        .then(directory => directory.extract({ path: gameDir }))
                                        .then(() => resolve())
                                        .catch(reject);
                                });

                                gameFilePath = `uploads/games/${path.basename(gameDir)}/index.html`;
                            } else if (request.game_type === 'flash') {
                                // Handle Flash SWF file
                                const fileName = `game_${request.slug}_${Date.now()}.swf`;
                                const filePath = path.join(gameUploadsDir, fileName);

                                fs.writeFileSync(filePath, gameFile.buffer);
                                gameFilePath = `uploads/games/${fileName}`;
                            } else if (request.game_type === 'rom') {
                                // Handle ROM file
                                const fileExtension = path.extname(gameFile.originalname);
                                const fileName = `game_${request.slug}_${Date.now()}${fileExtension}`;

                                // Create ROM system directory if it doesn't exist
                                const romSystemDir = path.join(gameUploadsDir, 'roms', romSystem || 'unknown');
                                if (!fs.existsSync(romSystemDir)) {
                                    fs.mkdirSync(romSystemDir, { recursive: true });
                                }

                                const filePath = path.join(romSystemDir, fileName);
                                fs.writeFileSync(filePath, gameFile.buffer);
                                gameFilePath = `uploads/games/roms/${romSystem || 'unknown'}/${fileName}`;
                            }
                        }
                    }

                    // Update game record with file paths
                    const updateData = {};
                    if (thumbnailPath) updateData.thumbnail = thumbnailPath;
                    if (gameFilePath) updateData.game_file = gameFilePath;

                    if (Object.keys(updateData).length > 0) {
                        await update(doCreateGame, false, "games", updateData);
                    }

                    // Clear all game-related caches when game is created
                    await CacheUtils.invalidateGameCaches();
                    return response(res, 200, i18n.translateSync('api.requests.game_created', {}, req.language?.current || 'en'));
                } catch (error) {
                    // Clean up on error - delete any created assets
                    if (doCreateGame) {
                        const gameToDelete = await getGameById(doCreateGame);
                        if (gameToDelete && gameToDelete[0]) {
                            await deleteGameAssets(gameToDelete[0]);
                        }
                        await remove(doCreateGame, false, "games");
                    }

                    if (tempGameDir && fs.existsSync(tempGameDir)) {
                        fs.rmSync(tempGameDir, { recursive: true, force: true });
                    }

                    return response(res, 500, i18n.translateSync('api.requests.failed_process_files', { error: error.message }, req.language?.current || 'en'));
                }
            }

            break;
        case "categories":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            if (!php.var.isset(request.name)) {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            // Generate unique slug if not provided
            const categorySlug = request.slug && request.slug.trim()
                ? await generateUniqueSlug(request.slug, 'categories')
                : await generateUniqueSlug(request.name, 'categories');

            let categoryImagePath = null;

            // Handle category image upload with optimization
            if (req.files && req.files.length > 0) {
                const imageFile = req.files.find(file => file.fieldname === 'image');

                if (imageFile) {
                    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

                    if (!allowedTypes.includes(imageFile.mimetype)) {
                        return response(res, 500, i18n.translateSync('api.requests.invalid_image_type', {}, req.language?.current || 'en'));
                    }

                    const categoryUploadsDir = path.join(process.cwd(), 'uploads', 'categories');

                    try {
                        // Process image with multiple sizes and WebP conversion
                        const processedImages = await ImageProcessor.processImage(
                            imageFile.buffer,
                            imageFile.originalname,
                            'categories',
                            categoryUploadsDir,
                            categorySlug
                        );

                        // Store processed image data as JSON for database
                        categoryImagePath = JSON.stringify({
                            webp: processedImages.webp,
                            original: processedImages.original,
                            metadata: processedImages.metadata
                        });
                    } catch (error) {
                        consoleLog('error', 'Failed to process category image', { error: error.message });
                        // Fallback to original processing method
                        if (!fs.existsSync(categoryUploadsDir)) {
                            fs.mkdirSync(categoryUploadsDir, { recursive: true });
                        }

                        const fileName = `category_${categorySlug}_${Date.now()}${path.extname(imageFile.originalname)}`;
                        const filePath = path.join(categoryUploadsDir, fileName);

                        fs.writeFileSync(filePath, imageFile.buffer);
                        categoryImagePath = `/uploads/categories/${fileName}`;
                    }
                }
            }

            const doCreateCategory = await create("categories", {
                name: request.name,
                slug: categorySlug,
                description: request.description || null,
                icon: request.icon || null,
                image: categoryImagePath,
                color: request.color || '#3B82F6',
                sort_order: request.sort_order || 0,
                is_active: request.is_active || 1
            });

            if (doCreateCategory) {
                // Clear all category-related caches when category is created
                await CacheUtils.invalidateCategoryCaches();
                return response(res, 200, i18n.translateSync('api.requests.category_created', {}, req.language?.current || 'en'));
            }

            break;
        case "pages":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            if (!php.var.isset(request.title, request.content)) {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            // Generate unique slug from manual input or title
            const pageSlug = request.slug && request.slug.trim()
                ? await generateUniqueSlug(request.slug, 'pages')
                : await generateUniqueSlug(request.title, 'pages');

            const doCreatePage = await create("pages", {
                title: request.title,
                slug: pageSlug,
                content: request.content,
                is_published: request.is_published || 0,
                created_by: res.locals.user.id
            });

            if (doCreatePage) {
                return response(res, 200, i18n.translateSync('api.requests.page_created', {}, req.language?.current || 'en'));
            }

            break;
        case "exp_ranks":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            if (!php.var.isset(request.level, request.exp_required)) {
                return response(res, 500, i18n.translateSync('api.requests.level_exp_required', {}, req.language?.current || 'en'));
            }

            const doCreateExpRank = await create("exp_ranks", {
                level: request.level,
                exp_required: request.exp_required,
                reward_title: request.reward_title || null,
                reward_description: request.reward_description || null
            });

            if (doCreateExpRank) {
                return response(res, 200, i18n.translateSync('api.requests.exp_rank_created', {}, req.language?.current || 'en'));
            }

            break;
        case "ad_placements":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            if (!php.var.isset(request.name, request.slug, request.width, request.height, request.placement_type)) {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            const doCreatePlacement = await createPlacement({
                name: request.name,
                slug: request.slug,
                description: request.description || null,
                width: parseInt(request.width),
                height: parseInt(request.height),
                placement_type: request.placement_type,
                is_active: request.is_active ? 1 : 0
            });

            if (doCreatePlacement) {
                return response(res, 200, i18n.translateSync('api.requests.ad_placement_created', {}, req.language?.current || 'en'));
            }

            break;
        case "ads":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            if (!php.var.isset(request.placement_id, request.name, request.ad_code)) {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            const doCreateAd = await createAd({
                placement_id: parseInt(request.placement_id),
                name: request.name || 'Untitled Advertisement',
                ad_code: request.ad_code,
                fallback_ad_code: request.fallback_ad_code || null,
                priority: parseInt(request.priority) || 1,
                is_active: request.is_active ? 1 : 0
            });

            if (doCreateAd) {
                // Clear ads cache when a new advertisement is created
                await CacheUtils.invalidateAdCaches();
                return response(res, 200, i18n.translateSync('api.requests.advertisement_created', {}, req.language?.current || 'en'));
            }

            break;
        case "templates":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.unauthorized', {}, req.language?.current || 'en'));
            }

            const templateFile = files && files.find(file => file.fieldname === 'template_file');
            if (!templateFile) {
                return response(res, 400, i18n.translateSync('api.requests.template_file_required', {}, req.language?.current || 'en'));
            }

            // Validate file type
            if (!templateFile.originalname.toLowerCase().endsWith('.zip')) {
                return response(res, 400, i18n.translateSync('api.requests.invalid_template_format', {}, req.language?.current || 'en'));
            }

            // File size validation (50MB limit)
            const maxSize = 50 * 1024 * 1024;
            if (templateFile.size > maxSize) {
                return response(res, 400, i18n.translateSync('api.requests.template_too_large', {}, req.language?.current || 'en'));
            }

            try {
                const zipBuffer = templateFile.buffer;
                const projectRoot = process.cwd();
                let templateName = null;
                let extractedFiles = [];
                let hasResourcesFiles = false;

                // Security function for path validation
                const isAllowedPath = (filePath) => {
                    const allowedPatterns = [
                        /^views\/[^\/\.][^\/]*\//,  // views/templatename/ (no dots, prevent hidden dirs)
                        /^public\/assets\//,         // public/assets/
                        /^resources\//               // resources/
                    ];

                    const protectedPatterns = [
                        /^views\/dashboard\//,       // Protect dashboard
                        /^views\/mail\//,           // Protect mail templates  
                        /^views\/chatroom\//        // Protect chatroom templates
                    ];

                    // Path traversal prevention
                    if (filePath.includes('../') || filePath.includes('..\\') || path.isAbsolute(filePath)) {
                        return false;
                    }

                    // Check against protected patterns first
                    if (protectedPatterns.some(pattern => pattern.test(filePath))) {
                        return false;
                    }

                    // Check against allowed patterns
                    return allowedPatterns.some(pattern => pattern.test(filePath));
                };

                // First pass: validate ZIP structure and find template name
                await new Promise((resolve, reject) => {
                    unzipper.Open.buffer(zipBuffer)
                        .then(directory => {
                            let infoJsonFound = false;
                            let fileCount = 0;
                            let totalSize = 0;

                            for (const file of directory.files) {
                                fileCount++;
                                totalSize += file.uncompressedSize;

                                // ZIP bomb protection
                                if (fileCount > 1000 || totalSize > 500 * 1024 * 1024) {
                                    reject(new Error('Template archive is too large or contains too many files'));
                                    return;
                                }

                                // Skip directories
                                if (file.type === 'Directory') continue;

                                // Validate path security
                                if (!isAllowedPath(file.path)) {
                                    reject(new Error(`Invalid file path in template: ${file.path}`));
                                    return;
                                }

                                // Look for info.json to determine template name
                                if (file.path.match(/^views\/[^\/]+\/info\.json$/)) {
                                    infoJsonFound = true;
                                    const pathParts = file.path.split('/');
                                    templateName = pathParts[1];
                                }

                                // Check for resources files
                                if (file.path.startsWith('resources/')) {
                                    hasResourcesFiles = true;
                                }
                            }

                            if (!infoJsonFound || !templateName) {
                                reject(new Error('Template must contain views/templatename/info.json file'));
                                return;
                            }

                            consoleLog('info', `New template detected: ${templateName}`);
                            resolve();
                        })
                        .catch(reject);
                });

                // Second pass: extract files
                await new Promise((resolve, reject) => {
                    unzipper.Open.buffer(zipBuffer)
                        .then(async directory => {
                            try {
                                for (const file of directory.files) {
                                    if (file.type === 'Directory') continue;

                                    const fullPath = path.join(projectRoot, file.path);
                                    const dirPath = path.dirname(fullPath);

                                    // Ensure directory exists
                                    if (!fs.existsSync(dirPath)) {
                                        fs.mkdirSync(dirPath, { recursive: true });
                                    }

                                    // Extract file
                                    const content = await file.buffer();
                                    fs.writeFileSync(fullPath, content);
                                    extractedFiles.push(file.path);

                                    consoleLog('info', `Extracted: ${file.path}`);
                                }
                                resolve();
                            } catch (error) {
                                reject(error);
                            }
                        })
                        .catch(reject);
                });

                // Validate extracted template structure and info.json
                const infoJsonPath = path.join(projectRoot, 'views', templateName, 'info.json');
                if (!fs.existsSync(infoJsonPath)) {
                    throw new Error('Template info.json not found after extraction');
                }

                // Parse and validate info.json
                try {
                    const infoContent = fs.readFileSync(infoJsonPath, 'utf8');
                    const templateInfo = JSON.parse(infoContent);

                    // Validate required fields
                    if (!templateInfo.name || !templateInfo.version || !templateInfo.author) {
                        throw new Error('Template info.json missing required fields (name, version, author)');
                    }

                    consoleLog('success', `Template "${templateInfo.name}" v${templateInfo.version} by ${templateInfo.author} installed successfully`);
                } catch (error) {
                    throw new Error(`Invalid info.json: ${error.message}`);
                }

                // Clear template cache
                clearCache();

                // Build resources if needed
                if (hasResourcesFiles) {
                    try {
                        consoleLog('info', 'Building template assets...');

                        // Run CSS build
                        const { exec } = await import('child_process');
                        await new Promise((resolve) => {
                            exec('npm run build:css', (error) => {
                                if (error) consoleLog('warning', `CSS build warning: ${error.message}`);
                                resolve();
                            });
                        });

                        // Run JS build  
                        await new Promise((resolve) => {
                            exec('npm run build:js', (error) => {
                                if (error) consoleLog('warning', `JS build warning: ${error.message}`);
                                resolve();
                            });
                        });

                        consoleLog('success', 'Template assets built successfully');
                    } catch (buildError) {
                        consoleLog('warning', `Asset build failed: ${buildError.message}`);
                        // Don't fail the upload for build errors
                    }
                }

                consoleLog('success', `Template uploaded successfully: ${templateName}`, {
                    templateName,
                    filesExtracted: extractedFiles.length,
                    hasAssets: hasResourcesFiles,
                    user: res.locals.user?.username
                });

                return response(res, 200, i18n.translateSync('api.requests.template_uploaded', { template: templateName }, req.language?.current || 'en'));

            } catch (error) {
                consoleLog('error', `Template upload error: ${error.message}`, {
                    error: error.message,
                    user: res.locals.user?.username
                });

                return response(res, 500, i18n.translateSync('api.requests.template_upload_failed', { error: error.message }, req.language?.current || 'en'));
            }

            break;
        default:
            return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
    }

    return response(res, 500, i18n.translateSync('api.requests.something_wrong', {}, req.language?.current || 'en'));
};

const updateRequest = async (req, res) => {
    const {
        tpl
    } = req.params;

    // Exclude content field from sanitization for pages to preserve HTML formatting
    // Exclude ad code fields from sanitization for ads to preserve HTML content
    const excludeFields = tpl === 'pages' ? ['content'] :
        tpl === 'ads' ? ['ad_code', 'fallback_ad_code'] : [];
    const request = sanitizeRequestBody(req.body, excludeFields);


    if (!php.var.isset(request.id)) {
        return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
    }

    switch (tpl) {
        case "users":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            if (!php.var.isset(request.username, request.email)) {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            // Protection for super admin (user ID 1)
            if (parseInt(request.id) === 1) {
                // Super admin cannot be deactivated or changed to user type
                if (request.user_type !== 'admin' && request.user_type !== undefined) {
                    return response(res, 403, i18n.translateSync('api.requests.cannot_change_super_admin', {}, req.language?.current || 'en'));
                }
                if (request.is_active === '0' || request.is_active === 0) {
                    return response(res, 403, i18n.translateSync('api.requests.cannot_deactivate_super_admin', {}, req.language?.current || 'en'));
                }
            }

            const updateUserData = {
                username: request.username,
                email: request.email,
                first_name: request.first_name || null,
                last_name: request.last_name || null,
                country: request.country || null,
                date_of_birth: request.date_of_birth || null,
                bio: request.bio || null,
                user_type: request.user_type || 'user',
                is_active: request.is_active || 1,
                is_verified: request.is_verified || 0
            };

            // Force super admin protections
            if (parseInt(request.id) === 1) {
                updateUserData.user_type = 'admin';
                updateUserData.is_active = 1;
            }

            if (request.password_hash && request.password_hash.trim() !== '') {
                const saltRounds = 12;
                const hashedPassword = await bcrypt.hash(request.password_hash, saltRounds);
                updateUserData.password = hashedPassword;
            }

            var doUpdateUser = await update(request.id, false, "users", updateUserData);

            if (doUpdateUser) {
                return response(res, 200, i18n.translateSync('api.requests.user_updated', {}, req.language?.current || 'en'));
            }

            break;
        case "games":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            if (!php.var.isset(request.title, request.category_id, request.game_type)) {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            // Generate unique slug if not provided
            const updateGameSlug = request.slug && request.slug.trim()
                ? await generateUniqueSlug(request.slug, 'games', request.id)
                : await generateUniqueSlug(request.title, 'games', request.id);

            // Validate files before processing
            const files = req.files;

            // Handle ROM system detection for updates
            let romSystem = null;
            if (request.game_type === 'rom') {
                if (request.rom_system === 'automatic') {
                    // Auto-detect ROM system from uploaded file
                    const gameFile = files.find(file => file.fieldname === 'game_file');
                    if (gameFile) {
                        const fileData = gameFile.path || gameFile.buffer;
                        romSystem = await detectRomSystem(gameFile.originalname, fileData);
                    } else {
                        // Keep existing rom_system if no new file uploaded
                        const existingGame = await getGameById(request.id);
                        romSystem = existingGame[0]?.rom_system || 'unknown';
                    }
                } else {
                    romSystem = request.rom_system;
                }
            }

            const updateGameData = {
                title: request.title,
                slug: updateGameSlug,
                description: request.description || null,
                short_description: request.short_description || null,
                category_id: request.category_id,
                game_type: request.game_type,
                width: request.width || 800,
                height: request.height || 600,
                controls: request.controls || null,
                tags: request.tags || null,
                is_featured: request.is_featured || 0,
                is_active: request.is_active || 1,
                sort_order: request.sort_order || 0,
                api_enabled: request.api_enabled || 0
            };

            // Only set rom_system for ROM games
            if (request.game_type === 'rom') {
                updateGameData.rom_system = romSystem;
            }
            let tempGameDir = null;

            if (files && files.length > 0) {
                // Validate game image
                const gameImageFile = files.find(file => file.fieldname === 'game_image');
                if (gameImageFile) {
                    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
                    if (!allowedImageTypes.includes(gameImageFile.mimetype)) {
                        return response(res, 500, i18n.translateSync('api.requests.invalid_image_type', {}, req.language?.current || 'en'));
                    }
                }

                // Validate game file
                const gameFile = files.find(file => file.fieldname === 'game_file');
                if (gameFile && request.game_type !== 'embed') {
                    if (request.game_type === 'html' && path.extname(gameFile.originalname).toLowerCase() === '.zip') {
                        // Validate HTML5 zip file
                        try {
                            const zipBuffer = gameFile.buffer;
                            await new Promise((resolve, reject) => {
                                unzipper.Open.buffer(zipBuffer)
                                    .then(directory => {
                                        // Check if index.html exists in zip
                                        const hasIndex = directory.files.some(file =>
                                            file.path.toLowerCase() === 'index.html' ||
                                            file.path.toLowerCase().endsWith('/index.html')
                                        );

                                        if (!hasIndex) {
                                            reject(new Error('HTML5 game zip file must contain an index.html file'));
                                            return;
                                        }
                                        resolve();
                                    })
                                    .catch(reject);
                            });
                        } catch (error) {
                            return response(res, 500, error.message || "Invalid HTML5 game zip file");
                        }
                    } else if (request.game_type === 'flash' && path.extname(gameFile.originalname).toLowerCase() === '.swf') {
                        // Flash file validation passed
                    } else if (request.game_type === 'rom') {
                        // ROM file validation
                        const allowedRomExtensions = ['.nes', '.snes', '.sfc', '.gba', '.gb', '.gbc', '.md', '.gen', '.smd', '.n64', '.z64', '.v64', '.bin', '.cue', '.iso', '.zip'];
                        const fileExtension = path.extname(gameFile.originalname).toLowerCase();
                        if (!allowedRomExtensions.includes(fileExtension)) {
                            return response(res, 500, i18n.translateSync('api.requests.invalid_rom_format', { formats: allowedRomExtensions.join(', ') }, req.language?.current || 'en'));
                        }
                    } else {
                        return response(res, 500, i18n.translateSync('api.requests.invalid_game_file_type', {}, req.language?.current || 'en'));
                    }
                }
            }

            try {
                // Process file uploads
                if (files && files.length > 0) {
                    // Handle game image upload with optimization
                    const gameImageFile = files.find(file => file.fieldname === 'game_image');
                    if (gameImageFile) {
                        const uploadsDir = path.join(process.cwd(), 'uploads', 'images', 'games');

                        try {
                            // Process image with multiple sizes and WebP conversion
                            const processedImages = await ImageProcessor.processImage(
                                gameImageFile.buffer,
                                gameImageFile.originalname,
                                'games',
                                uploadsDir,
                                updateGameSlug
                            );

                            // Store processed image data as JSON for database
                            updateGameData.thumbnail = JSON.stringify({
                                webp: processedImages.webp,
                                original: processedImages.original,
                                metadata: processedImages.metadata
                            });
                        } catch (error) {
                            consoleLog('error', 'Failed to process game image', { error: error.message });
                            // Fallback to original processing method
                            if (!fs.existsSync(uploadsDir)) {
                                fs.mkdirSync(uploadsDir, { recursive: true });
                            }

                            const fileExtension = path.extname(gameImageFile.originalname);
                            const fileName = `game_${updateGameSlug}_${Date.now()}${fileExtension}`;
                            const filePath = path.join(uploadsDir, fileName);

                            fs.writeFileSync(filePath, gameImageFile.buffer);
                            updateGameData.thumbnail = `uploads/images/games/${fileName}`;
                        }
                    }

                    // Handle game file upload
                    const gameFile = files.find(file => file.fieldname === 'game_file');
                    if (gameFile && request.game_type !== 'embed') {
                        const gameUploadsDir = path.join(process.cwd(), 'uploads', 'games');

                        // Ensure directory exists
                        if (!fs.existsSync(gameUploadsDir)) {
                            fs.mkdirSync(gameUploadsDir, { recursive: true });
                        }

                        if (request.game_type === 'html') {
                            // Handle HTML5 zip file - extract to folder
                            const gameDir = path.join(gameUploadsDir, `${request.slug}_${Date.now()}`);
                            tempGameDir = gameDir;

                            fs.mkdirSync(gameDir, { recursive: true });

                            // Extract zip file
                            const zipBuffer = gameFile.buffer;
                            await new Promise((resolve, reject) => {
                                unzipper.Open.buffer(zipBuffer)
                                    .then(directory => directory.extract({ path: gameDir }))
                                    .then(() => resolve())
                                    .catch(reject);
                            });

                            updateGameData.game_file = `uploads/games/${path.basename(gameDir)}/index.html`;
                            updateGameData.embed_url = null;
                        } else if (request.game_type === 'flash') {
                            // Handle Flash SWF file
                            const fileName = `game_${request.slug}_${Date.now()}.swf`;
                            const filePath = path.join(gameUploadsDir, fileName);

                            fs.writeFileSync(filePath, gameFile.buffer);
                            updateGameData.game_file = `uploads/games/${fileName}`;
                            updateGameData.embed_url = null;
                        } else if (request.game_type === 'rom') {
                            // Handle ROM file
                            const fileExtension = path.extname(gameFile.originalname);
                            const fileName = `game_${request.slug}_${Date.now()}${fileExtension}`;

                            // Create ROM system directory if it doesn't exist
                            const romSystemDir = path.join(gameUploadsDir, 'roms', romSystem || 'unknown');
                            if (!fs.existsSync(romSystemDir)) {
                                fs.mkdirSync(romSystemDir, { recursive: true });
                            }

                            const filePath = path.join(romSystemDir, fileName);
                            fs.writeFileSync(filePath, gameFile.buffer);
                            updateGameData.game_file = `uploads/games/roms/${romSystem || 'unknown'}/${fileName}`;
                            updateGameData.embed_url = null;
                        }
                    }
                }

                if (request.game_type === 'embed') {
                    updateGameData.embed_url = request.embed_url;
                    updateGameData.game_file = null;
                }

                // Get old game data before update for asset cleanup
                const oldGameData = await getGameById(request.id);
                const oldGame = oldGameData[0];

                var doUpdateGame = await update(request.id, false, "games", updateGameData);

                if (doUpdateGame) {
                    // Delete old assets if new files were uploaded
                    await deleteOldAssets(oldGame, updateGameData);

                    // Clear all game-related caches when game is updated
                    await CacheUtils.invalidateGameCaches();
                    return response(res, 200, i18n.translateSync('api.requests.game_updated', {}, req.language?.current || 'en'));
                }
            } catch (error) {
                // Clean up on error
                if (tempGameDir && fs.existsSync(tempGameDir)) {
                    fs.rmSync(tempGameDir, { recursive: true, force: true });
                }
                return response(res, 500, i18n.translateSync('api.requests.failed_process_files', { error: error.message }, req.language?.current || 'en'));
            }

            break;
        case "categories":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            if (!php.var.isset(request.name)) {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            // Generate unique slug if not provided
            const updateCategorySlug = request.slug && request.slug.trim()
                ? await generateUniqueSlug(request.slug, 'categories', request.id)
                : await generateUniqueSlug(request.name, 'categories', request.id);

            // Get existing category data
            const existingCategory = await getCategoryById(request.id);
            if (!existingCategory || existingCategory.length === 0) {
                return response(res, 500, i18n.translateSync('api.requests.category_not_found', {}, req.language?.current || 'en'));
            }

            let updateCategoryData = {
                name: request.name,
                slug: updateCategorySlug,
                description: request.description || null,
                icon: request.icon || null,
                color: request.color || '#3B82F6',
                sort_order: request.sort_order || 0,
                is_active: request.is_active || 1
            };

            // Handle category image upload with optimization
            if (req.files && req.files.length > 0) {
                const imageFile = req.files.find(file => file.fieldname === 'image');

                if (imageFile) {
                    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

                    if (!allowedTypes.includes(imageFile.mimetype)) {
                        return response(res, 500, i18n.translateSync('api.requests.invalid_image_type', {}, req.language?.current || 'en'));
                    }

                    const categoryUploadsDir = path.join(process.cwd(), 'uploads', 'categories');

                    try {
                        // Delete old image files if they exist
                        if (existingCategory[0].image) {
                            try {
                                const oldImageData = JSON.parse(existingCategory[0].image);
                                // Delete old optimized images
                                const allImages = { ...oldImageData.webp, ...oldImageData.original };
                                for (const imageInfo of Object.values(allImages)) {
                                    if (imageInfo.path && fs.existsSync(imageInfo.path)) {
                                        fs.unlinkSync(imageInfo.path);
                                    }
                                }
                            } catch (e) {
                                // Handle old format (simple path)
                                const oldImagePath = path.join(process.cwd(), existingCategory[0].image.replace(/^\//, ''));
                                if (fs.existsSync(oldImagePath)) {
                                    fs.unlinkSync(oldImagePath);
                                }
                            }
                        }

                        // Process image with multiple sizes and WebP conversion
                        const processedImages = await ImageProcessor.processImage(
                            imageFile.buffer,
                            imageFile.originalname,
                            'categories',
                            categoryUploadsDir,
                            updateCategorySlug
                        );

                        // Store processed image data as JSON for database
                        updateCategoryData.image = JSON.stringify({
                            webp: processedImages.webp,
                            original: processedImages.original,
                            metadata: processedImages.metadata
                        });
                    } catch (error) {
                        consoleLog('error', 'Failed to process category image', { error: error.message });
                        // Fallback to original processing method
                        if (!fs.existsSync(categoryUploadsDir)) {
                            fs.mkdirSync(categoryUploadsDir, { recursive: true });
                        }

                        // Delete old image if exists
                        if (existingCategory[0].image) {
                            const oldImagePath = path.join(process.cwd(), existingCategory[0].image.replace(/^\//, ''));
                            if (fs.existsSync(oldImagePath)) {
                                fs.unlinkSync(oldImagePath);
                            }
                        }

                        const fileName = `category_${updateCategorySlug}_${Date.now()}${path.extname(imageFile.originalname)}`;
                        const filePath = path.join(categoryUploadsDir, fileName);

                        fs.writeFileSync(filePath, imageFile.buffer);
                        updateCategoryData.image = `/uploads/categories/${fileName}`;
                    }
                } else {
                    // Keep existing image if no new one uploaded
                    updateCategoryData.image = existingCategory[0].image;
                }
            } else {
                // Keep existing image if no new one uploaded
                updateCategoryData.image = existingCategory[0].image;
            }

            var doUpdateCategory = await update(request.id, false, "categories", updateCategoryData);

            if (doUpdateCategory) {
                // Clear all category-related caches when category is updated
                await CacheUtils.invalidateCategoryCaches();
                return response(res, 200, i18n.translateSync('api.requests.category_updated', {}, req.language?.current || 'en'));
            }

            break;
        case "settings_system":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            try {
                // Handle file uploads (logo and favicon)
                if (req.files && req.files.length > 0) {
                    const logoFile = req.files.find(file => file.fieldname === 'site_logo');
                    const faviconFile = req.files.find(file => file.fieldname === 'site_favicon');

                    // Process site logo upload
                    if (logoFile) {
                        // Validate image file
                        const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
                        if (!allowedMimes.includes(logoFile.mimetype)) {
                            return response(res, 400, i18n.translateSync('api.requests.invalid_logo_format', {}, req.language?.current || 'en'));
                        }

                        try {
                            // Process logo with ImageProcessor
                            const logoDir = path.join(process.cwd(), 'uploads', 'logos');
                            const logoSlug = 'site-logo';

                            const logoResult = await ImageProcessor.processImage(
                                logoFile.buffer,
                                logoFile.originalname,
                                'logos',
                                logoDir,
                                logoSlug
                            );

                            // Store JSON result for optimized images
                            request.site_logo = JSON.stringify(logoResult);
                            consoleLog('success', 'Site logo processed successfully', { logoResult });
                        } catch (error) {
                            consoleLog('error', 'Failed to process site logo', { error: error.message });
                            return response(res, 500, i18n.translateSync('api.requests.failed_process_logo', { error: error.message }, req.language?.current || 'en'));
                        }
                    }

                    // Process site favicon upload
                    if (faviconFile) {
                        // Validate image file
                        const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'];
                        if (!allowedMimes.includes(faviconFile.mimetype)) {
                            return response(res, 400, i18n.translateSync('api.requests.invalid_favicon_format', {}, req.language?.current || 'en'));
                        }

                        try {
                            // Process favicon with ImageProcessor
                            const faviconDir = path.join(process.cwd(), 'uploads', 'favicons');
                            const faviconSlug = 'site-favicon';

                            const faviconResult = await ImageProcessor.processImage(
                                faviconFile.buffer,
                                faviconFile.originalname,
                                'favicons',
                                faviconDir,
                                faviconSlug
                            );

                            // Store JSON result for optimized images
                            request.site_favicon = JSON.stringify(faviconResult);
                            consoleLog('success', 'Site favicon processed successfully', { faviconResult });
                        } catch (error) {
                            consoleLog('error', 'Failed to process site favicon', { error: error.message });
                            return response(res, 500, i18n.translateSync('api.requests.failed_process_favicon', { error: error.message }, req.language?.current || 'en'));
                        }
                    }
                }

                // Settings fields to update
                const settingsFields = [
                    'site_name', 'site_description', 'site_logo', 'site_favicon',
                    'recaptcha_site_key', 'recaptcha_secret_key', 'purchase_code',
                    'user_registration_enabled', 'maintenance_mode', 'enable_frontend_pjax',
                    'games_per_page', 'enable_ratings', 'allow_guest_rating', 'enable_comments',
                    'enable_facebook_login', 'facebook_app_id', 'facebook_app_secret',
                    'enable_google_login', 'google_client_id', 'google_client_secret',
                    'enable_smtp', 'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_username', 'smtp_password', 'smtp_from_email', 'smtp_from_name',
                    'email_verification_enabled', 'email_verification_token_expiry_hours', 'email_verification_resend_limit_per_day',
                    'enable_cron_jobs', 'cron_password',
                    'default_language',
                    'timezone', 'date_format', 'time_format'
                ];

                for (const field of settingsFields) {
                    if (request[field] !== undefined) {
                        // Handle checkbox values (convert to 1 or 0)
                        let value = request[field];
                        if (['user_registration_enabled', 'maintenance_mode', 'enable_frontend_pjax', 'enable_ratings', 'allow_guest_rating', 'enable_comments', 'enable_facebook_login', 'enable_google_login', 'enable_smtp', 'smtp_secure', 'email_verification_enabled', 'enable_cron_jobs'].includes(field)) {
                            value = value === '1' || value === 'on' ? '1' : '0';
                        }


                        await upsertSetting(field, value);
                    }
                }

                // If email verification is being disabled, auto-verify all existing unverified users
                if (request.email_verification_enabled !== undefined) {
                    const emailVerificationEnabled = request.email_verification_enabled === '1' || request.email_verification_enabled === 'on' ? '1' : '0';

                    if (emailVerificationEnabled === '0') {
                        try {
                            // Auto-verify all unverified users (excluding OAuth users who should already be verified)
                            const autoVerifyResult = await autoVerifyAllUsers();

                            if (autoVerifyResult.affectedRows > 0) {
                                consoleLog('info', `Auto-verified ${autoVerifyResult.affectedRows} users after disabling email verification`);
                            }
                        } catch (error) {
                            consoleLog('error', 'Failed to auto-verify users when disabling email verification', { error: error.message });
                        }
                    }
                }

                // Clear settings cache after update
                clearCache();

                return response(res, 200, i18n.translateSync('api.requests.settings_updated', {}, req.language?.current || 'en'));
            } catch (error) {
                consoleLog('error', 'Settings update error', { error: error.message });
                return response(res, 500, i18n.translateSync('api.requests.failed_update_settings', {}, req.language?.current || 'en'));
            }

            break;
        case "settings_exp":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            try {
                // EXP settings fields to update
                const expSettingsFields = [
                    'exp_game_completion', 'exp_daily_login', 'exp_first_play',
                    'exp_game_rating', 'exp_game_comment', 'exp_follow_user',
                    'exp_profile_complete', 'exp_multiplier_weekends',
                    'exp_bonus_streak_days', 'exp_bonus_streak_multiplier'
                ];

                for (const field of expSettingsFields) {
                    if (request[field] !== undefined) {
                        await upsertSetting(field, request[field]);
                    }
                }

                // Clear settings cache after update
                clearCache();

                return response(res, 200, i18n.translateSync('api.requests.settings_updated', {}, req.language?.current || 'en'));
            } catch (error) {
                consoleLog('error', 'EXP settings update error', { error: error.message });
                return response(res, 500, i18n.translateSync('api.requests.failed_update_exp_settings', {}, req.language?.current || 'en'));
            }
        case "comments":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            if (!php.var.isset(request.comment)) {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            const updateCommentData = {
                comment: request.comment,
                is_active: request.is_active || 1
            };

            var doUpdateComment = await update(request.id, false, "game_comments", updateCommentData);

            if (doUpdateComment) {
                return response(res, 200, i18n.translateSync('api.requests.comment_updated', {}, req.language?.current || 'en'));
            }

            break;
        case "pages":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            if (!php.var.isset(request.title, request.content)) {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            // Generate unique slug from manual input or title (exclude current page)
            const updatePageSlug = request.slug && request.slug.trim()
                ? await generateUniqueSlug(request.slug, 'pages', request.id)
                : await generateUniqueSlug(request.title, 'pages', request.id);

            const updatePageData = {
                title: request.title,
                slug: updatePageSlug,
                content: request.content,
                is_published: request.is_published || 0
            };

            var doUpdatePage = await update(request.id, false, "pages", updatePageData);

            if (doUpdatePage) {
                // Invalidate cache for the updated page
                await invalidatePageCache(updatePageSlug, request.id);
                return response(res, 200, i18n.translateSync('api.requests.page_updated', {}, req.language?.current || 'en'));
            }

            break;
        case "exp_ranks":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            if (!php.var.isset(request.level, request.exp_required)) {
                return response(res, 500, i18n.translateSync('api.requests.level_exp_required', {}, req.language?.current || 'en'));
            }

            const updateExpRankData = {
                level: request.level,
                exp_required: request.exp_required,
                reward_title: request.reward_title || null,
                reward_description: request.reward_description || null
            };

            var doUpdateExpRank = await update(request.id, false, "exp_ranks", updateExpRankData);

            if (doUpdateExpRank) {
                return response(res, 200, i18n.translateSync('api.requests.exp_rank_updated', {}, req.language?.current || 'en'));
            }

            break;
        case "ad_placements":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            // Protection for default ad placements (IDs 1-12)
            const updatePlacementId = parseInt(request.id);
            if (updatePlacementId >= 1 && updatePlacementId <= 12) {
                return response(res, 403, i18n.translateSync('api.requests.default_placement_cannot_edit', {}, req.language?.current || 'en'));
            }

            if (!php.var.isset(request.name, request.slug, request.width, request.height, request.placement_type)) {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            const doUpdatePlacement = await updatePlacement(request.id, {
                name: request.name,
                slug: request.slug,
                description: request.description || null,
                width: parseInt(request.width),
                height: parseInt(request.height),
                placement_type: request.placement_type,
                is_active: request.is_active ? 1 : 0
            });

            if (doUpdatePlacement) {
                return response(res, 200, i18n.translateSync('api.requests.ad_placement_updated', {}, req.language?.current || 'en'));
            }

            break;
        case "ads":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }


            if (!php.var.isset(request.placement_id, request.name, request.ad_code)) {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            const doUpdateAd = await updateAd(request.id, {
                placement_id: parseInt(request.placement_id),
                name: request.name || 'Untitled Advertisement',
                ad_code: request.ad_code,
                fallback_ad_code: request.fallback_ad_code || null,
                priority: parseInt(request.priority) || 1,
                is_active: request.is_active ? 1 : 0
            });

            if (doUpdateAd) {
                // Clear ads cache when an advertisement is updated
                await CacheUtils.invalidateAdCaches();
                return response(res, 200, i18n.translateSync('api.requests.advertisement_updated', {}, req.language?.current || 'en'));
            }

            break;
        default:
            return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
    }

    return response(res, 500, i18n.translateSync('api.requests.something_wrong', {}, req.language?.current || 'en'));
};

const removeRequest = async (req, res) => {
    const {
        tpl,
        id
    } = req.params;

    if (!php.var.isset(id)) {
        return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
    }

    switch (tpl) {
        case "users":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            // Protection for super admin (user ID 1)
            if (parseInt(id) === 1) {
                return response(res, 403, i18n.translateSync('api.requests.cannot_delete_super_admin', {}, req.language?.current || 'en'));
            }

            const getUser = await getUserById(id);

            if (getUser.length < 1) {
                return response(res, 500, i18n.translateSync('api.requests.user_not_found', {}, req.language?.current || 'en'));
            }

            var doRemoveUser = await remove(id, false, "users");

            if (doRemoveUser) {
                return response(res, 200, i18n.translateSync('api.requests.user_deleted', {}, req.language?.current || 'en'));
            }

            break;
        case "games":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            const getGame = await getGameById(id);

            if (getGame.length < 1) {
                return response(res, 500, i18n.translateSync('api.requests.game_not_found', {}, req.language?.current || 'en'));
            }

            // Delete game assets before removing from database
            const gameData = getGame[0];
            await deleteGameAssets(gameData);

            var doRemoveGame = await remove(id, false, "games");

            if (doRemoveGame) {
                // Clear all game-related caches when game is deleted
                await CacheUtils.invalidateGameCaches();
                return response(res, 200, i18n.translateSync('api.requests.game_deleted', {}, req.language?.current || 'en'));
            }

            break;
        case "categories":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            const getCategory = await getCategoryById(id);

            if (getCategory.length < 1) {
                return response(res, 500, i18n.translateSync('api.requests.category_not_found', {}, req.language?.current || 'en'));
            }

            var doRemoveCategory = await remove(id, false, "categories");

            if (doRemoveCategory) {
                // Clear all category-related caches when category is deleted
                await CacheUtils.invalidateCategoryCaches();
                return response(res, 200, i18n.translateSync('api.requests.category_deleted', {}, req.language?.current || 'en'));
            }

            break;
        case "favorites":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            const getFavorite = await getFavoriteById(id);

            if (getFavorite.length < 1) {
                return response(res, 500, i18n.translateSync('api.requests.favorite_not_found', {}, req.language?.current || 'en'));
            }

            var doRemoveFavorite = await remove(id, false, "favorites");

            if (doRemoveFavorite) {
                return response(res, 200, i18n.translateSync('api.requests.favorite_deleted', {}, req.language?.current || 'en'));
            }

            break;
        case "follows":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            const getFollow = await getFollowById(id);

            if (getFollow.length < 1) {
                return response(res, 500, i18n.translateSync('api.requests.follow_not_found', {}, req.language?.current || 'en'));
            }

            var doRemoveFollow = await remove(id, false, "follows");

            if (doRemoveFollow) {
                return response(res, 200, i18n.translateSync('api.requests.follow_deleted', {}, req.language?.current || 'en'));
            }

            break;
        case "comments":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            const getComment = await getCommentById(id);

            if (getComment.length < 1) {
                return response(res, 500, i18n.translateSync('api.requests.comment_not_found', {}, req.language?.current || 'en'));
            }

            var doRemoveComment = await remove(id, false, "game_comments");

            if (doRemoveComment) {
                return response(res, 200, i18n.translateSync('api.requests.comment_deleted', {}, req.language?.current || 'en'));
            }

            break;
        case "pages":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            const getPage = await getPageById(id);

            if (getPage.length < 1) {
                return response(res, 500, i18n.translateSync('api.requests.page_not_found', {}, req.language?.current || 'en'));
            }

            var doRemovePage = await remove(id, false, "pages");

            if (doRemovePage) {
                // Invalidate cache for the deleted page
                await invalidatePageCache(null, id);
                return response(res, 200, i18n.translateSync('api.requests.page_deleted', {}, req.language?.current || 'en'));
            }

            break;
        case "exp_ranks":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            const getExpRank = await getExpRankById(id);

            if (getExpRank.length < 1) {
                return response(res, 500, i18n.translateSync('api.requests.exp_rank_not_found', {}, req.language?.current || 'en'));
            }

            var doRemoveExpRank = await remove(id, false, "exp_ranks");

            if (doRemoveExpRank) {
                return response(res, 200, i18n.translateSync('api.requests.exp_rank_deleted', {}, req.language?.current || 'en'));
            }

            break;
        case "exp_events":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            const getExpEvent = await getExpEventById(id);

            if (getExpEvent.length < 1) {
                return response(res, 500, i18n.translateSync('api.requests.exp_event_not_found', {}, req.language?.current || 'en'));
            }

            var doRemoveExpEvent = await remove(id, false, "exp_events");

            if (doRemoveExpEvent) {
                return response(res, 200, i18n.translateSync('api.requests.exp_event_deleted', {}, req.language?.current || 'en'));
            }

            break;
        case "ad_placements":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            // Protection for default ad placements (IDs 1-12)
            const placementId = parseInt(id);
            if (placementId >= 1 && placementId <= 12) {
                return response(res, 403, i18n.translateSync('api.requests.default_placement_cannot_delete', {}, req.language?.current || 'en'));
            }

            const doRemovePlacement = await deletePlacement(id);

            if (doRemovePlacement) {
                return response(res, 200, i18n.translateSync('api.requests.ad_placement_deleted', {}, req.language?.current || 'en'));
            }

            break;
        case "ads":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
            }

            const doRemoveAd = await deleteAd(id);

            if (doRemoveAd) {
                // Clear ads cache when an advertisement is deleted
                await CacheUtils.invalidateAdCaches();
                return response(res, 200, i18n.translateSync('api.requests.advertisement_deleted', {}, req.language?.current || 'en'));
            }

            break;
        default:
            return response(res, 500, i18n.translateSync('api.requests.invalid_request', {}, req.language?.current || 'en'));
    }

    return response(res, 500, i18n.translateSync('api.requests.something_wrong', {}, req.language?.current || 'en'));
};

const updateProfile = async (req, res) => {
    if (!res.locals.user) {
        return response(res, 401, i18n.translateSync('api.requests.authentication_required', {}, req.language?.current || 'en'));
    }

    const request = sanitizeRequestBody(req.body);

    if (!php.var.isset(request.username, request.email)) {
        return response(res, 400, i18n.translateSync('api.requests.username_email_required', {}, req.language?.current || 'en'));
    }

    try {
        const updateData = {
            username: request.username,
            email: request.email,
            first_name: request.first_name || null,
            last_name: request.last_name || null
        };

        // Handle avatar upload if present
        if (req.files && req.files.length > 0) {
            const avatarFile = req.files.find(file => file.fieldname === 'avatar');
            if (avatarFile) {
                try {
                    const avatarResult = await ImageProcessor.processAvatar(
                        avatarFile.buffer,
                        avatarFile.originalname,
                        res.locals.user.id
                    );
                    updateData.avatar = avatarResult.avatarUrl;
                } catch (avatarError) {
                    consoleLog('error', 'Avatar processing error', { error: avatarError.message });
                    return response(res, 400, avatarError.message);
                }
            }
        }

        // Handle avatar removal if requested
        if (request.remove_avatar === 'true') {
            updateData.avatar = null;
        }

        const doUpdateProfile = await updateUserProfile(res.locals.user.id, updateData);

        if (doUpdateProfile) {
            // Get updated user data
            const user = await getUserById(res.locals.user.id);
            req.session.user = user[0];

            return response(res, 200, i18n.translateSync('api.requests.profile_updated', {}, req.language?.current || 'en'));
        }

        return response(res, 500, i18n.translateSync('api.requests.profile_update_failed', {}, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', 'Profile update error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.requests.profile_update_error', {}, req.language?.current || 'en'));
    }
};

const updatePassword = async (req, res) => {
    if (!res.locals.user) {
        return response(res, 401, i18n.translateSync('api.requests.authentication_required', {}, req.language?.current || 'en'));
    }

    const request = sanitizeRequestBody(req.body);

    if (!php.var.isset(request.current_password, request.new_password, request.confirm_password)) {
        return response(res, 400, i18n.translateSync('api.requests.password_fields_required', {}, req.language?.current || 'en'));
    }

    if (request.new_password !== request.confirm_password) {
        return response(res, 400, i18n.translateSync('api.requests.passwords_no_match', {}, req.language?.current || 'en'));
    }

    if (request.new_password.length < 8) {
        return response(res, 400, i18n.translateSync('api.requests.password_min_length', {}, req.language?.current || 'en'));
    }

    try {
        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(request.current_password, res.locals.user.password);

        if (!isCurrentPasswordValid) {
            return response(res, 400, i18n.translateSync('api.requests.current_password_incorrect', {}, req.language?.current || 'en'));
        }

        // Hash new password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(request.new_password, saltRounds);

        const doUpdatePassword = await update(res.locals.user.id, false, "users", {
            password: hashedPassword
        });

        if (doUpdatePassword) {
            return response(res, 200, i18n.translateSync('api.requests.password_updated', {}, req.language?.current || 'en'));
        }

        return response(res, 500, i18n.translateSync('api.requests.password_update_failed', {}, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', 'Password update error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.requests.password_update_error', {}, req.language?.current || 'en'));
    }
};

const updateAdditional = async (req, res) => {
    if (!res.locals.user) {
        return response(res, 401, i18n.translateSync('api.requests.authentication_required', {}, req.language?.current || 'en'));
    }

    const request = sanitizeRequestBody(req.body);

    try {
        const updateData = {
            bio: request.bio || null,
            country: request.country || null,
            date_of_birth: request.date_of_birth || null
        };

        const doUpdateAdditional = await update(res.locals.user.id, false, "users", updateData);

        if (doUpdateAdditional) {
            // Get updated user data
            const updatedUser = await getUserById(res.locals.user.id);
            req.session.user = updatedUser[0];

            return response(res, 200, i18n.translateSync('api.requests.additional_info_updated', {}, req.language?.current || 'en'));
        }

        return response(res, 500, i18n.translateSync('api.requests.additional_info_failed', {}, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', 'Additional info update error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.requests.additional_info_error', {}, req.language?.current || 'en'));
    }
};

const exportData = async (req, res) => {
    if (!res.locals.user) {
        return response(res, 401, i18n.translateSync('api.requests.authentication_required', {}, req.language?.current || 'en'));
    }

    try {
        // Get user data
        const userData = await getUserById(res.locals.user.id);

        if (!userData || userData.length === 0) {
            return response(res, 404, i18n.translateSync('api.requests.user_data_not_found', {}, req.language?.current || 'en'));
        }

        // Remove sensitive information
        const exportData = {
            ...userData[0],
            password: undefined,
            created_at: userData[0].created_at,
            updated_at: userData[0].updated_at
        };

        // Set headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="user_data_${res.locals.user.id}.json"`);

        return res.json({
            export_date: new Date().toISOString(),
            user_data: exportData
        });
    } catch (error) {
        consoleLog('error', 'Data export error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.requests.data_export_error', {}, req.language?.current || 'en'));
    }
};


const followUserEndpoint = async (req, res) => {
    if (!res.locals.user) {
        return response(res, 401, i18n.translateSync('api.requests.authentication_required', {}, req.language?.current || 'en'));
    }

    const request = sanitizeRequestBody(req.body);

    if (!php.var.isset(request.username)) {
        return response(res, 400, i18n.translateSync('api.requests.username_required', {}, req.language?.current || 'en'));
    }

    try {
        // Find the user to follow
        const targetUser = await getUserByUsername(request.username);
        if (!targetUser || targetUser.length === 0) {
            return response(res, 404, i18n.translateSync('api.requests.user_not_found', {}, req.language?.current || 'en'));
        }

        const followingId = targetUser[0].id;

        // Can't follow yourself
        if (followingId === res.locals.user.id) {
            return response(res, 400, i18n.translateSync('api.requests.cannot_follow_self', {}, req.language?.current || 'en'));
        }

        // Check if already following
        const alreadyFollowing = await isFollowing(res.locals.user.id, followingId);
        if (alreadyFollowing) {
            return response(res, 400, i18n.translateSync('api.requests.already_following', {}, req.language?.current || 'en'));
        }

        const result = await followUser(res.locals.user.id, followingId);
        if (result) {
            // Award EXP for following a user
            const expResult = await awardFollowUserExp(res.locals.user.id, followingId, targetUser[0].username, req);

            // Send real-time notification to the target user
            await notifyUserFollowed(res.locals.user.id, followingId, {
                followerUsername: res.locals.user.username,
                followerAvatar: res.locals.user.avatarUrl
            });

            return response(res, 200, i18n.translateSync('api.requests.user_followed', {}, req.language?.current || 'en'), {
                expResult: expResult
            });
        }

        return response(res, 500, i18n.translateSync('api.requests.follow_failed', {}, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', 'Follow user error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.requests.follow_error', {}, req.language?.current || 'en'));
    }
};

const unfollowUserEndpoint = async (req, res) => {
    if (!res.locals.user) {
        return response(res, 401, i18n.translateSync('api.requests.authentication_required', {}, req.language?.current || 'en'));
    }

    const request = sanitizeRequestBody(req.body);

    if (!php.var.isset(request.username)) {
        return response(res, 400, i18n.translateSync('api.requests.username_required', {}, req.language?.current || 'en'));
    }

    try {
        // Find the user to unfollow
        const targetUser = await getUserByUsername(request.username);
        if (!targetUser || targetUser.length === 0) {
            return response(res, 404, i18n.translateSync('api.requests.user_not_found', {}, req.language?.current || 'en'));
        }

        const followingId = targetUser[0].id;

        // Check if currently following
        const currentlyFollowing = await isFollowing(res.locals.user.id, followingId);
        if (!currentlyFollowing) {
            return response(res, 400, i18n.translateSync('api.requests.not_following_user', {}, req.language?.current || 'en'));
        }

        const result = await unfollowUser(res.locals.user.id, followingId);
        if (result) {
            // Send real-time notification to the target user
            await notifyUserUnfollowed(res.locals.user.id, followingId, {
                followerUsername: res.locals.user.username
            });

            return response(res, 200, i18n.translateSync('api.requests.user_unfollowed', {}, req.language?.current || 'en'));
        }

        return response(res, 500, i18n.translateSync('api.requests.unfollow_failed', {}, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', 'Unfollow user error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.requests.unfollow_error', {}, req.language?.current || 'en'));
    }
};


const rateGameEndpoint = async (req, res) => {
    const request = sanitizeRequestBody(req.body);

    // Check if ratings are enabled
    const enableRatings = await getSetting('enable_ratings', '1');
    if (enableRatings !== '1') {
        return response(res, 403, i18n.translateSync('api.requests.ratings_disabled', {}, req.language?.current || 'en'));
    }

    // Check if guest rating is allowed
    const allowGuestRating = await getSetting('allow_guest_rating', '0') === '1';

    // Extract IP address for guest rating tracking
    const clientIP = extractIPAddress(req);

    // Determine user ID and rating approach
    let userId = null;
    let isGuestUser = false;

    if (res.locals.user) {
        // Authenticated user
        userId = res.locals.user.id;
    } else if (allowGuestRating) {
        // Guest user - use IP-based tracking
        isGuestUser = true;
    } else {
        return response(res, 401, i18n.translateSync('api.requests.authentication_required', {}, req.language?.current || 'en'));
    }

    // Validate required fields
    if (!php.var.isset(request.gameId, request.rating)) {
        return response(res, 400, i18n.translateSync('api.requests.game_rating_required', {}, req.language?.current || 'en'));
    }

    const gameId = parseInt(request.gameId);
    const rating = parseInt(request.rating);

    // Validate rating value
    if (rating < 1 || rating > 5) {
        return response(res, 400, i18n.translateSync('api.requests.rating_range_error', {}, req.language?.current || 'en'));
    }

    try {
        // Verify game exists
        const game = await getGameById(gameId);
        if (!game || game.length === 0) {
            return response(res, 404, i18n.translateSync('api.requests.game_not_found', {}, req.language?.current || 'en'));
        }

        // Check if user/IP has already rated this game (spam prevention)
        const hasAlreadyRated = await hasUserRated(gameId, userId, isGuestUser ? clientIP : null);

        let existingRating = null;
        if (isGuestUser) {
            existingRating = await getRatingByIP(gameId, clientIP);
        } else {
            existingRating = await getRating(gameId, userId);
        }

        // Submit or update rating
        if (isGuestUser) {
            await setRatingByIP(gameId, clientIP, rating);
        } else {
            await setRating(gameId, userId, rating);
        }

        // Get updated stats
        const stats = await getGameRatingStats(gameId);

        // Award EXP for rating (only for authenticated users, not guests)
        let expResult = null;
        if (!isGuestUser) {
            expResult = await awardGameRatingExp(userId, gameId, game[0].title, req);
        }

        // Determine message based on whether this was an update or new rating
        const message = existingRating !== null ?
            i18n.translateSync('api.requests.rating_updated', {}, req.language?.current || 'en') :
            i18n.translateSync('api.requests.rating_submitted', {}, req.language?.current || 'en');

        return response(res, 200, message, {
            gameRating: parseFloat(stats.rating),
            totalRatings: stats.total_ratings,
            userRatings: stats.user_ratings || 0,
            guestRatings: stats.guest_ratings || 0,
            userRating: rating,
            wasUpdate: existingRating !== null,
            expResult: expResult
        });

    } catch (error) {
        consoleLog('error', 'Rate game error', {
            error: error.message,
            gameId: gameId,
            userId: userId,
            isGuest: isGuestUser,
            clientIP: isGuestUser ? clientIP : 'N/A'
        });

        // Handle specific database constraint violations
        if (error.code === 'ER_DUP_ENTRY') {
            return response(res, 409, i18n.translateSync('api.requests.rating_duplicate', {}, req.language?.current || 'en'));
        }

        return response(res, 500, i18n.translateSync('api.requests.rating_submit_error', {}, req.language?.current || 'en'));
    }
};

const postCommentEndpoint = async (req, res) => {
    // Check if comments are enabled
    const enableComments = await getSetting('enable_comments', '1');
    if (enableComments !== '1') {
        return response(res, 403, i18n.translateSync('api.requests.comments_disabled', {}, req.language?.current || 'en'));
    }

    if (!res.locals.user) {
        return response(res, 401, i18n.translateSync('api.requests.authentication_required', {}, req.language?.current || 'en'));
    }

    const request = sanitizeRequestBody(req.body);

    if (!php.var.isset(request.gameId, request.comment)) {
        return response(res, 400, i18n.translateSync('api.requests.comment_game_required', {}, req.language?.current || 'en'));
    }

    const comment = request.comment.trim();
    if (!comment) {
        return response(res, 400, i18n.translateSync('api.requests.comment_empty', {}, req.language?.current || 'en'));
    }

    if (comment.length > 500) {
        return response(res, 400, i18n.translateSync('api.requests.comment_too_long', {}, req.language?.current || 'en'));
    }

    try {
        // Verify game exists
        const game = await getGameById(request.gameId);
        if (!game || game.length === 0) {
            return response(res, 404, i18n.translateSync('api.requests.game_not_found', {}, req.language?.current || 'en'));
        }

        const result = await createComment(request.gameId, res.locals.user.id, comment);

        if (result) {
            // Award EXP for commenting
            const expResult = await awardGameCommentExp(res.locals.user.id, request.gameId, game[0].title, req);

            return response(res, 200, i18n.translateSync('api.requests.comment_posted', {}, req.language?.current || 'en'), {
                comment: {
                    id: result.insertId,
                    user_id: res.locals.user.id,
                    username: res.locals.user.username,
                    avatar: res.locals.user.avatar,
                    comment: comment,
                    created_at: new Date()
                },
                expResult: expResult
            });
        }

        return response(res, 500, i18n.translateSync('api.requests.comment_post_failed', {}, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', 'Post comment error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.requests.comment_post_error', {}, req.language?.current || 'en'));
    }
};

const loadCommentsEndpoint = async (req, res) => {
    // Check if comments are enabled
    const enableComments = await getSetting('enable_comments', '1');
    if (enableComments !== '1') {
        return response(res, 403, i18n.translateSync('api.requests.comments_disabled', {}, req.language?.current || 'en'));
    }

    const { gameId, offset = 0, limit = 5 } = req.query;

    if (!gameId) {
        return response(res, 400, i18n.translateSync('api.requests.game_id_required', {}, req.language?.current || 'en'));
    }

    try {
        const comments = await getCommentsByGameId(
            parseInt(gameId),
            parseInt(limit),
            parseInt(offset)
        );

        return response(res, 200, i18n.translateSync('api.requests.comments_loaded', {}, req.language?.current || 'en'), comments || []);
    } catch (error) {
        consoleLog('error', 'Load comments error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.requests.comments_load_error', {}, req.language?.current || 'en'));
    }
};

const deleteCommentEndpoint = async (req, res) => {
    if (!res.locals.user) {
        return response(res, 401, i18n.translateSync('api.requests.authentication_required', {}, req.language?.current || 'en'));
    }

    const request = sanitizeRequestBody(req.body);

    if (!php.var.isset(request.commentId)) {
        return response(res, 400, i18n.translateSync('api.requests.comment_id_required', {}, req.language?.current || 'en'));
    }

    try {
        const result = await deleteComment(request.commentId, res.locals.user.id);

        if (result && result.affectedRows > 0) {
            return response(res, 200, i18n.translateSync('api.requests.comment_deleted_success', {}, req.language?.current || 'en'));
        }

        return response(res, 404, i18n.translateSync('api.requests.comment_delete_permission', {}, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', 'Delete comment error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.requests.comment_delete_error', {}, req.language?.current || 'en'));
    }
};

const toggleFavoriteEndpoint = async (req, res) => {
    if (!res.locals.user) {
        return response(res, 401, i18n.translateSync('api.requests.authentication_required', {}, req.language?.current || 'en'));
    }

    const request = sanitizeRequestBody(req.body);

    if (!php.var.isset(request.gameId)) {
        return response(res, 400, i18n.translateSync('api.requests.game_id_required', {}, req.language?.current || 'en'));
    }

    try {
        // Verify game exists
        const game = await getGameById(request.gameId);
        if (!game || game.length === 0) {
            return response(res, 404, i18n.translateSync('api.requests.game_not_found', {}, req.language?.current || 'en'));
        }

        // Check if already favorited
        const existing = await checkIfFavorite(res.locals.user.id, request.gameId);

        if (existing && existing.length > 0) {
            // Remove from favorites
            await removeFavorite(res.locals.user.id, request.gameId);

            return response(res, 200, i18n.translateSync('api.requests.removed_from_favorites', {}, req.language?.current || 'en'), {
                favorited: false
            });
        } else {
            // Add to favorites
            await addFavorite(res.locals.user.id, request.gameId);

            return response(res, 200, i18n.translateSync('api.requests.added_to_favorites', {}, req.language?.current || 'en'), {
                favorited: true
            });
        }
    } catch (error) {
        consoleLog('error', 'Toggle favorite error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.requests.favorites_update_error', {}, req.language?.current || 'en'));
    }
};

const getGameDataEndpoint = async (req, res) => {
    const gameSlug = req.params.slug || req.query.slug;

    if (!gameSlug) {
        return response(res, 400, i18n.translateSync('api.requests.game_slug_required', {}, req.language?.current || 'en'));
    }

    try {
        // Get game by slug
        const game = await getGameBySlug(gameSlug);
        if (!game || game.length === 0) {
            return response(res, 404, i18n.translateSync('api.requests.game_not_found', {}, req.language?.current || 'en'));
        }

        const gameData = game[0];

        // Get user-specific data if logged in
        let userRating = null;
        let isFavorited = false;

        if (res.locals.user) {
            const ratingResult = await getRating(gameData.id, res.locals.user.id);
            userRating = ratingResult;

            const favoriteResult = await checkIfFavorite(res.locals.user.id, gameData.id);
            isFavorited = favoriteResult && favoriteResult.length > 0;
        }

        // Get game rating stats
        const ratingStats = await getGameRatingStats(gameData.id);

        // Get comment count
        const commentCount = await getCommentCountByGameId(gameData.id);

        // Check if guest rating is allowed
        const allowGuestRating = await getSetting('allow_guest_rating', '0') === '1';

        return response(res, 200, i18n.translateSync('api.requests.game_data_retrieved', {}, req.language?.current || 'en'), {
            id: gameData.id,
            title: gameData.title,
            slug: gameData.slug,
            type: gameData.game_type,
            thumbnail: gameData.thumbnail,
            width: gameData.width || 800,
            height: gameData.height || 600,
            api_enabled: gameData.api_enabled,
            userRating: userRating,
            isFavorited: isFavorited,
            gameRating: parseFloat(ratingStats.rating) || 0,
            totalRatings: ratingStats.total_ratings || 0,
            commentCount: commentCount,
            allowGuestRating: allowGuestRating
        });
    } catch (error) {
        consoleLog('error', 'Get game data error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.requests.game_data_error', {}, req.language?.current || 'en'));
    }
};

const searchGamesEndpoint = async (req, res) => {
    try {
        const query = req.query.q;

        if (!query || query.trim().length < 2) {
            return response(res, 400, i18n.translateSync('api.requests.search_query_min_length', {}, req.language?.current || 'en'));
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const trimmedQuery = query.trim();

        // Track the search query (async, don't wait for it)
        trackSearchQuery(trimmedQuery).catch(err => {
            consoleLog('error', 'Error tracking search query', { error: err.message });
        });

        // Get search results and total count
        const [games, totalCount] = await Promise.all([
            searchGames(trimmedQuery, limit, offset),
            getSearchCount(trimmedQuery)
        ]);

        const hasNextPage = totalCount > offset + limit;

        return response(res, 200, i18n.translateSync('api.requests.search_completed', {}, req.language?.current || 'en'), {
            games: games || [],
            query: trimmedQuery,
            totalCount: totalCount,
            currentPage: page,
            hasNextPage: hasNextPage,
            totalPages: Math.ceil(totalCount / limit)
        });
    } catch (error) {
        consoleLog('error', 'Search games error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.requests.search_error', {}, req.language?.current || 'en'));
    }
};


// Arcade API Endpoints for iframe games


const arcadeSubmitScoreEndpoint = async (req, res) => {
    if (!res.locals.user) {
        return response(res, 401, i18n.translateSync('api.requests.authentication_required', {}, req.language?.current || 'en'));
    }

    const request = sanitizeRequestBody(req.body);

    if (!request.game_id || request.score === undefined) {
        return response(res, 400, i18n.translateSync('api.requests.game_score_required', {}, req.language?.current || 'en'));
    }

    try {
        const result = await scoreAPI.submitScore(
            res.locals.user.id,
            parseInt(request.game_id),
            parseFloat(request.score),
            request.score_data || {}
        );

        if (result.success) {
            return response(res, 200, result.message, {
                scoreId: result.scoreId,
                isPersonalBest: result.isPersonalBest,
                previousBest: result.previousBest,
                expAwarded: result.expAwarded
            });
        }

        return response(res, 400, result.error);
    } catch (error) {
        consoleLog('error', 'Arcade submit score error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.requests.score_submit_error', {}, req.language?.current || 'en'));
    }
};



const arcadeGetLeaderboardEndpoint = async (req, res) => {
    const gameId = req.params.game_id;
    const limit = parseInt(req.query.limit) || 10;

    if (!gameId) {
        return response(res, 400, i18n.translateSync('api.requests.game_id_required', {}, req.language?.current || 'en'));
    }

    try {
        const result = await scoreAPI.getLeaderboard(gameId, limit);

        if (result.success) {
            return response(res, 200, i18n.translateSync('api.requests.leaderboard_retrieved', {}, req.language?.current || 'en'), {
                leaderboard: result.leaderboard,
                count: result.count
            });
        }

        return response(res, 400, result.error);
    } catch (error) {
        consoleLog('error', 'Arcade get leaderboard error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.requests.leaderboard_error', {}, req.language?.current || 'en'));
    }
};

const arcadeGetUserBestEndpoint = async (req, res) => {
    if (!res.locals.user) {
        return response(res, 401, i18n.translateSync('api.requests.authentication_required', {}, req.language?.current || 'en'));
    }

    const gameId = req.params.game_id;

    if (!gameId) {
        return response(res, 400, i18n.translateSync('api.requests.game_id_required', {}, req.language?.current || 'en'));
    }

    try {
        const result = await scoreAPI.getUserBest(res.locals.user.id, gameId);

        if (result.success) {
            return response(res, 200, i18n.translateSync('api.requests.user_best_retrieved', {}, req.language?.current || 'en'), {
                bestScore: result.bestScore,
                totalScores: result.totalScores,
                rank: result.rank,
                totalPlayers: result.totalPlayers
            });
        }

        return response(res, 400, result.error);
    } catch (error) {
        consoleLog('error', 'Arcade get user best error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.requests.user_best_error', {}, req.language?.current || 'en'));
    }
};

const getUserProfileEndpoint = async (req, res) => {
    if (!res.locals.user) {
        return response(res, 401, i18n.translateSync('api.requests.authentication_required', {}, req.language?.current || 'en'));
    }

    try {
        const userId = res.locals.user.id;
        const user = res.locals.user;

        // Get user's rank information
        const currentLevel = user.level || 1;
        const currentExp = user.exp_points || 0;
        const totalExpEarned = user.total_exp_earned || 0;

        // Get rank title and next level info
        const [rankTitle, nextLevelExp, expProgress] = await Promise.all([
            getLevelTitle(currentLevel),
            getExpForNextLevel(currentLevel),
            getExpProgress(currentExp, currentLevel)
        ]);

        // Get current rank data
        const currentRankData = await getExpRankByLevel(currentLevel);
        const nextRankData = nextLevelExp ? await getExpRankByLevel(currentLevel + 1) : null;

        return response(res, 200, i18n.translateSync('api.requests.user_profile_retrieved', {}, req.language?.current || 'en'), {
            id: user.id,
            username: user.username,
            avatarUrl: user.avatarUrl,
            level: currentLevel,
            expPoints: currentExp,
            totalExpEarned: totalExpEarned,
            rankTitle: rankTitle,
            currentRank: {
                level: currentLevel,
                title: currentRankData?.[0]?.reward_title || `Rank ${currentLevel}`,
                description: currentRankData?.[0]?.reward_description || null,
                expRequired: currentRankData?.[0]?.exp_required || 0
            },
            nextRank: nextRankData ? {
                level: currentLevel + 1,
                title: nextRankData[0]?.reward_title || `Rank ${currentLevel + 1}`,
                description: nextRankData[0]?.reward_description || null,
                expRequired: nextRankData[0]?.exp_required || null
            } : null,
            expProgress: {
                current: expProgress.current,
                required: expProgress.required,
                percentage: expProgress.percentage,
                nextLevelExp: nextLevelExp
            },
            userType: user.user_type,
            firstName: user.first_name,
            lastName: user.last_name,
            country: user.country,
            joinDate: user.created_at
        });
    } catch (error) {
        consoleLog('error', 'Get user profile error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.requests.user_profile_error', {}, req.language?.current || 'en'));
    }
};

const clearCacheEndpoint = async (req, res) => {
    try {
        // Clear all system caches
        const success = await CacheUtils.clearAllCaches();

        if (success) {
            response(res, 200, i18n.translateSync('api.requests.caches_cleared', {}, req.language?.current || 'en'));
        } else {
            response(res, 500, i18n.translateSync('api.requests.cache_clear_failed', {}, req.language?.current || 'en'));
        }
    } catch (error) {
        consoleLog('error', `Cache clearing error: ${error.message}`);
        response(res, 500, i18n.translateSync('api.requests.cache_clear_error', {}, req.language?.current || 'en'));
    }
};

const rebuildAssetsEndpoint = async (req, res) => {
    try {
        consoleLog('info', 'Starting template asset rebuild...');

        // Import the rebuild utility
        const { rebuildAllTemplateAssets } = await import('../utils/rebuild.js');
        
        // Execute the rebuild process
        const results = await rebuildAllTemplateAssets();
        
        // Log detailed results
        const message = `Rebuilt ${results.successful}/${results.total} assets (${results.failed} failed)`;
        consoleLog('success', message, { 
            results: {
                successful: results.successful,
                failed: results.failed,
                total: results.total,
                details: results.details
            }
        });

        response(res, 200, i18n.translateSync('api.requests.assets_rebuilt', {}, req.language?.current || 'en'));

    } catch (error) {
        consoleLog('error', `Asset rebuild failed: ${error.message}`);
        response(res, 500, i18n.translateSync('api.requests.assets_rebuild_failed', {}, req.language?.current || 'en'));
    }
};

const activateTemplate = async (req, res) => {
    try {
        // Check admin authorization
        if (!res.locals.user || res.locals.user.user_type !== 'admin') {
            return response(res, 403, i18n.translateSync('api.requests.unauthorized', {}, req.language?.current || 'en'));
        }

        // Sanitize request body
        const request = sanitizeRequestBody(req.body);

        // Get template ID from request
        const templateId = request.template_id;

        if (!templateId) {
            return response(res, 400, i18n.translateSync('api.requests.template_id_required', {}, req.language?.current || 'en'));
        }

        // Validate template exists and is valid
        if (!validateTemplate(templateId)) {
            consoleLog('warning', `Invalid template activation attempted: ${templateId}`, {
                attemptedTemplate: templateId,
                user: res.locals.user?.username
            });
            return response(res, 400, i18n.translateSync('api.requests.invalid_template', { template: templateId }, req.language?.current || 'en'));
        }

        // Update selected_template setting
        await upsertSetting('selected_template', templateId);

        // Clear cache to ensure template change takes effect immediately
        clearCache();

        consoleLog('info', `Template activated successfully: ${templateId}`, {
            template: templateId,
            user: res.locals.user?.username
        });

        return response(res, 200, i18n.translateSync('api.requests.template_activated', { template: templateId }, req.language?.current || 'en'));

    } catch (error) {
        consoleLog('error', `Template activation error: ${error.message}`, {
            templateId: req.body?.template_id,
            error: error.message,
            user: res.locals.user?.username
        });
        return response(res, 500, i18n.translateSync('api.requests.template_activation_failed', {}, req.language?.current || 'en'));
    }
};

const deleteTemplate = async (req, res) => {
    try {
        // Check admin authorization
        if (!res.locals.user || res.locals.user.user_type !== 'admin') {
            return response(res, 403, i18n.translateSync('api.requests.unauthorized', {}, req.language?.current || 'en'));
        }

        // Get template ID from URL parameter
        const templateId = req.params.templateId;

        if (!templateId) {
            return response(res, 400, i18n.translateSync('api.requests.template_id_required', {}, req.language?.current || 'en'));
        }

        // Validate template exists
        if (!validateTemplate(templateId)) {
            consoleLog('warning', `Invalid template deletion attempted: ${templateId}`, {
                attemptedTemplate: templateId,
                user: res.locals.user?.username
            });
            return response(res, 400, i18n.translateSync('api.requests.invalid_template', { template: templateId }, req.language?.current || 'en'));
        }

        // Prevent deletion of default template
        if (templateId === 'default') {
            consoleLog('warning', `Attempted to delete default template: ${templateId}`, {
                templateId: templateId,
                user: res.locals.user?.username
            });
            return response(res, 400, i18n.translateSync('api.requests.cannot_delete_default_template', {}, req.language?.current || 'en'));
        }

        // Check if trying to delete currently active template
        const currentTemplate = await getSetting('selected_template') || 'default';
        if (currentTemplate === templateId) {
            consoleLog('warning', `Attempted to delete active template: ${templateId}`, {
                templateId: templateId,
                user: res.locals.user?.username
            });
            return response(res, 400, i18n.translateSync('api.requests.cannot_delete_active_template', {}, req.language?.current || 'en'));
        }

        // Get template metadata to retrieve uninstall paths
        const metadata = getTemplateMetadata(templateId);
        const uninstallPaths = metadata.uninstall || [];

        // Delete files and folders listed in uninstall array
        const deletedItems = [];
        const errors = [];

        for (const filePath of uninstallPaths) {
            try {
                const fullPath = path.join(process.cwd(), filePath);

                // Security check: ensure path is within project directory
                const projectRoot = process.cwd();
                const resolvedPath = path.resolve(fullPath);
                if (!resolvedPath.startsWith(projectRoot)) {
                    consoleLog('warning', `Attempted path traversal in template deletion: ${filePath}`, {
                        templateId: templateId,
                        attemptedPath: filePath,
                        resolvedPath: resolvedPath,
                        user: res.locals.user?.username
                    });
                    continue;
                }

                // Check if file/folder exists
                if (fs.existsSync(fullPath)) {
                    const stat = fs.statSync(fullPath);

                    if (stat.isDirectory()) {
                        // Remove directory recursively
                        fs.rmSync(fullPath, { recursive: true, force: true });
                        deletedItems.push(`Directory: ${filePath}`);
                    } else {
                        // Remove file
                        fs.unlinkSync(fullPath);
                        deletedItems.push(`File: ${filePath}`);
                    }
                } else {
                    consoleLog('info', `Template file not found during deletion: ${filePath}`, {
                        templateId: templateId,
                        missingPath: filePath
                    });
                }
            } catch (fileError) {
                consoleLog('error', `Error deleting template file: ${filePath}`, {
                    templateId: templateId,
                    filePath: filePath,
                    error: fileError.message,
                    user: res.locals.user?.username
                });
                errors.push(`${filePath}: ${fileError.message}`);
            }
        }

        // Clear template-related caches
        clearCache();

        consoleLog('info', `Template deleted successfully: ${templateId}`, {
            templateId: templateId,
            deletedItems: deletedItems,
            errors: errors.length > 0 ? errors : undefined,
            user: res.locals.user?.username
        });

        return response(res, 200, i18n.translateSync('api.requests.template_deleted', { template: templateId }, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', `Template deletion error: ${error.message}`, {
            templateId: req.params?.templateId,
            error: error.message,
            stack: error.stack,
            user: res.locals.user?.username
        });
        return response(res, 500, i18n.translateSync('api.requests.template_delete_failed', {}, req.language?.current || 'en'));
    }
};

const importerApiEndpoint = async (req, res) => {
    try {
        const purchaseCode = await getSetting('purchase_code', '');

        if (!purchaseCode) {
            return response(res, 400, i18n.translateSync('api.requests.purchase_code_required', {}, req.language?.current || 'en'));
        }

        // Build API URL with parameters
        const apiBaseUrl = 'https://api.titansystems.ph/arcade';
        const params = new URLSearchParams({
            code: purchaseCode,
            page: req.query.page || 1,
            limit: req.query.limit || 20
        });

        if (req.query.search) params.append('search', req.query.search);
        if (req.query.category) params.append('category', req.query.category);
        if (req.query.rom_type) params.append('rom_type', req.query.rom_type);

        const apiUrl = `${apiBaseUrl}/games?${params.toString()}`;

        const apiResponse = await axios.get(apiUrl, {
            timeout: 5000, // 10 seconds timeout
        });

        // Parse response and add full URLs
        const responseData = apiResponse.data.data;

        // Add full URLs to games
        if (responseData.games) {
            responseData.games = responseData.games.map(game => ({
                ...game,
                thumbnail: game.thumbnail ? `${apiBaseUrl}${game.thumbnail}` : false,
                game_file: `${apiBaseUrl}${game.game_file}`
            }));
        }

        return response(res, 200, i18n.translateSync('api.requests.games_retrieved', {}, req.language?.current || 'en'), !responseData ? [] : responseData);
    } catch (error) {
        consoleLog('error', 'Importer API error', { error: error.message });

        return response(res, 503, i18n.translateSync('api.requests.api_connection_failed', {}, req.language?.current || 'en'));
    }
};

const importGameEndpoint = async (req, res) => {
    if (!res.locals.user || res.locals.user.user_type !== 'admin') {
        return response(res, 403, i18n.translateSync('api.requests.admin_required', {}, req.language?.current || 'en'));
    }

    try {
        const gameData = req.body;

        // Debug: Log received data
        consoleLog('debug', 'Import endpoint received gameData', {
            gameData: JSON.stringify(gameData, null, 2),
            availableFields: gameData ? Object.keys(gameData) : 'no gameData'
        });

        if (!gameData) {
            return response(res, 400, i18n.translateSync('api.requests.no_game_data', {}, req.language?.current || 'en'));
        }

        // Normalize field names to handle different API response structures
        const normalizedGameData = {
            id: gameData.id,
            title: gameData.title,
            game_type: gameData.game_type,
            game_file: gameData.game_file || gameData.file || gameData.download_url || gameData.url,
            thumbnail: gameData.thumbnail || gameData.image || gameData.thumb,
            game_desc: gameData.game_desc || gameData.description || gameData.desc,
            game_category: gameData.game_category || gameData.category,
            game_controls: gameData.game_controls || gameData.controls,
            game_tags: gameData.game_tags || gameData.tags,
            rom_type: gameData.rom_type
        };

        const missingFields = [];
        if (!normalizedGameData.id) missingFields.push('id');
        if (!normalizedGameData.title) missingFields.push('title');
        if (!normalizedGameData.game_type) missingFields.push('game_type');
        if (!normalizedGameData.game_file) missingFields.push('game_file (or file/download_url/url)');

        if (missingFields.length > 0) {
            return response(res, 400, i18n.translateSync('api.requests.missing_required_fields', { fields: missingFields.join(', ') }, req.language?.current || 'en'));
        }

        // Use normalized data for the rest of the process
        Object.assign(gameData, normalizedGameData);

        // Check if game is already imported
        const existingGame = await getGameByImportId(gameData.id);
        if (existingGame) {
            return response(res, 409, i18n.translateSync('api.requests.game_already_imported', { title: gameData.title }, req.language?.current || 'en'), {
                gameId: existingGame.id,
                slug: existingGame.slug
            });
        }

        // Map API category to local category ID
        const categoryId = await mapApiCategoryToLocal(gameData.game_category);
        if (!categoryId) {
            return response(res, 400, i18n.translateSync('api.requests.category_not_found_import', { category: gameData.game_category }, req.language?.current || 'en'));
        }

        // Generate unique slug
        const gameSlug = await generateUniqueSlug(gameData.title, 'games');

        // Map game type and validate
        let localGameType;
        switch (gameData.game_type.toLowerCase()) {
            case 'html5':
                localGameType = 'html';
                break;
            case 'flash':
            case 'swf':
                localGameType = 'flash';
                break;
            case 'rom':
                localGameType = 'rom';
                // Ensure ROM type is provided for ROM games
                if (!gameData.rom_type) {
                    return response(res, 400, i18n.translateSync('api.requests.rom_type_required', {}, req.language?.current || 'en'));
                }
                break;
            default:
                return response(res, 400, i18n.translateSync('api.requests.unsupported_game_type', { type: gameData.game_type }, req.language?.current || 'en'));
        }

        // Prepare game data for local creation
        const localGameData = {
            title: gameData.title,
            slug: gameSlug,
            description: gameData.game_desc || null,
            short_description: gameData.game_desc ? gameData.game_desc.substring(0, 500) : null,
            category_id: categoryId,
            game_type: localGameType,
            rom_system: (localGameType === 'rom' && gameData.rom_type) ? gameData.rom_type : null,
            width: 800,
            height: 600,
            controls: gameData.game_controls || null,
            tags: gameData.game_tags || null,
            is_featured: 0,
            is_active: 1,
            sort_order: 0,
            api_enabled: 0,
            import_id: parseInt(gameData.id),
            created_by: res.locals.user.id
        };

        consoleLog('debug', 'Creating game with data:', {
            data: {
                title: localGameData.title,
                game_type: localGameData.game_type,
                rom_system: localGameData.rom_system,
                import_id: localGameData.import_id
            }
        });

        // Create game record first
        const gameId = await create("games", localGameData);

        if (!gameId) {
            return response(res, 500, i18n.translateSync('api.requests.game_record_create_failed', {}, req.language?.current || 'en'));
        }

        let thumbnailPath = null;
        let gameFilePath = null;

        try {
            // Download and process thumbnail if available
            if (gameData.thumbnail) {
                thumbnailPath = await downloadAndProcessThumbnail(gameData.thumbnail, gameSlug);
            }

            // Download and process game file based on type
            consoleLog('info', 'Processing game file', {
                gameType: localGameType,
                gameTitle: gameData.title,
                romType: localGameType === 'rom' ? gameData.rom_type : null
            });
            gameFilePath = await downloadAndProcessGameFile(gameData.game_file, gameSlug, localGameType, gameData.rom_type);

            // Update game record with file paths
            const updateData = {};
            if (thumbnailPath) updateData.thumbnail = thumbnailPath;
            if (gameFilePath) updateData.game_file = gameFilePath;

            if (Object.keys(updateData).length > 0) {
                await update(gameId, false, "games", updateData);
            }

            // Clear game-related caches
            await CacheUtils.invalidateGameCaches();

            return response(res, 200, i18n.translateSync('api.requests.game_imported', { title: gameData.title }, req.language?.current || 'en'), {
                gameId: gameId,
                slug: gameSlug
            });

        } catch (fileError) {
            // Clean up on file processing error - delete any created assets
            if (gameId) {
                const gameToDelete = await getGameById(gameId);
                if (gameToDelete && gameToDelete[0]) {
                    await deleteGameAssets(gameToDelete[0]);
                }
                await remove(gameId, false, "games");
            }
            throw fileError;
        }

    } catch (error) {
        consoleLog('error', 'Game import error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.requests.import_failed', { error: error.message }, req.language?.current || 'en'));
    }
};

// Advertisement API endpoints
const showAdEndpoint = async (req, res) => {
    try {
        const { game_id, ad_type, placement_context } = req.body;

        if (!ad_type) {
            return response(res, 400, i18n.translateSync('api.requests.ad_type_required', {}, req.language?.current || 'en'));
        }

        const adResult = await getAdForGameContext(null, ad_type, placement_context || {});

        if (adResult && adResult.ad_code) {
            return response(res, 200, i18n.translateSync('api.requests.ad_retrieved', {}, req.language?.current || 'en'), {
                ad_code: adResult.ad_code,
                placement_info: {
                    id: adResult.id,
                    placement_slug: adResult.placement_slug
                }
            });
        }

        return response(res, 404, i18n.translateSync('api.requests.no_suitable_ad', {}, req.language?.current || 'en'));

    } catch (error) {
        consoleLog('error', 'Show ad endpoint error', error);
        return response(res, 500, i18n.translateSync('api.requests.ad_retrieve_failed', { error: error.message }, req.language?.current || 'en'));
    }
};


const getBannerAdEndpoint = async (req, res) => {
    try {
        const { width, height, placement } = req.query;

        if (!width || !height) {
            return response(res, 400, i18n.translateSync('api.requests.width_height_required', {}, req.language?.current || 'en'));
        }

        // Determine placement based on device type and provided placement
        let finalPlacement = placement || 'header-banner';

        const ad = await getRandomAdForPlacementSlug(finalPlacement);

        if (ad) {
            return response(res, 200, i18n.translateSync('api.requests.banner_ad_retrieved', {}, req.language?.current || 'en'), {
                ad_code: ad.ad_code,
                placement_id: ad.placement_id,
                ad_id: ad.id
            });
        }

        return response(res, 404, i18n.translateSync('api.requests.no_suitable_banner_ad', {}, req.language?.current || 'en'));

    } catch (error) {
        consoleLog('error', 'Get banner ad endpoint error', error);
        return response(res, 500, i18n.translateSync('api.requests.banner_ad_retrieve_failed', { error: error.message }, req.language?.current || 'en'));
    }
};

/**
 * API endpoint for leaderboard data
 */
const getLeaderboardData = async (req, res) => {
    const period = req.params.period || 'all-time';
    const limit = parseInt(req.query.limit) || 50;

    try {

        // Create cache key
        const cacheKey = `exp-leaderboard-${period}-${limit}`;

        // Check cache
        const cachedData = await CacheUtils.get('leaderboard-data', cacheKey);
        if (cachedData) {
            return response(res, 200, i18n.translateSync('api.requests.leaderboard_retrieved', {}, req.language?.current || 'en'), cachedData);
        }
        let leaderboardData = [];

        // Get leaderboard based on period using EXP system
        try {
            switch (period) {
                case 'weekly':
                    leaderboardData = await getWeeklyTopUsersByExp(limit);
                    break;
                case 'monthly':
                    leaderboardData = await getMonthlyTopUsersByExp(limit);
                    break;
                case 'all-time':
                default:
                    leaderboardData = await getTopUsersByExp(limit);
                    break;
            }

        } catch (dbError) {
            consoleLog('error', 'Database query error in leaderboard', {
                period,
                limit,
                error: dbError.message
            });
            leaderboardData = [];
        }

        // Add rank and avatar data
        const finalPlayers = leaderboardData.map((player, index) => ({
            ...player,
            rank: index + 1, // Display rank for UI
            avatarUrl: getUserAvatarUrl(player),
            displayName: player.first_name || player.username,
            // Standardize numeric data with validation for EXP system
            level: validateAndParseInt(player.level, 1),
            exp_points: validateAndParseInt(player.exp_points, 0),
            total_exp_earned: validateAndParseBigInt(player.total_exp_earned, 0),
            // Include weekly/monthly EXP gained if available
            weekly_exp_gained: player.weekly_exp_gained ? validateAndParseInt(player.weekly_exp_gained, 0) : 0,
            monthly_exp_gained: player.monthly_exp_gained ? validateAndParseInt(player.monthly_exp_gained, 0) : 0
        }));

        const responseData = {
            leaderboard: finalPlayers,
            period: period,
            total: finalPlayers.length
        };

        // Cache results for 5 minutes
        await CacheUtils.put('leaderboard-data', cacheKey, responseData);

        return response(res, 200, i18n.translateSync('api.requests.leaderboard_retrieved', {}, req.language?.current || 'en'), responseData);

    } catch (error) {
        consoleLog('error', 'Get leaderboard data error', { error: error.message, period, limit });
        return response(res, 500, i18n.translateSync('api.requests.leaderboard_error', {}, req.language?.current || 'en'));
    }
};


export {
    createRequest,
    updateRequest,
    removeRequest,
    updateProfile,
    updatePassword,
    updateAdditional,
    exportData,
    followUserEndpoint,
    unfollowUserEndpoint,
    rateGameEndpoint,
    postCommentEndpoint,
    loadCommentsEndpoint,
    deleteCommentEndpoint,
    toggleFavoriteEndpoint,
    getGameDataEndpoint,
    searchGamesEndpoint,
    arcadeSubmitScoreEndpoint,
    arcadeGetLeaderboardEndpoint,
    arcadeGetUserBestEndpoint,
    getUserProfileEndpoint,
    clearCacheEndpoint,
    rebuildAssetsEndpoint,
    activateTemplate,
    deleteTemplate,
    importerApiEndpoint,
    importGameEndpoint,
    showAdEndpoint,
    getBannerAdEndpoint,
    getLeaderboardData
}