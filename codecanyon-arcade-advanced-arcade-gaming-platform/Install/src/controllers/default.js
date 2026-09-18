import { getAllCountries } from '../utils/countries.js';
import { getExpProgress, getExpForNextLevel, getLevelTitle } from '../utils/exp.js';
import { getTopUsersByLevel, getTopUsersByExp } from '../models/exp.js';
import { getUserAvatarUrl } from '../utils/gravatar.js';
import { getUserById, getUserByUsername } from '../models/users.js';
import { consoleLog } from '../utils/logger.js';
import i18n from '../utils/i18n.js';
import { getFollowing, getFollowCounts, isFollowing } from '../models/follows.js';
import { getUserFavorites, getFavoriteById, checkIfFavorite } from '../models/favorites.js';
import { getLastPlayedByUserId, addLastPlayed } from '../models/last_played.js';
import { getAllActiveCategories, getCategoryById, getCategoryBySlug } from '../models/categories.js';
import { getSetting } from '../models/settings.js';
import { getCommentsByGameId, getCommentCountByGameId } from '../models/comments.js';
import { getRating, getGameRatingStats } from '../models/ratings.js';
import { 
    getGamesByCategory, 
    getGamesByTag, 
    getTopRatedGames, 
    getPopularGames, 
    getTrendingGames, 
    getFeaturedGames,
    getRecentGames, 
    getFavoriteGames, 
    getAllGames,
    getGameById,
    getGameBySlug,
    incrementPlayCount,
    getRelatedGames,
    searchGames,
    getSearchCount,
    trackSearchQuery,
    getTopSearches,
    getPopularTags
} from '../models/games.js';
import { getPageBySlug } from '../models/pages.js';
import CacheUtils from '../utils/cache.js';
import { awardFirstPlayExp } from '../utils/exp.js';
import SitemapUtils from '../utils/sitemap.js';
import response from '../utils/response.js';

// Initialize homepage cache
CacheUtils.initCache('homepage-games', 30 * 60 * 1000); // 30 minutes
CacheUtils.initCache('homepage-randomized-categories', 24 * 60 * 60 * 1000); // 24 hours

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

const index = async (req, res) => {
    try {
        // Try to get cached categories with games, top searches, popular tags, discovery games, featured games, and hall of fame
        let [categoriesWithGames, topSearches, popularTags, discoveryGames, featuredGames, hallOfFameUsers] = await Promise.all([
            CacheUtils.get('homepage-randomized-categories', 'randomized-categories-with-games'),
            CacheUtils.get('homepage-games', 'top-searches'),
            CacheUtils.get('homepage-games', 'popular-tags'),
            CacheUtils.get('homepage-games', 'discovery-games'),
            CacheUtils.get('homepage-games', 'featured-games'),
            CacheUtils.get('homepage-games', 'hall-of-fame-users')
        ]);
        
        if (!categoriesWithGames) {
            // Cache miss - fetch fresh data
            const categories = await getAllActiveCategories();
            const categoriesWithGamesTemp = [];

            // Get games for each category (limit to 8 games per category for carousel)
            for (const category of categories) {
                const allGames = await getGamesByCategory(category.id);
                // Only include categories that have games
                if (allGames && allGames.length > 0) {
                    // Randomize games within category using Fisher-Yates shuffle
                    for (let i = allGames.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [allGames[i], allGames[j]] = [allGames[j], allGames[i]];
                    }
                    
                    categoriesWithGamesTemp.push({
                        ...category,
                        games: allGames.slice(0, 10), // Limit to 8 games for carousel
                        totalGames: allGames.length // Store total count for display
                    });
                }
            }

            // Sort categories by game count (descending), then randomize within same game count tiers
            categoriesWithGamesTemp.sort((a, b) => {
                // First sort by total games (descending)
                if (a.totalGames !== b.totalGames) {
                    return b.totalGames - a.totalGames;
                }
                // For categories with same game count, randomize
                return Math.random() - 0.5;
            });

            // Limit to maximum 9 categories
            categoriesWithGames = categoriesWithGamesTemp.slice(0, 9);

            // Cache the randomized result for 24 hours
            await CacheUtils.put('homepage-randomized-categories', 'randomized-categories-with-games', categoriesWithGames);
        }
        
        if (!topSearches) {
            // Cache miss - fetch top searches
            topSearches = await getTopSearches(40); // Get top 8 searches for homepage
            await CacheUtils.put('homepage-games', 'top-searches', topSearches);
        }
        
        if (!popularTags) {
            // Cache miss - fetch popular tags
            popularTags = await getPopularTags(12); // Get top 12 popular tags for homepage
            await CacheUtils.put('homepage-games', 'popular-tags', popularTags);
        }
        
        if (!discoveryGames) {
            // Cache miss - fetch discovery games (mix of popular, recent, and top-rated)
            const [popularGames, recentGames, topRatedGames] = await Promise.all([
                getPopularGames(15),
                getRecentGames(null, 15),
                getTopRatedGames(15)
            ]);
            
            // Combine all games into one array
            const allGames = [...popularGames, ...recentGames, ...topRatedGames];
            
            // Remove duplicates based on game ID
            const uniqueGames = allGames.filter((game, index, self) => 
                index === self.findIndex(g => g.id === game.id)
            );
            
            // Shuffle the games randomly using Fisher-Yates algorithm
            for (let i = uniqueGames.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [uniqueGames[i], uniqueGames[j]] = [uniqueGames[j], uniqueGames[i]];
            }
            
            // Limit to 30 random games
            discoveryGames = uniqueGames.slice(0, 30);
            await CacheUtils.put('homepage-games', 'discovery-games', discoveryGames);
        }
        
        if (!featuredGames) {
            // Cache miss - fetch featured games
            featuredGames = await getFeaturedGames(6); // Get top 6 featured games for homepage
            await CacheUtils.put('homepage-games', 'featured-games', featuredGames);
        }
        
        if (!hallOfFameUsers) {
            // Cache miss - fetch top 5 users by total experience (consistent with leaderboard)
            const topUsers = await getTopUsersByExp(5);
            
            // Add rank and avatar URL to each user
            hallOfFameUsers = topUsers.map((user, index) => ({
                ...user,
                rank: index + 1,
                avatarUrl: getUserAvatarUrl(user),
                displayName: user.first_name || user.username
            }));
            
            await CacheUtils.put('homepage-games', 'hall-of-fame-users', hallOfFameUsers);
        }
        
        // Parse image data for featured games
        if (featuredGames && featuredGames.length > 0) {
            featuredGames = featuredGames.map(game => {
                if (game.thumbnail && typeof game.thumbnail === 'string' && game.thumbnail.startsWith('{')) {
                    try {
                        game.parsedThumbnail = JSON.parse(game.thumbnail);
                    } catch (e) {
                        game.parsedThumbnail = null;
                    }
                }
                return game;
            });
        }
        
        // Parse image data for discovery games
        if (discoveryGames && discoveryGames.length > 0) {
            discoveryGames = discoveryGames.map(game => {
                if (game.thumbnail && typeof game.thumbnail === 'string' && game.thumbnail.startsWith('{')) {
                    try {
                        game.parsedThumbnail = JSON.parse(game.thumbnail);
                    } catch (e) {
                        game.parsedThumbnail = null;
                    }
                }
                return game;
            });
        }
        
        // Parse image data for categories
        if (categoriesWithGames && categoriesWithGames.length > 0) {
            categoriesWithGames = categoriesWithGames.map(category => {
                if (category.games && category.games.length > 0) {
                    category.games = category.games.map(game => {
                        if (game.thumbnail && typeof game.thumbnail === 'string' && game.thumbnail.startsWith('{')) {
                            try {
                                game.parsedThumbnail = JSON.parse(game.thumbnail);
                            } catch (e) {
                                game.parsedThumbnail = null;
                            }
                        }
                        return game;
                    });
                }
                return category;
            });
        }

        // Generate JSON-LD structured data for homepage
        const siteName = res.locals.site_name || 'ARCADE';
        const siteDescription = res.locals.site_description || 'Play thousands of free online games, no downloads required. No sign-ups, no ads, no pop-ups, no registration required. Just play.';
        
        const organizationSchema = res.locals.jsonLd.generateOrganization({
            name: siteName,
            alternateName: "ARCADE",
            description: siteDescription,
            logo: res.locals.site_logo || "/assets/images/logo.png"
        });
        
        const websiteSchema = res.locals.jsonLd.generateWebSite({
            name: siteName,
            alternateName: "ARCADE"
        });
        
        const jsonLdScripts = res.locals.jsonLd.generateMultiple([organizationSchema, websiteSchema]);
        
        // Generate social media meta tags for home page with thumbnail grid
        const socialMetaTags = await res.locals.socialMeta.generateHomepageMeta({
            title: siteName,
            description: siteDescription,
            url: res.locals.site_url
        });

        const pageData = {
            page: "default",
            title: siteName,
            description: siteDescription,
            categories: categoriesWithGames,
            topSearches: topSearches || [],
            popularTags: popularTags || [],
            discoveryGames: discoveryGames || [],
            featuredGames: featuredGames || [],
            hallOfFameUsers: hallOfFameUsers || [],
            jsonLdScripts,
            socialMetaTags
        };

        res.render("pages/default", pageData);
    } catch (error) {
        consoleLog('error', 'Error fetching categories and games', { error: error });
        
        // Fallback to empty data if there's an error
        const pageData = {
            page: "default",
            title: i18n.translateSync('games.fallback.title', {}, req.language?.current || 'en'),
            description: i18n.translateSync('games.fallback.description', {}, req.language?.current || 'en'),
            categories: [],
            featuredGames: [],
            discoveryGames: [],
            topSearches: [],
            popularTags: [],
            hallOfFameUsers: []
        };

        res.render("pages/default", pageData);
    }
};

const login = (req, res) => {
    // Redirect to dashboard if user is already logged in
    if (res.locals.user) {
        return res.redirect('/');
    }

    const pageData = {
        page: "login",
        title: `${i18n.translateSync('games.page_titles.login', {}, req.language?.current || 'en')} · ${res.locals.site_name || 'ARCADE'}`,
        description: i18n.translateSync('games.page_descriptions.login', { siteName: res.locals.site_name || 'ARCADE' }, req.language?.current || 'en')
    };

    res.render("pages/login", pageData);
};

const register = (req, res) => {
    // Redirect to dashboard if user is already logged in
    if (res.locals.user) {
        return res.redirect('/');
    }

    const pageData = {
        page: "register",
        title: `${i18n.translateSync('games.page_titles.register', {}, req.language?.current || 'en')} · ${res.locals.site_name || 'ARCADE'}`,
        description: i18n.translateSync('games.page_descriptions.register', { siteName: res.locals.site_name || 'ARCADE' }, req.language?.current || 'en')
    };

    res.render("pages/register", pageData);
};

const games = async (req, res) => {
    try {
        const page = parseInt(req.params.page) || 1;
        const limit = parseInt(await getSetting('games_per_page', 20));
        const offset = (page - 1) * limit;
        
        const [games, popularTags] = await Promise.all([
            getAllGames(limit + 1, offset), // Get one extra to check if there's a next page
            getPopularTags(12) // Get top 12 popular tags
        ]);
        
        const hasNextPage = games && games.length > limit;
        
        if (hasNextPage) {
            games.pop(); // Remove the extra game
        }
        
        // Parse thumbnail data
        const parsedGames = parseThumbnailData(games);
        
        const pageData = {
            page: "games",
            title: `${i18n.translateSync('games.page_titles.all_games', {}, req.language?.current || 'en')} · ${res.locals.site_name || 'ARCADE'}`,
            description: i18n.translateSync('games.descriptions.all_games', { siteName: res.locals.site_name || 'ARCADE' }, req.language?.current || 'en'),
            listType: "all",
            listTitle: i18n.translateSync('games.lists.all.title', {}, req.language?.current || 'en'),
            listDescription: i18n.translateSync('games.lists.all.description', {}, req.language?.current || 'en'),
            bannerImage: null,
            bannerColor: "#3B82F6",
            games: parsedGames || [],
            popularTags: popularTags || [],
            currentPage: page,
            hasNextPage: hasNextPage,
            baseUrl: "/games"
        };

        res.render("pages/games", pageData);
    } catch (error) {
        consoleLog('error', 'Error fetching games', { error: error.message });
        res.redirect('/errors/500');
    }
};

const gamesCategory = async (req, res) => {
    const { slug } = req.params;
    
    try {
        const page = parseInt(req.params.page) || 1;
        const limit = parseInt(await getSetting('games_per_page', 20));
        const offset = (page - 1) * limit;
        
        const categoryData = await getCategoryBySlug(slug);
        
        if (!categoryData || categoryData.length === 0) {
            return res.redirect('/errors/404');
        }
        
        const category = categoryData[0];
        const [allGames, popularTags] = await Promise.all([
            getGamesByCategory(category.id),
            getPopularTags(12) // Get top 12 popular tags
        ]);
        const totalGames = allGames ? allGames.length : 0;
        
        // Paginate the games
        const games = allGames ? allGames.slice(offset, offset + limit) : [];
        const hasNextPage = totalGames > offset + limit;
        
        // Parse thumbnail data
        const parsedGames = parseThumbnailData(games);
        
        // Generate JSON-LD structured data for category collection
        const collectionSchema = res.locals.jsonLd.generateCollectionPage(category, parsedGames);
        
        // Generate breadcrumb schema
        const breadcrumbSchema = res.locals.jsonLd.generateBreadcrumb([
            { name: i18n.translateSync('games.breadcrumbs.home', {}, req.language?.current || 'en'), url: "/" },
            { name: i18n.translateSync('games.breadcrumbs.categories', {}, req.language?.current || 'en'), url: "/games" },
            { name: category.name }
        ]);
        
        const jsonLdScripts = res.locals.jsonLd.generateMultiple([collectionSchema, breadcrumbSchema]);
        
        // Generate social media meta tags for category page
        const socialMetaTags = res.locals.socialMeta.generateCategoryMeta(category, parsedGames);

        const pageData = {
            page: "games",
            title: `${category.name} Games · ${res.locals.site_name || 'ARCADE'}`,
            description: category.description || i18n.translateSync('games.descriptions.category_fallback', { categoryName: category.name, siteName: res.locals.site_name || 'ARCADE' }, req.language?.current || 'en'),
            listType: "category",
            listTitle: i18n.translateSync('games.page_titles.category_games', { categoryName: category.name }, req.language?.current || 'en'),
            listDescription: category.description || i18n.translateSync('games.descriptions.category_collection', { categoryName: category.name }, req.language?.current || 'en'),
            bannerImage: category.image,
            bannerColor: category.color || "#3B82F6",
            category: category,
            games: parsedGames,
            popularTags: popularTags || [],
            currentPage: page,
            hasNextPage: hasNextPage,
            baseUrl: `/games/category/${slug}`,
            jsonLdScripts,
            socialMetaTags
        };

        res.render("pages/games", pageData);
    } catch (error) {
        consoleLog('error', 'Error fetching category games', { error: error.message });
        res.redirect('/errors/500');
    }
};

const gamesTag = async (req, res) => {
    const { tag } = req.params;
    
    try {
        const page = parseInt(req.params.page) || 1;
        const limit = parseInt(await getSetting('games_per_page', 20));
        const offset = (page - 1) * limit;
        
        const [games, popularTags] = await Promise.all([
            getGamesByTag(tag, limit + 1, offset),
            getPopularTags(12) // Get top 12 popular tags
        ]);
        const hasNextPage = games && games.length > limit;
        
        if (hasNextPage) {
            games.pop();
        }
        
        // Parse thumbnail data
        const parsedGames = parseThumbnailData(games);
        
        const pageData = {
            page: "games",
            title: `${tag} Games · ${res.locals.site_name || 'ARCADE'}`,
            description: i18n.translateSync('games.descriptions.tag_games', { tag: tag, siteName: res.locals.site_name || 'ARCADE' }, req.language?.current || 'en'),
            listType: "tag",
            listTitle: i18n.translateSync('games.page_titles.tag_games', { tag: tag }, req.language?.current || 'en'),
            listDescription: i18n.translateSync('games.descriptions.tag_description', { tag: tag }, req.language?.current || 'en'),
            bannerImage: null,
            bannerColor: "#8B5CF6",
            tag: tag,
            games: parsedGames || [],
            popularTags: popularTags || [],
            currentPage: page,
            hasNextPage: hasNextPage,
            baseUrl: `/games/tag/${tag}`
        };

        res.render("pages/games", pageData);
    } catch (error) {
        consoleLog('error', 'Error fetching tag games', { error: error.message });
        res.redirect('/errors/500');
    }
};

const gamesTop = async (req, res) => {
    try {
        const page = parseInt(req.params.page) || 1;
        const limit = parseInt(await getSetting('games_per_page', 20));
        const offset = (page - 1) * limit;
        
        const [games, popularTags] = await Promise.all([
            getTopRatedGames(limit + 1, offset),
            getPopularTags(12) // Get top 12 popular tags
        ]);
        const hasNextPage = games && games.length > limit;
        
        if (hasNextPage) {
            games.pop();
        }
        
        // Parse thumbnail data
        const parsedGames = parseThumbnailData(games);
        
        const pageData = {
            page: "games",
            title: `${i18n.translateSync('games.page_titles.top_rated', {}, req.language?.current || 'en')} · ${res.locals.site_name || 'ARCADE'}`,
            description: i18n.translateSync('games.descriptions.top_rated', { siteName: res.locals.site_name || 'ARCADE' }, req.language?.current || 'en'),
            listType: "top",
            listTitle: i18n.translateSync('games.lists.top.title', {}, req.language?.current || 'en'),
            listDescription: i18n.translateSync('games.lists.top.description', {}, req.language?.current || 'en'),
            bannerImage: null,
            bannerColor: "#F59E0B",
            games: parsedGames || [],
            popularTags: popularTags || [],
            currentPage: page,
            hasNextPage: hasNextPage,
            baseUrl: "/games/top"
        };

        res.render("pages/games", pageData);
    } catch (error) {
        consoleLog('error', 'Error fetching top games', { error: error.message });
        res.redirect('/errors/500');
    }
};

const gamesPopular = async (req, res) => {
    try {
        const page = parseInt(req.params.page) || 1;
        const limit = parseInt(await getSetting('games_per_page', 20));
        const offset = (page - 1) * limit;
        
        const [games, popularTags] = await Promise.all([
            getPopularGames(limit + 1, offset),
            getPopularTags(12) // Get top 12 popular tags
        ]);
        const hasNextPage = games && games.length > limit;
        
        if (hasNextPage) {
            games.pop();
        }
        
        // Parse thumbnail data
        const parsedGames = parseThumbnailData(games);
        
        const pageData = {
            page: "games",
            title: `${i18n.translateSync('games.page_titles.popular', {}, req.language?.current || 'en')} · ${res.locals.site_name || 'ARCADE'}`,
            description: i18n.translateSync('games.descriptions.popular', { siteName: res.locals.site_name || 'ARCADE' }, req.language?.current || 'en'),
            listType: "popular",
            listTitle: i18n.translateSync('games.lists.popular.title', {}, req.language?.current || 'en'),
            listDescription: i18n.translateSync('games.lists.popular.description', {}, req.language?.current || 'en'),
            bannerImage: null,
            bannerColor: "#EF4444",
            games: parsedGames || [],
            popularTags: popularTags || [],
            currentPage: page,
            hasNextPage: hasNextPage,
            baseUrl: "/games/popular"
        };

        res.render("pages/games", pageData);
    } catch (error) {
        consoleLog('error', 'Error fetching popular games', { error: error.message });
        res.redirect('/errors/500');
    }
};

const gamesTrending = async (req, res) => {
    try {
        const page = parseInt(req.params.page) || 1;
        const limit = parseInt(await getSetting('games_per_page', 20));
        const offset = (page - 1) * limit;
        
        const [games, popularTags] = await Promise.all([
            getTrendingGames(limit + 1, offset),
            getPopularTags(12) // Get top 12 popular tags
        ]);
        const hasNextPage = games && games.length > limit;
        
        if (hasNextPage) {
            games.pop();
        }
        
        // Parse thumbnail data
        const parsedGames = parseThumbnailData(games);
        
        const pageData = {
            page: "games",
            title: `${i18n.translateSync('games.page_titles.trending', {}, req.language?.current || 'en')} · ${res.locals.site_name || 'ARCADE'}`,
            description: i18n.translateSync('games.descriptions.trending', { siteName: res.locals.site_name || 'ARCADE' }, req.language?.current || 'en'),
            listType: "trending",
            listTitle: i18n.translateSync('games.lists.trending.title', {}, req.language?.current || 'en'),
            listDescription: i18n.translateSync('games.lists.trending.description', {}, req.language?.current || 'en'),
            bannerImage: null,
            bannerColor: "#10B981",
            games: parsedGames || [],
            popularTags: popularTags || [],
            currentPage: page,
            hasNextPage: hasNextPage,
            baseUrl: "/games/trending"
        };

        res.render("pages/games", pageData);
    } catch (error) {
        consoleLog('error', 'Error fetching trending games', { error: error.message });
        res.redirect('/errors/500');
    }
};

const gamesFeatured = async (req, res) => {
    try {
        const page = parseInt(req.params.page) || 1;
        const limit = parseInt(await getSetting('games_per_page', 20));
        const offset = (page - 1) * limit;
        
        const [games, popularTags] = await Promise.all([
            getFeaturedGames(limit + 1, offset),
            getPopularTags(12) // Get top 12 popular tags
        ]);
        const hasNextPage = games && games.length > limit;
        
        if (hasNextPage) {
            games.pop();
        }
        
        // Parse thumbnail data
        const parsedGames = parseThumbnailData(games);
        
        const pageData = {
            page: "games",
            title: `${i18n.translateSync('games.page_titles.featured', {}, req.language?.current || 'en')} · ${res.locals.site_name || 'ARCADE'}`,
            description: i18n.translateSync('games.descriptions.featured', { siteName: res.locals.site_name || 'ARCADE' }, req.language?.current || 'en'),
            listType: "featured",
            listTitle: i18n.translateSync('games.lists.featured.title', {}, req.language?.current || 'en'),
            listDescription: i18n.translateSync('games.lists.featured.description', {}, req.language?.current || 'en'),
            bannerImage: null,
            bannerColor: "#F59E0B",
            games: parsedGames || [],
            popularTags: popularTags || [],
            currentPage: page,
            hasNextPage: hasNextPage,
            baseUrl: "/games/featured"
        };

        res.render("pages/games", pageData);
    } catch (error) {
        consoleLog('error', 'Error fetching featured games', { error: error.message });
        res.redirect('/errors/500');
    }
};

const gamesRecent = async (req, res) => {
    // Require login for recent games
    if (!res.locals.user) {
        return res.redirect('/login');
    }
    
    try {
        const page = parseInt(req.params.page) || 1;
        const limit = parseInt(await getSetting('games_per_page', 20));
        const offset = (page - 1) * limit;
        
        const [games, popularTags] = await Promise.all([
            getRecentGames(res.locals.user.id, limit + 1, offset),
            getPopularTags(12) // Get top 12 popular tags
        ]);
        const hasNextPage = games && games.length > limit;
        
        if (hasNextPage) {
            games.pop();
        }
        
        // Parse thumbnail data
        const parsedGames = parseThumbnailData(games);
        
        const pageData = {
            page: "games",
            title: `${i18n.translateSync('games.page_titles.recent', {}, req.language?.current || 'en')} · ${res.locals.site_name || 'ARCADE'}`,
            description: i18n.translateSync('games.descriptions.recent', { siteName: res.locals.site_name || 'ARCADE' }, req.language?.current || 'en'),
            listType: "recent",
            listTitle: i18n.translateSync('games.lists.recent.title', {}, req.language?.current || 'en'),
            listDescription: i18n.translateSync('games.lists.recent.description', {}, req.language?.current || 'en'),
            bannerImage: null,
            bannerColor: "#6366F1",
            games: parsedGames || [],
            popularTags: popularTags || [],
            currentPage: page,
            hasNextPage: hasNextPage,
            baseUrl: "/games/recent"
        };

        res.render("pages/games", pageData);
    } catch (error) {
        consoleLog('error', 'Error fetching recent games', { error: error.message });
        res.redirect('/errors/500');
    }
};

const gamesFavorites = async (req, res) => {
    // Require login for favorites
    if (!res.locals.user) {
        return res.redirect('/login');
    }
    
    try {
        const page = parseInt(req.params.page) || 1;
        const limit = parseInt(await getSetting('games_per_page', 20));
        const offset = (page - 1) * limit;
        
        const [games, popularTags] = await Promise.all([
            getFavoriteGames(res.locals.user.id, limit + 1, offset),
            getPopularTags(12) // Get top 12 popular tags
        ]);
        const hasNextPage = games && games.length > limit;
        
        if (hasNextPage) {
            games.pop();
        }
        
        // Parse thumbnail data
        const parsedGames = parseThumbnailData(games);
        
        const pageData = {
            page: "games",
            title: `${i18n.translateSync('games.page_titles.favorites', {}, req.language?.current || 'en')} · ${res.locals.site_name || 'ARCADE'}`,
            description: i18n.translateSync('games.descriptions.favorites', { siteName: res.locals.site_name || 'ARCADE' }, req.language?.current || 'en'),
            listType: "favorites",
            listTitle: i18n.translateSync('games.lists.favorites.title', {}, req.language?.current || 'en'),
            listDescription: i18n.translateSync('games.lists.favorites.description', {}, req.language?.current || 'en'),
            bannerImage: null,
            bannerColor: "#EC4899",
            games: parsedGames || [],
            popularTags: popularTags || [],
            currentPage: page,
            hasNextPage: hasNextPage,
            baseUrl: "/games/favorites"
        };

        res.render("pages/games", pageData);
    } catch (error) {
        consoleLog('error', 'Error fetching favorite games', { error: error.message });
        res.redirect('/errors/500');
    }
};

const play = async (req, res) => {
    const { slug } = req.params;
    
    try {
        const gameData = await getGameBySlug(slug);
        
        if (!gameData || gameData.length === 0) {
            return res.redirect('/errors/404');
        }
        
        const game = gameData[0];
        
        // Parse thumbnail data for the main game
        if (game.thumbnail && typeof game.thumbnail === 'string' && game.thumbnail.startsWith('{')) {
            try {
                game.parsedThumbnail = JSON.parse(game.thumbnail);
            } catch (e) {
                game.parsedThumbnail = null;
            }
        }
        
        // Get category information
        if (game.category_id) {
            const categoryData = await getCategoryById(game.category_id);
            game.category_name = categoryData && categoryData.length > 0 ? categoryData[0].name : i18n.translateSync('categories.default', {}, req.language?.current || 'en');
        } else {
            game.category_name = i18n.translateSync('categories.default', {}, req.language?.current || 'en');
        }
        
        // Increment play count for all users (logged in and guests)
        await incrementPlayCount(game.id);
        
        // Track last played if user is logged in
        let expResult = null;
        if (res.locals.user) {
            await addLastPlayed(res.locals.user.id, game.id);
            
            // Award first play EXP
            expResult = await awardFirstPlayExp(res.locals.user.id, game.id, game.title, req);
        }
        
        // Get initial comments (5 by default)
        const comments = await getCommentsByGameId(game.id, 5, 0);
        const commentCount = await getCommentCountByGameId(game.id);
        
        // Get user's rating if logged in
        let userRating = null;
        let isFavorited = false;
        if (res.locals.user) {
            userRating = await getRating(game.id, res.locals.user.id);
            
            // Check if user has favorited this game
            const favoriteData = await checkIfFavorite(res.locals.user.id, game.id);
            isFavorited = favoriteData && favoriteData.length > 0;
        }
        
        // Get game rating stats
        const ratingStats = await getGameRatingStats(game.id);
        
        // Get related games and parse thumbnails
        let relatedGames = await getRelatedGames(game.id, game.category_id, game.tags, 3);
        if (relatedGames && relatedGames.length > 0) {
            relatedGames = relatedGames.map(game => {
                if (game.thumbnail && typeof game.thumbnail === 'string' && game.thumbnail.startsWith('{')) {
                    try {
                        game.parsedThumbnail = JSON.parse(game.thumbnail);
                    } catch (e) {
                        game.parsedThumbnail = null;
                    }
                }
                return game;
            });
        }
        
        // Check if guest rating is enabled
        const allowGuestRating = await getSetting('allow_guest_rating', '0') === '1';
        
        // Generate JSON-LD structured data for game
        const gameSchema = res.locals.jsonLd.generateGame({
            ...game,
            rating: ratingStats.rating,
            rating_count: ratingStats.total_ratings
        });
        
        // Generate breadcrumb schema
        const breadcrumbSchema = res.locals.jsonLd.generateBreadcrumb([
            { name: i18n.translateSync('games.breadcrumbs.home', {}, req.language?.current || 'en'), url: "/" },
            { name: game.category_name, url: `/category/${game.category_id}` },
            { name: game.title }
        ]);
        
        const jsonLdScripts = res.locals.jsonLd.generateMultiple([gameSchema, breadcrumbSchema]);
        
        // Generate social media meta tags for the game
        const socialMetaTags = res.locals.socialMeta.generateGameMeta({
            ...game,
            rating: ratingStats.rating,
            rating_count: ratingStats.total_ratings
        });

        const pageData = {
            page: "play",
            title: `${game.title} · ${res.locals.site_name || 'ARCADE'}`,
            description: game.instructions || i18n.translateSync('games.descriptions.play_game', { gameTitle: game.title, siteName: res.locals.site_name || 'ARCADE' }, req.language?.current || 'en'),
            game: game,
            comments: comments,
            commentCount: commentCount,
            userRating: userRating,
            isFavorited: isFavorited,
            gameRating: ratingStats.rating,
            totalRatings: ratingStats.total_ratings,
            relatedGames: relatedGames,
            allowGuestRating: allowGuestRating,
            expResult: expResult,
            jsonLdScripts,
            socialMetaTags
        };

        res.render("pages/play", pageData);
    } catch (error) {
        consoleLog('error', 'Error fetching game', { error: error.message });
        res.redirect('/errors/500');
    }
};

const emulator = async (req, res) => {
    const { gameId } = req.params;
    
    try {
        const gameData = await getGameById(parseInt(gameId));
        
        if (!gameData || gameData.length === 0) {
            return res.status(404).send(i18n.translateSync('errors.game_not_found', {}, req.language?.current || 'en'));
        }
        
        const game = gameData[0];
        
        // Only allow ROM games
        if (game.game_type !== 'rom' || !game.rom_system || !game.game_file) {
            return res.status(400).send(i18n.translateSync('errors.invalid_game_type', {}, req.language?.current || 'en'));
        }
        
        // Parse thumbnail data and extract URL
        let thumbnailUrl = '/assets/images/default-game-thumbnail.webp';
        if (game.thumbnail && typeof game.thumbnail === 'string' && game.thumbnail.startsWith('{')) {
            try {
                const thumbnailData = JSON.parse(game.thumbnail);
                if (thumbnailData.webp && thumbnailData.webp.standard) {
                    thumbnailUrl = '/' + thumbnailData.webp.standard.relativePath;
                } else if (thumbnailData.original && thumbnailData.original.standard) {
                    thumbnailUrl = '/' + thumbnailData.original.standard.relativePath;
                }
            } catch (e) {
                consoleLog('warn', 'Failed to parse thumbnail data for emulator', { gameId, error: e.message });
            }
        } else if (game.thumbnail) {
            thumbnailUrl = game.thumbnail.startsWith('/') ? game.thumbnail : '/' + game.thumbnail;
        }
        
        // Simple page data for isolated emulator
        const pageData = {
            page: "emulator",
            title: `${game.title} - ${i18n.translateSync('games.emulator', {}, req.language?.current || 'en')}`,
            game: {
                ...game,
                thumbnailUrl: thumbnailUrl
            }
        };

        res.render("pages/emulator", pageData);
    } catch (error) {
        consoleLog('error', 'Error loading emulator', { error: error.message });
        res.status(500).send(i18n.translateSync('errors.emulator_load_failed', {}, req.language?.current || 'en'));
    }
};

const profile = async (req, res) => {
    const username = req.params.username;
    
    try {
        let profileUser;
        let isOwnProfile = false;
        
        if (username) {
            // Looking up specific user profile
            const userData = await getUserByUsername(username);
            if (!userData || userData.length === 0) {
                return res.redirect('/auth/login');
            }
            profileUser = userData[0];
            isOwnProfile = res.locals.user && res.locals.user.id === profileUser.id;
        } else {
            // Accessing /profile without username - must be logged in
            if (!res.locals.user) {
                return res.redirect('/errors/404');
            }
            profileUser = res.locals.user;
            isOwnProfile = true;
        }

        // Ensure avatar URL is set
        if (!profileUser.avatarUrl) {
            profileUser.avatarUrl = getUserAvatarUrl(profileUser);
        }

        // Fetch profile data in parallel
        const promises = [
            getFollowCounts(profileUser.id),
            getUserFavorites(profileUser.id),
            getLastPlayedByUserId(profileUser.id, 6)
        ];

        // Only check following status if current user is logged in and viewing someone else's profile
        if (res.locals.user && !isOwnProfile) {
            promises.push(isFollowing(res.locals.user.id, profileUser.id));
        }

        const results = await Promise.all(promises);
        const [followCounts, favorites, lastPlayed, isCurrentlyFollowing] = results;

        // Parse thumbnail data for favorites and lastPlayed
        if (favorites && favorites.length > 0) {
            favorites.forEach(favorite => {
                if (favorite.thumbnail) {
                    try {
                        favorite.parsedThumbnail = JSON.parse(favorite.thumbnail);
                    } catch (e) {
                        favorite.parsedThumbnail = null;
                    }
                }
            });
        }

        if (lastPlayed && lastPlayed.length > 0) {
            lastPlayed.forEach(game => {
                if (game.thumbnail) {
                    try {
                        game.parsedThumbnail = JSON.parse(game.thumbnail);
                    } catch (e) {
                        game.parsedThumbnail = null;
                    }
                }
            });
        }

        // Get country information if user has a country set
        const countries = getAllCountries();
        const userCountry = profileUser.country ? countries.find(c => c.code === profileUser.country) : null;

        // Calculate EXP progression data
        const currentLevel = profileUser.level || 1;
        const currentExp = profileUser.exp_points || 0;
        const expProgress = await getExpProgress(currentExp, currentLevel);
        const nextLevelExp = await getExpForNextLevel(currentLevel);
        const levelTitle = await getLevelTitle(currentLevel);

        // Generate JSON-LD structured data for user profile
        const personSchema = res.locals.jsonLd.generatePerson({
            ...profileUser,
            location: userCountry ? userCountry.name : undefined
        });
        
        const jsonLdScripts = res.locals.jsonLd.toScriptTag(personSchema);
        
        // Generate social media meta tags for profile page
        const socialMetaTags = res.locals.socialMeta.generateProfileMeta({
            ...profileUser,
            location: userCountry ? userCountry.name : undefined
        });

        const pageData = {
            page: "profile",
            title: `${profileUser.username} · ${res.locals.site_name || 'ARCADE'}`,
            description: i18n.translateSync('games.descriptions.profile', { username: profileUser.username, siteName: res.locals.site_name || 'ARCADE' }, req.language?.current || 'en'),
            profileUser: profileUser,
            isOwnProfile: isOwnProfile,
            followCounts: followCounts || { following: 0, followers: 0 },
            favorites: favorites || [],
            lastPlayed: lastPlayed || [],
            isCurrentlyFollowing: isCurrentlyFollowing || false,
            userCountry: userCountry,
            expProgress: expProgress,
            nextLevelExp: nextLevelExp,
            levelTitle: levelTitle,
            jsonLdScripts,
            socialMetaTags
        };

        res.render("pages/profile", pageData);
    } catch (error) {
        consoleLog('error', 'Error fetching profile data', { error: error.message });
        res.redirect('/errors/500');
    }
};

const settings = async (req, res) => {
    // Redirect to login if user is not logged in
    if (!res.locals.user) {
        return res.redirect('/auth/login');
    }

    try {
        // Fetch fresh user data from database
        const freshUserData = await getUserById(res.locals.user.id);
        
        if (!freshUserData || freshUserData.length === 0) {
            return res.redirect('/auth/login');
        }

        // Format date_of_birth for HTML date input if it exists
        const user = { ...freshUserData[0] };
        
        if (user.date_of_birth) {
            if (user.date_of_birth instanceof Date) {
                // Handle JavaScript Date objects
                user.date_of_birth = user.date_of_birth.toISOString().split('T')[0];
            } else if (typeof user.date_of_birth === 'string') {
                if (user.date_of_birth.includes('T')) {
                    // Handle ISO date strings (2025-06-18T16:00:00.000Z)
                    user.date_of_birth = user.date_of_birth.split('T')[0];
                } else if (user.date_of_birth.includes(' ')) {
                    // Handle datetime strings (2025-06-18 16:00:00)
                    user.date_of_birth = user.date_of_birth.split(' ')[0];
                }
                // If it's already in YYYY-MM-DD format, leave it as is
            }
        }

        const pageData = {
            page: "settings",
            title: `${i18n.translateSync('games.page_titles.settings', {}, req.language?.current || 'en')} · ${res.locals.site_name || 'ARCADE'}`,
            description: i18n.translateSync('games.page_descriptions.settings', { siteName: res.locals.site_name || 'ARCADE' }, req.language?.current || 'en'),
            countries: getAllCountries(),
            user: user
        };

        res.render("pages/settings", pageData);
    } catch (error) {
        consoleLog('error', 'Error fetching user data for settings', { error: error.message });
        res.redirect('/auth/login');
    }
};

const search = async (req, res) => {
    const query = req.params.query;
    
    try {
        if (!query || query.trim().length < 2) {
            return res.redirect('/games');
        }
        
        const page = parseInt(req.params.page) || 1;
        const limit = parseInt(await getSetting('games_per_page', 20));
        const offset = (page - 1) * limit;
        
        const trimmedQuery = decodeURIComponent(query.trim());
        
        // Track the search query (async, don't wait for it)
        trackSearchQuery(trimmedQuery).catch(err => {
            consoleLog('error', 'Error tracking search query', { error: err.message });
        });
        
        // Get search results, total count, and popular tags
        const [games, totalCount, popularTags] = await Promise.all([
            searchGames(trimmedQuery, limit, offset),
            getSearchCount(trimmedQuery),
            getPopularTags(12) // Get top 12 popular tags
        ]);
        
        const hasNextPage = totalCount > offset + limit;
        
        // Parse thumbnail data
        const parsedGames = parseThumbnailData(games);
        
        // Generate JSON-LD structured data for search results
        const searchResultsSchema = res.locals.jsonLd.generateSearchResultsPage(trimmedQuery, parsedGames || []);
        const jsonLdScripts = res.locals.jsonLd.toScriptTag(searchResultsSchema);

        const pageData = {
            page: "games",
            title: `${i18n.translateSync('games.page_titles.search', { query: trimmedQuery }, req.language?.current || 'en')} · ${res.locals.site_name || 'ARCADE'}`,
            description: i18n.translateSync('games.descriptions.search_results', { query: trimmedQuery, siteName: res.locals.site_name || 'ARCADE' }, req.language?.current || 'en'),
            listType: "search",
            listTitle: i18n.translateSync('games.lists.search_results.title', {}, req.language?.current || 'en'),
            listDescription: totalCount === 1 ? 
                i18n.translateSync('games.lists.search_results.description_single', { count: totalCount, query: trimmedQuery }, req.language?.current || 'en') :
                i18n.translateSync('games.lists.search_results.description_plural', { count: totalCount, query: trimmedQuery }, req.language?.current || 'en'),
            bannerImage: null,
            bannerColor: "#6366F1",
            searchQuery: trimmedQuery,
            games: parsedGames || [],
            popularTags: popularTags || [],
            currentPage: page,
            gamesPerPage: limit,
            hasNextPage: hasNextPage,
            totalCount: totalCount,
            baseUrl: `/search/${encodeURIComponent(trimmedQuery)}`,
            jsonLdScripts
        };

        res.render("pages/games", pageData);
    } catch (error) {
        consoleLog('error', 'Error searching games', { error: error.message });
        res.redirect('/errors/500');
    }
};

const customPage = async (req, res) => {
    try {
        const { slug } = req.params;
        
        const pages = await getPageBySlug(slug);
        
        if (!pages || pages.length === 0) {
            return res.redirect('/errors/404');
        }
        
        const page = pages[0];
        
        // Check if page is published
        if (!page.is_published) {
            return res.redirect('/errors/403');
        }
        
        // Fetch author information if created_by exists
        let author = null;
        if (page.created_by) {
            const authorData = await getUserById(page.created_by);
            author = authorData && authorData.length > 0 ? authorData[0] : null;
        }
        
        // Generate JSON-LD structured data for article
        const articleSchema = res.locals.jsonLd.generateArticle(page, author);
        const jsonLdScripts = res.locals.jsonLd.toScriptTag(articleSchema);

        const pageData = {
            page: `custom/${page.slug}`,
            title: `${page.title} · ${res.locals.site_name || 'ARCADE'}`,
            description: page.meta_description || page.title,
            keywords: page.meta_keywords || '',
            customPage: page,
            user: res.locals.user || null,
            jsonLdScripts
        };
        
        res.render("pages/page", pageData);
    } catch (error) {
        consoleLog('error', 'Error loading custom page', { error: error.message });
        res.redirect('/errors/500');
    }
};

const getSitemap = async (req, res) => {
    try {
        // Get the base URL from the request
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;
        
        // Generate the sitemap XML
        const sitemapXml = await SitemapUtils.generateSitemap(baseUrl);
        
        // Set appropriate headers for XML content
        res.set({
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        });
        
        // Send the XML response
        res.send(sitemapXml);
        
    } catch (error) {
        consoleLog('error', 'Error generating sitemap', { error });
        response(res, 500, i18n.translateSync('errors.sitemap_generation_failed', {}, req.language?.current || 'en'), { 
            error: error.message 
        });
    }
};

const getRobotsTxt = async (req, res) => {
    try {
        // Get the base URL from the request
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;
        
        // Generate the robots.txt content
        const robotsTxt = SitemapUtils.generateRobotsTxt(baseUrl);
        
        // Set appropriate headers for text content
        res.set({
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
        });
        
        // Send the text response
        res.send(robotsTxt);
        
    } catch (error) {
        consoleLog('error', 'Error generating robots.txt', { error });
        response(res, 500, i18n.translateSync('errors.robots_generation_failed', {}, req.language?.current || 'en'), { 
            error: error.message 
        });
    }
};

/**
 * Leaderboard page controller
 */
const getLeaderboardPage = async (req, res) => {
    try {
        // Get initial all-time leaderboard data based on EXP
        const allTimeLeaderboard = await getTopUsersByExp(50);
        
        // Helper functions for data validation and parsing (consistent with requests.js)
        const validateAndParseInt = (value, defaultValue = 0) => {
            if (value === null || value === undefined) return defaultValue;
            const parsed = parseInt(value);
            return isNaN(parsed) ? defaultValue : Math.max(0, parsed);
        };

        const validateAndParseBigInt = (value, defaultValue = 0) => {
            if (value === null || value === undefined) return defaultValue;
            const parsed = parseInt(value);
            return isNaN(parsed) ? defaultValue : Math.max(0, parsed);
        };

        // Add rank and standardize data for each player
        const playersWithRank = allTimeLeaderboard.map((player, index) => ({
            ...player,
            rank: index + 1,
            avatarUrl: getUserAvatarUrl(player),
            displayName: player.first_name || player.username,
            // Standardize numeric data with validation for EXP system
            level: validateAndParseInt(player.level, 1),
            exp_points: validateAndParseInt(player.exp_points, 0),
            total_exp_earned: validateAndParseBigInt(player.total_exp_earned, 0)
        }));
        
        const pageData = {
            page: "leaderboard",
            title: `${i18n.translateSync('leaderboard.title', {}, req.language?.current || 'en')} · ${res.locals.site_name || 'ARCADE'}`,
            description: i18n.translateSync('leaderboard.description', { siteName: res.locals.site_name || 'ARCADE' }, req.language?.current || 'en'),
            leaderboard: playersWithRank,
            totalPlayers: playersWithRank.length
        };
        
        res.render("pages/leaderboard", pageData);
    } catch (error) {
        consoleLog('error', 'Get leaderboard page error', { error: error.message });
        res.status(500).render("pages/errors/500", {
            page: "error",
            title: `${i18n.translateSync('errors.server_error', {}, req.language?.current || 'en')} · ${res.locals.site_name || 'ARCADE'}`,
            error: i18n.translateSync('errors.something_wrong', {}, req.language?.current || 'en')
        });
    }
};

export {
    index,
    login,
    register,
    games,
    gamesCategory,
    gamesTag,
    gamesTop,
    gamesPopular,
    gamesTrending,
    gamesFeatured,
    gamesRecent,
    gamesFavorites,
    play,
    emulator,
    profile,
    settings,
    search,
    customPage,
    getSitemap,
    getRobotsTxt,
    getLeaderboardPage
}