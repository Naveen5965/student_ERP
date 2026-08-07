const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Student ERP System API',
    version: '1.0.0',
    description: `
# ERP-based Integrated Student Management System

A comprehensive API for managing student data, academic records, fees, hostel, library, and more.

## Features
- **Authentication**: JWT-based auth with refresh tokens
- **Student Management**: Complete student lifecycle management
- **Fee Management**: Online payments with Razorpay/PhonePe
- **Hostel Management**: Room allocation and complaints
- **Library System**: Book management and borrowing
- **Exam Management**: Hall tickets and results
- **Attendance**: QR-based attendance tracking
- **Scholarships**: Application and disbursement
- **Real-time Notifications**: Socket.io based updates
- **Multi-language**: Hindi, English, Rajasthani support

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your-access-token>
\`\`\`
    `,
    contact: {
      name: 'Student ERP Support',
      email: 'support@studenterp.edu',
    },
    license: {
      name: 'ISC',
      url: 'https://opensource.org/licenses/ISC',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
    {
      url: 'https://api.studenterp.edu',
      description: 'Production server',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication and authorization' },
    { name: 'Students', description: 'Student management operations' },
    { name: 'Fees', description: 'Fee management and payments' },
    { name: 'Hostel', description: 'Hostel and room management' },
    { name: 'Library', description: 'Library and book management' },
    { name: 'Exams', description: 'Exam management and results' },
    { name: 'Attendance', description: 'Attendance tracking' },
    { name: 'Scholarships', description: 'Scholarship management' },
    { name: 'Dashboard', description: 'Analytics and statistics' },
    { name: 'Documents', description: 'Document management' },
    { name: 'Notifications', description: 'Notification system' },
    { name: 'Chatbot', description: 'AI chatbot service' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token',
      },
    },
    schemas: {
      // Error response
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Error message' },
          details: { type: 'array', items: { type: 'string' } },
        },
      },
      
      // Success response
      Success: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          data: { type: 'object' },
        },
      },

      // User/Auth schemas
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'objectId' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { 
            type: 'string', 
            enum: ['student', 'admin', 'staff', 'hod', 'accountant', 'librarian', 'hostel_warden'] 
          },
          studentId: { type: 'string' },
          phone: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'student@example.com' },
          password: { type: 'string', minLength: 8, example: 'SecurePass123!' },
        },
      },

      LoginResponse: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Login successful' },
          token: { type: 'string', description: 'JWT access token' },
          refreshToken: { type: 'string', description: 'JWT refresh token' },
          user: { $ref: '#/components/schemas/User' },
        },
      },

      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password', 'role'],
        properties: {
          name: { type: 'string', minLength: 2, example: 'John Doe' },
          email: { type: 'string', format: 'email', example: 'john@example.com' },
          password: { 
            type: 'string', 
            minLength: 8,
            description: 'Must contain uppercase, lowercase, number, and special character',
            example: 'SecurePass123!' 
          },
          role: { 
            type: 'string', 
            enum: ['student', 'admin', 'staff'],
            example: 'student' 
          },
          phone: { type: 'string', example: '+919876543210' },
          studentId: { type: 'string', example: 'STU2024001' },
        },
      },

      // Student schemas
      Student: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'objectId' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          studentId: { type: 'string' },
          enrollmentNumber: { type: 'string' },
          department: { type: 'string' },
          semester: { type: 'integer', minimum: 1, maximum: 8 },
          batch: { type: 'string' },
          phone: { type: 'string' },
          address: { type: 'string' },
          dateOfBirth: { type: 'string', format: 'date' },
          admissionDate: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['active', 'inactive', 'graduated', 'dropped'] },
        },
      },

      // Fee schemas
      Fee: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'objectId' },
          studentId: { type: 'string' },
          feeType: { 
            type: 'string', 
            enum: ['tuition', 'hostel', 'library', 'exam', 'other'] 
          },
          amount: { type: 'number' },
          dueDate: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['pending', 'paid', 'overdue', 'partial'] },
          paymentMethod: { type: 'string' },
          transactionId: { type: 'string' },
        },
      },

      PaymentRequest: {
        type: 'object',
        required: ['feeId', 'amount', 'paymentMethod'],
        properties: {
          feeId: { type: 'string', format: 'objectId' },
          amount: { type: 'number', minimum: 1 },
          paymentMethod: { 
            type: 'string', 
            enum: ['razorpay', 'phonepe', 'upi', 'netbanking', 'card'] 
          },
        },
      },

      // Hostel schemas
      Hostel: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'objectId' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['boys', 'girls'] },
          totalRooms: { type: 'integer' },
          availableRooms: { type: 'integer' },
          wardenId: { type: 'string', format: 'objectId' },
          facilities: { type: 'array', items: { type: 'string' } },
        },
      },

      RoomAllocation: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'objectId' },
          studentId: { type: 'string', format: 'objectId' },
          hostelId: { type: 'string', format: 'objectId' },
          roomNumber: { type: 'string' },
          bedNumber: { type: 'integer' },
          allocationDate: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['active', 'vacated', 'pending'] },
        },
      },

      // Library schemas
      Book: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'objectId' },
          title: { type: 'string' },
          author: { type: 'string' },
          isbn: { type: 'string' },
          category: { type: 'string' },
          publisher: { type: 'string' },
          quantity: { type: 'integer' },
          availableCopies: { type: 'integer' },
          location: { type: 'string' },
        },
      },

      BookBorrowing: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'objectId' },
          bookId: { type: 'string', format: 'objectId' },
          studentId: { type: 'string', format: 'objectId' },
          borrowDate: { type: 'string', format: 'date' },
          dueDate: { type: 'string', format: 'date' },
          returnDate: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['borrowed', 'returned', 'overdue'] },
          fine: { type: 'number' },
        },
      },

      // Exam schemas
      Exam: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'objectId' },
          name: { type: 'string' },
          subject: { type: 'string' },
          department: { type: 'string' },
          semester: { type: 'integer' },
          date: { type: 'string', format: 'date' },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          venue: { type: 'string' },
          maxMarks: { type: 'integer' },
          passingMarks: { type: 'integer' },
        },
      },

      ExamResult: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'objectId' },
          examId: { type: 'string', format: 'objectId' },
          studentId: { type: 'string', format: 'objectId' },
          marksObtained: { type: 'number' },
          grade: { type: 'string' },
          status: { type: 'string', enum: ['pass', 'fail', 'absent'] },
        },
      },

      // Attendance schemas
      AttendanceSession: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'objectId' },
          subject: { type: 'string' },
          facultyId: { type: 'string', format: 'objectId' },
          department: { type: 'string' },
          semester: { type: 'integer' },
          date: { type: 'string', format: 'date' },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          qrCode: { type: 'string' },
          status: { type: 'string', enum: ['active', 'completed', 'cancelled'] },
        },
      },

      AttendanceRecord: {
        type: 'object',
        properties: {
          studentId: { type: 'string', format: 'objectId' },
          sessionId: { type: 'string', format: 'objectId' },
          status: { type: 'string', enum: ['present', 'absent', 'late', 'excused'] },
          markedAt: { type: 'string', format: 'date-time' },
          location: {
            type: 'object',
            properties: {
              latitude: { type: 'number' },
              longitude: { type: 'number' },
            },
          },
        },
      },

      // Scholarship schemas
      Scholarship: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'objectId' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['merit', 'need-based', 'sports', 'cultural', 'government'] },
          amount: { type: 'number' },
          eligibilityCriteria: { type: 'string' },
          applicationDeadline: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['open', 'closed', 'processing'] },
        },
      },

      ScholarshipApplication: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'objectId' },
          scholarshipId: { type: 'string', format: 'objectId' },
          studentId: { type: 'string', format: 'objectId' },
          applicationDate: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'disbursed'] },
          documents: { type: 'array', items: { type: 'string' } },
          remarks: { type: 'string' },
        },
      },

      // Dashboard schemas
      DashboardStats: {
        type: 'object',
        properties: {
          totalStudents: { type: 'integer' },
          activeStudents: { type: 'integer' },
          totalFeeCollected: { type: 'number' },
          pendingFees: { type: 'number' },
          hostelOccupancy: { type: 'number' },
          libraryBooksIssued: { type: 'integer' },
          attendancePercentage: { type: 'number' },
          scholarshipsAwarded: { type: 'integer' },
        },
      },

      // Notification schemas
      Notification: {
        type: 'object',
        properties: {
          _id: { type: 'string', format: 'objectId' },
          userId: { type: 'string', format: 'objectId' },
          title: { type: 'string' },
          message: { type: 'string' },
          type: { type: 'string', enum: ['info', 'warning', 'success', 'error'] },
          read: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // Pagination
      Pagination: {
        type: 'object',
        properties: {
          currentPage: { type: 'integer' },
          totalPages: { type: 'integer' },
          totalItems: { type: 'integer' },
          itemsPerPage: { type: 'integer' },
        },
      },
    },

    responses: {
      UnauthorizedError: {
        description: 'Access token is missing or invalid',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Unauthorized' },
              },
            },
          },
        },
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Resource not found' },
              },
            },
          },
        },
      },
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'Validation Error' },
                details: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  },
  security: [
    { bearerAuth: [] },
  ],
};

// Options for swagger-jsdoc
const options = {
  swaggerDefinition,
  apis: [
    './backend/routes/*.js',
    './backend/routes/**/*.js',
  ],
};

const swaggerSpec = swaggerJSDoc(options);

/**
 * Setup Swagger UI
 * @param {Express} app - Express application
 */
const setupSwagger = (app) => {
  // Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0 }
      .swagger-ui .info .title { color: #3b82f6 }
    `,
    customSiteTitle: 'Student ERP API Documentation',
    customfavIcon: '/favicon.ico',
  }));

  // Serve raw swagger JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log('📚 Swagger UI available at /api-docs');
};

module.exports = { setupSwagger, swaggerSpec };
