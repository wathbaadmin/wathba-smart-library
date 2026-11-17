import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CustomSupabaseConfig } from './sync/syncTypes';

export const CUSTOM_SUPABASE_STORAGE_KEY = 'midad_custom_supabase_config_v1';

/**
 * استرجاع إعدادات Supabase المحفوظة يدوياً من لوحة الإدارة إن وُجدت
 */
export function getCustomSupabaseConfig(): CustomSupabaseConfig | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CUSTOM_SUPABASE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.url === 'string' && typeof parsed.anonKey === 'string') {
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse custom Supabase config:', e);
  }
  return null;
}

/**
 * حفظ أو تحديث إعدادات الاتصال السحابي المركزي من لوحة الإدارة
 */
export function saveCustomSupabaseConfig(url: string, anonKey: string): void {
  const trimmedUrl = url.trim();
  const trimmedKey = anonKey.trim();
  const config: CustomSupabaseConfig = {
    url: trimmedUrl,
    anonKey: trimmedKey,
    savedAt: new Date().toISOString(),
    isEnabled: true,
  };
  localStorage.setItem(CUSTOM_SUPABASE_STORAGE_KEY, JSON.stringify(config));
  // إعادة تعيين العميل لإعادة البناء بالإعدادات الجديدة
  resetSupabaseClient();
}

/**
 * مسح إعدادات Supabase المخصصة والعودة للإعدادات الافتراضية
 */
export function clearCustomSupabaseConfig(): void {
  try {
    localStorage.removeItem(CUSTOM_SUPABASE_STORAGE_KEY);
    resetSupabaseClient();
  } catch (e) {
    console.warn('Failed to clear custom Supabase config:', e);
  }
}

/**
 * استخراج الرابط ومفتاح الوصول الفعّالين (الأولوية للإعدادات المخصصة ثم متغيرات البيئة)
 */
export function getEffectiveSupabaseConfig(): {
  url: string;
  anonKey: string;
  source: 'custom_settings' | 'env' | 'none';
} {
  const custom = getCustomSupabaseConfig();
  if (custom && custom.isEnabled && custom.url && custom.anonKey) {
    return {
      url: custom.url,
      anonKey: custom.anonKey,
      source: 'custom_settings',
    };
  }

  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (envUrl && envKey) {
    return {
      url: envUrl,
      anonKey: envKey,
      source: 'env',
    };
  }

  return {
    url: '',
    anonKey: '',
    source: 'none',
  };
}

/**
 * التحقق الذكي من توفر بيانات اتصال صالحة بقاعدة بيانات Supabase المركزية
 */
export function isSupabaseConfigured(): boolean {
  const config = getEffectiveSupabaseConfig();
  if (!config.url || !config.anonKey) return false;

  const isUrlValid =
    config.url.length > 10 &&
    config.url.startsWith('http') &&
    !config.url.includes('your-project-id');

  const isKeyValid =
    config.anonKey.length > 30 &&
    !config.anonKey.includes('...') &&
    config.anonKey !== 'eyJhbGciOiIsInR5cCI6IkpXVCJ9...';

  const storageMode: string = (import.meta.env.VITE_STORAGE_MODE || '').trim().toLowerCase();
  if (storageMode === 'local_only' && config.source === 'env') {
    return false;
  }

  return isUrlValid && isKeyValid;
}

let cachedClient: SupabaseClient | null = null;

export function resetSupabaseClient(): void {
  cachedClient = null;
}

/**
 * إنشاء أو استرجاع عميل Supabase المركزي
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!cachedClient) {
    const config = getEffectiveSupabaseConfig();
    try {
      cachedClient = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        realtime: {
          params: {
            eventsPerSecond: 20,
          },
        },
      });
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return cachedClient;
}

/**
 * فحص الاتصال بقاعدة البيانات المركزية وقياس سرعة الاستجابة (Latency)
 */
export async function testSupabaseConnection(
  customUrl?: string,
  customKey?: string
): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  try {
    let client: SupabaseClient;
    if (customUrl && customKey) {
      client = createClient(customUrl.trim(), customKey.trim(), {
        auth: { persistSession: false },
      });
    } else {
      const liveClient = getSupabaseClient();
      if (!liveClient) {
        return { ok: false, error: 'بيانات اتصال Supabase غير مكتملة أو غير مهيأة.' };
      }
      client = liveClient;
    }

    const start = performance.now();
    // استعلام سريع خفيف جداً لفحص سلامة الاتصال والـ RLS
    const { error } = await client
      .from('categories')
      .select('id')
      .limit(1);

    const latencyMs = Math.round(performance.now() - start);

    if (error) {
      // إذا كان الخطأ متعلقاً بأن الجدول غير موجود أو صلاحية، لكن الاتصال تم
      if (error.code === '42P01') {
        return {
          ok: false,
          error: 'تم الاتصال بقاعدة البيانات بنجاح، ولكن جداول مكتبة مداد لم يتم إنشاؤها بعد. يرجى تطبيق schema.sql من لوحة Supabase.',
          latencyMs,
        };
      }
      return { ok: false, error: error.message || 'فشل الاتصال بقاعدة البيانات.', latencyMs };
    }

    return { ok: true, latencyMs };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'تعذّر الاتصال بخادم قاعدة البيانات.' };
  }
}

export const supabase = getSupabaseClient();
