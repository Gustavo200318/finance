import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] Variáveis de ambiente ausentes. Preencha REACT_APP_SUPABASE_URL e REACT_APP_SUPABASE_ANON_KEY em .env.local e reinicie o dev server.'
  );
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const isSupabaseConfigured = Boolean(url && anonKey);

// dev-only: expose for debugging in DevTools console
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  (window as any).supabase = supabase;
  // eslint-disable-next-line no-console
  console.log('[supabase] cliente exposto em window.supabase', {
    url,
    keyPrefix: anonKey?.slice(0, 12),
    keyLength: anonKey?.length,
  });
}
