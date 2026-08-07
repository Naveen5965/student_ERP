require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { connectMongoDB } = require('../config/db');
const { securityHeaders, rateLimit, auditLog } = require('./middleware/auth');
const { setupSwagger } = require('./config/swagger');
const { initializeRealtimeService } = require('./services/realtimeService');

// Initialize database connection
connectMongoDB();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io for real-time notifications
const io = initializeRealtimeService(server);
app.set('io', io); // Make io accessible in routes

// Security middleware (applied first)
app.use(securityHeaders);
app.use(rateLimit(100, 15 * 60 * 1000)); // 100 requests per 15 minutes
app.use(auditLog);

// Setup Swagger API documentation
setupSwagger(app);

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://yourdomain.com'] // Replace with your production domain
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Define port
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'ERP-based Integrated Student Management System API',
    version: '1.0.0',
    status: 'running',
    documentation: '/api-docs',
    endpoints: {
      auth: '/api/auth',
      students: '/api/students',
      fees: '/api/fees',
      hostel: '/api/hostel',
      library: '/api/library',
      exams: '/api/exams',
      attendance: '/api/attendance',
      scholarships: '/api/scholarships',
      dashboard: '/api/dashboard',
      notifications: '/api/notifications',
      documents: '/api/documents',
      chatbot: '/api/chatbot'
    }
  });
});

// API Routes - Authentication
app.use('/api/auth', require('./routes/auth'));

// API Routes - Core Modules
app.use('/api/students', require('./routes/students'));
app.use('/api/fees', require('./routes/fees'));
app.use('/api/hostel', require('./routes/hostel'));
app.use('/api/library', require('./routes/library'));
app.use('/api/exams', require('./routes/exams'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/scholarships', require('./routes/scholarships'));
app.use('/api/dashboard', require('./routes/dashboard'));

// API Routes - Services
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/chatbot', require('./routes/chatbot'));

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Handle frontend routing
app.get('/auth/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/auth/login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dashboard/index.html'));
});

app.get('/fees', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/fees/index.html'));
});

app.get('/hostel', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/hostel/index.html'));
});

app.get('/library', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/library/index.html'));
});

app.get('/exams', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/exams/index.html'));
});

app.get('/attendance', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/attendance/index.html'));
});

app.get('/scholarships', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/scholarships/index.html'));
});

app.get('/admissions', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admissions/index.html'));
});

app.get('/chatbot', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/chatbot/index.html'));
});

app.get('/documents', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/documents/index.html'));
});

app.get('/notifications', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/notifications/index.html'));
});

// Default route to serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 404 handler for non-API routes only
app.get('*', (req, res) => {
  // If it's an API route that wasn't found, let Express handle it
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      message: 'API endpoint not found',
      path: req.path,
      documentation: '/api-docs',
      availableEndpoints: [
        '/api/auth - Authentication endpoints',
        '/api/students - Student management',
        '/api/fees - Fee management',
        '/api/hostel - Hostel management',
        '/api/library - Library management',
        '/api/exams - Exam management',
        '/api/attendance - Attendance tracking',
        '/api/scholarships - Scholarship management',
        '/api/dashboard - Analytics dashboard',
        '/api/notifications - Notifications',
        '/api/documents - Document management',
        '/api/chatbot - AI Chatbot',
        '/health - Health check'
      ]
    });
  }
  
  // For non-API routes, serve the main page (SPA behavior)
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation Error',
      details: Object.values(err.errors).map(e => e.message)
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token expired' });
  }

  // Default error response
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔔 Real-time notifications: Socket.io enabled`);
});

module.exports = { app, server, io }; // For testing purposes