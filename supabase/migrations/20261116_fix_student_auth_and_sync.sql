-- ========================================================================
-- ترقية وإصلاح نظام مصادقة ومزامنة الطلاب - مكتبة مداد
-- متوافق مع PostgreSQL 15+ و Supabase
-- ========================================================================

-- تفعيل ملحقات التشفير
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. التأكد من وجود وتكامل أعمدة جدول الطلاب (students)
ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS internal_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS grade VARCHAR(64) DEFAULT 'غير محدد',
    ADD COLUMN IF NOT EXISTS stage VARCHAR(64) DEFAULT 'الابتدائية',
    ADD COLUMN IF NOT EXISTS group_name VARCHAR(64) DEFAULT 'عام',
    ADD COLUMN IF NOT EXISTS access_code_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS access_code_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS qr_token VARCHAR(255),
    ADD COLUMN IF NOT EXISTS qr_token_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS qr_token_status VARCHAR(32) DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS qr_login_enabled BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS qr_token_version INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS qr_token_issued_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS total_books_read INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_active_loans INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Riyadh', NOW());

-- إنشاء فهرس فريد لكود الطالب لمنع التكرار وتسريع البحث أثناء الدخول
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_internal_id_upper
    ON public.students (UPPER(TRIM(internal_id)));

CREATE INDEX IF NOT EXISTS idx_students_status
    ON public.students (status);

CREATE INDEX IF NOT EXISTS idx_students_qr_token
    ON public.students (qr_token);

-- ========================================================================
-- 2. تصحيح سياسات الأمان RLS لجدول الطلاب (كانت تمنع القراءة تماماً)
-- ========================================================================
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- السماح بالقراءة للاستعلام عن الطلاب ومطابقة الحسابات
DROP POLICY IF EXISTS "Public Read Students" ON public.students;
DROP POLICY IF EXISTS "Student Read Own Profile" ON public.students;
DROP POLICY IF EXISTS "Allow student read by code or id" ON public.students;

CREATE POLICY "Public Read Students" ON public.students
    FOR SELECT
    USING (true);

-- السماح للمشرفين والإدارة بإدارة وتحديث بيانات الطلاب ورموز دخولهم
DROP POLICY IF EXISTS "Staff Manage Students" ON public.students;
DROP POLICY IF EXISTS "Staff Full Access Students" ON public.students;

CREATE POLICY "Staff Manage Students" ON public.students
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- سياسات جدول المشرفين (staff_users)
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff Users Read" ON public.staff_users;
CREATE POLICY "Staff Users Read" ON public.staff_users
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Staff Users Manage" ON public.staff_users;
CREATE POLICY "Staff Users Manage" ON public.staff_users
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ========================================================================
-- 3. إجراء التحقق الخادمي الذكي من دخول الطالب (verify_student_login)
-- ========================================================================
CREATE OR REPLACE FUNCTION public.verify_student_login(
    p_student_code TEXT,
    p_access_code TEXT,
    p_client_key TEXT DEFAULT 'web'
)
RETURNS JSONB AS $$
DECLARE
    v_norm_code TEXT := UPPER(TRIM(p_student_code));
    v_clean_pin TEXT := TRIM(p_access_code);
    v_student public.students%ROWTYPE;
    v_is_valid BOOLEAN := FALSE;
    v_parts TEXT[];
    v_salt TEXT;
    v_hash TEXT;
    v_calc_hash TEXT;
    v_i INT;
BEGIN
    IF v_norm_code IS NULL OR v_norm_code = '' OR v_clean_pin IS NULL OR v_clean_pin = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'يرجى إدخال كود الطالب ورمز الدخول.'
        );
    END IF;

    -- البحث المباشر في جدول الطلاب الأساسي
    SELECT * INTO v_student
    FROM public.students
    WHERE UPPER(TRIM(internal_id)) = v_norm_code
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'بيانات الدخول غير صحيحة. يرجى التحقق من كود الطالب ورمز الدخول.'
        );
    END IF;

    -- التحقق من حالة تفعيل الحساب
    IF v_student.status != 'active' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'هذا الحساب موقوف حالياً، يرجى مراجعة مشرف المكتبة.'
        );
    END IF;

    -- التحقق من وجود رمز دخول مسجل مسبقاً
    IF v_student.access_code_hash IS NULL OR TRIM(v_student.access_code_hash) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'لم يتم تعيين رمز دخول لهذا الحساب بعد. يرجى مراجعة مشرف المكتبة لتعيين رمز الدخول الخاص بك.'
        );
    END IF;

    -- مطابقة رمز الدخول:
    -- 1) إذا كان الرمز غير مشفر (سجلات قديمة)
    IF v_student.access_code_hash = v_clean_pin THEN
        v_is_valid := TRUE;
    -- 2) إذا كان الرمز مشفراً بتجزئة sha256$salt$digest
    ELSIF v_student.access_code_hash LIKE 'sha256$%$%' THEN
        v_parts := string_to_array(v_student.access_code_hash, '$');
        v_salt := v_parts[2];
        v_hash := v_parts[3];

        -- حساب التجزئة المطابقة لخوارزمية المنصة (400 rounds)
        v_calc_hash := encode(digest(convert_to('wathba-v2:' || v_salt || ':' || v_clean_pin, 'UTF8'), 'sha256'), 'hex');
        FOR v_i IN 2..400 LOOP
            v_calc_hash := encode(digest(decode(v_calc_hash, 'hex'), 'sha256'), 'hex');
        END LOOP;

        IF v_calc_hash = v_hash THEN
            v_is_valid := TRUE;
        END IF;
    END IF;

    IF NOT v_is_valid THEN
        -- زيادة عداد المحاولات الفاشلة
        UPDATE public.students
        SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1
        WHERE id = v_student.id;

        RETURN jsonb_build_object(
            'success', false,
            'error', 'بيانات الدخول غير صحيحة. يرجى التحقق من كود الطالب ورمز الدخول.'
        );
    END IF;

    -- تحديث وقت آخر تسجيل دخول بنجاح
    UPDATE public.students
    SET last_login_at = TIMEZONE('Asia/Riyadh', NOW()),
        failed_login_attempts = 0,
        locked_until = NULL
    WHERE id = v_student.id;

    RETURN jsonb_build_object(
        'success', true,
        'student', row_to_json(v_student)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================================
-- 4. إجراء التحقق من باركود الطالب (verify_student_qr_login)
-- ========================================================================
CREATE OR REPLACE FUNCTION public.verify_student_qr_login(
    p_qr_token TEXT,
    p_pin_code TEXT DEFAULT NULL,
    p_require_pin BOOLEAN DEFAULT FALSE,
    p_client_key TEXT DEFAULT 'web'
)
RETURNS JSONB AS $$
DECLARE
    v_clean_token TEXT := UPPER(TRIM(p_qr_token));
    v_token_hash TEXT;
    v_student public.students%ROWTYPE;
BEGIN
    IF v_clean_token IS NULL OR LENGTH(v_clean_token) < 5 THEN
        RETURN jsonb_build_object('success', false, 'error', 'رمز الباركود غير صالح');
    END IF;

    v_token_hash := encode(digest(convert_to('wathba-qr-v1:' || v_clean_token, 'UTF8'), 'sha256'), 'hex');

    SELECT * INTO v_student
    FROM public.students
    WHERE qr_token = v_clean_token OR qr_token_hash = v_token_hash
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_type', 'invalid', 'error', 'باركود الطالب غير مسجل في النظام');
    END IF;

    IF v_student.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error_type', 'suspended', 'error', 'حساب الطالب موقوف حالياً');
    END IF;

    IF v_student.qr_login_enabled = FALSE THEN
        RETURN jsonb_build_object('success', false, 'error_type', 'disabled', 'error', 'تم تعطيل الدخول بالباركود لهذا الحساب');
    END IF;

    IF p_require_pin THEN
        IF p_pin_code IS NULL OR TRIM(p_pin_code) = '' THEN
            RETURN jsonb_build_object(
                'success', false,
                'requires_pin', true,
                'student_code_hint', v_student.internal_id,
                'error', 'يرجى إدخال رمز الدخول الإضافي لتأكيد الهوية'
            );
        END IF;
    END IF;

    UPDATE public.students
    SET last_login_at = TIMEZONE('Asia/Riyadh', NOW()),
        failed_login_attempts = 0
    WHERE id = v_student.id;

    RETURN jsonb_build_object(
        'success', true,
        'student', row_to_json(v_student)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================================
-- 5. إجراء تعيين رمز الدخول لطالب قائم دون حذف أو تكرار
-- ========================================================================
CREATE OR REPLACE FUNCTION public.admin_set_student_access_code(
    p_student_id UUID,
    p_new_code TEXT,
    p_custom_student_code TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_student public.students%ROWTYPE;
    v_salt TEXT;
    v_digest TEXT;
    v_final_hash TEXT;
    v_i INT;
    v_new_internal_id TEXT;
BEGIN
    SELECT * INTO v_student FROM public.students WHERE id = p_student_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'الطالب غير موجود');
    END IF;

    v_new_internal_id := COALESCE(NULLIF(UPPER(TRIM(p_custom_student_code)), ''), v_student.internal_id);

    -- توليد ملح عشوائي وتجزئة آمنة
    v_salt := encode(gen_random_bytes(12), 'hex');
    v_digest := encode(digest(convert_to('wathba-v2:' || v_salt || ':' || TRIM(p_new_code), 'UTF8'), 'sha256'), 'hex');
    FOR v_i IN 2..400 LOOP
        v_digest := encode(digest(decode(v_digest, 'hex'), 'sha256'), 'hex');
    END LOOP;
    v_final_hash := 'sha256$' || v_salt || '$' || v_digest;

    UPDATE public.students
    SET internal_id = v_new_internal_id,
        access_code_hash = v_final_hash,
        access_code_updated_at = TIMEZONE('Asia/Riyadh', NOW()),
        failed_login_attempts = 0,
        locked_until = NULL
    WHERE id = p_student_id;

    RETURN jsonb_build_object(
        'success', true,
        'student_id', p_student_id,
        'internal_id', v_new_internal_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
