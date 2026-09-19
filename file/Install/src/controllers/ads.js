import response from "../utils/response.js";
import { consoleLog } from "../utils/logger.js";
import { sanitizeRequestBody } from "../utils/sanitize.js";
import i18n from '../utils/i18n.js';
import {
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
} from "../models/ads.js";
import {
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
} from "../models/ad_placements.js";

// Ad serving endpoints for HTML5 games and EmulatorJS
const showAdEndpoint = async (req, res) => {
    const request = sanitizeRequestBody(req.body);
    
    if (!request.game_id || !request.ad_type) {
        return response(res, 400, i18n.translateSync('api.ads.ad_type_game_id_required', {}, req.language?.current || 'en'));
    }

    try {
        // Get ad for the specific game context
        const ad = await getAdForGameContext(request.game_id, request.ad_type);
        
        if (!ad) {
            return response(res, 404, i18n.translateSync('api.ads.no_ads_available', {}, req.language?.current || 'en'), {
                placement_type: request.ad_type,
                fallback_available: false
            });
        }

        // Return ad with placement info
        return response(res, 200, i18n.translateSync('api.ads.ad_retrieved', {}, req.language?.current || 'en'), {
            ad_code: ad.ad_code,
            fallback_ad_code: ad.fallback_ad_code,
            placement_info: {
                id: ad.placement_id,
                name: ad.placement_name,
                slug: ad.placement_slug,
                type: ad.placement_type,
                width: ad.width,
                height: ad.height
            },
            ad_info: {
                id: ad.id,
                name: ad.name
            }
        });
    } catch (error) {
        consoleLog('error', 'Show ad error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.ads.error_retrieving', {}, req.language?.current || 'en'));
    }
};

// Ad serving by placement slug (for direct placement requests)
const serveAdByPlacementEndpoint = async (req, res) => {
    const { placementSlug } = req.params;
    
    if (!placementSlug) {
        return response(res, 400, i18n.translateSync('api.ads.placement_slug_required', {}, req.language?.current || 'en'));
    }

    try {
        const ad = await getRandomAdForPlacementSlug(placementSlug);
        
        if (!ad) {
            return response(res, 404, i18n.translateSync('api.ads.no_ads_available', {}, req.language?.current || 'en'), {
                placement_slug: placementSlug
            });
        }

        // Return ad content directly (for iframe embedding)
        res.setHeader('Content-Type', 'text/html');
        return res.send(ad.ad_code);
    } catch (error) {
        consoleLog('error', 'Serve ad by placement error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.ads.error_retrieving', {}, req.language?.current || 'en'));
    }
};

// EmulatorJS specific ad endpoints
const emulatorAdEndpoint = async (req, res) => {
    const { adType, gameId } = req.params;
    
    if (!adType || !gameId) {
        return response(res, 400, i18n.translateSync('api.ads.ad_type_game_id_required', {}, req.language?.current || 'en'));
    }

    try {
        // Map EmulatorJS ad types to placement slugs
        const placementMap = {
            'rom-preroll': 'rom-preroll',
            'rom-interstitial': 'rom-interstitial',
            'rom-save-reward': 'rom-save-reward',
            'fallback': 'rom-interstitial' // Fallback for blocked ads
        };
        
        const placementSlug = placementMap[adType];
        if (!placementSlug) {
            return response(res, 400, i18n.translateSync('api.ads.invalid_ad_type', {}, req.language?.current || 'en'));
        }

        const ad = await getRandomAdForPlacementSlug(placementSlug);
        
        if (!ad) {
            // Return empty response for EmulatorJS to handle gracefully
            res.setHeader('Content-Type', 'text/html');
            return res.send('<!-- No ad available -->');
        }

        // Return ad content for EmulatorJS
        res.setHeader('Content-Type', 'text/html');
        return res.send(ad.ad_code);
    } catch (error) {
        consoleLog('error', 'EmulatorJS ad error', { error: error.message });
        res.setHeader('Content-Type', 'text/html');
        return res.send('<!-- Ad error -->');
    }
};


// Banner ad placement endpoint (for automatic placement based on size)
const getBannerAdEndpoint = async (req, res) => {
    const { width, height } = req.query;
    
    if (!width || !height) {
        return response(res, 400, i18n.translateSync('api.ads.width_height_required', {}, req.language?.current || 'en'));
    }

    try {
        // Find best placement for the requested size
        const placement = await getBestPlacementForSize(
            parseInt(width), 
            parseInt(height), 
            'banner'
        );
        
        if (!placement) {
            return response(res, 404, i18n.translateSync('api.ads.no_banner_placements', {}, req.language?.current || 'en'));
        }

        // Get random ad for this placement
        const ad = await getRandomAdForPlacement(placement.id);
        
        if (!ad) {
            return response(res, 404, i18n.translateSync('api.ads.no_banner_ads', {}, req.language?.current || 'en'));
        }

        return response(res, 200, i18n.translateSync('api.ads.banner_retrieved', {}, req.language?.current || 'en'), {
            ad_code: ad.ad_code,
            placement_info: {
                id: placement.id,
                name: placement.name,
                slug: placement.slug,
                width: placement.width,
                height: placement.height,
                size_match: {
                    requested: { width: parseInt(width), height: parseInt(height) },
                    provided: { width: placement.width, height: placement.height }
                }
            }
        });
    } catch (error) {
        consoleLog('error', 'Get banner ad error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.ads.error_retrieving_banner', {}, req.language?.current || 'en'));
    }
};

// Placement management endpoints
const createPlacementEndpoint = async (req, res) => {
    if (!res.locals.user || res.locals.user.user_type !== 'admin') {
        return response(res, 403, i18n.translateSync('api.ads.admin_required', {}, req.language?.current || 'en'));
    }

    const request = sanitizeRequestBody(req.body);
    
    if (!request.name || !request.slug || !request.width || !request.height || !request.placement_type) {
        return response(res, 400, i18n.translateSync('api.ads.placement_fields_required', {}, req.language?.current || 'en'));
    }

    try {
        const placementId = await createPlacement({
            name: request.name,
            slug: request.slug,
            description: request.description,
            width: parseInt(request.width),
            height: parseInt(request.height),
            placement_type: request.placement_type
        });

        if (placementId) {
            return response(res, 200, i18n.translateSync('api.ads.placement_created', {}, req.language?.current || 'en'), {
                placement_id: placementId
            });
        }

        return response(res, 500, i18n.translateSync('api.ads.placement_create_failed', {}, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', 'Create placement error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.ads.placement_create_error', {}, req.language?.current || 'en'));
    }
};

const updatePlacementEndpoint = async (req, res) => {
    if (!res.locals.user || res.locals.user.user_type !== 'admin') {
        return response(res, 403, i18n.translateSync('api.ads.admin_required', {}, req.language?.current || 'en'));
    }

    const { placementId } = req.params;
    const request = sanitizeRequestBody(req.body);
    
    if (!placementId) {
        return response(res, 400, i18n.translateSync('api.ads.placement_id_required', {}, req.language?.current || 'en'));
    }

    try {
        const success = await updatePlacement(placementId, {
            name: request.name,
            slug: request.slug,
            description: request.description,
            width: parseInt(request.width),
            height: parseInt(request.height),
            placement_type: request.placement_type,
            is_active: request.is_active
        });

        if (success) {
            return response(res, 200, i18n.translateSync('api.ads.placement_updated', {}, req.language?.current || 'en'));
        }

        return response(res, 404, i18n.translateSync('api.ads.placement_not_found', {}, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', 'Update placement error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.ads.placement_update_error', {}, req.language?.current || 'en'));
    }
};

const deletePlacementEndpoint = async (req, res) => {
    if (!res.locals.user || res.locals.user.user_type !== 'admin') {
        return response(res, 403, i18n.translateSync('api.ads.admin_required', {}, req.language?.current || 'en'));
    }

    const { placementId } = req.params;
    
    if (!placementId) {
        return response(res, 400, i18n.translateSync('api.ads.placement_id_required', {}, req.language?.current || 'en'));
    }

    try {
        const success = await deletePlacement(placementId);

        if (success) {
            return response(res, 200, i18n.translateSync('api.ads.placement_updated', {}, req.language?.current || 'en'));
        }

        return response(res, 404, i18n.translateSync('api.ads.placement_not_found', {}, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', 'Delete placement error', { error: error.message });
        return response(res, 500, error.message || i18n.translateSync('api.ads.placement_update_error', {}, req.language?.current || 'en'));
    }
};

// Ad management endpoints
const createAdEndpoint = async (req, res) => {
    if (!res.locals.user || res.locals.user.user_type !== 'admin') {
        return response(res, 403, i18n.translateSync('api.ads.admin_required', {}, req.language?.current || 'en'));
    }

    const request = sanitizeRequestBody(req.body);
    
    if (!request.placement_id || !request.name || !request.ad_code) {
        return response(res, 400, i18n.translateSync('api.ads.placement_fields_required', {}, req.language?.current || 'en'));
    }

    try {
        const adId = await createAd({
            placement_id: parseInt(request.placement_id),
            name: request.name,
            ad_code: request.ad_code,
            fallback_ad_code: request.fallback_ad_code
        });

        if (adId) {
            return response(res, 200, i18n.translateSync('api.ads.placement_created', {}, req.language?.current || 'en'), {
                ad_id: adId
            });
        }

        return response(res, 500, i18n.translateSync('api.ads.placement_create_failed', {}, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', 'Create ad error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.ads.placement_create_error', {}, req.language?.current || 'en'));
    }
};

const updateAdEndpoint = async (req, res) => {
    if (!res.locals.user || res.locals.user.user_type !== 'admin') {
        return response(res, 403, i18n.translateSync('api.ads.admin_required', {}, req.language?.current || 'en'));
    }

    const { adId } = req.params;
    const request = sanitizeRequestBody(req.body);
    
    if (!adId) {
        return response(res, 400, i18n.translateSync('api.ads.placement_id_required', {}, req.language?.current || 'en'));
    }

    try {
        const success = await updateAd(adId, {
            placement_id: parseInt(request.placement_id),
            name: request.name,
            ad_code: request.ad_code,
            fallback_ad_code: request.fallback_ad_code,
            is_active: request.is_active
        });

        if (success) {
            return response(res, 200, i18n.translateSync('api.ads.placement_updated', {}, req.language?.current || 'en'));
        }

        return response(res, 404, i18n.translateSync('api.ads.placement_not_found', {}, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', 'Update ad error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.ads.placement_update_error', {}, req.language?.current || 'en'));
    }
};

const deleteAdEndpoint = async (req, res) => {
    if (!res.locals.user || res.locals.user.user_type !== 'admin') {
        return response(res, 403, i18n.translateSync('api.ads.admin_required', {}, req.language?.current || 'en'));
    }

    const { adId } = req.params;
    
    if (!adId) {
        return response(res, 400, i18n.translateSync('api.ads.placement_id_required', {}, req.language?.current || 'en'));
    }

    try {
        const success = await deleteAd(adId);

        if (success) {
            return response(res, 200, i18n.translateSync('api.ads.placement_updated', {}, req.language?.current || 'en'));
        }

        return response(res, 404, i18n.translateSync('api.ads.placement_not_found', {}, req.language?.current || 'en'));
    } catch (error) {
        consoleLog('error', 'Delete ad error', { error: error.message });
        return response(res, 500, i18n.translateSync('api.ads.placement_update_error', {}, req.language?.current || 'en'));
    }
};

export {
    showAdEndpoint,
    serveAdByPlacementEndpoint,
    emulatorAdEndpoint,
    getBannerAdEndpoint,
    createPlacementEndpoint,
    updatePlacementEndpoint,
    deletePlacementEndpoint,
    createAdEndpoint,
    updateAdEndpoint,
    deleteAdEndpoint
}