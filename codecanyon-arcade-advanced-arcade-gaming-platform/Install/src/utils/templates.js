import fs from 'fs';
import path from 'path';
import { consoleLog } from './logger.js';

/**
 * Get available template directories from the views folder
 * Excludes system directories: chatroom, dashboard, mail
 * 
 * @returns {Array} Array of available template directory names
 */
export const getAvailableTemplates = () => {
    try {
        const viewsPath = path.join(process.cwd(), 'views');
        const excludedDirectories = ['chatroom', 'dashboard', 'mail'];
        
        // Read all directories in views folder
        const items = fs.readdirSync(viewsPath, { withFileTypes: true });
        
        // Filter to only include directories that are not excluded
        const templates = items
            .filter(item => item.isDirectory())
            .map(item => item.name)
            .filter(name => !excludedDirectories.includes(name))
            .sort(); // Sort alphabetically for consistent ordering
            
        consoleLog('info', `Discovered ${templates.length} available templates`, { templates });
        return templates;
        
    } catch (error) {
        consoleLog('error', 'Failed to discover available templates', { error: error.message });
        // Return default template as fallback
        return ['default'];
    }
};

/**
 * Validate if a template directory exists and has required structure
 * 
 * @param {string} templateName - Name of the template to validate
 * @returns {boolean} True if template is valid, false otherwise
 */
export const validateTemplate = (templateName) => {
    try {
        const templatePath = path.join(process.cwd(), 'views', templateName);
        
        // Check if template directory exists
        if (!fs.existsSync(templatePath)) {
            return false;
        }
        
        // Check if it's actually a directory
        const stat = fs.statSync(templatePath);
        if (!stat.isDirectory()) {
            return false;
        }
        
        // Check for required structure (pages directory)
        const pagesPath = path.join(templatePath, 'pages');
        if (!fs.existsSync(pagesPath)) {
            return false;
        }
        
        // Check for essential pages
        const requiredPages = ['default.ejs'];
        for (const page of requiredPages) {
            const pagePath = path.join(pagesPath, page);
            if (!fs.existsSync(pagePath)) {
                consoleLog('warning', `Template ${templateName} missing required page: ${page}`);
                return false;
            }
        }
        
        return true;
        
    } catch (error) {
        consoleLog('error', `Error validating template ${templateName}`, { error: error.message });
        return false;
    }
};

/**
 * Get the current selected template from settings, with validation
 * 
 * @param {object} settings - Settings object from database
 * @returns {string} Valid template name, defaults to 'default' if invalid
 */
export const getCurrentTemplate = (settings) => {
    const selectedTemplate = settings?.selected_template || 'default';
    
    // Validate the selected template exists and is valid
    if (validateTemplate(selectedTemplate)) {
        return selectedTemplate;
    }
    
    // Fallback to default if selected template is invalid
    consoleLog('warning', `Selected template '${selectedTemplate}' is invalid, falling back to 'default'`, {
        requestedTemplate: selectedTemplate,
        fallbackTemplate: 'default',
        availableTemplates: getAvailableTemplates()
    });
    
    // Double-check that default template exists, if not, return the first available template
    if (!validateTemplate('default')) {
        const availableTemplates = getAvailableTemplates();
        if (availableTemplates.length > 0) {
            const fallbackTemplate = availableTemplates[0];
            consoleLog('error', `Default template is invalid, using first available template: ${fallbackTemplate}`, {
                availableTemplates: availableTemplates,
                selectedFallback: fallbackTemplate
            });
            return fallbackTemplate;
        }
        
        // Critical error: no valid templates found
        consoleLog('error', 'No valid templates found, this is a critical error', {
            selectedTemplate: selectedTemplate,
            availableTemplates: availableTemplates
        });
        return 'default'; // Return 'default' anyway to prevent crashes
    }
    
    return 'default';
};

/**
 * Get template metadata from info.json file
 * 
 * @param {string} templateName - Name of the template
 * @returns {object} Template metadata from info.json or defaults
 */
export const getTemplateMetadata = (templateName) => {
    try {
        const templatePath = path.join(process.cwd(), 'views', templateName);
        const metadataPath = path.join(templatePath, 'info.json');
        
        // Default metadata
        const defaultMetadata = {
            name: templateName.charAt(0).toUpperCase() + templateName.slice(1),
            version: '1.0.0',
            author: 'Unknown',
            author_url: null,
            preview_url: null,
            preview_image: null,
            uninstall: []
        };
        
        // Try to read info.json
        if (fs.existsSync(metadataPath)) {
            try {
                const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
                const parsedMetadata = JSON.parse(metadataContent);
                return { ...defaultMetadata, ...parsedMetadata };
            } catch (error) {
                consoleLog('warning', `Failed to parse info.json for template ${templateName}`, { error: error.message });
                return defaultMetadata;
            }
        }
        
        return defaultMetadata;
        
    } catch (error) {
        consoleLog('error', `Error getting template metadata for ${templateName}`, { error: error.message });
        return {
            name: templateName.charAt(0).toUpperCase() + templateName.slice(1),
            version: '1.0.0',
            author: 'Unknown',
            author_url: null,
            preview_url: null,
            preview_image: null,
            uninstall: []
        };
    }
};

/**
 * Get all available templates with their metadata
 * 
 * @returns {Array} Array of template objects with metadata
 */
export const getAvailableTemplatesWithMetadata = () => {
    try {
        const templateNames = getAvailableTemplates();
        const templatesWithMetadata = templateNames.map(templateName => ({
            id: templateName,
            ...getTemplateMetadata(templateName)
        }));
        
        consoleLog('info', `Retrieved ${templatesWithMetadata.length} templates with metadata`);
        return templatesWithMetadata;
        
    } catch (error) {
        consoleLog('error', 'Failed to get templates with metadata', { error: error.message });
        return [];
    }
};

/**
 * Get template information with metadata
 * 
 * @param {string} templateName - Name of the template
 * @returns {object} Template information object
 */
export const getTemplateInfo = (templateName) => {
    try {
        const templatePath = path.join(process.cwd(), 'views', templateName);
        const isValid = validateTemplate(templateName);
        
        // Try to read template metadata if it exists
        let metadata = {
            name: templateName,
            displayName: templateName.charAt(0).toUpperCase() + templateName.slice(1)
        };
        
        const metadataPath = path.join(templatePath, 'template.json');
        if (fs.existsSync(metadataPath)) {
            try {
                const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
                const parsedMetadata = JSON.parse(metadataContent);
                metadata = { ...metadata, ...parsedMetadata };
            } catch (error) {
                consoleLog('warning', `Failed to parse metadata for template ${templateName}`, { error: error.message });
            }
        }
        
        return {
            ...metadata,
            isValid,
            path: templatePath
        };
        
    } catch (error) {
        consoleLog('error', `Error getting template info for ${templateName}`, { error: error.message });
        return {
            name: templateName,
            displayName: templateName,
            isValid: false,
            path: null
        };
    }
};

/**
 * Emergency template recovery function
 * Resets the selected template to a known working template
 * 
 * @param {function} upsertSetting - Settings upsert function 
 * @returns {Promise<string>} The template that was set as fallback
 */
export const emergencyTemplateRecovery = async (upsertSetting) => {
    try {
        consoleLog('warning', 'Emergency template recovery initiated');
        
        // Get all available templates
        const availableTemplates = getAvailableTemplates();
        
        // Find the first valid template
        let recoveryTemplate = 'default';
        for (const template of availableTemplates) {
            if (validateTemplate(template)) {
                recoveryTemplate = template;
                break;
            }
        }
        
        // Set the recovery template
        await upsertSetting('selected_template', recoveryTemplate);
        
        consoleLog('info', `Emergency template recovery completed, set template to: ${recoveryTemplate}`, {
            recoveryTemplate: recoveryTemplate,
            availableTemplates: availableTemplates
        });
        
        return recoveryTemplate;
        
    } catch (error) {
        consoleLog('error', 'Emergency template recovery failed', { 
            error: error.message,
            stack: error.stack
        });
        
        // Try to set default as last resort
        try {
            await upsertSetting('selected_template', 'default');
            return 'default';
        } catch (finalError) {
            consoleLog('error', 'Final fallback to default template failed', { 
                error: finalError.message 
            });
            return 'default';
        }
    }
};