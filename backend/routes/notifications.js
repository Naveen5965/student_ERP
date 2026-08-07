const express = require('express');
const notificationService = require('../services/notificationService');
const { authenticateToken, requireAdmin, requireStaff, auditLog } = require('../middleware/auth');

const router = express.Router();

// Get notification service status
router.get('/status', authenticateToken, requireAdmin, (req, res) => {
  try {
    const status = notificationService.getStatus();
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ success: false, message: 'Failed to get status' });
  }
});

// Send welcome email to new user
router.post('/welcome', authenticateToken, requireStaff, auditLog, async (req, res) => {
  try {
    const { email, name, role } = req.body;

    if (!email || !name || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, name, and role are required'
      });
    }

    const result = await notificationService.sendEmail(
      email,
      'Welcome to Student ERP System',
      'welcome',
      {
        name,
        email,
        role,
        date: new Date().toLocaleDateString(),
        loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/login.html`
      }
    );

    res.json({
      success: result.success,
      message: result.success ? 'Welcome email sent successfully' : 'Failed to send welcome email',
      messageId: result.messageId,
      error: result.error
    });
  } catch (error) {
    console.error('Welcome email error:', error);
    res.status(500).json({ success: false, message: 'Failed to send welcome email' });
  }
});

// Send fee payment confirmation
router.post('/fee-payment', authenticateToken, requireStaff, auditLog, async (req, res) => {
  try {
    const {
      studentEmail,
      studentName,
      amount,
      transactionId,
      paymentMethod,
      receiptUrl
    } = req.body;

    if (!studentEmail || !studentName || !amount || !transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Student email, name, amount, and transaction ID are required'
      });
    }

    const result = await notificationService.sendEmail(
      studentEmail,
      `Fee Payment Confirmation - ₹${amount}`,
      'fee_payment',
      {
        studentName,
        amount,
        transactionId,
        date: new Date().toLocaleDateString(),
        paymentMethod: paymentMethod || 'UPI',
        receiptUrl: receiptUrl || '#'
      }
    );

    res.json({
      success: result.success,
      message: result.success ? 'Fee payment confirmation sent' : 'Failed to send confirmation',
      messageId: result.messageId,
      error: result.error
    });
  } catch (error) {
    console.error('Fee payment email error:', error);
    res.status(500).json({ success: false, message: 'Failed to send fee payment confirmation' });
  }
});

// Send admission approval notification
router.post('/admission-approved', authenticateToken, requireStaff, auditLog, async (req, res) => {
  try {
    const {
      studentEmail,
      studentName,
      studentId,
      program,
      department,
      admissionDate
    } = req.body;

    if (!studentEmail || !studentName || !studentId || !program || !department) {
      return res.status(400).json({
        success: false,
        message: 'All admission details are required'
      });
    }

    const result = await notificationService.sendEmail(
      studentEmail,
      'Admission Approved - Action Required',
      'admission_approved',
      {
        studentName,
        studentId,
        program,
        department,
        admissionDate: admissionDate || new Date().toLocaleDateString()
      }
    );

    res.json({
      success: result.success,
      message: result.success ? 'Admission approval notification sent' : 'Failed to send notification',
      messageId: result.messageId,
      error: result.error
    });
  } catch (error) {
    console.error('Admission approval email error:', error);
    res.status(500).json({ success: false, message: 'Failed to send admission approval notification' });
  }
});

// Send hostel booking confirmation
router.post('/hostel-booking', authenticateToken, requireStaff, auditLog, async (req, res) => {
  try {
    const {
      studentEmail,
      studentName,
      roomNumber,
      hostelBlock,
      checkInDate,
      duration
    } = req.body;

    if (!studentEmail || !studentName || !roomNumber || !hostelBlock) {
      return res.status(400).json({
        success: false,
        message: 'Student email, name, room number, and hostel block are required'
      });
    }

    const result = await notificationService.sendEmail(
      studentEmail,
      `Hostel Room Booking Confirmed - Room ${roomNumber}`,
      'hostel_booking',
      {
        studentName,
        roomNumber,
        hostelBlock,
        checkInDate: checkInDate || new Date().toLocaleDateString(),
        duration: duration || 12
      }
    );

    res.json({
      success: result.success,
      message: result.success ? 'Hostel booking confirmation sent' : 'Failed to send confirmation',
      messageId: result.messageId,
      error: result.error
    });
  } catch (error) {
    console.error('Hostel booking email error:', error);
    res.status(500).json({ success: false, message: 'Failed to send hostel booking confirmation' });
  }
});

// Send library due date reminder
router.post('/library-due', authenticateToken, requireStaff, auditLog, async (req, res) => {
  try {
    const { studentEmail, studentName, books } = req.body;

    if (!studentEmail || !studentName || !books || !Array.isArray(books)) {
      return res.status(400).json({
        success: false,
        message: 'Student email, name, and books array are required'
      });
    }

    const result = await notificationService.sendEmail(
      studentEmail,
      'Library Book Due Reminder',
      'library_due',
      {
        studentName,
        books
      }
    );

    res.json({
      success: result.success,
      message: result.success ? 'Library due reminder sent' : 'Failed to send reminder',
      messageId: result.messageId,
      error: result.error
    });
  } catch (error) {
    console.error('Library due email error:', error);
    res.status(500).json({ success: false, message: 'Failed to send library due reminder' });
  }
});

// Send custom notification
router.post('/custom', authenticateToken, requireAdmin, auditLog, async (req, res) => {
  try {
    const {
      recipients,
      subject,
      template,
      data,
      attachments
    } = req.body;

    if (!recipients || !subject || !template) {
      return res.status(400).json({
        success: false,
        message: 'Recipients, subject, and template are required'
      });
    }

    const result = await notificationService.sendEmail(
      recipients,
      subject,
      template,
      data || {},
      attachments || []
    );

    res.json({
      success: result.success,
      message: result.success ? 'Custom notification sent' : 'Failed to send notification',
      messageId: result.messageId,
      error: result.error
    });
  } catch (error) {
    console.error('Custom notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to send custom notification' });
  }
});

// Queue notification for later processing
router.post('/queue', authenticateToken, requireStaff, auditLog, async (req, res) => {
  try {
    const { type, recipients, data, options } = req.body;

    if (!type || !recipients) {
      return res.status(400).json({
        success: false,
        message: 'Notification type and recipients are required'
      });
    }

    const notificationId = await notificationService.queueNotification(
      type,
      recipients,
      data || {},
      options || {}
    );

    res.json({
      success: true,
      message: 'Notification queued successfully',
      notificationId
    });
  } catch (error) {
    console.error('Queue notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to queue notification' });
  }
});

// Get notification status
router.get('/status/:notificationId', authenticateToken, requireStaff, (req, res) => {
  try {
    const { notificationId } = req.params;
    const status = notificationService.getNotificationStatus(notificationId);

    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Get notification status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get notification status' });
  }
});

// Bulk notification endpoint
router.post('/bulk', authenticateToken, requireAdmin, auditLog, async (req, res) => {
  try {
    const { type, recipientList, data, options } = req.body;

    if (!type || !recipientList || !Array.isArray(recipientList)) {
      return res.status(400).json({
        success: false,
        message: 'Notification type and recipient list are required'
      });
    }

    const notificationIds = await notificationService.sendBulkNotification(
      type,
      recipientList,
      data || {},
      options || {}
    );

    res.json({
      success: true,
      message: `Bulk notification queued for ${recipientList.length} recipients`,
      notificationIds
    });
  } catch (error) {
    console.error('Bulk notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to send bulk notification' });
  }
});

// Schedule notification for future
router.post('/schedule', authenticateToken, requireAdmin, auditLog, async (req, res) => {
  try {
    const { type, recipients, data, scheduleTime, options } = req.body;

    if (!type || !recipients || !scheduleTime) {
      return res.status(400).json({
        success: false,
        message: 'Type, recipients, and schedule time are required'
      });
    }

    const notificationId = await notificationService.scheduleNotification(
      type,
      recipients,
      data || {},
      scheduleTime,
      options || {}
    );

    res.json({
      success: true,
      message: 'Notification scheduled successfully',
      notificationId
    });
  } catch (error) {
    console.error('Schedule notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to schedule notification' });
  }
});

// Test notification endpoint (development only)
router.post('/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Test email address is required'
      });
    }

    const result = await notificationService.sendEmail(
      email,
      'Test Notification - Student ERP System',
      'custom',
      {
        message: 'This is a test notification from the Student ERP System.',
        timestamp: new Date().toISOString(),
        test: true
      }
    );

    res.json({
      success: result.success,
      message: 'Test notification sent',
      messageId: result.messageId,
      error: result.error
    });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to send test notification' });
  }
});

module.exports = router;