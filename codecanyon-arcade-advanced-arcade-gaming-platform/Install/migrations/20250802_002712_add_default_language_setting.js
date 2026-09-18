/**
 * Migration: Add default_language setting to settings table
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
        throw new Error('Settings table must exist before adding default language setting');
    }
    
    // Check if default_language setting already exists
    const [existing] = await connection.execute(
        'SELECT COUNT(*) as count FROM settings WHERE name = ?',
        ['default_language']
    );
    
    if (existing[0].count === 0) {
        // Insert default_language setting
        await connection.execute(`
            INSERT INTO settings (name, value, created_at, updated_at) 
            VALUES (?, ?, NOW(), NOW())
        `, ['default_language', 'en']);
        
        console.log('Migration: Added default_language setting with value "en"');
    } else {
        console.log('Migration: default_language setting already exists, skipping insertion');
    }
}

/**
 * Reverse the migration (rollback)
 * @param {object} connection - MySQL connection object  
 */
export async function down(connection) {
    // Remove default_language setting
    const [result] = await connection.execute(
        'DELETE FROM settings WHERE name = ?',
        ['default_language']
    );
    
    if (result.affectedRows > 0) {
        console.log('Migration rollback: Removed default_language setting');
    } else {
        console.log('Migration rollback: default_language setting not found, skipping removal');
    }
}

/**
 * Optional: SQL for emergency rollback (stored in database)
 */
export const rollback = `DELETE FROM settings WHERE name = 'default_language';`;