const SUPABASE_URL = 'https://ojsdglkgejhfgopqiftr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_d_WlqGdnzmvNMvbmXSO3_w_SElybY6k';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Kredensial Khusus Pemilik (Owner) — Silakan ubah sesuai keinginan
const OWNER_CREDENTIALS = {
  username: 'owner_kakindi',
  password: 'kakindi2026'
};