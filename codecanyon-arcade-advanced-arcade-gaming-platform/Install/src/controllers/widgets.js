import response from "../utils/response.js";
import i18n from '../utils/i18n.js';
import {
    getUserById
} from "../models/users.js";
import {
    getGameById
} from "../models/games.js";
import {
    getCategoryById,
    getAllActiveCategories
} from "../models/categories.js";
import {
    getFavoriteById
} from "../models/favorites.js";
import {
    getSettingsAsObject
} from "../models/settings.js";
import {
    getAllCountries
} from "../utils/countries.js";
import {
    getCommentById
} from "../models/comments.js";
import {
    getPageById
} from "../models/pages.js";
import {
    getExpRankById
} from "../models/exp_ranks.js";
import {
    getSetting
} from "../models/settings.js";
import {
    getPlacementById
} from "../models/ad_placements.js";
import {
    getAdById
} from "../models/ads.js";
import {
    getAllPlacements
} from "../models/ad_placements.js";

const create = async (req, res) => {
    const { modalTemplate } = req.params;

    let vars;

    switch (modalTemplate) {
        case "users":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.add_user', {}, req.language?.current || 'en'),
                    data: {
                        countries: getAllCountries()
                    }
                },
                handler: {
                    tpl: "users",
                    type: "create",
                    size: "lg",
                    loader: i18n.translateSync('api.widgets.processing_request', {}, req.language?.current || 'en'),
                    require: "username|Username<=>email|Email<=>password_hash|Password"
                },
            };

            break;
        case "games":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            const categories = await getAllActiveCategories();

            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.add_game', {}, req.language?.current || 'en'),
                    data: {
                        categories: categories
                    }
                },
                handler: {
                    tpl: "games",
                    type: "create",
                    size: "xl",
                    loader: i18n.translateSync('api.widgets.processing_request', {}, req.language?.current || 'en'),
                    require: "title|Title<=>category_id|Category<=>game_type|Game Type"
                },
            };

            break;
        case "categories":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.add_category', {}, req.language?.current || 'en'),
                    data: {}
                },
                handler: {
                    tpl: "categories",
                    type: "create",
                    size: "lg",
                    loader: i18n.translateSync('api.widgets.processing_request', {}, req.language?.current || 'en'),
                    require: "name|Name"
                },
            };

            break;
        case "pages":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.add_page', {}, req.language?.current || 'en'),
                    data: {}
                },
                handler: {
                    tpl: "pages",
                    type: "create",
                    size: "xl",
                    loader: i18n.translateSync('api.widgets.processing_request', {}, req.language?.current || 'en'),
                    require: "title|Title<=>content|Content"
                },
            };

            break;
        case "exp_ranks":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.add_exp_rank', {}, req.language?.current || 'en'),
                    data: {}
                },
                handler: {
                    tpl: "exp_ranks",
                    type: "create",
                    size: "lg",
                    loader: i18n.translateSync('api.widgets.processing_request', {}, req.language?.current || 'en'),
                    require: "level|Level<=>exp_required|EXP Required"
                },
            };

            break;
        case "ad_placements":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.add_ad_placement', {}, req.language?.current || 'en'),
                    data: {}
                },
                handler: {
                    tpl: "ad_placements",
                    type: "create",
                    size: "lg",
                    loader: i18n.translateSync('api.widgets.processing_request', {}, req.language?.current || 'en'),
                    require: "name|Name<=>slug|Slug<=>width|Width<=>height|Height<=>placement_type|Placement Type"
                },
            };

            break;
        case "ads":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            const placements = await getAllPlacements();

            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.add_advertisement', {}, req.language?.current || 'en'),
                    data: {
                        placements: placements
                    }
                },
                handler: {
                    tpl: "ads",
                    type: "create",
                    size: "xl",
                    loader: i18n.translateSync('api.widgets.processing_request', {}, req.language?.current || 'en'),
                    require: "placement_id|Placement<=>ad_code|Ad Code"
                },
            };

            break;
        case "templates":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            vars = {
                template: {
                    title: i18n.translateSync('dashboard.template_manager.upload_template', {}, req.language?.current || 'en'),
                    data: {}
                },
                handler: {
                    tpl: "templates",
                    type: "create",
                    size: "lg",
                    loader: i18n.translateSync('dashboard.template_manager.uploading_template', {}, req.language?.current || 'en'),
                    require: "template_file|Template File"
                },
            };

            break;
        default:
            response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
    }

    try {
        res.render(`dashboard/widgets/modals/create/${modalTemplate}`, vars.template, (err, tpl) => {
            if (err) {
                response(res, 500, i18n.translateSync('api.widgets.template_error', {}, req.language?.current || 'en') + ": " + JSON.stringify(err));
            }

            response(res, 200, false, {
                tpl,
                vars: vars.handler,
            });
        });
    } catch {
        // Ignore
    }
};

const update = async (req, res) => {
    const { modalTemplate, id } = req.params;

    let vars;

    switch (modalTemplate) {
        case "users":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            const user = await getUserById(id);

            if (user.length < 1) {
                return response(res, 500, i18n.translateSync('api.widgets.user_not_found', {}, req.language?.current || 'en'));
            }

            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.edit_user', {}, req.language?.current || 'en'),
                    data: {
                        user: user[0],
                        countries: getAllCountries()
                    }
                },
                handler: {
                    id: id,
                    tpl: "users",
                    type: "update",
                    size: "lg",
                    loader: i18n.translateSync('api.widgets.processing_request', {}, req.language?.current || 'en'),
                    require: "username|Username<=>email|Email"
                },
            };

            break;
        case "games":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            const game = await getGameById(id);

            if (game.length < 1) {
                return response(res, 500, i18n.translateSync('api.widgets.game_not_found', {}, req.language?.current || 'en'));
            }

            const categoriesForUpdate = await getAllActiveCategories();

            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.edit_game', {}, req.language?.current || 'en'),
                    data: {
                        game: game[0],
                        categories: categoriesForUpdate
                    }
                },
                handler: {
                    id: id,
                    tpl: "games",
                    type: "update",
                    size: "xl",
                    loader: i18n.translateSync('api.widgets.processing_request', {}, req.language?.current || 'en'),
                    require: "title|Title<=>category_id|Category<=>game_type|Game Type"
                },
            };

            break;
        case "categories":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            const category = await getCategoryById(id);

            if (category.length < 1) {
                return response(res, 500, i18n.translateSync('api.widgets.category_not_found', {}, req.language?.current || 'en'));
            }

            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.edit_category', {}, req.language?.current || 'en'),
                    data: category[0]
                },
                handler: {
                    id: id,
                    tpl: "categories",
                    type: "update",
                    size: "lg",
                    loader: i18n.translateSync('api.widgets.processing_request', {}, req.language?.current || 'en'),
                    require: "name|Name"
                },
            };

            break;
        case "settings_system":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            const settings = await getSettingsAsObject();
            
            // Get available languages for the language selector
            const availableLanguageCodes = await i18n.getAvailableLanguages();
            const availableLanguages = await Promise.all(
                availableLanguageCodes.map(async (code) => {
                    return await i18n.getLanguageInfo(code);
                })
            );
            
            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.system_settings', {}, req.language?.current || 'en'),
                    data: settings,
                    availableLanguages: availableLanguages
                },
                handler: {
                    id: "none",
                    tpl: "settings_system",
                    type: "update",
                    size: "xl",
                    loader: i18n.translateSync('api.widgets.updating_settings', {}, req.language?.current || 'en'),
                    require: "site_name|Site Name"
                },
            };

            break;
        case "settings_exp":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            const expSettings = await getSettingsAsObject();

            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.exp_settings', {}, req.language?.current || 'en'),
                    data: expSettings
                },
                handler: {
                    id: "none",
                    tpl: "settings_exp",
                    type: "update",
                    size: "xl",
                    loader: i18n.translateSync('api.widgets.updating_exp_settings', {}, req.language?.current || 'en'),
                    require: "exp_game_completion|Game Completion EXP"
                },
            };

            break;
        case "comments":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            const comment = await getCommentById(id);

            if (comment.length < 1) {
                return response(res, 500, i18n.translateSync('api.widgets.comment_not_found', {}, req.language?.current || 'en'));
            }

            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.edit_comment', {}, req.language?.current || 'en'),
                    data: {
                        comment: comment[0]
                    }
                },
                handler: {
                    id: id,
                    tpl: "comments",
                    type: "update",
                    size: "lg",
                    loader: i18n.translateSync('api.widgets.processing_request', {}, req.language?.current || 'en'),
                    require: "comment|Comment"
                },
            };

            break;
        case "pages":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            const page = await getPageById(id);

            if (page.length < 1) {
                return response(res, 500, i18n.translateSync('api.widgets.page_not_found', {}, req.language?.current || 'en'));
            }

            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.edit_page', {}, req.language?.current || 'en'),
                    data: {
                        page: page[0]
                    }
                },
                handler: {
                    id: id,
                    tpl: "pages",
                    type: "update",
                    size: "xl",
                    loader: i18n.translateSync('api.widgets.processing_request', {}, req.language?.current || 'en'),
                    require: "title|Title<=>content|Content"
                },
            };

            break;
        case "exp_ranks":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            const expRank = await getExpRankById(id);

            if (expRank.length < 1) {
                return response(res, 500, i18n.translateSync('api.widgets.exp_rank_not_found', {}, req.language?.current || 'en'));
            }

            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.edit_exp_rank', {}, req.language?.current || 'en'),
                    data: {
                        exp_rank: expRank[0]
                    }
                },
                handler: {
                    id: id,
                    tpl: "exp_ranks",
                    type: "update",
                    size: "lg",
                    loader: i18n.translateSync('api.widgets.processing_request', {}, req.language?.current || 'en'),
                    require: "level|Level<=>exp_required|EXP Required"
                },
            };

            break;
        case "ad_placements":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            const adPlacement = await getPlacementById(id);

            if (!adPlacement) {
                return response(res, 500, i18n.translateSync('api.widgets.ad_placement_not_found', {}, req.language?.current || 'en'));
            }

            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.edit_ad_placement', {}, req.language?.current || 'en'),
                    data: adPlacement
                },
                handler: {
                    id: id,
                    tpl: "ad_placements",
                    type: "update",
                    size: "lg",
                    loader: i18n.translateSync('api.widgets.processing_request', {}, req.language?.current || 'en'),
                    require: "name|Name<=>slug|Slug<=>width|Width<=>height|Height<=>placement_type|Placement Type"
                },
            };

            break;
        case "ads":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            const ad = await getAdById(id);

            if (!ad) {
                return response(res, 500, i18n.translateSync('api.widgets.advertisement_not_found', {}, req.language?.current || 'en'));
            }

            const placementsForUpdate = await getAllPlacements();

            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.edit_advertisement', {}, req.language?.current || 'en'),
                    data: {
                        ...ad,
                        placements: placementsForUpdate
                    }
                },
                handler: {
                    id: id,
                    tpl: "ads",
                    type: "update",
                    size: "xl",
                    loader: i18n.translateSync('api.widgets.processing_request', {}, req.language?.current || 'en'),
                    require: "placement_id|Placement<=>name|Name<=>ad_code|Ad Code"
                },
            };

            break;
        default:
            return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
    }

    try {
        res.render(`dashboard/widgets/modals/update/${modalTemplate}`, vars.template, (err, tpl) => {
            if (err) {
                response(res, 500, i18n.translateSync('api.widgets.template_error', {}, req.language?.current || 'en') + ": " + JSON.stringify(err));
            }

            response(res, 200, false, {
                tpl,
                vars: vars.handler,
            });
        });
    } catch {
        // Ignore
    }
};

const staticModal = async (req, res) => {
    const { modalTemplate } = req.params;

    let vars;

    switch (modalTemplate) {
        case "cronjobs":
            if (!res.locals.user || res.locals.user.user_type !== 'admin') {
                return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
            }

            // Get cron settings and status
            const [cronEnabled, cronPassword, lastCleanup, lastMaintenance, lastReports, lastThumbnailGrid] = await Promise.all([
                getSetting('enable_cron_jobs', '0'),
                getSetting('cron_password', ''),
                getSetting('cron_last_run_cleanup', null),
                getSetting('cron_last_run_maintenance', null),
                getSetting('cron_last_run_reports', null),
                getSetting('cron_last_run_thumbnail_grid', null)
            ]);

            vars = {
                template: {
                    title: i18n.translateSync('api.widgets.cron_jobs', {}, req.language?.current || 'en'),
                    data: {
                        cronEnabled: cronEnabled === '1',
                        cronPassword: cronPassword,
                        lastRuns: {
                            cleanup: lastCleanup,
                            maintenance: lastMaintenance,
                            reports: lastReports,
                            thumbnailGrid: lastThumbnailGrid
                        }
                    }
                },
                handler: {
                    tpl: "cronjobs",
                    size: "xl",
                    loader: false
                }
            };

            break;
        default:
            return response(res, 500, i18n.translateSync('api.widgets.invalid_request', {}, req.language?.current || 'en'));
    }

    try {
        res.render(`dashboard/widgets/modals/static/${modalTemplate}`, vars.template, (err, tpl) => {
            if (err) {
                response(res, 500, i18n.translateSync('api.widgets.template_error', {}, req.language?.current || 'en') + ": " + JSON.stringify(err));
            }

            response(res, 200, false, {
                tpl,
                vars: vars.handler,
            });
        });
    } catch {
        // Ignore
    }
};

export {
    create,
    update,
    staticModal
}