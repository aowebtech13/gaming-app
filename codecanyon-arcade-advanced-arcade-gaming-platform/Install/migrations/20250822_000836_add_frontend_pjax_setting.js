/**
 * Migration: Add enable_frontend_pjax setting to settings table
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
        throw new Error('Settings table must exist before adding frontend PJAX setting');
    }
    
    // Check if enable_frontend_pjax setting already exists
    const [existing] = await connection.execute(
        'SELECT COUNT(*) as count FROM settings WHERE name = ?',
        ['enable_frontend_pjax']
    );
    
    if (existing[0].count === 0) {
        // Insert enable_frontend_pjax setting (enabled by default)
        await connection.execute(`
            INSERT INTO settings (name, value, created_at, updated_at) 
            VALUES (?, ?, NOW(), NOW())
        `, ['enable_frontend_pjax', '1']);
        
        console.log('Migration: Added enable_frontend_pjax setting with value "1" (enabled by default)');
    } else {
        console.log('Migration: enable_frontend_pjax setting already exists, skipping insertion');
    }
}

/**
 * Reverse the migration (rollback)
 * @param {object} connection - MySQL connection object  
 */
export async function down(connection) {
    // Remove enable_frontend_pjax setting
    const [result] = await connection.execute(
        'DELETE FROM settings WHERE name = ?',
        ['enable_frontend_pjax']
    );
    
    if (result.affectedRows > 0) {
        console.log('Migration rollback: Removed enable_frontend_pjax setting');
    } else {
        console.log('Migration rollback: enable_frontend_pjax setting not found, skipping removal');
    }
}

/**
 * Optional: SQL for emergency rollback (stored in database)
 */
export const rollback = `DELETE FROM settings WHERE name = 'enable_frontend_pjax';`;