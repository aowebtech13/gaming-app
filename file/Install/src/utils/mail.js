import nodemailer from 'nodemailer';
import { getSetting } from '../models/settings.js';
import { consoleLog } from './logger.js';
import executeQuery from './mysql.js';
import ejs from 'ejs';
import path from 'path';
import { fileURLToPath } from 'url';
import i18n from './i18n.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let transporter = null;

/**
 * Render email template using EJS with translation support
 * @param {string} templateName - Name of the template file (without .ejs extension)
 * @param {Object} data - Data to pass to the template
 * @param {string} languageCode - Language code for translations (default: 'en')
 * @returns {Promise<string>} Rendered HTML
 */
const renderEmailTemplate = async (templateName, data, languageCode = 'en') => {
    try {
        const templatePath = path.join(__dirname, '../../views/mail', `${templateName}.ejs`);
        
        // Add translation support to template data
        const templateData = {
            ...data,
            __: (key, vars) => i18n.translateSync(key, vars, languageCode),
            currentLanguage: languageCode,
            isRTL: await i18n.isRTL(languageCode)
        };
        
        return await ejs.renderFile(templatePath, templateData);
    } catch (error) {
        consoleLog('error', 'Failed to render email template', { 
            template: templateName, 
            error: error.message 
        });
        throw error;
    }
};

/**
 * Initialize the email transporter based on current settings
 */
export const initializeMailer = async () => {
    try {
        const smtpEnabled = await getSetting('enable_smtp', '0');
        
        if (smtpEnabled !== '1') {
            transporter = null;
            return false;
        }

        const [host, port, secure, username, password, fromEmail, fromName] = await Promise.all([
            getSetting('smtp_host', ''),
            getSetting('smtp_port', '587'),
            getSetting('smtp_secure', '0'),
            getSetting('smtp_username', ''),
            getSetting('smtp_password', ''),
            getSetting('smtp_from_email', ''),
            getSetting('smtp_from_name', '')
        ]);

        if (!host || !username || !password || !fromEmail) {
            consoleLog('error', 'SMTP settings incomplete - missing required fields');
            return false;
        }

        transporter = nodemailer.createTransport({
            host: host,
            port: parseInt(port),
            secure: secure === '1', // true for 465, false for other ports
            auth: {
                user: username,
                pass: password
            },
            tls: {
                rejectUnauthorized: false // Allow self-signed certificates
            }
        });

        // Verify the connection
        const verified = await transporter.verify();
        if (verified) {
            return true;
        } else {
            consoleLog('error', 'SMTP verification failed');
            transporter = null;
            return false;
        }
    } catch (error) {
        consoleLog('error', 'Failed to initialize SMTP transporter', { error: error.message });
        return false;
    }
};

/**
 * Send an email using the configured transporter
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional)
 * @param {string} options.template - Template name for logging (optional)
 * @param {string} options.recipientName - Recipient name for logging (optional)
 */
export const sendEmail = async (options) => {
    try {
        // Always initialize transporter to use latest settings
        const initialized = await initializeMailer();
        if (!initialized) {
            throw new Error('SMTP not configured or disabled');
        }

        const fromEmail = await getSetting('smtp_from_email', '');
        const fromName = await getSetting('smtp_from_name', '');

        const mailOptions = {
            from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text || options.html.replace(/<[^>]*>/g, '') // Strip HTML for text version
        };

        // Log email attempt
        await logEmail({
            recipientEmail: options.to,
            recipientName: options.recipientName || '',
            subject: options.subject,
            template: options.template || '',
            status: 'pending'
        });

        const info = await transporter.sendMail(mailOptions);
        
        // Log successful send
        await updateEmailLog(options.to, options.subject, 'sent', null);
        
        consoleLog('info', 'Email sent successfully', { 
            to: options.to, 
            subject: options.subject,
            messageId: info.messageId 
        });
        
        return { success: true, messageId: info.messageId };
    } catch (error) {
        // Log failed send
        await updateEmailLog(options.to, options.subject, 'failed', error.message);
        
        consoleLog('error', 'Failed to send email', { 
            to: options.to, 
            subject: options.subject,
            error: error.message 
        });
        
        return { success: false, error: error.message };
    }
};

/**
 * Send password reset email
 * @param {string} email - User email
 * @param {string} name - User name
 * @param {string} resetToken - Password reset token
 * @param {string} siteName - Site name
 * @param {string} languageCode - Language code for email (default: 'en')
 * @param {Object} req - Express request object for URL construction
 */
export const sendPasswordResetEmail = async (email, name, resetToken, siteName, languageCode = 'en', req = null) => {
    const baseUrl = req ? `${req.protocol}://${req.get('host')}` : 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password/${resetToken}`;
    
    const templateData = {
        siteName,
        name,
        resetUrl,
        currentYear: new Date().getFullYear()
    };
    
    const html = await renderEmailTemplate('password-reset', templateData, languageCode);
    
    // Get translated subject
    const subject = i18n.translateSync('email.reset_title', {}, languageCode);

    return await sendEmail({
        to: email,
        subject: `${subject} - ${siteName}`,
        html: html,
        template: 'password-reset',
        recipientName: name
    });
};

/**
 * Send welcome email to new users
 * @param {string} email - User email
 * @param {string} name - User name
 * @param {string} siteName - Site name
 * @param {string} languageCode - Language code for email (default: 'en')
 * @param {Object} req - Express request object for URL construction
 */
export const sendWelcomeEmail = async (email, name, siteName, languageCode = 'en', req = null) => {
    const baseUrl = req ? `${req.protocol}://${req.get('host')}` : 'http://localhost:3000';
    const templateData = {
        siteName,
        name,
        siteUrl: baseUrl,
        currentYear: new Date().getFullYear()
    };
    
    const html = await renderEmailTemplate('welcome', templateData, languageCode);
    
    // Get translated subject
    const subject = i18n.translateSync('email.welcome_subject', { siteName }, languageCode);

    return await sendEmail({
        to: email,
        subject: subject,
        html: html,
        template: 'welcome',
        recipientName: name
    });
};

/**
 * Send email verification email
 * @param {string} email - User email
 * @param {string} name - User name
 * @param {string} verificationToken - Email verification token
 * @param {string} siteName - Site name
 * @param {string} languageCode - Language code for email (default: 'en')
 * @param {Object} req - Express request object for URL construction
 */
export const sendEmailVerificationEmail = async (email, name, verificationToken, siteName, languageCode = 'en', req = null) => {
    const baseUrl = req ? `${req.protocol}://${req.get('host')}` : 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/verify-email/${verificationToken}`;
    
    const templateData = {
        siteName,
        name,
        verificationUrl,
        currentYear: new Date().getFullYear()
    };
    
    const html = await renderEmailTemplate('email-verification', templateData, languageCode);
    
    // Get translated subject
    const subject = i18n.translateSync('email.verify_title', {}, languageCode);

    return await sendEmail({
        to: email,
        subject: `${subject} - ${siteName}`,
        html: html,
        template: 'email-verification',
        recipientName: name
    });
};

/**
 * Log email to database
 * @param {Object} emailData - Email data for logging
 */
const logEmail = async (emailData) => {
    try {
        const query = `
            INSERT INTO email_logs (recipient_email, recipient_name, subject, template, status) 
            VALUES (?, ?, ?, ?, ?)
        `;
        await executeQuery(query, [
            emailData.recipientEmail,
            emailData.recipientName,
            emailData.subject,
            emailData.template,
            emailData.status
        ]);
    } catch (error) {
        consoleLog('error', 'Failed to log email', { error: error.message });
    }
};

/**
 * Update email log status
 * @param {string} email - Recipient email
 * @param {string} subject - Email subject
 * @param {string} status - New status
 * @param {string} errorMessage - Error message if failed
 */
const updateEmailLog = async (email, subject, status, errorMessage = null) => {
    try {
        const query = `
            UPDATE email_logs 
            SET status = ?, error_message = ?, sent_at = ${status === 'sent' ? 'NOW()' : 'NULL'}
            WHERE recipient_email = ? AND subject = ? AND status = 'pending' 
            ORDER BY created_at DESC LIMIT 1
        `;
        await executeQuery(query, [status, errorMessage, email, subject]);
    } catch (error) {
        consoleLog('error', 'Failed to update email log', { error: error.message });
    }
};


export default {
    initializeMailer,
    sendEmail,
    sendPasswordResetEmail,
    sendWelcomeEmail,
    sendEmailVerificationEmail
};