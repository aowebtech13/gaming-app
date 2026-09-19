/**
 * Migration: Initial Database Schema (EXACT v1.0 MATCH)
 * 
 * Creates the complete initial database schema matching the EXACT v1.0 structure.
 * This migration contains all the core tables with the CORRECT column structure.
 * 
 * SAFETY: This migration detects existing v1.0 installations and will NOT drop existing tables.
 * 
 * IMPORTANT: Follow database guidelines:
 * - Use only simple column types: tinyint, int, bigint, float, tinytext, text, longtext, datetime, date, time
 * - NO forbidden types: varchar, char, timestamp, enum, set, json, decimal
 * - TEXT columns cannot have DEFAULT values
 * - Always use utf8mb4_unicode_ci collation
 */

import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Run the migration (forward)
 * @param {object} connection - MySQL connection object
 */
export async function up(connection) {
    // Database configuration
    await connection.execute(`SET NAMES utf8mb4`);
    await connection.execute(`SET time_zone = '+00:00'`);
    await connection.execute(`SET foreign_key_checks = 0`);
    await connection.execute(`SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO'`);

    // =====================================================
    // SAFETY CHECK: DO NOT DROP TABLES IF THIS IS AN EXISTING V1.0 INSTALLATION
    // =====================================================
    
    // Check if this is an existing installation by looking for existing database tables
    // This is more reliable than .version file since files get replaced during deployment
    const checkTableQuery = 'SHOW TABLES LIKE "users"';
    const [existingTables] = await connection.execute(checkTableQuery);
    const hasExistingTables = existingTables.length > 0;
    
    // If tables exist, this is an existing installation that needs protection
    const isExistingInstallation = hasExistingTables;
    
    if (isExistingInstallation) {
        console.log('🚨 DETECTED EXISTING v1.0 INSTALLATION - Using safe CREATE IF NOT EXISTS mode (NO DROPS)');
        console.log('✅ Your existing data will be preserved!');
    } else {
        console.log('🆕 Fresh installation detected - Using normal creation mode');
    }

    // =====================================================
    // CORE SYSTEM TABLES (EXACT v1.0 STRUCTURE)
    // =====================================================

    // System Settings Table
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`settings\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`settings\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`name\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`value\` text COLLATE utf8mb4_unicode_ci,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Users Table (EXACT v1.0 Structure - Core Authentication and Profile)
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`users\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`users\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`username\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`email\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`password\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`first_name\` tinytext COLLATE utf8mb4_unicode_ci,
          \`last_name\` tinytext COLLATE utf8mb4_unicode_ci,
          \`avatar\` tinytext COLLATE utf8mb4_unicode_ci,
          \`bio\` text COLLATE utf8mb4_unicode_ci,
          \`country\` tinytext COLLATE utf8mb4_unicode_ci,
          \`date_of_birth\` date,
          \`user_type\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`level\` int(11) DEFAULT '1',
          \`exp_points\` int(11) DEFAULT '0',
          \`total_exp_earned\` bigint(20) DEFAULT '0',
          \`is_active\` tinyint(1) DEFAULT '1',
          \`is_verified\` tinyint(1) DEFAULT '0',
          \`last_login\` datetime,
          \`oauth_provider\` tinytext COLLATE utf8mb4_unicode_ci,
          \`oauth_avatar\` tinytext COLLATE utf8mb4_unicode_ci,
          \`chatroom_character\` tinytext COLLATE utf8mb4_unicode_ci,
          \`chatroom_last_x\` tinytext COLLATE utf8mb4_unicode_ci,
          \`chatroom_last_z\` tinytext COLLATE utf8mb4_unicode_ci,
          \`chatroom_last_visit\` datetime,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Password Reset Tokens Table
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`password_reset_tokens\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`password_reset_tokens\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`user_id\` int(11) NOT NULL,
          \`token\` text COLLATE utf8mb4_unicode_ci,
          \`expires_at\` datetime,
          \`used_at\` datetime,
          \`ip_address\` tinytext COLLATE utf8mb4_unicode_ci,
          \`user_agent\` text COLLATE utf8mb4_unicode_ci,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // OAuth Accounts Table (EXACT v1.0 Structure)
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`oauth_accounts\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`oauth_accounts\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`user_id\` int(11) NOT NULL,
          \`provider\` tinytext COLLATE utf8mb4_unicode_ci,
          \`provider_id\` tinytext COLLATE utf8mb4_unicode_ci,
          \`provider_email\` tinytext COLLATE utf8mb4_unicode_ci,
          \`provider_name\` tinytext COLLATE utf8mb4_unicode_ci,
          \`provider_avatar\` tinytext COLLATE utf8mb4_unicode_ci,
          \`access_token\` text COLLATE utf8mb4_unicode_ci,
          \`refresh_token\` text COLLATE utf8mb4_unicode_ci,
          \`expires_at\` datetime,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Email Verification Tokens Table
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`email_verification_tokens\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`email_verification_tokens\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`user_id\` int(11) NOT NULL,
          \`token\` text COLLATE utf8mb4_unicode_ci,
          \`expires_at\` datetime,
          \`used_at\` datetime,
          \`ip_address\` tinytext COLLATE utf8mb4_unicode_ci,
          \`user_agent\` text COLLATE utf8mb4_unicode_ci,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // =====================================================
    // CONTENT MANAGEMENT TABLES (EXACT v1.0 STRUCTURE)
    // =====================================================

    // Game Categories Table (EXACT v1.0 Structure)
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`categories\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`categories\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`name\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`slug\` text COLLATE utf8mb4_unicode_ci NOT NULL,
          \`description\` text COLLATE utf8mb4_unicode_ci,
          \`icon\` tinytext COLLATE utf8mb4_unicode_ci,
          \`image\` text COLLATE utf8mb4_unicode_ci,
          \`color\` tinytext COLLATE utf8mb4_unicode_ci,
          \`sort_order\` int(11) DEFAULT '0',
          \`is_active\` tinyint(1) DEFAULT '1',
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Games Table (EXACT v1.0 Structure)
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`games\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`games\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`title\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`slug\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`description\` text COLLATE utf8mb4_unicode_ci,
          \`short_description\` text COLLATE utf8mb4_unicode_ci,
          \`category_id\` int(11) NOT NULL,
          \`thumbnail\` text COLLATE utf8mb4_unicode_ci,
          \`game_type\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`game_file\` tinytext COLLATE utf8mb4_unicode_ci,
          \`embed_url\` text COLLATE utf8mb4_unicode_ci,
          \`rom_system\` tinytext COLLATE utf8mb4_unicode_ci,
          \`width\` int(11) DEFAULT '800',
          \`height\` int(11) DEFAULT '600',
          \`controls\` text COLLATE utf8mb4_unicode_ci,
          \`play_count\` int(11) DEFAULT '0',
          \`tags\` text COLLATE utf8mb4_unicode_ci,
          \`sort_order\` int(11) DEFAULT '0',
          \`is_featured\` tinyint(1) DEFAULT '0',
          \`is_active\` tinyint(1) DEFAULT '1',
          \`api_enabled\` tinyint(1) DEFAULT '0',
          \`import_id\` int(11) DEFAULT NULL,
          \`created_by\` int(11),
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Custom Pages Table
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`pages\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`pages\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`title\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`slug\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`content\` longtext COLLATE utf8mb4_unicode_ci,
          \`is_published\` tinyint(1) DEFAULT '0',
          \`created_by\` int(11),
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // =====================================================
    // USER INTERACTION TABLES
    // =====================================================

    // User Favorites Table
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`favorites\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`favorites\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`user_id\` int(11) NOT NULL,
          \`game_id\` int(11) NOT NULL,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // User Follows Table
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`follows\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`follows\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`follower_id\` int(11) NOT NULL,
          \`following_id\` int(11) NOT NULL,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Last Played Games Table
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`last_played\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`last_played\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`user_id\` int(11) NOT NULL,
          \`game_id\` int(11) NOT NULL,
          \`played_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Game Comments Table
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`game_comments\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`game_comments\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`game_id\` int(11) NOT NULL,
          \`user_id\` int(11) NOT NULL,
          \`comment\` text COLLATE utf8mb4_unicode_ci NOT NULL,
          \`is_active\` tinyint(1) DEFAULT '1',
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Game Ratings Table
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`game_ratings\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`game_ratings\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`game_id\` int(11) NOT NULL,
          \`user_id\` int(11) NOT NULL,
          \`rating\` tinyint(1) NOT NULL,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // =====================================================
    // GAMIFICATION SYSTEM TABLES
    // =====================================================

    // EXP Ranks Table
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`exp_ranks\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`exp_ranks\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`level\` int(11) NOT NULL,
          \`exp_required\` int(11) NOT NULL,
          \`reward_title\` tinytext COLLATE utf8mb4_unicode_ci,
          \`reward_description\` text COLLATE utf8mb4_unicode_ci,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // EXP Events Table
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`exp_events\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`exp_events\` (
          \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
          \`user_id\` int(11) NOT NULL,
          \`event_type\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`event_source_id\` int(11),
          \`exp_amount\` int(11) NOT NULL,
          \`description\` text COLLATE utf8mb4_unicode_ci,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // =====================================================
    // GAME SCORING SYSTEM TABLES
    // =====================================================

    // Game Scores Table
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`game_scores\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`game_scores\` (
          \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
          \`user_id\` int(11) NOT NULL,
          \`game_id\` int(11) NOT NULL,
          \`score\` bigint(20) NOT NULL,
          \`score_type\` tinytext COLLATE utf8mb4_unicode_ci,
          \`score_data\` longtext COLLATE utf8mb4_unicode_ci,
          \`is_personal_best\` tinyint(1) DEFAULT '0',
          \`is_verified\` tinyint(1) DEFAULT '1',
          \`achieved_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`exp_awarded\` int(11) DEFAULT '0',
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Game Leaderboards Table (Materialized View for Performance)
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`game_leaderboards\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`game_leaderboards\` (
          \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
          \`game_id\` int(11) NOT NULL,
          \`user_id\` int(11) NOT NULL,
          \`username\` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
          \`high_score\` bigint(20) NOT NULL,
          \`score_count\` int(11) DEFAULT '1',
          \`first_score_date\` datetime NOT NULL,
          \`last_score_date\` datetime NOT NULL,
          \`rank_position\` int(11),
          \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // =====================================================
    // SEARCH AND ANALYTICS TABLES
    // =====================================================

    // Search Queries Table
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`search_queries\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`search_queries\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`query\` text COLLATE utf8mb4_unicode_ci NOT NULL,
          \`query_hash\` text COLLATE utf8mb4_unicode_ci NOT NULL,
          \`search_count\` int(11) DEFAULT '1',
          \`last_searched\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // =====================================================
    // SYSTEM LOGGING TABLES
    // =====================================================

    // Email Logs Table
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`email_logs\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`email_logs\` (
          \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
          \`recipient_email\` tinytext COLLATE utf8mb4_unicode_ci,
          \`recipient_name\` tinytext COLLATE utf8mb4_unicode_ci,
          \`subject\` tinytext COLLATE utf8mb4_unicode_ci,
          \`template\` tinytext COLLATE utf8mb4_unicode_ci,
          \`status\` tinytext COLLATE utf8mb4_unicode_ci,
          \`error_message\` text COLLATE utf8mb4_unicode_ci,
          \`sent_at\` datetime,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Cron Job Logs Table
    if (!isExistingInstallation) {
        await connection.execute(`DROP TABLE IF EXISTS \`cron_logs\``);
    }
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`cron_logs\` (
          \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
          \`job_name\` tinytext COLLATE utf8mb4_unicode_ci,
          \`status\` tinytext COLLATE utf8mb4_unicode_ci,
          \`message\` text COLLATE utf8mb4_unicode_ci,
          \`execution_time_ms\` int(11),
          \`memory_usage_mb\` int(11),
          \`records_processed\` int(11),
          \`started_at\` datetime,
          \`completed_at\` datetime,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // =====================================================
    // DEFAULT DATA INSERTS (ONLY FOR FRESH INSTALLATIONS)
    // =====================================================
    
    if (!isExistingInstallation) {
        console.log('🗃️ Inserting default data for fresh installation...');
        
        // Core System Settings
        await connection.execute(`
            INSERT IGNORE INTO \`settings\` (\`name\`, \`value\`) VALUES
            ('site_name', 'Arcade'),
            ('site_description', 'The ultimate online gaming destination'),
            ('site_logo', '/assets/images/logo.png'),
            ('site_favicon', ''),
            ('maintenance_mode', '0'),
            ('user_registration_enabled', '1'),
            ('recaptcha_site_key', ''),
            ('recaptcha_secret_key', ''),
            ('games_per_page', '12'),
            ('enable_ratings', '1'),
            ('allow_guest_rating', '0'),
            ('enable_comments', '1'),
            ('timezone', 'UTC'),
            ('date_format', 'Y-m-d'),
            ('time_format', 'H:i:s'),
            ('purchase_code', '')
        `);

        // OAuth Settings
        await connection.execute(`
            INSERT IGNORE INTO \`settings\` (\`name\`, \`value\`) VALUES
            ('facebook_app_id', ''),
            ('facebook_app_secret', ''),
            ('google_client_id', ''),
            ('google_client_secret', ''),
            ('enable_facebook_login', '0'),
            ('enable_google_login', '0')
        `);

        // SMTP Email Settings
        await connection.execute(`
            INSERT IGNORE INTO \`settings\` (\`name\`, \`value\`) VALUES
            ('smtp_host', ''),
            ('smtp_port', '587'),
            ('smtp_secure', '0'),
            ('smtp_username', ''),
            ('smtp_password', ''),
            ('smtp_from_email', ''),
            ('smtp_from_name', ''),
            ('enable_smtp', '0')
        `);

        // Email Verification Settings
        await connection.execute(`
            INSERT IGNORE INTO \`settings\` (\`name\`, \`value\`) VALUES
            ('email_verification_enabled', '1'),
            ('email_verification_token_expiry_hours', '24'),
            ('email_verification_resend_limit_per_day', '5')
        `);

        // Cron Job Settings
        await connection.execute(`
            INSERT IGNORE INTO \`settings\` (\`name\`, \`value\`) VALUES
            ('cron_password', ''),
            ('enable_cron_jobs', '0'),
            ('cron_last_run_cleanup', ''),
            ('cron_last_run_maintenance', ''),
            ('cron_last_run_reports', ''),
            ('cron_cleanup_frequency', '24'),
            ('cron_maintenance_frequency', '168'),
            ('cron_reports_frequency', '720')
        `);

        // EXP System Settings
        await connection.execute(`
            INSERT IGNORE INTO \`settings\` (\`name\`, \`value\`) VALUES
            ('exp_game_completion', '50'),
            ('exp_daily_login', '10'),
            ('exp_first_play', '25'),
            ('exp_game_rating', '5'),
            ('exp_game_comment', '3'),
            ('exp_follow_user', '2'),
            ('exp_profile_complete', '20'),
            ('exp_multiplier_weekends', '1.5'),
            ('exp_bonus_streak_days', '7'),
            ('exp_bonus_streak_multiplier', '2.0')
        `);

        // Score System Settings
        await connection.execute(`
            INSERT IGNORE INTO \`settings\` (\`name\`, \`value\`) VALUES
            ('score_exp_multiplier', '0.1'),
            ('score_personal_best_bonus', '100'),
            ('score_leaderboard_positions', '10'),
            ('score_verification_enabled', '1'),
            ('score_rate_limit_per_minute', '5')
        `);

        // Default Admin User
        await connection.execute(`
            INSERT INTO \`users\` (\`id\`, \`username\`, \`email\`, \`password\`, \`first_name\`, \`last_name\`, \`user_type\`, \`level\`, \`exp_points\`, \`total_exp_earned\`, \`is_active\`, \`is_verified\`, \`created_at\`, \`updated_at\`) VALUES
            (1, 'admin', 'admin@localhost', '$2b$12$Cqcjs.SQ77Y0cy5JgcqULOVYc/NaM88MOteWc9KebH5bz6Rd/sFJq', 'System', 'Administrator', 'admin', 1, 0, 0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);

        // Game Categories (using Heroicons for icons)
        await connection.execute(`
            INSERT INTO \`categories\` (\`id\`, \`name\`, \`slug\`, \`description\`, \`icon\`, \`color\`, \`sort_order\`, \`is_active\`) VALUES
            (1, 'Action', 'action', 'Fast-paced games with intense gameplay', 'bolt', '#3B82F6', 1, 1),
            (2, 'Adventure', 'adventure', 'Exploration and story-driven games', 'map', '#10B981', 2, 1),
            (3, 'Driving', 'driving', 'Racing and vehicle simulation games', 'truck', '#F59E0B', 3, 1),
            (4, 'Fighting', 'fighting', 'Combat and martial arts games', 'hand-raised', '#8B5CF6', 4, 1),
            (5, 'Shooting', 'shooting', 'First-person and third-person shooters', 'viewfinder-circle', '#EF4444', 5, 1),
            (6, 'Puzzle', 'puzzle', 'Brain teasers and strategy games', 'puzzle-piece', '#6366F1', 6, 1)
        `);

        // EXP Ranks
        await connection.execute(`
            INSERT INTO \`exp_ranks\` (\`level\`, \`exp_required\`, \`reward_title\`, \`reward_description\`) VALUES
            (1, 0, 'Welcome!', 'Starting your gaming journey'),
            (2, 100, 'Gamer', 'You are getting the hang of it'),
            (3, 250, 'Skilled Player', 'Your skills are improving'),
            (4, 500, 'Experienced Gamer', 'You have some serious gaming experience'),
            (5, 1000, 'Pro Player', 'You are becoming a pro'),
            (6, 1750, 'Expert', 'Your expertise shows'),
            (7, 2750, 'Master Gamer', 'You have mastered the basics'),
            (8, 4250, 'Gaming Veteran', 'A veteran in the gaming world'),
            (9, 6500, 'Elite Player', 'You are among the elite'),
            (10, 10000, 'Legend', 'A true gaming legend'),
            (11, 15000, 'Champion', 'Champion of the arcade'),
            (12, 22500, 'Gaming Master', 'Master of all games'),
            (13, 32500, 'Supreme Player', 'Supreme gaming skills'),
            (14, 46000, 'Ultimate Gamer', 'Ultimate gaming prowess'),
            (15, 64000, 'Gaming God', 'Godlike gaming abilities'),
            (16, 87500, 'Arcade King', 'King of the arcade'),
            (17, 118000, 'Gaming Emperor', 'Emperor of gaming'),
            (18, 156000, 'Legendary Master', 'Legendary status achieved'),
            (19, 203000, 'Gaming Deity', 'Deity-level gaming'),
            (20, 260000, 'Immortal Player', 'Immortal gaming legend')
        `);

        // Default Custom Pages
        await connection.execute(`
            INSERT INTO \`pages\` (\`id\`, \`title\`, \`slug\`, \`content\`, \`is_published\`, \`created_by\`) VALUES
            (1, 'Privacy Policy', 'privacy-policy', '<h1>Privacy Policy</h1><p>This Privacy Policy describes how ARCADE Games collects, uses, and protects your information when you use our gaming platform.</p><h2>Information We Collect</h2><p>We collect information you provide directly to us, such as when you create an account, play games, or contact us for support.</p><h2>How We Use Your Information</h2><p>We use the information we collect to provide, maintain, and improve our services, including personalizing your gaming experience.</p><h2>Information Sharing</h2><p>We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy.</p><h2>Data Security</h2><p>We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p><h2>Contact Us</h2><p>If you have any questions about this Privacy Policy, please contact us through our platform.</p>', 1, 1),
            (2, 'Terms of Service', 'terms-of-service', '<h1>Terms of Service</h1><p>Welcome to ARCADE Games. These Terms of Service govern your use of our gaming platform.</p><h2>Acceptance of Terms</h2><p>By accessing and using our platform, you accept and agree to be bound by the terms and provision of this agreement.</p><h2>User Accounts</h2><p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p><h2>Game Content</h2><p>Our platform provides access to various games for entertainment purposes. You agree to use the games in accordance with their intended purpose.</p><h2>Prohibited Activities</h2><p>You agree not to engage in any activities that could harm the platform, other users, or violate applicable laws.</p><h2>Limitation of Liability</h2><p>ARCADE Games shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the platform.</p><h2>Changes to Terms</h2><p>We reserve the right to modify these terms at any time. Continued use of the platform constitutes acceptance of modified terms.</p>', 1, 1)
        `);

        console.log('✅ Default data inserted successfully');
    }

    await connection.execute(`SET foreign_key_checks = 1`);

    console.log('✅ Initial schema migration completed safely!');
    
    if (isExistingInstallation) {
        console.log('🔒 Existing v1.0 data preserved - no tables were dropped');
        console.log('📊 Tables matched to EXACT v1.0 structure');
    } else {
        console.log('🆕 Fresh installation schema created with default data');
    }
}

/**
 * Rollback the migration (reverse)
 * @param {object} connection - MySQL connection object
 */
export async function down(connection) {
    console.log('⚠️  WARNING: Rolling back initial schema will DELETE ALL DATA!');
    
    // Check if this looks like it has real data
    try {
        const [userCount] = await connection.execute(`SELECT COUNT(*) as count FROM users`);
        if (userCount[0].count > 1) {
            throw new Error('SAFETY: Cannot rollback - database contains user data. Manual intervention required.');
        }
    } catch (error) {
        console.log('Cannot check user count - proceeding with caution');
    }
    
    // Only proceed if database appears empty
    const tables = [
        'cron_logs', 'email_logs', 'search_queries', 'game_leaderboards', 'game_scores', 
        'exp_events', 'exp_ranks', 'game_ratings', 'game_comments', 'last_played', 
        'follows', 'favorites', 'pages', 'games', 'categories', 'email_verification_tokens', 
        'oauth_accounts', 'password_reset_tokens', 'users', 'settings'
    ];
    
    for (const table of tables) {
        await connection.execute(`DROP TABLE IF EXISTS \`${table}\``);
    }
}

/**
 * SQL for emergency rollback (stored in database) 
 */
export const rollback = `
-- EMERGENCY ROLLBACK SQL (USE WITH EXTREME CAUTION)
-- This will delete all data!
DROP TABLE IF EXISTS cron_logs;
DROP TABLE IF EXISTS email_logs;
DROP TABLE IF EXISTS search_queries;
DROP TABLE IF EXISTS game_leaderboards;
DROP TABLE IF EXISTS game_scores;
DROP TABLE IF EXISTS exp_events;
DROP TABLE IF EXISTS exp_ranks;
DROP TABLE IF EXISTS game_ratings;
DROP TABLE IF EXISTS game_comments;
DROP TABLE IF EXISTS last_played;
DROP TABLE IF EXISTS follows;
DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS pages;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS email_verification_tokens;
DROP TABLE IF EXISTS oauth_accounts;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS settings;
`;