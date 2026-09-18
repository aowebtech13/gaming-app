import executeQuery from "../utils/mysql.js";
import { consoleLog } from "./logger.js";

/**
 * Fetch paginated and searchable data from any table with optional custom filters.
 * MySQL 9.3.0 compatible version using string interpolation for LIMIT/OFFSET.
 * @param {string} tableName - The name of the table to fetch data from.
 * @param {string[]} columns - The columns to fetch from the table.
 * @param {Object} options - Options for pagination, search, and custom filters.
 * @param {string} options.search - The search query (applies to all specified columns).
 * @param {number} options.page - The page number (for pagination).
 * @param {number} options.limit - The number of records per page.
 * @param {string} [options.customWhere] - Custom WHERE clause (without 'WHERE').
 * @param {Array} [options.customParams] - Parameters for the custom WHERE clause.
 * @param {string} [options.orderBy] - Custom ORDER BY clause.
 * @returns {Promise<Object>} - An object containing data, total records, page, and limit.
 */
async function fetchTableData(
    tableName,
    columns,
    { 
        search = '', 
        page = 1, 
        limit = 10, 
        customWhere = '', 
        customParams = [], 
        orderBy = ''
    }
) {
    // Sanitize and validate pagination parameters
    const safeLimit = Math.max(1, Math.min(1000, parseInt(limit) || 10)); // Cap at 1000 for safety
    const safePage = Math.max(1, parseInt(page) || 1);
    const safeOffset = (safePage - 1) * safeLimit;

    // Build WHERE clause for search
    const searchQuery = `%${search}%`;
    let searchClause = '';
    let searchParams = [];

    if (search) {
        searchClause = columns.map(column => `${column} LIKE ?`).join(' OR ');
        searchParams = Array(columns.length).fill(searchQuery);
    }

    // Combine searchClause and customWhere
    const whereClause = [searchClause, customWhere].filter(Boolean).join(search ? ' AND ' : '');

    // Combine all parameters (excluding LIMIT/OFFSET for MySQL 9.3.0 compatibility)
    const allParams = [...searchParams, ...customParams];

    // Query to fetch paginated data - using string interpolation for LIMIT/OFFSET
    const fetchQuery = `
        SELECT ${columns.join(', ')} 
        FROM ${tableName} 
        ${whereClause ? `WHERE ${whereClause}` : ''} 
        ${orderBy ? `ORDER BY ${orderBy}` : ''} 
        LIMIT ${safeLimit} OFFSET ${safeOffset}`;

    // Query to get total count
    const countQuery = `
        SELECT COUNT(*) as total 
        FROM ${tableName} 
        ${whereClause ? `WHERE ${whereClause}` : ''}`;

    try {
        const data = await executeQuery(fetchQuery, allParams);
        const countResult = await executeQuery(countQuery, allParams);
        const total = countResult[0]?.total || 0;

        return {
            success: true,
            data,
            total,
            page: safePage,
            limit: safeLimit,
        };
    } catch (error) {
        consoleLog('database', 'Error fetching table data', { 
            error: error.message, 
            tableName, 
            query: fetchQuery,
            params: allParams 
        });
        throw error;
    }
}

export {
    fetchTableData
};