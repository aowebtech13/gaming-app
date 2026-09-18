import executeQuery from "../utils/mysql.js";
import { consoleLog } from "../utils/logger.js";

const create = async (table, data) => {
    try {
        const keys = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data);

        const query = `INSERT INTO \`${table}\` (${keys}) VALUES (${placeholders})`;
        const result = await executeQuery(query, values);

        return result.insertId; // Return last insert ID
    } catch (err) {
        consoleLog('database', `Database create operation error: ${err.message}`);
        return false;
    }
};

const update = async (id, username, table, data) => {
    try {
        const setClause = Object.keys(data).map(key => `\`${key}\` = ?`).join(', ');
        const values = Object.values(data);

        let query = `UPDATE \`${table}\` SET ${setClause} WHERE 1=1`;

        if (id) {
            query += ` AND id = ?`;
            values.push(id);
        }

        if (username) {
            query += ` AND username = ?`;
            values.push(username);
        }

        const result = await executeQuery(query, values);
        return result.affectedRows; // Return number of rows updated
    } catch (err) {
        consoleLog('database', `Database update operation error: ${err.message}`);
        return false;
    }
};

const remove = async (id, uid, table, customArray = {}) => {
    try {
        let query = `DELETE FROM \`${table}\` WHERE 1=1`;
        const values = [];

        if (id) {
            query += ` AND id = ?`;
            values.push(id);
        }

        if (uid) {
            query += ` AND uid = ?`;
            values.push(uid);
        }

        for (const [key, value] of Object.entries(customArray)) {
            query += ` AND \`${key}\` = ?`;
            values.push(value);
        }

        const result = await executeQuery(query, values);
        return result.affectedRows; // Return number of rows deleted
    } catch (err) {
        consoleLog('database', `Database delete operation error: ${err.message}`);
        return false;
    }
};

export { 
    create, 
    update, 
    remove 
};