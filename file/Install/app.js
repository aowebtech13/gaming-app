import { fileExists } from './src/utils/file.js';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import csrf from 'csrf';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs/promises'; // Using fs/promises for async file operations
import http from 'http';
import globals from './src/middlewares/globals.js';
import maintenance from './src/middlewares/maintenance.js';
import languageMiddleware from './src/middlewares/language.js';
import templateResolver from './src/middlewares/template_resolver.js';
import { initWebSocketServer, closeWebSocketServer } from './src/utils/websocket.js';
import { consoleLog } from './src/utils/logger.js';
import { closePool } from './src/utils/mysql.js';
import CacheUtils from './src/utils/cache.js';
import passport from 'passport';
import { initializePassport } from './src/utils/passport.js';
import i18n from './src/utils/i18n.js';

const envFileExist = await fileExists('.env');

if (!envFileExist) {
  consoleLog('error', 'The .env file does not exist. Please create it with appropriate configurations.');
  process.exit(1); // Exit the process
}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Initialize CSRF protection
const csrfProtection = csrf({
  algorithm: 'sha256',
  hmacKey: process.env.SESSION_SECRET || 'default-hmac-key',
  saltLength: 8,
  secretLength: 18
});

// Security middleware - Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'", // Required for EmulatorJS and gaming functionality
        "'unsafe-hashes'", // Required for inline event handlers (onclick, etc.)
        "blob:",
        "data:",
        "*.googleapis.com",
        "*.gstatic.com",
        "www.google.com", // Required for reCAPTCHA
        "*.googlesyndication.com", // Required for AdSense (includes pagead2.googlesyndication.com)
        "*.doubleclick.net", // Required for AdSense ad serving
        "*.googleadservices.com", // Required for AdSense partner services
        "*.googletagservices.com", // Required for AdSense tag services
        "adservice.google.com", // Required for AdSense core service
        "*.google", // Required for AdSense ad traffic quality scripts (ep1/ep2.adtrafficquality.google)
        "*.google.com", // Required for all Google services including AdSense, Funding Choices, etc.
        "accounts.google.com", // Required for Google Identity Services
        "*.facebook.com",
        "connect.facebook.net"
      ],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers (onclick, etc.)
      styleSrc: ["'self'", "'unsafe-inline'", "*.googleapis.com", "*.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "*"], // Allow all image sources for game assets
      connectSrc: [
        "'self'", 
        "*.facebook.com",
        "*.fbcdn.net", // Required for Facebook CDN assets
        "*.facebook.net", // Required for Facebook network endpoints
        "*.google.com",
        "accounts.google.com", // Required for Google Identity Services
        "oauth2.googleapis.com", // Required for Google OAuth token endpoints
        "*.googlesyndication.com", // Required for AdSense connections (includes pagead2.googlesyndication.com)
        "*.doubleclick.net", // Required for AdSense ad serving connections
        "*.google", // Required for AdSense ad traffic quality (ep1.adtrafficquality.google)
        "*.google.com", // Required for all Google services
        "*.emulatorjs.org",
        "cdn.emulatorjs.org",
        "blob:",
        "data:"
      ],
      fontSrc: ["'self'", "*.googleapis.com", "*.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:", "data:"],
      frameSrc: [
        "'self'", 
        "*.facebook.com",
        "accounts.google.com", // Required for Google OAuth consent screens
        "*.google.com", 
        "googleads.g.doubleclick.net", // Required for AdSense ad frames
        "tpc.googlesyndication.com", // Required for AdSense privacy/compliance
        "*" // Allow all iframe sources for embedded games
      ],
      frameAncestors: [
        "'self'",
        "*.google.com", // Allow Google/AdSense to frame parts of the site
        "*.googlesyndication.com", // Allow AdSense to frame content
        "*.doubleclick.net" // Allow DoubleClick to frame content
      ],
      workerSrc: ["'self'", "blob:"],
      upgradeInsecureRequests: process.env.ENVIRONMENT === 'production' ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false, // Disabled for gaming content compatibility
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false, // Disabled to prevent the warning on non-HTTPS origins
  originAgentCluster: false // Disabled to prevent agent cluster warnings
}));

// Additional security headers for development to prevent console warnings
if (process.env.ENVIRONMENT !== 'production') {
  app.use((req, res, next) => {
    // Prevent Cross-Origin-Opener-Policy warnings on HTTP development
    res.removeHeader('Cross-Origin-Opener-Policy');
    // Prevent Origin-Agent-Cluster warnings 
    res.removeHeader('Origin-Agent-Cluster');
    next();
  });
}

// Rate limiting configuration from environment variables
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // Default: 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Default: 1000 requests per window
  message: (req) => ({
    error: i18n.translateSync('errors.rate_limit', {}, req.language?.current || 'en'),
    code: 'RATE_LIMIT_EXCEEDED'
  }),
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // Default: 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5, // Default: 5 attempts per window
  message: (req) => ({
    error: i18n.translateSync('errors.auth_rate_limit', {}, req.language?.current || 'en'),
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }),
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use('/requests/', limiter); // API endpoints are under /requests/
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
app.use('/auth/forgot-password', authLimiter);
app.use('/auth/reset-password', authLimiter);

// CORS configuration with origin restrictions
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    // In production, restrict to your domains
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:8080']; // Default for development

    if (allowedOrigins.indexOf(origin) !== -1 || process.env.ENVIRONMENT !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token']
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.urlencoded({
  extended: true,
  limit: process.env.BODY_SIZE_LIMIT || '100mb' // Configurable body size limit
}));
app.use(express.json({
  limit: process.env.JSON_SIZE_LIMIT || '10mb' // Configurable JSON body size limit
}));

// Static file serving
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Secure session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true, // Need to save for CSRF tokens to work
  name: 'arcade.sid', // Change default session name
  cookie: {
    secure: process.env.ENVIRONMENT === 'production', // Use secure cookies in production
    httpOnly: true, // Prevent XSS attacks
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // CSRF protection
  }
}));

// Initialize Passport.js for OAuth
app.use(passport.initialize());
app.use(passport.session());
await initializePassport();

// CSRF token generation middleware (always provide token)
app.use((req, res, next) => {
  // Always create and provide CSRF token for session
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = csrfProtection.secretSync();
  }
  
  const token = csrfProtection.create(req.session.csrfSecret);
  res.locals.csrfToken = token;
  
  next();
});

// CSRF verification middleware function (to be used in routes)
const verifyCSRF = (req, res, next) => {
  // Skip verification for GET requests and specific paths
  if (req.method === 'GET' || 
      req.path.startsWith('/uploads/') ||
      req.path.startsWith('/auth/facebook') ||
      req.path.startsWith('/auth/google')) {
    return next();
  }

  try {
    const providedToken = req.body._csrf || req.query._csrf || req.headers['x-csrf-token'];
    
    if (!providedToken) {
      const error = new Error('CSRF token missing');
      error.code = 'EBADCSRFTOKEN';
      throw error;
    }

    if (!csrfProtection.verify(req.session.csrfSecret, providedToken)) {
      const error = new Error('CSRF token mismatch');
      error.code = 'EBADCSRFTOKEN';
      throw error;
    }

    next();
  } catch (err) {
    if (err.code === 'EBADCSRFTOKEN') {
      res.status(403).json({ error: i18n.translateSync('errors.csrf_expired', {}, req.language?.current || 'en'), code: 'CSRF_INVALID' });
    } else {
      next(err);
    }
  }
};

// Make CSRF verification available to routes
app.use((req, res, next) => {
  req.verifyCSRF = verifyCSRF;
  next();
});

// Application middleware
app.use(languageMiddleware);
app.use(globals);
app.use(templateResolver);
app.use(maintenance);
app.set('view engine', 'ejs');
// Trust proxy configuration - be specific to avoid rate limiting bypass
app.set('trust proxy', process.env.ENVIRONMENT === 'production' ? 1 : false);

// Dynamically include routes
const routesDir = path.join(__dirname, 'src', 'routers');
const files = await fs.readdir(routesDir);

for (const file of files) {
  if (file != 'default.js' && file.endsWith('.js')) {
    const routeModule = await import(path.join(routesDir, file));
    const routePath = `/${path.basename(file, '.js')}`;
    consoleLog('server', `Adding route: ${routePath}`);
    app.use(routePath, routeModule.default);
  } else {
    // Root route
    const rootModule = await import(path.join(routesDir, 'default.js'));
    app.use('/', rootModule.default);
  }
}

app.all("*", (req, res) => {
  const pageData = {
    page: "errors",
    title: "404",
    description: i18n.translateSync('errors.404_description', {}, req.language?.current || 'en')
  };

  res.render("pages/errors/404", pageData);
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
initWebSocketServer(server);

// Start the server
server.listen(process.env.SERVER_PORT, () => {
  consoleLog('server', `Server is running on port ${process.env.SERVER_PORT}`);
});

// Graceful shutdown handlers
async function gracefulShutdown(signal) {
  consoleLog('server', `Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Stop accepting new connections
    server.close(async () => {
      consoleLog('server', 'HTTP server closed');
      
      // Close WebSocket connections
      closeWebSocketServer();
      
      // Clean up cache instances
      await CacheUtils.cleanupUnusedCaches(0); // Clean all caches on shutdown
      
      // Close database connection pool
      await closePool();
      
      consoleLog('server', 'Graceful shutdown completed');
      process.exit(0);
    });
    
    // Force exit after 3 seconds if graceful shutdown fails
    setTimeout(() => {
      consoleLog('error', 'Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 3000);
    
  } catch (error) {
    consoleLog('error', 'Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
}

// Handle different shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Nodemon restart

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  consoleLog('error', 'Uncaught Exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  consoleLog('error', 'Unhandled Rejection', { reason, promise });
  gracefulShutdown('unhandledRejection');
});