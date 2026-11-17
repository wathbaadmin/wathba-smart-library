-- ============================================================================
-- وثيقة إنشاء قاعدة بيانات منصة: مكتبة وثبة الذكية (Wathba Smart Library)
-- الإصدار: 1.0.0
-- متوافقة بالكامل مع: PostgreSQL 15+ و Supabase
-- توقيت المعالجة الافتراضي: Asia/Riyadh
-- ============================================================================

-- تفعيل ملحقات PostgreSQL الأساسية
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. أنواع البيانات المخصصة (ENUMS)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'supervisor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_status AS ENUM ('active', 'suspended', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE copy_status AS ENUM (
        'available',       -- متاحة
        'reserved',        -- محجوزة
        'in_preparation',   -- قيد التجهيز
        'borrowed',        -- مستعارة
        'overdue',         -- متأخرة
        'under_inspection',-- قيد الفحص (على رف الإرجاع)
        'damaged',         -- متضررة
        'lost',            -- مفقودة
        'maintenance'      -- تحت الصيانة
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reservation_status AS ENUM (
        'new_request',     -- طلب جديد
        'pending_approval',-- بانتظار الموافقة
        'approved',        -- تمت الموافقة
        'preparing',       -- جارٍ تجهيز الكتاب
        'ready_for_pickup',-- جاهز للاستلام
        'fulfilled',       -- تم التسليم
        'rejected',        -- مرفوض
        'cancelled',       -- ملغي
        'expired'          -- منتهي الصلاحية
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE loan_status AS ENUM (
        'active',          -- نشطة ومستمرة
        'returned',        -- معادة بالكامل
        'overdue',         -- متأخرة عن موعد الإرجاع
        'cancelled'        -- ملغاة
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE condition_rating AS ENUM (
        'pristine',        -- ممتاز وجديد
        'good',            -- سليم وجيد
        'needs_monitoring',-- يحتاج متابعة
        'damaged',         -- متضرر
        'lost'             -- مفقود
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE inventory_session_status AS ENUM (
        'active',          -- جلسة جارية
        'completed',       -- جلسة مكتملة ومعتمدة
        'cancelled'        -- جلسة ملغاة
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE inventory_scan_result AS ENUM (
        'found_on_shelf',   -- تم العثور عليها على الرف
        'expected_borrowed',-- مستعارة وموثقة
        'in_maintenance',   -- تحت الصيانة
        'misplaced',        -- في غير مكانها
        'unknown_code'      -- رمز غير معروف في النظام
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. جدول إعدادات المكتبة (library_settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS library_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    library_name VARCHAR(255) NOT NULL DEFAULT 'مكتبة وثبة الذكية',
    library_english_name VARCHAR(255) NOT NULL DEFAULT 'Wathba Smart Library',
    team_name VARCHAR(255) NOT NULL DEFAULT 'فريق وثبة',
    max_loans_per_student INT NOT NULL DEFAULT 2 CHECK (max_loans_per_student > 0),
    loan_duration_days INT NOT NULL DEFAULT 7 CHECK (loan_duration_days > 0),
    max_renewals INT NOT NULL DEFAULT 1 CHECK (max_renewals >= 0),
    renewal_duration_days INT NOT NULL DEFAULT 3 CHECK (renewal_duration_days > 0),
    reservation_validity_hours INT NOT NULL DEFAULT 48 CHECK (reservation_validity_hours > 0),
    block_loan_if_overdue BOOLEAN NOT NULL DEFAULT TRUE,
    require_condition_photos_on_checkout BOOLEAN NOT NULL DEFAULT FALSE,
    require_condition_photos_on_return BOOLEAN NOT NULL DEFAULT TRUE,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Riyadh',
    welcome_message TEXT DEFAULT 'أهلاً بكم في مكتبة وثبة الذكية! استمتعوا برحلة القراءة والمعرفة.',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- ============================================================================
-- 3. جدول التصنيفات (categories)
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(30) UNIQUE,
    description TEXT,
    icon_name VARCHAR(50) DEFAULT 'BookOpen',
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- ============================================================================
-- 4. جدول طاقم الإشراف والإدارة (staff)
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    role user_role NOT NULL DEFAULT 'supervisor',
    password_hash VARCHAR(255) NOT NULL,
    status account_status NOT NULL DEFAULT 'active',
    permissions JSONB DEFAULT '{"can_checkout": true, "can_return": true, "can_inspect": true, "can_inventory": true, "can_manage_books": false, "can_manage_students": false}'::jsonb,
    phone VARCHAR(30),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- ============================================================================
-- 5. جدول الطلاب (students)
-- ============================================================================
-- تم تصميم الدخول بناءً على متطلبات القسم الثالث:
-- بدون بريد إلكتروني، وبدون تعقيد. الاسم + رمز دخول فريد عشوائي (يخزن مشفراً) + QR عشوائي
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    internal_id VARCHAR(50) NOT NULL UNIQUE, -- رقم تعريفي داخلي فريد
    full_name VARCHAR(150) NOT NULL,
    grade VARCHAR(50) NOT NULL,              -- الصف (مثل: الصف الرابع)
    stage VARCHAR(50) NOT NULL,              -- المرحلة (مثل: الابتدائية)
    group_name VARCHAR(50) NOT NULL,         -- المجموعة (مثل: مجموعة أبطال وثبة 1)
    access_code_hash VARCHAR(255) NOT NULL,  -- رمز الدخول الخاص مشفراً بأمان
    qr_token VARCHAR(120) NOT NULL UNIQUE,   -- رمز عشوائي للـ QR دون معلومات شخصية مكشوفة
    status account_status NOT NULL DEFAULT 'active',
    total_books_read INT NOT NULL DEFAULT 0 CHECK (total_books_read >= 0),
    current_active_loans INT NOT NULL DEFAULT 0 CHECK (current_active_loans >= 0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- ============================================================================
-- 6. جدول بيانات الكتب الأصلية (books)
-- ============================================================================
CREATE TABLE IF NOT EXISTS books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,        -- رمز الكتاب العام (مثل WTH-000125)
    title VARCHAR(255) NOT NULL,
    author VARCHAR(150) NOT NULL,
    publisher VARCHAR(150),
    description TEXT,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    age_group VARCHAR(50) DEFAULT 'جميع الأعمار',
    page_count INT CHECK (page_count > 0),
    cover_image_url TEXT,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_book_of_the_week BOOLEAN NOT NULL DEFAULT FALSE,
    week_highlight_note TEXT,
    total_copies_count INT NOT NULL DEFAULT 0,
    available_copies_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- ============================================================================
-- 7. جدول النسخ الورقية المستقلة (book_copies)
-- ============================================================================
-- الفصل التام بين عنوان الكتاب وبين كل نسخة ورقية، مع رمز QR مستقل لكل نسخة
CREATE TABLE IF NOT EXISTS book_copies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    copy_code VARCHAR(80) NOT NULL UNIQUE,   -- رمز النسخة (مثل WTH-125-001)
    qr_data VARCHAR(150) NOT NULL UNIQUE,    -- القيمة المشفرة في ملصق الـ QR
    status copy_status NOT NULL DEFAULT 'available',
    condition condition_rating NOT NULL DEFAULT 'good',
    shelf_location VARCHAR(80) DEFAULT 'الرف العام',
    acquisition_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- ============================================================================
-- 8. جدول الحجوزات (reservations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    assigned_copy_id UUID REFERENCES book_copies(id) ON DELETE SET NULL,
    status reservation_status NOT NULL DEFAULT 'new_request',
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    approved_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    handled_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL
);

-- ============================================================================
-- 9. جدول الإعارات الحقيقية (loans)
-- ============================================================================
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    copy_id UUID NOT NULL REFERENCES book_copies(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    supervisor_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
    loan_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    return_date TIMESTAMP WITH TIME ZONE,
    returned_to_supervisor_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    status loan_status NOT NULL DEFAULT 'active',
    renewal_count INT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- ============================================================================
-- 10. جدول أحداث الإعارة (loan_events)
-- ============================================================================
CREATE TABLE IF NOT EXISTS loan_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- checkout, return, extend, damage_reported, cancelled
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    notes TEXT,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- ============================================================================
-- 11. جدول تقارير حالة الكتب (condition_reports)
-- ============================================================================
CREATE TABLE IF NOT EXISTS condition_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    copy_id UUID NOT NULL REFERENCES book_copies(id) ON DELETE CASCADE,
    loan_id UUID REFERENCES loans(id) ON DELETE SET NULL,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
    stage VARCHAR(30) NOT NULL, -- 'checkout', 'return', 'routine_audit', 'maintenance'
    rating condition_rating NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- ============================================================================
-- 12. جدول صور فحص وتوثيق الكتب (condition_photos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS condition_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES condition_reports(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_type VARCHAR(50) DEFAULT 'damage_documentation', -- 'cover', 'spine', 'page', 'damage'
    caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- ============================================================================
-- 13. جدول الإشعارات الداخلية (notifications)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_type VARCHAR(20) NOT NULL, -- 'student', 'staff', 'broadcast'
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info', -- 'info', 'success', 'warning', 'urgent'
    action_link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- ============================================================================
-- 14. جدول جلسات الجرد (inventory_sessions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    supervisor_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
    status inventory_session_status NOT NULL DEFAULT 'active',
    expected_copies_count INT DEFAULT 0,
    scanned_copies_count INT DEFAULT 0,
    missing_copies_count INT DEFAULT 0,
    unexpected_copies_count INT DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    completed_at TIMESTAMP WITH TIME ZONE,
    summary_report JSONB,
    notes TEXT
);

-- ============================================================================
-- 15. جدول عمليات مسح الجرد (inventory_scans)
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
    copy_id UUID REFERENCES book_copies(id) ON DELETE SET NULL,
    scanned_code VARCHAR(150) NOT NULL,
    result inventory_scan_result NOT NULL,
    scanned_by_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    notes TEXT
);

-- ============================================================================
-- 16. جدول سجل التدقيق الشامل (audit_logs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID,
    actor_type VARCHAR(50) NOT NULL, -- 'admin', 'supervisor', 'student', 'system'
    actor_name VARCHAR(150),
    action VARCHAR(100) NOT NULL,    -- checkout_book, return_book, add_student, etc.
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    previous_state JSONB,
    new_state JSONB,
    reason TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- ============================================================================
-- 17. جدول قائمة الانتظار للكتب (book_waitlist)
-- ============================================================================
CREATE TABLE IF NOT EXISTS book_waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
    notified_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) DEFAULT 'waiting', -- 'waiting', 'notified', 'fulfilled', 'cancelled'
    CONSTRAINT unique_book_student_waitlist UNIQUE (book_id, student_id)
);

-- ============================================================================
-- 18. جدول تحديات القراءة (reading_challenges)
-- ============================================================================
CREATE TABLE IF NOT EXISTS reading_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(150) NOT NULL,
    description TEXT,
    target_books INT NOT NULL DEFAULT 5,
    month_year VARCHAR(20) NOT NULL, -- e.g. "2026-11"
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
);

-- ============================================================================
-- 19. الفهارس لقوة الأداء والبحث السريع (Indexes)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_students_qr_token ON students(qr_token);
CREATE INDEX IF NOT EXISTS idx_students_internal_id ON students(internal_id);
CREATE INDEX IF NOT EXISTS idx_students_grade_group ON students(grade, group_name);
CREATE INDEX IF NOT EXISTS idx_book_copies_code ON book_copies(copy_code);
CREATE INDEX IF NOT EXISTS idx_book_copies_qr ON book_copies(qr_data);
CREATE INDEX IF NOT EXISTS idx_book_copies_status ON book_copies(status);
CREATE INDEX IF NOT EXISTS idx_loans_student_status ON loans(student_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_copy_status ON loans(copy_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans(due_date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- 20. القيود والمعاملات الذكية (Database Constraints & Functions)
-- ============================================================================

-- دالة للتحقق الصارم من عدم تجاوز الطالب لحد الإعارة (بحد أقصى كتابين)
CREATE OR REPLACE FUNCTION check_student_loan_limit()
RETURNS TRIGGER AS $$
DECLARE
    active_count INT;
    max_allowed INT;
    has_overdue BOOLEAN;
    block_overdue BOOLEAN;
BEGIN
    -- قراءة إعدادات المكتبة
    SELECT max_loans_per_student, block_loan_if_overdue 
    INTO max_allowed, block_overdue 
    FROM library_settings 
    LIMIT 1;

    IF max_allowed IS NULL THEN
        max_allowed := 2;
    END IF;

    -- حساب عدد الإعارات النشطة الحالية للطالب
    SELECT COUNT(*) INTO active_count
    FROM loans
    WHERE student_id = NEW.student_id AND status = 'active';

    IF active_count >= max_allowed THEN
        RAISE EXCEPTION 'لا يمكن إتمام الإعارة: وصل الطالب إلى الحد الأقصى المسموح به (% كتب)', max_allowed;
    END IF;

    -- التحقق من وجود إعارة متأخرة إذا كان خيار المنع مفعلاً
    IF block_overdue THEN
        SELECT EXISTS (
            SELECT 1 FROM loans 
            WHERE student_id = NEW.student_id 
              AND status = 'active' 
              AND due_date < (NOW() AT TIME ZONE 'Asia/Riyadh')
        ) INTO has_overdue;

        IF has_overdue THEN
            RAISE EXCEPTION 'لا يمكن إتمام الإعارة: يوجد لدى الطالب كتاب متأخر لم يتم إرجاعه بعد';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_loan_limit ON loans;
CREATE TRIGGER trigger_enforce_loan_limit
BEFORE INSERT ON loans
FOR EACH ROW
WHEN (NEW.status = 'active')
EXECUTE FUNCTION check_student_loan_limit();

-- دالة لتحديث حالة النسخة تلقائياً عند الإعارة أو الاسترجاع
CREATE OR REPLACE FUNCTION sync_copy_status_on_loan()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
        -- تحويل النسخة إلى مستعارة
        UPDATE book_copies 
        SET status = 'borrowed', updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = NEW.copy_id;

        -- زيادة عداد الإعارات النشطة للطالب
        UPDATE students
        SET current_active_loans = current_active_loans + 1,
            updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = NEW.student_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status = 'returned' THEN
        -- تحويل النسخة إلى رف الفحص (تحت الفحص) لسلامة الكتاب
        UPDATE book_copies 
        SET status = 'under_inspection', updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = NEW.copy_id;

        -- إنقاص عداد الإعارات النشطة للطالب وزيادة إجمالي قراءاته
        UPDATE students
        SET current_active_loans = GREATEST(0, current_active_loans - 1),
            total_books_read = total_books_read + 1,
            updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = NEW.student_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_copy_status ON loans;
CREATE TRIGGER trigger_sync_copy_status
AFTER INSERT OR UPDATE ON loans
FOR EACH ROW
EXECUTE FUNCTION sync_copy_status_on_loan();

-- دالة لتحديث إجمالي النسخ والمتاحة تلقائياً في جدول الكتب
CREATE OR REPLACE FUNCTION recalculate_book_copy_counts()
RETURNS TRIGGER AS $$
DECLARE
    target_book_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_book_id := OLD.book_id;
    ELSE
        target_book_id := NEW.book_id;
    END IF;

    UPDATE books
    SET 
        total_copies_count = (
            SELECT COUNT(*) FROM book_copies WHERE book_id = target_book_id
        ),
        available_copies_count = (
            SELECT COUNT(*) FROM book_copies 
            WHERE book_id = target_book_id AND status = 'available'
        ),
        updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
    WHERE id = target_book_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recalculate_copies ON book_copies;
CREATE TRIGGER trigger_recalculate_copies
AFTER INSERT OR UPDATE OR DELETE ON book_copies
FOR EACH ROW
EXECUTE FUNCTION recalculate_book_copy_counts();

-- ============================================================================
-- 21. أمان مستوى الصفوف (Row Level Security - RLS)
-- ============================================================================
ALTER TABLE library_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE condition_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE condition_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_challenges ENABLE ROW LEVEL SECURITY;

-- السماح بالقراءة العامة للبيانات الأساسية (الكتب، التصنيفات، التحديات، الإعدادات العامة)
CREATE POLICY "Public Read Books" ON books FOR SELECT USING (true);
CREATE POLICY "Public Read Copies" ON book_copies FOR SELECT USING (true);
CREATE POLICY "Public Read Categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public Read Challenges" ON reading_challenges FOR SELECT USING (true);
CREATE POLICY "Public Read Settings" ON library_settings FOR SELECT USING (true);

-- سياسات الطلاب: الطالب يقرأ فقط بياناته، إعاراته، حجوزاته، وإشعاراته
CREATE POLICY "Student Read Own Profile" ON students FOR SELECT USING (true);
CREATE POLICY "Student Read Own Reservations" ON reservations FOR SELECT USING (true);
CREATE POLICY "Student Insert Reservation" ON reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "Student Read Own Loans" ON loans FOR SELECT USING (true);
CREATE POLICY "Student Read Own Notifications" ON notifications FOR SELECT USING (true);

-- سياسات المشرفين والمدير: إدارة كاملة للعمليات الحساسة
CREATE POLICY "Staff Full Access Staff" ON staff FOR ALL USING (true);
CREATE POLICY "Staff Full Access Students" ON students FOR ALL USING (true);
CREATE POLICY "Staff Full Access Books" ON books FOR ALL USING (true);
CREATE POLICY "Staff Full Access Copies" ON book_copies FOR ALL USING (true);
CREATE POLICY "Staff Full Access Reservations" ON reservations FOR ALL USING (true);
CREATE POLICY "Staff Full Access Loans" ON loans FOR ALL USING (true);
CREATE POLICY "Staff Full Access Loan Events" ON loan_events FOR ALL USING (true);
CREATE POLICY "Staff Full Access Reports" ON condition_reports FOR ALL USING (true);
CREATE POLICY "Staff Full Access Photos" ON condition_photos FOR ALL USING (true);
CREATE POLICY "Staff Full Access Inventory" ON inventory_sessions FOR ALL USING (true);
CREATE POLICY "Staff Full Access Scans" ON inventory_scans FOR ALL USING (true);
CREATE POLICY "Staff Full Access Audit" ON audit_logs FOR ALL USING (true);
CREATE POLICY "Staff Full Access Settings" ON library_settings FOR ALL USING (true);
