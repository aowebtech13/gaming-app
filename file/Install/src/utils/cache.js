import cache from 'persistent-cache';
import { consoleLog } from './logger.js';

/**
 * All-in-one cache utility
 */
const cacheInstances = new Map();
const cacheUsageTracking = new Map(); // Track last access time for each cache

const CacheUtils = {
  /**
   * Initialize a cache instance
   * @param {string} cacheName - Cache name
   * @param {number} duration - Cache duration in milliseconds
   * @returns {Object} Cache instance
   */
  initCache(cacheName, duration = 24 * 60 * 60 * 1000) {
    if (!cacheInstances.has(cacheName)) {
      const cacheInstance = cache({
        name: cacheName,
        duration: duration,
        memory: false,
        dir: './cache' // Explicitly specify cache directory
      });
      cacheInstances.set(cacheName, cacheInstance);
    }
    
    // Track cache usage
    cacheUsageTracking.set(cacheName, Date.now());
    
    return cacheInstances.get(cacheName);
  },

  /**
   * Get value from cache
   * @param {string} cacheName - Cache name
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or null
   */
  async get(cacheName, key) {
    return new Promise((resolve) => {
      const cacheInstance = cacheInstances.get(cacheName);
      if (!cacheInstance) {
        consoleLog('cache', `Cache ${cacheName} not initialized`, { action: 'GET', key, hit: false });
        resolve(null);
        return;
      }
      
      // Track cache usage
      cacheUsageTracking.set(cacheName, Date.now());
      
      cacheInstance.get(key, function(err, value) {
        if (err) {
          consoleLog('cache', `Error getting cache (${cacheName}): ${err.message}`, { action: 'GET', key, hit: false });
          resolve(null);
        } else {
          resolve(value);
        }
      });
    });
  },

  /**
   * Put value in cache
   * @param {string} cacheName - Cache name
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @returns {Promise<boolean>} Success status
   */
  async put(cacheName, key, value) {
    return new Promise((resolve) => {
      const cacheInstance = cacheInstances.get(cacheName);
      if (!cacheInstance) {
        consoleLog('cache', `Cache ${cacheName} not initialized`, { action: 'SET', key });
        resolve(false);
        return;
      }
      
      // Track cache usage
      cacheUsageTracking.set(cacheName, Date.now());
      
      cacheInstance.put(key, value, function(err) {
        if (err) {
          consoleLog('cache', `Error putting cache (${cacheName}): ${err.message}`, { action: 'SET', key });
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  },

  /**
   * Delete key from cache
   * @param {string} cacheName - Cache name
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async del(cacheName, key) {
    return new Promise((resolve) => {
      const cacheInstance = cacheInstances.get(cacheName);
      if (!cacheInstance) {
        consoleLog('cache', `Cache ${cacheName} not initialized`, { action: 'DEL', key });
        resolve(false);
        return;
      }
      
      cacheInstance.delete(key, function(err) {
        if (err) {
          consoleLog('cache', `Error deleting cache (${cacheName}): ${err.message}`, { action: 'DEL', key });
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  },

  /**
   * Clear entire cache by recreating the cache instance
   * @param {string} cacheName - Cache name
   * @returns {Promise<boolean>} Success status
   */
  async clear(cacheName) {
    try {
      // Remove the current cache instance
      if (cacheInstances.has(cacheName)) {
        cacheInstances.delete(cacheName);
        cacheUsageTracking.delete(cacheName);
      }
      
      // Reinitialize the cache (this effectively clears it)
      this.initCache(cacheName);
      
      consoleLog('cache', `Cache ${cacheName} cleared by recreation`, { action: 'CLEAR' });
      return true;
    } catch (error) {
      consoleLog('cache', `Error clearing cache (${cacheName}): ${error.message}`, { action: 'CLEAR' });
      return false;
    }
  },

  /**
   * Invalidate all game-related caches
   * Called when games are created, updated, or deleted
   */
  async invalidateGameCaches() {
    const gameCacheKeys = [
      // Homepage caches
      ['homepage-games', 'categories-with-games'],
      ['homepage-games', 'discovery-games'],
      ['homepage-games', 'featured-games'],
      ['homepage-games', 'popular-tags'],
      ['homepage-games', 'top-searches'],
      // New randomized categories cache
      ['homepage-randomized-categories', 'randomized-categories-with-games'],
      // Other game-related caches
      ['featured-games', 'featured-games-6'],
      ['popular-tags', 'popular-tags-12'],
      ['top-searches', 'top-searches-40'],
      ['sidebar-categories', 'random-categories'],
      // Total game count cache (used in header search placeholder)
      ['game-stats', 'total-count']
    ];

    const invalidationPromises = gameCacheKeys.map(([cacheName, key]) => 
      this.del(cacheName, key)
    );

    await Promise.all(invalidationPromises);
    consoleLog('cache', 'Invalidated all game-related caches', { action: 'INVALIDATE_GAMES' });
  },

  /**
   * Invalidate all category-related caches
   * Called when categories are created, updated, or deleted
   */
  async invalidateCategoryCaches() {
    const categoryCacheKeys = [
      // Homepage caches
      ['homepage-games', 'categories-with-games'],
      ['homepage-games', 'discovery-games'],
      // New randomized categories cache
      ['homepage-randomized-categories', 'randomized-categories-with-games'],
      // Sidebar and other category caches
      ['sidebar-categories', 'random-categories']
    ];

    const invalidationPromises = categoryCacheKeys.map(([cacheName, key]) => 
      this.del(cacheName, key)
    );

    await Promise.all(invalidationPromises);
    consoleLog('cache', 'Invalidated all category-related caches', { action: 'INVALIDATE_CATEGORIES' });
  },

  /**
   * Invalidate all homepage-related caches
   * Called when any homepage data changes
   */
  async invalidateHomepageCaches() {
    const homepageCacheKeys = [
      ['homepage-games', 'categories-with-games'],
      ['homepage-games', 'discovery-games'],
      ['homepage-games', 'featured-games'],
      ['homepage-games', 'popular-tags'],
      ['homepage-games', 'top-searches'],
      ['homepage-randomized-categories', 'randomized-categories-with-games']
    ];

    const invalidationPromises = homepageCacheKeys.map(([cacheName, key]) => 
      this.del(cacheName, key)
    );

    await Promise.all(invalidationPromises);
    consoleLog('cache', 'Invalidated all homepage-related caches', { action: 'INVALIDATE_HOMEPAGE' });
  },

  /**
   * Invalidate all advertisement-related caches
   * Called when ads are created, updated, or deleted
   */
  async invalidateAdCaches() {
    try {
      // Remove the ads cache instance completely (this clears all cached ads)
      if (cacheInstances.has('ads')) {
        cacheInstances.delete('ads');
        cacheUsageTracking.delete('ads');
      }
      
      consoleLog('cache', 'Invalidated all advertisement-related caches', { action: 'INVALIDATE_ADS' });
      return true;
    } catch (error) {
      consoleLog('cache', `Error invalidating ad caches: ${error.message}`, { action: 'INVALIDATE_ADS', error: error.message });
      return false;
    }
  },

  /**
   * Invalidate all ad placement-related caches
   * Called when ad placements are created, updated, or deleted
   */
  async invalidateAdPlacementCaches() {
    try {
      // Remove the ad-placements cache instance completely (this clears all cached placements)
      if (cacheInstances.has('ad-placements')) {
        cacheInstances.delete('ad-placements');
        cacheUsageTracking.delete('ad-placements');
      }
      
      consoleLog('cache', 'Invalidated all ad placement-related caches', { action: 'INVALIDATE_AD_PLACEMENTS' });
      return true;
    } catch (error) {
      consoleLog('cache', `Error invalidating ad placement caches: ${error.message}`, { action: 'INVALIDATE_AD_PLACEMENTS', error: error.message });
      return false;
    }
  },

  /**
   * Invalidate all language-related caches
   * Called when language files are updated or system cache is cleared
   */
  async invalidateLanguageCaches() {
    try {
      // Clear both language cache instances
      if (cacheInstances.has('i18n-languages')) {
        cacheInstances.delete('i18n-languages');
        cacheUsageTracking.delete('i18n-languages');
      }
      
      if (cacheInstances.has('i18n-metadata')) {
        cacheInstances.delete('i18n-metadata');
        cacheUsageTracking.delete('i18n-metadata');
      }
      
      consoleLog('cache', 'Invalidated all language-related caches', { action: 'INVALIDATE_LANGUAGES' });
      return true;
    } catch (error) {
      consoleLog('cache', `Error invalidating language caches: ${error.message}`, { action: 'INVALIDATE_LANGUAGES', error: error.message });
      return false;
    }
  },

  /**
   * Clear all cache instances
   * Called when clearing entire system cache
   */
  async clearAllCaches() {
    try {
      // Run all the existing invalidation functions
      await this.invalidateGameCaches();
      await this.invalidateCategoryCaches();
      await this.invalidateHomepageCaches();
      await this.invalidateAdCaches();
      await this.invalidateAdPlacementCaches();
      await this.invalidateLanguageCaches();
      
      consoleLog('cache', 'Successfully cleared all system caches', { action: 'CLEAR_ALL' });
      return true;
    } catch (error) {
      consoleLog('cache', `Error clearing all caches: ${error.message}`, { action: 'CLEAR_ALL', error: error.message });
      return false;
    }
  },

  /**
   * Clean up unused cache instances
   * Removes cache instances that haven't been used in the specified time
   * @param {number} maxAge - Maximum age in milliseconds (default: 24 hours)
   */
  async cleanupUnusedCaches(maxAge = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const unusedCaches = [];
    
    // Find unused caches
    cacheUsageTracking.forEach((lastUsed, cacheName) => {
      if (now - lastUsed > maxAge) {
        unusedCaches.push(cacheName);
      }
    });
    
    // Remove unused cache instances
    for (const cacheName of unusedCaches) {
      cacheInstances.delete(cacheName);
      cacheUsageTracking.delete(cacheName);
    }
    
    if (unusedCaches.length > 0) {
      consoleLog('cache', 'Cleaned up unused cache instances', {
        action: 'CLEANUP_UNUSED',
        removedCaches: unusedCaches,
        remainingCaches: cacheInstances.size
      });
    }
    
    return unusedCaches.length;
  },

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return {
      totalCacheInstances: cacheInstances.size,
      cacheNames: Array.from(cacheInstances.keys()),
      lastUsageTimes: Object.fromEntries(cacheUsageTracking)
    };
  },

  /**
   * Force cleanup of specific cache instance
   * @param {string} cacheName - Cache name to remove
   */
  async removeCacheInstance(cacheName) {
    if (cacheInstances.has(cacheName)) {
      cacheInstances.delete(cacheName);
      cacheUsageTracking.delete(cacheName);
      
      consoleLog('cache', 'Removed cache instance', {
        action: 'REMOVE_INSTANCE',
        cacheName,
        remainingCaches: cacheInstances.size
      });
      
      return true;
    }
    
    return false;
  }
};

export default CacheUtils;