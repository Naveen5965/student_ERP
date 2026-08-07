const nodemailer = require('nodemailer');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Notification Service for ERP System
class NotificationService {
  constructor() {
    this.outlookConfigured = false;
    this.smtpConfigured = false;
    this.templates = new Map();
    this.notificationQueue = [];
    this.isProcessing = false;

    this.initializeTransporters();
    this.loadEmailTemplates();
  }

  // Initialize email transporters
  async initializeTransporters() {
    try {
      // Check if we're in development mode
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      // In development mode, use a fake transporter to avoid authentication issues
      if (isDevelopment) {
        console.log('🧪 Development mode detected - using mock email transporter');
        this.mockTransporter = {
          sendMail: async (options) => {
            console.log('📧 DEV MODE - Email would be sent:', {
              to: options.to,
              subject: options.subject,
              template: options.html ? options.html.substring(0, 50) + '...' : 'No template'
            });
            return { messageId: `mock-${Date.now()}` };
          }
        };
        this.smtpConfigured = true;
        console.log('✅ Mock email transporter configured successfully');
        return;
      }
      
      // Outlook/Microsoft 365 SMTP configuration (production only)
      if (process.env.OUTLOOK_CLIENT_ID && process.env.OUTLOOK_CLIENT_SECRET) {
        this.outlookTransporter = nodemailer.createTransport({
          host: 'smtp-mail.outlook.com',
          port: 587,
          secure: false,
          auth: {
            user: process.env.OUTLOOK_USER,
            pass: process.env.OUTLOOK_PASSWORD
          },
          tls: {
            ciphers: 'SSLv3'
          }
        });

        await this.outlookTransporter.verify();
        this.outlookConfigured = true;
        console.log('✅ Outlook SMTP configured successfully');
      }

      // Fallback SMTP configuration (production only)
      if (process.env.SMTP_HOST) {
        this.smtpTransporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
          }
        });

        await this.smtpTransporter.verify();
        this.smtpConfigured = true;
        console.log('✅ SMTP configured successfully');
      }

      if (!this.outlookConfigured && !this.smtpConfigured) {
        console.warn('⚠️  No email configuration found. Notifications will be logged only.');
      }
    } catch (error) {
      console.error('❌ Email transporter configuration failed:', error.message);
    }
  }

  // Load email templates
  async loadEmailTemplates() {
    const templateDir = path.join(__dirname, '../templates/emails');

    try {
      await fs.access(templateDir);
      const files = await fs.readdir(templateDir);

      for (const file of files) {
        if (file.endsWith('.html') || file.endsWith('.txt')) {
          const templateName = path.parse(file).name;
          const templatePath = path.join(templateDir, file);
          const content = await fs.readFile(templatePath, 'utf8');
          this.templates.set(templateName, content);
        }
      }

      console.log(`📧 Loaded ${this.templates.size} email templates`);
    } catch (error) {
      console.warn('⚠️  Email templates directory not found, using default templates');
      this.createDefaultTemplates();
    }
  }

  // Create default email templates
  createDefaultTemplates() {
    this.templates.set('welcome', `
      <h2>Welcome to Student ERP System</h2>
      <p>Dear {{name}},</p>
      <p>Welcome to the Rajasthan Government Student ERP System!</p>
      <p>Your account has been created successfully.</p>
      <p><strong>Login Details:</strong></p>
      <ul>
        <li>Email: {{email}}</li>
        <li>Role: {{role}}</li>
      </ul>
      <p>Please change your password after first login.</p>
      <br>
      <p>Best regards,<br>ERP System Administrator</p>
    `);

    this.templates.set('fee_payment', `
      <h2>Fee Payment Confirmation</h2>
      <p>Dear {{studentName}},</p>
      <p>Your fee payment has been processed successfully.</p>
      <p><strong>Payment Details:</strong></p>
      <ul>
        <li>Amount: ₹{{amount}}</li>
        <li>Transaction ID: {{transactionId}}</li>
        <li>Date: {{date}}</li>
        <li>Payment Method: {{paymentMethod}}</li>
      </ul>
      <p>A receipt has been attached to this email.</p>
      <br>
      <p>Best regards,<br>Finance Department</p>
    `);

    this.templates.set('admission_approved', `
      <h2>Admission Approved</h2>
      <p>Dear {{studentName}},</p>
      <p>Congratulations! Your admission has been approved.</p>
      <p><strong>Admission Details:</strong></p>
      <ul>
        <li>Student ID: {{studentId}}</li>
        <li>Program: {{program}}</li>
        <li>Department: {{department}}</li>
        <li>Admission Date: {{admissionDate}}</li>
      </ul>
      <p>Please complete your fee payment and document verification.</p>
      <br>
      <p>Best regards,<br>Admissions Department</p>
    `);

    this.templates.set('hostel_booking', `
      <h2>Hostel Room Booking Confirmation</h2>
      <p>Dear {{studentName}},</p>
      <p>Your hostel room booking has been confirmed.</p>
      <p><strong>Booking Details:</strong></p>
      <ul>
        <li>Room Number: {{roomNumber}}</li>
        <li>Hostel Block: {{hostelBlock}}</li>
        <li>Check-in Date: {{checkInDate}}</li>
        <li>Duration: {{duration}} months</li>
      </ul>
      <p>Please arrive by the check-in date with required documents.</p>
      <br>
      <p>Best regards,<br>Hostel Management</p>
    `);

    this.templates.set('library_due', `
      <h2>Library Book Due Reminder</h2>
      <p>Dear {{studentName}},</p>
      <p>This is a reminder that the following books are due:</p>
      <ul>
        {{#each books}}
        <li>{{title}} - Due: {{dueDate}}</li>
        {{/each}}
      </ul>
      <p>Please return the books on time to avoid fines.</p>
      <br>
      <p>Best regards,<br>Library Department</p>
    `);
  }

  // Send email notification
  async sendEmail(to, subject, templateName, data = {}, attachments = []) {
    try {
      // Check if we're in development mode
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      // In development mode, use the mock transporter
      if (isDevelopment) {
        // Get and process template for logging purposes
        let html = this.templates.get(templateName) || templateName;
        
        // Log email details
        console.log('📧 Email notification (DEV MODE - not actually sent):', { 
          to, 
          subject, 
          templateName, 
          dataKeys: Object.keys(data),
          attachments: attachments.length
        });
        
        // Return success in dev mode
        return { 
          success: true, 
          messageId: `dev-${Date.now()}`,
          message: 'Email logged in development mode (not sent)'
        };
      }
      
      const transporter = this.outlookConfigured ? this.outlookTransporter : this.smtpTransporter;

      // Get and process template
      let html = this.templates.get(templateName) || templateName;
      let text = this.convertHtmlToText(html);

      // Replace template variables
      html = this.processTemplate(html, data);
      text = this.processTemplate(text, data);
      subject = this.processTemplate(subject, data);

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@rajasthan-gov.edu',
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text,
        attachments
      };

      const result = await transporter.sendMail(mailOptions);

      console.log('📧 Email sent successfully:', {
        to,
        subject,
        messageId: result.messageId
      });

      return {
        success: true,
        messageId: result.messageId,
        envelope: result.envelope
      };

    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Process template variables
  processTemplate(template, data) {
    let processed = template;

    // Replace simple variables
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, data[key] || '');
    });

    // Handle conditional blocks (basic implementation)
    processed = processed.replace(/{{#if (\w+)}}([\s\S]*?){{\/if}}/g, (match, condition, content) => {
      return data[condition] ? content : '';
    });

    // Handle loops (basic implementation for arrays)
    processed = processed.replace(/{{#each (\w+)}}([\s\S]*?){{\/each}}/g, (match, arrayName, content) => {
      const array = data[arrayName] || [];
      return array.map(item => {
        let itemContent = content;
        Object.keys(item).forEach(key => {
          itemContent = itemContent.replace(new RegExp(`{{${key}}}`, 'g'), item[key] || '');
        });
        return itemContent;
      }).join('');
    });

    return processed;
  }

  // Convert HTML to plain text
  convertHtmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\n\s+/g, '\n') // Clean up whitespace
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
      .trim();
  }

  // Queue notification for processing
  async queueNotification(type, recipients, data, options = {}) {
    const notification = {
      id: this.generateId(),
      type,
      recipients,
      data,
      options,
      createdAt: new Date(),
      status: 'queued',
      attempts: 0
    };

    this.notificationQueue.push(notification);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return notification.id;
  }

  // Process notification queue
  async processQueue() {
    if (this.isProcessing || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.notificationQueue.length > 0) {
      const notification = this.notificationQueue.shift();

      try {
        await this.processNotification(notification);
        notification.status = 'sent';
        notification.sentAt = new Date();
      } catch (error) {
        console.error('❌ Notification processing failed:', error);
        notification.status = 'failed';
        notification.error = error.message;
        notification.attempts++;

        // Retry logic (max 3 attempts)
        if (notification.attempts < 3) {
          notification.nextRetry = new Date(Date.now() + (notification.attempts * 60000)); // Exponential backoff
          this.notificationQueue.push(notification);
        }
      }
    }

    this.isProcessing = false;
  }

  // Process individual notification
  async processNotification(notification) {
    const { type, recipients, data, options } = notification;

    switch (type) {
      case 'welcome':
        await this.sendWelcomeEmail(recipients, data);
        break;
      case 'fee_payment':
        await this.sendFeePaymentEmail(recipients, data);
        break;
      case 'admission_approved':
        await this.sendAdmissionApprovedEmail(recipients, data);
        break;
      case 'hostel_booking':
        await this.sendHostelBookingEmail(recipients, data);
        break;
      case 'library_due':
        await this.sendLibraryDueEmail(recipients, data);
        break;
      case 'custom':
        await this.sendCustomEmail(recipients, data, options);
        break;
      default:
        throw new Error(`Unknown notification type: ${type}`);
    }
  }

  // Specific notification methods
  async sendWelcomeEmail(recipients, data) {
    const subject = 'Welcome to Student ERP System';
    return await this.sendEmail(recipients, subject, 'welcome', data);
  }

  async sendFeePaymentEmail(recipients, data) {
    const subject = `Fee Payment Confirmation - ₹${data.amount}`;
    return await this.sendEmail(recipients, subject, 'fee_payment', data);
  }

  async sendAdmissionApprovedEmail(recipients, data) {
    const subject = 'Admission Approved - Action Required';
    return await this.sendEmail(recipients, subject, 'admission_approved', data);
  }

  async sendHostelBookingEmail(recipients, data) {
    const subject = `Hostel Room Booking Confirmed - Room ${data.roomNumber}`;
    return await this.sendEmail(recipients, subject, 'hostel_booking', data);
  }

  async sendLibraryDueEmail(recipients, data) {
    const subject = 'Library Book Due Reminder';
    return await this.sendEmail(recipients, subject, 'library_due', data);
  }

  async sendCustomEmail(recipients, data, options) {
    const subject = options.subject || 'Notification from Student ERP System';
    const template = options.template || 'custom';
    return await this.sendEmail(recipients, subject, template, data, options.attachments);
  }

  // ==================== SMS NOTIFICATIONS ====================

  // Initialize SMS providers
  initializeSmsProviders() {
    // MSG91 Configuration (Primary for India)
    if (process.env.MSG91_AUTH_KEY) {
      this.msg91Configured = true;
      this.msg91Config = {
        authKey: process.env.MSG91_AUTH_KEY,
        senderId: process.env.MSG91_SENDER_ID || 'ERPSMS',
        route: process.env.MSG91_ROUTE || '4', // Transactional route
        templateId: process.env.MSG91_TEMPLATE_ID
      };
      console.log('✅ MSG91 SMS provider configured');
    }

    // Twilio Configuration (International/Backup)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioConfigured = true;
      this.twilioConfig = {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_PHONE_NUMBER
      };
      console.log('✅ Twilio SMS provider configured');
    }

    if (!this.msg91Configured && !this.twilioConfigured) {
      console.warn('⚠️  No SMS configuration found. SMS notifications will be logged only.');
    }
  }

  // Send SMS via MSG91 (Primary for India)
  async sendSmsMSG91(phone, message, templateId = null) {
    try {
      if (!this.msg91Configured) {
        console.log('📱 SMS (MSG91 not configured):', { phone, message });
        return { success: false, error: 'MSG91 not configured' };
      }

      const axios = require('axios');
      
      // For template-based SMS (recommended for DLT compliance in India)
      if (templateId || this.msg91Config.templateId) {
        const response = await axios.post(
          'https://api.msg91.com/api/v5/flow/',
          {
            template_id: templateId || this.msg91Config.templateId,
            sender: this.msg91Config.senderId,
            mobiles: this.formatPhoneForMSG91(phone),
            // Variables for template
            VAR1: message
          },
          {
            headers: {
              'authkey': this.msg91Config.authKey,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('📱 SMS sent via MSG91:', { phone, messageId: response.data.request_id });
        return { success: true, messageId: response.data.request_id, provider: 'MSG91' };
      }

      // For direct SMS (if DLT not required)
      const response = await axios.get('https://api.msg91.com/api/sendhttp.php', {
        params: {
          authkey: this.msg91Config.authKey,
          mobiles: this.formatPhoneForMSG91(phone),
          message: message,
          sender: this.msg91Config.senderId,
          route: this.msg91Config.route,
          country: '91'
        }
      });

      console.log('📱 SMS sent via MSG91:', { phone, response: response.data });
      return { success: true, messageId: response.data, provider: 'MSG91' };

    } catch (error) {
      console.error('❌ MSG91 SMS failed:', error.message);
      return { success: false, error: error.message, provider: 'MSG91' };
    }
  }

  // Send SMS via Twilio (International/Backup)
  async sendSmsTwilio(phone, message) {
    try {
      if (!this.twilioConfigured) {
        console.log('📱 SMS (Twilio not configured):', { phone, message });
        return { success: false, error: 'Twilio not configured' };
      }

      // In production, use actual Twilio SDK
      // const twilio = require('twilio');
      // const client = twilio(this.twilioConfig.accountSid, this.twilioConfig.authToken);

      // Simulated for development
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (isDevelopment) {
        console.log('📱 SMS (Twilio DEV MODE):', { phone, message });
        return { success: true, messageId: `twilio-dev-${Date.now()}`, provider: 'Twilio' };
      }

      // const result = await client.messages.create({
      //   body: message,
      //   from: this.twilioConfig.fromNumber,
      //   to: phone
      // });

      // console.log('📱 SMS sent via Twilio:', { phone, sid: result.sid });
      // return { success: true, messageId: result.sid, provider: 'Twilio' };

      return { success: false, error: 'Twilio production not implemented' };

    } catch (error) {
      console.error('❌ Twilio SMS failed:', error.message);
      return { success: false, error: error.message, provider: 'Twilio' };
    }
  }

  // Main SMS sending method
  async sendSMS(phone, message, options = {}) {
    try {
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (isDevelopment) {
        console.log('📱 SMS notification (DEV MODE):', { phone, message });
        return { success: true, messageId: `dev-sms-${Date.now()}`, message: 'SMS logged in development mode' };
      }

      // Use MSG91 for Indian numbers (primary)
      if (this.isIndianNumber(phone) && this.msg91Configured) {
        return await this.sendSmsMSG91(phone, message, options.templateId);
      }

      // Use Twilio for international numbers or as fallback
      if (this.twilioConfigured) {
        return await this.sendSmsTwilio(phone, message);
      }

      console.log('📱 SMS (No provider available):', { phone, message });
      return { success: false, error: 'No SMS provider configured' };

    } catch (error) {
      console.error('❌ SMS sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Check if Indian phone number
  isIndianNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.startsWith('91') || (cleaned.length === 10 && /^[6-9]/.test(cleaned));
  }

  // Format phone number for MSG91
  formatPhoneForMSG91(phone) {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    return cleaned;
  }

  // ==================== SMS TEMPLATES ====================

  // OTP SMS
  async sendOTP(phone, otp, purpose = 'verification') {
    const messages = {
      verification: `Your OTP for verification is ${otp}. Valid for 10 minutes. - Padho Rajasthan ERP`,
      login: `Your login OTP is ${otp}. Do not share with anyone. - Padho Rajasthan ERP`,
      password: `Your OTP to reset password is ${otp}. Valid for 10 minutes. - Padho Rajasthan ERP`
    };
    return await this.sendSMS(phone, messages[purpose] || messages.verification);
  }

  // Fee reminder SMS
  async sendFeeReminderSMS(phone, data) {
    const message = `Reminder: Fee payment of Rs. ${data.amount} is due on ${data.dueDate}. Pay now to avoid late fees. - Padho Rajasthan ERP`;
    return await this.sendSMS(phone, message);
  }

  // Payment confirmation SMS
  async sendPaymentConfirmationSMS(phone, data) {
    const message = `Payment of Rs. ${data.amount} received. Transaction ID: ${data.transactionId}. Thank you! - Padho Rajasthan ERP`;
    return await this.sendSMS(phone, message);
  }

  // Exam notification SMS
  async sendExamNotificationSMS(phone, data) {
    const message = `Exam Alert: ${data.examName} on ${data.date} at ${data.time}. Download hall ticket from ERP. - Padho Rajasthan ERP`;
    return await this.sendSMS(phone, message);
  }

  // Result notification SMS
  async sendResultNotificationSMS(phone, data) {
    const message = `Results declared! ${data.examName}: ${data.result}. Check ERP for detailed marks. - Padho Rajasthan ERP`;
    return await this.sendSMS(phone, message);
  }

  // Attendance alert SMS
  async sendAttendanceAlertSMS(phone, data) {
    const message = `Attendance Alert: Your current attendance in ${data.subject} is ${data.percentage}%. Minimum required: 75%. - Padho Rajasthan ERP`;
    return await this.sendSMS(phone, message);
  }

  // Library due SMS
  async sendLibraryDueSMS(phone, data) {
    const message = `Library Reminder: Book "${data.bookTitle}" is due on ${data.dueDate}. Return to avoid fine. - Padho Rajasthan ERP`;
    return await this.sendSMS(phone, message);
  }

  // Admission status SMS
  async sendAdmissionStatusSMS(phone, data) {
    const message = `Admission ${data.status}! Application ID: ${data.applicationId}. Login to ERP for details. - Padho Rajasthan ERP`;
    return await this.sendSMS(phone, message);
  }

  // Hostel allocation SMS
  async sendHostelAllocationSMS(phone, data) {
    const message = `Hostel Room Allotted: ${data.hostelName}, Room ${data.roomNumber}. Report by ${data.reportDate}. - Padho Rajasthan ERP`;
    return await this.sendSMS(phone, message);
  }

  // Scholarship notification SMS
  async sendScholarshipSMS(phone, data) {
    const message = `Scholarship ${data.status}: ${data.scholarshipName}. Amount: Rs. ${data.amount}. Check ERP for details. - Padho Rajasthan ERP`;
    return await this.sendSMS(phone, message);
  }

  // Bulk notification
  async sendBulkNotification(type, recipientList, data, options = {}) {
    const promises = recipientList.map(recipient =>
      this.queueNotification(type, recipient, { ...data, recipient }, options)
    );

    return await Promise.all(promises);
  }

  // Send notification via both email and SMS
  async sendMultiChannelNotification(email, phone, type, data, options = {}) {
    const results = { email: null, sms: null };

    if (email && options.sendEmail !== false) {
      results.email = await this.sendEmail(
        email,
        options.subject || 'Notification from Padho Rajasthan ERP',
        type,
        data,
        options.attachments
      );
    }

    if (phone && options.sendSMS !== false) {
      const smsMethod = `send${type.charAt(0).toUpperCase() + type.slice(1)}SMS`;
      if (typeof this[smsMethod] === 'function') {
        results.sms = await this[smsMethod](phone, data);
      } else {
        results.sms = await this.sendSMS(phone, options.smsMessage || `New notification: ${type}`);
      }
    }

    return results;
  }

  // Schedule notification for later
  async scheduleNotification(type, recipients, data, scheduleTime, options = {}) {
    const notification = {
      id: this.generateId(),
      type,
      recipients,
      data,
      options,
      scheduleTime: new Date(scheduleTime),
      createdAt: new Date(),
      status: 'scheduled'
    };

    // In production, save to database and use a job scheduler
    console.log('📅 Notification scheduled:', notification);

    return notification.id;
  }

  // Get notification status
  getNotificationStatus(notificationId) {
    const notification = this.notificationQueue.find(n => n.id === notificationId);
    return notification ? {
      id: notification.id,
      status: notification.status,
      attempts: notification.attempts,
      createdAt: notification.createdAt,
      sentAt: notification.sentAt,
      error: notification.error
    } : null;
  }

  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Get service status
  getStatus() {
    return {
      outlookConfigured: this.outlookConfigured,
      smtpConfigured: this.smtpConfigured,
      msg91Configured: this.msg91Configured || false,
      twilioConfigured: this.twilioConfigured || false,
      templatesLoaded: this.templates.size,
      queueLength: this.notificationQueue.length,
      isProcessing: this.isProcessing
    };
  }
}

// Export singleton instance
const notificationService = new NotificationService();
notificationService.initializeSmsProviders();
module.exports = notificationService;