/**
 * Migration: Add Advertisement System
 * 
 * Creates the advertisement system tables with comprehensive ad placement management
 * and individual advertisement configuration. Includes default placement types for
 * different gaming scenarios including EmulatorJS, Flash (Ruffle), and HTML5 games.
 * 
 * IMPORTANT: Follow database guidelines:
 * - Use only simple column types: tinyint, int, bigint, float, tinytext, text, longtext, datetime, date, time
 * - NO forbidden types: varchar, char, timestamp, enum, set, json, decimal
 * - TEXT columns cannot have DEFAULT values
 * - Always use utf8mb4_unicode_ci collation
 */

/**
 * Run the migration (forward)
 * @param {object} connection - MySQL connection object
 */
export async function up(connection) {
    // Advertisement Placements Table
    await connection.execute(`
        CREATE TABLE \`ad_placements\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`name\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`slug\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`description\` text COLLATE utf8mb4_unicode_ci,
          \`width\` int(11) NOT NULL,
          \`height\` int(11) NOT NULL,
          \`placement_type\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Note: Unique constraint on slug handled at application level
    // as tinytext columns cannot have direct unique indexes

    // Advertisements Table
    await connection.execute(`
        CREATE TABLE \`ads\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`placement_id\` int(11) NOT NULL,
          \`name\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`ad_code\` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`fallback_ad_code\` longtext COLLATE utf8mb4_unicode_ci,
          \`priority\` int(11) NOT NULL DEFAULT 1,
          \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);


    // Default Advertisement Placements
    await connection.execute(`
        INSERT INTO \`ad_placements\` (\`id\`, \`name\`, \`slug\`, \`description\`, \`width\`, \`height\`, \`placement_type\`, \`is_active\`) VALUES
        (1, 'Header Banner', 'header-banner', 'Banner ad displayed in the site header', 728, 90, 'banner', 1),
        (2, 'Sidebar Rectangle', 'sidebar-rectangle', 'Medium rectangle ad in sidebar areas', 300, 250, 'banner', 1),
        (3, 'ROM Game Pre-Roll', 'rom-preroll', 'EmulatorJS pre-roll ad for ROM games', 400, 300, 'emulator', 1),
        (4, 'ROM Game Interstitial', 'rom-interstitial', 'EmulatorJS interstitial ad during ROM gameplay', 400, 300, 'emulator', 1),
        (5, 'General Game Pre-Roll', 'game-preroll', 'Pre-roll ad shown before general games start', 400, 300, 'game-api', 1),
        (6, 'General Game Inter-Level', 'game-interlevel', 'Inter-level ad for general games', 400, 300, 'game-api', 1),
        (7, 'Footer Banner', 'footer-banner', 'Banner ad in footer area', 728, 90, 'banner', 1),
        (8, 'Game Loading', 'game-loading', 'Ad shown during game loading screens', 300, 250, 'game-api', 1),
        (9, 'Flash Game Pre-Roll', 'flash-preroll', 'Ruffle pre-roll ad shown before Flash games start', 400, 300, 'flash', 1),
        (10, 'Flash Game Interstitial', 'flash-interstitial', 'Ruffle interstitial ad during Flash gameplay', 400, 300, 'flash', 1),
        (11, 'Below Game Banner', 'below-game-banner', 'Banner ad displayed below the game frame', 728, 90, 'banner', 1);
    `);
}

/**
 * Reverse the migration (rollback)
 * @param {object} connection - MySQL connection object  
 */
export async function down(connection) {
    // Drop tables in reverse dependency order (ads depends on ad_placements)
    await connection.execute('DROP TABLE IF EXISTS \`ads\`');
    await connection.execute('DROP TABLE IF EXISTS \`ad_placements\`');
}

/**
 * SQL for emergency rollback (stored in database)
 */
export const rollback = `
    DROP TABLE IF EXISTS ads;
    DROP TABLE IF EXISTS ad_placements;
`;