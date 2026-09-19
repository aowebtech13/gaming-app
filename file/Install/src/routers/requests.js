import express from 'express';
import multer from 'multer';
import adminAuthResponse from '../middlewares/admin_auth_response.js';
import * as controller from '../controllers/requests.js';

const router = express.Router();
const upload = multer(); // Configure multer

router.post("/create/:tpl",
    upload.any(),
    adminAuthResponse,
    controller.createRequest
);

router.post("/update/:tpl",
    upload.any(),
    adminAuthResponse,
    controller.updateRequest
);

router.get("/delete/:tpl/:id", adminAuthResponse, controller.removeRequest);

// User settings routes (no admin auth required)
router.post("/update-profile", upload.any(), controller.updateProfile);
router.post("/update-password", upload.any(), controller.updatePassword);
router.post("/update-additional", upload.any(), controller.updateAdditional);
router.get("/export-data", controller.exportData);
router.get("/user-profile", controller.getUserProfileEndpoint);

// Leaderboard API route  
router.get("/leaderboard/:period", controller.getLeaderboardData);

// Follow management routes
router.post("/follow-user", upload.any(), controller.followUserEndpoint);
router.post("/unfollow-user", upload.any(), controller.unfollowUserEndpoint);

// Game interaction routes
router.get("/game-data/:slug", controller.getGameDataEndpoint);
router.post("/rate-game", upload.any(), controller.rateGameEndpoint);
router.post("/post-comment", upload.any(), controller.postCommentEndpoint);
router.get("/load-comments", controller.loadCommentsEndpoint);
router.post("/delete-comment", upload.any(), controller.deleteCommentEndpoint);
router.post("/toggle-favorite", upload.any(), controller.toggleFavoriteEndpoint);

// Search routes
router.get("/search-games", controller.searchGamesEndpoint);

// Score API routes for iframe games
router.post("/score/submit-score", upload.any(), controller.arcadeSubmitScoreEndpoint);
router.get("/score/leaderboard/:game_id", controller.arcadeGetLeaderboardEndpoint);
router.get("/score/user-best/:game_id", controller.arcadeGetUserBestEndpoint);
router.post("/score/show-ad", upload.any(), controller.showAdEndpoint);
router.get("/banner-ad", controller.getBannerAdEndpoint);

// System administration routes
router.post("/clear-cache", adminAuthResponse, controller.clearCacheEndpoint);
router.post("/rebuild-assets", adminAuthResponse, controller.rebuildAssetsEndpoint);
router.post("/activate-template", upload.any(), adminAuthResponse, controller.activateTemplate);
router.get("/delete-template/:templateId", adminAuthResponse, controller.deleteTemplate);
router.get("/importer", adminAuthResponse, controller.importerApiEndpoint);
router.post("/import-game", express.json(), adminAuthResponse, controller.importGameEndpoint);

export default router;
