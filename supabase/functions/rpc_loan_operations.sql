-- ============================================================================
-- دوال ومعاملات الخادم المخزنة (RPC Functions) لعمليات الإعارة والاسترجاع الآمنة
-- ============================================================================

-- 1. دالة تسليم كتاب آمنة ومعاملة ذرية تمنع التعارض (Atomic Checkout)
CREATE OR REPLACE FUNCTION rpc_checkout_book(
    p_copy_id UUID,
    p_student_id UUID,
    p_supervisor_id UUID,
    p_notes TEXT DEFAULT NULL,
    p_condition_rating condition_rating DEFAULT 'good',
    p_condition_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_max_loans INT;
    v_loan_duration_days INT;
    v_active_loans_count INT;
    v_copy_status copy_status;
    v_due_date TIMESTAMP WITH TIME ZONE;
    v_loan_id UUID;
    v_report_id UUID;
    v_student_name VARCHAR(150);
    v_copy_code VARCHAR(80);
BEGIN
    -- قفل السجلات لمنع أي Race Condition متزامن
    SELECT status, copy_code INTO v_copy_status, v_copy_code 
    FROM book_copies WHERE id = p_copy_id FOR UPDATE;

    IF v_copy_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'النسخة المطلوبة غير موجودة في النظام');
    END IF;

    IF v_copy_status != 'available' AND v_copy_status != 'reserved' AND v_copy_status != 'in_preparation' THEN
        RETURN jsonb_build_object('success', false, 'error', 'النسخة غير متاحة للإعارة حالياً (حالتها: ' || v_copy_status || ')');
    END IF;

    -- التحقق من الطالب
    SELECT full_name INTO v_student_name FROM students WHERE id = p_student_id FOR UPDATE;
    IF v_student_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'الطالب غير موجود');
    END IF;

    -- قراءة إعدادات الإعارة
    SELECT max_loans_per_student, loan_duration_days 
    INTO v_max_loans, v_loan_duration_days 
    FROM library_settings LIMIT 1;

    v_max_loans := COALESCE(v_max_loans, 2);
    v_loan_duration_days := COALESCE(v_loan_duration_days, 7);

    -- فحص الحد الأقصى
    SELECT COUNT(*) INTO v_active_loans_count 
    FROM loans WHERE student_id = p_student_id AND status = 'active';

    IF v_active_loans_count >= v_max_loans THEN
        RETURN jsonb_build_object('success', false, 'error', 'تجاوز الطالب الحد الأقصى المسموح به للإعارة (' || v_max_loans || ' كتب)');
    END IF;

    -- حساب تاريخ الاستحقاق
    v_due_date := (NOW() AT TIME ZONE 'Asia/Riyadh') + (v_loan_duration_days || ' days')::INTERVAL;

    -- إنشاء الإعارة
    INSERT INTO loans (
        copy_id, student_id, supervisor_id, loan_date, due_date, status, notes
    ) VALUES (
        p_copy_id, p_student_id, p_supervisor_id, (NOW() AT TIME ZONE 'Asia/Riyadh'), v_due_date, 'active', p_notes
    ) RETURNING id INTO v_loan_id;

    -- تسجيل حدث الإعارة
    INSERT INTO loan_events (loan_id, event_type, staff_id, notes)
    VALUES (v_loan_id, 'checkout', p_supervisor_id, 'تم تسليم النسخة بنجاح للطالب: ' || v_student_name);

    -- توثيق حالة النسخة عند الاستلام
    INSERT INTO condition_reports (
        copy_id, loan_id, student_id, staff_id, stage, rating, details
    ) VALUES (
        p_copy_id, v_loan_id, p_student_id, p_supervisor_id, 'checkout', p_condition_rating, p_condition_notes
    ) RETURNING id INTO v_report_id;

    -- إذا كان هناك حجز مرتبط بنفس الطالب والكتاب يتم تحديثه لمكتمل
    UPDATE reservations 
    SET status = 'fulfilled' 
    WHERE student_id = p_student_id 
      AND (assigned_copy_id = p_copy_id OR book_id = (SELECT book_id FROM book_copies WHERE id = p_copy_id))
      AND status IN ('new_request', 'approved', 'preparing', 'ready_for_pickup');

    -- تسجيل في سجل العمليات والتدقيق
    INSERT INTO audit_logs (
        actor_id, actor_type, action, entity_type, entity_id, new_state, notes
    ) VALUES (
        p_supervisor_id, 'supervisor', 'checkout_book', 'loan', v_loan_id::text,
        jsonb_build_object('student_id', p_student_id, 'copy_id', p_copy_id, 'due_date', v_due_date),
        'تسليم نسخة ' || v_copy_code || ' للطالب ' || v_student_name
    );

    RETURN jsonb_build_object(
        'success', true,
        'loan_id', v_loan_id,
        'report_id', v_report_id,
        'due_date', v_due_date,
        'message', 'تمت عملية تسليم الكتاب بنجاح'
    );
END;
$$ LANGUAGE plpgsql;

-- 2. دالة استرجاع كتاب آمنة مع تقرير الفحص
CREATE OR REPLACE FUNCTION rpc_return_book(
    p_loan_id UUID,
    p_supervisor_id UUID,
    p_condition_rating condition_rating,
    p_condition_details TEXT,
    p_send_to_return_shelf BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    v_copy_id UUID;
    v_student_id UUID;
    v_loan_status loan_status;
    v_new_copy_status copy_status;
    v_report_id UUID;
BEGIN
    SELECT copy_id, student_id, status 
    INTO v_copy_id, v_student_id, v_loan_status
    FROM loans WHERE id = p_loan_id FOR UPDATE;

    IF v_loan_status IS NULL OR v_loan_status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'الإعارة غير نشطة أو تمت إعادتها مسبقاً');
    END IF;

    -- إغلاق سجل الإعارة
    UPDATE loans 
    SET status = 'returned',
        return_date = (NOW() AT TIME ZONE 'Asia/Riyadh'),
        returned_to_supervisor_id = p_supervisor_id
    WHERE id = p_loan_id;

    -- تحديد حالة النسخة بعد الفحص
    IF p_condition_rating = 'damaged' THEN
        v_new_copy_status := 'damaged';
    ELSIF p_condition_rating = 'lost' THEN
        v_new_copy_status := 'lost';
    ELSIF p_send_to_return_shelf THEN
        v_new_copy_status := 'under_inspection'; -- تذهب إلى رف الإرجاع حتى اعتماد المشرف
    ELSE
        v_new_copy_status := 'available';
    END IF;

    UPDATE book_copies 
    SET status = v_new_copy_status,
        condition = p_condition_rating,
        updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
    WHERE id = v_copy_id;

    -- توثيق تقرير الفحص
    INSERT INTO condition_reports (
        copy_id, loan_id, student_id, staff_id, stage, rating, details
    ) VALUES (
        v_copy_id, p_loan_id, v_student_id, p_supervisor_id, 'return', p_condition_rating, p_condition_details
    ) RETURNING id INTO v_report_id;

    -- تسجيل حدث الاسترجاع
    INSERT INTO loan_events (loan_id, event_type, staff_id, notes)
    VALUES (p_loan_id, 'return', p_supervisor_id, 'تم استرجاع النسخة وفحصها. النتيجة: ' || p_condition_rating);

    -- سجل التدقيق
    INSERT INTO audit_logs (
        actor_id, actor_type, action, entity_type, entity_id, notes
    ) VALUES (
        p_supervisor_id, 'supervisor', 'return_book', 'loan', p_loan_id::text,
        'استرجاع نسخة الكتاب وفحص حالتها: ' || p_condition_rating
    );

    RETURN jsonb_build_object(
        'success', true,
        'report_id', v_report_id,
        'copy_status', v_new_copy_status,
        'message', 'تم استرجاع الكتاب وتوثيق حالته بنجاح'
    );
END;
$$ LANGUAGE plpgsql;

-- 3. دالة تمديد الإعارة (Extend Loan)
CREATE OR REPLACE FUNCTION rpc_extend_loan(
    p_loan_id UUID,
    p_requested_by VARCHAR(50) DEFAULT 'student'
)
RETURNS JSONB AS $$
DECLARE
    v_max_renewals INT;
    v_renewal_duration INT;
    v_current_renewal INT;
    v_due_date TIMESTAMP WITH TIME ZONE;
    v_new_due_date TIMESTAMP WITH TIME ZONE;
    v_status loan_status;
BEGIN
    SELECT max_renewals, renewal_duration_days 
    INTO v_max_renewals, v_renewal_duration 
    FROM library_settings LIMIT 1;

    v_max_renewals := COALESCE(v_max_renewals, 1);
    v_renewal_duration := COALESCE(v_renewal_duration, 3);

    SELECT renewal_count, due_date, status 
    INTO v_current_renewal, v_due_date, v_status
    FROM loans WHERE id = p_loan_id FOR UPDATE;

    IF v_status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'لا يمكن تمديد إعارة غير نشطة');
    END IF;

    IF v_current_renewal >= v_max_renewals THEN
        RETURN jsonb_build_object('success', false, 'error', 'تم استنفاذ عدد مرات التمديد المسموح بها (' || v_max_renewals || ' مرة)');
    END IF;

    v_new_due_date := v_due_date + (v_renewal_duration || ' days')::INTERVAL;

    UPDATE loans
    SET renewal_count = renewal_count + 1,
        due_date = v_new_due_date
    WHERE id = p_loan_id;

    INSERT INTO loan_events (loan_id, event_type, notes)
    VALUES (p_loan_id, 'extend', 'تم تمديد الإعارة لمدة ' || v_renewal_duration || ' أيام إضافية بطلب من: ' || p_requested_by);

    RETURN jsonb_build_object(
        'success', true,
        'new_due_date', v_new_due_date,
        'message', 'تم تمديد موعد الإعادة بنجاح حتى ' || v_new_due_date
    );
END;
$$ LANGUAGE plpgsql;
