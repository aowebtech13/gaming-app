import { getSetting } from '../models/settings.js';
import { consoleLog } from './logger.js';

/**
 * Format a date using the system date and time format settings
 * @param {string|Date} date - The date to format
 * @param {object} options - Formatting options
 * @param {boolean} options.includeTime - Whether to include time in the format (default: true)
 * @param {boolean} options.dateOnly - Whether to return only date (default: false)
 * @param {boolean} options.timeOnly - Whether to return only time (default: false)
 * @returns {Promise<string>} Formatted date string
 */
export const formatDate = async (date, options = {}) => {
    const { includeTime = true, dateOnly = false, timeOnly = false } = options;
    
    if (!date) return '';
    
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return '';
    
    try {
        // Get system date and time format settings
        const [dateFormat, timeFormat] = await Promise.all([
            getSetting('date_format', 'Y-m-d'),
            getSetting('time_format', 'H:i:s')
        ]);
        
        let formattedDate = '';
        let formattedTime = '';
        
        if (!timeOnly) {
            formattedDate = formatDatePart(dateObj, dateFormat);
        }
        
        if (!dateOnly && (includeTime || timeOnly)) {
            formattedTime = formatTimePart(dateObj, timeFormat);
        }
        
        if (timeOnly) return formattedTime;
        if (dateOnly) return formattedDate;
        
        return includeTime ? `${formattedDate} ${formattedTime}` : formattedDate;
    } catch (error) {
        // Fallback to default formatting if settings are not available
        consoleLog('error', 'Error formatting date', { error });
        return dateObj.toLocaleString();
    }
};

/**
 * Format just the date part according to system settings
 * @param {Date} dateObj - The date object
 * @param {string} format - The date format string
 * @returns {string} Formatted date string
 */
function formatDatePart(dateObj, format) {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthNamesShort = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    // Replace format tokens with actual values
    return format
        .replace('Y', year.toString())
        .replace('m', month.toString().padStart(2, '0'))
        .replace('d', day.toString().padStart(2, '0'))
        .replace('j', day.toString())
        .replace('F', monthNames[month - 1])
        .replace('M', monthNamesShort[month - 1]);
}

/**
 * Format just the time part according to system settings
 * @param {Date} dateObj - The date object  
 * @param {string} format - The time format string
 * @returns {string} Formatted time string
 */
function formatTimePart(dateObj, format) {
    const hours24 = dateObj.getHours();
    const hours12 = hours24 % 12 || 12;
    const minutes = dateObj.getMinutes();
    const seconds = dateObj.getSeconds();
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    
    // Replace format tokens with actual values
    return format
        .replace('H', hours24.toString().padStart(2, '0'))
        .replace('i', minutes.toString().padStart(2, '0'))
        .replace('s', seconds.toString().padStart(2, '0'))
        .replace('g', hours12.toString())
        .replace('A', ampm);
}

/**
 * Format a date for display in tables (includes time by default)
 * @param {string|Date} date - The date to format
 * @returns {Promise<string>} Formatted date string for table display
 */
export const formatTableDate = async (date) => {
    return await formatDate(date, { includeTime: true });
};

/**
 * Format a date for display without time
 * @param {string|Date} date - The date to format
 * @returns {Promise<string>} Formatted date string without time
 */
export const formatDateOnly = async (date) => {
    return await formatDate(date, { dateOnly: true });
};

/**
 * Format time only
 * @param {string|Date} date - The date to format
 * @returns {Promise<string>} Formatted time string
 */
export const formatTimeOnly = async (date) => {
    return await formatDate(date, { timeOnly: true });
};