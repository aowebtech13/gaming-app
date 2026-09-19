import { 
    getUserExpData, 
    updateUserExp, 
    logExpEvent, 
    hasEarnedExpToday,
    getExpSettings
} from '../models/exp.js';
import { getAllExpRanks } from '../models/exp_ranks.js';
import { consoleLog } from './logger.js';

// EXP event types
export const EXP_EVENTS = {
    GAME_COMPLETION: 'game_completion',
    DAILY_LOGIN: 'daily_login',
    FIRST_PLAY: 'first_play',
    GAME_RATING: 'game_rating',
    GAME_COMMENT: 'game_comment',
    FOLLOW_USER: 'follow_user',
    PROFILE_COMPLETE: 'profile_complete',
    LEVEL_UP: 'level_up',
    STREAK_BONUS: 'streak_bonus',
    CHATROOM_MESSAGE: 'chatroom_message',
    CHATROOM_SESSION: 'chatroom_session',
    SOCIAL_INTERACTION: 'social_interaction'
};

// Calculate user's current level based on EXP points
export const calculateLevel = async (expPoints) => {
    const expRanks = await getAllExpRanks();
    let currentLevel = 1;
    
    for (let i = expRanks.length - 1; i >= 0; i--) {
        if (expPoints >= expRanks[i].exp_required) {
            currentLevel = expRanks[i].level;
            break;
        }
    }
    
    return currentLevel;
};

// Get EXP required for next level
export const getExpForNextLevel = async (currentLevel) => {
    const expRanks = await getAllExpRanks();
    const nextLevelReq = expRanks.find(req => req.level === currentLevel + 1);
    return nextLevelReq ? nextLevelReq.exp_required : null;
};

// Calculate EXP progress to next level
export const getExpProgress = async (currentExp, currentLevel) => {
    const expRanks = await getAllExpRanks();
    const currentLevelReq = expRanks.find(req => req.level === currentLevel);
    const nextLevelReq = expRanks.find(req => req.level === currentLevel + 1);
    
    if (!nextLevelReq) {
        return { current: 0, required: 0, percentage: 100 }; // Max level
    }
    
    const currentLevelExp = currentLevelReq ? currentLevelReq.exp_required : 0;
    const nextLevelExp = nextLevelReq.exp_required;
    const progressExp = currentExp - currentLevelExp;
    const requiredExp = nextLevelExp - currentLevelExp;
    const percentage = Math.min(100, Math.max(0, (progressExp / requiredExp) * 100));
    
    return {
        current: progressExp,
        required: requiredExp,
        percentage: Math.round(percentage * 100) / 100
    };
};

// Check if it's weekend (for bonus multiplier)
export const isWeekend = () => {
    const day = new Date().getDay();
    return day === 0 || day === 6; // Sunday or Saturday
};

// Apply weekend multiplier to EXP
export const applyWeekendMultiplier = async (baseExp) => {
    if (!isWeekend()) return baseExp;
    
    const settings = await getExpSettings();
    const multiplier = parseFloat(settings.exp_multiplier_weekends || 1.0);
    return Math.round(baseExp * multiplier);
};

// Award EXP to user
export const awardExp = async (userId, eventType, baseAmount, description, sourceId = null, skipDuplicateCheck = false, req = null) => {
    try {
        // Check if user has already earned EXP for this action today (for certain event types)
        const dailyLimitEvents = [EXP_EVENTS.DAILY_LOGIN, EXP_EVENTS.FIRST_PLAY];
        if (!skipDuplicateCheck && dailyLimitEvents.includes(eventType)) {
            const hasEarned = await hasEarnedExpToday(userId, eventType, sourceId);
            if (hasEarned) {
                return { success: false, message: 'EXP already earned for this action today' };
            }
        }
        
        // Get user's current EXP data
        const userData = await getUserExpData(userId);
        if (!userData || userData.length === 0) {
            return { success: false, message: 'User not found' };
        }
        
        const user = userData[0];
        const currentExp = user.exp_points || 0;
        const currentLevel = user.level || 1;
        
        // Apply weekend multiplier
        const finalExpAmount = await applyWeekendMultiplier(baseAmount);
        
        // Calculate new EXP and level
        const newExp = currentExp + finalExpAmount;
        const newLevel = await calculateLevel(newExp);
        const leveledUp = newLevel > currentLevel;
        
        // Update user's EXP and level
        await updateUserExp(userId, newExp, newLevel, finalExpAmount);
        
        // Log the EXP event
        await logExpEvent(userId, eventType, finalExpAmount, description, sourceId);
        
        // If user leveled up, log level up event and award bonus EXP
        if (leveledUp) {
            const levelUpBonus = (newLevel - currentLevel) * 50; // 50 EXP per level gained
            await updateUserExp(userId, newExp + levelUpBonus, newLevel, levelUpBonus);
            await logExpEvent(userId, EXP_EVENTS.LEVEL_UP, levelUpBonus, `Rank up to ${newLevel}!`);
            
            // Send real-time level up notification
            try {
                const { notifyLevelUp } = await import('./websocket.js');
                notifyLevelUp(userId, {
                    oldLevel: currentLevel,
                    newLevel: newLevel,
                    expGained: finalExpAmount + levelUpBonus,
                    totalExp: newExp + levelUpBonus
                });
            } catch (error) {
                consoleLog('error', 'Error sending level up notification', { error });
            }
        }

        // Send real-time EXP gained notification (for non-level-up cases or always)
        try {
            const { notifyExpGained } = await import('./websocket.js');
            notifyExpGained(userId, {
                expGained: finalExpAmount,
                totalExp: newExp + (leveledUp ? (newLevel - currentLevel) * 50 : 0),
                source: eventType,
                description: description
            });
        } catch (error) {
            consoleLog('error', 'Error sending EXP gained notification', { error });
        }
        
        // Update session user data if request object is provided
        if (req && req.session && req.session.user && req.session.user.id === userId) {
            req.session.user.exp_points = newExp + (leveledUp ? (newLevel - currentLevel) * 50 : 0);
            req.session.user.level = newLevel;
            req.session.user.total_exp_earned = (req.session.user.total_exp_earned || 0) + finalExpAmount + (leveledUp ? (newLevel - currentLevel) * 50 : 0);
        }
        
        return {
            success: true,
            expGained: finalExpAmount,
            totalExp: newExp + (leveledUp ? (newLevel - currentLevel) * 50 : 0),
            oldLevel: currentLevel,
            newLevel: newLevel,
            leveledUp: leveledUp,
            message: leveledUp ? `Gained ${finalExpAmount} EXP and ranked up to ${newLevel}!` : `Gained ${finalExpAmount} EXP`
        };
        
    } catch (error) {
        consoleLog('error', 'Error awarding EXP', { error });
        return { success: false, message: 'Failed to award EXP' };
    }
};

// Get EXP amount for specific event type
export const getExpAmountForEvent = async (eventType) => {
    const settings = await getExpSettings();
    const expAmounts = {
        [EXP_EVENTS.GAME_COMPLETION]: parseInt(settings.exp_game_completion || 50),
        [EXP_EVENTS.DAILY_LOGIN]: parseInt(settings.exp_daily_login || 10),
        [EXP_EVENTS.FIRST_PLAY]: parseInt(settings.exp_first_play || 25),
        [EXP_EVENTS.GAME_RATING]: parseInt(settings.exp_game_rating || 5),
        [EXP_EVENTS.GAME_COMMENT]: parseInt(settings.exp_game_comment || 3),
        [EXP_EVENTS.FOLLOW_USER]: parseInt(settings.exp_follow_user || 2),
        [EXP_EVENTS.PROFILE_COMPLETE]: parseInt(settings.exp_profile_complete || 20)
    };
    
    return expAmounts[eventType] || 0;
};


// Award EXP for daily login
export const awardDailyLoginExp = async (userId, req = null) => {
    const baseAmount = await getExpAmountForEvent(EXP_EVENTS.DAILY_LOGIN);
    return await awardExp(
        userId, 
        EXP_EVENTS.DAILY_LOGIN, 
        baseAmount, 
        'Daily login bonus',
        null,
        false,
        req
    );
};

// Award EXP for first time playing a game
export const awardFirstPlayExp = async (userId, gameId, gameTitle, req = null) => {
    const baseAmount = await getExpAmountForEvent(EXP_EVENTS.FIRST_PLAY);
    return await awardExp(
        userId, 
        EXP_EVENTS.FIRST_PLAY, 
        baseAmount, 
        `First time playing: ${gameTitle}`, 
        gameId,
        false,
        req
    );
};

// Award EXP for rating a game
export const awardGameRatingExp = async (userId, gameId, gameTitle, req = null) => {
    const baseAmount = await getExpAmountForEvent(EXP_EVENTS.GAME_RATING);
    return await awardExp(
        userId, 
        EXP_EVENTS.GAME_RATING, 
        baseAmount, 
        `Rated game: ${gameTitle}`, 
        gameId,
        false,
        req
    );
};

// Award EXP for commenting on a game
export const awardGameCommentExp = async (userId, gameId, gameTitle, req = null) => {
    const baseAmount = await getExpAmountForEvent(EXP_EVENTS.GAME_COMMENT);
    return await awardExp(
        userId, 
        EXP_EVENTS.GAME_COMMENT, 
        baseAmount, 
        `Commented on: ${gameTitle}`, 
        gameId,
        false,
        req
    );
};

// Award EXP for following a user
export const awardFollowUserExp = async (userId, followedUserId, followedUsername, req = null) => {
    const baseAmount = await getExpAmountForEvent(EXP_EVENTS.FOLLOW_USER);
    return await awardExp(
        userId, 
        EXP_EVENTS.FOLLOW_USER, 
        baseAmount, 
        `Followed user: ${followedUsername}`, 
        followedUserId,
        false,
        req
    );
};

// Award EXP for completing profile
export const awardProfileCompleteExp = async (userId, req = null) => {
    const baseAmount = await getExpAmountForEvent(EXP_EVENTS.PROFILE_COMPLETE);
    return await awardExp(
        userId, 
        EXP_EVENTS.PROFILE_COMPLETE, 
        baseAmount, 
        'Completed profile information',
        null,
        false,
        req
    );
};

// Award EXP for chatroom message
export const awardChatroomMessageExp = async (userId, req = null) => {
    const baseAmount = 1; // Small amount for each message to prevent spam
    return await awardExp(
        userId, 
        EXP_EVENTS.CHATROOM_MESSAGE, 
        baseAmount, 
        'Chatroom participation',
        null,
        false,
        req
    );
};

// Award EXP for chatroom session (every 5 minutes)
export const awardChatroomSessionExp = async (userId, req = null) => {
    const baseAmount = 5; // 5 EXP per 5-minute session
    return await awardExp(
        userId, 
        EXP_EVENTS.CHATROOM_SESSION, 
        baseAmount, 
        'Active chatroom participation',
        null,
        false,
        req
    );
};

// Award EXP for social interactions (emotes, animations)
export const awardSocialInteractionExp = async (userId, interaction, req = null) => {
    const baseAmount = 2; // Small amount for social interactions
    return await awardExp(
        userId, 
        EXP_EVENTS.SOCIAL_INTERACTION, 
        baseAmount, 
        `Social interaction: ${interaction}`,
        null,
        false,
        req
    );
};

// Format EXP number for display
export const formatExp = (exp) => {
    if (exp >= 1000000) {
        return (exp / 1000000).toFixed(1) + 'M';
    } else if (exp >= 1000) {
        return (exp / 1000).toFixed(1) + 'K';
    }
    return exp.toString();
};

// Get level title/name
export const getLevelTitle = async (level) => {
    const expRanks = await getAllExpRanks();
    const levelData = expRanks.find(req => req.level === level);
    let title = levelData?.reward_title || `Rank ${level}`;
    
    // Don't use "Welcome!" for lowest rank - use "Gamer" instead
    if (title === 'Welcome!') {
        title = 'Gamer';
    }
    
    return title;
};

export default {
    EXP_EVENTS,
    calculateLevel,
    getExpForNextLevel,
    getExpProgress,
    awardExp,
    awardDailyLoginExp,
    awardFirstPlayExp,
    awardGameRatingExp,
    awardGameCommentExp,
    awardFollowUserExp,
    awardProfileCompleteExp,
    awardChatroomMessageExp,
    awardChatroomSessionExp,
    awardSocialInteractionExp,
    formatExp,
    getLevelTitle
};