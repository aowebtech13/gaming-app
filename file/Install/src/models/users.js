import executeQuery from "../utils/mysql.js";
import { getUserAvatarUrl } from "../utils/gravatar.js";
import bcrypt from 'bcrypt';

const getUserById = async (id) => {
    const data = await executeQuery("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
    if (data && data.length > 0) {
        data[0].avatarUrl = getUserAvatarUrl(data[0]);
        // Ensure EXP fields have default values
        data[0].level = data[0].level || 1;
        data[0].exp_points = data[0].exp_points || 0;
        data[0].total_exp_earned = data[0].total_exp_earned || 0;
        // Ensure chatroom fields have default values - parse text coordinates to numbers
        const parsedX = data[0].chatroom_last_x ? parseFloat(data[0].chatroom_last_x) : 0;
        const parsedZ = data[0].chatroom_last_z ? parseFloat(data[0].chatroom_last_z) : 0;
        data[0].chatroom_last_x = isNaN(parsedX) ? 0 : parsedX;
        data[0].chatroom_last_z = isNaN(parsedZ) ? 0 : parsedZ;
    }
    return data;
}

const getUserByEmail = async (email) => {
    const data = await executeQuery("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
    if (data && data.length > 0) {
        data[0].avatarUrl = getUserAvatarUrl(data[0]);
        // Ensure EXP fields have default values
        data[0].level = data[0].level || 1;
        data[0].exp_points = data[0].exp_points || 0;
        data[0].total_exp_earned = data[0].total_exp_earned || 0;
        // Ensure chatroom fields have default values - parse text coordinates to numbers
        const parsedX = data[0].chatroom_last_x ? parseFloat(data[0].chatroom_last_x) : 0;
        const parsedZ = data[0].chatroom_last_z ? parseFloat(data[0].chatroom_last_z) : 0;
        data[0].chatroom_last_x = isNaN(parsedX) ? 0 : parsedX;
        data[0].chatroom_last_z = isNaN(parsedZ) ? 0 : parsedZ;
    }
    return data;
}

const getUserByUsername = async (username) => {
    const data = await executeQuery("SELECT * FROM users WHERE username = ? LIMIT 1", [username]);
    if (data && data.length > 0) {
        data[0].avatarUrl = getUserAvatarUrl(data[0]);
        // Ensure EXP fields have default values
        data[0].level = data[0].level || 1;
        data[0].exp_points = data[0].exp_points || 0;
        data[0].total_exp_earned = data[0].total_exp_earned || 0;
        // Ensure chatroom fields have default values - parse text coordinates to numbers
        const parsedX = data[0].chatroom_last_x ? parseFloat(data[0].chatroom_last_x) : 0;
        const parsedZ = data[0].chatroom_last_z ? parseFloat(data[0].chatroom_last_z) : 0;
        data[0].chatroom_last_x = isNaN(parsedX) ? 0 : parsedX;
        data[0].chatroom_last_z = isNaN(parsedZ) ? 0 : parsedZ;
    }
    return data;
}

const getUserByUsernameOrEmail = async (usernameOrEmail) => {
    const data = await executeQuery("SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1", [usernameOrEmail, usernameOrEmail]);
    if (data && data.length > 0) {
        data[0].avatarUrl = getUserAvatarUrl(data[0]);
        // Ensure EXP fields have default values
        data[0].level = data[0].level || 1;
        data[0].exp_points = data[0].exp_points || 0;
        data[0].total_exp_earned = data[0].total_exp_earned || 0;
        // Ensure chatroom fields have default values - parse text coordinates to numbers
        const parsedX = data[0].chatroom_last_x ? parseFloat(data[0].chatroom_last_x) : 0;
        const parsedZ = data[0].chatroom_last_z ? parseFloat(data[0].chatroom_last_z) : 0;
        data[0].chatroom_last_x = isNaN(parsedX) ? 0 : parsedX;
        data[0].chatroom_last_z = isNaN(parsedZ) ? 0 : parsedZ;
    }
    return data;
}

const updateLastLogin = async (userId) => {
    return await executeQuery("UPDATE users SET last_login = NOW() WHERE id = ?", [userId]);
}

const checkUserExists = async (username, email) => {
    return await executeQuery("SELECT id, username, email FROM users WHERE username = ? OR email = ?", [username, email]);
}

const createUser = async (userData) => {
    try {
        const { 
            username, 
            email, 
            password, 
            first_name, 
            last_name,
            user_type = 'user',
            is_verified = 0,
            oauth_provider = null,
            oauth_avatar = null,
            language_preference = null
        } = userData;
        
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        const result = await executeQuery(
            "INSERT INTO users (username, email, password, first_name, last_name, user_type, is_active, is_verified, oauth_provider, oauth_avatar, language_preference, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, NOW())",
            [username, email, hashedPassword, first_name, last_name, user_type, is_verified, oauth_provider, oauth_avatar, language_preference]
        );
        
        return {
            success: true,
            userId: result.insertId,
            message: 'User created successfully'
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

const getAllUsers = async () => {
    const data = await executeQuery("SELECT id, username, first_name, last_name, email, user_type, is_active, created_at, updated_at FROM users ORDER BY created_at DESC", []);
    return data.map(user => {
        user.avatarUrl = getUserAvatarUrl(user);
        user.level = user.level || 1;
        user.exp_points = user.exp_points || 0;
        user.total_exp_earned = user.total_exp_earned || 0;
        const parsedX = user.chatroom_last_x ? parseFloat(user.chatroom_last_x) : 0;
        const parsedZ = user.chatroom_last_z ? parseFloat(user.chatroom_last_z) : 0;
        user.chatroom_last_x = isNaN(parsedX) ? 0 : parsedX;
        user.chatroom_last_z = isNaN(parsedZ) ? 0 : parsedZ;
        return user;
    });
}

const updateUserPassword = async (userId, newPassword) => {
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    return await executeQuery(
        "UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?",
        [hashedPassword, userId]
    );
}

const updateChatroomPosition = async (userId, x, z) => {
    return await executeQuery(
        "UPDATE users SET chatroom_last_x = ?, chatroom_last_z = ?, chatroom_last_visit = NOW() WHERE id = ?",
        [x, z, userId]
    );
}

const updateChatroomCharacter = async (userId, character) => {
    return await executeQuery(
        "UPDATE users SET chatroom_character = ? WHERE id = ?",
        [character, userId]
    );
}

const getChatroomUsers = async () => {
    return await executeQuery(
        "SELECT id, username, chatroom_character, chatroom_last_x, chatroom_last_z, chatroom_last_visit FROM users WHERE chatroom_last_visit IS NOT NULL ORDER BY chatroom_last_visit DESC",
        []
    );
}

const autoVerifyAllUsers = async () => {
    const result = await executeQuery(
        "UPDATE users SET is_verified = 1, updated_at = NOW() WHERE is_verified = 0 AND oauth_provider IS NULL",
        []
    );
    return result;
};

const verifyUserById = async (userId) => {
    const result = await executeQuery(
        "UPDATE users SET is_verified = 1 WHERE id = ?",
        [userId]
    );
    return result;
};

const updateUserVerificationStatus = async (userId) => {
    const result = await executeQuery(
        "UPDATE users SET is_verified = 1, updated_at = NOW() WHERE id = ?",
        [userId]
    );
    return result;
};

const getRecentChatroomActivity = async (limit = 5) => {
    return await executeQuery(`
        SELECT username, chatroom_last_visit 
        FROM users 
        WHERE chatroom_last_visit IS NOT NULL 
        AND chatroom_last_visit > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        ORDER BY chatroom_last_visit DESC 
        LIMIT ?
    `, [limit]);
};

const updateUserLanguagePreference = async (userId, languageCode) => {
    const result = await executeQuery(
        "UPDATE users SET language_preference = ?, updated_at = NOW() WHERE id = ?",
        [languageCode, userId]
    );
    return result;
};

const getUserLanguagePreference = async (userId) => {
    const result = await executeQuery(
        "SELECT language_preference FROM users WHERE id = ?",
        [userId]
    );
    return result.length > 0 ? result[0].language_preference : null;
};

const updateUserProfile = async (userId, updateData) => {
    const fields = [];
    const values = [];
    
    // Build dynamic query based on provided fields
    if (updateData.username !== undefined) {
        fields.push('username = ?');
        values.push(updateData.username);
    }
    if (updateData.email !== undefined) {
        fields.push('email = ?');
        values.push(updateData.email);
    }
    if (updateData.first_name !== undefined) {
        fields.push('first_name = ?');
        values.push(updateData.first_name);
    }
    if (updateData.last_name !== undefined) {
        fields.push('last_name = ?');
        values.push(updateData.last_name);
    }
    if (updateData.avatar !== undefined) {
        fields.push('avatar = ?');
        values.push(updateData.avatar);
    }
    if (updateData.bio !== undefined) {
        fields.push('bio = ?');
        values.push(updateData.bio);
    }
    if (updateData.country !== undefined) {
        fields.push('country = ?');
        values.push(updateData.country);
    }
    if (updateData.date_of_birth !== undefined) {
        fields.push('date_of_birth = ?');
        values.push(updateData.date_of_birth);
    }
    
    if (fields.length === 0) {
        throw new Error('No fields to update');
    }
    
    // Always update the updated_at timestamp
    fields.push('updated_at = NOW()');
    values.push(userId);
    
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    
    const result = await executeQuery(query, values);
    return result;
};

const updateUserAvatar = async (userId, avatarUrl) => {
    const result = await executeQuery(
        "UPDATE users SET avatar = ?, updated_at = NOW() WHERE id = ?",
        [avatarUrl, userId]
    );
    return result;
};

const removeUserAvatar = async (userId) => {
    const result = await executeQuery(
        "UPDATE users SET avatar = NULL, updated_at = NOW() WHERE id = ?",
        [userId]
    );
    return result;
};

export {
    getUserById,
    getUserByEmail,
    getUserByUsername,
    getUserByUsernameOrEmail,
    updateLastLogin,
    checkUserExists,
    createUser,
    getAllUsers,
    updateUserPassword,
    updateChatroomPosition,
    updateChatroomCharacter,
    getChatroomUsers,
    autoVerifyAllUsers,
    verifyUserById,
    updateUserVerificationStatus,
    getRecentChatroomActivity,
    updateUserLanguagePreference,
    getUserLanguagePreference,
    updateUserProfile,
    updateUserAvatar,
    removeUserAvatar
}