// Notification Utilities for ERP System
const notificationService = require('./notificationService');

class NotificationUtils {
  constructor() {
    this.events = new Map();
    this.setupDefaultEventHandlers();
  }

  // Register event handler
  on(event, handler) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(handler);
  }

  // Trigger event
  async emit(event, data) {
    const handlers = this.events.get(event) || [];
    const promises = handlers.map(handler => handler(data));
    await Promise.all(promises);
  }

  // Setup default event handlers
  setupDefaultEventHandlers() {
    // User registration event
    this.on('user.registered', async (data) => {
      await this.sendWelcomeEmail(data);
    });

    // Fee payment event
    this.on('fee.payment.completed', async (data) => {
      await this.sendFeePaymentConfirmation(data);
    });

    // Admission approved event
    this.on('admission.approved', async (data) => {
      await this.sendAdmissionApproval(data);
    });

    // Hostel booking event
    this.on('hostel.booked', async (data) => {
      await this.sendHostelBookingConfirmation(data);
    });

    // Library book due event
    this.on('library.book.due', async (data) => {
      await this.sendLibraryDueReminder(data);
    });

    // Password changed event
    this.on('user.password.changed', async (data) => {
      await this.sendPasswordChangeNotification(data);
    });

    // Account deactivated event
    this.on('user.deactivated', async (data) => {
      await this.sendAccountDeactivationNotice(data);
    });
  }

  // Send welcome email
  async sendWelcomeEmail(data) {
    const { email, name, role } = data;

    try {
      await notificationService.sendEmail(
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
      console.log(`✅ Welcome email sent to ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send welcome email to ${email}:`, error.message);
    }
  }

  // Send fee payment confirmation
  async sendFeePaymentConfirmation(data) {
    const {
      studentEmail,
      studentName,
      amount,
      transactionId,
      paymentMethod,
      receiptUrl
    } = data;

    try {
      await notificationService.sendEmail(
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
      console.log(`✅ Fee payment confirmation sent to ${studentEmail}`);
    } catch (error) {
      console.error(`❌ Failed to send fee confirmation to ${studentEmail}:`, error.message);
    }
  }

  // Send admission approval notification
  async sendAdmissionApproval(data) {
    const {
      studentEmail,
      studentName,
      studentId,
      program,
      department,
      admissionDate
    } = data;

    try {
      await notificationService.sendEmail(
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
      console.log(`✅ Admission approval notification sent to ${studentEmail}`);
    } catch (error) {
      console.error(`❌ Failed to send admission approval to ${studentEmail}:`, error.message);
    }
  }

  // Send hostel booking confirmation
  async sendHostelBookingConfirmation(data) {
    const {
      studentEmail,
      studentName,
      roomNumber,
      hostelBlock,
      checkInDate,
      duration
    } = data;

    try {
      await notificationService.sendEmail(
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
      console.log(`✅ Hostel booking confirmation sent to ${studentEmail}`);
    } catch (error) {
      console.error(`❌ Failed to send hostel booking confirmation to ${studentEmail}:`, error.message);
    }
  }

  // Send library due reminder
  async sendLibraryDueReminder(data) {
    const { studentEmail, studentName, books } = data;

    try {
      await notificationService.sendEmail(
        studentEmail,
        'Library Book Due Reminder',
        'library_due',
        {
          studentName,
          books
        }
      );
      console.log(`✅ Library due reminder sent to ${studentEmail}`);
    } catch (error) {
      console.error(`❌ Failed to send library reminder to ${studentEmail}:`, error.message);
    }
  }

  // Send password change notification
  async sendPasswordChangeNotification(data) {
    const { email, name } = data;

    try {
      await notificationService.sendEmail(
        email,
        'Password Changed Successfully',
        'custom',
        {
          name,
          message: 'Your password has been changed successfully. If you did not make this change, please contact support immediately.',
          timestamp: new Date().toISOString(),
          supportEmail: 'support@rajasthan-gov.edu'
        }
      );
      console.log(`✅ Password change notification sent to ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send password change notification to ${email}:`, error.message);
    }
  }

  // Send account deactivation notice
  async sendAccountDeactivationNotice(data) {
    const { email, name, reason } = data;

    try {
      await notificationService.sendEmail(
        email,
        'Account Deactivation Notice',
        'custom',
        {
          name,
          message: `Your account has been deactivated. Reason: ${reason || 'Administrative action'}`,
          timestamp: new Date().toISOString(),
          supportEmail: 'support@rajasthan-gov.edu'
        }
      );
      console.log(`✅ Account deactivation notice sent to ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send deactivation notice to ${email}:`, error.message);
    }
  }

  // Send bulk notifications
  async sendBulkNotification(type, recipients, data) {
    try {
      const notificationIds = await notificationService.sendBulkNotification(
        type,
        recipients,
        data
      );
      console.log(`✅ Bulk ${type} notifications sent to ${recipients.length} recipients`);
      return notificationIds;
    } catch (error) {
      console.error(`❌ Failed to send bulk ${type} notifications:`, error.message);
      throw error;
    }
  }

  // Schedule notification
  async scheduleNotification(type, recipients, data, scheduleTime) {
    try {
      const notificationId = await notificationService.scheduleNotification(
        type,
        recipients,
        data,
        scheduleTime
      );
      console.log(`📅 ${type} notification scheduled for ${scheduleTime}`);
      return notificationId;
    } catch (error) {
      console.error(`❌ Failed to schedule ${type} notification:`, error.message);
      throw error;
    }
  }

  // Send emergency notification to all users
  async sendEmergencyNotification(subject, message, priority = 'high') {
    try {
      // In production, get all user emails from database
      const emergencyRecipients = [
        'admin@rajasthan-gov.edu',
        'support@rajasthan-gov.edu'
        // Add more emergency contacts as needed
      ];

      await notificationService.sendEmail(
        emergencyRecipients,
        `🚨 EMERGENCY: ${subject}`,
        'custom',
        {
          message,
          priority,
          timestamp: new Date().toISOString(),
          emergency: true
        }
      );
      console.log(`🚨 Emergency notification sent: ${subject}`);
    } catch (error) {
      console.error(`❌ Failed to send emergency notification:`, error.message);
      throw error;
    }
  }

  // Send system maintenance notification
  async sendMaintenanceNotification(downTime, expectedUpTime) {
    try {
      const maintenanceRecipients = [
        'admin@rajasthan-gov.edu',
        'staff@rajasthan-gov.edu'
        // Add more as needed
      ];

      await notificationService.sendEmail(
        maintenanceRecipients,
        'System Maintenance Scheduled',
        'custom',
        {
          message: `The Student ERP System will be undergoing maintenance.`,
          downTime,
          expectedUpTime,
          timestamp: new Date().toISOString(),
          maintenance: true
        }
      );
      console.log(`🔧 Maintenance notification sent`);
    } catch (error) {
      console.error(`❌ Failed to send maintenance notification:`, error.message);
      throw error;
    }
  }

  // Get notification statistics
  getStats() {
    return {
      eventsRegistered: this.events.size,
      serviceStatus: notificationService.getStatus()
    };
  }
}

// Export singleton instance
module.exports = new NotificationUtils();