import executeQuery from "../utils/mysql.js";
import CacheUtils from '../utils/cache.js';
import { consoleLog } from '../utils/logger.js';

// Initialize ads cache
CacheUtils.initCache('ads', 15 * 60 * 1000); // 15 minutes

const getAllAds = async (limit = null, offset = 0) => {
    if (limit === null) {
        // Return all ads without pagination
        const data = await executeQuery(`
            SELECT a.*, ap.name as placement_name, ap.slug as placement_slug, 
                   ap.placement_type, ap.width, ap.height
            FROM ads a
            INNER JOIN ad_placements ap ON a.placement_id = ap.id
            WHERE a.is_active = 1 AND ap.is_active = 1
            ORDER BY a.created_at DESC
        `, []);
        return data;
    } else {
        // Return paginated results
        const safeLimit = parseInt(limit) || 20;
        const safeOffset = parseInt(offset) || 0;
        
        const data = await executeQuery(`
            SELECT a.*, ap.name as placement_name, ap.slug as placement_slug, 
                   ap.placement_type, ap.width, ap.height
            FROM ads a
            INNER JOIN ad_placements ap ON a.placement_id = ap.id
            WHERE a.is_active = 1 AND ap.is_active = 1
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        `, [safeLimit, safeOffset]);
        return data;
    }
}

const getAdById = async (id) => {
    const data = await executeQuery(`
        SELECT a.*, ap.name as placement_name, ap.slug as placement_slug, 
               ap.placement_type, ap.width, ap.height
        FROM ads a
        INNER JOIN ad_placements ap ON a.placement_id = ap.id
        WHERE a.id = ? 
        LIMIT 1
    `, [id]);
    return data.length > 0 ? data[0] : null;
}

const getAdsByPlacement = async (placementId) => {
    try {
        // Try to get cached ads for placement
        const cacheKey = `ads-by-placement-${placementId}`;
        let ads = await CacheUtils.get('ads', cacheKey);
        
        if (!ads) {
            // Cache miss - fetch fresh data
            ads = await executeQuery(`
                SELECT a.*, ap.name as placement_name, ap.slug as placement_slug, 
                       ap.placement_type, ap.width, ap.height
                FROM ads a
                INNER JOIN ad_placements ap ON a.placement_id = ap.id
                WHERE a.placement_id = ? AND a.is_active = 1 AND ap.is_active = 1
                ORDER BY a.created_at DESC
            `, [placementId]);
            
            // Cache the result for 15 minutes
            await CacheUtils.put('ads', cacheKey, ads);
        }
        
        return ads;
    } catch (error) {
        consoleLog('database', 'Error fetching ads by placement', { error: error.message });
        return [];
    }
}

const getAdsByPlacementSlug = async (placementSlug) => {
    try {
        // Try to get cached ads for placement slug
        const cacheKey = `ads-by-placement-slug-${placementSlug}`;
        let ads = await CacheUtils.get('ads', cacheKey);
        
        if (!ads) {
            // Cache miss - fetch fresh data
            ads = await executeQuery(`
                SELECT a.*, ap.name as placement_name, ap.slug as placement_slug, 
                       ap.placement_type, ap.width, ap.height
                FROM ads a
                INNER JOIN ad_placements ap ON a.placement_id = ap.id
                WHERE ap.slug = ? AND a.is_active = 1 AND ap.is_active = 1
                ORDER BY RAND()
            `, [placementSlug]);
            
            // Cache the result for 15 minutes
            await CacheUtils.put('ads', cacheKey, ads);
        }
        
        return ads;
    } catch (error) {
        consoleLog('database', 'Error fetching ads by placement slug', { error: error.message });
        return [];
    }
}

const getRandomAdForPlacement = async (placementId) => {
    try {
        const ads = await getAdsByPlacement(placementId);
        if (ads.length === 0) return null;
        
        // Return random ad from available ads
        const randomIndex = Math.floor(Math.random() * ads.length);
        return ads[randomIndex];
    } catch (error) {
        consoleLog('database', 'Error getting random ad for placement', { error: error.message });
        return null;
    }
}

const getRandomAdForPlacementSlug = async (placementSlug) => {
    try {
        const ads = await getAdsByPlacementSlug(placementSlug);
        if (ads.length === 0) return null;
        
        // Return random ad from available ads
        const randomIndex = Math.floor(Math.random() * ads.length);
        return ads[randomIndex];
    } catch (error) {
        consoleLog('database', 'Error getting random ad for placement slug', { error: error.message });
        return null;
    }
}

const getAdForGameContext = async (gameId, adType = 'interlevel') => {
    try {
        // Map ad types to placement slugs
        const placementMap = {
            'preroll': 'game-preroll',
            'interlevel': 'game-interlevel', 
            'loading': 'game-loading',
            'rom-preroll': 'rom-preroll',
            'rom-interstitial': 'rom-interstitial',
            'flash-preroll': 'flash-preroll',
            'flash-interstitial': 'flash-interstitial'
        };
        
        const placementSlug = placementMap[adType] || 'game-interlevel';
        
        // Get random ad for the placement
        const ad = await getRandomAdForPlacementSlug(placementSlug);
        
        if (!ad) {
            // Try fallback to generic interlevel if specific type not found
            if (adType !== 'interlevel') {
                return await getRandomAdForPlacementSlug('game-interlevel');
            }
            return null;
        }
        
        return ad;
    } catch (error) {
        consoleLog('database', 'Error getting ad for game context', { error: error.message });
        return null;
    }
}

const createAd = async (adData) => {
    const { placement_id, name, ad_code, fallback_ad_code } = adData;
    
    const data = await executeQuery(
        `INSERT INTO ads (placement_id, name, ad_code, fallback_ad_code) 
         VALUES (?, ?, ?, ?)`,
        [placement_id, name, ad_code, fallback_ad_code || null]
    );
    
    return data.insertId;
}

const updateAd = async (id, adData) => {
    const updateFields = [];
    const updateValues = [];
    
    // Only update fields that are provided
    if (adData.placement_id !== undefined) {
        updateFields.push('placement_id = ?');
        updateValues.push(adData.placement_id);
    }
    if (adData.name !== undefined) {
        updateFields.push('name = ?');
        updateValues.push(adData.name);
    }
    if (adData.ad_code !== undefined) {
        updateFields.push('ad_code = ?');
        updateValues.push(adData.ad_code);
    }
    if (adData.fallback_ad_code !== undefined) {
        updateFields.push('fallback_ad_code = ?');
        updateValues.push(adData.fallback_ad_code);
    }
    if (adData.is_active !== undefined) {
        updateFields.push('is_active = ?');
        updateValues.push(adData.is_active);
    }
    
    if (updateFields.length === 0) {
        return false; // No fields to update
    }
    
    // Always update the timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);
    
    const data = await executeQuery(
        `UPDATE ads SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
    );
    
    return data.affectedRows > 0;
}

const deleteAd = async (id) => {
    const data = await executeQuery("DELETE FROM ads WHERE id = ?", [id]);
    
    // Clear cache when deleting ad
    
    return data.affectedRows > 0;
}

const toggleAdStatus = async (id) => {
    const data = await executeQuery(
        "UPDATE ads SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [id]
    );
    
    // Clear cache when toggling status
    
    return data.affectedRows > 0;
}

const getAdStats = async () => {
    try {
        const stats = await executeQuery(`
            SELECT 
                ap.placement_type,
                ap.name as placement_name,
                COUNT(a.id) as total_ads,
                SUM(CASE WHEN a.is_active = 1 THEN 1 ELSE 0 END) as active_ads,
                SUM(CASE WHEN a.fallback_ad_code IS NOT NULL THEN 1 ELSE 0 END) as ads_with_fallback
            FROM ad_placements ap
            LEFT JOIN ads a ON ap.id = a.placement_id
            WHERE ap.is_active = 1
            GROUP BY ap.id, ap.placement_type, ap.name
            ORDER BY ap.placement_type, ap.name
        `, []);
        
        return stats;
    } catch (error) {
        consoleLog('database', 'Error fetching ad stats', { error: error.message });
        return [];
    }
}

const getTotalAdCount = async () => {
    const data = await executeQuery(
        "SELECT COUNT(*) as total FROM ads WHERE is_active = 1",
        []
    );
    return data[0]?.total || 0;
}

export {
    getAllAds,
    getAdById,
    getAdsByPlacement,
    getAdsByPlacementSlug,
    getRandomAdForPlacement,
    getRandomAdForPlacementSlug,
    getAdForGameContext,
    createAd,
    updateAd,
    deleteAd,
    toggleAdStatus,
    getAdStats,
    getTotalAdCount
}