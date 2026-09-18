import executeQuery from "../utils/mysql.js";

const getFavoriteById = async (id) => {
    const data = await executeQuery("SELECT * FROM favorites WHERE id = ? LIMIT 1", [id]);
    return data;
}

const getUserFavorites = async (userId) => {
    const data = await executeQuery("SELECT f.*, g.slug, g.title, g.thumbnail FROM favorites f LEFT JOIN games g ON f.game_id = g.id WHERE f.user_id = ?", [userId]);
    return data;
}

const checkIfFavorite = async (userId, gameId) => {
    const data = await executeQuery("SELECT id FROM favorites WHERE user_id = ? AND game_id = ? LIMIT 1", [userId, gameId]);
    return data;
}

const addFavorite = async (userId, gameId) => {
    const data = await executeQuery("INSERT INTO favorites (user_id, game_id) VALUES (?, ?)", [userId, gameId]);
    return data;
}

const removeFavorite = async (userId, gameId) => {
    const data = await executeQuery("DELETE FROM favorites WHERE user_id = ? AND game_id = ?", [userId, gameId]);
    return data;
}

export {
    getFavoriteById,
    getUserFavorites,
    checkIfFavorite,
    addFavorite,
    removeFavorite
}