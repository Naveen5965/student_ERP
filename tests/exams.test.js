/**
 * Exams API Tests
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../backend/server');

describe('Exams API', () => {
  let authToken;
  let adminToken;
  let testExamId;
  let testResultId;

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

  describe('POST /api/exams', () => {
    const newExam = {
      name: 'Mid-Term Examination',
      subject: 'Data Structures',
      subjectCode: 'CS301',
      department: 'Computer Science',
      semester: 3,
      date: '2024-10-15',
      startTime: '10:00',
      endTime: '13:00',
      venue: 'Hall A',
      maxMarks: 100,
      passingMarks: 40,
      academicYear: '2024-25',
      examType: 'mid-term'
    };

    it('should create exam (admin only)', async () => {
      const res = await request(app)
        .post('/api/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newExam);

      expect(res.statusCode).toBe(201);
      expect(res.body.exam).toHaveProperty('_id');
      testExamId = res.body.exam._id;
    });

    it('should reject student from creating exam', async () => {
      const res = await request(app)
        .post('/api/exams')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newExam);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/exams', () => {
    it('should return list of exams', async () => {
      const res = await request(app)
        .get('/api/exams')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('exams');
    });

    it('should filter by department and semester', async () => {
      const res = await request(app)
        .get('/api/exams?department=Computer Science&semester=3')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      res.body.exams.forEach(exam => {
        expect(exam.department).toBe('Computer Science');
        expect(exam.semester).toBe(3);
      });
    });
  });

  describe('GET /api/exams/schedule', () => {
    it('should return exam schedule for student', async () => {
      const res = await request(app)
        .get('/api/exams/schedule')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('schedule');
    });
  });

  describe('GET /api/exams/:id/hall-ticket', () => {
    it('should generate hall ticket PDF', async () => {
      const res = await request(app)
        .get(`/api/exams/${testExamId}/hall-ticket`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
    });
  });

  describe('POST /api/exams/:id/results', () => {
    it('should add exam results (admin only)', async () => {
      const results = [
        { studentId: 'STU2024001', marksObtained: 85 },
        { studentId: 'STU2024002', marksObtained: 72 },
        { studentId: 'STU2024003', marksObtained: 35 }
      ];

      const res = await request(app)
        .post(`/api/exams/${testExamId}/results`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ results });

      expect(res.statusCode).toBe(200);
      expect(res.body.results).toHaveLength(3);
    });
  });

  describe('GET /api/exams/:id/results', () => {
    it('should return exam results', async () => {
      const res = await request(app)
        .get(`/api/exams/${testExamId}/results`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('results');
      expect(res.body).toHaveProperty('statistics');
    });
  });

  describe('GET /api/exams/my-results', () => {
    it('should return results for logged in student', async () => {
      const res = await request(app)
        .get('/api/exams/my-results')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('results');
    });
  });

  describe('GET /api/exams/grade-card/:semester', () => {
    it('should generate grade card PDF', async () => {
      const res = await request(app)
        .get('/api/exams/grade-card/3')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
    });
  });

  describe('GET /api/exams/analytics', () => {
    it('should return exam analytics (admin only)', async () => {
      const res = await request(app)
        .get('/api/exams/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('overallPassPercentage');
      expect(res.body).toHaveProperty('subjectWiseAnalysis');
    });
  });

  describe('PUT /api/exams/:id', () => {
    it('should update exam details', async () => {
      const res = await request(app)
        .put(`/api/exams/${testExamId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ venue: 'Hall B' });

      expect(res.statusCode).toBe(200);
      expect(res.body.exam.venue).toBe('Hall B');
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });
});
