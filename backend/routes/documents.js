const express = require('express');
const path = require('path');
const documentStorage = require('../services/storage/documentStorage');
const { authenticateToken, requireStaff, auditLog } = require('../middleware/auth');

const router = express.Router();

// Configure multer for different document categories
const uploadMiddleware = {
  admissions: documentStorage.configureMulter('admissions').array('documents', 5),
  students: documentStorage.configureMulter('students').array('documents', 5),
  staff: documentStorage.configureMulter('staff').array('documents', 5),
  documents: documentStorage.configureMulter('documents').array('documents', 5),
  receipts: documentStorage.configureMulter('receipts').single('receipt'),
  certificates: documentStorage.configureMulter('certificates').array('certificates', 3)
};

// Upload documents
router.post('/upload/:category?', authenticateToken, auditLog, (req, res, next) => {
  const category = req.params.category || 'documents';
  const middleware = uploadMiddleware[category] || uploadMiddleware.documents;

  middleware(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds maximum limit'
        });
      }
      
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Too many files uploaded'
        });
      }

      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    try {
      const files = req.files || [req.file];
      const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      const results = await documentStorage.uploadMultipleFiles(
        files,
        req.user.id,
        category,
        metadata
      );

      const successfulUploads = results.filter(r => r.success);
      const failedUploads = results.filter(r => !r.success);

      res.json({
        success: true,
        message: `${successfulUploads.length} files uploaded successfully`,
        documents: successfulUploads.map(r => r.document),
        errors: failedUploads.map(r => r.error)
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Upload failed'
      });
    }
  });
});

// Get document by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await documentStorage.getFile(req.params.id, req.user.id);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      document: result.document
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve document'
    });
  }
});

// Download document
router.get('/download/:id', authenticateToken, async (req, res) => {
  try {
    const result = await documentStorage.downloadFile(req.params.id, req.user.id);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error
      });
    }

    // Update download count
    const Document = require('../../database/models').Document;
    await Document.findByIdAndUpdate(req.params.id, {
      $inc: { downloadCount: 1 },
      lastDownloaded: new Date()
    });

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Type', result.mimetype);
    res.setHeader('Content-Length', result.size);

    // Stream file to response
    res.sendFile(path.resolve(result.filePath));
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      message: 'Download failed'
    });
  }
});

// List documents with filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const filters = {
      category: req.query.category,
      userId: req.query.userId,
      tags: req.query.tags ? req.query.tags.split(',') : undefined,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await documentStorage.listDocuments(
      filters,
      req.user.id,
      req.user.role
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      documents: result.documents,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list documents'
    });
  }
});

// Search documents
router.get('/search/:term', authenticateToken, async (req, res) => {
  try {
    const searchTerm = req.params.term;
    const filters = {
      category: req.query.category,
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await documentStorage.searchDocuments(
      searchTerm,
      filters,
      req.user.id,
      req.user.role
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      documents: result.documents,
      pagination: result.pagination,
      searchTerm: result.searchTerm
    });
  } catch (error) {
    console.error('Search documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed'
    });
  }
});

// Update document metadata
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { tags, isPublic, metadata, category } = req.body;

    const result = await documentStorage.updateDocument(
      req.params.id,
      { tags, isPublic, metadata, category },
      req.user.id,
      req.user.role
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      message: 'Document updated successfully',
      document: result.document
    });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({
      success: false,
      message: 'Update failed'
    });
  }
});

// Delete document
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await documentStorage.deleteDocument(
      req.params.id,
      req.user.id,
      req.user.role
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Delete failed'
    });
  }
});

// Get documents by category
router.get('/category/:category', authenticateToken, async (req, res) => {
  try {
    const category = req.params.category;
    const filters = {
      category,
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await documentStorage.listDocuments(
      filters,
      req.user.id,
      req.user.role
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      category,
      documents: result.documents,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get category documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get category documents'
    });
  }
});

// Get user's documents
router.get('/user/my-documents', authenticateToken, async (req, res) => {
  try {
    const filters = {
      userId: req.user.id,
      category: req.query.category,
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await documentStorage.listDocuments(
      filters,
      req.user.id,
      req.user.role
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      documents: result.documents,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get user documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user documents'
    });
  }
});

// Get storage statistics (admin only)
router.get('/admin/stats', authenticateToken, requireStaff, async (req, res) => {
  try {
    const result = await documentStorage.getStorageStats();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      stats: result.stats
    });
  } catch (error) {
    console.error('Get storage stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get storage statistics'
    });
  }
});

// Verify document (staff only)
router.put('/:id/verify', authenticateToken, requireStaff, auditLog, async (req, res) => {
  try {
    const { verificationStatus, remarks } = req.body;

    if (!['verified', 'rejected'].includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification status'
      });
    }

    const result = await documentStorage.updateDocument(
      req.params.id,
      {
        metadata: {
          verificationStatus,
          verifiedBy: req.user.id,
          verificationDate: new Date(),
          verificationRemarks: remarks
        }
      },
      req.user.id,
      req.user.role
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      message: `Document ${verificationStatus} successfully`,
      document: result.document
    });
  } catch (error) {
    console.error('Document verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed'
    });
  }
});

// Cleanup temporary files (admin only)
router.post('/admin/cleanup', authenticateToken, requireStaff, auditLog, async (req, res) => {
  try {
    const result = await documentStorage.cleanupTempFiles();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      message: `Cleaned up ${result.cleanedCount} temporary files`
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      message: 'Cleanup failed'
    });
  }
});

module.exports = router;