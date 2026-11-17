export type UserRole = 'admin' | 'supervisor';
export type AccountStatus = 'active' | 'suspended' | 'archived';

export type CopyStatus =
  | 'available'        // متاحة
  | 'reserved'         // محجوزة
  | 'in_preparation'   // قيد التجهيز
  | 'borrowed'         // مستعارة
  | 'overdue'          // متأخرة
  | 'under_inspection' // قيد الفحص (على رف الإرجاع)
  | 'damaged'          // متضررة
  | 'lost'             // مفقودة
  | 'maintenance';     // تحت الصيانة

export type ReservationStatus =
  | 'new_request'      // طلب جديد
  | 'pending_approval' // بانتظار الموافقة
  | 'approved'         // تمت الموافقة
  | 'preparing'        // جارٍ تجهيز الكتاب
  | 'ready_for_pickup' // جاهز للاستلام
  | 'fulfilled'        // تم التسليم
  | 'rejected'         // مرفوض
  | 'cancelled'        // ملغي
  | 'expired';         // منتهي الصلاحية

export type LoanStatus = 'active' | 'returned' | 'overdue' | 'cancelled';

export type ConditionRating =
  | 'pristine'         // ممتاز وجديد
  | 'good'             // سليم وجيد
  | 'needs_monitoring' // يحتاج متابعة
  | 'damaged'          // متضرر
  | 'lost';            // مفقود

export type InventorySessionStatus = 'active' | 'completed' | 'cancelled';

export type InventoryScanResult =
  | 'found_on_shelf'
  | 'expected_borrowed'
  | 'in_maintenance'
  | 'misplaced'
  | 'unknown_code';

export interface StaffPermissions {
  can_checkout: boolean;
  can_return: boolean;
  can_inspect: boolean;
  can_inventory: boolean;
  can_manage_books: boolean;
  can_manage_students: boolean;
  can_manage_settings?: boolean;
  can_manage_discussions?: boolean;
  can_approve_discussions?: boolean;
  can_view_reports?: boolean;
  can_view_all_chats?: boolean;
  can_manage_chats?: boolean;
}

export interface StaffUser {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  permissions: StaffPermissions;
  assignedGroups?: string[];
  phone?: string;
  lastLoginAt?: string;
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
}

export interface Student {
  id: string;
  internalId: string; // الكود الفريد للطالب (Student Code)
  fullName: string;
  grade: string;
  stage: string;
  groupName: string;
  accessCodeHash: string; // تجزئة آمنة مملحة sha256$<salt>$<digest> - لا يُحفظ الرمز كنص مكشوف
  rawAccessCode?: string; // حقل عابر مؤقت في الذاكرة فقط عند الإصدار أو للترحيل الآلي، ويُحذف عند الحفظ
  accessCodeUpdatedAt?: string;
  failedLoginAttempts?: number;
  lockedUntil?: string;
  lastLoginAt?: string;
  qrToken: string;        // Secure random token, no PII / no password
  qrTokenHash?: string;   // SHA-256 digest of qrToken for verification
  qrTokenStatus?: 'active' | 'revoked';
  qrLoginEnabled?: boolean;
  qrTokenVersion?: number;
  qrTokenIssuedAt?: string;
  qrTokenRevokedAt?: string;
  revokedQrTokenHashes?: string[]; // Historical revoked token hashes to block old cards
  status: AccountStatus;
  totalBooksRead: number;
  currentActiveLoans: number;
  notes?: string;
  createdAt: string;
}

export interface EphemeralStudentCredential {
  studentId: string;
  studentCode: string;
  fullName: string;
  grade: string;
  groupName: string;
  plainAccessCode: string;
  issuedAt: string;
}

export interface AuthSessionRecord {
  sessionId: string;
  tabId?: string;
  mode: 'student' | 'supervisor' | 'admin';
  userId: string;
  issuedAt: number;
  lastActivityAt: number;
  expiresAt: number;
  studentSnapshot?: Student;
  staffSnapshot?: StaffUser;
}

export interface Category {
  id: string;
  name: string;
  code: string;
  description?: string;
  iconName: string;
  displayOrder: number;
}

export interface Book {
  id: string;
  code: string; // e.g. WTH-000125
  title: string;
  author: string;
  publisher?: string;
  description: string;
  categoryId: string;
  ageGroup: string;
  pageCount?: number;
  coverImageUrl?: string;
  isFeatured: boolean;
  isBookOfTheWeek: boolean;
  weekHighlightNote?: string;
  totalCopiesCount: number;
  availableCopiesCount: number;
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
}

export interface BookCopy {
  id: string;
  bookId: string;
  copyCode: string; // e.g. WTH-125-001
  qrData: string;   // Unique QR payload
  status: CopyStatus;
  condition: ConditionRating;
  shelfLocation: string;
  notes?: string;
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
}

export interface Reservation {
  id: string;
  studentId: string;
  bookId: string;
  assignedCopyId?: string;
  status: ReservationStatus;
  requestedAt: string;
  approvedAt?: string;
  expiresAt?: string;
  notes?: string;
  handledByStaffId?: string;
}

export interface Loan {
  id: string;
  copyId: string;
  studentId: string;
  supervisorId: string;
  loanDate: string;
  dueDate: string;
  returnDate?: string;
  returnedToSupervisorId?: string;
  status: LoanStatus;
  renewalCount: number;
  notes?: string;
}

export interface LoanEvent {
  id: string;
  loanId: string;
  eventType: 'checkout' | 'return' | 'extend' | 'damage_reported' | 'cancelled';
  staffId?: string;
  notes?: string;
  eventData?: any;
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
}

export interface ConditionReport {
  id: string;
  copyId: string;
  loanId?: string;
  studentId?: string;
  staffId: string;
  stage: 'checkout' | 'return' | 'routine' | 'maintenance';
  rating: ConditionRating;
  details?: string;
  photos: ConditionPhoto[];
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
}

export interface ConditionPhoto {
  id: string;
  reportId: string;
  photoUrl: string;
  photoType: 'cover' | 'spine' | 'page' | 'damage_documentation';
  caption?: string;
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
}

export interface LibraryNotification {
  id: string;
  recipientType: 'student' | 'staff' | 'broadcast';
  recipientRole?: 'admin' | 'supervisor' | 'student' | 'broadcast';
  studentId?: string;
  staffId?: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'urgent';
  actionLink?: string;
  conversationId?: string;
  sourceMessageId?: string;
  dedupeKey?: string;
  isRead: boolean;
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
}

export interface InventorySession {
  id: string;
  title: string;
  supervisorId: string;
  status: InventorySessionStatus;
  expectedCopiesCount: number;
  scannedCopiesCount: number;
  missingCopiesCount: number;
  unexpectedCopiesCount: number;
  startedAt: string;
  completedAt?: string;
  summaryReport?: any;
  notes?: string;
}

export interface InventoryScan {
  id: string;
  sessionId: string;
  copyId?: string;
  scannedCode: string;
  result: InventoryScanResult;
  scannedByStaffId: string;
  scannedAt: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  actorId?: string;
  actorType: 'admin' | 'supervisor' | 'student' | 'system';
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string;
  previousState?: any;
  newState?: any;
  reason?: string;
  notes?: string;
  ipAddress?: string;
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
}

export interface SettingsSnapshot {
  id: string;
  timestamp: string;
  authorId: string;
  authorName: string;
  summary: string;
  snapshot: Partial<LibrarySettings>;
}

export interface LibrarySettings {
  id: string;
  // 1. الهوية والموقع
  libraryName: string;
  libraryEnglishName: string;
  teamName: string;
  logoUrl?: string;
  faviconUrl?: string;
  description?: string;
  slogan?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: 'cairo' | 'ibm_plex' | 'amiri' | 'tajawal' | 'system';
  bgPattern?: 'subtle_dots' | 'clean_grid' | 'islamic_stars' | 'none';
  issuerOrganization?: string;
  contactEmail?: string;
  contactPhone?: string;
  location?: string;
  copyrightText?: string;
  welcomeMessage: string;

  // 2. المستخدمين والحسابات
  enableStudentLogin?: boolean;
  studentLoginMethod?: 'qr' | 'code' | 'both';
  enableStudentQrLogin?: boolean;
  requirePinWithQrLogin?: boolean;
  sessionTimeoutMinutes?: number;
  autoLogoutInactiveMinutes?: number;
  maxLoginAttempts?: number;
  lockoutDurationMinutes?: number;

  // 3. إدارة الكتب والنسخ
  showBookCovers?: boolean;
  showUnavailableBooks?: boolean;
  defaultBookSort?: 'title' | 'popular' | 'added_desc' | 'page_count';
  barcodePrefix?: string;

  // 4. الإعارة والإرجاع
  maxLoansPerStudent: number;
  loanDurationDays: number;
  selectableLoanDurations?: number[];
  minLoanDurationDays?: number;
  maxLoanDurationDays?: number;
  maxRenewals: number;
  renewalDurationDays: number;
  allowBackorderReservation?: boolean;
  reservationValidityHours: number;
  blockLoanIfOverdue: boolean;
  requireConditionPhotosOnCheckout: boolean;
  requireConditionPhotosOnReturn: boolean;
  loanApprovalMode?: 'automatic' | 'manual_review';

  // 5. القراءة وإكمال الكتب
  enableBookCompletionButton?: boolean;
  requireReviewForBookCompletion?: boolean;
  showReadingHistoryToStudents?: boolean;
  requireNotesOnCompletion?: boolean;

  // 6. المجموعات والمشرفين
  maxStudentsPerGroup?: number;
  restrictSupervisorsToAssignedGroups?: boolean;

  // 7. المظهر وتجربة الاستخدام
  themeMode?: 'light' | 'dark' | 'auto';
  tableDensity?: 'compact' | 'comfortable';
  cardElevation?: 'flat' | 'elevated' | 'bordered';

  // 8. التاريخ والتوقيت
  timezone: string;
  calendarPreference?: 'hijri' | 'gregorian' | 'dual';
  dateFormat?: string;

  // 9. تشغيل الموقع والصيانة والإعلانات
  isMaintenanceMode?: boolean;
  maintenanceMessage?: string;
  announcementBanner?: {
    enabled: boolean;
    text: string;
    type: 'info' | 'warning' | 'success';
    linkText?: string;
    linkUrl?: string;
  };

  // 10. Feature Flags (إدارة الخصائص والمميزات)
  featureFlags?: {
    exams: boolean;
    discussions: boolean;
    achievements: boolean;
    chat: boolean;
    reservations: boolean;
    exchanges: boolean;
    qrLogin: boolean;
    readingCompletions: boolean;
    soundEffects?: boolean;
  };

  // 11. سجل نسخ الإعدادات التاريخية للاستعادة الآمنة
  settingsSnapshots?: SettingsSnapshot[];
  lastBackupDate?: string;
}

export interface ReadingChallenge {
  id: string;
  title: string;
  description: string;
  targetBooks: number;
  monthYear: string;
  isActive: boolean;
}

export interface BookWaitlist {
  id: string;
  bookId: string;
  studentId: string;
  requestedAt: string;
  notifiedAt?: string;
  status: 'waiting' | 'notified' | 'fulfilled' | 'cancelled';
}

// ========================================================================
// نظام طلبات الإرجاع والاستبدال والتواصل الداخلي
// ========================================================================

export type ReturnRequestStatus =
  | 'new'                   // جديد
  | 'in_review'             // قيد المراجعة
  | 'approved'              // تمت الموافقة
  | 'waiting_for_pickup'    // بانتظار استلام الكتاب
  | 'received'              // تم الاستلام
  | 'under_inspection'      // قيد الفحص
  | 'completed'             // مكتمل
  | 'rejected'              // مرفوض مع توضيح السبب
  | 'cancelled';            // ملغي

export type ExchangeRequestStatus =
  | 'new'                   // جديد
  | 'in_review'             // قيد المراجعة
  | 'approved'              // تمت الموافقة (تم حجز النسخة البديلة مبدئياً)
  | 'waiting_for_old_book'  // بانتظار استلام الكتاب القديم
  | 'old_book_received'     // تم استلام الكتاب القديم وفحصه
  | 'completed'             // مكتمل (تم تسليم النسخة الجديدة رسمياً)
  | 'rejected'              // مرفوض مع توضيح السبب
  | 'cancelled';            // ملغي

export interface ReturnRequest {
  id: string;
  studentId: string;
  loanId: string;
  copyId: string;
  bookId: string;
  studentNotes?: string;
  status: ReturnRequestStatus;
  rejectionReason?: string;
  scheduledPickupTime?: string; // موعد أو آلية الاستلام
  handledByStaffId?: string;
  inspectionRating?: ConditionRating;
  inspectionNotes?: string;
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeRequest {
  id: string;
  studentId: string;
  oldLoanId: string;
  oldCopyId: string;
  oldBookId: string;
  newBookId: string;
  newCopyId?: string;       // يتم تعيينها عند موافقة المشرف وتخصيص النسخة البديلة
  newLoanId?: string;       // تنشأ عند التسليم الفعلي فقط
  studentNotes?: string;
  status: ExchangeRequestStatus;
  rejectionReason?: string;
  scheduledPickupTime?: string;
  handledByStaffId?: string;
  oldCopyInspectionRating?: ConditionRating;
  oldCopyInspectionNotes?: string;
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
  updatedAt: string;
}

export type ChatRecipientType = 'admin' | 'supervisor';
export type ChatSenderType = 'student' | 'supervisor' | 'admin' | 'system';
export type MessageDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type ConversationStatus = 'open' | 'waiting_reply' | 'completed' | 'archived';

export interface ChatAttachment {
  id?: string;
  url: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  type: 'image' | 'file';
}

export interface ChatMessage {
  id: string;
  clientMessageId?: string;
  conversationId: string;
  senderType: ChatSenderType;
  senderId: string;
  senderName: string;
  recipientType?: ChatRecipientType;
  recipientId?: string;
  content: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  attachmentType?: 'image' | 'file';
  replyToMessageId?: string;
  deliveryStatus: MessageDeliveryStatus;
  errorReason?: string;
  isRead: boolean;
  deliveredAt?: string;
  readAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedById?: string;
  deletedByName?: string;
  deletedReason?: string;
  systemEventType?:
    | 'welcome'
    | 'closed'
    | 'reopened'
    | 'transferred'
    | 'archived'
    | 'follow_up'
    | 'status_changed';
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
  updatedAt?: string;
}

export interface ConversationParticipant {
  userId: string;
  role: 'student' | 'supervisor' | 'admin';
  displayName: string;
  lastReadAt?: string;
  lastSeenAt?: string;
}

export interface Conversation {
  id: string;
  studentId: string;
  recipientType: ChatRecipientType;
  supervisorId?: string;
  assignedAdminId?: string;
  status: ConversationStatus;
  isPinned?: boolean;
  pinnedAt?: string;
  pinnedById?: string;
  isFollowUp?: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  archivedById?: string;
  lastMessageId?: string;
  lastMessageContent: string;
  lastMessageAt: string;
  lastMessageSenderType?: ChatSenderType;
  unreadCountStudent: number;
  unreadCountSupervisor: number;
  studentLastSeenAt?: string;
  staffLastSeenAt?: string;
  welcomeShown?: boolean;
  participants?: ConversationParticipant[];
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
  updatedAt: string;
}

export interface ChatNotificationSettings {
  enableSound: boolean;
  enableBrowserNotifications: boolean;
  showLastSeen: boolean;
  welcomeMessageText: string;
}

export interface ChatQueuedMessage {
  clientMessageId: string;
  conversationId?: string;
  studentId: string;
  recipientType: ChatRecipientType;
  supervisorId?: string;
  senderType: ChatSenderType;
  senderId: string;
  senderName: string;
  content: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  attachmentType?: 'image' | 'file';
  replyToMessageId?: string;
  retryCount: number;
  lastError?: string;
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
}

// ========================================================================
// نظام الألقاب والشهادات القرائية المتدرجة (بديل ميزة المدن والكيلومترات)
// ========================================================================

export type ReadingLogStatus = 'pending' | 'approved' | 'rejected' | 'superseded';

// ========================================================================
// نظام توثيق إكمال قراءة الكتب (Book Reading Completion Workflow)
// ========================================================================

export type ReadingCompletionStatus =
  | 'new'
  | 'pending_approval'
  | 'under_review'
  | 'approved'
  | 'needs_revision'
  | 'rejected';

export interface CompletionHistoryEntry {
  id: string;
  action: 'submitted' | 'under_review' | 'approved' | 'returned_for_revision' | 'rejected' | 'updated';
  actionLabel: string;
  actorId: string;
  actorName: string;
  actorRole: 'student' | 'supervisor' | 'admin' | 'system';
  note?: string;
  createdAt: string;
}

export interface BookReadingCompletion {
  id: string;
  loanId: string;
  bookId: string;
  copyId?: string;
  studentId: string;
  requestDate: string;           // تاريخ الإكمال الذي سجله الطالب
  status: ReadingCompletionStatus;
  approvedAt?: string;           // تاريخ اعتماد الإكمال
  approvedByStaffId?: string;    // معرّف المشرف
  approvedByStaffName?: string;  // اسم المشرف الذي اعتمد الإكمال
  reviewedAt?: string;
  reviewedByStaffId?: string;
  reviewedByStaffName?: string;
  rejectionReason?: string;
  revisionReason?: string;
  adminNotes?: string;
  studentNotes?: string;
  history?: CompletionHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export type ReadingRankThemeKey =
  | 'diploma'
  | 'bachelor'
  | 'master'
  | 'doctorate'
  | 'wathab'
  | 'custom';

export interface ReadingRankDefinition {
  id: string;
  code: string;                  // e.g., DIPLOMA, BACHELOR, MASTER, DOCTORATE, WATHAB
  orderIndex: number;
  title: string;                 // دبلوم القراءة / بكالوريوس القراءة / ماجستير القراءة / دكتوراه القراءة / وثّاب
  subtitle: string;
  requiredPages: number;         // 100, 300, 600, 1000, 1500
  description: string;
  motivationalPhrase: string;    // عبارة تحفيزية تظهر داخل الشهادة والبطاقة
  themeKey: ReadingRankThemeKey;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  badgeTitle: string;            // مسمى الشارة / الوسام الرقمي
  certificateHeading: string;    // عنوان فرعي داخل قالب الشهادة
  isHighestTier: boolean;        // يميز أعلى رتبة ("وثّاب") باحتفال ووسام رقمي حصري
  isActive: boolean;             // تشغيل أو إيقاف اللقب من لوحة الإدارة
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
  updatedAt: string;
}

export interface CertificateSettings {
  issuerOrganization: string;    // الجهة المصدرة للشهادة
  signatoryTitle: string;        // المسمى الوظيفي للموقع (مثل: مدير مكتبة وثبة الذكية)
  signatoryName: string;         // اسم الموقع أو الجهة
  footerNote: string;            // تذييل الشهادة الرسمي
  serialPrefix: string;          // بادئة رقم الشهادة الفريد e.g. WTH-CERT
  updatedAt: string;
}

export interface ReadingLog {
  id: string;
  studentId: string;
  loanId: string;
  bookId: string;
  fromPage: number;
  toPage: number;
  pagesCount: number;
  readingDate: string;           // تاريخ القراءة الفعلي YYYY-MM-DD أو ISO
  studentNotes?: string;
  status: ReadingLogStatus;
  rejectionReason?: string;
  reviewedByStaffId?: string;
  reviewedAt?: string;
  correctedPagesCount?: number;
  supersededById?: string;
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
  updatedAt: string;
}

export interface ReadingLogCorrection {
  id: string;
  readingLogId: string;
  studentId: string;
  staffId: string;
  staffName: string;
  previousPagesCount: number;
  newPagesCount: number;
  pagesDelta: number;
  reason: string;
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
}

export interface StudentRankAchievement {
  id: string;
  studentId: string;
  rankId: string;
  rankTitleSnapshot: string;
  pagesAtAchievement: number;
  unlockedAt: string;
  isCelebrated: boolean;
  status: 'active' | 'revoked';
}

export interface ReadingCertificate {
  id: string;
  certificateNumber: string;     // رقم شهادة فريد e.g. WTH-CERT-2026-0001
  studentId: string;
  studentNameSnapshot: string;
  studentGradeSnapshot: string;
  rankId: string;
  rankTitleSnapshot: string;
  themeKeySnapshot: ReadingRankThemeKey;
  primaryColorSnapshot: string;
  secondaryColorSnapshot: string;
  accentColorSnapshot: string;
  pagesCompletedSnapshot: number;
  motivationalPhrase: string;
  issuerOrganization: string;
  signatoryTitle: string;
  signatoryName: string;
  footerNote: string;
  issuedAt: string;
  version: number;
  isReissue: boolean;
  reissueReason?: string;
  issuedByStaffId?: string;
  previousCertificateId?: string;
  status: 'active' | 'archived';
}

// ========================================================================
// إعدادات لوحة الشرف والتنافس القرائي العام (Achievements & Leaderboard)
// ========================================================================

export type NameDisplayMode = 'full_name' | 'first_and_family' | 'first_name_only' | 'pseudonym';
export type LeaderboardPeriod = 'all_time' | 'month' | 'week' | 'today';

export interface AchievementSettings {
  isEnabled: boolean;                      // تفعيل أو إيقاف ظهور صفحة الإنجازات
  showLeaderboardToStudents: boolean;      // إتاحة لوحة المتصدرين لجميع الطلاب
  nameDisplayMode: NameDisplayMode;        // أسلوب عرض الأسماء
  showAvatars: boolean;                    // إظهار الصور الشخصية أو الرموز
  defaultPeriod: LeaderboardPeriod;        // الفترة الافتراضية للترتيب
  minPagesToAppear: number;                // الحد الأدنى من الصفحات المقروءة المعتمدة للظهور
  excludeInactiveStudents: boolean;        // استبعاد الطلاب دون صفحات
  excludedStudentIds?: string[];           // معرفات الطلاب المستبعدين (حسابات تجريبية)
  showPodium: boolean;                     // إبراز منصة التتويج للمراكز الثلاثة الأولى
  showLevelsGuide: boolean;                // إظهار دليل المستويات الخمسة
  allowStudentDetailModal: boolean;        // السماح بفتح تفاصيل إنجازات الطالب للزملاء
  updatedAt: string;
}

// ========================================================================
// نظام المناقشات القرائية والتقارير المتكاملة
// ========================================================================

export type DiscussionStatus =
  | 'requested'            // طلب المناقشة
  | 'awaiting_schedule'    // بانتظار تحديد الموعد
  | 'scheduled'            // تم تحديد الموعد
  | 'discussed'            // تمت المناقشة
  | 'pending_approval'     // بانتظار اعتماد النتيجة
  | 'approved'             // معتمدة
  | 'needs_rediscussion'   // تحتاج إلى إعادة مناقشة
  | 'cancelled'            // ملغاة
  | 'pending'              // توافق عكسي
  | 'completed';           // توافق عكسي

export type DiscussionType = 'individual' | 'group';

export interface DiscussionEvaluationItem {
  name: string;
  maxPoints: number;
  awardedPoints: number;
}

export interface DiscussionTemplate {
  id: string;
  name: string;
  description?: string;
  items: { name: string; maxPoints: number }[];
  totalMaxPoints: number;
  isDefault?: boolean;
}

export interface DiscussionHistoryEntry {
  date: string;
  staffId?: string;
  staffName: string;
  status: DiscussionStatus;
  totalScore: number;
  evaluation: DiscussionEvaluationItem[];
  notes?: string;
  reason?: string;
}

export interface ReadingDiscussion {
  id: string;
  loanId: string;
  bookId: string;
  studentId: string;
  supervisorId?: string;
  type: DiscussionType;
  groupId?: string;
  groupTitle?: string;
  status: DiscussionStatus;
  requestDate: string;
  scheduledDate?: string;
  scheduledNote?: string;
  discussionDate?: string;
  discussionSummary?: string;
  templateId?: string;
  templateName?: string;
  evaluation: DiscussionEvaluationItem[];
  totalScore: number;
  maxScore?: number;
  pointsAwarded: number;
  pointsApproved?: boolean;
  studentBenefit?: string;
  supervisorNotes?: string;
  supervisorRecommendations?: string;
  rediscussionReason?: string;
  cancellationReason?: string;
  previousDiscussionId?: string;
  history?: DiscussionHistoryEntry[];
  approvedByStaffId?: string;
  approvedAt?: string;
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
  updatedAt: string;
}

export interface DiscussionGroup {
  id: string;
  bookId: string;
  supervisorId: string;
  title: string;
  studentIds: string[];
  scheduledDate?: string;
  scheduledNote?: string;
  status: 'pending' | 'scheduled' | 'completed';
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
}

export type DiscussionApprovalAuthority = 'admin_only' | 'supervisor_and_admin' | 'designated_supervisors';

export interface DiscussionSettings {
  isEnabled: boolean;
  evaluationItems: { name: string; maxPoints: number }[];
  totalMaxPoints: number;
  pointsPerDiscussion: number;
  pointsCalculationMode?: 'fixed' | 'proportional';
  minPassingScore?: number;
  allowRediscussion: boolean;
  requireApproval: boolean;
  approvalAuthority?: DiscussionApprovalAuthority;
  enableNotifications?: boolean;
  allowIndividualDiscussions?: boolean;
  allowGroupDiscussions?: boolean;
  maxGroupSize?: number;
  templates?: DiscussionTemplate[];
  activeTemplateId?: string;
}

// ========================================================================
// نظام التقارير والإحصائيات وإعداداتها
// ========================================================================

export type ReportPeriodPreset = 'all' | 'this_week' | 'this_month' | 'last_30_days' | 'this_term' | 'custom';
export type ReportExportFormat = 'pdf' | 'excel' | 'print';

export interface GroupReportTemplateSections {
  groupInfo: boolean;
  readingStats: boolean;
  studentsTable: boolean;
  performanceAnalysis: boolean;
  charts: boolean;
  supervisorSummary: boolean;
}

export interface StudentReportTemplateSections {
  studentInfo: boolean;
  achievementSummary: boolean;
  booksLog: boolean;
  readingLog: boolean;
  discussionsLog: boolean;
  progressCharts: boolean;
  supervisorNotes: boolean;
}

export interface ReportSettings {
  issuerOrganization: string;
  reportHeaderTitle: string;
  logoDataUrl?: string;
  showLogo: boolean;
  signatoryTitle: string;
  signatoryName: string;
  supervisorSignatureLabel: string;
  adminSignatureLabel: string;
  showSignatures: boolean;
  footerText: string;
  defaultPeriod: ReportPeriodPreset;
  defaultFormat: ReportExportFormat;
  groupSections: GroupReportTemplateSections;
  studentSections: StudentReportTemplateSections;
  updatedAt: string;
}

export interface GroupSupervisorReportSummary {
  id: string;
  groupName: string;
  periodKey: string;
  supervisorId: string;
  supervisorName: string;
  keyAchievements: string;
  generalNotes: string;
  difficulties: string;
  studentsNeedingFollowUp: string;
  recommendations: string;
  updatedAt: string;
}

export interface StudentReportRecommendationNote {
  id: string;
  studentId: string;
  supervisorId: string;
  supervisorName: string;
  interestLevel: string;
  comprehensionLevel: string;
  keyBenefits: string;
  suggestedBooks: string;
  recommendations: string;
  updatedAt: string;
}

// ========================================================================
// نظام الاختبارات الإلكترونية والنماذج الذكية (Electronic Exams System)
// ========================================================================

export type ExamQuestionType =
  | 'multiple_choice'    // اختيار من متعدد (إجابة واحدة)
  | 'checkboxes'         // مربعات اختيار (أكثر من إجابة)
  | 'true_false'          // صح أو خطأ
  | 'short_answer'       // إجابة قصيرة
  | 'long_answer'        // إجابة طويلة (فقرة)
  | 'dropdown'           // قائمة منسدلة
  | 'numeric'            // سؤال رقمي
  | 'image_based'        // سؤال يتضمن صورة
  | 'passage_based';     // سؤال يتضمن نصاً أو فقرة قراءة

export interface ExamQuestionOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface ExamQuestion {
  id: string;
  type: ExamQuestionType;
  title: string;
  description?: string;
  imageUrl?: string;
  passageText?: string;
  points: number;
  isRequired: boolean;
  options?: ExamQuestionOption[];
  correctOptionIds?: string[];
  correctBoolean?: boolean;
  correctNumericAnswer?: number;
  numericTolerance?: number;
  correctTextKeywords?: string[];
  explanation?: string;
  order: number;
}

export interface ExamSettings {
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  paginationMode: 'single' | 'all';
  allowBackNavigation: boolean;
  allowReviewBeforeSubmit: boolean;
  resultsReleaseMode: 'immediate' | 'manual';
  showCorrectAnswers: 'always' | 'after_deadline' | 'never';
  preventRetakeAfterLimit: boolean;
  isPaused: boolean;
  extendedMinutes: number;
}

export type ExamStatus = 'draft' | 'scheduled' | 'published' | 'closed' | 'archived';

export interface ElectronicExam {
  id: string;
  code: string;
  title: string;
  instructions?: string;
  coverImageUrl?: string;
  subject: string;
  supervisorId: string;
  supervisorName: string;
  targetAudienceType: 'all' | 'group' | 'custom_students';
  targetGroupNames?: string[];
  targetStudentIds?: string[];
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  totalPoints: number;
  passingScore: number;
  allowedAttempts: number;
  status: ExamStatus;
  settings: ExamSettings;
  questions: ExamQuestion[];
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
  updatedAt: string;
}

export interface StudentQuestionAnswer {
  questionId: string;
  selectedOptionIds?: string[];
  selectedBoolean?: boolean;
  numericAnswer?: number;
  textAnswer?: string;
  isCorrect?: boolean;
  awardedPoints: number;
  isManuallyGraded: boolean;
  supervisorComment?: string;
}

export type ExamAttemptStatus = 'in_progress' | 'submitted' | 'grading_pending' | 'graded' | 'cancelled';

export interface ExamAttempt {
  id: string;
  examId: string;
  examTitleSnapshot: string;
  examSnapshot: ElectronicExam;
  studentId: string;
  studentNameSnapshot: string;
  studentGroupSnapshot: string;
  attemptNumber: number;
  startedAt: string;
  submittedAt?: string;
  durationSecondsTaken?: number;
  status: ExamAttemptStatus;
  answers: Record<string, StudentQuestionAnswer>;
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  isPassed: boolean;
  supervisorFeedback?: string;
  gradedByStaffId?: string;
  gradedAt?: string;
  reactions?: Record<string, string[]>; // e.g. { '👍': ['user1', 'user2'], '❤️': ['user3'] }
  createdAt: string;
  updatedAt: string;
}

