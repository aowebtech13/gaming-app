
import express from 'express';
import adminAuthResponse from '../middlewares/admin_auth_response.js';
import * as controller from '../controllers/tables.js';

const router = express.Router();

router.get('/users', adminAuthResponse, controller.users);
router.get('/games', adminAuthResponse, controller.games);
router.get('/categories', adminAuthResponse, controller.categories);
router.get('/favorites', adminAuthResponse, controller.favorites);
router.get('/follows', adminAuthResponse, controller.follows);
router.get('/comments', adminAuthResponse, controller.comments);
router.get('/pages', adminAuthResponse, controller.pages);
router.get('/exp_ranks', adminAuthResponse, controller.exp_ranks);
router.get('/exp_events', adminAuthResponse, controller.exp_events);
router.get('/email_logs', adminAuthResponse, controller.email_logs);
router.get('/cron_logs', adminAuthResponse, controller.cron_logs);
router.get('/search_queries', adminAuthResponse, controller.search_queries);
router.get('/game_scores', adminAuthResponse, controller.game_scores);
router.get('/game_leaderboards', adminAuthResponse, controller.game_leaderboards);
router.get('/ad_placements', adminAuthResponse, controller.ad_placements);
router.get('/ads', adminAuthResponse, controller.ads);

export default router;