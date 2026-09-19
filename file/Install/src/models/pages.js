import executeQuery from "../utils/mysql.js";
import CacheUtils from "../utils/cache.js";

// Initialize pages cache (7 days)
CacheUtils.initCache('custom-pages', 7 * 24 * 60 * 60 * 1000);

const getPageById = async (id) => {
    const data = await executeQuery("SELECT * FROM pages WHERE id = ? LIMIT 1", [id]);
    return data;
}

const getPageBySlug = async (slug) => {
    const cacheKey = `page:slug:${slug}`;
    
    // Try to get from cache first
    const cachedPage = await CacheUtils.get('custom-pages', cacheKey);
    if (cachedPage) {
        return cachedPage;
    }
    
    // If not in cache, fetch from database
    const data = await executeQuery("SELECT * FROM pages WHERE slug = ? LIMIT 1", [slug]);
    
    // Cache the result if found
    if (data && data.length > 0) {
        await CacheUtils.put('custom-pages', cacheKey, data);
    }
    
    return data;
}

const getPublishedPages = async (limit = 20, offset = 0) => {
    const data = await executeQuery(
        "SELECT * FROM pages WHERE is_published = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?",
        [limit, offset]
    );
    return data;
}

const getAllPages = async (limit = 20, offset = 0) => {
    const data = await executeQuery(
        "SELECT * FROM pages ORDER BY created_at DESC LIMIT ? OFFSET ?",
        [limit, offset]
    );
    return data;
}

const getAllPublishedPages = async () => {
    const data = await executeQuery(
        "SELECT * FROM pages WHERE is_published = 1 ORDER BY created_at DESC",
        []
    );
    return data;
}

const searchPages = async (query, limit = 20, offset = 0) => {
    const searchTerm = `%${query}%`;
    const data = await executeQuery(
        `SELECT * FROM pages 
         WHERE (title LIKE ? OR content LIKE ?) 
         ORDER BY 
            CASE 
                WHEN title LIKE ? THEN 1
                ELSE 2 
            END,
            created_at DESC 
         LIMIT ? OFFSET ?`,
        [searchTerm, searchTerm, searchTerm, limit, offset]
    );
    return data;
}

const getSearchCount = async (query) => {
    const searchTerm = `%${query}%`;
    const data = await executeQuery(
        `SELECT COUNT(*) as total 
         FROM pages 
         WHERE (title LIKE ? OR content LIKE ?)`,
        [searchTerm, searchTerm]
    );
    return data[0]?.total || 0;
}

const getTotalPageCount = async () => {
    const data = await executeQuery("SELECT COUNT(*) as total FROM pages", []);
    return data[0]?.total || 0;
}

const getPublishedPageCount = async () => {
    const data = await executeQuery("SELECT COUNT(*) as total FROM pages WHERE is_published = 1", []);
    return data[0]?.total || 0;
}

// Cache invalidation function
const invalidatePageCache = async (slug = null, pageId = null) => {
    if (slug) {
        await CacheUtils.del('custom-pages', `page:slug:${slug}`);
    }
    
    if (pageId) {
        // Get page by ID to find slug for cache invalidation
        const page = await executeQuery("SELECT slug FROM pages WHERE id = ? LIMIT 1", [pageId]);
        if (page && page.length > 0) {
            await CacheUtils.del('custom-pages', `page:slug:${page[0].slug}`);
        }
    }
};

export {
    getPageById,
    getPageBySlug,
    getPublishedPages,
    getAllPages,
    getAllPublishedPages,
    searchPages,
    getSearchCount,
    getTotalPageCount,
    getPublishedPageCount,
    invalidatePageCache
}