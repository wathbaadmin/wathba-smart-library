-- ============================================================================
-- مكتبة وثبة الذكية - ترقية نظام دخول الطلاب والحماية الخادمية (PostgreSQL / Supabase)
-- يحافظ على الجداول القائمة ويضيف التجزئة الآمنة، حدود المحاولات، الجلسات، وعزل RLS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. ترقية جدول الطلاب (تخزين التجزئة الآمنة ومنع النص المكشوف وتأمين فرادة الكود)
ALTER TABLE IF EXISTS public.students
  ADD COLUMN IF NOT EXISTS access_code_hash text,
  ADD COLUMN IF NOT EXISTS access_code_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- ضمان فرادة كود الطالب (internal_id) مع مراعاة عدم حساسية الحالة للمقارنة
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_unique_code_upper
  ON public.students (UPPER(TRIM(internal_id)));

-- إزالة أي عمود أو قيمة نصية مكشوفة قديمة لرموز الدخول بعد تحويلها إلى bcrypt
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'raw_access_code'
  ) THEN
    UPDATE public.students
    SET access_code_hash = crypt(raw_access_code, gen_salt('bf', 10)),
        access_code_updated_at = COALESCE(access_code_updated_at, now()),
        raw_access_code = NULL
    WHERE raw_access_code IS NOT NULL
      AND (access_code_hash IS NULL OR access_code_hash NOT LIKE '$2%');
  END IF;
END $$;

-- 2. جدول تتبع محاولات الدخول الفاشلة (Rate Limiting & Brutes Protection)
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_key text NOT NULL UNIQUE,
  failed_count integer NOT NULL DEFAULT 0,
  first_failed_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. جدول الجلسات النشطة مع انتهاء تلقائي لعدم النشاط
CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token_hash text NOT NULL UNIQUE,
  actor_role text NOT NULL CHECK (actor_role IN ('student', 'supervisor', 'admin')),
  actor_id text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_actor ON public.auth_sessions (actor_role, actor_id);

-- 4. جدول سجل محاولات الدخول والأمان
CREATE TABLE IF NOT EXISTS public.auth_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_role text,
  actor_id text,
  student_code_attempted text,
  event_type text NOT NULL,
  success boolean NOT NULL,
  reason text,
  client_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. دالة خادمية آمنة للتحقق من دخول الطالب بكود الطالب ورمز الدخول فقط
CREATE OR REPLACE FUNCTION public.verify_student_login(
  p_student_code text,
  p_access_code text,
  p_client_key text DEFAULT 'web'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_norm_code text := UPPER(TRIM(COALESCE(p_student_code, '')));
  v_attempt public.auth_attempts%ROWTYPE;
  v_student public.students%ROWTYPE;
  v_session_token text;
  v_session_id uuid;
  v_now timestamptz := now();
  v_lock_seconds integer;
BEGIN
  IF v_norm_code = '' OR COALESCE(TRIM(p_access_code), '') = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'يرجى إدخال كود الطالب ورمز الدخول.'
    );
  END IF;

  -- أ. التحقق من التقييد المؤقت على الكود أو العميل
  SELECT * INTO v_attempt
  FROM public.auth_attempts
  WHERE attempt_key = 'stu:' || v_norm_code;

  IF FOUND AND v_attempt.locked_until IS NOT NULL AND v_attempt.locked_until > v_now THEN
    INSERT INTO public.auth_audit_logs (actor_role, student_code_attempted, event_type, success, reason, client_key)
    VALUES ('student', v_norm_code, 'LOGIN_RATE_LIMITED', false, 'تجاوز حد المحاولات الفاشلة', p_client_key);

    RETURN jsonb_build_object(
      'success', false,
      'rate_limited', true,
      'retry_after_seconds', CEIL(EXTRACT(EPOCH FROM (v_attempt.locked_until - v_now)))::integer,
      'error', 'تم تقييد محاولات الدخول مؤقتاً بسبب التكرار غير الصحيح. يرجى الانتظار قليلاً ثم المحاولة.'
    );
  END IF;

  -- ب. البحث عن الطالب بكوده الفريد
  SELECT * INTO v_student
  FROM public.students
  WHERE UPPER(TRIM(internal_id)) = v_norm_code
  LIMIT 1;

  -- ج. التحقق من التجزئة باستخدام crypt() دون كشف وجود الكود عند الفشل
  IF NOT FOUND
     OR v_student.access_code_hash IS NULL
     OR v_student.access_code_hash <> crypt(TRIM(p_access_code), v_student.access_code_hash) THEN

    v_lock_seconds := CASE
      WHEN COALESCE(v_attempt.failed_count, 0) + 1 >= 8 THEN 300
      WHEN COALESCE(v_attempt.failed_count, 0) + 1 >= 5 THEN 60
      ELSE 0
    END;

    INSERT INTO public.auth_attempts (attempt_key, failed_count, first_failed_at, locked_until, updated_at)
    VALUES (
      'stu:' || v_norm_code,
      1,
      v_now,
      CASE WHEN v_lock_seconds > 0 THEN v_now + make_interval(secs => v_lock_seconds) ELSE NULL END,
      v_now
    )
    ON CONFLICT (attempt_key) DO UPDATE SET
      failed_count = public.auth_attempts.failed_count + 1,
      locked_until = CASE
        WHEN public.auth_attempts.failed_count + 1 >= 8 THEN v_now + interval '300 seconds'
        WHEN public.auth_attempts.failed_count + 1 >= 5 THEN v_now + interval '60 seconds'
        ELSE NULL
      END,
      updated_at = v_now;

    INSERT INTO public.auth_audit_logs (actor_role, student_code_attempted, event_type, success, reason, client_key)
    VALUES ('student', v_norm_code, 'LOGIN_FAILED', false, 'بيانات دخول غير مطابقة', p_client_key);

    RETURN jsonb_build_object(
      'success', false,
      'error', 'بيانات الدخول غير صحيحة. يرجى التحقق من كود الطالب ورمز الدخول.'
    );
  END IF;

  -- د. التحقق من حالة الحساب بعد مطابقة التجزئة فقط
  IF v_student.status <> 'active' THEN
    INSERT INTO public.auth_audit_logs (actor_role, actor_id, student_code_attempted, event_type, success, reason, client_key)
    VALUES ('student', v_student.id, v_norm_code, 'LOGIN_BLOCKED_SUSPENDED', false, 'حساب الطالب موقوف أو مؤرشف', p_client_key);

    RETURN jsonb_build_object(
      'success', false,
      'error', 'هذا الحساب موقوف حالياً، يرجى مراجعة مشرف المكتبة.'
    );
  END IF;

  -- هـ. تصفير العداد وتوليد جلسة دخول موثقة
  DELETE FROM public.auth_attempts WHERE attempt_key = 'stu:' || v_norm_code;

  v_session_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.auth_sessions (session_token_hash, actor_role, actor_id, issued_at, last_activity_at, expires_at)
  VALUES (
    encode(digest(v_session_token, 'sha256'), 'hex'),
    'student',
    v_student.id,
    v_now,
    v_now,
    v_now + interval '12 hours'
  )
  RETURNING id INTO v_session_id;

  UPDATE public.students
  SET last_login_at = v_now,
      failed_login_attempts = 0,
      locked_until = NULL
  WHERE id = v_student.id;

  INSERT INTO public.auth_audit_logs (actor_role, actor_id, student_code_attempted, event_type, success, reason, client_key)
  VALUES ('student', v_student.id, v_norm_code, 'LOGIN_SUCCESS', true, 'تم التحقق بنجاح', p_client_key);

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'session_token', v_session_token,
    'student', jsonb_build_object(
      'id', v_student.id,
      'internalId', v_student.internal_id,
      'fullName', v_student.full_name,
      'grade', v_student.grade,
      'stage', v_student.stage,
      'groupName', v_student.group_name,
      'qrToken', v_student.qr_token,
      'status', v_student.status,
      'totalBooksRead', v_student.total_books_read,
      'currentActiveLoans', v_student.current_active_loans,
      'lastLoginAt', v_now
    )
  );
END;
$$;

-- 6. دالة إدارية لإصدار أو إعادة تعيين كود ورمز الطالب بتجزئة آمنة
CREATE OR REPLACE FUNCTION public.admin_set_student_credentials(
  p_staff_id text,
  p_student_id text,
  p_student_code text,
  p_plain_access_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_norm_code text := UPPER(TRIM(COALESCE(p_student_code, '')));
  v_staff_role text;
BEGIN
  SELECT role INTO v_staff_role FROM public.staff_users WHERE id = p_staff_id AND status = 'active';
  IF v_staff_role IS NULL OR v_staff_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح بتنفيذ هذه العملية.');
  END IF;

  IF v_norm_code = '' OR LENGTH(TRIM(COALESCE(p_plain_access_code, ''))) < 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'كود الطالب أو رمز الدخول غير صالح.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.students
    WHERE UPPER(TRIM(internal_id)) = v_norm_code AND id <> p_student_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'كود الطالب مستخدم بالفعل لطالب آخر.');
  END IF;

  UPDATE public.students
  SET internal_id = v_norm_code,
      access_code_hash = crypt(TRIM(p_plain_access_code), gen_salt('bf', 10)),
      access_code_updated_at = now()
  WHERE id = p_student_id;

  -- إنهاء أي جلسات نشطة سابقة للطالب عند إعادة تعيين الرمز
  UPDATE public.auth_sessions
  SET revoked_at = now()
  WHERE actor_role = 'student' AND actor_id = p_student_id AND revoked_at IS NULL;

  INSERT INTO public.auth_audit_logs (actor_role, actor_id, student_code_attempted, event_type, success, reason)
  VALUES (v_staff_role, p_staff_id, v_norm_code, 'CREDENTIALS_UPDATED', true, 'تحديث كود ورمز الطالب');

  RETURN jsonb_build_object('success', true, 'student_code', v_norm_code);
END;
$$;

-- 7. سياسات عزل الصفوف (Row Level Security) لمنع وصول الطالب إلى بيانات طالب آخر
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reading_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reading_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.auth_audit_logs ENABLE ROW LEVEL SECURITY;

-- لا تسمح بالوصول المباشر لجدول auth_attempts / auth_sessions من المتصفح (عبر دوال SECURITY DEFINER فقط)
REVOKE ALL ON public.auth_attempts FROM anon, authenticated;
REVOKE ALL ON public.auth_sessions FROM anon, authenticated;
REVOKE ALL ON public.auth_audit_logs FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_student_login(text, text, text) TO anon, authenticated;

-- ============================================================================
-- 8. ترقية نظام الدخول بالباركود (QR Code) والتحقق الخادمي وإدارة الإلغاء وإعادة الإصدار
-- ============================================================================
ALTER TABLE IF EXISTS public.students
  ADD COLUMN IF NOT EXISTS qr_token_hash text,
  ADD COLUMN IF NOT EXISTS qr_token_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS qr_login_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS qr_token_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS qr_token_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS qr_token_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_qr_token_hashes jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_unique_qr_token
  ON public.students (UPPER(TRIM(qr_token)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_unique_qr_token_hash
  ON public.students (qr_token_hash)
  WHERE qr_token_hash IS NOT NULL;

UPDATE public.students
SET qr_token_hash = encode(digest('wathba-qr-v1:' || UPPER(TRIM(qr_token)), 'sha256'), 'hex'),
    qr_token_issued_at = COALESCE(qr_token_issued_at, created_at, now())
WHERE qr_token IS NOT NULL
  AND (qr_token_hash IS NULL OR qr_token_hash = '');

-- دالة خادمية للتحقق من دخول الطالب بالباركود QR
CREATE OR REPLACE FUNCTION public.verify_student_qr_login(
  p_qr_token text,
  p_pin_code text DEFAULT NULL,
  p_require_pin boolean DEFAULT false,
  p_client_key text DEFAULT 'web'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_norm_token text := UPPER(TRIM(COALESCE(p_qr_token, '')));
  v_token_hash text;
  v_attempt_key text;
  v_attempt public.auth_attempts%ROWTYPE;
  v_student public.students%ROWTYPE;
  v_is_revoked_history boolean := false;
  v_session_token text;
  v_session_id uuid;
  v_now timestamptz := now();
  v_lock_seconds integer;
BEGIN
  IF v_norm_token = '' OR LENGTH(v_norm_token) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error_type', 'empty', 'error', 'لم يتم قراءة رمز باركود صالح.');
  END IF;

  v_token_hash := encode(digest('wathba-qr-v1:' || v_norm_token, 'sha256'), 'hex');
  v_attempt_key := 'qr:' || LEFT(v_token_hash, 12);

  SELECT * INTO v_attempt
  FROM public.auth_attempts
  WHERE attempt_key = v_attempt_key;

  IF FOUND AND v_attempt.locked_until IS NOT NULL AND v_attempt.locked_until > v_now THEN
    INSERT INTO public.auth_audit_logs (actor_role, student_code_attempted, event_type, success, reason, client_key)
    VALUES ('student', v_attempt_key, 'QR_LOGIN_RATE_LIMITED', false, 'تجاوز حد محاولات المسح', p_client_key);

    RETURN jsonb_build_object(
      'success', false,
      'error_type', 'rate_limited',
      'rate_limited', true,
      'retry_after_seconds', CEIL(EXTRACT(EPOCH FROM (v_attempt.locked_until - v_now)))::integer,
      'error', 'تم تقييد محاولات المسح مؤقتاً. يرجى المحاولة لاحقاً.'
    );
  END IF;

  -- فحص الرموز الملغاة سابقاً
  SELECT EXISTS (
    SELECT 1 FROM public.students
    WHERE revoked_qr_token_hashes @> jsonb_build_array(v_token_hash)
  ) INTO v_is_revoked_history;

  IF v_is_revoked_history THEN
    INSERT INTO public.auth_audit_logs (actor_role, student_code_attempted, event_type, success, reason, client_key)
    VALUES ('student', v_attempt_key, 'QR_LOGIN_REVOKED_REJECTED', false, 'محاولة دخول بباركود ملغى', p_client_key);

    RETURN jsonb_build_object(
      'success', false,
      'error_type', 'revoked',
      'error', 'هذا الباركود ملغى أو تم استبداله ببطاقة جديدة. يرجى استخدام البطاقة الحديثة أو الدخول اليدوي.'
    );
  END IF;

  SELECT * INTO v_student
  FROM public.students
  WHERE qr_token_hash = v_token_hash OR UPPER(TRIM(qr_token)) = v_norm_token
  LIMIT 1;

  IF NOT FOUND THEN
    v_lock_seconds := CASE
      WHEN COALESCE(v_attempt.failed_count, 0) + 1 >= 8 THEN 300
      WHEN COALESCE(v_attempt.failed_count, 0) + 1 >= 5 THEN 60
      ELSE 0
    END;

    INSERT INTO public.auth_attempts (attempt_key, failed_count, first_failed_at, locked_until, updated_at)
    VALUES (
      v_attempt_key, 1, v_now,
      CASE WHEN v_lock_seconds > 0 THEN v_now + make_interval(secs => v_lock_seconds) ELSE NULL END,
      v_now
    )
    ON CONFLICT (attempt_key) DO UPDATE SET
      failed_count = public.auth_attempts.failed_count + 1,
      locked_until = CASE
        WHEN public.auth_attempts.failed_count + 1 >= 8 THEN v_now + interval '300 seconds'
        WHEN public.auth_attempts.failed_count + 1 >= 5 THEN v_now + interval '60 seconds'
        ELSE NULL
      END,
      updated_at = v_now;

    INSERT INTO public.auth_audit_logs (actor_role, student_code_attempted, event_type, success, reason, client_key)
    VALUES ('student', v_attempt_key, 'QR_LOGIN_FAILED', false, 'باركود غير مسجل', p_client_key);

    RETURN jsonb_build_object(
      'success', false,
      'error_type', 'invalid',
      'error', 'رمز الباركود غير مسجل أو غير صالح للدخول.'
    );
  END IF;

  IF v_student.status <> 'active' THEN
    INSERT INTO public.auth_audit_logs (actor_role, actor_id, student_code_attempted, event_type, success, reason, client_key)
    VALUES ('student', v_student.id, v_student.internal_id, 'QR_LOGIN_BLOCKED_SUSPENDED', false, 'حساب الطالب موقوف', p_client_key);

    RETURN jsonb_build_object(
      'success', false,
      'error_type', 'suspended',
      'error', 'هذا الحساب موقوف حالياً، يرجى مراجعة إدارة المكتبة.'
    );
  END IF;

  IF v_student.qr_token_status = 'revoked' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_type', 'revoked',
      'error', 'تم إلغاء باركود الدخول لهذا الحساب. يرجى مراجعة المشرف لإصدار بطاقة جديدة.'
    );
  END IF;

  IF v_student.qr_login_enabled = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_type', 'disabled',
      'error', 'تم تعطيل الدخول بالباركود لهذا الطالب من قِبل الإدارة. يرجى استخدام الدخول اليدوي.'
    );
  END IF;

  -- تحقق إضافي برمز الدخول عند تفعيله
  IF p_require_pin THEN
    IF COALESCE(TRIM(p_pin_code), '') = '' THEN
      RETURN jsonb_build_object(
        'success', false,
        'requires_pin', true,
        'error_type', 'requires_pin',
        'student_code_hint', v_student.internal_id
      );
    END IF;
    IF v_student.access_code_hash IS NULL OR v_student.access_code_hash <> crypt(TRIM(p_pin_code), v_student.access_code_hash) THEN
      INSERT INTO public.auth_audit_logs (actor_role, actor_id, student_code_attempted, event_type, success, reason, client_key)
      VALUES ('student', v_student.id, v_student.internal_id, 'QR_LOGIN_INVALID_PIN', false, 'فشل التحقق الإضافي برمز الدخول', p_client_key);

      RETURN jsonb_build_object(
        'success', false,
        'requires_pin', true,
        'error_type', 'invalid_pin',
        'student_code_hint', v_student.internal_id,
        'error', 'رمز الدخول الإضافي غير صحيح.'
      );
    END IF;
  END IF;

  DELETE FROM public.auth_attempts WHERE attempt_key = v_attempt_key;

  v_session_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.auth_sessions (session_token_hash, actor_role, actor_id, issued_at, last_activity_at, expires_at)
  VALUES (
    encode(digest(v_session_token, 'sha256'), 'hex'),
    'student',
    v_student.id,
    v_now,
    v_now,
    v_now + interval '12 hours'
  )
  RETURNING id INTO v_session_id;

  UPDATE public.students
  SET last_login_at = v_now,
      failed_login_attempts = 0,
      locked_until = NULL
  WHERE id = v_student.id;

  INSERT INTO public.auth_audit_logs (actor_role, actor_id, student_code_attempted, event_type, success, reason, client_key)
  VALUES ('student', v_student.id, v_student.internal_id, 'QR_LOGIN_SUCCESS', true, 'دخول بالباركود بنجاح', p_client_key);

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'session_token', v_session_token,
    'student', jsonb_build_object(
      'id', v_student.id,
      'internalId', v_student.internal_id,
      'fullName', v_student.full_name,
      'grade', v_student.grade,
      'stage', v_student.stage,
      'groupName', v_student.group_name,
      'qrToken', v_student.qr_token,
      'qrTokenHash', v_student.qr_token_hash,
      'qrTokenStatus', v_student.qr_token_status,
      'qrLoginEnabled', v_student.qr_login_enabled,
      'qrTokenVersion', v_student.qr_token_version,
      'status', v_student.status,
      'totalBooksRead', v_student.total_books_read,
      'currentActiveLoans', v_student.current_active_loans,
      'lastLoginAt', v_now
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_student_qr_login(text, text, boolean, text) TO anon, authenticated;
