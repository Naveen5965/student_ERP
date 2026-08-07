/**
 * Attendance API Tests
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../backend/server');

describe('Attendance API', () => {
  let authToken;
  let facultyToken;
  let testSessionId;
  let testQRCode;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@student.edu', password: 'TestPass123!' });
    authToken = loginRes.body.token;

    const facultyLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'faculty@studenterp.edu', password: 'Faculty@123' });
    facultyToken = facultyLoginRes.body.token;
  });

  describe('POST /api/attendance/sessions', () => {
    const newSession = {
      subject: 'Data Structures',
      department: 'Computer Science',
      semester: 3,
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '10:00',
      location: 'Room 101'
    };

    it('should create attendance session (faculty only)', async () => {
      const res = await request(app)
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send(newSession);

      expect(res.statusCode).toBe(201);
      expect(res.body.session).toHaveProperty('_id');
      expect(res.body.session).toHaveProperty('qrCode');
      testSessionId = res.body.session._id;
      testQRCode = res.body.session.qrCode;
    });

    it('should reject student from creating session', async () => {
      const res = await request(app)
        .post('/api/attendance/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newSession);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/attendance/sessions/:id/qr', () => {
    it('should return QR code image', async () => {
      const res = await request(app)
        .get(`/api/attendance/sessions/${testSessionId}/qr`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/image/);
    });
  });

  describe('POST /api/attendance/mark', () => {
    it('should mark attendance with QR code', async () => {
      const res = await request(app)
        .post('/api/attendance/mark')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId: testSessionId,
          qrCode: testQRCode,
          location: {
            latitude: 26.9124,
            longitude: 75.7873
          }
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.record.status).toBe('present');
    });

    it('should reject invalid QR code', async () => {
      const res = await request(app)
        .post('/api/attendance/mark')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId: testSessionId,
          qrCode: 'invalid-qr-code'
        });

      expect(res.statusCode).toBe(400);
    });

    it('should reject duplicate attendance', async () => {
      const res = await request(app)
        .post('/api/attendance/mark')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId: testSessionId,
          qrCode: testQRCode
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/attendance/sessions/:id', () => {
    it('should return session with attendance records', async () => {
      const res = await request(app)
        .get(`/api/attendance/sessions/${testSessionId}`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.session).toHaveProperty('records');
      expect(Array.isArray(res.body.session.records)).toBe(true);
    });
  });

  describe('GET /api/attendance/my-attendance', () => {
    it('should return attendance for logged in student', async () => {
      const res = await request(app)
        .get('/api/attendance/my-attendance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('attendance');
      expect(res.body).toHaveProperty('summary');
    });
  });

  describe('GET /api/attendance/summary/:studentId', () => {
    it('should return attendance summary', async () => {
      const res = await request(app)
        .get('/api/attendance/summary/STU2024001')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('totalClasses');
      expect(res.body).toHaveProperty('present');
      expect(res.body).toHaveProperty('absent');
      expect(res.body).toHaveProperty('percentage');
    });
  });

  describe('PUT /api/attendance/sessions/:id/complete', () => {
    it('should complete attendance session', async () => {
      const res = await request(app)
        .put(`/api/attendance/sessions/${testSessionId}/complete`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.session.status).toBe('completed');
    });
  });

  describe('GET /api/attendance/low-attendance', () => {
    it('should return students with low attendance', async () => {
      const res = await request(app)
        .get('/api/attendance/low-attendance?threshold=75')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('students');
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });
});
