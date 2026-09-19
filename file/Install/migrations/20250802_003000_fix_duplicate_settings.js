/**
 * Migration: Fix duplicate settings rows in settings table
 * 
 * IMPORTANT: Follow database guidelines:
 * - Use only simple column types: tinyint, int, bigint, float, tinytext, text, longtext, datetime, date, time
 * - NO forbidden types: varchar, char, timestamp, enum, set, json, decimal
 * - TEXT columns cannot have DEFAULT values
 * - Always use utf8mb4_unicode_ci collation
 */

import {
    tableExists
} from '../src/utils/migration.js';

/**
 * Run the migration (forward)
 * @param {object} connection - MySQL connection object
 */
export async function up(connection) {
    // Ensure settings table exists
    const settingsTableExists = await tableExists(connection, 'settings');
    if (!settingsTableExists) {
        throw new Error('Settings table must exist before fixing duplicate settings');
    }
    
    console.log('Migration: Starting duplicate settings cleanup...');
    
    // Check for existing duplicates
    const [duplicates] = await connection.execute(`
        SELECT name, COUNT(*) as count 
        FROM settings 
        GROUP BY name 
        HAVING count > 1
    `);
    
    if (duplicates.length > 0) {
        console.log(`Migration: Found ${duplicates.length} duplicate setting names`);
        
        // Remove duplicates keeping only the first occurrence (lowest ID)
        const [result] = await connection.execute(`
            DELETE t1 FROM settings t1
            INNER JOIN settings t2 
            WHERE t1.id > t2.id AND t1.name = t2.name
        `);
        
        console.log(`Migration: Removed ${result.affectedRows} duplicate settings rows`);
        
        // Verify cleanup
        const [remainingDuplicates] = await connection.execute(`
            SELECT name, COUNT(*) as count 
            FROM settings 
            GROUP BY name 
            HAVING count > 1
        `);
        
        if (remainingDuplicates.length === 0) {
            console.log('Migration: Successfully cleaned up all duplicate settings');
        } else {
            console.log(`Migration: Warning - ${remainingDuplicates.length} duplicate settings remain`);
        }
    } else {
        console.log('Migration: No duplicate settings found, cleanup not needed');
    }
    
    // Add unique index to prevent future duplicates
    const [indexExists] = await connection.execute(`
        SELECT COUNT(*) as count FROM information_schema.statistics 
        WHERE table_schema = DATABASE() 
        AND table_name = 'settings' 
        AND index_name = 'idx_settings_name_unique'
    `);
    
    if (indexExists[0].count === 0) {
        await connection.execute(`
            CREATE UNIQUE INDEX idx_settings_name_unique 
            ON settings (name(50))
        `);
        console.log('Migration: Added unique index on settings.name to prevent future duplicates');
    } else {
        console.log('Migration: Unique index on settings.name already exists');
    }
}

/**
 * Reverse the migration (rollback)
 * @param {object} connection - MySQL connection object  
 */
export async function down(connection) {
    // Drop the unique index
    const [indexExists] = await connection.execute(`
        SELECT COUNT(*) as count FROM information_schema.statistics 
        WHERE table_schema = DATABASE() 
        AND table_name = 'settings' 
        AND index_name = 'idx_settings_name_unique'
    `);
    
    if (indexExists[0].count > 0) {
        await connection.execute('DROP INDEX idx_settings_name_unique ON settings');
        console.log('Migration rollback: Removed unique index from settings.name');
    } else {
        console.log('Migration rollback: Unique index on settings.name does not exist, skipping removal');
    }
    
    console.log('Migration rollback: Note - Duplicate settings were not restored as this would violate data integrity');
}

/**
 * Optional: SQL for emergency rollback (stored in database)
 */
export const rollback = `DROP INDEX IF EXISTS idx_settings_name_unique ON settings;`;