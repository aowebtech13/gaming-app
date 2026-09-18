/**
 * Migration: Add language preference column to users table
 * 
 * IMPORTANT: Follow database guidelines:
 * - Use only simple column types: tinyint, int, bigint, float, tinytext, text, longtext, datetime, date, time
 * - NO forbidden types: varchar, char, timestamp, enum, set, json, decimal
 * - TEXT columns cannot have DEFAULT values
 * - Always use utf8mb4_unicode_ci collation
 */

import {
    tableExists,
    columnExists,
    addColumnIfNotExists
} from '../src/utils/migration.js';

/**
 * Run the migration (forward)
 * @param {object} connection - MySQL connection object
 */
export async function up(connection) {
    // Ensure users table exists
    const usersTableExists = await tableExists(connection, 'users');
    if (!usersTableExists) {
        throw new Error('Users table must exist before adding language preference column');
    }
    
    // Add language preference column to users table
    const columnResult = await addColumnIfNotExists(
        connection,
        'users',
        'language_preference',
        'language_preference tinytext COLLATE utf8mb4_unicode_ci'
    );
    
    console.log(`Migration: ${columnResult.message}`);
    
    // Add index for language preference queries (check if exists first)
    const [indexExists] = await connection.execute(`
        SELECT COUNT(*) as count FROM information_schema.statistics 
        WHERE table_schema = DATABASE() 
        AND table_name = 'users' 
        AND index_name = 'idx_users_language_preference'
    `);
    
    if (indexExists[0].count === 0) {
        await connection.execute(`
            CREATE INDEX idx_users_language_preference 
            ON users (language_preference(10))
        `);
        console.log('Migration: Index idx_users_language_preference created');
    } else {
        console.log('Migration: Index idx_users_language_preference already exists');
    }
}

/**
 * Reverse the migration (rollback)
 * @param {object} connection - MySQL connection object  
 */
export async function down(connection) {
    // Check if column exists before dropping
    const columnExists = await columnExists(connection, 'users', 'language_preference');
    if (columnExists) {
        // Drop index first
        await connection.execute('DROP INDEX IF EXISTS idx_users_language_preference ON users');
        console.log('Migration rollback: Index idx_users_language_preference dropped');
        
        // Drop column
        await connection.execute('ALTER TABLE users DROP COLUMN language_preference');
        console.log('Migration rollback: Column language_preference dropped from users table');
    } else {
        console.log('Migration rollback: Column language_preference does not exist, skipping drop');
    }
}

/**
 * Optional: SQL for emergency rollback (stored in database)
 */
export const rollback = `
DROP INDEX IF EXISTS idx_users_language_preference ON users;
ALTER TABLE users DROP COLUMN IF EXISTS language_preference;
`;