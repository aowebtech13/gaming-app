/**
 * Migration: Fix Unicode Slug Support
 * 
 * Updates slug columns from tinytext to text to properly support Unicode characters.
 * Unicode characters can use multiple bytes each (Japanese: ~3 bytes, Arabic: ~2 bytes),
 * so tinytext (255 byte limit) is insufficient for international slugs.
 * 
 * IMPORTANT: Follow database guidelines:
 * - Use only simple column types: text instead of tinytext
 * - Always use utf8mb4_unicode_ci collation
 */

/**
 * Run the migration (forward)
 * @param {object} connection - MySQL connection object
 */
export async function up(connection) {
    console.log('🔄 Updating slug columns to support Unicode characters...');

    // Update games table slug column from tinytext to text
    await connection.execute(`
        ALTER TABLE \`games\` 
        MODIFY COLUMN \`slug\` text COLLATE utf8mb4_unicode_ci NOT NULL
    `);
    console.log('✅ Updated games.slug to text type');

    // Update pages table slug column from tinytext to text  
    await connection.execute(`
        ALTER TABLE \`pages\`
        MODIFY COLUMN \`slug\` text COLLATE utf8mb4_unicode_ci NOT NULL
    `);
    console.log('✅ Updated pages.slug to text type');

    // Check if ad_placements table exists (from advertisement system migration)
    const [tables] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'ad_placements'
    `);
    
    if (tables.length > 0) {
        // Update ad_placements table slug column from tinytext to text
        await connection.execute(`
            ALTER TABLE \`ad_placements\`
            MODIFY COLUMN \`slug\` text COLLATE utf8mb4_unicode_ci NOT NULL
        `);
        console.log('✅ Updated ad_placements.slug to text type');
    }

    console.log('🌐 Unicode slug support migration completed successfully!');
    console.log('📝 Slug columns now support international characters:');
    console.log('   - Japanese: ファンタジーRPG');
    console.log('   - Arabic: لعبة-المغامرات');  
    console.log('   - Chinese: 冒险游戏');
    console.log('   - Mixed: super-マリオ-bros');
}

/**
 * Rollback the migration (reverse)
 * @param {object} connection - MySQL connection object
 */
export async function down(connection) {
    console.log('⚠️  WARNING: Rolling back Unicode slug support...');
    console.log('⚠️  This will revert slug columns to tinytext (255 byte limit)');
    console.log('⚠️  International slugs may be truncated or cause errors!');

    // Revert games table slug column back to tinytext
    await connection.execute(`
        ALTER TABLE \`games\` 
        MODIFY COLUMN \`slug\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL
    `);
    console.log('⬅️  Reverted games.slug to tinytext');

    // Revert pages table slug column back to tinytext
    await connection.execute(`
        ALTER TABLE \`pages\`
        MODIFY COLUMN \`slug\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL  
    `);
    console.log('⬅️  Reverted pages.slug to tinytext');

    // Check if ad_placements table exists
    const [tables] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'ad_placements'
    `);
    
    if (tables.length > 0) {
        // Revert ad_placements table slug column back to tinytext
        await connection.execute(`
            ALTER TABLE \`ad_placements\`
            MODIFY COLUMN \`slug\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL
        `);
        console.log('⬅️  Reverted ad_placements.slug to tinytext');
    }

    console.log('⬅️  Unicode slug support rollback completed');
}

/**
 * SQL for emergency rollback (stored in database) 
 */
export const rollback = `
-- EMERGENCY ROLLBACK: Revert slug columns to tinytext
-- WARNING: This may truncate international slugs!
ALTER TABLE games MODIFY COLUMN slug tinytext COLLATE utf8mb4_unicode_ci NOT NULL;
ALTER TABLE pages MODIFY COLUMN slug tinytext COLLATE utf8mb4_unicode_ci NOT NULL;
-- Only run if table exists:
-- ALTER TABLE ad_placements MODIFY COLUMN slug tinytext COLLATE utf8mb4_unicode_ci NOT NULL;
`;