const express = require('express');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const { Student, User } = require('../../database/models');
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

// ==================== ATTENDANCE SCHEMAS ====================

const AttendanceSessionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: String, required: true },
  subjectCode: { type: String },
  faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  semester: { type: Number },
  batch: { type: Number },
  date: { type: Date, default: Date.now },
  startTime: { type: String, required: true },
  endTime: { type: String },
  location: { type: String },
  qrCode: { type: String }, // Base64 QR code
  qrToken: { type: String, unique: true }, // Unique token for QR
  qrExpiresAt: { type: Date },
  status: {
    type: String,
    enum: ['Scheduled', 'Active', 'Completed', 'Cancelled'],
    default: 'Scheduled'
  },
  attendanceType: {
    type: String,
    enum: ['QR', 'Manual', 'Biometric', 'Facial'],
    default: 'QR'
  },
  totalStudents: { type: Number, default: 0 },
  presentCount: { type: Number, default: 0 },
  absentCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const AttendanceRecordSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceSession', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Late', 'Excused', 'On Leave'],
    default: 'Absent'
  },
  markedAt: { type: Date },
  markedBy: {
    type: String,
    enum: ['QR', 'Manual', 'Self', 'System'],
    default: 'System'
  },
  location: {
    latitude: { type: Number },
    longitude: { type: Number }
  },
  deviceInfo: { type: String },
  remarks: { type: String }
});

const LeaveRequestSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  leaveType: {
    type: String,
    enum: ['Sick', 'Personal', 'Family Emergency', 'Academic', 'Other'],
    required: true
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true },
  documents: [{ type: String }], // URLs to supporting documents
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  remarks: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const AttendanceSession = mongoose.models.AttendanceSession || mongoose.model('AttendanceSession', AttendanceSessionSchema);
const AttendanceRecord = mongoose.models.AttendanceRecord || mongoose.model('AttendanceRecord', AttendanceRecordSchema);
const LeaveRequest = mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', LeaveRequestSchema);

// ==================== ATTENDANCE SESSION MANAGEMENT ====================

// POST /api/attendance/sessions - Create attendance session
router.post('/sessions', authenticateToken, requireStaff, [
  body('name').trim().notEmpty(),
  body('subject').trim().notEmpty(),
  body('startTime').notEmpty(),
  body('date').optional().isISO8601()
], handleValidationErrors, async (req, res) => {
  try {
    const { name, subject, subjectCode, program, semester, batch, date, startTime, endTime, location, attendanceType } = req.body;

    // Generate unique QR token
    const crypto = require('crypto');
    const qrToken = crypto.randomBytes(32).toString('hex');
    
    // QR expires in 30 minutes
    const qrExpiresAt = new Date();
    qrExpiresAt.setMinutes(qrExpiresAt.getMinutes() + 30);

    const session = new AttendanceSession({
      name,
      subject,
      subjectCode,
      faculty: req.user.id,
      program,
      semester,
      batch,
      date: date || new Date(),
      startTime,
      endTime,
      location,
      qrToken,
      qrExpiresAt,
      attendanceType: attendanceType || 'QR'
    });

    // Generate QR code
    const qrData = JSON.stringify({
      sessionId: session._id,
      token: qrToken,
      subject,
      date: session.date
    });

    session.qrCode = await QRCode.toDataURL(qrData);

    // Count total students for this batch/program
    const query = {};
    if (batch) query.batch = batch;
    if (program) query.program = program;
    session.totalStudents = await Student.countDocuments(query);

    await session.save();

    // Create absent records for all eligible students
    const students = await Student.find(query).select('_id');
    const absentRecords = students.map(student => ({
      session: session._id,
      student: student._id,
      status: 'Absent'
    }));

    if (absentRecords.length > 0) {
      await AttendanceRecord.insertMany(absentRecords);
    }

    session.absentCount = students.length;
    await session.save();

    res.status(201).json({
      success: true,
      message: 'Attendance session created',
      data: {
        session,
        qrCode: session.qrCode
      }
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ success: false, message: 'Failed to create session' });
  }
});

// GET /api/attendance/sessions - Get attendance sessions
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const { date, subject, status, page = 1, limit = 10 } = req.query;
    const query = {};

    if (date) {
      const startOfDay = new Date(date);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.date = { $gte: startOfDay, $lte: endOfDay };
    }

    if (subject) query.subject = { $regex: subject, $options: 'i' };
    if (status) query.status = status;

    // If faculty, only show their sessions
    if (req.user.role === 'staff') {
      query.faculty = req.user.id;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [sessions, total] = await Promise.all([
      AttendanceSession.find(query)
        .populate('faculty', 'name email')
        .populate('program', 'name code')
        .sort({ date: -1, startTime: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AttendanceSession.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
  }
});

// GET /api/attendance/sessions/:id - Get session details
router.get('/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const session = await AttendanceSession.findById(req.params.id)
      .populate('faculty', 'name email')
      .populate('program', 'name code')
      .lean();

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const records = await AttendanceRecord.find({ session: req.params.id })
      .populate('student', 'firstName lastName registrationNumber')
      .sort({ status: 1 })
      .lean();

    res.json({
      success: true,
      data: { session, records }
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch session' });
  }
});

// PUT /api/attendance/sessions/:id/start - Start attendance session
router.put('/sessions/:id/start', authenticateToken, requireStaff, async (req, res) => {
  try {
    const session = await AttendanceSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Regenerate QR code with new expiry
    const crypto = require('crypto');
    const qrToken = crypto.randomBytes(32).toString('hex');
    const qrExpiresAt = new Date();
    qrExpiresAt.setMinutes(qrExpiresAt.getMinutes() + 30);

    const qrData = JSON.stringify({
      sessionId: session._id,
      token: qrToken,
      subject: session.subject,
      date: session.date
    });

    session.qrToken = qrToken;
    session.qrExpiresAt = qrExpiresAt;
    session.qrCode = await QRCode.toDataURL(qrData);
    session.status = 'Active';

    await session.save();

    res.json({
      success: true,
      message: 'Session started',
      data: { session, qrCode: session.qrCode }
    });
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({ success: false, message: 'Failed to start session' });
  }
});

// PUT /api/attendance/sessions/:id/end - End attendance session
router.put('/sessions/:id/end', authenticateToken, requireStaff, async (req, res) => {
  try {
    const session = await AttendanceSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    session.status = 'Completed';
    session.endTime = new Date().toLocaleTimeString();

    // Update counts
    const presentCount = await AttendanceRecord.countDocuments({
      session: session._id,
      status: { $in: ['Present', 'Late'] }
    });

    session.presentCount = presentCount;
    session.absentCount = session.totalStudents - presentCount;

    await session.save();

    res.json({
      success: true,
      message: 'Session ended',
      data: { session }
    });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ success: false, message: 'Failed to end session' });
  }
});

// ==================== MARK ATTENDANCE ====================

// POST /api/attendance/mark-qr - Mark attendance via QR code
router.post('/mark-qr', authenticateToken, [
  body('qrToken').notEmpty(),
  body('sessionId').isMongoId()
], handleValidationErrors, async (req, res) => {
  try {
    const { sessionId, qrToken, location } = req.body;

    const session = await AttendanceSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Validate QR token
    if (session.qrToken !== qrToken) {
      return res.status(400).json({ success: false, message: 'Invalid QR code' });
    }

    // Check if QR expired
    if (new Date() > session.qrExpiresAt) {
      return res.status(400).json({ success: false, message: 'QR code has expired' });
    }

    // Check if session is active
    if (session.status !== 'Active') {
      return res.status(400).json({ success: false, message: 'Attendance session is not active' });
    }

    // Get student
    const student = await Student.findOne({ email: req.user.email });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Find or create attendance record
    let record = await AttendanceRecord.findOne({
      session: sessionId,
      student: student._id
    });

    if (record && record.status === 'Present') {
      return res.status(400).json({ success: false, message: 'Attendance already marked' });
    }

    if (record) {
      record.status = 'Present';
      record.markedAt = new Date();
      record.markedBy = 'QR';
      if (location) record.location = location;
    } else {
      record = new AttendanceRecord({
        session: sessionId,
        student: student._id,
        status: 'Present',
        markedAt: new Date(),
        markedBy: 'QR',
        location
      });
    }

    await record.save();

    // Update session counts
    const presentCount = await AttendanceRecord.countDocuments({
      session: sessionId,
      status: { $in: ['Present', 'Late'] }
    });

    session.presentCount = presentCount;
    session.absentCount = session.totalStudents - presentCount;
    await session.save();

    res.json({
      success: true,
      message: 'Attendance marked successfully',
      data: {
        subject: session.subject,
        date: session.date,
        status: 'Present'
      }
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark attendance' });
  }
});

// POST /api/attendance/mark-manual - Mark attendance manually (faculty)
router.post('/mark-manual', authenticateToken, requireStaff, [
  body('sessionId').isMongoId(),
  body('records').isArray()
], handleValidationErrors, async (req, res) => {
  try {
    const { sessionId, records } = req.body;

    const session = await AttendanceSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    let updated = 0;
    for (const record of records) {
      await AttendanceRecord.findOneAndUpdate(
        { session: sessionId, student: record.studentId },
        {
          status: record.status,
          markedAt: new Date(),
          markedBy: 'Manual',
          remarks: record.remarks
        },
        { upsert: true }
      );
      updated++;
    }

    // Update session counts
    const presentCount = await AttendanceRecord.countDocuments({
      session: sessionId,
      status: { $in: ['Present', 'Late'] }
    });

    session.presentCount = presentCount;
    session.absentCount = session.totalStudents - presentCount;
    await session.save();

    res.json({
      success: true,
      message: `${updated} records updated`,
      data: { session }
    });
  } catch (error) {
    console.error('Manual attendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to update attendance' });
  }
});

// ==================== STUDENT ATTENDANCE ====================

// GET /api/attendance/my-attendance - Get student's attendance
router.get('/my-attendance', authenticateToken, async (req, res) => {
  try {
    const { subject, startDate, endDate } = req.query;

    const student = await Student.findOne({ email: req.user.email });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const matchQuery = { student: student._id };

    const records = await AttendanceRecord.find(matchQuery)
      .populate({
        path: 'session',
        select: 'name subject date startTime',
        match: {
          ...(subject && { subject: { $regex: subject, $options: 'i' } }),
          ...(startDate && endDate && { date: { $gte: new Date(startDate), $lte: new Date(endDate) } })
        }
      })
      .sort({ 'session.date': -1 })
      .lean();

    // Filter out records where session didn't match
    const filteredRecords = records.filter(r => r.session !== null);

    // Calculate summary
    const totalClasses = filteredRecords.length;
    const present = filteredRecords.filter(r => r.status === 'Present').length;
    const late = filteredRecords.filter(r => r.status === 'Late').length;
    const absent = filteredRecords.filter(r => r.status === 'Absent').length;
    const excused = filteredRecords.filter(r => r.status === 'Excused' || r.status === 'On Leave').length;

    const attendancePercentage = totalClasses > 0 
      ? (((present + late + excused) / totalClasses) * 100).toFixed(1)
      : 0;

    // Group by subject
    const subjectWise = {};
    filteredRecords.forEach(r => {
      const subj = r.session.subject;
      if (!subjectWise[subj]) {
        subjectWise[subj] = { total: 0, present: 0, absent: 0 };
      }
      subjectWise[subj].total++;
      if (r.status === 'Present' || r.status === 'Late') {
        subjectWise[subj].present++;
      } else if (r.status === 'Absent') {
        subjectWise[subj].absent++;
      }
    });

    res.json({
      success: true,
      data: {
        records: filteredRecords,
        summary: {
          totalClasses,
          present,
          late,
          absent,
          excused,
          attendancePercentage: parseFloat(attendancePercentage)
        },
        subjectWise: Object.entries(subjectWise).map(([subject, data]) => ({
          subject,
          ...data,
          percentage: ((data.present / data.total) * 100).toFixed(1)
        }))
      }
    });
  } catch (error) {
    console.error('Get my attendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance' });
  }
});

// ==================== LEAVE MANAGEMENT ====================

// POST /api/attendance/leave - Apply for leave
router.post('/leave', authenticateToken, [
  body('leaveType').isIn(['Sick', 'Personal', 'Family Emergency', 'Academic', 'Other']),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('reason').trim().isLength({ min: 10 })
], handleValidationErrors, async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason, documents } = req.body;

    const student = await Student.findOne({ email: req.user.email });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Check for overlapping leave requests
    const overlapping = await LeaveRequest.findOne({
      student: student._id,
      status: { $ne: 'Rejected' },
      $or: [
        { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } }
      ]
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: 'You already have a leave request for overlapping dates'
      });
    }

    const leave = new LeaveRequest({
      student: student._id,
      leaveType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
      documents: documents || []
    });

    await leave.save();

    res.status(201).json({
      success: true,
      message: 'Leave request submitted',
      data: { leave }
    });
  } catch (error) {
    console.error('Apply leave error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit leave request' });
  }
});

// GET /api/attendance/leave - Get leave requests
router.get('/leave', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = {};

    if (status) query.status = status;

    // If student, only show their requests
    if (req.user.role === 'student') {
      const student = await Student.findOne({ email: req.user.email });
      if (student) query.student = student._id;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [requests, total] = await Promise.all([
      LeaveRequest.find(query)
        .populate('student', 'firstName lastName registrationNumber')
        .populate('approvedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      LeaveRequest.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get leave requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leave requests' });
  }
});

// PUT /api/attendance/leave/:id - Approve/Reject leave
router.put('/leave/:id', authenticateToken, requireStaff, [
  body('status').isIn(['Approved', 'Rejected'])
], handleValidationErrors, async (req, res) => {
  try {
    const { status, remarks } = req.body;

    const leave = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      {
        status,
        remarks,
        approvedBy: req.user.id,
        approvedAt: new Date()
      },
      { new: true }
    ).populate('student', 'firstName lastName');

    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    // If approved, mark attendance as 'On Leave' for those dates
    if (status === 'Approved') {
      await AttendanceRecord.updateMany(
        {
          student: leave.student._id,
          'session.date': { $gte: leave.startDate, $lte: leave.endDate }
        },
        { status: 'On Leave' }
      );
    }

    res.json({
      success: true,
      message: `Leave request ${status.toLowerCase()}`,
      data: { leave }
    });
  } catch (error) {
    console.error('Update leave error:', error);
    res.status(500).json({ success: false, message: 'Failed to update leave request' });
  }
});

// ==================== ATTENDANCE REPORTS ====================

// GET /api/attendance/report - Get attendance report
router.get('/report', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { batch, program, subject, startDate, endDate, format = 'json' } = req.query;

    const sessionQuery = {};
    if (subject) sessionQuery.subject = { $regex: subject, $options: 'i' };
    if (startDate && endDate) {
      sessionQuery.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const sessions = await AttendanceSession.find(sessionQuery).select('_id').lean();
    const sessionIds = sessions.map(s => s._id);

    const studentQuery = {};
    if (batch) studentQuery.batch = parseInt(batch);
    if (program) studentQuery.program = mongoose.Types.ObjectId(program);

    const students = await Student.find(studentQuery)
      .select('firstName lastName registrationNumber')
      .lean();

    const reportData = await Promise.all(
      students.map(async (student) => {
        const records = await AttendanceRecord.find({
          student: student._id,
          session: { $in: sessionIds }
        }).lean();

        const total = records.length;
        const present = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
        const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : 0;

        return {
          registrationNumber: student.registrationNumber,
          name: `${student.firstName} ${student.lastName}`,
          totalClasses: total,
          present,
          absent: total - present,
          percentage
        };
      })
    );

    if (format === 'csv') {
      const headers = Object.keys(reportData[0] || {}).join(',');
      const rows = reportData.map(row => Object.values(row).join(','));
      const csv = [headers, ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.csv');
      return res.send(csv);
    }

    res.json({
      success: true,
      data: {
        report: reportData,
        generatedAt: new Date(),
        totalStudents: reportData.length
      }
    });
  } catch (error) {
    console.error('Attendance report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

module.exports = router;
