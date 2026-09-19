import executeQuery from "../utils/mysql.js";
import { consoleLog } from '../utils/logger.js';

const submitGameScore = async (userId, gameId, score, scoreData = {}) => {
    try {
        const scoreDataJson = JSON.stringify(scoreData);
        
        // Check if this is a personal best
        const currentBest = await getUserBestScore(userId, gameId);
        const isPersonalBest = !currentBest || score > currentBest.high_score;
        
        // Handle TEXT field defaults in application code as per database rules
        const scoreType = scoreData.mode || 'points';
        const isVerified = 1; // Default verified
        const expAwarded = 0; // Default exp (will be updated by arcade-api)
        
        // Insert the score
        const result = await executeQuery(
            `INSERT INTO game_scores (user_id, game_id, score, score_type, score_data, is_personal_best, is_verified, exp_awarded) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, gameId, score, scoreType, scoreDataJson, isPersonalBest ? 1 : 0, isVerified, expAwarded]
        );
        
        if (result && result.insertId) {
            // Update leaderboard
            await updateLeaderboard(gameId, userId, score);
            
            // If personal best, mark previous scores as not personal best
            if (isPersonalBest && currentBest) {
                await executeQuery(
                    `UPDATE game_scores SET is_personal_best = 0 
                     WHERE user_id = ? AND game_id = ? AND id != ?`,
                    [userId, gameId, result.insertId]
                );
            }
            
            return {
                scoreId: result.insertId,
                isPersonalBest: isPersonalBest,
                previousBest: currentBest ? currentBest.high_score : 0,
                success: true
            };
        }
        
        return { success: false, error: 'Failed to submit score' };
    } catch (error) {
        consoleLog('database', 'Error submitting game score', { 
            error: error.message, userId, gameId, score 
        });
        return { success: false, error: error.message };
    }
};

const getUserBestScore = async (userId, gameId) => {
    try {
        const data = await executeQuery(
            `SELECT MAX(score) as high_score, COUNT(*) as total_scores,
                    MIN(achieved_at) as first_score, MAX(achieved_at) as last_score
             FROM game_scores 
             WHERE user_id = ? AND game_id = ? AND is_verified = 1`,
            [userId, gameId]
        );
        
        return data && data.length > 0 && data[0].high_score ? data[0] : null;
    } catch (error) {
        consoleLog('database', 'Error fetching user best score', { error: error.message, userId, gameId });
        return null;
    }
};

const getGameLeaderboard = async (gameId, limit = 10) => {
    try {
        const data = await executeQuery(
            `SELECT l.rank_position, l.username, l.high_score, l.score_count,
                    l.first_score_date, l.last_score_date, u.avatar, u.level
             FROM game_leaderboards l
             LEFT JOIN users u ON l.user_id = u.id
             WHERE l.game_id = ? 
             ORDER BY l.rank_position ASC 
             LIMIT ?`,
            [gameId, limit]
        );
        
        return data || [];
    } catch (error) {
        consoleLog('database', 'Error fetching game leaderboard', { error: error.message, gameId });
        return [];
    }
};

const updateLeaderboard = async (gameId, userId, newScore) => {
    try {
        // Get user info
        const userInfo = await executeQuery(
            "SELECT username FROM users WHERE id = ? LIMIT 1",
            [userId]
        );
        
        if (!userInfo || userInfo.length === 0) {
            return { success: false, error: 'User not found' };
        }
        
        const username = userInfo[0].username;
        
        // Check if user already has a leaderboard entry
        const existing = await executeQuery(
            "SELECT * FROM game_leaderboards WHERE game_id = ? AND user_id = ? LIMIT 1",
            [gameId, userId]
        );
        
        if (existing && existing.length > 0) {
            // Update existing entry if new score is better
            if (newScore > existing[0].high_score) {
                await executeQuery(
                    `UPDATE game_leaderboards 
                     SET high_score = ?, score_count = score_count + 1, 
                         last_score_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                     WHERE game_id = ? AND user_id = ?`,
                    [newScore, gameId, userId]
                );
            } else {
                // Just increment score count
                await executeQuery(
                    `UPDATE game_leaderboards 
                     SET score_count = score_count + 1, last_score_date = CURRENT_TIMESTAMP, 
                         updated_at = CURRENT_TIMESTAMP
                     WHERE game_id = ? AND user_id = ?`,
                    [gameId, userId]
                );
            }
        } else {
            // Insert new leaderboard entry
            await executeQuery(
                `INSERT INTO game_leaderboards 
                 (game_id, user_id, username, high_score, score_count, first_score_date, last_score_date) 
                 VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [gameId, userId, username, newScore]
            );
        }
        
        // Update rank positions
        await updateRankPositions(gameId);
        
        return { success: true };
    } catch (error) {
        consoleLog('database', 'Error updating leaderboard', { 
            error: error.message, gameId, userId, newScore 
        });
        return { success: false, error: error.message };
    }
};

const updateRankPositions = async (gameId) => {
    try {
        // Get all users for this game ordered by high score
        const users = await executeQuery(
            `SELECT id, user_id, high_score 
             FROM game_leaderboards 
             WHERE game_id = ? 
             ORDER BY high_score DESC, first_score_date ASC`,
            [gameId]
        );
        
        // Update rank positions
        for (let i = 0; i < users.length; i++) {
            await executeQuery(
                "UPDATE game_leaderboards SET rank_position = ? WHERE id = ?",
                [i + 1, users[i].id]
            );
        }
        
        return { success: true };
    } catch (error) {
        consoleLog('database', 'Error updating rank positions', { error: error.message, gameId });
        return { success: false, error: error.message };
    }
};

const getUserScoreHistory = async (userId, gameId, limit = 20) => {
    try {
        const data = await executeQuery(
            `SELECT score, score_data, is_personal_best, achieved_at, exp_awarded
             FROM game_scores
             WHERE user_id = ? AND game_id = ? AND is_verified = 1
             ORDER BY achieved_at DESC
             LIMIT ?`,
            [userId, gameId, limit]
        );
        
        return data || [];
    } catch (error) {
        consoleLog('database', 'Error fetching user score history', { 
            error: error.message, userId, gameId 
        });
        return [];
    }
};

const getGameScoreStats = async (gameId) => {
    try {
        const data = await executeQuery(
            `SELECT 
                COUNT(*) as total_scores,
                COUNT(DISTINCT user_id) as unique_players,
                MAX(score) as highest_score,
                AVG(score) as average_score,
                MIN(achieved_at) as first_score_date,
                MAX(achieved_at) as last_score_date
             FROM game_scores 
             WHERE game_id = ? AND is_verified = 1`,
            [gameId]
        );
        
        return data && data.length > 0 ? data[0] : null;
    } catch (error) {
        consoleLog('database', 'Error fetching game score stats', { error: error.message, gameId });
        return null;
    }
};

const getUserRankInGame = async (userId, gameId) => {
    try {
        const data = await executeQuery(
            `SELECT rank_position, high_score, 
                    (SELECT COUNT(*) FROM game_leaderboards WHERE game_id = ?) as total_players
             FROM game_leaderboards 
             WHERE game_id = ? AND user_id = ? 
             LIMIT 1`,
            [gameId, gameId, userId]
        );
        
        return data && data.length > 0 ? data[0] : null;
    } catch (error) {
        consoleLog('database', 'Error fetching user rank', { error: error.message, userId, gameId });
        return null;
    }
};

const updateScoreExpAwarded = async (scoreId, expAwarded) => {
    try {
        const result = await executeQuery(
            "UPDATE game_scores SET exp_awarded = ? WHERE id = ?",
            [expAwarded, scoreId]
        );
        
        return { success: true, affectedRows: result.affectedRows };
    } catch (error) {
        consoleLog('database', 'Error updating score exp awarded', { error: error.message, scoreId, expAwarded });
        return { success: false, error: error.message };
    }
};

const getScoreById = async (id) => {
    try {
        const data = await executeQuery(`
            SELECT 
                gs.id,
                gs.user_id,
                gs.game_id,
                gs.score,
                gs.score_type,
                gs.score_data,
                gs.is_personal_best,
                gs.is_verified,
                gs.achieved_at,
                gs.exp_awarded,
                u.username,
                g.title as game_title
            FROM game_scores gs
            LEFT JOIN users u ON gs.user_id = u.id
            LEFT JOIN games g ON gs.game_id = g.id
            WHERE gs.id = ?
            LIMIT 1
        `, [id]);
        
        return data || [];
    } catch (error) {
        consoleLog('database', 'Error fetching score by ID', { error: error.message, id });
        return [];
    }
};

export {
    submitGameScore,
    getUserBestScore,
    getGameLeaderboard,
    updateLeaderboard,
    getUserScoreHistory,
    getGameScoreStats,
    getUserRankInGame,
    updateScoreExpAwarded,
    getScoreById
};