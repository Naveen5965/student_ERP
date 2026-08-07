const { ChatbotConversation, ChatbotIntent, ChatbotFAQ, Student, User, FeePayment, AdmissionForm, LibraryBook, HostelRoom } = require('../../../database/models');
const { v4: uuidv4 } = require('uuid');

class ChatbotService {
  constructor() {
    this.defaultIntents = this.getDefaultIntents();
    this.defaultFAQs = this.getDefaultFAQs();
    this.initializeDefaultData();
  }

  // Initialize default intents and FAQs
  async initializeDefaultData() {
    try {
      // Check if intents exist
      const intentCount = await ChatbotIntent.countDocuments();
      if (intentCount === 0) {
        await ChatbotIntent.insertMany(this.defaultIntents);
        console.log('Default chatbot intents initialized');
      }

      // Check if FAQs exist
      const faqCount = await ChatbotFAQ.countDocuments();
      if (faqCount === 0) {
        await ChatbotFAQ.insertMany(this.defaultFAQs);
        console.log('Default chatbot FAQs initialized');
      }
    } catch (error) {
      console.error('Error initializing chatbot data:', error);
    }
  }

  // Start new conversation
  async startConversation(userId = null, userType = 'guest') {
    try {
      const sessionId = uuidv4();
      
      const conversation = new ChatbotConversation({
        sessionId,
        userId,
        userType,
        messages: [{
          id: uuidv4(),
          sender: 'bot',
          message: this.getWelcomeMessage(userType),
          intent: 'welcome',
          confidence: 1.0
        }],
        context: {
          currentIntent: 'welcome',
          entities: {},
          sessionVariables: {},
          userPreferences: {}
        }
      });

      await conversation.save();

      return {
        success: true,
        sessionId,
        message: conversation.messages[0].message,
        quickReplies: this.getWelcomeQuickReplies()
      };
    } catch (error) {
      console.error('Error starting conversation:', error);
      return {
        success: false,
        error: 'Failed to start conversation'
      };
    }
  }

  // Process user message
  async processMessage(sessionId, userMessage, userId = null) {
    try {
      const conversation = await ChatbotConversation.findOne({ sessionId, isActive: true });
      
      if (!conversation) {
        return {
          success: false,
          error: 'Conversation not found'
        };
      }

      // Add user message to conversation
      const userMessageObj = {
        id: uuidv4(),
        sender: 'user',
        message: userMessage,
        timestamp: new Date()
      };
      
      conversation.messages.push(userMessageObj);

      // Process intent recognition
      const intentResult = await this.recognizeIntent(userMessage);
      
      // Generate bot response
      const botResponse = await this.generateResponse(intentResult, conversation, userId);
      
      // Add bot message to conversation
      const botMessageObj = {
        id: uuidv4(),
        sender: 'bot',
        message: botResponse.message,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        timestamp: new Date()
      };
      
      conversation.messages.push(botMessageObj);

      // Update conversation context
      conversation.context.currentIntent = intentResult.intent;
      conversation.context.entities = { ...conversation.context.entities, ...intentResult.entities };

      await conversation.save();

      return {
        success: true,
        message: botResponse.message,
        quickReplies: botResponse.quickReplies || [],
        buttons: botResponse.buttons || [],
        data: botResponse.data
      };
    } catch (error) {
      console.error('Error processing message:', error);
      return {
        success: false,
        error: 'Failed to process message'
      };
    }
  }

  // Recognize intent from user message
  async recognizeIntent(message) {
    try {
      const normalizedMessage = message.toLowerCase().trim();
      
      // Check for exact FAQ matches first
      const faq = await this.findBestFAQMatch(normalizedMessage);
      if (faq) {
        return {
          intent: 'faq',
          confidence: 0.9,
          entities: { faqId: faq._id },
          data: faq
        };
      }

      // Check for intent patterns
      const intent = await this.findBestIntentMatch(normalizedMessage);
      if (intent) {
        return {
          intent: intent.name,
          confidence: intent.confidence,
          entities: intent.entities,
          data: intent
        };
      }

      // Default fallback
      return {
        intent: 'default_fallback',
        confidence: 0.1,
        entities: {},
        data: null
      };
    } catch (error) {
      console.error('Error recognizing intent:', error);
      return {
        intent: 'error',
        confidence: 0.0,
        entities: {},
        data: null
      };
    }
  }

  // Find best FAQ match
  async findBestFAQMatch(message) {
    try {
      const faqs = await ChatbotFAQ.find({ isActive: true });
      
      let bestMatch = null;
      let bestScore = 0;

      for (const faq of faqs) {
        // Check direct question match
        const questionScore = this.calculateSimilarity(message, faq.question.toLowerCase());
        
        // Check keywords match
        const keywordScore = this.calculateKeywordMatch(message, faq.keywords);
        
        // Check alternatives match
        const alternativeScore = Math.max(...faq.alternatives.map(alt => 
          this.calculateSimilarity(message, alt.toLowerCase())
        ));

        const totalScore = Math.max(questionScore, keywordScore, alternativeScore);
        
        if (totalScore > bestScore && totalScore > 0.6) {
          bestScore = totalScore;
          bestMatch = faq;
        }
      }

      if (bestMatch) {
        // Update popularity
        bestMatch.popularity += 1;
        bestMatch.lastAsked = new Date();
        await bestMatch.save();
      }

      return bestMatch;
    } catch (error) {
      console.error('Error finding FAQ match:', error);
      return null;
    }
  }

  // Find best intent match
  async findBestIntentMatch(message) {
    try {
      const intents = await ChatbotIntent.find({ isActive: true });
      
      let bestMatch = null;
      let bestScore = 0;

      for (const intent of intents) {
        for (const phrase of intent.trainingPhrases) {
          const score = this.calculateSimilarity(message, phrase.text.toLowerCase());
          
          if (score > bestScore && score > 0.7) {
            bestScore = score;
            bestMatch = {
              ...intent.toObject(),
              confidence: score,
              entities: this.extractEntities(message, phrase.entities)
            };
          }
        }
      }

      return bestMatch;
    } catch (error) {
      console.error('Error finding intent match:', error);
      return null;
    }
  }

  // Generate bot response
  async generateResponse(intentResult, conversation, userId) {
    try {
      switch (intentResult.intent) {
        case 'faq':
          return await this.handleFAQResponse(intentResult.data);
        
        case 'admission_info':
          return await this.handleAdmissionInfo(userId);
        
        case 'fee_inquiry':
          return await this.handleFeeInquiry(userId);
        
        case 'hostel_info':
          return await this.handleHostelInfo(userId);
        
        case 'library_info':
          return await this.handleLibraryInfo(userId);
        
        case 'student_profile':
          return await this.handleStudentProfile(userId);
        
        case 'contact_support':
          return await this.handleContactSupport();
        
        case 'default_fallback':
          return await this.handleFallback();
        
        default:
          return await this.handleGenericIntent(intentResult);
      }
    } catch (error) {
      console.error('Error generating response:', error);
      return {
        message: "I'm sorry, I encountered an error. Please try again or contact support.",
        quickReplies: ['Contact Support', 'Try Again']
      };
    }
  }

  // Handle FAQ response
  async handleFAQResponse(faq) {
    const relatedQuestions = await ChatbotFAQ.find({
      _id: { $in: faq.relatedQuestions },
      isActive: true
    }).limit(3);

    return {
      message: faq.answer,
      quickReplies: relatedQuestions.map(q => q.question),
      buttons: [{
        title: 'More FAQs',
        payload: 'view_all_faqs'
      }]
    };
  }

  // Handle admission information
  async handleAdmissionInfo(userId) {
    try {
      if (userId) {
        const admissionForm = await AdmissionForm.findOne({ 
          'personalInfo.email': { $exists: true } 
        }).populate('program');
        
        if (admissionForm) {
          return {
            message: `Your admission application (${admissionForm.formId}) is currently ${admissionForm.status}. ${this.getStatusMessage(admissionForm.status)}`,
            quickReplies: ['Check Documents', 'Interview Info', 'Contact Admissions'],
            data: {
              formId: admissionForm.formId,
              status: admissionForm.status,
              program: admissionForm.program?.name
            }
          };
        }
      }

      return {
        message: "Here's information about our admission process:\n\n• Online application submission\n• Document verification\n• Merit-based selection\n• Interview (if required)\n• Final admission confirmation\n\nWould you like details about any specific step?",
        quickReplies: ['Application Process', 'Required Documents', 'Admission Dates', 'Fee Structure']
      };
    } catch (error) {
      console.error('Error handling admission info:', error);
      return {
        message: "I can help you with admission information. Please specify what you'd like to know about.",
        quickReplies: ['Application Process', 'Required Documents', 'Admission Dates']
      };
    }
  }

  // Handle fee inquiry
  async handleFeeInquiry(userId) {
    try {
      if (userId) {
        const user = await User.findById(userId).populate('student');
        
        if (user && user.student) {
          const feePayments = await FeePayment.find({
            student: user.student._id
          }).populate('feeStructure').sort({ paymentDate: -1 }).limit(5);

          const pendingFees = feePayments.filter(payment => payment.status === 'Pending');
          
          let message = "Here's your fee information:\n\n";
          
          if (pendingFees.length > 0) {
            message += `💰 Pending Fees: ₹${pendingFees.reduce((sum, fee) => sum + fee.amountPaid, 0)}\n`;
          }
          
          message += `📊 Last Payment: ₹${feePayments[0]?.amountPaid || 0} on ${feePayments[0]?.paymentDate?.toLocaleDateString() || 'N/A'}\n`;
          message += `📈 Total Paid: ₹${feePayments.filter(p => p.status === 'Completed').reduce((sum, fee) => sum + fee.amountPaid, 0)}`;

          return {
            message,
            quickReplies: ['Pay Fees', 'Fee Receipt', 'Fee Structure', 'Payment History'],
            data: {
              pendingAmount: pendingFees.reduce((sum, fee) => sum + fee.amountPaid, 0),
              lastPayment: feePayments[0]
            }
          };
        }
      }

      return {
        message: "I can help you with fee-related queries. Here's what I can assist with:\n\n• Fee structure information\n• Payment methods (UPI, Cards, Net Banking)\n• Fee receipts\n• Payment deadlines\n• Scholarship information",
        quickReplies: ['Fee Structure', 'Payment Methods', 'Scholarship Info']
      };
    } catch (error) {
      console.error('Error handling fee inquiry:', error);
      return {
        message: "I can help you with fee information. What would you like to know?",
        quickReplies: ['Fee Structure', 'Payment Methods', 'Scholarship Info']
      };
    }
  }

  // Handle hostel information
  async handleHostelInfo(userId) {
    try {
      if (userId) {
        const user = await User.findById(userId).populate('student');
        
        if (user && user.student && user.student.hostelRoom) {
          const hostelRoom = await HostelRoom.findById(user.student.hostelRoom).populate('hostel');
          
          return {
            message: `🏠 Your Hostel Information:\n\n• Hostel: ${hostelRoom.hostel.name}\n• Room: ${hostelRoom.roomNumber}\n• Floor: ${hostelRoom.floor}\n• Type: ${hostelRoom.roomType}\n• Monthly Rent: ₹${hostelRoom.monthlyRent}`,
            quickReplies: ['Room Details', 'Hostel Facilities', 'Maintenance Request', 'Room Change']
          };
        }
      }

      return {
        message: "Here's information about our hostel facilities:\n\n🏠 Separate hostels for boys and girls\n🛏️ Single, double, and triple occupancy rooms\n🍽️ Mess facilities with nutritious meals\n🔒 24/7 security\n📶 Wi-Fi connectivity\n🏃‍♀️ Recreation facilities",
        quickReplies: ['Room Booking', 'Hostel Fees', 'Facilities', 'Rules & Regulations']
      };
    } catch (error) {
      console.error('Error handling hostel info:', error);
      return {
        message: "I can help you with hostel information. What would you like to know?",
        quickReplies: ['Room Booking', 'Hostel Fees', 'Facilities']
      };
    }
  }

  // Handle library information
  async handleLibraryInfo(userId) {
    try {
      const totalBooks = await LibraryBook.countDocuments();
      const availableBooks = await LibraryBook.aggregate([
        { $group: { _id: null, total: { $sum: '$availableCopies' } } }
      ]);

      let message = `📚 Library Information:\n\n• Total Books: ${totalBooks}\n• Available Books: ${availableBooks[0]?.total || 0}\n• Digital Resources Available\n• Study Rooms & Reading Areas\n• Research Assistance`;

      if (userId) {
        // Get user's borrowed books
        const { BookTransaction } = require('../../../database/models');
        const user = await User.findById(userId).populate('student');
        
        if (user && user.student) {
          const borrowedBooks = await BookTransaction.find({
            student: user.student._id,
            status: 'Issued'
          }).populate('book').limit(5);

          if (borrowedBooks.length > 0) {
            message += `\n\n📖 Your Borrowed Books (${borrowedBooks.length}):\n`;
            borrowedBooks.forEach(transaction => {
              message += `• ${transaction.book.title} (Due: ${transaction.dueDate.toLocaleDateString()})\n`;
            });
          }
        }
      }

      return {
        message,
        quickReplies: ['Search Books', 'My Books', 'Library Rules', 'Renew Books', 'Pay Fine']
      };
    } catch (error) {
      console.error('Error handling library info:', error);
      return {
        message: "I can help you with library services. What would you like to know?",
        quickReplies: ['Search Books', 'Library Rules', 'Opening Hours']
      };
    }
  }

  // Handle student profile
  async handleStudentProfile(userId) {
    try {
      if (!userId) {
        return {
          message: "Please log in to view your profile information.",
          quickReplies: ['Login', 'Register', 'Forgot Password']
        };
      }

      const user = await User.findById(userId).populate('student');
      
      if (!user || !user.student) {
        return {
          message: "I couldn't find your student profile. Please contact support if this is an error.",
          quickReplies: ['Contact Support', 'Register as Student']
        };
      }

      const student = user.student;
      const message = `👤 Your Profile:\n\n• Name: ${student.firstName} ${student.lastName}\n• Registration: ${student.registrationNumber}\n• Program: ${student.program}\n• Batch: ${student.batch}\n• Email: ${student.email}\n• Phone: ${student.phone}`;

      return {
        message,
        quickReplies: ['Update Profile', 'Academic Records', 'Download ID Card', 'Change Password']
      };
    } catch (error) {
      console.error('Error handling student profile:', error);
      return {
        message: "I can help you with profile information. Please try again or contact support.",
        quickReplies: ['Contact Support', 'Try Again']
      };
    }
  }

  // Handle contact support
  async handleContactSupport() {
    return {
      message: "📞 Contact Support:\n\n• Email: support@studenterp.edu\n• Phone: +91-XXXX-XXXXXX\n• Office Hours: 9 AM - 6 PM (Mon-Fri)\n• Emergency: +91-XXXX-XXXXXX (24/7)\n\nYou can also submit a support ticket through the portal.",
      quickReplies: ['Submit Ticket', 'FAQ', 'Email Support'],
      buttons: [{
        title: 'Call Support',
        payload: 'call_support'
      }, {
        title: 'Email Support',
        payload: 'email_support'
      }]
    };
  }

  // Handle fallback
  async handleFallback() {
    const suggestions = [
      'Admission Information',
      'Fee Inquiry',
      'Hostel Information',
      'Library Services',
      'Contact Support'
    ];

    return {
      message: "I'm not sure I understood that. Here are some things I can help you with:",
      quickReplies: suggestions
    };
  }

  // Handle generic intent
  async handleGenericIntent(intentResult) {
    if (intentResult.data && intentResult.data.responses && intentResult.data.responses.length > 0) {
      const response = intentResult.data.responses[0];
      return {
        message: response.text,
        quickReplies: response.quickReplies || [],
        buttons: response.buttons || []
      };
    }

    return {
      message: "I can help you with various queries about the student portal.",
      quickReplies: ['Admission', 'Fees', 'Hostel', 'Library', 'Support']
    };
  }

  // End conversation
  async endConversation(sessionId, rating = null, feedback = null) {
    try {
      const conversation = await ChatbotConversation.findOne({ sessionId });
      
      if (conversation) {
        conversation.isActive = false;
        conversation.endTime = new Date();
        
        if (rating) {
          conversation.rating = {
            score: rating,
            feedback: feedback,
            ratedAt: new Date()
          };
        }

        await conversation.save();
      }

      return { success: true };
    } catch (error) {
      console.error('Error ending conversation:', error);
      return { success: false, error: 'Failed to end conversation' };
    }
  }

  // Get conversation history
  async getConversationHistory(sessionId) {
    try {
      const conversation = await ChatbotConversation.findOne({ sessionId });
      
      if (!conversation) {
        return { success: false, error: 'Conversation not found' };
      }

      return {
        success: true,
        messages: conversation.messages,
        context: conversation.context
      };
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return { success: false, error: 'Failed to get conversation history' };
    }
  }

  // Utility methods
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  calculateKeywordMatch(message, keywords) {
    if (!keywords || keywords.length === 0) return 0;
    
    const messageWords = message.toLowerCase().split(/\s+/);
    const matchedKeywords = keywords.filter(keyword => 
      messageWords.some(word => word.includes(keyword.toLowerCase()))
    );
    
    return matchedKeywords.length / keywords.length;
  }

  extractEntities(message, entityDefs) {
    const entities = {};
    
    if (entityDefs && entityDefs.length > 0) {
      entityDefs.forEach(entityDef => {
        const value = message.substring(entityDef.start, entityDef.end);
        entities[entityDef.entity] = value;
      });
    }
    
    return entities;
  }

  getWelcomeMessage(userType) {
    switch (userType) {
      case 'student':
        return "👋 Welcome back! I'm here to help you with admission, fees, hostel, library, and other student services. How can I assist you today?";
      case 'staff':
        return "👋 Hello! I'm the student portal assistant. I can help you with student information, system queries, and administrative tasks. What do you need help with?";
      default:
        return "👋 Welcome to the Student ERP System! I'm your virtual assistant. I can help you with admission information, fee inquiries, hostel details, library services, and more. How can I help you today?";
    }
  }

  getWelcomeQuickReplies() {
    return [
      'Admission Information',
      'Fee Inquiry',
      'Hostel Information',
      'Library Services',
      'Contact Support'
    ];
  }

  getStatusMessage(status) {
    const messages = {
      'Pending': 'We will review your application soon.',
      'Under Review': 'Your application is being reviewed by our admission team.',
      'Approved': 'Congratulations! Your application has been approved.',
      'Rejected': 'Unfortunately, your application was not successful this time.',
      'Waitlisted': 'You are on our waitlist. We will notify you if a spot becomes available.'
    };
    
    return messages[status] || 'Please contact admissions for more information.';
  }

  // Default intents and FAQs data
  getDefaultIntents() {
    return [
      {
        name: 'admission_info',
        displayName: 'Admission Information',
        category: 'admission',
        description: 'Provides information about admission process',
        trainingPhrases: [
          { text: 'I want to know about admission process' },
          { text: 'How to apply for admission' },
          { text: 'Admission requirements' },
          { text: 'When is the admission deadline' },
          { text: 'Tell me about admission' }
        ],
        responses: [{
          text: 'I can help you with admission information. What specifically would you like to know?',
          quickReplies: ['Application Process', 'Required Documents', 'Admission Dates', 'Fee Structure']
        }]
      },
      {
        name: 'fee_inquiry',
        displayName: 'Fee Inquiry',
        category: 'fees',
        description: 'Handles fee-related queries',
        trainingPhrases: [
          { text: 'What are the fees' },
          { text: 'Fee structure' },
          { text: 'How much does it cost' },
          { text: 'Payment methods' },
          { text: 'Fee payment' }
        ],
        responses: [{
          text: 'I can help you with fee information. What would you like to know?',
          quickReplies: ['Fee Structure', 'Payment Methods', 'Scholarship Info']
        }]
      },
      {
        name: 'hostel_info',
        displayName: 'Hostel Information',
        category: 'hostel',
        description: 'Provides hostel-related information',
        trainingPhrases: [
          { text: 'Tell me about hostel' },
          { text: 'Hostel facilities' },
          { text: 'Room booking' },
          { text: 'Hostel fees' },
          { text: 'Accommodation' }
        ],
        responses: [{
          text: 'I can provide information about our hostel facilities. What would you like to know?',
          quickReplies: ['Room Booking', 'Hostel Fees', 'Facilities', 'Rules & Regulations']
        }]
      },
      {
        name: 'library_info',
        displayName: 'Library Information',
        category: 'library',
        description: 'Provides library-related information',
        trainingPhrases: [
          { text: 'Library information' },
          { text: 'Book search' },
          { text: 'Library timings' },
          { text: 'Borrow books' },
          { text: 'Library services' }
        ],
        responses: [{
          text: 'I can help you with library services. What do you need assistance with?',
          quickReplies: ['Search Books', 'Library Rules', 'Opening Hours', 'My Books']
        }]
      },
      {
        name: 'contact_support',
        displayName: 'Contact Support',
        category: 'support',
        description: 'Provides contact information for support',
        trainingPhrases: [
          { text: 'Contact support' },
          { text: 'Help me' },
          { text: 'Talk to human' },
          { text: 'Customer service' },
          { text: 'Support number' }
        ],
        responses: [{
          text: 'Here are the ways to contact our support team.',
          quickReplies: ['Submit Ticket', 'FAQ', 'Email Support']
        }]
      }
    ];
  }

  getDefaultFAQs() {
    return [
      {
        question: 'What documents are required for admission?',
        answer: 'For admission, you need:\n• 10th and 12th mark sheets\n• Transfer certificate\n• Character certificate\n• Passport size photographs\n• Aadhar card copy\n• Caste certificate (if applicable)',
        category: 'admission',
        keywords: ['documents', 'required', 'admission', 'certificates'],
        alternatives: [
          'Which documents do I need for admission?',
          'Admission document requirements',
          'What papers are needed for admission?'
        ]
      },
      {
        question: 'What are the payment methods available?',
        answer: 'We accept the following payment methods:\n• UPI (PhonePe, Google Pay, Paytm)\n• Debit/Credit Cards\n• Net Banking\n• Demand Draft\n• Cash (at office only)',
        category: 'fees',
        keywords: ['payment', 'methods', 'upi', 'card', 'banking'],
        alternatives: [
          'How can I pay fees?',
          'Fee payment options',
          'What payment methods do you accept?'
        ]
      },
      {
        question: 'What are the library timings?',
        answer: 'Library timings:\n• Monday to Friday: 8:00 AM - 8:00 PM\n• Saturday: 9:00 AM - 5:00 PM\n• Sunday: 10:00 AM - 4:00 PM\n• Closed on public holidays',
        category: 'library',
        keywords: ['library', 'timings', 'hours', 'schedule'],
        alternatives: [
          'When is the library open?',
          'Library opening hours',
          'Library schedule'
        ]
      },
      {
        question: 'How do I book a hostel room?',
        answer: 'To book a hostel room:\n1. Fill the hostel application form\n2. Submit required documents\n3. Pay the hostel fees\n4. Room allocation will be done based on availability\n5. You will receive confirmation via email',
        category: 'hostel',
        keywords: ['hostel', 'room', 'booking', 'allocation'],
        alternatives: [
          'Hostel room booking process',
          'How to get hostel accommodation?',
          'Room allocation procedure'
        ]
      },
      {
        question: 'What is the refund policy?',
        answer: 'Refund policy:\n• Admission fees: 80% refund if cancelled before semester starts\n• Hostel fees: 50% refund if vacated before month-end\n• Library fines: Non-refundable\n• Processing time: 15-30 working days',
        category: 'fees',
        keywords: ['refund', 'policy', 'cancellation', 'fees'],
        alternatives: [
          'Can I get refund?',
          'Refund rules',
          'Fee refund policy'
        ]
      }
    ];
  }
}

module.exports = new ChatbotService();