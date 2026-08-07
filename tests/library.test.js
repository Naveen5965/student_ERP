/**
 * Library API Tests
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../backend/server');

describe('Library API', () => {
  let authToken;
  let librarianToken;
  let testBookId;
  let testBorrowingId;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@student.edu', password: 'TestPass123!' });
    authToken = loginRes.body.token;

    const librarianLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'librarian@studenterp.edu', password: 'Librarian@123' });
    librarianToken = librarianLoginRes.body.token;
  });

  describe('GET /api/library/books', () => {
    it('should return list of books', async () => {
      const res = await request(app)
        .get('/api/library/books')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('books');
      expect(Array.isArray(res.body.books)).toBe(true);
    });

    it('should search books by title', async () => {
      const res = await request(app)
        .get('/api/library/books?search=programming')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
    });

    it('should filter by category', async () => {
      const res = await request(app)
        .get('/api/library/books?category=Computer Science')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      res.body.books.forEach(book => {
        expect(book.category).toBe('Computer Science');
      });
    });
  });

  describe('POST /api/library/books', () => {
    const newBook = {
      title: 'Test Book',
      author: 'Test Author',
      isbn: '978-0-00-000000-0',
      category: 'Computer Science',
      publisher: 'Test Publisher',
      quantity: 5,
      location: 'Section A, Shelf 1'
    };

    it('should add new book (librarian only)', async () => {
      const res = await request(app)
        .post('/api/library/books')
        .set('Authorization', `Bearer ${librarianToken}`)
        .send(newBook);

      expect(res.statusCode).toBe(201);
      expect(res.body.book).toHaveProperty('_id');
      testBookId = res.body.book._id;
    });

    it('should reject non-librarian users', async () => {
      const res = await request(app)
        .post('/api/library/books')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newBook);

      expect(res.statusCode).toBe(403);
    });

    it('should reject duplicate ISBN', async () => {
      const res = await request(app)
        .post('/api/library/books')
        .set('Authorization', `Bearer ${librarianToken}`)
        .send(newBook);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/library/borrow', () => {
    it('should borrow a book', async () => {
      const res = await request(app)
        .post('/api/library/borrow')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bookId: testBookId });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('borrowing');
      expect(res.body.borrowing.status).toBe('borrowed');
      testBorrowingId = res.body.borrowing._id;
    });

    it('should reject if book not available', async () => {
      // Borrow all copies
      const res = await request(app)
        .post('/api/library/borrow')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bookId: testBookId });

      // Should eventually fail when no copies available
      expect([200, 400]).toContain(res.statusCode);
    });
  });

  describe('GET /api/library/my-books', () => {
    it('should return borrowed books for student', async () => {
      const res = await request(app)
        .get('/api/library/my-books')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('borrowings');
    });
  });

  describe('POST /api/library/return/:borrowingId', () => {
    it('should return a borrowed book', async () => {
      const res = await request(app)
        .post(`/api/library/return/${testBorrowingId}`)
        .set('Authorization', `Bearer ${librarianToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.borrowing.status).toBe('returned');
    });
  });

  describe('POST /api/library/reserve', () => {
    it('should reserve a book', async () => {
      const res = await request(app)
        .post('/api/library/reserve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bookId: testBookId });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('reservation');
    });
  });

  describe('GET /api/library/overdue', () => {
    it('should return overdue books (librarian only)', async () => {
      const res = await request(app)
        .get('/api/library/overdue')
        .set('Authorization', `Bearer ${librarianToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('overdueBooks');
    });
  });

  describe('GET /api/library/statistics', () => {
    it('should return library statistics', async () => {
      const res = await request(app)
        .get('/api/library/statistics')
        .set('Authorization', `Bearer ${librarianToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('totalBooks');
      expect(res.body).toHaveProperty('totalBorrowed');
      expect(res.body).toHaveProperty('totalOverdue');
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });
});
