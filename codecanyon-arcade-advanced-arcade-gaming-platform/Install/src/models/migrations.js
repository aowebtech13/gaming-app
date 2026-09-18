import executeQuery from '../utils/mysql.js';

/**
 * Migration model for tracking database migrations
 * Follows database guidelines with simple column types
 */

/**
 * Create the migrations table if it doesn't exist
 */
const createMigrationsTable = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS migrations (
            id int(11) NOT NULL AUTO_INCREMENT,
            migration_name tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
            batch int(11) NOT NULL,
            executed_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            execution_time_ms int(11),
            rollback_sql longtext COLLATE utf8mb4_unicode_ci,
            created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    
    await executeQuery(createTableQuery, []);
};

/**
 * Get all applied migrations
 */
const getAppliedMigrations = async () => {
    await createMigrationsTable();
    const data = await executeQuery(
        "SELECT * FROM migrations ORDER BY executed_at ASC", 
        []
    );
    return data;
};

/**
 * Get the next batch number for migrations
 */
const getNextBatchNumber = async () => {
    await createMigrationsTable();
    const result = await executeQuery(
        "SELECT MAX(batch) as max_batch FROM migrations", 
        []
    );
    return result[0].max_batch ? result[0].max_batch + 1 : 1;
};

/**
 * Check if a migration has been applied
 */
const isMigrationApplied = async (migrationName) => {
    await createMigrationsTable();
    const data = await executeQuery(
        "SELECT * FROM migrations WHERE migration_name = ? LIMIT 1", 
        [migrationName]
    );
    return data.length > 0;
};

/**
 * Record a migration as applied
 */
const recordMigration = async (migrationName, batch, executionTimeMs, rollbackSql = null) => {
    await createMigrationsTable();
    const data = await executeQuery(
        "INSERT INTO migrations (migration_name, batch, execution_time_ms, rollback_sql) VALUES (?, ?, ?, ?)",
        [migrationName, batch, executionTimeMs, rollbackSql]
    );
    return data;
};

/**
 * Remove a migration record (for rollbacks)
 */
const removeMigrationRecord = async (migrationName) => {
    await createMigrationsTable();
    const data = await executeQuery(
        "DELETE FROM migrations WHERE migration_name = ?",
        [migrationName]
    );
    return data;
};

/**
 * Get migrations from a specific batch
 */
const getMigrationsByBatch = async (batch) => {
    await createMigrationsTable();
    const data = await executeQuery(
        "SELECT * FROM migrations WHERE batch = ? ORDER BY executed_at DESC",
        [batch]
    );
    return data;
};

/**
 * Get the latest batch number
 */
const getLatestBatch = async () => {
    await createMigrationsTable();
    const result = await executeQuery(
        "SELECT MAX(batch) as latest_batch FROM migrations",
        []
    );
    return result[0].latest_batch || 0;
};

/**
 * Get migration status summary
 */
const getMigrationStatus = async () => {
    await createMigrationsTable();
    const result = await executeQuery(`
        SELECT 
            COUNT(*) as total_migrations,
            MAX(batch) as latest_batch,
            MAX(executed_at) as last_migration_time
        FROM migrations
    `, []);
    
    return result[0];
};

/**
 * Clear all migration records (use with caution)
 */
const clearAllMigrations = async () => {
    await createMigrationsTable();
    const data = await executeQuery("DELETE FROM migrations", []);
    return data;
};

export {
    createMigrationsTable,
    getAppliedMigrations,
    getNextBatchNumber,
    isMigrationApplied,
    recordMigration,
    removeMigrationRecord,
    getMigrationsByBatch,
    getLatestBatch,
    getMigrationStatus,
    clearAllMigrations
};