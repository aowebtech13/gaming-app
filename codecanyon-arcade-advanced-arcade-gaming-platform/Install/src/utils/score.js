import { submitGameScore, getGameLeaderboard, getUserBestScore, getUserRankInGame, updateScoreExpAwarded } from '../models/game_scores.js';
import { incrementPlayCount, getGameById } from '../models/games.js';
import { logExpEvent, getUserExpData, getLevelRequirements, updateUserExp } from '../models/exp.js';
import { consoleLog } from './logger.js';


// Calculate EXP reward based on score
const calculateScoreExp = (score, isPersonalBest = false) => {
    let exp = Math.floor(score * 0.1); // Base: 0.1 EXP per point
    
    // Cap the EXP to prevent abuse
    exp = Math.min(exp, 500);
    
    // Personal best bonus
    if (isPersonalBest) {
        exp += 100;
    }
    
    return Math.max(exp, 1); // Minimum 1 EXP
};

// Award EXP and handle level ups
const awardExp = async (userId, eventType, sourceId, expAmount, description) => {
    try {
        const userData = await getUserExpData(userId);
        if (!userData || userData.length === 0) {
            return { success: false, error: 'User not found' };
        }

        const user = userData[0];
        const newTotalExp = user.exp_points + expAmount;
        
        // Check for level up
        let newLevel = user.level;
        let leveledUp = false;
        
        while (true) {
            const nextLevelReq = await getLevelRequirements(newLevel + 1);
            if (!nextLevelReq || nextLevelReq.length === 0 || newTotalExp < nextLevelReq[0].exp_required) {
                break;
            }
            newLevel++;
            leveledUp = true;
        }
        
        // Update user EXP and level
        await updateUserExp(userId, newTotalExp, newLevel, expAmount);
        
        // Log the EXP event
        await logExpEvent(userId, eventType, expAmount, description, sourceId);
        
        return {
            success: true,
            expAwarded: expAmount,
            leveledUp,
            newLevel,
            totalExp: newTotalExp
        };
    } catch (error) {
        consoleLog('arcade-api', 'Error awarding EXP', { error: error.message, userId, expAmount });
        return { success: false, error: error.message };
    }
};

// Submit a score
const submitScore = async (userId, gameId, score, scoreData = {}) => {
    try {
        if (!userId || !gameId || score === undefined) {
            return { success: false, error: 'Missing required parameters' };
        }

        // Check if game exists and has API enabled
        const game = await getGameById(gameId);
        if (!game || game.length === 0) {
            return { success: false, error: 'Game not found' };
        }

        // Only check API enablement for HTML5 and embed games
        if ((game[0].game_type === 'html' || game[0].game_type === 'embed') && !game[0].api_enabled) {
            return { success: false, error: 'API not enabled for this game' };
        }

        // API not supported for non-HTML5/embed games
        if (game[0].game_type !== 'html' && game[0].game_type !== 'embed') {
            return { success: false, error: 'API only supported for HTML5 and embed games' };
        }

        // Validate score
        if (typeof score !== 'number' || score < 0) {
            return { success: false, error: 'Invalid score value' };
        }

        // Submit score
        const scoreResult = await submitGameScore(
            userId,
            gameId,
            score,
            scoreData
        );

        if (!scoreResult.success) {
            return scoreResult;
        }

        // Award EXP based on score
        const expAmount = calculateScoreExp(score, scoreResult.isPersonalBest);
        if (expAmount > 0) {
            await awardExp(userId, 'game_score', gameId, expAmount, 
                `Score of ${score} in game`);
            
            // Update the score record with EXP awarded
            await updateScoreExpAwarded(scoreResult.scoreId, expAmount);
            scoreResult.expAwarded = expAmount;
        }

        consoleLog('arcade-api', 'Score submitted', {
            userId,
            gameId,
            score,
            isPersonalBest: scoreResult.isPersonalBest
        });

        return {
            success: true,
            scoreId: scoreResult.scoreId,
            isPersonalBest: scoreResult.isPersonalBest,
            previousBest: scoreResult.previousBest,
            expAwarded: expAmount,
            message: scoreResult.isPersonalBest ? 'New personal best!' : 'Score submitted'
        };

    } catch (error) {
        consoleLog('arcade-api', 'Error submitting score', { 
            error: error.message, userId, gameId, score 
        });
        return { success: false, error: 'Internal server error' };
    }
};

// Get leaderboard for a game
const getLeaderboard = async (gameId, limit = 10) => {
    try {
        if (!gameId) {
            return { success: false, error: 'Game ID required' };
        }

        // Check if game exists and has API enabled
        const game = await getGameById(gameId);
        if (!game || game.length === 0) {
            return { success: false, error: 'Game not found' };
        }

        // Only check API enablement for HTML5 and embed games
        if ((game[0].game_type === 'html' || game[0].game_type === 'embed') && !game[0].api_enabled) {
            return { success: false, error: 'API not enabled for this game' };
        }

        // API not supported for non-HTML5/embed games
        if (game[0].game_type !== 'html' && game[0].game_type !== 'embed') {
            return { success: false, error: 'API only supported for HTML5 and embed games' };
        }

        const leaderboard = await getGameLeaderboard(gameId, limit);
        
        return {
            success: true,
            leaderboard: leaderboard,
            count: leaderboard.length
        };

    } catch (error) {
        consoleLog('arcade-api', 'Error fetching leaderboard', { 
            error: error.message, gameId 
        });
        return { success: false, error: 'Internal server error' };
    }
};

// Get user's best score for a game
const getUserBest = async (userId, gameId) => {
    try {
        if (!userId || !gameId) {
            return { success: false, error: 'Missing required parameters' };
        }

        const bestScore = await getUserBestScore(userId, gameId);
        const userRank = await getUserRankInGame(userId, gameId);
        
        return {
            success: true,
            bestScore: bestScore ? bestScore.high_score : 0,
            totalScores: bestScore ? bestScore.total_scores : 0,
            rank: userRank ? userRank.rank_position : null,
            totalPlayers: userRank ? userRank.total_players : 0
        };

    } catch (error) {
        consoleLog('arcade-api', 'Error fetching user best', { 
            error: error.message, userId, gameId 
        });
        return { success: false, error: 'Internal server error' };
    }
};


// Export all functions
export default {
    submitScore,
    getLeaderboard,
    getUserBest
};