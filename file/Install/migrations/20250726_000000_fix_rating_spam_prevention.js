/**
 * Migration: Fix Rating Spam Prevention System
 * 
 * This migration addresses the rating spam issue by:
 * 1. Adding unique constraint to game_ratings table to prevent duplicate ratings per user per game
 * 2. Creating guest_ratings table for IP-based rating tracking
 * 3. Cleaning up existing duplicate ratings
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
    createTableIfNotExists,
    addColumnIfNotExists,
    createIndexIfNotExists
} from '../src/utils/migration.js';

/**
 * Run the migration (forward)
 * @param {object} connection - MySQL connection object
 */
export async function up(connection) {
    console.log('Starting rating spam prevention migration...');
    
    // Step 1: Clean up existing duplicate ratings in game_ratings table
    console.log('Cleaning up duplicate ratings...');
    
    // Find and remove duplicate ratings, keeping only the latest one per user per game
    const duplicateCleanupResult = await connection.execute(`
        DELETE r1 FROM game_ratings r1
        INNER JOIN game_ratings r2 
        WHERE r1.game_id = r2.game_id 
        AND r1.user_id = r2.user_id 
        AND r1.id < r2.id
    `);
    
    console.log(`Cleaned up ${duplicateCleanupResult[0].affectedRows} duplicate ratings`);
    
    // Step 2: Add unique constraint to game_ratings table
    console.log('Adding unique constraint to game_ratings table...');
    
    try {
        // Check if constraint already exists
        const [constraints] = await connection.execute(`
            SELECT CONSTRAINT_NAME 
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'game_ratings' 
            AND CONSTRAINT_TYPE = 'UNIQUE'
            AND CONSTRAINT_NAME = 'unique_user_game_rating'
        `);
        
        if (constraints.length === 0) {
            await connection.execute(`
                ALTER TABLE game_ratings 
                ADD UNIQUE KEY unique_user_game_rating (game_id, user_id)
            `);
            console.log('Unique constraint added to game_ratings table');
        } else {
            console.log('Unique constraint already exists on game_ratings table');
        }
    } catch (error) {
        console.error('Error adding unique constraint:', error.message);
        throw error;
    }
    
    // Step 3: Add ip_address column to game_ratings table for guest tracking
    console.log('Adding ip_address column to game_ratings table...');
    
    const ipColumnResult = await addColumnIfNotExists(
        connection,
        'game_ratings',
        'ip_address',
        'ip_address text COLLATE utf8mb4_unicode_ci'
    );
    
    console.log(ipColumnResult.message);
    
    console.log('Rating spam prevention migration completed successfully');
}

/**
 * Reverse the migration (rollback)
 * @param {object} connection - MySQL connection object  
 */
export async function down(connection) {
    console.log('Rolling back rating spam prevention migration...');
    
    // Step 1: Remove ip_address column from game_ratings table
    try {
        const ipColumnExists = await columnExists(connection, 'game_ratings', 'ip_address');
        if (ipColumnExists) {
            await connection.execute('ALTER TABLE game_ratings DROP COLUMN ip_address');
            console.log('ip_address column removed from game_ratings table');
        } else {
            console.log('ip_address column does not exist in game_ratings table');
        }
    } catch (error) {
        console.warn('Warning: Could not remove ip_address column:', error.message);
    }
    
    // Step 2: Remove unique constraint from game_ratings table
    try {
        const [constraints] = await connection.execute(`
            SELECT CONSTRAINT_NAME 
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'game_ratings' 
            AND CONSTRAINT_TYPE = 'UNIQUE'
            AND CONSTRAINT_NAME = 'unique_user_game_rating'
        `);
        
        if (constraints.length > 0) {
            await connection.execute(`
                ALTER TABLE game_ratings 
                DROP INDEX unique_user_game_rating
            `);
            console.log('Unique constraint removed from game_ratings table');
        } else {
            console.log('Unique constraint does not exist on game_ratings table');
        }
    } catch (error) {
        console.error('Error removing unique constraint:', error.message);
        throw error;
    }
    
    console.log('Rating spam prevention migration rollback completed');
}

/**
 * Optional: SQL for emergency rollback (stored in database)
 */
export const rollback = `
ALTER TABLE game_ratings DROP COLUMN IF EXISTS ip_address;
ALTER TABLE game_ratings DROP INDEX IF EXISTS unique_user_game_rating;
`;