import { getAllGames } from '../models/games.js';
import { getAllCategories } from '../models/categories.js';
import { getAllPublishedPages } from '../models/pages.js';
import { getAllUsers } from '../models/users.js';
import { consoleLog } from './logger.js';

class SitemapUtils {
    static generateSitemapXML(urls) {
        const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        const xmlFooter = '\n</urlset>';
        
        const urlEntries = urls.map(url => {
            const priority = url.priority || '0.5';
            const changefreq = url.changefreq || 'weekly';
            const lastmod = url.lastmod ? new Date(url.lastmod).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            
            return `
  <url>
    <loc>${url.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
        });
        
        return xmlHeader + urlEntries.join('') + xmlFooter;
    }

    static async generateSitemapUrls(baseUrl) {
        const urls = [];
        
        // Add static pages
        urls.push({
            loc: baseUrl,
            priority: '1.0',
            changefreq: 'daily'
        });
        
        urls.push({
            loc: `${baseUrl}/games`,
            priority: '0.9',
            changefreq: 'daily'
        });
        
        urls.push({
            loc: `${baseUrl}/login`,
            priority: '0.3',
            changefreq: 'monthly'
        });
        
        urls.push({
            loc: `${baseUrl}/register`,
            priority: '0.3',
            changefreq: 'monthly'
        });

        // Add game categories
        try {
            const categories = await getAllCategories();
            categories.forEach(category => {
                urls.push({
                    loc: `${baseUrl}/games/category/${category.slug}`,
                    priority: '0.8',
                    changefreq: 'weekly',
                    lastmod: category.updated_at
                });
            });
        } catch (error) {
            consoleLog('error', 'Error fetching categories for sitemap', { error });
        }

        // Add individual games
        try {
            const games = await getAllGames();
            games.forEach(game => {
                urls.push({
                    loc: `${baseUrl}/play/${game.slug}`,
                    priority: '0.7',
                    changefreq: 'weekly',
                    lastmod: game.updated_at
                });
            });
        } catch (error) {
            consoleLog('error', 'Error fetching games for sitemap', { error });
        }

        // Add custom pages
        try {
            const pages = await getAllPublishedPages();
            pages.forEach(page => {
                urls.push({
                    loc: `${baseUrl}/page/${page.slug}`,
                    priority: '0.6',
                    changefreq: 'monthly',
                    lastmod: page.updated_at
                });
            });
        } catch (error) {
            consoleLog('error', 'Error fetching pages for sitemap', { error });
        }

        // Add user profiles (only active users)
        try {
            const users = await getAllUsers();
            const activeUsers = users.filter(user => user.is_active);
            activeUsers.forEach(user => {
                urls.push({
                    loc: `${baseUrl}/profile/${user.username}`,
                    priority: '0.4',
                    changefreq: 'monthly',
                    lastmod: user.updated_at
                });
            });
        } catch (error) {
            consoleLog('error', 'Error fetching users for sitemap', { error });
        }

        return urls;
    }

    static async generateSitemap(baseUrl) {
        const urls = await this.generateSitemapUrls(baseUrl);
        return this.generateSitemapXML(urls);
    }

    static generateRobotsTxt(baseUrl) {
        return `User-agent: *
Allow: /

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml

# Disallow admin areas
Disallow: /dashboard/
Disallow: /requests/
Disallow: /widgets/
Disallow: /auth/logout

# Disallow API endpoints
Disallow: /api/

# Allow important pages
Allow: /games/
Allow: /page/
Allow: /profile/
Allow: /search/`;
    }
}

export default SitemapUtils;