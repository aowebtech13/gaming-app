/**
 * Social Media Meta Tags Utility
 * Generates comprehensive social media meta tags for Open Graph, Twitter Cards, and other platforms
 */

import crypto from 'crypto';
import ThumbnailGridGenerator from './thumbnail_grid.js';
import { consoleLog } from './logger.js';

class SocialMetaGenerator {
    constructor(baseUrl, siteName) {
        this.baseUrl = baseUrl || '';
        this.siteName = siteName || 'ARCADE';
    }

    /**
     * HTML escape function for security
     * @private
     */
    _escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Extract image URL from thumbnail data
     * @private
     */
    _extractImageUrl(thumbnail, preferredSize = 'large') {
        if (!thumbnail) return null;

        // Check if thumbnail is a JSON string (new format)
        if (typeof thumbnail === 'string' && thumbnail.startsWith('{')) {
            try {
                const thumbnailData = JSON.parse(thumbnail);
                
                // Priority order based on preferred size
                const sizes = preferredSize === 'large' 
                    ? ['large', 'standard', 'thumbnail']
                    : ['standard', 'large', 'thumbnail'];
                
                // Try WebP first, then original
                for (const size of sizes) {
                    if (thumbnailData.webp && thumbnailData.webp[size]) {
                        return `${this.baseUrl}/${thumbnailData.webp[size].relativePath}`;
                    }
                    if (thumbnailData.original && thumbnailData.original[size]) {
                        return `${this.baseUrl}/${thumbnailData.original[size].relativePath}`;
                    }
                }
            } catch (e) {
                // If JSON parsing fails, treat as simple path
                return `${this.baseUrl}/${thumbnail}`;
            }
        } else {
            // Simple string path (legacy format)
            return `${this.baseUrl}/${thumbnail}`;
        }
        
        return null;
    }

    /**
     * Generate social media meta tags for games
     */
    generateGameMeta(game) {
        const gameUrl = `${this.baseUrl}/play/${game.slug}`;
        const gameTitle = this._escapeHtml(game.title);
        const gameDescription = this._escapeHtml(
            game.instructions || game.description || `Play ${game.title} online for free on ${this.siteName}`
        );
        
        const imageUrl = this._extractImageUrl(game.thumbnail, 'large');
        
        const metaTags = [];
        
        // Basic meta tags
        metaTags.push(`<meta name="description" content="${gameDescription}">`);
        metaTags.push(`<meta name="keywords" content="${game.title}, online game, ${game.category_name || 'games'}, ${this.siteName}">`);
        
        // Open Graph (Facebook, LinkedIn, Discord, WhatsApp, etc.)
        metaTags.push(`<meta property="og:type" content="game">`);
        metaTags.push(`<meta property="og:site_name" content="${this._escapeHtml(this.siteName)}">`);
        metaTags.push(`<meta property="og:title" content="${gameTitle}">`);
        metaTags.push(`<meta property="og:description" content="${gameDescription}">`);
        metaTags.push(`<meta property="og:url" content="${gameUrl}">`);
        metaTags.push(`<meta property="og:locale" content="en_US">`);
        
        if (imageUrl) {
            metaTags.push(`<meta property="og:image" content="${imageUrl}">`);
            metaTags.push(`<meta property="og:image:type" content="image/jpeg">`);
            metaTags.push(`<meta property="og:image:width" content="600">`);
            metaTags.push(`<meta property="og:image:height" content="600">`);
            metaTags.push(`<meta property="og:image:alt" content="${gameTitle} - Game Thumbnail">`);
        }
        
        // Game-specific Open Graph properties
        if (game.category_name) {
            metaTags.push(`<meta property="game:genre" content="${this._escapeHtml(game.category_name)}">`);
        }
        metaTags.push(`<meta property="game:developer" content="${this._escapeHtml(this.siteName)}">`);
        metaTags.push(`<meta property="game:platform" content="Web Browser">`);
        metaTags.push(`<meta property="game:price" content="Free">`);
        
        // Twitter Card
        metaTags.push(`<meta name="twitter:card" content="summary_large_image">`);
        metaTags.push(`<meta name="twitter:site" content="@${this.siteName}">`);
        metaTags.push(`<meta name="twitter:creator" content="@${this.siteName}">`);
        metaTags.push(`<meta name="twitter:title" content="${gameTitle}">`);
        metaTags.push(`<meta name="twitter:description" content="${gameDescription}">`);
        
        if (imageUrl) {
            metaTags.push(`<meta name="twitter:image" content="${imageUrl}">`);
            metaTags.push(`<meta name="twitter:image:alt" content="${gameTitle} - Game Thumbnail">`);
        }
        
        // Additional social platforms
        metaTags.push(`<meta property="article:publisher" content="${this._escapeHtml(this.siteName)}">`);
        
        return metaTags.join('\n');
    }

    /**
     * Generate social media meta tags for homepage with thumbnail grid
     */
    async generateHomepageMeta(pageData = {}) {
        const pageUrl = pageData.url || this.baseUrl;
        const pageTitle = this._escapeHtml(pageData.title || `${this.siteName} - Free Online Games`);
        const pageDescription = this._escapeHtml(
            pageData.description || `Play thousands of free online games on ${this.siteName}. Retro games, HTML5 games, Flash games and more!`
        );
        
        // Try to get the thumbnail grid image
        let pageImage = pageData.image || null;
        try {
            const gridGenerator = new ThumbnailGridGenerator();
            const metadata = await gridGenerator.getGridMetadata();
            
            if (metadata && metadata.generatedAt) {
                // Check if grid is not too old (within 14 days)
                const generatedAt = new Date(metadata.generatedAt);
                const now = new Date();
                const daysSinceGeneration = (now - generatedAt) / (1000 * 60 * 60 * 24);
                
                if (daysSinceGeneration <= 14) {
                    pageImage = '/assets/images/social/homepage-grid.jpg';
                }
            }
        } catch (error) {
            // Fallback to provided image or none
            consoleLog('warn', 'Could not load thumbnail grid metadata', { error: error.message });
        }
        
        const metaTags = [];
        
        // Basic meta tags
        metaTags.push(`<meta name="description" content="${pageDescription}">`);
        metaTags.push(`<meta name="keywords" content="online games, free games, retro games, HTML5 games, Flash games, gaming platform, ${this.siteName}">`);
        
        // Open Graph
        metaTags.push(`<meta property="og:type" content="website">`);
        metaTags.push(`<meta property="og:site_name" content="${this._escapeHtml(this.siteName)}">`);
        metaTags.push(`<meta property="og:title" content="${pageTitle}">`);
        metaTags.push(`<meta property="og:description" content="${pageDescription}">`);
        metaTags.push(`<meta property="og:url" content="${pageUrl}">`);
        metaTags.push(`<meta property="og:locale" content="en_US">`);
        
        if (pageImage) {
            const imageUrl = pageImage.startsWith('http') ? pageImage : `${this.baseUrl}${pageImage}`;
            metaTags.push(`<meta property="og:image" content="${imageUrl}">`);
            metaTags.push(`<meta property="og:image:type" content="image/jpeg">`);
            metaTags.push(`<meta property="og:image:width" content="1200">`);
            metaTags.push(`<meta property="og:image:height" content="630">`);
            metaTags.push(`<meta property="og:image:alt" content="${this.siteName} - Popular Games Collection">`);
        }
        
        // Website-specific Open Graph properties
        metaTags.push(`<meta property="og:see_also" content="${this.baseUrl}/games">`);
        metaTags.push(`<meta property="og:see_also" content="${this.baseUrl}/sitemap.xml">`);
        
        // Twitter Card
        metaTags.push(`<meta name="twitter:card" content="summary_large_image">`);
        metaTags.push(`<meta name="twitter:site" content="@${this.siteName}">`);
        metaTags.push(`<meta name="twitter:creator" content="@${this.siteName}">`);
        metaTags.push(`<meta name="twitter:title" content="${pageTitle}">`);
        metaTags.push(`<meta name="twitter:description" content="${pageDescription}">`);
        
        if (pageImage) {
            const imageUrl = pageImage.startsWith('http') ? pageImage : `${this.baseUrl}${pageImage}`;
            metaTags.push(`<meta name="twitter:image" content="${imageUrl}">`);
            metaTags.push(`<meta name="twitter:image:alt" content="${this.siteName} - Popular Games Collection">`);
        }
        
        // Additional platform-specific tags
        metaTags.push(`<meta property="article:publisher" content="${this._escapeHtml(this.siteName)}">`);
        metaTags.push(`<meta name="application-name" content="${this._escapeHtml(this.siteName)}">`);
        metaTags.push(`<meta name="theme-color" content="#667eea">`);
        
        return metaTags.join('\n');
    }

    /**
     * Generate social media meta tags for general pages
     */
    generatePageMeta(page) {
        const pageUrl = page.url || this.baseUrl;
        const pageTitle = this._escapeHtml(page.title || this.siteName);
        const pageDescription = this._escapeHtml(
            page.description || `${this.siteName} - Online Gaming Platform with thousands of free games`
        );
        const pageImage = page.image || null;
        
        const metaTags = [];
        
        // Basic meta tags
        metaTags.push(`<meta name="description" content="${pageDescription}">`);
        metaTags.push(`<meta name="keywords" content="online games, free games, gaming platform, ${this.siteName}">`);
        
        // Open Graph
        metaTags.push(`<meta property="og:type" content="website">`);
        metaTags.push(`<meta property="og:site_name" content="${this._escapeHtml(this.siteName)}">`);
        metaTags.push(`<meta property="og:title" content="${pageTitle}">`);
        metaTags.push(`<meta property="og:description" content="${pageDescription}">`);
        metaTags.push(`<meta property="og:url" content="${pageUrl}">`);
        metaTags.push(`<meta property="og:locale" content="en_US">`);
        
        if (pageImage) {
            const imageUrl = pageImage.startsWith('http') ? pageImage : `${this.baseUrl}/${pageImage}`;
            metaTags.push(`<meta property="og:image" content="${imageUrl}">`);
            metaTags.push(`<meta property="og:image:alt" content="${pageTitle}">`);
        }
        
        // Twitter Card
        metaTags.push(`<meta name="twitter:card" content="summary_large_image">`);
        metaTags.push(`<meta name="twitter:site" content="@${this.siteName}">`);
        metaTags.push(`<meta name="twitter:title" content="${pageTitle}">`);
        metaTags.push(`<meta name="twitter:description" content="${pageDescription}">`);
        
        if (pageImage) {
            const imageUrl = pageImage.startsWith('http') ? pageImage : `${this.baseUrl}/${pageImage}`;
            metaTags.push(`<meta name="twitter:image" content="${imageUrl}">`);
            metaTags.push(`<meta name="twitter:image:alt" content="${pageTitle}">`);
        }
        
        return metaTags.join('\n');
    }

    /**
     * Generate social media meta tags for user profiles
     */
    generateProfileMeta(user) {
        const profileUrl = `${this.baseUrl}/profile/${user.username}`;
        const profileTitle = this._escapeHtml(`${user.fullname || user.username} - ${this.siteName}`);
        const profileDescription = this._escapeHtml(
            user.bio || `Check out ${user.fullname || user.username}'s gaming profile on ${this.siteName}`
        );
        
        let imageUrl = null;
        if (user.avatar) {
            imageUrl = user.avatar.startsWith('http') ? user.avatar : `${this.baseUrl}/${user.avatar}`;
        } else if (user.email) {
            const emailHash = crypto.createHash('md5').update(user.email.toLowerCase()).digest('hex');
            imageUrl = `https://www.gravatar.com/avatar/${emailHash}?d=mp&s=600`;
        }
        
        const metaTags = [];
        
        // Basic meta tags
        metaTags.push(`<meta name="description" content="${profileDescription}">`);
        metaTags.push(`<meta name="keywords" content="${user.username}, gaming profile, ${this.siteName}">`);
        
        // Open Graph
        metaTags.push(`<meta property="og:type" content="profile">`);
        metaTags.push(`<meta property="og:site_name" content="${this._escapeHtml(this.siteName)}">`);
        metaTags.push(`<meta property="og:title" content="${profileTitle}">`);
        metaTags.push(`<meta property="og:description" content="${profileDescription}">`);
        metaTags.push(`<meta property="og:url" content="${profileUrl}">`);
        metaTags.push(`<meta property="profile:username" content="${this._escapeHtml(user.username)}">`);
        
        if (user.fullname) {
            const names = user.fullname.split(' ');
            if (names.length >= 2) {
                metaTags.push(`<meta property="profile:first_name" content="${this._escapeHtml(names[0])}">`);
                metaTags.push(`<meta property="profile:last_name" content="${this._escapeHtml(names.slice(1).join(' '))}">`);
            }
        }
        
        if (imageUrl) {
            metaTags.push(`<meta property="og:image" content="${imageUrl}">`);
            metaTags.push(`<meta property="og:image:alt" content="${user.fullname || user.username} - Profile Picture">`);
        }
        
        // Twitter Card
        metaTags.push(`<meta name="twitter:card" content="summary">`);
        metaTags.push(`<meta name="twitter:site" content="@${this.siteName}">`);
        metaTags.push(`<meta name="twitter:title" content="${profileTitle}">`);
        metaTags.push(`<meta name="twitter:description" content="${profileDescription}">`);
        
        if (imageUrl) {
            metaTags.push(`<meta name="twitter:image" content="${imageUrl}">`);
            metaTags.push(`<meta name="twitter:image:alt" content="${user.fullname || user.username} - Profile Picture">`);
        }
        
        return metaTags.join('\n');
    }

    /**
     * Generate social media meta tags for category pages
     */
    generateCategoryMeta(category, games = []) {
        const categoryUrl = `${this.baseUrl}/category/${category.slug}`;
        const categoryTitle = this._escapeHtml(`${category.name} Games - ${this.siteName}`);
        const categoryDescription = this._escapeHtml(
            category.description || `Play ${category.name} games online for free. ${games.length} games available on ${this.siteName}`
        );
        
        // Use first game's thumbnail as category image if available
        let imageUrl = null;
        if (games.length > 0 && games[0].thumbnail) {
            imageUrl = this._extractImageUrl(games[0].thumbnail, 'large');
        }
        
        const metaTags = [];
        
        // Basic meta tags
        metaTags.push(`<meta name="description" content="${categoryDescription}">`);
        metaTags.push(`<meta name="keywords" content="${category.name}, games, ${category.name} games, ${this.siteName}">`);
        
        // Open Graph
        metaTags.push(`<meta property="og:type" content="website">`);
        metaTags.push(`<meta property="og:site_name" content="${this._escapeHtml(this.siteName)}">`);
        metaTags.push(`<meta property="og:title" content="${categoryTitle}">`);
        metaTags.push(`<meta property="og:description" content="${categoryDescription}">`);
        metaTags.push(`<meta property="og:url" content="${categoryUrl}">`);
        
        if (imageUrl) {
            metaTags.push(`<meta property="og:image" content="${imageUrl}">`);
            metaTags.push(`<meta property="og:image:alt" content="${category.name} Games">`);
        }
        
        // Twitter Card
        metaTags.push(`<meta name="twitter:card" content="summary_large_image">`);
        metaTags.push(`<meta name="twitter:site" content="@${this.siteName}">`);
        metaTags.push(`<meta name="twitter:title" content="${categoryTitle}">`);
        metaTags.push(`<meta name="twitter:description" content="${categoryDescription}">`);
        
        if (imageUrl) {
            metaTags.push(`<meta name="twitter:image" content="${imageUrl}">`);
            metaTags.push(`<meta name="twitter:image:alt" content="${category.name} Games">`);
        }
        
        return metaTags.join('\n');
    }

    /**
     * Generate social media meta tags for search results
     */
    generateSearchMeta(query, results = []) {
        const searchUrl = `${this.baseUrl}/search/${encodeURIComponent(query)}`;
        const searchTitle = this._escapeHtml(`Search: ${query} - ${this.siteName}`);
        const searchDescription = this._escapeHtml(
            `Found ${results.length} games matching "${query}" on ${this.siteName}. Play online for free!`
        );
        
        const metaTags = [];
        
        // Basic meta tags
        metaTags.push(`<meta name="description" content="${searchDescription}">`);
        metaTags.push(`<meta name="keywords" content="${query}, search, games, ${this.siteName}">`);
        
        // Open Graph
        metaTags.push(`<meta property="og:type" content="website">`);
        metaTags.push(`<meta property="og:site_name" content="${this._escapeHtml(this.siteName)}">`);
        metaTags.push(`<meta property="og:title" content="${searchTitle}">`);
        metaTags.push(`<meta property="og:description" content="${searchDescription}">`);
        metaTags.push(`<meta property="og:url" content="${searchUrl}">`);
        
        // Twitter Card
        metaTags.push(`<meta name="twitter:card" content="summary">`);
        metaTags.push(`<meta name="twitter:site" content="@${this.siteName}">`);
        metaTags.push(`<meta name="twitter:title" content="${searchTitle}">`);
        metaTags.push(`<meta name="twitter:description" content="${searchDescription}">`);
        
        return metaTags.join('\n');
    }
}

export default SocialMetaGenerator;