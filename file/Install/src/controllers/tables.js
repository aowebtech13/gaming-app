import {
    fetchTableData
} from "../utils/table.js";
import { getAllSettings } from '../models/settings.js';
import { formatTableDate } from '../utils/date.js';
import i18n from '../utils/i18n.js';

const users = async (req, res) => {
    if(!res.locals.user || res.locals.user.user_type !== 'admin'){
        return res.status(401).json({ success: false, message: i18n.translateSync('errors.unauthorized', {}, req.language?.current || 'en') });
    }

    const { search, page = 1, limit = 10 } = req.query;

    try {
        const result = await fetchTableData('users', ['id', 'username', 'email', 'first_name', 'last_name', 'country', 'is_active', 'is_verified', 'created_at'], {
            search,
            page,
            limit,
            orderBy: 'created_at DESC'
        });

        const metadata = [
            {
                key: 'id',
                label: i18n.translateSync('forms.id', {}, req.language?.current || 'en')
            },
            {
                key: 'username',
                label: i18n.translateSync('auth.username', {}, req.language?.current || 'en')
            },
            {
                key: 'email',
                label: i18n.translateSync('auth.email', {}, req.language?.current || 'en')
            },
            {
                key: 'first_name',
                label: i18n.translateSync('auth.first_name', {}, req.language?.current || 'en')
            },
            {
                key: 'last_name',
                label: i18n.translateSync('auth.last_name', {}, req.language?.current || 'en')
            },
            {
                key: 'country',
                label: i18n.translateSync('auth.country', {}, req.language?.current || 'en')
            },
            {
                key: 'is_active',
                label: i18n.translateSync('api.tables.active', {}, req.language?.current || 'en'),
                render: (row) => {
                    const activeText = i18n.translateSync('forms.active', {}, req.language?.current || 'en');
                    const inactiveText = i18n.translateSync('forms.inactive', {}, req.language?.current || 'en');
                    return row.is_active ? `<span class="badge badge-success">${activeText}</span>` : `<span class="badge badge-danger">${inactiveText}</span>`;
                }
            },
            {
                key: 'is_verified',
                label: i18n.translateSync('api.tables.verified', {}, req.language?.current || 'en'),
                render: (row) => {
                    const verifiedText = i18n.translateSync('api.tables.verified', {}, req.language?.current || 'en');
                    const unverifiedText = i18n.translateSync('api.tables.unverified', {}, req.language?.current || 'en');
                    return row.is_verified ? `<span class="badge badge-success">${verifiedText}</span>` : `<span class="badge badge-warning">${unverifiedText}</span>`;
                }
            },
            {
                key: 'created_at',
                label: i18n.translateSync('api.tables.created', {}, req.language?.current || 'en'),
                render: async (row) => {
                    return await formatTableDate(row.created_at);
                }
            },
            {
                key: 'actions',
                label: i18n.translateSync('api.tables.actions', {}, req.language?.current || 'en'),
                render: (row) =>
                    `
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" system-toggle="update/users/${row.id}"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg></button>
                        <button class="btn btn-sm btn-danger" system-delete="users/${row.id}"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></button>
                    </div>
                    `,
            },
        ];

        const enrichedData = await Promise.all(
            result.data.map(async (row) => {
                const enrichedRow = { ...row };
                for (const meta of metadata) {
                    if (meta.render) {
                        enrichedRow[meta.key] = await meta.render(row);
                    }
                }
                return enrichedRow;
            })
        );

        res.json({
            success: true,
            metadata,
            data: enrichedData,
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: i18n.translateSync('api.tables.server_error', {}, req.language?.current || 'en'), error });
    }
};

const games = async (req, res) => {
    if(!res.locals.user || res.locals.user.user_type !== 'admin'){
        return res.status(401).json({ success: false, message: i18n.translateSync('errors.unauthorized', {}, req.language?.current || 'en') });
    }

    const { search, page = 1, limit = 10 } = req.query;

    try {
        const result = await fetchTableData('games g LEFT JOIN categories c ON g.category_id = c.id', ['g.id', 'g.title', 'g.slug', 'g.category_id', 'c.name', 'g.game_type', 'g.is_featured', 'g.is_active', 'g.api_enabled', 'g.created_at'], {
            search,
            page,
            limit,
            orderBy: 'g.created_at DESC'
        });

        const metadata = [
            {
                key: 'id',
                label: i18n.translateSync('forms.id', {}, req.language?.current || 'en')
            },
            {
                key: 'title',
                label: i18n.translateSync('api.tables.title', {}, req.language?.current || 'en'),
                render: (row) => {
                    return `<a href="/play/${row.slug}" target="_blank" class="text-blue-600 hover:text-blue-800 underline font-medium">${row.title}</a>`;
                }
            },
            {
                key: 'name',
                label: i18n.translateSync('api.tables.category', {}, req.language?.current || 'en'),
                render: (row) => {
                    const noCategoryText = i18n.translateSync('api.tables.no_category', {}, req.language?.current || 'en');
                    return row.name || `<span class="text-gray-400 italic">${noCategoryText}</span>`;
                }
            },
            {
                key: 'game_type',
                label: i18n.translateSync('api.tables.type', {}, req.language?.current || 'en'),
                render: (row) => {
                    const typeColors = {
                        html: 'primary',
                        flash: 'warning',
                        webgl: 'info',
                        embed: 'secondary'
                    };
                    return `<span class="badge badge-${typeColors[row.game_type] || 'secondary'}">${row.game_type.toUpperCase()}</span>`;
                }
            },
            {
                key: 'is_featured',
                label: i18n.translateSync('api.tables.featured', {}, req.language?.current || 'en'),
                render: (row) => {
                    const featuredText = i18n.translateSync('api.tables.featured', {}, req.language?.current || 'en');
                    const normalText = i18n.translateSync('api.tables.normal', {}, req.language?.current || 'en');
                    return row.is_featured ? `<span class="badge badge-success">${featuredText}</span>` : `<span class="badge badge-secondary">${normalText}</span>`;
                }
            },
            {
                key: 'is_active',
                label: i18n.translateSync('api.tables.active', {}, req.language?.current || 'en'),
                render: (row) => {
                    const activeText = i18n.translateSync('forms.active', {}, req.language?.current || 'en');
                    const inactiveText = i18n.translateSync('forms.inactive', {}, req.language?.current || 'en');
                    return row.is_active ? `<span class="badge badge-success">${activeText}</span>` : `<span class="badge badge-danger">${inactiveText}</span>`;
                }
            },
            {
                key: 'api_enabled',
                label: i18n.translateSync('api.tables.api', {}, req.language?.current || 'en'),
                render: (row) => {
                    const enabledText = i18n.translateSync('api.tables.enabled', {}, req.language?.current || 'en');
                    const disabledText = i18n.translateSync('api.tables.disabled', {}, req.language?.current || 'en');
                    return row.api_enabled ? `<span class="badge badge-info">${enabledText}</span>` : `<span class="badge badge-secondary">${disabledText}</span>`;
                }
            },
            {
                key: 'created_at',
                label: i18n.translateSync('api.tables.created', {}, req.language?.current || 'en'),
                render: async (row) => {
                    return await formatTableDate(row.created_at);
                }
            },
            {
                key: 'actions',
                label: i18n.translateSync('api.tables.actions', {}, req.language?.current || 'en'),
                render: (row) =>
                    `
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" system-toggle="update/games/${row.id}"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg></button>
                        <button class="btn btn-sm btn-danger" system-delete="games/${row.id}"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></button>
                    </div>
                    `,
            },
        ];

        const enrichedData = await Promise.all(
            result.data.map(async (row) => {
                const enrichedRow = { ...row };
                for (const meta of metadata) {
                    if (meta.render) {
                        enrichedRow[meta.key] = await meta.render(row);
                    }
                }
                return enrichedRow;
            })
        );

        res.json({
            success: true,
            metadata,
            data: enrichedData,
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: i18n.translateSync('api.tables.server_error', {}, req.language?.current || 'en'), error });
    }
};

const categories = async (req, res) => {
    if(!res.locals.user || res.locals.user.user_type !== 'admin'){
        return res.status(401).json({ success: false, message: i18n.translateSync('errors.unauthorized', {}, req.language?.current || 'en') });
    }

    const { search, page = 1, limit = 10 } = req.query;

    try {
        const result = await fetchTableData('categories', ['id', 'name', 'slug', 'description', 'icon', 'sort_order', 'is_active', 'created_at'], {
            search,
            page,
            limit,
            orderBy: 'sort_order ASC'
        });

        const metadata = [
            {
                key: 'id',
                label: i18n.translateSync('forms.id', {}, req.language?.current || 'en')
            },
            {
                key: 'name',
                label: i18n.translateSync('api.tables.name', {}, req.language?.current || 'en')
            },
            {
                key: 'slug',
                label: i18n.translateSync('api.tables.slug', {}, req.language?.current || 'en')
            },
            {
                key: 'description',
                label: i18n.translateSync('api.tables.description', {}, req.language?.current || 'en')
            },
            {
                key: 'icon',
                label: i18n.translateSync('api.tables.icon', {}, req.language?.current || 'en'),
                render: (row) => {
                    if (row.icon && !row.icon.includes('la-')) {
                        return `<img src="/assets/images/heroicons/${row.icon}.svg" alt="${row.icon}" class="w-4 h-4 inline-block mr-2" /> ${row.icon}`;
                    } else if (row.icon) {
                        return `<i class="${row.icon}"></i> ${row.icon}`;
                    } else {
                        const noIconText = i18n.translateSync('api.tables.no_icon', {}, req.language?.current || 'en');
                        return noIconText;
                    }
                }
            },
            {
                key: 'is_active',
                label: i18n.translateSync('api.tables.active', {}, req.language?.current || 'en'),
                render: (row) => {
                    const activeText = i18n.translateSync('forms.active', {}, req.language?.current || 'en');
                    const inactiveText = i18n.translateSync('forms.inactive', {}, req.language?.current || 'en');
                    return row.is_active ? `<span class="badge badge-success">${activeText}</span>` : `<span class="badge badge-danger">${inactiveText}</span>`;
                }
            },
            {
                key: 'created_at',
                label: i18n.translateSync('api.tables.created', {}, req.language?.current || 'en'),
                render: async (row) => {
                    return await formatTableDate(row.created_at);
                }
            },
            {
                key: 'actions',
                label: i18n.translateSync('api.tables.actions', {}, req.language?.current || 'en'),
                render: (row) =>
                    `
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" system-toggle="update/categories/${row.id}"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg></button>
                        <button class="btn btn-sm btn-danger" system-delete="categories/${row.id}"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></button>
                    </div>
                    `,
            },
        ];

        const enrichedData = await Promise.all(
            result.data.map(async (row) => {
                const enrichedRow = { ...row };
                for (const meta of metadata) {
                    if (meta.render) {
                        enrichedRow[meta.key] = await meta.render(row);
                    }
                }
                return enrichedRow;
            })
        );

        res.json({
            success: true,
            metadata,
            data: enrichedData,
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: i18n.translateSync('api.tables.server_error', {}, req.language?.current || 'en'), error });
    }
};

const favorites = async (req, res) => {
    if(!res.locals.user || res.locals.user.user_type !== 'admin'){
        return res.status(401).json({ success: false, message: i18n.translateSync('errors.unauthorized', {}, req.language?.current || 'en') });
    }

    const { search, page = 1, limit = 10 } = req.query;

    try {
        const result = await fetchTableData('favorites f LEFT JOIN users u ON f.user_id = u.id LEFT JOIN games g ON f.game_id = g.id', ['f.id', 'u.username', 'g.title', 'f.created_at'], {
            search,
            page,
            limit,
            orderBy: 'f.created_at DESC'
        });

        const metadata = [
            {
                key: 'id',
                label: i18n.translateSync('forms.id', {}, req.language?.current || 'en')
            },
            {
                key: 'username',
                label: i18n.translateSync('api.tables.user', {}, req.language?.current || 'en')
            },
            {
                key: 'title',
                label: i18n.translateSync('api.tables.game', {}, req.language?.current || 'en')
            },
            {
                key: 'created_at',
                label: i18n.translateSync('api.tables.added', {}, req.language?.current || 'en'),
                render: async (row) => {
                    return await formatTableDate(row.created_at);
                }
            },
            {
                key: 'actions',
                label: i18n.translateSync('api.tables.actions', {}, req.language?.current || 'en'),
                render: (row) =>
                    `
                    <div class="btn-group">
                        <button class="btn btn-sm btn-danger" system-delete="favorites/${row.id}"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></button>
                    </div>
                    `,
            },
        ];

        const enrichedData = await Promise.all(
            result.data.map(async (row) => {
                const enrichedRow = { ...row };
                for (const meta of metadata) {
                    if (meta.render) {
                        enrichedRow[meta.key] = await meta.render(row);
                    }
                }
                return enrichedRow;
            })
        );

        res.json({
            success: true,
            metadata,
            data: enrichedData,
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: i18n.translateSync('api.tables.server_error', {}, req.language?.current || 'en'), error });
    }
};

const follows = async (req, res) => {
    if(!res.locals.user || res.locals.user.user_type !== 'admin'){
        return res.status(401).json({ success: false, message: i18n.translateSync('errors.unauthorized', {}, req.language?.current || 'en') });
    }

    const { search, page = 1, limit = 10 } = req.query;

    try {
        const result = await fetchTableData('follows f LEFT JOIN users u1 ON f.follower_id = u1.id LEFT JOIN users u2 ON f.following_id = u2.id', ['f.id', 'u1.username as follower', 'u2.username as following', 'f.created_at'], {
            search,
            page,
            limit,
            orderBy: 'f.created_at DESC'
        });

        const metadata = [
            {
                key: 'id',
                label: i18n.translateSync('forms.id', {}, req.language?.current || 'en')
            },
            {
                key: 'follower',
                label: i18n.translateSync('api.tables.follower', {}, req.language?.current || 'en')
            },
            {
                key: 'following',
                label: i18n.translateSync('api.tables.following', {}, req.language?.current || 'en')
            },
            {
                key: 'created_at',
                label: i18n.translateSync('api.tables.since', {}, req.language?.current || 'en'),
                render: async (row) => {
                    return await formatTableDate(row.created_at);
                }
            },
            {
                key: 'actions',
                label: i18n.translateSync('api.tables.actions', {}, req.language?.current || 'en'),
                render: (row) =>
                    `
                    <div class="btn-group">
                        <button class="btn btn-sm btn-danger" system-delete="follows/${row.id}"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></button>
                    </div>
                    `,
            },
        ];

        const enrichedData = await Promise.all(
            result.data.map(async (row) => {
                const enrichedRow = { ...row };
                for (const meta of metadata) {
                    if (meta.render) {
                        enrichedRow[meta.key] = await meta.render(row);
                    }
                }
                return enrichedRow;
            })
        );

        res.json({
            success: true,
            metadata,
            data: enrichedData,
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: i18n.translateSync('api.tables.server_error', {}, req.language?.current || 'en'), error });
    }
};

const comments = async (req, res) => {
    if(!res.locals.user || res.locals.user.user_type !== 'admin'){
        return res.status(401).json({ success: false, message: i18n.translateSync('errors.unauthorized', {}, req.language?.current || 'en') });
    }

    const { search, page = 1, limit = 10 } = req.query;

    try {
        const result = await fetchTableData('game_comments c LEFT JOIN users u ON c.user_id = u.id LEFT JOIN games g ON c.game_id = g.id', ['c.id', 'u.username', 'g.title as game_title', 'c.comment', 'c.is_active', 'c.created_at'], {
            search,
            page,
            limit,
            orderBy: 'c.created_at DESC'
        });

        const metadata = [
            {
                key: 'id',
                label: i18n.translateSync('forms.id', {}, req.language?.current || 'en')
            },
            {
                key: 'username',
                label: i18n.translateSync('api.tables.user', {}, req.language?.current || 'en')
            },
            {
                key: 'game_title',
                label: i18n.translateSync('api.tables.game', {}, req.language?.current || 'en')
            },
            {
                key: 'comment',
                label: i18n.translateSync('api.tables.comment', {}, req.language?.current || 'en'),
                render: (row) => {
                    const maxLength = 80;
                    return row.comment.length > maxLength 
                        ? row.comment.substring(0, maxLength) + '...'
                        : row.comment;
                }
            },
            {
                key: 'is_active',
                label: i18n.translateSync('api.tables.status', {}, req.language?.current || 'en'),
                render: (row) => {
                    const activeText = i18n.translateSync('forms.active', {}, req.language?.current || 'en');
                    const inactiveText = i18n.translateSync('forms.inactive', {}, req.language?.current || 'en');
                    return row.is_active ? `<span class="badge badge-success">${activeText}</span>` : `<span class="badge badge-danger">${inactiveText}</span>`;
                }
            },
            {
                key: 'created_at',
                label: i18n.translateSync('api.tables.posted', {}, req.language?.current || 'en'),
                render: async (row) => {
                    return await formatTableDate(row.created_at);
                }
            },
            {
                key: 'actions',
                label: i18n.translateSync('api.tables.actions', {}, req.language?.current || 'en'),
                render: (row) =>
                    `
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" system-toggle="update/comments/${row.id}"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg></button>
                        <button class="btn btn-sm btn-danger" system-delete="comments/${row.id}"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></button>
                    </div>
                    `,
            },
        ];

        const enrichedData = await Promise.all(
            result.data.map(async (row) => {
                const enrichedRow = { ...row };
                for (const meta of metadata) {
                    if (meta.render) {
                        enrichedRow[meta.key] = await meta.render(row);
                    }
                }
                return enrichedRow;
            })
        );

        res.json({
            success: true,
            metadata,
            data: enrichedData,
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: i18n.translateSync('api.tables.server_error', {}, req.language?.current || 'en'), error });
    }
};

const pages = async (req, res) => {
    if(!res.locals.user || res.locals.user.user_type !== 'admin'){
        return res.status(401).json({ success: false, message: i18n.translateSync('errors.unauthorized', {}, req.language?.current || 'en') });
    }

    const { search, page = 1, limit = 10 } = req.query;

    try {
        const result = await fetchTableData('pages p LEFT JOIN users u ON p.created_by = u.id', ['p.id', 'p.title', 'p.slug', 'p.is_published', 'u.username as created_by_username', 'p.created_at', 'p.updated_at'], {
            search,
            page,
            limit,
            orderBy: 'p.created_at DESC'
        });

        const metadata = [
            {
                key: 'id',
                label: i18n.translateSync('forms.id', {}, req.language?.current || 'en')
            },
            {
                key: 'title',
                label: i18n.translateSync('api.tables.title', {}, req.language?.current || 'en')
            },
            {
                key: 'slug',
                label: i18n.translateSync('api.tables.slug', {}, req.language?.current || 'en'),
                render: (row) => {
                    return `<a href="/page/${row.slug}" target="_blank" class="text-blue-600 hover:text-blue-800 underline">${row.slug}</a>`;
                }
            },
            {
                key: 'is_published',
                label: i18n.translateSync('api.tables.status', {}, req.language?.current || 'en'),
                render: (row) => {
                    const publishedText = i18n.translateSync('api.tables.published', {}, req.language?.current || 'en');
                    const draftText = i18n.translateSync('api.tables.draft', {}, req.language?.current || 'en');
                    return row.is_published ? `<span class="badge badge-success">${publishedText}</span>` : `<span class="badge badge-warning">${draftText}</span>`;
                }
            },
            {
                key: 'created_by_username',
                label: i18n.translateSync('api.tables.author', {}, req.language?.current || 'en')
            },
            {
                key: 'created_at',
                label: i18n.translateSync('api.tables.created', {}, req.language?.current || 'en'),
                render: async (row) => {
                    return await formatTableDate(row.created_at);
                }
            },
            {
                key: 'updated_at',
                label: i18n.translateSync('api.tables.updated', {}, req.language?.current || 'en'),
                render: async (row) => {
                    return await formatTableDate(row.updated_at);
                }
            },
            {
                key: 'actions',
                label: i18n.translateSync('api.tables.actions', {}, req.language?.current || 'en'),
                render: (row) =>
                    `
                    <div class="btn-group">
                        <button class="btn btn-sm btn-info" onclick="copyPageLink('${row.slug}')" title="Copy Link"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"></path></svg></button>
                        <button class="btn btn-sm btn-primary" system-toggle="update/pages/${row.id}"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg></button>
                        <button class="btn btn-sm btn-danger" system-delete="pages/${row.id}"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></button>
                    </div>
                    `,
            },
        ];

        const enrichedData = await Promise.all(
            result.data.map(async (row) => {
                const enrichedRow = { ...row };
                for (const meta of metadata) {
                    if (meta.render) {
                        enrichedRow[meta.key] = await meta.render(row);
                    }
                }
                return enrichedRow;
            })
        );

        res.json({
            success: true,
            metadata,
            data: enrichedData,
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: i18n.translateSync('api.tables.server_error', {}, req.language?.current || 'en'), error });
    }
};


const exp_ranks = async (req, res) => {
    if(!res.locals.user || res.locals.user.user_type !== 'admin'){
        return res.status(401).json({ success: false, message: i18n.translateSync('errors.unauthorized', {}, req.language?.current || 'en') });
    }

    const { search, page = 1, limit = 10 } = req.query;

    try {
        const result = await fetchTableData('exp_ranks', ['id', 'level', 'exp_required', 'reward_title', 'reward_description', 'created_at'], {
            search,
            page,
            limit,
            orderBy: 'level ASC'
        });

        const metadata = [
            {
                key: 'id',
                label: i18n.translateSync('forms.id', {}, req.language?.current || 'en')
            },
            {
                key: 'level',
                label: i18n.translateSync('api.tables.rank', {}, req.language?.current || 'en'),
                render: (row) => `<span class="badge badge-warning"><svg class="w-4 h-4 inline-block mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg> Rank ${row.level}</span>`
            },
            {
                key: 'exp_required',
                label: i18n.translateSync('api.tables.exp_required', {}, req.language?.current || 'en'),
                render: (row) => `<span class="text-primary font-weight-bold">${parseInt(row.exp_required).toLocaleString()}</span>`
            },
            {
                key: 'reward_title',
                label: i18n.translateSync('api.tables.title', {}, req.language?.current || 'en')
            },
            {
                key: 'reward_description',
                label: i18n.translateSync('api.tables.description', {}, req.language?.current || 'en')
            },
            {
                key: 'created_at',
                label: i18n.translateSync('api.tables.created', {}, req.language?.current || 'en'),
                render: async (row) => {
                    return await formatTableDate(row.created_at);
                }
            },
            {
                key: 'actions',
                label: i18n.translateSync('api.tables.actions', {}, req.language?.current || 'en'),
                render: (row) =>
                    `
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" system-toggle="update/exp_ranks/${row.id}"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg></button>
                        <button class="btn btn-sm btn-danger" system-delete="exp_ranks/${row.id}"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></button>
                    </div>
                    `,
            },
        ];

        const enrichedData = await Promise.all(
            result.data.map(async (row) => {
                const enrichedRow = { ...row };
                for (const meta of metadata) {
                    if (meta.render) {
                        enrichedRow[meta.key] = await meta.render(row);
                    }
                }
                return enrichedRow;
            })
        );

        res.json({
            success: true,
            metadata,
            data: enrichedData,
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: i18n.translateSync('api.tables.server_error', {}, req.language?.current || 'en'), error });
    }
};

const exp_events = async (req, res) => {
    if(!res.locals.user || res.locals.user.user_type !== 'admin'){
        return res.status(401).json({ success: false, message: i18n.translateSync('errors.unauthorized', {}, req.language?.current || 'en') });
    }

    const { search, page = 1, limit = 10 } = req.query;

    try {
        const result = await fetchTableData('exp_events e LEFT JOIN users u ON e.user_id = u.id', ['e.id', 'e.user_id', 'e.event_type', 'e.event_source_id', 'e.exp_amount', 'e.description', 'e.created_at', 'u.username'], {
            search,
            page,
            limit,
            orderBy: 'e.created_at DESC'
        });

        const metadata = [
            {
                key: 'id',
                label: i18n.translateSync('forms.id', {}, req.language?.current || 'en')
            },
            {
                key: 'username',
                label: i18n.translateSync('api.tables.user', {}, req.language?.current || 'en')
            },
            {
                key: 'event_type',
                label: i18n.translateSync('api.tables.event_type', {}, req.language?.current || 'en'),
                render: (row) => {
                    const typeColors = {
                        'game_completion': 'success',
                        'daily_login': 'info',
                        'first_play': 'warning',
                        'game_rating': 'primary',
                        'game_comment': 'secondary',
                        'follow_user': 'dark',
                        'level_up': 'danger'
                    };
                    const color = typeColors[row.event_type] || 'light';
                    return `<span class="badge badge-${color}">${row.event_type.replace('_', ' ')}</span>`;
                }
            },
            {
                key: 'exp_amount',
                label: i18n.translateSync('api.tables.exp_amount', {}, req.language?.current || 'en'),
                render: (row) => `<span class="text-success font-weight-bold">+${row.exp_amount}</span>`
            },
            {
                key: 'description',
                label: i18n.translateSync('api.tables.description', {}, req.language?.current || 'en')
            },
            {
                key: 'created_at',
                label: i18n.translateSync('api.tables.date', {}, req.language?.current || 'en'),
                render: async (row) => {
                    return await formatTableDate(row.created_at);
                }
            },
            {
                key: 'actions',
                label: i18n.translateSync('api.tables.actions', {}, req.language?.current || 'en'),
                render: (row) =>
                    `
                    <div class="btn-group">
                        <button class="btn btn-sm btn-danger" system-delete="exp_events/${row.id}"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></button>
                    </div>
                    `,
            },
        ];

        const enrichedData = await Promise.all(
            result.data.map(async (row) => {
                const enrichedRow = { ...row };
                for (const meta of metadata) {
                    if (meta.render) {
                        enrichedRow[meta.key] = await meta.render(row);
                    }
                }
                return enrichedRow;
            })
        );

        res.json({
            success: true,
            metadata,
            data: enrichedData,
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: i18n.translateSync('api.tables.server_error', {}, req.language?.current || 'en'), error });
    }
};

const email_logs = async (req, res) => {
    if(!res.locals.user || res.locals.user.user_type !== 'admin'){
        return res.status(401).json({ success: false, message: i18n.translateSync('errors.unauthorized', {}, req.language?.current || 'en') });
    }

    const { search, page = 1, limit = 10 } = req.query;

    try {
        const result = await fetchTableData('email_logs', ['id', 'recipient_email', 'recipient_name', 'subject', 'template', 'status', 'sent_at', 'created_at'], {
            search,
            page,
            limit,
            orderBy: 'created_at DESC'
        });

        const metadata = [
            { key: 'id', label: i18n.translateSync('api.tables.id', {}, req.language?.current || 'en') },
            { key: 'recipient_email', label: i18n.translateSync('api.tables.recipient', {}, req.language?.current || 'en') },
            { key: 'subject', label: i18n.translateSync('api.tables.subject', {}, req.language?.current || 'en') },
            { key: 'template', label: i18n.translateSync('api.tables.template', {}, req.language?.current || 'en') },
            { 
                key: 'status', 
                label: i18n.translateSync('api.tables.status', {}, req.language?.current || 'en'),
                render: (row) => {
                    const statusColors = {
                        'sent': 'bg-green-100 text-green-800',
                        'failed': 'bg-red-100 text-red-800',
                        'pending': 'bg-yellow-100 text-yellow-800'
                    };
                    const colorClass = statusColors[row.status] || 'bg-gray-100 text-gray-800';
                    return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}">${row.status}</span>`;
                }
            },
            { 
                key: 'sent_at', 
                label: i18n.translateSync('api.tables.sent_at', {}, req.language?.current || 'en'),
                render: async (row) => row.sent_at ? await formatTableDate(row.sent_at) : i18n.translateSync('api.tables.not_sent', {}, req.language?.current || 'en')
            },
            { 
                key: 'created_at', 
                label: i18n.translateSync('api.tables.created', {}, req.language?.current || 'en'),
                render: async (row) => await formatTableDate(row.created_at)
            }
        ];

        const enrichedData = await Promise.all(
            result.data.map(async (row) => {
                const enrichedRow = { ...row };
                for (const meta of metadata) {
                    if (meta.render) {
                        enrichedRow[meta.key] = await meta.render(row);
                    }
                }
                return enrichedRow;
            })
        );

        res.json({
            success: true,
            metadata,
            data: enrichedData,
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: i18n.translateSync('api.tables.server_error', {}, req.language?.current || 'en'), error });
    }
};

const cron_logs = async (req, res) => {
    if(!res.locals.user || res.locals.user.user_type !== 'admin'){
        return res.status(401).json({ success: false, message: i18n.translateSync('errors.unauthorized', {}, req.language?.current || 'en') });
    }

    const { search, page = 1, limit = 10 } = req.query;

    try {
        const result = await fetchTableData('cron_logs', ['id', 'job_name', 'status', 'execution_time_ms', 'memory_usage_mb', 'records_processed', 'started_at', 'completed_at', 'created_at'], {
            search,
            page,
            limit,
            orderBy: 'created_at DESC'
        });

        const metadata = [
            { key: 'id', label: i18n.translateSync('api.tables.id', {}, req.language?.current || 'en') },
            { key: 'job_name', label: i18n.translateSync('api.tables.job_name', {}, req.language?.current || 'en') },
            { 
                key: 'status', 
                label: i18n.translateSync('api.tables.status', {}, req.language?.current || 'en'),
                render: (row) => {
                    const statusColors = {
                        'completed': 'bg-green-100 text-green-800',
                        'failed': 'bg-red-100 text-red-800',
                        'running': 'bg-blue-100 text-blue-800'
                    };
                    const colorClass = statusColors[row.status] || 'bg-gray-100 text-gray-800';
                    return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}">${row.status}</span>`;
                }
            },
            { 
                key: 'execution_time_ms', 
                label: i18n.translateSync('api.tables.duration', {}, req.language?.current || 'en'),
                render: (row) => row.execution_time_ms ? `${row.execution_time_ms}ms` : 'N/A'
            },
            { 
                key: 'memory_usage_mb', 
                label: i18n.translateSync('api.tables.memory', {}, req.language?.current || 'en'),
                render: (row) => row.memory_usage_mb ? `${row.memory_usage_mb}MB` : 'N/A'
            },
            { key: 'records_processed', label: i18n.translateSync('api.tables.records', {}, req.language?.current || 'en') },
            { 
                key: 'started_at', 
                label: i18n.translateSync('api.tables.started', {}, req.language?.current || 'en'),
                render: async (row) => row.started_at ? await formatTableDate(row.started_at) : 'N/A'
            },
            { 
                key: 'completed_at', 
                label: i18n.translateSync('api.tables.completed', {}, req.language?.current || 'en'),
                render: async (row) => row.completed_at ? await formatTableDate(row.completed_at) : 'N/A'
            }
        ];

        const enrichedData = await Promise.all(
            result.data.map(async (row) => {
                const enrichedRow = { ...row };
                for (const meta of metadata) {
                    if (meta.render) {
                        enrichedRow[meta.key] = await meta.render(row);
                    }
                }
                return enrichedRow;
            })
        );

        res.json({
            success: true,
            metadata,
            data: enrichedData,
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: i18n.translateSync('api.tables.server_error', {}, req.language?.current || 'en'), error });
    }
};

const search_queries = async (req, res) => {
    if(!res.locals.user || res.locals.user.user_type !== 'admin'){
        return res.status(401).json({ success: false, message: i18n.translateSync('errors.unauthorized', {}, req.language?.current || 'en') });
    }

    const { search, page = 1, limit = 10 } = req.query;

    try {
        const result = await fetchTableData('search_queries', ['id', 'query', 'search_count', 'last_searched', 'created_at'], {
            search,
            page,
            limit,
            orderBy: 'search_count DESC, last_searched DESC'
        });

        const metadata = [
            { key: 'id', label: i18n.translateSync('api.tables.id', {}, req.language?.current || 'en') },
            { key: 'query', label: i18n.translateSync('api.tables.search_query', {}, req.language?.current || 'en') },
            { 
                key: 'search_count', 
                label: i18n.translateSync('api.tables.count', {}, req.language?.current || 'en'),
                render: (row) => `<span class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">${row.search_count}</span>`
            },
            { 
                key: 'last_searched', 
                label: i18n.translateSync('api.tables.last_searched', {}, req.language?.current || 'en'),
                render: async (row) => await formatTableDate(row.last_searched)
            },
            { 
                key: 'created_at', 
                label: i18n.translateSync('api.tables.first_searched', {}, req.language?.current || 'en'),
                render: async (row) => await formatTableDate(row.created_at)
            }
        ];

        const enrichedData = await Promise.all(
            result.data.map(async (row) => {
                const enrichedRow = { ...row };
                for (const meta of metadata) {
                    if (meta.render) {
                        enrichedRow[meta.key] = await meta.render(row);
                    }
                }
                return enrichedRow;
            })
        );

        res.json({
            success: true,
            metadata,
            data: enrichedData,
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: i18n.translateSync('api.tables.server_error', {}, req.language?.current || 'en'), error });
    }
};

const game_scores = async (req, res) => {
    if(!res.locals.user || res.locals.user.user_type !== 'admin'){
        return res.status(401).json({ success: false, message: i18n.translateSync('errors.unauthorized', {}, req.language?.current || 'en') });
    }

    const { search, page = 1, limit = 10 } = req.query;

    try {
        const result = await fetchTableData('game_scores gs LEFT JOIN users u ON gs.user_id = u.id LEFT JOIN games g ON gs.game_id = g.id', 
            ['gs.id', 'u.username', 'g.title as game_title', 'gs.score', 'gs.score_type', 'gs.is_personal_best', 'gs.is_verified', 'gs.exp_awarded', 'gs.achieved_at'], {
            search,
            page,
            limit,
            orderBy: 'gs.achieved_at DESC'
        });

        const metadata = [
            { key: 'id', label: i18n.translateSync('api.tables.id', {}, req.language?.current || 'en') },
            { key: 'username', label: i18n.translateSync('api.tables.player', {}, req.language?.current || 'en') },
            { key: 'game_title', label: i18n.translateSync('api.tables.game', {}, req.language?.current || 'en') },
            { 
                key: 'score', 
                label: i18n.translateSync('api.tables.score', {}, req.language?.current || 'en'),
                render: (row) => `<span class="font-bold text-blue-600">${row.score.toLocaleString()}</span>`
            },
            { key: 'score_type', label: i18n.translateSync('api.tables.type', {}, req.language?.current || 'en') },
            { 
                key: 'is_personal_best', 
                label: i18n.translateSync('api.tables.personal_best', {}, req.language?.current || 'en'),
                render: (row) => row.is_personal_best ? `<span class="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">${i18n.translateSync('yes', {}, req.language?.current || 'en')}</span>` : i18n.translateSync('no', {}, req.language?.current || 'en')
            },
            { 
                key: 'is_verified', 
                label: i18n.translateSync('api.tables.verified', {}, req.language?.current || 'en'),
                render: (row) => row.is_verified ? `<span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">${i18n.translateSync('yes', {}, req.language?.current || 'en')}</span>` : `<span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">${i18n.translateSync('no', {}, req.language?.current || 'en')}</span>`
            },
            { key: 'exp_awarded', label: i18n.translateSync('api.tables.exp', {}, req.language?.current || 'en') },
            { 
                key: 'achieved_at', 
                label: i18n.translateSync('api.tables.achieved', {}, req.language?.current || 'en'),
                render: async (row) => await formatTableDate(row.achieved_at)
            }
        ];

        const enrichedData = await Promise.all(
            result.data.map(async (row) => {
                const enrichedRow = { ...row };
                for (const meta of metadata) {
                    if (meta.render) {
                        enrichedRow[meta.key] = await meta.render(row);
                    }
                }
                return enrichedRow;
            })
        );

        res.json({
            success: true,
            metadata,
            data: enrichedData,
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: i18n.translateSync('api.tables.server_error', {}, req.language?.current || 'en'), error });
    }
};

const game_leaderboards = async (req, res) => {
    if(!res.locals.user || res.locals.user.user_type !== 'admin'){
        return res.status(401).json({ success: false, message: i18n.translateSync('errors.unauthorized', {}, req.language?.current || 'en') });
    }

    const { search, page = 1, limit = 10 } = req.query;

    try {
        const result = await fetchTableData('game_leaderboards gl LEFT JOIN games g ON gl.game_id = g.id', 
            ['gl.id', 'g.title as game_title', 'gl.username', 'gl.high_score', 'gl.score_count', 'gl.rank_position', 'gl.first_score_date', 'gl.last_score_date', 'gl.updated_at'], {
            search,
            page,
            limit,
            orderBy: 'gl.updated_at DESC'
        });

        const metadata = [
            { key: 'id', label: i18n.translateSync('api.tables.id', {}, req.language?.current || 'en') },
            { key: 'game_title', label: i18n.translateSync('api.tables.game', {}, req.language?.current || 'en') },
            { key: 'username', label: i18n.translateSync('api.tables.player', {}, req.language?.current || 'en') },
            { 
                key: 'high_score', 
                label: i18n.translateSync('api.tables.high_score', {}, req.language?.current || 'en'),
                render: (row) => `<span class="font-bold text-purple-600">${row.high_score.toLocaleString()}</span>`
            },
            { key: 'score_count', label: i18n.translateSync('api.tables.attempts', {}, req.language?.current || 'en') },
            { 
                key: 'rank_position', 
                label: i18n.translateSync('api.tables.rank', {}, req.language?.current || 'en'),
                render: (row) => row.rank_position ? `<span class="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">#${row.rank_position}</span>` : i18n.translateSync('api.tables.unranked', {}, req.language?.current || 'en')
            },
            { 
                key: 'first_score_date', 
                label: i18n.translateSync('api.tables.first_score', {}, req.language?.current || 'en'),
                render: async (row) => await formatTableDate(row.first_score_date)
            },
            { 
                key: 'last_score_date', 
                label: i18n.translateSync('api.tables.last_score', {}, req.language?.current || 'en'),
                render: async (row) => await formatTableDate(row.last_score_date)
            }
        ];

        const enrichedData = await Promise.all(
            result.data.map(async (row) => {
                const enrichedRow = { ...row };
                for (const meta of metadata) {
                    if (meta.render) {
                        enrichedRow[meta.key] = await meta.render(row);
                    }
                }
                return enrichedRow;
            })
        );

        res.json({
            success: true,
            metadata,
            data: enrichedData,
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: i18n.translateSync('api.tables.server_error', {}, req.language?.current || 'en'), error });
    }
};

const ad_placements = async (req, res) => {
    if(!res.locals.user || res.locals.user.user_type !== 'admin'){
        return res.status(401).json({ success: false, message: i18n.translateSync('errors.unauthorized', {}, req.language?.current || 'en') });
    }

    const { search, page = 1, limit = 10 } = req.query;

    try {
        const result = await fetchTableData('ad_placements', 
            ['id', 'name', 'slug', 'description', 'width', 'height', 'placement_type', 'is_active', 'created_at', 'updated_at'], {
            search,
            page,
            limit,
            orderBy: 'id DESC'
        });

        const metadata = [
            { key: 'id', label: i18n.translateSync('api.tables.id', {}, req.language?.current || 'en') },
            { key: 'name', label: i18n.translateSync('api.tables.name', {}, req.language?.current || 'en') },
            { key: 'slug', label: i18n.translateSync('api.tables.slug', {}, req.language?.current || 'en') },
            { 
                key: 'dimensions', 
                label: i18n.translateSync('api.tables.dimensions', {}, req.language?.current || 'en'),
                render: (row) => `<span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">${row.width}×${row.height}</span>`
            },
            { 
                key: 'placement_type', 
                label: i18n.translateSync('api.tables.type', {}, req.language?.current || 'en'),
                render: (row) => {
                    const typeColors = {
                        'banner': 'bg-blue-100 text-blue-800',
                        'emulator': 'bg-purple-100 text-purple-800',
                        'game-api': 'bg-green-100 text-green-800'
                    };
                    const colorClass = typeColors[row.placement_type] || 'bg-gray-100 text-gray-800';
                    return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}">${row.placement_type}</span>`;
                }
            },
            { 
                key: 'is_active', 
                label: i18n.translateSync('api.tables.status', {}, req.language?.current || 'en'),
                render: (row) => row.is_active ? `<span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">${i18n.translateSync('api.tables.active', {}, req.language?.current || 'en')}</span>` : `<span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">${i18n.translateSync('api.tables.inactive', {}, req.language?.current || 'en')}</span>`
            },
            { 
                key: 'created_at', 
                label: i18n.translateSync('api.tables.created', {}, req.language?.current || 'en'),
                render: async (row) => await formatTableDate(row.created_at)
            },
            {
                key: 'actions',
                label: i18n.translateSync('api.tables.actions', {}, req.language?.current || 'en'),
                render: (row) => {
                    // Default placements (IDs 1-13) cannot be edited or deleted
                    const isDefaultPlacement = row.id >= 1 && row.id <= 13;
                    
                    if (isDefaultPlacement) {
                        return `
                            <div class="btn-group">
                                <span class="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">${i18n.translateSync('api.tables.default', {}, req.language?.current || 'en')}</span>
                            </div>
                        `;
                    }
                    
                    return `
                        <div class="btn-group">
                            <button class="btn btn-sm btn-primary" system-toggle="update/ad_placements/${row.id}">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path>
                                </svg>
                            </button>
                            <button class="btn btn-sm btn-danger" system-delete="ad_placements/${row.id}">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                </svg>
                            </button>
                        </div>
                    `;
                },
            },
        ];

        const enrichedData = await Promise.all(
            result.data.map(async (row) => {
                const enrichedRow = { ...row };
                for (const meta of metadata) {
                    if (meta.render) {
                        enrichedRow[meta.key] = await meta.render(row);
                    }
                }
                return enrichedRow;
            })
        );

        res.json({
            success: true,
            metadata,
            data: enrichedData,
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: i18n.translateSync('api.tables.server_error', {}, req.language?.current || 'en'), error });
    }
};

const ads = async (req, res) => {
    if(!res.locals.user || res.locals.user.user_type !== 'admin'){
        return res.status(401).json({ success: false, message: i18n.translateSync('errors.unauthorized', {}, req.language?.current || 'en') });
    }

    const { search, page = 1, limit = 10 } = req.query;

    try {
        const result = await fetchTableData('ads a LEFT JOIN ad_placements ap ON a.placement_id = ap.id', 
            ['a.id', 'a.name', 'ap.name as placement_name', 'ap.placement_type', 'ap.width', 'ap.height', 'a.is_active', 'a.created_at', 'a.updated_at'], {
            search,
            page,
            limit,
            orderBy: 'a.created_at DESC'
        });

        const metadata = [
            { key: 'id', label: i18n.translateSync('api.tables.id', {}, req.language?.current || 'en') },
            { key: 'name', label: i18n.translateSync('api.tables.ad_name', {}, req.language?.current || 'en') },
            { key: 'placement_name', label: i18n.translateSync('api.tables.placement', {}, req.language?.current || 'en') },
            { 
                key: 'placement_type', 
                label: i18n.translateSync('api.tables.type', {}, req.language?.current || 'en'),
                render: (row) => {
                    const typeColors = {
                        'banner': 'bg-blue-100 text-blue-800',
                        'emulator': 'bg-purple-100 text-purple-800',
                        'game-api': 'bg-green-100 text-green-800'
                    };
                    const colorClass = typeColors[row.placement_type] || 'bg-gray-100 text-gray-800';
                    return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}">${row.placement_type}</span>`;
                }
            },
            { 
                key: 'dimensions', 
                label: i18n.translateSync('api.tables.size', {}, req.language?.current || 'en'),
                render: (row) => `<span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">${row.width}×${row.height}</span>`
            },
            { 
                key: 'is_active', 
                label: i18n.translateSync('api.tables.status', {}, req.language?.current || 'en'),
                render: (row) => row.is_active ? `<span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">${i18n.translateSync('api.tables.active', {}, req.language?.current || 'en')}</span>` : `<span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">${i18n.translateSync('api.tables.inactive', {}, req.language?.current || 'en')}</span>`
            },
            { 
                key: 'created_at', 
                label: i18n.translateSync('api.tables.created', {}, req.language?.current || 'en'),
                render: async (row) => await formatTableDate(row.created_at)
            },
            {
                key: 'actions',
                label: i18n.translateSync('api.tables.actions', {}, req.language?.current || 'en'),
                render: (row) => `
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" system-toggle="update/ads/${row.id}">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-sm btn-danger" system-delete="ads/${row.id}">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                            </svg>
                        </button>
                    </div>
                `,
            },
        ];

        const enrichedData = await Promise.all(
            result.data.map(async (row) => {
                const enrichedRow = { ...row };
                for (const meta of metadata) {
                    if (meta.render) {
                        enrichedRow[meta.key] = await meta.render(row);
                    }
                }
                return enrichedRow;
            })
        );

        res.json({
            success: true,
            metadata,
            data: enrichedData,
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: i18n.translateSync('api.tables.server_error', {}, req.language?.current || 'en'), error });
    }
};

export {
    users,
    games,
    categories,
    favorites,
    follows,
    comments,
    pages,
    exp_ranks,
    exp_events,
    email_logs,
    cron_logs,
    search_queries,
    game_scores,
    game_leaderboards,
    ad_placements,
    ads
}