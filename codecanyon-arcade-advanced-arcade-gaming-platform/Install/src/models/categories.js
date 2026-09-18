import executeQuery from "../utils/mysql.js";
import { consoleLog } from '../utils/logger.js';

const getCategoryById = async (id) => {
    const data = await executeQuery("SELECT * FROM categories WHERE id = ? LIMIT 1", [id]);
    return data;
}

const getCategoryBySlug = async (slug) => {
    const data = await executeQuery("SELECT * FROM categories WHERE slug = ? LIMIT 1", [slug]);
    return data;
}

const getCategoryByName = async (name) => {
    const data = await executeQuery("SELECT * FROM categories WHERE name = ? AND is_active = 1 LIMIT 1", [name]);
    return data.length > 0 ? data[0] : null;
}

const getAllActiveCategories = async () => {
    const data = await executeQuery("SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC", []);
    return data;
}

const getRandomCategories = async (limit = 10) => {
    try {
        const safeLimit = Math.max(1, parseInt(limit) || 10);
        const data = await executeQuery(`SELECT * FROM categories WHERE is_active = 1 ORDER BY RAND() LIMIT ${safeLimit}`, []);
        return data || [];
    } catch (error) {
        consoleLog('error', 'Error in getRandomCategories', { error: error.message });
        return [];
    }
}

const getRandomCategoriesWithGames = async (limit = 9) => {
    try {
        const safeLimit = Math.max(1, parseInt(limit) || 9);
        const data = await executeQuery(`
            SELECT DISTINCT c.* 
            FROM categories c 
            INNER JOIN games g ON c.id = g.category_id 
            WHERE c.is_active = 1 AND g.is_active = 1 
            ORDER BY RAND() 
            LIMIT ${safeLimit}
        `, []);
        return data || [];
    } catch (error) {
        consoleLog('error', 'Error in getRandomCategoriesWithGames', { error: error.message });
        return [];
    }
}

const getAllCategories = getAllActiveCategories;

// Helper function to parse and get optimized image URL
const getOptimizedCategoryImageUrl = (imageData, size = 'standard', supportsWebP = true) => {
    if (!imageData) {
        return '/assets/images/default-avatar.jpg';
    }
    
    // Handle old format (simple path)
    if (typeof imageData === 'string' && !imageData.startsWith('{')) {
        return imageData.startsWith('/') ? imageData : `/${imageData}`;
    }
    
    // Handle new format (JSON)
    try {
        const parsedData = typeof imageData === 'string' ? JSON.parse(imageData) : imageData;
        
        if (!parsedData.webp || !parsedData.original) {
            return '/assets/images/default-avatar.jpg';
        }
        
        const sizeData = supportsWebP ? parsedData.webp[size] : parsedData.original[size];
        
        if (!sizeData) {
            // Fallback to available size
            const availableSizes = Object.keys(supportsWebP ? parsedData.webp : parsedData.original);
            const fallbackSize = availableSizes.includes('standard') ? 'standard' : availableSizes[0];
            const fallbackData = supportsWebP ? parsedData.webp[fallbackSize] : parsedData.original[fallbackSize];
            return fallbackData ? `/${fallbackData.relativePath}` : '/assets/images/default-avatar.jpg';
        }
        
        return `/${sizeData.relativePath}`;
    } catch (error) {
        return '/assets/images/default-avatar.jpg';
    }
};

// Helper function to generate picture HTML for responsive images
const generateCategoryPictureHTML = (imageData, alt = '', className = '', size = 'standard') => {
    if (!imageData) {
        return `<img src="/assets/images/default-avatar.jpg" alt="${alt}" class="${className}" loading="lazy" />`;
    }
    
    // Handle old format (simple path)
    if (typeof imageData === 'string' && !imageData.startsWith('{')) {
        const src = imageData.startsWith('/') ? imageData : `/${imageData}`;
        return `<img src="${src}" alt="${alt}" class="${className}" loading="lazy" />`;
    }
    
    // Handle new format (JSON with WebP support)
    try {
        const parsedData = typeof imageData === 'string' ? JSON.parse(imageData) : imageData;
        
        if (!parsedData.webp || !parsedData.original) {
            return `<img src="/assets/images/default-avatar.jpg" alt="${alt}" class="${className}" loading="lazy" />`;
        }
        
        const webpImage = parsedData.webp[size];
        const originalImage = parsedData.original[size];
        
        if (!webpImage || !originalImage) {
            return `<img src="/assets/images/default-avatar.jpg" alt="${alt}" class="${className}" loading="lazy" />`;
        }
        
        return `<picture class="${className}">
            <source srcset="/${webpImage.relativePath}" type="image/webp">
            <img src="/${originalImage.relativePath}" alt="${alt}" loading="lazy">
        </picture>`;
    } catch (error) {
        return `<img src="/assets/images/default-avatar.jpg" alt="${alt}" class="${className}" loading="lazy" />`;
    }
};

export {
    getCategoryById,
    getCategoryBySlug,
    getCategoryByName,
    getAllActiveCategories,
    getAllCategories,
    getRandomCategories,
    getRandomCategoriesWithGames,
    getOptimizedCategoryImageUrl,
    generateCategoryPictureHTML
}