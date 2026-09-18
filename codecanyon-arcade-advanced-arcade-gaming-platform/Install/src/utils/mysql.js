import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { consoleLog } from './logger.js';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT)
});

async function executeQuery(query, params) {
  try {
    // Use pool.query instead of pool.execute to avoid prepared statement issues
    const [results] = await pool.query(query, params);
    return results;
  } catch (error) {
    throw error;
  }
}

// Graceful shutdown function for the connection pool
async function closePool() {
  try {
    await pool.end();
    consoleLog('database', 'MySQL connection pool closed gracefully');
  } catch (error) {
    consoleLog('error', 'Error closing MySQL connection pool: ' + JSON.stringify(error));
  }
}

// Export both the query function and cleanup function
export default executeQuery;
export { closePool, pool };
