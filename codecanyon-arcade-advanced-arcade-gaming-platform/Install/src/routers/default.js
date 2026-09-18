
import express from 'express';
import * as controller from '../controllers/default.js';
import * as authController from '../controllers/auth.js';

const router = express.Router();

router.get('/', controller.index);
router.get('/login', controller.login);
router.get('/register', controller.register);
router.get('/forgot-password', authController.forgotPassword);
router.get('/reset-password/:token', authController.resetPassword);
router.get('/verify-email/:token', authController.verifyEmail);
router.get('/games', controller.games);
router.get('/games/page/:page', controller.games);
router.get('/games/category/:slug', controller.gamesCategory);
router.get('/games/category/:slug/page/:page', controller.gamesCategory);
router.get('/games/tag/:tag', controller.gamesTag);
router.get('/games/tag/:tag/page/:page', controller.gamesTag);
router.get('/games/top', controller.gamesTop);
router.get('/games/top/page/:page', controller.gamesTop);
router.get('/games/popular', controller.gamesPopular);
router.get('/games/popular/page/:page', controller.gamesPopular);
router.get('/games/trending', controller.gamesTrending);
router.get('/games/trending/page/:page', controller.gamesTrending);
router.get('/games/featured', controller.gamesFeatured);
router.get('/games/featured/page/:page', controller.gamesFeatured);
router.get('/games/recent', controller.gamesRecent);
router.get('/games/recent/page/:page', controller.gamesRecent);
router.get('/games/favorites', controller.gamesFavorites);
router.get('/games/favorites/page/:page', controller.gamesFavorites);
router.get('/play/:slug', controller.play);
router.get('/emulator/:gameId', controller.emulator);
router.get('/profile/:username?', controller.profile);
router.get('/settings', controller.settings);
router.get('/search/:query', controller.search);
router.get('/search/:query/page/:page', controller.search);
router.get('/page/:slug', controller.customPage);
router.get('/leaderboard', controller.getLeaderboardPage);

// SEO routes
router.get('/sitemap.xml', controller.getSitemap);
router.get('/robots.txt', controller.getRobotsTxt);

export default router;