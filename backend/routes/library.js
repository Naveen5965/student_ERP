const express = require('express');
const mongoose = require('mongoose');
const { LibraryBook, Student, User } = require('../../database/models');
const { authenticateToken, requireStaff, requireAdmin, auditLog } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Validation failed',
      errors: errors.array() 
    });
  }
  next();
};

// ==================== LIBRARY TRANSACTION SCHEMA ====================

const LibraryTransactionSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryBook', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  returnDate: { type: Date },
  status: {
    type: String,
    enum: ['Issued', 'Returned', 'Overdue', 'Lost'],
    default: 'Issued'
  },
  renewCount: { type: Number, default: 0 },
  fine: { type: Number, default: 0 },
  finePaid: { type: Boolean, default: false },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  returnedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String }
});

const LibraryTransaction = mongoose.models.LibraryTransaction || 
  mongoose.model('LibraryTransaction', LibraryTransactionSchema);

// Reservation Schema
const ReservationSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryBook', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  reservationDate: { type: Date, default: Date.now },
  expiryDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['Active', 'Fulfilled', 'Expired', 'Cancelled'],
    default: 'Active'
  },
  notified: { type: Boolean, default: false }
});

const BookReservation = mongoose.models.BookReservation || 
  mongoose.model('BookReservation', ReservationSchema);

// Fine configuration
const FINE_PER_DAY = 5; // Rs. 5 per day
const MAX_BORROW_DAYS = 14;
const MAX_RENEWALS = 2;
const MAX_BOOKS_PER_STUDENT = 5;

// ==================== BOOK MANAGEMENT ====================

// GET /api/library/books - Search and list books
router.get('/books', authenticateToken, async (req, res) => {
  try {
    const {
      search,
      category,
      author,
      available,
      page = 1,
      limit = 20,
      sortBy = 'title',
      sortOrder = 'asc'
    } = req.query;

    const query = {};

    // Search by title, author, or ISBN
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { isbn: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) query.category = category;
    if (author) query.author = { $regex: author, $options: 'i' };
    if (available === 'true') query.availableCopies = { $gt: 0 };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [books, total, categories] = await Promise.all([
      LibraryBook.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      LibraryBook.countDocuments(query),
      LibraryBook.distinct('category')
    ]);

    res.json({
      success: true,
      data: {
        books,
        categories,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch books' });
  }
});

// GET /api/library/books/:id - Get book details
router.get('/books/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const book = await LibraryBook.findById(id).lean();
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    // Get current borrowers
    const currentBorrowers = await LibraryTransaction.find({
      book: id,
      status: { $in: ['Issued', 'Overdue'] }
    })
      .populate('student', 'firstName lastName registrationNumber')
      .lean();

    // Get reservation queue
    const reservations = await BookReservation.find({
      book: id,
      status: 'Active'
    })
      .populate('student', 'firstName lastName')
      .sort({ reservationDate: 1 })
      .lean();

    res.json({
      success: true,
      data: {
        book,
        currentBorrowers,
        reservationQueue: reservations
      }
    });
  } catch (error) {
    console.error('Get book error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch book' });
  }
});

// POST /api/library/books - Add new book
router.post('/books', authenticateToken, requireStaff, [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('author').trim().notEmpty().withMessage('Author is required'),
  body('isbn').trim().notEmpty().withMessage('ISBN is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('totalCopies').isInt({ min: 1 }).withMessage('Total copies must be at least 1')
], handleValidationErrors, auditLog, async (req, res) => {
  try {
    const {
      title, author, isbn, publisher, yearPublished,
      edition, category, subject, location, totalCopies
    } = req.body;

    // Check if ISBN already exists
    const existingBook = await LibraryBook.findOne({ isbn });
    if (existingBook) {
      return res.status(409).json({ success: false, message: 'Book with this ISBN already exists' });
    }

    const book = new LibraryBook({
      title,
      author,
      isbn,
      publisher,
      yearPublished,
      edition,
      category,
      subject,
      location,
      totalCopies,
      availableCopies: totalCopies
    });

    await book.save();

    res.status(201).json({
      success: true,
      message: 'Book added successfully',
      data: { book }
    });
  } catch (error) {
    console.error('Add book error:', error);
    res.status(500).json({ success: false, message: 'Failed to add book' });
  }
});

// PUT /api/library/books/:id - Update book
router.put('/books/:id', authenticateToken, requireStaff, auditLog, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Calculate available copies if total copies changed
    if (updates.totalCopies !== undefined) {
      const book = await LibraryBook.findById(id);
      if (book) {
        const issuedCopies = book.totalCopies - book.availableCopies;
        updates.availableCopies = updates.totalCopies - issuedCopies;
        if (updates.availableCopies < 0) {
          return res.status(400).json({
            success: false,
            message: 'Cannot reduce total copies below issued count'
          });
        }
      }
    }

    const book = await LibraryBook.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    res.json({
      success: true,
      message: 'Book updated successfully',
      data: { book }
    });
  } catch (error) {
    console.error('Update book error:', error);
    res.status(500).json({ success: false, message: 'Failed to update book' });
  }
});

// DELETE /api/library/books/:id - Delete book
router.delete('/books/:id', authenticateToken, requireAdmin, auditLog, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if book has active transactions
    const activeTransactions = await LibraryTransaction.countDocuments({
      book: id,
      status: { $in: ['Issued', 'Overdue'] }
    });

    if (activeTransactions > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete book with active transactions'
      });
    }

    await LibraryBook.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Book deleted successfully'
    });
  } catch (error) {
    console.error('Delete book error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete book' });
  }
});

// ==================== BORROWING OPERATIONS ====================

// POST /api/library/issue - Issue book to student
router.post('/issue', authenticateToken, requireStaff, [
  body('bookId').isMongoId().withMessage('Valid book ID is required'),
  body('studentId').isMongoId().withMessage('Valid student ID is required')
], handleValidationErrors, auditLog, async (req, res) => {
  try {
    const { bookId, studentId, customDueDays } = req.body;

    // Check book availability
    const book = await LibraryBook.findById(bookId);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    if (book.availableCopies <= 0) {
      return res.status(400).json({ success: false, message: 'No copies available' });
    }

    // Check student
    const student = await Student.findById(studentId);
    if (!student || !student.isActive) {
      return res.status(404).json({ success: false, message: 'Student not found or inactive' });
    }

    if (!student.libraryCard) {
      return res.status(400).json({ success: false, message: 'Student does not have a library card' });
    }

    // Check if student has reached max books limit
    const currentlyBorrowed = await LibraryTransaction.countDocuments({
      student: studentId,
      status: { $in: ['Issued', 'Overdue'] }
    });

    if (currentlyBorrowed >= MAX_BOOKS_PER_STUDENT) {
      return res.status(400).json({
        success: false,
        message: `Student has reached maximum limit of ${MAX_BOOKS_PER_STUDENT} books`
      });
    }

    // Check for unpaid fines
    const unpaidFines = await LibraryTransaction.aggregate([
      { $match: { student: mongoose.Types.ObjectId(studentId), fine: { $gt: 0 }, finePaid: false } },
      { $group: { _id: null, totalFine: { $sum: '$fine' } } }
    ]);

    if (unpaidFines.length > 0 && unpaidFines[0].totalFine > 100) {
      return res.status(400).json({
        success: false,
        message: `Student has unpaid fines of Rs. ${unpaidFines[0].totalFine}. Please clear fines first.`
      });
    }

    // Calculate due date
    const dueDays = customDueDays || MAX_BORROW_DAYS;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);

    // Create transaction
    const transaction = new LibraryTransaction({
      book: bookId,
      student: studentId,
      dueDate,
      issuedBy: req.user.id
    });

    await transaction.save();

    // Update book availability
    book.availableCopies -= 1;
    await book.save();

    // Check and fulfill any reservations
    await BookReservation.findOneAndUpdate(
      { book: bookId, student: studentId, status: 'Active' },
      { status: 'Fulfilled' }
    );

    res.status(201).json({
      success: true,
      message: 'Book issued successfully',
      data: {
        transaction,
        dueDate,
        book: { title: book.title, author: book.author }
      }
    });
  } catch (error) {
    console.error('Issue book error:', error);
    res.status(500).json({ success: false, message: 'Failed to issue book' });
  }
});

// POST /api/library/return - Return book
router.post('/return', authenticateToken, requireStaff, [
  body('transactionId').isMongoId().withMessage('Valid transaction ID is required')
], handleValidationErrors, auditLog, async (req, res) => {
  try {
    const { transactionId, waiveFine } = req.body;

    const transaction = await LibraryTransaction.findById(transactionId)
      .populate('book')
      .populate('student', 'firstName lastName');

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.status === 'Returned') {
      return res.status(400).json({ success: false, message: 'Book already returned' });
    }

    // Calculate fine if overdue
    const now = new Date();
    let fine = 0;
    if (now > transaction.dueDate) {
      const daysOverdue = Math.ceil((now - transaction.dueDate) / (1000 * 60 * 60 * 24));
      fine = daysOverdue * FINE_PER_DAY;
    }

    // Update transaction
    transaction.returnDate = now;
    transaction.status = 'Returned';
    transaction.fine = waiveFine ? 0 : fine;
    transaction.finePaid = waiveFine || fine === 0;
    transaction.returnedTo = req.user.id;

    await transaction.save();

    // Update book availability
    await LibraryBook.findByIdAndUpdate(transaction.book._id, {
      $inc: { availableCopies: 1 }
    });

    // Notify next person in reservation queue
    const nextReservation = await BookReservation.findOne({
      book: transaction.book._id,
      status: 'Active'
    }).sort({ reservationDate: 1 });

    if (nextReservation && !nextReservation.notified) {
      nextReservation.notified = true;
      await nextReservation.save();
      // TODO: Send notification to student
    }

    res.json({
      success: true,
      message: 'Book returned successfully',
      data: {
        transaction,
        fine: transaction.fine,
        fineMessage: fine > 0 ? `Fine of Rs. ${fine} for ${Math.ceil((now - transaction.dueDate) / (1000 * 60 * 60 * 24))} overdue days` : null
      }
    });
  } catch (error) {
    console.error('Return book error:', error);
    res.status(500).json({ success: false, message: 'Failed to return book' });
  }
});

// POST /api/library/renew - Renew book
router.post('/renew', authenticateToken, [
  body('transactionId').isMongoId().withMessage('Valid transaction ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { transactionId } = req.body;

    const transaction = await LibraryTransaction.findById(transactionId)
      .populate('book');

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.status !== 'Issued') {
      return res.status(400).json({ success: false, message: 'Can only renew issued books' });
    }

    if (transaction.renewCount >= MAX_RENEWALS) {
      return res.status(400).json({
        success: false,
        message: `Maximum renewal limit of ${MAX_RENEWALS} reached`
      });
    }

    // Check if book is reserved by someone else
    const hasReservation = await BookReservation.exists({
      book: transaction.book._id,
      status: 'Active',
      student: { $ne: transaction.student }
    });

    if (hasReservation) {
      return res.status(400).json({
        success: false,
        message: 'Cannot renew - book is reserved by another student'
      });
    }

    // Check if already overdue
    if (new Date() > transaction.dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Cannot renew overdue book. Please return and pay fine first.'
      });
    }

    // Extend due date
    const newDueDate = new Date(transaction.dueDate);
    newDueDate.setDate(newDueDate.getDate() + MAX_BORROW_DAYS);

    transaction.dueDate = newDueDate;
    transaction.renewCount += 1;
    await transaction.save();

    res.json({
      success: true,
      message: 'Book renewed successfully',
      data: {
        newDueDate,
        renewalsRemaining: MAX_RENEWALS - transaction.renewCount
      }
    });
  } catch (error) {
    console.error('Renew book error:', error);
    res.status(500).json({ success: false, message: 'Failed to renew book' });
  }
});

// ==================== RESERVATIONS ====================

// POST /api/library/reserve - Reserve a book
router.post('/reserve', authenticateToken, [
  body('bookId').isMongoId().withMessage('Valid book ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { bookId } = req.body;

    // Get student from user
    const student = await Student.findOne({ email: req.user.email });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const book = await LibraryBook.findById(bookId);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    // Check if already reserved by this student
    const existingReservation = await BookReservation.findOne({
      book: bookId,
      student: student._id,
      status: 'Active'
    });

    if (existingReservation) {
      return res.status(400).json({ success: false, message: 'You already have a reservation for this book' });
    }

    // Check if student already has this book
    const hasBook = await LibraryTransaction.exists({
      book: bookId,
      student: student._id,
      status: { $in: ['Issued', 'Overdue'] }
    });

    if (hasBook) {
      return res.status(400).json({ success: false, message: 'You already have this book' });
    }

    // Create reservation (expires in 7 days)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);

    const reservation = new BookReservation({
      book: bookId,
      student: student._id,
      expiryDate
    });

    await reservation.save();

    // Get queue position
    const queuePosition = await BookReservation.countDocuments({
      book: bookId,
      status: 'Active',
      reservationDate: { $lte: reservation.reservationDate }
    });

    res.status(201).json({
      success: true,
      message: 'Book reserved successfully',
      data: {
        reservation,
        queuePosition,
        expiryDate
      }
    });
  } catch (error) {
    console.error('Reserve book error:', error);
    res.status(500).json({ success: false, message: 'Failed to reserve book' });
  }
});

// DELETE /api/library/reserve/:id - Cancel reservation
router.delete('/reserve/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await BookReservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }

    reservation.status = 'Cancelled';
    await reservation.save();

    res.json({
      success: true,
      message: 'Reservation cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel reservation error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel reservation' });
  }
});

// ==================== FINES MANAGEMENT ====================

// GET /api/library/fines - Get all fines or student fines
router.get('/fines', authenticateToken, async (req, res) => {
  try {
    const { studentId, unpaidOnly, page = 1, limit = 20 } = req.query;
    const query = { fine: { $gt: 0 } };

    if (studentId) {
      query.student = studentId;
    } else if (req.user.role === 'student') {
      const student = await Student.findOne({ email: req.user.email });
      if (student) query.student = student._id;
    }

    if (unpaidOnly === 'true') {
      query.finePaid = false;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [fines, total, totalUnpaid] = await Promise.all([
      LibraryTransaction.find(query)
        .populate('book', 'title author')
        .populate('student', 'firstName lastName registrationNumber')
        .sort({ returnDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      LibraryTransaction.countDocuments(query),
      LibraryTransaction.aggregate([
        { $match: { ...query, finePaid: false } },
        { $group: { _id: null, total: { $sum: '$fine' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        fines,
        totalUnpaidAmount: totalUnpaid[0]?.total || 0,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get fines error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fines' });
  }
});

// POST /api/library/fines/pay - Pay fine
router.post('/fines/pay', authenticateToken, requireStaff, [
  body('transactionId').isMongoId().withMessage('Valid transaction ID is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Valid amount is required')
], handleValidationErrors, auditLog, async (req, res) => {
  try {
    const { transactionId, amount, paymentMethod } = req.body;

    const transaction = await LibraryTransaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.finePaid) {
      return res.status(400).json({ success: false, message: 'Fine already paid' });
    }

    if (amount < transaction.fine) {
      return res.status(400).json({
        success: false,
        message: `Full fine amount of Rs. ${transaction.fine} is required`
      });
    }

    transaction.finePaid = true;
    transaction.notes = `Fine of Rs. ${transaction.fine} paid via ${paymentMethod || 'Cash'} on ${new Date().toISOString()}`;
    await transaction.save();

    res.json({
      success: true,
      message: 'Fine paid successfully',
      data: { transaction }
    });
  } catch (error) {
    console.error('Pay fine error:', error);
    res.status(500).json({ success: false, message: 'Failed to process payment' });
  }
});

// ==================== STUDENT LIBRARY ACCOUNT ====================

// GET /api/library/my-account - Get student's library account
router.get('/my-account', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findOne({ email: req.user.email });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const [currentlyBorrowed, borrowHistory, reservations, unpaidFines] = await Promise.all([
      LibraryTransaction.find({
        student: student._id,
        status: { $in: ['Issued', 'Overdue'] }
      })
        .populate('book', 'title author isbn')
        .lean(),
      LibraryTransaction.find({
        student: student._id,
        status: 'Returned'
      })
        .populate('book', 'title author')
        .sort({ returnDate: -1 })
        .limit(10)
        .lean(),
      BookReservation.find({
        student: student._id,
        status: 'Active'
      })
        .populate('book', 'title author')
        .lean(),
      LibraryTransaction.aggregate([
        { $match: { student: student._id, fine: { $gt: 0 }, finePaid: false } },
        { $group: { _id: null, total: { $sum: '$fine' } } }
      ])
    ]);

    // Check for overdue books and update status
    const now = new Date();
    for (const transaction of currentlyBorrowed) {
      if (now > new Date(transaction.dueDate) && transaction.status === 'Issued') {
        await LibraryTransaction.findByIdAndUpdate(transaction._id, { status: 'Overdue' });
        transaction.status = 'Overdue';
      }
    }

    res.json({
      success: true,
      data: {
        libraryCard: student.libraryCard,
        currentlyBorrowed,
        borrowHistory,
        reservations,
        unpaidFines: unpaidFines[0]?.total || 0,
        borrowLimit: MAX_BOOKS_PER_STUDENT,
        booksRemaining: MAX_BOOKS_PER_STUDENT - currentlyBorrowed.length
      }
    });
  } catch (error) {
    console.error('Get library account error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch account' });
  }
});

// ==================== LIBRARY STATISTICS ====================

// GET /api/library/stats - Get library statistics
router.get('/stats', authenticateToken, requireStaff, async (req, res) => {
  try {
    const [
      totalBooks,
      totalCopies,
      availableCopies,
      activeTransactions,
      overdueBooks,
      categoryStats,
      monthlyStats,
      popularBooks
    ] = await Promise.all([
      LibraryBook.countDocuments(),
      LibraryBook.aggregate([{ $group: { _id: null, total: { $sum: '$totalCopies' } } }]),
      LibraryBook.aggregate([{ $group: { _id: null, total: { $sum: '$availableCopies' } } }]),
      LibraryTransaction.countDocuments({ status: 'Issued' }),
      LibraryTransaction.countDocuments({ status: 'Overdue' }),
      LibraryBook.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 }, copies: { $sum: '$totalCopies' } } },
        { $sort: { count: -1 } }
      ]),
      LibraryTransaction.aggregate([
        {
          $match: {
            issueDate: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$issueDate' } },
            issues: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      LibraryTransaction.aggregate([
        { $group: { _id: '$book', borrowCount: { $sum: 1 } } },
        { $sort: { borrowCount: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'librarybooks',
            localField: '_id',
            foreignField: '_id',
            as: 'bookInfo'
          }
        },
        { $unwind: '$bookInfo' },
        {
          $project: {
            title: '$bookInfo.title',
            author: '$bookInfo.author',
            borrowCount: 1
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalBooks,
          totalCopies: totalCopies[0]?.total || 0,
          availableCopies: availableCopies[0]?.total || 0,
          activeTransactions,
          overdueBooks
        },
        categoryStats,
        monthlyStats,
        popularBooks
      }
    });
  } catch (error) {
    console.error('Get library stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
});

module.exports = router;
