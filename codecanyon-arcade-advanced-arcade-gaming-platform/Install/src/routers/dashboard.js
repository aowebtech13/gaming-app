import express from 'express';
import adminAuth from '../middlewares/admin_auth.js';
import * as controller from '../controllers/dashboard.js';

const router = express.Router();

router.get('/', adminAuth, controller.index);
router.get('/overview', adminAuth, controller.overview);
router.get('/users', adminAuth, controller.users);
router.get('/games', adminAuth, controller.games);
router.get('/categories', adminAuth, controller.categories);
router.get('/favorites', adminAuth, controller.favorites);
router.get('/importer', adminAuth, controller.importer);
router.get('/follows', adminAuth, controller.follows);
router.get('/comments', adminAuth, controller.comments);
router.get('/pages', adminAuth, controller.pages);
router.get('/exp_ranks', adminAuth, controller.exp_ranks);
router.get('/exp_events', adminAuth, controller.exp_events);
router.get('/email_logs', adminAuth, controller.email_logs);
router.get('/cron_logs', adminAuth, controller.cron_logs);
router.get('/search_queries', adminAuth, controller.search_queries);
router.get('/game_scores', adminAuth, controller.game_scores);
router.get('/game_leaderboards', adminAuth, controller.game_leaderboards);
router.get('/ad_placements', adminAuth, controller.ad_placements);
router.get('/ads', adminAuth, controller.ads);
router.get('/templates', adminAuth, controller.templates);

export default router;
