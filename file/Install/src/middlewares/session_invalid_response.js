import response from "../utils/response.js";
import i18n from '../utils/i18n.js';

const session = (req, res, next) => {
    if (!req.session.user) {
        return response(res, 500, i18n.translateSync('api.middleware.invalid_request', {}, req.language?.current || 'en'));
    }

    next();
}

export default session;
