import { getSetting } from '../models/settings.js';
import { consoleLog } from '../utils/logger.js';
import i18n from '../utils/i18n.js';

const maintenance = async (req, res, next) => {
    try {
        // Check if maintenance mode is enabled
        const maintenanceEnabled = await getSetting('maintenance_mode', '0');
        
        if (maintenanceEnabled === '1') {
            // Allow access to auth routes, static assets, and admin routes
            const allowedPaths = [
                '/auth/login',
                '/auth/logout',
                '/auth/process-login',
                '/dashboard',
                '/assets',
                '/uploads',
                '/favicon',
                '/robots.txt'
            ];
            
            // Check if the request path starts with any allowed path
            const isAllowed = allowedPaths.some(path => req.path.startsWith(path));
            
            // Allow admin users to bypass maintenance mode
            const isAdmin = req.session?.user?.user_type === 'admin';
            
            if (!isAllowed && !isAdmin) {
                // Return 503 Service Unavailable status
                res.status(503);
                
                // Render maintenance page
                return res.render("pages/maintenance", {
                    page: 'maintenance',
                    title: i18n.translateSync('api.middleware.maintenance_mode_title', {}, req.language?.current || 'en'),
                    description: i18n.translateSync('api.middleware.maintenance_mode_description', {}, req.language?.current || 'en')
                });
            }
        }
        
        next();
    } catch (error) {
        // If there's an error checking maintenance mode, continue normally
        consoleLog('error', 'Maintenance mode check error', { error });
        next();
    }
};

export default maintenance;