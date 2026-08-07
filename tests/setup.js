/**
 * Jest Test Setup Configuration
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Setup before all tests
beforeAll(async () => {
  // Create in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Connect to in-memory database
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Seed test data
  await seedTestData();
});

// Cleanup after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Clear database between tests if needed
afterEach(async () => {
  // Optionally clear collections between tests
  // const collections = mongoose.connection.collections;
  // for (const key in collections) {
  //   await collections[key].deleteMany({});
  // }
});

// Seed test data
async function seedTestData() {
  const bcrypt = require('bcrypt');
  const { User, Student, Hostel, Book } = require('../database/models');

  // Create test users
  const hashedPassword = await bcrypt.hash('TestPass123!', 12);
  const adminHashedPassword = await bcrypt.hash('Admin@123', 12);
  const facultyHashedPassword = await bcrypt.hash('Faculty@123', 12);
  const librarianHashedPassword = await bcrypt.hash('Librarian@123', 12);
  const wardenHashedPassword = await bcrypt.hash('Warden@123', 12);

  await User.create([
    {
      email: 'test@student.edu',
      password: hashedPassword,
      name: 'Test Student',
      role: 'student',
      studentId: 'STU2024001',
      phone: '+919876543210',
      isActive: true
    },
    {
      email: 'admin@studenterp.edu',
      password: adminHashedPassword,
      name: 'System Administrator',
      role: 'admin',
      phone: '+919876543211',
      isActive: true
    },
    {
      email: 'faculty@studenterp.edu',
      password: facultyHashedPassword,
      name: 'Test Faculty',
      role: 'staff',
      phone: '+919876543212',
      isActive: true
    },
    {
      email: 'librarian@studenterp.edu',
      password: librarianHashedPassword,
      name: 'Test Librarian',
      role: 'librarian',
      phone: '+919876543213',
      isActive: true
    },
    {
      email: 'warden@studenterp.edu',
      password: wardenHashedPassword,
      name: 'Test Warden',
      role: 'hostel_warden',
      phone: '+919876543214',
      isActive: true
    }
  ]);

  // Create test students
  await Student.create([
    {
      name: 'Test Student',
      email: 'test@student.edu',
      studentId: 'STU2024001',
      enrollmentNumber: 'EN2024001',
      department: 'Computer Science',
      semester: 3,
      batch: '2024',
      phone: '+919876543210',
      dateOfBirth: new Date('2002-05-15'),
      address: 'Test Address, Jaipur',
      status: 'active',
      cgpa: 8.5
    },
    {
      name: 'Second Student',
      email: 'student2@test.edu',
      studentId: 'STU2024002',
      enrollmentNumber: 'EN2024002',
      department: 'Computer Science',
      semester: 3,
      batch: '2024',
      phone: '+919876543215',
      dateOfBirth: new Date('2002-06-20'),
      address: 'Another Address, Jaipur',
      status: 'active',
      cgpa: 7.8
    },
    {
      name: 'Third Student',
      email: 'student3@test.edu',
      studentId: 'STU2024003',
      enrollmentNumber: 'EN2024003',
      department: 'Computer Science',
      semester: 3,
      batch: '2024',
      phone: '+919876543216',
      dateOfBirth: new Date('2002-07-25'),
      address: 'Third Address, Jaipur',
      status: 'active',
      cgpa: 6.5
    }
  ]);

  // Create test books
  await Book.create([
    {
      title: 'Introduction to Algorithms',
      author: 'Thomas H. Cormen',
      isbn: '978-0-262-03384-8',
      category: 'Computer Science',
      publisher: 'MIT Press',
      quantity: 10,
      availableCopies: 10,
      location: 'Section A, Shelf 1'
    },
    {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn: '978-0-132-35088-4',
      category: 'Computer Science',
      publisher: 'Prentice Hall',
      quantity: 5,
      availableCopies: 5,
      location: 'Section A, Shelf 2'
    }
  ]);

  console.log('✅ Test data seeded successfully');
}

// Global test timeout
jest.setTimeout(30000);

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret';
process.env.NODE_ENV = 'test';
