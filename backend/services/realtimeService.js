const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Real-time Notification Service using Socket.io
class RealtimeNotificationService {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // userId -> Set of socket ids
    this.socketUsers = new Map(); // socketId -> userId
    this.rooms = new Map(); // roomName -> Set of socket ids
  }

  // Initialize Socket.io with HTTP server
  initialize(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    console.log('🔌 Real-time notification service initialized');
    return this.io;
  }

  // JWT Authentication middleware
  setupMiddleware() {
    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        socket.userId = decoded.id;
        socket.userRole = decoded.role;
        socket.userEmail = decoded.email;
        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });
  }

  // Setup event handlers
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔗 User connected: ${socket.userId} (${socket.id})`);

      // Track user's socket
      this.addUserSocket(socket.userId, socket.id);

      // Join user-specific room
      socket.join(`user:${socket.userId}`);

      // Join role-based room
      socket.join(`role:${socket.userRole}`);

      // Handle room subscriptions
      socket.on('subscribe', (rooms) => {
        if (Array.isArray(rooms)) {
          rooms.forEach(room => {
            socket.join(room);
            this.addToRoom(room, socket.id);
            console.log(`📥 ${socket.userId} subscribed to ${room}`);
          });
        }
      });

      socket.on('unsubscribe', (rooms) => {
        if (Array.isArray(rooms)) {
          rooms.forEach(room => {
            socket.leave(room);
            this.removeFromRoom(room, socket.id);
            console.log(`📤 ${socket.userId} unsubscribed from ${room}`);
          });
        }
      });

      // Handle read receipts
      socket.on('notification:read', async (notificationId) => {
        // Mark notification as read in database
        // This would update the notification status
        console.log(`✓ Notification ${notificationId} marked as read by ${socket.userId}`);
      });

      // Handle typing indicators (for chat)
      socket.on('typing:start', (roomId) => {
        socket.to(roomId).emit('typing:start', {
          userId: socket.userId,
          roomId
        });
      });

      socket.on('typing:stop', (roomId) => {
        socket.to(roomId).emit('typing:stop', {
          userId: socket.userId,
          roomId
        });
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`🔌 User disconnected: ${socket.userId} (${reason})`);
        this.removeUserSocket(socket.userId, socket.id);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`❌ Socket error for ${socket.userId}:`, error);
      });

      // Send welcome notification
      this.sendToUser(socket.userId, 'notification', {
        type: 'system',
        title: 'Connected',
        message: 'Real-time notifications enabled',
        timestamp: new Date()
      });
    });
  }

  // ==================== USER & ROOM MANAGEMENT ====================

  addUserSocket(userId, socketId) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socketId);
    this.socketUsers.set(socketId, userId);
  }

  removeUserSocket(userId, socketId) {
    if (this.userSockets.has(userId)) {
      this.userSockets.get(userId).delete(socketId);
      if (this.userSockets.get(userId).size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.socketUsers.delete(socketId);
  }

  addToRoom(roomName, socketId) {
    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, new Set());
    }
    this.rooms.get(roomName).add(socketId);
  }

  removeFromRoom(roomName, socketId) {
    if (this.rooms.has(roomName)) {
      this.rooms.get(roomName).delete(socketId);
      if (this.rooms.get(roomName).size === 0) {
        this.rooms.delete(roomName);
      }
    }
  }

  isUserOnline(userId) {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
  }

  getOnlineUsers() {
    return Array.from(this.userSockets.keys());
  }

  // ==================== NOTIFICATION METHODS ====================

  // Send to specific user
  sendToUser(userId, event, data) {
    if (!this.io) return false;

    const notification = {
      ...data,
      id: this.generateId(),
      timestamp: new Date(),
      read: false
    };

    this.io.to(`user:${userId}`).emit(event, notification);
    console.log(`📨 Sent ${event} to user ${userId}`);
    return true;
  }

  // Send to multiple users
  sendToUsers(userIds, event, data) {
    userIds.forEach(userId => this.sendToUser(userId, event, data));
  }

  // Send to role
  sendToRole(role, event, data) {
    if (!this.io) return false;

    const notification = {
      ...data,
      id: this.generateId(),
      timestamp: new Date(),
      read: false
    };

    this.io.to(`role:${role}`).emit(event, notification);
    console.log(`📨 Sent ${event} to role ${role}`);
    return true;
  }

  // Send to room
  sendToRoom(room, event, data) {
    if (!this.io) return false;

    const notification = {
      ...data,
      id: this.generateId(),
      timestamp: new Date(),
      read: false
    };

    this.io.to(room).emit(event, notification);
    console.log(`📨 Sent ${event} to room ${room}`);
    return true;
  }

  // Broadcast to all connected users
  broadcast(event, data) {
    if (!this.io) return false;

    const notification = {
      ...data,
      id: this.generateId(),
      timestamp: new Date(),
      read: false
    };

    this.io.emit(event, notification);
    console.log(`📢 Broadcast ${event} to all users`);
    return true;
  }

  // ==================== SPECIFIC NOTIFICATION TYPES ====================

  // Fee payment notification
  notifyFeePayment(userId, paymentData) {
    this.sendToUser(userId, 'notification', {
      type: 'fee_payment',
      title: 'Payment Successful',
      message: `Your payment of ₹${paymentData.amount} has been received.`,
      data: paymentData,
      priority: 'high',
      actions: [
        { label: 'View Receipt', action: 'view_receipt', data: paymentData.receiptId }
      ]
    });
  }

  // Fee reminder notification
  notifyFeeReminder(userId, feeData) {
    this.sendToUser(userId, 'notification', {
      type: 'fee_reminder',
      title: 'Fee Payment Reminder',
      message: `Fee payment of ₹${feeData.amount} is due on ${feeData.dueDate}.`,
      data: feeData,
      priority: 'high',
      actions: [
        { label: 'Pay Now', action: 'pay_fee', data: feeData }
      ]
    });
  }

  // Exam notification
  notifyExam(userId, examData) {
    this.sendToUser(userId, 'notification', {
      type: 'exam',
      title: 'Exam Notification',
      message: `${examData.examName} scheduled on ${examData.date} at ${examData.time}`,
      data: examData,
      priority: 'high',
      actions: [
        { label: 'Download Hall Ticket', action: 'download_hall_ticket', data: examData.examId }
      ]
    });
  }

  // Result notification
  notifyResult(userId, resultData) {
    this.sendToUser(userId, 'notification', {
      type: 'result',
      title: 'Results Declared',
      message: `Results for ${resultData.examName} are now available.`,
      data: resultData,
      priority: 'high',
      actions: [
        { label: 'View Results', action: 'view_result', data: resultData.examId }
      ]
    });
  }

  // Attendance alert
  notifyAttendanceAlert(userId, attendanceData) {
    this.sendToUser(userId, 'notification', {
      type: 'attendance_alert',
      title: 'Attendance Warning',
      message: `Your attendance in ${attendanceData.subject} is ${attendanceData.percentage}% (below 75%)`,
      data: attendanceData,
      priority: 'high'
    });
  }

  // Library notification
  notifyLibrary(userId, libraryData) {
    this.sendToUser(userId, 'notification', {
      type: 'library',
      title: libraryData.title || 'Library Notification',
      message: libraryData.message,
      data: libraryData,
      priority: libraryData.priority || 'medium'
    });
  }

  // Hostel notification
  notifyHostel(userId, hostelData) {
    this.sendToUser(userId, 'notification', {
      type: 'hostel',
      title: hostelData.title || 'Hostel Notification',
      message: hostelData.message,
      data: hostelData,
      priority: hostelData.priority || 'medium'
    });
  }

  // Scholarship notification
  notifyScholarship(userId, scholarshipData) {
    this.sendToUser(userId, 'notification', {
      type: 'scholarship',
      title: `Scholarship: ${scholarshipData.status}`,
      message: `Your scholarship application for ${scholarshipData.name} has been ${scholarshipData.status.toLowerCase()}.`,
      data: scholarshipData,
      priority: 'high',
      actions: [
        { label: 'View Details', action: 'view_scholarship', data: scholarshipData.applicationId }
      ]
    });
  }

  // Admission notification
  notifyAdmission(userId, admissionData) {
    this.sendToUser(userId, 'notification', {
      type: 'admission',
      title: `Admission ${admissionData.status}`,
      message: admissionData.message,
      data: admissionData,
      priority: 'high'
    });
  }

  // New announcement
  announceToAll(announcementData) {
    this.broadcast('announcement', {
      type: 'announcement',
      title: announcementData.title,
      message: announcementData.message,
      data: announcementData,
      priority: announcementData.priority || 'medium'
    });
  }

  // Announce to specific department/program
  announceToDepartment(departmentId, announcementData) {
    this.sendToRoom(`department:${departmentId}`, 'announcement', {
      type: 'announcement',
      title: announcementData.title,
      message: announcementData.message,
      data: announcementData,
      priority: announcementData.priority || 'medium'
    });
  }

  // Chat message (for chatbot or support)
  sendChatMessage(userId, messageData) {
    this.sendToUser(userId, 'chat:message', {
      type: 'chat',
      ...messageData
    });
  }

  // System notification
  systemNotification(data) {
    this.broadcast('system', {
      type: 'system',
      title: data.title,
      message: data.message,
      priority: data.priority || 'low'
    });
  }

  // Generate unique ID
  generateId() {
    return `notif_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get service stats
  getStats() {
    return {
      onlineUsers: this.userSockets.size,
      totalConnections: this.socketUsers.size,
      activeRooms: this.rooms.size,
      roomDetails: Array.from(this.rooms.entries()).map(([name, sockets]) => ({
        name,
        members: sockets.size
      }))
    };
  }
}

// Export singleton instance
module.exports = new RealtimeNotificationService();
