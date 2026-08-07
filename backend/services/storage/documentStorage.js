const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

// Document Storage Service for ERP System
class DocumentStorageService {
  constructor() {
    this.storageBasePath = process.env.DOCUMENT_STORAGE_PATH || path.join(__dirname, '../../../storage');
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
    this.allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];

    this.initializeStorage();
  }

  // Initialize storage directories
  async initializeStorage() {
    try {
      const directories = [
        'admissions',
        'students',
        'staff',
        'documents',
        'receipts',
        'certificates',
        'temporary'
      ];

      await fs.mkdir(this.storageBasePath, { recursive: true });

      for (const dir of directories) {
        const dirPath = path.join(this.storageBasePath, dir);
        await fs.mkdir(dirPath, { recursive: true });
      }

      console.log('📁 Document storage initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize storage:', error);
    }
  }

  // Configure multer for file uploads
  configureMulter(category = 'documents') {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(this.storageBasePath, category);
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const randomId = crypto.randomBytes(8).toString('hex');
        const extension = path.extname(file.originalname);
        const filename = `${timestamp}_${randomId}${extension}`;
        cb(null, filename);
      }
    });

    const fileFilter = (req, file, cb) => {
      if (this.allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} not allowed`), false);
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: this.maxFileSize,
        files: 5 // Maximum 5 files per upload
      }
    });
  }

  // Save file metadata to database
  async saveFileMetadata(fileData, userId, category = 'documents') {
    const Document = require('../../../database/models').Document;

    const documentData = {
      originalName: fileData.originalname,
      filename: fileData.filename,
      path: fileData.path,
      size: fileData.size,
      mimetype: fileData.mimetype,
      category,
      uploadedBy: userId,
      uploadDate: new Date(),
      checksum: await this.calculateChecksum(fileData.path),
      isPublic: false,
      tags: [],
      metadata: {}
    };

    const document = new Document(documentData);
    await document.save();

    return document;
  }

  // Calculate file checksum for integrity
  async calculateChecksum(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      console.error('Checksum calculation failed:', error);
      return null;
    }
  }

  // Upload single file
  async uploadFile(file, userId, category = 'documents', metadata = {}) {
    try {
      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }

      if (!this.allowedTypes.includes(file.mimetype)) {
        throw new Error(`File type ${file.mimetype} not allowed`);
      }

      if (file.size > this.maxFileSize) {
        throw new Error(`File size exceeds limit of ${this.maxFileSize} bytes`);
      }

      // Save file metadata
      const document = await this.saveFileMetadata(file, userId, category);

      // Update metadata if provided
      if (Object.keys(metadata).length > 0) {
        document.metadata = { ...document.metadata, ...metadata };
        await document.save();
      }

      return {
        success: true,
        document: {
          id: document._id,
          originalName: document.originalName,
          filename: document.filename,
          size: document.size,
          category: document.category,
          uploadDate: document.uploadDate,
          downloadUrl: `/api/documents/download/${document._id}`
        }
      };
    } catch (error) {
      console.error('File upload failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Upload multiple files
  async uploadMultipleFiles(files, userId, category = 'documents', metadata = {}) {
    const results = [];

    for (const file of files) {
      const result = await this.uploadFile(file, userId, category, metadata);
      results.push(result);
    }

    return results;
  }

  // Get file by ID
  async getFile(documentId, userId = null) {
    try {
      const Document = require('../../../database/models').Document;
      const document = await Document.findById(documentId).populate('uploadedBy', 'name email');

      if (!document) {
        throw new Error('Document not found');
      }

      // Check access permissions
      if (!document.isPublic && userId !== document.uploadedBy._id.toString()) {
        // Check if user has admin privileges
        const User = require('../../../database/models').User;
        const user = await User.findById(userId);
        
        if (!user || !['admin', 'super_admin'].includes(user.role)) {
          throw new Error('Access denied');
        }
      }

      return {
        success: true,
        document: {
          id: document._id,
          originalName: document.originalName,
          filename: document.filename,
          path: document.path,
          size: document.size,
          mimetype: document.mimetype,
          category: document.category,
          uploadDate: document.uploadDate,
          uploadedBy: document.uploadedBy,
          tags: document.tags,
          metadata: document.metadata,
          checksum: document.checksum
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Download file
  async downloadFile(documentId, userId = null) {
    try {
      const result = await this.getFile(documentId, userId);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      const document = result.document;
      const filePath = document.path;

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new Error('File not found on disk');
      }

      return {
        success: true,
        filePath: filePath,
        filename: document.originalName,
        mimetype: document.mimetype,
        size: document.size
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // List documents with filters
  async listDocuments(filters = {}, userId = null, userRole = null) {
    try {
      const Document = require('../../../database/models').Document;
      
      let query = {};

      // Apply filters
      if (filters.category) {
        query.category = filters.category;
      }

      if (filters.userId) {
        query.uploadedBy = filters.userId;
      }

      if (filters.tags && filters.tags.length > 0) {
        query.tags = { $in: filters.tags };
      }

      if (filters.dateFrom || filters.dateTo) {
        query.uploadDate = {};
        if (filters.dateFrom) {
          query.uploadDate.$gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          query.uploadDate.$lte = new Date(filters.dateTo);
        }
      }

      // Access control
      if (!['admin', 'super_admin'].includes(userRole)) {
        query.$or = [
          { isPublic: true },
          { uploadedBy: userId }
        ];
      }

      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 10;
      const skip = (page - 1) * limit;

      const documents = await Document.find(query)
        .populate('uploadedBy', 'name email role')
        .sort({ uploadDate: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Document.countDocuments(query);

      return {
        success: true,
        documents: documents.map(doc => ({
          id: doc._id,
          originalName: doc.originalName,
          filename: doc.filename,
          size: doc.size,
          mimetype: doc.mimetype,
          category: doc.category,
          uploadDate: doc.uploadDate,
          uploadedBy: doc.uploadedBy,
          tags: doc.tags,
          isPublic: doc.isPublic,
          downloadUrl: `/api/documents/download/${doc._id}`
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Update document metadata
  async updateDocument(documentId, updates, userId, userRole) {
    try {
      const Document = require('../../../database/models').Document;
      const document = await Document.findById(documentId);

      if (!document) {
        throw new Error('Document not found');
      }

      // Check permissions
      if (document.uploadedBy.toString() !== userId && !['admin', 'super_admin'].includes(userRole)) {
        throw new Error('Access denied');
      }

      // Update allowed fields
      const allowedUpdates = ['tags', 'isPublic', 'metadata', 'category'];
      const updateData = {};

      for (const field of allowedUpdates) {
        if (updates[field] !== undefined) {
          updateData[field] = updates[field];
        }
      }

      updateData.lastModified = new Date();

      const updatedDocument = await Document.findByIdAndUpdate(
        documentId,
        updateData,
        { new: true }
      ).populate('uploadedBy', 'name email');

      return {
        success: true,
        document: {
          id: updatedDocument._id,
          originalName: updatedDocument.originalName,
          tags: updatedDocument.tags,
          isPublic: updatedDocument.isPublic,
          metadata: updatedDocument.metadata,
          category: updatedDocument.category,
          lastModified: updatedDocument.lastModified
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Delete document
  async deleteDocument(documentId, userId, userRole) {
    try {
      const Document = require('../../../database/models').Document;
      const document = await Document.findById(documentId);

      if (!document) {
        throw new Error('Document not found');
      }

      // Check permissions
      if (document.uploadedBy.toString() !== userId && !['admin', 'super_admin'].includes(userRole)) {
        throw new Error('Access denied');
      }

      // Delete file from disk
      try {
        await fs.unlink(document.path);
      } catch (error) {
        console.warn('File deletion from disk failed:', error.message);
      }

      // Delete from database
      await Document.findByIdAndDelete(documentId);

      return {
        success: true,
        message: 'Document deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Search documents
  async searchDocuments(searchTerm, filters = {}, userId = null, userRole = null) {
    try {
      const Document = require('../../../database/models').Document;
      
      let query = {
        $or: [
          { originalName: { $regex: searchTerm, $options: 'i' } },
          { tags: { $regex: searchTerm, $options: 'i' } },
          { 'metadata.description': { $regex: searchTerm, $options: 'i' } }
        ]
      };

      // Apply additional filters
      if (filters.category) {
        query.category = filters.category;
      }

      // Access control
      if (!['admin', 'super_admin'].includes(userRole)) {
        query.$and = [
          query,
          {
            $or: [
              { isPublic: true },
              { uploadedBy: userId }
            ]
          }
        ];
      }

      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 10;
      const skip = (page - 1) * limit;

      const documents = await Document.find(query)
        .populate('uploadedBy', 'name email')
        .sort({ uploadDate: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Document.countDocuments(query);

      return {
        success: true,
        documents: documents.map(doc => ({
          id: doc._id,
          originalName: doc.originalName,
          size: doc.size,
          category: doc.category,
          uploadDate: doc.uploadDate,
          uploadedBy: doc.uploadedBy,
          tags: doc.tags,
          downloadUrl: `/api/documents/download/${doc._id}`
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        searchTerm
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get storage statistics
  async getStorageStats() {
    try {
      const Document = require('../../../database/models').Document;
      
      const stats = await Document.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalSize: { $sum: '$size' }
          }
        }
      ]);

      const totalStats = await Document.aggregate([
        {
          $group: {
            _id: null,
            totalFiles: { $sum: 1 },
            totalSize: { $sum: '$size' }
          }
        }
      ]);

      return {
        success: true,
        stats: {
          byCategory: stats,
          total: totalStats[0] || { totalFiles: 0, totalSize: 0 }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Clean up temporary files
  async cleanupTempFiles() {
    try {
      const tempDir = path.join(this.storageBasePath, 'temporary');
      const files = await fs.readdir(tempDir);
      
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < oneHourAgo) {
          await fs.unlink(filePath);
          cleanedCount++;
        }
      }

      console.log(`🧹 Cleaned up ${cleanedCount} temporary files`);
      return { success: true, cleanedCount };
    } catch (error) {
      console.error('Cleanup failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
module.exports = new DocumentStorageService();