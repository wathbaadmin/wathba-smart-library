import { AuthSessionRecord, StaffUser, Student } from '../types';
import { isSupabaseConfigured, supabase, getSupabaseClient } from './supabase';
import {
  fetchStudentByCodeFromSupabase,
  recordStudentLoginInSupabase,
  mapSupabaseStudentToStudent,
} from './supabaseSync';

// ============================================================================
// Pure-TypeScript RFC 6234 SHA-256 Implementation (يعمل على HTTPS و HTTP المحلي معاً)
// ============================================================================
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256Bytes(input: Uint8Array): Uint8Array {
  const bitLen = input.length * 8;
  const padLen = ((input.length + 8) >> 6) + 1;
  const padded = new Uint8Array(padLen * 64);
  padded.set(input);
  padded[input.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^ ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^ (w[i - 15] >>> 3);
      const s1 = ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^ ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateCryptoSaltHex(byteLen = 12): string {
  const arr = new Uint8Array(byteLen);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(arr);
}

const HASH_PREFIX = 'sha256$';
const HASH_ROUNDS = 400;

export function isHashedSecret(value?: string): boolean {
  return typeof value === 'string' && value.startsWith(HASH_PREFIX) && value.split('$').length === 3;
}

export function hashAccessCodeSync(plainCode: string, explicitSalt?: string): string {
  const normalized = plainCode.trim();
  const salt = explicitSalt || generateCryptoSaltHex(12);
  const encoder = new TextEncoder();
  let digest = sha256Bytes(encoder.encode(`wathba-v2:${salt}:${normalized}`));
  for (let i = 1; i < HASH_ROUNDS; i++) {
    digest = sha256Bytes(digest);
  }
  return `${HASH_PREFIX}${salt}$${bytesToHex(digest)}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function verifyAccessCodeAgainstHash(plainCode: string, storedHash?: string): boolean {
  const trimmed = plainCode.trim();
  if (!trimmed || !storedHash) return false;
  if (!isHashedSecret(storedHash)) {
    // دعم ترحيل فقط في حال وجود سجل قديم قبل التطبيع
    return constantTimeEqual(trimmed, storedHash.trim());
  }
  const parts = storedHash.split('$');
  const salt = parts[1];
  if (!salt) return false;
  const computed = hashAccessCodeSync(trimmed, salt);
  return constantTimeEqual(computed, storedHash);
}

// ============================================================================
// تطبيع وتطهير سجلات الطلاب لمنع بقاء أي رمز نصي مكشوف في التخزين أو القاعدة
// وإدارة وتجزئة رموز QR الخاصة بدخول الطلاب
// ============================================================================
export function normalizeStudentCode(code: string): string {
  return code.trim().toUpperCase();
}

export function normalizeQrToken(token: string): string {
  return token.trim().toUpperCase();
}

export function hashQrTokenDeterministic(qrToken: string): string {
  const normalized = normalizeQrToken(qrToken);
  if (!normalized) return '';
  const encoder = new TextEncoder();
  const digest = sha256Bytes(encoder.encode(`wathba-qr-v1:${normalized}`));
  return bytesToHex(digest);
}

export function generateUniqueStudentQrToken(
  existingStudents: Student[],
  extraUsedTokens?: Set<string>
): string {
  const usedHashes = new Set<string>();
  const usedRaw = new Set<string>();

  for (const stu of existingStudents || []) {
    if (stu.qrToken) {
      const norm = normalizeQrToken(stu.qrToken);
      usedRaw.add(norm);
      usedHashes.add(hashQrTokenDeterministic(norm));
    }
    if (stu.qrTokenHash) {
      usedHashes.add(stu.qrTokenHash);
    }
    for (const oldHash of stu.revokedQrTokenHashes || []) {
      usedHashes.add(oldHash);
    }
  }

  if (extraUsedTokens) {
    extraUsedTokens.forEach((tok) => {
      const norm = normalizeQrToken(tok);
      usedRaw.add(norm);
      usedHashes.add(hashQrTokenDeterministic(norm));
    });
  }

  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = `WTH-QR-${generateCryptoSaltHex(10).toUpperCase()}`;
    const candidateHash = hashQrTokenDeterministic(candidate);
    if (!usedRaw.has(candidate) && !usedHashes.has(candidateHash)) {
      return candidate;
    }
  }

  return `WTH-QR-${generateCryptoSaltHex(12).toUpperCase()}`;
}

export function sanitizeStudentForPersistence(student: Student): Student {
  const plainFallback = student.rawAccessCode || (!isHashedSecret(student.accessCodeHash) ? student.accessCodeHash : '');
  const secureHash = isHashedSecret(student.accessCodeHash)
    ? student.accessCodeHash
    : hashAccessCodeSync(plainFallback || generateStudentAccessCode(6));

  const now = new Date().toISOString();
  const cleanQrToken = student.qrToken ? normalizeQrToken(student.qrToken) : `WTH-QR-${generateCryptoSaltHex(10).toUpperCase()}`;
  const computedQrHash = hashQrTokenDeterministic(cleanQrToken);

  const { rawAccessCode: _omitted, ...cleanRest } = student;
  return {
    ...cleanRest,
    internalId: normalizeStudentCode(student.internalId),
    accessCodeHash: secureHash,
    accessCodeUpdatedAt: student.accessCodeUpdatedAt || student.createdAt || now,
    qrToken: cleanQrToken,
    qrTokenHash: computedQrHash,
    qrTokenStatus: student.qrTokenStatus || 'active',
    qrLoginEnabled: student.qrLoginEnabled !== false,
    qrTokenVersion: student.qrTokenVersion || 1,
    qrTokenIssuedAt: student.qrTokenIssuedAt || student.createdAt || now,
    revokedQrTokenHashes: Array.isArray(student.revokedQrTokenHashes) ? student.revokedQrTokenHashes : [],
  };
}

export function migrateStudentsPool(pool: Student[]): { students: Student[]; changed: boolean } {
  let changed = false;
  const normalized = (pool || []).map((stu) => {
    const needsMigration =
      Boolean(stu.rawAccessCode) ||
      !isHashedSecret(stu.accessCodeHash) ||
      stu.internalId !== normalizeStudentCode(stu.internalId) ||
      !stu.qrToken ||
      !stu.qrTokenHash ||
      stu.qrTokenStatus === undefined ||
      stu.qrLoginEnabled === undefined;
    if (needsMigration) changed = true;
    return sanitizeStudentForPersistence(stu);
  });
  return { students: normalized, changed };
}

export function generateUniqueStudentCode(existingStudents: Student[], prefix = 'STU'): string {
  const used = new Set(existingStudents.map((s) => normalizeStudentCode(s.internalId)));
  let num = 1001 + existingStudents.length;
  while (used.has(`${prefix}-${num}`)) {
    num += 1;
  }
  return `${prefix}-${num}`;
}

export function generateStudentAccessCode(length = 6): string {
  const chars = '0123456789';
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// ============================================================================
// حماية محاولات الدخول (Rate Limiting & Progressive Lockout)
// ============================================================================
const RATE_LIMIT_KEY = 'wathba_auth_ratelimit_v1';

interface AttemptBucket {
  failedCount: number;
  lastFailedAt: number;
  lockedUntil: number;
}

function loadRateBuckets(): Record<string, AttemptBucket> {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRateBuckets(buckets: Record<string, AttemptBucket>): void {
  try {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(buckets));
  } catch {
    // ignore storage errors
  }
}

export function checkAuthRateLimit(bucketKey: string): {
  allowed: boolean;
  retryAfterSeconds: number;
  failedCount: number;
} {
  const buckets = loadRateBuckets();
  const entry = buckets[bucketKey];
  if (!entry) return { allowed: true, retryAfterSeconds: 0, failedCount: 0 };

  const now = Date.now();
  // Reset stale buckets older than 15 minutes
  if (now - entry.lastFailedAt > 15 * 60 * 1000 && entry.lockedUntil <= now) {
    delete buckets[bucketKey];
    saveRateBuckets(buckets);
    return { allowed: true, retryAfterSeconds: 0, failedCount: 0 };
  }

  if (entry.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
      failedCount: entry.failedCount,
    };
  }

  return { allowed: true, retryAfterSeconds: 0, failedCount: entry.failedCount };
}

export function recordAuthFailure(bucketKey: string): {
  failedCount: number;
  lockedSeconds: number;
} {
  const buckets = loadRateBuckets();
  const now = Date.now();
  const prev = buckets[bucketKey];
  const nextCount = (prev?.failedCount || 0) + 1;

  let lockedSeconds = 0;
  if (nextCount >= 8) {
    lockedSeconds = 300; // 5 minutes
  } else if (nextCount >= 5) {
    lockedSeconds = 30 * Math.pow(2, nextCount - 5); // 30s, 60s, 120s
  }

  buckets[bucketKey] = {
    failedCount: nextCount,
    lastFailedAt: now,
    lockedUntil: lockedSeconds > 0 ? now + lockedSeconds * 1000 : 0,
  };
  saveRateBuckets(buckets);
  return { failedCount: nextCount, lockedSeconds };
}

export function clearAuthFailures(bucketKey: string): void {
  const buckets = loadRateBuckets();
  if (buckets[bucketKey]) {
    delete buckets[bucketKey];
    saveRateBuckets(buckets);
  }
}

// ============================================================================
// إدارة الجلسات الآمنة المستقلة لكل تبويب والمهلة التلقائية لعدم النشاط
// ============================================================================
export const TAB_AUTH_SESSION_KEY = 'midad_tab_auth_session_v3';
export const AUTH_SESSION_STORAGE_KEY = 'midad_tab_auth_session_v3';
export const LEGACY_AUTH_STORAGE_KEY = 'wathba_auth_session_v2';
export const OLD_LEGACY_AUTH_STORAGE_KEY = 'wathba_auth_session_v1';
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 دقيقة من عدم النشاط
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 ساعة كحد أقصى للجلسة

export function getOrCreateTabId(): string {
  if (typeof window === 'undefined') return 'tab-server';
  try {
    let tabId = sessionStorage.getItem('midad_tab_id');
    if (!tabId) {
      tabId = `tab-${Date.now()}-${generateCryptoSaltHex(4)}`;
      sessionStorage.setItem('midad_tab_id', tabId);
    }
    return tabId;
  } catch {
    return `tab-${Date.now()}`;
  }
}

export function createSessionRecord(
  mode: 'student' | 'supervisor' | 'admin',
  student: Student | null,
  staff: StaffUser | null,
  tabId?: string
): AuthSessionRecord {
  const now = Date.now();
  const userId = mode === 'student' ? student?.id || '' : staff?.id || '';
  const currentTabId = tabId || getOrCreateTabId();
  return {
    sessionId: `sess-${generateCryptoSaltHex(8)}`,
    tabId: currentTabId,
    mode,
    userId,
    issuedAt: now,
    lastActivityAt: now,
    expiresAt: now + SESSION_MAX_AGE_MS,
    studentSnapshot: student ? sanitizeStudentForPersistence(student) : undefined,
    staffSnapshot: staff || undefined,
  };
}

export function isSessionExpired(session: AuthSessionRecord, now = Date.now()): boolean {
  if (!session || !session.userId) return true;
  if (now > session.expiresAt) return true;
  if (now - session.lastActivityAt > SESSION_IDLE_TIMEOUT_MS) return true;
  return false;
}

// ============================================================================
// التحقق من دخول الطالب (خادمي عبر Supabase RPC عند التفعيل + محلي محصن)
// ============================================================================
export interface VerifiedStudentLoginResult {
  success: boolean;
  error?: string;
  student?: Student;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
  verifiedByServer?: boolean;
}

export async function verifyStudentLoginSecure(
  studentCodeInput: string,
  accessCodeInput: string,
  localStudentsPool: Student[]
): Promise<VerifiedStudentLoginResult> {
  const normCode = normalizeStudentCode(studentCodeInput);
  const trimmedPin = accessCodeInput.trim();

  if (!normCode || !trimmedPin) {
    return {
      success: false,
      error: 'يرجى إدخال كود الطالب ورمز الدخول.',
    };
  }

  const perCodeBucket = `stu:${normCode}`;
  const globalBucket = 'stu:global';

  const codeLimit = checkAuthRateLimit(perCodeBucket);
  if (!codeLimit.allowed) {
    return {
      success: false,
      rateLimited: true,
      retryAfterSeconds: codeLimit.retryAfterSeconds,
      error: `تم تقييد محاولات الدخول مؤقتاً. يرجى المحاولة بعد ${codeLimit.retryAfterSeconds} ثانية.`,
    };
  }

  const globalLimit = checkAuthRateLimit(globalBucket);
  if (!globalLimit.allowed) {
    return {
      success: false,
      rateLimited: true,
      retryAfterSeconds: globalLimit.retryAfterSeconds,
      error: `تم رصد محاولات متكررة. يرجى الانتظار ${globalLimit.retryAfterSeconds} ثانية قبل إعادة المحاولة.`,
    };
  }

  // 1. المسار الخادمي عند تفعيل Supabase
  if (isSupabaseConfigured()) {
    const client = getSupabaseClient() || supabase;
    if (client) {
      // 1.أ. محاولة التحقق عبر إجراء RPC المخزن في الخادم
      try {
        const { data, error } = await client.rpc('verify_student_login', {
          p_student_code: normCode,
          p_access_code: trimmedPin,
          p_client_key: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 64) : 'web',
        });

        if (!error && data) {
          if (data.success && data.student) {
            clearAuthFailures(perCodeBucket);
            clearAuthFailures(globalBucket);
            return {
              success: true,
              student: sanitizeStudentForPersistence(mapSupabaseStudentToStudent(data.student)),
              verifiedByServer: true,
            };
          }
          recordAuthFailure(perCodeBucket);
          recordAuthFailure(globalBucket);
          return {
            success: false,
            rateLimited: Boolean(data.rate_limited),
            retryAfterSeconds: data.retry_after_seconds,
            error: data.error || 'بيانات الدخول غير صحيحة. يرجى التحقق من كود الطالب ورمز الدخول.',
          };
        }
      } catch {
        // الاستمرار إلى فحص الجدول المباشر في حال عدم تثبيت دالة RPC بعد
      }

      // 1.ب. الاستعلام المباشر من جدول الطلاب المركزي في Supabase (حل جذري يربط الدخول بالسجلات الأصلية)
      try {
        const dbStudent = await fetchStudentByCodeFromSupabase(normCode);
        if (dbStudent) {
          // التحقق من حالة حساب الطالب
          if (dbStudent.status !== 'active') {
            return {
              success: false,
              error: 'هذا الحساب موقوف حالياً، يرجى مراجعة مشرف المكتبة.',
            };
          }

          // فحص هل تم تعيين رمز دخول للطالب مسبقاً
          if (!dbStudent.accessCodeHash || dbStudent.accessCodeHash.trim() === '') {
            return {
              success: false,
              error: 'لم يتم تعيين رمز دخول لهذا الحساب بعد. يرجى مراجعة مشرف المكتبة لتعيين رمز الدخول الخاص بك.',
            };
          }

          // التحقق الآمن والمشفر من رمز الدخول
          const isPinValid = verifyAccessCodeAgainstHash(trimmedPin, dbStudent.accessCodeHash);
          if (!isPinValid) {
            const fail = recordAuthFailure(perCodeBucket);
            recordAuthFailure(globalBucket);
            return {
              success: false,
              rateLimited: fail.lockedSeconds > 0,
              retryAfterSeconds: fail.lockedSeconds || undefined,
              error: 'بيانات الدخول غير صحيحة. يرجى التحقق من كود الطالب ورمز الدخول.',
            };
          }

          // تم التحقق بنجاح من قاعدة البيانات المركزية
          await recordStudentLoginInSupabase(dbStudent.id);
          clearAuthFailures(perCodeBucket);
          clearAuthFailures(globalBucket);

          const loggedInStudent: Student = {
            ...dbStudent,
            failedLoginAttempts: 0,
            lockedUntil: undefined,
            lastLoginAt: new Date().toISOString(),
          };

          return {
            success: true,
            student: sanitizeStudentForPersistence(loggedInStudent),
            verifiedByServer: true,
          };
        }
      } catch (err) {
        console.warn('تعذر التحقق المباشر من قاعدة بيانات الطلاب:', err);
      }
    }
  }

  // 2. التحقق المشفّر المحلي المتطابق في السلوك الأمني مع الخادم (بيئة عدم الاتصال فقط)
  const migrated = migrateStudentsPool(localStudentsPool).students;
  const candidate = migrated.find((s) => normalizeStudentCode(s.internalId) === normCode);

  if (candidate && (!candidate.accessCodeHash || candidate.accessCodeHash.trim() === '')) {
    return {
      success: false,
      error: 'لم يتم تعيين رمز دخول لهذا الحساب بعد. يرجى مراجعة مشرف المكتبة لتعيين رمز الدخول الخاص بك.',
    };
  }

  const validHashMatch = candidate ? verifyAccessCodeAgainstHash(trimmedPin, candidate.accessCodeHash) : false;

  // لا نكشف أبداً هل كود الطالب موجود أم لا إذا فشل التحقق!
  if (!candidate || !validHashMatch) {
    const codeFail = recordAuthFailure(perCodeBucket);
    recordAuthFailure(globalBucket);
    if (codeFail.lockedSeconds > 0) {
      return {
        success: false,
        rateLimited: true,
        retryAfterSeconds: codeFail.lockedSeconds,
        error: `تم تقييد محاولات الدخول مؤقتاً بسبب التكرار. يرجى الانتظار ${codeFail.lockedSeconds} ثانية.`,
      };
    }
    return {
      success: false,
      error: 'بيانات الدخول غير صحيحة. يرجى التحقق من كود الطالب ورمز الدخول.',
    };
  }

  // نتحقق من حالة الحساب فقط بعد مطابقة رمز الدخول السري الصحيح
  if (candidate.status !== 'active') {
    return {
      success: false,
      error: 'هذا الحساب موقوف حالياً، يرجى مراجعة مشرف المكتبة.',
    };
  }

  clearAuthFailures(perCodeBucket);
  clearAuthFailures(globalBucket);

  const loggedInStudent: Student = {
    ...candidate,
    failedLoginAttempts: 0,
    lockedUntil: undefined,
    lastLoginAt: new Date().toISOString(),
  };

  return {
    success: true,
    student: loggedInStudent,
    verifiedByServer: false,
  };
}

// ============================================================================
// التحقق الآمن من دخول الطالب عبر الباركود (QR Code)
// يتحقق من: الإعداد العام، حد المحاولات، البطاقات الملغاة، حالة الحساب، تعطيل QR، والتحقق الإضافي بالرمز
// ============================================================================
export type QrLoginErrorType =
  | 'empty'
  | 'globally_disabled'
  | 'rate_limited'
  | 'revoked'
  | 'invalid'
  | 'disabled'
  | 'suspended'
  | 'requires_pin'
  | 'invalid_pin';

export interface VerifiedStudentQrLoginResult {
  success: boolean;
  error?: string;
  qrErrorType?: QrLoginErrorType;
  requiresPin?: boolean;
  studentCodeHint?: string;
  student?: Student;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
  verifiedByServer?: boolean;
}

export async function verifyStudentQrLoginSecure(params: {
  qrTokenInput: string;
  localStudentsPool: Student[];
  enableStudentQrLogin?: boolean;
  requirePinWithQrLogin?: boolean;
  optionalPin?: string;
}): Promise<VerifiedStudentQrLoginResult> {
  const {
    qrTokenInput,
    localStudentsPool,
    enableStudentQrLogin = true,
    requirePinWithQrLogin = false,
    optionalPin,
  } = params;

  const normalizedToken = normalizeQrToken(qrTokenInput || '');

  if (!enableStudentQrLogin) {
    return {
      success: false,
      qrErrorType: 'globally_disabled',
      error: 'تم تعطيل الدخول بالباركود حالياً من قِبل إدارة المكتبة. يُرجى استخدام الدخول اليدوي بكود الطالب ورمز الدخول.',
    };
  }

  if (!normalizedToken || normalizedToken.length < 6) {
    return {
      success: false,
      qrErrorType: 'empty',
      error: 'لم يتم قراءة رمز QR صالح. وجّه الكاميرا بوضوح نحو بطاقة الطالب.',
    };
  }

  // رفض استخدام كود الطالب أو المعرف الداخلي بدلاً من رمز QR المشفر
  if (/^STU-\d+$/i.test(normalizedToken)) {
    const globalFail = recordAuthFailure('qr:global');
    return {
      success: false,
      qrErrorType: 'invalid',
      rateLimited: globalFail.lockedSeconds > 0,
      retryAfterSeconds: globalFail.lockedSeconds || undefined,
      error: 'هذا الرمز ليس باركود دخول معتمد. يرجى مسح باركود الـ QR المخصص أو الدخول اليدوي برمز الدخول.',
    };
  }

  const tokenHash = hashQrTokenDeterministic(normalizedToken);
  const perTokenBucket = `qr:${tokenHash.slice(0, 12)}`;
  const globalBucket = 'qr:global';

  const tokenLimit = checkAuthRateLimit(perTokenBucket);
  if (!tokenLimit.allowed) {
    return {
      success: false,
      qrErrorType: 'rate_limited',
      rateLimited: true,
      retryAfterSeconds: tokenLimit.retryAfterSeconds,
      error: `تم تقييد محاولات المسح مؤقتاً. يرجى المحاولة بعد ${tokenLimit.retryAfterSeconds} ثانية.`,
    };
  }

  const globalLimit = checkAuthRateLimit(globalBucket);
  if (!globalLimit.allowed) {
    return {
      success: false,
      qrErrorType: 'rate_limited',
      rateLimited: true,
      retryAfterSeconds: globalLimit.retryAfterSeconds,
      error: `تم رصد محاولات متكررة. يرجى الانتظار ${globalLimit.retryAfterSeconds} ثانية قبل إعادة المحاولة.`,
    };
  }

  // 1. المسار الخادمي عند تفعيل Supabase
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.rpc('verify_student_qr_login', {
        p_qr_token: normalizedToken,
        p_pin_code: optionalPin?.trim() || null,
        p_require_pin: requirePinWithQrLogin,
        p_client_key: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 64) : 'web',
      });

      if (!error && data) {
        if (data.success && data.student) {
          clearAuthFailures(perTokenBucket);
          clearAuthFailures(globalBucket);
          return {
            success: true,
            student: sanitizeStudentForPersistence(data.student as Student),
            verifiedByServer: true,
          };
        }

        if (data.requires_pin) {
          return {
            success: false,
            requiresPin: true,
            qrErrorType: data.error_type === 'invalid_pin' ? 'invalid_pin' : 'requires_pin',
            studentCodeHint: data.student_code_hint,
            error: data.error,
            verifiedByServer: true,
          };
        }

        recordAuthFailure(perTokenBucket);
        recordAuthFailure(globalBucket);
        return {
          success: false,
          qrErrorType: (data.error_type as QrLoginErrorType) || 'invalid',
          rateLimited: Boolean(data.rate_limited),
          retryAfterSeconds: data.retry_after_seconds,
          error: data.error || 'تعذر التحقق من باركود الطالب.',
          verifiedByServer: true,
        };
      }
    } catch {
      // Fallback to direct query or local verification if RPC is not deployed yet
    }

    // الاستعلام المباشر عبر رمز الباركود من جدول الطلاب في Supabase
    try {
      const client = getSupabaseClient() || supabase;
      if (client) {
        const { data: dbStudent, error: qrErr } = await client
          .from('students')
          .select('*')
          .or(`qr_token.eq.${normalizedToken},qr_token_hash.eq.${tokenHash}`)
          .maybeSingle();

        if (!qrErr && dbStudent) {
          const mapped = mapSupabaseStudentToStudent(dbStudent);

          if (mapped.status !== 'active') {
            return {
              success: false,
              qrErrorType: 'suspended',
              error: 'هذا الحساب موقوف حالياً، يرجى مراجعة مشرف المكتبة.',
              verifiedByServer: true,
            };
          }

          if (mapped.qrLoginEnabled === false) {
            return {
              success: false,
              qrErrorType: 'disabled',
              error: 'تم تعطيل الدخول بالباركود لهذا الحساب. يُرجى تسجيل الدخول اليدوي بكود الطالب.',
              verifiedByServer: true,
            };
          }

          if (requirePinWithQrLogin) {
            if (!optionalPin || !optionalPin.trim()) {
              return {
                success: false,
                requiresPin: true,
                qrErrorType: 'requires_pin',
                studentCodeHint: mapped.internalId,
                error: 'يرجى إدخال رمز الدخول الإضافي المخصص لحسابك لتأكيد الهوية.',
                verifiedByServer: true,
              };
            }
            if (!mapped.accessCodeHash || !verifyAccessCodeAgainstHash(optionalPin.trim(), mapped.accessCodeHash)) {
              recordAuthFailure(perTokenBucket);
              recordAuthFailure(globalBucket);
              return {
                success: false,
                requiresPin: true,
                qrErrorType: 'invalid_pin',
                studentCodeHint: mapped.internalId,
                error: 'رمز الدخول الإضافي غير صحيح.',
                verifiedByServer: true,
              };
            }
          }

          await recordStudentLoginInSupabase(mapped.id);
          clearAuthFailures(perTokenBucket);
          clearAuthFailures(globalBucket);
          return {
            success: true,
            student: sanitizeStudentForPersistence(mapped),
            verifiedByServer: true,
          };
        }
      }
    } catch (err) {
      console.warn('فشل الاستعلام المباشر بالباركود من Supabase:', err);
    }
  }

  // 2. التحقق المحلّي المحصّن المطابق للخادم
  const migrated = migrateStudentsPool(localStudentsPool).students;

  // فحص هل الباركود الممسوح ضمن الرموز الملغاة أو المعاد إصدارها سابقاً
  const matchedRevokedHistory = migrated.some((s) =>
    (s.revokedQrTokenHashes || []).some((oldHash) => constantTimeEqual(oldHash, tokenHash))
  );

  if (matchedRevokedHistory) {
    const fail = recordAuthFailure(perTokenBucket);
    recordAuthFailure(globalBucket);
    return {
      success: false,
      qrErrorType: 'revoked',
      rateLimited: fail.lockedSeconds > 0,
      retryAfterSeconds: fail.lockedSeconds || undefined,
      error: 'هذا الباركود ملغى أو تم استبداله ببطاقة جديدة. يرجى استخدام البطاقة الحديثة أو الدخول اليدوي.',
    };
  }

  const candidate = migrated.find((s) => {
    const storedHash = s.qrTokenHash || hashQrTokenDeterministic(s.qrToken);
    return constantTimeEqual(storedHash, tokenHash);
  });

  if (!candidate) {
    const fail = recordAuthFailure(perTokenBucket);
    recordAuthFailure(globalBucket);
    if (fail.lockedSeconds > 0) {
      return {
        success: false,
        qrErrorType: 'rate_limited',
        rateLimited: true,
        retryAfterSeconds: fail.lockedSeconds,
        error: `تم تقييد محاولات المسح مؤقتاً بسبب التكرار. يرجى الانتظار ${fail.lockedSeconds} ثانية.`,
      };
    }
    return {
      success: false,
      qrErrorType: 'invalid',
      error: 'رمز الباركود غير مسجل أو غير صالح للدخول.',
    };
  }

  // لا يُسمح بتجاوز إيقاف الحساب عن طريق الباركود
  if (candidate.status !== 'active') {
    return {
      success: false,
      qrErrorType: 'suspended',
      error: 'هذا الحساب موقوف حالياً، يرجى مراجعة إدارة المكتبة.',
    };
  }

  if (candidate.qrTokenStatus === 'revoked') {
    return {
      success: false,
      qrErrorType: 'revoked',
      error: 'تم إلغاء باركود الدخول لهذا الحساب. يرجى مراجعة المشرف لإصدار بطاقة جديدة.',
    };
  }

  if (candidate.qrLoginEnabled === false) {
    return {
      success: false,
      qrErrorType: 'disabled',
      error: 'تم تعطيل الدخول بالباركود لهذا الطالب من قِبل الإدارة. يرجى استخدام الدخول اليدوي.',
    };
  }

  // التحقق الإضافي برمز الدخول (PIN) عند تفعيله من إعدادات الإدارة
  if (requirePinWithQrLogin) {
    const trimmedPin = (optionalPin || '').trim();
    if (!trimmedPin) {
      return {
        success: false,
        requiresPin: true,
        qrErrorType: 'requires_pin',
        studentCodeHint: candidate.internalId,
      };
    }
    const pinOk = verifyAccessCodeAgainstHash(trimmedPin, candidate.accessCodeHash);
    if (!pinOk) {
      const pinFail = recordAuthFailure(`stu:${candidate.internalId}`);
      recordAuthFailure(globalBucket);
      return {
        success: false,
        requiresPin: true,
        qrErrorType: pinFail.lockedSeconds > 0 ? 'rate_limited' : 'invalid_pin',
        rateLimited: pinFail.lockedSeconds > 0,
        retryAfterSeconds: pinFail.lockedSeconds || undefined,
        studentCodeHint: candidate.internalId,
        error:
          pinFail.lockedSeconds > 0
            ? `تم تقييد المحاولات مؤقتاً. يرجى الانتظار ${pinFail.lockedSeconds} ثانية.`
            : 'رمز الدخول الإضافي غير صحيح. يرجى المحاولة مرة أخرى.',
      };
    }
    clearAuthFailures(`stu:${candidate.internalId}`);
  }

  clearAuthFailures(perTokenBucket);
  clearAuthFailures(globalBucket);

  const loggedInStudent: Student = {
    ...candidate,
    failedLoginAttempts: 0,
    lockedUntil: undefined,
    lastLoginAt: new Date().toISOString(),
  };

  return {
    success: true,
    student: loggedInStudent,
    verifiedByServer: false,
  };
}
