import executeQuery from "../utils/mysql.js";

const logCronJob = async (jobData) => {
    const { job_name, status, message, execution_time_ms, memory_usage_mb, records_processed, started_at, completed_at } = jobData;
    return await executeQuery(
        "INSERT INTO cron_logs (job_name, status, message, execution_time_ms, memory_usage_mb, records_processed, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [job_name, status, message, execution_time_ms, memory_usage_mb, records_processed, started_at, completed_at]
    );
}

const startCronJob = async (jobName) => {
    return await executeQuery(
        "INSERT INTO cron_logs (job_name, status, started_at) VALUES (?, 'running', NOW())",
        [jobName]
    );
}

const completeCronJob = async (logId, status, message, execution_time_ms, memory_usage_mb, records_processed) => {
    return await executeQuery(
        "UPDATE cron_logs SET status = ?, message = ?, execution_time_ms = ?, memory_usage_mb = ?, records_processed = ?, completed_at = NOW() WHERE id = ?",
        [status, message, execution_time_ms, memory_usage_mb, records_processed, logId]
    );
}

const getCronLogs = async (limit = 100, offset = 0) => {
    return await executeQuery(
        "SELECT * FROM cron_logs ORDER BY created_at DESC LIMIT ? OFFSET ?",
        [limit, offset]
    );
}

const getCronLogsByJob = async (jobName, limit = 50) => {
    return await executeQuery(
        "SELECT * FROM cron_logs WHERE job_name = ? ORDER BY created_at DESC LIMIT ?",
        [jobName, limit]
    );
}

const getCronLogsByStatus = async (status, limit = 50) => {
    return await executeQuery(
        "SELECT * FROM cron_logs WHERE status = ? ORDER BY created_at DESC LIMIT ?",
        [status, limit]
    );
}

const getCronJobStats = async () => {
    return await executeQuery(`
        SELECT 
            job_name,
            status,
            COUNT(*) as count,
            AVG(execution_time_ms) as avg_execution_time,
            MAX(execution_time_ms) as max_execution_time,
            AVG(memory_usage_mb) as avg_memory_usage,
            SUM(records_processed) as total_records_processed,
            DATE(created_at) as date
        FROM cron_logs 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY job_name, status, DATE(created_at)
        ORDER BY date DESC, job_name
    `, []);
}

const getRunningCronJobs = async () => {
    return await executeQuery(
        "SELECT * FROM cron_logs WHERE status = 'running' ORDER BY started_at ASC",
        []
    );
}

const cleanupOldLogs = async (daysToKeep = 90) => {
    return await executeQuery(
        "DELETE FROM cron_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)",
        [daysToKeep]
    );
}

const getRecentCronLogs = async (limit = 20) => {
    return await executeQuery(`
        SELECT job_name, status, message, execution_time_ms, records_processed, started_at
        FROM cron_logs 
        ORDER BY started_at DESC 
        LIMIT ?
    `, [limit]);
}

const getCronStatusCounts = async () => {
    return await executeQuery(`
        SELECT status, COUNT(*) as count
        FROM cron_logs 
        WHERE started_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY status
    `, []);
}

const createCronLogEntry = async (jobName, status, message = null, executionTime = null, memoryUsage = null, recordsProcessed = null) => {
    return await executeQuery(`
        INSERT INTO cron_logs (job_name, status, message, execution_time_ms, memory_usage_mb, records_processed, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [jobName, status, message, executionTime, memoryUsage, recordsProcessed]);
}

export {
    logCronJob,
    startCronJob,
    completeCronJob,
    getCronLogs,
    getCronLogsByJob,
    getCronLogsByStatus,
    getCronJobStats,
    getRunningCronJobs,
    cleanupOldLogs,
    getRecentCronLogs,
    getCronStatusCounts,
    createCronLogEntry
}