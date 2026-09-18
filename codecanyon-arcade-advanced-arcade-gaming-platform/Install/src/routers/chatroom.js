import express from 'express';
import multer from 'multer';
import * as controller from '../controllers/chatroom.js';

const router = express.Router();
const upload = multer();

// Main chatroom page
router.get('/', controller.index);

// Chatroom API endpoints
router.post("/award-exp", upload.any(), controller.awardChatroomExpEndpoint);
router.post("/update-character", upload.any(), controller.updateChatroomCharacterEndpoint);
router.post("/save-coordinates", upload.any(), controller.saveChatroomCoordinatesEndpoint);
router.get("/data", controller.getChatroomDataEndpoint);
router.get("/characters-list", controller.getCharacterTypesEndpoint);

// Floating chat API endpoints
router.get("/stats", controller.getChatroomStatsEndpoint);
router.get("/history", controller.getChatHistoryEndpoint);
router.post("/floating-message", upload.any(), controller.sendFloatingChatMessageEndpoint);

// Follow system endpoints for chatroom
router.get("/follow-status/:username", controller.checkFollowStatusEndpoint);
router.post("/follow-user", upload.any(), controller.followUserFromChatroomEndpoint);
router.post("/unfollow-user", upload.any(), controller.unfollowUserFromChatroomEndpoint);


export default router;
