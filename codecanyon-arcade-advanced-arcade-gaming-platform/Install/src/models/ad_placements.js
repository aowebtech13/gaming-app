import executeQuery from "../utils/mysql.js";
import CacheUtils from '../utils/cache.js';
import { consoleLog } from '../utils/logger.js';

// Initialize ad placements cache
CacheUtils.initCache('ad-placements', 30 * 60 * 1000); // 30 minutes

const getAllPlacements = async () => {
    try {
        // Try to get cached placements
        const cacheKey = 'all-placements';
        let placements = await CacheUtils.get('ad-placements', cacheKey);
        
        if (!placements) {
            // Cache miss - fetch fresh data
            placements = await executeQuery(
                "SELECT * FROM ad_placements WHERE is_active = 1 ORDER BY placement_type, name",
                []
            );
            
            // Cache the result for 30 minutes
            await CacheUtils.put('ad-placements', cacheKey, placements);
        }
        
        return placements;
    } catch (error) {
        consoleLog('database', 'Error fetching all ad placements', { error: error.message });
        return [];
    }
}

const getPlacementById = async (id) => {
    const data = await executeQuery("SELECT * FROM ad_placements WHERE id = ? LIMIT 1", [id]);
    return data.length > 0 ? data[0] : null;
}

const getPlacementBySlug = async (slug) => {
    const data = await executeQuery("SELECT * FROM ad_placements WHERE slug = ? LIMIT 1", [slug]);
    return data.length > 0 ? data[0] : null;
}

const getPlacementsByType = async (placementType) => {
    try {
        // Try to get cached placements by type
        const cacheKey = `placements-by-type-${placementType}`;
        let placements = await CacheUtils.get('ad-placements', cacheKey);
        
        if (!placements) {
            // Cache miss - fetch fresh data
            placements = await executeQuery(
                "SELECT * FROM ad_placements WHERE placement_type = ? AND is_active = 1 ORDER BY name",
                [placementType]
            );
            
            // Cache the result for 30 minutes
            await CacheUtils.put('ad-placements', cacheKey, placements);
        }
        
        return placements;
    } catch (error) {
        consoleLog('database', 'Error fetching placements by type', { error: error.message });
        return [];
    }
}

const getBestPlacementForSize = async (width, height, placementType = null) => {
    try {
        // Calculate 20% tolerance for responsive placement
        const widthTolerance = Math.round(width * 0.2);
        const heightTolerance = Math.round(height * 0.2);
        const minWidth = width - widthTolerance;
        const maxWidth = width + widthTolerance;
        const minHeight = height - heightTolerance;
        const maxHeight = height + heightTolerance;
        
        let query = `
            SELECT *, 
                   ABS(width - ?) + ABS(height - ?) as size_diff,
                   CASE 
                       WHEN width BETWEEN ? AND ? AND height BETWEEN ? AND ? THEN 1
                       ELSE 0
                   END as within_tolerance
            FROM ad_placements 
            WHERE is_active = 1
        `;
        let params = [width, height, minWidth, maxWidth, minHeight, maxHeight];
        
        if (placementType) {
            query += " AND placement_type = ?";
            params.push(placementType);
        }
        
        // Prioritize placements within 20% tolerance, then by closest size
        query += " ORDER BY within_tolerance DESC, size_diff ASC LIMIT 1";
        
        const data = await executeQuery(query, params);
        const result = data.length > 0 ? data[0] : null;
        
        // Log placement decision for debugging
        if (result) {
            const withinTolerance = result.within_tolerance === 1;
            consoleLog('ad-placement', `Best placement found for ${width}x${height}`, {
                placementId: result.id,
                placementSize: `${result.width}x${result.height}`,
                withinTolerance,
                sizeDiff: result.size_diff,
                toleranceUsed: `±${widthTolerance}x${heightTolerance}`
            });
        }
        
        return result;
    } catch (error) {
        consoleLog('database', 'Error finding best placement for size', { error: error.message });
        return null;
    }
}

const createPlacement = async (placementData) => {
    const { name, slug, description, width, height, placement_type } = placementData;
    
    const data = await executeQuery(
        `INSERT INTO ad_placements (name, slug, description, width, height, placement_type) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, slug, description, width, height, placement_type]
    );
    
    // Clear cache when creating new placement
    await CacheUtils.invalidateAdPlacementCaches();
    
    return data.insertId;
}

const updatePlacement = async (id, placementData) => {
    const { name, slug, description, width, height, placement_type, is_active } = placementData;
    
    const data = await executeQuery(
        `UPDATE ad_placements 
         SET name = ?, slug = ?, description = ?, width = ?, height = ?, 
             placement_type = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, slug, description, width, height, placement_type, is_active, id]
    );
    
    // Clear cache when updating placement
    await CacheUtils.invalidateAdPlacementCaches();
    
    return data.affectedRows > 0;
}

const deletePlacement = async (id) => {
    // Check if placement has ads before deleting
    const adsCount = await executeQuery(
        "SELECT COUNT(*) as count FROM ads WHERE placement_id = ?",
        [id]
    );
    
    if (adsCount[0]?.count > 0) {
        throw new Error('Cannot delete placement with active ads');
    }
    
    const data = await executeQuery("DELETE FROM ad_placements WHERE id = ?", [id]);
    
    // Clear cache when deleting placement
    await CacheUtils.invalidateAdPlacementCaches();
    
    return data.affectedRows > 0;
}

const togglePlacementStatus = async (id) => {
    const data = await executeQuery(
        "UPDATE ad_placements SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [id]
    );
    
    // Clear cache when toggling status
    await CacheUtils.invalidateAdPlacementCaches();
    
    return data.affectedRows > 0;
}

const getPlacementStats = async () => {
    try {
        const stats = await executeQuery(`
            SELECT 
                ap.placement_type,
                COUNT(ap.id) as total_placements,
                COUNT(a.id) as total_ads,
                SUM(CASE WHEN ap.is_active = 1 THEN 1 ELSE 0 END) as active_placements,
                SUM(CASE WHEN a.is_active = 1 THEN 1 ELSE 0 END) as active_ads
            FROM ad_placements ap
            LEFT JOIN ads a ON ap.id = a.placement_id
            GROUP BY ap.placement_type
            ORDER BY ap.placement_type
        `, []);
        
        return stats;
    } catch (error) {
        consoleLog('database', 'Error fetching placement stats', { error: error.message });
        return [];
    }
}

export {
    getAllPlacements,
    getPlacementById,
    getPlacementBySlug,
    getPlacementsByType,
    getBestPlacementForSize,
    createPlacement,
    updatePlacement,
    deletePlacement,
    togglePlacementStatus,
    getPlacementStats
}