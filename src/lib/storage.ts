import { supabase, isSupabaseConfigured } from './supabase';

export async function uploadConditionPhoto(
  file: File | Blob,
  pathPrefix = 'inspection'
): Promise<string> {
  // إذا كان اتصال Supabase متاحاً ومُفعلاً
  if (isSupabaseConfigured() && supabase) {
    try {
      const fileName = `${pathPrefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const filePath = `condition-photos/${fileName}`;

      const { data, error } = await supabase.storage
        .from('wathba-library-media')
        .upload(filePath, file, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from('wathba-library-media')
          .getPublicUrl(filePath);
        return publicUrlData.publicUrl;
      }
    } catch (err) {
      console.warn('Supabase storage upload failed, falling back to local persistent store', err);
    }
  }

  // وضع التخزين المباشر المستمر كـ Data URL محلي
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.readAsDataURL(file);
  });
}
