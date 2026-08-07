const express = require('express');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { Student, Program } = require('../../database/models');
const { authenticateToken, requireStaff, requireAdmin, auditLog } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ==================== EXAM SCHEMAS ====================

const ExamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  type: {
    type: String,
    enum: ['Mid-Term', 'End-Term', 'Supplementary', 'Internal', 'Practical'],
    required: true
  },
  semester: { type: Number, required: true },
  academicYear: { type: String, required: true },
  program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  registrationDeadline: { type: Date, required: true },
  subjects: [{
    name: { type: String, required: true },
    code: { type: String, required: true },
    maxMarks: { type: Number, default: 100 },
    passingMarks: { type: Number, default: 40 },
    examDate: { type: Date },
    examTime: { type: String },
    venue: { type: String },
    duration: { type: Number, default: 180 } // minutes
  }],
  status: {
    type: String,
    enum: ['Scheduled', 'Ongoing', 'Completed', 'Results Declared'],
    default: 'Scheduled'
  },
  createdAt: { type: Date, default: Date.now }
});

const ExamRegistrationSchema = new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  subjects: [{ type: String }], // Subject codes
  registrationDate: { type: Date, default: Date.now },
  hallTicketNumber: { type: String, unique: true },
  hallTicketGenerated: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['Registered', 'Confirmed', 'Cancelled'],
    default: 'Registered'
  },
  fee: { type: Number, default: 0 },
  feePaid: { type: Boolean, default: false }
});

const ExamResultSchema = new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  subjectResults: [{
    subjectCode: { type: String, required: true },
    subjectName: { type: String },
    marksObtained: { type: Number, required: true },
    maxMarks: { type: Number, default: 100 },
    grade: { type: String },
    gradePoint: { type: Number },
    credits: { type: Number, default: 3 },
    status: {
      type: String,
      enum: ['Pass', 'Fail', 'Absent', 'Withheld'],
      default: 'Pass'
    }
  }],
  totalMarks: { type: Number },
  percentage: { type: Number },
  sgpa: { type: Number },
  cgpa: { type: Number },
  overallGrade: { type: String },
  overallStatus: {
    type: String,
    enum: ['Pass', 'Fail', 'Compartment', 'Withheld'],
    default: 'Pass'
  },
  remarks: { type: String },
  declaredAt: { type: Date, default: Date.now },
  isPublished: { type: Boolean, default: false }
});

const Exam = mongoose.models.Exam || mongoose.model('Exam', ExamSchema);
const ExamRegistration = mongoose.models.ExamRegistration || mongoose.model('ExamRegistration', ExamRegistrationSchema);
const ExamResult = mongoose.models.ExamResult || mongoose.model('ExamResult', ExamResultSchema);

// Grade calculation helper
function calculateGrade(percentage) {
  if (percentage >= 90) return { grade: 'O', gradePoint: 10 };
  if (percentage >= 80) return { grade: 'A+', gradePoint: 9 };
  if (percentage >= 70) return { grade: 'A', gradePoint: 8 };
  if (percentage >= 60) return { grade: 'B+', gradePoint: 7 };
  if (percentage >= 50) return { grade: 'B', gradePoint: 6 };
  if (percentage >= 40) return { grade: 'C', gradePoint: 5 };
  return { grade: 'F', gradePoint: 0 };
}

// ==================== EXAM MANAGEMENT ====================

// GET /api/exams - List all exams
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, type, semester, academicYear, page = 1, limit = 10 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (semester) query.semester = parseInt(semester);
    if (academicYear) query.academicYear = academicYear;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [exams, total] = await Promise.all([
      Exam.find(query)
        .populate('program', 'name code')
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Exam.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        exams,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get exams error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch exams' });
  }
});

// GET /api/exams/:id - Get exam details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('program', 'name code')
      .lean();

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    const registrationCount = await ExamRegistration.countDocuments({
      exam: req.params.id,
      status: { $ne: 'Cancelled' }
    });

    res.json({
      success: true,
      data: { exam, registeredStudents: registrationCount }
    });
  } catch (error) {
    console.error('Get exam error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch exam' });
  }
});

// POST /api/exams - Create exam
router.post('/', authenticateToken, requireStaff, [
  body('name').trim().notEmpty(),
  body('code').trim().notEmpty(),
  body('type').isIn(['Mid-Term', 'End-Term', 'Supplementary', 'Internal', 'Practical']),
  body('semester').isInt({ min: 1, max: 10 }),
  body('academicYear').matches(/^\d{4}-\d{4}$/),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('registrationDeadline').isISO8601()
], handleValidationErrors, auditLog, async (req, res) => {
  try {
    const examData = req.body;
    
    const exam = new Exam(examData);
    await exam.save();

    res.status(201).json({
      success: true,
      message: 'Exam created successfully',
      data: { exam }
    });
  } catch (error) {
    console.error('Create exam error:', error);
    res.status(500).json({ success: false, message: 'Failed to create exam' });
  }
});

// PUT /api/exams/:id - Update exam
router.put('/:id', authenticateToken, requireStaff, auditLog, async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    res.json({
      success: true,
      message: 'Exam updated successfully',
      data: { exam }
    });
  } catch (error) {
    console.error('Update exam error:', error);
    res.status(500).json({ success: false, message: 'Failed to update exam' });
  }
});

// ==================== EXAM REGISTRATION ====================

// POST /api/exams/:examId/register - Register for exam
router.post('/:examId/register', authenticateToken, async (req, res) => {
  try {
    const { examId } = req.params;
    const { subjects } = req.body;

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    // Check registration deadline
    if (new Date() > exam.registrationDeadline) {
      return res.status(400).json({ success: false, message: 'Registration deadline has passed' });
    }

    // Get student
    const student = await Student.findOne({ email: req.user.email });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Check if already registered
    const existingReg = await ExamRegistration.findOne({
      exam: examId,
      student: student._id,
      status: { $ne: 'Cancelled' }
    });

    if (existingReg) {
      return res.status(400).json({ success: false, message: 'Already registered for this exam' });
    }

    // Generate hall ticket number
    const year = new Date().getFullYear().toString().slice(-2);
    const count = await ExamRegistration.countDocuments({ exam: examId });
    const hallTicketNumber = `${exam.code}${year}${String(count + 1).padStart(5, '0')}`;

    const registration = new ExamRegistration({
      exam: examId,
      student: student._id,
      subjects: subjects || exam.subjects.map(s => s.code),
      hallTicketNumber
    });

    await registration.save();

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { registration, hallTicketNumber }
    });
  } catch (error) {
    console.error('Exam registration error:', error);
    res.status(500).json({ success: false, message: 'Failed to register for exam' });
  }
});

// GET /api/exams/my-registrations - Get student's registrations
router.get('/student/my-registrations', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findOne({ email: req.user.email });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const registrations = await ExamRegistration.find({ student: student._id })
      .populate('exam', 'name code type semester academicYear startDate endDate')
      .sort({ registrationDate: -1 })
      .lean();

    res.json({
      success: true,
      data: { registrations }
    });
  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch registrations' });
  }
});

// ==================== HALL TICKET ====================

// GET /api/exams/hall-ticket/:registrationId - Generate hall ticket PDF
router.get('/hall-ticket/:registrationId', authenticateToken, async (req, res) => {
  try {
    const registration = await ExamRegistration.findById(req.params.registrationId)
      .populate('exam')
      .populate({
        path: 'student',
        populate: { path: 'program', select: 'name code' }
      });

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=hallticket_${registration.hallTicketNumber}.pdf`);

    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('ADMIT CARD / HALL TICKET', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(registration.exam.name, { align: 'center' });
    doc.fontSize(12).text(`Academic Year: ${registration.exam.academicYear}`, { align: 'center' });
    doc.moveDown(2);

    // Student Details
    doc.fontSize(12).font('Helvetica-Bold').text('Student Details');
    doc.font('Helvetica');
    doc.text(`Hall Ticket Number: ${registration.hallTicketNumber}`);
    doc.text(`Name: ${registration.student.firstName} ${registration.student.lastName}`);
    doc.text(`Registration Number: ${registration.student.registrationNumber}`);
    doc.text(`Program: ${registration.student.program?.name || 'N/A'}`);
    doc.moveDown();

    // Exam Schedule
    doc.font('Helvetica-Bold').text('Examination Schedule');
    doc.font('Helvetica');

    const tableTop = doc.y + 10;
    let y = tableTop;

    // Table headers
    doc.text('Subject', 50, y);
    doc.text('Date', 200, y);
    doc.text('Time', 300, y);
    doc.text('Venue', 400, y);
    y += 20;

    // Table rows
    registration.exam.subjects.forEach(subject => {
      if (registration.subjects.includes(subject.code)) {
        doc.text(subject.name, 50, y);
        doc.text(subject.examDate ? new Date(subject.examDate).toLocaleDateString() : 'TBA', 200, y);
        doc.text(subject.examTime || 'TBA', 300, y);
        doc.text(subject.venue || 'TBA', 400, y);
        y += 20;
      }
    });

    // Generate QR code
    const qrData = JSON.stringify({
      hallTicket: registration.hallTicketNumber,
      student: registration.student.registrationNumber,
      exam: registration.exam.code
    });

    const qrCodeDataUrl = await QRCode.toDataURL(qrData);
    doc.image(qrCodeDataUrl, 450, doc.y + 50, { width: 80 });

    doc.moveDown(5);

    // Instructions
    doc.font('Helvetica-Bold').text('Important Instructions:');
    doc.font('Helvetica').fontSize(10);
    doc.text('1. Bring this hall ticket along with a valid photo ID.');
    doc.text('2. Report to the examination center 30 minutes before the exam.');
    doc.text('3. Electronic devices are not allowed in the examination hall.');
    doc.text('4. Use of unfair means will lead to disqualification.');

    doc.moveDown(2);
    doc.fontSize(10).text('This is a computer-generated document.', { align: 'center' });

    // Update registration
    registration.hallTicketGenerated = true;
    await registration.save();

    doc.end();
  } catch (error) {
    console.error('Hall ticket generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate hall ticket' });
  }
});

// ==================== RESULTS MANAGEMENT ====================

// POST /api/exams/:examId/results - Upload results
router.post('/:examId/results', authenticateToken, requireStaff, auditLog, async (req, res) => {
  try {
    const { examId } = req.params;
    const { results } = req.body; // Array of { studentId, subjectResults }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    const savedResults = [];
    const errors = [];

    for (const resultData of results) {
      try {
        // Calculate grades for each subject
        const subjectResults = resultData.subjectResults.map(sr => {
          const percentage = (sr.marksObtained / sr.maxMarks) * 100;
          const { grade, gradePoint } = calculateGrade(percentage);
          return {
            ...sr,
            grade,
            gradePoint,
            status: percentage >= 40 ? 'Pass' : 'Fail'
          };
        });

        // Calculate overall results
        const totalMarks = subjectResults.reduce((sum, sr) => sum + sr.marksObtained, 0);
        const maxTotalMarks = subjectResults.reduce((sum, sr) => sum + sr.maxMarks, 0);
        const percentage = (totalMarks / maxTotalMarks) * 100;
        const { grade: overallGrade } = calculateGrade(percentage);

        // Calculate SGPA
        const totalCredits = subjectResults.reduce((sum, sr) => sum + (sr.credits || 3), 0);
        const totalGradePoints = subjectResults.reduce((sum, sr) => sum + ((sr.credits || 3) * sr.gradePoint), 0);
        const sgpa = totalGradePoints / totalCredits;

        const result = new ExamResult({
          exam: examId,
          student: resultData.studentId,
          subjectResults,
          totalMarks,
          percentage: percentage.toFixed(2),
          sgpa: sgpa.toFixed(2),
          overallGrade,
          overallStatus: subjectResults.every(sr => sr.status === 'Pass') ? 'Pass' : 
                        subjectResults.filter(sr => sr.status === 'Fail').length <= 2 ? 'Compartment' : 'Fail'
        });

        await result.save();
        savedResults.push(result);
      } catch (err) {
        errors.push({ studentId: resultData.studentId, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `${savedResults.length} results uploaded successfully`,
      data: { savedResults: savedResults.length, errors }
    });
  } catch (error) {
    console.error('Upload results error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload results' });
  }
});

// GET /api/exams/:examId/results - Get exam results
router.get('/:examId/results', authenticateToken, async (req, res) => {
  try {
    const { examId } = req.params;
    const { published } = req.query;

    const query = { exam: examId };
    if (published === 'true') query.isPublished = true;

    // If student, only show their results
    if (req.user.role === 'student') {
      const student = await Student.findOne({ email: req.user.email });
      if (student) query.student = student._id;
    }

    const results = await ExamResult.find(query)
      .populate('student', 'firstName lastName registrationNumber')
      .populate('exam', 'name code')
      .lean();

    res.json({
      success: true,
      data: { results }
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch results' });
  }
});

// PUT /api/exams/:examId/results/publish - Publish results
router.put('/:examId/results/publish', authenticateToken, requireAdmin, auditLog, async (req, res) => {
  try {
    const { examId } = req.params;

    await ExamResult.updateMany(
      { exam: examId },
      { isPublished: true }
    );

    await Exam.findByIdAndUpdate(examId, { status: 'Results Declared' });

    res.json({
      success: true,
      message: 'Results published successfully'
    });
  } catch (error) {
    console.error('Publish results error:', error);
    res.status(500).json({ success: false, message: 'Failed to publish results' });
  }
});

// GET /api/exams/student/my-results - Get student's results
router.get('/student/my-results', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findOne({ email: req.user.email });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const results = await ExamResult.find({ student: student._id, isPublished: true })
      .populate('exam', 'name code type semester academicYear')
      .sort({ 'exam.semester': 1 })
      .lean();

    // Calculate overall CGPA
    let totalCredits = 0;
    let totalGradePoints = 0;

    results.forEach(result => {
      result.subjectResults.forEach(sr => {
        totalCredits += sr.credits || 3;
        totalGradePoints += (sr.credits || 3) * sr.gradePoint;
      });
    });

    const cgpa = totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        results,
        cgpa,
        totalCredits,
        totalExams: results.length
      }
    });
  } catch (error) {
    console.error('Get student results error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch results' });
  }
});

// GET /api/exams/grade-card/:studentId - Generate grade card PDF
router.get('/grade-card/:studentId', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId)
      .populate('program', 'name code duration');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const results = await ExamResult.find({ student: student._id, isPublished: true })
      .populate('exam', 'name code semester academicYear')
      .sort({ 'exam.semester': 1 })
      .lean();

    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=gradecard_${student.registrationNumber}.pdf`);

    doc.pipe(res);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('CONSOLIDATED GRADE CARD', { align: 'center' });
    doc.moveDown();

    // Student Info
    doc.fontSize(11).font('Helvetica');
    doc.text(`Name: ${student.firstName} ${student.lastName}`);
    doc.text(`Registration No: ${student.registrationNumber}`);
    doc.text(`Program: ${student.program?.name || 'N/A'}`);
    doc.text(`Batch: ${student.batch}`);
    doc.moveDown();

    // Results table
    let y = doc.y;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Subject', 50, y);
    doc.text('Max', 250, y);
    doc.text('Obtained', 300, y);
    doc.text('Grade', 360, y);
    doc.text('GP', 400, y);
    doc.text('Credits', 440, y);
    y += 20;

    let totalCredits = 0;
    let totalGradePoints = 0;

    doc.font('Helvetica').fontSize(9);
    results.forEach(result => {
      doc.font('Helvetica-Bold').text(`Semester ${result.exam.semester}`, 50, y);
      y += 15;
      doc.font('Helvetica');

      result.subjectResults.forEach(sr => {
        doc.text(sr.subjectName || sr.subjectCode, 50, y);
        doc.text(sr.maxMarks.toString(), 250, y);
        doc.text(sr.marksObtained.toString(), 300, y);
        doc.text(sr.grade, 360, y);
        doc.text(sr.gradePoint.toString(), 400, y);
        doc.text((sr.credits || 3).toString(), 440, y);
        
        totalCredits += sr.credits || 3;
        totalGradePoints += (sr.credits || 3) * sr.gradePoint;
        y += 15;
      });
      y += 10;
    });

    const cgpa = totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : 0;

    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text(`Total Credits Earned: ${totalCredits}`);
    doc.text(`Cumulative Grade Point Average (CGPA): ${cgpa}`);

    doc.moveDown(3);
    doc.fontSize(10).text('Controller of Examinations', 400, doc.y);
    doc.moveDown(2);
    doc.fontSize(8).text('This is a computer-generated document.', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Grade card generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate grade card' });
  }
});

module.exports = router;
