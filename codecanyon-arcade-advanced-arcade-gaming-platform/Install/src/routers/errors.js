import express from 'express';
import * as controller from '../controllers/errors.js';

const router = express.Router();

router.get('/404', controller.notfound);
router.get('/401', controller.invalid);
router.get('/400', controller.system);
router.get('/402', controller.denied);
router.get('/500', controller.server);

export default router;
