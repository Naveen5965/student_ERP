const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const {
    User,
    Student,
    Department,
    Program,
    FeeStructure,
    FeePayment,
    Hostel,
    HostelRoom,
    LibraryBook,
    BookTransaction,
    AdmissionForm,
    Document,
    ChatbotIntent,
    ChatbotFAQ
} = require('../models');

const seedData = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.DB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('MongoDB connected for seeding...');

        // Clear existing data
        console.log('Clearing existing data...');
        await Promise.all([
            User.deleteMany({}),
            Student.deleteMany({}),
            Department.deleteMany({}),
            Program.deleteMany({}),
            FeeStructure.deleteMany({}),
            FeePayment.deleteMany({}),
            Hostel.deleteMany({}),
            HostelRoom.deleteMany({}),
            LibraryBook.deleteMany({}),
            BookTransaction.deleteMany({}),
            AdmissionForm.deleteMany({}),
            Document.deleteMany({}),
            ChatbotIntent.deleteMany({}),
            ChatbotFAQ.deleteMany({})
        ]);
        console.log('Existing data cleared.');

        // --- Create Users ---
        console.log('Creating users...');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        const adminUser = await User.create({
            name: 'Admin User',
            email: 'admin@test.com',
            password: hashedPassword,
            role: 'admin'
        });

        const staffUser = await User.create({
            name: 'Staff User',
            email: 'staff@test.com',
            password: hashedPassword,
            role: 'staff'
        });
        
        const librarianUser = await User.create({
            name: 'Librarian User',
            email: 'librarian@test.com',
            password: hashedPassword,
            role: 'librarian'
        });

        const wardenUser = await User.create({
            name: 'Hostel Warden',
            email: 'warden@test.com',
            password: hashedPassword,
            role: 'hostel_warden'
        });
        console.log('Users created.');

        // --- Create Departments ---
        console.log('Creating departments...');
        const csDept = await Department.create({
            name: 'Computer Science',
            code: 'CS',
            head: 'Dr. Alan Turing'
        });

        const eeDept = await Department.create({
            name: 'Electrical Engineering',
            code: 'EE',
            head: 'Dr. Nikola Tesla'
        });
        console.log('Departments created.');

        // --- Create Programs ---
        console.log('Creating programs...');
        const btechCs = await Program.create({
            name: 'Bachelor of Technology in Computer Science',
            code: 'BTECH-CS',
            department: csDept._id,
            duration: 4,
            degreeLevel: 'Bachelor'
        });

        const mtechEe = await Program.create({
            name: 'Master of Technology in Electrical Engineering',
            code: 'MTECH-EE',
            department: eeDept._id,
            duration: 2,
            degreeLevel: 'Master'
        });
        
        csDept.programs.push(btechCs._id);
        await csDept.save();
        
        eeDept.programs.push(mtechEe._id);
        await eeDept.save();
        console.log('Programs created.');

        // --- Create Fee Structures ---
        console.log('Creating fee structures...');
        const btechFee = await FeeStructure.create({
            programCode: 'BTECH-CS',
            academicYear: '2024-2025',
            tuitionFee: 120000,
            hostelFee: 60000,
            libraryFee: 5000,
            examFee: 2000,
            totalFee: 187000,
            dueDate: new Date('2024-08-01')
        });
        
        btechCs.feeStructure = btechFee._id;
        await btechCs.save();
        console.log('Fee structures created.');

        // --- Create Students ---
        console.log('Creating students...');
        const student1 = await Student.create({
            registrationNumber: 'STU001',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@test.com',
            phone: '1234567890',
            dateOfBirth: new Date('2004-05-15'),
            gender: 'Male',
            address: { street: '123 Main St', city: 'Anytown', state: 'CA', zipCode: '12345' },
            program: btechCs._id,
            batch: 2024,
            hostelResident: true
        });

        const studentUser = await User.create({
            name: 'John Doe',
            email: 'john.doe@test.com',
            password: hashedPassword,
            role: 'student',
            student: student1._id
        });
        console.log('Students created.');

        // --- Create Hostels ---
        console.log('Creating hostels...');
        const boysHostel = await Hostel.create({
            name: 'Alpha Boys Hostel',
            type: 'Boys',
            warden: { name: 'Mr. Smith', contact: '9876543210', email: 'warden@test.com' },
            capacity: 200,
            floors: 4
        });
        console.log('Hostels created.');

        // --- Create Hostel Rooms ---
        console.log('Creating hostel rooms...');
        const room101 = await HostelRoom.create({
            hostel: boysHostel._id,
            roomNumber: '101',
            floor: 1,
            capacity: 2,
            occupants: [{ student: student1._id }],
            isOccupied: true,
            status: 'Occupied'
        });
        
        student1.hostelRoom = room101._id;
        await student1.save();
        
        boysHostel.occupiedRooms = 1;
        await boysHostel.save();
        console.log('Hostel rooms created.');

        // --- Create Library Books ---
        console.log('Creating library books...');
        const book1 = await LibraryBook.create({
            title: 'The Lord of the Rings',
            author: 'J.R.R. Tolkien',
            isbn: '978-0-618-64015-7',
            category: 'Fantasy',
            totalCopies: 5,
            availableCopies: 4
        });
        console.log('Library books created.');

        // --- Create Book Transactions ---
        console.log('Creating book transactions...');
        await BookTransaction.create({
            book: book1._id,
            student: student1._id,
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
            issuedBy: librarianUser._id
        });
        console.log('Book transactions created.');

        // --- Create Admission Forms ---
        console.log('Creating admission forms...');
        await AdmissionForm.create({
            formId: 'ADM001',
            program: btechCs._id,
            academicYear: '2024-2025',
            personalInfo: {
                firstName: 'Jane',
                lastName: 'Smith',
                email: 'jane.smith@test.com',
                phone: '0987654321',
                dateOfBirth: new Date('2005-02-20'),
                gender: 'Female'
            },
            status: 'Approved',
            reviewedBy: adminUser._id
        });
        console.log('Admission forms created.');

        // --- Create Chatbot Intents ---
        console.log('Creating chatbot intents...');
        await ChatbotIntent.create([
            {
                name: 'get_admission_info',
                displayName: 'Get Admission Information',
                category: 'admission',
                trainingPhrases: [{ text: 'Tell me about admissions' }, { text: 'How to apply?' }],
                responses: [{ text: 'You can find all admission details on our website. The process is online.' }]
            },
            {
                name: 'get_fee_details',
                displayName: 'Get Fee Details',
                category: 'fees',
                trainingPhrases: [{ text: 'What are the fees?' }, { text: 'Fee structure' }],
                responses: [{ text: 'Fee details vary by program. Which program are you interested in?' }]
            }
        ]);
        console.log('Chatbot intents created.');

        // --- Create Chatbot FAQs ---
        console.log('Creating chatbot FAQs...');
        await ChatbotFAQ.create([
            {
                question: 'What is the last date for admission?',
                answer: 'The last date for admission for the current academic year is August 31st.',
                category: 'admission',
                keywords: ['last date', 'admission', 'deadline']
            },
            {
                question: 'How can I pay my fees online?',
                answer: 'You can pay your fees through the student portal using UPI, credit/debit card, or net banking.',
                category: 'fees',
                keywords: ['pay fees', 'online payment']
            }
        ]);
        console.log('Chatbot FAQs created.');

        console.log('✅ Sample data seeded successfully!');
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    } finally {
        mongoose.disconnect();
        console.log('MongoDB disconnected.');
    }
};

seedData();
