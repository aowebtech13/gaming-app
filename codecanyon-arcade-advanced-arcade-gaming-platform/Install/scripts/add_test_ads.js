#!/usr/bin/env node

/**
 * Add Test Advertisements Script
 * 
 * Truncates existing ads and adds sample advertisements to all placement types 
 * using light-colored dummy images for testing the advertisement system functionality.
 */

import { createAd } from '../src/models/ads.js';
import executeQuery from '../src/utils/mysql.js';
import { consoleLog } from '../src/utils/logger.js';
import CacheUtils from '../src/utils/cache.js';

// Standard ad placement configurations (from migration 20250725_000000_add_advertisement_system.js)
const adPlacements = [
    { id: 1, name: 'Header Banner', slug: 'header-banner', description: 'Banner ad displayed in the site header', width: 728, height: 90, placement_type: 'banner' },
    { id: 2, name: 'Sidebar Rectangle', slug: 'sidebar-rectangle', description: 'Medium rectangle ad in sidebar areas', width: 300, height: 250, placement_type: 'banner' },
    { id: 3, name: 'ROM Game Pre-Roll', slug: 'rom-preroll', description: 'EmulatorJS pre-roll ad for ROM games', width: 400, height: 300, placement_type: 'emulator' },
    { id: 4, name: 'ROM Game Interstitial', slug: 'rom-interstitial', description: 'EmulatorJS interstitial ad during ROM gameplay', width: 400, height: 300, placement_type: 'emulator' },
    { id: 5, name: 'General Game Pre-Roll', slug: 'game-preroll', description: 'Pre-roll ad shown before general games start', width: 400, height: 300, placement_type: 'game-api' },
    { id: 6, name: 'General Game Inter-Level', slug: 'game-interlevel', description: 'Inter-level ad for general games', width: 400, height: 300, placement_type: 'game-api' },
    { id: 7, name: 'Footer Banner', slug: 'footer-banner', description: 'Banner ad in footer area', width: 728, height: 90, placement_type: 'banner' },
    { id: 8, name: 'Game Loading', slug: 'game-loading', description: 'Ad shown during game loading screens', width: 300, height: 250, placement_type: 'game-api' },
    { id: 9, name: 'Flash Game Pre-Roll', slug: 'flash-preroll', description: 'Ruffle pre-roll ad shown before Flash games start', width: 400, height: 300, placement_type: 'flash' },
    { id: 10, name: 'Flash Game Interstitial', slug: 'flash-interstitial', description: 'Ruffle interstitial ad during Flash gameplay', width: 400, height: 300, placement_type: 'flash' },
    { id: 11, name: 'Below Game Banner', slug: 'below-game-banner', description: 'Banner ad displayed below the game frame', width: 728, height: 90, placement_type: 'banner' }
];

// Test ad configurations for each placement type
const testAds = [
    {
        placement_id: 1, // Header Banner (728x90)
        name: 'Test Header Banner Ad',
        ad_code: '<a href="https://codecanyon.net/item/arcade-advanced-arcade-gaming-platform/58973458" target="_blank"><img src="https://dummyimage.com/728x90/E3F2FD/1976D2&text=Header+Banner+Ad" alt="Header Banner Ad" style="width: 728px; height: 90px; border: 0;"></a>',
        fallback_ad_code: '<div style="width: 728px; height: 90px; background: #E3F2FD; display: flex; align-items: center; justify-content: center; border: 1px dashed #90CAF9; color: #1976D2; font-family: Arial, sans-serif;">Header Banner Ad Placeholder</div>'
    },
    {
        placement_id: 2, // Sidebar Rectangle (300x250)
        name: 'Test Sidebar Rectangle Ad',
        ad_code: '<a href="https://codecanyon.net/item/arcade-advanced-arcade-gaming-platform/58973458" target="_blank"><img src="https://dummyimage.com/300x250/F3E5F5/7B1FA2&text=Sidebar+Rectangle+Ad" alt="Sidebar Rectangle Ad" style="width: 300px; height: 250px; border: 0;"></a>',
        fallback_ad_code: '<div style="width: 300px; height: 250px; background: #F3E5F5; display: flex; align-items: center; justify-content: center; border: 1px dashed #CE93D8; color: #7B1FA2; font-family: Arial, sans-serif;">Sidebar Rectangle Ad Placeholder</div>'
    },
    {
        placement_id: 3, // ROM Game Pre-Roll (400x300)
        name: 'Test ROM Pre-Roll Ad',
        ad_code: '<a href="https://codecanyon.net/item/arcade-advanced-arcade-gaming-platform/58973458" target="_blank"><img src="https://dummyimage.com/400x300/E8F5E8/388E3C&text=ROM+Pre-Roll+Ad" alt="ROM Pre-Roll Ad" style="width: 400px; height: 300px; border: 0;"></a>',
        fallback_ad_code: '<div style="width: 400px; height: 300px; background: #E8F5E8; display: flex; align-items: center; justify-content: center; border: 1px dashed #A5D6A7; color: #388E3C; font-family: Arial, sans-serif;">ROM Pre-Roll Ad Placeholder</div>'
    },
    {
        placement_id: 4, // ROM Game Interstitial (400x300)
        name: 'Test ROM Interstitial Ad',
        ad_code: '<a href="https://codecanyon.net/item/arcade-advanced-arcade-gaming-platform/58973458" target="_blank"><img src="https://dummyimage.com/400x300/FFF3E0/F57C00&text=ROM+Interstitial+Ad" alt="ROM Interstitial Ad" style="width: 400px; height: 300px; border: 0;"></a>',
        fallback_ad_code: '<div style="width: 400px; height: 300px; background: #FFF3E0; display: flex; align-items: center; justify-content: center; border: 1px dashed #FFCC02; color: #F57C00; font-family: Arial, sans-serif;">ROM Interstitial Ad Placeholder</div>'
    },
    {
        placement_id: 5, // General Game Pre-Roll (400x300)
        name: 'Test General Pre-Roll Ad',
        ad_code: '<a href="https://codecanyon.net/item/arcade-advanced-arcade-gaming-platform/58973458" target="_blank"><img src="https://dummyimage.com/400x300/E1F5FE/0277BD&text=General+Pre-Roll+Ad" alt="General Pre-Roll Ad" style="width: 400px; height: 300px; border: 0;"></a>',
        fallback_ad_code: '<div style="width: 400px; height: 300px; background: #E1F5FE; display: flex; align-items: center; justify-content: center; border: 1px dashed #81D4FA; color: #0277BD; font-family: Arial, sans-serif;">General Pre-Roll Ad Placeholder</div>'
    },
    {
        placement_id: 6, // General Game Inter-Level (400x300)
        name: 'Test General Inter-Level Ad',
        ad_code: '<a href="https://codecanyon.net/item/arcade-advanced-arcade-gaming-platform/58973458" target="_blank"><img src="https://dummyimage.com/400x300/F1F8E9/689F38&text=General+Inter-Level+Ad" alt="General Inter-Level Ad" style="width: 400px; height: 300px; border: 0;"></a>',
        fallback_ad_code: '<div style="width: 400px; height: 300px; background: #F1F8E9; display: flex; align-items: center; justify-content: center; border: 1px dashed #AED581; color: #689F38; font-family: Arial, sans-serif;">General Inter-Level Ad Placeholder</div>'
    },
    {
        placement_id: 7, // Footer Banner (728x90)
        name: 'Test Footer Banner Ad',
        ad_code: '<a href="https://codecanyon.net/item/arcade-advanced-arcade-gaming-platform/58973458" target="_blank"><img src="https://dummyimage.com/728x90/E8EAF6/3F51B5&text=Footer+Banner+Ad" alt="Footer Banner Ad" style="width: 728px; height: 90px; border: 0;"></a>',
        fallback_ad_code: '<div style="width: 728px; height: 90px; background: #E8EAF6; display: flex; align-items: center; justify-content: center; border: 1px dashed #C5CAE9; color: #3F51B5; font-family: Arial, sans-serif;">Footer Banner Ad Placeholder</div>'
    },
    {
        placement_id: 8, // Game Loading (300x250)
        name: 'Test Game Loading Ad',
        ad_code: '<a href="https://codecanyon.net/item/arcade-advanced-arcade-gaming-platform/58973458" target="_blank"><img src="https://dummyimage.com/300x250/E0F2F1/00695C&text=Game+Loading+Ad" alt="Game Loading Ad" style="width: 300px; height: 250px; border: 0;"></a>',
        fallback_ad_code: '<div style="width: 300px; height: 250px; background: #E0F2F1; display: flex; align-items: center; justify-content: center; border: 1px dashed #80CBC4; color: #00695C; font-family: Arial, sans-serif;">Game Loading Ad Placeholder</div>'
    },
    {
        placement_id: 9, // Flash Game Pre-Roll (400x300)
        name: 'Test Flash Pre-Roll Ad',
        ad_code: '<a href="https://codecanyon.net/item/arcade-advanced-arcade-gaming-platform/58973458" target="_blank"><img src="https://dummyimage.com/400x300/FFF8E1/FF8F00&text=Flash+Pre-Roll+Ad" alt="Flash Pre-Roll Ad" style="width: 400px; height: 300px; border: 0;"></a>',
        fallback_ad_code: '<div style="width: 400px; height: 300px; background: #FFF8E1; display: flex; align-items: center; justify-content: center; border: 1px dashed #FFE082; color: #FF8F00; font-family: Arial, sans-serif;">Flash Pre-Roll Ad Placeholder</div>'
    },
    {
        placement_id: 10, // Flash Game Interstitial (400x300)
        name: 'Test Flash Interstitial Ad',
        ad_code: '<a href="https://codecanyon.net/item/arcade-advanced-arcade-gaming-platform/58973458" target="_blank"><img src="https://dummyimage.com/400x300/FAFAFA/424242&text=Flash+Interstitial+Ad" alt="Flash Interstitial Ad" style="width: 400px; height: 300px; border: 0;"></a>',
        fallback_ad_code: '<div style="width: 400px; height: 300px; background: #FAFAFA; display: flex; align-items: center; justify-content: center; border: 1px dashed #E0E0E0; color: #424242; font-family: Arial, sans-serif;">Flash Interstitial Ad Placeholder</div>'
    },
    {
        placement_id: 11, // Below Game Banner (728x90)
        name: 'Test Below Game Banner Ad',
        ad_code: '<a href="https://codecanyon.net/item/arcade-advanced-arcade-gaming-platform/58973458" target="_blank"><img src="https://dummyimage.com/728x90/E0F7FA/00695C&text=Below+Game+Banner+Ad" alt="Below Game Banner Ad" style="width: 728px; height: 90px; border: 0;"></a>',
        fallback_ad_code: '<div style="width: 728px; height: 90px; background: #E0F7FA; display: flex; align-items: center; justify-content: center; border: 1px dashed #4DB6AC; color: #00695C; font-family: Arial, sans-serif;">Below Game Banner Ad Placeholder</div>'
    }
];

async function addTestAdvertisements() {
    console.log('🗑️ Truncating existing advertisement tables...\n');
    
    try {
        // Truncate both tables to ensure clean state (ads depends on ad_placements)
        await executeQuery('TRUNCATE TABLE ads', []);
        consoleLog('success', '✅ Successfully truncated ads table');
        
        await executeQuery('TRUNCATE TABLE ad_placements', []);
        consoleLog('success', '✅ Successfully truncated ad_placements table');
        
        // Clear ads cache after truncating
        await CacheUtils.invalidateAdCaches();
        consoleLog('success', '✅ Cleared ads cache');
    } catch (error) {
        consoleLog('error', `❌ Error truncating tables: ${error.message}`);
        process.exit(1);
    }
    
    console.log('\n🏗️ Creating advertisement placement types...\n');
    
    let placementSuccessCount = 0;
    let placementErrorCount = 0;
    
    for (const placement of adPlacements) {
        try {
            await executeQuery(
                `INSERT INTO ad_placements (id, name, slug, description, width, height, placement_type, is_active) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                [placement.id, placement.name, placement.slug, placement.description, placement.width, placement.height, placement.placement_type]
            );
            
            placementSuccessCount++;
            consoleLog('success', `✅ Created placement "${placement.name}" (${placement.width}×${placement.height}) - ${placement.placement_type}`);
        } catch (error) {
            placementErrorCount++;
            consoleLog('error', `❌ Error creating placement "${placement.name}": ${error.message}`);
        }
    }
    
    console.log('\n📊 Placement Creation Summary:');
    console.log(`✅ Successfully created: ${placementSuccessCount} placements`);
    console.log(`❌ Errors encountered: ${placementErrorCount} placements`);
    
    if (placementErrorCount > 0) {
        console.log('\n⚠️ Some placements failed to create. Aborting ad creation.');
        process.exit(1);
    }
    
    console.log('\n🚀 Adding light-colored test advertisements to database...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const adData of testAds) {
        try {
            const insertId = await createAd(adData);
            
            if (insertId) {
                successCount++;
                consoleLog('success', `✅ Created ad "${adData.name}" (ID: ${insertId}) for placement ${adData.placement_id}`);
            } else {
                errorCount++;
                consoleLog('error', `❌ Failed to create ad "${adData.name}" for placement ${adData.placement_id}`);
            }
        } catch (error) {
            errorCount++;
            consoleLog('error', `❌ Error creating ad "${adData.name}": ${error.message}`);
        }
    }
    
    console.log('\n📊 Test Advertisement Creation Summary:');
    console.log(`✅ Successfully created: ${successCount} ads`);
    console.log(`❌ Errors encountered: ${errorCount} ads`);
    console.log(`📝 Total ads processed: ${testAds.length} ads`);
    
    if (successCount > 0) {
        // Clear ads cache after adding new ads to ensure fresh data
        try {
            await CacheUtils.invalidateAdCaches();
            consoleLog('success', '✅ Cleared ads cache after adding new advertisements');
        } catch (error) {
            consoleLog('error', `⚠️ Failed to clear ads cache: ${error.message}`);
        }
        
        console.log('\n🎉 Complete advertisement system has been reset and populated!');
        console.log('Features:');
        console.log('• All 11 placement types recreated with proper dimensions');
        console.log('• Light, pleasant background colors with good contrast');
        console.log('• "Ad" included in all advertisement text');
        console.log('• Both primary and fallback content for each placement');
        console.log('• Covers all placement types for comprehensive testing');
        console.log('• Uses proper dummyimage.com URL format');
        console.log('• Advertisement cache cleared for immediate availability');
        console.log('• Self-contained script - no dependency on migrations');
    }
    
    if (errorCount > 0) {
        console.log('\n⚠️  Some advertisements failed to create. Please check the error messages above.');
    }
    
    process.exit(errorCount > 0 ? 1 : 0);
}

// Run the script
addTestAdvertisements().catch((error) => {
    consoleLog('error', `Fatal error: ${error.message}`);
    process.exit(1);
});