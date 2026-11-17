import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  Book,
  BookCopy,
  Category,
  ConditionRating,
  ConditionReport,
  ConditionPhoto,
  CopyStatus,
  InventoryScan,
  InventorySession,
  LibrarySettings,
  SettingsSnapshot,
  Loan,
  LoanEvent,
  ReadingChallenge,
  Reservation,
  ReservationStatus,
  StaffUser,
  Student,
  AuditLog,
  BookWaitlist,
  ReturnRequest,
  ReturnRequestStatus,
  ExchangeRequest,
  ExchangeRequestStatus,
  Conversation,
  ChatMessage,
  ChatRecipientType,
  ChatSenderType,
  ConversationStatus,
  ChatNotificationSettings,
  ChatQueuedMessage,
  ReadingRankDefinition,
  CertificateSettings,
  ReadingLog,
  ReadingLogCorrection,
  StudentRankAchievement,
  ReadingCertificate,
  ReadingDiscussion,
  DiscussionGroup,
  DiscussionSettings,
  DiscussionEvaluationItem,
  DiscussionHistoryEntry,
  ReportSettings,
  GroupSupervisorReportSummary,
  StudentReportRecommendationNote,
  EphemeralStudentCredential,
  ElectronicExam,
  ExamAttempt,
  ExamQuestion,
  StudentQuestionAnswer,
  ExamAttemptStatus,
  BookReadingCompletion,
  ReadingCompletionStatus,
  AchievementSettings,
} from '../types';
import {
  initialBooks,
  initialCategories,
  initialCopies,
  initialLoans,
  initialLoanEvents,
  initialReservations,
  initialSettings,
  initialStaff,
  initialStudents,
  initialReadingChallenges,
  initialAuditLogs,
  initialConditionReports,
  initialReturnRequests,
  initialExchangeRequests,
  initialConversations,
  initialMessages,
  initialChatNotificationSettings,
  initialReadingRanks,
  initialCertificateSettings,
  initialReadingLogs,
  initialReadingLogCorrections,
  initialStudentRanks,
  initialReadingCertificates,
  initialDiscussions,
  initialDiscussionGroups,
  initialDiscussionSettings,
  initialReportSettings,
  initialGroupReportSummaries,
  initialStudentReportNotes,
  initialExams,
  initialExamAttempts,
  initialReadingCompletions,
  initialAchievementSettings,
} from '../data/initialData';
import { gradeSingleQuestion } from '../lib/examUtils';
import { addDaysToCurrent, isOverdue } from '../lib/dateUtils';
import { generateRandomCode, generateSecureToken } from '../lib/qrGenerator';
import { generateUniqueCertificateNumber } from '../lib/ranksData';
import {
  generateStudentAccessCode,
  generateUniqueStudentCode,
  generateUniqueStudentQrToken,
  hashAccessCodeSync,
  hashQrTokenDeterministic,
  migrateStudentsPool,
  normalizeStudentCode,
  sanitizeStudentForPersistence,
} from '../lib/studentAuthService';
import {
  CHAT_SYNC_CHANNEL_NAME,
  CHAT_OUTBOX_STORAGE_KEY,
  TAB_INSTANCE_ID,
  broadcastChatEvent,
  emitScopedNotification,
  getDeterministicConversationId,
  loadChatOutbox,
  loadChatSettings,
  markConversationReadInSupabase,
  normalizeConversation,
  normalizeMessage,
  saveChatOutbox,
  saveChatSettings,
  syncConversationAndMessageToSupabase,
  verifyPersistedMessageInLocalStorage,
} from '../lib/chatService';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  fetchAllStudentsFromSupabase,
  upsertStudentToSupabase,
  syncEntityRecordToSupabase,
  fetchFullCloudState,
} from '../lib/supabaseSync';
import { centralSync } from '../lib/sync/centralSyncService';

export interface RankTierProgress {
  rank: ReadingRankDefinition;
  status: 'earned' | 'in_progress' | 'locked';
  progressPercent: number;
  remainingPages: number;
  pagesCompletedTowardTier: number;
  achievement?: StudentRankAchievement;
  certificate?: ReadingCertificate;
}

export interface StudentRankSummary {
  totalApprovedPages: number;
  pendingPagesCount: number;
  completedBooksCount: number;
  discussionPoints: number;
  approvedDiscussionsCount: number;
  currentRank: ReadingRankDefinition | null;
  nextRank: ReadingRankDefinition | null;
  remainingPagesToNext: number;
  progressPercentToNext: number;
  isWathabAchieved: boolean;
  tiers: RankTierProgress[];
  certificates: ReadingCertificate[];
  uncelebratedAchievements: StudentRankAchievement[];
}

export interface BookReadingCoverage {
  bookPageCount: number;
  approvedPages: number;
  pendingPages: number;
  remainingPages: number;
  nextSuggestedFromPage: number;
  loggedRanges: { fromPage: number; toPage: number; status: ReadingLog['status'] }[];
}

interface LibraryContextType {
  settings: LibrarySettings;
  categories: Category[];
  books: Book[];
  copies: BookCopy[];
  students: Student[];
  staff: StaffUser[];
  reservations: Reservation[];
  loans: Loan[];
  loanEvents: LoanEvent[];
  conditionReports: ConditionReport[];
  inventorySessions: InventorySession[];
  inventoryScans: InventoryScan[];
  auditLogs: AuditLog[];
  readingChallenges: ReadingChallenge[];
  waitlist: BookWaitlist[];
  returnRequests: ReturnRequest[];
  exchangeRequests: ExchangeRequest[];
  conversations: Conversation[];
  messages: ChatMessage[];

  // نظام الألقاب والشهادات القرائية ولوحة الإنجازات
  readingRanks: ReadingRankDefinition[];
  certificateSettings: CertificateSettings;
  achievementSettings: AchievementSettings;
  updateAchievementSettings: (newSettings: Partial<AchievementSettings>) => void;
  readingLogs: ReadingLog[];
  readingLogCorrections: ReadingLogCorrection[];
  studentRanks: StudentRankAchievement[];
  readingCertificates: ReadingCertificate[];

  getStudentRankSummary: (studentId: string) => StudentRankSummary;
  getBookReadingCoverage: (studentId: string, bookId: string) => BookReadingCoverage;
  submitReadingLog: (params: {
    studentId: string;
    loanId: string;
    bookId: string;
    fromPage: number;
    toPage: number;
    readingDate?: string;
    studentNotes?: string;
  }) => { success: boolean; error?: string; log?: ReadingLog };
  recordReadingLogBySupervisor: (params: {
    studentId: string;
    bookId: string;
    loanId?: string;
    fromPage: number;
    toPage: number;
    readingDate?: string;
    supervisorNotes?: string;
    staffId: string;
  }) => {
    success: boolean;
    error?: string;
    log?: ReadingLog;
    pagesApproved?: number;
    newlyEarnedRanks?: string[];
  };
  approveReadingLog: (params: {
    logId: string;
    staffId: string;
  }) => { success: boolean; error?: string; pagesApproved?: number; newlyEarnedRanks?: string[] };
  rejectReadingLog: (params: {
    logId: string;
    staffId: string;
    reason: string;
  }) => { success: boolean; error?: string };
  correctReadingLog: (params: {
    logId: string;
    staffId: string;
    newFromPage: number;
    newToPage: number;
    reason: string;
  }) => { success: boolean; error?: string };
  markRankCelebrated: (studentId: string, rankId: string) => void;
  reissueCertificate: (params: {
    studentId: string;
    rankId: string;
    staffId: string;
    reason: string;
  }) => { success: boolean; error?: string; certificate?: ReadingCertificate };
  addReadingRank: (rank: Omit<ReadingRankDefinition, 'id' | 'createdAt' | 'updatedAt'>) => ReadingRankDefinition;
  updateReadingRank: (rank: ReadingRankDefinition) => void;
  deleteReadingRank: (rankId: string) => { success: boolean; error?: string };
  reorderReadingRanks: (orderedRankIds: string[]) => void;
  updateCertificateSettings: (newSettings: Partial<CertificateSettings>) => void;
  recordBookAndPagesInStudentRecord: (params: {
    studentId: string;
    bookId: string;
    loanId?: string;
    staffId?: string;
    staffName?: string;
    customPages?: number;
    notes?: string;
  }) => { success: boolean; addedPages: number };

  // Book Reading Completion Workflow
  readingCompletions: BookReadingCompletion[];
  requestReadingCompletion: (params: {
    loanId: string;
    studentId: string;
    studentNotes?: string;
  }) => { success: boolean; error?: string; completion?: BookReadingCompletion };
  approveReadingCompletion: (params: {
    completionId: string;
    staffId: string;
    staffName: string;
    adminNotes?: string;
  }) => { success: boolean; error?: string };
  setReadingCompletionUnderReview: (params: {
    completionId: string;
    staffId: string;
    staffName: string;
  }) => { success: boolean; error?: string };
  returnReadingCompletionForRevision: (params: {
    completionId: string;
    staffId: string;
    staffName: string;
    reason: string;
    adminNotes?: string;
  }) => { success: boolean; error?: string };
  rejectReadingCompletion: (params: {
    completionId: string;
    staffId: string;
    staffName: string;
    reason: string;
    adminNotes?: string;
  }) => { success: boolean; error?: string };
  updateReadingCompletionAdminNotes: (params: {
    completionId: string;
    adminNotes: string;
  }) => { success: boolean; error?: string };

  // Return & Exchange Requests
  submitReturnRequest: (loanId: string, studentNotes?: string) => { success: boolean; error?: string; request?: ReturnRequest };
  cancelReturnRequest: (requestId: string) => { success: boolean; error?: string };
  updateReturnRequestStatus: (params: {
    requestId: string;
    status: ReturnRequestStatus;
    rejectionReason?: string;
    scheduledPickupTime?: string;
    staffId: string;
    conditionRating?: ConditionRating;
    inspectionNotes?: string;
  }) => { success: boolean; error?: string };

  submitExchangeRequest: (oldLoanId: string, newBookId: string, studentNotes?: string) => { success: boolean; error?: string; request?: ExchangeRequest };
  cancelExchangeRequest: (requestId: string) => { success: boolean; error?: string };
  updateExchangeRequestStatus: (params: {
    requestId: string;
    status: ExchangeRequestStatus;
    rejectionReason?: string;
    scheduledPickupTime?: string;
    staffId: string;
    assignedNewCopyId?: string;
    conditionRating?: ConditionRating;
    inspectionNotes?: string;
    oldCopyCondition?: ConditionRating;
    oldCopyNotes?: string;
  }) => { success: boolean; error?: string };

  // Student-Supervisor/Admin Internal Messaging
  chatSettings: ChatNotificationSettings;
  chatOutbox: ChatQueuedMessage[];
  isChatOnline: boolean;
  updateChatSettings: (newSettings: Partial<ChatNotificationSettings>) => void;
  getActiveChatSupervisors: () => StaffUser[];
  createOrGetConversation: (params: {
    studentId: string;
    recipientType: ChatRecipientType;
    supervisorId?: string;
  }) => { success: boolean; error?: string; conversation?: Conversation };
  sendChatMessage: (params: {
    conversationId?: string;
    studentId: string;
    recipientType?: ChatRecipientType;
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
    clientMessageId?: string;
  }) => Promise<{ success: boolean; error?: string; message?: ChatMessage; conversation?: Conversation }>;
  retryChatMessage: (messageId: string) => Promise<{ success: boolean; error?: string }>;
  flushChatOutbox: () => Promise<void>;
  markConversationAsRead: (conversationId: string, readerType: 'student' | 'supervisor' | 'admin') => void;
  markConversationDelivered: (conversationId: string, receiverType: 'student' | 'supervisor' | 'admin') => void;
  updateConversationStatus: (params: {
    conversationId: string;
    status: ConversationStatus;
    actorId: string;
    actorType: 'admin' | 'supervisor' | 'student';
    actorName: string;
    reason?: string;
  }) => { success: boolean; error?: string };
  togglePinConversation: (conversationId: string, staffId: string, staffName: string) => { success: boolean; error?: string };
  toggleFollowUpConversation: (conversationId: string, staffId: string, staffName: string) => { success: boolean; error?: string };
  transferConversationToAdmin: (params: {
    conversationId: string;
    fromStaffId: string;
    fromStaffName: string;
    fromRole: 'admin' | 'supervisor';
    reason?: string;
  }) => { success: boolean; error?: string };
  softDeleteChatMessage: (params: {
    messageId: string;
    deletedById: string;
    deletedByType: 'admin' | 'supervisor' | 'student';
    deletedByName: string;
    reason?: string;
  }) => { success: boolean; error?: string };
  toggleMessageReaction: (messageId: string, emoji: string, userId: string) => void;
  updateConversationPresence: (conversationId: string, actorType: 'student' | 'staff') => void;

  // Getters
  getBookCopies: (bookId: string) => BookCopy[];
  getAvailableCopies: (bookId: string) => BookCopy[];
  getStudentActiveLoans: (studentId: string) => Loan[];
  getStudentReservations: (studentId: string) => Reservation[];
  getStudentReadingHistory: (studentId: string) => Loan[];
  isStudentEligibleForLoan: (studentId: string) => { eligible: boolean; reason?: string };

  // Operations
  checkoutBook: (
    paramsOrCopyId:
      | {
          copyId: string;
          studentId: string;
          supervisorId: string;
          conditionRating?: ConditionRating;
          conditionNotes?: string;
          photos?: string[];
        }
      | string,
    studentId?: string,
    supervisorId?: string,
    conditionNotes?: string,
    conditionRating?: ConditionRating,
    photos?: string[]
  ) => { success: boolean; error?: string; loan?: Loan };

  returnBook: (params: {
    loanId: string;
    supervisorId: string;
    conditionRating: ConditionRating;
    details?: string;
    photos?: string[];
    sendToReturnShelf?: boolean;
  }) => { success: boolean; error?: string };

  extendLoan: (loanId: string, requestedBy?: string) => { success: boolean; error?: string; newDueDate?: string };
  approveReturnInspection: (copyId: string, condition: ConditionRating, shelfLocation: string, supervisorId: string) => void;

  // Book & Copies & Categories
  addCategory: (category: Omit<Category, 'id' | 'displayOrder'>) => Category;
  updateCategory: (category: Category) => void;
  addBook: (bookData: Omit<Book, 'id' | 'totalCopiesCount' | 'availableCopiesCount' | 'createdAt'>, numberOfCopies: number, shelf: string) => Book;
  updateBook: (book: Book) => void;
  deleteBook: (bookId: string) => void;
  addCopy: (bookId: string, shelfLocation?: string) => BookCopy;
  updateCopy: (copy: BookCopy) => void;

  // Students & Secure Access Credentials
  issuedStudentCredentials: Record<string, EphemeralStudentCredential>;
  isStudentCodeAvailable: (code: string, excludeStudentId?: string) => boolean;
  addStudent: (
    data: Omit<Student, 'id' | 'totalBooksRead' | 'currentActiveLoans' | 'createdAt' | 'qrToken' | 'accessCodeHash'> & {
      customAccessCode?: string;
    }
  ) => Student;
  bulkAddStudents: (newStudents: Student[], credentials?: EphemeralStudentCredential[]) => void;
  updateStudent: (student: Student) => void;
  regenerateStudentCode: (studentId: string, customAccessCode?: string) => { rawCode: string; qrToken: string };
  resetStudentAccessCode: (params: {
    studentId: string;
    customStudentCode?: string;
    customAccessCode?: string;
    regenerateQr?: boolean;
    staffId?: string;
  }) => { success: boolean; error?: string; credential?: EphemeralStudentCredential };
  reissueStudentQrToken: (params: {
    studentId: string;
    staffId?: string;
    reason?: string;
  }) => { success: boolean; error?: string; student?: Student };
  revokeStudentQrToken: (params: {
    studentId: string;
    staffId?: string;
    reason?: string;
  }) => { success: boolean; error?: string; student?: Student };
  toggleStudentQrLogin: (params: {
    studentId: string;
    enabled: boolean;
    staffId?: string;
  }) => { success: boolean; error?: string; student?: Student };
  batchGenerateStudentCredentials: (params: {
    studentIds: string[];
    regenerateStudentCodes?: boolean;
    staffId?: string;
  }) => { success: boolean; credentials: EphemeralStudentCredential[] };

  // Reservations
  requestReservation: (bookId: string, studentId: string, notes?: string) => { success: boolean; error?: string; reservation?: Reservation };
  updateReservationStatus: (reservationId: string, status: ReservationStatus, staffId?: string, assignedCopyId?: string) => void;

  // Inventory
  createInventorySession: (title: string, supervisorId: string) => InventorySession;
  recordInventoryScan: (sessionId: string, code: string, supervisorId: string) => { success: boolean; result: string; message: string };
  completeInventorySession: (sessionId: string, notes?: string) => void;

  // Audit & Settings
  logAudit: (log: Omit<AuditLog, 'id' | 'createdAt'>) => void;
  updateSettings: (newSettings: Partial<LibrarySettings>, meta?: { staffId?: string; staffName?: string; summary?: string }) => void;
  rollbackSettingsSnapshot: (snapshotId: string, meta?: { staffId?: string; staffName?: string }) => { success: boolean; error?: string };
  exportDatabaseBackup: () => string;
  importDatabaseBackup: (jsonContent: string) => { success: boolean; error?: string };
  resetToDefaults: () => void;
  clearAllData: (options?: { keepStudents?: boolean }) => void;

  // نظام المناقشات القرائية
  discussions: ReadingDiscussion[];
  discussionGroups: DiscussionGroup[];
  discussionSettings: DiscussionSettings;
  getStudentDiscussionPoints: (studentId: string) => number;
  canStaffApproveDiscussion: (staffMember?: StaffUser | null) => boolean;
  requestDiscussion: (params: { loanId: string; bookId: string; studentId: string; rediscussionReason?: string }) => { success: boolean; error?: string; discussion?: ReadingDiscussion };
  scheduleDiscussion: (params: { discussionId: string; supervisorId: string; scheduledDate: string; scheduledNote?: string }) => { success: boolean; error?: string };
  recordDiscussionResult: (params: {
    discussionId: string;
    supervisorId: string;
    discussionSummary?: string;
    evaluation: DiscussionEvaluationItem[];
    studentBenefit: string;
    notes: string;
    recommendations?: string;
    templateId?: string;
    templateName?: string;
    autoApproveIfAllowed?: boolean;
  }) => { success: boolean; error?: string };
  approveDiscussion: (params: { discussionId: string; staffId: string; pointsAwarded?: number }) => { success: boolean; error?: string };
  requestRediscussion: (params: { discussionId: string; staffId: string; reason: string }) => { success: boolean; error?: string };
  cancelDiscussion: (params: { discussionId: string; staffId: string; reason: string }) => { success: boolean; error?: string };
  createDiscussionGroup: (params: { bookId: string; supervisorId: string; title: string; studentIds: string[]; scheduledDate?: string; scheduledNote?: string }) => { success: boolean; error?: string; group?: DiscussionGroup };
  updateDiscussionSettings: (settings: Partial<DiscussionSettings>) => void;

  // نظام التقارير وإعداداتها والموظفين
  reportSettings: ReportSettings;
  groupReportSummaries: GroupSupervisorReportSummary[];
  studentReportNotes: StudentReportRecommendationNote[];
  updateReportSettings: (newSettings: Partial<ReportSettings>) => void;
  saveGroupReportSummary: (summary: Omit<GroupSupervisorReportSummary, 'id' | 'updatedAt'>) => GroupSupervisorReportSummary;
  saveStudentReportNote: (note: Omit<StudentReportRecommendationNote, 'id' | 'updatedAt'>) => StudentReportRecommendationNote;
  addStaffMember: (staffMember: StaffUser) => void;
  updateStaffMember: (staffMember: StaffUser) => void;

  // نظام الاختبارات الإلكترونية
  exams: ElectronicExam[];
  examAttempts: ExamAttempt[];
  createExam: (examData: Omit<ElectronicExam, 'id' | 'code' | 'createdAt' | 'updatedAt'>) => { success: boolean; error?: string; exam?: ElectronicExam };
  updateExam: (examId: string, updates: Partial<ElectronicExam>) => { success: boolean; error?: string };
  deleteExam: (examId: string) => { success: boolean; error?: string };
  publishExam: (examId: string) => { success: boolean; error?: string };
  pauseExam: (examId: string, isPaused: boolean) => { success: boolean; error?: string };
  extendExamDuration: (examId: string, additionalMinutes: number) => { success: boolean; error?: string };
  duplicateExam: (examId: string) => { success: boolean; error?: string; exam?: ElectronicExam };
  startExamAttempt: (examId: string, studentId: string) => { success: boolean; error?: string; attempt?: ExamAttempt };
  saveExamAttemptProgress: (attemptId: string, answers: Record<string, StudentQuestionAnswer>) => void;
  submitExamAttempt: (attemptId: string, answers: Record<string, StudentQuestionAnswer>) => { success: boolean; error?: string; attempt?: ExamAttempt };
  gradeAttemptQuestion: (attemptId: string, questionId: string, awardedPoints: number, comment?: string) => { success: boolean; error?: string };
  approveAndFinalizeAttempt: (attemptId: string, supervisorFeedback?: string, staffId?: string) => { success: boolean; error?: string };
}

const STORAGE_KEY = 'wathba_library_data_v1';

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // الحالة التفاعلية لكامل المنظومة
  const [settings, setSettings] = useState<LibrarySettings>(() => {
    const loaded = loadInitial('settings', initialSettings);
    if (loaded) {
      const needsMigration =
        loaded.libraryName === 'مكتبة وثبة الذكية' ||
        loaded.libraryName === 'مكتبة مداد الذكية' ||
        !loaded.libraryName ||
        !loaded.logoUrl;
      if (needsMigration) {
        return {
          ...loaded,
          libraryName: 'مكتبة مداد',
          libraryEnglishName: 'MIDAD Library',
          teamName: 'مداد | MIDAD',
          logoUrl: loaded.logoUrl || '/midad-logo.jpg',
          welcomeMessage: loaded.welcomeMessage?.replace('وثبة', 'مداد') || initialSettings.welcomeMessage,
        };
      }
    }
    return loaded;
  });
  const [categories, setCategories] = useState<Category[]>(() => loadInitial('categories', initialCategories));
  const [books, setBooks] = useState<Book[]>(() => loadInitial('books', initialBooks));
  const [copies, setCopies] = useState<BookCopy[]>(() => loadInitial('copies', initialCopies));
  const [students, setStudents] = useState<Student[]>(() => {
    const raw = loadInitial('students', initialStudents);
    return migrateStudentsPool(Array.isArray(raw) ? raw : initialStudents).students;
  });
  const [issuedStudentCredentials, setIssuedStudentCredentials] = useState<
    Record<string, EphemeralStudentCredential>
  >({});
  const [staff, setStaff] = useState<StaffUser[]>(() => loadInitial('staff', initialStaff));
  const [reservations, setReservations] = useState<Reservation[]>(() => loadInitial('reservations', initialReservations));
  const [loans, setLoans] = useState<Loan[]>(() => loadInitial('loans', initialLoans));
  const [loanEvents, setLoanEvents] = useState<LoanEvent[]>(() => loadInitial('loanEvents', initialLoanEvents));
  const [conditionReports, setConditionReports] = useState<ConditionReport[]>(() => loadInitial('conditionReports', initialConditionReports));
  const [inventorySessions, setInventorySessions] = useState<InventorySession[]>(() => loadInitial('inventorySessions', []));
  const [inventoryScans, setInventoryScans] = useState<InventoryScan[]>(() => loadInitial('inventoryScans', []));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => loadInitial('auditLogs', initialAuditLogs));
  const [readingChallenges, setReadingChallenges] = useState<ReadingChallenge[]>(() => loadInitial('readingChallenges', initialReadingChallenges));
  const [waitlist, setWaitlist] = useState<BookWaitlist[]>(() => loadInitial('waitlist', []));
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>(() => loadInitial('returnRequests', initialReturnRequests));
  const [exchangeRequests, setExchangeRequests] = useState<ExchangeRequest[]>(() => loadInitial('exchangeRequests', initialExchangeRequests));
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const raw = loadInitial('conversations', initialConversations);
    return Array.isArray(raw) ? raw.map(normalizeConversation) : initialConversations;
  });
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const raw = loadInitial('messages', initialMessages);
    return Array.isArray(raw) ? raw.map(normalizeMessage) : initialMessages;
  });
  const [chatSettings, setChatSettings] = useState<ChatNotificationSettings>(() => loadChatSettings());
  const [chatOutbox, setChatOutbox] = useState<ChatQueuedMessage[]>(() => loadChatOutbox());
  const [isChatOnline, setIsChatOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const conversationsRef = useRef<Conversation[]>(conversations);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const staffRef = useRef<StaffUser[]>(staff);
  const studentsRef = useRef<Student[]>(students);
  const chatSettingsRef = useRef<ChatNotificationSettings>(chatSettings);
  conversationsRef.current = conversations;
  messagesRef.current = messages;
  staffRef.current = staff;
  studentsRef.current = students;
  chatSettingsRef.current = chatSettings;
  const lastPersistErrorRef = useRef<string | null>(null);
  const skipNextBroadcastRef = useRef<boolean>(false);
  const skipNextPersistWriteRef = useRef<boolean>(false);
  const lastWrittenJsonRef = useRef<string | null>(null);
  const latestDataToSaveRef = useRef<Record<string, any>>({});
  const [readingRanks, setReadingRanks] = useState<ReadingRankDefinition[]>(() => loadInitial('readingRanks', initialReadingRanks));
  const [certificateSettings, setCertificateSettings] = useState<CertificateSettings>(() => loadInitial('certificateSettings', initialCertificateSettings));
  const [achievementSettings, setAchievementSettings] = useState<AchievementSettings>(() => loadInitial('achievementSettings', initialAchievementSettings));
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>(() => {
    const rawLogs: any[] = loadInitial('readingLogs', initialReadingLogs);
    return (rawLogs || []).map((l) => ({
      ...l,
      readingDate:
        l.readingDate ||
        (l.createdAt ? String(l.createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10)),
    }));
  });
  const [readingLogCorrections, setReadingLogCorrections] = useState<ReadingLogCorrection[]>(() => loadInitial('readingLogCorrections', initialReadingLogCorrections));
  const [studentRanks, setStudentRanks] = useState<StudentRankAchievement[]>(() => loadInitial('studentRanks', initialStudentRanks));
  const [readingCertificates, setReadingCertificates] = useState<ReadingCertificate[]>(() => loadInitial('readingCertificates', initialReadingCertificates));

  // نظام المناقشات القرائية والتقارير
  const [discussions, setDiscussions] = useState<ReadingDiscussion[]>(() => loadInitial('discussions', initialDiscussions));
  const [discussionGroups, setDiscussionGroups] = useState<DiscussionGroup[]>(() => loadInitial('discussionGroups', initialDiscussionGroups));
  const [discussionSettingsState, setDiscussionSettingsState] = useState<DiscussionSettings>(() => loadInitial('discussionSettings', initialDiscussionSettings));
  const [reportSettings, setReportSettings] = useState<ReportSettings>(() => loadInitial('reportSettings', initialReportSettings));
  const [groupReportSummaries, setGroupReportSummaries] = useState<GroupSupervisorReportSummary[]>(() => loadInitial('groupReportSummaries', initialGroupReportSummaries));
  const [studentReportNotes, setStudentReportNotes] = useState<StudentReportRecommendationNote[]>(() => loadInitial('studentReportNotes', initialStudentReportNotes));

  // نظام الاختبارات الإلكترونية
  const [exams, setExams] = useState<ElectronicExam[]>(() => loadInitial('exams', initialExams));
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>(() => loadInitial('examAttempts', initialExamAttempts));

  // نظام توثيق إكمال قراءة الكتب
  const [readingCompletions, setReadingCompletions] = useState<BookReadingCompletion[]>(() => loadInitial('readingCompletions', initialReadingCompletions));

  // استرجاع البيانات من التخزين المستمر
  function loadInitial(key: string, fallback: any) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed[key] !== undefined) return parsed[key];
      }
    } catch (e) {
      console.warn(`Failed loading ${key} from storage:`, e);
    }
    return fallback;
  }

  const currentDataSnapshot = {
    settings,
    categories,
    books,
    copies,
    students,
    staff,
    reservations,
    loans,
    loanEvents,
    conditionReports,
    inventorySessions,
    inventoryScans,
    auditLogs,
    readingChallenges,
    waitlist,
    returnRequests,
    exchangeRequests,
    conversations,
    messages,
    readingRanks,
    certificateSettings,
    achievementSettings,
    readingLogs,
    readingLogCorrections,
    studentRanks,
    readingCertificates,
    discussions,
    discussionGroups,
    discussionSettings: discussionSettingsState,
    reportSettings,
    groupReportSummaries,
    studentReportNotes,
    exams,
    examAttempts,
    readingCompletions,
  };
  latestDataToSaveRef.current = currentDataSnapshot;

  const persistChatSnapshotNow = useCallback(
    (nextConversations: Conversation[], nextMessages: ChatMessage[]): { ok: boolean; error?: string } => {
      try {
        let baseData: Record<string, any> = latestDataToSaveRef.current;
        try {
          const existingRaw = localStorage.getItem(STORAGE_KEY);
          if (existingRaw) {
            baseData = { ...JSON.parse(existingRaw), ...baseData };
          }
        } catch {
          // ignore parse failure on existing storage, overwrite with current state
        }
        const merged = {
          ...baseData,
          conversations: nextConversations,
          messages: nextMessages,
        };
        const serialized = JSON.stringify(merged);
        localStorage.setItem(STORAGE_KEY, serialized);
        lastWrittenJsonRef.current = serialized;
        lastPersistErrorRef.current = null;
        return { ok: true };
      } catch (e: any) {
        const errMsg =
          e?.name === 'QuotaExceededError'
            ? 'تعذّر حفظ الرسالة: مساحة التخزين المحلي في المتصفح ممتلئة.'
            : e?.message || 'تعذّر حفظ البيانات في التخزين المحلي.';
        lastPersistErrorRef.current = errMsg;
        return { ok: false, error: errMsg };
      }
    },
    []
  );

  // حفظ التغييرات فوراً في قاعدة البيانات المحلية المستمرة
  useEffect(() => {
    if (skipNextPersistWriteRef.current) {
      skipNextPersistWriteRef.current = false;
      skipNextBroadcastRef.current = false;
      return;
    }
    try {
      const serialized = JSON.stringify(currentDataSnapshot);
      if (lastWrittenJsonRef.current === serialized) {
        skipNextBroadcastRef.current = false;
        return;
      }
      localStorage.setItem(STORAGE_KEY, serialized);
      lastWrittenJsonRef.current = serialized;
      lastPersistErrorRef.current = null;
      if (!skipNextBroadcastRef.current) {
        broadcastChatEvent({
          type: 'LIBRARY_DATA_UPDATED',
          sourceTabId: TAB_INSTANCE_ID,
          updatedAt: new Date().toISOString(),
        });
      }
      skipNextBroadcastRef.current = false;
    } catch (e: any) {
      lastPersistErrorRef.current =
        e?.name === 'QuotaExceededError'
          ? 'تعذّر حفظ الرسالة: مساحة التخزين المحلي في المتصفح ممتلئة.'
          : e?.message || 'تعذّر حفظ البيانات في التخزين المحلي.';
      console.error('Failed to persist library data:', e);
    }
  }, [
    settings,
    categories,
    books,
    copies,
    students,
    staff,
    reservations,
    loans,
    loanEvents,
    conditionReports,
    inventorySessions,
    inventoryScans,
    auditLogs,
    readingChallenges,
    waitlist,
    returnRequests,
    exchangeRequests,
    conversations,
    messages,
    readingRanks,
    certificateSettings,
    achievementSettings,
    readingLogs,
    readingLogCorrections,
    studentRanks,
    readingCertificates,
    discussions,
    discussionGroups,
    discussionSettingsState,
    reportSettings,
    groupReportSummaries,
    studentReportNotes,
    exams,
    examAttempts,
    readingCompletions,
  ]);

  // تحديث عدادات النسخ للكتب تلقائياً
  useEffect(() => {
    setBooks((prevBooks) =>
      prevBooks.map((b) => {
        const bCopies = copies.filter((c) => c.bookId === b.id);
        const availCopies = bCopies.filter((c) => c.status === 'available');
        return {
          ...b,
          totalCopiesCount: bCopies.length,
          availableCopiesCount: availCopies.length,
        };
      })
    );
  }, [copies]);

  // المزامنة المركزية المباشرة مع قاعدة البيانات السحابية Supabase لجلب وتحديث كافة السجلات
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let isMounted = true;

    // 1. جلب الحالة الكاملة المحدثة من قاعدة البيانات السحابية المركزية عند بدء التشغيل
    (async () => {
      try {
        const fullCloud = await fetchFullCloudState();
        if (fullCloud && isMounted) {
          if (Array.isArray(fullCloud.students) && fullCloud.students.length > 0) {
            setStudents((prev) => {
              const cloudIds = new Set(fullCloud.students.map((s: any) => s.id));
              const cloudCodes = new Set(fullCloud.students.map((s: any) => s.internalId.toUpperCase()));
              const localOnly = prev.filter(
                (p) => !cloudIds.has(p.id) && !cloudCodes.has(p.internalId.toUpperCase())
              );
              return [...fullCloud.students, ...localOnly];
            });
          }
          if (Array.isArray(fullCloud.books) && fullCloud.books.length > 0) {
            setBooks(fullCloud.books);
          }
          if (Array.isArray(fullCloud.copies) && fullCloud.copies.length > 0) {
            setCopies(fullCloud.copies);
          }
          if (Array.isArray(fullCloud.categories) && fullCloud.categories.length > 0) {
            setCategories(fullCloud.categories);
          }
          if (Array.isArray(fullCloud.loans) && fullCloud.loans.length > 0) {
            setLoans(fullCloud.loans);
          }
          if (Array.isArray(fullCloud.reservations) && fullCloud.reservations.length > 0) {
            setReservations(fullCloud.reservations);
          }
        }
      } catch (err) {
        console.warn('فشل جلب الحالة السحابية المبدئية:', err);
      }
    })();

    // 2. الاستماع اللحظي المباشر عبر Supabase Realtime لأي إضافة أو تعديل من أي جهاز آخر في العالم
    const unsubscribeSync = centralSync.subscribeToSyncEvents((event) => {
      if (!isMounted || !event || !event.entity) return;

      const { entity, action, data, recordId } = event;

      if (entity === 'students' && data) {
        setStudents((prev) => {
          if (action === 'DELETE') {
            return prev.filter((s) => s.id !== (recordId || data.id));
          }
          const exists = prev.some((s) => s.id === data.id);
          return exists ? prev.map((s) => (s.id === data.id ? { ...s, ...data } : s)) : [data, ...prev];
        });
      } else if (entity === 'books' && data) {
        setBooks((prev) => {
          if (action === 'DELETE') {
            return prev.filter((b) => b.id !== (recordId || data.id));
          }
          const exists = prev.some((b) => b.id === data.id);
          return exists ? prev.map((b) => (b.id === data.id ? { ...b, ...data } : b)) : [data, ...prev];
        });
      } else if (entity === 'copies' && data) {
        setCopies((prev) => {
          if (action === 'DELETE') {
            return prev.filter((c) => c.id !== (recordId || data.id));
          }
          const exists = prev.some((c) => c.id === data.id);
          return exists ? prev.map((c) => (c.id === data.id ? { ...c, ...data } : c)) : [data, ...prev];
        });
      } else if (entity === 'loans' && data) {
        setLoans((prev) => {
          if (action === 'DELETE') {
            return prev.filter((l) => l.id !== (recordId || data.id));
          }
          const exists = prev.some((l) => l.id === data.id);
          return exists ? prev.map((l) => (l.id === data.id ? { ...l, ...data } : l)) : [data, ...prev];
        });
      } else if (entity === 'reservations' && data) {
        setReservations((prev) => {
          if (action === 'DELETE') {
            return prev.filter((r) => r.id !== (recordId || data.id));
          }
          const exists = prev.some((r) => r.id === data.id);
          return exists ? prev.map((r) => (r.id === data.id ? { ...r, ...data } : r)) : [data, ...prev];
        });
      } else if (entity === 'settings' && data) {
        setSettings((prev) => ({ ...prev, ...data }));
      }
    });

    return () => {
      isMounted = false;
      unsubscribeSync();
    };
  }, []);

  // Getters
  const getBookCopies = (bookId: string) => copies.filter((c) => c.bookId === bookId);
  const getAvailableCopies = (bookId: string) => copies.filter((c) => c.bookId === bookId && c.status === 'available');
  const getStudentActiveLoans = (studentId: string) => loans.filter((l) => l.studentId === studentId && l.status === 'active');
  const getStudentReservations = (studentId: string) => reservations.filter((r) => r.studentId === studentId);
  const getStudentReadingHistory = (studentId: string) => loans.filter((l) => l.studentId === studentId && l.status === 'returned');

  const isStudentEligibleForLoan = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return { eligible: false, reason: 'الطالب غير مسجل في النظام' };
    if (student.status !== 'active') return { eligible: false, reason: 'حساب الطالب معلق أو مؤرشف' };

    const activeLoans = loans.filter((l) => l.studentId === studentId && l.status === 'active');
    if (activeLoans.length >= settings.maxLoansPerStudent) {
      return {
        eligible: false,
        reason: `تجاوز الطالب الحد الأقصى للإعارة المسموح به (${settings.maxLoansPerStudent} كتب)`,
      };
    }

    if (settings.blockLoanIfOverdue) {
      const hasOverdue = activeLoans.some((l) => isOverdue(l.dueDate));
      if (hasOverdue) {
        return { eligible: false, reason: 'يوجد لدى الطالب كتاب متأخر لم يتم إرجاعه بعد' };
      }
    }

    return { eligible: true };
  };

  // تسجيل التدقيق
  const logAudit = (log: Omit<AuditLog, 'id' | 'createdAt'>) => {
    const newLog: AuditLog = {
      ...log,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      createdAt: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // عمليات الإعارة الذكية
  const checkoutBook = (
    paramsOrCopyId:
      | {
          copyId: string;
          studentId: string;
          supervisorId: string;
          conditionRating?: ConditionRating;
          conditionNotes?: string;
          photos?: string[];
        }
      | string,
    studentIdArg?: string,
    supervisorIdArg?: string,
    conditionNotesArg?: string,
    conditionRatingArg?: ConditionRating,
    photosArg?: string[]
  ) => {
    let copyId: string;
    let studentId: string;
    let supervisorId: string;
    let conditionRating: ConditionRating = 'good';
    let conditionNotes = '';
    let photos: string[] = [];

    if (typeof paramsOrCopyId === 'object' && paramsOrCopyId !== null) {
      copyId = paramsOrCopyId.copyId;
      studentId = paramsOrCopyId.studentId;
      supervisorId = paramsOrCopyId.supervisorId;
      if (paramsOrCopyId.conditionRating) conditionRating = paramsOrCopyId.conditionRating;
      if (paramsOrCopyId.conditionNotes) conditionNotes = paramsOrCopyId.conditionNotes;
      if (paramsOrCopyId.photos) photos = paramsOrCopyId.photos;
    } else {
      copyId = paramsOrCopyId;
      studentId = studentIdArg || '';
      supervisorId = supervisorIdArg || '';
      if (conditionNotesArg) conditionNotes = conditionNotesArg;
      if (conditionRatingArg) conditionRating = conditionRatingArg;
      if (photosArg) photos = photosArg;
    }

    // إيجاد النسخة بالمعرّف أو الرمز لضمان المرونة التامة
    const copy = copies.find(
      (c) => c.id === copyId || c.copyCode.toLowerCase() === (copyId || '').toLowerCase() || c.qrData === copyId
    );
    if (!copy) return { success: false, error: 'النسخة غير موجودة في قاعدة البيانات' };

    // استخدام المعرف الحقيقي للنسخة
    const actualCopyId = copy.id;

    if (copy.status !== 'available' && copy.status !== 'reserved' && copy.status !== 'in_preparation') {
      return { success: false, error: `النسخة غير متاحة للإعارة حالياً (حالتها: ${copy.status})` };
    }

    const eligibility = isStudentEligibleForLoan(studentId);
    if (!eligibility.eligible) {
      return { success: false, error: eligibility.reason };
    }

    const student = students.find((s) => s.id === studentId);
    const supervisor = staff.find((st) => st.id === supervisorId);
    const book = books.find((b) => b.id === copy.bookId);

    const loanId = `loan-${Date.now()}`;
    const loanDate = new Date().toISOString();
    const dueDate = addDaysToCurrent(settings.loanDurationDays);

    const newLoan: Loan = {
      id: loanId,
      copyId: actualCopyId,
      studentId,
      supervisorId,
      loanDate,
      dueDate,
      status: 'active',
      renewalCount: 0,
      notes: conditionNotes,
    };

    // تحديث حالة النسخة
    setCopies((prev) =>
      prev.map((c) => (c.id === actualCopyId ? { ...c, status: 'borrowed' as CopyStatus } : c))
    );

    // تحديث عدد إعارات الطالب
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, currentActiveLoans: s.currentActiveLoans + 1 } : s))
    );

    // إضافة الإعارة
    setLoans((prev) => [newLoan, ...prev]);

    // تسجيل حدث الإعارة
    const newEvent: LoanEvent = {
      id: `event-${Date.now()}`,
      loanId,
      eventType: 'checkout',
      staffId: supervisorId,
      notes: `تسليم كتاب "${book?.title}" (نسخة ${copy.copyCode}) للطالب ${student?.fullName}`,
      createdAt: loanDate,
    };
    setLoanEvents((prev) => [newEvent, ...prev]);

    // توثيق حالة النسخة عند الاستلام
    const reportId = `rep-${Date.now()}`;
    const newReport: ConditionReport = {
      id: reportId,
      copyId: actualCopyId,
      loanId,
      studentId,
      staffId: supervisorId,
      stage: 'checkout',
      rating: conditionRating,
      details: conditionNotes || 'تسليم معتمد بالمسح الذكي',
      photos: photos.map((p, idx) => ({
        id: `photo-${reportId}-${idx}`,
        reportId,
        photoUrl: p,
        photoType: 'cover',
        createdAt: loanDate,
      })),
      createdAt: loanDate,
    };
    setConditionReports((prev) => [newReport, ...prev]);

    // تحديث أي حجز مسبق مرتبط
    setReservations((prev) =>
      prev.map((r) =>
        r.studentId === studentId && (r.bookId === copy.bookId || r.assignedCopyId === actualCopyId) && r.status !== 'fulfilled'
          ? { ...r, status: 'fulfilled' as ReservationStatus }
          : r
      )
    );

    // تسجيل التدقيق
    logAudit({
      actorId: supervisorId,
      actorType: 'supervisor',
      actorName: supervisor?.fullName || 'مشرف المكتبة',
      action: 'تسليم كتاب',
      entityType: 'loan',
      entityId: loanId,
      notes: `تسليم النسخة ${copy.copyCode} للطالب ${student?.fullName}`,
      newState: { loanId, copyId: actualCopyId, studentId, dueDate },
    });

    centralSync.broadcastMutation({ entity: 'loans', action: 'INSERT', data: newLoan, recordId: newLoan.id });
    syncEntityRecordToSupabase('loans', newLoan).catch(() => {});
    centralSync.broadcastMutation({ entity: 'copies', action: 'UPDATE', data: { id: actualCopyId, status: 'borrowed' }, recordId: actualCopyId });

    return { success: true, loan: newLoan };
  };

  // استرجاع كتاب وتوثيق حالته
  const returnBook = ({
    loanId,
    supervisorId,
    conditionRating,
    details = '',
    photos = [],
    sendToReturnShelf = true,
  }: {
    loanId: string;
    supervisorId: string;
    conditionRating: ConditionRating;
    details?: string;
    photos?: string[];
    sendToReturnShelf?: boolean;
  }) => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan || loan.status !== 'active') {
      return { success: false, error: 'سجل الإعارة غير نشط أو تمت إعادته مسبقاً' };
    }

    const copy = copies.find((c) => c.id === loan.copyId);
    const student = students.find((s) => s.id === loan.studentId);
    const supervisor = staff.find((s) => s.id === supervisorId);
    const returnTime = new Date().toISOString();

    // إغلاق الإعارة
    setLoans((prev) =>
      prev.map((l) =>
        l.id === loanId
          ? {
              ...l,
              status: 'returned' as const,
              returnDate: returnTime,
              returnedToSupervisorId: supervisorId,
            }
          : l
      )
    );

    // تحديث حالة النسخة بناءً على الفحص
    let nextStatus: CopyStatus = 'available';
    if (conditionRating === 'damaged') {
      nextStatus = 'damaged';
    } else if (conditionRating === 'lost') {
      nextStatus = 'lost';
    } else if (sendToReturnShelf) {
      nextStatus = 'under_inspection'; // تذهب لرف الإرجاع أولاً
    }

    setCopies((prev) =>
      prev.map((c) =>
        c.id === loan.copyId ? { ...c, status: nextStatus, condition: conditionRating } : c
      )
    );

    // تحديث إحصائيات الطالب
    setStudents((prev) =>
      prev.map((s) =>
        s.id === loan.studentId
          ? {
              ...s,
              currentActiveLoans: Math.max(0, s.currentActiveLoans - 1),
              totalBooksRead: s.totalBooksRead + 1,
            }
          : s
      )
    );

    // توثيق تقرير الفحص مع الصور
    const reportId = `rep-${Date.now()}`;
    const report: ConditionReport = {
      id: reportId,
      copyId: loan.copyId,
      loanId,
      studentId: loan.studentId,
      staffId: supervisorId,
      stage: 'return',
      rating: conditionRating,
      details: details || `استرجاع كتاب - تقييم الفحص: ${conditionRating}`,
      photos: photos.map((p, idx) => ({
        id: `photo-${reportId}-${idx}`,
        reportId,
        photoUrl: p,
        photoType: 'damage_documentation',
        createdAt: returnTime,
      })),
      createdAt: returnTime,
    };
    setConditionReports((prev) => [report, ...prev]);

    // تسجيل حدث الاسترجاع
    const newEvent: LoanEvent = {
      id: `event-${Date.now()}`,
      loanId,
      eventType: 'return',
      staffId: supervisorId,
      notes: `استرجاع نسخة ${copy?.copyCode} من الطالب ${student?.fullName}. نتيجة الفحص: ${conditionRating}`,
      createdAt: returnTime,
    };
    setLoanEvents((prev) => [newEvent, ...prev]);

    // تدقيق
    logAudit({
      actorId: supervisorId,
      actorType: 'supervisor',
      actorName: supervisor?.fullName || 'مشرف المكتبة',
      action: 'استرجاع كتاب وفحصه',
      entityType: 'loan',
      entityId: loanId,
      notes: `تم استرجاع النسخة ${copy?.copyCode}. الحالة: ${conditionRating}`,
    });

    const updatedLoanObj = {
      ...loan,
      status: 'returned' as const,
      returnDate: returnTime,
      returnedToSupervisorId: supervisorId,
    };
    centralSync.broadcastMutation({ entity: 'loans', action: 'UPDATE', data: updatedLoanObj, recordId: loanId });
    syncEntityRecordToSupabase('loans', updatedLoanObj).catch(() => {});
    if (copy) {
      centralSync.broadcastMutation({ entity: 'copies', action: 'UPDATE', data: { id: copy.id, status: nextStatus, condition: conditionRating }, recordId: copy.id });
    }

    return { success: true };
  };

  // تمديد الإعارة
  const extendLoan = (loanId: string, requestedBy = 'student') => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan || loan.status !== 'active') {
      return { success: false, error: 'لا يمكن تمديد إعارة غير نشطة' };
    }

    if (settings.maxRenewals === 0 || loan.renewalCount >= settings.maxRenewals) {
      return {
        success: false,
        error: 'عملية تمديد الإعارة غير متاحة في النظام',
      };
    }

    const currentDue = new Date(loan.dueDate);
    currentDue.setDate(currentDue.getDate() + settings.renewalDurationDays);
    const newDueDate = currentDue.toISOString();

    setLoans((prev) =>
      prev.map((l) =>
        l.id === loanId ? { ...l, renewalCount: l.renewalCount + 1, dueDate: newDueDate } : l
      )
    );

    const newEvent: LoanEvent = {
      id: `event-${Date.now()}`,
      loanId,
      eventType: 'extend',
      notes: `تم تمديد موعد الإرجاع لمدة ${settings.renewalDurationDays} أيام إضافية بطلب من: ${requestedBy}`,
      createdAt: new Date().toISOString(),
    };
    setLoanEvents((prev) => [newEvent, ...prev]);

    logAudit({
      actorType: requestedBy === 'supervisor' ? 'supervisor' : 'student',
      actorName: requestedBy,
      action: 'تمديد إعارة',
      entityType: 'loan',
      entityId: loanId,
      notes: `تمديد حتى ${newDueDate}`,
    });

    return { success: true, newDueDate };
  };

  // اعتماد كتاب بعد الفحص ونقله من رف الإرجاع إلى متاح
  const approveReturnInspection = (
    copyId: string,
    condition: ConditionRating,
    shelfLocation: string,
    supervisorId: string
  ) => {
    setCopies((prev) =>
      prev.map((c) =>
        c.id === copyId
          ? {
              ...c,
              status: (condition === 'damaged' ? 'damaged' : 'available') as CopyStatus,
              condition,
              shelfLocation: shelfLocation || c.shelfLocation,
            }
          : c
      )
    );

    logAudit({
      actorId: supervisorId,
      actorType: 'supervisor',
      actorName: 'مشرف رف الإرجاع',
      action: 'اعتماد فحص رف الإرجاع',
      entityType: 'book_copy',
      entityId: copyId,
      notes: `تم اعتماد النسخة ونقلها إلى الرف ${shelfLocation} بحالة ${condition}`,
    });
  };

  // إدارة الكتب والنسخ
  const addBook = (
    bookData: Omit<Book, 'id' | 'totalCopiesCount' | 'availableCopiesCount' | 'createdAt'>,
    numberOfCopies: number,
    shelf: string
  ) => {
    const bookId = `book-${Date.now()}`;
    const createdAt = new Date().toISOString();

    const newBook: Book = {
      ...bookData,
      id: bookId,
      totalCopiesCount: numberOfCopies,
      availableCopiesCount: numberOfCopies,
      createdAt,
    };

    // إنشاء النسخ الورقية المستقلة بأكوادها الفريدة وQR
    // استخراج رقم تسلسلي من كود الكتاب أو تلقائي
    const baseCode = bookData.code.replace('WTH-', '').replace('WTH', '');
    const cleanNum = parseInt(baseCode, 10) || Math.floor(100 + Math.random() * 900);

    const generatedCopies: BookCopy[] = [];
    for (let i = 1; i <= numberOfCopies; i++) {
      const copyNumFormatted = String(i).padStart(3, '0');
      const copyCode = `WTH-${cleanNum}-${copyNumFormatted}`;
      const qrData = `WTH-COPY-${cleanNum}-${copyNumFormatted}-${generateSecureToken('QR')}`;

      generatedCopies.push({
        id: `copy-${bookId}-${i}`,
        bookId,
        copyCode,
        qrData,
        status: 'available',
        condition: 'pristine',
        shelfLocation: shelf || 'الرف العام',
        createdAt,
      });
    }

    setBooks((prev) => [newBook, ...prev]);
    setCopies((prev) => [...generatedCopies, ...prev]);

    centralSync.broadcastMutation({ entity: 'books', action: 'INSERT', data: newBook });
    syncEntityRecordToSupabase('books', newBook);

    logAudit({
      actorType: 'admin',
      actorName: 'إدارة المكتبة',
      action: 'إضافة كتاب ونسخ ورقية',
      entityType: 'book',
      entityId: bookId,
      notes: `إضافة كتاب "${newBook.title}" مع توليد ${numberOfCopies} نسخ ورقية برمز ${bookData.code}`,
    });

    return newBook;
  };

  const updateBook = (book: Book) => {
    setBooks((prev) => prev.map((b) => (b.id === book.id ? book : b)));
    centralSync.broadcastMutation({ entity: 'books', action: 'UPDATE', data: book, recordId: book.id });
    syncEntityRecordToSupabase('books', book);
    logAudit({
      actorType: 'admin',
      actorName: 'إدارة المكتبة',
      action: 'تعديل بيانات كتاب',
      entityType: 'book',
      entityId: book.id,
      notes: `تعديل عنوان/بيانات كتاب ${book.title}`,
    });
  };

  const deleteBook = (bookId: string) => {
    const target = books.find((b) => b.id === bookId);
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    setCopies((prev) => prev.filter((c) => c.bookId !== bookId));
    centralSync.broadcastMutation({ entity: 'books', action: 'DELETE', data: null, recordId: bookId });
    syncEntityRecordToSupabase('books', bookId, 'DELETE');
    logAudit({
      actorType: 'admin',
      actorName: 'إدارة المكتبة',
      action: 'حذف كتاب ونسخه',
      entityType: 'book',
      entityId: bookId,
      notes: `حذف كتاب ${target?.title}`,
    });
  };

  const addCopy = (bookId: string, shelfLocation = 'الرف العام') => {
    const bookCopies = copies.filter((c) => c.bookId === bookId);
    const nextIdx = bookCopies.length + 1;
    const book = books.find((b) => b.id === bookId);
    const baseCode = book ? book.code.replace('WTH-', '') : '100';
    const copyCode = `WTH-${baseCode}-${String(nextIdx).padStart(3, '0')}`;
    const qrData = `WTH-COPY-${baseCode}-${String(nextIdx).padStart(3, '0')}-${generateSecureToken('QR')}`;

    const newCopy: BookCopy = {
      id: `copy-${bookId}-${Date.now()}`,
      bookId,
      copyCode,
      qrData,
      status: 'available',
      condition: 'pristine',
      shelfLocation,
      createdAt: new Date().toISOString(),
    };

    setCopies((prev) => [newCopy, ...prev]);

    logAudit({
      actorType: 'admin',
      actorName: 'إدارة المكتبة',
      action: 'إضافة نسخة ورقية منفردة',
      entityType: 'book_copy',
      entityId: newCopy.id,
      notes: `إضافة نسخة جديدة ${copyCode} لكتاب ${book?.title}`,
    });

    return newCopy;
  };

  const updateCopy = (copy: BookCopy) => {
    setCopies((prev) => prev.map((c) => (c.id === copy.id ? copy : c)));
    logAudit({
      actorType: 'admin',
      actorName: 'إدارة المكتبة',
      action: 'تعديل حالة نسخة ورقية',
      entityType: 'book_copy',
      entityId: copy.id,
      notes: `تحديث نسخة ${copy.copyCode} إلى ${copy.status}`,
    });
  };

  // إدارة التصنيفات
  const addCategory = (catData: Omit<Category, 'id' | 'displayOrder'>): Category => {
    const newCat: Category = {
      ...catData,
      id: `cat-${Date.now()}`,
      code: catData.code.trim().toUpperCase() || `CAT-${categories.length + 1}`,
      displayOrder: categories.length + 1,
    };
    setCategories((prev) => [...prev, newCat]);
    logAudit({
      actorType: 'admin',
      actorName: 'إدارة التصنيفات',
      action: 'إضافة تصنيف كتب جديد',
      entityType: 'category',
      entityId: newCat.id,
      notes: `إضافة تصنيف "${newCat.name}" (${newCat.code})`,
    });
    return newCat;
  };

  const updateCategory = (category: Category) => {
    setCategories((prev) => prev.map((c) => (c.id === category.id ? category : c)));
    logAudit({
      actorType: 'admin',
      actorName: 'إدارة التصنيفات',
      action: 'تحديث تصنيف كتب',
      entityType: 'category',
      entityId: category.id,
      notes: `تعديل تصنيف "${category.name}"`,
    });
  };

  // إدارة الطلاب وأكواد الدخول المشفرة
  const isStudentCodeAvailable = (code: string, excludeStudentId?: string): boolean => {
    const norm = normalizeStudentCode(code);
    if (!norm) return false;
    return !students.some(
      (s) => s.id !== excludeStudentId && normalizeStudentCode(s.internalId) === norm
    );
  };

  const addStudent = (
    data: Omit<Student, 'id' | 'totalBooksRead' | 'currentActiveLoans' | 'createdAt' | 'qrToken' | 'accessCodeHash'> & {
      customAccessCode?: string;
    }
  ) => {
    const { customAccessCode, ...studentFields } = data;
    const desiredCode = normalizeStudentCode(studentFields.internalId || '');
    const uniqueCode =
      desiredCode && isStudentCodeAvailable(desiredCode)
        ? desiredCode
        : generateUniqueStudentCode(students);

    const plainPin = (customAccessCode || '').trim() || generateStudentAccessCode(6);
    const now = new Date().toISOString();
    const studentId = `stu-${Date.now()}`;

    const newQrToken = generateUniqueStudentQrToken(students);
    const newStudent = sanitizeStudentForPersistence({
      ...studentFields,
      id: studentId,
      internalId: uniqueCode,
      accessCodeHash: hashAccessCodeSync(plainPin),
      accessCodeUpdatedAt: now,
      qrToken: newQrToken,
      qrTokenHash: hashQrTokenDeterministic(newQrToken),
      qrTokenStatus: 'active',
      qrLoginEnabled: true,
      qrTokenVersion: 1,
      qrTokenIssuedAt: now,
      revokedQrTokenHashes: [],
      status: studentFields.status || 'active',
      totalBooksRead: 0,
      currentActiveLoans: 0,
      createdAt: now,
    });

    setStudents((prev) => [newStudent, ...prev]);
    centralSync.broadcastMutation({ entity: 'students', action: 'INSERT', data: newStudent, recordId: newStudent.id });
    upsertStudentToSupabase(newStudent).catch((e) => console.warn('Supabase upsert failed:', e));
    setIssuedStudentCredentials((prev) => ({
      ...prev,
      [studentId]: {
        studentId,
        studentCode: newStudent.internalId,
        fullName: newStudent.fullName,
        grade: newStudent.grade,
        groupName: newStudent.groupName,
        plainAccessCode: plainPin,
        issuedAt: now,
      },
    }));

    logAudit({
      actorType: 'admin',
      actorName: 'إدارة الطلاب',
      action: 'إضافة طالب وإصدار كود ورمز دخول مشفر',
      entityType: 'student',
      entityId: studentId,
      notes: `إضافة الطالب ${newStudent.fullName} بالكود ${newStudent.internalId} (${newStudent.grade} - ${newStudent.groupName})`,
    });

    return newStudent;
  };

  const bulkAddStudents = (newStudentsList: Student[], credentialsList?: EphemeralStudentCredential[]) => {
    const { students: cleanList } = migrateStudentsPool(newStudentsList);
    setStudents((prev) => [...cleanList, ...prev]);
    cleanList.forEach((stu) => {
      upsertStudentToSupabase(stu).catch((e) => console.warn('Supabase bulk upsert failed:', e));
    });

    if (credentialsList && credentialsList.length > 0) {
      setIssuedStudentCredentials((prev) => {
        const next = { ...prev };
        credentialsList.forEach((cred) => {
          next[cred.studentId] = cred;
        });
        return next;
      });
    }

    logAudit({
      actorType: 'admin',
      actorName: 'إدارة الطلاب',
      action: 'استيراد طلاب مجمع مع توليد أكواد الدخول المشفرة',
      entityType: 'students_bulk',
      notes: `تم استيراد ${cleanList.length} طالب بنجاح مع تشفير رموز الدخول وإنشاء بطاقات QR`,
    });
  };

  const updateStudent = (student: Student) => {
    const existing = students.find((s) => s.id === student.id);
    // نحافظ دائماً على ثبات باركود الطالب عند تعديل اسمه أو صفه أو مجموعته
    const preservedQrStudent: Student = existing
      ? {
          ...student,
          qrToken: existing.qrToken || student.qrToken,
          qrTokenHash: existing.qrTokenHash || student.qrTokenHash,
          qrTokenStatus: existing.qrTokenStatus ?? student.qrTokenStatus ?? 'active',
          qrLoginEnabled: existing.qrLoginEnabled ?? student.qrLoginEnabled ?? true,
          qrTokenVersion: existing.qrTokenVersion ?? student.qrTokenVersion ?? 1,
          qrTokenIssuedAt: existing.qrTokenIssuedAt ?? student.qrTokenIssuedAt,
          qrTokenRevokedAt: existing.qrTokenRevokedAt ?? student.qrTokenRevokedAt,
          revokedQrTokenHashes: existing.revokedQrTokenHashes ?? student.revokedQrTokenHashes ?? [],
        }
      : student;
    const clean = sanitizeStudentForPersistence(preservedQrStudent);
    setStudents((prev) => prev.map((s) => (s.id === clean.id ? clean : s)));
    centralSync.broadcastMutation({ entity: 'students', action: 'UPDATE', data: clean, recordId: clean.id });
    upsertStudentToSupabase(clean).catch((e) => console.warn('Supabase update failed:', e));
    logAudit({
      actorType: 'admin',
      actorName: 'إدارة الطلاب',
      action: 'تعديل بيانات طالب',
      entityType: 'student',
      entityId: clean.id,
      notes: `تعديل بيانات الطالب ${clean.fullName} (${clean.internalId}) — الحالة: ${clean.status}`,
    });
  };

  const resetStudentAccessCode = ({
    studentId,
    customStudentCode,
    customAccessCode,
    regenerateQr = false,
    staffId,
  }: {
    studentId: string;
    customStudentCode?: string;
    customAccessCode?: string;
    regenerateQr?: boolean;
    staffId?: string;
  }): { success: boolean; error?: string; credential?: EphemeralStudentCredential } => {
    const existing = students.find((s) => s.id === studentId);
    if (!existing) {
      return { success: false, error: 'الطالب غير موجود في السجلات' };
    }

    const nextCode = customStudentCode ? normalizeStudentCode(customStudentCode) : existing.internalId;
    if (!nextCode) {
      return { success: false, error: 'كود الطالب لا يمكن أن يكون فارغاً' };
    }
    if (!isStudentCodeAvailable(nextCode, studentId)) {
      return { success: false, error: `كود الطالب "${nextCode}" مستخدم بالفعل لطالب آخر` };
    }

    const plainPin = (customAccessCode || '').trim() || generateStudentAccessCode(6);
    if (plainPin.length < 4) {
      return { success: false, error: 'يجب أن يتكون رمز الدخول من 4 أحرف/أرقام على الأقل' };
    }

    const now = new Date().toISOString();
    const newHash = hashAccessCodeSync(plainPin);
    const oldQrHash = existing.qrTokenHash || (existing.qrToken ? hashQrTokenDeterministic(existing.qrToken) : '');
    const nextQr = regenerateQr ? generateUniqueStudentQrToken(students) : existing.qrToken;
    const nextRevokedList =
      regenerateQr && oldQrHash
        ? Array.from(new Set([...(existing.revokedQrTokenHashes || []), oldQrHash]))
        : existing.revokedQrTokenHashes || [];

    const updatedStudentObj = sanitizeStudentForPersistence({
      ...existing,
      internalId: nextCode,
      accessCodeHash: newHash,
      accessCodeUpdatedAt: now,
      failedLoginAttempts: 0,
      lockedUntil: undefined,
      qrToken: nextQr,
      qrTokenHash: hashQrTokenDeterministic(nextQr),
      qrTokenStatus: regenerateQr ? 'active' : existing.qrTokenStatus || 'active',
      qrTokenVersion: regenerateQr ? (existing.qrTokenVersion || 1) + 1 : existing.qrTokenVersion || 1,
      qrTokenIssuedAt: regenerateQr ? now : existing.qrTokenIssuedAt,
      revokedQrTokenHashes: nextRevokedList,
    });

    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? updatedStudentObj : s))
    );
    upsertStudentToSupabase(updatedStudentObj).catch((e) => console.warn('Supabase credential update failed:', e));

    const cred: EphemeralStudentCredential = {
      studentId: existing.id,
      studentCode: nextCode,
      fullName: existing.fullName,
      grade: existing.grade,
      groupName: existing.groupName,
      plainAccessCode: plainPin,
      issuedAt: now,
    };

    setIssuedStudentCredentials((prev) => ({
      ...prev,
      [studentId]: cred,
    }));

    const actor = staffId ? staff.find((st) => st.id === staffId) : undefined;
    logAudit({
      actorId: staffId,
      actorType: actor?.role || 'admin',
      actorName: actor?.fullName || 'إدارة الطلاب',
      action: 'تحديث/إعادة تعيين كود ورمز دخول الطالب',
      entityType: 'student',
      entityId: studentId,
      notes: `تم تحديث بيانات دخول الطالب ${existing.fullName} (الكود: ${nextCode}) بتجزئة آمنة`,
    });

    return { success: true, credential: cred };
  };

  const reissueStudentQrToken = ({
    studentId,
    staffId,
    reason,
  }: {
    studentId: string;
    staffId?: string;
    reason?: string;
  }): { success: boolean; error?: string; student?: Student } => {
    const existing = students.find((s) => s.id === studentId);
    if (!existing) return { success: false, error: 'الطالب غير موجود في السجلات' };

    const now = new Date().toISOString();
    const oldHash = existing.qrTokenHash || (existing.qrToken ? hashQrTokenDeterministic(existing.qrToken) : '');
    const revokedHashes = oldHash
      ? Array.from(new Set([...(existing.revokedQrTokenHashes || []), oldHash]))
      : existing.revokedQrTokenHashes || [];

    const newQr = generateUniqueStudentQrToken(students);
    const updatedStudent = sanitizeStudentForPersistence({
      ...existing,
      qrToken: newQr,
      qrTokenHash: hashQrTokenDeterministic(newQr),
      qrTokenStatus: 'active',
      qrLoginEnabled: true,
      qrTokenVersion: (existing.qrTokenVersion || 1) + 1,
      qrTokenIssuedAt: now,
      qrTokenRevokedAt: undefined,
      revokedQrTokenHashes: revokedHashes,
    });

    setStudents((prev) => prev.map((s) => (s.id === studentId ? updatedStudent : s)));

    const actor = staffId ? staff.find((st) => st.id === staffId) : undefined;
    logAudit({
      actorId: staffId,
      actorType: actor?.role || 'admin',
      actorName: actor?.fullName || 'إدارة الطلاب',
      action: 'إعادة إصدار باركود QR لطالب (وإبطال القديم)',
      entityType: 'student_qr',
      entityId: studentId,
      notes: `تم إبطال الباركود السابق وإصدار نسخة جديدة (#${updatedStudent.qrTokenVersion}) للطالب ${existing.fullName}${reason ? ` — السبب: ${reason}` : ''}`,
    });

    return { success: true, student: updatedStudent };
  };

  const revokeStudentQrToken = ({
    studentId,
    staffId,
    reason,
  }: {
    studentId: string;
    staffId?: string;
    reason?: string;
  }): { success: boolean; error?: string; student?: Student } => {
    const existing = students.find((s) => s.id === studentId);
    if (!existing) return { success: false, error: 'الطالب غير موجود في السجلات' };

    const now = new Date().toISOString();
    const oldHash = existing.qrTokenHash || (existing.qrToken ? hashQrTokenDeterministic(existing.qrToken) : '');
    const revokedHashes = oldHash
      ? Array.from(new Set([...(existing.revokedQrTokenHashes || []), oldHash]))
      : existing.revokedQrTokenHashes || [];

    const updatedStudent = sanitizeStudentForPersistence({
      ...existing,
      qrTokenStatus: 'revoked',
      qrLoginEnabled: false,
      qrTokenRevokedAt: now,
      revokedQrTokenHashes: revokedHashes,
    });

    setStudents((prev) => prev.map((s) => (s.id === studentId ? updatedStudent : s)));

    const actor = staffId ? staff.find((st) => st.id === staffId) : undefined;
    logAudit({
      actorId: staffId,
      actorType: actor?.role || 'admin',
      actorName: actor?.fullName || 'إدارة الطلاب',
      action: 'إلغاء باركود QR لطالب',
      entityType: 'student_qr',
      entityId: studentId,
      notes: `تم إلغاء صلاحية الباركود الحالي للطالب ${existing.fullName}${reason ? ` — السبب: ${reason}` : ''}`,
    });

    return { success: true, student: updatedStudent };
  };

  const toggleStudentQrLogin = ({
    studentId,
    enabled,
    staffId,
  }: {
    studentId: string;
    enabled: boolean;
    staffId?: string;
  }): { success: boolean; error?: string; student?: Student } => {
    const existing = students.find((s) => s.id === studentId);
    if (!existing) return { success: false, error: 'الطالب غير موجود في السجلات' };

    const now = new Date().toISOString();
    let updatedStudent: Student;

    // عند التفعيل لبطاقة كانت ملغاة سابقاً، نصدر رمزاً جديداً بدلاً من إعادة تنشيط رمز ملغى
    if (enabled && existing.qrTokenStatus === 'revoked') {
      const oldHash = existing.qrTokenHash || (existing.qrToken ? hashQrTokenDeterministic(existing.qrToken) : '');
      const revokedHashes = oldHash
        ? Array.from(new Set([...(existing.revokedQrTokenHashes || []), oldHash]))
        : existing.revokedQrTokenHashes || [];
      const freshQr = generateUniqueStudentQrToken(students);
      updatedStudent = sanitizeStudentForPersistence({
        ...existing,
        qrToken: freshQr,
        qrTokenHash: hashQrTokenDeterministic(freshQr),
        qrTokenStatus: 'active',
        qrLoginEnabled: true,
        qrTokenVersion: (existing.qrTokenVersion || 1) + 1,
        qrTokenIssuedAt: now,
        qrTokenRevokedAt: undefined,
        revokedQrTokenHashes: revokedHashes,
      });
    } else {
      updatedStudent = sanitizeStudentForPersistence({
        ...existing,
        qrLoginEnabled: enabled,
      });
    }

    setStudents((prev) => prev.map((s) => (s.id === studentId ? updatedStudent : s)));

    const actor = staffId ? staff.find((st) => st.id === staffId) : undefined;
    logAudit({
      actorId: staffId,
      actorType: actor?.role || 'admin',
      actorName: actor?.fullName || 'إدارة الطلاب',
      action: enabled ? 'تفعيل الدخول بالباركود لطالب' : 'تعطيل الدخول بالباركود لطالب',
      entityType: 'student_qr',
      entityId: studentId,
      notes: `${enabled ? 'تفعيل' : 'تعطيل'} الدخول ببطاقة QR للطالب ${existing.fullName}`,
    });

    return { success: true, student: updatedStudent };
  };

  const regenerateStudentCode = (studentId: string, customAccessCode?: string) => {
    const res = resetStudentAccessCode({ studentId, customAccessCode });
    const stu = students.find((s) => s.id === studentId);
    return {
      rawCode: res.credential?.plainAccessCode || '',
      qrToken: stu?.qrToken || '',
    };
  };

  const batchGenerateStudentCredentials = ({
    studentIds,
    regenerateStudentCodes = false,
    staffId,
  }: {
    studentIds: string[];
    regenerateStudentCodes?: boolean;
    staffId?: string;
  }): { success: boolean; credentials: EphemeralStudentCredential[] } => {
    const targetSet = new Set(studentIds);
    const now = new Date().toISOString();
    const generatedCreds: EphemeralStudentCredential[] = [];
    const poolCopy = [...students];

    const updatedStudents = poolCopy.map((stu) => {
      if (!targetSet.has(stu.id)) return sanitizeStudentForPersistence(stu);

      let nextCode = stu.internalId;
      if (regenerateStudentCodes || !nextCode) {
        const others = poolCopy.filter((o) => o.id !== stu.id);
        nextCode = generateUniqueStudentCode(others);
      }

      const plainPin = generateStudentAccessCode(6);
      const newHash = hashAccessCodeSync(plainPin);

      generatedCreds.push({
        studentId: stu.id,
        studentCode: nextCode,
        fullName: stu.fullName,
        grade: stu.grade,
        groupName: stu.groupName,
        plainAccessCode: plainPin,
        issuedAt: now,
      });

      return sanitizeStudentForPersistence({
        ...stu,
        internalId: nextCode,
        accessCodeHash: newHash,
        accessCodeUpdatedAt: now,
        failedLoginAttempts: 0,
        lockedUntil: undefined,
      });
    });

    setStudents(updatedStudents);
    setIssuedStudentCredentials((prev) => {
      const next = { ...prev };
      generatedCreds.forEach((c) => {
        next[c.studentId] = c;
      });
      return next;
    });

    const actor = staffId ? staff.find((st) => st.id === staffId) : undefined;
    logAudit({
      actorId: staffId,
      actorType: actor?.role || 'admin',
      actorName: actor?.fullName || 'إدارة الطلاب',
      action: 'إنشاء بيانات دخول لعدة طلاب دفعة واحدة',
      entityType: 'students_bulk',
      notes: `تم توليد وإعادة تعيين رموز الدخول المشفرة لـ ${generatedCreds.length} طالب`,
    });

    return { success: true, credentials: generatedCreds };
  };

  // الحجوزات
  const requestReservation = (bookId: string, studentId: string, notes = '') => {
    const eligibility = isStudentEligibleForLoan(studentId);
    if (!eligibility.eligible) {
      return { success: false, error: eligibility.reason };
    }

    // التحقق من عدم وجود حجز نشط سابق لنفس الكتاب
    const existing = reservations.find(
      (r) =>
        r.studentId === studentId &&
        r.bookId === bookId &&
        r.status !== 'fulfilled' &&
        r.status !== 'rejected' &&
        r.status !== 'cancelled' &&
        r.status !== 'expired'
    );

    if (existing) {
      return { success: false, error: 'لديك طلب حجز قائم بالفعل لهذا الكتاب' };
    }

    const resId = `res-${Date.now()}`;
    const newRes: Reservation = {
      id: resId,
      bookId,
      studentId,
      status: 'pending_approval',
      requestedAt: new Date().toISOString(),
      notes,
    };

    setReservations((prev) => [newRes, ...prev]);

    logAudit({
      actorType: 'student',
      actorName: 'طالب',
      action: 'طلب حجز كتاب',
      entityType: 'reservation',
      entityId: resId,
      notes: `طلب حجز كتاب جديد`,
    });

    return { success: true, reservation: newRes };
  };

  const updateReservationStatus = (
    reservationId: string,
    status: ReservationStatus,
    staffId?: string,
    assignedCopyId?: string
  ) => {
    setReservations((prev) =>
      prev.map((r) => {
        if (r.id !== reservationId) return r;
        const now = new Date().toISOString();
        const expiresAt =
          status === 'ready_for_pickup'
            ? addDaysToCurrent(Math.ceil(settings.reservationValidityHours / 24))
            : r.expiresAt;

        return {
          ...r,
          status,
          assignedCopyId: assignedCopyId || r.assignedCopyId,
          approvedAt: status === 'approved' || status === 'ready_for_pickup' ? now : r.approvedAt,
          expiresAt,
          handledByStaffId: staffId || r.handledByStaffId,
        };
      })
    );

    if (assignedCopyId && status === 'ready_for_pickup') {
      setCopies((prev) =>
        prev.map((c) => (c.id === assignedCopyId ? { ...c, status: 'reserved' as CopyStatus } : c))
      );
    }
  };

  // جلسات الجرد الذكي
  const createInventorySession = (title: string, supervisorId: string) => {
    const newSession: InventorySession = {
      id: `inv-${Date.now()}`,
      title,
      supervisorId,
      status: 'active',
      expectedCopiesCount: copies.length,
      scannedCopiesCount: 0,
      missingCopiesCount: 0,
      unexpectedCopiesCount: 0,
      startedAt: new Date().toISOString(),
    };

    setInventorySessions((prev) => [newSession, ...prev]);

    logAudit({
      actorId: supervisorId,
      actorType: 'supervisor',
      actorName: 'مشرف الجرد',
      action: 'بدء جلسة جرد جديدة',
      entityType: 'inventory_session',
      entityId: newSession.id,
      notes: `بدء جلسة جرد: "${title}" بإجمالي متوقع ${copies.length} نسخة`,
    });

    return newSession;
  };

  const recordInventoryScan = (sessionId: string, code: string, supervisorId: string) => {
    const trimmed = code.trim();
    // مطابقة مع النسخ المسجلة إما عبر كود النسخة أو بيانات QR
    const foundCopy = copies.find((c) => c.copyCode === trimmed || c.qrData === trimmed);

    let result = 'found_on_shelf';
    let message = 'تمت مطابقة النسخة على الرف بنجاح';

    if (!foundCopy) {
      result = 'unknown_code';
      message = 'رمز غير معروف في قاعدة بيانات المكتبة';
    } else if (foundCopy.status === 'borrowed') {
      result = 'expected_borrowed';
      message = 'تنبيه: النسخة مسجلة كمستعارة مع طالب حالياً!';
    } else if (foundCopy.status === 'maintenance') {
      result = 'in_maintenance';
      message = 'النسخة مسجلة تحت الصيانة والتغليف';
    }

    const scanRecord: InventoryScan = {
      id: `scan-${Date.now()}`,
      sessionId,
      copyId: foundCopy?.id,
      scannedCode: trimmed,
      result: result as any,
      scannedByStaffId: supervisorId,
      scannedAt: new Date().toISOString(),
    };

    setInventoryScans((prev) => [scanRecord, ...prev]);

    // تحديث عدادات الجلسة
    setInventorySessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          scannedCopiesCount: s.scannedCopiesCount + 1,
          unexpectedCopiesCount:
            result === 'unknown_code' ? s.unexpectedCopiesCount + 1 : s.unexpectedCopiesCount,
        };
      })
    );

    return { success: true, result, message };
  };

  const completeInventorySession = (sessionId: string, notes = '') => {
    const sessionScans = inventoryScans.filter((sc) => sc.sessionId === sessionId);
    const scannedCopyIds = new Set(sessionScans.map((sc) => sc.copyId).filter(Boolean));
    const missingCount = copies.filter((c) => !scannedCopyIds.has(c.id) && c.status !== 'borrowed').length;

    setInventorySessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              status: 'completed',
              completedAt: new Date().toISOString(),
              missingCopiesCount: missingCount,
              notes,
            }
          : s
      )
    );

    logAudit({
      actorType: 'supervisor',
      actorName: 'مشرف الجرد',
      action: 'إغلاق واعتماد جلسة الجرد',
      entityType: 'inventory_session',
      entityId: sessionId,
      notes: `اكتمال الجرد: تم مسح ${sessionScans.length} نسخة، المفقود المحتمل: ${missingCount}`,
    });
  };

  const updateSettings = (
    newSettings: Partial<LibrarySettings>,
    meta?: { staffId?: string; staffName?: string; summary?: string }
  ) => {
    setSettings((prev) => {
      const now = new Date().toISOString();
      const currentSnapshot: SettingsSnapshot = {
        id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now,
        authorId: meta?.staffId || 'admin',
        authorName: meta?.staffName || 'إدارة النظام',
        summary: meta?.summary || 'تعديل الإعدادات العامة',
        snapshot: prev,
      };

      const existingSnapshots = prev.settingsSnapshots || [];
      const updatedSnapshots = [currentSnapshot, ...existingSnapshots].slice(0, 25);

      const updatedSettings = {
        ...prev,
        ...newSettings,
        settingsSnapshots: updatedSnapshots,
      };

      centralSync.broadcastMutation({
        entity: 'settings',
        action: 'UPDATE',
        data: updatedSettings,
        actorId: meta?.staffId,
        actorName: meta?.staffName,
      });
      syncEntityRecordToSupabase('settings', updatedSettings);

      return updatedSettings;
    });

    logAudit({
      actorId: meta?.staffId,
      actorType: 'admin',
      actorName: meta?.staffName || 'إدارة النظام',
      action: 'تحديث مركز الإعدادات العامة',
      entityType: 'library_settings',
      notes: meta?.summary || 'تحديث وحفظ الإعدادات في مركز التحكم الشامل',
    });
  };

  const rollbackSettingsSnapshot = (
    snapshotId: string,
    meta?: { staffId?: string; staffName?: string }
  ): { success: boolean; error?: string } => {
    const snap = (settings.settingsSnapshots || []).find((s) => s.id === snapshotId);
    if (!snap) return { success: false, error: 'النسخة التاريخية المحددة غير موجودة' };

    setSettings((prev) => ({
      ...prev,
      ...snap.snapshot,
      settingsSnapshots: prev.settingsSnapshots,
    }));

    logAudit({
      actorId: meta?.staffId,
      actorType: 'admin',
      actorName: meta?.staffName || 'إدارة النظام',
      action: 'استعادة نسخة إعدادات سابقة',
      entityType: 'library_settings',
      notes: `استعادة إعدادات تاريخ ${snap.timestamp} (${snap.summary})`,
    });

    return { success: true };
  };

  const exportDatabaseBackup = () => {
    const fullBackup = {
      exportTimestamp: new Date().toISOString(),
      version: '2.5.0',
      settings,
      achievementSettings,
      categories,
      books,
      copies,
      students,
      staff,
      reservations,
      loans,
      loanEvents,
      conditionReports,
      inventorySessions,
      inventoryScans,
      auditLogs,
      readingChallenges,
      waitlist,
      returnRequests,
      exchangeRequests,
      conversations,
      messages,
      readingRanks,
      certificateSettings,
      readingLogs,
      readingLogCorrections,
      studentRanks,
      readingCertificates,
      discussions,
      discussionGroups,
      discussionSettings: discussionSettingsState,
      reportSettings,
      groupReportSummaries,
      studentReportNotes,
      exams,
      examAttempts,
      readingCompletions,
    };
    return JSON.stringify(fullBackup, null, 2);
  };

  const importDatabaseBackup = (jsonContent: string) => {
    try {
      const parsed = JSON.parse(jsonContent);
      if (!parsed.books || !parsed.copies || !parsed.students) {
        return { success: false, error: 'الملف غير متطابق مع بنية قاعدة بيانات مكتبة مداد' };
      }

      if (parsed.settings) setSettings(parsed.settings);
      if (parsed.achievementSettings) setAchievementSettings(parsed.achievementSettings);
      if (parsed.categories) setCategories(parsed.categories);
      if (parsed.books) setBooks(parsed.books);
      if (parsed.copies) setCopies(parsed.copies);
      if (parsed.students) setStudents(migrateStudentsPool(parsed.students).students);
      if (parsed.staff) setStaff(parsed.staff);
      if (parsed.reservations) setReservations(parsed.reservations);
      if (parsed.loans) setLoans(parsed.loans);
      if (parsed.loanEvents) setLoanEvents(parsed.loanEvents);
      if (parsed.conditionReports) setConditionReports(parsed.conditionReports);
      if (parsed.inventorySessions) setInventorySessions(parsed.inventorySessions);
      if (parsed.inventoryScans) setInventoryScans(parsed.inventoryScans);
      if (parsed.auditLogs) setAuditLogs(parsed.auditLogs);
      if (parsed.readingChallenges) setReadingChallenges(parsed.readingChallenges);
      if (parsed.returnRequests) setReturnRequests(parsed.returnRequests);
      if (parsed.exchangeRequests) setExchangeRequests(parsed.exchangeRequests);
      if (parsed.conversations) setConversations(parsed.conversations);
      if (parsed.messages) setMessages(parsed.messages);
      if (parsed.readingRanks) setReadingRanks(parsed.readingRanks);
      if (parsed.certificateSettings) setCertificateSettings(parsed.certificateSettings);
      if (parsed.readingLogs) setReadingLogs(parsed.readingLogs);
      if (parsed.readingLogCorrections) setReadingLogCorrections(parsed.readingLogCorrections);
      if (parsed.studentRanks) setStudentRanks(parsed.studentRanks);
      if (parsed.readingCertificates) setReadingCertificates(parsed.readingCertificates);
      if (parsed.discussions) setDiscussions(parsed.discussions);
      if (parsed.discussionGroups) setDiscussionGroups(parsed.discussionGroups);
      if (parsed.discussionSettings) setDiscussionSettingsState(parsed.discussionSettings);
      if (parsed.reportSettings) setReportSettings(parsed.reportSettings);
      if (parsed.groupReportSummaries) setGroupReportSummaries(parsed.groupReportSummaries);
      if (parsed.studentReportNotes) setStudentReportNotes(parsed.studentReportNotes);
      if (parsed.exams) setExams(parsed.exams);
      if (parsed.examAttempts) setExamAttempts(parsed.examAttempts);
      if (parsed.readingCompletions) setReadingCompletions(parsed.readingCompletions);

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'خطأ في قراءة ملف النسخة الاحتياطية' };
    }
  };

  // ========================================================================
  // نظام طلبات الإرجاع والاستبدال والتواصل الداخلي
  // ========================================================================

  const submitReturnRequest = (loanId: string, studentNotes?: string) => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan || loan.status !== 'active') {
      return { success: false, error: 'لا يمكن تقديم طلب إرجاع لإعارة غير نشطة' };
    }

    const existingActive = returnRequests.find(
      (r) =>
        r.loanId === loanId &&
        r.status !== 'completed' &&
        r.status !== 'cancelled' &&
        r.status !== 'rejected'
    );
    if (existingActive) {
      return { success: false, error: 'يوجد طلب إرجاع نشط بالفعل لهذا الكتاب قيد المتابعة' };
    }

    const copy = copies.find((c) => c.id === loan.copyId);
    const book = books.find((b) => b.id === copy?.bookId);
    const student = students.find((s) => s.id === loan.studentId);

    const newReq: ReturnRequest = {
      id: `req-ret-${Date.now()}`,
      studentId: loan.studentId,
      loanId,
      copyId: loan.copyId,
      bookId: copy?.bookId || '',
      studentNotes: studentNotes?.trim(),
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setReturnRequests((prev) => [newReq, ...prev]);

    logAudit({
      actorId: loan.studentId,
      actorType: 'student',
      actorName: student?.fullName || 'طالب',
      action: 'تقديم طلب إرجاع كتاب',
      entityType: 'return_request',
      entityId: newReq.id,
      notes: `طلب إرجاع نسخة ${copy?.copyCode} (${book?.title})`,
    });

    return { success: true, request: newReq };
  };

  const cancelReturnRequest = (requestId: string) => {
    const req = returnRequests.find((r) => r.id === requestId);
    if (!req) return { success: false, error: 'الطلب غير موجود' };

    if (req.status !== 'new' && req.status !== 'in_review') {
      return { success: false, error: 'لا يمكن إلغاء الطلب بعد اعتماده أو بدء تنفيذه' };
    }

    setReturnRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? { ...r, status: 'cancelled', updatedAt: new Date().toISOString() }
          : r
      )
    );

    return { success: true };
  };

  const updateReturnRequestStatus = ({
    requestId,
    status,
    rejectionReason,
    scheduledPickupTime,
    staffId,
    conditionRating = 'good',
    inspectionNotes,
  }: {
    requestId: string;
    status: ReturnRequestStatus;
    rejectionReason?: string;
    scheduledPickupTime?: string;
    staffId: string;
    conditionRating?: ConditionRating;
    inspectionNotes?: string;
  }) => {
    const req = returnRequests.find((r) => r.id === requestId);
    if (!req) return { success: false, error: 'الطلب غير موجود' };

    const loan = loans.find((l) => l.id === req.loanId);
    const copy = copies.find((c) => c.id === req.copyId);
    const student = students.find((s) => s.id === req.studentId);
    const supervisor = staff.find((s) => s.id === staffId);

    // إذا تم استلام الكتاب فعلياً: ينتقل فوراً إلى رف الفحص
    if (status === 'received' || status === 'under_inspection') {
      setCopies((prev) =>
        prev.map((c) => (c.id === req.copyId ? { ...c, status: 'under_inspection' } : c))
      );
    }

    // إذا اكتمل الإرجاع بعد الفحص: إنهاء الإعارة وتحديث حالة النسخة والعدادات
    if (status === 'completed' && loan && loan.status === 'active') {
      const returnTime = new Date().toISOString();
      setLoans((prev) =>
        prev.map((l) =>
          l.id === req.loanId
            ? {
                ...l,
                status: 'returned',
                returnDate: returnTime,
                returnedToSupervisorId: staffId,
              }
            : l
        )
      );

      let nextCopyStatus: CopyStatus = 'available';
      if (conditionRating === 'damaged') nextCopyStatus = 'damaged';
      else if (conditionRating === 'lost') nextCopyStatus = 'lost';

      setCopies((prev) =>
        prev.map((c) =>
          c.id === req.copyId
            ? { ...c, status: nextCopyStatus, condition: conditionRating, notes: inspectionNotes }
            : c
        )
      );

      // تحديث عدادات الطالب
      setStudents((prev) =>
        prev.map((s) =>
          s.id === req.studentId
            ? {
                ...s,
                currentActiveLoans: Math.max(0, s.currentActiveLoans - 1),
                totalBooksRead: s.totalBooksRead + 1,
              }
            : s
        )
      );

      // توثيق تقرير الفحص
      const repId = `rep-ret-${Date.now()}`;
      setConditionReports((prev) => [
        {
          id: repId,
          copyId: req.copyId,
          loanId: req.loanId,
          studentId: req.studentId,
          staffId,
          stage: 'return',
          rating: conditionRating,
          details: inspectionNotes || `إرجاع عبر طلب معتمد - تقييم الفحص: ${conditionRating}`,
          photos: [],
          createdAt: returnTime,
        },
        ...prev,
      ]);
    }

    setReturnRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status,
              rejectionReason: rejectionReason || r.rejectionReason,
              scheduledPickupTime: scheduledPickupTime || r.scheduledPickupTime,
              handledByStaffId: staffId,
              inspectionRating: conditionRating,
              inspectionNotes,
              updatedAt: new Date().toISOString(),
            }
          : r
      )
    );

    logAudit({
      actorId: staffId,
      actorType: 'supervisor',
      actorName: supervisor?.fullName || 'مشرف المكتبة',
      action: `تحديث حالة طلب إرجاع إلى (${status})`,
      entityType: 'return_request',
      entityId: requestId,
      notes: rejectionReason ? `سبب الرفض: ${rejectionReason}` : `حالة الطلب: ${status}`,
    });

    return { success: true };
  };

  const submitExchangeRequest = (oldLoanId: string, newBookId: string, studentNotes?: string) => {
    const oldLoan = loans.find((l) => l.id === oldLoanId);
    if (!oldLoan || oldLoan.status !== 'active') {
      return { success: false, error: 'لا يمكن استبدال كتاب غير مستعار حالياً' };
    }

    const newBook = books.find((b) => b.id === newBookId);
    if (!newBook || newBook.availableCopiesCount <= 0) {
      return { success: false, error: 'عفواً، لا توجد نسخ متاحة حالياً من الكتاب البديل المطلوب' };
    }

    const existingActive = exchangeRequests.find(
      (r) =>
        r.oldLoanId === oldLoanId &&
        r.status !== 'completed' &&
        r.status !== 'cancelled' &&
        r.status !== 'rejected'
    );
    if (existingActive) {
      return { success: false, error: 'يوجد طلب استبدال نشط بالفعل لهذا الكتاب قيد المتابعة' };
    }

    const oldCopy = copies.find((c) => c.id === oldLoan.copyId);
    const oldBook = books.find((b) => b.id === oldCopy?.bookId);
    const student = students.find((s) => s.id === oldLoan.studentId);

    const newReq: ExchangeRequest = {
      id: `req-exc-${Date.now()}`,
      studentId: oldLoan.studentId,
      oldLoanId,
      oldCopyId: oldLoan.copyId,
      oldBookId: oldCopy?.bookId || '',
      newBookId,
      studentNotes: studentNotes?.trim(),
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setExchangeRequests((prev) => [newReq, ...prev]);

    logAudit({
      actorId: oldLoan.studentId,
      actorType: 'student',
      actorName: student?.fullName || 'طالب',
      action: 'تقديم طلب استبدال كتاب',
      entityType: 'exchange_request',
      entityId: newReq.id,
      notes: `طلب استبدال (${oldBook?.title}) بكتاب (${newBook.title})`,
    });

    return { success: true, request: newReq };
  };

  const cancelExchangeRequest = (requestId: string) => {
    const req = exchangeRequests.find((r) => r.id === requestId);
    if (!req) return { success: false, error: 'الطلب غير موجود' };

    if (req.status !== 'new' && req.status !== 'in_review') {
      return { success: false, error: 'لا يمكن إلغاء الطلب بعد اعتماده أو بدء تنفيذه' };
    }

    // إطلاق سراح النسخة البديلة إن كانت محجوزة مبدئياً
    if (req.newCopyId) {
      setCopies((prev) =>
        prev.map((c) => (c.id === req.newCopyId ? { ...c, status: 'available' } : c))
      );
    }

    setExchangeRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? { ...r, status: 'cancelled', updatedAt: new Date().toISOString() }
          : r
      )
    );

    return { success: true };
  };

  const updateExchangeRequestStatus = ({
    requestId,
    status,
    rejectionReason,
    scheduledPickupTime,
    staffId,
    assignedNewCopyId,
    conditionRating,
    inspectionNotes,
    oldCopyCondition = 'good',
    oldCopyNotes,
  }: {
    requestId: string;
    status: ExchangeRequestStatus;
    rejectionReason?: string;
    scheduledPickupTime?: string;
    staffId: string;
    assignedNewCopyId?: string;
    conditionRating?: ConditionRating;
    inspectionNotes?: string;
    oldCopyCondition?: ConditionRating;
    oldCopyNotes?: string;
  }) => {
    const effectiveCondition = conditionRating || oldCopyCondition || 'good';
    const effectiveNotes = inspectionNotes || oldCopyNotes;
    const req = exchangeRequests.find((r) => r.id === requestId);
    if (!req) return { success: false, error: 'الطلب غير موجود' };

    const oldLoan = loans.find((l) => l.id === req.oldLoanId);
    const oldCopy = copies.find((c) => c.id === req.oldCopyId);
    const student = students.find((s) => s.id === req.studentId);
    const supervisor = staff.find((s) => s.id === staffId);

    // 1. عند الموافقة المبدئية: تخصيص وحجز نسخة بديلة لمنع ازدواج التخصيص
    let finalNewCopyId = req.newCopyId || assignedNewCopyId;
    if (status === 'approved' && !finalNewCopyId) {
      const availNewCopy = copies.find((c) => c.bookId === req.newBookId && c.status === 'available');
      if (availNewCopy) {
        finalNewCopyId = availNewCopy.id;
        setCopies((prev) =>
          prev.map((c) => (c.id === availNewCopy.id ? { ...c, status: 'in_preparation' } : c))
        );
      }
    }

    // 2. عند استلام الكتاب القديم: يذهب لرف الفحص
    if (status === 'old_book_received') {
      setCopies((prev) =>
        prev.map((c) => (c.id === req.oldCopyId ? { ...c, status: 'under_inspection' } : c))
      );
    }

    // 3. عند الاكتمال والتسليم الفعلي للبديل:
    let createdNewLoanId = req.newLoanId;
    if (status === 'completed') {
      const executionTime = new Date().toISOString();

      // أ. إغلاق الإعارة القديمة
      setLoans((prev) =>
        prev.map((l) =>
          l.id === req.oldLoanId
            ? {
                ...l,
                status: 'returned',
                returnDate: executionTime,
                returnedToSupervisorId: staffId,
              }
            : l
        )
      );

      // ب. تحديث حالة النسخة القديمة
      let nextOldStatus: CopyStatus = 'available';
      if (effectiveCondition === 'damaged') nextOldStatus = 'damaged';
      else if (effectiveCondition === 'lost') nextOldStatus = 'lost';

      setCopies((prev) =>
        prev.map((c) =>
          c.id === req.oldCopyId
            ? { ...c, status: nextOldStatus, condition: effectiveCondition, notes: effectiveNotes }
            : c
        )
      );

      // ج. إنشاء الإعارة الجديدة للنسخة البديلة (بحد أقصى كتابين للطلاب)
      const targetCopyId =
        finalNewCopyId ||
        copies.find(
          (c) =>
            c.bookId === req.newBookId &&
            (c.status === 'available' || c.status === 'in_preparation')
        )?.id;

      if (targetCopyId) {
        createdNewLoanId = `loan-${Date.now()}`;
        const dueTime = new Date();
        dueTime.setDate(dueTime.getDate() + settings.loanDurationDays);

        const newLoan: Loan = {
          id: createdNewLoanId,
          copyId: targetCopyId,
          studentId: req.studentId,
          supervisorId: staffId,
          loanDate: executionTime,
          dueDate: dueTime.toISOString(),
          status: 'active',
          renewalCount: 0,
          notes: `إعارة ناتجة عن استبدال معتمد (طلب #${req.id})`,
        };

        setLoans((prev) => [newLoan, ...prev]);

        // تحديث النسخة الجديدة إلى مستعارة
        setCopies((prev) =>
          prev.map((c) => (c.id === targetCopyId ? { ...c, status: 'borrowed' } : c))
        );

        // تسجيل حدث الإعارة
        setLoanEvents((prev) => [
          {
            id: `event-${Date.now()}`,
            loanId: createdNewLoanId!,
            eventType: 'checkout',
            staffId,
            notes: `تسليم النسخة البديلة للطالب ${student?.fullName}`,
            createdAt: executionTime,
          },
          ...prev,
        ]);
      }
    }

    setExchangeRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status,
              newCopyId: finalNewCopyId,
              newLoanId: createdNewLoanId,
              rejectionReason: rejectionReason || r.rejectionReason,
              scheduledPickupTime: scheduledPickupTime || r.scheduledPickupTime,
              handledByStaffId: staffId,
              oldCopyInspectionRating: oldCopyCondition,
              oldCopyInspectionNotes: oldCopyNotes,
              updatedAt: new Date().toISOString(),
            }
          : r
      )
    );

    logAudit({
      actorId: staffId,
      actorType: 'supervisor',
      actorName: supervisor?.fullName || 'مشرف المكتبة',
      action: `تحديث حالة طلب استبدال إلى (${status})`,
      entityType: 'exchange_request',
      entityId: requestId,
      notes: rejectionReason ? `سبب الرفض: ${rejectionReason}` : `حالة الطلب: ${status}`,
    });

    return { success: true };
  };

  // ========================================================================
  // نظام إكمال قراءة الكتب واعتمادها (Book Reading Completion Workflow)
  // ========================================================================

  const requestReadingCompletion = useCallback(
    ({
      loanId,
      studentId,
      studentNotes,
    }: {
      loanId: string;
      studentId: string;
      studentNotes?: string;
    }): { success: boolean; error?: string; completion?: BookReadingCompletion } => {
      const targetLoan = loans.find((l) => l.id === loanId);
      if (!targetLoan) {
        return { success: false, error: 'سجل الإعارة غير موجود.' };
      }
      if (targetLoan.studentId !== studentId) {
        return { success: false, error: 'هذه الإعارة لا تخص الطالب المحدد.' };
      }

      // التحقق من عدم تكرار الإكمال لنفس عملية الإعارة
      const existing = readingCompletions.find((c) => c.loanId === loanId);
      if (existing) {
        if (existing.status === 'approved') {
          return { success: false, error: 'تم اعتماد إكمال قراءة هذا الكتاب لهذه الإعارة مسبقاً.' };
        }
        if (existing.status === 'pending_approval') {
          return { success: false, error: 'طلب إكمال قراءة هذا الكتاب قيد المراجعة والاعتماد لدى المشرف حالياً.' };
        }
      }

      const copy = copies.find((c) => c.id === targetLoan.copyId);
      const bookId = copy?.bookId || '';
      const book = books.find((b) => b.id === bookId);
      const student = students.find((s) => s.id === studentId);
      const now = new Date().toISOString();

      const newCompletion: BookReadingCompletion = {
        id: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        loanId,
        bookId,
        copyId: targetLoan.copyId,
        studentId,
        requestDate: now,
        status: 'new',
        studentNotes: studentNotes?.trim() || undefined,
        history: [
          {
            id: `hist-${Date.now()}-1`,
            action: 'submitted',
            actionLabel: 'تقديم طلب إكمال قراءة الكتاب',
            actorId: studentId,
            actorName: student?.fullName || 'الطالب',
            actorRole: 'student',
            note: studentNotes?.trim() || 'طلب إكمال قراءة الكتاب من بوابة الطالب',
            createdAt: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      setReadingCompletions((prev) => {
        const filtered = prev.filter((c) => c.loanId !== loanId);
        return [newCompletion, ...filtered];
      });
      centralSync.broadcastMutation({ entity: 'readingCompletions', action: 'INSERT', data: newCompletion });
      syncEntityRecordToSupabase('readingCompletions', newCompletion);

      // إشعار الإدارة والمشرفين بطلب الإكمال الجديد
      emitScopedNotification({
        recipientType: 'staff',
        recipientRole: 'supervisor',
        title: 'طلب اعتماد إكمال كتاب جديد 📖',
        message: `أرسل الطالب ${student?.fullName || 'طالب'} إشعار إكمال قراءة كتاب "${book?.title || 'كتاب'}" بانتظار المراجعة والاعتماد.`,
        type: 'info',
        actionLink: 'reading_completions',
      });
      emitScopedNotification({
        recipientType: 'staff',
        recipientRole: 'admin',
        title: 'طلب إكمال كتاب جديد 📖',
        message: `قدّم الطالب ${student?.fullName || 'طالب'} طلب إكمال قراءة كتاب "${book?.title || 'كتاب'}".`,
        type: 'info',
        actionLink: 'reading_completions',
      });

      logAudit({
        actorId: studentId,
        actorType: 'student',
        actorName: student?.fullName || 'الطالب',
        action: 'READING_COMPLETION_REQUESTED',
        entityType: 'reading_completion',
        entityId: newCompletion.id,
        newState: newCompletion,
        reason: 'طلب إكمال قراءة كتاب من بوابة الطالب',
      });

      return { success: true, completion: newCompletion };
    },
    [loans, copies, books, students, readingCompletions, logAudit]
  );

  const setReadingCompletionUnderReview = useCallback(
    ({
      completionId,
      staffId,
      staffName,
    }: {
      completionId: string;
      staffId: string;
      staffName: string;
    }): { success: boolean; error?: string } => {
      const comp = readingCompletions.find((c) => c.id === completionId);
      if (!comp) return { success: false, error: 'سجل الطلب غير موجود.' };
      if (comp.status === 'approved') return { success: false, error: 'تم اعتماد هذا الطلب مسبقاً.' };

      const now = new Date().toISOString();
      const updatedComp: BookReadingCompletion = {
        ...comp,
        status: 'under_review',
        reviewedAt: now,
        reviewedByStaffId: staffId,
        reviewedByStaffName: staffName,
        history: [
          ...(comp.history || []),
          {
            id: `hist-${Date.now()}`,
            action: 'under_review',
            actionLabel: 'بدء مراجعة الطلب',
            actorId: staffId,
            actorName: staffName,
            actorRole: 'supervisor',
            note: 'تم وضع الطلب قيد المراجعة والتدقيق الإداري',
            createdAt: now,
          },
        ],
        updatedAt: now,
      };

      setReadingCompletions((prev) => prev.map((c) => (c.id === completionId ? updatedComp : c)));
      centralSync.broadcastMutation({ entity: 'readingCompletions', action: 'UPDATE', data: updatedComp, recordId: completionId });
      syncEntityRecordToSupabase('readingCompletions', updatedComp);
      return { success: true };
    },
    [readingCompletions]
  );

  // دالة الخادم/المزود المركزية لمنح الألقاب المستحقة وإصدار الشهادات تلقائياً (دون تكرار)
  const syncStudentRanksAndCertificates = useCallback(
    (
      studentId: string,
      newTotalApprovedPages: number,
      nowIso: string,
      staffId?: string
    ): string[] => {
      const student = students.find((s) => s.id === studentId);
      if (!student) return [];

      const activeRanksSorted = [...readingRanks]
        .filter((r) => r.isActive)
        .sort((a, b) => a.orderIndex - b.orderIndex || a.requiredPages - b.requiredPages);

      const existingActiveAchievements = studentRanks.filter(
        (sr) => sr.studentId === studentId && sr.status === 'active'
      );
      const earnedRankIds = new Set(existingActiveAchievements.map((a) => a.rankId));

      const existingCertRankIds = new Set(
        readingCertificates
          .filter((c) => c.studentId === studentId)
          .map((c) => c.rankId)
      );

      const newAchievements: StudentRankAchievement[] = [];
      const newCertificates: ReadingCertificate[] = [];
      const newlyEarnedTitles: string[] = [];
      const certPool = [...readingCertificates];

      for (const rank of activeRanksSorted) {
        if (newTotalApprovedPages >= rank.requiredPages) {
          if (!earnedRankIds.has(rank.id)) {
            earnedRankIds.add(rank.id);
            newlyEarnedTitles.push(rank.title);

            newAchievements.push({
              id: `srank-${studentId}-${rank.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              studentId,
              rankId: rank.id,
              rankTitleSnapshot: rank.title,
              pagesAtAchievement: newTotalApprovedPages,
              unlockedAt: nowIso,
              isCelebrated: false,
              status: 'active',
            });
          }

          // عدم إصدار أكثر من شهادة عن اللقب نفسه تلقائياً
          if (!existingCertRankIds.has(rank.id)) {
            existingCertRankIds.add(rank.id);
            const certNumber = generateUniqueCertificateNumber(
              certificateSettings.serialPrefix,
              certPool
            );
            const newCert: ReadingCertificate = {
              id: `cert-${studentId}-${rank.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              certificateNumber: certNumber,
              studentId,
              studentNameSnapshot: student.fullName,
              studentGradeSnapshot: `${student.grade} • ${student.groupName}`,
              rankId: rank.id,
              rankTitleSnapshot: rank.title,
              themeKeySnapshot: rank.themeKey,
              primaryColorSnapshot: rank.primaryColor,
              secondaryColorSnapshot: rank.secondaryColor,
              accentColorSnapshot: rank.accentColor,
              pagesCompletedSnapshot: newTotalApprovedPages,
              motivationalPhrase: rank.motivationalPhrase,
              issuerOrganization: certificateSettings.issuerOrganization,
              signatoryTitle: certificateSettings.signatoryTitle,
              signatoryName: certificateSettings.signatoryName,
              footerNote: certificateSettings.footerNote,
              issuedAt: nowIso,
              version: 1,
              isReissue: false,
              issuedByStaffId: staffId,
              status: 'active',
            };
            certPool.push(newCert);
            newCertificates.push(newCert);
          }
        }
      }

      if (newAchievements.length > 0) {
        setStudentRanks((prev) => [...prev, ...newAchievements]);
      }
      if (newCertificates.length > 0) {
        setReadingCertificates((prev) => [...prev, ...newCertificates]);
        newCertificates.forEach((c) => {
          logAudit({
            actorId: staffId,
            actorType: staffId ? 'supervisor' : 'system',
            actorName: staffId
              ? staff.find((st) => st.id === staffId)?.fullName || 'مشرف المكتبة'
              : 'النظام التلقائي',
            action: `إصدار شهادة لقب "${c.rankTitleSnapshot}"`,
            entityType: 'reading_certificate',
            entityId: c.id,
            notes: `إصدار شهادة رقم ${c.certificateNumber} للطالب ${c.studentNameSnapshot} (${c.pagesCompletedSnapshot} صفحة معتمدة)`,
          });
        });
      }

      return newlyEarnedTitles;
    },
    [students, readingRanks, studentRanks, readingCertificates, certificateSettings, staff, logAudit]
  );

  // دالة توثيق قراءة الكتاب والصفحات في سجل الطالب readingLogs واحتساب الرصيد والألقاب
  const recordBookAndPagesInStudentRecord = useCallback(
    ({
      studentId,
      bookId,
      loanId,
      staffId,
      staffName,
      customPages,
      notes,
    }: {
      studentId: string;
      bookId: string;
      loanId?: string;
      staffId?: string;
      staffName?: string;
      customPages?: number;
      notes?: string;
    }): { success: boolean; addedPages: number } => {
      const book = books.find((b) => b.id === bookId);
      const student = students.find((s) => s.id === studentId);
      const now = new Date().toISOString();
      const bookPageCount =
        customPages && customPages > 0
          ? customPages
          : book?.pageCount && book.pageCount > 0
          ? book.pageCount
          : 100;

      // فحص الصفحات المعتمدة مسبقاً لهذا الكتاب لدى الطالب
      const existingApprovedLogs = readingLogs.filter(
        (l) => l.studentId === studentId && l.bookId === bookId && l.status === 'approved'
      );
      const existingApprovedPages = existingApprovedLogs.reduce(
        (sum, l) => sum + (l.correctedPagesCount ?? l.pagesCount),
        0
      );

      let addedPages = 0;
      if (existingApprovedPages < bookPageCount) {
        const remainingToCredit = bookPageCount - existingApprovedPages;
        const highestToPage = existingApprovedLogs.reduce(
          (max, l) => Math.max(max, l.toPage),
          0
        );
        const fromPage = highestToPage > 0 ? highestToPage + 1 : 1;
        const toPage = bookPageCount;

        const newLogEntry: ReadingLog = {
          id: `rlog-auto-${studentId}-${bookId}-${Date.now()}`,
          studentId,
          loanId: loanId || '',
          bookId,
          fromPage,
          toPage,
          pagesCount: remainingToCredit,
          readingDate: now.slice(0, 10),
          studentNotes:
            notes ||
            `إتمام قراءة كتاب "${book?.title || 'كتاب'}" كاملاً (${bookPageCount} صفحة) وتوثيقه في سجل الطالب المعتمد بواسطة ${staffName || 'المشرف'}`,
          status: 'approved',
          reviewedByStaffId: staffId,
          reviewedAt: now,
          createdAt: now,
          updatedAt: now,
        };

        setReadingLogs((prev) => [newLogEntry, ...prev]);
        addedPages = remainingToCredit;
        centralSync.broadcastMutation({ entity: 'readingLogs', action: 'INSERT', data: newLogEntry });
        syncEntityRecordToSupabase('readingLogs', newLogEntry);

        // زيادة عداد الكتب المقروءة للطالب وتحديث المزامنة اللحظية
        const updatedStudent = {
          ...student,
          totalBooksRead: (student?.totalBooksRead || 0) + 1,
        };
        setStudents((prev) =>
          prev.map((s) =>
            s.id === studentId ? (updatedStudent as Student) : s
          )
        );
        centralSync.broadcastMutation({ entity: 'students', action: 'UPDATE', data: updatedStudent, recordId: studentId });
        syncEntityRecordToSupabase('students', updatedStudent);
      }

      // مزامنة الألقاب والشهادات القرائية برصيد الصفحات الجديد
      const currentApprovedPages = readingLogs
        .filter((l) => l.studentId === studentId && l.status === 'approved')
        .reduce((sum, l) => sum + (l.correctedPagesCount ?? l.pagesCount), 0);
      const updatedTotal = currentApprovedPages + addedPages;

      syncStudentRanksAndCertificates(studentId, updatedTotal, now, staffId);

      return { success: true, addedPages };
    },
    [books, students, readingLogs, syncStudentRanksAndCertificates]
  );

  const approveReadingCompletion = useCallback(
    ({
      completionId,
      staffId,
      staffName,
      adminNotes,
    }: {
      completionId: string;
      staffId: string;
      staffName: string;
      adminNotes?: string;
    }): { success: boolean; error?: string } => {
      const comp = readingCompletions.find((c) => c.id === completionId);
      if (!comp) {
        return { success: false, error: 'سجل إكمال القراءة غير موجود.' };
      }
      if (comp.status === 'approved') {
        return { success: false, error: 'تم اعتماد هذا الإكمال مسبقاً.' };
      }

      const now = new Date().toISOString();
      const updatedComp: BookReadingCompletion = {
        ...comp,
        status: 'approved',
        approvedAt: now,
        approvedByStaffId: staffId,
        approvedByStaffName: staffName,
        adminNotes: adminNotes !== undefined ? adminNotes.trim() : comp.adminNotes,
        history: [
          ...(comp.history || []),
          {
            id: `hist-${Date.now()}`,
            action: 'approved',
            actionLabel: 'اعتماد إكمال الكتاب رسمياً',
            actorId: staffId,
            actorName: staffName,
            actorRole: 'supervisor',
            note: adminNotes?.trim() || 'تم اعتماد إكمال قراءة الكتاب وإضافته لسجل قراءات الطالب',
            createdAt: now,
          },
        ],
        updatedAt: now,
      };

      setReadingCompletions((prev) => prev.map((c) => (c.id === completionId ? updatedComp : c)));
      centralSync.broadcastMutation({ entity: 'readingCompletions', action: 'UPDATE', data: updatedComp, recordId: completionId });
      syncEntityRecordToSupabase('readingCompletions', updatedComp);

      const book = books.find((b) => b.id === comp.bookId);
      const student = students.find((s) => s.id === comp.studentId);
      const bookPageCount = book?.pageCount && book.pageCount > 0 ? book.pageCount : 100;

      // توثيق الكتاب والصفحات فوراً في سجل الطالب المعتمد readingLogs وتحديث رصيد قراءاته وسلّم الألقاب
      recordBookAndPagesInStudentRecord({
        studentId: comp.studentId,
        bookId: comp.bookId,
        loanId: comp.loanId,
        staffId,
        staffName,
        customPages: bookPageCount,
        notes: comp.studentNotes || `اعتماد إكمال قراءة كتاب "${book?.title || 'كتاب'}" كاملاً (${bookPageCount} صفحة) وتوثيقه في سجل الطالب من المشرف ${staffName}`,
      });

      // إشعار الطالب بنجاح الاعتماد
      emitScopedNotification({
        recipientType: 'student',
        studentId: comp.studentId,
        title: 'تم اعتماد إكمال قراءة الكتاب 🎉',
        message: `أحسنت يا ${student?.fullName || 'بطل'}! اعتمد المشرف ${staffName} إتمامك لقراءة كتاب "${book?.title || 'كتاب'}" (${bookPageCount} صفحة) وأُضيف لسجل قراءاتك المعتمدة.`,
        type: 'success',
        actionLink: 'reading_history',
      });

      logAudit({
        actorId: staffId,
        actorType: 'supervisor',
        actorName: staffName,
        action: 'READING_COMPLETION_APPROVED',
        entityType: 'reading_completion',
        entityId: completionId,
        newState: updatedComp,
        reason: `اعتماد إكمال قراءة كتاب "${book?.title || 'كتاب'}" وإضافة ${bookPageCount} صفحة لسجل قراءات الطالب وسلّم الألقاب`,
      });

      return { success: true };
    },
    [readingCompletions, books, students, logAudit, recordBookAndPagesInStudentRecord]
  );

  const returnReadingCompletionForRevision = useCallback(
    ({
      completionId,
      staffId,
      staffName,
      reason,
      adminNotes,
    }: {
      completionId: string;
      staffId: string;
      staffName: string;
      reason: string;
      adminNotes?: string;
    }): { success: boolean; error?: string } => {
      const comp = readingCompletions.find((c) => c.id === completionId);
      if (!comp) return { success: false, error: 'سجل الطلب غير موجود.' };

      const now = new Date().toISOString();
      const updatedComp: BookReadingCompletion = {
        ...comp,
        status: 'needs_revision',
        revisionReason: reason.trim(),
        adminNotes: adminNotes !== undefined ? adminNotes.trim() : comp.adminNotes,
        reviewedAt: now,
        reviewedByStaffId: staffId,
        reviewedByStaffName: staffName,
        history: [
          ...(comp.history || []),
          {
            id: `hist-${Date.now()}`,
            action: 'returned_for_revision',
            actionLabel: 'إعادة الطلب للمراجعة والاستكمال',
            actorId: staffId,
            actorName: staffName,
            actorRole: 'supervisor',
            note: reason.trim(),
            createdAt: now,
          },
        ],
        updatedAt: now,
      };

      setReadingCompletions((prev) => prev.map((c) => (c.id === completionId ? updatedComp : c)));
      centralSync.broadcastMutation({ entity: 'readingCompletions', action: 'UPDATE', data: updatedComp, recordId: completionId });
      syncEntityRecordToSupabase('readingCompletions', updatedComp);

      const book = books.find((b) => b.id === comp.bookId);

      // إشعار الطالب بالسبب
      emitScopedNotification({
        recipientType: 'student',
        studentId: comp.studentId,
        title: 'طلب إكمال الكتاب يحتاج إلى استكمال ℹ️',
        message: `أعاد المشرف ${staffName} طلب إكمال كتاب "${book?.title || 'كتاب'}" للملاحظة التالية: ${reason}`,
        type: 'warning',
        actionLink: 'reading_history',
      });

      logAudit({
        actorId: staffId,
        actorType: 'supervisor',
        actorName: staffName,
        action: 'READING_COMPLETION_RETURNED_FOR_REVISION',
        entityType: 'reading_completion',
        entityId: completionId,
        newState: updatedComp,
        reason: reason || 'إعادة الطلب لاستكمال المعلومات والملاحظات',
      });

      return { success: true };
    },
    [readingCompletions, books, logAudit]
  );

  const rejectReadingCompletion = useCallback(
    ({
      completionId,
      staffId,
      staffName,
      reason,
      adminNotes,
    }: {
      completionId: string;
      staffId: string;
      staffName: string;
      reason: string;
      adminNotes?: string;
    }): { success: boolean; error?: string } => {
      const comp = readingCompletions.find((c) => c.id === completionId);
      if (!comp) {
        return { success: false, error: 'سجل إكمال القراءة غير موجود.' };
      }

      const now = new Date().toISOString();
      const updatedComp: BookReadingCompletion = {
        ...comp,
        status: 'rejected',
        rejectionReason: reason.trim() || 'لم يتم استيفاء شروط إكمال القراءة',
        adminNotes: adminNotes !== undefined ? adminNotes.trim() : comp.adminNotes,
        reviewedAt: now,
        reviewedByStaffId: staffId,
        reviewedByStaffName: staffName,
        history: [
          ...(comp.history || []),
          {
            id: `hist-${Date.now()}`,
            action: 'rejected',
            actionLabel: 'رفض طلب الإكمال',
            actorId: staffId,
            actorName: staffName,
            actorRole: 'supervisor',
            note: reason.trim() || 'تم رفض طلب الإكمال',
            createdAt: now,
          },
        ],
        updatedAt: now,
      };

      setReadingCompletions((prev) => prev.map((c) => (c.id === completionId ? updatedComp : c)));
      centralSync.broadcastMutation({ entity: 'readingCompletions', action: 'UPDATE', data: updatedComp, recordId: completionId });
      syncEntityRecordToSupabase('readingCompletions', updatedComp);

      const book = books.find((b) => b.id === comp.bookId);

      // إشعار الطالب بالملاحظات
      emitScopedNotification({
        recipientType: 'student',
        studentId: comp.studentId,
        title: 'قرار بشأن طلب إكمال قراءة كتاب ❌',
        message: `تم رفض طلب إكمال كتاب "${book?.title || 'كتاب'}" للسبب التالي: ${reason}`,
        type: 'warning',
        actionLink: 'reading_history',
      });

      logAudit({
        actorId: staffId,
        actorType: 'supervisor',
        actorName: staffName,
        action: 'READING_COMPLETION_REJECTED',
        entityType: 'reading_completion',
        entityId: completionId,
        newState: updatedComp,
        reason: reason || 'رفض أو إعادة طلب إكمال القراءة للتوضيح',
      });

      return { success: true };
    },
    [readingCompletions, books, logAudit]
  );

  const updateReadingCompletionAdminNotes = useCallback(
    ({
      completionId,
      adminNotes,
    }: {
      completionId: string;
      adminNotes: string;
    }): { success: boolean; error?: string } => {
      const comp = readingCompletions.find((c) => c.id === completionId);
      if (!comp) return { success: false, error: 'سجل الطلب غير موجود.' };

      const now = new Date().toISOString();
      const updatedComp: BookReadingCompletion = {
        ...comp,
        adminNotes: adminNotes.trim(),
        updatedAt: now,
      };

      setReadingCompletions((prev) => prev.map((c) => (c.id === completionId ? updatedComp : c)));
      centralSync.broadcastMutation({ entity: 'readingCompletions', action: 'UPDATE', data: updatedComp, recordId: completionId });
      syncEntityRecordToSupabase('readingCompletions', updatedComp);
      return { success: true };
    },
    [readingCompletions]
  );

  // ========================================================================
  // نظام المحادثات والشات المتقدم (الرسائل المباشرة + حالات التسليم + المزامنة)
  // ========================================================================

  const isFlushingOutboxRef = useRef<boolean>(false);
  const lastPresenceMapRef = useRef<Record<string, number>>({});

  const updateChatSettings = useCallback((newSettings: Partial<ChatNotificationSettings>) => {
    setChatSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveChatSettings(updated);
      return updated;
    });
  }, []);

  const getActiveChatSupervisors = useCallback(() => {
    return staff.filter((s) => s.role === 'supervisor' && s.status === 'active');
  }, [staff]);

  const createOrGetConversation = useCallback(
    ({
      studentId,
      recipientType,
      supervisorId,
    }: {
      studentId: string;
      recipientType: ChatRecipientType;
      supervisorId?: string;
    }): { success: boolean; error?: string; conversation?: Conversation } => {
      const student = students.find((s) => s.id === studentId);
      if (!student || student.status !== 'active') {
        return { success: false, error: 'حساب الطالب غير نشط أو غير مسجل في النظام.' };
      }

      if (recipientType === 'supervisor') {
        const targetSup = staffRef.current.find(
          (s) => s.id === supervisorId && s.role === 'supervisor' && s.status === 'active'
        );
        if (!targetSup) {
          return {
            success: false,
            error: 'المشرف المحدد غير متاح أو حسابه غير مفعّل حالياً.',
          };
        }
      }

      const existing = conversationsRef.current.find((c) => {
        if (c.studentId !== studentId) return false;
        if (recipientType === 'admin') {
          return c.recipientType === 'admin';
        }
        return c.recipientType === 'supervisor' && c.supervisorId === supervisorId;
      });

      if (existing) {
        return { success: true, conversation: existing };
      }

      const now = new Date().toISOString();
      const convId = getDeterministicConversationId(studentId, recipientType, supervisorId);
      const studentHadPreviousConv = conversationsRef.current.some((c) => c.studentId === studentId);
      const welcomeText = chatSettingsRef.current.welcomeMessageText;

      const newConv: Conversation = {
        id: convId,
        studentId,
        recipientType,
        supervisorId: recipientType === 'supervisor' ? supervisorId : undefined,
        status: 'open',
        isPinned: false,
        isFollowUp: false,
        isArchived: false,
        lastMessageContent: !studentHadPreviousConv ? welcomeText : '',
        lastMessageAt: now,
        lastMessageSenderType: !studentHadPreviousConv ? 'system' : undefined,
        unreadCountStudent: 0,
        unreadCountSupervisor: 0,
        welcomeShown: true,
        createdAt: now,
        updatedAt: now,
      };

      conversationsRef.current = [newConv, ...conversationsRef.current];
      setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== convId)]);

      if (!studentHadPreviousConv) {
        const welcomeMsg: ChatMessage = {
          id: `msg-welcome-${Date.now()}`,
          conversationId: convId,
          senderType: 'system',
          senderId: 'system',
          senderName: 'النظام الترحيبي لمكتبة مداد',
          recipientType,
          recipientId: studentId,
          content: welcomeText,
          deliveryStatus: 'read',
          isRead: true,
          deliveredAt: now,
          readAt: now,
          systemEventType: 'welcome',
          createdAt: now,
        };
        messagesRef.current = [...messagesRef.current, welcomeMsg];
        setMessages((prev) => [...prev, welcomeMsg]);
      }

      persistChatSnapshotNow(conversationsRef.current, messagesRef.current);

      return { success: true, conversation: newConv };
    },
    [persistChatSnapshotNow, students]
  );

  const enqueueChatMessage = useCallback((queuedItem: ChatQueuedMessage) => {
    setChatOutbox((prev) => {
      const existsIdx = prev.findIndex((q) => q.clientMessageId === queuedItem.clientMessageId);
      const next =
        existsIdx >= 0
          ? prev.map((q, idx) => (idx === existsIdx ? queuedItem : q))
          : [...prev, queuedItem];
      saveChatOutbox(next);
      return next;
    });
  }, []);

  const dequeueChatMessage = useCallback((clientMessageId?: string) => {
    if (!clientMessageId) return;
    setChatOutbox((prev) => {
      const next = prev.filter((q) => q.clientMessageId !== clientMessageId);
      saveChatOutbox(next);
      return next;
    });
  }, []);

  const commitOutboundMessage = useCallback(
    async ({
      conv,
      msg,
    }: {
      conv: Conversation;
      msg: ChatMessage;
    }): Promise<{ success: boolean; error?: string; message: ChatMessage; conversation: Conversation }> => {
      const cmsgId = msg.clientMessageId || msg.id;

      // 1) تحقق حقيقي من الاتصال قبل اعتماد الإرسال
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const reason =
          'لا يوجد اتصال بالشبكة حالياً. حُفظت الرسالة في قائمة الانتظار وسيتم إرسالها تلقائياً عند عودة الاتصال.';
        const failedMsg: ChatMessage = {
          ...msg,
          deliveryStatus: 'failed',
          errorReason: reason,
        };
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? failedMsg : m)));
        enqueueChatMessage({
          clientMessageId: cmsgId,
          conversationId: conv.id,
          studentId: conv.studentId,
          recipientType: conv.recipientType,
          supervisorId: conv.supervisorId,
          senderType: msg.senderType,
          senderId: msg.senderId,
          senderName: msg.senderName,
          content: msg.content,
          attachmentUrl: msg.attachmentUrl,
          attachmentName: msg.attachmentName,
          attachmentMimeType: msg.attachmentMimeType,
          attachmentSize: msg.attachmentSize,
          attachmentType: msg.attachmentType,
          replyToMessageId: msg.replyToMessageId,
          retryCount: 1,
          lastError: reason,
          createdAt: msg.createdAt,
        });
        return { success: false, error: reason, message: failedMsg, conversation: conv };
      }

      // 2) الحفظ الفعلي الفوري في قاعدة البيانات المحلية (localStorage) والتحقق من نجاحه
      await new Promise((resolve) => setTimeout(resolve, 35));

      const persistRes = persistChatSnapshotNow(conversationsRef.current, messagesRef.current);
      const isPersistedLocally =
        persistRes.ok && verifyPersistedMessageInLocalStorage(STORAGE_KEY, msg.id);

      if (!persistRes.ok || !isPersistedLocally) {
        const reason =
          persistRes.error || 'تعذّر تأكيد حفظ الرسالة في التخزين المحلي. اضغط «إعادة المحاولة».';
        const failedMsg: ChatMessage = {
          ...msg,
          deliveryStatus: 'failed',
          errorReason: reason,
        };
        messagesRef.current = messagesRef.current.map((m) => (m.id === msg.id ? failedMsg : m));
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? failedMsg : m)));
        return { success: false, error: reason, message: failedMsg, conversation: conv };
      }

      // 3) إذا كان الربط السحابي Supabase مفعلاً، لا تعتمد الإرسال قبل تأكيد السحابة
      const cloudRes = await syncConversationAndMessageToSupabase(conv, msg);
      if (!cloudRes.ok) {
        const reason = cloudRes.error || 'تعذّر حفظ الرسالة في قاعدة البيانات المركزية.';
        const failedMsg: ChatMessage = {
          ...msg,
          deliveryStatus: 'failed',
          errorReason: reason,
        };
        messagesRef.current = messagesRef.current.map((m) => (m.id === msg.id ? failedMsg : m));
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? failedMsg : m)));
        enqueueChatMessage({
          clientMessageId: cmsgId,
          conversationId: conv.id,
          studentId: conv.studentId,
          recipientType: conv.recipientType,
          supervisorId: conv.supervisorId,
          senderType: msg.senderType,
          senderId: msg.senderId,
          senderName: msg.senderName,
          content: msg.content,
          attachmentUrl: msg.attachmentUrl,
          attachmentName: msg.attachmentName,
          attachmentMimeType: msg.attachmentMimeType,
          attachmentSize: msg.attachmentSize,
          attachmentType: msg.attachmentType,
          replyToMessageId: msg.replyToMessageId,
          retryCount: 1,
          lastError: reason,
          createdAt: msg.createdAt,
        });
        return { success: false, error: reason, message: failedMsg, conversation: conv };
      }

      // 4) تأكيد الحفظ الفعلي -> الانتقال إلى حالة «تم الإرسال»
      const sentAt = new Date().toISOString();
      const sentMsg: ChatMessage = {
        ...msg,
        deliveryStatus: 'sent',
        errorReason: undefined,
        updatedAt: sentAt,
      };
      messagesRef.current = messagesRef.current.map((m) =>
        m.id === msg.id && m.deliveryStatus !== 'read' ? sentMsg : m
      );
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id && m.deliveryStatus !== 'read' ? sentMsg : m))
      );
      persistChatSnapshotNow(conversationsRef.current, messagesRef.current);
      broadcastChatEvent({
        type: 'LIBRARY_DATA_UPDATED',
        sourceTabId: TAB_INSTANCE_ID,
        conversationId: conv.id,
        messageId: msg.id,
        updatedAt: sentAt,
      });
      dequeueChatMessage(msg.clientMessageId);

      // إرسال إشعار موجه للطرف المستقبل فقط (بدون تكرار)
      const preview =
        msg.content.trim() ||
        (msg.attachmentName ? `مرفق: ${msg.attachmentName}` : 'رسالة جديدة');

      if (msg.senderType === 'student') {
        if (conv.recipientType === 'admin') {
          emitScopedNotification({
            recipientType: 'staff',
            recipientRole: 'admin',
            title: 'رسالة جديدة لإدارة المكتبة',
            message: `${msg.senderName}: ${preview}`,
            type: 'info',
            conversationId: conv.id,
            sourceMessageId: msg.id,
            dedupeKey: `chat-msg-${msg.id}`,
          });
        } else if (conv.supervisorId) {
          emitScopedNotification({
            recipientType: 'staff',
            recipientRole: 'supervisor',
            staffId: conv.supervisorId,
            title: 'رسالة جديدة من طالب',
            message: `${msg.senderName}: ${preview}`,
            type: 'info',
            conversationId: conv.id,
            sourceMessageId: msg.id,
            dedupeKey: `chat-msg-${msg.id}`,
          });
        }
      } else if (msg.senderType === 'supervisor' || msg.senderType === 'admin') {
        emitScopedNotification({
          recipientType: 'student',
          recipientRole: 'student',
          studentId: conv.studentId,
          title: msg.senderType === 'admin' ? 'رد من إدارة المكتبة' : `رد من ${msg.senderName}`,
          message: preview,
          type: 'success',
          conversationId: conv.id,
          sourceMessageId: msg.id,
          dedupeKey: `chat-msg-${msg.id}`,
        });
      }

      // 5) التحقق من وصول الرسالة لصندوق وارد الطرف الآخر -> «تم التسليم»
      setTimeout(() => {
        const deliveredAt = new Date().toISOString();
        messagesRef.current = messagesRef.current.map((m) =>
          m.id === msg.id && (m.deliveryStatus === 'sent' || m.deliveryStatus === 'sending')
            ? { ...m, deliveryStatus: 'delivered', deliveredAt }
            : m
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id && (m.deliveryStatus === 'sent' || m.deliveryStatus === 'sending')
              ? { ...m, deliveryStatus: 'delivered', deliveredAt }
              : m
          )
        );
        persistChatSnapshotNow(conversationsRef.current, messagesRef.current);
        broadcastChatEvent({
          type: 'MESSAGE_DELIVERED',
          sourceTabId: TAB_INSTANCE_ID,
          conversationId: conv.id,
          messageIds: [msg.id],
          deliveredAt,
        });
      }, 180);

      return { success: true, message: sentMsg, conversation: conv };
    },
    [dequeueChatMessage, enqueueChatMessage, persistChatSnapshotNow]
  );

  const sendChatMessage = useCallback(
    async ({
      conversationId,
      studentId,
      recipientType,
      supervisorId,
      senderType,
      senderId,
      senderName,
      content,
      attachmentUrl,
      attachmentName,
      attachmentMimeType,
      attachmentSize,
      attachmentType,
      replyToMessageId,
      clientMessageId,
    }: {
      conversationId?: string;
      studentId: string;
      recipientType?: ChatRecipientType;
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
      clientMessageId?: string;
    }): Promise<{
      success: boolean;
      error?: string;
      message?: ChatMessage;
      conversation?: Conversation;
    }> => {
      const trimmed = content.trim();
      if (!trimmed && !attachmentUrl) {
        return { success: false, error: 'يُرجى كتابة نص الرسالة أو إرفاق ملف قبل الإرسال.' };
      }

      const cmsgId =
        clientMessageId ||
        `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // منع التكرار عند النقر السريع المتكرر على زر الإرسال
      const duplicate = messagesRef.current.find(
        (m) => m.clientMessageId === cmsgId && m.deliveryStatus !== 'failed'
      );
      if (duplicate) {
        const existingConv = conversationsRef.current.find((c) => c.id === duplicate.conversationId);
        return { success: true, message: duplicate, conversation: existingConv };
      }

      let targetConv: Conversation | undefined = conversationId
        ? conversationsRef.current.find((c) => c.id === conversationId)
        : undefined;

      const resolvedRecipientType: ChatRecipientType =
        targetConv?.recipientType ||
        recipientType ||
        (supervisorId ? 'supervisor' : 'admin');
      const resolvedSupervisorId =
        resolvedRecipientType === 'supervisor'
          ? targetConv?.supervisorId || supervisorId
          : undefined;

      if (!targetConv) {
        const ensured = createOrGetConversation({
          studentId,
          recipientType: resolvedRecipientType,
          supervisorId: resolvedSupervisorId,
        });
        if (!ensured.success || !ensured.conversation) {
          return { success: false, error: ensured.error || 'تعذّر إنشاء المحادثة.' };
        }
        targetConv = ensured.conversation;
      } else if (
        senderType === 'student' &&
        targetConv.recipientType === 'supervisor' &&
        targetConv.supervisorId
      ) {
        const supActive = staffRef.current.some(
          (s) =>
            s.id === targetConv?.supervisorId &&
            s.role === 'supervisor' &&
            s.status === 'active'
        );
        if (!supActive) {
          return {
            success: false,
            error:
              'عذراً، حساب هذا المشرف غير مفعّل حالياً. يمكنك فتح محادثة جديدة مع إدارة المكتبة أو مشرف آخر.',
          };
        }
      }

      const now = new Date().toISOString();
      const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const previewContent = trimmed || (attachmentName ? `مرفق: ${attachmentName}` : 'مرفق');

      const nextStatus: ConversationStatus =
        senderType === 'student'
          ? 'waiting_reply'
          : senderType === 'system'
          ? targetConv.status
          : 'open';

      const updatedConv: Conversation = {
        ...targetConv,
        status: nextStatus,
        isArchived: false,
        assignedAdminId:
          senderType === 'admin' && targetConv.recipientType === 'admin'
            ? senderId
            : targetConv.assignedAdminId,
        lastMessageId: msgId,
        lastMessageContent: previewContent,
        lastMessageAt: now,
        lastMessageSenderType: senderType,
        unreadCountStudent:
          senderType === 'supervisor' || senderType === 'admin'
            ? targetConv.unreadCountStudent + 1
            : targetConv.unreadCountStudent,
        unreadCountSupervisor:
          senderType === 'student'
            ? targetConv.unreadCountSupervisor + 1
            : targetConv.unreadCountSupervisor,
        updatedAt: now,
      };

      const optimisticMsg: ChatMessage = {
        id: msgId,
        clientMessageId: cmsgId,
        conversationId: updatedConv.id,
        senderType,
        senderId,
        senderName,
        recipientType: updatedConv.recipientType,
        recipientId:
          senderType === 'student'
            ? updatedConv.recipientType === 'supervisor'
              ? updatedConv.supervisorId
              : 'admin'
            : updatedConv.studentId,
        content: trimmed,
        attachmentUrl,
        attachmentName,
        attachmentMimeType,
        attachmentSize,
        attachmentType: attachmentUrl ? attachmentType || 'image' : undefined,
        replyToMessageId,
        deliveryStatus: 'sending',
        isRead: false,
        createdAt: now,
      };

      // تحديث الواجهة فوراً بحالة «جارٍ الإرسال» فقط
      conversationsRef.current = [
        updatedConv,
        ...conversationsRef.current.filter((c) => c.id !== updatedConv.id),
      ];
      setConversations((prev) => [
        updatedConv,
        ...prev.filter((c) => c.id !== updatedConv.id),
      ]);

      messagesRef.current = [...messagesRef.current, optimisticMsg];
      setMessages((prev) => [...prev, optimisticMsg]);

      return commitOutboundMessage({ conv: updatedConv, msg: optimisticMsg });
    },
    [commitOutboundMessage, createOrGetConversation]
  );

  const retryChatMessage = useCallback(
    async (messageId: string): Promise<{ success: boolean; error?: string }> => {
      const targetMsg = messagesRef.current.find((m) => m.id === messageId);
      if (!targetMsg) {
        return { success: false, error: 'الرسالة غير موجودة.' };
      }
      const targetConv = conversationsRef.current.find((c) => c.id === targetMsg.conversationId);
      if (!targetConv) {
        return { success: false, error: 'المحادثة غير موجودة.' };
      }

      const retryingMsg: ChatMessage = {
        ...targetMsg,
        deliveryStatus: 'sending',
        errorReason: undefined,
        updatedAt: new Date().toISOString(),
      };
      messagesRef.current = messagesRef.current.map((m) => (m.id === messageId ? retryingMsg : m));
      setMessages((prev) => prev.map((m) => (m.id === messageId ? retryingMsg : m)));

      const res = await commitOutboundMessage({ conv: targetConv, msg: retryingMsg });
      return { success: res.success, error: res.error };
    },
    [commitOutboundMessage]
  );

  const flushChatOutbox = useCallback(async () => {
    if (isFlushingOutboxRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const queued = loadChatOutbox();
    if (queued.length === 0) return;

    isFlushingOutboxRef.current = true;
    try {
      for (const item of queued) {
        const failedMsg = messagesRef.current.find(
          (m) =>
            (m.clientMessageId && m.clientMessageId === item.clientMessageId) ||
            m.id === item.clientMessageId
        );
        if (failedMsg && failedMsg.deliveryStatus === 'failed') {
          await retryChatMessage(failedMsg.id);
        } else if (!failedMsg) {
          // إعادة إرسال الرسالة المحفوظة في القائمة إذا لم تكن محملة في السجل بعد إعادة تشغيل المتصفح
          await sendChatMessage({
            conversationId: item.conversationId,
            studentId: item.studentId,
            recipientType: item.recipientType,
            supervisorId: item.supervisorId,
            senderType: item.senderType,
            senderId: item.senderId,
            senderName: item.senderName,
            content: item.content,
            attachmentUrl: item.attachmentUrl,
            attachmentName: item.attachmentName,
            attachmentMimeType: item.attachmentMimeType,
            attachmentSize: item.attachmentSize,
            attachmentType: item.attachmentType,
            replyToMessageId: item.replyToMessageId,
            clientMessageId: item.clientMessageId,
          });
        } else {
          dequeueChatMessage(item.clientMessageId);
        }
      }
    } finally {
      isFlushingOutboxRef.current = false;
    }
  }, [dequeueChatMessage, retryChatMessage, sendChatMessage]);

  const markConversationDelivered = useCallback(
    (conversationId: string, receiverType: 'student' | 'supervisor' | 'admin') => {
      const now = new Date().toISOString();
      const targetIds = messagesRef.current
        .filter((m) => {
          if (m.conversationId !== conversationId) return false;
          const isFromOppositeSide =
            receiverType === 'student'
              ? m.senderType === 'supervisor' || m.senderType === 'admin'
              : m.senderType === 'student';
          return isFromOppositeSide && m.deliveryStatus === 'sent';
        })
        .map((m) => m.id);

      if (targetIds.length === 0) return;

      const targetSet = new Set(targetIds);
      setMessages((prev) =>
        prev.map((m) =>
          targetSet.has(m.id) && m.deliveryStatus === 'sent'
            ? { ...m, deliveryStatus: 'delivered' as const, deliveredAt: m.deliveredAt || now }
            : m
        )
      );

      broadcastChatEvent({
        type: 'MESSAGE_DELIVERED',
        sourceTabId: TAB_INSTANCE_ID,
        conversationId,
        messageIds: targetIds,
        deliveredAt: now,
      });
    },
    []
  );

  const markConversationAsRead = useCallback(
    (conversationId: string, readerType: 'student' | 'supervisor' | 'admin') => {
      const now = new Date().toISOString();

      const hasUnreadMsgs = messagesRef.current.some((m) => {
        if (m.conversationId !== conversationId) return false;
        const isOpposite =
          readerType === 'student'
            ? m.senderType === 'supervisor' || m.senderType === 'admin'
            : m.senderType === 'student';
        return (
          isOpposite &&
          (!m.isRead || m.deliveryStatus !== 'read') &&
          m.deliveryStatus !== 'failed'
        );
      });

      const currentConv = conversationsRef.current.find((c) => c.id === conversationId);
      const hasConvUnread = Boolean(
        currentConv &&
          (readerType === 'student'
            ? currentConv.unreadCountStudent > 0
            : currentConv.unreadCountSupervisor > 0)
      );

      if (!hasUnreadMsgs && !hasConvUnread) return;

      if (hasUnreadMsgs) {
        const nextMsgs = messagesRef.current.map((m) => {
          if (m.conversationId !== conversationId) return m;
          const isOpposite =
            readerType === 'student'
              ? m.senderType === 'supervisor' || m.senderType === 'admin'
              : m.senderType === 'student';
          if (
            isOpposite &&
            (!m.isRead || m.deliveryStatus !== 'read') &&
            m.deliveryStatus !== 'failed'
          ) {
            return {
              ...m,
              isRead: true,
              deliveryStatus: 'read' as const,
              deliveredAt: m.deliveredAt || now,
              readAt: m.readAt || now,
            };
          }
          return m;
        });
        messagesRef.current = nextMsgs;
        setMessages(nextMsgs);
      }

      if (hasConvUnread) {
        const nextConvs = conversationsRef.current.map((c) => {
          if (c.id !== conversationId) return c;
          return {
            ...c,
            unreadCountStudent: readerType === 'student' ? 0 : c.unreadCountStudent,
            unreadCountSupervisor: readerType !== 'student' ? 0 : c.unreadCountSupervisor,
          };
        });
        conversationsRef.current = nextConvs;
        setConversations(nextConvs);
      }

      persistChatSnapshotNow(conversationsRef.current, messagesRef.current);
      markConversationReadInSupabase(conversationId, readerType);
      broadcastChatEvent({
        type: 'CONVERSATION_READ',
        sourceTabId: TAB_INSTANCE_ID,
        conversationId,
        readerType,
        readAt: now,
      });
    },
    [persistChatSnapshotNow]
  );

  const appendSystemChatMessage = useCallback(
    (
      conversationId: string,
      content: string,
      systemEventType: ChatMessage['systemEventType']
    ) => {
      const now = new Date().toISOString();
      const sysMsg: ChatMessage = {
        id: `msg-sys-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        conversationId,
        senderType: 'system',
        senderId: 'system',
        senderName: 'إشعار النظام',
        content,
        deliveryStatus: 'read',
        isRead: true,
        deliveredAt: now,
        readAt: now,
        systemEventType,
        createdAt: now,
      };
      setMessages((prev) => [...prev, sysMsg]);
      return sysMsg;
    },
    []
  );

  const updateConversationStatus = useCallback(
    ({
      conversationId,
      status,
      actorId,
      actorType,
      actorName,
      reason,
    }: {
      conversationId: string;
      status: ConversationStatus;
      actorId: string;
      actorType: 'admin' | 'supervisor' | 'student';
      actorName: string;
      reason?: string;
    }) => {
      const conv = conversationsRef.current.find((c) => c.id === conversationId);
      if (!conv) return { success: false, error: 'المحادثة غير موجودة.' };

      const now = new Date().toISOString();
      const labels: Record<ConversationStatus, string> = {
        open: 'مفتوحة',
        waiting_reply: 'بانتظار الرد',
        completed: 'مكتملة',
        archived: 'مؤرشفة',
      };

      const systemText =
        status === 'archived'
          ? `تمت أرشفة المحادثة بواسطة ${actorName}${reason ? ` (${reason})` : ''}.`
          : status === 'completed'
          ? `تم إغلاق المحادثة وتحديدها كمكتملة بواسطة ${actorName}.`
          : status === 'open' && (conv.status === 'completed' || conv.status === 'archived')
          ? `تمت إعادة فتح المحادثة بواسطة ${actorName}.`
          : `تم تحديث حالة المحادثة إلى «${labels[status]}» بواسطة ${actorName}.`;

      const eventType: ChatMessage['systemEventType'] =
        status === 'archived'
          ? 'archived'
          : status === 'completed'
          ? 'closed'
          : status === 'open' && (conv.status === 'completed' || conv.status === 'archived')
          ? 'reopened'
          : 'status_changed';

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                status,
                isArchived: status === 'archived',
                archivedAt: status === 'archived' ? now : undefined,
                archivedById: status === 'archived' ? actorId : undefined,
                updatedAt: now,
              }
            : c
        )
      );

      appendSystemChatMessage(conversationId, systemText, eventType);

      logAudit({
        actorId,
        actorType,
        actorName,
        action: 'CHAT_STATUS_UPDATED',
        entityType: 'conversation',
        entityId: conversationId,
        previousState: { status: conv.status, isArchived: conv.isArchived },
        newState: { status, isArchived: status === 'archived' },
        reason: reason || systemText,
      });

      return { success: true };
    },
    [appendSystemChatMessage]
  );

  const togglePinConversation = useCallback(
    (conversationId: string, staffId: string, staffName: string) => {
      const conv = conversationsRef.current.find((c) => c.id === conversationId);
      if (!conv) return { success: false, error: 'المحادثة غير موجودة.' };

      const nextPinned = !conv.isPinned;
      const now = new Date().toISOString();

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                isPinned: nextPinned,
                pinnedAt: nextPinned ? now : undefined,
                pinnedById: nextPinned ? staffId : undefined,
                updatedAt: now,
              }
            : c
        )
      );

      const staffRole =
        staffRef.current.find((s) => s.id === staffId)?.role === 'admin' ? 'admin' : 'supervisor';
      logAudit({
        actorId: staffId,
        actorType: staffRole,
        actorName: staffName,
        action: nextPinned ? 'CHAT_PINNED' : 'CHAT_UNPINNED',
        entityType: 'conversation',
        entityId: conversationId,
      });

      return { success: true };
    },
    []
  );

  const toggleFollowUpConversation = useCallback(
    (conversationId: string, staffId: string, staffName: string) => {
      const conv = conversationsRef.current.find((c) => c.id === conversationId);
      if (!conv) return { success: false, error: 'المحادثة غير موجودة.' };

      const nextFollowUp = !conv.isFollowUp;
      const now = new Date().toISOString();

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, isFollowUp: nextFollowUp, updatedAt: now }
            : c
        )
      );

      const staffRole =
        staffRef.current.find((s) => s.id === staffId)?.role === 'admin' ? 'admin' : 'supervisor';
      logAudit({
        actorId: staffId,
        actorType: staffRole,
        actorName: staffName,
        action: nextFollowUp ? 'CHAT_MARKED_FOLLOW_UP' : 'CHAT_UNMARKED_FOLLOW_UP',
        entityType: 'conversation',
        entityId: conversationId,
      });

      return { success: true };
    },
    []
  );

  const transferConversationToAdmin = useCallback(
    ({
      conversationId,
      fromStaffId,
      fromStaffName,
      fromRole,
      reason,
    }: {
      conversationId: string;
      fromStaffId: string;
      fromStaffName: string;
      fromRole: 'admin' | 'supervisor';
      reason?: string;
    }) => {
      const conv = conversationsRef.current.find((c) => c.id === conversationId);
      if (!conv) return { success: false, error: 'المحادثة غير موجودة.' };
      if (conv.recipientType === 'admin') {
        return { success: false, error: 'المحادثة موجّهة بالفعل إلى صندوق وارد الإدارة.' };
      }

      const now = new Date().toISOString();
      const student = students.find((s) => s.id === conv.studentId);
      const sysText = `تم تحويل المحادثة من المشرف (${fromStaffName}) إلى إدارة المكتبة${
        reason ? ` — السبب: ${reason}` : ''
      }.`;

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                recipientType: 'admin',
                supervisorId: undefined,
                status: 'open',
                isArchived: false,
                unreadCountSupervisor: Math.max(1, c.unreadCountSupervisor),
                lastMessageContent: sysText,
                lastMessageAt: now,
                lastMessageSenderType: 'system',
                updatedAt: now,
              }
            : c
        )
      );

      const sysMsg = appendSystemChatMessage(conversationId, sysText, 'transferred');

      emitScopedNotification({
        recipientType: 'staff',
        recipientRole: 'admin',
        title: 'محادثة محوّلة إلى الإدارة',
        message: `حوّل ${fromStaffName} محادثة الطالب ${student?.fullName || ''} إلى صندوق الإدارة.`,
        type: 'warning',
        conversationId,
        sourceMessageId: sysMsg.id,
        dedupeKey: `chat-transfer-${sysMsg.id}`,
      });

      logAudit({
        actorId: fromStaffId,
        actorType: fromRole,
        actorName: fromStaffName,
        action: 'CHAT_TRANSFERRED_TO_ADMIN',
        entityType: 'conversation',
        entityId: conversationId,
        previousState: { recipientType: conv.recipientType, supervisorId: conv.supervisorId },
        newState: { recipientType: 'admin', supervisorId: null },
        reason: reason || 'تحويل للإدارة للمتابعة',
      });

      return { success: true };
    },
    [appendSystemChatMessage, students]
  );

  const softDeleteChatMessage = useCallback(
    ({
      messageId,
      deletedById,
      deletedByType,
      deletedByName,
      reason,
    }: {
      messageId: string;
      deletedById: string;
      deletedByType: 'admin' | 'supervisor' | 'student';
      deletedByName: string;
      reason?: string;
    }) => {
      const targetMsg = messagesRef.current.find((m) => m.id === messageId);
      if (!targetMsg) return { success: false, error: 'الرسالة غير موجودة.' };
      if (targetMsg.isDeleted) return { success: false, error: 'تم حذف هذه الرسالة مسبقاً.' };

      if (deletedByType === 'student' && targetMsg.senderId !== deletedById) {
        return { success: false, error: 'لا يمكنك حذف رسالة لا تخصك.' };
      }

      const now = new Date().toISOString();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                isDeleted: true,
                deletedAt: now,
                deletedById,
                deletedByName,
                deletedReason: reason,
                updatedAt: now,
              }
            : m
        )
      );

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== targetMsg.conversationId) return c;
          if (c.lastMessageId === messageId) {
            return {
              ...c,
              lastMessageContent: 'تم حذف هذه الرسالة',
              updatedAt: now,
            };
          }
          return c;
        })
      );

      logAudit({
        actorId: deletedById,
        actorType: deletedByType,
        actorName: deletedByName,
        action: 'CHAT_MESSAGE_SOFT_DELETED',
        entityType: 'chat_message',
        entityId: messageId,
        previousState: { content: targetMsg.content, attachmentName: targetMsg.attachmentName },
        newState: { isDeleted: true, deletedAt: now },
        reason: reason || 'حذف ناعم من داخل المحادثة مع حفظ السجل',
      });

      return { success: true };
    },
    []
  );

  const toggleMessageReaction = useCallback(
    (messageId: string, emoji: string, userId: string) => {
      const targetMsg = messagesRef.current.find((m) => m.id === messageId);
      if (!targetMsg || targetMsg.isDeleted) return;
      const currentReactions: Record<string, string[]> = { ...(targetMsg.reactions || {}) };
      const userList = currentReactions[emoji] || [];
      const hasReacted = userList.includes(userId);
      if (hasReacted) {
        currentReactions[emoji] = userList.filter((id) => id !== userId);
        if (currentReactions[emoji].length === 0) delete currentReactions[emoji];
      } else {
        currentReactions[emoji] = [...userList, userId];
      }
      const nextMessages = messagesRef.current.map((m) =>
        m.id === messageId ? { ...m, reactions: currentReactions, updatedAt: new Date().toISOString() } : m
      );
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      persistChatSnapshotNow(conversationsRef.current, nextMessages);
      broadcastChatEvent({
        type: 'LIBRARY_DATA_UPDATED',
        sourceTabId: TAB_INSTANCE_ID,
        conversationId: targetMsg.conversationId,
        messageId,
        updatedAt: new Date().toISOString(),
      });
    },
    [persistChatSnapshotNow]
  );

  const updateConversationPresence = useCallback(
    (conversationId: string, actorType: 'student' | 'staff') => {
      if (!chatSettingsRef.current.showLastSeen) return;
      const throttleKey = `${conversationId}:${actorType}`;
      const nowMs = Date.now();
      if (
        lastPresenceMapRef.current[throttleKey] &&
        nowMs - lastPresenceMapRef.current[throttleKey] < 20000
      ) {
        return;
      }
      lastPresenceMapRef.current[throttleKey] = nowMs;
      const now = new Date().toISOString();

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          return actorType === 'student'
            ? { ...c, studentLastSeenAt: now }
            : { ...c, staffLastSeenAt: now };
        })
      );

      broadcastChatEvent({
        type: 'PRESENCE_PING',
        sourceTabId: TAB_INSTANCE_ID,
        conversationId,
        actorType,
        lastSeenAt: now,
      });
    },
    []
  );

  // المزامنة اللحظية الفورية عبر التبويبات/النوافذ دون الحاجة لأي تحديث يدوي (F5)
  useEffect(() => {
    const syncFromLocalStorage = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);

        // حماية من الحلقات التكرارية
        skipNextBroadcastRef.current = true;
        skipNextPersistWriteRef.current = true;
        lastWrittenJsonRef.current = raw;

        // 1. مزامنة المحادثات والرسائل الفورية
        if (Array.isArray(parsed?.conversations)) {
          const normalizedConvs = parsed.conversations.map(normalizeConversation);
          if (JSON.stringify(normalizedConvs) !== JSON.stringify(conversationsRef.current)) {
            conversationsRef.current = normalizedConvs;
            setConversations(normalizedConvs);
          }
        }

        if (Array.isArray(parsed?.messages)) {
          const remoteNormalized: ChatMessage[] = parsed.messages.map(normalizeMessage);
          const remoteIds = new Set(remoteNormalized.map((m) => m.id));
          const localPendingOrFailed = messagesRef.current.filter(
            (m) =>
              !remoteIds.has(m.id) &&
              (m.deliveryStatus === 'sending' || m.deliveryStatus === 'failed')
          );
          const mergedMsgs = [...remoteNormalized, ...localPendingOrFailed].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          if (JSON.stringify(mergedMsgs) !== JSON.stringify(messagesRef.current)) {
            messagesRef.current = mergedMsgs;
            setMessages(mergedMsgs);
          }
        }

        // 2. مزامنة الطلاب وطاقم الإشراف
        if (Array.isArray(parsed?.students)) {
          const syncedStudents = migrateStudentsPool(parsed.students).students;
          if (JSON.stringify(syncedStudents) !== JSON.stringify(studentsRef.current)) {
            studentsRef.current = syncedStudents;
            setStudents(syncedStudents);
          }
        }
        if (Array.isArray(parsed?.staff)) {
          staffRef.current = parsed.staff;
          setStaff(parsed.staff);
        }

        // 3. مزامنة طلبات إكمال الكتب اللحظية (Reading Completions)
        if (Array.isArray(parsed?.readingCompletions)) {
          setReadingCompletions(parsed.readingCompletions);
        }

        // 4. مزامنة الإعارات وأحداثها (Loans & Events)
        if (Array.isArray(parsed?.loans)) {
          setLoans(parsed.loans);
        }
        if (Array.isArray(parsed?.loanEvents)) {
          setLoanEvents(parsed.loanEvents);
        }

        // 5. مزامنة النسخ والكتب والتصنيفات (Copies & Books)
        if (Array.isArray(parsed?.copies)) {
          setCopies(parsed.copies);
        }
        if (Array.isArray(parsed?.books)) {
          setBooks(parsed.books);
        }
        if (Array.isArray(parsed?.categories)) {
          setCategories(parsed.categories);
        }

        // 6. مزامنة الحجوزات وطلبات الإرجاع والاستبدال (Requests)
        if (Array.isArray(parsed?.reservations)) {
          setReservations(parsed.reservations);
        }
        if (Array.isArray(parsed?.returnRequests)) {
          setReturnRequests(parsed.returnRequests);
        }
        if (Array.isArray(parsed?.exchangeRequests)) {
          setExchangeRequests(parsed.exchangeRequests);
        }

        // 7. مزامنة المناقشات القرائية والمجموعات
        if (Array.isArray(parsed?.discussions)) {
          setDiscussions(parsed.discussions);
        }
        if (Array.isArray(parsed?.discussionGroups)) {
          setDiscussionGroups(parsed.discussionGroups);
        }
        if (parsed?.discussionSettingsState) {
          setDiscussionSettingsState(parsed.discussionSettingsState);
        }

        // 8. مزامنة سجلات القراءة والألقاب والشهادات
        if (Array.isArray(parsed?.readingLogs)) {
          setReadingLogs(parsed.readingLogs);
        }
        if (Array.isArray(parsed?.readingLogCorrections)) {
          setReadingLogCorrections(parsed.readingLogCorrections);
        }
        if (Array.isArray(parsed?.studentRanks)) {
          setStudentRanks(parsed.studentRanks);
        }
        if (Array.isArray(parsed?.readingCertificates)) {
          setReadingCertificates(parsed.readingCertificates);
        }
        if (Array.isArray(parsed?.readingRanks)) {
          setReadingRanks(parsed.readingRanks);
        }
        if (parsed?.certificateSettings) {
          setCertificateSettings(parsed.certificateSettings);
        }

        // 9. مزامنة الاختبارات الإلكترونية ومحاولات الطلاب
        if (Array.isArray(parsed?.exams)) {
          setExams(parsed.exams);
        }
        if (Array.isArray(parsed?.examAttempts)) {
          setExamAttempts(parsed.examAttempts);
        }

        // 10. مزامنة سجل الرقابة والتقارير والإعدادات
        if (Array.isArray(parsed?.auditLogs)) {
          setAuditLogs(parsed.auditLogs);
        }
        if (parsed?.settings) {
          setSettings(parsed.settings);
        }
        if (parsed?.reportSettings) {
          setReportSettings(parsed.reportSettings);
        }
        if (Array.isArray(parsed?.groupReportSummaries)) {
          setGroupReportSummaries(parsed.groupReportSummaries);
        }
        if (Array.isArray(parsed?.studentReportNotes)) {
          setStudentReportNotes(parsed.studentReportNotes);
        }
        if (Array.isArray(parsed?.conditionReports)) {
          setConditionReports(parsed.conditionReports);
        }
        if (Array.isArray(parsed?.inventorySessions)) {
          setInventorySessions(parsed.inventorySessions);
        }
        if (Array.isArray(parsed?.inventoryScans)) {
          setInventoryScans(parsed.inventoryScans);
        }
        if (Array.isArray(parsed?.readingChallenges)) {
          setReadingChallenges(parsed.readingChallenges);
        }
        if (Array.isArray(parsed?.waitlist)) {
          setWaitlist(parsed.waitlist);
        }
      } catch (e) {
        console.warn('Cross-tab live data sync failed:', e);
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        if (e.newValue && e.newValue === lastWrittenJsonRef.current) return;
        syncFromLocalStorage();
      } else if (e.key === CHAT_OUTBOX_STORAGE_KEY) {
        setChatOutbox(loadChatOutbox());
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(CHAT_SYNC_CHANNEL_NAME);
        channel.onmessage = (event) => {
          const data = event.data;
          if (!data || data.sourceTabId === TAB_INSTANCE_ID) return;

          if (data.type === 'LIBRARY_DATA_UPDATED') {
            syncFromLocalStorage();
          } else if (data.type === 'CONVERSATION_READ') {
            skipNextBroadcastRef.current = true;
            skipNextPersistWriteRef.current = true;
            setMessages((prev) =>
              prev.map((m) => {
                if (m.conversationId !== data.conversationId) return m;
                const isOpposite =
                  data.readerType === 'student'
                    ? m.senderType === 'supervisor' || m.senderType === 'admin'
                    : m.senderType === 'student';
                return isOpposite && m.deliveryStatus !== 'failed'
                  ? {
                      ...m,
                      isRead: true,
                      deliveryStatus: 'read',
                      deliveredAt: m.deliveredAt || data.readAt,
                      readAt: m.readAt || data.readAt,
                    }
                  : m;
              })
            );
          } else if (data.type === 'MESSAGE_DELIVERED') {
            skipNextBroadcastRef.current = true;
            skipNextPersistWriteRef.current = true;
            setMessages((prev) =>
              prev.map((m) =>
                m.conversationId === data.conversationId &&
                Array.isArray(data.messageIds) &&
                data.messageIds.includes(m.id) &&
                m.deliveryStatus === 'sent'
                  ? { ...m, deliveryStatus: 'delivered', deliveredAt: data.deliveredAt }
                  : m
              )
            );
          } else if (data.type === 'PRESENCE_PING') {
            skipNextBroadcastRef.current = true;
            skipNextPersistWriteRef.current = true;
            setConversations((prev) =>
              prev.map((c) =>
                c.id === data.conversationId
                  ? data.actorType === 'student'
                    ? { ...c, studentLastSeenAt: data.lastSeenAt }
                    : { ...c, staffLastSeenAt: data.lastSeenAt }
                  : c
              )
            );
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel setup failed:', e);
    }

    const handleOnline = () => {
      setIsChatOnline(true);
      flushChatOutbox();
    };
    const handleOffline = () => {
      setIsChatOnline(false);
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // الاشتراك المباشر في أحداث المزامنة المركزية الفورية (Central Real-Time Sync)
    const unsubscribeCentralSync = centralSync.subscribeToSyncEvents((event) => {
      skipNextPersistWriteRef.current = false;
      switch (event.entity) {
        case 'books':
          if (event.action === 'INSERT') {
            setBooks((prev) => [event.data, ...prev.filter((b) => b.id !== event.data.id)]);
          } else if (event.action === 'UPDATE') {
            setBooks((prev) => prev.map((b) => (b.id === event.data.id ? { ...b, ...event.data } : b)));
          } else if (event.action === 'DELETE') {
            setBooks((prev) => prev.filter((b) => b.id !== event.recordId));
          }
          break;
        case 'copies':
          if (event.action === 'INSERT') {
            setCopies((prev) => [event.data, ...prev.filter((c) => c.id !== event.data.id)]);
          } else if (event.action === 'UPDATE') {
            setCopies((prev) => prev.map((c) => (c.id === event.data.id ? { ...c, ...event.data } : c)));
          } else if (event.action === 'DELETE') {
            setCopies((prev) => prev.filter((c) => c.id !== event.recordId));
          }
          break;
        case 'categories':
          if (event.action === 'INSERT') {
            setCategories((prev) => [...prev.filter((c) => c.id !== event.data.id), event.data]);
          } else if (event.action === 'UPDATE') {
            setCategories((prev) => prev.map((c) => (c.id === event.data.id ? { ...c, ...event.data } : c)));
          }
          break;
        case 'students':
          if (event.action === 'INSERT') {
            setStudents((prev) => [event.data, ...prev.filter((s) => s.id !== event.data.id)]);
          } else if (event.action === 'UPDATE') {
            setStudents((prev) => prev.map((s) => (s.id === event.data.id ? { ...s, ...event.data } : s)));
          }
          break;
        case 'staff':
          if (event.action === 'INSERT') {
            setStaff((prev) => [event.data, ...prev.filter((s) => s.id !== event.data.id)]);
          } else if (event.action === 'UPDATE') {
            setStaff((prev) => prev.map((s) => (s.id === event.data.id ? { ...s, ...event.data } : s)));
          }
          break;
        case 'loans':
          if (event.action === 'INSERT') {
            setLoans((prev) => [event.data, ...prev.filter((l) => l.id !== event.data.id)]);
          } else if (event.action === 'UPDATE') {
            setLoans((prev) => prev.map((l) => (l.id === event.data.id ? { ...l, ...event.data } : l)));
          }
          break;
        case 'reservations':
          if (event.action === 'INSERT') {
            setReservations((prev) => [event.data, ...prev.filter((r) => r.id !== event.data.id)]);
          } else if (event.action === 'UPDATE') {
            setReservations((prev) => prev.map((r) => (r.id === event.data.id ? { ...r, ...event.data } : r)));
          }
          break;
        case 'returnRequests':
          if (event.action === 'INSERT') {
            setReturnRequests((prev) => [event.data, ...prev.filter((r) => r.id !== event.data.id)]);
          } else if (event.action === 'UPDATE') {
            setReturnRequests((prev) => prev.map((r) => (r.id === event.data.id ? { ...r, ...event.data } : r)));
          }
          break;
        case 'exchangeRequests':
          if (event.action === 'INSERT') {
            setExchangeRequests((prev) => [event.data, ...prev.filter((r) => r.id !== event.data.id)]);
          } else if (event.action === 'UPDATE') {
            setExchangeRequests((prev) => prev.map((r) => (r.id === event.data.id ? { ...r, ...event.data } : r)));
          }
          break;
        case 'readingCompletions':
          if (event.action === 'INSERT') {
            setReadingCompletions((prev) => [event.data, ...prev.filter((c) => c.id !== event.data.id)]);
          } else if (event.action === 'UPDATE') {
            setReadingCompletions((prev) => prev.map((c) => (c.id === event.data.id ? { ...c, ...event.data } : c)));
          }
          break;
        case 'readingLogs':
          if (event.action === 'INSERT') {
            setReadingLogs((prev) => [event.data, ...prev.filter((l) => l.id !== event.data.id)]);
          } else if (event.action === 'UPDATE') {
            setReadingLogs((prev) => prev.map((l) => (l.id === event.data.id ? { ...l, ...event.data } : l)));
          }
          break;
        case 'discussions':
          if (event.action === 'INSERT') {
            setDiscussions((prev) => [event.data, ...prev.filter((d) => d.id !== event.data.id)]);
          } else if (event.action === 'UPDATE') {
            setDiscussions((prev) => prev.map((d) => (d.id === event.data.id ? { ...d, ...event.data } : d)));
          }
          break;
        case 'exams':
          if (event.action === 'INSERT') {
            setExams((prev) => [event.data, ...prev.filter((e) => e.id !== event.data.id)]);
          } else if (event.action === 'UPDATE') {
            setExams((prev) => prev.map((e) => (e.id === event.data.id ? { ...e, ...event.data } : e)));
          } else if (event.action === 'DELETE') {
            setExams((prev) => prev.filter((e) => e.id !== event.recordId));
          }
          break;
        case 'examAttempts':
          if (event.action === 'INSERT') {
            setExamAttempts((prev) => [event.data, ...prev.filter((a) => a.id !== event.data.id)]);
          } else if (event.action === 'UPDATE') {
            setExamAttempts((prev) => prev.map((a) => (a.id === event.data.id ? { ...a, ...event.data } : a)));
          }
          break;
        case 'settings':
          setSettings(event.data);
          break;
        case 'certificateSettings':
          setCertificateSettings(event.data);
          break;
        case 'achievementSettings':
          setAchievementSettings(event.data);
          break;
      }
    });

    // جلب أحدث حالة مركزية من السحابة عند توفر الاتصال
    if (isSupabaseConfigured()) {
      fetchFullCloudState().then((cloudData) => {
        if (!cloudData) return;
        if (Array.isArray(cloudData.books) && cloudData.books.length > 0) {
          setBooks((prev) => {
            const merged = [...prev];
            cloudData.books.forEach((cb: Book) => {
              const idx = merged.findIndex((b) => b.id === cb.id);
              if (idx >= 0) merged[idx] = cb;
              else merged.unshift(cb);
            });
            return merged;
          });
        }
        if (Array.isArray(cloudData.students) && cloudData.students.length > 0) {
          setStudents((prev) => {
            const merged = [...prev];
            cloudData.students.forEach((cs: Student) => {
              const idx = merged.findIndex((s) => s.id === cs.id);
              if (idx >= 0) merged[idx] = cs;
              else merged.unshift(cs);
            });
            return merged;
          });
        }
      });
    }

    // اشتراك Supabase Realtime للأجهزة المتعددة عند تفعيل السحابة
    let supabaseChannel: any = null;
    if (isSupabaseConfigured() && supabase) {
      supabaseChannel = supabase
        .channel('wathba-realtime-chat-v1')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages' },
          (payload: any) => {
            const row = payload.new;
            if (!row) return;
            const incoming: ChatMessage = normalizeMessage({
              id: row.id,
              clientMessageId: row.client_message_id,
              conversationId: row.conversation_id,
              senderType: row.sender_type,
              senderId: row.sender_id,
              senderName: row.sender_name,
              recipientType: row.recipient_type,
              recipientId: row.recipient_id,
              content: row.content,
              attachmentUrl: row.attachment_url,
              attachmentName: row.attachment_name,
              attachmentType: row.attachment_type,
              replyToMessageId: row.reply_to_message_id,
              deliveryStatus: row.delivery_status,
              isRead: row.is_read,
              deliveredAt: row.delivered_at,
              readAt: row.read_at,
              isDeleted: row.is_deleted,
              deletedAt: row.deleted_at,
              createdAt: row.created_at,
            });
            skipNextBroadcastRef.current = true;
            setMessages((prev) => {
              const idx = prev.findIndex((m) => m.id === incoming.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = { ...prev[idx], ...incoming };
                return updated;
              }
              return [...prev, incoming].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );
            });
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'conversations' },
          (payload: any) => {
            const row = payload.new;
            if (!row) return;
            const incomingConv = normalizeConversation({
              id: row.id,
              studentId: row.student_id,
              recipientType: row.recipient_type,
              supervisorId: row.supervisor_id,
              assignedAdminId: row.assigned_admin_id,
              status: row.status,
              isPinned: row.is_pinned,
              isFollowUp: row.is_follow_up,
              isArchived: row.is_archived,
              lastMessageContent: row.last_message_content,
              lastMessageAt: row.last_message_at,
              unreadCountStudent: row.unread_count_student,
              unreadCountSupervisor: row.unread_count_supervisor,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            });
            skipNextBroadcastRef.current = true;
            setConversations((prev) => {
              const filtered = prev.filter((c) => c.id !== incomingConv.id);
              return [incomingConv, ...filtered].sort(
                (a, b) =>
                  new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
              );
            });
          }
        )
        .subscribe();
    }

    return () => {
      unsubscribeCentralSync();
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (channel) {
        try {
          channel.close();
        } catch {
          // ignore
        }
      }
      if (supabaseChannel && supabase) {
        supabase.removeChannel(supabaseChannel);
      }
    };
  }, [flushChatOutbox]);

  // ========================================================================
  // نظام الألقاب والشهادات القرائية المتدرجة (الألقاب الخمسة والشهادات)
  // ========================================================================

  const getBookReadingCoverage = (studentId: string, bookId: string): BookReadingCoverage => {
    const book = books.find((b) => b.id === bookId);
    const bookPageCount = book?.pageCount && book.pageCount > 0 ? book.pageCount : 100;

    // التحقق مما إذا كان الطالب قد أتم قراءة الكتاب واعتمدها المشرف أو أجرى مناقشة معتمدة
    const isAutoFullyCompleted =
      (readingCompletions || []).some(
        (c) => c.studentId === studentId && c.bookId === bookId && c.status === 'approved'
      ) ||
      (discussions || []).some(
        (d) => d.studentId === studentId && d.bookId === bookId && d.status === 'approved'
      );

    const studentBookLogs = (readingLogs || []).filter(
      (l) =>
        l.studentId === studentId &&
        l.bookId === bookId &&
        (l.status === 'approved' || l.status === 'pending')
    );

    let approvedPages = studentBookLogs
      .filter((l) => l.status === 'approved')
      .reduce((sum, l) => sum + (l.correctedPagesCount ?? l.pagesCount), 0);

    const pendingPages = studentBookLogs
      .filter((l) => l.status === 'pending')
      .reduce((sum, l) => sum + l.pagesCount, 0);

    let loggedRanges = studentBookLogs.map((l) => ({
      fromPage: l.fromPage,
      toPage: l.toPage,
      status: l.status,
    }));

    if (isAutoFullyCompleted) {
      approvedPages = Math.max(bookPageCount, approvedPages);
      if (!loggedRanges.some((r) => r.fromPage <= 1 && r.toPage >= bookPageCount && r.status === 'approved')) {
        loggedRanges = [
          { fromPage: 1, toPage: bookPageCount, status: 'approved' },
          ...loggedRanges,
        ];
      }
    }

    const remainingPages = isAutoFullyCompleted
      ? 0
      : Math.max(0, bookPageCount - (approvedPages + pendingPages));
    const highestToPage = isAutoFullyCompleted
      ? bookPageCount
      : studentBookLogs.reduce((max, l) => Math.max(max, l.toPage), 0);

    return {
      bookPageCount,
      approvedPages,
      pendingPages,
      remainingPages,
      nextSuggestedFromPage: Math.min(bookPageCount, highestToPage + 1),
      loggedRanges,
    };
  };

  const getStudentRankSummary = (studentId: string): StudentRankSummary => {
    const activeRanksSorted = [...(readingRanks || [])]
      .filter((r) => r.isActive)
      .sort((a, b) => a.orderIndex - b.orderIndex || a.requiredPages - b.requiredPages);

    const approvedLogs = (readingLogs || []).filter(
      (l) => l.studentId === studentId && l.status === 'approved'
    );
    const pendingLogs = (readingLogs || []).filter(
      (l) => l.studentId === studentId && l.status === 'pending'
    );

    // جمع كافة الكتب المعتمدة للطالب سواء من سجل القراءة أو طلبات الإكمال المعتمدة أو المناقشات المعتمدة
    const autoApprovedBookIds = new Set<string>();
    (readingCompletions || [])
      .filter((c) => c.studentId === studentId && c.status === 'approved')
      .forEach((c) => autoApprovedBookIds.add(c.bookId));
    (discussions || [])
      .filter((d) => d.studentId === studentId && d.status === 'approved')
      .forEach((d) => autoApprovedBookIds.add(d.bookId));

    // عدد الكتب المكتملة بناءً على الصفحات المعتمدة
    const pagesByBook = new Map<string, number>();
    approvedLogs.forEach((l) => {
      pagesByBook.set(
        l.bookId,
        (pagesByBook.get(l.bookId) || 0) + (l.correctedPagesCount ?? l.pagesCount)
      );
    });

    // احتساب كامل صفحات الكتاب لكل كتاب معتمد إكماله أو مناقشته
    autoApprovedBookIds.forEach((bId) => {
      const b = books.find((bk) => bk.id === bId);
      const targetPages = b?.pageCount && b.pageCount > 0 ? b.pageCount : 100;
      const current = pagesByBook.get(bId) || 0;
      if (current < targetPages) {
        pagesByBook.set(bId, targetPages);
      }
    });

    let totalApprovedPages = 0;
    pagesByBook.forEach((pagesRead) => {
      totalApprovedPages += pagesRead;
    });

    const pendingPagesCount = pendingLogs.reduce((sum, l) => sum + l.pagesCount, 0);

    let completedBooksCount = 0;
    pagesByBook.forEach((pagesRead, bId) => {
      const b = books.find((bk) => bk.id === bId);
      const targetPages = b?.pageCount && b.pageCount > 0 ? b.pageCount : 100;
      if (pagesRead >= targetPages) {
        completedBooksCount += 1;
      }
    });

    const studentActiveAchievements = (studentRanks || []).filter(
      (sr) => sr.studentId === studentId && sr.status === 'active'
    );
    const studentCerts = (readingCertificates || []).filter(
      (c) => c.studentId === studentId
    );

    const achievementByRankId = new Map(
      studentActiveAchievements.map((a) => [a.rankId, a])
    );

    let currentRank: ReadingRankDefinition | null = null;
    let nextRank: ReadingRankDefinition | null = null;
    let foundNext = false;

    const tiers: RankTierProgress[] = activeRanksSorted.map((rank) => {
      const ach = achievementByRankId.get(rank.id);
      const isEarned = !!ach && totalApprovedPages >= rank.requiredPages;

      // أحدث شهادة فعالة لهذا اللقب
      const activeCert =
        studentCerts.find((c) => c.rankId === rank.id && c.status === 'active') ||
        studentCerts.find((c) => c.rankId === rank.id);

      let status: RankTierProgress['status'] = 'locked';
      if (isEarned) {
        status = 'earned';
        currentRank = rank;
      } else if (!foundNext) {
        status = 'in_progress';
        nextRank = rank;
        foundNext = true;
      }

      const pagesCompletedTowardTier = Math.min(totalApprovedPages, rank.requiredPages);
      const remainingPages = Math.max(0, rank.requiredPages - totalApprovedPages);
      const progressPercent =
        rank.requiredPages > 0
          ? Math.min(100, Math.max(0, Math.round((totalApprovedPages / rank.requiredPages) * 100)))
          : 100;

      return {
        rank,
        status,
        progressPercent,
        remainingPages,
        pagesCompletedTowardTier,
        achievement: ach,
        certificate: activeCert,
      };
    });

    const resolvedCurrentRank = currentRank as ReadingRankDefinition | null;
    const resolvedNextRank = nextRank as ReadingRankDefinition | null;

    const prevThreshold = resolvedCurrentRank ? resolvedCurrentRank.requiredPages : 0;
    const nextThreshold = resolvedNextRank ? resolvedNextRank.requiredPages : prevThreshold;
    const remainingPagesToNext = resolvedNextRank
      ? Math.max(0, nextThreshold - totalApprovedPages)
      : 0;

    let progressPercentToNext = 100;
    if (resolvedNextRank) {
      const span = Math.max(1, nextThreshold - prevThreshold);
      const covered = Math.max(0, totalApprovedPages - prevThreshold);
      progressPercentToNext = Math.min(100, Math.max(0, Math.round((covered / span) * 100)));
    }

    const highestTier = activeRanksSorted.find((r) => r.isHighestTier);
    const isWathabAchieved = !!(
      highestTier &&
      achievementByRankId.has(highestTier.id) &&
      totalApprovedPages >= highestTier.requiredPages
    );

    const uncelebratedAchievements = studentActiveAchievements.filter(
      (a) => !a.isCelebrated && a.status === 'active'
    );

    const approvedStudentDiscussions = (discussions || []).filter(
      (d) => d.studentId === studentId && d.status === 'approved'
    );
    const discussionPoints = approvedStudentDiscussions.reduce(
      (sum, d) => sum + (Number(d.pointsAwarded) || 0),
      0
    );

    return {
      totalApprovedPages,
      pendingPagesCount,
      completedBooksCount,
      discussionPoints,
      approvedDiscussionsCount: approvedStudentDiscussions.length,
      currentRank,
      nextRank,
      remainingPagesToNext,
      progressPercentToNext,
      isWathabAchieved,
      tiers,
      certificates: studentCerts.sort(
        (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()
      ),
      uncelebratedAchievements,
    };
  };

  // المزامنة التلقائية الشاملة بأثر رجعي: أي كتاب تم اعتماده في طلبات الإكمال أو تمت مناقشته واعتماده
  // يتم التأكد فوراً من تسجيل الكتاب وصفحاته كاملة في سجل الطالب (readingLogs) واحتساب رصيد صفحاته وألقابه
  useEffect(() => {
    const now = new Date().toISOString();
    const approvedComps = (readingCompletions || []).filter((c) => c.status === 'approved');
    const approvedDiscs = (discussions || []).filter((d) => d.status === 'approved');

    let hasNewLogs = false;
    const logsToAdd: ReadingLog[] = [];

    // 1. فحص كتب إكمال القراءة المعتمدة
    approvedComps.forEach((comp) => {
      const alreadyHas =
        readingLogs.some(
          (l) => l.studentId === comp.studentId && l.bookId === comp.bookId && l.status === 'approved'
        ) || logsToAdd.some((l) => l.studentId === comp.studentId && l.bookId === comp.bookId);

      if (!alreadyHas) {
        const bk = books.find((b) => b.id === comp.bookId);
        const pCount = bk?.pageCount && bk.pageCount > 0 ? bk.pageCount : 100;
        logsToAdd.push({
          id: `rlog-retro-${comp.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          studentId: comp.studentId,
          loanId: comp.loanId,
          bookId: comp.bookId,
          fromPage: 1,
          toPage: pCount,
          pagesCount: pCount,
          readingDate: comp.requestDate ? comp.requestDate.slice(0, 10) : now.slice(0, 10),
          studentNotes: comp.studentNotes || `اعتماد قراءة كتاب "${bk?.title || 'كتاب'}" كاملاً (${pCount} صفحة)`,
          status: 'approved',
          reviewedByStaffId: comp.approvedByStaffId,
          reviewedAt: comp.approvedAt || now,
          createdAt: comp.approvedAt || now,
          updatedAt: now,
        });
        hasNewLogs = true;
      }
    });

    // 2. فحص المناقشات المعتمدة
    approvedDiscs.forEach((disc) => {
      const alreadyHas =
        readingLogs.some(
          (l) => l.studentId === disc.studentId && l.bookId === disc.bookId && l.status === 'approved'
        ) || logsToAdd.some((l) => l.studentId === disc.studentId && l.bookId === disc.bookId);

      if (!alreadyHas) {
        const bk = books.find((b) => b.id === disc.bookId);
        const pCount = bk?.pageCount && bk.pageCount > 0 ? bk.pageCount : 100;
        logsToAdd.push({
          id: `rlog-retro-disc-${disc.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          studentId: disc.studentId,
          loanId: disc.loanId,
          bookId: disc.bookId,
          fromPage: 1,
          toPage: pCount,
          pagesCount: pCount,
          readingDate: disc.discussionDate ? disc.discussionDate.slice(0, 10) : now.slice(0, 10),
          studentNotes: `مناقشة كتاب "${bk?.title || 'كتاب'}" واعتماد القراءة والصفحات (${pCount} صفحة)`,
          status: 'approved',
          reviewedByStaffId: disc.approvedByStaffId || disc.supervisorId,
          reviewedAt: disc.approvedAt || now,
          createdAt: disc.approvedAt || now,
          updatedAt: now,
        });
        hasNewLogs = true;
      }
    });

    if (hasNewLogs && logsToAdd.length > 0) {
      setReadingLogs((prev) => [...logsToAdd, ...prev]);

      // مزامنة ألقاب وشهادات الطلاب المتأثرين فوراً
      const affectedStudentIds = Array.from(new Set(logsToAdd.map((l) => l.studentId)));
      affectedStudentIds.forEach((stuId) => {
        const studentAddedPages = logsToAdd
          .filter((l) => l.studentId === stuId)
          .reduce((sum, l) => sum + l.pagesCount, 0);
        const existingPages = readingLogs
          .filter((l) => l.studentId === stuId && l.status === 'approved')
          .reduce((sum, l) => sum + (l.correctedPagesCount ?? l.pagesCount), 0);
        syncStudentRanksAndCertificates(stuId, existingPages + studentAddedPages, now);
      });
    }
  }, [readingCompletions, discussions, books, readingLogs, syncStudentRanksAndCertificates]);

  // مزامنة تلقائية عند التحميل لأي سجلات قراءة معتمدة محفوظة مسبقاً
  useEffect(() => {
    const now = new Date().toISOString();
    students.forEach((stu) => {
      const approvedPages = readingLogs
        .filter((l) => l.studentId === stu.id && l.status === 'approved')
        .reduce((sum, l) => sum + (l.correctedPagesCount ?? l.pagesCount), 0);
      if (approvedPages > 0) {
        const activeRanks = readingRanks.filter(
          (r) => r.isActive && approvedPages >= r.requiredPages
        );
        const missing = activeRanks.some(
          (r) =>
            !studentRanks.some(
              (sr) => sr.studentId === stu.id && sr.rankId === r.id && sr.status === 'active'
            ) ||
            !readingCertificates.some(
              (c) => c.studentId === stu.id && c.rankId === r.id
            )
        );
        if (missing) {
          syncStudentRanksAndCertificates(stu.id, approvedPages, now);
        }
      }
    });
  }, []);

  const submitReadingLog = ({
    studentId,
    loanId,
    bookId,
    fromPage,
    toPage,
    readingDate,
    studentNotes,
  }: {
    studentId: string;
    loanId: string;
    bookId: string;
    fromPage: number;
    toPage: number;
    readingDate?: string;
    studentNotes?: string;
  }) => {
    const loan = loans.find((l) => l.id === loanId && l.studentId === studentId);
    if (!loan) {
      return { success: false, error: 'يجب اختيار كتاب مسجل في سجل استعاراتك' };
    }

    const copy = copies.find((c) => c.id === loan.copyId);
    const book = books.find((b) => b.id === (copy?.bookId || bookId));
    if (!book || book.id !== bookId) {
      return { success: false, error: 'الكتاب المختار غير مطابق لسجل الإعارة' };
    }

    const maxPages = book.pageCount && book.pageCount > 0 ? book.pageCount : 100;
    const fPage = Math.floor(Number(fromPage));
    const tPage = Math.floor(Number(toPage));

    if (!Number.isFinite(fPage) || !Number.isFinite(tPage) || fPage < 1 || tPage < fPage) {
      return { success: false, error: 'يرجى إدخال نطاق صفحات صحيح (من - إلى)' };
    }

    if (tPage > maxPages) {
      return {
        success: false,
        error: `لا يسمح بتجاوز عدد صفحات الكتاب (${maxPages} صفحة)`,
      };
    }

    // منع تسجيل الصفحات نفسها أكثر من مرة
    const existingForBook = readingLogs.filter(
      (l) =>
        l.studentId === studentId &&
        l.bookId === bookId &&
        (l.status === 'approved' || l.status === 'pending')
    );

    const overlap = existingForBook.find(
      (l) => fPage <= l.toPage && tPage >= l.fromPage
    );
    if (overlap) {
      return {
        success: false,
        error: `عذراً، الصفحات من ${overlap.fromPage} إلى ${overlap.toPage} مسجلة مسبقاً (${
          overlap.status === 'approved' ? 'معتمدة' : 'بانتظار الاعتماد'
        }). يرجى اختيار صفحات جديدة لم تُسجل.`,
      };
    }

    const pagesCount = tPage - fPage + 1;
    const now = new Date().toISOString();
    const effectiveDate = readingDate?.trim() || now.slice(0, 10);
    const student = students.find((s) => s.id === studentId);

    const newLog: ReadingLog = {
      id: `rlog-${Date.now()}`,
      studentId,
      loanId,
      bookId,
      fromPage: fPage,
      toPage: tPage,
      pagesCount,
      readingDate: effectiveDate,
      studentNotes: studentNotes?.trim(),
      status: 'pending', // لا تُحتسب الصفحات قبل اعتماد المشرف
      createdAt: now,
      updatedAt: now,
    };

    setReadingLogs((prev) => [newLog, ...prev]);

    logAudit({
      actorId: studentId,
      actorType: 'student',
      actorName: student?.fullName || 'طالب',
      action: 'تقديم طلب تسجيل قراءة كتاب',
      entityType: 'reading_log',
      entityId: newLog.id,
      notes: `قراءة ${pagesCount} صفحة (${fPage}-${tPage}) من كتاب "${book.title}" بتاريخ ${effectiveDate} (بانتظار الاعتماد)`,
    });

    return { success: true, log: newLog };
  };

  const approveReadingLog = ({
    logId,
    staffId,
  }: {
    logId: string;
    staffId: string;
  }) => {
    const log = readingLogs.find((l) => l.id === logId);
    if (!log) return { success: false, error: 'سجل القراءة غير موجود' };
    if (log.status !== 'pending') {
      return { success: false, error: 'هذا الطلب تمت مراجعته مسبقاً' };
    }

    const supervisor = staff.find((s) => s.id === staffId);
    const student = students.find((s) => s.id === log.studentId);
    const book = books.find((b) => b.id === log.bookId);
    const now = new Date().toISOString();

    setReadingLogs((prev) =>
      prev.map((l) =>
        l.id === logId
          ? {
              ...l,
              status: 'approved',
              reviewedByStaffId: staffId,
              reviewedAt: now,
              updatedAt: now,
            }
          : l
      )
    );

    const previousApprovedPages = readingLogs
      .filter((l) => l.studentId === log.studentId && l.status === 'approved')
      .reduce((sum, l) => sum + (l.correctedPagesCount ?? l.pagesCount), 0);
    const newTotalPages = previousApprovedPages + log.pagesCount;

    const newlyEarnedRanks = syncStudentRanksAndCertificates(
      log.studentId,
      newTotalPages,
      now,
      staffId
    );

    logAudit({
      actorId: staffId,
      actorType: 'supervisor',
      actorName: supervisor?.fullName || 'مشرف المكتبة',
      action: 'اعتماد تسجيل قراءة وتحديث الألقاب',
      entityType: 'reading_log',
      entityId: logId,
      notes: `اعتماد ${log.pagesCount} صفحة للطالب ${student?.fullName} من كتاب "${book?.title}" (الإجمالي: ${newTotalPages} صفحة)`,
    });

    return {
      success: true,
      pagesApproved: log.pagesCount,
      newlyEarnedRanks,
    };
  };

  const recordReadingLogBySupervisor = ({
    studentId,
    bookId,
    loanId,
    fromPage,
    toPage,
    readingDate,
    supervisorNotes,
    staffId,
  }: {
    studentId: string;
    bookId: string;
    loanId?: string;
    fromPage: number;
    toPage: number;
    readingDate?: string;
    supervisorNotes?: string;
    staffId: string;
  }) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) {
      return { success: false, error: 'الطالب المختار غير موجود في السجلات' };
    }
    if (student.status !== 'active') {
      return { success: false, error: 'حساب الطالب موقوف حالياً ولا يمكن تسجيل صفحات جديدة له' };
    }

    const book = books.find((b) => b.id === bookId);
    if (!book) {
      return { success: false, error: 'الكتاب المختار غير موجود في الفهرس' };
    }

    const supervisor = staff.find((s) => s.id === staffId);
    if (!supervisor) {
      return { success: false, error: 'بيانات المشرف غير صالحة' };
    }

    const maxPages = book.pageCount && book.pageCount > 0 ? book.pageCount : 100;
    const fPage = Math.floor(Number(fromPage));
    const tPage = Math.floor(Number(toPage));

    if (!Number.isFinite(fPage) || !Number.isFinite(tPage) || fPage < 1 || tPage < fPage) {
      return { success: false, error: 'يرجى إدخال نطاق صفحات صحيح (من - إلى)' };
    }

    if (tPage > maxPages) {
      return {
        success: false,
        error: `لا يسمح بتجاوز عدد صفحات الكتاب (${maxPages} صفحة)`,
      };
    }

    const existingForBook = readingLogs.filter(
      (l) =>
        l.studentId === studentId &&
        l.bookId === bookId &&
        (l.status === 'approved' || l.status === 'pending')
    );

    const overlap = existingForBook.find(
      (l) => fPage <= l.toPage && tPage >= l.fromPage
    );
    if (overlap) {
      return {
        success: false,
        error: `الصفحات من ${overlap.fromPage} إلى ${overlap.toPage} مسجلة مسبقاً لهذا الطالب (${
          overlap.status === 'approved' ? 'معتمدة' : 'بانتظار الاعتماد'
        }). يرجى اختيار صفحات جديدة لم تُسجل.`,
      };
    }

    const matchingLoan =
      (loanId ? loans.find((l) => l.id === loanId && l.studentId === studentId) : undefined) ||
      loans.find((l) => {
        if (l.studentId !== studentId || l.status === 'cancelled') return false;
        const c = copies.find((cp) => cp.id === l.copyId);
        return c?.bookId === bookId;
      });

    const pagesCount = tPage - fPage + 1;
    const now = new Date().toISOString();
    const effectiveDate = readingDate?.trim() || now.slice(0, 10);

    const newLog: ReadingLog = {
      id: `rlog-sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      studentId,
      loanId: matchingLoan?.id || 'supervisor-direct',
      bookId,
      fromPage: fPage,
      toPage: tPage,
      pagesCount,
      readingDate: effectiveDate,
      studentNotes: supervisorNotes?.trim() || `مسجل ومعتمد عبر المشرف: ${supervisor.fullName}`,
      status: 'approved',
      reviewedByStaffId: staffId,
      reviewedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    setReadingLogs((prev) => [newLog, ...prev]);

    const previousApprovedPages = readingLogs
      .filter((l) => l.studentId === studentId && l.status === 'approved')
      .reduce((sum, l) => sum + (l.correctedPagesCount ?? l.pagesCount), 0);
    const newTotalPages = previousApprovedPages + pagesCount;

    const newlyEarnedRanks = syncStudentRanksAndCertificates(
      studentId,
      newTotalPages,
      now,
      staffId
    );

    logAudit({
      actorId: staffId,
      actorType: supervisor.role === 'admin' ? 'admin' : 'supervisor',
      actorName: supervisor.fullName,
      action: 'تسجيل واعتماد صفحات قراءة للطالب',
      entityType: 'reading_log',
      entityId: newLog.id,
      notes: `تسجيل واعتماد ${pagesCount} صفحة (${fPage}-${tPage}) للطالب ${student.fullName} من كتاب "${book.title}" بتاريخ ${effectiveDate} (الإجمالي: ${newTotalPages} صفحة)`,
    });

    return {
      success: true,
      log: newLog,
      pagesApproved: pagesCount,
      newlyEarnedRanks,
    };
  };

  const rejectReadingLog = ({
    logId,
    staffId,
    reason,
  }: {
    logId: string;
    staffId: string;
    reason: string;
  }) => {
    const log = readingLogs.find((l) => l.id === logId);
    if (!log) return { success: false, error: 'السجل غير موجود' };
    if (log.status !== 'pending') {
      return { success: false, error: 'يمكن رفض الطلبات المعلقة فقط' };
    }
    if (!reason.trim()) {
      return { success: false, error: 'يرجى كتابة سبب الرفض ليظهر للطالب' };
    }

    const supervisor = staff.find((s) => s.id === staffId);
    const student = students.find((s) => s.id === log.studentId);
    const now = new Date().toISOString();

    setReadingLogs((prev) =>
      prev.map((l) =>
        l.id === logId
          ? {
              ...l,
              status: 'rejected',
              rejectionReason: reason.trim(),
              reviewedByStaffId: staffId,
              reviewedAt: now,
              updatedAt: now,
            }
          : l
      )
    );

    logAudit({
      actorId: staffId,
      actorType: 'supervisor',
      actorName: supervisor?.fullName || 'مشرف المكتبة',
      action: 'رفض طلب تسجيل قراءة',
      entityType: 'reading_log',
      entityId: logId,
      notes: `رفض طلب الطالب ${student?.fullName} (${log.pagesCount} صفحة). السبب: ${reason.trim()}`,
    });

    return { success: true };
  };

  const correctReadingLog = ({
    logId,
    staffId,
    newFromPage,
    newToPage,
    reason,
  }: {
    logId: string;
    staffId: string;
    newFromPage: number;
    newToPage: number;
    reason: string;
  }) => {
    const oldLog = readingLogs.find((l) => l.id === logId);
    if (!oldLog || oldLog.status !== 'approved') {
      return { success: false, error: 'يمكن إجراء تصحيح موثق فقط على قراءة معتمدة مسبقاً' };
    }
    if (!reason.trim()) {
      return { success: false, error: 'يجب توثيق سبب التصحيح الإداري' };
    }

    const book = books.find((b) => b.id === oldLog.bookId);
    const maxPages = book?.pageCount && book.pageCount > 0 ? book.pageCount : 100;
    const fPage = Math.floor(Number(newFromPage));
    const tPage = Math.floor(Number(newToPage));

    if (!Number.isFinite(fPage) || !Number.isFinite(tPage) || fPage < 1 || tPage < fPage || tPage > maxPages) {
      return { success: false, error: `نطاق الصفحات المصحح غير صالح (الحد الأقصى ${maxPages})` };
    }

    const supervisor = staff.find((s) => s.id === staffId);
    const student = students.find((s) => s.id === oldLog.studentId);
    const now = new Date().toISOString();

    const newPagesCount = tPage - fPage + 1;
    const pagesDelta = newPagesCount - oldLog.pagesCount;
    const replacementId = `rlog-corr-${Date.now()}`;

    const correctedLog: ReadingLog = {
      id: replacementId,
      studentId: oldLog.studentId,
      loanId: oldLog.loanId,
      bookId: oldLog.bookId,
      fromPage: fPage,
      toPage: tPage,
      pagesCount: newPagesCount,
      readingDate: oldLog.readingDate,
      studentNotes: oldLog.studentNotes
        ? `${oldLog.studentNotes} (تصحيح موثق)`
        : 'سجل قراءة مصحح وموثق',
      status: 'approved',
      reviewedByStaffId: staffId,
      reviewedAt: now,
      correctedPagesCount: newPagesCount,
      createdAt: oldLog.createdAt,
      updatedAt: now,
    };

    const correctionEntry: ReadingLogCorrection = {
      id: `rlcorr-${Date.now()}`,
      readingLogId: oldLog.id,
      studentId: oldLog.studentId,
      staffId,
      staffName: supervisor?.fullName || 'مشرف المكتبة',
      previousPagesCount: oldLog.pagesCount,
      newPagesCount,
      pagesDelta,
      reason: reason.trim(),
      createdAt: now,
    };

    setReadingLogs((prev) => [
      correctedLog,
      ...prev.map((l) =>
        l.id === oldLog.id
          ? {
              ...l,
              status: 'superseded' as ReadingLog['status'],
              supersededById: replacementId,
              updatedAt: now,
            }
          : l
      ),
    ]);
    setReadingLogCorrections((prev) => [correctionEntry, ...prev]);

    const otherApprovedPages = readingLogs
      .filter(
        (l) =>
          l.studentId === oldLog.studentId &&
          l.status === 'approved' &&
          l.id !== oldLog.id
      )
      .reduce((sum, l) => sum + (l.correctedPagesCount ?? l.pagesCount), 0);
    const updatedTotalPages = Math.max(0, otherApprovedPages + newPagesCount);

    if (pagesDelta > 0) {
      syncStudentRanksAndCertificates(oldLog.studentId, updatedTotalPages, now, staffId);
    } else if (pagesDelta < 0) {
      const validRankIds = new Set(
        readingRanks
          .filter((r) => r.isActive && updatedTotalPages >= r.requiredPages)
          .map((r) => r.id)
      );
      setStudentRanks((prev) =>
        prev.map((sr) =>
          sr.studentId === oldLog.studentId && !validRankIds.has(sr.rankId)
            ? { ...sr, status: 'revoked' }
            : sr
        )
      );
    }

    logAudit({
      actorId: staffId,
      actorType: 'supervisor',
      actorName: supervisor?.fullName || 'مشرف المكتبة',
      action: 'تصحيح موثق لسجل قراءة',
      entityType: 'reading_log',
      entityId: oldLog.id,
      notes: `تعديل صفحات الطالب ${student?.fullName} من ${oldLog.pagesCount} إلى ${newPagesCount} صفحة (فرق ${pagesDelta >= 0 ? `+${pagesDelta}` : pagesDelta} صفحة). السبب: ${reason.trim()}`,
    });

    return { success: true };
  };

  const markRankCelebrated = (studentId: string, rankId: string) => {
    setStudentRanks((prev) =>
      prev.map((sr) =>
        sr.studentId === studentId && sr.rankId === rankId && sr.status === 'active'
          ? { ...sr, isCelebrated: true }
          : sr
      )
    );
  };

  const reissueCertificate = ({
    studentId,
    rankId,
    staffId,
    reason,
  }: {
    studentId: string;
    rankId: string;
    staffId: string;
    reason: string;
  }) => {
    if (!reason.trim()) {
      return { success: false, error: 'يجب كتابة سبب إعادة إصدار الشهادة' };
    }
    const student = students.find((s) => s.id === studentId);
    const rank = readingRanks.find((r) => r.id === rankId);
    const adminStaff = staff.find((st) => st.id === staffId);
    if (!student || !rank) {
      return { success: false, error: 'بيانات الطالب أو اللقب غير موجودة' };
    }

    const summary = getStudentRankSummary(studentId);
    const tier = summary.tiers.find((t) => t.rank.id === rankId);
    if (!tier || tier.status !== 'earned') {
      return { success: false, error: 'لم يستحق الطالب هذا اللقب بعد لإصدار شهادة عنه' };
    }

    const existingForPair = readingCertificates.filter(
      (c) => c.studentId === studentId && c.rankId === rankId
    );
    const latestActive = existingForPair.find((c) => c.status === 'active');
    const maxVersion = existingForPair.reduce((max, c) => Math.max(max, c.version), 0);

    const now = new Date().toISOString();
    const newCertNumber = generateUniqueCertificateNumber(
      certificateSettings.serialPrefix,
      readingCertificates
    );

    const reissuedCert: ReadingCertificate = {
      id: `cert-${studentId}-${rankId}-${Date.now()}`,
      certificateNumber: newCertNumber,
      studentId,
      studentNameSnapshot: student.fullName,
      studentGradeSnapshot: `${student.grade} • ${student.groupName}`,
      rankId: rank.id,
      rankTitleSnapshot: rank.title,
      themeKeySnapshot: rank.themeKey,
      primaryColorSnapshot: rank.primaryColor,
      secondaryColorSnapshot: rank.secondaryColor,
      accentColorSnapshot: rank.accentColor,
      pagesCompletedSnapshot: summary.totalApprovedPages,
      motivationalPhrase: rank.motivationalPhrase,
      issuerOrganization: certificateSettings.issuerOrganization,
      signatoryTitle: certificateSettings.signatoryTitle,
      signatoryName: certificateSettings.signatoryName,
      footerNote: certificateSettings.footerNote,
      issuedAt: now,
      version: maxVersion + 1,
      isReissue: true,
      reissueReason: reason.trim(),
      issuedByStaffId: staffId,
      previousCertificateId: latestActive?.id,
      status: 'active',
    };

    setReadingCertificates((prev) => [
      reissuedCert,
      ...prev.map((c) =>
        c.studentId === studentId && c.rankId === rankId && c.status === 'active'
          ? { ...c, status: 'archived' as const }
          : c
      ),
    ]);

    logAudit({
      actorId: staffId,
      actorType: adminStaff?.role === 'admin' ? 'admin' : 'supervisor',
      actorName: adminStaff?.fullName || 'إدارة المكتبة',
      action: `إعادة إصدار شهادة لقب "${rank.title}"`,
      entityType: 'reading_certificate',
      entityId: reissuedCert.id,
      notes: `إصدار النسخة رقم #${reissuedCert.version} (${newCertNumber}) للطالب ${student.fullName} مع أرشفة الإصدار السابق. السبب: ${reason.trim()}`,
    });

    return { success: true, certificate: reissuedCert };
  };

  const addReadingRank = (
    rankData: Omit<ReadingRankDefinition, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    const now = new Date().toISOString();
    const newRank: ReadingRankDefinition = {
      ...rankData,
      id: `rank-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    setReadingRanks((prev) => [...prev, newRank]);
    logAudit({
      actorType: 'admin',
      actorName: 'إدارة النظام',
      action: 'إضافة لقب قرائي جديد',
      entityType: 'reading_rank',
      entityId: newRank.id,
      notes: `إضافة لقب "${newRank.title}" عند ${newRank.requiredPages} صفحة`,
    });
    return newRank;
  };

  const updateReadingRank = (rank: ReadingRankDefinition) => {
    const now = new Date().toISOString();
    setReadingRanks((prev) =>
      prev.map((r) => {
        if (r.id === rank.id) return { ...rank, updatedAt: now };
        if (rank.isHighestTier) return { ...r, isHighestTier: false };
        return r;
      })
    );
    logAudit({
      actorType: 'admin',
      actorName: 'إدارة النظام',
      action: 'تحديث إعدادات لقب قرائي',
      entityType: 'reading_rank',
      entityId: rank.id,
      notes: `تعديل "${rank.title}" (${rank.requiredPages} صفحة، الحالة: ${rank.isActive ? 'مفعل' : 'متوقف'})`,
    });
  };

  const deleteReadingRank = (rankId: string) => {
    const hasCertificates = readingCertificates.some((c) => c.rankId === rankId);
    if (hasCertificates) {
      return {
        success: false,
        error: 'لا يمكن حذف لقب صدرت عنه شهادات رسمية للطلاب. يمكنك إيقافه مؤقتاً للحفاظ على السجلات.',
      };
    }
    if (readingRanks.length <= 2) {
      return { success: false, error: 'يجب الإبقاء على لقبين قرائيين على الأقل في النظام' };
    }
    const target = readingRanks.find((r) => r.id === rankId);
    setReadingRanks((prev) => prev.filter((r) => r.id !== rankId));
    logAudit({
      actorType: 'admin',
      actorName: 'إدارة النظام',
      action: 'حذف لقب قرائي',
      entityType: 'reading_rank',
      entityId: rankId,
      notes: `حذف لقب "${target?.title}"`,
    });
    return { success: true };
  };

  const reorderReadingRanks = (orderedRankIds: string[]) => {
    const now = new Date().toISOString();
    setReadingRanks((prev) =>
      prev.map((r) => {
        const idx = orderedRankIds.indexOf(r.id);
        return idx !== -1 ? { ...r, orderIndex: idx + 1, updatedAt: now } : r;
      })
    );
    logAudit({
      actorType: 'admin',
      actorName: 'إدارة النظام',
      action: 'إعادة ترتيب سُلّم الألقاب القرائية',
      entityType: 'reading_rank',
      notes: 'تعديل تسلسل مستويات الألقاب',
    });
  };

  const updateCertificateSettings = (newCertSettings: Partial<CertificateSettings>) => {
    setCertificateSettings((prev) => ({
      ...prev,
      ...newCertSettings,
      updatedAt: new Date().toISOString(),
    }));
    logAudit({
      actorType: 'admin',
      actorName: 'إدارة النظام',
      action: 'تحديث قوالب وبيانات إصدار الشهادات',
      entityType: 'certificate_settings',
      notes: 'تعديل الجهة المصدرة أو المسمى التوقيعي للشهادات القرائية',
    });
  };

  const updateAchievementSettings = (newSettings: Partial<AchievementSettings>) => {
    setAchievementSettings((prev) => ({
      ...prev,
      ...newSettings,
      updatedAt: new Date().toISOString(),
    }));
    logAudit({
      actorType: 'admin',
      actorName: 'إدارة النظام',
      action: 'تحديث إعدادات لوحة الشرف والتنافس القرائي',
      entityType: 'achievement_settings',
      notes: 'تعديل خيارات ظهور أسماء الطلاب وفترات الترتيب واستبعاد الحسابات',
    });
  };

  const resetToDefaults = () => {
    setSettings(initialSettings);
    setCategories(initialCategories);
    setBooks(initialBooks);
    setCopies(initialCopies);
    setStudents(initialStudents);
    setStaff(initialStaff);
    setLoans(initialLoans);
    setLoanEvents(initialLoanEvents);
    setReservations(initialReservations);
    setAuditLogs(initialAuditLogs);
    setConditionReports(initialConditionReports);
    setReadingChallenges(initialReadingChallenges);
    setInventorySessions([]);
    setInventoryScans([]);
    setWaitlist([]);
    setReturnRequests(initialReturnRequests);
    setExchangeRequests(initialExchangeRequests);
    setConversations(initialConversations.map(normalizeConversation));
    setMessages(initialMessages.map(normalizeMessage));
    saveChatOutbox([]);
    setChatOutbox([]);
    setReadingRanks(initialReadingRanks);
    setCertificateSettings(initialCertificateSettings);
    setReadingLogs(initialReadingLogs);
    setReadingLogCorrections(initialReadingLogCorrections);
    setStudentRanks(initialStudentRanks);
    setReadingCertificates(initialReadingCertificates);
    setDiscussions(initialDiscussions);
    setDiscussionGroups(initialDiscussionGroups);
    setDiscussionSettingsState(initialDiscussionSettings);
    setReportSettings(initialReportSettings);
    setGroupReportSummaries(initialGroupReportSummaries);
    setStudentReportNotes(initialStudentReportNotes);
  };

  const clearAllData = (options?: { keepStudents?: boolean }) => {
    setBooks([]);
    setCopies([]);
    setLoans([]);
    setLoanEvents([]);
    setReservations([]);
    setConditionReports([]);
    setInventorySessions([]);
    setInventoryScans([]);
    setWaitlist([]);
    setReturnRequests([]);
    setExchangeRequests([]);
    setConversations([]);
    setMessages([]);
    setReadingLogs([]);
    setReadingLogCorrections([]);
    setStudentRanks([]);
    setReadingCertificates([]);
    setDiscussions([]);
    setDiscussionGroups([]);
    setGroupReportSummaries([]);
    setStudentReportNotes([]);
    if (!options?.keepStudents) {
      setStudents([]);
    }
    setStaff(initialStaff);
    logAudit({
      actorType: 'admin',
      actorName: 'المدير العام',
      action: 'حذف جميع البيانات والتصفير الشامل',
      entityType: 'system',
      notes: 'تم تصفير كافة الكتب والنسخ الورقية والإعارات وتفريغ قاعدة البيانات',
    });
  };

  // ========================================================================
  // دوال نظام المناقشات القرائية والتقارير والموظفين
  // ========================================================================

  const getStudentDiscussionPoints = (studentId: string): number => {
    return (discussions || [])
      .filter((d) => d.studentId === studentId && d.status === 'approved')
      .reduce((sum, d) => sum + (Number(d.pointsAwarded) || 0), 0);
  };

  const canStaffApproveDiscussion = (staffMember?: StaffUser | null): boolean => {
    if (!staffMember) return false;
    if (staffMember.role === 'admin') return true;
    const authority = discussionSettingsState.approvalAuthority || 'supervisor_and_admin';
    if (authority === 'admin_only') return false;
    if (authority === 'designated_supervisors') {
      return Boolean(staffMember.permissions?.can_approve_discussions);
    }
    return staffMember.permissions?.can_approve_discussions !== false;
  };

  const requestDiscussion = (params: {
    loanId: string;
    bookId: string;
    studentId: string;
    rediscussionReason?: string;
  }) => {
    const { loanId, bookId, studentId, rediscussionReason } = params;
    if (!discussionSettingsState.isEnabled) {
      return { success: false, error: 'نظام المناقشات القرائية متوقف حالياً من إعدادات الإدارة' };
    }

    const loan = loans.find((l) => l.id === loanId);
    if (!loan || loan.studentId !== studentId) {
      return { success: false, error: 'الإعارة غير موجودة أو لا تخص هذا الطالب' };
    }

    const copy = copies.find((c) => c.id === loan.copyId);
    if (copy && copy.bookId !== bookId) {
      return { success: false, error: 'الكتاب المختار غير مطابق لسجل الإعارة' };
    }

    const studentBookDiscussions = discussions.filter(
      (d) => d.bookId === bookId && d.studentId === studentId
    );

    const activeInProgress = studentBookDiscussions.find(
      (d) =>
        d.status === 'requested' ||
        d.status === 'awaiting_schedule' ||
        d.status === 'pending' ||
        d.status === 'scheduled' ||
        d.status === 'discussed' ||
        d.status === 'pending_approval' ||
        d.status === 'completed'
    );
    if (activeInProgress) {
      return { success: false, error: 'يوجد طلب مناقشة قائم قيد المتابعة لهذا الكتاب بالفعل' };
    }

    const previousApproved = studentBookDiscussions.find((d) => d.status === 'approved');
    const needsRediscussionItem = studentBookDiscussions.find(
      (d) => d.status === 'needs_rediscussion'
    );

    if (previousApproved && !needsRediscussionItem) {
      if (!discussionSettingsState.allowRediscussion) {
        return {
          success: false,
          error: 'تمت مناقشة هذا الكتاب واعتماده مسبقاً ولا تسمح الإعدادات بطلب إعادة مناقشة',
        };
      }
      if (!rediscussionReason || !rediscussionReason.trim()) {
        return {
          success: false,
          error: 'تمت مناقشة هذا الكتاب مسبقاً؛ يرجى كتابة مبرر طلب إعادة المناقشة',
        };
      }
    }

    const now = new Date().toISOString();
    const student = students.find((s) => s.id === studentId);
    const book = books.find((b) => b.id === bookId);

    const newDiscussion: ReadingDiscussion = {
      id: `disc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      loanId,
      bookId,
      studentId,
      type: 'individual',
      status: 'awaiting_schedule',
      requestDate: now,
      evaluation: [],
      totalScore: 0,
      maxScore: discussionSettingsState.totalMaxPoints || 100,
      pointsAwarded: 0,
      pointsApproved: false,
      rediscussionReason: rediscussionReason?.trim(),
      previousDiscussionId: needsRediscussionItem?.id || previousApproved?.id,
      history: [
        {
          date: now,
          staffName: student?.fullName || 'الطالب',
          status: 'requested',
          totalScore: 0,
          evaluation: [],
          reason: rediscussionReason?.trim() || 'تقديم طلب مناقشة الكتاب',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    // Keep previous discussions untouched (never delete history!), just update a needs_rediscussion pointer if replaced or keep both
    setDiscussions((prev) => [newDiscussion, ...prev]);
    centralSync.broadcastMutation({ entity: 'discussions', action: 'INSERT', data: newDiscussion });
    syncEntityRecordToSupabase('discussions', newDiscussion);

    logAudit({
      actorId: studentId,
      actorType: 'student',
      actorName: student?.fullName || studentId,
      action: 'طلب مناقشة كتاب',
      entityType: 'discussion',
      entityId: newDiscussion.id,
      notes: `طلب الطالب ${student?.fullName || ''} مناقشة كتاب "${book?.title || bookId}"${
        rediscussionReason ? ` (مبرر الإعادة: ${rediscussionReason.trim()})` : ''
      }`,
    });

    return { success: true, discussion: newDiscussion };
  };

  const scheduleDiscussion = (params: {
    discussionId: string;
    supervisorId: string;
    scheduledDate: string;
    scheduledNote?: string;
  }) => {
    const disc = discussions.find((d) => d.id === params.discussionId);
    if (!disc) return { success: false, error: 'المناقشة غير موجودة' };
    if (disc.status === 'approved' || disc.status === 'cancelled') {
      return { success: false, error: 'لا يمكن جدولة مناقشة معتمدة أو ملغاة' };
    }
    if (!params.scheduledDate) {
      return { success: false, error: 'يرجى تحديد تاريخ ووقت الموعد' };
    }

    const supervisor = staff.find((s) => s.id === params.supervisorId);
    const now = new Date().toISOString();

    setDiscussions((prev) =>
      prev.map((d) => {
        if (d.id !== params.discussionId) return d;
        const historyEntry: DiscussionHistoryEntry = {
          date: now,
          staffId: params.supervisorId,
          staffName: supervisor?.fullName || 'مشرف المكتبة',
          status: 'scheduled',
          totalScore: d.totalScore,
          evaluation: d.evaluation,
          notes: params.scheduledNote?.trim() || `تحديد موعد: ${params.scheduledDate}`,
        };
        return {
          ...d,
          supervisorId: params.supervisorId,
          scheduledDate: params.scheduledDate,
          scheduledNote: params.scheduledNote?.trim(),
          status: 'scheduled' as const,
          history: [...(d.history || []), historyEntry],
          updatedAt: now,
        };
      })
    );

    const updatedDiscPayload = {
      ...disc,
      supervisorId: params.supervisorId,
      scheduledDate: params.scheduledDate,
      scheduledNote: params.scheduledNote?.trim(),
      status: 'scheduled' as const,
      updatedAt: now,
    };
    centralSync.broadcastMutation({ entity: 'discussions', action: 'UPDATE', data: updatedDiscPayload, recordId: params.discussionId });
    syncEntityRecordToSupabase('discussions', updatedDiscPayload);

    logAudit({
      actorId: params.supervisorId,
      actorType: supervisor?.role === 'admin' ? 'admin' : 'supervisor',
      actorName: supervisor?.fullName || params.supervisorId,
      action: 'تحديد موعد مناقشة قرائية',
      entityType: 'discussion',
      entityId: params.discussionId,
      notes: `تم تحديد الموعد: ${params.scheduledDate}`,
    });

    return { success: true };
  };

  const recordDiscussionResult = (params: {
    discussionId: string;
    supervisorId: string;
    discussionSummary?: string;
    evaluation: DiscussionEvaluationItem[];
    studentBenefit: string;
    notes: string;
    recommendations?: string;
    templateId?: string;
    templateName?: string;
    autoApproveIfAllowed?: boolean;
  }) => {
    const disc = discussions.find((d) => d.id === params.discussionId);
    if (!disc) return { success: false, error: 'المناقشة غير موجودة' };
    if (disc.status === 'approved') {
      return { success: false, error: 'تم اعتماد هذه المناقشة مسبقاً ولا يمكن تعديلها' };
    }
    if (disc.status === 'cancelled') {
      return { success: false, error: 'لا يمكن تسجيل نتيجة لمناقشة ملغاة' };
    }

    const supervisor = staff.find((s) => s.id === params.supervisorId);
    const totalScore = params.evaluation.reduce((sum, e) => sum + (Number(e.awardedPoints) || 0), 0);
    const maxScore =
      params.evaluation.reduce((sum, e) => sum + (Number(e.maxPoints) || 0), 0) ||
      discussionSettingsState.totalMaxPoints ||
      100;

    // Calculate candidate points according to discussionSettings
    const basePoints = discussionSettingsState.pointsPerDiscussion || 10;
    const minPassing = discussionSettingsState.minPassingScore ?? 50;
    let computedPoints = 0;
    if (totalScore >= minPassing) {
      if (discussionSettingsState.pointsCalculationMode === 'proportional') {
        computedPoints = Math.max(1, Math.round((totalScore / maxScore) * basePoints));
      } else {
        computedPoints = basePoints;
      }
    }

    const shouldAutoApprove =
      Boolean(params.autoApproveIfAllowed) && canStaffApproveDiscussion(supervisor);

    const nextStatus = shouldAutoApprove
      ? ('approved' as const)
      : discussionSettingsState.requireApproval
      ? ('pending_approval' as const)
      : ('discussed' as const);

    const now = new Date().toISOString();

    setDiscussions((prev) =>
      prev.map((d) => {
        if (d.id !== params.discussionId) return d;
        const historyEntry: DiscussionHistoryEntry = {
          date: now,
          staffId: params.supervisorId,
          staffName: supervisor?.fullName || 'مشرف المكتبة',
          status: nextStatus,
          totalScore,
          evaluation: params.evaluation,
          notes: params.notes,
        };
        return {
          ...d,
          supervisorId: params.supervisorId,
          discussionSummary: params.discussionSummary?.trim(),
          templateId: params.templateId,
          templateName: params.templateName,
          evaluation: params.evaluation,
          totalScore,
          maxScore,
          studentBenefit: params.studentBenefit.trim(),
          supervisorNotes: params.notes.trim(),
          supervisorRecommendations: params.recommendations?.trim(),
          discussionDate: d.discussionDate || now,
          status: nextStatus,
          pointsAwarded: shouldAutoApprove && !d.pointsApproved ? computedPoints : d.pointsAwarded,
          pointsApproved: shouldAutoApprove ? true : d.pointsApproved,
          approvedByStaffId: shouldAutoApprove ? params.supervisorId : d.approvedByStaffId,
          approvedAt: shouldAutoApprove ? now : d.approvedAt,
          history: [...(d.history || []), historyEntry],
          updatedAt: now,
        };
      })
    );

    const updatedDiscResultPayload = {
      ...disc,
      discussionSummary: params.discussionSummary?.trim(),
      evaluation: params.evaluation,
      totalScore,
      maxScore,
      studentBenefit: params.studentBenefit.trim(),
      supervisorNotes: params.notes.trim(),
      supervisorRecommendations: params.recommendations?.trim(),
      discussionDate: disc.discussionDate || now,
      status: nextStatus,
      pointsAwarded: shouldAutoApprove && !disc.pointsApproved ? computedPoints : disc.pointsAwarded,
      pointsApproved: shouldAutoApprove ? true : disc.pointsApproved,
      approvedByStaffId: shouldAutoApprove ? params.supervisorId : disc.approvedByStaffId,
      approvedAt: shouldAutoApprove ? now : disc.approvedAt,
      updatedAt: now,
    };
    centralSync.broadcastMutation({ entity: 'discussions', action: 'UPDATE', data: updatedDiscResultPayload, recordId: params.discussionId });
    syncEntityRecordToSupabase('discussions', updatedDiscResultPayload);

    if (shouldAutoApprove) {
      const discBook = books.find((b) => b.id === disc.bookId);
      const discPageCount = discBook?.pageCount && discBook.pageCount > 0 ? discBook.pageCount : 100;

      // إدراج الكتاب والصفحات فوراً في سجل الطالب المعتمد بعد المناقشة
      recordBookAndPagesInStudentRecord({
        studentId: disc.studentId,
        bookId: disc.bookId,
        loanId: disc.loanId,
        staffId: params.supervisorId,
        staffName: supervisor?.fullName,
        customPages: discPageCount,
        notes: `تسجيل واعتماد مناقشة كتاب "${discBook?.title || 'كتاب'}" بنجاح (${totalScore}/${maxScore}) وتوثيق صفحات الكتاب (${discPageCount} صفحة) في سجل الطالب`,
      });

      // واعتماد طلب إكمال القراءة إذا وُجد
      setReadingCompletions((prev) =>
        prev.map((c) =>
          c.studentId === disc.studentId && c.bookId === disc.bookId && c.status !== 'approved'
            ? {
                ...c,
                status: 'approved',
                approvedAt: now,
                approvedByStaffId: params.supervisorId,
                approvedByStaffName: supervisor?.fullName || 'المشرف',
                adminNotes: `اعتماد تلقائي إثر اجتياز المناقشة بنجاح (${totalScore} درجة)`,
                updatedAt: now,
              }
            : c
        )
      );
    }

    logAudit({
      actorId: params.supervisorId,
      actorType: supervisor?.role === 'admin' ? 'admin' : 'supervisor',
      actorName: supervisor?.fullName || params.supervisorId,
      action: shouldAutoApprove ? 'تسجيل واعتماد نتيجة مناقشة' : 'تسجيل نتيجة مناقشة قرائية',
      entityType: 'discussion',
      entityId: params.discussionId,
      notes: `الدرجة: ${totalScore}/${maxScore}${shouldAutoApprove ? ` • النقاط المعتمدة: ${computedPoints}` : ' • بانتظار الاعتماد'}`,
    });

    return { success: true };
  };

  const approveDiscussion = (params: {
    discussionId: string;
    staffId: string;
    pointsAwarded?: number;
  }) => {
    const disc = discussions.find((d) => d.id === params.discussionId);
    if (!disc) return { success: false, error: 'المناقشة غير موجودة' };
    if (disc.status === 'approved' || disc.pointsApproved) {
      return { success: false, error: 'تم اعتماد هذه المناقشة واحتساب نقاطها مسبقاً (يمنع التكرار)' };
    }
    if (
      disc.status !== 'pending_approval' &&
      disc.status !== 'discussed' &&
      disc.status !== 'completed'
    ) {
      return { success: false, error: 'يجب تسجيل نتيجة المناقشة أولاً قبل اعتمادها' };
    }

    const approver = staff.find((s) => s.id === params.staffId);
    if (!canStaffApproveDiscussion(approver)) {
      return {
        success: false,
        error: 'عفواً، صلاحية اعتماد المناقشات وإضافة النقاط محصورة وفق إعدادات الإدارة',
      };
    }

    const basePoints = discussionSettingsState.pointsPerDiscussion || 10;
    const maxScore = disc.maxScore || discussionSettingsState.totalMaxPoints || 100;
    const defaultPoints =
      discussionSettingsState.pointsCalculationMode === 'proportional'
        ? Math.max(0, Math.round((disc.totalScore / maxScore) * basePoints))
        : basePoints;
    const finalPoints =
      params.pointsAwarded !== undefined ? Math.max(0, Number(params.pointsAwarded)) : defaultPoints;

    const now = new Date().toISOString();

    setDiscussions((prev) =>
      prev.map((d) => {
        if (d.id !== params.discussionId) return d;
        const historyEntry: DiscussionHistoryEntry = {
          date: now,
          staffId: params.staffId,
          staffName: approver?.fullName || 'الإدارة',
          status: 'approved',
          totalScore: d.totalScore,
          evaluation: d.evaluation,
          notes: `اعتماد النتيجة ومنح ${finalPoints} نقطة`,
        };
        return {
          ...d,
          status: 'approved' as const,
          pointsAwarded: finalPoints,
          pointsApproved: true,
          approvedByStaffId: params.staffId,
          approvedAt: now,
          history: [...(d.history || []), historyEntry],
          updatedAt: now,
        };
      })
    );

    const updatedDiscPayload = {
      ...disc,
      status: 'approved' as const,
      pointsAwarded: finalPoints,
      pointsApproved: true,
      approvedByStaffId: params.staffId,
      approvedAt: now,
      updatedAt: now,
    };
    centralSync.broadcastMutation({ entity: 'discussions', action: 'UPDATE', data: updatedDiscPayload, recordId: params.discussionId });
    syncEntityRecordToSupabase('discussions', updatedDiscPayload);

    const student = students.find((s) => s.id === disc.studentId);
    const book = books.find((b) => b.id === disc.bookId);
    const discPageCount = book?.pageCount && book.pageCount > 0 ? book.pageCount : 100;

    // إدراج الكتاب والصفحات فوراً في سجل الطالب المعتمد بعد المناقشة
    recordBookAndPagesInStudentRecord({
      studentId: disc.studentId,
      bookId: disc.bookId,
      loanId: disc.loanId,
      staffId: params.staffId,
      staffName: approver?.fullName,
      customPages: discPageCount,
      notes: `اعتماد مناقشة كتاب "${book?.title || 'كتاب'}" بنجاح (${disc.totalScore}/${maxScore}) وتوثيق صفحات الكتاب (${discPageCount} صفحة) في سجل الطالب ومنح ${finalPoints} نقطة`,
    });

    // واعتماد طلب إكمال القراءة إذا وُجد
    setReadingCompletions((prev) =>
      prev.map((c) =>
        c.studentId === disc.studentId && c.bookId === disc.bookId && c.status !== 'approved'
          ? {
              ...c,
              status: 'approved',
              approvedAt: now,
              approvedByStaffId: params.staffId,
              approvedByStaffName: approver?.fullName || 'المشرف',
              adminNotes: `اعتماد تلقائي إثر اجتياز المناقشة بنجاح (${disc.totalScore} درجة / ${finalPoints} نقطة)`,
              updatedAt: now,
            }
          : c
      )
    );

    logAudit({
      actorId: params.staffId,
      actorType: approver?.role === 'admin' ? 'admin' : 'supervisor',
      actorName: approver?.fullName || params.staffId,
      action: 'اعتماد نتيجة مناقشة وإضافة نقاط وتوثيق السجل',
      entityType: 'discussion',
      entityId: params.discussionId,
      notes: `اعتماد مناقشة الطالب ${student?.fullName || ''} لكتاب "${book?.title || ''}" (${disc.totalScore}/${maxScore}) وتوثيق ${discPageCount} صفحة في سجله مع منح ${finalPoints} نقطة`,
    });

    return { success: true };
  };

  const requestRediscussion = (params: {
    discussionId: string;
    staffId: string;
    reason: string;
  }) => {
    const disc = discussions.find((d) => d.id === params.discussionId);
    if (!disc) return { success: false, error: 'المناقشة غير موجودة' };
    if (disc.status === 'approved') {
      return { success: false, error: 'لا يمكن تعديل مناقشة معتمدة؛ يتم حفظ السجلات المعتمدة ولا تُحذف' };
    }
    if (!params.reason.trim()) {
      return { success: false, error: 'يرجى توضيح سبب طلب إعادة المناقشة' };
    }

    const staffMember = staff.find((s) => s.id === params.staffId);
    const now = new Date().toISOString();

    setDiscussions((prev) =>
      prev.map((d) => {
        if (d.id !== params.discussionId) return d;
        const historyEntry: DiscussionHistoryEntry = {
          date: now,
          staffId: params.staffId,
          staffName: staffMember?.fullName || 'مشرف المكتبة',
          status: 'needs_rediscussion',
          totalScore: d.totalScore,
          evaluation: d.evaluation,
          reason: params.reason.trim(),
        };
        return {
          ...d,
          status: 'needs_rediscussion' as const,
          rediscussionReason: params.reason.trim(),
          supervisorNotes: d.supervisorNotes
            ? `${d.supervisorNotes}\n[توصية بإعادة المناقشة]: ${params.reason.trim()}`
            : `[توصية بإعادة المناقشة]: ${params.reason.trim()}`,
          history: [...(d.history || []), historyEntry],
          updatedAt: now,
        };
      })
    );

    logAudit({
      actorId: params.staffId,
      actorType: staffMember?.role === 'admin' ? 'admin' : 'supervisor',
      actorName: staffMember?.fullName || params.staffId,
      action: 'طلب إعادة مناقشة',
      entityType: 'discussion',
      entityId: params.discussionId,
      reason: params.reason.trim(),
    });

    return { success: true };
  };

  const cancelDiscussion = (params: { discussionId: string; staffId: string; reason: string }) => {
    const disc = discussions.find((d) => d.id === params.discussionId);
    if (!disc) return { success: false, error: 'المناقشة غير موجودة' };
    if (disc.status === 'approved') {
      return { success: false, error: 'لا يمكن إلغاء أو حذف مناقشة معتمدة' };
    }

    const staffMember = staff.find((s) => s.id === params.staffId);
    const now = new Date().toISOString();

    setDiscussions((prev) =>
      prev.map((d) => {
        if (d.id !== params.discussionId) return d;
        const historyEntry: DiscussionHistoryEntry = {
          date: now,
          staffId: params.staffId,
          staffName: staffMember?.fullName || 'مشرف المكتبة',
          status: 'cancelled',
          totalScore: d.totalScore,
          evaluation: d.evaluation,
          reason: params.reason.trim(),
        };
        return {
          ...d,
          status: 'cancelled' as const,
          cancellationReason: params.reason.trim(),
          history: [...(d.history || []), historyEntry],
          updatedAt: now,
        };
      })
    );

    logAudit({
      actorId: params.staffId,
      actorType: staffMember?.role === 'admin' ? 'admin' : 'supervisor',
      actorName: staffMember?.fullName || params.staffId,
      action: 'إلغاء مناقشة',
      entityType: 'discussion',
      entityId: params.discussionId,
      reason: params.reason.trim(),
    });

    return { success: true };
  };

  const createDiscussionGroup = (params: {
    bookId: string;
    supervisorId: string;
    title: string;
    studentIds: string[];
    scheduledDate?: string;
    scheduledNote?: string;
  }) => {
    if (!discussionSettingsState.isEnabled) {
      return { success: false, error: 'نظام المناقشات متوقف حالياً' };
    }
    if (discussionSettingsState.allowGroupDiscussions === false) {
      return { success: false, error: 'المناقشات الجماعية غير مفعلة في إعدادات الإدارة' };
    }
    if (!params.studentIds || params.studentIds.length < 2) {
      return { success: false, error: 'يرجى اختيار طالبين على الأقل للمناقشة الجماعية' };
    }

    const now = new Date().toISOString();
    const supervisor = staff.find((s) => s.id === params.supervisorId);
    const book = books.find((b) => b.id === params.bookId);
    const groupId = `dgrp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const newGroup: DiscussionGroup = {
      id: groupId,
      bookId: params.bookId,
      supervisorId: params.supervisorId,
      title: params.title.trim() || `مناقشة جماعية: ${book?.title || ''}`,
      studentIds: params.studentIds,
      scheduledDate: params.scheduledDate,
      scheduledNote: params.scheduledNote?.trim(),
      status: params.scheduledDate ? 'scheduled' : 'pending',
      createdAt: now,
    };
    setDiscussionGroups((prev) => [newGroup, ...prev]);

    const newGroupDiscussions: ReadingDiscussion[] = params.studentIds.map((sid) => {
      const studentLoan = loans.find(
        (l) => l.studentId === sid && copies.find((c) => c.id === l.copyId)?.bookId === params.bookId
      );
      return {
        id: `disc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sid.slice(-4)}`,
        loanId: studentLoan?.id || '',
        bookId: params.bookId,
        studentId: sid,
        supervisorId: params.supervisorId,
        type: 'group' as const,
        groupId,
        groupTitle: newGroup.title,
        status: params.scheduledDate ? ('scheduled' as const) : ('awaiting_schedule' as const),
        requestDate: now,
        scheduledDate: params.scheduledDate,
        scheduledNote: params.scheduledNote?.trim(),
        evaluation: [],
        totalScore: 0,
        maxScore: discussionSettingsState.totalMaxPoints || 100,
        pointsAwarded: 0,
        pointsApproved: false,
        history: [
          {
            date: now,
            staffId: params.supervisorId,
            staffName: supervisor?.fullName || 'مشرف المكتبة',
            status: params.scheduledDate ? 'scheduled' : 'awaiting_schedule',
            totalScore: 0,
            evaluation: [],
            notes: `إدراج الطالب ضمن المناقشة الجماعية: ${newGroup.title}`,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };
    });
    setDiscussions((prev) => [...newGroupDiscussions, ...prev]);

    logAudit({
      actorId: params.supervisorId,
      actorType: supervisor?.role === 'admin' ? 'admin' : 'supervisor',
      actorName: supervisor?.fullName || params.supervisorId,
      action: 'إنشاء مناقشة جماعية',
      entityType: 'discussion_group',
      entityId: groupId,
      notes: `مناقشة جماعية لكتاب "${book?.title || ''}" بمشاركة ${params.studentIds.length} طلاب`,
    });
    return { success: true, group: newGroup };
  };

  const updateDiscussionSettings = (newSettings: Partial<DiscussionSettings>) => {
    setDiscussionSettingsState((prev) => ({ ...prev, ...newSettings }));
    logAudit({
      actorType: 'admin',
      actorName: 'المدير العام',
      action: 'تحديث إعدادات المناقشات القرائية',
      entityType: 'discussion_settings',
      notes: 'تعديل عناصر التقييم أو النقاط أو الصلاحيات دون المساس بالسجلات المعتمدة',
    });
  };

  // ========================================================================
  // دوال إعدادات التقارير، ملخصات المشرفين، وإدارة الطاقم
  // ========================================================================

  const updateReportSettings = (newSettings: Partial<ReportSettings>) => {
    setReportSettings((prev) => ({
      ...prev,
      ...newSettings,
      updatedAt: new Date().toISOString(),
    }));
    logAudit({
      actorType: 'admin',
      actorName: 'المدير العام',
      action: 'تحديث إعدادات وقوالب التقارير',
      entityType: 'report_settings',
      notes: 'تحديث ترويسة التقارير أو الشعار أو التوقيعات أو أقسام القوالب',
    });
  };

  const saveGroupReportSummary = (
    summaryData: Omit<GroupSupervisorReportSummary, 'id' | 'updatedAt'>
  ): GroupSupervisorReportSummary => {
    const now = new Date().toISOString();
    const existing = groupReportSummaries.find(
      (g) => g.groupName === summaryData.groupName && g.periodKey === summaryData.periodKey
    );
    const saved: GroupSupervisorReportSummary = {
      ...summaryData,
      id: existing?.id || `grpsum-${Date.now()}`,
      updatedAt: now,
    };

    setGroupReportSummaries((prev) => {
      if (existing) {
        return prev.map((g) => (g.id === existing.id ? saved : g));
      }
      return [saved, ...prev];
    });

    logAudit({
      actorId: summaryData.supervisorId,
      actorType: 'supervisor',
      actorName: summaryData.supervisorName,
      action: 'حفظ ملخص وتوصيات تقرير المجموعة',
      entityType: 'supervisor_notes',
      entityId: saved.id,
      notes: `تحديث ملخص المشرف لمجموعة "${summaryData.groupName}"`,
    });

    return saved;
  };

  const saveStudentReportNote = (
    noteData: Omit<StudentReportRecommendationNote, 'id' | 'updatedAt'>
  ): StudentReportRecommendationNote => {
    const now = new Date().toISOString();
    const existing = studentReportNotes.find((n) => n.studentId === noteData.studentId);
    const saved: StudentReportRecommendationNote = {
      ...noteData,
      id: existing?.id || `stunote-${Date.now()}`,
      updatedAt: now,
    };

    setStudentReportNotes((prev) => {
      if (existing) {
        return prev.map((n) => (n.id === existing.id ? saved : n));
      }
      return [saved, ...prev];
    });

    const stu = students.find((s) => s.id === noteData.studentId);
    logAudit({
      actorId: noteData.supervisorId,
      actorType: 'supervisor',
      actorName: noteData.supervisorName,
      action: 'حفظ ملاحظات وتوصيات الطالب التربوية',
      entityType: 'supervisor_notes',
      entityId: saved.id,
      notes: `تحديث توصيات وملاحظات الطالب ${stu?.fullName || noteData.studentId}`,
    });

    return saved;
  };

  const addStaffMember = (staffMember: StaffUser) => {
    setStaff((prev) => [staffMember, ...prev]);
    logAudit({
      actorType: 'admin',
      actorName: 'المدير العام',
      action: 'إضافة عضو إشراف جديد',
      entityType: 'staff',
      entityId: staffMember.id,
      notes: `إضافة ${staffMember.fullName} (${staffMember.role})`,
    });
  };

  const updateStaffMember = (staffMember: StaffUser) => {
    setStaff((prev) => prev.map((s) => (s.id === staffMember.id ? staffMember : s)));
    logAudit({
      actorType: 'admin',
      actorName: 'المدير العام',
      action: 'تحديث صلاحيات وبيانات مشرف',
      entityType: 'staff',
      entityId: staffMember.id,
      notes: `تحديث صلاحيات/مجموعات ${staffMember.fullName}`,
    });
  };

  // ========================================================================
  // دوال نظام الاختبارات الإلكترونية (Exams System Implementation)
  // ========================================================================

  const createExam = (
    examData: Omit<ElectronicExam, 'id' | 'code' | 'createdAt' | 'updatedAt'>
  ): { success: boolean; error?: string; exam?: ElectronicExam } => {
    try {
      const examId = `exam-${Date.now()}`;
      const examCode = `EXAM-${new Date().getFullYear()}-${String(exams.length + 1).padStart(3, '0')}`;
      const now = new Date().toISOString();

      const questions = examData.questions || [];
      const totalPoints = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);

      const newExam: ElectronicExam = {
        ...examData,
        id: examId,
        code: examCode,
        totalPoints,
        questions,
        createdAt: now,
        updatedAt: now,
      };

      setExams((prev) => [newExam, ...prev]);

      logAudit({
        actorType: 'supervisor',
        actorName: examData.supervisorName || 'المشرف',
        action: 'إنشاء اختبار إلكتروني جديد',
        entityType: 'staff',
        entityId: examId,
        notes: `إنشاء اختبار "${newExam.title}" برمز ${examCode}`,
      });

      return { success: true, exam: newExam };
    } catch (e: any) {
      return { success: false, error: e?.message || 'تعذر إنشاء الاختبار' };
    }
  };

  const updateExam = (
    examId: string,
    updates: Partial<ElectronicExam>
  ): { success: boolean; error?: string } => {
    try {
      setExams((prev) =>
        prev.map((ex) => {
          if (ex.id !== examId) return ex;
          const questions = updates.questions || ex.questions;
          const totalPoints = questions.reduce(
            (sum, q) => sum + (Number(q.points) || 0),
            0
          );
          return {
            ...ex,
            ...updates,
            totalPoints,
            questions,
            updatedAt: new Date().toISOString(),
          };
        })
      );
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'تعذر تحديث الاختبار' };
    }
  };

  const deleteExam = (examId: string): { success: boolean; error?: string } => {
    const hasAttempts = examAttempts.some((a) => a.examId === examId);
    if (hasAttempts) {
      // إذا كان للاختبار محاولات سابقة، نقوم بأرشفته بدلاً من حذفه نهائياً لحفظ السجلات
      setExams((prev) =>
        prev.map((e) => (e.id === examId ? { ...e, status: 'archived' } : e))
      );
      return { success: true };
    }
    setExams((prev) => prev.filter((e) => e.id !== examId));
    return { success: true };
  };

  const publishExam = (examId: string): { success: boolean; error?: string } => {
    const exam = exams.find((e) => e.id === examId);
    if (!exam) return { success: false, error: 'الاختبار غير موجود' };
    if (!exam.questions || exam.questions.length === 0) {
      return { success: false, error: 'لا يمكن نشر اختبار دون إضافة سؤال واحد على الأقل' };
    }

    setExams((prev) =>
      prev.map((e) =>
        e.id === examId
          ? { ...e, status: 'published', updatedAt: new Date().toISOString() }
          : e
      )
    );

    logAudit({
      actorType: 'supervisor',
      actorName: exam.supervisorName,
      action: 'نشر اختبار إلكتروني للطلاب',
      entityType: 'staff',
      entityId: examId,
      notes: `نشر اختبار "${exam.title}"`,
    });

    return { success: true };
  };

  const pauseExam = (examId: string, isPaused: boolean): { success: boolean; error?: string } => {
    setExams((prev) =>
      prev.map((e) =>
        e.id === examId
          ? {
              ...e,
              settings: { ...e.settings, isPaused },
              updatedAt: new Date().toISOString(),
            }
          : e
      )
    );
    return { success: true };
  };

  const extendExamDuration = (
    examId: string,
    additionalMinutes: number
  ): { success: boolean; error?: string } => {
    setExams((prev) =>
      prev.map((e) =>
        e.id === examId
          ? {
              ...e,
              durationMinutes: e.durationMinutes + additionalMinutes,
              settings: {
                ...e.settings,
                extendedMinutes: (e.settings?.extendedMinutes || 0) + additionalMinutes,
              },
              updatedAt: new Date().toISOString(),
            }
          : e
      )
    );
    return { success: true };
  };

  const duplicateExam = (
    examId: string
  ): { success: boolean; error?: string; exam?: ElectronicExam } => {
    const original = exams.find((e) => e.id === examId);
    if (!original) return { success: false, error: 'الاختبار الأصلي غير موجود' };

    const newId = `exam-${Date.now()}`;
    const newCode = `EXAM-${new Date().getFullYear()}-${String(exams.length + 1).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const duplicated: ElectronicExam = {
      ...original,
      id: newId,
      code: newCode,
      title: `نسخة من ${original.title}`,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      questions: (original.questions || []).map((q, idx) => ({
        ...q,
        id: `q-${Date.now()}-${idx}`,
        options: (q.options || []).map((opt, oIdx) => ({
          ...opt,
          id: `opt-${Date.now()}-${idx}-${oIdx}`,
        })),
      })),
    };

    setExams((prev) => [duplicated, ...prev]);
    return { success: true, exam: duplicated };
  };

  const startExamAttempt = (
    examId: string,
    studentId: string
  ): { success: boolean; error?: string; attempt?: ExamAttempt } => {
    const exam = exams.find((e) => e.id === examId);
    if (!exam) return { success: false, error: 'الاختبار غير موجود' };
    if (exam.settings?.isPaused) {
      return { success: false, error: 'تم إيقاف استقبال الإجابات لهذا الاختبار مؤقتاً من قِبل المشرف' };
    }

    const student = students.find((s) => s.id === studentId);
    if (!student) return { success: false, error: 'الطالب غير مسجل' };

    // فحص المحاولات
    const priorAttempts = examAttempts.filter(
      (a) => a.examId === examId && a.studentId === studentId && a.status !== 'cancelled'
    );
    if (exam.allowedAttempts > 0 && priorAttempts.length >= exam.allowedAttempts) {
      return { success: false, error: 'لقد استنفدت جميع المحاولات المسموح بها لهذا الاختبار' };
    }

    // إذا كان هناك محاولة جارية بالفعل، متابعتها
    const inProgressAttempt = priorAttempts.find((a) => a.status === 'in_progress');
    if (inProgressAttempt) {
      return { success: true, attempt: inProgressAttempt };
    }

    const attemptId = `attempt-${Date.now()}-${studentId.slice(0, 5)}`;
    const now = new Date().toISOString();

    const newAttempt: ExamAttempt = {
      id: attemptId,
      examId,
      examTitleSnapshot: exam.title,
      examSnapshot: JSON.parse(JSON.stringify(exam)), // نسخة ثابتة لا تتأثر بأي تعديل مستقبلي
      studentId,
      studentNameSnapshot: student.fullName,
      studentGroupSnapshot: student.groupName || 'عام',
      attemptNumber: priorAttempts.length + 1,
      startedAt: now,
      status: 'in_progress',
      answers: {},
      totalScore: 0,
      maxPossibleScore: exam.totalPoints,
      percentage: 0,
      isPassed: false,
      createdAt: now,
      updatedAt: now,
    };

    setExamAttempts((prev) => [newAttempt, ...prev]);
    return { success: true, attempt: newAttempt };
  };

  const saveExamAttemptProgress = (
    attemptId: string,
    answers: Record<string, StudentQuestionAnswer>
  ) => {
    setExamAttempts((prev) =>
      prev.map((a) =>
        a.id === attemptId
          ? { ...a, answers, updatedAt: new Date().toISOString() }
          : a
      )
    );
  };

  const submitExamAttempt = (
    attemptId: string,
    answers: Record<string, StudentQuestionAnswer>
  ): { success: boolean; error?: string; attempt?: ExamAttempt } => {
    const existing = examAttempts.find((a) => a.id === attemptId);
    if (!existing) return { success: false, error: 'المحاولة غير موجودة' };

    const exam = existing.examSnapshot;
    const questions = exam.questions || [];
    const gradedAnswers: Record<string, StudentQuestionAnswer> = {};
    let totalScore = 0;
    let hasPendingManualReview = false;

    questions.forEach((q) => {
      const ans = answers[q.id];
      const gradeRes = gradeSingleQuestion(q, ans);

      if (gradeRes.needsManualReview) {
        hasPendingManualReview = true;
      }

      const awardedPoints = gradeRes.awardedPoints;
      totalScore += awardedPoints;

      gradedAnswers[q.id] = {
        questionId: q.id,
        selectedOptionIds: ans?.selectedOptionIds,
        selectedBoolean: ans?.selectedBoolean,
        numericAnswer: ans?.numericAnswer,
        textAnswer: ans?.textAnswer,
        isCorrect: gradeRes.isCorrect,
        awardedPoints,
        isManuallyGraded: !gradeRes.needsManualReview,
        supervisorComment: ans?.supervisorComment,
      };
    });

    const maxScore = exam.totalPoints || 1;
    const percentage = Math.round((totalScore / maxScore) * 100);
    const isPassed = totalScore >= (exam.passingScore || 0);
    const now = new Date().toISOString();
    const startTime = new Date(existing.startedAt).getTime();
    const durationSecondsTaken = Math.max(0, Math.floor((new Date(now).getTime() - startTime) / 1000));

    const finalStatus: ExamAttemptStatus = hasPendingManualReview
      ? 'grading_pending'
      : 'graded';

    const updatedAttempt: ExamAttempt = {
      ...existing,
      submittedAt: now,
      durationSecondsTaken,
      status: finalStatus,
      answers: gradedAnswers,
      totalScore,
      maxPossibleScore: maxScore,
      percentage,
      isPassed,
      updatedAt: now,
    };

    setExamAttempts((prev) =>
      prev.map((a) => (a.id === attemptId ? updatedAttempt : a))
    );

    return { success: true, attempt: updatedAttempt };
  };

  const gradeAttemptQuestion = (
    attemptId: string,
    questionId: string,
    awardedPoints: number,
    comment?: string
  ): { success: boolean; error?: string } => {
    setExamAttempts((prev) =>
      prev.map((a) => {
        if (a.id !== attemptId) return a;
        const currentAns = a.answers[questionId] || {
          questionId,
          awardedPoints: 0,
          isManuallyGraded: true,
        };
        const updatedAnswers = {
          ...a.answers,
          [questionId]: {
            ...currentAns,
            awardedPoints: Number(awardedPoints) || 0,
            isManuallyGraded: true,
            supervisorComment: comment !== undefined ? comment : currentAns.supervisorComment,
          },
        };

        const newTotal = Object.values(updatedAnswers).reduce(
          (sum, ans) => sum + (Number(ans.awardedPoints) || 0),
          0
        );
        const percentage = Math.round((newTotal / (a.maxPossibleScore || 1)) * 100);
        const isPassed = newTotal >= (a.examSnapshot.passingScore || 0);

        return {
          ...a,
          answers: updatedAnswers,
          totalScore: newTotal,
          percentage,
          isPassed,
          updatedAt: new Date().toISOString(),
        };
      })
    );
    return { success: true };
  };

  const approveAndFinalizeAttempt = (
    attemptId: string,
    supervisorFeedback?: string,
    staffId?: string
  ): { success: boolean; error?: string } => {
    setExamAttempts((prev) =>
      prev.map((a) => {
        if (a.id !== attemptId) return a;
        return {
          ...a,
          status: 'graded',
          supervisorFeedback: supervisorFeedback || a.supervisorFeedback,
          gradedByStaffId: staffId || a.gradedByStaffId,
          gradedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      })
    );
    return { success: true };
  };


  return (
    <LibraryContext.Provider
      value={{
        settings,
        categories,
        books,
        copies,
        students,
        staff,
        reservations,
        loans,
        loanEvents,
        conditionReports,
        inventorySessions,
        inventoryScans,
        auditLogs,
        readingChallenges,
        waitlist,
        returnRequests,
        exchangeRequests,
        conversations,
        messages,
        readingRanks,
        certificateSettings,
        achievementSettings,
        updateAchievementSettings,
        readingLogs,
        readingLogCorrections,
        studentRanks,
        readingCertificates,
        getStudentRankSummary,
        getBookReadingCoverage,
        submitReadingLog,
        recordReadingLogBySupervisor,
        approveReadingLog,
        rejectReadingLog,
        correctReadingLog,
        markRankCelebrated,
        reissueCertificate,
        addReadingRank,
        updateReadingRank,
        deleteReadingRank,
        reorderReadingRanks,
        updateCertificateSettings,
        recordBookAndPagesInStudentRecord,
        submitReturnRequest,
        cancelReturnRequest,
        updateReturnRequestStatus,
        submitExchangeRequest,
        cancelExchangeRequest,
        updateExchangeRequestStatus,
        readingCompletions,
        requestReadingCompletion,
        approveReadingCompletion,
        setReadingCompletionUnderReview,
        returnReadingCompletionForRevision,
        rejectReadingCompletion,
        updateReadingCompletionAdminNotes,
        chatSettings,
        chatOutbox,
        isChatOnline,
        updateChatSettings,
        getActiveChatSupervisors,
        createOrGetConversation,
        sendChatMessage,
        retryChatMessage,
        flushChatOutbox,
        markConversationAsRead,
        markConversationDelivered,
        updateConversationStatus,
        togglePinConversation,
        toggleFollowUpConversation,
        transferConversationToAdmin,
        softDeleteChatMessage,
        toggleMessageReaction,
        updateConversationPresence,
        getBookCopies,
        getAvailableCopies,
        getStudentActiveLoans,
        getStudentReservations,
        getStudentReadingHistory,
        isStudentEligibleForLoan,
        checkoutBook,
        returnBook,
        extendLoan,
        approveReturnInspection,
        addCategory,
        updateCategory,
        addBook,
        updateBook,
        deleteBook,
        addCopy,
        updateCopy,
        issuedStudentCredentials,
        isStudentCodeAvailable,
        addStudent,
        bulkAddStudents,
        updateStudent,
        regenerateStudentCode,
        resetStudentAccessCode,
        reissueStudentQrToken,
        revokeStudentQrToken,
        toggleStudentQrLogin,
        batchGenerateStudentCredentials,
        requestReservation,
        updateReservationStatus,
        createInventorySession,
        recordInventoryScan,
        completeInventorySession,
        logAudit,
        updateSettings,
        rollbackSettingsSnapshot,
        exportDatabaseBackup,
        importDatabaseBackup,
        resetToDefaults,
        clearAllData,
        discussions,
        discussionGroups,
        discussionSettings: discussionSettingsState,
        getStudentDiscussionPoints,
        canStaffApproveDiscussion,
        requestDiscussion,
        scheduleDiscussion,
        recordDiscussionResult,
        approveDiscussion,
        requestRediscussion,
        cancelDiscussion,
        createDiscussionGroup,
        updateDiscussionSettings,
        reportSettings,
        groupReportSummaries,
        studentReportNotes,
        updateReportSettings,
        saveGroupReportSummary,
        saveStudentReportNote,
        addStaffMember,
        updateStaffMember,
        exams,
        examAttempts,
        createExam,
        updateExam,
        deleteExam,
        publishExam,
        pauseExam,
        extendExamDuration,
        duplicateExam,
        startExamAttempt,
        saveExamAttemptProgress,
        submitExamAttempt,
        gradeAttemptQuestion,
        approveAndFinalizeAttempt,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used within a LibraryProvider');
  return context;
};
