import executeQuery from "../utils/mysql.js";

const logEmail = async (emailData) => {
    const { recipient_email, recipient_name, subject, template, status, error_message, sent_at } = emailData;
    return await executeQuery(
        "INSERT INTO email_logs (recipient_email, recipient_name, subject, template, status, error_message, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [recipient_email, recipient_name, subject, template, status, error_message, sent_at]
    );
}

const getEmailLogs = async (limit = 50, offset = 0) => {
    return await executeQuery(
        "SELECT * FROM email_logs ORDER BY created_at DESC LIMIT ? OFFSET ?",
        [limit, offset]
    );
}

const getEmailLogsByStatus = async (status, limit = 50) => {
    return await executeQuery(
        "SELECT * FROM email_logs WHERE status = ? ORDER BY created_at DESC LIMIT ?",
        [status, limit]
    );
}

const getEmailLogsByRecipient = async (recipient_email, limit = 50) => {
    return await executeQuery(
        "SELECT * FROM email_logs WHERE recipient_email = ? ORDER BY created_at DESC LIMIT ?",
        [recipient_email, limit]
    );
}

const getEmailLogsByTemplate = async (template, limit = 50) => {
    return await executeQuery(
        "SELECT * FROM email_logs WHERE template = ? ORDER BY created_at DESC LIMIT ?",
        [template, limit]
    );
}

const getEmailLogsStats = async () => {
    return await executeQuery(`
        SELECT 
            status,
            COUNT(*) as count,
            DATE(created_at) as date
        FROM email_logs 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY status, DATE(created_at)
        ORDER BY date DESC
    `);
}

const cleanupOldEmailLogs = async (daysToKeep = 90) => {
    return await executeQuery(
        "DELETE FROM email_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)",
        [daysToKeep]
    );
}

export {
    logEmail,
    getEmailLogs,
    getEmailLogsByStatus,
    getEmailLogsByRecipient,
    getEmailLogsByTemplate,
    getEmailLogsStats,
    cleanupOldEmailLogs
}