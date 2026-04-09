import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://syoihwlnmgcxonjwimpk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ovKzdIWJi_2RFNYqQyiAsA_GjxUrExt';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true, // 🔥 zapisuje session (KLUCZOWE)
    autoRefreshToken: true, // 🔥 odświeża token
    detectSessionInUrl: true,
  },
});
