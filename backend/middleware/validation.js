const Joi = require('joi');

// Common validation patterns
const patterns = {
  phone: /^[6-9]\d{9}$/,
  pin: /^\d{6}$/,
  aadhaar: /^\d{12}$/,
  pan: /^[A-Z]{5}\d{4}[A-Z]$/,
  registrationNumber: /^[A-Z]{2,4}\d{4,10}$/,
  mongoId: /^[0-9a-fA-F]{24}$/
};

// Custom error messages
const customMessages = {
  'string.empty': '{{#label}} is required',
  'string.min': '{{#label}} must be at least {{#limit}} characters',
  'string.max': '{{#label}} must be at most {{#limit}} characters',
  'string.email': 'Please provide a valid email address',
  'string.pattern.base': '{{#label}} format is invalid',
  'number.min': '{{#label}} must be at least {{#limit}}',
  'number.max': '{{#label}} must be at most {{#limit}}',
  'any.required': '{{#label}} is required',
  'array.min': '{{#label}} must have at least {{#limit}} items',
  'date.base': '{{#label}} must be a valid date'
};

// ==================== COMMON SCHEMAS ====================

const mongoIdSchema = Joi.string().pattern(patterns.mongoId).messages({
  'string.pattern.base': 'Invalid ID format'
});

const phoneSchema = Joi.string().pattern(patterns.phone).messages({
  'string.pattern.base': 'Please provide a valid 10-digit phone number'
});

const emailSchema = Joi.string().email().lowercase().trim();

const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/[A-Z]/, 'uppercase')
  .pattern(/[a-z]/, 'lowercase')
  .pattern(/[0-9]/, 'number')
  .pattern(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/, 'special')
  .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.max': 'Password must be at most 128 characters',
    'string.pattern.name': 'Password must contain at least one {{#name}} character'
  });

const dateSchema = Joi.date().iso();

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// ==================== AUTH SCHEMAS ====================

const authSchemas = {
  register: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: emailSchema.required(),
    password: passwordSchema.required(),
    role: Joi.string().valid('student', 'staff', 'admin', 'librarian', 'hostel_warden').required(),
    studentId: Joi.when('role', {
      is: 'student',
      then: Joi.string().pattern(patterns.registrationNumber).required(),
      otherwise: Joi.forbidden()
    }),
    department: Joi.string().max(100),
    phone: phoneSchema
  }),

  login: Joi.object({
    email: emailSchema.required(),
    password: Joi.string().required()
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: passwordSchema.required(),
    confirmPassword: Joi.ref('newPassword')
  }).messages({
    'any.only': 'Passwords do not match'
  }),

  forgotPassword: Joi.object({
    email: emailSchema.required()
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    newPassword: passwordSchema.required(),
    confirmPassword: Joi.ref('newPassword')
  })
};

// ==================== STUDENT SCHEMAS ====================

const studentSchemas = {
  create: Joi.object({
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    email: emailSchema.required(),
    phone: phoneSchema.required(),
    dateOfBirth: dateSchema.required(),
    gender: Joi.string().valid('Male', 'Female', 'Other').required(),
    address: Joi.object({
      street: Joi.string().max(200),
      city: Joi.string().max(100).required(),
      state: Joi.string().max(100).default('Rajasthan'),
      pincode: Joi.string().pattern(patterns.pin).required(),
      country: Joi.string().max(100).default('India')
    }),
    program: mongoIdSchema.required(),
    department: mongoIdSchema,
    batch: Joi.number().integer().min(2000).max(2100).required(),
    semester: Joi.number().integer().min(1).max(10).default(1),
    category: Joi.string().valid('General', 'OBC', 'SC', 'ST', 'EWS').default('General'),
    aadhaar: Joi.string().pattern(patterns.aadhaar),
    parentInfo: Joi.object({
      fatherName: Joi.string().max(100).required(),
      motherName: Joi.string().max(100),
      guardianName: Joi.string().max(100),
      guardianPhone: phoneSchema,
      guardianEmail: emailSchema
    })
  }),

  update: Joi.object({
    firstName: Joi.string().min(2).max(50),
    lastName: Joi.string().min(2).max(50),
    phone: phoneSchema,
    address: Joi.object({
      street: Joi.string().max(200),
      city: Joi.string().max(100),
      state: Joi.string().max(100),
      pincode: Joi.string().pattern(patterns.pin),
      country: Joi.string().max(100)
    }),
    semester: Joi.number().integer().min(1).max(10)
  }).min(1) // At least one field required
};

// ==================== FEE SCHEMAS ====================

const feeSchemas = {
  createPayment: Joi.object({
    amount: Joi.number().positive().required(),
    feeType: Joi.string().valid('tuition', 'hostel', 'library', 'exam', 'full', 'other').default('full'),
    description: Joi.string().max(500)
  }),

  manualPayment: Joi.object({
    studentId: mongoIdSchema.required(),
    amount: Joi.number().positive().required(),
    paymentMethod: Joi.string().valid('Cash', 'Cheque', 'Bank Transfer', 'DD').required(),
    feeType: Joi.string().valid('tuition', 'hostel', 'library', 'exam', 'full', 'other'),
    chequeNumber: Joi.when('paymentMethod', {
      is: 'Cheque',
      then: Joi.string().required(),
      otherwise: Joi.forbidden()
    }),
    bankName: Joi.string().max(100),
    remarks: Joi.string().max(500)
  }),

  feeStructure: Joi.object({
    program: mongoIdSchema.required(),
    academicYear: Joi.string().pattern(/^\d{4}-\d{2}$/).required(),
    tuitionFee: Joi.number().min(0).required(),
    hostelFee: Joi.number().min(0).default(0),
    libraryFee: Joi.number().min(0).default(0),
    examFee: Joi.number().min(0).default(0),
    otherFees: Joi.number().min(0).default(0),
    description: Joi.string().max(500)
  })
};

// ==================== EXAM SCHEMAS ====================

const examSchemas = {
  create: Joi.object({
    name: Joi.string().min(3).max(200).required(),
    code: Joi.string().max(20).required(),
    type: Joi.string().valid('Internal', 'Mid-Term', 'End-Term', 'Practical', 'Viva', 'Assignment').required(),
    program: mongoIdSchema.required(),
    semester: Joi.number().integer().min(1).max(10).required(),
    subjects: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        code: Joi.string().required(),
        maxMarks: Joi.number().positive().required(),
        passingMarks: Joi.number().positive().required(),
        date: dateSchema.required(),
        startTime: Joi.string().required(),
        endTime: Joi.string().required(),
        venue: Joi.string().max(100)
      })
    ).min(1).required(),
    academicYear: Joi.string().pattern(/^\d{4}-\d{2}$/).required()
  }),

  result: Joi.object({
    examId: mongoIdSchema.required(),
    studentId: mongoIdSchema.required(),
    marks: Joi.array().items(
      Joi.object({
        subjectCode: Joi.string().required(),
        marksObtained: Joi.number().min(0).required(),
        grade: Joi.string().max(5),
        remarks: Joi.string().max(200)
      })
    ).min(1).required()
  })
};

// ==================== ATTENDANCE SCHEMAS ====================

const attendanceSchemas = {
  createSession: Joi.object({
    name: Joi.string().min(3).max(100).required(),
    subject: Joi.string().min(2).max(100).required(),
    subjectCode: Joi.string().max(20),
    program: mongoIdSchema,
    semester: Joi.number().integer().min(1).max(10),
    batch: Joi.number().integer().min(2000).max(2100),
    date: dateSchema,
    startTime: Joi.string().required(),
    endTime: Joi.string(),
    location: Joi.string().max(100),
    attendanceType: Joi.string().valid('QR', 'Manual', 'Biometric', 'Facial').default('QR')
  }),

  markQR: Joi.object({
    sessionId: mongoIdSchema.required(),
    qrToken: Joi.string().required(),
    location: Joi.object({
      latitude: Joi.number().min(-90).max(90),
      longitude: Joi.number().min(-180).max(180)
    })
  }),

  markManual: Joi.object({
    sessionId: mongoIdSchema.required(),
    records: Joi.array().items(
      Joi.object({
        studentId: mongoIdSchema.required(),
        status: Joi.string().valid('Present', 'Absent', 'Late', 'Excused', 'On Leave').required(),
        remarks: Joi.string().max(200)
      })
    ).min(1).required()
  }),

  leaveRequest: Joi.object({
    leaveType: Joi.string().valid('Sick', 'Personal', 'Family Emergency', 'Academic', 'Other').required(),
    startDate: dateSchema.required(),
    endDate: dateSchema.required().min(Joi.ref('startDate')),
    reason: Joi.string().min(10).max(1000).required(),
    documents: Joi.array().items(Joi.string().uri())
  })
};

// ==================== LIBRARY SCHEMAS ====================

const librarySchemas = {
  addBook: Joi.object({
    title: Joi.string().min(2).max(300).required(),
    author: Joi.string().min(2).max(200).required(),
    isbn: Joi.string().pattern(/^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$/).required(),
    publisher: Joi.string().max(200),
    category: Joi.string().max(100).required(),
    edition: Joi.string().max(50),
    publicationYear: Joi.number().integer().min(1900).max(new Date().getFullYear()),
    totalCopies: Joi.number().integer().min(1).required(),
    location: Joi.object({
      shelf: Joi.string().max(20),
      row: Joi.number().integer().min(1),
      section: Joi.string().max(50)
    }),
    language: Joi.string().max(50).default('English'),
    description: Joi.string().max(2000)
  }),

  borrow: Joi.object({
    bookId: mongoIdSchema.required(),
    studentId: mongoIdSchema,
    dueDate: dateSchema
  }),

  return: Joi.object({
    borrowingId: mongoIdSchema.required(),
    condition: Joi.string().valid('Good', 'Damaged', 'Lost').default('Good'),
    remarks: Joi.string().max(500)
  })
};

// ==================== HOSTEL SCHEMAS ====================

const hostelSchemas = {
  createHostel: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    type: Joi.string().valid('Boys', 'Girls', 'Co-ed').required(),
    totalRooms: Joi.number().integer().min(1).required(),
    facilities: Joi.array().items(Joi.string().max(100)),
    warden: mongoIdSchema,
    contact: Joi.object({
      phone: phoneSchema,
      email: emailSchema
    }),
    address: Joi.string().max(500)
  }),

  allocation: Joi.object({
    studentId: mongoIdSchema.required(),
    roomId: mongoIdSchema.required(),
    startDate: dateSchema.required(),
    endDate: dateSchema,
    bedNumber: Joi.number().integer().min(1)
  }),

  complaint: Joi.object({
    type: Joi.string().valid('Maintenance', 'Cleanliness', 'Security', 'Food', 'Water', 'Electricity', 'Other').required(),
    description: Joi.string().min(10).max(1000).required(),
    priority: Joi.string().valid('Low', 'Medium', 'High', 'Urgent').default('Medium'),
    roomNumber: Joi.string().max(20)
  })
};

// ==================== SCHOLARSHIP SCHEMAS ====================

const scholarshipSchemas = {
  create: Joi.object({
    name: Joi.string().min(3).max(200).required(),
    code: Joi.string().max(20).required(),
    type: Joi.string().valid('Merit', 'Need-Based', 'Sports', 'Minority', 'Disability', 'State Government', 'Central Government', 'Private', 'Other').required(),
    amount: Joi.number().positive().required(),
    eligibility: Joi.object({
      minPercentage: Joi.number().min(0).max(100),
      maxIncome: Joi.number().positive(),
      categories: Joi.array().items(Joi.string()),
      gender: Joi.string().valid('Any', 'Male', 'Female', 'Other'),
      programs: Joi.array().items(mongoIdSchema),
      domicile: Joi.string().max(100)
    }),
    applicationDeadline: dateSchema,
    documentsRequired: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        description: Joi.string(),
        mandatory: Joi.boolean().default(true)
      })
    ),
    totalSlots: Joi.number().integer().min(1)
  }),

  apply: Joi.object({
    familyIncome: Joi.number().min(0),
    category: Joi.string().max(50),
    bankDetails: Joi.object({
      accountNumber: Joi.string().pattern(/^\d{9,18}$/).required(),
      bankName: Joi.string().max(100).required(),
      ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required(),
      accountHolderName: Joi.string().max(100).required()
    }),
    documents: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        url: Joi.string().uri().required()
      })
    ),
    statement: Joi.string().max(2000),
    submit: Joi.boolean().default(false)
  })
};

// ==================== VALIDATION MIDDLEWARE ====================

// Create validation middleware from schema
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      messages: customMessages
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    req[property] = value;
    next();
  };
};

// Validate query parameters
const validateQuery = (schema) => validate(schema, 'query');

// Validate URL parameters
const validateParams = (schema) => validate(schema, 'params');

// Export schemas and middleware
module.exports = {
  // Middleware
  validate,
  validateQuery,
  validateParams,

  // Schemas
  authSchemas,
  studentSchemas,
  feeSchemas,
  examSchemas,
  attendanceSchemas,
  librarySchemas,
  hostelSchemas,
  scholarshipSchemas,

  // Common schemas
  mongoIdSchema,
  phoneSchema,
  emailSchema,
  passwordSchema,
  dateSchema,
  paginationSchema,

  // Patterns
  patterns
};
