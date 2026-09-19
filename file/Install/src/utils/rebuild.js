import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { consoleLog } from './logger.js';

/**
 * Rebuild assets for all templates
 * @returns {Promise<Object>} Results summary with total, successful, failed counts and details
 */
export const rebuildAllTemplateAssets = async () => {
    try {
        consoleLog('info', 'Starting template asset rebuild process...');
        
        const templates = discoverTemplates();
        const results = { total: 0, successful: 0, failed: 0, details: [] };
        
        consoleLog('info', `Found ${templates.length} templates to process`, { templates });
        
        for (const templateName of templates) {
            consoleLog('info', `Processing template: ${templateName}`);
            const templateResults = await rebuildTemplateAssets(templateName);
            
            results.total += templateResults.length;
            results.successful += templateResults.filter(r => r.success).length;
            results.failed += templateResults.filter(r => !r.success).length;
            results.details.push(...templateResults);
        }
        
        consoleLog('success', `Asset rebuild completed: ${results.successful}/${results.total} successful`, {
            successful: results.successful,
            failed: results.failed,
            total: results.total
        });
        
        return results;
    } catch (error) {
        consoleLog('error', `Asset rebuild process failed: ${error.message}`, { error: error.message });
        throw error;
    }
};

/**
 * Rebuild assets for a specific template
 * @param {string} templateName - Name of the template
 * @returns {Promise<Array>} Array of build results
 */
export const rebuildTemplateAssets = async (templateName) => {
    try {
        const templatePath = path.join(process.cwd(), 'views', templateName);
        const infoPath = path.join(templatePath, 'info.json');
        
        if (fs.existsSync(infoPath)) {
            try {
                const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
                if (info.rebuild && Array.isArray(info.rebuild)) {
                    consoleLog('info', `Using rebuild config for template: ${templateName}`, {
                        assetsCount: info.rebuild.length
                    });
                    return await buildFromConfig(info.rebuild, templateName);
                }
            } catch (parseError) {
                consoleLog('warning', `Failed to parse info.json for ${templateName}, falling back to auto-detection`, {
                    templateName,
                    error: parseError.message
                });
            }
        }
        
        consoleLog('info', `Auto-detecting assets for template: ${templateName}`);
        return await autoDetectAndBuild(templateName);
    } catch (error) {
        consoleLog('error', `Failed to rebuild assets for template ${templateName}`, {
            templateName,
            error: error.message
        });
        return [{
            success: false,
            templateName,
            asset: null,
            error: error.message
        }];
    }
};

/**
 * Build assets from template rebuild configuration
 * @param {Array} rebuildConfig - Array of asset build configurations
 * @param {string} templateName - Name of the template
 * @returns {Promise<Array>} Array of build results
 */
export const buildFromConfig = async (rebuildConfig, templateName) => {
    const results = [];
    
    for (const asset of rebuildConfig) {
        const result = await executeAssetBuild(asset, templateName);
        results.push(result);
    }
    
    return results;
};

/**
 * Execute build command for a single asset
 * @param {Object} asset - Asset configuration with input, output, command
 * @param {string} templateName - Name of the template
 * @returns {Promise<Object>} Build result
 */
export const executeAssetBuild = async (asset, templateName) => {
    try {
        // Validate the build command for security
        validateCommand(asset.command);
        
        // Check if input file exists
        if (!fs.existsSync(asset.input)) {
            return {
                success: false,
                templateName,
                asset,
                error: `Input file not found: ${asset.input}`
            };
        }
        
        // Replace placeholders in the command
        const command = replaceCommandPlaceholders(asset.command, asset.input, asset.output);
        
        consoleLog('info', `Building asset for ${templateName}`, {
            templateName,
            input: asset.input,
            output: asset.output,
            command: command
        });
        
        // Execute the build command
        await new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
        
        consoleLog('success', `Asset built successfully for ${templateName}`, {
            templateName,
            input: asset.input,
            output: asset.output
        });
        
        return {
            success: true,
            templateName,
            asset,
            message: 'Built successfully'
        };
    } catch (error) {
        consoleLog('error', `Asset build failed for ${templateName}`, {
            templateName,
            input: asset.input,
            output: asset.output,
            error: error.message
        });
        
        return {
            success: false,
            templateName,
            asset,
            error: error.message
        };
    }
};

/**
 * Auto-detect and build standard assets for templates without rebuild config
 * @param {string} templateName - Name of the template
 * @returns {Promise<Array>} Array of build results
 */
export const autoDetectAndBuild = async (templateName) => {
    const results = [];
    const scssFile = `resources/css/${templateName}.scss`;
    const jsFile = `resources/js/${templateName}.js`;
    
    // Check for SCSS file and build CSS
    if (fs.existsSync(scssFile)) {
        const cssAsset = {
            input: scssFile,
            output: `public/assets/css/${templateName}.min.css`,
            command: 'tailwindcss -i {input} -o {output} --minify'
        };
        results.push(await executeAssetBuild(cssAsset, templateName));
    }
    
    // Check for JS file and build minified JS
    if (fs.existsSync(jsFile)) {
        const jsAsset = {
            input: jsFile,
            output: `public/assets/js/${templateName}.min.js`,
            command: 'terser {input} -o {output} --compress drop_console=true --mangle --comments false'
        };
        results.push(await executeAssetBuild(jsAsset, templateName));
    }
    
    if (results.length === 0) {
        consoleLog('info', `No assets found for template: ${templateName}`, { templateName });
        results.push({
            success: true,
            templateName,
            asset: null,
            message: 'No assets to build'
        });
    }
    
    return results;
};

/**
 * Discover all template directories
 * @returns {Array<string>} Array of template names
 */
export const discoverTemplates = () => {
    try {
        const viewsPath = path.join(process.cwd(), 'views');
        const excludedDirs = ['chatroom', 'dashboard', 'mail'];
        
        if (!fs.existsSync(viewsPath)) {
            consoleLog('warning', 'Views directory not found', { viewsPath });
            return [];
        }
        
        const templates = fs.readdirSync(viewsPath, { withFileTypes: true })
            .filter(item => item.isDirectory())
            .map(item => item.name)
            .filter(name => !excludedDirs.includes(name));
            
        consoleLog('info', `Discovered ${templates.length} templates`, { templates, excludedDirs });
        return templates;
    } catch (error) {
        consoleLog('error', `Failed to discover templates: ${error.message}`, { error: error.message });
        return [];
    }
};

/**
 * Validate build command for security
 * @param {string} command - Command to validate
 * @throws {Error} If command is not allowed
 */
export const validateCommand = (command) => {
    if (!command || typeof command !== 'string') {
        throw new Error('Build command must be a non-empty string');
    }
    
    // List of allowed build tools
    const allowedTools = ['tailwindcss', 'terser', 'postcss', 'sass', 'node-sass', 'webpack', 'rollup', 'esbuild'];
    const commandStart = command.trim().split(' ')[0];
    
    if (!allowedTools.includes(commandStart)) {
        throw new Error(`Unauthorized build tool: ${commandStart}. Allowed tools: ${allowedTools.join(', ')}`);
    }
    
    // Prevent command chaining and injection
    const dangerousPatterns = ['&&', '||', ';', '|', '>', '<', '$', '`', '$(', '${'];
    for (const pattern of dangerousPatterns) {
        if (command.includes(pattern)) {
            throw new Error(`Command contains forbidden pattern: ${pattern}`);
        }
    }
    
    consoleLog('info', `Command validated successfully: ${commandStart}`);
};

/**
 * Replace placeholders in build command
 * @param {string} command - Command template with placeholders
 * @param {string} input - Input file path
 * @param {string} output - Output file path
 * @returns {string} Command with placeholders replaced
 */
export const replaceCommandPlaceholders = (command, input, output) => {
    return command
        .replace(/\{input\}/g, input)
        .replace(/\{output\}/g, output);
};