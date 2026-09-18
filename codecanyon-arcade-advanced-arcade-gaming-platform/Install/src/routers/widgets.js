
import express from 'express';
import adminAuthResponse from '../middlewares/admin_auth_response.js';
import * as controller from '../controllers/widgets.js';

const router = express.Router();

router.get('/create/:modalTemplate', adminAuthResponse, controller.create);
router.get('/update/:modalTemplate/:id', adminAuthResponse, controller.update);
router.get('/static/:modalTemplate', adminAuthResponse, controller.staticModal);

export default router;