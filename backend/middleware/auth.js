const jwt = require('jsonwebtoken');
const User = require('../../database/models').User;

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Role-based Authorization Middleware
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Insufficient permissions',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

// Admin only access
const requireAdmin = authorizeRoles('admin', 'super_admin');

// Staff and Admin access
const requireStaff = authorizeRoles('admin', 'super_admin', 'staff');

// Student access
const requireStudent = authorizeRoles('admin', 'super_admin', 'staff', 'student');

// Microsoft 365 OAuth verification (placeholder for future implementation)
const verifyMicrosoftToken = async (req, res, next) => {
  const token = req.headers['x-ms-token'];

  if (!token) {
    return next(); // Continue without Microsoft verification if not provided
  }

  try {
    // Placeholder for Microsoft Graph API verification
    // In production, verify token with Microsoft Graph API
    const isValid = await verifyWithMicrosoftGraph(token);

    if (!isValid) {
      return res.status(401).json({ message: 'Invalid Microsoft token' });
    }

    req.microsoftUser = await getMicrosoftUserInfo(token);
    next();
  } catch (error) {
    console.error('Microsoft token verification error:', error);
    return res.status(500).json({ message: 'Authentication service error' });
  }
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://code.jquery.com; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://api.phonepe.com https://graph.microsoft.com; " +
    "frame-src 'self' https://forms.microsoft.com;"
  );

  // HSTS (HTTP Strict Transport Security)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

// Rate limiting helper (basic implementation)
const rateLimitStore = new Map();

const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, []);
    }

    const requests = rateLimitStore.get(key);
    const recentRequests = requests.filter(time => time > windowStart);

    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
      });
    }

    recentRequests.push(now);
    rateLimitStore.set(key, recentRequests);

    next();
  };
};

// Input validation helper
const validateInput = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

// Audit logging middleware
const auditLog = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    user: req.user ? req.user.id : 'anonymous'
  };

  console.log('AUDIT:', JSON.stringify(logEntry));

  // In production, save to database or external logging service
  next();
};

// Placeholder functions for Microsoft integration
async function verifyWithMicrosoftGraph(token) {
  // Placeholder - implement actual Microsoft Graph API verification
  return true;
}

async function getMicrosoftUserInfo(token) {
  // Placeholder - implement actual Microsoft user info retrieval
  return {
    id: 'ms-user-id',
    email: 'user@microsoft.com',
    name: 'Microsoft User'
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles,
  requireAdmin,
  requireStaff,
  requireStudent,
  verifyMicrosoftToken,
  securityHeaders,
  rateLimit,
  validateInput,
  auditLog
};