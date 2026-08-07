const express = require('express');
const chatbotService = require('../services/chatbot/chatbotService');
const { authenticateToken, auditLog } = require('../middleware/auth');

const router = express.Router();

// Start new conversation
router.post('/start', async (req, res) => {
  try {
    const { userId, userType } = req.body;
    
    const result = await chatbotService.startConversation(userId, userType);
    
    if (result.success) {
      res.json({
        success: true,
        sessionId: result.sessionId,
        message: result.message,
        quickReplies: result.quickReplies
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error starting chatbot conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start conversation'
    });
  }
});

// Send message
router.post('/message', async (req, res) => {
  try {
    const { sessionId, message, userId } = req.body;
    
    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and message are required'
      });
    }
    
    const result = await chatbotService.processMessage(sessionId, message, userId);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        quickReplies: result.quickReplies || [],
        buttons: result.buttons || [],
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error processing chatbot message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process message'
    });
  }
});

// Get conversation history
router.get('/conversation/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const result = await chatbotService.getConversationHistory(sessionId);
    
    if (result.success) {
      res.json({
        success: true,
        messages: result.messages,
        context: result.context
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error getting conversation history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get conversation history'
    });
  }
});

// End conversation
router.post('/end', async (req, res) => {
  try {
    const { sessionId, rating, feedback } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }
    
    const result = await chatbotService.endConversation(sessionId, rating, feedback);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Conversation ended successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error ending chatbot conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end conversation'
    });
  }
});

// Get all FAQs (public endpoint)
router.get('/faqs', async (req, res) => {
  try {
    const { ChatbotFAQ } = require('../../database/models');
    const { category, limit = 20, page = 1 } = req.query;
    
    const filter = { isActive: true };
    if (category) {
      filter.category = category;
    }
    
    const faqs = await ChatbotFAQ.find(filter)
      .select('question answer category')
      .sort({ popularity: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await ChatbotFAQ.countDocuments(filter);
    
    res.json({
      success: true,
      faqs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error getting FAQs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get FAQs'
    });
  }
});

// Search FAQs
router.get('/faqs/search/:query', async (req, res) => {
  try {
    const { ChatbotFAQ } = require('../../database/models');
    const { query } = req.params;
    const { category, limit = 10 } = req.query;
    
    const searchFilter = {
      isActive: true,
      $or: [
        { question: { $regex: query, $options: 'i' } },
        { answer: { $regex: query, $options: 'i' } },
        { keywords: { $in: [new RegExp(query, 'i')] } }
      ]
    };
    
    if (category) {
      searchFilter.category = category;
    }
    
    const faqs = await ChatbotFAQ.find(searchFilter)
      .select('question answer category keywords')
      .sort({ popularity: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      faqs,
      query,
      count: faqs.length
    });
  } catch (error) {
    console.error('Error searching FAQs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search FAQs'
    });
  }
});

// Admin: Add new FAQ
router.post('/admin/faqs', authenticateToken, auditLog, async (req, res) => {
  try {
    // Check if user is admin or staff
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const { ChatbotFAQ } = require('../../database/models');
    const { question, answer, category, keywords, alternatives } = req.body;
    
    if (!question || !answer || !category) {
      return res.status(400).json({
        success: false,
        message: 'Question, answer, and category are required'
      });
    }
    
    const faq = new ChatbotFAQ({
      question,
      answer,
      category,
      keywords: keywords || [],
      alternatives: alternatives || [],
      createdBy: req.user.id
    });
    
    await faq.save();
    
    res.status(201).json({
      success: true,
      message: 'FAQ added successfully',
      faq
    });
  } catch (error) {
    console.error('Error adding FAQ:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add FAQ'
    });
  }
});

// Admin: Update FAQ
router.put('/admin/faqs/:id', authenticateToken, auditLog, async (req, res) => {
  try {
    // Check if user is admin or staff
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const { ChatbotFAQ } = require('../../database/models');
    const { id } = req.params;
    const { question, answer, category, keywords, alternatives, isActive } = req.body;
    
    const faq = await ChatbotFAQ.findById(id);
    
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }
    
    // Update fields
    if (question) faq.question = question;
    if (answer) faq.answer = answer;
    if (category) faq.category = category;
    if (keywords) faq.keywords = keywords;
    if (alternatives) faq.alternatives = alternatives;
    if (typeof isActive !== 'undefined') faq.isActive = isActive;
    
    faq.updatedAt = new Date();
    
    await faq.save();
    
    res.json({
      success: true,
      message: 'FAQ updated successfully',
      faq
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update FAQ'
    });
  }
});

// Admin: Delete FAQ
router.delete('/admin/faqs/:id', authenticateToken, auditLog, async (req, res) => {
  try {
    // Check if user is admin or staff
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const { ChatbotFAQ } = require('../../database/models');
    const { id } = req.params;
    
    const faq = await ChatbotFAQ.findById(id);
    
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }
    
    await ChatbotFAQ.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'FAQ deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete FAQ'
    });
  }
});

// Admin: Get conversation analytics
router.get('/admin/analytics', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin or staff
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const { ChatbotConversation, ChatbotFAQ } = require('../../database/models');
    const { dateFrom, dateTo } = req.query;
    
    const dateFilter = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.$lte = new Date(dateTo);
    
    const conversationFilter = Object.keys(dateFilter).length > 0 ? { startTime: dateFilter } : {};
    
    // Get conversation statistics
    const totalConversations = await ChatbotConversation.countDocuments(conversationFilter);
    const activeConversations = await ChatbotConversation.countDocuments({ 
      ...conversationFilter, 
      isActive: true 
    });
    
    // Get average conversation duration
    const conversationsWithDuration = await ChatbotConversation.aggregate([
      { $match: { ...conversationFilter, endTime: { $exists: true } } },
      { 
        $project: { 
          duration: { $subtract: ['$endTime', '$startTime'] } 
        } 
      },
      { 
        $group: { 
          _id: null, 
          avgDuration: { $avg: '$duration' } 
        } 
      }
    ]);
    
    // Get most popular FAQs
    const popularFAQs = await ChatbotFAQ.find({ isActive: true })
      .select('question category popularity')
      .sort({ popularity: -1 })
      .limit(10);
    
    // Get conversation ratings
    const ratings = await ChatbotConversation.aggregate([
      { $match: { ...conversationFilter, 'rating.score': { $exists: true } } },
      { 
        $group: { 
          _id: null, 
          avgRating: { $avg: '$rating.score' },
          totalRatings: { $sum: 1 }
        } 
      }
    ]);
    
    // Get conversations by user type
    const userTypeStats = await ChatbotConversation.aggregate([
      { $match: conversationFilter },
      { $group: { _id: '$userType', count: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      analytics: {
        totalConversations,
        activeConversations,
        averageDuration: conversationsWithDuration[0]?.avgDuration || 0,
        averageRating: ratings[0]?.avgRating || 0,
        totalRatings: ratings[0]?.totalRatings || 0,
        popularFAQs,
        userTypeStats
      }
    });
  } catch (error) {
    console.error('Error getting chatbot analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics'
    });
  }
});

// Admin: Get all conversations
router.get('/admin/conversations', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin or staff
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const { ChatbotConversation } = require('../../database/models');
    const { page = 1, limit = 20, userType, isActive } = req.query;
    
    const filter = {};
    if (userType) filter.userType = userType;
    if (typeof isActive !== 'undefined') filter.isActive = isActive === 'true';
    
    const conversations = await ChatbotConversation.find(filter)
      .populate('userId', 'name email')
      .select('sessionId userType isActive startTime endTime rating messages')
      .sort({ startTime: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await ChatbotConversation.countDocuments(filter);
    
    res.json({
      success: true,
      conversations: conversations.map(conv => ({
        sessionId: conv.sessionId,
        user: conv.userId,
        userType: conv.userType,
        isActive: conv.isActive,
        startTime: conv.startTime,
        endTime: conv.endTime,
        messageCount: conv.messages.length,
        rating: conv.rating
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get conversations'
    });
  }
});

module.exports = router;