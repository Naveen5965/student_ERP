/**
 * Hostel API Tests
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../backend/server');

describe('Hostel API', () => {
  let authToken;
  let wardenToken;
  let adminToken;
  let testHostelId;
  let testRoomId;
  let testAllocationId;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@student.edu', password: 'TestPass123!' });
    authToken = loginRes.body.token;

    const wardenLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'warden@studenterp.edu', password: 'Warden@123' });
    wardenToken = wardenLoginRes.body.token;

    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@studenterp.edu', password: 'Admin@123' });
    adminToken = adminLoginRes.body.token;
  });

  describe('GET /api/hostel', () => {
    it('should return list of hostels', async () => {
      const res = await request(app)
        .get('/api/hostel')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('hostels');
    });
  });

  describe('POST /api/hostel', () => {
    const newHostel = {
      name: 'Test Hostel',
      type: 'boys',
      totalRooms: 50,
      floors: 3,
      facilities: ['WiFi', 'Mess', 'Gym'],
      feePerSemester: 15000,
      address: 'Campus Area'
    };

    it('should create new hostel (admin only)', async () => {
      const res = await request(app)
        .post('/api/hostel')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newHostel);

      expect(res.statusCode).toBe(201);
      expect(res.body.hostel).toHaveProperty('_id');
      testHostelId = res.body.hostel._id;
    });
  });

  describe('POST /api/hostel/:hostelId/rooms', () => {
    const newRoom = {
      roomNumber: 'A101',
      floor: 1,
      type: 'double',
      capacity: 2,
      rentPerBed: 7500
    };

    it('should add room to hostel', async () => {
      const res = await request(app)
        .post(`/api/hostel/${testHostelId}/rooms`)
        .set('Authorization', `Bearer ${wardenToken}`)
        .send(newRoom);

      expect(res.statusCode).toBe(201);
      expect(res.body.room).toHaveProperty('_id');
      testRoomId = res.body.room._id;
    });
  });

  describe('GET /api/hostel/:hostelId/rooms', () => {
    it('should return rooms in hostel', async () => {
      const res = await request(app)
        .get(`/api/hostel/${testHostelId}/rooms`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('rooms');
    });

    it('should filter available rooms', async () => {
      const res = await request(app)
        .get(`/api/hostel/${testHostelId}/rooms?available=true`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /api/hostel/allocate', () => {
    it('should allocate room to student', async () => {
      const res = await request(app)
        .post('/api/hostel/allocate')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({
          studentId: 'STU2024001',
          hostelId: testHostelId,
          roomId: testRoomId,
          bedNumber: 1,
          academicYear: '2024-25'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.allocation).toHaveProperty('_id');
      testAllocationId = res.body.allocation._id;
    });

    it('should reject if room is full', async () => {
      // Allocate second bed
      await request(app)
        .post('/api/hostel/allocate')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({
          studentId: 'STU2024002',
          hostelId: testHostelId,
          roomId: testRoomId,
          bedNumber: 2,
          academicYear: '2024-25'
        });

      // Third allocation should fail
      const res = await request(app)
        .post('/api/hostel/allocate')
        .set('Authorization', `Bearer ${wardenToken}`)
        .send({
          studentId: 'STU2024003',
          hostelId: testHostelId,
          roomId: testRoomId,
          bedNumber: 3,
          academicYear: '2024-25'
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/hostel/my-allocation', () => {
    it('should return student allocation', async () => {
      const res = await request(app)
        .get('/api/hostel/my-allocation')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /api/hostel/complaints', () => {
    it('should register a complaint', async () => {
      const res = await request(app)
        .post('/api/hostel/complaints')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          category: 'maintenance',
          subject: 'AC not working',
          description: 'The air conditioner in my room is not cooling properly',
          priority: 'medium'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.complaint).toHaveProperty('ticketNumber');
    });
  });

  describe('GET /api/hostel/complaints', () => {
    it('should return complaints (warden)', async () => {
      const res = await request(app)
        .get('/api/hostel/complaints')
        .set('Authorization', `Bearer ${wardenToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('complaints');
    });
  });

  describe('GET /api/hostel/statistics', () => {
    it('should return hostel statistics', async () => {
      const res = await request(app)
        .get('/api/hostel/statistics')
        .set('Authorization', `Bearer ${wardenToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('totalCapacity');
      expect(res.body).toHaveProperty('totalOccupied');
      expect(res.body).toHaveProperty('occupancyRate');
    });
  });

  describe('PUT /api/hostel/vacate/:allocationId', () => {
    it('should vacate room allocation', async () => {
      const res = await request(app)
        .put(`/api/hostel/vacate/${testAllocationId}`)
        .set('Authorization', `Bearer ${wardenToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.allocation.status).toBe('vacated');
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });
});
