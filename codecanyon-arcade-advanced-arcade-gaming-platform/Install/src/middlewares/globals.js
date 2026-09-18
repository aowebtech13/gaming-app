import { getCachedSettings } from '../models/settings.js';
import { getUserAvatarUrl } from '../utils/gravatar.js';
import { consoleLog } from '../utils/logger.js';
import { getRandomCategories } from '../models/categories.js';
import { 
  getTotalGameCount,
  getPopularGames,
  getFeaturedGames,
  getTrendingGames,
  getRecentGames,
  getTopRatedGames,
  getRandomGames
} from '../models/games.js';
import { getCategoryByName } from '../models/categories.js';
import { getRandomAdForPlacementSlug } from '../models/ads.js';
import CacheUtils from '../utils/cache.js';
import JsonLdGenerator from '../utils/jsonld.js';
import SocialMetaGenerator from '../utils/social_meta.js';
import i18n, { __ } from '../utils/i18n.js';
import { getVersionInfo } from '../utils/version.js';

// Helper function to parse thumbnail JSON data
const parseThumbnailData = (games) => {
    if (!games || !Array.isArray(games)) return games;
    
    return games.map(game => {
        if (game.thumbnail && typeof game.thumbnail === 'string' && game.thumbnail.startsWith('{')) {
            try {
                game.parsedThumbnail = JSON.parse(game.thumbnail);
            } catch (e) {
                game.parsedThumbnail = null;
            }
        }
        return game;
    });
};

// Initialize caches
CacheUtils.initCache('sidebar-categories', 7 * 24 * 60 * 60 * 1000); // 7 days
CacheUtils.initCache('game-stats', 24 * 60 * 60 * 1000); // 1 day
CacheUtils.initCache('popular-games', 60 * 60 * 1000); // 1 hour
CacheUtils.initCache('featured-games', 30 * 60 * 1000); // 30 min
CacheUtils.initCache('trending-games', 45 * 60 * 1000); // 45 min
CacheUtils.initCache('recent-games', 15 * 60 * 1000); // 15 min
CacheUtils.initCache('top-rated-games', 2 * 60 * 60 * 1000); // 2 hours

const globals = async (req, res, next) => {
  try {
    // Get settings from database
    const settings = await getCachedSettings();

    // Get cached random categories for sidebar (7 days cache)
    let sidebarCategories;

    try {
      sidebarCategories = await CacheUtils.get('sidebar-categories', 'random-categories');
      if (!sidebarCategories) {
        // Cache miss - fetch new random categories
        sidebarCategories = await getRandomCategories(10);
        await CacheUtils.put('sidebar-categories', 'random-categories', sidebarCategories);
      }
    } catch (error) {
      consoleLog('cache', 'Error fetching random categories for sidebar', { error: error.message });
      sidebarCategories = [];
    }

    // Get cached total game count (1 day cache)
    let totalGameCount;

    try {
      totalGameCount = await CacheUtils.get('game-stats', 'total-count');
      if (!totalGameCount) {
        // Cache miss - fetch total game count
        totalGameCount = await getTotalGameCount();
        await CacheUtils.put('game-stats', 'total-count', totalGameCount);
      }
    } catch (error) {
      consoleLog('cache', 'Error fetching total game count', { error: error.message });
      totalGameCount = 0;
    }

    // Load game collections for template helpers
    const gameCollections = {};

    try {
      // Load Popular Games
      gameCollections.popular = await CacheUtils.get('popular-games', 'collection');
      if (!gameCollections.popular) {
        gameCollections.popular = await getPopularGames(50, 0);
        gameCollections.popular = parseThumbnailData(gameCollections.popular);
        await CacheUtils.put('popular-games', 'collection', gameCollections.popular);
      }

      // Load Featured Games
      gameCollections.featured = await CacheUtils.get('featured-games', 'collection');
      if (!gameCollections.featured) {
        gameCollections.featured = await getFeaturedGames(50, 0);
        gameCollections.featured = parseThumbnailData(gameCollections.featured);
        await CacheUtils.put('featured-games', 'collection', gameCollections.featured);
      }

      // Load Trending Games
      gameCollections.trending = await CacheUtils.get('trending-games', 'collection');
      if (!gameCollections.trending) {
        gameCollections.trending = await getTrendingGames(50, 0);
        gameCollections.trending = parseThumbnailData(gameCollections.trending);
        await CacheUtils.put('trending-games', 'collection', gameCollections.trending);
      }

      // Load Recent Games
      gameCollections.recent = await CacheUtils.get('recent-games', 'collection');
      if (!gameCollections.recent) {
        gameCollections.recent = await getRecentGames(null, 50, 0);
        gameCollections.recent = parseThumbnailData(gameCollections.recent);
        await CacheUtils.put('recent-games', 'collection', gameCollections.recent);
      }

      // Load Top Rated Games
      gameCollections.topRated = await CacheUtils.get('top-rated-games', 'collection');
      if (!gameCollections.topRated) {
        gameCollections.topRated = await getTopRatedGames(50, 0);
        gameCollections.topRated = parseThumbnailData(gameCollections.topRated);
        await CacheUtils.put('top-rated-games', 'collection', gameCollections.topRated);
      }

    } catch (error) {
      consoleLog('cache', 'Error loading game collections', { error: error.message });
      // Set fallback empty arrays
      gameCollections.popular = [];
      gameCollections.featured = [];
      gameCollections.trending = [];
      gameCollections.recent = [];
      gameCollections.topRated = [];
    }

    res.locals.site_url = `${req.protocol}://${req.get('host')}`;
    res.locals.env = { ...process.env };
    res.locals.session = req.session;
    res.locals.sidebarCategories = sidebarCategories;
    res.locals.totalGameCount = totalGameCount;
    
    // Initialize JSON-LD generator and Social Meta generator
    res.locals.jsonLd = new JsonLdGenerator(res.locals.site_url, settings.site_name || 'ARCADE');
    res.locals.socialMeta = new SocialMetaGenerator(res.locals.site_url, settings.site_name || 'ARCADE');

    // Set user with Gravatar avatar URL
    const user = req.session.user || null;
    if (user) {
      user.avatarUrl = getUserAvatarUrl(user);
    }
    res.locals.user = user;
    res.locals.safeUser = getSafeUserData(user);

    // Add version information to all pages
    res.locals.version = getVersionInfo();

    // Add translation functions to locals
    const currentLanguage = req.language?.current || 'en';
    
    // Server-side translation function
    res.locals.__ = (key, variables = {}) => {
      try {
        // Use synchronous version for templates
        return i18n.translateSync(key, variables, currentLanguage);
      } catch (error) {
        consoleLog('i18n', `Translation error for key "${key}":`, { error: error.message });
        return key; // Fallback to key if translation fails
      }
    };

    // Get all translations for client-side use
    res.locals.translations = await i18n.getAllTranslations(currentLanguage);
    res.locals.translationsJSON = JSON.stringify(res.locals.translations);

    // Add universal getGames function for templates (synchronous version)
    res.locals.getGames = (type = 'popular', limit = 10, options = {}) => {
      const { 
        category = null, 
        offset = 0, 
        shuffle = false
      } = options;
      
      // Use cached data only (templates can't handle async)
      const collections = {
        'popular': gameCollections.popular || [],
        'featured': gameCollections.featured || [],
        'trending': gameCollections.trending || [],
        'recent': gameCollections.recent || [],
        'top': gameCollections.topRated || [],
        'top-rated': gameCollections.topRated || [],
        'random': [...(gameCollections.popular || []), ...(gameCollections.featured || []), ...(gameCollections.trending || [])].filter((game, index, self) => index === self.findIndex(g => g.id === game.id))
      };
      
      let games = collections[type] || collections.popular;
      
      // Filter by category
      if (category) {
        games = games.filter(game => 
          game.category_name && 
          game.category_name.toLowerCase() === category.toLowerCase()
        );
      }
      
      // Shuffle if requested or if type is 'random'
      if (shuffle || type === 'random') {
        games = [...games].sort(() => Math.random() - 0.5);
      }
      
      // Apply pagination
      return games.slice(offset, offset + limit);
    };

    // Add settings to locals
    Object.keys(settings).forEach(key => {
      res.locals[key] = settings[key];
    });

    // Pre-load ad data for server-side rendering when PJAX is disabled
    if (settings.enable_frontend_pjax === '0') {
      try {
        const commonPlacements = ['header-banner', 'sidebar-rectangle', 'below-game-banner', 'footer-banner'];
        const adsByPlacement = {};
        
        // Pre-load ads for common placements
        await Promise.all(commonPlacements.map(async (placement) => {
          try {
            const ad = await getRandomAdForPlacementSlug(placement);
            if (ad) {
              adsByPlacement[placement] = ad;
            }
          } catch (error) {
            consoleLog('ads', `Error pre-loading ad for placement "${placement}":`, { error: error.message });
          }
        }));
        
        res.locals.adsByPlacement = adsByPlacement;
      } catch (error) {
        consoleLog('ads', 'Error pre-loading ads:', { error: error.message });
        res.locals.adsByPlacement = {};
      }
    } else {
      // No need to pre-load ads when using AJAX
      res.locals.adsByPlacement = {};
    }

  } catch (error) {
    consoleLog('error', 'Error loading settings in globals middleware', { error: error.message });
    // Continue with defaults if settings fail to load
    res.locals.site_url = `${req.protocol}://${req.get('host')}`;
    res.locals.env = { ...process.env };
    res.locals.session = req.session;
    res.locals.sidebarCategories = [];
    res.locals.totalGameCount = 0;
    
    // Initialize JSON-LD generator with default site name
    res.locals.jsonLd = new JsonLdGenerator(res.locals.site_url, 'ARCADE');

    // Set user with Gravatar avatar URL
    const user = req.session.user || null;
    if (user) {
      user.avatarUrl = getUserAvatarUrl(user);
    }
    res.locals.user = user;
    res.locals.safeUser = getSafeUserData(user);
    
    // Add version information to all pages
    res.locals.version = getVersionInfo();
    
    // Add translation functions with fallback
    const currentLanguage = req.language?.current || 'en';
    
    // Server-side translation function
    res.locals.__ = (key, variables = {}) => {
      try {
        // Use synchronous version for templates
        return i18n.translateSync(key, variables, currentLanguage);
      } catch (error) {
        consoleLog('i18n', `Translation error for key "${key}":`, { error: error.message });
        return key; // Fallback to key if translation fails
      }
    };

    // Get all translations for client-side use (fallback to empty object)
    try {
      res.locals.translations = await i18n.getAllTranslations(currentLanguage);
      res.locals.translationsJSON = JSON.stringify(res.locals.translations);
    } catch (error) {
      res.locals.translations = {};
      res.locals.translationsJSON = '{}';
    }
    
    // Set default settings
    res.locals.site_name = 'ARCADE';
    res.locals.site_description = 'The ultimate online gaming destination';
    res.locals.maintenance_mode = '0';
    
    // Fallback: empty ads object when settings fail to load
    res.locals.adsByPlacement = {};
  }

  next();
};

// Function to create safe user data for client-side consumption
const getSafeUserData = (user) => {
  if (!user) return null;
  
  // Create a copy of the user object excluding sensitive fields
  const safeUser = { ...user };
  
  // Remove sensitive fields that should not be exposed to client-side
  delete safeUser.password;
  
  return safeUser;
};

export default globals;
