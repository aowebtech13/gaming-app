import express from 'express';
import * as adsController from '../controllers/ads.js';

const router = express.Router();

// Ad serving routes (public endpoints for displaying ads)
router.get('/placement/:placementSlug', adsController.serveAdByPlacementEndpoint);
router.get('/emulator/:adType/:gameId', adsController.emulatorAdEndpoint);

export default router;