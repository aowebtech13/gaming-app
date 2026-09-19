import express from 'express';
import multer from 'multer';
import * as controller from '../controllers/auth.js';
import { 
    facebookAuth, 
    facebookCallback, 
    googleAuth, 
    googleCallback 
} from '../controllers/oauth.js';

const router = express.Router();
const upload = multer(); // Configure multer

// Authentication pages
router.get('/login', controller.login);
router.get('/register', controller.register);
router.get('/forgot-password', controller.forgotPassword);
router.get('/reset-password/:token', controller.resetPassword);

// Email verification
router.get('/verify-email/:token', controller.verifyEmail);
router.post('/resend-verification', upload.any(), (req, res, next) => req.verifyCSRF(req, res, next), controller.resendVerificationEmail);

// Authentication processing (with CSRF verification after multer)
router.post('/login', upload.any(), (req, res, next) => req.verifyCSRF(req, res, next), controller.processLogin);
router.post('/register', upload.any(), (req, res, next) => req.verifyCSRF(req, res, next), controller.processRegister);
router.post('/forgot-password', upload.any(), (req, res, next) => req.verifyCSRF(req, res, next), controller.processForgotPassword);
router.post('/reset-password', upload.any(), (req, res, next) => req.verifyCSRF(req, res, next), controller.processResetPassword);
router.post('/logout', upload.any(), (req, res, next) => req.verifyCSRF(req, res, next), controller.logout);
router.get('/logout', controller.logout);

// OAuth routes
router.get('/facebook', facebookAuth);
router.get('/facebook/callback', facebookCallback);
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);

export default router;