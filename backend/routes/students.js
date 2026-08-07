const express = require('express');
const mongoose = require('mongoose');
const { Student, User, Program, Department, FeePayment, AdmissionForm } = require('../../database/models');
const { authenticateToken, requireStaff, requireAdmin, auditLog } = require('../middleware/auth');
const { body, query, param, validationResult } = require('express-validator');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Validation failed',
      errors: errors.array() 
    });
  }
  next();
};

// Student validation rules
const studentValidation = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').matches(/^[0-9]{10}$/).withMessage('Valid 10-digit phone number is required'),
  body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
  body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Valid gender is required'),
  body('program').isMongoId().withMessage('Valid program ID is required'),
  body('batch').isInt({ min: 2000, max: 2100 }).withMessage('Valid batch year is required')
];

// ==================== STUDENT CRUD OPERATIONS ====================

// GET /api/students - Get all students with pagination and filters
router.get('/', authenticateToken, requireStaff, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      program,
      batch,
      department,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Search by name, email, or registration number
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by program
    if (program) {
      query.program = mongoose.Types.ObjectId(program);
    }

    // Filter by batch
    if (batch) {
      query.batch = parseInt(batch);
    }

    // Filter by status
    if (status !== undefined) {
      query.isActive = status === 'active';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [students, total] = await Promise.all([
      Student.find(query)
        .populate('program', 'name code')
        .populate('hostelRoom', 'roomNumber')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Student.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        students,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch students' });
  }
});

// GET /api/students/stats - Get student statistics
router.get('/stats', authenticateToken, requireStaff, async (req, res) => {
  try {
    const [
      totalStudents,
      activeStudents,
      hostelResidents,
      genderDistribution,
      programDistribution,
      batchDistribution
    ] = await Promise.all([
      Student.countDocuments(),
      Student.countDocuments({ isActive: true }),
      Student.countDocuments({ hostelResident: true }),
      Student.aggregate([
        { $group: { _id: '$gender', count: { $sum: 1 } } }
      ]),
      Student.aggregate([
        { $lookup: { from: 'programs', localField: 'program', foreignField: '_id', as: 'programInfo' } },
        { $unwind: '$programInfo' },
        { $group: { _id: '$programInfo.name', count: { $sum: 1 } } }
      ]),
      Student.aggregate([
        { $group: { _id: '$batch', count: { $sum: 1 } } },
        { $sort: { _id: -1 } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          total: totalStudents,
          active: activeStudents,
          inactive: totalStudents - activeStudents,
          hostelResidents
        },
        genderDistribution,
        programDistribution,
        batchDistribution
      }
    });
  } catch (error) {
    console.error('Get student stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
});

// GET /api/students/:id - Get student by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID' });
    }

    const student = await Student.findById(id)
      .populate('program', 'name code department duration degreeLevel')
      .populate('hostelRoom', 'roomNumber floor hostel')
      .lean();

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Get additional data
    const [feePayments, attendanceStats] = await Promise.all([
      FeePayment.find({ student: id })
        .sort({ paymentDate: -1 })
        .limit(5)
        .lean(),
      // Placeholder for attendance stats
      Promise.resolve({ totalClasses: 0, attended: 0, percentage: 0 })
    ]);

    res.json({
      success: true,
      data: {
        student,
        feePayments,
        attendanceStats
      }
    });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch student' });
  }
});

// POST /api/students - Create new student
router.post('/', authenticateToken, requireStaff, studentValidation, handleValidationErrors, auditLog, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      gender,
      address,
      program,
      batch,
      photo,
      hostelResident
    } = req.body;

    // Check if email already exists
    const existingStudent = await Student.findOne({ email });
    if (existingStudent) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Generate registration number
    const year = new Date().getFullYear().toString().slice(-2);
    const programDoc = await Program.findById(program);
    const count = await Student.countDocuments({ batch });
    const registrationNumber = `${year}${programDoc?.code || 'STU'}${String(count + 1).padStart(4, '0')}`;

    // Generate library card number
    const libraryCard = `LIB${year}${String(count + 1).padStart(6, '0')}`;

    const student = new Student({
      registrationNumber,
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth: new Date(dateOfBirth),
      gender,
      address,
      program,
      batch,
      photo,
      hostelResident: hostelResident || false,
      libraryCard,
      joiningDate: new Date()
    });

    await student.save();

    // Create user account for the student
    const bcrypt = require('bcryptjs');
    const defaultPassword = await bcrypt.hash('Student@123', 12);
    
    const user = new User({
      name: `${firstName} ${lastName}`,
      email,
      password: defaultPassword,
      role: 'student',
      student: student._id,
      isActive: true
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: {
        student,
        credentials: {
          email,
          defaultPassword: 'Student@123',
          note: 'Please change password on first login'
        }
      }
    });
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({ success: false, message: 'Failed to create student' });
  }
});

// PUT /api/students/:id - Update student
router.put('/:id', authenticateToken, requireStaff, auditLog, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID' });
    }

    const allowedUpdates = [
      'firstName', 'lastName', 'phone', 'address', 'photo',
      'hostelResident', 'hostelRoom', 'isActive'
    ];

    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    updates.updatedAt = new Date();

    const student = await Student.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('program', 'name code');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: { student }
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ success: false, message: 'Failed to update student' });
  }
});

// DELETE /api/students/:id - Soft delete student
router.delete('/:id', authenticateToken, requireAdmin, auditLog, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID' });
    }

    const student = await Student.findByIdAndUpdate(
      id,
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Deactivate associated user account
    await User.findOneAndUpdate(
      { student: id },
      { isActive: false }
    );

    res.json({
      success: true,
      message: 'Student deactivated successfully'
    });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete student' });
  }
});

// ==================== STUDENT DOCUMENTS ====================

// POST /api/students/:id/documents - Upload student documents
router.post('/:id/documents', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, url } = req.body;

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    student.documents.push({
      name,
      type,
      url,
      uploadDate: new Date()
    });

    await student.save();

    res.json({
      success: true,
      message: 'Document added successfully',
      data: { documents: student.documents }
    });
  } catch (error) {
    console.error('Add document error:', error);
    res.status(500).json({ success: false, message: 'Failed to add document' });
  }
});

// GET /api/students/:id/documents - Get student documents
router.get('/:id/documents', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).select('documents');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.json({
      success: true,
      data: { documents: student.documents }
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch documents' });
  }
});

// ==================== STUDENT ACADEMIC RECORDS ====================

// GET /api/students/:id/academic - Get academic records
router.get('/:id/academic', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id).populate('program');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Get exam results if available
    const ExamResult = mongoose.models.ExamResult;
    let examResults = [];
    if (ExamResult) {
      examResults = await ExamResult.find({ student: id })
        .populate('exam', 'name semester')
        .sort({ 'exam.semester': 1 })
        .lean();
    }

    res.json({
      success: true,
      data: {
        student: {
          registrationNumber: student.registrationNumber,
          name: `${student.firstName} ${student.lastName}`,
          program: student.program,
          batch: student.batch
        },
        examResults,
        cgpa: calculateCGPA(examResults)
      }
    });
  } catch (error) {
    console.error('Get academic records error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch academic records' });
  }
});

// Helper function to calculate CGPA
function calculateCGPA(results) {
  if (!results || results.length === 0) return 0;
  
  let totalCredits = 0;
  let totalGradePoints = 0;

  for (const result of results) {
    if (result.credits && result.gradePoint) {
      totalCredits += result.credits;
      totalGradePoints += result.credits * result.gradePoint;
    }
  }

  return totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : 0;
}

// ==================== STUDENT FEE HISTORY ====================

// GET /api/students/:id/fees - Get fee payment history
router.get('/:id/fees', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const payments = await FeePayment.find({ student: id })
      .populate('feeStructure')
      .sort({ paymentDate: -1 })
      .lean();

    const totalPaid = payments
      .filter(p => p.status === 'Completed')
      .reduce((sum, p) => sum + p.amountPaid, 0);

    res.json({
      success: true,
      data: {
        payments,
        summary: {
          totalPayments: payments.length,
          totalPaid,
          pendingPayments: payments.filter(p => p.status === 'Pending').length
        }
      }
    });
  } catch (error) {
    console.error('Get fee history error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fee history' });
  }
});

// ==================== BULK OPERATIONS ====================

// POST /api/students/bulk-import - Bulk import students
router.post('/bulk-import', authenticateToken, requireAdmin, auditLog, async (req, res) => {
  try {
    const { students } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, message: 'Students array is required' });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const studentData of students) {
      try {
        // Generate registration number
        const year = new Date().getFullYear().toString().slice(-2);
        const count = await Student.countDocuments({ batch: studentData.batch });
        const registrationNumber = `${year}STU${String(count + 1).padStart(4, '0')}`;

        const student = new Student({
          ...studentData,
          registrationNumber,
          libraryCard: `LIB${year}${String(count + 1).padStart(6, '0')}`
        });

        await student.save();
        results.success.push({
          email: studentData.email,
          registrationNumber
        });
      } catch (error) {
        results.failed.push({
          email: studentData.email,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Imported ${results.success.length} students, ${results.failed.length} failed`,
      data: results
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ success: false, message: 'Bulk import failed' });
  }
});

// POST /api/students/bulk-update - Bulk update students
router.post('/bulk-update', authenticateToken, requireAdmin, auditLog, async (req, res) => {
  try {
    const { studentIds, updates } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Student IDs array is required' });
    }

    const result = await Student.updateMany(
      { _id: { $in: studentIds } },
      { $set: { ...updates, updatedAt: new Date() } }
    );

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} students`,
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ success: false, message: 'Bulk update failed' });
  }
});

module.exports = router;
