/**
 * Students API Tests
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../backend/server');
const { User } = require('../database/models');

describe('Students API', () => {
  let authToken;
  let adminToken;
  let testStudentId;

  beforeAll(async () => {
    // Create test user and get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@student.edu',
        password: 'TestPass123!'
      });
    authToken = loginRes.body.token;

    // Create admin user and get token
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@studenterp.edu',
        password: 'Admin@123'
      });
    adminToken = adminLoginRes.body.token;
  });

  describe('GET /api/students', () => {
    it('should return list of students for admin', async () => {
      const res = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('students');
      expect(Array.isArray(res.body.students)).toBe(true);
    });

    it('should reject unauthorized access', async () => {
      const res = await request(app)
        .get('/api/students');

      expect(res.statusCode).toBe(401);
    });

    it('should filter students by department', async () => {
      const res = await request(app)
        .get('/api/students?department=Computer Science')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      res.body.students.forEach(student => {
        expect(student.department).toBe('Computer Science');
      });
    });

    it('should paginate results', async () => {
      const res = await request(app)
        .get('/api/students?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination.currentPage).toBe(1);
    });
  });

  describe('POST /api/students', () => {
    const newStudent = {
      name: 'Test Student',
      email: 'newstudent@example.com',
      studentId: 'STU2024999',
      enrollmentNumber: 'EN2024999',
      department: 'Computer Science',
      semester: 3,
      batch: '2024',
      phone: '+919876543210',
      dateOfBirth: '2000-01-15',
      address: 'Test Address, City'
    };

    it('should create new student (admin only)', async () => {
      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newStudent);

      expect(res.statusCode).toBe(201);
      expect(res.body.student).toHaveProperty('_id');
      expect(res.body.student.name).toBe(newStudent.name);
      testStudentId = res.body.student._id;
    });

    it('should reject duplicate student ID', async () => {
      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newStudent);

      expect(res.statusCode).toBe(400);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Incomplete Student' });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/students/:id', () => {
    it('should return student by ID', async () => {
      const res = await request(app)
        .get(`/api/students/${testStudentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.student._id).toBe(testStudentId);
    });

    it('should return 404 for non-existent student', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/students/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/students/:id', () => {
    it('should update student details', async () => {
      const res = await request(app)
        .put(`/api/students/${testStudentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ semester: 4 });

      expect(res.statusCode).toBe(200);
      expect(res.body.student.semester).toBe(4);
    });
  });

  describe('GET /api/students/profile/me', () => {
    it('should return logged in student profile', async () => {
      const res = await request(app)
        .get('/api/students/profile/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('student');
    });
  });

  describe('DELETE /api/students/:id', () => {
    it('should delete student (admin only)', async () => {
      const res = await request(app)
        .delete(`/api/students/${testStudentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });
});
