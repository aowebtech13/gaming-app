import express from 'express';
import { 
    authenticateCron,
    dailyCleanup,
    weeklyMaintenance, 
    monthlyReports,
    weeklyThumbnailGrid,
    getCronStatus
} from '../controllers/cronjobs.js';

const router = express.Router();

// Apply authentication middleware to all cron routes
router.use(authenticateCron);

// Cron job endpoints
router.get('/daily-cleanup', dailyCleanup);
router.get('/weekly-maintenance', weeklyMaintenance);
router.get('/monthly-reports', monthlyReports);
router.get('/weekly-thumbnail-grid', weeklyThumbnailGrid);

// Status endpoint
router.get('/status', getCronStatus);

export default router;