const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Student Schema
const StudentSchema = new Schema({
  registrationNumber: {
    type: String,
    required: true,
    unique: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  },
  program: {
    type: Schema.Types.ObjectId,
    ref: 'Program',
    required: true
  },
  batch: {
    type: Number,
    required: true
  },
  joiningDate: {
    type: Date,
    default: Date.now
  },
  photo: {
    type: String // URL to photo stored in cloud storage
  },
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  hostelResident: {
    type: Boolean,
    default: false
  },
  hostelRoom: {
    type: Schema.Types.ObjectId,
    ref: 'HostelRoom'
  },
  libraryCard: {
    type: String,
    unique: true,
    sparse: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// User Schema (for authentication)
const UserSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'staff', 'student', 'librarian', 'hostel_warden'],
    required: true
  },
  profilePic: String,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  student: {
    type: Schema.Types.ObjectId,
    ref: 'Student'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Department Schema
const DepartmentSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  code: {
    type: String,
    required: true,
    unique: true
  },
  head: {
    type: String
  },
  description: String,
  programs: [{
    type: Schema.Types.ObjectId,
    ref: 'Program'
  }]
});

// Program/Course Schema
const ProgramSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  code: {
    type: String,
    required: true,
    unique: true
  },
  department: {
    type: Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  duration: {
    type: Number, // in years
    required: true
  },
  degreeLevel: {
    type: String,
    enum: ['Certificate', 'Diploma', 'Associate', 'Bachelor', 'Master', 'Doctoral'],
    required: true
  },
  description: String,
  feeStructure: {
    type: Schema.Types.ObjectId,
    ref: 'FeeStructure'
  }
});

// Fee Structure Schema
const FeeStructureSchema = new Schema({
  programCode: {
    type: String,
    required: true
  },
  academicYear: {
    type: String,
    required: true
  },
  tuitionFee: {
    type: Number,
    required: true
  },
  hostelFee: {
    type: Number,
    default: 0
  },
  libraryFee: {
    type: Number,
    default: 0
  },
  examFee: {
    type: Number,
    default: 0
  },
  miscFees: [{
    name: String,
    amount: Number
  }],
  totalFee: {
    type: Number,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Fee Payment Schema
const FeePaymentSchema = new Schema({
  student: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  feeStructure: {
    type: Schema.Types.ObjectId,
    ref: 'FeeStructure',
    required: true
  },
  academicYear: {
    type: String,
    required: true
  },
  semester: {
    type: Number,
    required: true
  },
  amountPaid: {
    type: Number,
    required: true
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: ['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Cash', 'Cheque'],
    required: true
  },
  transactionId: {
    type: String,
    unique: true
  },
  receiptNumber: {
    type: String,
    unique: true
  },
  receiptUrl: String, // PDF receipt URL in cloud storage
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
    default: 'Pending'
  },
  notes: String,
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
});

// Hostel Schema
const HostelSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Boys', 'Girls', 'Co-ed'],
    required: true
  },
  warden: {
    name: String,
    contact: String,
    email: String
  },
  capacity: {
    type: Number,
    required: true
  },
  occupiedRooms: {
    type: Number,
    default: 0
  },
  floors: {
    type: Number,
    required: true
  },
  facilities: [String],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hostel Room Schema
const HostelRoomSchema = new Schema({
  hostel: {
    type: Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true
  },
  roomNumber: {
    type: String,
    required: true
  },
  floor: {
    type: Number,
    required: true
  },
  capacity: {
    type: Number,
    default: 2
  },
  occupants: [{
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student'
    },
    allocationDate: {
      type: Date,
      default: Date.now
    },
    vacatingDate: Date
  }],
  isOccupied: {
    type: Boolean,
    default: false
  },
  roomType: {
    type: String,
    enum: ['Single', 'Double', 'Triple', 'Dormitory'],
    default: 'Double'
  },
  facilities: [String],
  status: {
    type: String,
    enum: ['Available', 'Occupied', 'Under Maintenance', 'Reserved'],
    default: 'Available'
  },
  monthlyRent: Number
});

// Library Book Schema
const LibraryBookSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  },
  isbn: {
    type: String,
    unique: true
  },
  publisher: String,
  yearPublished: Number,
  edition: String,
  category: {
    type: String,
    required: true
  },
  subject: String,
  location: {
    shelf: String,
    row: Number
  },
  totalCopies: {
    type: Number,
    required: true
  },
  availableCopies: {
    type: Number,
    required: true
  },
  addedDate: {
    type: Date,
    default: Date.now
  }
});

// Book Issue/Return Schema
const BookTransactionSchema = new Schema({
  book: {
    type: Schema.Types.ObjectId,
    ref: 'LibraryBook',
    required: true
  },
  student: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  returnDate: Date,
  fineAmount: {
    type: Number,
    default: 0
  },
  finePaid: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Issued', 'Returned', 'Overdue', 'Lost'],
    default: 'Issued'
  },
  issuedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  returnedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
});

// Admission Form Schema
const AdmissionFormSchema = new Schema({
  formId: {
    type: String,
    required: true,
    unique: true
  },
  program: {
    type: Schema.Types.ObjectId,
    ref: 'Program',
    required: true
  },
  academicYear: {
    type: String,
    required: true
  },
  personalInfo: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other']
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String
    },
    nationality: String
  },
  academicInfo: {
    lastQualification: String,
    institution: String,
    board: String,
    yearOfPassing: Number,
    percentage: Number,
    marksheet: String // URL to uploaded document
  },
  documents: [{
    name: String,
    type: String,
    url: String,
    verified: {
      type: Boolean,
      default: false
    }
  }],
  applicationDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['Pending', 'Under Review', 'Approved', 'Rejected', 'Waitlisted'],
    default: 'Pending'
  },
  remarks: String,
  interviewDate: Date,
  interviewScore: Number,
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewDate: Date
});

// Document Schema
const DocumentSchema = new Schema({
  originalName: {
    type: String,
    required: true
  },
  filename: {
    type: String,
    required: true,
    unique: true
  },
  path: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['admissions', 'students', 'staff', 'documents', 'receipts', 'certificates', 'temporary'],
    default: 'documents'
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  checksum: {
    type: String,
    required: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    lowercase: true
  }],
  metadata: {
    description: String,
    studentId: String,
    admissionFormId: String,
    feePaymentId: String,
    documentType: String,
    expiryDate: Date,
    issueDate: Date,
    issuer: String,
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    verificationDate: Date,
    additionalInfo: Schema.Types.Mixed
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloaded: Date,
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  deletedDate: Date
});

// Create indexes for Document schema
DocumentSchema.index({ uploadedBy: 1, category: 1 });
DocumentSchema.index({ tags: 1 });
DocumentSchema.index({ 'metadata.studentId': 1 });
DocumentSchema.index({ 'metadata.admissionFormId': 1 });
DocumentSchema.index({ filename: 1 });
DocumentSchema.index({ checksum: 1 });

// Chatbot Conversation Schema
const ChatbotConversationSchema = new Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  userType: {
    type: String,
    enum: ['student', 'guest', 'staff'],
    default: 'guest'
  },
  messages: [{
    id: {
      type: String,
      required: true
    },
    sender: {
      type: String,
      enum: ['user', 'bot'],
      required: true
    },
    message: {
      type: String,
      required: true
    },
    intent: String,
    confidence: Number,
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: {
      buttonClicked: String,
      quickReply: String,
      attachments: [String],
      responseTime: Number
    }
  }],
  context: {
    currentIntent: String,
    entities: Schema.Types.Mixed,
    sessionVariables: Schema.Types.Mixed,
    userPreferences: Schema.Types.Mixed
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: Date,
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    ratedAt: Date
  },
  resolvedIssues: [{
    category: String,
    description: String,
    resolved: Boolean,
    timestamp: Date
  }],
  transferredToHuman: {
    type: Boolean,
    default: false
  },
  humanAgentId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  transferReason: String,
  transferTime: Date
});

// Chatbot Intent Schema
const ChatbotIntentSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['admission', 'fees', 'hostel', 'library', 'academic', 'general', 'support']
  },
  description: String,
  trainingPhrases: [{
    text: String,
    entities: [{
      entity: String,
      start: Number,
      end: Number,
      value: String
    }]
  }],
  responses: [{
    text: String,
    quickReplies: [String],
    buttons: [{
      title: String,
      payload: String,
      url: String
    }],
    condition: String
  }],
  parameters: [{
    name: String,
    entityType: String,
    required: Boolean,
    prompts: [String]
  }],
  webhookEnabled: {
    type: Boolean,
    default: false
  },
  webhookUrl: String,
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Chatbot FAQ Schema
const ChatbotFAQSchema = new Schema({
  question: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['admission', 'fees', 'hostel', 'library', 'academic', 'general', 'technical']
  },
  keywords: [String],
  alternatives: [String], // Alternative ways to ask the same question
  relatedQuestions: [{
    type: Schema.Types.ObjectId,
    ref: 'ChatbotFAQ'
  }],
  popularity: {
    type: Number,
    default: 0
  },
  lastAsked: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for Chatbot schemas
ChatbotConversationSchema.index({ sessionId: 1 });
ChatbotConversationSchema.index({ userId: 1 });
ChatbotConversationSchema.index({ startTime: -1 });
ChatbotConversationSchema.index({ isActive: 1 });

ChatbotIntentSchema.index({ name: 1 });
ChatbotIntentSchema.index({ category: 1 });
ChatbotIntentSchema.index({ isActive: 1 });

ChatbotFAQSchema.index({ category: 1 });
ChatbotFAQSchema.index({ keywords: 1 });
ChatbotFAQSchema.index({ popularity: -1 });
ChatbotFAQSchema.index({ isActive: 1 });

// Create and export models
const models = {
  Student: mongoose.model('Student', StudentSchema),
  User: mongoose.model('User', UserSchema),
  Department: mongoose.model('Department', DepartmentSchema),
  Program: mongoose.model('Program', ProgramSchema),
  FeeStructure: mongoose.model('FeeStructure', FeeStructureSchema),
  FeePayment: mongoose.model('FeePayment', FeePaymentSchema),
  Hostel: mongoose.model('Hostel', HostelSchema),
  HostelRoom: mongoose.model('HostelRoom', HostelRoomSchema),
  LibraryBook: mongoose.model('LibraryBook', LibraryBookSchema),
  BookTransaction: mongoose.model('BookTransaction', BookTransactionSchema),
  AdmissionForm: mongoose.model('AdmissionForm', AdmissionFormSchema),
  Document: mongoose.model('Document', DocumentSchema),
  ChatbotConversation: mongoose.model('ChatbotConversation', ChatbotConversationSchema),
  ChatbotIntent: mongoose.model('ChatbotIntent', ChatbotIntentSchema),
  ChatbotFAQ: mongoose.model('ChatbotFAQ', ChatbotFAQSchema)
};

module.exports = models;