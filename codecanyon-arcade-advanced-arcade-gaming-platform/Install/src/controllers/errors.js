import i18n from '../utils/i18n.js';

const notfound = (req, res) => {
    const pageData = {
        page: "errors",
        title: "404",
        description: i18n.translateSync('errors.page_not_found', {}, req.language?.current || 'en')
    };

    res.render("pages/errors/404", pageData);
};

const invalid = (req, res) => {
    const pageData = {
        page: "errors",
        title: "401",
        description: i18n.translateSync('errors.unauthorized', {}, req.language?.current || 'en')
    };

    res.render("pages/errors/401", pageData);
};

const system = (req, res) => {
    const pageData = {
        page: "errors",
        title: "400",
        description: i18n.translateSync('errors.invalid_request', {}, req.language?.current || 'en')
    };

    res.render("pages/errors/400", pageData);
};

const denied = (req, res) => {
    const pageData = {
        page: "errors",
        title: "402",
        description: i18n.translateSync('errors.access_denied', {}, req.language?.current || 'en')
    };

    res.render("pages/errors/402", pageData);
};

const server = (req, res) => {
    const pageData = {
        page: "errors",
        title: "500",
        description: i18n.translateSync('errors.server_error', {}, req.language?.current || 'en')
    };

    res.render("pages/errors/500", pageData);
};

export {
    notfound,
    invalid,
    system,
    denied,
    server
}