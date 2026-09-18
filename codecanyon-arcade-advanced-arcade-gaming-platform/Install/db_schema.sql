-- =====================================================
-- ARCADE - MIGRATION-BASED DEPLOYMENT
-- =====================================================
-- 
-- This schema file is minimal and migration-based.
-- All database tables and data are created through migrations for consistency.
-- 
-- Database Engine: MySQL/MariaDB
-- Character Set: utf8mb4_unicode_ci
-- Version: 2025-08-02 (Migration-Based)
-- =====================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

-- =====================================================
-- MIGRATION SYSTEM INITIALIZATION
-- =====================================================

-- Create migrations table for tracking
CREATE TABLE IF NOT EXISTS `migrations` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `migration_name` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
    `batch` int(11) NOT NULL,
    `executed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `execution_time_ms` int(11),
    `rollback_sql` longtext COLLATE utf8mb4_unicode_ci,
    `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- RECENT SCHEMA UPDATES (v1.3)
-- =====================================================
-- The following shows the structure added by recent migrations:
-- 
-- 1. User Language Preferences (20250802_002652):
--    ALTER TABLE users ADD COLUMN language_preference tinytext COLLATE utf8mb4_unicode_ci;
--    CREATE INDEX idx_users_language_preference ON users (language_preference(10));
--
-- 2. Default Language Setting (20250802_002712):
--    INSERT INTO settings (name, value) VALUES ('default_language', 'en');
--
-- 3. Settings Table Cleanup (20250802_003000):
--    - Removed duplicate settings rows
--    - Added unique index: CREATE UNIQUE INDEX idx_settings_name_unique ON settings (name(50));
--
-- These changes are applied automatically during deployment via migrations.

-- Reset foreign key checks
SET foreign_key_checks = 1;

-- =====================================================
-- DEPLOYMENT COMPLETE
-- =====================================================
-- 
-- 🚀 MIGRATION-BASED SCHEMA READY!
-- 
-- Next steps:
-- 1. Run: npm run migrate:up
-- 2. This will create all database tables via migrations
-- 3. Fresh deployments and updates will be consistent
-- 
-- Migration Files:
-- ✓ 20250715_000000_initial_schema.js - Complete database schema
-- ✓ 20250725_000000_add_advertisement_system.js - Advertisement system
-- ✓ 20250726_000000_fix_rating_spam_prevention.js - Rating system fixes
-- ✓ 20250802_002652_add_user_language_preference.js - User language preferences
-- ✓ 20250802_002712_add_default_language_setting.js - Default language setting
-- ✓ 20250802_003000_fix_duplicate_settings.js - Settings table cleanup
-- 
-- Benefits:
-- ✓ Version control for database changes
-- ✓ Rollback capabilities
-- ✓ Consistent deployments (fresh vs update)
-- ✓ Automatic updates for existing installations
-- =====================================================