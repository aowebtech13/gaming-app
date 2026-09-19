import i18n from '../utils/i18n.js';
import { consoleLog } from '../utils/logger.js';
import { getSetting } from '../models/settings.js';
import { getAvailableTemplates, getAvailableTemplatesWithMetadata } from '../utils/templates.js';

const index = (req, res) => {
    res.redirect("/dashboard/overview");
};

const overview = async(req, res) => {
    try {
        const { getSystemStats } = await import('../models/dashboard_stats.js');
        const { getAdStats, getTotalAdCount } = await import('../models/ads.js');
        const { getPlacementStats } = await import('../models/ad_placements.js');
        
        // Get site name from system settings
        const siteName = await getSetting('site_name') || 'ARCADE';
        
        const [systemStats, adStats, placementStats, totalAds] = await Promise.all([
            getSystemStats(),
            getAdStats(),
            getPlacementStats(), 
            getTotalAdCount()
        ]);

        const adStatsData = {
            total_ads: totalAds,
            ad_stats: adStats,
            placement_stats: placementStats
        };
        
        const pageData = {
            page: "dashboard/overview",
            title: `${i18n.translateSync('dashboard.page_titles.overview.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
            description: i18n.translateSync('dashboard.page_titles.overview.description', {}, req.language?.current || 'en'),
            stats: systemStats,
            adStats: adStatsData
        };

        res.render("dashboard/pages/default", pageData);
    } catch (error) {
        consoleLog('error', 'Dashboard overview error', { error });
        
        // Get site name from system settings (with fallback)
        const siteName = await getSetting('site_name').catch(() => 'ARCADE') || 'ARCADE';
        
        const pageData = {
            page: "dashboard/overview",
            title: `${i18n.translateSync('dashboard.page_titles.overview.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
            description: i18n.translateSync('dashboard.page_titles.overview.description', {}, req.language?.current || 'en'),
            stats: null,
            adStats: null,
            error: i18n.translateSync('api.dashboard.stats_load_failed', {}, req.language?.current || 'en')
        };
        res.render("dashboard/pages/default", pageData);
    }
};

const users = async(req, res) => {
    // Get site name from system settings
    const siteName = await getSetting('site_name') || 'ARCADE';
    
    const pageData = {
        page: "dashboard/users",
        title: `${i18n.translateSync('dashboard.page_titles.users.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
        description: i18n.translateSync('dashboard.page_titles.users.description', {}, req.language?.current || 'en')
    };

    res.render("dashboard/pages/users", pageData);
};

const games = async(req, res) => {
    // Get site name from system settings
    const siteName = await getSetting('site_name') || 'ARCADE';
    
    const pageData = {
        page: "dashboard/games",
        title: `${i18n.translateSync('dashboard.page_titles.games.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
        description: i18n.translateSync('dashboard.page_titles.games.description', {}, req.language?.current || 'en')
    };

    res.render("dashboard/pages/games", pageData);
};

const categories = async(req, res) => {
    // Get site name from system settings
    const siteName = await getSetting('site_name') || 'ARCADE';
    
    const pageData = {
        page: "dashboard/categories",
        title: `${i18n.translateSync('dashboard.page_titles.categories.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
        description: i18n.translateSync('dashboard.page_titles.categories.description', {}, req.language?.current || 'en')
    };

    res.render("dashboard/pages/categories", pageData);
};

const favorites = async(req, res) => {
    // Get site name from system settings
    const siteName = await getSetting('site_name') || 'ARCADE';
    
    const pageData = {
        page: "dashboard/favorites",
        title: `${i18n.translateSync('dashboard.page_titles.favorites.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
        description: i18n.translateSync('dashboard.page_titles.favorites.description', {}, req.language?.current || 'en')
    };

    res.render("dashboard/pages/favorites", pageData);
};

const importer = async(req, res) => {
    try {
        // Get site name from system settings
        const siteName = await getSetting('site_name') || 'ARCADE';
        
        const pageData = {
            page: "dashboard/importer",
            title: `${i18n.translateSync('dashboard.page_titles.importer.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
            description: i18n.translateSync('dashboard.page_titles.importer.description', {}, req.language?.current || 'en')
        };

        res.render("dashboard/pages/importer", pageData);
    } catch (error) {
        consoleLog('error', 'Importer page error', { error });
        
        // Get site name from system settings (with fallback)
        const siteName = await getSetting('site_name').catch(() => 'ARCADE') || 'ARCADE';
        
        const pageData = {
            page: "dashboard/importer",
            title: `${i18n.translateSync('dashboard.page_titles.importer.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
            description: i18n.translateSync('dashboard.page_titles.importer.description', {}, req.language?.current || 'en'),
            error: i18n.translateSync('api.dashboard.importer_load_failed', {}, req.language?.current || 'en')
        };
        res.render("dashboard/pages/importer", pageData);
    }
};

const follows = async(req, res) => {
    // Get site name from system settings
    const siteName = await getSetting('site_name') || 'ARCADE';
    
    const pageData = {
        page: "dashboard/follows",
        title: `${i18n.translateSync('dashboard.page_titles.follows.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
        description: i18n.translateSync('dashboard.page_titles.follows.description', {}, req.language?.current || 'en')
    };

    res.render("dashboard/pages/follows", pageData);
};

const comments = async(req, res) => {
    // Get site name from system settings
    const siteName = await getSetting('site_name') || 'ARCADE';
    
    const pageData = {
        page: "dashboard/comments",
        title: `${i18n.translateSync('dashboard.page_titles.comments.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
        description: i18n.translateSync('dashboard.page_titles.comments.description', {}, req.language?.current || 'en')
    };

    res.render("dashboard/pages/comments", pageData);
};

const pages = async(req, res) => {
    // Get site name from system settings
    const siteName = await getSetting('site_name') || 'ARCADE';
    
    const pageData = {
        page: "dashboard/pages",
        title: `${i18n.translateSync('dashboard.page_titles.pages.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
        description: i18n.translateSync('dashboard.page_titles.pages.description', {}, req.language?.current || 'en')
    };

    res.render("dashboard/pages/pages", pageData);
};

const exp_ranks = async(req, res) => {
    // Get site name from system settings
    const siteName = await getSetting('site_name') || 'ARCADE';
    
    const pageData = {
        page: "dashboard/exp_ranks",
        title: `${i18n.translateSync('dashboard.page_titles.exp_ranks.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
        description: i18n.translateSync('dashboard.page_titles.exp_ranks.description', {}, req.language?.current || 'en')
    };

    res.render("dashboard/pages/exp_ranks", pageData);
};

const exp_events = async(req, res) => {
    // Get site name from system settings
    const siteName = await getSetting('site_name') || 'ARCADE';
    
    const pageData = {
        page: "dashboard/exp_events",
        title: `${i18n.translateSync('dashboard.page_titles.exp_events.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
        description: i18n.translateSync('dashboard.page_titles.exp_events.description', {}, req.language?.current || 'en')
    };

    res.render("dashboard/pages/exp_events", pageData);
};

const email_logs = async(req, res) => {
    // Get site name from system settings
    const siteName = await getSetting('site_name') || 'ARCADE';
    
    const pageData = {
        page: "dashboard/email_logs",
        title: `${i18n.translateSync('dashboard.page_titles.email_logs.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
        description: i18n.translateSync('dashboard.page_titles.email_logs.description', {}, req.language?.current || 'en')
    };

    res.render("dashboard/pages/email_logs", pageData);
};

const cron_logs = async(req, res) => {
    // Get site name from system settings
    const siteName = await getSetting('site_name') || 'ARCADE';
    
    const pageData = {
        page: "dashboard/cron_logs",
        title: `${i18n.translateSync('dashboard.page_titles.cron_logs.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
        description: i18n.translateSync('dashboard.page_titles.cron_logs.description', {}, req.language?.current || 'en')
    };

    res.render("dashboard/pages/cron_logs", pageData);
};

const search_queries = async(req, res) => {
    // Get site name from system settings
    const siteName = await getSetting('site_name') || 'ARCADE';
    
    const pageData = {
        page: "dashboard/search_queries",
        title: `${i18n.translateSync('dashboard.page_titles.search_queries.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
        description: i18n.translateSync('dashboard.page_titles.search_queries.description', {}, req.language?.current || 'en')
    };

    res.render("dashboard/pages/search_queries", pageData);
};

const game_scores = async(req, res) => {
    // Get site name from system settings
    const siteName = await getSetting('site_name') || 'ARCADE';
    
    const pageData = {
        page: "dashboard/game_scores",
        title: `${i18n.translateSync('dashboard.page_titles.game_scores.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
        description: i18n.translateSync('dashboard.page_titles.game_scores.description', {}, req.language?.current || 'en')
    };

    res.render("dashboard/pages/game_scores", pageData);
};

const game_leaderboards = async(req, res) => {
    // Get site name from system settings
    const siteName = await getSetting('site_name') || 'ARCADE';
    
    const pageData = {
        page: "dashboard/game_leaderboards",
        title: `${i18n.translateSync('dashboard.page_titles.game_leaderboards.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
        description: i18n.translateSync('dashboard.page_titles.game_leaderboards.description', {}, req.language?.current || 'en')
    };

    res.render("dashboard/pages/game_leaderboards", pageData);
};

const ad_placements = async(req, res) => {
    // Get site name from system settings
    const siteName = await getSetting('site_name') || 'ARCADE';
    
    const pageData = {
        page: "dashboard/ad_placements",
        title: `${i18n.translateSync('dashboard.page_titles.ad_placements.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
        description: i18n.translateSync('dashboard.page_titles.ad_placements.description', {}, req.language?.current || 'en')
    };

    res.render("dashboard/pages/ad_placements", pageData);
};

const ads = async(req, res) => {
    // Get site name from system settings
    const siteName = await getSetting('site_name') || 'ARCADE';
    
    const pageData = {
        page: "dashboard/ads",
        title: `${i18n.translateSync('dashboard.page_titles.ads.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
        description: i18n.translateSync('dashboard.page_titles.ads.description', {}, req.language?.current || 'en')
    };

    res.render("dashboard/pages/ads", pageData);
};

const templates = async(req, res) => {
    // Get site name from system settings
    const siteName = await getSetting('site_name') || 'ARCADE';
    
    // Get currently selected template
    const selectedTemplate = await getSetting('selected_template', 'default');
    
    // Get available templates with metadata
    const templatesWithMetadata = getAvailableTemplatesWithMetadata();
    
    const pageData = {
        page: "dashboard/templates",
        title: `${i18n.translateSync('dashboard.page_titles.templates.title', {}, req.language?.current || 'en')} &middot; ${siteName}`,
        description: i18n.translateSync('dashboard.page_titles.templates.description', {}, req.language?.current || 'en'),
        templates: templatesWithMetadata,
        selectedTemplate: selectedTemplate
    };

    res.render("dashboard/pages/templates", pageData);
};



export {
    index,
    overview,
    users,
    games,
    categories,
    favorites,
    importer,
    follows,
    comments,
    pages,
    exp_ranks,
    exp_events,
    email_logs,
    cron_logs,
    search_queries,
    game_scores,
    game_leaderboards,
    ad_placements,
    ads,
    templates
}