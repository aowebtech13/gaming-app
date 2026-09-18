import { getSetting } from '../models/settings.js';
import { getCurrentTemplate, validateTemplate } from '../utils/templates.js';
import { consoleLog } from '../utils/logger.js';

/**
 * Template Resolution Middleware
 * 
 * This middleware dynamically resolves template paths based on the selected_template setting.
 * It overrides the res.render function to automatically prepend the correct template path.
 * 
 * @param {object} req - Express request object
 * @param {object} res - Express response object  
 * @param {function} next - Express next function
 */
const templateResolver = async (req, res, next) => {
    try {
        // 1. Check URL parameter and store in session if valid
        const urlTheme = req.query.theme;
        if (urlTheme && validateTemplate(urlTheme)) {
            req.session.selectedTheme = urlTheme;
            consoleLog('info', `Theme set via URL parameter: ${urlTheme}`, { 
                urlTheme: urlTheme,
                sessionId: req.session.id 
            });
        }
        
        // 2. Get session theme or fallback to database setting
        const sessionTheme = req.session.selectedTheme;
        const dbTheme = await getSetting('selected_template', 'default');
        
        // Use session theme if available, otherwise database setting
        const selectedTemplate = sessionTheme || dbTheme;
        
        // 3. Validate and get the current template (falls back to 'default' if invalid)
        const currentTemplate = getCurrentTemplate({ selected_template: selectedTemplate });
        
        // Store the current template in res.locals for use in templates
        res.locals.currentTemplate = currentTemplate;
        
        // Override the res.render function to automatically prepend template path
        const originalRender = res.render.bind(res);
        
        res.render = function(view, options, callback) {
            // Handle different function signatures
            let opts = options;
            let cb = callback;
            
            if (typeof options === 'function') {
                cb = options;
                opts = {};
            }
            
            opts = opts || {};
            
            // Don't modify paths for dashboard, mail, or chatroom templates
            const systemPaths = ['dashboard/', 'mail/', 'chatroom/'];
            const isSystemPath = systemPaths.some(path => view.startsWith(path));
            
            if (!isSystemPath) {
                let templatePath;
                
                // Check if the view already starts with 'default/' and replace it
                if (view.startsWith('default/')) {
                    templatePath = view.replace('default/', `${currentTemplate}/`);
                } else {
                    // Prepend the current template path to the view
                    templatePath = `${currentTemplate}/${view}`;
                }
                
                consoleLog('debug', `Resolving template path: ${view} -> ${templatePath}`, {
                    originalView: view,
                    sessionTheme: sessionTheme,
                    dbTheme: dbTheme,
                    selectedTemplate: selectedTemplate,
                    resolvedTemplate: currentTemplate,
                    finalPath: templatePath
                });
                
                return originalRender(templatePath, opts, cb);
            } else {
                // System paths remain unchanged
                return originalRender(view, opts, cb);
            }
        };
        
        next();
    } catch (error) {
        consoleLog('error', 'Template resolver middleware error', { 
            error: error.message,
            stack: error.stack,
            urlTheme: req.query.theme || 'none',
            sessionTheme: req.session?.selectedTheme || 'none',
            selectedTemplate: selectedTemplate || 'unknown'
        });
        
        // Fallback to default template on error
        res.locals.currentTemplate = 'default';
        
        // Still override render function with fallback
        const originalRender = res.render.bind(res);
        
        res.render = function(view, options, callback) {
            let opts = options;
            let cb = callback;
            
            if (typeof options === 'function') {
                cb = options;
                opts = {};
            }
            
            opts = opts || {};
            
            const systemPaths = ['dashboard/', 'mail/', 'chatroom/'];
            const isSystemPath = systemPaths.some(path => view.startsWith(path));
            
            if (!isSystemPath) {
                let templatePath;
                
                // Check if the view already starts with 'default/' and keep it as is (fallback)
                if (view.startsWith('default/')) {
                    templatePath = view;
                } else {
                    // Prepend 'default/' to the view (fallback)
                    templatePath = `default/${view}`;
                }
                
                return originalRender(templatePath, opts, cb);
            } else {
                return originalRender(view, opts, cb);
            }
        };
        
        next();
    }
};

export default templateResolver;