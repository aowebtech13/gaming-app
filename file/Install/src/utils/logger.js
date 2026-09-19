import clc from 'console-log-colors';

const isProduction = () => {
    return process.env.ENVIRONMENT === 'production';
};

export const consoleLog = (type, message, options = {}) => {
    if (isProduction()) return;

    const { 
        method = null, 
        url = null, 
        status = null, 
        time = null, 
        query = null,
        action = null,
        key = null,
        hit = null,
        event = null,
        userId = null,
        data = null,
        ...args 
    } = options;

    const typeColors = {
        'info': { color: 'blue', label: '[INFO]' },
        'success': { color: 'green', label: '[SUCCESS]' },
        'warn': { color: 'yellow', label: '[WARN]' },
        'error': { color: 'red', label: '[ERROR]' },
        'debug': { color: 'magenta', label: '[DEBUG]' },
        'request': { color: 'cyan', label: '[REQUEST]' },
        'database': { color: 'magenta', label: '[DATABASE]' },
        'cache': { color: 'cyan', label: '[CACHE]' },
        'websocket': { color: 'magenta', label: '[WEBSOCKET]' },
        'server': { color: 'green', label: '[SERVER]' }
    };

    const typeConfig = typeColors[type] || { color: 'white', label: `[${type.toUpperCase()}]` };
    let output = [clc[typeConfig.color](typeConfig.label)];

    switch (type) {
        case 'request':
            const methodColors = {
                'GET': 'green',
                'POST': 'blue',
                'PUT': 'yellow',
                'DELETE': 'red',
                'PATCH': 'cyan'
            };
            const statusColor = status ? (status >= 400 ? 'red' : status >= 300 ? 'yellow' : 'green') : 'white';
            const timeStr = time ? clc.gray(`${time}ms`) : '';
            
            output.push(
                methodColors[method] ? clc[methodColors[method]](method) : clc.white(method || ''),
                clc.white(url || message),
                status ? clc[statusColor](status) : '',
                timeStr
            );
            break;

        case 'database':
            const dbTimeStr = time ? clc.gray(`${time}ms`) : '';
            output.push(clc.white(query || message), dbTimeStr);
            break;

        case 'cache':
            const actionColors = {
                'GET': 'blue',
                'SET': 'green',
                'DEL': 'red',
                'CLEAR': 'yellow'
            };
            const hitStr = hit !== null ? (hit ? clc.green('HIT') : clc.red('MISS')) : '';
            
            output.push(
                actionColors[action] ? clc[actionColors[action]](action) : clc.white(action || ''),
                clc.white(key || message),
                hitStr
            );
            break;

        case 'websocket':
            const userStr = userId ? clc.gray(`user:${userId}`) : '';
            const dataStr = data ? clc.gray(JSON.stringify(data)) : '';
            
            output.push(
                clc.white(event || message),
                userStr,
                dataStr
            );
            break;

        default:
            output.push(clc.white(message));
            if (Object.keys(args).length > 0) {
                output.push(...Object.values(args));
            }
            break;
    }

    console.log(...output.filter(item => item !== ''));
};