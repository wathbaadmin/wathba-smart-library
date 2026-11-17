-- ========================================================================
-- منظومة مكتبة وثبة الذكية - Wathba Smart Library System
-- مخطط قاعدة البيانات المتكامل (Schema DDL) مع سياسات الأمان RLS وسجل الرقابة
-- متوافق مع PostgreSQL 15+ و Supabase
-- توقيت الرياض: Asia/Riyadh
-- ========================================================================

-- تفعيل الامتدادات المطلوبة
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================================================
-- 1. جدول التصنيفات والفهرسة (categories)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL UNIQUE,
    description TEXT,
    icon_name VARCHAR(64) DEFAULT 'BookOpen',
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- ========================================================================
-- 2. جدول عناوين الكتب الأصلية (books)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(64) NOT NULL UNIQUE, -- e.g. WTH-000125
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    publisher VARCHAR(255),
    description TEXT,
    category_id VARCHAR(64) REFERENCES public.categories(id) ON DELETE SET NULL,
    age_group VARCHAR(64) DEFAULT 'للجميع',
    page_count INT,
    cover_image_url TEXT,
    is_featured BOOLEAN DEFAULT FALSE,
    is_book_of_the_week BOOLEAN DEFAULT FALSE,
    week_highlight_note TEXT,
    total_copies_count INT DEFAULT 1,
    available_copies_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- ========================================================================
-- 3. جدول النسخ الورقية المادية وباركود الـ QR (book_copies)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.book_copies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    copy_code VARCHAR(64) NOT NULL UNIQUE, -- e.g. WTH-125-001
    qr_data TEXT NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'available', -- available, reserved, borrowed, overdue, under_inspection, damaged, lost
    condition VARCHAR(32) NOT NULL DEFAULT 'good', -- pristine, good, needs_monitoring, damaged, lost
    shelf_location VARCHAR(128) NOT NULL DEFAULT 'الرف العام',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- ========================================================================
-- 4. جدول حسابات الطلاب (students)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    internal_id VARCHAR(64) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    grade VARCHAR(64) NOT NULL, -- الصف الدراسي
    stage VARCHAR(64) DEFAULT 'الابتدائية',
    group_name VARCHAR(64) DEFAULT 'عام',
    access_code_hash VARCHAR(255) NOT NULL, -- PIN مشفر
    qr_token VARCHAR(255) NOT NULL UNIQUE, -- مشفر بدون بيانات حساسة
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    total_books_read INT DEFAULT 0,
    current_active_loans INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- ========================================================================
-- 5. جدول طاقم الإشراف والإدارة (staff_users)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.staff_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(64) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'supervisor', -- admin, supervisor
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(32),
    permissions JSONB DEFAULT '{"can_checkout": true, "can_return": true, "can_inspect": true, "can_inventory": true, "can_manage_books": true, "can_manage_students": true, "can_manage_settings": false}'::jsonb,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- ========================================================================
-- 6. جدول حركة الإعارات (loans)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    copy_id UUID NOT NULL REFERENCES public.book_copies(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    supervisor_id UUID REFERENCES public.staff_users(id),
    loan_date TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    due_date TIMESTAMPTZ NOT NULL,
    return_date TIMESTAMPTZ,
    returned_to_supervisor_id UUID REFERENCES public.staff_users(id),
    status VARCHAR(32) NOT NULL DEFAULT 'active', -- active, returned, overdue, cancelled
    renewal_count INT NOT NULL DEFAULT 0, -- تمديد 0
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- ========================================================================
-- 7. جدول أحداث دورة الإعارة (loan_events)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.loan_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    event_type VARCHAR(32) NOT NULL, -- checkout, return, damage_reported, cancelled
    staff_id UUID REFERENCES public.staff_users(id),
    notes TEXT,
    event_data JSONB,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- ========================================================================
-- 8. جدول طلبات حجز الكتب (reservations)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    assigned_copy_id UUID REFERENCES public.book_copies(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'new_request', -- new_request, pending_approval, approved, ready_for_pickup, fulfilled, rejected, cancelled, expired
    requested_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    approved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ, -- بعد 48 ساعة
    notes TEXT,
    handled_by_staff_id UUID REFERENCES public.staff_users(id)
);

-- ========================================================================
-- 9. جدول تقارير فحص حالة الكتب (condition_reports)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.condition_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    copy_id UUID NOT NULL REFERENCES public.book_copies(id) ON DELETE CASCADE,
    loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES public.staff_users(id),
    stage VARCHAR(32) NOT NULL, -- checkout, return, routine, maintenance
    rating VARCHAR(32) NOT NULL, -- pristine, good, needs_monitoring, damaged, lost
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- ========================================================================
-- 10. جدول صور توثيق حالة الكتب (condition_photos)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.condition_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES public.condition_reports(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_type VARCHAR(32) DEFAULT 'damage_documentation',
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- ========================================================================
-- 11. جدول جلسات الجرد الدوري (inventory_sessions)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.inventory_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    supervisor_id UUID REFERENCES public.staff_users(id),
    status VARCHAR(32) NOT NULL DEFAULT 'active', -- active, completed, cancelled
    expected_copies_count INT DEFAULT 0,
    scanned_copies_count INT DEFAULT 0,
    missing_copies_count INT DEFAULT 0,
    unexpected_copies_count INT DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    completed_at TIMESTAMPTZ,
    summary_report JSONB,
    notes TEXT
);

-- ========================================================================
-- 12. جدول مسحات الجرد (inventory_scans)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.inventory_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.inventory_sessions(id) ON DELETE CASCADE,
    copy_id UUID REFERENCES public.book_copies(id) ON DELETE SET NULL,
    scanned_code VARCHAR(64) NOT NULL,
    result VARCHAR(32) NOT NULL, -- found_on_shelf, expected_borrowed, in_maintenance, misplaced, unknown_code
    scanned_by_staff_id UUID REFERENCES public.staff_users(id),
    scanned_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    notes TEXT
);

-- ========================================================================
-- 13. جدول الإشعارات والتعميمات (notifications)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_type VARCHAR(32) NOT NULL, -- student, staff, broadcast
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES public.staff_users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'info', -- info, success, warning, urgent
    action_link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- ========================================================================
-- 14. جدول إعدادات المكتبة والسياسات (library_settings)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.library_settings (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'primary_settings',
    library_name VARCHAR(255) NOT NULL DEFAULT 'مكتبة وثبة الذكية',
    library_english_name VARCHAR(255) NOT NULL DEFAULT 'Wathba Smart Library',
    team_name VARCHAR(255) NOT NULL DEFAULT 'فريق وثبة',
    max_loans_per_student INT NOT NULL DEFAULT 2,
    loan_duration_days INT NOT NULL DEFAULT 7,
    max_renewals INT NOT NULL DEFAULT 0, -- تمديد 0
    renewal_duration_days INT NOT NULL DEFAULT 0,
    reservation_validity_hours INT NOT NULL DEFAULT 48,
    block_loan_if_overdue BOOLEAN NOT NULL DEFAULT TRUE,
    require_condition_photos_on_checkout BOOLEAN NOT NULL DEFAULT FALSE,
    require_condition_photos_on_return BOOLEAN NOT NULL DEFAULT TRUE,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Riyadh',
    welcome_message TEXT DEFAULT 'مرحباً بكم في مكتبة وثبة الذكية',
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- ========================================================================
-- 15. جدول سجل العمليات والرقابة الأمنية (audit_logs)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id VARCHAR(64),
    actor_type VARCHAR(32) NOT NULL, -- admin, supervisor, student, system
    actor_name VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64),
    previous_state JSONB,
    new_state JSONB,
    reason TEXT,
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- ========================================================================
-- سياسات حماية وأمان البيانات (Row Level Security - RLS)
-- ========================================================================

-- تفعيل RLS على جميع الجداول
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condition_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condition_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ========================================================================
-- 15. جدول طلبات إرجاع الكتب المستعارة (return_requests)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.return_requests (
    id VARCHAR(64) PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    copy_id UUID NOT NULL REFERENCES public.book_copies(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    student_notes TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'new', -- new, in_review, approved, waiting_for_pickup, received, under_inspection, completed, rejected, cancelled
    rejection_reason TEXT,
    scheduled_pickup_time TEXT,
    handled_by_staff_id UUID REFERENCES public.staff(id),
    inspection_rating VARCHAR(32),
    inspection_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- ========================================================================
-- 16. جدول طلبات استبدال الكتب المستعارة (exchange_requests)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.exchange_requests (
    id VARCHAR(64) PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    old_loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    old_copy_id UUID NOT NULL REFERENCES public.book_copies(id) ON DELETE CASCADE,
    old_book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    new_book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    new_copy_id UUID REFERENCES public.book_copies(id),
    new_loan_id UUID REFERENCES public.loans(id),
    student_notes TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'new', -- new, in_review, approved, waiting_for_old_book, old_book_received, completed, rejected, cancelled
    rejection_reason TEXT,
    scheduled_pickup_time TEXT,
    handled_by_staff_id UUID REFERENCES public.staff(id),
    old_copy_inspection_rating VARCHAR(32),
    old_copy_inspection_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- ========================================================================
-- 17. جدول المحادثات الداخلية المباشرة (conversations)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id VARCHAR(64) PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    recipient_type VARCHAR(24) NOT NULL DEFAULT 'admin', -- 'admin' | 'supervisor'
    supervisor_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
    assigned_admin_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'open', -- open, waiting_reply, completed, archived
    is_pinned BOOLEAN DEFAULT FALSE,
    is_follow_up BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    last_message_content TEXT,
    last_message_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    unread_count_student INT DEFAULT 0,
    unread_count_supervisor INT DEFAULT 0,
    student_last_seen_at TIMESTAMPTZ,
    staff_last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- ========================================================================
-- 18. جدول رسائل المحادثات المرفقة (messages)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id VARCHAR(64) PRIMARY KEY,
    client_message_id VARCHAR(96),
    conversation_id VARCHAR(64) NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_type VARCHAR(32) NOT NULL, -- student, supervisor, admin, system
    sender_id VARCHAR(64) NOT NULL,
    sender_name VARCHAR(255) NOT NULL,
    recipient_type VARCHAR(24),
    recipient_id VARCHAR(64),
    content TEXT,
    attachment_url TEXT,
    attachment_name VARCHAR(255),
    attachment_type VARCHAR(32), -- image, file
    reply_to_message_id VARCHAR(64),
    delivery_status VARCHAR(24) NOT NULL DEFAULT 'sent', -- sending, sent, delivered, read, failed
    is_read BOOLEAN DEFAULT FALSE,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by_id VARCHAR(64),
    system_event_type VARCHAR(32),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- فهارس السرعة
CREATE INDEX IF NOT EXISTS idx_return_requests_student ON public.return_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_exchange_requests_student ON public.exchange_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_conversations_student ON public.conversations(student_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);

-- تفعيل RLS للأنظمة الجديدة
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 1. الفهرس والتصنيفات والطلاب متاح للقراءة العامة لجميع الطلاب والزوار لمطابقة الحسابات
CREATE POLICY "Public Read Books" ON public.books FOR SELECT USING (true);
CREATE POLICY "Public Read Categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Public Read Book Copies" ON public.book_copies FOR SELECT USING (true);
CREATE POLICY "Public Read Library Settings" ON public.library_settings FOR SELECT USING (true);
CREATE POLICY "Public Read Students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Staff Users Read" ON public.staff_users FOR SELECT USING (true);

-- 2. المشرفون والإدارة يملكون صلاحيات التعديل
CREATE POLICY "Staff Manage Students" ON public.students FOR ALL USING (true);
CREATE POLICY "Staff Users Manage" ON public.staff_users FOR ALL USING (true);
CREATE POLICY "Staff Manage Books" ON public.books FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Staff Manage Copies" ON public.book_copies FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Staff Manage Loans" ON public.loans FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Staff Manage Reservations" ON public.reservations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Staff Manage Reports" ON public.condition_reports FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Staff Manage Inventory" ON public.inventory_sessions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Staff Manage Return Requests" ON public.return_requests FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Staff Manage Exchange Requests" ON public.exchange_requests FOR ALL USING (auth.role() = 'authenticated');

-- 3. صلاحيات الطالب للطلبات (المحادثات محكومة بسياسات العزل التفصيلية في القسم 33 أدناه)
CREATE POLICY "Student Read Own Return Requests" ON public.return_requests FOR SELECT USING (true);
CREATE POLICY "Student Insert Own Return Requests" ON public.return_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Student Read Own Exchange Requests" ON public.exchange_requests FOR SELECT USING (true);
CREATE POLICY "Student Insert Own Exchange Requests" ON public.exchange_requests FOR INSERT WITH CHECK (true);

-- 4. سجل العمليات محمي: يُسمح بالإضافة والاستعلام فقط، وممنوع التعديل أو الحذف نهائياً!
CREATE POLICY "Audit Logs Read" ON public.audit_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Audit Logs Insert" ON public.audit_logs FOR INSERT WITH CHECK (true);
-- لا توجد سياسة UPDATE أو DELETE لـ audit_logs لضمان النزاهة القانونية.

-- ========================================================================
-- إعداد مساحات تخزين الصور (Supabase Storage Buckets)
-- ========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('book-covers', 'book-covers', true),
    ('condition-photos', 'condition-photos', true),
    ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- سياسات التخزين
CREATE POLICY "Public Access Covers" ON storage.objects FOR SELECT USING (bucket_id = 'book-covers');
CREATE POLICY "Authenticated Upload Covers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'book-covers');
CREATE POLICY "Public Access Condition Photos" ON storage.objects FOR SELECT USING (bucket_id = 'condition-photos');
CREATE POLICY "Authenticated Upload Condition Photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'condition-photos');
CREATE POLICY "Public Access Chat Attachments" ON storage.objects FOR SELECT USING (bucket_id = 'chat-attachments');
CREATE POLICY "Authenticated Upload Chat Attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-attachments');

-- ========================================================================
-- 19 - 25. منظومة «الألقاب والشهادات القرائية» (بديلاً عن رحلة المدن السابقة)
-- ========================================================================

-- إزالة الجداول والدوال السيادية الخاصة بنظام «رحلة قارئ وثبة» السابق مع الحفاظ الكامل على سجلات القراءة والكتب والطلاب والإعارات
DROP POLICY IF EXISTS "Public Access City Images" ON storage.objects;
DROP POLICY IF EXISTS "Staff Upload City Images" ON storage.objects;
DROP FUNCTION IF EXISTS public.approve_reading_log_server(VARCHAR, UUID);

DROP TABLE IF EXISTS public.group_city_stamps CASCADE;
DROP TABLE IF EXISTS public.group_journeys CASCADE;
DROP TABLE IF EXISTS public.student_journey_badges CASCADE;
DROP TABLE IF EXISTS public.student_challenge_answers CASCADE;
DROP TABLE IF EXISTS public.student_city_stamps CASCADE;
DROP TABLE IF EXISTS public.journey_correction_logs CASCADE;
DROP TABLE IF EXISTS public.student_journey_profiles CASCADE;
DROP TABLE IF EXISTS public.journey_cities CASCADE;
DROP TABLE IF EXISTS public.journey_settings CASCADE;

-- 19. تعريفات الألقاب القرائية الخمسة المتدرجة (قابلة للتعديل والترتيب والتفعيل من الإدارة)
CREATE TABLE IF NOT EXISTS public.reading_ranks (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    order_index INT NOT NULL DEFAULT 1,
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    required_pages INT NOT NULL CHECK (required_pages > 0),
    description TEXT,
    motivational_phrase TEXT,
    theme_key VARCHAR(32) NOT NULL DEFAULT 'diploma' CHECK (theme_key IN ('diploma', 'bachelor', 'master', 'doctorate', 'wathab', 'custom')),
    primary_color VARCHAR(32) NOT NULL DEFAULT '#3b707d',
    secondary_color VARCHAR(32) NOT NULL DEFAULT '#e3ecf3',
    accent_color VARCHAR(32) NOT NULL DEFAULT '#0284c7',
    badge_title VARCHAR(255),
    certificate_heading VARCHAR(255),
    is_highest_tier BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- 20. إعدادات قوالب الشهادات والتوقيع والجهة المصدرة
CREATE TABLE IF NOT EXISTS public.certificate_settings (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'default',
    issuer_organization VARCHAR(255) NOT NULL DEFAULT 'مكتبة وثبة الذكية • فريق وثبة',
    signatory_title VARCHAR(255) NOT NULL DEFAULT 'إدارة مكتبة وثبة الذكية',
    signatory_name VARCHAR(255) NOT NULL DEFAULT 'فريق الإشراف التربوي والثقافي',
    footer_note TEXT DEFAULT 'صادرة إلكترونياً وموثقة في السجل القرائي المركزي لمكتبة وثبة الذكية — المملكة العربية السعودية',
    serial_prefix VARCHAR(32) NOT NULL DEFAULT 'WTH-CERT',
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- 21. رصيد القراءة المعتمد لكل طالب (يُحسب في الخادم فقط ولا يُعدّل من المتصفح)
CREATE TABLE IF NOT EXISTS public.student_rank_profiles (
    student_id UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
    total_approved_pages INT NOT NULL DEFAULT 0 CHECK (total_approved_pages >= 0),
    current_rank_id VARCHAR(64) REFERENCES public.reading_ranks(id) ON DELETE SET NULL,
    has_wathab_medal BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- 22. سجلات وطلبات القراءة مع ضمان عدم تكرار الصفحات أو تجاوز صفحات الكتاب أو الإخلال بملكية الإعارة
-- (يتم الإبقاء على السجلات المعتمدة السابقة وترقية الأعمدة بأمان دون حذف البيانات التاريخية)
CREATE TABLE IF NOT EXISTS public.reading_logs (
    id VARCHAR(64) PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE RESTRICT,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
    from_page INT NOT NULL CHECK (from_page >= 1),
    to_page INT NOT NULL CHECK (to_page >= from_page),
    pages_count INT GENERATED ALWAYS AS (to_page - from_page + 1) STORED,
    reading_date DATE NOT NULL DEFAULT (TIMEZONE('Asia/Riyadh', NOW())::date),
    student_notes TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'superseded')),
    rejection_reason TEXT,
    reviewed_by_staff_id UUID REFERENCES public.staff(id),
    reviewed_at TIMESTAMPTZ,
    superseded_by_id VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

ALTER TABLE public.reading_logs
    ADD COLUMN IF NOT EXISTS reading_date DATE NOT NULL DEFAULT (TIMEZONE('Asia/Riyadh', NOW())::date);

ALTER TABLE public.reading_logs
    DROP COLUMN IF EXISTS km_awarded,
    DROP COLUMN IF EXISTS pages_per_unit_snapshot,
    DROP COLUMN IF EXISTS km_per_unit_snapshot;

-- 23. سجل التصحيحات الإدارية الموثقة لسجلات القراءة دون حذف السجل القديم
CREATE TABLE IF NOT EXISTS public.reading_log_corrections (
    id VARCHAR(64) PRIMARY KEY,
    reading_log_id VARCHAR(64) NOT NULL REFERENCES public.reading_logs(id) ON DELETE RESTRICT,
    new_reading_log_id VARCHAR(64) REFERENCES public.reading_logs(id) ON DELETE SET NULL,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.staff(id),
    previous_from_page INT NOT NULL,
    previous_to_page INT NOT NULL,
    previous_pages_count INT NOT NULL,
    new_from_page INT NOT NULL,
    new_to_page INT NOT NULL,
    new_pages_count INT NOT NULL,
    pages_delta INT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- 24. الألقاب المكتسبة للطلاب والاحتفال التلقائي والوسام الحصري للقب «وثّاب»
CREATE TABLE IF NOT EXISTS public.student_ranks (
    id VARCHAR(64) PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    rank_id VARCHAR(64) NOT NULL REFERENCES public.reading_ranks(id) ON DELETE CASCADE,
    pages_at_unlock INT NOT NULL DEFAULT 0,
    unlocked_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    is_celebrated BOOLEAN NOT NULL DEFAULT FALSE,
    has_exclusive_medal BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (student_id, rank_id)
);

-- 25. الشهادات القرائية الصادرة مع منع التكرار وأرشفة النسخ السابقة عند إعادة الإصدار
CREATE TABLE IF NOT EXISTS public.reading_certificates (
    id VARCHAR(64) PRIMARY KEY,
    certificate_number VARCHAR(64) NOT NULL UNIQUE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    rank_id VARCHAR(64) NOT NULL REFERENCES public.reading_ranks(id) ON DELETE RESTRICT,
    student_name_snapshot VARCHAR(255) NOT NULL,
    student_grade_snapshot VARCHAR(128),
    rank_title_snapshot VARCHAR(255) NOT NULL,
    rank_subtitle_snapshot VARCHAR(255),
    certificate_heading_snapshot VARCHAR(255),
    theme_key_snapshot VARCHAR(32) NOT NULL DEFAULT 'diploma',
    primary_color_snapshot VARCHAR(32) NOT NULL DEFAULT '#3b707d',
    secondary_color_snapshot VARCHAR(32) NOT NULL DEFAULT '#e3ecf3',
    accent_color_snapshot VARCHAR(32) NOT NULL DEFAULT '#0284c7',
    pages_completed_snapshot INT NOT NULL DEFAULT 0,
    required_pages_snapshot INT NOT NULL DEFAULT 0,
    motivational_phrase TEXT,
    issuer_organization VARCHAR(255) NOT NULL,
    signatory_title VARCHAR(255) NOT NULL,
    signatory_name VARCHAR(255) NOT NULL,
    footer_note TEXT,
    issued_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    issued_by_staff_id UUID REFERENCES public.staff(id),
    version INT NOT NULL DEFAULT 1,
    is_reissue BOOLEAN NOT NULL DEFAULT FALSE,
    reissue_reason TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'))
);

-- فهارس الأداء ومنع التكرار
CREATE INDEX IF NOT EXISTS idx_reading_logs_student_book ON public.reading_logs(student_id, book_id);
CREATE INDEX IF NOT EXISTS idx_reading_logs_status ON public.reading_logs(status);
CREATE INDEX IF NOT EXISTS idx_reading_logs_date ON public.reading_logs(reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_student_ranks_student ON public.student_ranks(student_id);
CREATE INDEX IF NOT EXISTS idx_reading_certificates_student ON public.reading_certificates(student_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_certificate_per_student_rank
    ON public.reading_certificates(student_id, rank_id)
    WHERE status = 'active';

-- دالة حراسة قاعدة البيانات: منع تكرار الصفحات أو تجاوز صفحات الكتاب أو الإخلال بملكية الإعارة
CREATE OR REPLACE FUNCTION public.validate_reading_log_pages()
RETURNS TRIGGER AS $$
DECLARE
    v_book_pages INT;
    v_loan_student_id UUID;
    v_loan_book_id UUID;
    v_overlap_count INT;
BEGIN
    SELECT student_id, book_id INTO v_loan_student_id, v_loan_book_id
    FROM public.loans
    WHERE id = NEW.loan_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'سجل الإعارة غير موجود';
    END IF;

    IF v_loan_student_id <> NEW.student_id OR v_loan_book_id <> NEW.book_id THEN
        RAISE EXCEPTION 'سجل الإعارة لا يطابق الطالب أو الكتاب المحدد';
    END IF;

    SELECT COALESCE(page_count, 100) INTO v_book_pages FROM public.books WHERE id = NEW.book_id;
    IF NEW.to_page > v_book_pages THEN
        RAISE EXCEPTION 'تجاوز عدد صفحات الكتاب (% صفحة)', v_book_pages;
    END IF;

    IF NEW.status IN ('pending', 'approved') THEN
        SELECT COUNT(*) INTO v_overlap_count
        FROM public.reading_logs
        WHERE student_id = NEW.student_id
          AND book_id = NEW.book_id
          AND id <> NEW.id
          AND status IN ('pending', 'approved')
          AND NEW.from_page <= to_page
          AND NEW.to_page >= from_page;

        IF v_overlap_count > 0 THEN
            RAISE EXCEPTION 'هذه الصفحات مسجلة مسبقاً ولا يمكن تكرارها';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_reading_log_pages ON public.reading_logs;
CREATE TRIGGER trg_validate_reading_log_pages
BEFORE INSERT OR UPDATE ON public.reading_logs
FOR EACH ROW EXECUTE FUNCTION public.validate_reading_log_pages();

-- دالة مزامنة الألقاب والشهادات على الخادم بناءً على الصفحات المعتمدة فعلياً فقط
CREATE OR REPLACE FUNCTION public.sync_student_ranks_server(p_student_id UUID, p_staff_id UUID DEFAULT NULL)
RETURNS INT AS $$
DECLARE
    v_total_pages INT := 0;
    v_student public.students%ROWTYPE;
    v_cert_settings public.certificate_settings%ROWTYPE;
    v_rank RECORD;
    v_highest_rank_id VARCHAR(64) := NULL;
    v_has_wathab BOOLEAN := FALSE;
    v_seq INT := 0;
    v_cert_num VARCHAR(64);
    v_year INT := EXTRACT(YEAR FROM TIMEZONE('Asia/Riyadh', NOW()))::INT;
BEGIN
    SELECT * INTO v_student FROM public.students WHERE id = p_student_id;
    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    SELECT COALESCE(SUM(pages_count), 0) INTO v_total_pages
    FROM public.reading_logs
    WHERE student_id = p_student_id AND status = 'approved';

    SELECT * INTO v_cert_settings FROM public.certificate_settings WHERE id = 'default' LIMIT 1;
    IF NOT FOUND THEN
        INSERT INTO public.certificate_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
        SELECT * INTO v_cert_settings FROM public.certificate_settings WHERE id = 'default' LIMIT 1;
    END IF;

    FOR v_rank IN
        SELECT * FROM public.reading_ranks
        WHERE is_active = TRUE AND required_pages <= v_total_pages
        ORDER BY required_pages ASC, order_index ASC
    LOOP
        v_highest_rank_id := v_rank.id;
        IF v_rank.is_highest_tier OR v_rank.theme_key = 'wathab' THEN
            v_has_wathab := TRUE;
        END IF;

        INSERT INTO public.student_ranks (id, student_id, rank_id, pages_at_unlock, has_exclusive_medal)
        VALUES (
            'sr-' || encode(gen_random_bytes(6), 'hex'),
            p_student_id,
            v_rank.id,
            v_total_pages,
            (v_rank.is_highest_tier OR v_rank.theme_key = 'wathab')
        )
        ON CONFLICT (student_id, rank_id) DO NOTHING;

        IF NOT EXISTS (
            SELECT 1 FROM public.reading_certificates
            WHERE student_id = p_student_id AND rank_id = v_rank.id AND status = 'active'
        ) THEN
            SELECT COUNT(*) + 1 INTO v_seq FROM public.reading_certificates;
            v_cert_num := COALESCE(NULLIF(TRIM(v_cert_settings.serial_prefix), ''), 'WTH-CERT') || '-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
            WHILE EXISTS (SELECT 1 FROM public.reading_certificates WHERE certificate_number = v_cert_num) LOOP
                v_seq := v_seq + 1;
                v_cert_num := COALESCE(NULLIF(TRIM(v_cert_settings.serial_prefix), ''), 'WTH-CERT') || '-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
            END LOOP;

            INSERT INTO public.reading_certificates (
                id,
                certificate_number,
                student_id,
                rank_id,
                student_name_snapshot,
                student_grade_snapshot,
                rank_title_snapshot,
                rank_subtitle_snapshot,
                certificate_heading_snapshot,
                theme_key_snapshot,
                primary_color_snapshot,
                secondary_color_snapshot,
                accent_color_snapshot,
                pages_completed_snapshot,
                required_pages_snapshot,
                motivational_phrase,
                issuer_organization,
                signatory_title,
                signatory_name,
                footer_note,
                issued_by_staff_id,
                version,
                is_reissue,
                status
            ) VALUES (
                'cert-' || encode(gen_random_bytes(6), 'hex'),
                v_cert_num,
                p_student_id,
                v_rank.id,
                v_student.full_name,
                COALESCE(v_student.grade, ''),
                v_rank.title,
                v_rank.subtitle,
                v_rank.certificate_heading,
                v_rank.theme_key,
                v_rank.primary_color,
                v_rank.secondary_color,
                v_rank.accent_color,
                v_total_pages,
                v_rank.required_pages,
                v_rank.motivational_phrase,
                v_cert_settings.issuer_organization,
                v_cert_settings.signatory_title,
                v_cert_settings.signatory_name,
                v_cert_settings.footer_note,
                p_staff_id,
                1,
                FALSE,
                'active'
            );
        END IF;
    END LOOP;

    INSERT INTO public.student_rank_profiles (student_id, total_approved_pages, current_rank_id, has_wathab_medal, updated_at)
    VALUES (p_student_id, v_total_pages, v_highest_rank_id, v_has_wathab, TIMEZONE('Asia/Riyadh', NOW()))
    ON CONFLICT (student_id) DO UPDATE
    SET total_approved_pages = v_total_pages,
        current_rank_id = v_highest_rank_id,
        has_wathab_medal = v_has_wathab,
        updated_at = TIMEZONE('Asia/Riyadh', NOW());

    RETURN v_total_pages;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة الخادم الموثوقة لاعتماد سجل القراءة وتحديث الألقاب والشهادات
CREATE OR REPLACE FUNCTION public.approve_reading_log_and_ranks_server(p_log_id VARCHAR, p_staff_id UUID)
RETURNS INT AS $$
DECLARE
    v_log public.reading_logs%ROWTYPE;
    v_new_total_pages INT;
BEGIN
    SELECT * INTO v_log FROM public.reading_logs WHERE id = p_log_id FOR UPDATE;
    IF NOT FOUND OR v_log.status <> 'pending' THEN
        RAISE EXCEPTION 'الطلب غير موجود أو تمت مراجعته مسبقاً';
    END IF;

    UPDATE public.reading_logs
    SET status = 'approved',
        reviewed_by_staff_id = p_staff_id,
        reviewed_at = TIMEZONE('Asia/Riyadh', NOW()),
        updated_at = TIMEZONE('Asia/Riyadh', NOW())
    WHERE id = p_log_id;

    v_new_total_pages := public.sync_student_ranks_server(v_log.student_id, p_staff_id);
    RETURN v_new_total_pages;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- البيانات الافتراضية للألقاب القرائية الخمسة وإعدادات الشهادات
INSERT INTO public.certificate_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.reading_ranks (
    id, code, order_index, title, subtitle, required_pages, description,
    motivational_phrase, theme_key, primary_color, secondary_color, accent_color,
    badge_title, certificate_heading, is_highest_tier, is_active
) VALUES
(
    'rank-diploma', 'DIPLOMA', 1, 'دبلوم القراءة', 'المرتبة الأكاديمية الأولى', 100,
    'بداية واثقة ومشرقة في عالم المعرفة، تُمنح عند إتمام قراءة واعتماد 100 صفحة من كتب المكتبة.',
    'مبارك خطوتك الأولى في درب القرّاء المتميزين؛ كل صفحة تقرؤها تفتح لك باباً جديداً للنور والفهم!',
    'diploma', '#3b707d', '#e3ecf3', '#0284c7',
    'شارة باحث الدبلوم', 'شهادة استحقاق الدرجة التأسيسية في القراءة', FALSE, TRUE
),
(
    'rank-bachelor', 'BACHELOR', 2, 'بكالوريوس القراءة', 'المرتبة الأكاديمية الثانية', 300,
    'إنجاز قرائي متين يعكس شغف الطالب بالاطلاع والمثابرة عبر 300 صفحة معتمدة.',
    'أثبتَّ همّةً عاليةً وعزيمةً صادقةً في صحبة الكتاب، فهنيئاً لك هذا التقدّم المشرّف!',
    'bachelor', '#026bc9', '#e0effe', '#38bdf8',
    'شارة قارئ البكالوريوس', 'شهادة تفوّق وإجادة في القراءة المعرفية', FALSE, TRUE
),
(
    'rank-master', 'MASTER', 3, 'ماجستير القراءة', 'المرتبة الأكاديمية الثالثة', 600,
    'مرتبة رفيعة لقارئ متمرّس أتم قراءة واعتماد 600 صفحة من روائع الفكر والقصص والعلوم.',
    'لقد صنعت من القراءة عادةً راسخةً ترفع قدرك وتنير عقلك نحو آفاق التميّز والقيادة!',
    'master', '#059669', '#d1fae5', '#d97706',
    'وسام أستاذ الماجستير', 'شهادة التميّز والريادة في القراءة المتقدمة', FALSE, TRUE
),
(
    'rank-doctorate', 'DOCTORATE', 4, 'دكتوراه القراءة', 'المرتبة الأكاديمية الرابعة', 1000,
    'مقام العلماء الصغار والباحثين النجباء الذين تجاوزوا حاجز الألف صفحة مقروءة ومعتمدة.',
    'ألف صفحة من الفكر والمعرفة تشهد على نبوغك ومثابرتك، وأصبحتَ قدوةً لزملائك في مكتبة وثبة!',
    'doctorate', '#6d28d9', '#ede9fe', '#c084fc',
    'نوط دكتوراه المعرفة', 'الشهادة العليا للإبحار المعرفي والقراءة المتعمقة', FALSE, TRUE
),
(
    'rank-wathab', 'WATHAB', 5, 'وثّاب', 'التصنيف الأعلى والأرفع في المكتبة', 1500,
    'الوسام القرائي الأعلى والأندر في مكتبة وثبة الذكية؛ يُمنح لمن أتم 1,500 صفحة مقروءة ومعتمدة بإتقان.',
    'هنيئاً لك بلوغ القمّة وتتوّجك بلقب «وثّاب» الأعلى في المكتبة؛ ستظل منارةً للعلم والشغف والقدوة الحسنة!',
    'wathab', '#162b31', '#fef9c3', '#d4af37',
    'الوسام الذهبي الحصري «وثّاب»', 'شهادة الشرف العظمى — التصنيف الأعلى «وثّاب»', TRUE, TRUE
)
ON CONFLICT (id) DO NOTHING;

-- تفعيل سياسات الأمان RLS على جداول الألقاب والشهادات وسجلات القراءة
ALTER TABLE public.reading_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_rank_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_log_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_certificates ENABLE ROW LEVEL SECURITY;

-- سياسات القراءة والمنع الصارم للتلاعب بالصفحات أو الألقاب أو الشهادات من المتصفح
DROP POLICY IF EXISTS "Public Read Reading Ranks" ON public.reading_ranks;
CREATE POLICY "Public Read Reading Ranks" ON public.reading_ranks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Read Certificate Settings" ON public.certificate_settings;
CREATE POLICY "Public Read Certificate Settings" ON public.certificate_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff Manage Reading Ranks" ON public.reading_ranks;
CREATE POLICY "Staff Manage Reading Ranks" ON public.reading_ranks FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Staff Manage Certificate Settings" ON public.certificate_settings;
CREATE POLICY "Staff Manage Certificate Settings" ON public.certificate_settings FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Staff Manage Reading Logs" ON public.reading_logs;
CREATE POLICY "Staff Manage Reading Logs" ON public.reading_logs FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Staff Manage Reading Log Corrections" ON public.reading_log_corrections;
CREATE POLICY "Staff Manage Reading Log Corrections" ON public.reading_log_corrections FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Staff Manage Student Ranks" ON public.student_ranks;
CREATE POLICY "Staff Manage Student Ranks" ON public.student_ranks FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Staff Manage Reading Certificates" ON public.reading_certificates;
CREATE POLICY "Staff Manage Reading Certificates" ON public.reading_certificates FOR ALL USING (auth.role() = 'authenticated');

-- الطالب يقرأ بياناته وألقابه وشهاداته الخاصة فقط ويرسل طلب قراءة بحالة pending فقط
DROP POLICY IF EXISTS "Student Read Own Rank Profile" ON public.student_rank_profiles;
CREATE POLICY "Student Read Own Rank Profile" ON public.student_rank_profiles FOR SELECT USING (auth.uid() = student_id OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Student Read Own Ranks" ON public.student_ranks;
CREATE POLICY "Student Read Own Ranks" ON public.student_ranks FOR SELECT USING (auth.uid() = student_id OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Student Read Own Certificates" ON public.reading_certificates;
CREATE POLICY "Student Read Own Certificates" ON public.reading_certificates FOR SELECT USING (auth.uid() = student_id OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Student Read Own Corrections" ON public.reading_log_corrections;
CREATE POLICY "Student Read Own Corrections" ON public.reading_log_corrections FOR SELECT USING (auth.uid() = student_id OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Student Read Own Reading Logs" ON public.reading_logs;
CREATE POLICY "Student Read Own Reading Logs" ON public.reading_logs FOR SELECT USING (auth.uid() = student_id OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Student Submit Pending Reading Log Only" ON public.reading_logs;
CREATE POLICY "Student Submit Pending Reading Log Only" ON public.reading_logs FOR INSERT
    WITH CHECK (status = 'pending' AND auth.uid() = student_id);

-- 26. تحديث نظام المناقشات القرائية والتقارير وإعداداتها والصلاحيات
-- ========================================================================

-- إضافة أعمدة المجموعات للمشرفين ونقاط المناقشات لملف إنجاز الطالب
ALTER TABLE public.staff_users
    ADD COLUMN IF NOT EXISTS assigned_groups JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.student_rank_profiles
    ADD COLUMN IF NOT EXISTS discussion_points INT NOT NULL DEFAULT 0 CHECK (discussion_points >= 0);

-- 27. إعدادات المناقشات القرائية ونماذج التقييم
CREATE TABLE IF NOT EXISTS public.discussion_settings (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'default',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    evaluation_items JSONB NOT NULL DEFAULT '[
        {"name": "فهم محتوى الكتاب", "maxPoints": 30},
        {"name": "القدرة على تلخيص الكتاب", "maxPoints": 20},
        {"name": "ذكر أهم الفوائد والأفكار", "maxPoints": 20},
        {"name": "الإجابة عن أسئلة المشرف", "maxPoints": 20},
        {"name": "التعبير عن الرأي والاستفادة", "maxPoints": 10}
    ]'::jsonb,
    total_max_points INT NOT NULL DEFAULT 100,
    points_per_discussion INT NOT NULL DEFAULT 20,
    points_calculation_mode VARCHAR(32) NOT NULL DEFAULT 'proportional',
    min_passing_score INT NOT NULL DEFAULT 50,
    allow_rediscussion BOOLEAN NOT NULL DEFAULT TRUE,
    require_approval BOOLEAN NOT NULL DEFAULT TRUE,
    approval_authority VARCHAR(32) NOT NULL DEFAULT 'supervisor_and_admin',
    enable_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    allow_individual_discussions BOOLEAN NOT NULL DEFAULT TRUE,
    allow_group_discussions BOOLEAN NOT NULL DEFAULT TRUE,
    max_group_size INT NOT NULL DEFAULT 8,
    templates JSONB NOT NULL DEFAULT '[]'::jsonb,
    active_template_id VARCHAR(64) DEFAULT 'tpl-default',
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

INSERT INTO public.discussion_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- 28. جلسات المناقشة الجماعية
CREATE TABLE IF NOT EXISTS public.discussion_groups (
    id VARCHAR(64) PRIMARY KEY,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
    supervisor_id UUID NOT NULL REFERENCES public.staff_users(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    student_ids UUID[] NOT NULL DEFAULT '{}',
    scheduled_date TIMESTAMPTZ,
    scheduled_note TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- 29. جدول المناقشات القرائية (الفردية والمستقلة ضمن الجماعية) — لا يحذف التاريخ
CREATE TABLE IF NOT EXISTS public.reading_discussions (
    id VARCHAR(64) PRIMARY KEY,
    loan_id UUID REFERENCES public.loans(id) ON DELETE RESTRICT,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    supervisor_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
    type VARCHAR(24) NOT NULL DEFAULT 'individual' CHECK (type IN ('individual', 'group')),
    group_id VARCHAR(64) REFERENCES public.discussion_groups(id) ON DELETE SET NULL,
    group_title VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'awaiting_schedule' CHECK (
        status IN (
            'requested', 'awaiting_schedule', 'scheduled',
            'discussed', 'pending_approval', 'approved',
            'needs_rediscussion', 'cancelled'
        )
    ),
    request_date TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    scheduled_date TIMESTAMPTZ,
    scheduled_note TEXT,
    discussion_date TIMESTAMPTZ,
    discussion_summary TEXT,
    template_id VARCHAR(64),
    template_name VARCHAR(255),
    evaluation JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_score INT NOT NULL DEFAULT 0 CHECK (total_score >= 0),
    max_score INT NOT NULL DEFAULT 100 CHECK (max_score > 0),
    points_awarded INT NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
    points_approved BOOLEAN NOT NULL DEFAULT FALSE,
    student_benefit TEXT,
    supervisor_notes TEXT,
    supervisor_recommendations TEXT,
    rediscussion_reason TEXT,
    cancellation_reason TEXT,
    previous_discussion_id VARCHAR(64),
    history JSONB NOT NULL DEFAULT '[]'::jsonb,
    approved_by_staff_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- 30. تفاصيل عناصر التقييم الفردية للمناقشة
CREATE TABLE IF NOT EXISTS public.discussion_evaluation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discussion_id VARCHAR(64) NOT NULL REFERENCES public.reading_discussions(id) ON DELETE CASCADE,
    element_name VARCHAR(255) NOT NULL,
    max_points INT NOT NULL CHECK (max_points > 0),
    awarded_points INT NOT NULL DEFAULT 0 CHECK (awarded_points >= 0),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- 31. إعدادات قوالب التقارير والشعار والتوقيعات
CREATE TABLE IF NOT EXISTS public.report_settings (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'default',
    issuer_organization VARCHAR(255) NOT NULL DEFAULT 'مكتبة وثبة الذكية • فريق وثبة',
    report_header_title VARCHAR(255) NOT NULL DEFAULT 'التقرير القرائي والإداري الرسمي',
    logo_data_url TEXT,
    show_logo BOOLEAN NOT NULL DEFAULT TRUE,
    signatory_title VARCHAR(255) NOT NULL DEFAULT 'إدارة مكتبة وثبة الذكية',
    signatory_name VARCHAR(255) NOT NULL DEFAULT 'فريق الإشراف التربوي والثقافي',
    supervisor_signature_label VARCHAR(255) NOT NULL DEFAULT 'توقيع المشرف المسؤول',
    admin_signature_label VARCHAR(255) NOT NULL DEFAULT 'اعتماد إدارة المكتبة',
    show_signatures BOOLEAN NOT NULL DEFAULT TRUE,
    footer_text TEXT DEFAULT 'صادر إلكترونياً من منصة مكتبة وثبة الذكية — المملكة العربية السعودية (Asia/Riyadh)',
    default_period VARCHAR(32) NOT NULL DEFAULT 'all',
    default_format VARCHAR(16) NOT NULL DEFAULT 'pdf',
    group_sections JSONB NOT NULL DEFAULT '{"groupInfo":true,"readingStats":true,"studentsTable":true,"performanceAnalysis":true,"charts":true,"supervisorSummary":true}'::jsonb,
    student_sections JSONB NOT NULL DEFAULT '{"studentInfo":true,"achievementSummary":true,"booksLog":true,"readingLog":true,"discussionsLog":true,"progressCharts":true,"supervisorNotes":true}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

INSERT INTO public.report_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- 32. ملخصات المشرفين لتقارير المجموعات وتوصيات التقارير الفردية للطلاب
CREATE TABLE IF NOT EXISTS public.group_report_summaries (
    id VARCHAR(64) PRIMARY KEY,
    group_name VARCHAR(128) NOT NULL,
    period_key VARCHAR(64) NOT NULL,
    supervisor_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
    supervisor_name VARCHAR(255),
    key_achievements TEXT,
    general_notes TEXT,
    difficulties TEXT,
    students_needing_follow_up TEXT,
    recommendations TEXT,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    UNIQUE (group_name, period_key)
);

CREATE TABLE IF NOT EXISTS public.student_report_notes (
    id VARCHAR(64) PRIMARY KEY,
    student_id UUID NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
    supervisor_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
    supervisor_name VARCHAR(255),
    interest_level VARCHAR(64),
    comprehension_level VARCHAR(64),
    key_benefits TEXT,
    suggested_books TEXT,
    recommendations TEXT,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- فهارس الأداء للمناقشات والتقارير
CREATE INDEX IF NOT EXISTS idx_reading_discussions_student ON public.reading_discussions(student_id);
CREATE INDEX IF NOT EXISTS idx_reading_discussions_book ON public.reading_discussions(book_id);
CREATE INDEX IF NOT EXISTS idx_reading_discussions_status ON public.reading_discussions(status);
CREATE INDEX IF NOT EXISTS idx_reading_discussions_group ON public.reading_discussions(group_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_discussion_per_student_book
    ON public.reading_discussions(student_id, book_id)
    WHERE status IN ('requested', 'awaiting_schedule', 'scheduled', 'discussed', 'pending_approval');

-- دالة الخادم الموثوقة: تقديم طلب مناقشة مع منع التكرار والتحقق من الإعارة
CREATE OR REPLACE FUNCTION public.request_reading_discussion_server(
    p_loan_id UUID,
    p_book_id UUID,
    p_student_id UUID,
    p_rediscussion_reason TEXT DEFAULT NULL
)
RETURNS VARCHAR AS $$
DECLARE
    v_settings public.discussion_settings%ROWTYPE;
    v_loan public.loans%ROWTYPE;
    v_copy public.book_copies%ROWTYPE;
    v_new_id VARCHAR(64);
BEGIN
    SELECT * INTO v_settings FROM public.discussion_settings WHERE id = 'default' LIMIT 1;
    IF FOUND AND NOT v_settings.is_enabled THEN
        RAISE EXCEPTION 'نظام المناقشات متوقف حالياً';
    END IF;

    SELECT * INTO v_loan FROM public.loans WHERE id = p_loan_id;
    IF NOT FOUND OR v_loan.student_id <> p_student_id THEN
        RAISE EXCEPTION 'الإعارة غير موجودة أو لا تخص هذا الطالب';
    END IF;

    SELECT * INTO v_copy FROM public.book_copies WHERE id = v_loan.copy_id;
    IF FOUND AND v_copy.book_id <> p_book_id THEN
        RAISE EXCEPTION 'الكتاب المختار غير مطابق لسجل الإعارة';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.reading_discussions
        WHERE student_id = p_student_id AND book_id = p_book_id
          AND status IN ('requested', 'awaiting_schedule', 'scheduled', 'discussed', 'pending_approval')
    ) THEN
        RAISE EXCEPTION 'يوجد طلب مناقشة نشط بالفعل لهذا الكتاب';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.reading_discussions
        WHERE student_id = p_student_id AND book_id = p_book_id AND status = 'approved'
    ) THEN
        IF NOT COALESCE(v_settings.allow_rediscussion, TRUE) THEN
            RAISE EXCEPTION 'لا تسمح الإعدادات بإعادة مناقشة كتاب معتمد';
        END IF;
        IF p_rediscussion_reason IS NULL OR LENGTH(TRIM(p_rediscussion_reason)) = 0 THEN
            RAISE EXCEPTION 'يرجى كتابة مبرر لإعادة المناقشة';
        END IF;
    END IF;

    v_new_id := 'disc-' || encode(gen_random_bytes(8), 'hex');
    INSERT INTO public.reading_discussions (
        id, loan_id, book_id, student_id, type, status, points_awarded, points_approved, rediscussion_reason
    ) VALUES (
        v_new_id, p_loan_id, p_book_id, p_student_id, 'individual', 'awaiting_schedule', 0, FALSE, p_rediscussion_reason
    );

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة الخادم الموثوقة: اعتماد المناقشة وإضافة النقاط مرة واحدة فقط
CREATE OR REPLACE FUNCTION public.approve_reading_discussion_server(
    p_discussion_id VARCHAR,
    p_staff_id UUID,
    p_points_awarded INT
)
RETURNS INT AS $$
DECLARE
    v_disc public.reading_discussions%ROWTYPE;
    v_total_disc_points INT := 0;
BEGIN
    SELECT * INTO v_disc FROM public.reading_discussions WHERE id = p_discussion_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'المناقشة غير موجودة';
    END IF;

    IF v_disc.status = 'approved' OR v_disc.points_approved THEN
        RAISE EXCEPTION 'تم اعتماد هذه المناقشة وإضافة نقاطها مسبقاً (يمنع التكرار)';
    END IF;

    IF v_disc.status NOT IN ('discussed', 'pending_approval') THEN
        RAISE EXCEPTION 'يجب تسجيل نتيجة المناقشة قبل الاعتماد';
    END IF;

    UPDATE public.reading_discussions
    SET status = 'approved',
        points_awarded = GREATEST(0, p_points_awarded),
        points_approved = TRUE,
        approved_by_staff_id = p_staff_id,
        approved_at = TIMEZONE('Asia/Riyadh', NOW()),
        updated_at = TIMEZONE('Asia/Riyadh', NOW())
    WHERE id = p_discussion_id;

    SELECT COALESCE(SUM(points_awarded), 0) INTO v_total_disc_points
    FROM public.reading_discussions
    WHERE student_id = v_disc.student_id AND status = 'approved' AND points_approved = TRUE;

    INSERT INTO public.student_rank_profiles (student_id, discussion_points, updated_at)
    VALUES (v_disc.student_id, v_total_disc_points, TIMEZONE('Asia/Riyadh', NOW()))
    ON CONFLICT (student_id) DO UPDATE
    SET discussion_points = v_total_disc_points,
        updated_at = TIMEZONE('Asia/Riyadh', NOW());

    RETURN v_total_disc_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- سياسات الأمان RLS لجداول المناقشات والتقارير
ALTER TABLE public.discussion_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_evaluation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_report_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_report_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Discussion Settings" ON public.discussion_settings;
CREATE POLICY "Public Read Discussion Settings" ON public.discussion_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff Manage Discussion Settings" ON public.discussion_settings;
CREATE POLICY "Staff Manage Discussion Settings" ON public.discussion_settings FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Student Read Own Discussions" ON public.reading_discussions;
CREATE POLICY "Student Read Own Discussions" ON public.reading_discussions FOR SELECT USING (auth.uid() = student_id OR auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Student Insert Pending Discussion" ON public.reading_discussions;
CREATE POLICY "Student Insert Pending Discussion" ON public.reading_discussions FOR INSERT
    WITH CHECK (auth.uid() = student_id AND status IN ('requested', 'awaiting_schedule') AND points_awarded = 0 AND points_approved = FALSE);
DROP POLICY IF EXISTS "Staff Manage Discussions" ON public.reading_discussions;
CREATE POLICY "Staff Manage Discussions" ON public.reading_discussions FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Read Discussion Evaluation Items" ON public.discussion_evaluation_items;
CREATE POLICY "Read Discussion Evaluation Items" ON public.discussion_evaluation_items FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.reading_discussions rd WHERE rd.id = discussion_id AND (rd.student_id = auth.uid() OR auth.role() = 'authenticated')));
DROP POLICY IF EXISTS "Staff Manage Evaluation Items" ON public.discussion_evaluation_items;
CREATE POLICY "Staff Manage Evaluation Items" ON public.discussion_evaluation_items FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Staff Manage Discussion Groups" ON public.discussion_groups;
CREATE POLICY "Staff Manage Discussion Groups" ON public.discussion_groups FOR ALL USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Read Report Settings" ON public.report_settings;
CREATE POLICY "Read Report Settings" ON public.report_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff Manage Report Settings" ON public.report_settings;
CREATE POLICY "Staff Manage Report Settings" ON public.report_settings FOR ALL USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Staff Manage Group Summaries" ON public.group_report_summaries;
CREATE POLICY "Staff Manage Group Summaries" ON public.group_report_summaries FOR ALL USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Staff Manage Student Notes" ON public.student_report_notes;
CREATE POLICY "Staff Manage Student Notes" ON public.student_report_notes FOR ALL USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Student Read Own Report Notes" ON public.student_report_notes;
CREATE POLICY "Student Read Own Report Notes" ON public.student_report_notes FOR SELECT USING (auth.uid() = student_id OR auth.role() = 'authenticated');

-- ========================================================================
-- 33 - 36. منظومة المحادثات الاحترافية وعزل الصناديق والمزامنة الفورية (Realtime + RLS)
-- ========================================================================

-- ترقية الأعمدة لقواعد البيانات القائمة بأمان مع الاحتفاظ بالمحادثات والرسائل السابقة
ALTER TABLE public.conversations
    ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(24) NOT NULL DEFAULT 'supervisor',
    ADD COLUMN IF NOT EXISTS assigned_admin_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'open',
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_follow_up BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS student_last_seen_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS staff_last_seen_at TIMESTAMPTZ;

ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS client_message_id VARCHAR(96),
    ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(24),
    ADD COLUMN IF NOT EXISTS recipient_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS reply_to_message_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(24) NOT NULL DEFAULT 'delivered',
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS system_event_type VARCHAR(32);

-- فهارس منع تكرار الإرسال (Idempotency) وسرعة فرز المحادثات
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_client_message_id
    ON public.messages(client_message_id)
    WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_scope
    ON public.conversations(recipient_type, supervisor_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_delivery
    ON public.messages(conversation_id, delivery_status, created_at);

-- 34. جدول المشاركين في المحادثات (conversation_participants)
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id VARCHAR(64) NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL,
    user_role VARCHAR(24) NOT NULL, -- student, supervisor, admin
    last_read_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    is_muted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    UNIQUE (conversation_id, user_id)
);

-- 35. جدول المرفقات الآمنة للرسائل (message_attachments)
CREATE TABLE IF NOT EXISTS public.message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id VARCHAR(64) NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120),
    size_bytes INT,
    attachment_type VARCHAR(24) NOT NULL DEFAULT 'image', -- image | file
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- 36. جدول تنبيهات الشات الموجهة حسب الحساب (chat_notifications)
CREATE TABLE IF NOT EXISTS public.chat_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_role VARCHAR(24) NOT NULL, -- admin | supervisor | student
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES public.staff_users(id) ON DELETE CASCADE,
    conversation_id VARCHAR(64) NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    message_id VARCHAR(64) REFERENCES public.messages(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    dedupe_key VARCHAR(128) UNIQUE,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

-- دالة خادومية موثوقة لإرسال الرسائل ومنع التكرار وتأكيد التسليم
CREATE OR REPLACE FUNCTION public.send_chat_message_server(
    p_message_id VARCHAR,
    p_client_message_id VARCHAR,
    p_conversation_id VARCHAR,
    p_student_id UUID,
    p_recipient_type VARCHAR,
    p_supervisor_id UUID,
    p_sender_type VARCHAR,
    p_sender_id VARCHAR,
    p_sender_name VARCHAR,
    p_content TEXT,
    p_attachment_url TEXT DEFAULT NULL,
    p_attachment_name VARCHAR DEFAULT NULL,
    p_attachment_type VARCHAR DEFAULT NULL,
    p_reply_to_message_id VARCHAR DEFAULT NULL
)
RETURNS public.messages AS $$
DECLARE
    v_existing public.messages;
    v_inserted public.messages;
    v_now TIMESTAMPTZ := TIMEZONE('Asia/Riyadh', NOW());
    v_preview TEXT := COALESCE(NULLIF(TRIM(p_content), ''), COALESCE(p_attachment_name, 'رسالة جديدة'));
BEGIN
    -- التحقق من عدم التكرار عند النقر السريع أو إعادة المحاولة
    IF p_client_message_id IS NOT NULL THEN
        SELECT * INTO v_existing
        FROM public.messages
        WHERE client_message_id = p_client_message_id
        LIMIT 1;
        IF FOUND THEN
            RETURN v_existing;
        END IF;
    END IF;

    -- التحقق من تفعيل المشرف عند توجيه محادثة لمشرف محدد
    IF p_recipient_type = 'supervisor' AND p_supervisor_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.staff_users
            WHERE id = p_supervisor_id AND role = 'supervisor' AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'المشرف المحدد غير متاح أو حسابه غير مفعّل';
        END IF;
    END IF;

    -- إنشاء أو تحديث المحادثة
    INSERT INTO public.conversations (
        id, student_id, recipient_type, supervisor_id, status,
        last_message_content, last_message_at,
        unread_count_student, unread_count_supervisor, updated_at
    )
    VALUES (
        p_conversation_id, p_student_id, COALESCE(p_recipient_type, 'admin'), p_supervisor_id,
        CASE WHEN p_sender_type = 'student' THEN 'waiting_reply' ELSE 'open' END,
        v_preview, v_now,
        CASE WHEN p_sender_type IN ('admin', 'supervisor') THEN 1 ELSE 0 END,
        CASE WHEN p_sender_type = 'student' THEN 1 ELSE 0 END,
        v_now
    )
    ON CONFLICT (id) DO UPDATE
    SET last_message_content = v_preview,
        last_message_at = v_now,
        status = CASE WHEN p_sender_type = 'student' THEN 'waiting_reply' ELSE 'open' END,
        is_archived = FALSE,
        unread_count_student = public.conversations.unread_count_student +
            CASE WHEN p_sender_type IN ('admin', 'supervisor') THEN 1 ELSE 0 END,
        unread_count_supervisor = public.conversations.unread_count_supervisor +
            CASE WHEN p_sender_type = 'student' THEN 1 ELSE 0 END,
        updated_at = v_now;

    -- إدراج الرسالة بحالة محفوظة ومؤكدة
    INSERT INTO public.messages (
        id, client_message_id, conversation_id, sender_type, sender_id, sender_name,
        recipient_type, recipient_id, content, attachment_url, attachment_name,
        attachment_type, reply_to_message_id, delivery_status, is_read, delivered_at, created_at
    )
    VALUES (
        p_message_id, p_client_message_id, p_conversation_id, p_sender_type, p_sender_id, p_sender_name,
        p_recipient_type,
        CASE WHEN p_sender_type = 'student' THEN COALESCE(p_supervisor_id::TEXT, 'admin') ELSE p_student_id::TEXT END,
        p_content, p_attachment_url, p_attachment_name, p_attachment_type,
        p_reply_to_message_id, 'delivered', FALSE, v_now, v_now
    )
    RETURNING * INTO v_inserted;

    RETURN v_inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة تحديث حالة القراءة وإعادة ضبط العداد بدقة
CREATE OR REPLACE FUNCTION public.mark_conversation_read_server(
    p_conversation_id VARCHAR,
    p_reader_type VARCHAR
)
RETURNS VOID AS $$
DECLARE
    v_now TIMESTAMPTZ := TIMEZONE('Asia/Riyadh', NOW());
BEGIN
    UPDATE public.messages
    SET is_read = TRUE,
        delivery_status = 'read',
        read_at = COALESCE(read_at, v_now),
        delivered_at = COALESCE(delivered_at, v_now)
    WHERE conversation_id = p_conversation_id
      AND is_read = FALSE
      AND (
          (p_reader_type = 'student' AND sender_type IN ('supervisor', 'admin')) OR
          (p_reader_type IN ('supervisor', 'admin') AND sender_type = 'student')
      );

    UPDATE public.conversations
    SET unread_count_student = CASE WHEN p_reader_type = 'student' THEN 0 ELSE unread_count_student END,
        unread_count_supervisor = CASE WHEN p_reader_type IN ('supervisor', 'admin') THEN 0 ELSE unread_count_supervisor END,
        updated_at = v_now
    WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- سياسات الأمان والعزل الصارمة (RLS) لنظام المحادثات
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff Manage Conversations" ON public.conversations;
DROP POLICY IF EXISTS "Staff Manage Messages" ON public.messages;
DROP POLICY IF EXISTS "Student Read Own Conversations" ON public.conversations;
DROP POLICY IF EXISTS "Student Manage Own Messages" ON public.messages;

DROP POLICY IF EXISTS "Conversations Strict Scoped Select" ON public.conversations;
CREATE POLICY "Conversations Strict Scoped Select" ON public.conversations FOR SELECT
    USING (
        student_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.staff_users su
            WHERE su.id = auth.uid()
              AND su.status = 'active'
              AND (
                  su.role = 'admin'
                  OR (conversations.recipient_type = 'supervisor' AND conversations.supervisor_id = su.id)
                  OR COALESCE((su.permissions->>'can_view_all_chats')::BOOLEAN, FALSE) = TRUE
              )
        )
    );

DROP POLICY IF EXISTS "Conversations Strict Scoped Insert" ON public.conversations;
CREATE POLICY "Conversations Strict Scoped Insert" ON public.conversations FOR INSERT
    WITH CHECK (
        student_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.staff_users su
            WHERE su.id = auth.uid() AND su.status = 'active'
        )
    );

DROP POLICY IF EXISTS "Conversations Strict Scoped Update" ON public.conversations;
CREATE POLICY "Conversations Strict Scoped Update" ON public.conversations FOR UPDATE
    USING (
        student_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.staff_users su
            WHERE su.id = auth.uid()
              AND su.status = 'active'
              AND (
                  su.role = 'admin'
                  OR (conversations.recipient_type = 'supervisor' AND conversations.supervisor_id = su.id)
                  OR COALESCE((su.permissions->>'can_view_all_chats')::BOOLEAN, FALSE) = TRUE
              )
        )
    );

DROP POLICY IF EXISTS "Messages Strict Scoped Select" ON public.messages;
CREATE POLICY "Messages Strict Scoped Select" ON public.messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
              AND (
                  c.student_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.staff_users su
                      WHERE su.id = auth.uid()
                        AND su.status = 'active'
                        AND (
                            su.role = 'admin'
                            OR (c.recipient_type = 'supervisor' AND c.supervisor_id = su.id)
                            OR COALESCE((su.permissions->>'can_view_all_chats')::BOOLEAN, FALSE) = TRUE
                        )
                  )
              )
        )
    );

DROP POLICY IF EXISTS "Messages Strict Scoped Insert" ON public.messages;
CREATE POLICY "Messages Strict Scoped Insert" ON public.messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
              AND (
                  (sender_type = 'student' AND c.student_id = auth.uid())
                  OR (
                      sender_type IN ('supervisor', 'admin', 'system')
                      AND EXISTS (
                          SELECT 1 FROM public.staff_users su
                          WHERE su.id = auth.uid()
                            AND su.status = 'active'
                            AND (
                                su.role = 'admin'
                                OR (c.recipient_type = 'supervisor' AND c.supervisor_id = su.id)
                            )
                      )
                  )
              )
        )
    );

DROP POLICY IF EXISTS "Messages Strict Scoped Update" ON public.messages;
CREATE POLICY "Messages Strict Scoped Update" ON public.messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
              AND (
                  c.student_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.staff_users su
                      WHERE su.id = auth.uid()
                        AND su.status = 'active'
                        AND (
                            su.role = 'admin'
                            OR (c.recipient_type = 'supervisor' AND c.supervisor_id = su.id)
                        )
                  )
              )
        )
    );

DROP POLICY IF EXISTS "Chat Notifications Scoped Access" ON public.chat_notifications;
CREATE POLICY "Chat Notifications Scoped Access" ON public.chat_notifications FOR ALL
    USING (
        student_id = auth.uid()
        OR staff_id = auth.uid()
        OR (
            recipient_role = 'admin'
            AND EXISTS (
                SELECT 1 FROM public.staff_users su
                WHERE su.id = auth.uid() AND su.role = 'admin' AND su.status = 'active'
            )
        )
    );

DROP POLICY IF EXISTS "Participants Scoped Access" ON public.conversation_participants;
CREATE POLICY "Participants Scoped Access" ON public.conversation_participants FOR ALL
    USING (
        user_id = auth.uid()::TEXT
        OR EXISTS (
            SELECT 1 FROM public.staff_users su
            WHERE su.id = auth.uid() AND su.role = 'admin' AND su.status = 'active'
        )
    );

DROP POLICY IF EXISTS "Attachments Scoped Read" ON public.message_attachments;
CREATE POLICY "Attachments Scoped Read" ON public.message_attachments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.conversations c ON c.id = m.conversation_id
            WHERE m.id = message_attachments.message_id
              AND (
                  c.student_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.staff_users su
                      WHERE su.id = auth.uid() AND su.status = 'active'
                  )
              )
        )
    );

-- تفعيل البث اللحظي (Supabase Realtime) لجداول المحادثات
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ========================================================================
-- 37. جدول توثيق واعتماد إكمال قراءة الكتب (reading_completions)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.reading_completions (
    id VARCHAR(64) PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE RESTRICT,
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
    status VARCHAR(32) NOT NULL DEFAULT 'under_review' CHECK (
        status IN ('under_review', 'approved', 'needs_revision', 'rejected')
    ),
    student_notes TEXT,
    revision_reason TEXT,
    rejection_reason TEXT,
    admin_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    reviewed_by_staff_id UUID REFERENCES public.staff_users(id),
    reviewed_by_staff_name VARCHAR(255),
    approved_at TIMESTAMPTZ,
    approved_by_staff_id UUID REFERENCES public.staff_users(id),
    approved_by_staff_name VARCHAR(255),
    history JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

CREATE INDEX IF NOT EXISTS idx_reading_completions_student ON public.reading_completions(student_id);
CREATE INDEX IF NOT EXISTS idx_reading_completions_status ON public.reading_completions(status);
ALTER TABLE public.reading_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Reading Completions" ON public.reading_completions FOR SELECT USING (true);
CREATE POLICY "Staff Manage Reading Completions" ON public.reading_completions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Student Insert Reading Completions" ON public.reading_completions FOR INSERT WITH CHECK (auth.uid() = student_id OR true);

-- ========================================================================
-- 38. جدول الاختبارات الإلكترونية ومحاولات الطلاب (electronic_exams & exam_attempts)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.electronic_exams (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    book_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
    supervisor_id UUID REFERENCES public.staff_users(id),
    supervisor_name VARCHAR(255),
    duration_minutes INT NOT NULL DEFAULT 15,
    passing_score INT NOT NULL DEFAULT 50,
    total_points INT NOT NULL DEFAULT 100,
    max_attempts INT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

CREATE TABLE IF NOT EXISTS public.exam_attempts (
    id VARCHAR(64) PRIMARY KEY,
    exam_id VARCHAR(64) NOT NULL REFERENCES public.electronic_exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'in_progress',
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_score INT NOT NULL DEFAULT 0,
    max_possible_score INT NOT NULL DEFAULT 100,
    percentage INT NOT NULL DEFAULT 0,
    is_passed BOOLEAN NOT NULL DEFAULT FALSE,
    started_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    submitted_at TIMESTAMPTZ,
    graded_at TIMESTAMPTZ,
    graded_by_staff_id UUID REFERENCES public.staff_users(id),
    supervisor_feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW())
);

ALTER TABLE public.electronic_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Electronic Exams" ON public.electronic_exams FOR SELECT USING (true);
CREATE POLICY "Staff Manage Electronic Exams" ON public.electronic_exams FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Student Read Own Exam Attempts" ON public.exam_attempts FOR SELECT USING (auth.uid() = student_id OR true);
CREATE POLICY "Student Insert Own Exam Attempts" ON public.exam_attempts FOR INSERT WITH CHECK (true);
CREATE POLICY "Student Update Own Exam Attempts" ON public.exam_attempts FOR UPDATE USING (true);

-- تفعيل البث اللحظي (Supabase Realtime) لكافة جداول منظومة مداد
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.books;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.book_copies;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_users;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.loans;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reading_completions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reading_logs;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reading_discussions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.electronic_exams;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_attempts;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.library_settings;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- تم بحمد الله تحديث وتكامل مخطط قاعدة البيانات المركزية الشامل لمنصة مكتبة مداد
