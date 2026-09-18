#!/usr/bin/env node

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

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
        console.log(`${colors.bright}${colors.magenta}${'═'.repeat(80)}${colors.reset}`);
        console.log(`${colors.bright}${colors.bgBlue}  ${msg}  ${colors.reset}`);
        console.log(`${colors.bright}${colors.magenta}${'═'.repeat(80)}${colors.reset}`);
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
        console.log(`${colors.bright}${colors.yellow}${'═'.repeat(80)}${colors.reset}`);
        console.log(`${colors.bright}${colors.bgGreen}  ${msg}  ${colors.reset}`);
        console.log(`${colors.bright}${colors.yellow}${'═'.repeat(80)}${colors.reset}`);
        console.log('');
    },
    simulate: (msg) => console.log(`${colors.dim}${colors.cyan}[SIMULATION]${colors.reset} ${msg}`)
};

// Progress indicator
function showProgress(message, duration = 1500) {
    return new Promise((resolve) => {
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let i = 0;
        const interval = setInterval(() => {
            process.stdout.write(`\r${colors.magenta}${frames[i]}${colors.reset} ${message}...`);
            i = (i + 1) % frames.length;
        }, 100);

        setTimeout(() => {
            clearInterval(interval);
            process.stdout.write(`\r${colors.yellow}✓${colors.reset} ${message}\n`);
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
    console.log(`${colors.bright}${colors.magenta}                  🧪 TITAN SYSTEMS SIMULATION 🧪${colors.reset}`);
    console.log(`${colors.bright}${colors.yellow}              ✨ Deployment Simulation Wizard ✨${colors.reset}`);
    console.log('');
    console.log(`${colors.dim}   Welcome to the Titan Systems Arcade Platform deployment simulation!${colors.reset}`);
    console.log(`${colors.dim}   This wizard will simulate the deployment process without making changes.${colors.reset}`);
    console.log('');
    console.log(`${colors.bright}${colors.yellow}⚠ SIMULATION MODE - NO ACTUAL CHANGES WILL BE MADE${colors.reset}`);
    console.log('');
    console.log(`     ${colors.yellow}⚠${colors.reset} ${colors.bright}Test deployment configuration safely${colors.reset}`);
    console.log(`     ${colors.yellow}⚠${colors.reset} ${colors.bright}Validate database credentials${colors.reset}`);
    console.log(`     ${colors.yellow}⚠${colors.reset} ${colors.bright}Preview deployment steps${colors.reset}`);
    console.log(`     ${colors.yellow}⚠${colors.reset} ${colors.bright}No files or databases will be modified${colors.reset}`);
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
    console.log(`  ${colors.cyan}[SIMULATION]${colors.reset} Site name set to: ${colors.bright}${config.site.name}${colors.reset}`);
    console.log(`  ${colors.cyan}[SIMULATION]${colors.reset} Site description set to: ${colors.bright}${config.site.description}${colors.reset}`);
    console.log(`  ${colors.cyan}[SIMULATION]${colors.reset} Server port set to: ${colors.bright}${config.site.port}${colors.reset}`);
    console.log(`  ${colors.cyan}[SIMULATION]${colors.reset} Site URL(s) set to: ${colors.bright}${config.site.url}${colors.reset}`);
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
    console.log(`  ${colors.cyan}[SIMULATION]${colors.reset} Admin username: ${colors.bright}${config.admin.username}${colors.reset}`);
    console.log(`  ${colors.cyan}[SIMULATION]${colors.reset} Admin full name: ${colors.bright}${config.admin.firstName} ${config.admin.lastName}${colors.reset}`);
    console.log(`  ${colors.cyan}[SIMULATION]${colors.reset} Admin email: ${colors.bright}${config.admin.email}${colors.reset}`);
    console.log(`  ${colors.cyan}[SIMULATION]${colors.reset} Password would be hashed with bcrypt (12 rounds)`);
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
    
    console.log('');
    console.log(`  ${colors.cyan}[SIMULATION]${colors.reset} Database connection would be: ${colors.bright}${config.db.username}@${config.db.host}/${config.db.name}${colors.reset}`);
    console.log('');
    
    // Simulate database connection test
    await showProgress('Simulating database connection test');
    log.simulate('Database connection test would be performed here');
    log.success('Database connection test simulation successful!');
}

// Generate .env file simulation
async function simulateEnvFile() {
    log.header('ENVIRONMENT FILE SIMULATION');
    await showProgress('Simulating .env.example template reading');
    
    try {
        const envExamplePath = path.join(rootDir, '.env.example');
        
        // Check if .env.example exists
        if (fs.existsSync(envExamplePath)) {
            const envContent = fs.readFileSync(envExamplePath, 'utf8');
            log.simulate('Successfully read .env.example template');
            
            // Generate unique session secret
            const sessionSecret = crypto.randomBytes(64).toString('hex');
            log.simulate(`Generated session secret: ${sessionSecret.substring(0, 20)}...`);
            
            // Show what would be replaced
            console.log('');
            log.subheader('Environment Variables (Simulation):');
            console.log(`${colors.cyan}SERVER_PORT:${colors.reset} ${config.site.port}`);
            console.log(`${colors.cyan}ENVIRONMENT:${colors.reset} production`);
            console.log(`${colors.cyan}ALLOWED_ORIGINS:${colors.reset} ${config.site.url}`);
            console.log(`${colors.cyan}SESSION_SECRET:${colors.reset} ${sessionSecret.substring(0, 20)}...`);
            console.log(`${colors.cyan}DB_HOST:${colors.reset} ${config.db.host}`);
            console.log(`${colors.cyan}DB_USER:${colors.reset} ${config.db.username}`);
            console.log(`${colors.cyan}DB_PASSWORD:${colors.reset} ${'*'.repeat(config.db.password.length)}`);
            console.log(`${colors.cyan}DB_DATABASE:${colors.reset} ${config.db.name}`);
            console.log(`${colors.cyan}DB_CONNECTION_LIMIT:${colors.reset} 500`);
            console.log('');
            
            await showProgress('Simulating .env file creation');
            log.simulate('Would create .env file with above configuration');
            log.success('.env file simulation completed!');
        } else {
            log.error('.env.example file not found - simulation cannot proceed');
            throw new Error('.env.example file missing');
        }
        
    } catch (error) {
        log.error('Environment file simulation failed:');
        console.log(`${colors.red}${error.message}${colors.reset}`);
        throw error;
    }
}

// Database initialization simulation (migration-based)
async function simulateDatabase() {
    log.header('DATABASE INITIALIZATION SIMULATION');
    await showProgress('Simulating db_schema.sql reading');
    
    try {
        const schemaPath = path.join(rootDir, 'db_schema.sql');
        
        // Check if schema file exists
        if (fs.existsSync(schemaPath)) {
            const schemaContent = fs.readFileSync(schemaPath, 'utf8');
            
            log.simulate('Found minimal db_schema.sql (migration-based deployment)');
            log.simulate('Schema only creates migrations tracking table');
            
            await showProgress('Simulating database connection');
            log.simulate(`Would connect to: ${config.db.username}@${config.db.host}/${config.db.name}`);
            
            await showProgress('Simulating migration system initialization');
            log.simulate('Would execute minimal schema to create migrations table');
            log.success('Migration system initialization simulation completed!');
            
        } else {
            log.error('db_schema.sql file not found - simulation cannot proceed');
            throw new Error('db_schema.sql file missing');
        }
        
    } catch (error) {
        log.error('Database initialization simulation failed:');
        console.log(`${colors.red}${error.message}${colors.reset}`);
        throw error;
    }
}

// Migration simulation
async function simulateMigrations() {
    log.header('MIGRATION SYSTEM SIMULATION');
    await showProgress('Simulating migration status check');
    
    try {
        const migrationsDir = path.join(rootDir, 'migrations');
        
        if (fs.existsSync(migrationsDir)) {
            const migrationFiles = fs.readdirSync(migrationsDir)
                .filter(file => file.endsWith('.js'))
                .sort();
            
            log.simulate(`Found ${migrationFiles.length} migration files:`);
            migrationFiles.forEach(file => {
                console.log(`    ${colors.cyan}→${colors.reset} ${file}`);
            });
            
            await showProgress('Simulating pending migrations execution');
            
            for (const migrationFile of migrationFiles) {
                log.simulate(`Would execute migration: ${migrationFile}`);
                await new Promise(resolve => setTimeout(resolve, 300)); // Small delay for realism
            }
            
            console.log('');
            log.simulate('All database tables would be created via migrations');
            log.simulate('Default data would be inserted via migrations');
            log.simulate('Advertisement system would be added via migration');
            log.success(`Migration simulation completed! ${migrationFiles.length} migrations would be applied.`);
            
        } else {
            log.warning('Migrations directory not found - would create it during real deployment');
        }
        
    } catch (error) {
        log.error('Migration simulation failed:');
        console.log(`${colors.red}${error.message}${colors.reset}`);
        throw error;
    }
}

// Admin account update simulation
async function simulateAdminUpdate() {
    log.header('ADMIN ACCOUNT UPDATE SIMULATION');
    
    await showProgress('Simulating admin account update');
    const hashedPassword = await bcrypt.hash(config.admin.password, 12);
    log.simulate('Would delete default admin account (id=1)');
    log.simulate(`Would create new admin account with hashed password: ${hashedPassword.substring(0, 30)}...`);
    
    // Simulate site settings update
    await showProgress('Simulating site settings update');
    log.simulate(`Would update site_name setting to: ${config.site.name}`);
    log.simulate(`Would update site_description setting to: ${config.site.description}`);
    
    log.success('Admin account update simulation completed!');
}

// Final setup simulation
async function finalizeSimulation() {
    log.header('SIMULATION COMPLETE');
    
    log.highlight('🧪 DEPLOYMENT SIMULATION COMPLETED! 🧪');
    
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
    
    log.subheader('What Would Have Been Done');
    console.log(`  ${colors.green}✓${colors.reset} Read .env.example template`);
    console.log(`  ${colors.green}✓${colors.reset} Generated secure session secret`);
    console.log(`  ${colors.green}✓${colors.reset} Created .env file with database credentials`);
    console.log(`  ${colors.green}✓${colors.reset} Initialized migration system (minimal schema)`);
    console.log(`  ${colors.green}✓${colors.reset} Applied all pending migrations`);
    console.log(`  ${colors.green}✓${colors.reset} Created database tables via migrations`);
    console.log(`  ${colors.green}✓${colors.reset} Installed advertisement system via migration`);
    console.log(`  ${colors.green}✓${colors.reset} Removed default admin account`);
    console.log(`  ${colors.green}✓${colors.reset} Created custom admin account with bcrypt password`);
    console.log(`  ${colors.green}✓${colors.reset} Updated site settings in database`);
    console.log('');
    
    log.subheader('Next Steps (If This Was Real)');
    console.log(`  ${colors.bright}${colors.blue}1.${colors.reset} Run the application: ${colors.bright}${colors.cyan}npm start${colors.reset}`);
    console.log(`  ${colors.bright}${colors.blue}2.${colors.reset} Access admin panel: ${colors.bright}${colors.cyan}http://localhost:${config.site.port}/dashboard${colors.reset}`);
    console.log(`  ${colors.bright}${colors.blue}3.${colors.reset} Login with your admin credentials`);
    console.log('');
    
    log.subheader('Important Configuration Notes');
    console.log(`  ${colors.bright}${colors.yellow}🔒 ALLOWED_ORIGINS:${colors.reset}`);
    console.log(`    The .env file would contain ALLOWED_ORIGINS which controls CORS access.`);
    console.log(`    Simulated value: ${colors.cyan}${config.site.url}${colors.reset}`);
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
    
    console.log(`${colors.bright}${colors.yellow}⚠ This was a simulation - no actual changes were made to your system!${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}ℹ To perform the real deployment, run: ${colors.cyan}npm run deploy${colors.reset}`);
    console.log('');
}

// Show help information
function showHelp() {
    console.log('');
    console.log(`${colors.bright}${colors.cyan}Deployment Simulation Help${colors.reset}`);
    console.log('');
    console.log(`${colors.bright}Usage:${colors.reset}`);
    console.log(`  node scripts/deploy_simulation.js [options]`);
    console.log('');
    console.log(`${colors.bright}Options:${colors.reset}`);
    console.log(`  --help, -h    Show this help message`);
    console.log('');
    console.log(`${colors.bright}Description:${colors.reset}`);
    console.log(`  Interactive deployment simulation wizard that walks you through`);
    console.log(`  the deployment process without making any actual changes.`);
    console.log('');
    console.log(`${colors.bright}Features:${colors.reset}`);
    console.log(`  • Site configuration validation`);
    console.log(`  • Admin account setup simulation`);
    console.log(`  • Database connection testing simulation`);
    console.log(`  • Environment file generation preview`);
    console.log(`  • Migration system validation`);
    console.log('');
    console.log(`${colors.yellow}⚠ This is a simulation - no actual changes will be made${colors.reset}`);
    console.log('');
}

// Main deployment simulation function
async function deploySimulation() {
    try {
        // Check for help flag or non-interactive mode
        const args = process.argv.slice(2);
        if (args.includes('--help') || args.includes('-h')) {
            showHelp();
            return;
        }
        
        showWelcomeBanner();
        
        await configureSite();
        await configureAdmin();
        await configureDatabase();
        await simulateEnvFile();
        await simulateDatabase();
        await simulateMigrations();
        await simulateAdminUpdate();
        await finalizeSimulation();
        
    } catch (error) {
        log.error('Deployment simulation failed:');
        console.log(`${colors.red}${error.message}${colors.reset}`);
        console.log('');
        log.info('This simulation helps identify potential issues before real deployment');
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Run deployment simulation
deploySimulation()
    .catch(console.error)
    .finally(() => {
        // Ensure process exits properly
        process.exit(0);
    });