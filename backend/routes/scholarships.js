const express = require('express');
const mongoose = require('mongoose');
const { Student, User, Department, Program } = require('../../database/models');
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

// ==================== SCHOLARSHIP SCHEMAS ====================

const ScholarshipSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  description: { type: String },
  type: {
    type: String,
    enum: ['Merit', 'Need-Based', 'Sports', 'Minority', 'Disability', 'State Government', 'Central Government', 'Private', 'Other'],
    required: true
  },
  fundingSource: {
    type: String,
    enum: ['Government', 'Private', 'Institution', 'NGO', 'Corporate'],
    default: 'Government'
  },
  amount: { type: Number, required: true },
  amountType: {
    type: String,
    enum: ['Fixed', 'Percentage', 'Full Tuition', 'Full Fee'],
    default: 'Fixed'
  },
  eligibility: {
    minPercentage: { type: Number },
    maxIncome: { type: Number }, // Annual family income limit
    categories: [{ type: String }], // General, OBC, SC, ST, etc.
    gender: { type: String, enum: ['Any', 'Male', 'Female', 'Other'] },
    programs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Program' }],
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    domicile: { type: String }, // State domicile requirement
    minAttendance: { type: Number }, // Minimum attendance percentage
    otherCriteria: [{ type: String }]
  },
  applicationDeadline: { type: Date },
  applicationStartDate: { type: Date },
  renewalRequired: { type: Boolean, default: false },
  renewalCriteria: { type: String },
  documentsRequired: [{
    name: { type: String },
    description: { type: String },
    mandatory: { type: Boolean, default: true }
  }],
  totalSlots: { type: Number },
  filledSlots: { type: Number, default: 0 },
  academicYear: { type: String }, // e.g., "2024-25"
  status: {
    type: String,
    enum: ['Active', 'Closed', 'Upcoming', 'Discontinued'],
    default: 'Active'
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const ScholarshipApplicationSchema = new mongoose.Schema({
  scholarship: { type: mongoose.Schema.Types.ObjectId, ref: 'Scholarship', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  academicYear: { type: String, required: true },
  applicationDate: { type: Date, default: Date.now },
  
  // Student provided data
  familyIncome: { type: Number },
  category: { type: String },
  bankDetails: {
    accountNumber: { type: String },
    bankName: { type: String },
    ifscCode: { type: String },
    accountHolderName: { type: String }
  },
  documents: [{
    name: { type: String },
    url: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false }
  }],
  statement: { type: String }, // Personal statement/essay
  
  // Review process
  status: {
    type: String,
    enum: ['Draft', 'Submitted', 'Under Review', 'Documents Pending', 'Approved', 'Rejected', 'Disbursed', 'Cancelled'],
    default: 'Draft'
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  reviewRemarks: { type: String },
  rejectionReason: { type: String },
  
  // Disbursement
  disbursementStatus: {
    type: String,
    enum: ['Pending', 'Processing', 'Completed', 'Failed'],
    default: 'Pending'
  },
  disbursementDate: { type: Date },
  disbursementAmount: { type: Number },
  transactionId: { type: String },
  
  // Audit
  statusHistory: [{
    status: { type: String },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    remarks: { type: String }
  }]
});

const Scholarship = mongoose.models.Scholarship || mongoose.model('Scholarship', ScholarshipSchema);
const ScholarshipApplication = mongoose.models.ScholarshipApplication || mongoose.model('ScholarshipApplication', ScholarshipApplicationSchema);

// ==================== SCHOLARSHIP MANAGEMENT ====================

// POST /api/scholarships - Create new scholarship
router.post('/', authenticateToken, requireAdmin, [
  body('name').trim().notEmpty(),
  body('code').trim().notEmpty(),
  body('type').isIn(['Merit', 'Need-Based', 'Sports', 'Minority', 'Disability', 'State Government', 'Central Government', 'Private', 'Other']),
  body('amount').isNumeric()
], handleValidationErrors, async (req, res) => {
  try {
    const scholarshipData = {
      ...req.body,
      createdBy: req.user.id
    };

    const scholarship = new Scholarship(scholarshipData);
    await scholarship.save();

    res.status(201).json({
      success: true,
      message: 'Scholarship created successfully',
      data: { scholarship }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Scholarship code already exists' });
    }
    console.error('Create scholarship error:', error);
    res.status(500).json({ success: false, message: 'Failed to create scholarship' });
  }
});

// GET /api/scholarships - List scholarships
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type, status, search, page = 1, limit = 10 } = req.query;
    const query = {};

    if (type) query.type = type;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [scholarships, total] = await Promise.all([
      Scholarship.find(query)
        .populate('eligibility.programs', 'name code')
        .populate('eligibility.departments', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Scholarship.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        scholarships,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get scholarships error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch scholarships' });
  }
});

// GET /api/scholarships/eligible - Get scholarships student is eligible for
router.get('/eligible', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findOne({ email: req.user.email })
      .populate('program')
      .lean();

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const now = new Date();
    const query = {
      status: 'Active',
      $or: [
        { applicationDeadline: { $gte: now } },
        { applicationDeadline: null }
      ]
    };

    const scholarships = await Scholarship.find(query).lean();

    // Filter based on eligibility
    const eligibleScholarships = scholarships.filter(s => {
      const elig = s.eligibility || {};
      
      // Check minimum percentage
      if (elig.minPercentage && student.previousEducation?.percentage < elig.minPercentage) {
        return false;
      }

      // Check program eligibility
      if (elig.programs?.length > 0) {
        if (!elig.programs.some(p => p.toString() === student.program?._id?.toString())) {
          return false;
        }
      }

      // Check category
      if (elig.categories?.length > 0) {
        if (!elig.categories.includes(student.category)) {
          return false;
        }
      }

      // Check gender
      if (elig.gender && elig.gender !== 'Any' && elig.gender !== student.gender) {
        return false;
      }

      // Check if slots available
      if (s.totalSlots && s.filledSlots >= s.totalSlots) {
        return false;
      }

      return true;
    });

    // Check if already applied
    const applications = await ScholarshipApplication.find({
      student: student._id,
      scholarship: { $in: eligibleScholarships.map(s => s._id) }
    }).select('scholarship status').lean();

    const applicationMap = {};
    applications.forEach(app => {
      applicationMap[app.scholarship.toString()] = app.status;
    });

    const result = eligibleScholarships.map(s => ({
      ...s,
      applicationStatus: applicationMap[s._id.toString()] || 'Not Applied'
    }));

    res.json({
      success: true,
      data: {
        scholarships: result,
        total: result.length
      }
    });
  } catch (error) {
    console.error('Get eligible scholarships error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch eligible scholarships' });
  }
});

// GET /api/scholarships/:id - Get scholarship details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id)
      .populate('eligibility.programs', 'name code')
      .populate('eligibility.departments', 'name')
      .populate('createdBy', 'name')
      .lean();

    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    // Get application statistics
    const stats = await ScholarshipApplication.aggregate([
      { $match: { scholarship: mongoose.Types.ObjectId(req.params.id) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const applicationStats = {};
    stats.forEach(s => {
      applicationStats[s._id] = s.count;
    });

    res.json({
      success: true,
      data: {
        scholarship,
        applicationStats
      }
    });
  } catch (error) {
    console.error('Get scholarship error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch scholarship' });
  }
});

// PUT /api/scholarships/:id - Update scholarship
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const scholarship = await Scholarship.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    res.json({
      success: true,
      message: 'Scholarship updated',
      data: { scholarship }
    });
  } catch (error) {
    console.error('Update scholarship error:', error);
    res.status(500).json({ success: false, message: 'Failed to update scholarship' });
  }
});

// ==================== SCHOLARSHIP APPLICATIONS ====================

// POST /api/scholarships/:id/apply - Apply for scholarship
router.post('/:id/apply', authenticateToken, async (req, res) => {
  try {
    const scholarship = await Scholarship.findById(req.params.id);
    if (!scholarship) {
      return res.status(404).json({ success: false, message: 'Scholarship not found' });
    }

    if (scholarship.status !== 'Active') {
      return res.status(400).json({ success: false, message: 'Scholarship is not active' });
    }

    if (scholarship.applicationDeadline && new Date() > scholarship.applicationDeadline) {
      return res.status(400).json({ success: false, message: 'Application deadline has passed' });
    }

    const student = await Student.findOne({ email: req.user.email });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Check for existing application
    const existingApp = await ScholarshipApplication.findOne({
      scholarship: req.params.id,
      student: student._id,
      academicYear: req.body.academicYear || '2024-25'
    });

    if (existingApp) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this scholarship'
      });
    }

    const { familyIncome, category, bankDetails, documents, statement, submit } = req.body;

    const application = new ScholarshipApplication({
      scholarship: req.params.id,
      student: student._id,
      academicYear: req.body.academicYear || '2024-25',
      familyIncome,
      category,
      bankDetails,
      documents,
      statement,
      status: submit ? 'Submitted' : 'Draft',
      statusHistory: [{
        status: submit ? 'Submitted' : 'Draft',
        changedBy: req.user.id,
        remarks: 'Application created'
      }]
    });

    await application.save();

    res.status(201).json({
      success: true,
      message: submit ? 'Application submitted successfully' : 'Application saved as draft',
      data: { application }
    });
  } catch (error) {
    console.error('Apply scholarship error:', error);
    res.status(500).json({ success: false, message: 'Failed to apply for scholarship' });
  }
});

// GET /api/scholarships/applications/my - Get student's applications
router.get('/applications/my', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findOne({ email: req.user.email });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const applications = await ScholarshipApplication.find({ student: student._id })
      .populate('scholarship', 'name code amount type')
      .sort({ applicationDate: -1 })
      .lean();

    res.json({
      success: true,
      data: { applications }
    });
  } catch (error) {
    console.error('Get my applications error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch applications' });
  }
});

// GET /api/scholarships/applications/all - Get all applications (admin)
router.get('/applications/all', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { status, scholarshipId, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (scholarshipId) query.scholarship = scholarshipId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let applications = await ScholarshipApplication.find(query)
      .populate('scholarship', 'name code amount type')
      .populate('student', 'firstName lastName registrationNumber email')
      .populate('reviewedBy', 'name')
      .sort({ applicationDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    if (search) {
      applications = applications.filter(app => {
        const studentName = `${app.student?.firstName} ${app.student?.lastName}`.toLowerCase();
        return studentName.includes(search.toLowerCase()) ||
               app.student?.registrationNumber?.toLowerCase().includes(search.toLowerCase());
      });
    }

    const total = await ScholarshipApplication.countDocuments(query);

    res.json({
      success: true,
      data: {
        applications,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get all applications error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch applications' });
  }
});

// PUT /api/scholarships/applications/:id/review - Review application
router.put('/applications/:id/review', authenticateToken, requireStaff, [
  body('status').isIn(['Under Review', 'Documents Pending', 'Approved', 'Rejected'])
], handleValidationErrors, async (req, res) => {
  try {
    const { status, reviewRemarks, rejectionReason, disbursementAmount } = req.body;

    const application = await ScholarshipApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    application.status = status;
    application.reviewedBy = req.user.id;
    application.reviewedAt = new Date();
    if (reviewRemarks) application.reviewRemarks = reviewRemarks;
    if (rejectionReason) application.rejectionReason = rejectionReason;
    if (disbursementAmount) application.disbursementAmount = disbursementAmount;

    application.statusHistory.push({
      status,
      changedBy: req.user.id,
      remarks: reviewRemarks || rejectionReason
    });

    await application.save();

    // Update filled slots if approved
    if (status === 'Approved') {
      await Scholarship.findByIdAndUpdate(application.scholarship, {
        $inc: { filledSlots: 1 }
      });
    }

    res.json({
      success: true,
      message: `Application ${status.toLowerCase()}`,
      data: { application }
    });
  } catch (error) {
    console.error('Review application error:', error);
    res.status(500).json({ success: false, message: 'Failed to review application' });
  }
});

// POST /api/scholarships/applications/:id/disburse - Disburse scholarship
router.post('/applications/:id/disburse', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { transactionId, amount } = req.body;

    const application = await ScholarshipApplication.findById(req.params.id)
      .populate('scholarship');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.status !== 'Approved') {
      return res.status(400).json({ success: false, message: 'Application must be approved before disbursement' });
    }

    application.disbursementStatus = 'Completed';
    application.disbursementDate = new Date();
    application.disbursementAmount = amount || application.scholarship.amount;
    application.transactionId = transactionId;
    application.status = 'Disbursed';

    application.statusHistory.push({
      status: 'Disbursed',
      changedBy: req.user.id,
      remarks: `Amount Rs. ${application.disbursementAmount} disbursed. Transaction ID: ${transactionId}`
    });

    await application.save();

    res.json({
      success: true,
      message: 'Scholarship disbursed successfully',
      data: { application }
    });
  } catch (error) {
    console.error('Disburse scholarship error:', error);
    res.status(500).json({ success: false, message: 'Failed to disburse scholarship' });
  }
});

// ==================== SCHOLARSHIP STATISTICS ====================

// GET /api/scholarships/stats - Get scholarship statistics
router.get('/stats/overview', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { academicYear = '2024-25' } = req.query;

    const [
      totalScholarships,
      activeScholarships,
      totalApplications,
      applicationsByStatus,
      totalDisbursed,
      topScholarships
    ] = await Promise.all([
      Scholarship.countDocuments(),
      Scholarship.countDocuments({ status: 'Active' }),
      ScholarshipApplication.countDocuments({ academicYear }),
      ScholarshipApplication.aggregate([
        { $match: { academicYear } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      ScholarshipApplication.aggregate([
        { $match: { academicYear, status: 'Disbursed' } },
        { $group: { _id: null, total: { $sum: '$disbursementAmount' }, count: { $sum: 1 } } }
      ]),
      ScholarshipApplication.aggregate([
        { $match: { academicYear } },
        { $group: { _id: '$scholarship', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'scholarships', localField: '_id', foreignField: '_id', as: 'scholarship' } },
        { $unwind: '$scholarship' }
      ])
    ]);

    const statusMap = {};
    applicationsByStatus.forEach(s => {
      statusMap[s._id] = s.count;
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalScholarships,
          activeScholarships,
          totalApplications,
          approvedApplications: statusMap['Approved'] || 0,
          rejectedApplications: statusMap['Rejected'] || 0,
          pendingApplications: (statusMap['Submitted'] || 0) + (statusMap['Under Review'] || 0),
          disbursedCount: totalDisbursed[0]?.count || 0,
          totalDisbursedAmount: totalDisbursed[0]?.total || 0
        },
        applicationsByStatus: statusMap,
        topScholarships: topScholarships.map(s => ({
          name: s.scholarship.name,
          code: s.scholarship.code,
          applications: s.count
        }))
      }
    });
  } catch (error) {
    console.error('Get scholarship stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
});

module.exports = router;
