import express from 'express';
import { getAvailableLanguages, changeLanguage, getCurrentLanguage } from '../controllers/languages.js';

const router = express.Router();

// Get available languages
router.get('/available', getAvailableLanguages);

// Get current language info
router.get('/current', getCurrentLanguage);

// Change language
router.post('/change', changeLanguage);

export default router;