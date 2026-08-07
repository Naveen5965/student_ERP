const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../database/models').User;
const { authenticateToken, requireAdmin, auditLog } = require('../middleware/auth');
const notificationUtils = require('../services/notificationUtils');

const router = express.Router();

// ==================== PASSWORD VALIDATION ====================

// Strong password requirements
const passwordRequirements = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  commonPasswords: [
    'password', '12345678', 'qwerty123', 'admin123', 'letmein',
    'welcome', 'monkey', 'dragon', 'master', 'login123',
    'password123', 'admin@123', 'test@123', 'user@123'
  ]
};

// Validate password strength
const validatePasswordStrength = (password) => {
  const errors = [];
  const requirements = passwordRequirements;

  if (!password || password.length < requirements.minLength) {
    errors.push(`Password must be at least ${requirements.minLength} characters long`);
  }

  if (password && password.length > requirements.maxLength) {
    errors.push(`Password must be less than ${requirements.maxLength} characters`);
  }

  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (requirements.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (requirements.requireSpecialChars) {
    const specialRegex = new RegExp(`[${requirements.specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`);
    if (!specialRegex.test(password)) {
      errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
    }
  }

  // Check for common passwords
  if (requirements.commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a stronger password');
  }

  // Check for sequential characters
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password should not contain more than 2 consecutive identical characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength: calculatePasswordStrength(password)
  };
};

// Calculate password strength score
const calculatePasswordStrength = (password) => {
  if (!password) return { score: 0, label: 'Very Weak' };

  let score = 0;

  // Length scoring
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 2;

  // Diversity bonus
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= password.length * 0.7) score += 1;

  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const normalizedScore = Math.min(Math.floor(score / 2), 5);

  return {
    score: normalizedScore,
    label: labels[normalizedScore]
  };
};

// ==================== REFRESH TOKEN MANAGEMENT ====================

// Store for refresh tokens (in production, use Redis or database)
const refreshTokens = new Map();

// Generate refresh token
const generateRefreshToken = (userId) => {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  refreshTokens.set(token, {
    userId,
    expiresAt,
    createdAt: new Date()
  });

  return token;
};

// Validate refresh token
const validateRefreshToken = (token) => {
  const tokenData = refreshTokens.get(token);
  if (!tokenData) return null;

  if (new Date() > tokenData.expiresAt) {
    refreshTokens.delete(token);
    return null;
  }

  return tokenData;
};

// Revoke refresh token
const revokeRefreshToken = (token) => {
  refreshTokens.delete(token);
};

// Revoke all refresh tokens for user
const revokeAllUserTokens = (userId) => {
  for (const [token, data] of refreshTokens.entries()) {
    if (data.userId === userId) {
      refreshTokens.delete(token);
    }
  }
};

// Generate access token
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '15m' } // Short-lived access token
  );
};

// ==================== INPUT VALIDATION ====================

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  next();
};

const validateRegistration = (req, res, next) => {
  const { email, password, role, name } = req.body;
  if (!email || !password || !role || !name) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  if (!['student', 'staff', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  // Validate password strength
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      message: 'Password does not meet requirements',
      errors: passwordValidation.errors,
      strength: passwordValidation.strength
    });
  }

  next();
};

// ==================== AUTH ROUTES ====================

// User registration
router.post('/register', validateRegistration, auditLog, async (req, res) => {
  try {
    const { email, password, role, name, studentId, department } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      role,
      name,
      studentId: role === 'student' ? studentId : undefined,
      department,
      isActive: true,
      lastLogin: new Date()
    });

    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user._id.toString());

    // Send welcome email asynchronously (don't block registration)
    setImmediate(() => {
      notificationUtils.emit('user.registered', {
        email: user.email,
        name: user.name,
        role: user.role
      });
    });

    res.status(201).json({
      message: 'User registered successfully',
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// User login
router.post('/login', validateLogin, auditLog, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user._id.toString());

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        department: user.department
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Refresh token endpoint
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token required' });
    }

    const tokenData = validateRefreshToken(refreshToken);
    if (!tokenData) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(tokenData.userId);
    if (!user || !user.isActive) {
      revokeRefreshToken(refreshToken);
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    // Generate new access token
    const accessToken = generateAccessToken(user);

    // Optionally rotate refresh token for better security
    revokeRefreshToken(refreshToken);
    const newRefreshToken = generateRefreshToken(user._id.toString());

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ message: 'Failed to refresh token' });
  }
});

// Logout endpoint
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      revokeRefreshToken(refreshToken);
    }

    // Optionally revoke all tokens for this user
    // revokeAllUserTokens(req.user.id);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
});

// Logout from all devices
router.post('/logout-all', authenticateToken, async (req, res) => {
  try {
    revokeAllUserTokens(req.user.id);
    res.json({ message: 'Logged out from all devices' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
});

// Check password strength endpoint
router.post('/check-password', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: 'Password required' });
  }

  const validation = validatePasswordStrength(password);
  res.json(validation);
});

// Microsoft 365 OAuth login (placeholder)
router.post('/microsoft-login', auditLog, async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ message: 'Access token required' });
    }

    // Placeholder for Microsoft Graph API integration
    // In production, validate token and get user info from Microsoft
    const microsoftUser = {
      id: 'ms-' + crypto.randomBytes(8).toString('hex'),
      email: 'user@microsoft.com', // Would come from Microsoft
      name: 'Microsoft User',
      role: 'student' // Default role, could be determined by group membership
    };

    // Check if user exists, create if not
    let user = await User.findOne({ email: microsoftUser.email });

    if (!user) {
      user = new User({
        email: microsoftUser.email,
        password: crypto.randomBytes(32).toString('hex'), // Random password for Microsoft users
        role: microsoftUser.role,
        name: microsoftUser.name,
        isActive: true,
        lastLogin: new Date(),
        microsoftId: microsoftUser.id
      });
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Microsoft login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Microsoft login error:', error);
    res.status(500).json({ message: 'Microsoft login failed' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        department: user.department,
        studentId: user.studentId,
        isActive: user.isActive,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, department } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update allowed fields
    if (name) user.name = name;
    if (department) user.department = department;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        department: user.department
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    user.password = hashedPassword;

    await user.save();

    // Send password change notification asynchronously
    setImmediate(() => {
      notificationUtils.emit('user.password.changed', {
        email: user.email,
        name: user.name
      });
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

// Admin: Get all users
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;

    let query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Admin: Update user role/status
router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role, isActive } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (role) user.role = role;
    if (typeof isActive === 'boolean') {
      user.isActive = isActive;
      // Send deactivation notification if account is being deactivated
      if (!isActive) {
        setImmediate(() => {
          notificationUtils.emit('user.deactivated', {
            email: user.email,
            name: user.name,
            reason: 'Administrative action'
          });
        });
      }
    }

    await user.save();

    res.json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// Logout (client-side token removal)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Refresh token (placeholder)
router.post('/refresh', authenticateToken, (req, res) => {
  // Generate new token with same user data
  const token = jwt.sign(
    {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      name: req.user.name
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token });
});

module.exports = router;