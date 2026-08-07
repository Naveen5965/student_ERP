// Multi-language Support (i18n) for Padho Rajasthan ERP
// Supports Hindi, English, and Rajasthani

const translations = {
  en: {
    // Common
    app_name: 'Padho Rajasthan',
    tagline: 'Student ERP System',
    welcome: 'Welcome',
    logout: 'Logout',
    login: 'Login',
    register: 'Register',
    submit: 'Submit',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    view: 'View',
    search: 'Search',
    filter: 'Filter',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    info: 'Information',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    download: 'Download',
    upload: 'Upload',
    print: 'Print',
    
    // Navigation
    nav_dashboard: 'Dashboard',
    nav_students: 'Students',
    nav_fees: 'Fees',
    nav_exams: 'Examinations',
    nav_attendance: 'Attendance',
    nav_library: 'Library',
    nav_hostel: 'Hostel',
    nav_scholarships: 'Scholarships',
    nav_documents: 'Documents',
    nav_notifications: 'Notifications',
    nav_settings: 'Settings',
    nav_profile: 'Profile',
    nav_help: 'Help',
    
    // Dashboard
    dashboard_overview: 'Overview',
    dashboard_total_students: 'Total Students',
    dashboard_pending_fees: 'Pending Fees',
    dashboard_attendance_today: "Today's Attendance",
    dashboard_upcoming_exams: 'Upcoming Exams',
    dashboard_recent_activities: 'Recent Activities',
    
    // Student Module
    student_profile: 'Student Profile',
    student_id: 'Student ID',
    student_name: 'Name',
    student_email: 'Email',
    student_phone: 'Phone Number',
    student_dob: 'Date of Birth',
    student_gender: 'Gender',
    student_address: 'Address',
    student_program: 'Program',
    student_department: 'Department',
    student_batch: 'Batch',
    student_semester: 'Semester',
    student_enrollment_date: 'Enrollment Date',
    
    // Fees Module
    fees_structure: 'Fee Structure',
    fees_payment: 'Fee Payment',
    fees_history: 'Payment History',
    fees_pending: 'Pending Fees',
    fees_paid: 'Paid',
    fees_total: 'Total Fees',
    fees_due_date: 'Due Date',
    fees_pay_now: 'Pay Now',
    fees_receipt: 'Receipt',
    fees_tuition: 'Tuition Fee',
    fees_hostel: 'Hostel Fee',
    fees_library: 'Library Fee',
    fees_exam: 'Exam Fee',
    fees_other: 'Other Fees',
    
    // Exams Module
    exam_schedule: 'Exam Schedule',
    exam_hall_ticket: 'Hall Ticket',
    exam_results: 'Results',
    exam_grade_card: 'Grade Card',
    exam_name: 'Exam Name',
    exam_date: 'Date',
    exam_time: 'Time',
    exam_venue: 'Venue',
    exam_subject: 'Subject',
    exam_marks: 'Marks',
    exam_grade: 'Grade',
    exam_pass: 'Pass',
    exam_fail: 'Fail',
    
    // Attendance Module
    attendance_mark: 'Mark Attendance',
    attendance_view: 'View Attendance',
    attendance_report: 'Attendance Report',
    attendance_present: 'Present',
    attendance_absent: 'Absent',
    attendance_late: 'Late',
    attendance_leave: 'On Leave',
    attendance_percentage: 'Attendance Percentage',
    attendance_scan_qr: 'Scan QR Code',
    
    // Library Module
    library_search_books: 'Search Books',
    library_borrow: 'Borrow Book',
    library_return: 'Return Book',
    library_my_books: 'My Borrowed Books',
    library_due_date: 'Due Date',
    library_fine: 'Fine Amount',
    library_available: 'Available',
    library_unavailable: 'Not Available',
    
    // Hostel Module
    hostel_rooms: 'Rooms',
    hostel_allocation: 'Room Allocation',
    hostel_complaint: 'Complaint',
    hostel_fees: 'Hostel Fees',
    hostel_room_number: 'Room Number',
    hostel_block: 'Block',
    hostel_capacity: 'Capacity',
    hostel_occupied: 'Occupied',
    hostel_vacant: 'Vacant',
    
    // Scholarship Module
    scholarship_available: 'Available Scholarships',
    scholarship_apply: 'Apply',
    scholarship_status: 'Application Status',
    scholarship_approved: 'Approved',
    scholarship_pending: 'Pending',
    scholarship_rejected: 'Rejected',
    scholarship_amount: 'Scholarship Amount',
    scholarship_eligibility: 'Eligibility Criteria',
    
    // Notifications
    notification_all: 'All Notifications',
    notification_unread: 'Unread',
    notification_mark_read: 'Mark as Read',
    notification_clear: 'Clear All',
    
    // Authentication
    auth_email: 'Email Address',
    auth_password: 'Password',
    auth_confirm_password: 'Confirm Password',
    auth_forgot_password: 'Forgot Password?',
    auth_reset_password: 'Reset Password',
    auth_login_success: 'Login Successful',
    auth_logout_success: 'Logged Out Successfully',
    auth_invalid_credentials: 'Invalid Email or Password',
    
    // Messages
    msg_saved_successfully: 'Saved Successfully',
    msg_deleted_successfully: 'Deleted Successfully',
    msg_updated_successfully: 'Updated Successfully',
    msg_operation_failed: 'Operation Failed',
    msg_network_error: 'Network Error. Please try again.',
    msg_session_expired: 'Session Expired. Please login again.',
    msg_access_denied: 'Access Denied',
    msg_not_found: 'Not Found',
    msg_confirm_delete: 'Are you sure you want to delete?',
    
    // Date & Time
    date_today: 'Today',
    date_yesterday: 'Yesterday',
    date_tomorrow: 'Tomorrow',
    date_this_week: 'This Week',
    date_this_month: 'This Month',
    
    // Gender
    gender_male: 'Male',
    gender_female: 'Female',
    gender_other: 'Other'
  },
  
  hi: {
    // Common
    app_name: 'पढ़ो राजस्थान',
    tagline: 'विद्यार्थी ERP प्रणाली',
    welcome: 'स्वागत है',
    logout: 'लॉग आउट',
    login: 'लॉग इन',
    register: 'पंजीकरण',
    submit: 'जमा करें',
    cancel: 'रद्द करें',
    save: 'सहेजें',
    delete: 'हटाएं',
    edit: 'संपादित करें',
    view: 'देखें',
    search: 'खोजें',
    filter: 'फ़िल्टर',
    loading: 'लोड हो रहा है...',
    error: 'त्रुटि',
    success: 'सफल',
    warning: 'चेतावनी',
    info: 'जानकारी',
    yes: 'हाँ',
    no: 'नहीं',
    ok: 'ठीक है',
    close: 'बंद करें',
    back: 'वापस',
    next: 'अगला',
    previous: 'पिछला',
    download: 'डाउनलोड',
    upload: 'अपलोड',
    print: 'प्रिंट',
    
    // Navigation
    nav_dashboard: 'डैशबोर्ड',
    nav_students: 'विद्यार्थी',
    nav_fees: 'शुल्क',
    nav_exams: 'परीक्षाएं',
    nav_attendance: 'उपस्थिति',
    nav_library: 'पुस्तकालय',
    nav_hostel: 'छात्रावास',
    nav_scholarships: 'छात्रवृत्ति',
    nav_documents: 'दस्तावेज़',
    nav_notifications: 'सूचनाएं',
    nav_settings: 'सेटिंग्स',
    nav_profile: 'प्रोफाइल',
    nav_help: 'सहायता',
    
    // Dashboard
    dashboard_overview: 'अवलोकन',
    dashboard_total_students: 'कुल विद्यार्थी',
    dashboard_pending_fees: 'बकाया शुल्क',
    dashboard_attendance_today: 'आज की उपस्थिति',
    dashboard_upcoming_exams: 'आगामी परीक्षाएं',
    dashboard_recent_activities: 'हाल की गतिविधियां',
    
    // Student Module
    student_profile: 'विद्यार्थी प्रोफाइल',
    student_id: 'विद्यार्थी आईडी',
    student_name: 'नाम',
    student_email: 'ईमेल',
    student_phone: 'फोन नंबर',
    student_dob: 'जन्म तिथि',
    student_gender: 'लिंग',
    student_address: 'पता',
    student_program: 'कार्यक्रम',
    student_department: 'विभाग',
    student_batch: 'बैच',
    student_semester: 'सेमेस्टर',
    student_enrollment_date: 'नामांकन तिथि',
    
    // Fees Module
    fees_structure: 'शुल्क संरचना',
    fees_payment: 'शुल्क भुगतान',
    fees_history: 'भुगतान इतिहास',
    fees_pending: 'बकाया शुल्क',
    fees_paid: 'भुगतान किया',
    fees_total: 'कुल शुल्क',
    fees_due_date: 'देय तिथि',
    fees_pay_now: 'अभी भुगतान करें',
    fees_receipt: 'रसीद',
    fees_tuition: 'शिक्षण शुल्क',
    fees_hostel: 'छात्रावास शुल्क',
    fees_library: 'पुस्तकालय शुल्क',
    fees_exam: 'परीक्षा शुल्क',
    fees_other: 'अन्य शुल्क',
    
    // Exams Module
    exam_schedule: 'परीक्षा कार्यक्रम',
    exam_hall_ticket: 'प्रवेश पत्र',
    exam_results: 'परिणाम',
    exam_grade_card: 'ग्रेड कार्ड',
    exam_name: 'परीक्षा का नाम',
    exam_date: 'तारीख',
    exam_time: 'समय',
    exam_venue: 'स्थान',
    exam_subject: 'विषय',
    exam_marks: 'अंक',
    exam_grade: 'ग्रेड',
    exam_pass: 'उत्तीर्ण',
    exam_fail: 'अनुत्तीर्ण',
    
    // Attendance Module
    attendance_mark: 'उपस्थिति दर्ज करें',
    attendance_view: 'उपस्थिति देखें',
    attendance_report: 'उपस्थिति रिपोर्ट',
    attendance_present: 'उपस्थित',
    attendance_absent: 'अनुपस्थित',
    attendance_late: 'देरी से',
    attendance_leave: 'छुट्टी पर',
    attendance_percentage: 'उपस्थिति प्रतिशत',
    attendance_scan_qr: 'QR कोड स्कैन करें',
    
    // Library Module
    library_search_books: 'पुस्तकें खोजें',
    library_borrow: 'पुस्तक लें',
    library_return: 'पुस्तक वापस करें',
    library_my_books: 'मेरी उधार पुस्तकें',
    library_due_date: 'वापसी तिथि',
    library_fine: 'जुर्माना राशि',
    library_available: 'उपलब्ध',
    library_unavailable: 'अनुपलब्ध',
    
    // Hostel Module
    hostel_rooms: 'कमरे',
    hostel_allocation: 'कमरा आवंटन',
    hostel_complaint: 'शिकायत',
    hostel_fees: 'छात्रावास शुल्क',
    hostel_room_number: 'कमरा नंबर',
    hostel_block: 'ब्लॉक',
    hostel_capacity: 'क्षमता',
    hostel_occupied: 'भरा हुआ',
    hostel_vacant: 'खाली',
    
    // Scholarship Module
    scholarship_available: 'उपलब्ध छात्रवृत्तियां',
    scholarship_apply: 'आवेदन करें',
    scholarship_status: 'आवेदन की स्थिति',
    scholarship_approved: 'स्वीकृत',
    scholarship_pending: 'विचाराधीन',
    scholarship_rejected: 'अस्वीकृत',
    scholarship_amount: 'छात्रवृत्ति राशि',
    scholarship_eligibility: 'पात्रता मानदंड',
    
    // Notifications
    notification_all: 'सभी सूचनाएं',
    notification_unread: 'अपठित',
    notification_mark_read: 'पढ़ा हुआ चिह्नित करें',
    notification_clear: 'सभी हटाएं',
    
    // Authentication
    auth_email: 'ईमेल पता',
    auth_password: 'पासवर्ड',
    auth_confirm_password: 'पासवर्ड की पुष्टि करें',
    auth_forgot_password: 'पासवर्ड भूल गए?',
    auth_reset_password: 'पासवर्ड रीसेट करें',
    auth_login_success: 'लॉग इन सफल',
    auth_logout_success: 'सफलतापूर्वक लॉग आउट',
    auth_invalid_credentials: 'गलत ईमेल या पासवर्ड',
    
    // Messages
    msg_saved_successfully: 'सफलतापूर्वक सहेजा गया',
    msg_deleted_successfully: 'सफलतापूर्वक हटाया गया',
    msg_updated_successfully: 'सफलतापूर्वक अपडेट किया गया',
    msg_operation_failed: 'कार्य विफल',
    msg_network_error: 'नेटवर्क त्रुटि। कृपया पुनः प्रयास करें।',
    msg_session_expired: 'सत्र समाप्त। कृपया पुनः लॉग इन करें।',
    msg_access_denied: 'पहुंच अस्वीकृत',
    msg_not_found: 'नहीं मिला',
    msg_confirm_delete: 'क्या आप वाकई हटाना चाहते हैं?',
    
    // Date & Time
    date_today: 'आज',
    date_yesterday: 'कल (बीता)',
    date_tomorrow: 'कल (आने वाला)',
    date_this_week: 'इस सप्ताह',
    date_this_month: 'इस महीने',
    
    // Gender
    gender_male: 'पुरुष',
    gender_female: 'महिला',
    gender_other: 'अन्य'
  },
  
  raj: {
    // Rajasthani (Marwari dialect) translations
    // Common
    app_name: 'पढ़ो राजस्थान',
    tagline: 'छात्र ERP प्रणाली',
    welcome: 'खम्मा घणी',
    logout: 'बारैर निकळो',
    login: 'भीतर आओ',
    register: 'नांव लिखाओ',
    submit: 'भेजो',
    cancel: 'छोड़ो',
    save: 'संभाळो',
    delete: 'हटाओ',
    edit: 'बदळो',
    view: 'देखो',
    search: 'खोजो',
    filter: 'छाणो',
    loading: 'लोड हो रह्यो है...',
    error: 'गड़बड़',
    success: 'हो ग्यो',
    warning: 'चेतावणी',
    info: 'जाणकारी',
    yes: 'हां',
    no: 'ना',
    ok: 'ठीक है',
    close: 'बंद करो',
    back: 'पाछो',
    next: 'आग्गो',
    previous: 'पाछलो',
    download: 'उतारो',
    upload: 'चढ़ाओ',
    print: 'छापो',
    
    // Navigation
    nav_dashboard: 'डैशबोर्ड',
    nav_students: 'विद्यार्थी',
    nav_fees: 'फीस',
    nav_exams: 'परीक्षा',
    nav_attendance: 'हाजरी',
    nav_library: 'पुस्तकालय',
    nav_hostel: 'छात्रावास',
    nav_scholarships: 'छात्रवृत्ति',
    nav_documents: 'कागज-पत्र',
    nav_notifications: 'सूचना',
    nav_settings: 'सेटिंग',
    nav_profile: 'प्रोफाइल',
    nav_help: 'मदद',
    
    // Dashboard
    dashboard_overview: 'झलक',
    dashboard_total_students: 'कुल विद्यार्थी',
    dashboard_pending_fees: 'बाकी फीस',
    dashboard_attendance_today: 'आज री हाजरी',
    dashboard_upcoming_exams: 'आवण वाळी परीक्षा',
    dashboard_recent_activities: 'ताजी गतिविधि',
    
    // Student Module
    student_profile: 'विद्यार्थी री जाणकारी',
    student_id: 'विद्यार्थी नंबर',
    student_name: 'नांव',
    student_email: 'ईमेल',
    student_phone: 'फोन नंबर',
    student_dob: 'जनम दिन',
    student_gender: 'लिंग',
    student_address: 'पतो',
    student_program: 'कोर्स',
    student_department: 'विभाग',
    student_batch: 'बैच',
    student_semester: 'सेमेस्टर',
    student_enrollment_date: 'दाखिला दिनांक',
    
    // Fees Module
    fees_structure: 'फीस री जाणकारी',
    fees_payment: 'फीस भरो',
    fees_history: 'भरी हुई फीस',
    fees_pending: 'बाकी फीस',
    fees_paid: 'भर दी',
    fees_total: 'पूरी फीस',
    fees_due_date: 'आखरी तारीख',
    fees_pay_now: 'अबै भरो',
    fees_receipt: 'रसीद',
    fees_tuition: 'पढ़ाई फीस',
    fees_hostel: 'छात्रावास फीस',
    fees_library: 'पुस्तकालय फीस',
    fees_exam: 'परीक्षा फीस',
    fees_other: 'और खरचा',
    
    // Exams Module
    exam_schedule: 'परीक्षा समय-सारणी',
    exam_hall_ticket: 'प्रवेश पत्र',
    exam_results: 'नतीजा',
    exam_grade_card: 'ग्रेड कार्ड',
    exam_name: 'परीक्षा को नांव',
    exam_date: 'तारीख',
    exam_time: 'टैम',
    exam_venue: 'जगा',
    exam_subject: 'विषय',
    exam_marks: 'नंबर',
    exam_grade: 'ग्रेड',
    exam_pass: 'पास',
    exam_fail: 'फेल',
    
    // Attendance Module
    attendance_mark: 'हाजरी लगाओ',
    attendance_view: 'हाजरी देखो',
    attendance_report: 'हाजरी रिपोर्ट',
    attendance_present: 'हाजर',
    attendance_absent: 'गैरहाजर',
    attendance_late: 'देर सूं आयो',
    attendance_leave: 'छुट्टी पर',
    attendance_percentage: 'हाजरी प्रतिशत',
    attendance_scan_qr: 'QR कोड स्कैन करो',
    
    // Library Module
    library_search_books: 'पोथी खोजो',
    library_borrow: 'पोथी लो',
    library_return: 'पोथी वापस करो',
    library_my_books: 'मेरी ली हुई पोथी',
    library_due_date: 'वापसी तारीख',
    library_fine: 'दंड रकम',
    library_available: 'मिल सकै',
    library_unavailable: 'नी मिलै',
    
    // Hostel Module
    hostel_rooms: 'कमरा',
    hostel_allocation: 'कमरा दियो',
    hostel_complaint: 'शिकायत',
    hostel_fees: 'छात्रावास फीस',
    hostel_room_number: 'कमरा नंबर',
    hostel_block: 'ब्लॉक',
    hostel_capacity: 'जगा',
    hostel_occupied: 'भर गयो',
    hostel_vacant: 'खाली',
    
    // Scholarship Module
    scholarship_available: 'मिलण वाळी छात्रवृत्ति',
    scholarship_apply: 'अर्जी करो',
    scholarship_status: 'अर्जी री स्थिति',
    scholarship_approved: 'मंजूर',
    scholarship_pending: 'अटकी है',
    scholarship_rejected: 'नामंजूर',
    scholarship_amount: 'छात्रवृत्ति राशि',
    scholarship_eligibility: 'पात्रता',
    
    // Notifications
    notification_all: 'सारी सूचना',
    notification_unread: 'बिना देखी',
    notification_mark_read: 'देख लियो',
    notification_clear: 'सारी हटाओ',
    
    // Authentication
    auth_email: 'ईमेल पतो',
    auth_password: 'पासवर्ड',
    auth_confirm_password: 'पासवर्ड फेर लिखो',
    auth_forgot_password: 'पासवर्ड भूल गया?',
    auth_reset_password: 'पासवर्ड बदळो',
    auth_login_success: 'आ गया भीतर',
    auth_logout_success: 'ठीक सूं निकळ गया',
    auth_invalid_credentials: 'गलत ईमेल या पासवर्ड',
    
    // Messages
    msg_saved_successfully: 'संभाळ लियो',
    msg_deleted_successfully: 'हटा दियो',
    msg_updated_successfully: 'बदळ दियो',
    msg_operation_failed: 'काम नी हुयो',
    msg_network_error: 'नेटवर्क में गड़बड़। फेर कोशिश करो।',
    msg_session_expired: 'सत्र खतम। फेर भीतर आओ।',
    msg_access_denied: 'इजाजत नी है',
    msg_not_found: 'नी मिल्यो',
    msg_confirm_delete: 'सही में हटाणो है?',
    
    // Date & Time
    date_today: 'आज',
    date_yesterday: 'काल (बीतो)',
    date_tomorrow: 'काल (आवणो)',
    date_this_week: 'आ हफ्ता',
    date_this_month: 'आ महीनो',
    
    // Gender
    gender_male: 'आदमी',
    gender_female: 'लुगाई',
    gender_other: 'और'
  }
};

// i18n Service Class
class I18nService {
  constructor() {
    this.currentLocale = 'en';
    this.fallbackLocale = 'en';
    this.translations = translations;
    this.pluralRules = new Intl.PluralRules(this.currentLocale);
  }

  // Set locale
  setLocale(locale) {
    if (this.translations[locale]) {
      this.currentLocale = locale;
      this.pluralRules = new Intl.PluralRules(locale);
      return true;
    }
    console.warn(`Locale '${locale}' not found, using fallback`);
    return false;
  }

  // Get current locale
  getLocale() {
    return this.currentLocale;
  }

  // Get available locales
  getAvailableLocales() {
    return Object.keys(this.translations);
  }

  // Get translation
  t(key, params = {}) {
    let translation = this.translations[this.currentLocale]?.[key] ||
                     this.translations[this.fallbackLocale]?.[key] ||
                     key;

    // Replace parameters
    Object.keys(params).forEach(param => {
      translation = translation.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
    });

    return translation;
  }

  // Pluralize
  plural(key, count, params = {}) {
    const pluralKey = `${key}_${this.pluralRules.select(count)}`;
    return this.t(pluralKey, { ...params, count });
  }

  // Format number
  formatNumber(number, options = {}) {
    return new Intl.NumberFormat(this.currentLocale, options).format(number);
  }

  // Format currency
  formatCurrency(amount, currency = 'INR') {
    return new Intl.NumberFormat(this.currentLocale, {
      style: 'currency',
      currency
    }).format(amount);
  }

  // Format date
  formatDate(date, options = {}) {
    return new Intl.DateTimeFormat(this.currentLocale, options).format(new Date(date));
  }

  // Get all translations for current locale (for frontend)
  getAllTranslations() {
    return this.translations[this.currentLocale] || this.translations[this.fallbackLocale];
  }

  // Add custom translation
  addTranslation(locale, key, value) {
    if (!this.translations[locale]) {
      this.translations[locale] = {};
    }
    this.translations[locale][key] = value;
  }

  // Middleware for Express
  middleware() {
    return (req, res, next) => {
      // Get locale from header, query, or cookie
      const locale = req.headers['accept-language']?.split(',')[0]?.split('-')[0] ||
                    req.query.lang ||
                    req.cookies?.lang ||
                    'en';

      this.setLocale(locale);

      // Add helper to response locals
      res.locals.t = (key, params) => this.t(key, params);
      res.locals.locale = this.currentLocale;
      res.locals.locales = this.getAvailableLocales();

      next();
    };
  }
}

// Export singleton instance and translations
module.exports = {
  i18n: new I18nService(),
  translations
};
