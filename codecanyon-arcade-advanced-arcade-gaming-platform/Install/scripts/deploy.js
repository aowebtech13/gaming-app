#!/usr/bin/env node

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
// Dynamic import for migration utilities after environment is loaded

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Colors for beautiful CLI output
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

// Styled console functions
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

// Progress indicator
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

// Hidden password input
const hiddenQuestion = (query) => {
    return new Promise((resolve) => {
        process.stdout.write(query);
        process.stdin.setRawMode(true);
        let password = '';
        
        const onData = (char) => {
            char = char.toString();
            if (char === '\r' || char === '\n') {
                process.stdin.setRawMode(false);
                process.stdin.removeListener('data', onData);
                process.stdout.write('\n');
                resolve(password);
            } else if (char === '\u0003') {
                process.exit();
            } else if (char === '\u007f') {
                if (password.length > 0) {
                    password = password.slice(0, -1);
                    process.stdout.write('\b \b');
                }
            } else {
                password += char;
                process.stdout.write('*');
            }
        };
        
        process.stdin.on('data', onData);
    });
};

// Configuration storage
let config = {};

// Validation functions
const validators = {
    email: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },
    
    siteName: (name) => {
        return name && name.trim().length >= 3 && name.trim().length <= 100;
    },
    
    username: (username) => {
        const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
        return usernameRegex.test(username);
    },
    
    databaseName: (dbName) => {
        const dbNameRegex = /^[a-zA-Z0-9_-]{1,64}$/;
        return dbNameRegex.test(dbName);
    },
    
    port: (port) => {
        const portNum = parseInt(port);
        return !isNaN(portNum) && portNum >= 1 && portNum <= 65535;
    },
    
    password: (password) => {
        return password && password.length >= 6;
    },
    
    name: (name) => {
        return name && name.trim().length >= 1 && name.trim().length <= 50;
    }
};

// Validation helper function
async function validateInput(prompt, validator, errorMessage) {
    let value;
    while (true) {
        value = await question(prompt);
        if (validator(value)) {
            return value;
        }
        console.log(`  ${colors.red}✗${colors.reset} ${errorMessage}`);
        console.log('');
    }
}

// Hidden input validation helper
async function validateHiddenInput(prompt, validator, errorMessage) {
    let value;
    while (true) {
        value = await hiddenQuestion(prompt);
        if (validator(value)) {
            return value;
        }
        console.log(`  ${colors.red}✗${colors.reset} ${errorMessage}`);
        console.log('');
    }
}

// Welcome banner
function showWelcomeBanner() {
    console.clear();
    console.log('');
    console.log(`${colors.bright}${colors.cyan}                  🚀 TITAN SYSTEMS DEPLOYMENT 🚀${colors.reset}`);
    console.log(`${colors.bright}${colors.yellow}              ✨ Arcade Platform Deployment Wizard ✨${colors.reset}`);
    console.log('');
    console.log(`${colors.dim}   Welcome to the Titan Systems Arcade Platform deployment wizard!${colors.reset}`);
    console.log(`${colors.dim}   This wizard will configure your platform and create the .env file.${colors.reset}`);
    console.log('');
    console.log(`     ${colors.green}✓${colors.reset} ${colors.bright}Secure environment configuration${colors.reset}`);
    console.log(`     ${colors.green}✓${colors.reset} ${colors.bright}Database schema installation${colors.reset}`);
    console.log(`     ${colors.green}✓${colors.reset} ${colors.bright}Admin account creation${colors.reset}`);
    console.log(`     ${colors.green}✓${colors.reset} ${colors.bright}Production-ready setup${colors.reset}`);
    console.log('');
}

// Site configuration
async function configureSite() {
    log.header('SITE CONFIGURATION');
    
    config.site = {};
    
    config.site.name = await validateInput(
        `${colors.bright}${colors.yellow}🏷️  Site Name${colors.reset}: `,
        validators.siteName,
        'Site name must be between 3 and 100 characters'
    );
    
    config.site.description = await validateInput(
        `${colors.bright}${colors.yellow}📝 Site Description${colors.reset}: `,
        validators.siteName,
        'Site description must be between 3 and 100 characters'
    );
    
    let portInput = await question(`${colors.bright}${colors.yellow}🌐 Server Port${colors.reset} [3000]: `) || '3000';
    while (!validators.port(portInput)) {
        console.log(`  ${colors.red}✗${colors.reset} Port must be a number between 1 and 65535`);
        console.log('');
        portInput = await question(`${colors.bright}${colors.yellow}🌐 Server Port${colors.reset} [3000]: `) || '3000';
    }
    config.site.port = portInput;
    
    console.log(`${colors.dim}   Enter your site URL(s). You can specify multiple URLs separated by commas.${colors.reset}`);
    console.log(`${colors.dim}   Examples:${colors.reset}`);
    console.log(`${colors.dim}     • Single URL: https://yourdomain.com${colors.reset}`);
    console.log(`${colors.dim}     • Multiple URLs: https://yourdomain.com,http://192.168.1.100:${portInput}${colors.reset}`);
    console.log(`${colors.dim}     • Development: http://localhost:${portInput},http://192.168.1.100:${portInput}${colors.reset}`);
    console.log('');
    
    config.site.url = await question(`${colors.bright}${colors.yellow}🌍 Site URL(s)${colors.reset} [http://localhost:${portInput}]: `) || `http://localhost:${portInput}`;
    
    console.log('');
    console.log(`  ${colors.green}✓${colors.reset} Site Name: ${colors.bright}${config.site.name}${colors.reset}`);
    console.log(`  ${colors.green}✓${colors.reset} Description: ${colors.bright}${config.site.description}${colors.reset}`);
    console.log(`  ${colors.green}✓${colors.reset} Port: ${colors.bright}${config.site.port}${colors.reset}`);
    console.log(`  ${colors.green}✓${colors.reset} Site URL(s): ${colors.bright}${config.site.url}${colors.reset}`);
    console.log('');
    log.success('Site configuration completed!');
}

// Admin account configuration
async function configureAdmin() {
    log.header('ADMIN ACCOUNT CONFIGURATION');
    console.log(`${colors.dim}   Creating the main administrator account for your platform${colors.reset}`);
    console.log('');
    
    config.admin = {};
    
    config.admin.username = await validateInput(
        `${colors.bright}${colors.yellow}👤 Admin Username${colors.reset}: `,
        validators.username,
        'Username must be 3-20 characters long and contain only letters, numbers, hyphens, and underscores'
    );
    
    config.admin.firstName = await validateInput(
        `${colors.bright}${colors.yellow}📛 First Name${colors.reset}: `,
        validators.name,
        'First name must be 1-50 characters long'
    );
    
    config.admin.lastName = await validateInput(
        `${colors.bright}${colors.yellow}📛 Last Name${colors.reset}: `,
        validators.name,
        'Last name must be 1-50 characters long'
    );
    
    config.admin.email = await validateInput(
        `${colors.bright}${colors.yellow}📧 Admin Email${colors.reset}: `,
        validators.email,
        'Please enter a valid email address (e.g., admin@example.com)'
    );
    
    config.admin.password = await validateHiddenInput(
        `${colors.bright}${colors.yellow}🔐 Admin Password${colors.reset}: `,
        validators.password,
        'Password must be at least 6 characters long'
    );
    
    console.log('');
    console.log(`  ${colors.green}✓${colors.reset} Username: ${colors.bright}${config.admin.username}${colors.reset}`);
    console.log(`  ${colors.green}✓${colors.reset} Name: ${colors.bright}${config.admin.firstName} ${config.admin.lastName}${colors.reset}`);
    console.log(`  ${colors.green}✓${colors.reset} Email: ${colors.bright}${config.admin.email}${colors.reset}`);
    console.log(`  ${colors.green}✓${colors.reset} Password: ${colors.bright}${'*'.repeat(config.admin.password.length)}${colors.reset}`);
    console.log('');
    log.success('Admin account configuration completed!');
}

// Database configuration
async function configureDatabase() {
    log.header('DATABASE CONFIGURATION');
    console.log(`${colors.dim}   Connecting to your MySQL database server${colors.reset}`);
    console.log('');

    config.db = {};
    
    config.db.host = await question(`${colors.bright}${colors.yellow}🖥️  Database Host${colors.reset} [localhost]: `) || 'localhost';
    
    config.db.name = await validateInput(
        `${colors.bright}${colors.yellow}🗄️  Database Name${colors.reset}: `,
        validators.databaseName,
        'Database name must be 1-64 characters long and contain only letters, numbers, hyphens, and underscores'
    );
    
    config.db.username = await validateInput(
        `${colors.bright}${colors.yellow}👤 Database Username${colors.reset}: `,
        validators.username,
        'Database username must be 3-20 characters long and contain only letters, numbers, hyphens, and underscores'
    );
    
    config.db.password = await hiddenQuestion(`${colors.bright}${colors.yellow}🔐 Database Password${colors.reset}: `);
    
    // Test database connection
    await showProgress('Testing database connection');
    
    try {
        const connection = await mysql.createConnection({
            host: config.db.host,
            port: 3306,
            user: config.db.username,
            password: config.db.password,
            database: config.db.name
        });
        
        await connection.execute('SELECT 1');
        await connection.end();
        
        console.log('');
        console.log(`  ${colors.green}✓${colors.reset} Host: ${colors.bright}${config.db.host}${colors.reset}`);
        console.log(`  ${colors.green}✓${colors.reset} Database: ${colors.bright}${config.db.name}${colors.reset}`);
        console.log(`  ${colors.green}✓${colors.reset} Username: ${colors.bright}${config.db.username}${colors.reset}`);
        console.log(`  ${colors.green}✓${colors.reset} Connection: ${colors.bright}${colors.green}Successful${colors.reset}`);
        console.log('');
        log.success('Database connection successful!');
    } catch (error) {
        console.log('');
        console.log(`  ${colors.red}✗${colors.reset} Database connection failed`);
        console.log(`  ${colors.red}Complete Error Object:${colors.reset}`);
        console.log(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        console.log('');
        process.exit(1);
    }
}

// Generate .env file from template
async function generateEnvFile() {
    log.header('GENERATING CONFIGURATION');
    await showProgress('Reading .env.example template');
    
    try {
        const envExamplePath = path.join(rootDir, '.env.example');
        let envContent = fs.readFileSync(envExamplePath, 'utf8');
        
        // Generate unique session secret
        const sessionSecret = crypto.randomBytes(64).toString('hex');
        
        // Replace template values
        envContent = envContent
            .replace(/SERVER_PORT=.*/, `SERVER_PORT=${config.site.port}`)
            .replace(/SESSION_SECRET=.*/, `SESSION_SECRET=${sessionSecret}`)
            .replace(/ENVIRONMENT=.*/, `ENVIRONMENT=production`)
            .replace(/ALLOWED_ORIGINS=.*/, `ALLOWED_ORIGINS=${config.site.url}`)
            .replace(/DB_HOST=.*/, `DB_HOST=${config.db.host}`)
            .replace(/DB_USER=.*/, `DB_USER=${config.db.username}`)
            .replace(/DB_PASSWORD=.*/, `DB_PASSWORD=${config.db.password}`)
            .replace(/DB_DATABASE=.*/, `DB_DATABASE=${config.db.name}`);
        
        // Add missing fields if not present
        if (!envContent.includes('DB_CONNECTION_LIMIT')) {
            envContent += '\nDB_CONNECTION_LIMIT=500';
        }
        
        await showProgress('Writing .env file');
        const envPath = path.join(rootDir, '.env');
        fs.writeFileSync(envPath, envContent);
        
        log.success('.env file created successfully!');
    } catch (error) {
        log.error('Failed to create .env file:');
        console.log(`${colors.red}${error.message}${colors.reset}`);
        process.exit(1);
    }
}

// Install database base schema (migration table only)
async function installDatabase() {
    log.header('DATABASE INITIALIZATION');
    await showProgress('Reading db_schema.sql');
    
    try {
        const schemaPath = path.join(rootDir, 'db_schema.sql');
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        
        await showProgress('Connecting to database');
        const connection = await mysql.createConnection({
            host: config.db.host,
            port: 3306,
            user: config.db.username,
            password: config.db.password,
            database: config.db.name,
            multipleStatements: true
        });
        
        await showProgress('Installing migration system');
        
        // Split SQL file into individual statements and execute them separately
        const statements = schemaContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        for (const statement of statements) {
            if (statement) {
                await connection.execute(statement);
            }
        }
        
        await connection.end();
        
        log.success('Migration system initialized successfully!');
        console.log('');
        console.log(`  ${colors.bright}📝 Migration-based deployment:${colors.reset}`);
        console.log(`     • Database tables will be created via migrations`);
        console.log(`     • Admin account will be created via migrations`);
        console.log(`     • This ensures consistent deployments and easy updates`);
        console.log('');
        
    } catch (error) {
        log.error('Database initialization failed:');
        console.log(`${colors.red}${error.message}${colors.reset}`);
        process.exit(1);
    }
}

// Update admin account after migrations are complete
async function updateAdminAccount() {
    log.header('ADMIN ACCOUNT SETUP');
    
    try {
        await showProgress('Connecting to database');
        const connection = await mysql.createConnection({
            host: config.db.host,
            port: 3306,
            user: config.db.username,
            password: config.db.password,
            database: config.db.name
        });
        
        // Create admin account
        await showProgress('Updating admin account');
        const hashedPassword = await bcrypt.hash(config.admin.password, 12);
        
        // Remove the default admin account first
        await connection.execute('DELETE FROM users WHERE id = 1');
        
        // Insert new admin account
        await connection.execute(`
            INSERT INTO users (username, email, password, first_name, last_name, user_type, level, exp_points, total_exp_earned, is_active, is_verified, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, 'admin', 1, 0, 0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [config.admin.username, config.admin.email, hashedPassword, config.admin.firstName, config.admin.lastName]);
        
        // Update site settings
        await showProgress('Updating site settings');
        await connection.execute('UPDATE settings SET value = ? WHERE name = "site_name"', [config.site.name]);
        await connection.execute('UPDATE settings SET value = ? WHERE name = "site_description"', [config.site.description]);
        
        await connection.end();
        
        log.success('Admin account configured successfully!');
        
    } catch (error) {
        log.error('Admin account setup failed:');
        console.log(`${colors.red}${error.message}${colors.reset}`);
        process.exit(1);
    }
}

// Check and run pending migrations
async function runMigrations() {
    log.header('MIGRATION SYSTEM');
    
    try {
        // Load environment variables from the newly created .env file
        await showProgress('Loading environment configuration');
        const envPath = path.join(rootDir, '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        
        // Parse and set environment variables
        envContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [key, ...valueParts] = trimmed.split('=');
                const value = valueParts.join('=');
                // Only set if key is not empty
                if (key) {
                    process.env[key] = value;
                }
            }
        });
        
        await showProgress('Checking migration status');
        
        // Dynamic import of migration utilities after environment is loaded
        const { getMigrationStatusInfo, runPendingMigrations } = await import('../src/utils/migration.js');
        
        const status = await getMigrationStatusInfo();
        
        console.log('');
        console.log(`  ${colors.bright}📁 Migration files:${colors.reset} ${status.totalMigrationFiles}`);
        console.log(`  ${colors.bright}✅ Applied:${colors.reset} ${status.appliedMigrations}`);
        console.log(`  ${colors.bright}⏳ Pending:${colors.reset} ${status.pendingMigrations}`);
        
        if (status.pendingMigrations > 0) {
            console.log('');
            log.warning(`Found ${status.pendingMigrations} pending migrations`);
            console.log(`  ${colors.dim}These migrations will create all database tables and setup data${colors.reset}`);
            
            // For fresh deployments, automatically run all migrations
            console.log('');
            log.step('Running all pending migrations automatically...');
            
            await showProgress('Running pending migrations');
            
            const result = await runPendingMigrations();
            
            if (result.success) {
                console.log('');
                result.results.forEach(migration => {
                    console.log(`  ${colors.green}✓${colors.reset} ${migration.migrationName} ${colors.dim}(${migration.executionTime}ms)${colors.reset}`);
                });
                console.log('');
                log.success(`Successfully applied ${result.results.length} migrations!`);
            } else {
                throw new Error(result.message);
            }
        } else {
            console.log('');
            log.success('All migrations are up to date!');
        }
        
    } catch (error) {
        log.error('Migration check failed:');
        console.log(`${colors.red}${error.message}${colors.reset}`);
        
        const continueAnyway = await question(`${colors.bright}${colors.yellow}Continue deployment anyway? (y/N)${colors.reset}: `);
        
        if (continueAnyway.toLowerCase() !== 'y' && continueAnyway.toLowerCase() !== 'yes') {
            process.exit(1);
        }
    }
}

// Final setup steps
async function finalizeSetup() {
    log.header('DEPLOYMENT COMPLETE');
    
    log.highlight('🚀 DEPLOYMENT COMPLETED SUCCESSFULLY! 🚀');
    
    log.subheader('Configuration Summary');
    console.log(`  ${colors.bright}🏷️  Site Name:${colors.reset} ${config.site.name}`);
    console.log(`  ${colors.bright}📝 Description:${colors.reset} ${config.site.description}`);
    console.log(`  ${colors.bright}🌐 Server Port:${colors.reset} ${config.site.port}`);
    console.log(`  ${colors.bright}🌍 Site URL(s):${colors.reset} ${config.site.url}`);
    console.log(`  ${colors.bright}👤 Admin Username:${colors.reset} ${config.admin.username}`);
    console.log(`  ${colors.bright}📧 Admin Email:${colors.reset} ${config.admin.email}`);
    console.log(`  ${colors.bright}🗄️  Database:${colors.reset} ${config.db.name} at ${config.db.host}`);
    console.log(`  ${colors.bright}🔧 Environment:${colors.reset} production`);
    console.log('');
    
    log.subheader('Next Steps');
    console.log(`  ${colors.bright}${colors.green}1.${colors.reset} Run the application: ${colors.bright}${colors.cyan}npm start${colors.reset}`);
    console.log(`  ${colors.bright}${colors.green}2.${colors.reset} Access admin panel: ${colors.bright}${colors.cyan}http://localhost:${config.site.port}/dashboard${colors.reset}`);
    console.log(`  ${colors.bright}${colors.green}3.${colors.reset} Login with your admin credentials`);
    console.log('');
    
    log.subheader('Important Configuration Notes');
    console.log(`  ${colors.bright}${colors.yellow}🔒 ALLOWED_ORIGINS:${colors.reset}`);
    console.log(`    The .env file contains ALLOWED_ORIGINS which controls CORS access.`);
    console.log(`    Current value: ${colors.cyan}${config.site.url}${colors.reset}`);
    console.log('');
    console.log(`  ${colors.dim}To allow multiple domains/IPs to access your site:${colors.reset}`);
    console.log(`    ${colors.bright}1.${colors.reset} Edit the .env file`);
    console.log(`    ${colors.bright}2.${colors.reset} Update ALLOWED_ORIGINS with comma-separated URLs:`);
    console.log(`       ${colors.cyan}ALLOWED_ORIGINS=https://yourdomain.com,http://192.168.1.100:3000,http://localhost:3000${colors.reset}`);
    console.log(`    ${colors.bright}3.${colors.reset} Restart the application`);
    console.log('');
    console.log(`  ${colors.dim}This is especially important for:${colors.reset}`);
    console.log(`    • Development environments with multiple IP addresses`);
    console.log(`    • Production deployments with multiple domains`);
    console.log(`    • Local network access from different devices`);
    console.log('');
}

// Show help information
function showHelp() {
    console.log('');
    console.log(`${colors.bright}${colors.cyan}Deployment Script Help${colors.reset}`);
    console.log('');
    console.log(`${colors.bright}Usage:${colors.reset}`);
    console.log(`  node scripts/deploy.js [options]`);
    console.log('');
    console.log(`${colors.bright}Options:${colors.reset}`);
    console.log(`  --help, -h    Show this help message`);
    console.log('');
    console.log(`${colors.bright}Description:${colors.reset}`);
    console.log(`  Interactive deployment wizard for fresh installations of`);
    console.log(`  the Titan Systems Arcade Platform.`);
    console.log('');
    console.log(`${colors.bright}Features:${colors.reset}`);
    console.log(`  • Site configuration setup`);
    console.log(`  • Admin account creation`);
    console.log(`  • Database initialization via migrations`);
    console.log(`  • Environment file generation`);
    console.log(`  • Production-ready configuration`);
    console.log('');
    console.log(`${colors.red}⚠ This will make actual changes to your system${colors.reset}`);
    console.log(`${colors.blue}ℹ For testing, use: npm run deploy:simulate${colors.reset}`);
    console.log('');
}

// Main deployment function
async function deploy() {
    try {
        // Check for help flag
        const args = process.argv.slice(2);
        if (args.includes('--help') || args.includes('-h')) {
            showHelp();
            return;
        }
        
        showWelcomeBanner();
        
        await configureSite();
        await configureAdmin();
        await configureDatabase();
        await generateEnvFile();
        await installDatabase();
        await runMigrations();
        await updateAdminAccount();
        await finalizeSetup();
        
    } catch (error) {
        log.error('Deployment failed:');
        console.log(`${colors.red}${error.message}${colors.reset}`);
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Run deployment
deploy()
    .catch(console.error)
    .finally(() => {
        // Ensure process exits properly
        process.exit(0);
    });