// utils/sanitize.js
import executeQuery from './mysql.js';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import validator from 'validator';
import { consoleLog } from './logger.js';

// Initialize DOMPurify with JSDOM for server-side use
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Configure DOMPurify with safe defaults
const purifyConfig = {
    ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'i', 'b', 'span', 'div',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre'
    ],
    ALLOWED_ATTR: ['class', 'id'],
    FORBID_TAGS: ['script', 'object', 'embed', 'link', 'style', 'meta'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    USE_PROFILES: { html: true }
};

// Configure DOMPurify for advertisement content (allow everything)
const adPurifyConfig = {
    ALLOWED_TAGS: false, // Allow all tags
    ALLOWED_ATTR: false, // Allow all attributes
    FORBID_TAGS: [], // Don't forbid any tags
    FORBID_ATTR: [], // Don't forbid any attributes
    ADD_TAGS: ['script'], // Explicitly allow script tags
    ADD_ATTR: ['crossorigin', 'async', 'defer', 'src'], // Allow script attributes
    ALLOW_UNKNOWN_PROTOCOLS: true, // Allow unknown protocols in URLs
    USE_PROFILES: { html: true }
};

// Strict config for text-only content
const strictPurifyConfig = {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
};

/**
 * Sanitizes request body with comprehensive validation and sanitization
 * @param {Object} body - Request body object
 * @param {Array} excludeFields - Fields to skip sanitization (for rich text content)
 * @param {Object} options - Sanitization options
 * @returns {Object} Sanitized body object
 */
const sanitizeRequestBody = (body, excludeFields = [], options = {}) => {
    if (typeof body !== 'object' || body === null) {
        return {};
    }
    
    const sanitizedBody = {};
    const { allowHtml = false, strict = true } = options;
    
    for (const [key, value] of Object.entries(body)) {
        try {
            if (excludeFields.includes(key)) {
                // Skip sanitization entirely for ad code fields to preserve script tags
                const isAdCode = key === 'ad_code' || key === 'fallback_ad_code';
                if (isAdCode) {
                    sanitizedBody[key] = value; // Preserve ad code exactly as submitted
                } else {
                    // Apply HTML sanitization for other excluded fields (rich text content)
                    sanitizedBody[key] = typeof value === 'string' ? sanitizeHtml(value, false) : value;
                }
            } else if (typeof value === 'string') {
                sanitizedBody[key] = allowHtml ? sanitizeHtml(value, false) : sanitizeString(value, strict);
            } else if (typeof value === 'number') {
                sanitizedBody[key] = sanitizeNumber(value);
            } else if (Array.isArray(value)) {
                sanitizedBody[key] = value.map(item => 
                    typeof item === 'string' ? sanitizeString(item, strict) : item
                );
            } else {
                sanitizedBody[key] = value; // Keep other types as-is
            }
        } catch (error) {
            // Log sanitization errors and exclude problematic fields
            consoleLog('warn', `Sanitization failed for field '${key}'`, { error: error.message });
            // Don't include the field if sanitization fails
        }
    }
    
    return sanitizedBody;
};

/**
 * Sanitizes HTML content using DOMPurify
 * @param {string} input - HTML string to sanitize
 * @param {boolean} strict - Use strict mode (text only)
 * @param {Object} customConfig - Custom DOMPurify configuration
 * @returns {string} Sanitized HTML string
 */
const sanitizeHtml = (input, strict = false, customConfig = null) => {
    if (typeof input !== 'string') {
        throw new Error('Input must be a string');
    }
    
    const config = customConfig || (strict ? strictPurifyConfig : purifyConfig);
    return DOMPurify.sanitize(input.trim(), config);
};

/**
 * Sanitizes plain text strings by removing HTML and normalizing content
 * @param {string} input - String to sanitize
 * @param {boolean} strict - Apply strict validation
 * @returns {string} Sanitized string
 */
const sanitizeString = (input, strict = true) => {
    if (typeof input !== 'string') {
        throw new Error('Input must be a string');
    }
    
    // First pass: Remove HTML tags using DOMPurify
    let sanitized = DOMPurify.sanitize(input, strictPurifyConfig);
    
    // Second pass: Additional security measures
    sanitized = sanitized
        .trim()
        // Remove null bytes and control characters
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        // Remove potential script injection patterns
        .replace(/javascript:/gi, '')
        .replace(/data:/gi, '')
        .replace(/vbscript:/gi, '');
    
    if (strict) {
        // Additional strict validation
        if (sanitized.length > 10000) { // Prevent extremely long strings
            throw new Error('Input string too long');
        }
        
        // Check for suspicious patterns
        const suspiciousPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+\s*=/i,
            /expression\s*\(/i,
            /url\s*\(/i,
            /import\s*\(/i
        ];
        
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(sanitized)) {
                throw new Error('Input contains suspicious content');
            }
        }
    }
    
    return sanitized;
};

/**
 * Validates and sanitizes email addresses
 * @param {string} input - Email string to validate
 * @returns {string|false} Sanitized email or false if invalid
 */
const sanitizeEmail = (input) => {
    if (typeof input !== 'string') {
        return false;
    }
    
    const sanitized = validator.normalizeEmail(input.trim(), {
        gmail_lowercase: true,
        gmail_remove_dots: false,
        outlookdotcom_lowercase: true,
        yahoo_lowercase: true,
        icloud_lowercase: true
    });
    
    if (!sanitized || !validator.isEmail(sanitized, {
        allow_display_name: false,
        require_display_name: false,
        allow_utf8_local_part: false,
        require_tld: true,
        ignore_max_length: false
    })) {
        return false;
    }
    
    return sanitized;
};

/**
 * Validates and sanitizes numeric input
 * @param {string|number} input - Numeric input to validate
 * @param {Object} options - Validation options
 * @returns {number} Sanitized number
 */
const sanitizeNumber = (input, options = {}) => {
    if (typeof input !== 'string' && typeof input !== 'number') {
        throw new Error('Input must be a string or number');
    }
    
    const { min, max, allowFloat = true } = options;
    
    // Convert to string for validation
    const inputStr = String(input).trim();
    
    // Validate numeric format
    if (!allowFloat && !validator.isInt(inputStr)) {
        throw new Error('Input must be an integer');
    }
    
    if (allowFloat && !validator.isNumeric(inputStr, { no_symbols: true })) {
        throw new Error('Input must be a valid number');
    }
    
    const sanitized = allowFloat ? parseFloat(inputStr) : parseInt(inputStr, 10);
    
    if (isNaN(sanitized)) {
        throw new Error('Invalid number');
    }
    
    // Range validation
    if (typeof min === 'number' && sanitized < min) {
        throw new Error(`Number must be at least ${min}`);
    }
    
    if (typeof max === 'number' && sanitized > max) {
        throw new Error(`Number must be at most ${max}`);
    }
    
    return sanitized;
};

/**
 * Validates and sanitizes URL input
 * @param {string} input - URL string to validate
 * @param {Object} options - Validation options
 * @returns {string} Sanitized URL
 */
const sanitizeURL = (input, options = {}) => {
    if (typeof input !== 'string') {
        throw new Error('Input must be a string');
    }
    
    const { 
        protocols = ['http', 'https'],
        require_protocol = true,
        allow_underscores = false,
        allow_trailing_dot = false
    } = options;
    
    const sanitized = input.trim();
    
    if (!validator.isURL(sanitized, {
        protocols,
        require_protocol,
        require_host: true,
        require_port: false,
        require_valid_protocol: true,
        allow_underscores,
        allow_trailing_dot,
        allow_protocol_relative_urls: false
    })) {
        throw new Error('Invalid URL format');
    }
    
    // Additional security check for potentially malicious URLs
    const url = new URL(sanitized);
    const suspiciousPatterns = [
        /javascript:/i,
        /data:/i,
        /vbscript:/i,
        /file:/i
    ];
    
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(url.protocol)) {
            throw new Error('URL protocol not allowed');
        }
    }
    
    return sanitized;
};

/**
 * Enhanced email validation
 * @param {string} input - Email to validate
 * @returns {boolean} True if valid email
 */
const isEmail = (input) => {
    if (typeof input !== 'string') {
        return false;
    }
    
    return validator.isEmail(input.trim(), {
        allow_display_name: false,
        require_display_name: false,
        allow_utf8_local_part: false,
        require_tld: true
    });
};

/**
 * Enhanced URL validation
 * @param {string} input - URL to validate
 * @param {Object} options - Validation options
 * @returns {boolean} True if valid URL
 */
const isURL = (input, options = {}) => {
    if (typeof input !== 'string') return false;
    
    const { protocols = ['http', 'https'] } = options;
    
    return validator.isURL(input.trim(), {
        protocols,
        require_protocol: true,
        require_host: true,
        require_valid_protocol: true
    });
};

/**
 * Enhanced integer validation
 * @param {string|number} input - Value to validate
 * @param {Object} options - Validation options
 * @returns {boolean} True if valid integer
 */
const isInt = (input, options = {}) => {
    if (typeof input !== 'string' && typeof input !== 'number') {
        return false;
    }
    
    const { min, max } = options;
    
    return validator.isInt(String(input), { min, max });
};

/**
 * Validates if input contains only alphanumeric characters
 * @param {string} input - String to validate
 * @param {string} locale - Locale for validation
 * @returns {boolean} True if alphanumeric
 */
const isAlphanumeric = (input, locale = 'en-US') => {
    if (typeof input !== 'string') return false;
    return validator.isAlphanumeric(input, locale);
};

/**
 * Validates strong password requirements
 * @param {string} input - Password to validate
 * @returns {boolean} True if password meets requirements
 */
const isStrongPassword = (input) => {
    if (typeof input !== 'string') return false;
    
    return validator.isStrongPassword(input, {
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
        returnScore: false
    });
};

/**
 * Generates URL-safe slug from input string
 * @param {string} input - String to convert to slug
 * @returns {string} URL-safe slug
 */
const generateSlug = (input) => {
    if (typeof input !== 'string') {
        throw new Error('Input must be a string');
    }
    
    // Basic sanitization - remove dangerous characters but preserve Unicode
    let sanitized = input
        .trim()
        // Remove null bytes and control characters
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Remove potential script injection patterns
        .replace(/javascript:/gi, '')
        .replace(/data:/gi, '')
        .replace(/vbscript:/gi, '');
    
    return sanitized
        .toLowerCase()
        .trim()
        // Only remove truly dangerous characters, keep Unicode letters/numbers
        .replace(/[<>'"&\x00-\x1F\x7F]/g, '')
        // Replace spaces with hyphens
        .replace(/\s+/g, '-')
        // Replace multiple hyphens with single hyphen
        .replace(/-+/g, '-')
        // Remove leading and trailing hyphens
        .replace(/^-|-$/g, '')
        // Limit length
        .substring(0, 100);
};

/**
 * Generates unique slug by checking database for duplicates
 * @param {string} input - String to convert to slug
 * @param {string} tableName - Database table to check for uniqueness
 * @param {number|null} excludeId - ID to exclude from uniqueness check
 * @returns {Promise<string>} Unique slug
 */
const generateUniqueSlug = async (input, tableName, excludeId = null) => {
    // Validate table name to prevent SQL injection
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw new Error('Invalid table name');
    }
    
    let baseSlug = generateSlug(input);
    if (!baseSlug) {
        baseSlug = 'item'; // Fallback for empty slugs
    }
    
    let slug = baseSlug;
    let counter = 1;
    
    // Keep trying until we find a unique slug (with safety limit)
    while (counter < 1000) { // Prevent infinite loops
        let query = `SELECT COUNT(*) as count FROM ?? WHERE slug = ?`;
        let params = [tableName, slug];
        
        // Exclude current record when updating
        if (excludeId) {
            query += ' AND id != ?';
            params.push(excludeId);
        }
        
        const result = await executeQuery(query, params);
        
        if (result[0].count === 0) {
            return slug;
        }
        
        // If slug exists, try with counter
        slug = `${baseSlug}-${counter}`;
        counter++;
    }
    
    // If we couldn't find a unique slug, append timestamp
    return `${baseSlug}-${Date.now()}`;
};

export { 
    sanitizeRequestBody,
    sanitizeString,
    sanitizeHtml,
    sanitizeEmail, 
    sanitizeNumber, 
    sanitizeURL,
    isEmail, 
    isURL,
    isInt,
    isAlphanumeric,
    isStrongPassword,
    generateSlug,
    generateUniqueSlug
};