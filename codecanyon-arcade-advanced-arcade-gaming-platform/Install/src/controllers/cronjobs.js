import { consoleLog } from '../utils/logger.js';
import { getSetting } from '../models/settings.js';
import i18n from '../utils/i18n.js';
import { deleteExpiredTokens } from '../models/password_reset_tokens.js';
import { cleanupOldEmailLogs } from '../models/email_logs.js';
import { cleanupOldLogs, createCronLogEntry, getRecentCronLogs, getCronStatusCounts } from '../models/cron_logs.js';
import { cleanupSearchQueriesKeepTop } from '../models/search_queries.js';
import { 
    optimizeAllTables, 
    updateGameLeaderboardRankings,
    getUserStatistics,
    getGameStatistics,
    getTopGamesByPlays,
    getActivityStatistics,
    getSearchStatistics,
    updateCronLastRun
} from '../models/maintenance.js';
import CacheUtils from '../utils/cache.js';
import response from '../utils/response.js';
import ThumbnailGridGenerator from '../utils/thumbnail_grid.js';

/**
 * Middleware to authenticate cron job requests
 */
export const authenticateCron = async (req, res, next) => {
    try {
        const { password } = req.query;
        const cronEnabled = await getSetting('enable_cron_jobs', '0');
        
        if (cronEnabled !== '1') {
            return response(res, 403, i18n.translateSync('api.cronjobs.disabled', {}, req.language?.current || 'en'));
        }
        
        const cronPassword = await getSetting('cron_password', '');
        if (!cronPassword) {
            return response(res, 500, i18n.translateSync('api.cronjobs.password_not_configured', {}, req.language?.current || 'en'));
        }
        
        if (!password || password !== cronPassword) {
            consoleLog('warn', 'Unauthorized cron job access attempt', { 
                ip: req.ip, 
                userAgent: req.get('User-Agent'),
                path: req.path 
            });
            return response(res, 401, i18n.translateSync('api.cronjobs.invalid_password', {}, req.language?.current || 'en'));
        }
        
        next();
    } catch (error) {
        consoleLog('error', 'Cron authentication error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.cronjobs.auth_error', {}, req.language?.current || 'en'));
    }
};

/**
 * Log cron job execution
 */
const logCronExecution = async (jobName, status, message = null, executionTime = null, memoryUsage = null, recordsProcessed = null) => {
    try {
        await createCronLogEntry(jobName, status, message, executionTime, memoryUsage, recordsProcessed);
    } catch (error) {
        consoleLog('error', 'Failed to log cron execution', { error: error.message });
    }
};

/**
 * Daily cleanup cron job
 * Removes expired tokens, old logs, and optimizes database
 */
export const dailyCleanup = async (req, res) => {
    const startTime = Date.now();
    const jobName = 'daily_cleanup';
    
    try {
        consoleLog('info', 'Starting daily cleanup cron job');
        let totalProcessed = 0;
        const tasks = [];

        // 1. Delete expired password reset tokens
        const expiredTokens = await deleteExpiredTokens();
        totalProcessed += expiredTokens;
        tasks.push(`Deleted ${expiredTokens} expired password reset tokens`);

        // 2. Clean up old email logs (older than 90 days)
        const emailLogCleanup = await cleanupOldEmailLogs(90);
        totalProcessed += emailLogCleanup.affectedRows;
        tasks.push(`Cleaned ${emailLogCleanup.affectedRows} old email logs`);

        // 3. Clean up old cron logs (older than 30 days)
        const cronLogCleanup = await cleanupOldLogs(30);
        totalProcessed += cronLogCleanup.affectedRows;
        tasks.push(`Cleaned ${cronLogCleanup.affectedRows} old cron logs`);

        // 4. Clean up old search queries (keep only top 1000)
        const searchCleanup = await cleanupSearchQueriesKeepTop(1000);
        totalProcessed += searchCleanup.affectedRows;
        tasks.push(`Cleaned ${searchCleanup.affectedRows} old search queries`);

        // 5. Update last run timestamp
        await updateCronLastRun('cleanup');

        const executionTime = Date.now() - startTime;
        const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        
        const message = `Daily cleanup completed successfully: ${tasks.join('; ')}`;
        await logCronExecution(jobName, 'completed', message, executionTime, memoryUsage, totalProcessed);
        
        consoleLog('info', 'Daily cleanup cron job completed', { 
            executionTime: `${executionTime}ms`,
            recordsProcessed: totalProcessed,
            tasks: tasks
        });

        return response(res, 200, i18n.translateSync('api.cronjobs.daily_cleanup_success', {}, req.language?.current || 'en'), {
            executionTime: `${executionTime}ms`,
            recordsProcessed: totalProcessed,
            tasks: tasks
        });

    } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = `Daily cleanup failed: ${error.message}`;
        
        await logCronExecution(jobName, 'failed', errorMessage, executionTime);
        
        consoleLog('error', 'Daily cleanup cron job failed', { 
            error: error.message,
            executionTime: `${executionTime}ms`
        });

        return response(res, 500, i18n.translateSync('api.cronjobs.daily_cleanup_failed', {}, req.language?.current || 'en'), { error: error.message });
    }
};

/**
 * Weekly maintenance cron job
 * Optimizes database tables and clears cache
 */
export const weeklyMaintenance = async (req, res) => {
    const startTime = Date.now();
    const jobName = 'weekly_maintenance';
    
    try {
        consoleLog('info', 'Starting weekly maintenance cron job');
        const tasks = [];

        // 1. Optimize database tables
        const optimizationResults = await optimizeAllTables();
        tasks.push(...optimizationResults);

        // 2. Clear all caches
        try {
            const caches = ['homepage-games', 'custom-pages', 'sidebar-categories'];
            for (const cacheName of caches) {
                await CacheUtils.clear(cacheName);
            }
            tasks.push('Cleared all application caches');
        } catch (error) {
            consoleLog('warn', 'Failed to clear some caches', { error: error.message });
        }

        // 3. Update game leaderboard rankings
        try {
            await updateGameLeaderboardRankings();
            tasks.push('Updated game leaderboard rankings');
        } catch (error) {
            consoleLog('warn', 'Failed to update leaderboard rankings', { error: error.message });
        }

        // 4. Update last run timestamp
        await updateCronLastRun('maintenance');

        const executionTime = Date.now() - startTime;
        const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        
        const message = `Weekly maintenance completed successfully: ${tasks.join('; ')}`;
        await logCronExecution(jobName, 'completed', message, executionTime, memoryUsage, tasks.length);
        
        consoleLog('info', 'Weekly maintenance cron job completed', { 
            executionTime: `${executionTime}ms`,
            tasksCompleted: tasks.length,
            tasks: tasks
        });

        return response(res, 200, i18n.translateSync('api.cronjobs.weekly_maintenance_success', {}, req.language?.current || 'en'), {
            executionTime: `${executionTime}ms`,
            tasksCompleted: tasks.length,
            tasks: tasks
        });

    } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = `Weekly maintenance failed: ${error.message}`;
        
        await logCronExecution(jobName, 'failed', errorMessage, executionTime);
        
        consoleLog('error', 'Weekly maintenance cron job failed', { 
            error: error.message,
            executionTime: `${executionTime}ms`
        });

        return response(res, 500, i18n.translateSync('api.cronjobs.weekly_maintenance_failed', {}, req.language?.current || 'en'), { error: error.message });
    }
};

/**
 * Monthly reports cron job
 * Generates usage statistics and analytics
 */
export const monthlyReports = async (req, res) => {
    const startTime = Date.now();
    const jobName = 'monthly_reports';
    
    try {
        consoleLog('info', 'Starting monthly reports cron job');
        const reports = {};

        // 1. User statistics
        const userStats = await getUserStatistics();
        reports.users = userStats[0];

        // 2. Game statistics
        const gameStats = await getGameStatistics();
        reports.games = gameStats[0];

        // 3. Top games by plays
        const topGames = await getTopGamesByPlays(10);
        reports.topGames = topGames;

        // 4. Activity statistics
        const activityStats = await getActivityStatistics();
        reports.activity = activityStats[0];

        // 5. Search statistics
        const searchStats = await getSearchStatistics();
        reports.search = searchStats[0];

        // 6. Update last run timestamp
        await updateCronLastRun('reports');

        const executionTime = Date.now() - startTime;
        const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        
        const message = `Monthly reports generated successfully: ${Object.keys(reports).length} report sections`;
        await logCronExecution(jobName, 'completed', message, executionTime, memoryUsage, Object.keys(reports).length);
        
        consoleLog('info', 'Monthly reports cron job completed', { 
            executionTime: `${executionTime}ms`,
            reportsGenerated: Object.keys(reports).length,
            reports: reports
        });

        return response(res, 200, i18n.translateSync('api.cronjobs.monthly_reports_success', {}, req.language?.current || 'en'), {
            executionTime: `${executionTime}ms`,
            reports: reports
        });

    } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = `Monthly reports failed: ${error.message}`;
        
        await logCronExecution(jobName, 'failed', errorMessage, executionTime);
        
        consoleLog('error', 'Monthly reports cron job failed', { 
            error: error.message,
            executionTime: `${executionTime}ms`
        });

        return response(res, 500, i18n.translateSync('api.cronjobs.monthly_reports_failed', {}, req.language?.current || 'en'), { error: error.message });
    }
};

/**
 * Weekly thumbnail grid generation cron job
 * Generates social media thumbnail grid for homepage
 */
export const weeklyThumbnailGrid = async (req, res) => {
    const startTime = Date.now();
    const jobName = 'weekly_thumbnail_grid';
    
    try {
        consoleLog('info', 'Starting weekly thumbnail grid generation cron job');
        
        const gridGenerator = new ThumbnailGridGenerator();
        
        // Check if regeneration is needed
        const needsRegeneration = await gridGenerator.needsRegeneration();
        
        let result;
        if (needsRegeneration) {
            consoleLog('info', 'Generating new thumbnail grid');
            result = await gridGenerator.generateGrid();
        } else {
            consoleLog('info', 'Thumbnail grid is up to date, skipping generation');
            result = {
                imagePath: '/assets/images/social/homepage-grid.jpg',
                metadata: await gridGenerator.getGridMetadata(),
                success: true,
                skipped: true
            };
        }

        // Update last run timestamp
        await updateCronLastRun('thumbnail_grid');

        const executionTime = Date.now() - startTime;
        const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        
        const gamesProcessed = result.metadata?.gameCount || 0;
        const message = result.skipped 
            ? 'Thumbnail grid was up to date, no regeneration needed'
            : `Thumbnail grid generated successfully with ${gamesProcessed} games`;
            
        await logCronExecution(jobName, 'completed', message, executionTime, memoryUsage, gamesProcessed);
        
        consoleLog('info', 'Weekly thumbnail grid cron job completed', { 
            executionTime: `${executionTime}ms`,
            gamesProcessed,
            imagePath: result.imagePath,
            skipped: result.skipped || false
        });

        return response(res, 200, i18n.translateSync('api.cronjobs.thumbnail_grid_success', {}, req.language?.current || 'en'), {
            executionTime: `${executionTime}ms`,
            gamesProcessed,
            imagePath: result.imagePath,
            metadata: result.metadata,
            skipped: result.skipped || false
        });

    } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = `Thumbnail grid generation failed: ${error.message}`;
        
        await logCronExecution(jobName, 'failed', errorMessage, executionTime);
        
        consoleLog('error', 'Weekly thumbnail grid cron job failed', { 
            error: error.message,
            executionTime: `${executionTime}ms`
        });

        return response(res, 500, i18n.translateSync('api.cronjobs.thumbnail_grid_failed', {}, req.language?.current || 'en'), { error: error.message });
    }
};

/**
 * Get cron job status and last run times
 */
export const getCronStatus = async (req, res) => {
    try {
        const [cronEnabled, lastCleanup, lastMaintenance, lastReports, lastThumbnailGrid] = await Promise.all([
            getSetting('enable_cron_jobs', '0'),
            getSetting('cron_last_run_cleanup', null),
            getSetting('cron_last_run_maintenance', null),
            getSetting('cron_last_run_reports', null),
            getSetting('cron_last_run_thumbnail_grid', null)
        ]);

        // Get recent cron logs
        const recentLogs = await getRecentCronLogs(20);

        // Get cron job counts by status
        const statusCounts = await getCronStatusCounts();

        return response(res, 200, i18n.translateSync('api.cronjobs.status_retrieved', {}, req.language?.current || 'en'), {
            enabled: cronEnabled === '1',
            lastRuns: {
                cleanup: lastCleanup,
                maintenance: lastMaintenance,
                reports: lastReports,
                thumbnailGrid: lastThumbnailGrid
            },
            recentLogs: recentLogs,
            statusCounts: statusCounts
        });

    } catch (error) {
        consoleLog('error', 'Failed to get cron status', { error: error.message });
        return response(res, 500, i18n.translateSync('api.cronjobs.status_failed', {}, req.language?.current || 'en'), { error: error.message });
    }
};

export default {
    authenticateCron,
    dailyCleanup,
    weeklyMaintenance,
    monthlyReports,
    weeklyThumbnailGrid,
    getCronStatus
};