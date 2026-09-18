/**
 * Migration: Add selected_template setting to settings table
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
        throw new Error('Settings table must exist before adding selected template setting');
    }
    
    // Check if selected_template setting already exists
    const [existing] = await connection.execute(
        'SELECT COUNT(*) as count FROM settings WHERE name = ?',
        ['selected_template']
    );
    
    if (existing[0].count === 0) {
        // Insert selected_template setting
        await connection.execute(`
            INSERT INTO settings (name, value, created_at, updated_at) 
            VALUES (?, ?, NOW(), NOW())
        `, ['selected_template', 'default']);
        
        console.log('Migration: Added selected_template setting with value "default"');
    } else {
        console.log('Migration: selected_template setting already exists, skipping insertion');
    }
}

/**
 * Reverse the migration (rollback)
 * @param {object} connection - MySQL connection object  
 */
export async function down(connection) {
    // Remove selected_template setting
    const [result] = await connection.execute(
        'DELETE FROM settings WHERE name = ?',
        ['selected_template']
    );
    
    if (result.affectedRows > 0) {
        console.log('Migration rollback: Removed selected_template setting');
    } else {
        console.log('Migration rollback: selected_template setting not found, skipping removal');
    }
}

/**
 * Optional: SQL for emergency rollback (stored in database)
 */
export const rollback = `DELETE FROM settings WHERE name = 'selected_template';`;