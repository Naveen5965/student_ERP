// Security Configuration
const crypto = require('crypto');

const securityConfig = {
  // Password requirements
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000 // 15 minutes
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: '7d',
    issuer: 'student-erp-system',
    audience: 'student-erp-users'
  },

  // Session configuration
  session: {
    cookieName: 'student_erp_session',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },

  // CORS configuration
  cors: {
    origins: process.env.NODE_ENV === 'production'
      ? ['https://yourdomain.com']
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    standard: {
      windowMs: 15 * 60 * 1000,
      max: 100
    },
    strict: {
      windowMs: 15 * 60 * 1000,
      max: 10
    },
    auth: {
      windowMs: 15 * 60 * 1000,
      max: 5
    }
  },

  // Encryption settings
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    saltRounds: 12
  },

  // Microsoft 365 OAuth
  microsoft: {
    clientId: process.env.MS365_CLIENT_ID,
    clientSecret: process.env.MS365_CLIENT_SECRET,
    tenantId: process.env.MS365_TENANT_ID,
    redirectUri: process.env.MS365_REDIRECT_URI,
    scopes: [
      'https://graph.microsoft.com/User.Read',
      'https://graph.microsoft.com/User.ReadWrite',
      'https://graph.microsoft.com/Mail.Send'
    ],
    endpoints: {
      authorization: `https://login.microsoftonline.com/${process.env.MS365_TENANT_ID}/oauth2/v2.0/authorize`,
      token: `https://login.microsoftonline.com/${process.env.MS365_TENANT_ID}/oauth2/v2.0/token`,
      graph: 'https://graph.microsoft.com/v1.0'
    }
  },

  // Security headers
  headers: {
    contentSecurityPolicy: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://code.jquery.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'https://api.phonepe.com', 'https://graph.microsoft.com'],
      'frame-src': ["'self'", 'https://forms.microsoft.com']
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  },

  // Audit logging
  audit: {
    enabled: true,
    logLevel: 'info',
    sensitiveFields: ['password', 'token', 'secret', 'key'],
    retentionDays: 90
  },

  // File upload security
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    maxFiles: 5,
    virusScan: true
  }
};

// Validation functions
securityConfig.validatePassword = (password) => {
  const errors = [];

  if (password.length < securityConfig.password.minLength) {
    errors.push(`Password must be at least ${securityConfig.password.minLength} characters long`);
  }

  if (securityConfig.password.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (securityConfig.password.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (securityConfig.password.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (securityConfig.password.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Generate secure random token
securityConfig.generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Hash sensitive data
securityConfig.hashData = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

module.exports = securityConfig;