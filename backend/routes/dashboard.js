const express = require('express');
const mongoose = require('mongoose');
const { Student, User, FeePayment, Hostel, HostelRoom, LibraryBook, Program, Department } = require('../../database/models');
const { authenticateToken, requireStaff, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ==================== MAIN DASHBOARD STATS ====================

// GET /api/dashboard - Get main dashboard statistics
router.get('/', authenticateToken, requireStaff, async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    // Parallel data fetching
    const [
      // Student Stats
      totalStudents,
      activeStudents,
      newStudentsThisMonth,
      newStudentsLastMonth,
      
      // Fee Stats
      feeCollectionThisMonth,
      feeCollectionLastMonth,
      pendingFees,
      
      // Hostel Stats
      totalHostelCapacity,
      hostelOccupancy,
      
      // Library Stats
      totalBooks,
      booksIssued,
      
      // User Stats
      totalUsers,
      activeUsers
    ] = await Promise.all([
      Student.countDocuments(),
      Student.countDocuments({ isActive: true }),
      Student.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Student.countDocuments({ createdAt: { $gte: lastMonth, $lte: endOfLastMonth } }),
      
      FeePayment.aggregate([
        { $match: { paymentDate: { $gte: startOfMonth }, status: 'Completed' } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]),
      FeePayment.aggregate([
        { $match: { paymentDate: { $gte: lastMonth, $lte: endOfLastMonth }, status: 'Completed' } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]),
      FeePayment.aggregate([
        { $match: { status: 'Pending' } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]),
      
      HostelRoom.aggregate([{ $group: { _id: null, total: { $sum: '$capacity' } } }]),
      HostelRoom.aggregate([{ $unwind: '$occupants' }, { $count: 'total' }]),
      
      mongoose.models.LibraryBook?.countDocuments() || Promise.resolve(0),
      mongoose.models.LibraryTransaction?.countDocuments({ status: 'Issued' }) || Promise.resolve(0),
      
      User.countDocuments(),
      User.countDocuments({ isActive: true })
    ]);

    // Calculate percentage changes
    const studentGrowth = newStudentsLastMonth > 0 
      ? ((newStudentsThisMonth - newStudentsLastMonth) / newStudentsLastMonth * 100).toFixed(1)
      : 100;

    const currentMonthFees = feeCollectionThisMonth[0]?.total || 0;
    const lastMonthFees = feeCollectionLastMonth[0]?.total || 0;
    const feeGrowth = lastMonthFees > 0
      ? ((currentMonthFees - lastMonthFees) / lastMonthFees * 100).toFixed(1)
      : 100;

    const capacity = totalHostelCapacity[0]?.total || 0;
    const occupied = hostelOccupancy[0]?.total || 0;
    const occupancyRate = capacity > 0 ? ((occupied / capacity) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        students: {
          total: totalStudents,
          active: activeStudents,
          newThisMonth: newStudentsThisMonth,
          growth: parseFloat(studentGrowth)
        },
        fees: {
          collectedThisMonth: currentMonthFees,
          collectedLastMonth: lastMonthFees,
          pending: pendingFees[0]?.total || 0,
          growth: parseFloat(feeGrowth)
        },
        hostel: {
          totalCapacity: capacity,
          occupied: occupied,
          available: capacity - occupied,
          occupancyRate: parseFloat(occupancyRate)
        },
        library: {
          totalBooks,
          booksIssued
        },
        users: {
          total: totalUsers,
          active: activeUsers
        },
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
});

// ==================== CHARTS DATA ====================

// GET /api/dashboard/charts/students - Student enrollment trends
router.get('/charts/students', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { period = '12' } = req.query;
    const months = parseInt(period);
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const enrollmentTrend = await Student.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const genderDistribution = await Student.aggregate([
      { $group: { _id: '$gender', count: { $sum: 1 } } }
    ]);

    const programDistribution = await Student.aggregate([
      {
        $lookup: {
          from: 'programs',
          localField: 'program',
          foreignField: '_id',
          as: 'programInfo'
        }
      },
      { $unwind: { path: '$programInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$programInfo.name', 'Unknown'] },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const batchDistribution = await Student.aggregate([
      { $group: { _id: '$batch', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 5 }
    ]);

    // Format enrollment trend for charts
    const formattedTrend = enrollmentTrend.map(item => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      enrollments: item.count
    }));

    res.json({
      success: true,
      data: {
        enrollmentTrend: formattedTrend,
        genderDistribution,
        programDistribution,
        batchDistribution
      }
    });
  } catch (error) {
    console.error('Student charts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch chart data' });
  }
});

// GET /api/dashboard/charts/fees - Fee collection trends
router.get('/charts/fees', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { period = '12' } = req.query;
    const months = parseInt(period);
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const collectionTrend = await FeePayment.aggregate([
      { $match: { paymentDate: { $gte: startDate }, status: 'Completed' } },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' }
          },
          total: { $sum: '$amountPaid' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const paymentMethodDistribution = await FeePayment.aggregate([
      { $match: { status: 'Completed' } },
      { $group: { _id: '$paymentMethod', total: { $sum: '$amountPaid' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);

    const statusDistribution = await FeePayment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amountPaid' } } }
    ]);

    // Daily collection for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const dailyCollection = await FeePayment.aggregate([
      { $match: { paymentDate: { $gte: startOfMonth }, status: 'Completed' } },
      {
        $group: {
          _id: { $dayOfMonth: '$paymentDate' },
          total: { $sum: '$amountPaid' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const formattedTrend = collectionTrend.map(item => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      amount: item.total,
      transactions: item.count
    }));

    res.json({
      success: true,
      data: {
        collectionTrend: formattedTrend,
        paymentMethodDistribution,
        statusDistribution,
        dailyCollection
      }
    });
  } catch (error) {
    console.error('Fee charts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch chart data' });
  }
});

// GET /api/dashboard/charts/hostel - Hostel statistics
router.get('/charts/hostel', authenticateToken, requireStaff, async (req, res) => {
  try {
    const hostelStats = await Hostel.aggregate([
      {
        $lookup: {
          from: 'hostelrooms',
          localField: '_id',
          foreignField: 'hostel',
          as: 'rooms'
        }
      },
      {
        $project: {
          name: 1,
          type: 1,
          totalRooms: { $size: '$rooms' },
          totalCapacity: { $sum: '$rooms.capacity' },
          occupied: {
            $reduce: {
              input: '$rooms',
              initialValue: 0,
              in: { $add: ['$$value', { $size: '$$this.occupants' }] }
            }
          }
        }
      }
    ]);

    const roomTypeDistribution = await HostelRoom.aggregate([
      { $group: { _id: '$roomType', count: { $sum: 1 } } }
    ]);

    const statusDistribution = await HostelRoom.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        hostelStats,
        roomTypeDistribution,
        statusDistribution
      }
    });
  } catch (error) {
    console.error('Hostel charts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch chart data' });
  }
});

// ==================== REPORTS ====================

// GET /api/dashboard/reports/students - Student report
router.get('/reports/students', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { format = 'json', batch, program, status } = req.query;

    const query = {};
    if (batch) query.batch = parseInt(batch);
    if (program) query.program = mongoose.Types.ObjectId(program);
    if (status) query.isActive = status === 'active';

    const students = await Student.find(query)
      .populate('program', 'name code')
      .sort({ registrationNumber: 1 })
      .lean();

    const reportData = students.map(s => ({
      registrationNumber: s.registrationNumber,
      name: `${s.firstName} ${s.lastName}`,
      email: s.email,
      phone: s.phone,
      program: s.program?.name || 'N/A',
      batch: s.batch,
      status: s.isActive ? 'Active' : 'Inactive',
      hostelResident: s.hostelResident ? 'Yes' : 'No',
      joiningDate: s.joiningDate
    }));

    if (format === 'csv') {
      const headers = Object.keys(reportData[0] || {}).join(',');
      const rows = reportData.map(row => Object.values(row).join(','));
      const csv = [headers, ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=students_report.csv');
      return res.send(csv);
    }

    res.json({
      success: true,
      data: {
        report: reportData,
        generatedAt: new Date(),
        totalRecords: reportData.length
      }
    });
  } catch (error) {
    console.error('Student report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// GET /api/dashboard/reports/fees - Fee collection report
router.get('/reports/fees', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { startDate, endDate, status, format = 'json' } = req.query;

    const query = {};
    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = new Date(startDate);
      if (endDate) query.paymentDate.$lte = new Date(endDate);
    }
    if (status) query.status = status;

    const payments = await FeePayment.find(query)
      .populate('student', 'firstName lastName registrationNumber')
      .sort({ paymentDate: -1 })
      .lean();

    const reportData = payments.map(p => ({
      transactionId: p.transactionId,
      receiptNumber: p.receiptNumber,
      studentName: p.student ? `${p.student.firstName} ${p.student.lastName}` : 'N/A',
      registrationNumber: p.student?.registrationNumber || 'N/A',
      amount: p.amountPaid,
      paymentMethod: p.paymentMethod,
      status: p.status,
      paymentDate: p.paymentDate
    }));

    const summary = {
      totalTransactions: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + p.amountPaid, 0),
      completed: payments.filter(p => p.status === 'Completed').length,
      pending: payments.filter(p => p.status === 'Pending').length
    };

    if (format === 'csv') {
      const headers = Object.keys(reportData[0] || {}).join(',');
      const rows = reportData.map(row => Object.values(row).join(','));
      const csv = [headers, ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=fees_report.csv');
      return res.send(csv);
    }

    res.json({
      success: true,
      data: {
        report: reportData,
        summary,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Fee report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// GET /api/dashboard/reports/hostel - Hostel occupancy report
router.get('/reports/hostel', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { hostelId, format = 'json' } = req.query;

    const query = {};
    if (hostelId) query.hostel = mongoose.Types.ObjectId(hostelId);

    const rooms = await HostelRoom.find(query)
      .populate('hostel', 'name type')
      .populate('occupants.student', 'firstName lastName registrationNumber')
      .lean();

    const reportData = rooms.map(r => ({
      hostel: r.hostel?.name || 'N/A',
      roomNumber: r.roomNumber,
      floor: r.floor,
      roomType: r.roomType,
      capacity: r.capacity,
      occupied: r.occupants.length,
      status: r.status,
      occupants: r.occupants.map(o => 
        o.student ? `${o.student.firstName} ${o.student.lastName} (${o.student.registrationNumber})` : 'N/A'
      ).join('; ')
    }));

    if (format === 'csv') {
      const headers = Object.keys(reportData[0] || {}).join(',');
      const rows = reportData.map(row => Object.values(row).join(','));
      const csv = [headers, ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=hostel_report.csv');
      return res.send(csv);
    }

    res.json({
      success: true,
      data: {
        report: reportData,
        generatedAt: new Date(),
        totalRooms: reportData.length
      }
    });
  } catch (error) {
    console.error('Hostel report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// ==================== ACTIVITY LOGS ====================

// GET /api/dashboard/activity - Recent activity
router.get('/activity', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // Get recent activities from various collections
    const [recentStudents, recentPayments, recentLogins] = await Promise.all([
      Student.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('firstName lastName createdAt')
        .lean(),
      FeePayment.find({ status: 'Completed' })
        .sort({ paymentDate: -1 })
        .limit(5)
        .populate('student', 'firstName lastName')
        .select('amountPaid paymentDate student')
        .lean(),
      User.find({ lastLogin: { $exists: true } })
        .sort({ lastLogin: -1 })
        .limit(5)
        .select('name email lastLogin role')
        .lean()
    ]);

    const activities = [];

    recentStudents.forEach(s => {
      activities.push({
        type: 'student_registered',
        message: `New student ${s.firstName} ${s.lastName} registered`,
        timestamp: s.createdAt,
        icon: 'user-plus'
      });
    });

    recentPayments.forEach(p => {
      activities.push({
        type: 'fee_payment',
        message: `Fee payment of ₹${p.amountPaid} received from ${p.student?.firstName || 'Unknown'}`,
        timestamp: p.paymentDate,
        icon: 'credit-card'
      });
    });

    recentLogins.forEach(u => {
      activities.push({
        type: 'user_login',
        message: `${u.name} (${u.role}) logged in`,
        timestamp: u.lastLogin,
        icon: 'log-in'
      });
    });

    // Sort by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedActivities = activities.slice(0, parseInt(limit));

    res.json({
      success: true,
      data: { activities: limitedActivities }
    });
  } catch (error) {
    console.error('Activity log error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch activity' });
  }
});

// ==================== QUICK STATS FOR WIDGETS ====================

// GET /api/dashboard/quick-stats - Quick stats for dashboard widgets
router.get('/quick-stats', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      todayPayments,
      todayNewStudents,
      activeLibraryTransactions,
      pendingComplaints
    ] = await Promise.all([
      FeePayment.aggregate([
        { $match: { paymentDate: { $gte: today }, status: 'Completed' } },
        { $group: { _id: null, total: { $sum: '$amountPaid' }, count: { $sum: 1 } } }
      ]),
      Student.countDocuments({ createdAt: { $gte: today } }),
      mongoose.models.LibraryTransaction?.countDocuments({ status: 'Issued' }) || Promise.resolve(0),
      mongoose.models.HostelComplaint?.countDocuments({ status: 'Pending' }) || Promise.resolve(0)
    ]);

    res.json({
      success: true,
      data: {
        todayCollection: todayPayments[0]?.total || 0,
        todayTransactions: todayPayments[0]?.count || 0,
        todayNewStudents,
        activeLibraryTransactions,
        pendingComplaints
      }
    });
  } catch (error) {
    console.error('Quick stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quick stats' });
  }
});

module.exports = router;
