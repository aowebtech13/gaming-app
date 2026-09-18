import response from "../utils/response.js";
import i18n from '../utils/i18n.js';

const adminAuthResponse = (req, res, next) => {
    // Check if user is logged in
    if (!req.session.user) {
        return response(res, 401, i18n.translateSync('api.middleware.auth_required', {}, req.language?.current || 'en'));
    }

    // Check if user is admin
    if (req.session.user.user_type !== 'admin') {
        return response(res, 403, i18n.translateSync('api.middleware.admin_access_required', {}, req.language?.current || 'en'));
    }

    // Check if user is active
    if (!req.session.user.is_active) {
        req.session.destroy();
        return response(res, 401, i18n.translateSync('api.middleware.account_inactive', {}, req.language?.current || 'en'));
    }

    next();
}

export default adminAuthResponse;