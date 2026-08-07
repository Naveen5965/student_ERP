const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const { FeePayment, Student, FeeStructure } = require('../../database/models');
const { authenticateToken, requireStaff, requireAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ==================== RAZORPAY INTEGRATION ====================

// Initialize Razorpay (in production, use actual Razorpay SDK)
// const Razorpay = require('razorpay');
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET
// });

// Simulated Razorpay for development
const razorpaySimulator = {
  orders: {
    create: async (options) => ({
      id: 'order_' + crypto.randomBytes(12).toString('hex'),
      amount: options.amount,
      currency: options.currency,
      receipt: options.receipt,
      status: 'created',
      created_at: Date.now()
    })
  },
  payments: {
    fetch: async (paymentId) => ({
      id: paymentId,
      status: 'captured',
      method: 'upi'
    })
  }
};

// ==================== FEE STRUCTURE MANAGEMENT ====================

// POST /api/fees/structure - Create fee structure
router.post('/structure', authenticateToken, requireAdmin, [
  body('program').isMongoId(),
  body('academicYear').notEmpty(),
  body('tuitionFee').isNumeric()
], handleValidationErrors, async (req, res) => {
  try {
    const feeStructure = new FeeStructure(req.body);
    await feeStructure.save();

    res.status(201).json({
      success: true,
      message: 'Fee structure created',
      data: { feeStructure }
    });
  } catch (error) {
    console.error('Create fee structure error:', error);
    res.status(500).json({ success: false, message: 'Failed to create fee structure' });
  }
});

// GET /api/fees/structure - Get fee structures
router.get('/structure', authenticateToken, async (req, res) => {
  try {
    const { program, academicYear } = req.query;
    const query = {};

    if (program) query.program = program;
    if (academicYear) query.academicYear = academicYear;

    const structures = await FeeStructure.find(query)
      .populate('program', 'name code')
      .sort({ academicYear: -1 })
      .lean();

    res.json({
      success: true,
      data: { structures }
    });
  } catch (error) {
    console.error('Get fee structure error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fee structures' });
  }
});

// ==================== PAYMENT ORDERS ====================

// POST /api/fees/create-order - Create payment order
router.post('/create-order', authenticateToken, [
  body('amount').isNumeric().custom(val => val > 0),
  body('feeType').optional().isIn(['tuition', 'hostel', 'library', 'exam', 'full', 'other'])
], handleValidationErrors, async (req, res) => {
  try {
    const { amount, feeType = 'full', description } = req.body;

    const student = await Student.findOne({ email: req.user.email });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Create order receipt
    const receiptId = `rcpt_${student.registrationNumber}_${Date.now()}`;

    // Create Razorpay order
    const order = await razorpaySimulator.orders.create({
      amount: Math.round(amount * 100), // Amount in paise
      currency: 'INR',
      receipt: receiptId,
      notes: {
        studentId: student._id.toString(),
        feeType,
        description
      }
    });

    // Store pending payment
    const pendingPayment = new FeePayment({
      student: student._id,
      amount,
      feeType,
      transactionId: order.id,
      paymentMethod: 'Online',
      status: 'Pending',
      paymentGateway: 'Razorpay',
      gatewayOrderId: order.id,
      description,
      createdAt: new Date()
    });

    await pendingPayment.save();

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID || 'rzp_test_xxxxxxxxxxxx', // Public key for frontend
        prefill: {
          name: `${student.firstName} ${student.lastName}`,
          email: student.email,
          contact: student.phone
        },
        notes: {
          paymentId: pendingPayment._id
        }
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: 'Failed to create payment order' });
  }
});

// POST /api/fees/verify-payment - Verify Razorpay payment
router.post('/verify-payment', authenticateToken, [
  body('razorpay_order_id').notEmpty(),
  body('razorpay_payment_id').notEmpty(),
  body('razorpay_signature').notEmpty()
], handleValidationErrors, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'test_secret')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    // In production, verify actual signature
    // For development, we'll accept the payment
    const isValidSignature = true; // generatedSignature === razorpay_signature;

    if (!isValidSignature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // Update payment record
    const payment = await FeePayment.findOneAndUpdate(
      { gatewayOrderId: razorpay_order_id },
      {
        status: 'Completed',
        gatewayPaymentId: razorpay_payment_id,
        gatewaySignature: razorpay_signature,
        paymentDate: new Date(),
        transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`
      },
      { new: true }
    ).populate('student', 'firstName lastName email');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    // TODO: Send payment confirmation email
    // await sendPaymentConfirmation(payment);

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        payment,
        receiptUrl: `/api/fees/receipt/${payment._id}`
      }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
});

// ==================== PHONEPE INTEGRATION ====================

// POST /api/fees/phonepe/initiate - Initiate PhonePe payment
router.post('/phonepe/initiate', authenticateToken, [
  body('amount').isNumeric().custom(val => val > 0)
], handleValidationErrors, async (req, res) => {
  try {
    const { amount, feeType = 'full' } = req.body;

    const student = await Student.findOne({ email: req.user.email });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const merchantTransactionId = `MT${student.registrationNumber}${Date.now()}`;

    // In production, use actual PhonePe SDK
    // const phonePePayload = {
    //   merchantId: process.env.PHONEPE_MERCHANT_ID,
    //   merchantTransactionId,
    //   amount: amount * 100,
    //   redirectUrl: `${process.env.FRONTEND_URL}/fees/callback`,
    //   callbackUrl: `${process.env.BACKEND_URL}/api/fees/phonepe/callback`,
    //   mobileNumber: student.phone,
    //   paymentInstrument: { type: 'PAY_PAGE' }
    // };

    // Store pending payment
    const pendingPayment = new FeePayment({
      student: student._id,
      amount,
      feeType,
      transactionId: merchantTransactionId,
      paymentMethod: 'Online',
      status: 'Pending',
      paymentGateway: 'PhonePe',
      gatewayOrderId: merchantTransactionId,
      createdAt: new Date()
    });

    await pendingPayment.save();

    // Simulated response for development
    res.json({
      success: true,
      data: {
        merchantTransactionId,
        paymentUrl: `https://phonepe.com/pay/${merchantTransactionId}`, // Simulated URL
        paymentId: pendingPayment._id
      }
    });
  } catch (error) {
    console.error('PhonePe initiate error:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate PhonePe payment' });
  }
});

// POST /api/fees/phonepe/callback - PhonePe payment callback
router.post('/phonepe/callback', async (req, res) => {
  try {
    const { transactionId, code, merchantId } = req.body;

    // Verify checksum in production
    // const checksum = req.headers['x-verify'];

    if (code === 'PAYMENT_SUCCESS') {
      await FeePayment.findOneAndUpdate(
        { gatewayOrderId: transactionId },
        {
          status: 'Completed',
          paymentDate: new Date(),
          gatewayResponse: req.body
        }
      );
    } else {
      await FeePayment.findOneAndUpdate(
        { gatewayOrderId: transactionId },
        {
          status: 'Failed',
          gatewayResponse: req.body
        }
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('PhonePe callback error:', error);
    res.status(500).json({ success: false });
  }
});

// ==================== FEE PAYMENTS ====================

// GET /api/fees/my-payments - Get student's payment history
router.get('/my-payments', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findOne({ email: req.user.email });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const payments = await FeePayment.find({ student: student._id })
      .populate('feeStructure')
      .sort({ paymentDate: -1 })
      .lean();

    // Get pending fees
    const feeStructure = await FeeStructure.findOne({
      program: student.program,
      academicYear: '2024-25' // Current academic year
    });

    const totalPaid = payments
      .filter(p => p.status === 'Completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalFees = feeStructure
      ? (feeStructure.tuitionFee + feeStructure.hostelFee + feeStructure.libraryFee + feeStructure.examFee + (feeStructure.otherFees || 0))
      : 0;

    res.json({
      success: true,
      data: {
        payments,
        summary: {
          totalFees,
          totalPaid,
          pending: totalFees - totalPaid,
          lastPayment: payments.length > 0 ? payments[0] : null
        }
      }
    });
  } catch (error) {
    console.error('Get my payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payments' });
  }
});

// GET /api/fees/all-payments - Get all payments (admin)
router.get('/all-payments', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { status, startDate, endDate, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (startDate && endDate) {
      query.paymentDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let payments = await FeePayment.find(query)
      .populate('student', 'firstName lastName registrationNumber')
      .populate('feeStructure')
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    if (search) {
      payments = payments.filter(p => {
        const name = `${p.student?.firstName} ${p.student?.lastName}`.toLowerCase();
        return name.includes(search.toLowerCase()) ||
               p.student?.registrationNumber?.includes(search) ||
               p.transactionId?.includes(search);
      });
    }

    const total = await FeePayment.countDocuments(query);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get all payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payments' });
  }
});

// POST /api/fees/manual-payment - Record manual/cash payment
router.post('/manual-payment', authenticateToken, requireStaff, [
  body('studentId').isMongoId(),
  body('amount').isNumeric(),
  body('paymentMethod').isIn(['Cash', 'Cheque', 'Bank Transfer', 'DD'])
], handleValidationErrors, async (req, res) => {
  try {
    const { studentId, amount, paymentMethod, feeType, chequeNumber, bankName, remarks } = req.body;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const payment = new FeePayment({
      student: studentId,
      amount,
      feeType: feeType || 'full',
      transactionId: `MAN${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      paymentMethod,
      status: 'Completed',
      paymentDate: new Date(),
      chequeNumber,
      bankName,
      remarks,
      recordedBy: req.user.id
    });

    await payment.save();

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: { payment }
    });
  } catch (error) {
    console.error('Manual payment error:', error);
    res.status(500).json({ success: false, message: 'Failed to record payment' });
  }
});

// ==================== FEE REPORTS ====================

// GET /api/fees/report - Get fee collection report
router.get('/report', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const matchQuery = { status: 'Completed' };
    if (startDate && endDate) {
      matchQuery.paymentDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    let groupId;
    if (groupBy === 'day') {
      groupId = { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } };
    } else if (groupBy === 'month') {
      groupId = { $dateToString: { format: '%Y-%m', date: '$paymentDate' } };
    } else {
      groupId = { $dateToString: { format: '%Y', date: '$paymentDate' } };
    }

    const [collectionData, methodWise, summary] = await Promise.all([
      FeePayment.aggregate([
        { $match: matchQuery },
        { $group: { _id: groupId, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      FeePayment.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      FeePayment.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        collection: collectionData,
        methodWise,
        summary: summary[0] || { total: 0, count: 0 }
      }
    });
  } catch (error) {
    console.error('Fee report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

// ==================== PDF RECEIPT ====================

// GET /api/fees/receipt/:paymentId
// Generate a PDF fee receipt
router.get('/receipt/:paymentId', authenticateToken, async (req, res) => {
    try {
        const { paymentId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(paymentId)) {
            return res.status(400).json({ message: 'Invalid Payment ID' });
        }

        const payment = await FeePayment.findById(paymentId)
            .populate({
                path: 'student',
                select: 'firstName lastName registrationNumber program',
                populate: {
                    path: 'program',
                    select: 'name code'
                }
            })
            .populate('feeStructure');

        if (!payment) {
            return res.status(404).json({ message: 'Payment record not found' });
        }

        // Create a new PDF document
        const doc = new PDFDocument({ size: 'A4', margin: 50 });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=receipt_${payment.transactionId}.pdf`);

        // Pipe the PDF to the response stream
        doc.pipe(res);

        // --- Add Content to the PDF ---

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text('University Name', { align: 'center' });
        doc.fontSize(16).text('Fee Receipt', { align: 'center' });
        doc.moveDown();

        // Receipt Details
        doc.fontSize(12).font('Helvetica');
        doc.text(`Receipt No: ${payment.transactionId}`);
        doc.text(`Date: ${new Date(payment.paymentDate).toLocaleDateString()}`);
        doc.moveDown();

        // Student Details
        doc.font('Helvetica-Bold').text('Student Information');
        doc.font('Helvetica');
        const student = payment.student;
        doc.text(`Name: ${student.firstName} ${student.lastName}`);
        doc.text(`Registration No: ${student.registrationNumber}`);
        doc.text(`Program: ${student.program.name} (${student.program.code})`);
        doc.moveDown();

        // Fee Breakdown Table
        doc.font('Helvetica-Bold').text('Fee Breakdown');
        const tableTop = doc.y;
        const itemX = 50;
        const amountX = 450;

        doc.font('Helvetica-Bold');
        doc.text('Description', itemX, tableTop);
        doc.text('Amount', amountX, tableTop, { align: 'right' });
        doc.font('Helvetica');
        doc.moveDown();

        const feeStructure = payment.feeStructure;
        let y = doc.y;

        const drawRow = (description, amount) => {
            doc.text(description, itemX, y);
            doc.text(`Rs. ${amount.toFixed(2)}`, amountX, y, { align: 'right' });
            y += 20;
        };

        if (feeStructure) {
            drawRow('Tuition Fee', feeStructure.tuitionFee);
            drawRow('Hostel Fee', feeStructure.hostelFee);
            drawRow('Library Fee', feeStructure.libraryFee);
            drawRow('Exam Fee', feeStructure.examFee);
        } else {
            // Fallback if fee structure is not detailed
            drawRow('Total Fees Paid', payment.amount);
        }
        
        doc.y = y; // Move cursor down past the rows
        doc.moveDown();

        // Total
        doc.font('Helvetica-Bold');
        doc.text('Total Paid', itemX);
        doc.text(`Rs. ${payment.amount.toFixed(2)}`, amountX, doc.y - 15, { align: 'right' });
        doc.moveDown(2);

        // Footer
        doc.fontSize(10).text('This is a computer-generated receipt and does not require a signature.', {
            align: 'center'
        });

        // Finalize the PDF
        doc.end();

    } catch (error) {
        console.error('Error generating PDF receipt:', error);
        res.status(500).json({ message: 'Server error while generating receipt.' });
    }
});

module.exports = router;
