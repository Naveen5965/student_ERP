const express = require('express');
const mongoose = require('mongoose');
const { Hostel, HostelRoom, Student, User } = require('../../database/models');
const { authenticateToken, requireStaff, requireAdmin, auditLog } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');

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

// ==================== HOSTEL MANAGEMENT ====================

// GET /api/hostel - Get all hostels
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type, status } = req.query;
    const query = {};

    if (type) query.type = type;

    const hostels = await Hostel.find(query).lean();

    // Calculate occupancy for each hostel
    const hostelsWithOccupancy = await Promise.all(
      hostels.map(async (hostel) => {
        const rooms = await HostelRoom.find({ hostel: hostel._id });
        const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
        const occupiedBeds = rooms.reduce((sum, room) => sum + room.occupants.length, 0);
        
        return {
          ...hostel,
          totalRooms: rooms.length,
          totalCapacity,
          occupiedBeds,
          availableBeds: totalCapacity - occupiedBeds,
          occupancyRate: totalCapacity > 0 ? ((occupiedBeds / totalCapacity) * 100).toFixed(1) : 0
        };
      })
    );

    res.json({
      success: true,
      data: { hostels: hostelsWithOccupancy }
    });
  } catch (error) {
    console.error('Get hostels error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch hostels' });
  }
});

// GET /api/hostel/stats - Get hostel statistics
router.get('/stats', authenticateToken, requireStaff, async (req, res) => {
  try {
    const [
      totalHostels,
      totalRooms,
      roomStats,
      typeDistribution
    ] = await Promise.all([
      Hostel.countDocuments(),
      HostelRoom.countDocuments(),
      HostelRoom.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Hostel.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalCapacity: { $sum: '$capacity' }
          }
        }
      ])
    ]);

    const totalCapacity = await HostelRoom.aggregate([
      { $group: { _id: null, total: { $sum: '$capacity' } } }
    ]);

    const occupiedBeds = await HostelRoom.aggregate([
      { $unwind: '$occupants' },
      { $count: 'total' }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalHostels,
          totalRooms,
          totalCapacity: totalCapacity[0]?.total || 0,
          occupiedBeds: occupiedBeds[0]?.total || 0
        },
        roomStats,
        typeDistribution
      }
    });
  } catch (error) {
    console.error('Get hostel stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
});

// POST /api/hostel - Create new hostel
router.post('/', authenticateToken, requireAdmin, [
  body('name').trim().notEmpty().withMessage('Hostel name is required'),
  body('type').isIn(['Boys', 'Girls', 'Co-ed']).withMessage('Valid hostel type is required'),
  body('capacity').isInt({ min: 1 }).withMessage('Valid capacity is required'),
  body('floors').isInt({ min: 1 }).withMessage('Valid number of floors is required')
], handleValidationErrors, auditLog, async (req, res) => {
  try {
    const { name, type, warden, capacity, floors, facilities } = req.body;

    const hostel = new Hostel({
      name,
      type,
      warden,
      capacity,
      floors,
      facilities: facilities || []
    });

    await hostel.save();

    res.status(201).json({
      success: true,
      message: 'Hostel created successfully',
      data: { hostel }
    });
  } catch (error) {
    console.error('Create hostel error:', error);
    res.status(500).json({ success: false, message: 'Failed to create hostel' });
  }
});

// PUT /api/hostel/:id - Update hostel
router.put('/:id', authenticateToken, requireAdmin, auditLog, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const hostel = await Hostel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    res.json({
      success: true,
      message: 'Hostel updated successfully',
      data: { hostel }
    });
  } catch (error) {
    console.error('Update hostel error:', error);
    res.status(500).json({ success: false, message: 'Failed to update hostel' });
  }
});

// ==================== ROOM MANAGEMENT ====================

// GET /api/hostel/:hostelId/rooms - Get rooms in a hostel
router.get('/:hostelId/rooms', authenticateToken, async (req, res) => {
  try {
    const { hostelId } = req.params;
    const { floor, status, roomType } = req.query;

    const query = { hostel: hostelId };
    if (floor) query.floor = parseInt(floor);
    if (status) query.status = status;
    if (roomType) query.roomType = roomType;

    const rooms = await HostelRoom.find(query)
      .populate('occupants.student', 'firstName lastName registrationNumber')
      .sort({ floor: 1, roomNumber: 1 })
      .lean();

    res.json({
      success: true,
      data: { rooms }
    });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rooms' });
  }
});

// GET /api/hostel/rooms/available - Get available rooms across all hostels
router.get('/rooms/available', authenticateToken, async (req, res) => {
  try {
    const { type, roomType } = req.query;

    let hostelQuery = {};
    if (type) hostelQuery.type = type;

    const hostels = await Hostel.find(hostelQuery).select('_id name type');
    const hostelIds = hostels.map(h => h._id);

    const roomQuery = {
      hostel: { $in: hostelIds },
      status: 'Available'
    };
    if (roomType) roomQuery.roomType = roomType;

    const rooms = await HostelRoom.find(roomQuery)
      .populate('hostel', 'name type')
      .lean();

    // Filter rooms with available beds
    const availableRooms = rooms.filter(room => 
      room.occupants.length < room.capacity
    );

    res.json({
      success: true,
      data: { rooms: availableRooms }
    });
  } catch (error) {
    console.error('Get available rooms error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch available rooms' });
  }
});

// POST /api/hostel/:hostelId/rooms - Create room
router.post('/:hostelId/rooms', authenticateToken, requireStaff, [
  body('roomNumber').trim().notEmpty().withMessage('Room number is required'),
  body('floor').isInt({ min: 0 }).withMessage('Valid floor is required'),
  body('capacity').isInt({ min: 1, max: 10 }).withMessage('Valid capacity is required'),
  body('roomType').isIn(['Single', 'Double', 'Triple', 'Dormitory']).withMessage('Valid room type is required')
], handleValidationErrors, auditLog, async (req, res) => {
  try {
    const { hostelId } = req.params;
    const { roomNumber, floor, capacity, roomType, facilities, monthlyRent } = req.body;

    // Check if hostel exists
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    // Check if room number already exists in this hostel
    const existingRoom = await HostelRoom.findOne({ hostel: hostelId, roomNumber });
    if (existingRoom) {
      return res.status(409).json({ success: false, message: 'Room number already exists' });
    }

    const room = new HostelRoom({
      hostel: hostelId,
      roomNumber,
      floor,
      capacity,
      roomType,
      facilities: facilities || [],
      monthlyRent: monthlyRent || 0,
      status: 'Available'
    });

    await room.save();

    res.status(201).json({
      success: true,
      message: 'Room created successfully',
      data: { room }
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ success: false, message: 'Failed to create room' });
  }
});

// POST /api/hostel/rooms/:roomId/allocate - Allocate student to room
router.post('/rooms/:roomId/allocate', authenticateToken, requireStaff, [
  body('studentId').isMongoId().withMessage('Valid student ID is required')
], handleValidationErrors, auditLog, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { studentId } = req.body;

    const room = await HostelRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    // Check if room has capacity
    if (room.occupants.length >= room.capacity) {
      return res.status(400).json({ success: false, message: 'Room is at full capacity' });
    }

    // Check if student exists and is not already allocated
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (student.hostelRoom) {
      return res.status(400).json({ success: false, message: 'Student already has a room allocated' });
    }

    // Allocate room
    room.occupants.push({
      student: studentId,
      allocationDate: new Date()
    });

    if (room.occupants.length >= room.capacity) {
      room.status = 'Occupied';
      room.isOccupied = true;
    }

    await room.save();

    // Update student record
    student.hostelResident = true;
    student.hostelRoom = roomId;
    await student.save();

    res.json({
      success: true,
      message: 'Room allocated successfully',
      data: { room }
    });
  } catch (error) {
    console.error('Allocate room error:', error);
    res.status(500).json({ success: false, message: 'Failed to allocate room' });
  }
});

// POST /api/hostel/rooms/:roomId/vacate - Vacate student from room
router.post('/rooms/:roomId/vacate', authenticateToken, requireStaff, [
  body('studentId').isMongoId().withMessage('Valid student ID is required')
], handleValidationErrors, auditLog, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { studentId } = req.body;

    const room = await HostelRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    // Find and remove occupant
    const occupantIndex = room.occupants.findIndex(
      o => o.student.toString() === studentId
    );

    if (occupantIndex === -1) {
      return res.status(400).json({ success: false, message: 'Student not found in this room' });
    }

    room.occupants[occupantIndex].vacatingDate = new Date();
    room.occupants.splice(occupantIndex, 1);

    room.status = 'Available';
    room.isOccupied = room.occupants.length > 0;

    await room.save();

    // Update student record
    await Student.findByIdAndUpdate(studentId, {
      hostelResident: false,
      hostelRoom: null
    });

    res.json({
      success: true,
      message: 'Room vacated successfully',
      data: { room }
    });
  } catch (error) {
    console.error('Vacate room error:', error);
    res.status(500).json({ success: false, message: 'Failed to vacate room' });
  }
});

// ==================== COMPLAINTS MANAGEMENT ====================

// Complaint Schema (inline for now, should be in models.js)
const ComplaintSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'HostelRoom', required: true },
  category: {
    type: String,
    enum: ['Maintenance', 'Cleanliness', 'Security', 'Mess', 'Roommate', 'Other'],
    required: true
  },
  description: { type: String, required: true },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Resolved', 'Closed'],
    default: 'Pending'
  },
  assignedTo: { type: String },
  resolution: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date }
});

const HostelComplaint = mongoose.models.HostelComplaint || mongoose.model('HostelComplaint', ComplaintSchema);

// GET /api/hostel/complaints - Get all complaints
router.get('/complaints', authenticateToken, async (req, res) => {
  try {
    const { status, priority, category, page = 1, limit = 10 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    // If student, only show their complaints
    if (req.user.role === 'student') {
      const student = await Student.findOne({ email: req.user.email });
      if (student) {
        query.student = student._id;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [complaints, total] = await Promise.all([
      HostelComplaint.find(query)
        .populate('student', 'firstName lastName registrationNumber')
        .populate('room', 'roomNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      HostelComplaint.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        complaints,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints' });
  }
});

// POST /api/hostel/complaints - Create complaint
router.post('/complaints', authenticateToken, [
  body('category').isIn(['Maintenance', 'Cleanliness', 'Security', 'Mess', 'Roommate', 'Other']),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('priority').optional().isIn(['Low', 'Medium', 'High', 'Urgent'])
], handleValidationErrors, async (req, res) => {
  try {
    const { category, description, priority } = req.body;

    // Get student info
    const student = await Student.findOne({ email: req.user.email });
    if (!student || !student.hostelRoom) {
      return res.status(400).json({ 
        success: false, 
        message: 'You must be a hostel resident to file a complaint' 
      });
    }

    const complaint = new HostelComplaint({
      student: student._id,
      room: student.hostelRoom,
      category,
      description,
      priority: priority || 'Medium'
    });

    await complaint.save();

    res.status(201).json({
      success: true,
      message: 'Complaint registered successfully',
      data: { complaint }
    });
  } catch (error) {
    console.error('Create complaint error:', error);
    res.status(500).json({ success: false, message: 'Failed to create complaint' });
  }
});

// PUT /api/hostel/complaints/:id - Update complaint status
router.put('/complaints/:id', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedTo, resolution } = req.body;

    const updates = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (assignedTo) updates.assignedTo = assignedTo;
    if (resolution) updates.resolution = resolution;
    if (status === 'Resolved') updates.resolvedAt = new Date();

    const complaint = await HostelComplaint.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    ).populate('student', 'firstName lastName registrationNumber');

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    res.json({
      success: true,
      message: 'Complaint updated successfully',
      data: { complaint }
    });
  } catch (error) {
    console.error('Update complaint error:', error);
    res.status(500).json({ success: false, message: 'Failed to update complaint' });
  }
});

// ==================== MESS MANAGEMENT ====================

// Mess Menu Schema
const MessMenuSchema = new mongoose.Schema({
  hostel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel' },
  dayOfWeek: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    required: true
  },
  breakfast: [{ name: String, isVeg: { type: Boolean, default: true } }],
  lunch: [{ name: String, isVeg: { type: Boolean, default: true } }],
  snacks: [{ name: String, isVeg: { type: Boolean, default: true } }],
  dinner: [{ name: String, isVeg: { type: Boolean, default: true } }],
  specialItems: [{ name: String, isVeg: { type: Boolean, default: true } }],
  isActive: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
});

const MessMenu = mongoose.models.MessMenu || mongoose.model('MessMenu', MessMenuSchema);

// GET /api/hostel/mess/menu - Get mess menu
router.get('/mess/menu', authenticateToken, async (req, res) => {
  try {
    const { hostelId, day } = req.query;

    const query = { isActive: true };
    if (hostelId) query.hostel = hostelId;
    if (day) query.dayOfWeek = day;

    const menu = await MessMenu.find(query)
      .populate('hostel', 'name')
      .sort({ dayOfWeek: 1 })
      .lean();

    res.json({
      success: true,
      data: { menu }
    });
  } catch (error) {
    console.error('Get mess menu error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch menu' });
  }
});

// POST /api/hostel/mess/menu - Create/Update mess menu
router.post('/mess/menu', authenticateToken, requireStaff, auditLog, async (req, res) => {
  try {
    const { hostelId, dayOfWeek, breakfast, lunch, snacks, dinner, specialItems } = req.body;

    const menu = await MessMenu.findOneAndUpdate(
      { hostel: hostelId, dayOfWeek },
      {
        hostel: hostelId,
        dayOfWeek,
        breakfast,
        lunch,
        snacks,
        dinner,
        specialItems,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Menu updated successfully',
      data: { menu }
    });
  } catch (error) {
    console.error('Update mess menu error:', error);
    res.status(500).json({ success: false, message: 'Failed to update menu' });
  }
});

// ==================== VISITOR MANAGEMENT ====================

const VisitorSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  visitorName: { type: String, required: true },
  visitorPhone: { type: String, required: true },
  relationship: { type: String, required: true },
  purpose: { type: String, required: true },
  checkInTime: { type: Date, default: Date.now },
  checkOutTime: { type: Date },
  idProof: { type: String },
  status: {
    type: String,
    enum: ['Checked In', 'Checked Out'],
    default: 'Checked In'
  }
});

const HostelVisitor = mongoose.models.HostelVisitor || mongoose.model('HostelVisitor', VisitorSchema);

// GET /api/hostel/visitors - Get visitors
router.get('/visitors', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { date, status, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (date) {
      const startOfDay = new Date(date);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.checkInTime = { $gte: startOfDay, $lte: endOfDay };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [visitors, total] = await Promise.all([
      HostelVisitor.find(query)
        .populate('student', 'firstName lastName registrationNumber hostelRoom')
        .sort({ checkInTime: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      HostelVisitor.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        visitors,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get visitors error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch visitors' });
  }
});

// POST /api/hostel/visitors - Register visitor
router.post('/visitors', authenticateToken, requireStaff, [
  body('studentId').isMongoId().withMessage('Valid student ID is required'),
  body('visitorName').trim().notEmpty().withMessage('Visitor name is required'),
  body('visitorPhone').matches(/^[0-9]{10}$/).withMessage('Valid phone number is required'),
  body('relationship').trim().notEmpty().withMessage('Relationship is required'),
  body('purpose').trim().notEmpty().withMessage('Purpose is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { studentId, visitorName, visitorPhone, relationship, purpose, idProof } = req.body;

    const student = await Student.findById(studentId);
    if (!student || !student.hostelResident) {
      return res.status(400).json({ success: false, message: 'Invalid student or not a hostel resident' });
    }

    const visitor = new HostelVisitor({
      student: studentId,
      visitorName,
      visitorPhone,
      relationship,
      purpose,
      idProof
    });

    await visitor.save();

    res.status(201).json({
      success: true,
      message: 'Visitor registered successfully',
      data: { visitor }
    });
  } catch (error) {
    console.error('Register visitor error:', error);
    res.status(500).json({ success: false, message: 'Failed to register visitor' });
  }
});

// PUT /api/hostel/visitors/:id/checkout - Checkout visitor
router.put('/visitors/:id/checkout', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { id } = req.params;

    const visitor = await HostelVisitor.findByIdAndUpdate(
      id,
      {
        status: 'Checked Out',
        checkOutTime: new Date()
      },
      { new: true }
    );

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found' });
    }

    res.json({
      success: true,
      message: 'Visitor checked out successfully',
      data: { visitor }
    });
  } catch (error) {
    console.error('Checkout visitor error:', error);
    res.status(500).json({ success: false, message: 'Failed to checkout visitor' });
  }
});

module.exports = router;
