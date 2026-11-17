import { Student, Loan, Reservation, ReadingLog, ReadingDiscussion } from '../types';
import { isSupabaseConfigured, getSupabaseClient } from './supabase';

/**
 * تحويل سجل الطالب من قاعدة بيانات Supabase (snake_case) إلى نموذج التطبيق (camelCase)
 */
export function mapSupabaseStudentToStudent(row: any): Student {
  const now = new Date().toISOString();
  return {
    id: String(row.id),
    internalId: String(row.internal_id || '').trim().toUpperCase(),
    fullName: String(row.full_name || '').trim(),
    grade: String(row.grade || 'غير محدد').trim(),
    stage: row.stage || 'الابتدائية',
    groupName: row.group_name || 'عام',
    accessCodeHash: row.access_code_hash || undefined,
    accessCodeUpdatedAt: row.access_code_updated_at || row.created_at || now,
    qrToken: row.qr_token || `WTH-QR-${String(row.id).slice(0, 8).toUpperCase()}`,
    qrTokenHash: row.qr_token_hash || undefined,
    qrTokenStatus: (row.qr_token_status as any) || 'active',
    qrLoginEnabled: row.qr_login_enabled !== false,
    qrTokenVersion: Number(row.qr_token_version) || 1,
    qrTokenIssuedAt: row.qr_token_issued_at || row.created_at || now,
    status: (row.status as any) || 'active',
    totalBooksRead: Number(row.total_books_read) || 0,
    currentActiveLoans: Number(row.current_active_loans) || 0,
    notes: row.notes || undefined,
    createdAt: row.created_at || now,
    lastLoginAt: row.last_login_at || undefined,
  };
}

/**
 * تحويل نموذج الطالب من التطبيق إلى حقول جدول Supabase (snake_case)
 */
export function mapStudentToSupabasePayload(student: Student): Record<string, any> {
  const payload: Record<string, any> = {
    id: student.id,
    internal_id: student.internalId.trim().toUpperCase(),
    full_name: student.fullName.trim(),
    grade: student.grade.trim(),
    stage: student.stage || 'الابتدائية',
    group_name: student.groupName || 'عام',
    status: student.status || 'active',
    total_books_read: student.totalBooksRead || 0,
    current_active_loans: student.currentActiveLoans || 0,
    notes: student.notes || null,
  };

  if (student.accessCodeHash) {
    payload.access_code_hash = student.accessCodeHash;
    payload.access_code_updated_at = student.accessCodeUpdatedAt || new Date().toISOString();
  }

  if (student.qrToken) {
    payload.qr_token = student.qrToken;
    payload.qr_token_hash = student.qrTokenHash || null;
    payload.qr_token_status = student.qrTokenStatus || 'active';
    payload.qr_login_enabled = student.qrLoginEnabled !== false;
  }

  if (student.lastLoginAt) {
    payload.last_login_at = student.lastLoginAt;
  }

  return payload;
}

/**
 * البحث المباشر عن طالب من قاعدة البيانات السحابية المركزية باستخدام كود الطالب (internal_id)
 */
export async function fetchStudentByCodeFromSupabase(studentCode: string): Promise<Student | null> {
  if (!isSupabaseConfigured()) return null;
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const cleanCode = studentCode.trim().toUpperCase();
    const { data, error } = await client
      .from('students')
      .select('*')
      .ilike('internal_id', cleanCode)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return mapSupabaseStudentToStudent(data);
  } catch (err) {
    console.warn('فشل جلب بيانات الطالب من Supabase:', err);
    return null;
  }
}

/**
 * البحث المباشر عن طالب من قاعدة البيانات السحابية باستخدام المعرف الأساسي (UUID)
 */
export async function fetchStudentByIdFromSupabase(studentId: string): Promise<Student | null> {
  if (!isSupabaseConfigured()) return null;
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('students')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();

    if (error || !data) return null;
    return mapSupabaseStudentToStudent(data);
  } catch (err) {
    console.warn('فشل جلب سجل الطالب بالمعرف:', err);
    return null;
  }
}

/**
 * جلب قائمة الطلاب الكاملة من قاعدة البيانات المركزية
 */
export async function fetchAllStudentsFromSupabase(): Promise<Student[] | null> {
  if (!isSupabaseConfigured()) return null;
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !Array.isArray(data)) {
      return null;
    }

    return data.map(mapSupabaseStudentToStudent);
  } catch (err) {
    console.warn('فشل جلب قائمة الطلاب من Supabase:', err);
    return null;
  }
}

/**
 * حفظ أو تحديث سجل طالب في قاعدة البيانات السحابية المركزية مع الحفاظ الصارم على المعرف الأساسي وعدم تكراره
 */
export async function upsertStudentToSupabase(
  student: Student
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: true }; // وضع محلي بدون سحابة
  const client = getSupabaseClient();
  if (!client) return { success: true };

  try {
    const payload = mapStudentToSupabasePayload(student);
    const { error } = await client
      .from('students')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error('Supabase upsert student error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'تعذر الاتصال بقاعدة البيانات السحابية' };
  }
}

/**
 * تحديث وقت آخر دخول للطالب في قاعدة البيانات السحابية
 */
export async function recordStudentLoginInSupabase(studentId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client
      .from('students')
      .update({
        last_login_at: new Date().toISOString(),
        failed_login_attempts: 0,
      })
      .eq('id', studentId);
  } catch {
    // عدم تعطيل تسجيل الدخول في حال فشل تحديث التوقيت بالخلفية
  }
}

/**
 * جلب سجلات استعارات الطالب الحالي من قاعدة البيانات المركزية
 */
export async function fetchStudentLoansFromSupabase(studentId: string): Promise<Loan[] | null> {
  if (!isSupabaseConfigured()) return null;
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('loans')
      .select('*')
      .eq('student_id', studentId)
      .order('loan_date', { ascending: false });

    if (error || !Array.isArray(data)) return null;

    return data.map((row: any) => ({
      id: String(row.id),
      copyId: String(row.copy_id),
      studentId: String(row.student_id),
      supervisorId: String(row.supervisor_id || ''),
      loanDate: row.loan_date,
      dueDate: row.due_date,
      returnDate: row.return_date || undefined,
      status: row.status,
      renewalCount: Number(row.renewal_count) || 0,
      notes: row.notes || undefined,
      createdAt: row.created_at || row.loan_date,
    }));
  } catch (err) {
    console.warn('فشل جلب إعارات الطالب من Supabase:', err);
    return null;
  }
}

/**
 * جلب سجلات قراءة الطالب من قاعدة البيانات المركزية
 */
export async function fetchStudentReadingLogsFromSupabase(studentId: string): Promise<ReadingLog[] | null> {
  if (!isSupabaseConfigured()) return null;
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('reading_logs')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error || !Array.isArray(data)) return null;

    return data.map((row: any) => ({
      id: String(row.id),
      studentId: String(row.student_id),
      loanId: String(row.loan_id),
      bookId: String(row.book_id),
      fromPage: Number(row.from_page),
      toPage: Number(row.to_page),
      pagesCount: Number(row.pages_count) || Math.max(1, (Number(row.to_page) - Number(row.from_page) + 1)),
      readingDate: row.reading_date || String(row.created_at || '').slice(0, 10),
      studentNotes: row.student_notes || undefined,
      status: row.status,
      supervisorNotes: row.supervisor_notes || undefined,
      approvedByStaffId: row.approved_by_staff_id || undefined,
      approvedAt: row.approved_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
    }));
  } catch (err) {
    console.warn('فشل جلب سجل قراءة الطالب من Supabase:', err);
    return null;
  }
}

/**
 * خريطة أسماء الكيانات البرمجية إلى أسماء جداول Supabase
 */
export const ENTITY_TABLE_MAP: Record<string, string> = {
  books: 'books',
  copies: 'book_copies',
  categories: 'categories',
  students: 'students',
  staff: 'staff_users',
  loans: 'loans',
  loanEvents: 'loan_events',
  reservations: 'reservations',
  returnRequests: 'return_requests',
  exchangeRequests: 'exchange_requests',
  readingLogs: 'reading_logs',
  readingLogCorrections: 'reading_log_corrections',
  readingRanks: 'reading_ranks',
  studentRanks: 'student_ranks',
  readingCertificates: 'reading_certificates',
  discussions: 'reading_discussions',
  discussionGroups: 'discussion_groups',
  discussionSettings: 'discussion_settings',
  reportSettings: 'report_settings',
  groupReportSummaries: 'group_report_summaries',
  studentReportNotes: 'student_report_notes',
  exams: 'electronic_exams',
  examAttempts: 'exam_attempts',
  readingCompletions: 'reading_completions',
  settings: 'library_settings',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
};

/**
 * حفظ أو حذف أي سجل في جدول Supabase المقابل له مع التحويل التلقائي
 */
export async function syncEntityRecordToSupabase(
  entity: string,
  record: any,
  action: 'UPSERT' | 'DELETE' = 'UPSERT'
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !record) return { success: true };
  const client = getSupabaseClient();
  if (!client) return { success: true };

  const tableName = ENTITY_TABLE_MAP[entity] || entity;

  try {
    if (action === 'DELETE') {
      const targetId = typeof record === 'string' ? record : record.id;
      if (!targetId) return { success: true };
      const { error } = await client.from(tableName).delete().eq('id', targetId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    // إعداد الحمولة مع تنظيف المفاتيح
    const payload: Record<string, any> = {};
    for (const [key, value] of Object.entries(record)) {
      // تحويل camelCase إلى snake_case للجدول
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      payload[snakeKey] = value;
    }

    const { error } = await client.from(tableName).upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn(`Supabase upsert to ${tableName} warning:`, error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'خطأ أثناء المزامنة مع السحابة' };
  }
}

/**
 * جلب الحالة الكاملة لقاعدة البيانات السحابية المركزية
 */
export async function fetchFullCloudState(): Promise<Record<string, any> | null> {
  if (!isSupabaseConfigured()) return null;
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const [
      booksRes,
      copiesRes,
      categoriesRes,
      studentsRes,
      staffRes,
      loansRes,
      reservationsRes,
      completionsRes,
      discussionsRes,
      examsRes,
      settingsRes,
    ] = await Promise.allSettled([
      client.from('books').select('*').order('created_at', { ascending: false }),
      client.from('book_copies').select('*'),
      client.from('categories').select('*').order('display_order', { ascending: true }),
      client.from('students').select('*').order('created_at', { ascending: false }),
      client.from('staff_users').select('*'),
      client.from('loans').select('*').order('loan_date', { ascending: false }),
      client.from('reservations').select('*'),
      client.from('reading_completions').select('*'),
      client.from('reading_discussions').select('*'),
      client.from('electronic_exams').select('*'),
      client.from('library_settings').select('*').limit(1),
    ]);

    const result: Record<string, any> = {};

    if (booksRes.status === 'fulfilled' && Array.isArray(booksRes.value.data) && booksRes.value.data.length > 0) {
      result.books = booksRes.value.data.map((row) => ({
        id: String(row.id),
        code: row.code,
        title: row.title,
        author: row.author,
        publisher: row.publisher,
        description: row.description,
        categoryId: row.category_id,
        ageGroup: row.age_group,
        pageCount: row.page_count,
        coverImageUrl: row.cover_image_url,
        isFeatured: row.is_featured,
        isBookOfTheWeek: row.is_book_of_the_week,
        totalCopiesCount: row.total_copies_count,
        availableCopiesCount: row.available_copies_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    }

    if (copiesRes.status === 'fulfilled' && Array.isArray(copiesRes.value.data) && copiesRes.value.data.length > 0) {
      result.copies = copiesRes.value.data.map((row) => ({
        id: String(row.id),
        bookId: String(row.book_id),
        copyCode: row.copy_code,
        qrData: row.qr_data,
        status: row.status,
        condition: row.condition,
        shelfLocation: row.shelf_location,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    }

    if (categoriesRes.status === 'fulfilled' && Array.isArray(categoriesRes.value.data) && categoriesRes.value.data.length > 0) {
      result.categories = categoriesRes.value.data.map((row) => ({
        id: String(row.id),
        name: row.name,
        code: row.code,
        description: row.description,
        iconName: row.icon_name || 'BookOpen',
        displayOrder: row.display_order,
      }));
    }

    if (studentsRes.status === 'fulfilled' && Array.isArray(studentsRes.value.data) && studentsRes.value.data.length > 0) {
      result.students = studentsRes.value.data.map(mapSupabaseStudentToStudent);
    }

    if (loansRes.status === 'fulfilled' && Array.isArray(loansRes.value.data) && loansRes.value.data.length > 0) {
      result.loans = loansRes.value.data.map((row) => ({
        id: String(row.id),
        copyId: String(row.copy_id),
        studentId: String(row.student_id),
        supervisorId: String(row.supervisor_id || ''),
        loanDate: row.loan_date,
        dueDate: row.due_date,
        returnDate: row.return_date || undefined,
        status: row.status,
        renewalCount: Number(row.renewal_count) || 0,
        notes: row.notes || undefined,
        createdAt: row.created_at || row.loan_date,
      }));
    }

    if (reservationsRes.status === 'fulfilled' && Array.isArray(reservationsRes.value.data) && reservationsRes.value.data.length > 0) {
      result.reservations = reservationsRes.value.data.map((row) => ({
        id: String(row.id),
        bookId: String(row.book_id),
        studentId: String(row.student_id),
        reservationDate: row.reservation_date || row.created_at,
        status: row.status,
        assignedCopyId: row.assigned_copy_id || undefined,
        notes: row.notes || undefined,
      }));
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (err) {
    console.warn('Failed to fetch full state from cloud:', err);
    return null;
  }
}

