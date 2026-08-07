// MongoDB Initialization Script
// This script runs when the MongoDB container is first created

// Switch to the application database
db = db.getSiblingDB('student_erp');

// Create application user
db.createUser({
  user: 'student_erp_user',
  pwd: 'student_erp_password',
  roles: [
    { role: 'readWrite', db: 'student_erp' },
    { role: 'dbAdmin', db: 'student_erp' }
  ]
});

// Create collections with schema validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'password', 'role'],
      properties: {
        email: {
          bsonType: 'string',
          description: 'User email address'
        },
        password: {
          bsonType: 'string',
          description: 'Hashed password'
        },
        role: {
          enum: ['student', 'admin', 'staff', 'hod', 'accountant', 'librarian', 'hostel_warden'],
          description: 'User role'
        },
        name: {
          bsonType: 'string'
        },
        phone: {
          bsonType: 'string'
        }
      }
    }
  }
});

// Create indexes for better query performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });
db.users.createIndex({ studentId: 1 }, { sparse: true });

// Students collection
db.createCollection('students');
db.students.createIndex({ studentId: 1 }, { unique: true });
db.students.createIndex({ enrollmentNumber: 1 }, { unique: true });
db.students.createIndex({ department: 1, semester: 1 });
db.students.createIndex({ email: 1 });

// Fees collection
db.createCollection('fees');
db.fees.createIndex({ studentId: 1 });
db.fees.createIndex({ status: 1 });
db.fees.createIndex({ dueDate: 1 });
db.fees.createIndex({ academicYear: 1, semester: 1 });

// Hostels collection
db.createCollection('hostels');
db.hostels.createIndex({ name: 1 }, { unique: true });
db.hostels.createIndex({ type: 1 });

// Room allocations collection
db.createCollection('roomallocations');
db.roomallocations.createIndex({ studentId: 1 });
db.roomallocations.createIndex({ hostelId: 1, roomNumber: 1 });
db.roomallocations.createIndex({ status: 1 });

// Library books collection
db.createCollection('books');
db.books.createIndex({ isbn: 1 }, { unique: true });
db.books.createIndex({ title: 'text', author: 'text' });
db.books.createIndex({ category: 1 });

// Book borrowings collection
db.createCollection('bookborrowings');
db.bookborrowings.createIndex({ studentId: 1 });
db.bookborrowings.createIndex({ bookId: 1 });
db.bookborrowings.createIndex({ status: 1 });
db.bookborrowings.createIndex({ dueDate: 1 });

// Exams collection
db.createCollection('exams');
db.exams.createIndex({ department: 1, semester: 1 });
db.exams.createIndex({ date: 1 });
db.exams.createIndex({ academicYear: 1 });

// Exam results collection
db.createCollection('examresults');
db.examresults.createIndex({ examId: 1 });
db.examresults.createIndex({ studentId: 1 });
db.examresults.createIndex({ studentId: 1, examId: 1 }, { unique: true });

// Attendance sessions collection
db.createCollection('attendancesessions');
db.attendancesessions.createIndex({ facultyId: 1 });
db.attendancesessions.createIndex({ date: 1 });
db.attendancesessions.createIndex({ department: 1, semester: 1 });

// Attendance records collection
db.createCollection('attendancerecords');
db.attendancerecords.createIndex({ sessionId: 1 });
db.attendancerecords.createIndex({ studentId: 1 });
db.attendancerecords.createIndex({ studentId: 1, sessionId: 1 }, { unique: true });

// Scholarships collection
db.createCollection('scholarships');
db.scholarships.createIndex({ name: 1 });
db.scholarships.createIndex({ type: 1 });
db.scholarships.createIndex({ applicationDeadline: 1 });

// Scholarship applications collection
db.createCollection('scholarshipapplications');
db.scholarshipapplications.createIndex({ scholarshipId: 1 });
db.scholarshipapplications.createIndex({ studentId: 1 });
db.scholarshipapplications.createIndex({ status: 1 });

// Notifications collection
db.createCollection('notifications');
db.notifications.createIndex({ userId: 1 });
db.notifications.createIndex({ createdAt: -1 });
db.notifications.createIndex({ read: 1 });

// Documents collection
db.createCollection('documents');
db.documents.createIndex({ userId: 1 });
db.documents.createIndex({ type: 1 });
db.documents.createIndex({ createdAt: -1 });

// Audit logs collection
db.createCollection('auditlogs');
db.auditlogs.createIndex({ userId: 1 });
db.auditlogs.createIndex({ action: 1 });
db.auditlogs.createIndex({ timestamp: -1 });
db.auditlogs.createIndex({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days TTL

// Refresh tokens collection
db.createCollection('refreshtokens');
db.refreshtokens.createIndex({ userId: 1 });
db.refreshtokens.createIndex({ token: 1 }, { unique: true });
db.refreshtokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Push subscriptions collection
db.createCollection('pushsubscriptions');
db.pushsubscriptions.createIndex({ userId: 1 });
db.pushsubscriptions.createIndex({ endpoint: 1 }, { unique: true });

// Insert default admin user
db.users.insertOne({
  email: 'admin@studenterp.edu',
  password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4rNl8rQFAA6BQJQe', // "Admin@123"
  name: 'System Administrator',
  role: 'admin',
  phone: '+919876543210',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

print('✅ MongoDB initialization completed');
print('📊 Collections created with indexes');
print('👤 Default admin user created (admin@studenterp.edu / Admin@123)');
