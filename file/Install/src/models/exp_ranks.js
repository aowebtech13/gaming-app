import executeQuery from "../utils/mysql.js";

const getExpRankById = async (id) => {
    return await executeQuery("SELECT * FROM exp_ranks WHERE id = ? LIMIT 1", [id]);
}

const getExpRankByLevel = async (level) => {
    return await executeQuery("SELECT * FROM exp_ranks WHERE level = ? LIMIT 1", [level]);
}

const getAllExpRanks = async () => {
    return await executeQuery("SELECT * FROM exp_ranks ORDER BY level ASC", []);
}

export {
    getExpRankById,
    getExpRankByLevel,
    getAllExpRanks
}