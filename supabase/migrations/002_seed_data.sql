-- ============================================================================
-- بذور البيانات الأساسية المبدئية: مكتبة وثبة الذكية
-- Seed Data for Wathba Smart Library
-- ============================================================================

-- 1. إعدادات المكتبة الافتراضية
INSERT INTO library_settings (
    library_name,
    library_english_name,
    team_name,
    max_loans_per_student,
    loan_duration_days,
    max_renewals,
    renewal_duration_days,
    reservation_validity_hours,
    block_loan_if_overdue,
    require_condition_photos_on_checkout,
    require_condition_photos_on_return,
    timezone,
    welcome_message
) VALUES (
    'مكتبة وثبة الذكية',
    'Wathba Smart Library',
    'فريق وثبة',
    2,
    7,
    1,
    3,
    48,
    TRUE,
    FALSE,
    TRUE,
    'Asia/Riyadh',
    'مرحباً بكم في مكتبة وثبة الذكية، حيث تصنع القراءة قادة المستقبل!'
) ON CONFLICT DO NOTHING;

-- 2. التصنيفات الافتراضية المعتمدة
INSERT INTO categories (name, code, description, icon_name, display_order) VALUES
('قصص إسلامية', 'CAT-ISLAMIC', 'قصص وعبر من التاريخ والتراث الإسلامي العريق', 'Moon', 1),
('السيرة النبوية', 'CAT-SEERAH', 'محطات مشرقة من حياة خير البرية صلى الله عليه وسلم', 'HeartHandshake', 2),
('قصص الأنبياء', 'CAT-PROPHETS', 'قصص الأنبياء والمرسلين والدروس والعبر المستفادة', 'Compass', 3),
('القيم والأخلاق', 'CAT-VALUES', 'غرس الفضائل والصدق والأمانة والتعاون وبر الوالدين', 'Sparkles', 4),
('الثقافة والمعرفة', 'CAT-CULTURE', 'موسوعات ومعلومات عامة تثري ثقافة الطالب وتوسع مداركه', 'Globe', 5),
('العلوم والاكتشاف', 'CAT-SCIENCE', 'عالم التجارب، الفضاء، الطبيعة، والاختراعات الممتعة', 'Atom', 6),
('تنمية المهارات', 'CAT-SKILLS', 'التفكير الإبداعي، القيادة، الإلقاء وحل المشكلات', 'Lightbulb', 7),
('قصص الأطفال', 'CAT-KIDS', 'حكايات شيقة ومصورة مناسبة للأعمار المبكرة', 'Smile', 8),
('كتب متنوعة', 'CAT-GENERAL', 'مجموعة مختارة ومميزة في شتى مجالات القراءة والاطلاع', 'Library', 9)
ON CONFLICT (name) DO NOTHING;

-- 3. حساب المدير العام والمشرف الافتراضي
-- كلمة المرور الافتراضية للمدير: admin123
-- كلمة المرور الافتراضية للمشرف: supervisor123
INSERT INTO staff (username, full_name, role, password_hash, status, permissions) VALUES
('admin', 'أ. عبدالله التميمي (المدير العام)', 'admin', 'admin123', 'active', '{"can_checkout": true, "can_return": true, "can_inspect": true, "can_inventory": true, "can_manage_books": true, "can_manage_students": true, "can_manage_settings": true}'::jsonb),
('supervisor1', 'أ. إبراهيم الخالد (مشرف المكتبة)', 'supervisor', 'supervisor123', 'active', '{"can_checkout": true, "can_return": true, "can_inspect": true, "can_inventory": true, "can_manage_books": false, "can_manage_students": true, "can_manage_settings": false}'::jsonb)
ON CONFLICT (username) DO NOTHING;

-- 4. إدراج طلاب مبدئيين (طلاب المرحلة الابتدائية بفريق وثبة)
-- رموز الدخول لا تكون مكشوفة ومعرف QR هو توكن عشوائي
INSERT INTO students (internal_id, full_name, grade, stage, group_name, access_code_hash, qr_token, status, total_books_read) VALUES
('STU-1001', 'عمر أحمد الصالح', 'الصف الرابع', 'الابتدائية', 'فرسان وثبة', '1001', 'STU-QR-a9f82d41b5', 'active', 4),
('STU-1002', 'سلمان فهد الشمري', 'الصف الخامس', 'الابتدائية', 'فرسان وثبة', '1002', 'STU-QR-c7e12f68d3', 'active', 7),
('STU-1003', 'عبدالرحمن خالد العتيبي', 'الصف الرابع', 'الابتدائية', 'رواد المعرفة', '1003', 'STU-QR-e5b38a90f1', 'active', 2),
('STU-1004', 'زياد محمد الغامدي', 'الصف السادس', 'الابتدائية', 'رواد المعرفة', '1004', 'STU-QR-71c429df83', 'active', 5),
('STU-1005', 'فيصل نايف القحطاني', 'الصف الثالث', 'الابتدائية', 'أشبال وثبة', '1005', 'STU-QR-98ab42f10d', 'active', 1)
ON CONFLICT (internal_id) DO NOTHING;

-- 5. كتب مبدئية ونسخها الورقية وفق شروط المشروع
-- مثال: قصص الأنبياء (رمز WTH-000125) مع 5 نسخ: WTH-125-001 إلى WTH-125-005
DO $$
DECLARE
    cat_prophets UUID;
    cat_seerah UUID;
    cat_science UUID;
    cat_values UUID;
    book1_id UUID;
    book2_id UUID;
    book3_id UUID;
    book4_id UUID;
BEGIN
    SELECT id INTO cat_prophets FROM categories WHERE code = 'CAT-PROPHETS' LIMIT 1;
    SELECT id INTO cat_seerah FROM categories WHERE code = 'CAT-SEERAH' LIMIT 1;
    SELECT id INTO cat_science FROM categories WHERE code = 'CAT-SCIENCE' LIMIT 1;
    SELECT id INTO cat_values FROM categories WHERE code = 'CAT-VALUES' LIMIT 1;

    -- الكتاب 1: قصص الأنبياء
    INSERT INTO books (code, title, author, publisher, description, category_id, age_group, page_count, cover_image_url, is_featured, is_book_of_the_week, week_highlight_note)
    VALUES (
        'WTH-000125',
        'قصص الأنبياء للأشبال والناشئة',
        'د. طارق السويدان',
        'دار الإبداع الفكري',
        'سلسلة مشوقة تصحب القارئ الصغير في رحاب قصص الأنبياء بدءاً من آدم عليه السلام وحتى خاتم النبيين مع رسوم توضيحية وقيم نبيلة.',
        cat_prophets,
        '9 - 13 سنة',
        160,
        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
        TRUE,
        TRUE,
        'كتاب هذا الأسبوع المختار لغرس العبر والصبر واليقين في نفوس أشبال وثبة'
    ) RETURNING id INTO book1_id;

    -- 5 نسخ للكتاب 1
    INSERT INTO book_copies (book_id, copy_code, qr_data, status, condition, shelf_location) VALUES
    (book1_id, 'WTH-125-001', 'WTH-COPY-125-001-QR8841', 'available', 'pristine', 'رف أ-1'),
    (book1_id, 'WTH-125-002', 'WTH-COPY-125-002-QR8842', 'available', 'good', 'رف أ-1'),
    (book1_id, 'WTH-125-003', 'WTH-COPY-125-003-QR8843', 'available', 'good', 'رف أ-1'),
    (book1_id, 'WTH-125-004', 'WTH-COPY-125-004-QR8844', 'available', 'good', 'رف أ-1'),
    (book1_id, 'WTH-125-005', 'WTH-COPY-125-005-QR8845', 'available', 'pristine', 'رف أ-1')
    ON CONFLICT (copy_code) DO NOTHING;

    -- الكتاب 2: روائع السيرة النبوية العطرة
    INSERT INTO books (code, title, author, publisher, description, category_id, age_group, page_count, cover_image_url, is_featured)
    VALUES (
        'WTH-000126',
        'روائع السيرة النبوية العطرة للأطفال',
        'أحمد مصطفى فكري',
        'دار الهدى',
        'سيرة النبي محمد صلى الله عليه وسلم بأسلوب سلس يلامس قلوب الفتيان، يوضح مواقفه مع الصغار والرحمة والشجاعة.',
        cat_seerah,
        '8 - 12 سنة',
        128,
        'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&auto=format&fit=crop&q=80',
        TRUE
    ) RETURNING id INTO book2_id;

    INSERT INTO book_copies (book_id, copy_code, qr_data, status, condition, shelf_location) VALUES
    (book2_id, 'WTH-126-001', 'WTH-COPY-126-001-QR7711', 'available', 'good', 'رف ب-2'),
    (book2_id, 'WTH-126-002', 'WTH-COPY-126-002-QR7712', 'available', 'good', 'رف ب-2'),
    (book2_id, 'WTH-126-003', 'WTH-COPY-126-003-QR7713', 'available', 'pristine', 'رف ب-2')
    ON CONFLICT (copy_code) DO NOTHING;

    -- الكتاب 3: موسوعة العلوم العجيبة والتجارب
    INSERT INTO books (code, title, author, publisher, description, category_id, age_group, page_count, cover_image_url, is_featured)
    VALUES (
        'WTH-000127',
        'موسوعة العلوم العجيبة وتجارب المستكشفين',
        'د. سارة المنصور',
        'المعرفة الحديثة',
        'دليل تفاعلي للناشئة للتعرف على أسرار الأرض والفضاء والطاقة، مع تجارب يمكن تطبيقها بأمان.',
        cat_science,
        '10 - 15 سنة',
        180,
        'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=600&auto=format&fit=crop&q=80',
        TRUE
    ) RETURNING id INTO book3_id;

    INSERT INTO book_copies (book_id, copy_code, qr_data, status, condition, shelf_location) VALUES
    (book3_id, 'WTH-127-001', 'WTH-COPY-127-001-QR6621', 'available', 'good', 'رف ج-1'),
    (book3_id, 'WTH-127-002', 'WTH-COPY-127-002-QR6622', 'available', 'good', 'رف ج-1')
    ON CONFLICT (copy_code) DO NOTHING;

    -- الكتاب 4: أخلاق القائد الصغير
    INSERT INTO books (code, title, author, publisher, description, category_id, age_group, page_count, cover_image_url, is_featured)
    VALUES (
        'WTH-000128',
        'أخلاق القائد الصغير: قيم تصنع النجاح',
        'عبدالعزيز الراجحي',
        'دار وثبة للنشر التربوي',
        'قصص تفاعلية تعلم الطالب كيف يكون أميناً، صادقاً، متعاوناً مع فريقه، ومتحملاً للمسؤولية.',
        cat_values,
        '7 - 12 سنة',
        96,
        'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=600&auto=format&fit=crop&q=80',
        FALSE
    ) RETURNING id INTO book4_id;

    INSERT INTO book_copies (book_id, copy_code, qr_data, status, condition, shelf_location) VALUES
    (book4_id, 'WTH-128-001', 'WTH-COPY-128-001-QR5531', 'available', 'good', 'رف د-3'),
    (book4_id, 'WTH-128-002', 'WTH-COPY-128-002-QR5532', 'available', 'pristine', 'رف د-3')
    ON CONFLICT (copy_code) DO NOTHING;
END $$;

-- 6. إضافة تحدي قراء وثبة الشهري
INSERT INTO reading_challenges (title, description, target_books, month_year, is_active)
VALUES (
    'تحدي فرسان وثبة للقراءة (نوفمبر 2026)',
    'اقرأ 5 كتب خلال شهر نوفمبر واحصل على وسام القارئ الماسي وشهادة تميز خاصة من فريق وثبة!',
    5,
    '2026-11',
    TRUE
) ON CONFLICT DO NOTHING;
