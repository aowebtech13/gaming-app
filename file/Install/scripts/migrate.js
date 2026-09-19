#!/usr/bin/env node

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    getMigrationFiles,
    getPendingMigrations,
    executeMigration,
    runPendingMigrations,
    rollbackLastBatch,
    resetAllMigrations,
    freshMigrations,
    getMigrationStatusInfo,
    migrationsDir
} from '../src/utils/migration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for beautiful CLI output (matching deploy.js style)
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m'
};

// Styled console functions (matching deploy.js style)
const log = {
    success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
    step: (msg) => console.log(`${colors.cyan}→${colors.reset} ${msg}`),
    header: (msg) => {
        console.log('');
        console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════════════════════════════${colors.reset}`);
        console.log(`${colors.bright}${colors.bgBlue}  ${msg}  ${colors.reset}`);
        console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════════════════════════════${colors.reset}`);
        console.log('');
    },
    subheader: (msg) => {
        console.log('');
        console.log(`${colors.bright}${colors.yellow}${msg}${colors.reset}`);
        console.log(`${colors.bright}${colors.blue}${'─'.repeat(msg.length)}${colors.reset}`);
        console.log('');
    },
    highlight: (msg) => {
        console.log('');
        console.log(`${colors.bright}${colors.magenta}${'═'.repeat(80)}${colors.reset}`);
        console.log(`${colors.bright}${colors.bgGreen}  ${msg}  ${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}${'═'.repeat(80)}${colors.reset}`);
        console.log('');
    }
};

// Progress indicator (matching deploy.js style)
function showProgress(message, duration = 2000) {
    return new Promise((resolve) => {
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let i = 0;
        const interval = setInterval(() => {
            process.stdout.write(`\r${colors.cyan}${frames[i]}${colors.reset} ${message}...`);
            i = (i + 1) % frames.length;
        }, 100);

        setTimeout(() => {
            clearInterval(interval);
            process.stdout.write(`\r${colors.green}✓${colors.reset} ${message}\n`);
            resolve();
        }, duration);
    });
}

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Promisify readline question
const question = (query) => new Promise(resolve => rl.question(query, resolve));

// Welcome banner
function showWelcomeBanner() {
    console.clear();
    console.log('');
    console.log(`${colors.bright}${colors.cyan}              🗄️  DATABASE MIGRATION MANAGER 🗄️${colors.reset}`);
    console.log(`${colors.bright}${colors.yellow}            ✨ Titan Systems Migration Tool ✨${colors.reset}`);
    console.log('');
    console.log(`${colors.dim}   Manage database schema changes with version control and rollback support${colors.reset}`);
    console.log('');
    console.log(`     ${colors.green}✓${colors.reset} ${colors.bright}Transaction-wrapped execution${colors.reset}`);
    console.log(`     ${colors.green}✓${colors.reset} ${colors.bright}Rollback and reset capabilities${colors.reset}`);
    console.log(`     ${colors.green}✓${colors.reset} ${colors.bright}Migration status tracking${colors.reset}`);
    console.log(`     ${colors.green}✓${colors.reset} ${colors.bright}Database guideline validation${colors.reset}`);
    console.log('');
}

// Generate timestamp for migration filename
function generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// Create migration template
function createMigrationTemplate(migrationName) {
    return `/**
 * Migration: ${migrationName}
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
    // Example:
    // await connection.execute(\`
    //     CREATE TABLE example_table (
    //         id int(11) NOT NULL AUTO_INCREMENT,
    //         name tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
    //         description text COLLATE utf8mb4_unicode_ci,
    //         is_active tinyint(1) DEFAULT '1',
    //         created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    //         PRIMARY KEY (id)
    //     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    // \`);
    
    throw new Error('Migration up() method not implemented');
}

/**
 * Reverse the migration (rollback)
 * @param {object} connection - MySQL connection object  
 */
export async function down(connection) {
    // Example:
    // await connection.execute('DROP TABLE IF EXISTS example_table');
    
    throw new Error('Migration down() method not implemented');
}

/**
 * Optional: SQL for emergency rollback (stored in database)
 * Use this for complex migrations that need custom rollback logic
 */
export const rollback = null;
`;
}

// Create new migration command
async function createMigration() {
    log.header('CREATE NEW MIGRATION');
    
    const description = await question(`${colors.bright}${colors.yellow}📝 Migration description${colors.reset}: `);
    
    if (!description || description.trim().length === 0) {
        log.error('Migration description is required');
        return;
    }
    
    const sanitizedDescription = description.trim().toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_');
    
    const timestamp = generateTimestamp();
    const fileName = `${timestamp}_${sanitizedDescription}.js`;
    const filePath = path.join(migrationsDir, fileName);
    
    // Ensure migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
    }
    
    await showProgress('Creating migration file');
    
    const template = createMigrationTemplate(description);
    fs.writeFileSync(filePath, template);
    
    console.log('');
    console.log(`  ${colors.green}✓${colors.reset} Migration file: ${colors.bright}${fileName}${colors.reset}`);
    console.log(`  ${colors.green}✓${colors.reset} Location: ${colors.bright}${filePath}${colors.reset}`);
    console.log('');
    log.success('Migration template created successfully!');
    console.log('');
    console.log(`${colors.dim}Next steps:${colors.reset}`);
    console.log(`  1. Edit the migration file to implement up() and down() methods`);
    console.log(`  2. Run '${colors.cyan}npm run migrate up${colors.reset}' to apply pending migrations`);
}

// Show migration status
async function showStatus() {
    log.header('MIGRATION STATUS');
    
    await showProgress('Loading migration status');
    
    try {
        const status = await getMigrationStatusInfo();
        
        console.log('');
        log.subheader('Migration Summary');
        console.log(`  ${colors.bright}📁 Total migration files:${colors.reset} ${status.totalMigrationFiles}`);
        console.log(`  ${colors.bright}✅ Applied migrations:${colors.reset} ${status.appliedMigrations}`);
        console.log(`  ${colors.bright}⏳ Pending migrations:${colors.reset} ${status.pendingMigrations}`);
        console.log(`  ${colors.bright}🔢 Latest batch:${colors.reset} ${status.latestBatch}`);
        
        if (status.migrations.applied.length > 0) {
            log.subheader('Applied Migrations');
            status.migrations.applied.forEach((migration, index) => {
                const executionTime = migration.executionTime ? `(${migration.executionTime}ms)` : '';
                console.log(`  ${colors.green}✓${colors.reset} ${colors.bright}Batch ${migration.batch}:${colors.reset} ${migration.name} ${colors.dim}${executionTime}${colors.reset}`);
            });
        }
        
        if (status.migrations.pending.length > 0) {
            log.subheader('Pending Migrations');
            status.migrations.pending.forEach((migration, index) => {
                console.log(`  ${colors.yellow}⏳${colors.reset} ${migration}`);
            });
        } else if (status.totalMigrationFiles > 0) {
            console.log('');
            log.success('All migrations are up to date!');
        }
        
    } catch (error) {
        log.error(`Failed to get migration status: ${error.message}`);
    }
}

// Run pending migrations
async function runMigrations() {
    log.header('RUN PENDING MIGRATIONS');
    
    await showProgress('Checking for pending migrations');
    
    try {
        const result = await runPendingMigrations();
        
        if (result.results.length === 0) {
            console.log('');
            log.success('No pending migrations to run');
            return;
        }
        
        console.log('');
        log.subheader('Migration Results');
        
        result.results.forEach(migration => {
            if (migration.success) {
                console.log(`  ${colors.green}✓${colors.reset} ${migration.migrationName} ${colors.dim}(${migration.executionTime}ms)${colors.reset}`);
            } else {
                console.log(`  ${colors.red}✗${colors.reset} ${migration.migrationName}`);
                console.log(`    ${colors.red}Error:${colors.reset} ${migration.error}`);
            }
        });
        
        console.log('');
        if (result.success) {
            log.highlight(`🚀 SUCCESSFULLY APPLIED ${result.results.length} MIGRATIONS! 🚀`);
        } else {
            log.error('Migration batch failed. Some migrations may have been applied.');
        }
        
    } catch (error) {
        log.error(`Failed to run migrations: ${error.message}`);
    }
}

// Rollback last batch
async function rollbackMigrations() {
    log.header('ROLLBACK LAST BATCH');
    
    log.warning('This will rollback the most recent batch of migrations.');
    const confirm = await question(`${colors.bright}${colors.yellow}Continue? (y/N)${colors.reset}: `);
    
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
        log.info('Rollback cancelled');
        return;
    }
    
    await showProgress('Rolling back migrations');
    
    try {
        const result = await rollbackLastBatch();
        
        if (result.results.length === 0) {
            console.log('');
            log.success('No migrations to rollback');
            return;
        }
        
        console.log('');
        log.subheader('Rollback Results');
        
        result.results.forEach(migration => {
            if (migration.success) {
                console.log(`  ${colors.green}✓${colors.reset} ${migration.migrationName} ${colors.dim}(${migration.executionTime}ms)${colors.reset}`);
            } else {
                console.log(`  ${colors.red}✗${colors.reset} ${migration.migrationName}`);
                console.log(`    ${colors.red}Error:${colors.reset} ${migration.error}`);
            }
        });
        
        console.log('');
        if (result.success) {
            log.highlight(`🔄 SUCCESSFULLY ROLLED BACK ${result.results.length} MIGRATIONS! 🔄`);
        } else {
            log.error('Rollback failed. Database may be in an inconsistent state.');
        }
        
    } catch (error) {
        log.error(`Failed to rollback migrations: ${error.message}`);
    }
}

// Reset all migrations
async function resetMigrations() {
    log.header('RESET ALL MIGRATIONS');
    
    log.warning('This will rollback ALL migrations. Your database will be in its original state.');
    const confirm = await question(`${colors.bright}${colors.yellow}Are you sure? This cannot be undone! (y/N)${colors.reset}: `);
    
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
        log.info('Reset cancelled');
        return;
    }
    
    const doubleConfirm = await question(`${colors.bright}${colors.red}Type 'RESET' to confirm${colors.reset}: `);
    
    if (doubleConfirm !== 'RESET') {
        log.info('Reset cancelled');
        return;
    }
    
    await showProgress('Resetting all migrations');
    
    try {
        const result = await resetAllMigrations();
        
        console.log('');
        if (result.success) {
            log.highlight(`🔄 SUCCESSFULLY RESET ${result.results.length} MIGRATIONS! 🔄`);
        } else {
            log.error('Reset failed. Some migrations may still be applied.');
        }
        
    } catch (error) {
        log.error(`Failed to reset migrations: ${error.message}`);
    }
}

// Fresh migrations (reset + migrate)
async function runFreshMigrations() {
    log.header('FRESH MIGRATIONS');
    
    log.warning('This will reset ALL migrations and re-run them from scratch.');
    log.warning('Your database will be completely recreated with fresh data.');
    const confirm = await question(`${colors.bright}${colors.yellow}Are you sure? This cannot be undone! (y/N)${colors.reset}: `);
    
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
        log.info('Fresh migrations cancelled');
        return;
    }
    
    const doubleConfirm = await question(`${colors.bright}${colors.red}Type 'FRESH' to confirm${colors.reset}: `);
    
    if (doubleConfirm !== 'FRESH') {
        log.info('Fresh migrations cancelled');
        return;
    }
    
    await showProgress('Running fresh migrations');
    
    try {
        const result = await freshMigrations();
        
        console.log('');
        if (result.success) {
            log.highlight(`🆕 SUCCESSFULLY COMPLETED ${result.results.length} FRESH MIGRATIONS! 🆕`);
            
            console.log('');
            log.subheader('Fresh Migration Results');
            result.results.forEach((migration, index) => {
                const executionTime = migration.executionTime ? `(${migration.executionTime}ms)` : '';
                console.log(`  ${colors.green}✓${colors.reset} ${colors.bright}${migration.name}${colors.reset} ${colors.dim}${executionTime}${colors.reset}`);
            });
            
            console.log('');
            log.success('Database has been freshly migrated with clean data!');
        } else {
            log.error('Fresh migrations failed');
            if (result.error) {
                console.log(`  ${colors.red}Error:${colors.reset} ${result.error}`);
            }
        }
        
    } catch (error) {
        log.error(`Failed to run fresh migrations: ${error.message}`);
    }
}

// Show help
function showHelp() {
    log.header('MIGRATION COMMANDS');
    
    console.log(`${colors.bright}Available Commands:${colors.reset}`);
    console.log('');
    console.log(`  ${colors.cyan}create${colors.reset}     Create a new migration file`);
    console.log(`  ${colors.cyan}status${colors.reset}     Show migration status`);
    console.log(`  ${colors.cyan}up${colors.reset}         Run all pending migrations`);
    console.log(`  ${colors.cyan}down${colors.reset}       Rollback the last batch of migrations`);
    console.log(`  ${colors.cyan}reset${colors.reset}      Rollback all migrations`);
    console.log(`  ${colors.cyan}fresh${colors.reset}      Reset and re-run all migrations`);
    console.log(`  ${colors.cyan}help${colors.reset}       Show this help message`);
    console.log('');
    console.log(`${colors.bright}Usage Examples:${colors.reset}`);
    console.log(`  ${colors.dim}node scripts/migrate.js create${colors.reset}`);
    console.log(`  ${colors.dim}node scripts/migrate.js up${colors.reset}`);
    console.log(`  ${colors.dim}npm run migrate status${colors.reset}`);
    console.log('');
}

// Main command handler
async function handleCommand() {
    const command = process.argv[2];
    
    switch (command) {
        case 'create':
            await createMigration();
            break;
        case 'status':
            await showStatus();
            break;
        case 'up':
            await runMigrations();
            break;
        case 'down':
            await rollbackMigrations();
            break;
        case 'reset':
            await resetMigrations();
            break;
        case 'fresh':
            await runFreshMigrations();
            break;
        case 'help':
        case '--help':
        case '-h':
            showHelp();
            break;
        default:
            showWelcomeBanner();
            showHelp();
            break;
    }
    
    // Close readline interface if it exists
    if (typeof rl !== 'undefined' && rl.close) {
        rl.close();
    }
}

// Run the migration manager
handleCommand()
    .catch(console.error)
    .finally(() => {
        // Ensure process exits properly
        process.exit(0);
    });