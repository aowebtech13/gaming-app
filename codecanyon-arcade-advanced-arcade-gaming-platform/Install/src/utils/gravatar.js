import crypto from 'crypto';

/**
 * Generate Gravatar URL for given email
 * @param {string} email - User's email address
 * @param {number} size - Size of avatar in pixels (default: 80)
 * @param {string} defaultImage - Default image type (default: 'mp')
 * @param {string} rating - Image rating (g, pg, r, x) (default: 'g')
 * @returns {string} Gravatar URL
 */
const getGravatarUrl = (email, size = 80, defaultImage = 'mp', rating = 'g') => {
    if (!email || typeof email !== 'string') {
        return null;
    }

    // Create MD5 hash of email
    const trimmedEmail = email.trim().toLowerCase();
    const hash = crypto.createHash('md5').update(trimmedEmail).digest('hex');
    
    // Build Gravatar URL
    const params = new URLSearchParams({
        s: size.toString(),
        d: defaultImage,
        r: rating
    });
    
    return `https://www.gravatar.com/avatar/${hash}?${params.toString()}`;
};

/**
 * Get user avatar URL with Gravatar fallback
 * @param {Object} user - User object
 * @param {number} size - Size of avatar in pixels (default: 80)
 * @returns {string} Avatar URL
 */
const getUserAvatarUrl = (user, size = 80) => {
    // If user has uploaded avatar, use it
    if (user.avatar && user.avatar.trim() !== '') {
        return user.avatar;
    }
    
    // Otherwise use Gravatar
    if (user.email) {
        return getGravatarUrl(user.email, size);
    }
    
    // Final fallback to default image
    return '/assets/images/default-avatar.jpg';
};

export {
    getGravatarUrl,
    getUserAvatarUrl
};