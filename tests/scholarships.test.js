/**
 * Scholarships API Tests
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../backend/server');

describe('Scholarships API', () => {
  let authToken;
  let adminToken;
  let testScholarshipId;
  let testApplicationId;

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

  describe('POST /api/scholarships', () => {
    const newScholarship = {
      name: 'Merit Scholarship',
      type: 'merit',
      amount: 25000,
      eligibilityCriteria: 'CGPA >= 8.5',
      description: 'Scholarship for meritorious students',
      applicationDeadline: '2024-12-31',
      documentsRequired: ['marksheet', 'income_certificate'],
      quota: 50
    };

    it('should create scholarship (admin only)', async () => {
      const res = await request(app)
        .post('/api/scholarships')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newScholarship);

      expect(res.statusCode).toBe(201);
      expect(res.body.scholarship).toHaveProperty('_id');
      testScholarshipId = res.body.scholarship._id;
    });

    it('should reject student from creating scholarship', async () => {
      const res = await request(app)
        .post('/api/scholarships')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newScholarship);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/scholarships', () => {
    it('should return list of scholarships', async () => {
      const res = await request(app)
        .get('/api/scholarships')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('scholarships');
    });

    it('should filter by type', async () => {
      const res = await request(app)
        .get('/api/scholarships?type=merit')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      res.body.scholarships.forEach(s => {
        expect(s.type).toBe('merit');
      });
    });

    it('should filter open scholarships', async () => {
      const res = await request(app)
        .get('/api/scholarships?status=open')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/scholarships/eligible', () => {
    it('should return eligible scholarships for student', async () => {
      const res = await request(app)
        .get('/api/scholarships/eligible')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('scholarships');
    });
  });

  describe('POST /api/scholarships/:id/apply', () => {
    it('should submit scholarship application', async () => {
      const res = await request(app)
        .post(`/api/scholarships/${testScholarshipId}/apply`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          documents: [
            { type: 'marksheet', url: '/documents/marksheet.pdf' },
            { type: 'income_certificate', url: '/documents/income.pdf' }
          ],
          statement: 'I am applying for this scholarship to support my education.'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.application).toHaveProperty('_id');
      expect(res.body.application.status).toBe('pending');
      testApplicationId = res.body.application._id;
    });

    it('should reject duplicate application', async () => {
      const res = await request(app)
        .post(`/api/scholarships/${testScholarshipId}/apply`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          documents: [],
          statement: 'Duplicate application'
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/scholarships/my-applications', () => {
    it('should return student applications', async () => {
      const res = await request(app)
        .get('/api/scholarships/my-applications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('applications');
      expect(res.body.applications.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/scholarships/:id/applications', () => {
    it('should return all applications for scholarship (admin)', async () => {
      const res = await request(app)
        .get(`/api/scholarships/${testScholarshipId}/applications`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('applications');
    });
  });

  describe('PUT /api/scholarships/applications/:id/verify', () => {
    it('should verify application (admin)', async () => {
      const res = await request(app)
        .put(`/api/scholarships/applications/${testApplicationId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'approved',
          remarks: 'All documents verified'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.application.status).toBe('approved');
    });
  });

  describe('POST /api/scholarships/applications/:id/disburse', () => {
    it('should disburse scholarship amount', async () => {
      const res = await request(app)
        .post(`/api/scholarships/applications/${testApplicationId}/disburse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 25000,
          transactionId: 'TXN123456',
          bankDetails: {
            accountNumber: '1234567890',
            ifscCode: 'ABCD0001234',
            bankName: 'Test Bank'
          }
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.application.status).toBe('disbursed');
    });
  });

  describe('GET /api/scholarships/statistics', () => {
    it('should return scholarship statistics', async () => {
      const res = await request(app)
        .get('/api/scholarships/statistics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('totalScholarships');
      expect(res.body).toHaveProperty('totalApplications');
      expect(res.body).toHaveProperty('totalDisbursed');
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });
});
