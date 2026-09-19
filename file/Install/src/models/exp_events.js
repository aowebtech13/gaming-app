import executeQuery from "../utils/mysql.js";

const getExpEventById = async (id) => {
    return await executeQuery("SELECT * FROM exp_events WHERE id = ? LIMIT 1", [id]);
}

const getAllExpEvents = async () => {
    return await executeQuery(`
        SELECT e.*, u.username 
        FROM exp_events e 
        LEFT JOIN users u ON e.user_id = u.id 
        ORDER BY e.created_at DESC
    `, []);
}

const getExpEventsByUserId = async (userId) => {
    return await executeQuery(`
        SELECT e.*, u.username 
        FROM exp_events e 
        LEFT JOIN users u ON e.user_id = u.id 
        WHERE e.user_id = ? 
        ORDER BY e.created_at DESC
    `, [userId]);
}

const getExpEventsByType = async (eventType) => {
    return await executeQuery(`
        SELECT e.*, u.username 
        FROM exp_events e 
        LEFT JOIN users u ON e.user_id = u.id 
        WHERE e.event_type = ? 
        ORDER BY e.created_at DESC
    `, [eventType]);
}

export {
    getExpEventById,
    getAllExpEvents,
    getExpEventsByUserId,
    getExpEventsByType
}