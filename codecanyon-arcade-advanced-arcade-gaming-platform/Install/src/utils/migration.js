import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { consoleLog } from './logger.js';
import {
    getAppliedMigrations,
    getNextBatchNumber,
    isMigrationApplied,
    recordMigration,
    removeMigrationRecord,
    getMigrationsByBatch,
    getLatestBatch
} from '../models/migrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const migrationsDir = path.join(rootDir, 'migrations');

/**
 * Database connection configuration
 */
const getDbConfig = () => {
    return {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'arcade',
        multipleStatements: true
    };
};

/**
 * Create database connection
 */
const createConnection = async () => {
    return await mysql.createConnection(getDbConfig());
};

/**
 * Validate migration file structure according to database guidelines
 */
const validateMigrationSQL = (sql) => {
    const forbidden = [
        'varchar', 'char', 'timestamp', 'enum', 'set', 'json', 'decimal'
    ];
    
    const lowerSQL = sql.toLowerCase();
    const violations = [];
    
    forbidden.forEach(type => {
        if (lowerSQL.includes(type + '(') || lowerSQL.includes(type + ' ')) {
            violations.push(`Forbidden column type "${type}" found in migration`);
        }
    });
    
    // Check for DEFAULT values on TEXT columns
    if (lowerSQL.includes('text') && lowerSQL.includes('default')) {
        const textDefaultRegex = /(tiny|medium|long)?text[^,]*default/gi;
        if (textDefaultRegex.test(sql)) {
            violations.push('TEXT columns cannot have DEFAULT values in MySQL');
        }
    }
    
    return violations;
};

/**
 * Load migration file
 */
const loadMigrationFile = (migrationName) => {
    const migrationPath = path.join(migrationsDir, migrationName);
    
    if (!fs.existsSync(migrationPath)) {
        throw new Error(`Migration file not found: ${migrationName}`);
    }
    
    try {
        // Dynamic import for ES modules
        return import(migrationPath);
    } catch (error) {
        throw new Error(`Failed to load migration ${migrationName}: ${error.message}`);
    }
};

/**
 * Get all migration files from the migrations directory
 */
const getMigrationFiles = () => {
    if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
        return [];
    }
    
    return fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.js'))
        .sort(); // Chronological order based on timestamp prefix
};

/**
 * Get pending migrations (not yet applied)
 */
const getPendingMigrations = async () => {
    const allMigrationFiles = getMigrationFiles();
    const appliedMigrations = await getAppliedMigrations();
    const appliedNames = appliedMigrations.map(m => m.migration_name);
    
    return allMigrationFiles.filter(file => !appliedNames.includes(file));
};

/**
 * Execute a single migration with transaction support
 */
const executeMigration = async (migrationName, direction = 'up') => {
    const connection = await createConnection();
    const startTime = Date.now();
    
    try {
        await connection.beginTransaction();
        
        const migrationModule = await loadMigrationFile(migrationName);
        
        if (direction === 'up' && typeof migrationModule.up !== 'function') {
            throw new Error(`Migration ${migrationName} missing "up" method`);
        }
        
        if (direction === 'down' && typeof migrationModule.down !== 'function') {
            throw new Error(`Migration ${migrationName} missing "down" method`);
        }
        
        // Execute the migration
        const migrationFunction = direction === 'up' ? migrationModule.up : migrationModule.down;
        await migrationFunction(connection);
        
        const executionTime = Date.now() - startTime;
        
        if (direction === 'up') {
            // Record the migration as applied
            const batch = await getNextBatchNumber();
            const rollbackSql = migrationModule.rollback || null;
            await recordMigration(migrationName, batch, executionTime, rollbackSql);
        } else {
            // Remove the migration record for rollback
            await removeMigrationRecord(migrationName);
        }
        
        await connection.commit();
        
        return {
            success: true,
            migrationName,
            direction,
            executionTime,
            message: `Migration ${migrationName} ${direction} executed successfully`
        };
        
    } catch (error) {
        await connection.rollback();
        throw new Error(`Migration ${migrationName} ${direction} failed: ${error.message}`);
    } finally {
        await connection.end();
    }
};

/**
 * Run pending migrations
 */
const runPendingMigrations = async () => {
    const pendingMigrations = await getPendingMigrations();
    const results = [];
    
    if (pendingMigrations.length === 0) {
        return {
            success: true,
            message: 'No pending migrations to run',
            results: []
        };
    }
    
    for (const migrationName of pendingMigrations) {
        try {
            const result = await executeMigration(migrationName, 'up');
            results.push(result);
        } catch (error) {
            results.push({
                success: false,
                migrationName,
                direction: 'up',
                error: error.message
            });
            
            return {
                success: false,
                message: `Migration batch failed at ${migrationName}`,
                results
            };
        }
    }
    
    return {
        success: true,
        message: `Successfully ran ${results.length} migrations`,
        results
    };
};

/**
 * Rollback the last batch of migrations
 */
const rollbackLastBatch = async () => {
    const latestBatch = await getLatestBatch();
    
    if (latestBatch === 0) {
        return {
            success: true,
            message: 'No migrations to rollback',
            results: []
        };
    }
    
    const migrationsToRollback = await getMigrationsByBatch(latestBatch);
    const results = [];
    
    // Rollback in reverse order
    for (const migration of migrationsToRollback) {
        try {
            const result = await executeMigration(migration.migration_name, 'down');
            results.push(result);
        } catch (error) {
            results.push({
                success: false,
                migrationName: migration.migration_name,
                direction: 'down',
                error: error.message
            });
            
            return {
                success: false,
                message: `Rollback failed at ${migration.migration_name}`,
                results
            };
        }
    }
    
    return {
        success: true,
        message: `Successfully rolled back batch ${latestBatch}`,
        results
    };
};

/**
 * Reset all migrations (rollback everything)
 */
const resetAllMigrations = async () => {
    const appliedMigrations = await getAppliedMigrations();
    const results = [];
    
    if (appliedMigrations.length === 0) {
        return {
            success: true,
            message: 'No migrations to reset',
            results: []
        };
    }
    
    // Rollback all migrations in reverse order
    for (let i = appliedMigrations.length - 1; i >= 0; i--) {
        const migration = appliedMigrations[i];
        try {
            const result = await executeMigration(migration.migration_name, 'down');
            results.push(result);
        } catch (error) {
            results.push({
                success: false,
                migrationName: migration.migration_name,
                direction: 'down',
                error: error.message
            });
            
            return {
                success: false,
                message: `Reset failed at ${migration.migration_name}`,
                results
            };
        }
    }
    
    return {
        success: true,
        message: `Successfully reset ${results.length} migrations`,
        results
    };
};

/**
 * Fresh migration (reset + migrate)
 */
const freshMigrations = async () => {
    const resetResult = await resetAllMigrations();
    
    if (!resetResult.success) {
        return resetResult;
    }
    
    const migrateResult = await runPendingMigrations();
    
    return {
        success: migrateResult.success,
        message: `Fresh migration completed`,
        resetResults: resetResult.results,
        migrateResults: migrateResult.results
    };
};

/**
 * Check if a table exists in the database
 */
const tableExists = async (connection, tableName) => {
    try {
        // Use INFORMATION_SCHEMA for better compatibility across MySQL 5.7+ and MariaDB
        const [rows] = await connection.execute(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = ?
        `, [tableName]);
        return rows.length > 0;
    } catch (error) {
        consoleLog('error', `Error checking if table ${tableName} exists`, { error: error.message });
        return false;
    }
};

/**
 * Check if a column exists in a specific table
 */
const columnExists = async (connection, tableName, columnName) => {
    try {
        // Use INFORMATION_SCHEMA for better compatibility across MySQL 5.7+ and MariaDB
        const [rows] = await connection.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = ? 
            AND COLUMN_NAME = ?
        `, [tableName, columnName]);
        return rows.length > 0;
    } catch (error) {
        consoleLog('error', `Error checking if column ${columnName} exists in table ${tableName}`, { error: error.message });
        return false;
    }
};

/**
 * Check if an index exists on a table
 */
const indexExists = async (connection, tableName, indexName) => {
    try {
        // Use INFORMATION_SCHEMA for better compatibility across MySQL 5.7+ and MariaDB
        const [rows] = await connection.execute(`
            SELECT INDEX_NAME 
            FROM INFORMATION_SCHEMA.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = ? 
            AND INDEX_NAME = ?
        `, [tableName, indexName]);
        return rows.length > 0;
    } catch (error) {
        consoleLog('error', `Error checking if index ${indexName} exists on table ${tableName}`, { error: error.message });
        return false;
    }
};

/**
 * Check if a foreign key constraint exists
 */
const foreignKeyExists = async (connection, tableName, constraintName) => {
    try {
        // Use INFORMATION_SCHEMA for better compatibility across MySQL 5.7+ and MariaDB
        const [rows] = await connection.execute(`
            SELECT CONSTRAINT_NAME 
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = ? 
            AND CONSTRAINT_NAME = ?
            AND REFERENCED_TABLE_NAME IS NOT NULL
        `, [tableName, constraintName]);
        return rows.length > 0;
    } catch (error) {
        consoleLog('error', `Error checking if foreign key ${constraintName} exists on table ${tableName}`, { error: error.message });
        return false;
    }
};

/**
 * Get table column information
 */
const getTableColumns = async (connection, tableName) => {
    try {
        // Use INFORMATION_SCHEMA for better compatibility across MySQL 5.7+ and MariaDB
        const [rows] = await connection.execute(`
            SELECT 
                COLUMN_NAME as Field,
                COLUMN_TYPE as Type,
                IS_NULLABLE as \`Null\`,
                COLUMN_KEY as \`Key\`,
                COLUMN_DEFAULT as \`Default\`,
                EXTRA as Extra
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        `, [tableName]);
        return rows.map(row => ({
            field: row.Field,
            type: row.Type,
            null: row.Null,
            key: row.Key,
            default: row.Default,
            extra: row.Extra
        }));
    } catch (error) {
        consoleLog('error', `Error getting columns for table ${tableName}`, { error: error.message });
        return [];
    }
};

/**
 * Safe table creation helper - only creates if it doesn't exist
 */
const createTableIfNotExists = async (connection, tableName, createTableSQL) => {
    const exists = await tableExists(connection, tableName);
    if (!exists) {
        await connection.execute(createTableSQL);
        return { created: true, message: `Table ${tableName} created successfully` };
    } else {
        return { created: false, message: `Table ${tableName} already exists, skipping creation` };
    }
};

/**
 * Safe column addition helper - only adds if it doesn't exist
 */
const addColumnIfNotExists = async (connection, tableName, columnName, columnDefinition) => {
    const exists = await columnExists(connection, tableName, columnName);
    if (!exists) {
        const sql = `ALTER TABLE \`${tableName}\` ADD COLUMN ${columnDefinition}`;
        await connection.execute(sql);
        return { added: true, message: `Column ${columnName} added to table ${tableName}` };
    } else {
        return { added: false, message: `Column ${columnName} already exists in table ${tableName}, skipping addition` };
    }
};

/**
 * Safe index creation helper - only creates if it doesn't exist
 */
const createIndexIfNotExists = async (connection, tableName, indexName, indexDefinition) => {
    const exists = await indexExists(connection, tableName, indexName);
    if (!exists) {
        const sql = `CREATE INDEX ${indexName} ON \`${tableName}\` ${indexDefinition}`;
        await connection.execute(sql);
        return { created: true, message: `Index ${indexName} created on table ${tableName}` };
    } else {
        return { created: false, message: `Index ${indexName} already exists on table ${tableName}, skipping creation` };
    }
};

/**
 * Safe foreign key creation helper - only creates if it doesn't exist
 */
const addForeignKeyIfNotExists = async (connection, tableName, constraintName, foreignKeyDefinition) => {
    const exists = await foreignKeyExists(connection, tableName, constraintName);
    if (!exists) {
        const sql = `ALTER TABLE \`${tableName}\` ADD CONSTRAINT ${constraintName} ${foreignKeyDefinition}`;
        await connection.execute(sql);
        return { created: true, message: `Foreign key ${constraintName} added to table ${tableName}` };
    } else {
        return { created: false, message: `Foreign key ${constraintName} already exists on table ${tableName}, skipping creation` };
    }
};

/**
 * Modify column if it exists with different definition
 */
const modifyColumnIfDifferent = async (connection, tableName, columnName, newDefinition) => {
    const exists = await columnExists(connection, tableName, columnName);
    if (exists) {
        const columns = await getTableColumns(connection, tableName);
        const column = columns.find(col => col.field === columnName);
        
        if (column) {
            // Simple check - in real scenarios you might want more sophisticated comparison
            const sql = `ALTER TABLE \`${tableName}\` MODIFY COLUMN ${columnName} ${newDefinition}`;
            await connection.execute(sql);
            return { modified: true, message: `Column ${columnName} modified in table ${tableName}` };
        }
    }
    return { modified: false, message: `Column ${columnName} does not exist in table ${tableName}` };
};

/**
 * Get migration status
 */
const getMigrationStatusInfo = async () => {
    const allFiles = getMigrationFiles();
    const appliedMigrations = await getAppliedMigrations();
    const pendingMigrations = await getPendingMigrations();
    
    return {
        totalMigrationFiles: allFiles.length,
        appliedMigrations: appliedMigrations.length,
        pendingMigrations: pendingMigrations.length,
        latestBatch: await getLatestBatch(),
        migrations: {
            applied: appliedMigrations.map(m => ({
                name: m.migration_name,
                batch: m.batch,
                executedAt: m.executed_at,
                executionTime: m.execution_time_ms
            })),
            pending: pendingMigrations
        }
    };
};

export {
    getMigrationFiles,
    getPendingMigrations,
    executeMigration,
    runPendingMigrations,
    rollbackLastBatch,
    resetAllMigrations,
    freshMigrations,
    getMigrationStatusInfo,
    validateMigrationSQL,
    loadMigrationFile,
    createConnection,
    migrationsDir,
    // Smart migration helpers
    tableExists,
    columnExists,
    indexExists,
    foreignKeyExists,
    getTableColumns,
    createTableIfNotExists,
    addColumnIfNotExists,
    createIndexIfNotExists,
    addForeignKeyIfNotExists,
    modifyColumnIfDifferent
};