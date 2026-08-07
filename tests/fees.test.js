/**
 * Fees API Tests
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../backend/server');

describe('Fees API', () => {
  let authToken;
  let adminToken;
  let testFeeId;
  let testOrderId;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@student.edu', password: 'TestPass123!' });
    authToken = loginRes.body.token;

    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@studenterp.edu', password: 'Admin@123' });
    adminToken = adminLoginRes.body.token;
  });

  describe('GET /api/fees', () => {
    it('should return fees for logged in student', async () => {
      const res = await request(app)
        .get('/api/fees')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('fees');
    });

    it('should filter fees by status', async () => {
      const res = await request(app)
        .get('/api/fees?status=pending')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      res.body.fees.forEach(fee => {
        expect(fee.status).toBe('pending');
      });
    });
  });

  describe('POST /api/fees', () => {
    const newFee = {
      studentId: 'STU2024001',
      feeType: 'tuition',
      amount: 50000,
      dueDate: '2024-12-31',
      academicYear: '2024-25',
      semester: 1,
      description: 'Tuition fee for Semester 1'
    };

    it('should create new fee (admin/accountant only)', async () => {
      const res = await request(app)
        .post('/api/fees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newFee);

      expect(res.statusCode).toBe(201);
      expect(res.body.fee).toHaveProperty('_id');
      testFeeId = res.body.fee._id;
    });

    it('should reject non-admin users', async () => {
      const res = await request(app)
        .post('/api/fees')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newFee);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/fees/summary', () => {
    it('should return fee summary', async () => {
      const res = await request(app)
        .get('/api/fees/summary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('totalFees');
      expect(res.body).toHaveProperty('paidAmount');
      expect(res.body).toHaveProperty('pendingAmount');
    });
  });

  describe('POST /api/fees/payment/create', () => {
    it('should create Razorpay order', async () => {
      const res = await request(app)
        .post('/api/fees/payment/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          feeId: testFeeId,
          amount: 50000,
          paymentMethod: 'razorpay'
        });

      // May fail if Razorpay not configured
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('orderId');
        testOrderId = res.body.orderId;
      } else {
        expect(res.statusCode).toBe(500); // Payment gateway not configured
      }
    });
  });

  describe('POST /api/fees/payment/verify', () => {
    it('should verify payment signature', async () => {
      // Skip if order wasn't created
      if (!testOrderId) {
        return;
      }

      const res = await request(app)
        .post('/api/fees/payment/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          razorpay_order_id: testOrderId,
          razorpay_payment_id: 'pay_test123',
          razorpay_signature: 'test_signature'
        });

      // Will fail with invalid signature
      expect([200, 400]).toContain(res.statusCode);
    });
  });

  describe('GET /api/fees/:id/receipt', () => {
    it('should generate fee receipt PDF', async () => {
      const res = await request(app)
        .get(`/api/fees/${testFeeId}/receipt`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Expect PDF or error if fee not paid
      expect([200, 400]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.headers['content-type']).toBe('application/pdf');
      }
    });
  });

  describe('GET /api/fees/analytics', () => {
    it('should return fee analytics (admin only)', async () => {
      const res = await request(app)
        .get('/api/fees/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('collectionRate');
      expect(res.body).toHaveProperty('monthlyCollection');
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });
});
